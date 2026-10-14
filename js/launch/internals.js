// Inside Falcon 9, for the Launch view's cutaway: what the skin hides, in each stage's own frame (metres, the rocket on
// +y with the bottom of its engines at 0, as the model). From what is published:
// - Both stages are one aluminium-lithium tank each, liquid oxygen above kerosene (RP-1) with a common bulkhead between
//   them (insulated in the second stage); the second stage's tank is a shorter version of the first's, made on the
//   same tooling. The first stage's oxygen tank is a monocoque; its kerosene tank has stringers and ring frames. The
//   oxygen feed line runs down the middle of the kerosene tank. Helium for pressurising the tanks is kept cold in
//   carbon-overwrapped bottles (COPVs) submerged in the oxygen: three in the second stage (the Amos-6 investigation);
//   the first stage's are drawn the same way (their number and mounting are not published).
// - Tank sizes: the propellant (405 t in the first stage, 107.5 t in the second, oxygen to kerosene 2.36 by mass)
//   at 1.22 t/m³ for densified oxygen and 0.82 t/m³ for chilled kerosene, in tanks 3.6 m across inside with 2:1
//   elliptical domes; the first stage's comes to 380 m³ and fits from the engine section to the interstage. The
//   second stage's is fitted between the vacuum Merlin and Dragon's trunk in the same ratio of the two volumes.
// - The engine section: the octaweb (an octagonal thrust structure with beams to the middle engine), and each Merlin
//   1D's combustion chamber, single-shaft turbopump, gas generator and its exhaust duct, gimbal and steering
//   actuators; propellant lines 10 cm across from the tanks to the nine pumps.
// - The interstage: the grid fins' actuators at its base and the nitrogen bottles for the cold-gas thrusters.
// Propellant fills each tank to the level its remaining mass gives (settled at the aft end, as it is under thrust or
// falling tail-first through the air). Everything is clipped by the cutaway's plane; the liquids also at their level.
import * as THREE from 'three';

const radius = 1.8, dome = .9;   // inside radius of the tanks; height of a 2:1 elliptical dome
const area = Math.PI * radius * radius, domeVolume = 2 / 3 * Math.PI * radius * radius * dome;
// Tanks: [aft dome apex, kerosene cylinder, oxygen cylinder] (m); each dome sits outside its cylinder's ends.
const tanks = {
    first: { apex: 3, kerosene: 14.44, oxygen: 21.66 },
    second: { apex: 48.15, kerosene: 3.52, oxygen: 4.38 }
};
for (const tank of Object.values(tanks)) {
    tank.aft = tank.apex + dome;                     // aft dome's rim
    tank.common = tank.aft + tank.kerosene;          // common bulkhead's rim (it bows down into the kerosene)
    tank.forward = tank.common + tank.oxygen;        // forward dome's rim
    tank.top = tank.forward + dome;
    tank.keroseneVolume = area * tank.kerosene;      // the aft dome adds what the common dome takes away
    tank.oxygenVolume = area * tank.oxygen + 2 * domeVolume;
}
export const tankLayout = tanks;

// An elliptical dome's outline from its apex to its rim (`down` when it bows downward), as [radius, height] points.
function domeOutline(rim, down, steps = 14) {
    const points = [];
    for (let k = 0; k <= steps; k++) {
        const a = k / steps * Math.PI / 2;
        points.push(new THREE.Vector2(radius * Math.sin(a), rim + (down ? -1 : 1) * dome * Math.cos(a)));
    }
    return points;   // apex first
}
// Volume of a dome's cap `depth` metres deep from its apex.
const cap = depth => { const z = Math.min(dome, Math.max(0, depth)); return Math.PI * radius * radius * z * z * (3 * dome - z) / (3 * dome * dome); };
// The height of a liquid holding `volume` in a tank, from the bottom: kerosene (aft dome, cylinder, less the common dome
// bowing into it) or oxygen (in the bowl of the common dome, the cylinder, the forward dome). Solved by bisection.
function keroseneVolumeAt(tank, y) {
    return cap(y - tank.apex) + area * Math.min(tank.kerosene, Math.max(0, y - tank.aft)) - cap(y - (tank.common - dome));
}
function oxygenVolumeAt(tank, y) {
    const above = Math.max(0, y - tank.forward), t = Math.min(dome, above);
    return cap(y - (tank.common - dome)) + area * Math.min(tank.oxygen, Math.max(0, y - tank.common)) + Math.PI * radius * radius * (t - t * t * t / (3 * dome * dome));
}
function levelFor(volumeAt, tank, volume, low, high) {
    for (let k = 0; k < 40; k++) { const mid = (low + high) / 2; if (volumeAt(tank, mid) < volume) low = mid; else high = mid; }
    return (low + high) / 2;
}
// The liquid's surface radius at a height (inside the domes it narrows).
function radiusAt(tank, y, oxygen) {
    if (oxygen) {
        if (y < tank.common) { const d = (tank.common - y) / dome; return radius * Math.sqrt(Math.max(0, 1 - d * d)); }
        if (y > tank.forward) { const d = (y - tank.forward) / dome; return radius * Math.sqrt(Math.max(0, 1 - d * d)); }
        return radius;
    }
    if (y < tank.aft) { const d = (tank.aft - y) / dome; return radius * Math.sqrt(Math.max(0, 1 - d * d)); }
    return radius;
}

export function createInternals(data) {
    const cut = { first: new THREE.Plane(), second: new THREE.Plane() };
    const surface = (colour, options = {}) => new THREE.MeshStandardMaterial({ color: colour, roughness: .55, metalness: .45, side: THREE.DoubleSide, ...options });
    const kinds = {
        aluminium: [0xb9bec4, { roughness: .45, metalness: .6 }], frame: [0x9aa1a8, { roughness: .5, metalness: .55 }], copv: [0x26282b, { roughness: .35, metalness: .3 }],
        copper: [0x9a6440, { roughness: .4, metalness: .7 }], pump: [0xc4c8cc, { roughness: .35, metalness: .75 }], dark: [0x33363a, { roughness: .6, metalness: .3 }],
        line: [0xd0d3d6, { roughness: .4, metalness: .6 }], insulation: [0xe8e2d4, { roughness: .8, metalness: 0 }], nitrogen: [0x3b4046, { roughness: .4, metalness: .4 }]
    };
    const groups = { first: new THREE.Group(), second: new THREE.Group() };
    const liquids = [];
    // Per stage: one merged mesh per kind of surface, each clipped by that stage's cut.
    const pieces = { first: {}, second: {} };
    const put = (stage, kind, geometry) => (pieces[stage][kind] ||= []).push(geometry);
    const tube = (stage, kind, from, to, r, segments = 8) => {
        const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), length = a.distanceTo(b);
        const geometry = new THREE.CylinderGeometry(r, r, length, segments, 1, true);
        geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
        geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        put(stage, kind, geometry);
    };
    const block = (stage, kind, centre, size, turn = 0) => put(stage, kind, new THREE.BoxGeometry(...size).rotateY(turn).translate(...centre));
    const lathe = (points, segments = 48) => new THREE.LatheGeometry(points, segments);

    for (const stage of ['first', 'second']) {
        const tank = tanks[stage];
        // Bulkheads: the aft dome, the common one (two skins with insulation between in the second stage) and the
        // forward dome.
        put(stage, 'aluminium', lathe(domeOutline(tank.aft, true)));
        put(stage, 'aluminium', lathe(domeOutline(tank.common, true)));
        if (stage === 'second') put(stage, 'insulation', lathe(domeOutline(tank.common + .07, true)));
        put(stage, 'aluminium', lathe(domeOutline(tank.forward, false)));
        // The oxygen line down the middle of the kerosene tank, from the bottom of the common bulkhead.
        tube(stage, 'line', [0, tank.common - dome, 0], [0, tank.apex - (stage === 'first' ? .25 : .05), 0], stage === 'first' ? .3 : .15, 16);
        // Helium bottles in the oxygen, on struts to the wall.
        const copvAt = stage === 'first' ? tank.forward - 1.6 : tank.forward - .9, length = stage === 'first' ? 1.5 : 1.1;
        for (let k = 0; k < 3; k++) {
            const a = k * Math.PI * 2 / 3 + Math.PI / 6, x = Math.cos(a) * 1.05, z = Math.sin(a) * 1.05;
            put(stage, 'copv', new THREE.CapsuleGeometry(.3, length, 6, 16).translate(x, copvAt, z));
            for (const dy of [-length / 3, length / 3]) tube(stage, 'frame', [x * 1.25, copvAt + dy, z * 1.25], [Math.cos(a) * (radius - .02), copvAt + dy, Math.sin(a) * (radius - .02)], .035, 6);
        }
        // The liquids: the volume each tank holds, clipped at its level.
        for (const oxygen of [false, true]) {
            const outline = oxygen
                ? [...domeOutline(tank.common, true), new THREE.Vector2(radius, tank.forward), ...domeOutline(tank.forward, false).reverse()]
                : [...domeOutline(tank.aft, true), new THREE.Vector2(radius, tank.common), ...domeOutline(tank.common, true).reverse()];
            const level = new THREE.Plane(), material = surface(oxygen ? 0x9fd2ff : 0xe2b35c, { roughness: .15, metalness: 0, transparent: true, opacity: oxygen ? .78 : .85, depthWrite: false });
            const body = new THREE.Mesh(lathe(outline.map(p => new THREE.Vector2(Math.max(0, p.x - .015), p.y))), material);
            const top = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), surface(oxygen ? 0xc4e4ff : 0xf0cb7a, { roughness: .1, metalness: 0, transparent: true, opacity: .9, depthWrite: false }));
            body.renderOrder = top.renderOrder = 3;
            groups[stage].add(body, top);
            material.clippingPlanes = [cut[stage], level]; top.material.clippingPlanes = [cut[stage]];
            liquids.push({ stage, oxygen, tank, level, body, top, volume: oxygen ? tank.oxygenVolume : tank.keroseneVolume });
        }
    }

    // First stage: the kerosene tank's stringers and ring frames.
    {
        const tank = tanks.first;
        for (let y = tank.aft + .6; y < tank.common - .3; y += .85) put('first', 'frame', new THREE.TorusGeometry(radius - .04, .035, 4, 64).rotateX(Math.PI / 2).translate(0, y, 0));
        for (let k = 0; k < 72; k++) { const a = k / 72 * Math.PI * 2; block('first', 'frame', [Math.cos(a) * (radius - .02), (tank.aft + tank.common) / 2, Math.sin(a) * (radius - .02)], [.03, tank.kerosene, .05], -a); }
    }
    // The engine section: the octaweb and the nine Merlins' insides; the lines from the tanks to their pumps.
    {
        const merlins = [[0, 0], ...Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 4) * data.engines.merlinRadius, Math.sin(k * Math.PI / 4) * data.engines.merlinRadius])];
        const web = 2.55;
        for (let k = 0; k < 8; k++) {
            const a = (k + .5) * Math.PI / 4, b = (k + 1.5) * Math.PI / 4, r = 1.68;
            tube('first', 'dark', [Math.cos(a) * r, web, Math.sin(a) * r], [Math.cos(b) * r, web, Math.sin(b) * r], .1, 6);
            tube('first', 'dark', [Math.cos(a) * .3, web, Math.sin(a) * .3], [Math.cos(a) * r, web, Math.sin(a) * r], .09, 6);
            tube('first', 'dark', [Math.cos(a) * r, web, Math.sin(a) * r], [Math.cos(a) * r, 1.35, Math.sin(a) * r], .07, 6);
        }
        put('first', 'dark', new THREE.TorusGeometry(.3, .08, 6, 24).rotateX(Math.PI / 2).translate(0, web, 0));
        merlins.forEach(([x, z], k) => {
            const out = k === 0 ? 0 : Math.atan2(z, x), side = out + Math.PI / 2, sx = Math.cos(side), sz = Math.sin(side);
            put('first', 'copper', new THREE.CylinderGeometry(.21, .19, .55, 20).translate(x, 1.95, z));                 // combustion chamber
            put('first', 'copper', new THREE.CylinderGeometry(.19, .12, .28, 20).translate(x, 1.54, z));                 // converging to the throat
            put('first', 'pump', new THREE.SphereGeometry(.21, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, 2.22, z));   // injector dome
            put('first', 'pump', new THREE.CylinderGeometry(.16, .16, .62, 16).translate(x + sx * .37, 2.05, z + sz * .37));   // turbopump
            put('first', 'dark', new THREE.CylinderGeometry(.06, .06, .3, 10).translate(x + sx * .37 + Math.cos(out) * .2, 2.2, z + sz * .37 + Math.sin(out) * .2));   // gas generator
            tube('first', 'pump', [x + sx * .37, 1.74, z + sz * .37], [x + sx * .47, .62, z + sz * .47], .07, 10);      // turbine exhaust duct
            block('first', 'dark', [x, 2.42, z], [.22, .14, .22]);                                                        // gimbal
            for (const s of [-1, 1]) tube('first', 'pump', [x + Math.cos(out + s * .9) * .55, web - .1, z + Math.sin(out + s * .9) * .55], [x + Math.cos(out + s * .9) * .22, 1.9, z + Math.sin(out + s * .9) * .22], .03, 6);   // steering actuators
            // Lines 10 cm across: oxygen from the feed line's foot, kerosene from the aft dome.
            tube('first', 'line', [0, 2.72, 0], [x + sx * .37, 2.36, z + sz * .37], .05, 8);
            const ka = out + .6, kx = Math.cos(ka) * 1.05, kz = Math.sin(ka) * 1.05;
            tube('first', 'insulation', [k === 0 ? .6 : kx, 3.15, k === 0 ? .2 : kz], [x - sx * .3, 2.3, z - sz * .3], .05, 8);
        });
    }
    // The interstage: the grid fins' actuators at its base, nitrogen bottles for the cold-gas thrusters.
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; block('first', 'dark', [Math.cos(a) * 1.45, 42.1, Math.sin(a) * 1.45], [.34, .5, .34], -a); }
    for (const s of [-1, 1]) put('first', 'nitrogen', new THREE.SphereGeometry(.38, 18, 12).translate(0, 46.8, s * 1.35));

    // Merge each stage's pieces by kind, one clipped material each.
    for (const stage of ['first', 'second']) for (const [kind, list] of Object.entries(pieces[stage])) {
        const [colour, options] = kinds[kind], material = surface(colour, options);
        material.clippingPlanes = [cut[stage]];
        const merged = merge(list);
        const mesh = new THREE.Mesh(merged, material); mesh.castShadow = false; mesh.receiveShadow = true;
        groups[stage].add(mesh);
    }
    groups.first.visible = groups.second.visible = false;
    groups.first.name = 'internals'; groups.second.name = 'internals';

    // Each frame of the cutaway: the cut through each stage's axis, square to the camera, keeping the far half; the
    // liquids at the levels of the propellant left (fractions of the stage's load, 0-1).
    const origin = new THREE.Vector3(), axis = new THREE.Vector3(), toCamera = new THREE.Vector3(), point = new THREE.Vector3();
    function update(stages, camera, left) {
        for (const stage of ['first', 'second']) {
            const object = stages[stage];
            object.updateMatrixWorld();
            origin.setFromMatrixPosition(object.matrixWorld); axis.set(0, 1, 0).transformDirection(object.matrixWorld);
            toCamera.subVectors(camera.position, origin); toCamera.addScaledVector(axis, -toCamera.dot(axis));
            if (toCamera.lengthSq() < 1e-9) toCamera.set(1, 0, 0).transformDirection(object.matrixWorld);
            toCamera.normalize();
            cut[stage].setFromNormalAndCoplanarPoint(toCamera.negate(), origin);
        }
        for (const liquid of liquids) {
            const { tank, oxygen, level, body, top } = liquid, object = stages[liquid.stage];
            const volume = .97 * liquid.volume * Math.min(1, Math.max(0, left[liquid.stage]));
            const empty = volume < .05;
            body.visible = top.visible = !empty;
            if (empty) continue;
            const y = oxygen ? levelFor(oxygenVolumeAt, tank, volume, tank.common - dome, tank.top) : levelFor(keroseneVolumeAt, tank, volume, tank.apex, tank.common);
            const r = radiusAt(tank, y, oxygen) - .02;
            top.position.set(0, y, 0); top.scale.setScalar(Math.max(.01, r));
            point.set(0, y, 0).applyMatrix4(object.matrixWorld); axis.set(0, 1, 0).transformDirection(object.matrixWorld);
            level.setFromNormalAndCoplanarPoint(axis.negate(), point);
        }
    }
    function setShown(on) { groups.first.visible = groups.second.visible = on; }
    return { first: groups.first, second: groups.second, cut, update, setShown };
}

// Merge non-indexed copies of geometries (positions and normals only).
function merge(list) {
    const parts = list.map(geometry => geometry.index ? geometry.toNonIndexed() : geometry);
    let count = 0; for (const geometry of parts) count += geometry.attributes.position.count;
    const position = new Float32Array(count * 3), normal = new Float32Array(count * 3);
    let at = 0;
    for (const geometry of parts) {
        position.set(geometry.attributes.position.array, at * 3); normal.set(geometry.attributes.normal.array, at * 3);
        at += geometry.attributes.position.count;
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(position, 3)); merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    merged.computeBoundingSphere();
    return merged;
}
