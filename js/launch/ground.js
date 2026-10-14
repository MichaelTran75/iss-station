// The ground round LC-39A for the Launch view: aerial imagery in four nested rings of map tiles, the pad's towers,
// the exhaust cloud at liftoff and the sky seen from inside the atmosphere. Metres in the pad's local frame (x east,
// y up, z south), the ground curved with the Earth.
// - Imagery: USGS National Map orthoimagery (public domain) at about 2 m, 17 m and 130 m a pixel round the pad, and
//   NASA's Blue Marble (GIBS, public domain) at about 1 km out to 1,100 km, its edge fading into the globe's own map; outside the US the USGS tiles are
//   transparent and the coarser ring shows through. Tiles load from those servers when the view first opens.
// - Structures, simplified, where the USGS image shows them: the fixed service structure with its lightning mast and
//   catenary wires, the crew access arm swung clear (as at liftoff), the transporter-erector leaning back, the launch
//   mount over the flame trench, the sound suppression water tower and the two propellant spheres.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { launchSite, padFrame } from '../sim/ascent.js';

const earthRadius = 6371000, rad = Math.PI / 180;
const usgs = (z, x, y) => 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/' + z + '/' + y + '/' + x;
const gibs = (z, x, y) => 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/' + z + '/' + y + '/' + x + '.jpeg';
// Outer ring first: each ring covers 4 × 4 tiles round the pad.
const rings = [{ zoom: 7, url: gibs, segments: 16, fade: true }, { zoom: 10, url: usgs, segments: 8 }, { zoom: 13, url: usgs, segments: 3 }, { zoom: 16, url: usgs, segments: 2 }];
export const mountHeight = 6;   // the rocket stands on the launch mount, its engines 6 m above the pad deck

export function createGround() {
    const group = new THREE.Group(), pad = padFrame();
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    // Latitude and longitude (degrees) on the sphere to the pad's frame.
    function local(latitude, longitude, target) {
        const phi = latitude * rad, lambda = longitude * rad;
        const p = [earthRadius * Math.cos(phi) * Math.cos(lambda) - pad.position[0], earthRadius * Math.cos(phi) * Math.sin(lambda) - pad.position[1], earthRadius * Math.sin(phi) - pad.position[2]];
        return target.set(dot(p, pad.east), dot(p, pad.up), dot(p, pad.south));
    }
    const loader = new THREE.TextureLoader(), point = new THREE.Vector3();
    let pending = 0, failed = 0;
    const status = { get loading() { return pending; }, get failed() { return failed; } };
    rings.forEach(({ zoom, url, segments, fade }, level) => {
        const n = 2 ** zoom, tileX = (launchSite.longitude + 180) / 360 * n;
        const phi = launchSite.latitude * rad, tileY = (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2 * n;
        const x0 = Math.round(tileX) - 2, y0 = Math.round(tileY) - 2;
        for (let tx = x0; tx < x0 + 4; tx++) for (let ty = y0; ty < y0 + 4; ty++) {
            const positions = [], uvs = [], colours = [];
            const indices = [];
            for (let j = 0; j <= segments; j++) for (let i = 0; i <= segments; i++) {
                const u = i / segments, v = j / segments;
                const longitude = (tx + u) / n * 360 - 180, latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + v) / n))) / rad;
                local(latitude, longitude, point); positions.push(point.x, point.y, point.z); uvs.push(u, 1 - v);
                // The outermost ring thins out over its last third into the globe's map beyond it.
                const edge = Math.max(Math.abs(tx + u - x0 - 2), Math.abs(ty + v - y0 - 2)) / 2;
                colours.push(1, 1, 1, fade ? 1 - THREE.MathUtils.smoothstep(edge, .66, 1) : 1);
            }
            for (let j = 0; j < segments; j++) for (let i = 0; i < segments; i++) {
                const a = j * (segments + 1) + i, b = a + 1, c = a + segments + 1, d = c + 1;
                indices.push(a, c, b, b, c, d);
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geometry.setIndex(indices);
            if (fade) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 4));
            // Inner rings draw over outer ones; transparent pixels (no USGS coverage) leave the ring below showing. The
            // outer rings are pushed back rather than the inner ones pulled forward: pulled toward a low camera, the
            // ring under the pad would cover the foot of the mount and the rocket at grazing angles.
            const behind = rings.length - 1 - level;
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, polygonOffset: behind > 0, polygonOffsetFactor: 2 * behind, polygonOffsetUnits: 8 * behind,
                ...(fade ? { vertexColors: true, transparent: true, depthWrite: false } : { alphaTest: .5 }) });
            const mesh = new THREE.Mesh(geometry, material); mesh.visible = false; mesh.renderOrder = -50 + level; mesh.frustumCulled = false;
            group.add(mesh);
            pending++;
            loader.load(url(zoom, tx, ty), texture => {
                texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; material.map = texture; material.needsUpdate = true; mesh.visible = true; pending--;
            }, undefined, () => { pending--; failed++; });
        }
    });

    // Structures. Steel lattice as merged boxes and rods.
    const pieces = new Map();
    const add = (colour, geometry) => { if (!pieces.has(colour)) pieces.set(colour, []); pieces.get(colour).push(geometry); };
    const box = (colour, [x, y, z], [w, h, d], rotation = [0, 0, 0]) => add(colour, new THREE.BoxGeometry(w, h, d).rotateX(rotation[0]).rotateY(rotation[1]).rotateZ(rotation[2]).translate(x, y, z));
    const rod = (colour, a, b, radius) => {
        const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), length = start.distanceTo(end);
        add(colour, new THREE.CylinderGeometry(radius, radius, length, 6).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize())).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2));
    };
    const steel = 0x8e9396, white = 0xe8e9e6, dark = 0x3b3f44, concrete = 0xb9b6ad, trench = 0x2d2b28, tank = 0xdfe2e3;
    // Positions measured on the USGS image of the pad (x east, z south, metres from the launch mount). The tower's
    // and the water tower's lengths are cross-checked against their shadows in the same image.
    // Launch mount on the transporter-erector's base, with four hold-down clamps round the engines, over the flame
    // deflector.
    box(concrete, [0, mountHeight / 2 - .5, 0], [12, mountHeight - 1, 12]);
    box(dark, [0, mountHeight - .3, 0], [7, .6, 7]);
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; box(dark, [Math.cos(a) * 2.6, mountHeight + .9, Math.sin(a) * 2.6], [.7, 2.4, .7]); }
    // Flame trench: 18 m wide, running 105 m north from under the mount (exhaust leaves northward), with its walls.
    box(trench, [0, .12, -58], [18, .25, 104]);
    for (const s of [-1, 1]) box(concrete, [s * 9.6, .9, -58], [1.2, 1.8, 104]);
    add(concrete, new THREE.BoxGeometry(18, 7, 10).translate(0, 1, -5));   // the deflector's bulk under the mount
    // Fixed service structure, 26 m west: 12 m square, floors every 6.1 m (20 ft), 87 m to the roof; the crew
    // access arm at the 66 m level (217 ft) and a 23 m lightning mast on top (110 m in all, as the shadow shows).
    const tower = [-26, 0, -2], half = 6, top = 87, floor = 6.1;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(steel, [tower[0] + sx * half, top / 2, tower[2] + sz * half], [1.1, top, 1.1]);
    for (let y = floor; y <= top; y += floor) {
        for (const s of [-1, 1]) { box(steel, [tower[0], y, tower[2] + s * half], [2 * half, .6, .6]); box(steel, [tower[0] + s * half, y, tower[2]], [.6, .6, 2 * half]); }
        for (const s of [-1, 1]) {
            rod(steel, [tower[0] - half, y - floor, tower[2] + s * half], [tower[0] + half, y, tower[2] + s * half], .2);
            rod(steel, [tower[0] + s * half, y - floor, tower[2] - half], [tower[0] + s * half, y, tower[2] + half], .2);
        }
        box(steel, [tower[0], y - .2, tower[2]], [2 * half, .25, 2 * half]);
    }
    box(0xb4b8ba, [tower[0] - 2, top / 2, tower[2] + 2], [4, top, 4]);   // elevator and stair core
    rod(white, [tower[0], top, tower[2]], [tower[0], top + 23, tower[2]], .55);
    // Crew access arm, swung clear along the tower's north face for liftoff, with the white room at its end.
    box(white, [tower[0] + half - 1, 66, tower[2] - half - 11], [2.8, 3.4, 22]);
    box(white, [tower[0] + half - 1, 66, tower[2] - half - 23.5], [4.4, 4.6, 4.4]);
    // Transporter-erector: the strongback on the rocket's south side, the side it came up the ramp from the hangar,
    // leaning back once its clamps have opened; its base frame runs down the ramp.
    const lean = .035;
    for (const s of [-1, 1]) box(dark, [s * 2.3, 31, 4.9 + 31 * lean], [.9, 62, .9], [lean, 0, 0]);
    for (let y = 4; y < 62; y += 6) box(dark, [0, y, 4.9 + y * lean], [5.4, .45, .6]);
    for (const s of [-1, 1]) box(dark, [s * 3.5, 1.4, 22], [1, 2.8, 34]);
    // Sound suppression water tower, 129 m north and 77 m east: tank 89 m up on four splayed legs.
    const water = [77, 0, -129];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(steel, [water[0] + sx * 6, 0, water[2] + sz * 6], [water[0] + sx * 3, 77, water[2] + sz * 3], .45);
    for (let y = 12; y < 77; y += 13) { const w = 6 - 3 * y / 77; for (const s of [-1, 1]) { box(steel, [water[0], y, water[2] + s * w], [2 * w, .4, .4]); box(steel, [water[0] + s * w, y, water[2]], [.4, .4, 2 * w]); } }
    add(tank, new THREE.SphereGeometry(6.5, 24, 16).scale(1, .9, 1).translate(water[0], 83, water[2]));
    // Propellant spheres at the pad's north corners (liquid oxygen west, the old hydrogen sphere east).
    add(tank, new THREE.SphereGeometry(9.4, 32, 20).translate(-402, 11, -273));
    add(tank, new THREE.SphereGeometry(10.6, 32, 20).translate(370, 12, -259));
    for (const [x, z, r] of [[-402, -273, 7], [370, -259, 8]]) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; rod(steel, [x + Math.cos(a) * r, 0, z + Math.sin(a) * r], [x + Math.cos(a) * r * .9, 9, z + Math.sin(a) * r * .9], .35); }
    const structures = new THREE.Group();
    for (const [colour, geometries] of pieces) structures.add(new THREE.Mesh(mergeGeometries(geometries, false), new THREE.MeshStandardMaterial({ color: colour, roughness: .75, metalness: .2 })));
    group.add(structures);
    // Lightning protection: catenary wires from the mast down to ground anchors 340 m north and south.
    const wire = [];
    for (const s of [-1, 1]) for (let k = 0; k <= 40; k++) {
        const f = k / 40, sag = 30 * 4 * f * (1 - f);
        wire.push(new THREE.Vector3(tower[0], (top + 23) * (1 - f) - sag * (1 - f * .3) + 1, tower[2] + s * 340 * f));
    }
    const catenary = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire.flatMap((point, k) => k % 41 === 40 ? [] : [point, wire[k + 1]])), new THREE.LineBasicMaterial({ color: 0x2b2e31 }));
    group.add(catenary);

    // Exhaust cloud at liftoff: puffs leave the flame trench northward, rise, swell and thin.
    const smokeMap = (() => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; const g = canvas.getContext('2d');
        const glow = g.createRadialGradient(32, 32, 0, 32, 32, 32); glow.addColorStop(0, 'rgba(255,255,255,.9)'); glow.addColorStop(.5, 'rgba(255,255,255,.45)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = glow; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(canvas);
    })();
    let seed = 7; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const puffs = Array.from({ length: 90 }, () => {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeMap, color: 0xe9e6e0, transparent: true, depthWrite: false }));
        sprite.renderOrder = 4; group.add(sprite);
        const side = random() < .75 ? 1 : -1;   // 1: out of the trench's north end; -1: deluge steam at the mount
        return { sprite, born: random() * 16 - 2.5, speed: 22 + random() * 26, heading: side * (1 + (random() - .5) * .5), drift: (random() - .5) * .6, rise: 2 + random() * 5, size: 10 + random() * 14 };
    });
    function updateSmoke(mission, light) {
        for (const puff of puffs) {
            const age = mission - puff.born;
            puff.sprite.visible = age > 0 && age < 70;
            if (!puff.sprite.visible) continue;
            // Most leave by the trench's north end, 100 m from the mount; the rest is steam off the deluge round it.
            const travel = puff.speed * 9 * (1 - Math.exp(-age / 9));   // slows as it spreads
            if (puff.heading < 0) puff.sprite.position.set(travel * puff.drift * 1.6, 4 + puff.rise * age * .6 + Math.sqrt(age) * 3, travel * .35 * Math.sign(puff.drift || 1));
            else puff.sprite.position.set(travel * puff.drift * .8, 3 + puff.rise * age * .8 + Math.sqrt(age) * 3, -40 - Math.min(70, travel * .6) - travel * .5);
            puff.sprite.scale.setScalar(puff.size * (1 + age * .55));
            puff.sprite.material.opacity = Math.min(1, age * 2) * Math.max(0, 1 - age / 70) * .85;
            puff.sprite.material.color.setScalar(.25 + .7 * light);
        }
    }

    // The sky from inside the atmosphere: blue overhead, paler at the horizon, a glow round the Sun; it thins out on the
    // way up and is gone by about 60 km, leaving space (drawn behind by the real sky).
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: { sun: { value: new THREE.Vector3(0, 1, 0) }, up: { value: new THREE.Vector3(0, 1, 0) }, thickness: { value: 1 }, daylight: { value: 1 } },
        vertexShader: 'varying vec3 vDirection; void main() { vDirection = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 sun; uniform vec3 up; uniform float thickness; uniform float daylight; varying vec3 vDirection;
            void main() {
                vec3 direction = normalize(vDirection);
                float elevation = dot(direction, up);
                vec3 zenith = mix(vec3(.03, .07, .2), vec3(.16, .36, .78), thickness);
                vec3 horizon = mix(vec3(.18, .3, .55), vec3(.62, .76, .92), thickness);
                vec3 colour = mix(horizon, zenith, pow(clamp(elevation, 0., 1.), .45));
                float toSun = max(dot(direction, sun), 0.);
                colour += vec3(1., .95, .85) * (pow(toSun, 600.) * 4. + pow(toSun, 12.) * .25 * thickness);
                gl_FragColor = vec4(colour * daylight, clamp(thickness * 1.15, 0., 1.));
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`,
        side: THREE.BackSide, depthTest: false, depthWrite: false, transparent: true
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), skyMaterial); sky.renderOrder = -100; sky.frustumCulled = false;
    // Atmosphere for a camera at `altitude` metres, with the Sun `sunElevation` (sine) above its horizon.
    function updateSky(camera, altitude, sunDirection, sunElevation) {
        sky.position.copy(camera.position);
        const thickness = Math.max(0, 1 - altitude / 60000) ** 2.2;
        skyMaterial.uniforms.thickness.value = thickness;
        skyMaterial.uniforms.sun.value.copy(sunDirection);
        skyMaterial.uniforms.up.value.set(camera.position.x, camera.position.y + earthRadius, camera.position.z).normalize();
        skyMaterial.uniforms.daylight.value = THREE.MathUtils.clamp(.15 + sunElevation * 3, .12, 1);
        sky.visible = thickness > .003;
    }
    // Daylight on the imagery (its own lighting is baked in): dim it when the Sun is low.
    function setDaylight(light) { for (const mesh of group.children) if (mesh.material?.isMeshBasicMaterial) mesh.material.color.setScalar(light); }

    return { group, sky, updateSky, updateSmoke, setDaylight, status };
}
