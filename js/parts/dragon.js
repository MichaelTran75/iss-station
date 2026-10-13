// SpaceX Crew Dragon.
import * as THREE from 'three';
import { assetData } from '../core/data.js';
import { markShadowsDirty } from '../core/quality.js';
import { Kit, material, shapes } from '../core/kit.js';
import { ghostOpacity, part, pma2BaseZ, pmaReferenceLength, pmaReferenceOffset, ring } from '../core/station.js';
import { modernSolar, payloadCanvas, payloadPillow } from '../core/surfaces.js';
import { pmaArray } from '../core/pma.js';
import { createRendezvous, issMeanMotion, rendezvousWaypoints } from '../sim/rendezvous.js';

// BEGIN DRAGON REFERENCE: Crew Dragon measured from the supplied GLB; the zip's scene.gltf and scene.bin hold the
// same bytes. Each part is a GLB mesh component in the Dragon frame, in metres at the GLB's 1:10 scale, quantised to
// 1/4096 m: x across, +y toward the nose-cone hinge, +z forward along the docking axis, origin on the face of the
// white collar round the docking ring. Nose-cone parts are measured from the hinge. Parts keep the GLB's own vertex
// splits, so recomputed normals reproduce its shading. ['b' body | 'n' nose cone, surface, positions, indices]
const dragonReference = assetData.dragonReference;
// END DRAGON REFERENCE
// BEGIN DRAGON CREW REFERENCE: the supplied SpaceX suit model (Diuis, CC BY 4.0), seated by a simple rig that bends
// hip, knee, shoulder and elbow about joints measured on the mesh. Metres, quantised to 1/4096 m, from the hip midpoint
// in the suit's own frame: x across, -y forward, z up. Triangles are grouped by the base-colour texture's two tones
// (white suit, black panels) plus the helmet visor. `rig` holds the seated right arm and hand: 22 bones as [name, parent,
// pivot] (upper arm, forearm, three forearm segments that share its twist, the hand, three joints in each finger and the
// thumb, placed on the glove's own finger axes), the skin as [vertex (2 bytes), bone, bone, weight of the second] for
// every vertex not wholly on the torso, the hand's knuckle-line and palm axes, the index fingertip relaxed and pointing,
// and the pointing hand's finger joint rotations (index out, the others curled, the thumb across them).
const dragonCrewSuit = assetData.dragonCrewSuit;
// Capsule radius in metres by height z on the Dragon axis: the median of the outer surface round the capsule, and the
// heat-shield deck 0.06 m inside the dish ([r, z] pairs).
const dragonCabinTables = {"z":[-4.22,-4.18,-4.14,-4.1,-4.06,-4.02,-3.98,-3.94,-3.9,-3.86,-3.82,-3.78,-3.74,-3.7,-3.66,-3.62,-3.58,-3.54,-3.5,-3.46,-3.42,-3.38,-3.34,-3.3,-3.26,-3.22,-3.18,-3.14,-3.1,-3.06,-3.02,-2.98,-2.94,-2.9,-2.86,-2.82,-2.78,-2.74,-2.7,-2.66,-2.62,-2.58,-2.54,-2.5,-2.46,-2.42,-2.38,-2.34,-2.3,-2.26,-2.22,-2.18,-2.14,-2.1,-2.06,-2.02,-1.98,-1.94,-1.9,-1.86,-1.82,-1.78,-1.74,-1.7,-1.66,-1.62,-1.58,-1.54,-1.5,-1.46,-1.42,-1.38,-1.34,-1.3,-1.26,-1.22,-1.18,-1.14,-1.1,-1.06,-1.02,-0.98,-0.94,-0.9,-0.86,-0.82,-0.78,-0.74,-0.7,-0.66,-0.62,-0.58,-0.54,-0.5,-0.46,-0.42,-0.38,-0.34,-0.3,-0.26,-0.22,-0.18,-0.14,-0.1,-0.06,-0.02],"median":[0.0,0.602,0.903,1.134,1.326,1.489,1.603,1.712,1.805,1.887,1.931,1.961,1.982,1.994,1.999,1.998,1.996,1.994,1.985,1.976,1.972,1.969,1.965,1.962,1.959,1.955,1.952,1.949,1.945,1.94,1.933,1.926,1.919,1.912,1.905,1.898,1.89,1.881,1.873,1.865,1.856,1.848,1.839,1.829,1.819,1.809,1.799,1.789,1.779,1.768,1.756,1.744,1.732,1.72,1.712,1.695,1.681,1.667,1.657,1.643,1.628,1.613,1.597,1.578,1.562,1.547,1.535,1.516,1.501,1.485,1.47,1.454,1.439,1.423,1.408,1.392,1.377,1.362,1.346,1.331,1.314,1.298,1.282,1.265,1.248,1.23,1.212,1.195,1.177,1.158,1.139,1.12,1.101,1.082,1.062,1.042,1.022,1.002,0.982,0.961,0.877,0.861,0.846,0.83,0.814,0.797],"bowl":[[0.0,-4.16],[0.597,-4.12],[0.894,-4.081],[1.123,-4.041],[1.313,-4.001],[1.472,-3.962],[1.583,-3.924],[1.69,-3.884],[1.78,-3.845],[1.855,-3.809],[1.887,-3.779],[1.91,-3.748],[1.927,-3.717],[1.935,-3.688],[1.939,-3.657],[1.938,-3.622],[1.936,-3.583],[1.935,-3.548],[1.926,-3.513]]};
// END DRAGON CREW REFERENCE
function dragonMesh(positions, indices, surface) {
    const quantised = pmaArray(positions, Int16Array), position = new Float32Array(quantised.length);
    for (let i = 0; i < quantised.length; i++) position[i] = quantised[i] * dragonReference.quantum;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setIndex(new THREE.BufferAttribute(pmaArray(indices, Uint16Array), 1));
    geometry.computeVertexNormals();
    // Only the trunk cells carry a texture: it wraps the 1.86 m cylinder by arc length and runs down its height.
    const uv = new Float32Array(position.length / 3 * 2);
    if (surface === 'solar') for (let i = 0; i < uv.length / 2; i++) {
        uv[i * 2] = Math.atan2(position[i * 3], position[i * 3 + 1]) * 1.86 / 1.6;
        uv[i * 2 + 1] = position[i * 3 + 2] / 7.2;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geometry;
}
const dragonCells = modernSolar.clone(); dragonCells.wrapS = dragonCells.wrapT = THREE.RepeatWrapping; dragonCells.needsUpdate = true;
const dragonSkins = {
    white: material(0xf0f2ee, .5, .16), black: material(0x1c1f24, .58, .3), metal: material(0x3b4045, .42, .55),
    glass: material(0x183241, .22, .48), ring: material(0xc4c8c6, .4, .35), solar: material(0xffffff, .82, .1, dragonCells),
    solarFin: material(0x1d2232, .6, .22), stripe: material(0x511212, .62, .2)
};
// The collar meets the face of PMA-2's docking ring, which sits 0.19 m inboard of the tips of its three guide petals.
// Dragon's own petals, 60 degrees round from them, pass inside the ring.
const pma2RingFaceZ = pma2BaseZ - pmaReferenceLength + .19;
// The approach runs the rendezvous model (js/sim/rendezvous.js): Waypoint 0 400 m below the station, the coasting
// transfer to Waypoint 1 on the docking axis, the approach along it with the hold at Waypoint 2, then contact and
// capture. The nose cone opened a minute after Dragon left the second stage, so it is open throughout (the GLB's own
// stroke, -120 degrees about the hinge). `time` runs in animation seconds, `mission` in real seconds from Waypoint 0;
// `offset` (station frame) puts the docking ring relative to the port, and `thrust` is the Draco acceleration.
export const rendezvous = createRendezvous(issMeanMotion);
export const approach = {
    port: new THREE.Vector3(0, -pmaReferenceOffset, pma2RingFaceZ), nose: new THREE.Vector3(0, 0, 0), contactGap: .003,
    duration: rendezvous.duration, time: 0, mission: 0, range: 400, open: 1, phase: 'transfer', label: 'WAYPOINT 0', warp: 60,
    offset: new THREE.Vector3(), thrust: new THREE.Vector3()
};
// LVLH (radial, along-track, cross-track) to the station frame: zenith is +y, the velocity -z, the orbit normal -x.
export const lvlhToStation = ([radial, along, cross], target = new THREE.Vector3()) => target.set(-cross, radial, -along);
// Three touchscreens on one panel: dark fields with an orbit trace, status bars and a faint grid.
const dragonScreens = payloadCanvas(768, 132, g => {
    g.fillStyle = '#1b1f24'; g.fillRect(0, 0, 768, 132);
    for (let screen = 0; screen < 3; screen++) {
        const x0 = 10 + screen * 252;
        g.fillStyle = '#0d2236'; g.fillRect(x0, 10, 244, 112);
        g.strokeStyle = 'rgba(120,180,220,.18)'; g.lineWidth = 1;
        for (let x = x0 + 20; x < x0 + 244; x += 20) { g.beginPath(); g.moveTo(x, 10); g.lineTo(x, 122); g.stroke(); }
        for (let y = 30; y < 122; y += 20) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + 244, y); g.stroke(); }
        g.strokeStyle = '#6fc3ea'; g.lineWidth = 2.5; g.beginPath();
        if (screen === 1) { g.ellipse(x0 + 122, 70, 78, 34, -.2, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#e8f4fb'; g.beginPath(); g.arc(x0 + 190, 58, 4, 0, Math.PI * 2); g.fill(); }
        else { for (let x = 0; x <= 200; x += 4) { const y = 70 + Math.sin(x / 32 + screen) * 26; x ? g.lineTo(x0 + 22 + x, y) : g.moveTo(x0 + 22, y); } g.stroke(); }
        g.fillStyle = '#9fd8f2'; for (let row = 0; row < 4; row++) g.fillRect(x0 + 14, 18 + row * 9, 40 + ((row * 37 + screen * 23) % 50), 4);
        g.fillStyle = '#4fb07a'; g.fillRect(x0 + 196, 100, 36, 12);
    }
});
// Service-bay bulkheads: tan composite panels with rows of lightening holes.
const dragonBayPanel = payloadCanvas(192, 128, g => {
    g.fillStyle = '#a7804f'; g.fillRect(0, 0, 192, 128);
    g.fillStyle = '#6f5130'; for (let x = 0; x < 6; x++) for (let y = 0; y < 4; y++) { g.beginPath(); g.ellipse(18 + x * 31, 17 + y * 31, 10, 10, 0, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#c29a66'; g.lineWidth = 6; g.strokeRect(3, 3, 186, 122);
});
export const dragon = part('dragon', 'SpaceX Crew Dragon', '17 / RENDEZVOUS & DOCKING', 'Crew Dragon flies the last hour of its rendezvous: from Waypoint 0, 400 m below the station, it coasts on a curved Clohessy-Wiltshire transfer to Waypoint 1, 220 m out on Harmony\'s forward docking axis, closes at about 0.35 m/s to Waypoint 2, holds 20 m out for the go/no-go, then closes at 7 cm/s to contact and capture. Draco puffs show each burn. Times follow the Crew-2 docking timeline; the readout gives the time warp. The capsule, its four SuperDraco pods, four windows, side hatch, docking ring with three guide petals and the trunk with its four fins are measured from the supplied Crew Dragon model. Selected, the hull turns 75% transparent to show the four suited crew inside. Solar cells cover one half of the trunk; the other half is radiator.', [['Destination', 'Harmony forward (IDA-2)'], ['Waypoints', '400 m / 220 m / 20 m'], ['Contact speed', '5 cm/s'], ['Length / diameter', '8.1 m / 4.0 m']], [0, 1.6, -2.6], (kit, group) => {
    const noseCone = new THREE.Group(), coneKit = new Kit();
    for (const [where, surface, positions, indices] of dragonReference.parts) (where === 'n' ? coneKit : kit).add(dragonMesh(positions, indices, surface), dragonSkins[surface]);
    coneKit.finish(noseCone); noseCone.position.fromArray(dragonReference.hinge); noseCone.name = 'Docking nose cone'; group.add(noseCone);
    group.userData.reference = { source: dragonReference.source, author: dragonReference.author, license: dragonReference.license, parts: dragonReference.parts.length, scale: dragonReference.scale };
    // Crew cabin, shown while the Dragon is selected and its hull turns translucent. The lining, floor, forward bulkhead,
    // tunnel and heat-shield deck turn translucent with the hull; the seats, crew, flight display, cargo and tanks stay
    // solid. Interior layout is illustrative.
    const cabin = new THREE.Group(), structure = new THREE.Group(), fittings = new THREE.Group(), structureKit = new Kit(), fittingKit = new Kit();
    cabin.name = 'Crew cabin'; cabin.visible = false; fittings.userData.fittings = true; cabin.add(structure, fittings); group.add(cabin);
    const cut = dragonCabinTables, step = cut.z[1] - cut.z[0];
    const tableAt = (table, z) => { const i = THREE.MathUtils.clamp((z - cut.z[0]) / step, 0, table.length - 1.0001), k = Math.floor(i); return THREE.MathUtils.lerp(table[k], table[k + 1], i - k); };
    // The lining stands 0.30 m inside the outer surface, clear of the SuperDraco pod recesses and the hatch.
    const floorZ = -3.40, floorDepth = .08, bulkheadZ = -.75, tunnelTop = -.49, tunnelRadius = .45;
    const wallRadius = z => tableAt(cut.median, z) - .30;
    const inside = (color, roughness, metalness, side) => { const surface = material(color, roughness, metalness).clone(); surface.side = side; return surface; };
    const wallProfile = []; for (let z = floorZ; z < bulkheadZ + .001; z += .05) wallProfile.push(new THREE.Vector2(wallRadius(z), z));
    structureKit.add(new THREE.LatheGeometry(wallProfile, 72), inside(0xd5d9da, .82, .05, THREE.BackSide), [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    const floorRadius = tableAt(cut.median, floorZ - floorDepth) - .06;
    structureKit.add(new THREE.CylinderGeometry(floorRadius, floorRadius, floorDepth, 72), material(0xc3c8ca, .78, .08), [0, 0, floorZ - floorDepth / 2], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    structureKit.add(new THREE.RingGeometry(tunnelRadius, tableAt(cut.median, bulkheadZ) - .02, 72), inside(0xc9cdd0, .78, .08, THREE.DoubleSide), [0, 0, bulkheadZ], [1, 1, 1], [0, 0, 0], false);
    structureKit.add(new THREE.CylinderGeometry(tunnelRadius, tunnelRadius, tunnelTop - bulkheadZ, 48, 1, true), inside(0xb7bcbe, .8, .1, THREE.BackSide), [0, 0, (tunnelTop + bulkheadZ) / 2], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    structureKit.add(new THREE.LatheGeometry(cut.bowl.map(([r, z]) => new THREE.Vector2(r, z)), 72), inside(0x8b8278, .86, .08, THREE.DoubleSide), [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    structureKit.finish(structure);
    // Four suited crew on a reclined seat pallet: heads toward +y, faces toward the nose and the -y side.
    const suit = dragonCrewSuit, quantised = pmaArray(suit.positions, Int16Array), suitPoints = new Float32Array(quantised.length);
    for (let i = 0; i < quantised.length; i++) suitPoints[i] = quantised[i] * suit.quantum;
    const suitIndex = { white: pmaArray(suit.white, Uint16Array), black: pmaArray(suit.black, Uint16Array), visor: pmaArray(suit.visor, Uint16Array) };
    const suitBody = new THREE.BufferGeometry(), allIndex = new Uint16Array(suitIndex.white.length + suitIndex.black.length + suitIndex.visor.length);
    allIndex.set(suitIndex.white); allIndex.set(suitIndex.black, suitIndex.white.length); allIndex.set(suitIndex.visor, suitIndex.white.length + suitIndex.black.length);
    suitBody.setAttribute('position', new THREE.BufferAttribute(suitPoints, 3)); suitBody.setIndex(new THREE.BufferAttribute(allIndex, 1)); suitBody.computeVertexNormals();
    const suitUv = new THREE.BufferAttribute(new Float32Array(suitPoints.length / 3 * 2), 2);
    const crewSkins = { white: material(0xf1f2ef, .56, .05), black: material(0x25282c, .6, .15), visor: material(0x0d1115, .14, .7) };
    const suitParts = Object.entries(suitIndex).map(([name, index]) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', suitBody.attributes.position); geometry.setAttribute('normal', suitBody.attributes.normal); geometry.setAttribute('uv', suitUv);
        geometry.setIndex(new THREE.BufferAttribute(index, 1)); return [geometry, crewSkins[name]];
    });
    const recline = 55 * Math.PI / 180, seatTurn = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, Math.cos(recline), -Math.sin(recline)), new THREE.Vector3(0, Math.sin(recline), Math.cos(recline))));
    const seatShell = 0x2a2e33, pallet = 0x7f95aa;
    // The crew member in seat 1 reaches for the display: that suit is skinned to the right (outboard) arm and hand of
    // the rig, so the sleeve bends as it did when the figure was seated and each finger bends at its own joints.
    const rig = suit.rig, skin = pmaArray(rig.skin, Uint8Array), skinIndex = new Uint16Array(suitPoints.length / 3 * 4), skinWeight = new Float32Array(suitPoints.length / 3 * 4);
    for (let i = 0; i < suitPoints.length / 3; i++) skinWeight[i * 4] = 1;
    for (let k = 0; k < skin.length; k += 5) {
        const i = skin[k] | skin[k + 1] << 8, weight = skin[k + 4] / 255;
        skinIndex[i * 4] = skin[k + 2]; skinIndex[i * 4 + 1] = skin[k + 3]; skinWeight[i * 4] = 1 - weight; skinWeight[i * 4 + 1] = weight;
    }
    const reachingBody = new THREE.BufferGeometry();
    reachingBody.setAttribute('position', suitBody.attributes.position); reachingBody.setAttribute('normal', suitBody.attributes.normal);
    reachingBody.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4)); reachingBody.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
    reachingBody.setIndex(new THREE.BufferAttribute(allIndex, 1));
    let groupStart = 0; ['white', 'black', 'visor'].forEach((name, k) => { reachingBody.addGroup(groupStart, suitIndex[name].length, k); groupStart += suitIndex[name].length; });
    const armBones = rig.bones.map(([name]) => Object.assign(new THREE.Bone(), { name }));
    rig.bones.forEach(([, parent, x, y, z], i) => {
        armBones[i].position.set(x, y, z);
        if (parent >= 0) { armBones[i].position.sub(new THREE.Vector3(...rig.bones[parent].slice(2))); armBones[parent].add(armBones[i]); }
    });
    const reaching = new THREE.SkinnedMesh(reachingBody, ['white', 'black', 'visor'].map(name => crewSkins[name].clone()));
    reaching.name = 'Crew member at the display'; reaching.frustumCulled = false; reaching.add(armBones[0]);
    reaching.updateMatrixWorld(true); reaching.bind(new THREE.Skeleton(armBones));
    let reachingSeat;
    [-.93, -.31, .31, .93].forEach((x, index) => {
        const seat = new THREE.Group(), seatKit = new Kit();
        seat.position.set(x, -.25, -2.95 + (index === 1 || index === 2 ? .08 : 0)); seat.quaternion.copy(seatTurn); seat.name = 'Crew seat ' + (index + 1);
        // Shell fitted to the seated suit (suit frame): back, headrest, pan, leg rest, foot rest and side rails.
        seatKit.box([0, .225, .38], [.50, .06, .76], seatShell);
        seatKit.box([0, .245, .77], [.30, .07, .30], seatShell);
        seatKit.box([0, -.04, -.177], [.50, .32, .05], seatShell);
        seatKit.box([0, -.19, -.30], [.46, .05, .24], seatShell);
        seatKit.box([0, -.405, -.535], [.50, .34, .04], seatShell);
        for (const side of [-1, 1]) { seatKit.box([side * .265, .20, .38], [.03, .10, .78], 0x3b4148); seatKit.box([side * .265, -.04, -.15], [.03, .32, .08], 0x3b4148); }
        if (index === 0) { seat.add(reaching); reachingSeat = seat; } else for (const [geometry, skin] of suitParts) seatKit.add(geometry, skin, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
        seatKit.finish(seat); fittings.add(seat); seat.updateMatrix();
        for (const local of [[-.2, .25, 0], [.2, .25, 0], [-.2, -.40, -.56], [.2, -.40, -.56]]) {
            const foot = new THREE.Vector3(...local).applyMatrix4(seat.matrix);
            fittingKit.rod(foot.toArray(), [foot.x, foot.y, floorZ], .026, pallet);
        }
    });
    for (const y of [-.94, -.11]) { const reach = Math.sqrt(wallRadius(floorZ + .05) ** 2 - y * y); fittingKit.rod([-reach, y, floorZ + .05], [reach, y, floorZ + .05], .035, pallet); }
    // Flight display in front of the crew, within reach of the middle seats, hung from the forward bulkhead.
    const display = new THREE.Group(), displayKit = new Kit();
    display.position.set(0, .04, -2.135); display.name = 'Flight display';
    display.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, .7317, .6816), new THREE.Vector3(0, .6816, -.7317)));
    displayKit.box([0, 0, -.03], [1.96, .40, .05], 0x30353b);
    displayKit.add(new THREE.PlaneGeometry(1.86, .32), material(0xffffff, .35, .1, dragonScreens), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    displayKit.finish(display); fittings.add(display); display.updateMatrix();
    for (const side of [-1, 1]) { const top = new THREE.Vector3(side * .7, .2, -.05).applyMatrix4(display.matrix); fittingKit.rod(top.toArray(), [Math.sign(top.x) * .55, .45, bulkheadZ], .03, pallet); }
    // Two touches on the right-hand screen, in seat 1's frame: on the trace, then on the green key below it. The arm
    // reaches in steps: raised with the hand still relaxed 12 cm off the glass; the forearm turned 80 degrees so the palm
    // faces down, the wrist flexed 20 degrees; then the index finger out with the others curled, hovering 5 cm off and
    // pressing. At that angle the finger pad meets the glass 6 mm below the tip vertex.
    const toSeat = reachingSeat.matrix.clone().invert(), onScreen = (x, y, lift) => new THREE.Vector3(x, y, lift).applyMatrix4(display.matrix).applyMatrix4(toSeat);
    const boneIndex = Object.fromEntries(rig.bones.map(([name], i) => [name, i])), pivot = name => new THREE.Vector3(...rig.bones[boneIndex[name]].slice(2));
    const shoulder = pivot('upperArm'), elbow = pivot('forearm'), wrist = pivot('hand'), foreAxis = wrist.clone().sub(elbow).normalize();
    const across = new THREE.Vector3(...rig.across), palm = new THREE.Vector3(...rig.palm), pole = shoulder.clone().add(new THREE.Vector3(-.35, .1, -.3));
    function reachFor(target, { twist = 0, extend = 0, deviate = 0, point = false } = {}) {
        const swing = new THREE.Quaternion().setFromAxisAngle(across, -extend).multiply(new THREE.Quaternion().setFromAxisAngle(palm, deviate));
        const turned = new THREE.Quaternion().setFromAxisAngle(foreAxis, twist).multiply(swing);
        // The forearm and the posed hand reach as one piece, from the elbow to the index fingertip.
        const fingertip = new THREE.Vector3(...(point ? rig.pointTip : rig.restTip)).sub(wrist).applyQuaternion(turned).add(wrist);
        const upperLength = elbow.distanceTo(shoulder), foreLength = fingertip.distanceTo(elbow), toward = target.clone().sub(shoulder);
        const span = THREE.MathUtils.clamp(toward.length(), Math.abs(upperLength - foreLength) + .01, upperLength + foreLength - .001); toward.normalize();
        const along = (upperLength ** 2 - foreLength ** 2 + span ** 2) / (2 * span), out = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
        const bend = pole.clone().sub(shoulder); bend.addScaledVector(toward, -bend.dot(toward)).normalize();
        const elbowAt = shoulder.clone().addScaledVector(toward, along).addScaledVector(bend, out), tipAt = shoulder.clone().addScaledVector(toward, span);
        const upperTurn = new THREE.Quaternion().setFromUnitVectors(elbow.clone().sub(shoulder).normalize(), elbowAt.clone().sub(shoulder).normalize());
        const foreTurn = new THREE.Quaternion().setFromUnitVectors(fingertip.clone().sub(elbow).applyQuaternion(upperTurn).normalize(), tipAt.clone().sub(elbowAt).normalize());
        // One rotation per bone. The three forearm segments share the twist, so the sleeve turns along its length.
        const pose = rig.bones.map(() => new THREE.Quaternion()), step = new THREE.Quaternion().setFromAxisAngle(foreAxis, twist / 3);
        pose[boneIndex.upperArm] = upperTurn; pose[boneIndex.forearm] = upperTurn.clone().invert().multiply(foreTurn).multiply(upperTurn);
        for (const name of ['twist1', 'twist2', 'twist3']) pose[boneIndex[name]] = step.clone();
        pose[boneIndex.hand] = swing;
        if (point) for (const [name, x, y, z, w] of rig.point) pose[boneIndex[name]] = new THREE.Quaternion(x, y, z, w);
        return pose;
    }
    const trace = [.77, -.055], key = [.833, -.097], rad = THREE.MathUtils.degToRad, palmDown = { twist: rad(-80), extend: rad(-20), deviate: rad(15) }, pointing = { ...palmDown, point: true };
    const touch = {
        bones: armBones,
        poses: {
            rest: rig.bones.map(() => new THREE.Quaternion()), raise: reachFor(onScreen(...trace, .12)), turn: reachFor(onScreen(...trace, .07), palmDown),
            hoverTrace: reachFor(onScreen(...trace, .05), pointing), pressTrace: reachFor(onScreen(...trace, .0064), pointing),
            hoverKey: reachFor(onScreen(...key, .05), pointing), pressKey: reachFor(onScreen(...key, .0064), pointing)
        }
    };
    // Cargo bags stowed on the floor, under the seats.
    const bag = material(0xeceee9, .86, .03);
    for (const [x, y, sx, sy] of [[-.95, .42, .5, .4], [-.32, .5, .5, .44], [.32, .48, .5, .42], [.95, .40, .46, .4], [-.55, -.52, .62, .3], [.4, -.55, .55, .28]]) fittingKit.add(payloadPillow, bag, [x, y, floorZ + .14], [sx, sy, .26]);
    // Service bay under the floor: four propellant tanks, radial bulkheads and a central core.
    const tank = material(0xb0b5b8, .35, .55), bay = material(0xffffff, .78, .08, dragonBayPanel);
    for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2, x = Math.sin(a) * 1.28, y = Math.cos(a) * 1.28;
        fittingKit.add(shapes.sphere, tank, [x, y, -3.735], [.24, .24, .24], [0, 0, 0], false);
        ring(fittingKit, [x, y, -3.735], .245, 'z', 0x8d9397, .014);
    }
    for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4; fittingKit.add(shapes.box, bay, [Math.sin(a) * 1.05, Math.cos(a) * 1.05, -3.70], [1.0, .03, .44], [0, 0, Math.PI / 2 - a]); }
    fittingKit.add(new THREE.CylinderGeometry(.5, .5, .64, 40), material(0x4a4f55, .7, .3), [0, 0, -3.80], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    fittingKit.finish(fittings);
    cabin.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; } });
    group.userData.detail = { noseCone, cabin, touch, openAngle: dragonReference.openAngle, windows: 4, superDracoPods: 4, fins: 4, integratedSolarCells: true, crew: 4 };
});
const dragonCone = dragon.group.userData.detail.noseCone, dragonCabin = dragon.group.userData.detail.cabin;
// Selected, the Dragon turns translucent so the crew show through: 75% transparent on the docking approach, 90% with
// its line art in the cabin view. The cabin fittings stay solid. Translucent copies are kept per solid surface.
const dragonShell = { opacity: 0, copies: new Map() };
export function setDragonShell(opacity) {
    if (dragonShell.opacity === opacity) return;
    markShadowsDirty();
    dragonShell.opacity = opacity; dragonCabin.visible = opacity > 0;
    dragon.group.traverse(child => {
        if (child.userData.lineArt) { child.visible = opacity === ghostOpacity; return; }
        if (!child.isMesh) return;
        for (let parent = child.parent; parent && parent !== dragon.group; parent = parent.parent) if (parent.userData.fittings) return;
        const solid = child.userData.shellSolid || child.material;
        if (!opacity) { if (child.userData.shellSolid) { child.material = solid; child.castShadow = child.userData.shellShadow; delete child.userData.shellSolid; delete child.userData.shellShadow; } return; }
        if (!child.userData.shellSolid) { child.userData.shellSolid = solid; child.userData.shellShadow = child.castShadow; }
        if (!dragonShell.copies.has(solid)) dragonShell.copies.set(solid, new Map());
        const copies = dragonShell.copies.get(solid);
        if (!copies.has(opacity)) copies.set(opacity, Object.assign(solid.clone(), { transparent: true, opacity, depthWrite: false, alphaTest: 0 }));
        const copy = copies.get(opacity);
        copy.emissive?.copy(solid.emissive); copy.emissiveIntensity = solid.emissiveIntensity;
        child.material = copy; child.castShadow = false;
    });
}
// The capsule's bounds with the cone open, at the origin of its frame; the framing covers the last leg, from Waypoint 2
// (20 m out) to the docked position.
dragonCone.rotation.x = dragonReference.openAngle; dragon.group.position.set(0, 0, 0); dragon.group.updateMatrixWorld(true);
const dragonLocalBounds = new THREE.Box3().setFromObject(dragon.group);
const dockedOffset = new THREE.Vector3().copy(approach.port).sub(approach.nose);
export const dragonFlightBounds = dragonLocalBounds.clone().translate(lvlhToStation(rendezvousWaypoints[2].position).add(dockedOffset));
dragonFlightBounds.union(dragonLocalBounds.clone().translate(new THREE.Vector3(0, 0, -approach.contactGap).add(dockedOffset)));
// Dragon's bounds where it is now.
export const dragonBounds = (target = new THREE.Box3()) => target.copy(dragonLocalBounds).translate(dragon.group.position);
// Draco thrusters: four clusters round the capsule's upper cone, each with a radial and an aft-canted nozzle, and two
// forward nozzles by the docking ring. A nozzle puffs when it points against the commanded acceleration: a long puff
// for each burn of the transfer, short pulses while Dragon holds a speed profile on the docking axis.
const dracoNozzles = [];
for (const angle of [.25, .75, 1.25, 1.75].map(turn => turn * Math.PI)) {
    const at = new THREE.Vector3(Math.cos(angle) * 1.62, Math.sin(angle) * 1.62, -1.4);
    dracoNozzles.push({ at, normal: new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0) });
    dracoNozzles.push({ at, normal: new THREE.Vector3(Math.cos(angle) * .35, Math.sin(angle) * .35, -1).normalize() });
}
for (const x of [-.95, .95]) dracoNozzles.push({ at: new THREE.Vector3(x, 0, -.55), normal: new THREE.Vector3(0, 0, 1) });
const puffMap = payloadCanvas(64, 64, g => {
    const glow = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    // Readable on the light paper as well as on black: a white core inside a pale blue-grey rim.
    glow.addColorStop(0, 'rgba(255,255,255,1)'); glow.addColorStop(.45, 'rgba(236,244,250,.85)'); glow.addColorStop(.75, 'rgba(150,186,204,.45)'); glow.addColorStop(1, 'rgba(150,186,204,0)');
    g.fillStyle = glow; g.fillRect(0, 0, 64, 64);
});
for (const nozzle of dracoNozzles) {
    nozzle.puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffMap, transparent: true, opacity: 0, depthWrite: false }));
    nozzle.puff.visible = false; nozzle.puff.userData.puff = true; dragon.group.add(nozzle.puff);
}
const burnTimes = rendezvous.impulses.map(impulse => ({ at: rendezvous.animAt(impulse.mission), direction: lvlhToStation(impulse.deltaV).normalize() }));
const puffDirection = new THREE.Vector3();
function updatePuffs() {
    let strength = 0;
    for (const burn of burnTimes) {
        const since = approach.time - burn.at;
        if (since >= 0 && since < .9) { strength = 1 - since / .9; puffDirection.copy(burn.direction); }
    }
    const thrust = approach.thrust.length();
    if (!strength && thrust > 1e-5 && approach.time < approach.duration) {
        // Short pulses, stronger for harder braking or acceleration.
        const pulse = (approach.time * 1.4) % 1;
        if (pulse < .22) { strength = THREE.MathUtils.clamp(thrust / 2e-3, .55, 1) * (1 - pulse / .22); puffDirection.copy(approach.thrust).normalize(); }
    }
    for (const nozzle of dracoNozzles) {
        const weight = strength * Math.max(0, -nozzle.normal.dot(puffDirection));
        nozzle.puff.visible = weight > .02;
        if (!nozzle.puff.visible) continue;
        nozzle.puff.material.opacity = Math.min(1, weight * 1.3);
        nozzle.puff.position.copy(nozzle.at).addScaledVector(nozzle.normal, .45 + .8 * weight);
        nozzle.puff.scale.setScalar(.55 + 1.1 * weight);
    }
}
export function updateApproach(delta) {
    approach.time = Math.min(approach.duration, approach.time + Math.max(0, delta));
    const state = rendezvous.state(rendezvous.missionAt(approach.time));
    Object.assign(approach, { mission: state.mission, range: state.range, phase: state.phase, label: state.label, warp: state.warp });
    lvlhToStation([state.position[0], Math.max(state.position[1], approach.contactGap), state.position[2]], approach.offset);
    lvlhToStation(state.thrust, approach.thrust);
    dragon.group.position.copy(dockedOffset).add(approach.offset);
    updatePuffs();
    dragon.group.updateMatrixWorld(true);
}
// Phase for the readout, with the time warp while the animation compresses time.
export function approachPhase() {
    if (approach.time >= approach.duration) return 'DOCKED';
    return approach.label + ' ×' + approach.warp;
}
// Every 12 s the crew member in seat 1 raises the right arm, turns the hand palm-down, points the index finger, touches
// the trace on the right-hand screen and then the green key below it, and settles back. Steps are [start, end, from,
// to] in seconds; between steps the last pose holds.
const dragonTouchSteps = [[2, 3.6, 'rest', 'raise'], [3.6, 4.5, 'raise', 'turn'], [4.5, 5, 'turn', 'hoverTrace'], [5, 5.3, 'hoverTrace', 'pressTrace'],
    [5.55, 5.85, 'pressTrace', 'hoverTrace'], [5.85, 6.35, 'hoverTrace', 'hoverKey'], [6.35, 6.65, 'hoverKey', 'pressKey'], [6.9, 7.2, 'pressKey', 'hoverKey'],
    [7.2, 8, 'hoverKey', 'raise'], [8, 9.6, 'raise', 'rest']];
export function updateDragonCrew(time) {
    const { bones, poses } = dragon.group.userData.detail.touch, cycle = time % 12;
    let from = 'rest', to = 'rest', k = 0;
    for (const [start, end, a, b] of dragonTouchSteps) {
        if (cycle >= end) { from = to = b; continue; }
        if (cycle >= start) { from = a; to = b; k = THREE.MathUtils.smoothstep(cycle, start, end); }
        break;
    }
    bones.forEach((bone, i) => bone.quaternion.slerpQuaternions(poses[from][i], poses[to][i], k));
}
// Without motion the approach starts at the Waypoint 2 hold, 20 m out.
export const approachStartTime = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? rendezvous.phaseStart('hold') : 0;
approach.time = approachStartTime();
updateApproach(0);
