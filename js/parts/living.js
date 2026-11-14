// Living quarters behind clear sections of the hull, drawn as Columbus and Tranquility show their cabins: a 75%-
// transparent skin over an opening on the starboard-zenith side, cut faces and frames round it, a liner inside, and the
// racks of the two near walls (inside the cut) left out so the cabin stays in view. The crew who sleep and eat here are
// posed by js/figures/living-crew.js. Layouts and fittings are illustrative.
// - Harmony, forward bay (toward PMA-2): crew quarters. Harmony has four, one in a rack bay of each wall, about 2.1 m³
//   each; the port and deck ones show (both in the aft half of the bay, the half seen through the opening from
//   forward), the starboard and overhead ones lie in the cut. The forward end is the hatchway to PMA-2, open through
//   to a short dark tunnel, so a crew coming aboard from Crew Dragon floats in through it. Each is a booth flush with the rack faces, with a folding door folded open, a sleeping bag strapped to the back wall, a laptop on a shelf, a reading light, a vent grille and a
//   few personal things. Avionics racks fill the other bays.
// - Unity, its whole barrel: the galley, in the aft half (seen past the radial port collars from forward). A table on a
//   post with straps for food packs; on the port wall the potable water dispenser, the food warmer (briefcase-shaped, for pouches) and food containers; stowage racks; the hatchways
//   to Tranquility (port, open) and the free nadir port (closed). The Quest and Z1 port collars cross the opening.
// What the crew use is crew gear (userData.crewGear): it stays in view when the station is ghosted (js/ui/ghost.js).
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { Kit, material, palette, shapes } from '../core/kit.js';

// Openings in each module's own frame: angles from +x toward +y, depths along the axis (Harmony: station z; Unity:
// from its centre).
export const harmonyOpen = { a0: -Math.PI / 6, a1: 2 * Math.PI / 3, z0: -8.25, z1: -5.95 };
export const unityOpen = { a0: -Math.PI / 12, a1: 7 * Math.PI / 12, z0: -2.55, z1: 2.55 };
const R = 2.15, Rp = 1.98, aisle = .95, rackDepth = .72;
export const at = (r, a, z) => [Math.cos(a) * r, Math.sin(a) * r, z];
export const twoSided = (color, roughness = .7, metalness = .22) => { const m = material(color, roughness, metalness).clone(); m.side = THREE.DoubleSide; return m; };
// Whether `angle` lies in the arc from a0 to a1 (counter-clockwise).
export const inArc = (angle, a0, a1) => { const turn = Math.PI * 2; return ((angle - a0) % turn + turn) % turn <= a1 - a0 + 1e-6; };
// A strip of a cone or cylinder about the z axis (or a flat ring sector when z0 = z1), facing outward.
export function sweep(target, r0, z0, r1, z1, a0, a1, surface) {
    const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 32))), positions = [], indices = [];
    for (let row = 0; row < 2; row++) for (let i = 0; i <= steps; i++) positions.push(...at(row ? r1 : r0, a0 + (a1 - a0) * i / steps, row ? z1 : z0));
    for (let i = 0; i < steps; i++) { const j = i + steps + 1; indices.push(i, i + 1, j, j, i + 1, j + 1); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); target.add(geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
}
function arc(target, r, z, a0, a1, radius, color) {
    const points = [], steps = Math.max(8, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 40)));
    for (let i = 0; i <= steps; i++) points.push(new THREE.Vector3(...at(r, a0 + (a1 - a0) * i / steps, z)));
    target.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps * 2, radius, 6, false), material(color, .6, .3), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
}
const inside = (group, gear = false) => {
    if (gear) group.userData.crewGear = true;
    group.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; } });
    return group;
};
function roundedSquare(half, radius) {
    const s = new THREE.Shape(); s.moveTo(-half + radius, -half); s.lineTo(half - radius, -half); s.quadraticCurveTo(half, -half, half, -half + radius);
    s.lineTo(half, half - radius); s.quadraticCurveTo(half, half, half - radius, half); s.lineTo(-half + radius, half);
    s.quadraticCurveTo(-half, half, -half, half - radius); s.lineTo(-half, -half + radius); s.quadraticCurveTo(-half, -half, -half + radius, -half); return s;
}

// The opening: cut faces through the wall along each long edge with a longeron and stiffeners, a ring frame of two arcs
// and a lattice at each end, and the clear skin (kept in the robotic arm's clearance map: userData.shell).
function clearSection(cabin, { a0, a1, z0, z1 }, Ro, name) {
    const frameKit = new Kit(), glazingKit = new Kit(), span = z1 - z0, cutFace = twoSided(0xe4e6df, .82, .08);
    for (const a of [a0, a1]) {
        const corners = [at(Rp, a, z0), at(Ro, a, z0), at(Ro, a, z1), at(Rp, a, z1)], face = new THREE.BufferGeometry();
        face.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3)); face.setIndex([0, 1, 2, 0, 2, 3]); face.computeVertexNormals();
        frameKit.add(face, cutFace, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
        frameKit.rod(at(2.07, a, z0), at(2.07, a, z1), .045, 0xd6d9d2);
        for (let n = 1; n < 8; n++) frameKit.box(at(2.07, a, z0 + span * n / 8), [.13, .13, .05], 0xbfc4be, [0, 0, a], false);
    }
    for (const z of [z0 + .006, z1 - .006]) sweep(frameKit, Rp, z, Ro, z, a0, a1, cutFace);
    for (const z of [z0 + .07, z1 - .07]) {
        const lo = a0 - .03, hi = a1 + .03, n = 10;
        for (const r of [1.72, 1.96]) arc(frameKit, r, z, lo, hi, .032, 0xdfe2db);
        for (let i = 0; i < n; i++) {
            const a = lo + (hi - lo) * i / n, b = lo + (hi - lo) * (i + 1) / n;
            frameKit.rod(at(1.72, a, z), at(1.96, b, z), .016, 0xc5c9c3); frameKit.rod(at(1.96, a, z), at(1.72, b, z), .016, 0xc5c9c3);
        }
    }
    const frames = new THREE.Group(); frames.name = name + ' exposed frames'; frameKit.finish(frames); cabin.add(frames);
    const clearSkin = new THREE.MeshStandardMaterial({ color: 0xd3d8d4, roughness: .35, metalness: .08, transparent: true, opacity: .25, depthWrite: false });
    sweep(glazingKit, Ro, z0, Ro, z1, a0, a1, clearSkin);
    for (let a = Math.ceil(a0 / (Math.PI / 6)) * Math.PI / 6; a < a1 - .01; a += Math.PI / 6) if (a > a0 + .01) glazingKit.line([at(Ro + .004, a, z0), at(Ro + .004, a, z1)]);
    glazingKit.line(Array.from({ length: 25 }, (_, i) => at(Ro + .004, a0 + (a1 - a0) * i / 24, (z0 + z1) / 2)));
    const glazing = new THREE.Group(); glazing.name = name + ' see-through hull section'; glazingKit.finish(glazing); cabin.add(glazing);
    glazing.traverse(object => { object.userData.interior = true; object.userData.shell = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; object.renderOrder = 2; } });
}

// Liner over the closed part of the wall, and an end bulkhead at each end with a hatchway: open (dark beyond), closed,
// or 'tunnel' (the end cone lined, a ring wall with the hatch cut through, and a dark open sleeve beyond).
function linerAndEnds(kit, { a0, a1, z0, z1 }, ends) {
    sweep(kit, Rp, z0, Rp, z1, a1, a0 + Math.PI * 2, twoSided(0xd8dbd3, .85, .06));
    const bulkhead = twoSided(0xe1e3dc, .85, .06), beyond = new THREE.MeshBasicMaterial({ color: 0x14181a, side: THREE.DoubleSide });
    const hatchFrame = roundedSquare(.62, .26); hatchFrame.holes.push(roundedSquare(.5, .21));
    ends.forEach((open, k) => {
        const side = k ? -1 : 1;
        if (open === 'tunnel') {
            const end = k ? z1 : z0, wall = end - side * .2, ring = new THREE.Shape(); ring.absarc(0, 0, 1.32, 0, Math.PI * 2, false); ring.holes.push(roundedSquare(.5, .21));
            sweep(kit, Rp, end, 1.32, wall, 0, Math.PI * 2, bulkhead);
            kit.add(new THREE.ShapeGeometry(ring, 24), bulkhead, [0, 0, wall], [1, 1, 1], [0, 0, 0], false);
            kit.add(new THREE.ExtrudeGeometry(hatchFrame, { depth: .07, bevelEnabled: false, curveSegments: 8 }), material(0xb4bab6, .6, .3), [0, 0, side > 0 ? wall : wall - .07], [1, 1, 1], [0, 0, 0], false);
            for (const [x, y, w, h] of [[.5, 0, .02, 1], [-.5, 0, .02, 1], [0, .5, 1, .02], [0, -.5, 1, .02]]) kit.add(shapes.box, beyond, [x, y, wall - side * .14], [w, h, .28], [0, 0, 0], false);
            return;
        }
        const z = k ? z1 - .02 : z0 + .02;
        sweep(kit, 0, z, R - .003, z, 0, Math.PI * 2, bulkhead);
        kit.add(new THREE.ExtrudeGeometry(hatchFrame, { depth: .07, bevelEnabled: false, curveSegments: 8 }), material(0xb4bab6, .6, .3), [0, 0, side > 0 ? z : z - .07], [1, 1, 1], [0, 0, 0], false);
        kit.add(new THREE.ShapeGeometry(roundedSquare(.505, .21), 8), open ? beyond : material(0xc3c8c4, .7, .2), [0, 0, z + side * .012], [1, 1, 1], [0, 0, 0], false);
        for (const x of [-.76, .76]) kit.rod([x, -.36, z + side * .1], [x, .36, z + side * .1], .016, palette.gold);
    });
}

// Rack fronts drawn once on canvases: lockers (stowage) and equipment panels (avionics, galley).
function fronts(seed, equipment) {
    const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 320; const g = canvas.getContext('2d');
    let state = seed * 9301 + 49297; const random = () => (state = (state * 9301 + 49297) % 233280) / 233280;
    g.fillStyle = '#d9dcd5'; g.fillRect(0, 0, 192, 320);
    for (let row = 0; row < 5; row++) for (let column = 0; column < 2; column++) {
        const x = 6 + column * 93, y = 6 + row * 62, w = 87, h = 56, kind = equipment ? random() : 1;
        g.fillStyle = kind < .35 ? '#39424a' : kind < .55 ? '#b9c3c4' : '#eceee8'; g.fillRect(x, y, w, h);
        g.strokeStyle = '#8b938f'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
        if (kind < .35) { g.fillStyle = ['#5fd0a0', '#e9b44c', '#6aa7e0'][Math.floor(random() * 3)]; for (let i = 0; i < 4; i++) g.fillRect(x + 8 + i * 18, y + 12, 9, 5); g.fillStyle = '#9fb0b8'; g.fillRect(x + 8, y + 28, 52, 12); }
        else { g.fillStyle = '#5c6562'; g.fillRect(x + w / 2 - 14, y + h - 13, 28, 5); g.fillStyle = random() < .5 ? '#2f5f8f' : '#b5533c'; g.fillRect(x + 7, y + 7, 22, 8); }
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return texture;
}
let faces = null;
const rackFaces = () => (faces ||= { lockers: material(0xffffff, .82, .05, fronts(3, false)), equipment: material(0xffffff, .82, .05, fronts(7, true)) });
const rackBody = material(0x9ea8a3, .78, .18);
// One rack: its front faces +x at x = 0, its body runs back to -x; height along y, width along z. A deck rack is the
// same turned a quarter (roll), front up.
function rack(parent, name, face, place, roll, extras) {
    const group = new THREE.Group(), kit = new Kit(); group.name = name;
    kit.add(shapes.box, rackBody, [-rackDepth / 2, 0, 0], [rackDepth - .02, 1.86, 1.02], [0, 0, 0], false);
    kit.add(new THREE.PlaneGeometry(1.0, 1.82), rackFaces()[face], [.004, 0, 0], [1, 1, 1], [0, Math.PI / 2, 0], false);
    for (const z of [-.51, .51]) kit.box([-.02, 0, z], [.07, 1.9, .045], 0xd1d5ce, [0, 0, 0], false);
    extras?.(kit);
    kit.finish(group); group.position.fromArray(place); group.rotation.z = roll; parent.add(group); return inside(group, true);
}

// A crew quarters booth in a rack bay (rack frame as above): back wall at the rack's back, sides and ends, a front frame
// flush with the rack faces round a doorway, the folding door folded at the +z side. The sleeping bag hangs on the
// back wall, head end toward +y; `bed.hips` is where the sleeper's hips go (figure up +y, front +x).
function crewQuarters(parent, name, place, roll, look) {
    const group = new THREE.Group(), kit = new Kit(); group.name = name;
    const shell = 0xe8e7e0, pad = 0xd2d8dc, trim = 0xbcc2be;
    kit.box([-.69, 0, 0], [.02, 1.9, 1.04], pad, [0, 0, 0], false);
    for (const z of [-.51, .51]) kit.box([-.335, 0, z], [.71, 1.9, .02], shell, [0, 0, 0], false);
    for (const y of [-.94, .94]) kit.box([-.335, y, 0], [.71, .02, 1.04], shell, [0, 0, 0], false);
    kit.box([.02, .875, 0], [.03, .15, 1.04], trim, [0, 0, 0], false); kit.box([.02, -.875, 0], [.03, .15, 1.04], trim, [0, 0, 0], false);
    for (const z of [-.475, .475]) kit.box([.02, 0, z], [.03, 1.6, .09], trim, [0, 0, 0], false);
    // The folding door, folded open: pleats in a zigzag at the hinge side.
    for (let i = 0; i < 5; i++) kit.box([.06 + i * .026, 0, .44], [.012, 1.56, .1], 0xf1f0ea, [0, i % 2 ? .5 : -.5, 0], false);
    // Vent grille in the ceiling, the duct above it, and the reading light over the doorway.
    kit.box([-.28, .925, 0], [.42, .012, .5], 0x5d6468, [0, 0, 0], false);
    for (let i = 0; i < 6; i++) kit.box([-.45 + i * .068, .917, 0], [.012, .006, .48], 0x3d4347, [0, 0, 0], false);
    kit.box([-.28, 1.0, 0], [.4, .11, .3], 0xc9cdc8, [0, 0, 0], false);
    kit.add(shapes.box, new THREE.MeshBasicMaterial({ color: 0xf3eedb }), [-.06, .91, 0], [.06, .012, .42], [0, 0, 0], false);
    // A laptop on a shelf on the -z wall beside the head, lid up, screen dark (asleep).
    kit.box([-.2, .6, -.37], [.3, .015, .24], 0xb5bab6, [0, 0, 0], false);
    kit.box([-.18, .615, -.37], [.22, .016, .26], 0x2d3134, [0, 0, 0], false);
    kit.box([-.29, .72, -.37], [.016, .2, .26], 0x2d3134, [0, 0, -.2], false);
    kit.add(new THREE.PlaneGeometry(.23, .17), material(0x1d2a38, .3, .1), [-.279, .722, -.37], [1, 1, 1], [0, Math.PI / 2, -.2], false);
    // Personal things on the +z wall: photographs, a mesh pocket, a cargo pouch.
    [[0xc79a5b, -.32, .45], [0x6e8fb3, -.16, .5], [0xb46a5e, -.24, .28]].forEach(([color, x, y]) =>
        kit.add(new THREE.PlaneGeometry(.1, .13), material(color, .7, .05), [x, y, .499], [1, 1, 1], [0, Math.PI, 0], false));
    kit.box([-.3, -.15, .48], [.3, .34, .035], 0x8f9a8c, [0, 0, 0], false);
    kit.box([-.18, -.55, .47], [.22, .2, .05], 0xd8d2bf, [0, 0, 0], false);
    // The sleeping bag on the back wall, its collar, and two straps over it to the wall.
    const bed = { hips: [-.5, -.04, 0], top: .51 };
    kit.add(new THREE.CapsuleGeometry(.3, .84, 6, 18), material(look.bag, .92, .02), [-.5, -.2, 0], [.8, 1, 1], [0, 0, 0], false);
    kit.add(new THREE.TorusGeometry(.2, .03, 8, 24), material(0xd8d2c0, .9, .02), [-.5, .46, 0], [.86, 1, 1], [Math.PI / 2, 0, 0], false);
    for (const y of [-.6, .02]) {
        kit.box([-.255, y, 0], [.012, .05, .48], 0x4a4f53, [0, 0, 0], false);
        for (const z of [-.24, .24]) kit.box([-.5, y, z * 1.12], [.4, .05, .012], 0x4a4f53, [0, 0, z > 0 ? -.35 : .35], false);
    }
    kit.finish(group); group.position.fromArray(place); group.rotation.z = roll; parent.add(group);
    return { home: inside(group, true), bed };
}

// ---- Harmony: the aft bay. `group` is Harmony's own (station frame). ----
export function harmonyQuarters(group) {
    const open = harmonyOpen, mid = (open.z0 + open.z1) / 2, cabin = new THREE.Group(); cabin.name = 'Harmony crew quarters'; cabin.position.z = mid; group.add(cabin);
    const local = { ...open, z0: open.z0 - mid, z1: open.z1 - mid };
    clearSection(cabin, local, 2.18, 'Harmony');
    const kit = new Kit(), lining = new THREE.Group(); lining.name = 'Harmony liner and bulkheads';
    linerAndEnds(kit, local, ['tunnel', true]);
    for (const sx of [-1, 1]) kit.rod([sx * .86, -.9, local.z0 + .1], [sx * .86, -.9, local.z1 - .1], .018, palette.gold);
    kit.finish(lining); cabin.add(inside(lining));
    // Crew quarters in the aft half of the port wall and of the deck, avionics racks forward of them.
    const half = (local.z1 - local.z0) / 4;
    const beds = [
        crewQuarters(cabin, 'Crew quarters (port)', [-aisle, 0, half], 0, { bag: 0x2f4a6b }),
        crewQuarters(cabin, 'Crew quarters (deck)', [0, -aisle, half], Math.PI / 2, { bag: 0x3c5a45 })
    ];
    rack(cabin, 'Avionics rack (port)', 'equipment', [-aisle, 0, -half], 0);
    rack(cabin, 'Avionics rack (deck)', 'equipment', [0, -aisle, -half], Math.PI / 2);
    group.userData.quarters = { cabin, open, beds };
    return group.userData.quarters;
}

// ---- Unity: the galley. `group` is Unity's own (station frame); the cabin is centred on the node. ----
export function unityGalley(group, centre) {
    const open = unityOpen, cabin = new THREE.Group(); cabin.name = 'Unity galley'; cabin.position.fromArray(centre); group.add(cabin);
    clearSection(cabin, open, 2.197, 'Unity');
    const kit = new Kit(), lining = new THREE.Group(); lining.name = 'Unity liner and bulkheads';
    linerAndEnds(kit, open, [true, true]);
    // Standoff walls round the two far radial hatchways: open to Tranquility (port), closed at the free nadir port.
    const wall = twoSided(0xdfe1da, .85, .06), beyond = new THREE.MeshBasicMaterial({ color: 0x14181a, side: THREE.DoubleSide });
    kit.add(shapes.box, wall, [-1.45, 0, 0], [.03, 2.3, 2.45], [0, 0, 0], false);
    kit.add(new THREE.ShapeGeometry(roundedSquare(.56, .23), 8), beyond, [-1.432, 0, 0], [1, 1, 1], [0, Math.PI / 2, 0], false);
    kit.add(new THREE.ExtrudeGeometry((() => { const s = roundedSquare(.66, .27); s.holes.push(roundedSquare(.56, .23)); return s; })(), { depth: .06, bevelEnabled: false, curveSegments: 8 }),
        material(0xb4bab6, .6, .3), [-1.435, 0, 0], [1, 1, 1], [0, Math.PI / 2, 0], false);
    kit.add(shapes.box, wall, [0, -1.45, 0], [2.3, .03, 2.45], [0, 0, 0], false);
    kit.add(new THREE.ShapeGeometry(roundedSquare(.6, .25), 8), material(0xc3c8c4, .7, .2), [0, -1.43, 0], [1, 1, 1], [-Math.PI / 2, 0, 0], false);
    kit.box([0, -1.41, 0], [.5, .03, .07], 0x5c6461, [0, 0, 0], false);
    for (const sz of [-1, 1]) kit.rod([-.9, -.9, sz * 2.45], [-.9, -.9, sz * 1.3], .018, palette.gold);
    kit.finish(lining); cabin.add(inside(lining));
    // Racks forward and aft of the hatchways on the two far walls; the forward port one is the galley wall.
    const bay = 1.9;
    rack(cabin, 'Galley rack', 'equipment', [-aisle, 0, bay], 0, k => {
        // Potable water dispenser: a cabinet with its needle, a dial and a small display.
        k.box([.07, .48, -.24], [.14, .3, .26], 0xdadcd6, [0, 0, 0], false);
        k.add(new THREE.PlaneGeometry(.1, .05), material(0x223a2f, .3, .1), [.141, .55, -.24], [1, 1, 1], [0, Math.PI / 2, 0], false);
        k.cylinder([.15, .44, -.17], .025, .02, 0x5c6461, [0, 0, Math.PI / 2]);
        k.rod([.14, .38, -.3], [.24, .36, -.3], .006, 0x9aa1a3);
        // Food warmer: a silver briefcase with a handle, latched to the rack.
        k.box([.05, .02, .2], [.1, .32, .46], 0xb8bdbd, [0, 0, 0], false);
        k.rod([.105, .19, .1], [.105, .19, .3], .01, 0x3b4146);
        // Food containers and pouches on Velcro.
        for (let i = 0; i < 3; i++) k.box([.06, -.48, -.3 + i * .3], [.12, .26, .26], [0xd8d2bf, 0xcfc8b2, 0xe0dbc9][i], [0, 0, 0], false);
        [[0xd9534f, .25, -.05], [0xe3b04b, .25, .05], [0x5b8fc9, .3, .32], [0x6aa56b, .22, .4]].forEach(([color, y, z]) => k.box([.012, y, z], [.012, .09, .07], color, [0, 0, 0], false));
    });
    rack(cabin, 'Stowage rack (port forward)', 'lockers', [-aisle, 0, -bay], 0);
    rack(cabin, 'Stowage rack (deck forward)', 'lockers', [0, -aisle, -bay], Math.PI / 2);
    rack(cabin, 'Stowage rack (deck aft)', 'lockers', [0, -aisle, bay], Math.PI / 2);
    // The table: a top with Velcro strips and bungees, on a post from the deck, foot loops either side; on it a meal
    // pouch, a drink pouch, a tortilla, scissors.
    const table = { centre: [.05, -.36, 1.8], size: [.52, .03, .78] }, tableKit = new Kit(), tableGroup = new THREE.Group(); tableGroup.name = 'Galley table';
    const [tx, ty, tz] = table.centre;
    tableKit.box([tx, ty - .015, tz], table.size, 0xd6d2c4, [0, 0, 0], false);
    for (const dz of [-.22, 0, .22]) tableKit.box([tx, ty + .002, tz + dz], [.5, .004, .05], 0x3a3f42, [0, 0, 0], false);
    for (const dx of [-.15, .15]) tableKit.rod([tx + dx, ty + .012, tz - .38], [tx + dx, ty + .012, tz + .38], .006, 0x2c4f7a);
    tableKit.rod([tx, -aisle, tz], [tx, ty - .03, tz], .035, 0xa9afad);
    tableKit.box([tx, -aisle + .01, tz], [.22, .02, .22], 0x8e9592, [0, 0, 0], false);
    for (const [x, z] of [[-.45, 1.92], [-.45, 1.68], [.62, 1.82], [.62, 1.58]]) {
        tableKit.rod([x - .1, -aisle + .07, z], [x + .1, -aisle + .07, z], .01, palette.dark);
        for (const dx of [-.1, .1]) tableKit.rod([x + dx, -aisle, z], [x + dx, -aisle + .07, z], .01, palette.dark);
    }
    tableKit.box([tx - .12, ty + .012, tz + .02], [.13, .02, .17], 0xe9a23b, [0, .2, 0], false);
    tableKit.box([tx + .12, ty + .012, tz - .2], [.12, .018, .16], 0x7c9a4e, [0, -.3, 0], false);
    tableKit.add(new THREE.CylinderGeometry(.1, .1, .005, 24), material(0xe2cfa0, .9, .02), [tx + .1, ty + .006, tz + .22], [1, 1, 1], [0, 0, 0], false);
    tableKit.box([tx - .14, ty + .006, tz - .2], [.1, .008, .02], 0x2a2d30, [0, .4, 0], false);
    tableKit.finish(tableGroup); cabin.add(inside(tableGroup, true));
    group.userData.galley = { cabin, open, table };
    return group.userData.galley;
}
