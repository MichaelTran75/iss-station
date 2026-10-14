// Crew Dragon's Draco thrusters, for the station's Dragon and the Launch view's. Sixteen: four facing forward from the
// forward bulkhead by the docking ring, under the nose cone (they fire only with it open; they make the big
// translation and orbit-raising burns, the deorbit burn too), and twelve round the capsule, three in each of the four
// SuperDraco pods: one canted aft and outward, two across the pod, one each way (roll, and sideways moves in pairs).
// Each gives 400 N (90 lbf) at 300 s of specific impulse on monomethylhydrazine and nitrogen tetroxide, which ignite
// on contact; the flight computer fires them on and off, in pulses as short as 30 ms. The forward four sit where the
// supplied capsule model has them; inside the pods the three are placed by their jobs (the pods' fairings hide them).
// A firing thruster shows a short jet at its nozzle and white exhaust streaming out and spreading (in sunlight its
// droplets and condensate show white); off, the exhaust fades within a second. Dragon frame: x across, +y toward the
// nose cone's hinge, +z forward (the nose).
import * as THREE from 'three';

export const dracoThrust = 400;   // N each
const rad = Math.PI / 180;
export const dracoNozzles = (() => {
    const list = [];
    for (const [x, y] of [[-.57, .39], [-.57, -.39], [.57, -.39], [.57, .39]]) list.push({ at: new THREE.Vector3(x, y, .02), exhaust: new THREE.Vector3(0, 0, 1), forward: true });
    for (const angle of [54.4, 125.6, -125.6, -54.4].map(degrees => degrees * rad)) {
        const radial = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0), tangent = new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0);
        const at = radial.clone().multiplyScalar(1.87).setZ(-2.52);
        list.push({ at, exhaust: radial.clone().multiplyScalar(.5).add(new THREE.Vector3(0, 0, -1)).normalize() });
        for (const side of [-1, 1]) list.push({ at: at.clone().addScaledVector(tangent, side * .17).setZ(-2.42), exhaust: tangent.clone().multiplyScalar(side).addScaledVector(radial, .3).normalize() });
    }
    return list;
})();
// Which thrusters fire to push Dragon along `direction` (its own frame, unit): those whose thrust (against their
// exhaust) lies nearest it, with the forward four only when the cone is open. Writes 0-1 strengths into `out`.
export function selectDracos(direction, coneOpen, strength, out) {
    let best = 0;
    for (let k = 0; k < dracoNozzles.length; k++) {
        const nozzle = dracoNozzles[k], along = nozzle.forward && !coneOpen ? 0 : Math.max(0, -nozzle.exhaust.dot(direction));
        out[k] = along; best = Math.max(best, along);
    }
    for (let k = 0; k < out.length; k++) out[k] = best > 0 && out[k] > .6 * best ? strength * out[k] / best : 0;
    return out;
}
// Attitude hold between burns: now and then a pair of the pods' cross thrusters on opposite pods fires a short pulse
// (a roll or yaw trim). `time` in animation seconds.
export function attitudePulses(time, out) {
    const period = 2.3, beat = Math.floor(time / period), phase = time - beat * period;
    if (phase > .16) return out;
    const hash = Math.abs(Math.sin(beat * 12.9898) * 43758.5453) % 1, pod = Math.floor(hash * 4), side = hash * 8 % 1 < .5 ? 1 : 2;
    const strength = .55 * (1 - phase / .16);
    out[4 + pod * 3 + side] = Math.max(out[4 + pod * 3 + side], strength);
    out[4 + ((pod + 2) % 4) * 3 + side] = Math.max(out[4 + ((pod + 2) % 4) * 3 + side], strength);
    return out;
}

const jetVertex = `attribute float strength; varying float vAlong; varying float vStrength; varying float vFacing;
    void main() {
        vAlong = position.y; vStrength = strength;
        vec4 view = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * mat3(instanceMatrix) * normal), normalize(-view.xyz)));
        gl_Position = projectionMatrix * view;
    }`;
const jetFragment = `varying float vAlong; varying float vStrength; varying float vFacing;
    void main() {
        float glow = vStrength * pow(1. - vAlong, 2.2) * (.35 + .65 * vFacing);
        vec3 colour = mix(vec3(1., .96, .86), vec3(1., .62, .38), smoothstep(0., .6, vAlong));
        gl_FragColor = vec4(colour * glow, glow * .7);
    }`;
const puffVertex = `attribute vec3 offset; attribute float size; attribute float alpha; varying vec2 vQuad; varying float vAlpha;
    void main() {
        vec4 view = modelViewMatrix * vec4(offset, 1.0);
        view.xy += position.xy * size * 2.0;
        vQuad = position.xy * 2.0; vAlpha = alpha;
        gl_Position = projectionMatrix * view;
    }`;
// Readable on the light paper as well as on black: a white core inside a pale blue-grey rim.
const puffFragment = `varying vec2 vQuad; varying float vAlpha;
    void main() {
        float r = length(vQuad);
        if (r > 1.) discard;
        vec3 colour = mix(vec3(1.), vec3(.6, .72, .8), smoothstep(.25, .95, r));
        gl_FragColor = vec4(colour, vAlpha * (1. - smoothstep(.35, 1., r)));
    }`;

// The jets and the exhaust for one Dragon, in `parent`'s frame (the Dragon's own).
export function createDracoPlumes(parent, { jetLength = 1.6, puffSpeed = 9, capacity = 420 } = {}) {
    const count = dracoNozzles.length;
    // Jets: a short cone from each nozzle along its exhaust, 0 at the nozzle to 1 at the tip.
    const cone = new THREE.CylinderGeometry(.42, .05, 1, 14, 1, true).translate(0, .5, 0);
    const strength = new THREE.InstancedBufferAttribute(new Float32Array(count), 1); strength.setUsage(THREE.DynamicDrawUsage);
    cone.setAttribute('strength', strength);
    const jets = new THREE.InstancedMesh(cone, new THREE.ShaderMaterial({ vertexShader: jetVertex, fragmentShader: jetFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }), count);
    jets.frustumCulled = false; jets.renderOrder = 6; jets.userData.puff = true;
    const up = new THREE.Vector3(0, 1, 0), turn = new THREE.Quaternion(), matrix = new THREE.Matrix4(), scale = new THREE.Vector3();
    dracoNozzles.forEach((nozzle, k) => { nozzle.turn = new THREE.Quaternion().setFromUnitVectors(up, nozzle.exhaust); });
    // Exhaust puffs: billboards streaming out of firing nozzles.
    const geometry = new THREE.InstancedBufferGeometry(), plane = new THREE.PlaneGeometry(1, 1);
    geometry.index = plane.index; geometry.setAttribute('position', plane.getAttribute('position'));
    const attribute = (name, size) => { const value = new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size); value.setUsage(THREE.DynamicDrawUsage); geometry.setAttribute(name, value); return value; };
    const offset = attribute('offset', 3), size = attribute('size', 1), alpha = attribute('alpha', 1);
    geometry.instanceCount = 0;
    const puffs = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ vertexShader: puffVertex, fragmentShader: puffFragment, transparent: true, depthWrite: false }));
    puffs.frustumCulled = false; puffs.renderOrder = 5; puffs.userData.puff = true;
    parent.add(jets, puffs);
    const pool = Array.from({ length: capacity }, () => ({ position: new THREE.Vector3(), origin: new THREE.Vector3(), velocity: new THREE.Vector3(), age: 1, life: 1, strength: 0 }));
    let next = 0, seed = 3;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const carry = new Float32Array(count), spread = new THREE.Vector3();
    // `delta` animation seconds since the last call (0 while paused: the exhaust holds still), `firing` 0-1 a nozzle.
    function update(delta, firing) {
        let lit = 0;
        for (let k = 0; k < count; k++) {
            const nozzle = dracoNozzles[k], on = firing[k];
            strength.array[k] = on;
            const length = jetLength * (.55 + .45 * on);
            matrix.compose(nozzle.at, nozzle.turn, scale.set(.5 + .5 * on, length, .5 + .5 * on));
            jets.setMatrixAt(k, matrix);
            if (on > .02) lit++;
            // Exhaust leaves at about 70 puffs a second from a nozzle at full thrust, overlapping into a cone.
            carry[k] += on * 70 * delta;
            while (carry[k] >= 1) {
                carry[k]--;
                const puff = pool[next]; next = (next + 1) % capacity;
                spread.set(random() - .5, random() - .5, random() - .5).multiplyScalar(.75);
                puff.velocity.copy(nozzle.exhaust).add(spread).normalize().multiplyScalar(puffSpeed * (.7 + .6 * random()));
                puff.origin.copy(nozzle.at); puff.position.copy(nozzle.at).addScaledVector(nozzle.exhaust, .15).addScaledVector(puff.velocity, random() * delta);
                puff.age = 0; puff.life = .45 + .45 * random(); puff.strength = on;
            }
        }
        strength.needsUpdate = true; jets.instanceMatrix.needsUpdate = true; jets.visible = lit > 0;
        let shown = 0;
        for (const puff of pool) {
            if (puff.age >= puff.life) continue;
            puff.age += delta; puff.position.addScaledVector(puff.velocity, delta); puff.velocity.multiplyScalar(Math.exp(-delta * 1.2));
            if (puff.age >= puff.life) continue;
            const f = puff.age / puff.life;
            offset.setXYZ(shown, puff.position.x, puff.position.y, puff.position.z);
            // Grows with the distance it has gone (the cone spreads about 30°) and thins as it does.
            size.setX(shown, (.07 + .3 * puff.position.distanceTo(puff.origin)) * (.6 + .4 * puff.strength) * jetLength / 1.6);
            alpha.setX(shown, .42 * puff.strength * (1 - f) ** 1.5 * Math.min(1, f * 10 + .2));
            shown++;
        }
        geometry.instanceCount = shown; offset.needsUpdate = size.needsUpdate = alpha.needsUpdate = true;
        puffs.visible = shown > 0;
    }
    update(0, new Float32Array(count));
    return { update, jets, puffs };
}
