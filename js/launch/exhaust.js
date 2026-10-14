// Exhaust in the air for the Launch view: the cloud at the pad and the trail the rocket leaves up through the
// atmosphere, both carried by the day's wind (js/sim/wind.js). Metres in the pad's frame (x east, y up, z south).
// - The cloud: puffs from three sources while the Merlins fire at the pad and just above it: out of the flame trench's
//   north end (the deflector turns the exhaust there), off the deck once the rocket is high enough for its plume to
//   strike it, and steam off the deluge water round the mount. Each puff is a parcel of turbulent jet: it slows as it
//   draws in air (its speed falls as 1/(1 + v₀t/L), a round jet's decay), grows with what it entrains (a tenth of its
//   speed relative to the air) and by diffusion, rises while it is hotter than the air, jostles with the turbulence
//   (a Langevin walk, as the airport page's smoke does) and drifts with the wind. Simulated in steps; a jump in time
//   replays it from ignition.
// - The trail: puffs left behind the flame along the flight path, each from the moment the rocket passed. A puff
//   rides the wind at its height, spreads by turbulent diffusion (faster in the lowest two kilometres, where the
//   afternoon air churns) and thins as it spreads; dense and white in the moist low air, a contrail again in the
//   cold air near 10 km, faint above 30 km.
// Drawn as lit, soft, camera-facing puffs, sorted back to front.
import * as THREE from 'three';
import { windAt } from '../sim/wind.js';
import { air, vehicleState } from '../sim/ascent.js';
import { clusterPlume } from '../sim/plume.js';
import { terrainHeight } from './complex.js';
import { mountHeight } from './ground.js';

const puffVertex = `attribute vec3 offset; attribute float size; attribute float alpha; attribute vec3 tint; attribute float seed;
    varying vec2 vQuad; varying float vAlpha; varying vec3 vTint; varying float vSeed; varying vec3 vWorld;
    void main() {
        float c = cos(seed * 6.2832), s = sin(seed * 6.2832);
        vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
        vec4 view = modelViewMatrix * vec4(offset, 1.0);
        view.xy += q * size * 2.0;
        vQuad = position.xy * 2.0; vAlpha = alpha; vTint = tint; vSeed = seed; vWorld = offset;
        gl_Position = projectionMatrix * view;
    }`;
const puffFragment = `uniform sampler2D map; uniform vec3 sunView; uniform vec3 sunColour; uniform vec3 skyColour; uniform vec3 glowAt; uniform vec3 glowColour; uniform float glowRange;
    varying vec2 vQuad; varying float vAlpha; varying vec3 vTint; varying float vSeed; varying vec3 vWorld;
    void main() {
        float r2 = dot(vQuad, vQuad);
        if (r2 > 1.0) discard;
        vec4 tex = texture2D(map, vQuad * .5 + .5);
        // A soft sphere's normal, lit by the Sun and the sky, with the flame's glow underneath.
        vec3 n = normalize(vec3(vQuad, sqrt(max(0., 1. - r2))));
        float sun = .12 + .88 * max(0., dot(n, sunView));
        vec3 light = skyColour * (.55 + .45 * n.y) + sunColour * sun;
        float d = length(vWorld - glowAt) / glowRange;
        light += glowColour / (1. + d * d);
        float a = vAlpha * smoothstep(0., .9, tex.a * 1.6 - r2 * .55) * smoothstep(1., .3, sqrt(r2));
        gl_FragColor = vec4(vTint * light * (.8 + .2 * tex.r), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }`;
// A cloudy puff: overlapping soft blobs, denser at the middle.
function puffTexture() {
    const size = 128, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    let seed = 11; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 70; k++) {
        const angle = random() * Math.PI * 2, reach = Math.sqrt(random()) * size * .3, r = size * (.08 + random() * .16);
        const x = size / 2 + Math.cos(angle) * reach, y = size / 2 + Math.sin(angle) * reach, shade = 200 + Math.round(random() * 55);
        const blob = g.createRadialGradient(x, y, 0, x, y, r);
        blob.addColorStop(0, `rgba(${shade},${shade},${shade},.42)`); blob.addColorStop(1, `rgba(${shade},${shade},${shade},0)`);
        g.fillStyle = blob; g.fillRect(0, 0, size, size);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.NoColorSpace;
    return texture;
}

// A batch of puffs: positions, sizes, opacities and tints written each frame, back to front from the camera.
function puffBatch(capacity, map, renderOrder) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = new THREE.PlaneGeometry(1, 1).index;
    geometry.setAttribute('position', new THREE.PlaneGeometry(1, 1).getAttribute('position'));
    const attribute = (name, size) => { const value = new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size); value.setUsage(THREE.DynamicDrawUsage); geometry.setAttribute(name, value); return value; };
    const offset = attribute('offset', 3), size = attribute('size', 1), alpha = attribute('alpha', 1), tint = attribute('tint', 3), seed = attribute('seed', 1);
    geometry.instanceCount = 0;
    const material = new THREE.ShaderMaterial({
        uniforms: { map: { value: map }, sunView: { value: new THREE.Vector3(0, 1, 0) }, sunColour: { value: new THREE.Color(1, .97, .92) }, skyColour: { value: new THREE.Color(.42, .46, .52) },
            glowAt: { value: new THREE.Vector3() }, glowColour: { value: new THREE.Color(0, 0, 0) }, glowRange: { value: 40 } },
        vertexShader: puffVertex, fragmentShader: puffFragment, transparent: true, depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false; mesh.renderOrder = renderOrder;
    const order = new Uint32Array(capacity), depth = new Float32Array(capacity);
    // Write `count` puffs from the source arrays in back-to-front order for `camera`.
    function write(count, source, camera) {
        const e = camera.matrixWorldInverse.elements;
        for (let k = 0; k < count; k++) { order[k] = k; const x = source.x[k], y = source.y[k], z = source.z[k]; depth[k] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
        const sorted = Array.prototype.slice.call(order.subarray(0, count)).sort((a, b) => depth[a] - depth[b]);
        for (let j = 0; j < count; j++) {
            const k = sorted[j];
            offset.array[j * 3] = source.x[k]; offset.array[j * 3 + 1] = source.y[k]; offset.array[j * 3 + 2] = source.z[k];
            size.array[j] = source.r[k]; alpha.array[j] = source.a[k]; seed.array[j] = source.s[k];
            tint.array[j * 3] = source.c[k * 3]; tint.array[j * 3 + 1] = source.c[k * 3 + 1]; tint.array[j * 3 + 2] = source.c[k * 3 + 2];
        }
        for (const value of [offset, size, alpha, tint, seed]) { value.needsUpdate = true; value.addUpdateRange?.(0, count * value.itemSize); }
        geometry.instanceCount = count;
    }
    return { mesh, material, write };
}
const columns = capacity => ({ x: new Float32Array(capacity), y: new Float32Array(capacity), z: new Float32Array(capacity), r: new Float32Array(capacity), a: new Float32Array(capacity), s: new Float32Array(capacity), c: new Float32Array(capacity * 3) });

export function createExhaust() {
    const group = new THREE.Group(), map = puffTexture();
    const wind = [0, 0];

    // The cloud at the pad.
    const cloudCapacity = 1100, cloudBatch = puffBatch(cloudCapacity, map, 4), cloudOut = columns(cloudCapacity);
    group.add(cloudBatch.mesh);
    const P = {   // particle state
        x: new Float32Array(cloudCapacity), y: new Float32Array(cloudCapacity), z: new Float32Array(cloudCapacity),
        vx: new Float32Array(cloudCapacity), vy: new Float32Array(cloudCapacity), vz: new Float32Array(cloudCapacity),
        tx: new Float32Array(cloudCapacity), ty: new Float32Array(cloudCapacity), tz: new Float32Array(cloudCapacity),   // turbulent velocity
        r: new Float32Array(cloudCapacity), r0: new Float32Array(cloudCapacity), age: new Float32Array(cloudCapacity), life: new Float32Array(cloudCapacity),
        heat: new Float32Array(cloudCapacity), steam: new Uint8Array(cloudCapacity), seed: new Float32Array(cloudCapacity), count: 0
    };
    let seed = 1;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const gauss = () => { let s = 0; for (let k = 0; k < 4; k++) s += random(); return (s - 2) * 1.732; };
    let simTime = null, carry = { trench: 0, deck: 0, steam: 0 };
    function reset() { P.count = 0; seed = 1; carry = { trench: 0, deck: 0, steam: 0 }; simTime = -3; }
    function emit(x, y, z, vx, vy, vz, r, life, heat, steam) {
        let k = P.count;
        if (k >= cloudCapacity) {   // full: reuse the oldest
            let oldest = 0; for (let j = 1; j < P.count; j++) if (P.age[j] / P.life[j] > P.age[oldest] / P.life[oldest]) oldest = j;
            k = oldest;
        } else P.count++;
        P.x[k] = x; P.y[k] = y; P.z[k] = z; P.vx[k] = vx; P.vy[k] = vy; P.vz[k] = vz; P.tx[k] = P.ty[k] = P.tz[k] = 0;
        P.r[k] = P.r0[k] = r; P.age[k] = 0; P.life[k] = life; P.heat[k] = heat; P.steam[k] = steam ? 1 : 0; P.seed[k] = random();
    }
    // The rocket's engines above the deck and its thrust share at a mission time.
    function engineState(time) {
        if (time < -3) return { height: 0, thrust: 0 };
        const state = vehicleState(time);
        return { height: state.altitude, thrust: Math.max(0, state.engines) / 9 };
    }
    const deckLevel = terrainHeight(0, 0), mount = mountHeight;
    function step(time, dt) {
        const { height, thrust } = engineState(time), above = height + mount;   // engines' height over the deck
        // Sources: [puffs a second].
        const trench = thrust * 46 * (1 - THREE.MathUtils.smoothstep(above, 30, 110));
        const deck = thrust * 32 * THREE.MathUtils.smoothstep(above, 10, 28) * (1 - THREE.MathUtils.smoothstep(above, 90, 220));
        const steam = time > -3 && time < 16 ? 16 * Math.min(1, (time + 3) / 2) * (time > 8 ? (16 - time) / 8 : 1) : 0;
        carry.trench += trench * dt; carry.deck += deck * dt; carry.steam += steam * dt;
        while (carry.trench >= 1) {
            carry.trench--;
            const spread = gauss() * .32, speed = 62 + random() * 30;
            emit((random() - .5) * 14, 3 + random() * 7, -104 - random() * 6, Math.sin(spread) * speed, 3 + random() * 9, -Math.cos(spread) * speed, 5 + random() * 3, 70 + random() * 60, .55, false);
        }
        while (carry.deck >= 1) {
            carry.deck--;
            const angle = random() * Math.PI * 2, speed = 22 + random() * 26, at = 8 + random() * 10;
            emit(Math.cos(angle) * at, deckLevel + 2 + random() * 4, Math.sin(angle) * at, Math.cos(angle) * speed, 2 + random() * 6, Math.sin(angle) * speed, 4 + random() * 3, 60 + random() * 50, .4, false);
        }
        while (carry.steam >= 1) {
            carry.steam--;
            const angle = random() * Math.PI * 2, at = 4 + random() * 14;
            emit(Math.cos(angle) * at, deckLevel + 1 + random() * 3, Math.sin(angle) * at, Math.cos(angle) * (4 + random() * 8), 1 + random() * 3, Math.sin(angle) * (4 + random() * 8), 3 + random() * 3, 50 + random() * 40, .1, true);
        }
        // Motion.
        const decay = Math.exp(-dt / 1.6), kick = Math.sqrt(1 - decay * decay);
        for (let k = 0; k < P.count; k++) {
            if (P.age[k] >= P.life[k]) continue;
            windAt(Math.max(0, P.y[k]), wind);
            const wx = P.vx[k] - wind[0], wy = P.vy[k], wz = P.vz[k] - wind[1], w = Math.hypot(wx, wy, wz);
            // Jet decay toward the wind, entrainment growth, buoyancy cooling as it mixes, turbulence.
            const slow = 1 / (1 + w * dt / 55);
            P.vx[k] = wind[0] + wx * slow; P.vz[k] = wind[1] + wz * slow; P.vy[k] = wy * slow;
            P.r[k] += (.1 * w + .32) * dt;
            P.heat[k] *= Math.exp(-dt / 9);
            P.vy[k] += 9.8 * P.heat[k] * dt * Math.pow(P.r0[k] / P.r[k], 1.5);
            const sigma = .14 * w + .7;
            P.tx[k] = P.tx[k] * decay + sigma * kick * gauss(); P.ty[k] = P.ty[k] * decay + sigma * .6 * kick * gauss(); P.tz[k] = P.tz[k] * decay + sigma * kick * gauss();
            P.x[k] += (P.vx[k] + P.tx[k]) * dt; P.y[k] += (P.vy[k] + P.ty[k]) * dt; P.z[k] += (P.vz[k] + P.tz[k]) * dt;
            // The ground (and the mound) stops the cloud's base: it rolls along it.
            const floor = terrainHeight(P.x[k], P.z[k]) + P.r[k] * .45;
            if (P.y[k] < floor) { P.y[k] = floor; if (P.vy[k] < 0) P.vy[k] *= -.2; }
            P.age[k] += dt;
        }
    }
    function simulateTo(time) {
        if (simTime === null || time < simTime - 1e-6 || time - simTime > 3) {
            reset();
            if (time < -3) { simTime = time; return; }
        }
        // Catching up after a jump takes coarser steps once the engines have climbed away (the cloud only drifts then).
        while (simTime < time - 1e-9) { const dt = Math.min(time - simTime > 2 && simTime > 30 ? .5 : .1, time - simTime); step(simTime, dt); simTime += dt; }
    }

    // The trail: puffs laid at the plume's tail along the flight path, closer together low down where the plume is
    // narrow.
    const trail = [];
    {
        let t = 1.5;
        while (t < 165 && trail.length < 2200) {
            const state = vehicleState(t), atm = air(state.altitude);
            const plume = clusterPlume({ throttle: Math.max(.4, Math.min(1, state.engines / 9)), pressure: atm.p, density: atm.rho, airspeed: state.speed });
            const tailBack = Math.min(plume.flame * .8, 400), radius = Math.min(300, 12 + plume.jetDiameter * 1.5 + .12 * tailBack);
            const height = state.altitude;
            // Opacity: dense in the moist lowest kilometres, a contrail between 8 and 13 km, faint above 30 km.
            const opacity = .9 * Math.exp(-height / 8000) + .3 * Math.exp(-(((height - 10500) / 2600) ** 2)) + .06 * Math.exp(-height / 40000);
            if (state.engines > 0) trail.push({ t, position: state.position, direction: state.direction, back: tailBack, radius, opacity, height, seed: (trail.length * .618) % 1 });
            const spacing = Math.max(3, Math.min(240, radius * .7));
            t += Math.max(.02, spacing / Math.max(30, state.speed));
        }
    }
    const trailBatch = puffBatch(trail.length, map, 3), trailOut = columns(trail.length);
    group.add(trailBatch.mesh);
    const trailLift = terrainHeight(0, 0) + mount;

    const sunView = new THREE.Vector3(), glow = new THREE.Vector3();
    // Update for a mission time: `sun` the Sun's direction in the pad's frame, `light` 0-1 daylight, `flame` the
    // first stage's plume (world position of its middle, thrust share) for the glow on the cloud.
    function update(mission, camera, sun, light, flame) {
        // Cloud.
        simulateTo(Math.min(mission, 900));
        let count = 0;
        const shown = mission > -3.2 && mission < 900;
        if (shown) for (let k = 0; k < P.count; k++) {
            const age = P.age[k], life = P.life[k];
            if (age >= life) continue;
            const thin = Math.pow(P.r0[k] / P.r[k], .55) * Math.min(1, age * 3) * (1 - THREE.MathUtils.smoothstep(age, life * .55, life));
            if (thin < .01) continue;
            cloudOut.x[count] = P.x[k]; cloudOut.y[count] = P.y[k]; cloudOut.z[count] = P.z[k]; cloudOut.r[count] = P.r[k];
            cloudOut.a[count] = (P.steam[k] ? .62 : .72) * thin; cloudOut.s[count] = P.seed[k];
            const shade = P.steam[k] ? .97 : .9 - .1 * Math.exp(-age / 6);
            cloudOut.c[count * 3] = shade; cloudOut.c[count * 3 + 1] = shade * (P.steam[k] ? 1 : .975); cloudOut.c[count * 3 + 2] = shade * (P.steam[k] ? 1.01 : .94);
            count++;
        }
        cloudBatch.write(count, cloudOut, camera);
        // Trail.
        let laid = 0;
        if (mission > 0 && mission < 3600) for (const puff of trail) {
            if (puff.t > mission) break;
            const age = mission - puff.t;
            windAt(puff.height, wind);
            const diffusion = puff.height < 2000 ? 80 : 22, r = Math.sqrt(puff.radius ** 2 + 2 * diffusion * age);
            const fade = Math.min(1, age * 2) * Math.pow(puff.radius / r, 1.1);
            if (fade * puff.opacity < .004) continue;
            const lift = puff.height < 3000 ? trailLift * (1 - puff.height / 3000) : 0;
            trailOut.x[laid] = puff.position[0] - puff.direction[0] * puff.back + wind[0] * age;
            trailOut.y[laid] = puff.position[1] + lift - puff.direction[1] * puff.back;
            trailOut.z[laid] = puff.position[2] - puff.direction[2] * puff.back + wind[1] * age;
            trailOut.r[laid] = r; trailOut.a[laid] = puff.opacity * fade; trailOut.s[laid] = puff.seed;
            trailOut.c[laid * 3] = trailOut.c[laid * 3 + 1] = .95; trailOut.c[laid * 3 + 2] = .97;
            laid++;
        }
        trailBatch.write(laid, trailOut, camera);
        // Light: the Sun and sky, and the flame's orange glow on the cloud.
        sunView.copy(sun).transformDirection(camera.matrixWorldInverse);
        for (const batch of [cloudBatch, trailBatch]) {
            const u = batch.material.uniforms;
            u.sunView.value.copy(sunView);
            u.sunColour.value.setRGB(1, .97, .92).multiplyScalar(.95 * light);
            u.skyColour.value.setRGB(.42, .47, .55).multiplyScalar(.35 + .65 * light);
            u.glowAt.value.copy(flame.position);
            u.glowColour.value.setRGB(1.6, .75, .3).multiplyScalar(flame.strength);
            u.glowRange.value = flame.range;
        }
        cloudBatch.mesh.visible = count > 0; trailBatch.mesh.visible = laid > 0;
        return glow;
    }
    return { group, update };
}
