// Launch Complex 39 round LC-39A for the Launch view: the pads' raised hardstands with their ramps and flame trenches
// (the ground's imagery is draped over them, see js/launch/ground.js), Pad 39B with its three lightning towers, the
// Vehicle Assembly Building and Launch Control Center 5 km south-west, SpaceX's hangar at the foot of 39A's ramp and
// the buildings and tank farms round the pad. Metres in the pad's local frame (x east, y up, z south).
// - Sizes: NASA (VAB 218 × 158 m and 160 m tall, its low bay 135 × 84 m and 64 m tall at the south end, high-bay
//   doors 139 m tall on the east and west faces; the hardstands 119 × 99 m and 12 m above the ground, 48 ft above sea
//   level at 39A; ramps of 5%; flame trenches 18 m wide; 39B's lightning towers 600 ft, 183 m).
// - Footprints and places: OpenStreetMap (© OpenStreetMap contributors, ODbL), checked against the USGS image the
//   ground shows. The KSC industrial area's grid, and the VAB and LCC with it, runs 13.4° west of north. Structures
//   built after Demo-2 (the Starship tower at 39A, 39B's new hydrogen sphere) are left out.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const earthRadius = 6371000, rad = Math.PI / 180;
// The ground falls away from the pad with the Earth's curve (2 m at the VAB).
export const groundDrop = (x, z) => -(x * x + z * z) / (2 * earthRadius);

// The pads: the hardstand round the launch mount (its half extents west, east, north and south of the mount), the
// ramp up from the south and the flame trench running north from under the mount, its floor at ground level.
const slopeRun = 30;   // the hardstand's sides fall 1 in 2.5
export const pads = [
    { name: '39A', x: 0, z: 0, deck: 12, west: 62, east: 58, north: 58, south: 42, rampHalf: 30, rampLength: 240, trench: { half: 9, north: 110, south: 6 } },
    { name: '39B', x: -1635, z: -2114, deck: 12, west: 60, east: 60, north: 55, south: 45, rampHalf: 30, rampLength: 240, trench: { half: 9, north: 105, south: 6 } }
];
export const padDeck = pads[0].deck;
function moundHeight(pad, x, z) {
    const dx = x - pad.x, dz = z - pad.z;
    const ox = Math.max(0, dx - pad.east, -pad.west - dx), oz = Math.max(0, dz - pad.south, -pad.north - dz);
    let h = pad.deck * Math.max(0, 1 - Math.max(ox, oz, (ox + oz) * .72) / slopeRun);   // chamfered corners: roughly octagonal
    if (dz > pad.south) {
        const ramp = pad.deck * Math.max(0, 1 - (dz - pad.south) / pad.rampLength), side = Math.max(0, Math.abs(dx) - pad.rampHalf);
        h = Math.max(h, ramp - pad.deck * side / slopeRun);
    }
    return h;
}
// Height of the ground above the imagery's plane at (x, z): the pads' mounds, nothing elsewhere.
export function terrainHeight(x, z) {
    let h = 0;
    for (const pad of pads) if (Math.abs(x - pad.x) < 200 && z - pad.z > -200 && z - pad.z < 400) h = Math.max(h, moundHeight(pad, x, z));
    return h;
}
export const inTrench = (x, z) => pads.some(pad => Math.abs(x - pad.x) < pad.trench.half && z - pad.z > -pad.trench.north && z - pad.z < pad.trench.south);
// Lines the imagery's grid must follow round the pads: every 3 m over the mounds, and exactly along the trench walls
// and ends (so the cut has straight edges and vertical walls).
export const terrainLines = (() => {
    const xs = [], zs = [];
    for (const pad of pads) {
        for (let x = -pad.west - slopeRun - 6; x <= pad.east + slopeRun + 6; x += 3) xs.push(pad.x + x);
        for (let z = -pad.north - slopeRun - 6; z <= pad.south + pad.rampLength + 6; z += 3) zs.push(pad.z + z);
        xs.push(pad.x - pad.trench.half, pad.x + pad.trench.half);
        zs.push(pad.z - pad.trench.north, pad.z + pad.trench.south);
    }
    return { xs: xs.sort((a, b) => a - b), zs: zs.sort((a, b) => a - b) };
})();

// Canvas textures.
function canvasTexture(width, height, draw, repeat) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
    if (repeat) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(...repeat); }
    return texture;
}
// Siding: a light wall with faint vertical panel joints.
function siding(g, w, h, base, joint, every) {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = joint; for (let x = 0; x < w; x += every) g.fillRect(x, 0, 1, h);
}
// The VAB's faces, drawn at 2 px a metre. The high bay's long faces carry two doors each: a 46 m wide lower door to
// 35 m and the 23 m wide upper door above it to 139 m, panels banded every 6 m.
const px = 2;
function vabDoors(g, w, h, doorsAt) {
    for (const at of doorsAt) {
        const cx = at * w;
        g.fillStyle = '#b9bfc2'; g.fillRect(cx - 23 * px, h - 35 * px, 46 * px, 35 * px); g.fillRect(cx - 11.5 * px, h - 139 * px, 23 * px, 104 * px);
        g.fillStyle = 'rgba(70,78,84,.35)';
        for (let y = h - 6 * px; y > h - 139 * px; y -= 6 * px) g.fillRect(cx - (y > h - 35 * px ? 23 : 11.5) * px, y, (y > h - 35 * px ? 46 : 23) * px, 1);
        g.strokeStyle = '#7d868c'; g.lineWidth = 2; g.strokeRect(cx - 23 * px, h - 35 * px, 46 * px, 35 * px); g.strokeRect(cx - 11.5 * px, h - 139 * px, 23 * px, 104 * px);
    }
}
// The flag, 63.7 m high and 33.5 m wide, hung vertically (union at the top left), and the NASA insignia.
function vabFlag(g, x0, y0) {
    const w = 33.5 * px, h = 63.7 * px, stripe = w / 13;
    for (let k = 0; k < 13; k++) { g.fillStyle = k % 2 ? '#f2f2ee' : '#b3243a'; g.fillRect(x0 + k * stripe, y0, Math.ceil(stripe), h); }
    const uw = stripe * 7, uh = h * .4;   // the union: seven stripes wide, 0.76 of the hoist (25.5 m) tall
    g.fillStyle = '#1e2f6b'; g.fillRect(x0, y0, uw, uh);
    g.fillStyle = '#f2f2ee';
    for (let r = 0; r < 11; r++) for (let c = 0; c < (r % 2 ? 4 : 5); c++) g.fillRect(x0 + uw * ((c + (r % 2 ? 1 : .5)) / 5.2), y0 + uh * ((r + .6) / 11.4), 2, 2);
}
function vabInsignia(g, cx, cy) {
    const r = 16.75 * px;
    g.fillStyle = '#1d3f95'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#f2f2ee'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy + 2, r * 1.15, r * .38, -.35, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#d2263c'; g.beginPath(); g.moveTo(cx - r * 1.05, cy + r * .55); g.lineTo(cx + r * 1.2, cy - r * .7); g.lineTo(cx + r * .1, cy + r * .05); g.closePath(); g.fill();
    g.fillStyle = '#f2f2ee'; g.font = 'bold ' + Math.round(r * .55) + 'px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('NASA', cx, cy + 1);
    for (const [sx, sy] of [[-.5, -.55], [.35, -.62], [-.62, .2], [.55, .5], [.1, .72]]) g.fillRect(cx + sx * r, cy + sy * r, 2, 2);
}

// Boxes standing on the ground, turned `angle` (degrees, the direction of their length `along` in the x-z plane
// measured from +x toward +z, i.e. from east toward south).
function placeBox(mesh, [x, z], angle, height) {
    mesh.position.set(x, groundDrop(x, z) + height / 2, z);
    mesh.rotation.y = -angle * rad;
    return mesh;
}

export function createComplex() {
    const group = new THREE.Group();
    const pieces = new Map();
    const add = (colour, geometry) => { if (!pieces.has(colour)) pieces.set(colour, []); pieces.get(colour).push(geometry); };
    const steel = 0x8e9396, white = 0xe8e9e6, tank = 0xdfe2e3, concrete = 0xb9b6ad;
    const rod = (colour, a, b, radius, sides = 6) => {
        const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), length = start.distanceTo(end);
        add(colour, new THREE.CylinderGeometry(radius, radius, length, sides).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize())).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2));
    };
    const lit = (options) => new THREE.MeshStandardMaterial({ roughness: .82, metalness: .05, ...options });

    // Vehicle Assembly Building: high bay to the north-north-west, low bay at the south end. Its length runs at 76.6°
    // (from east toward south) in the pad's frame; u along it (toward the low bay), v across it (positive west).
    {
        const centre = [-4568.9, 2498.9], angle = 76.6, a = angle * rad, ca = Math.cos(a), sa = Math.sin(a);
        const at = (u, v) => [centre[0] + u * ca - v * sa, centre[1] + u * sa + v * ca];
        const wall = '#cdd1d1', joint = 'rgba(105,113,118,.32)';
        const long = canvasTexture(137 * px, 160 * px, (g, w, h) => { siding(g, w, h, wall, joint, 8); vabDoors(g, w, h, [.25, .75]); });
        const south = canvasTexture(157 * px, 160 * px, (g, w, h) => {
            siding(g, w, h, wall, joint, 8);
            vabFlag(g, w * .2 - 16.75 * px, h - 147 * px);   // the flag on the west half of the face (left from the south)
            vabInsignia(g, w * .76, h - 116 * px);
        });
        const plain = canvasTexture(157 * px, 160 * px, (g, w, h) => siding(g, w, h, wall, joint, 8));
        const roof = lit({ color: 0x8f9396 });
        // Box faces: +x (local u, south end), -x (north end), +y roof, -y, +z (v, west face), -z (east face).
        const highBay = new THREE.Mesh(new THREE.BoxGeometry(136.6, 160.3, 157), [lit({ map: south }), lit({ map: plain }), roof, roof, lit({ map: long }), lit({ map: long })]);
        placeBox(highBay, at(-42.2, 0), angle, 160.3); group.add(highBay);
        const lowWall = canvasTexture(134, 64, (g, w, h) => { siding(g, w, h, '#cfd2d1', 'rgba(120,128,132,.2)', 5); g.fillStyle = 'rgba(90,98,104,.35)'; for (let y = 10; y < h; y += 13) g.fillRect(0, y, w, 1); });
        const lowSide = lit({ map: lowWall }), lowBay = new THREE.Mesh(new THREE.BoxGeometry(79.2, 64, 133.8), [lowSide, lowSide, roof, roof, lowSide, lowSide]);
        placeBox(lowBay, at(65.7, -.3), angle, 64); group.add(lowBay);
        const entrance = new THREE.Mesh(new THREE.BoxGeometry(5.2, 18, 66), lit({ color: 0xc9cccb }));
        placeBox(entrance, at(107.8, .4), angle, 18); group.add(entrance);
        // The Launch Control Center at the VAB's south-east corner, its firing rooms' windows facing the pads
        // (north-east), joined to the VAB by a bridge.
        const glazing = canvasTexture(230, 48, (g, w, h) => {
            siding(g, w, h, '#d9dad6', 'rgba(110,116,120,.25)', 6);
            g.fillStyle = '#26323b'; g.fillRect(6, 20, w - 12, 12);
            g.fillStyle = 'rgba(200,210,214,.5)'; for (let x = 8; x < w - 8; x += 4) g.fillRect(x, 20, 1, 12);
        });
        const lccWall = lit({ color: 0xd9dad6 });
        const lcc = new THREE.Mesh(new THREE.BoxGeometry(115.2, 24, 55.2), [lccWall, lccWall, roof, roof, lit({ map: glazing }), lccWall]);
        placeBox(lcc, [-4402.9, 2548.2], -144.4, 24); group.add(lcc);
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(40.5, 4.5, 3.8), lccWall);
        placeBox(bridge, [-4478.3, 2521.2], -133.5, 4.5); bridge.position.y += 10; group.add(bridge);
    }

    // SpaceX's hangar at the foot of 39A's ramp (the Horizontal Integration Facility, where the rocket is joined lying
    // down and rolled out on the transporter-erector), its door to the north, and the buildings round it.
    {
        const doorFace = canvasTexture(96, 40, (g, w, h) => {
            siding(g, w, h, '#e6e7e3', 'rgba(120,124,126,.25)', 3);
            g.fillStyle = '#c3c7c8'; g.fillRect(12, 6, 72, 34); g.fillStyle = 'rgba(80,86,90,.4)'; for (let y = 10; y < h; y += 4) g.fillRect(12, y, 72, 1);
            g.strokeStyle = '#8b9296'; g.strokeRect(12, 6, 72, 34);
        });
        const side = lit({ map: canvasTexture(190, 40, (g, w, h) => siding(g, w, h, '#e6e7e3', 'rgba(120,124,126,.25)', 3)) }), top = lit({ color: 0xd4d6d3 });
        // Length north-south (local x along +z): faces +x south, -x north (the door), +z west, -z east.
        const hif = new THREE.Mesh(new THREE.BoxGeometry(94.6, 20, 47.9), [side, lit({ map: doorFace }), top, top, side, side]);
        placeBox(hif, [-5.7, 459.4], 90, 20); group.add(hif);
        // Rails from the hangar door up the ramp to the pad.
        for (const s of [-1, 1]) for (let z = 40; z < 412; z += 6) {
            const x = s * 4.5, y0 = Math.max(terrainHeight(x, z), 0), y1 = Math.max(terrainHeight(x, z + 6), 0);
            add(0x55595d, new THREE.BoxGeometry(.5, .3, 6.05).rotateX(Math.atan2(y0 - y1, 6)).translate(x, (y0 + y1) / 2 + .15, z + 3));
        }
        const building = (centre, length, width, angle, height, colour) => group.add(placeBox(new THREE.Mesh(new THREE.BoxGeometry(length, height, width), lit({ color: colour })), centre, angle, height));
        building([10.5, 635], 92.1, 41.1, 125.1, 14, 0xe1e2de);    // Falcon support building
        building([68.1, 423.1], 38, 17, 0, 9, 0xd6d4cc);          // Operations Building No. 1
        building([-212, 78.5], 36.9, 20.2, -30.2, 9, 0xe4e4e0);
        building([-201, 278.2], 21.1, 11.6, 120.7, 6, 0xd9d6cc);  // Hypergol Fuel Facility
        building([262.9, 157.3], 42.1, 21, 29.2, 11, 0xd7d8d4);
        building([240, 191.6], 10.6, 6.5, -60.1, 5, 0xd9d6cc);    // Nitrogen tetroxide facility
        // Horizontal tanks (nitrogen, helium, propellants) on saddles: [x, z, length, diameter, angle].
        const tanks = [[-371.5, -186.7, 35, 5.3, -152.4], [-368.7, -192.7, 35, 5.3, -152.4], [-366.1, -199.2, 35, 5.3, -152.4], [-365.1, -250.1, 39.7, 4, -62.5], [-345.3, -252, 39.7, 4, -62.5],
            [-123, 137.7, 27, 4.6, 125.6], [-117.7, 140.7, 26.9, 4.5, 125.6], [167, -22.1, 44.6, 3.6, -144.1],
            ...[[175.4, -31.5], [177.8, -35.2], [179.9, -38.5], [182.4, -41.5], [185.1, -44.5], [187.5, -47.4]].map(([x, z]) => [x, z, 29, 3, 36.4]),
            ...[[191.5, -139.9], [198.7, -134.6], [206, -129], [213.8, -123.3]].map(([x, z]) => [x, z, 45.2, 7.5, -53.7]), [222.1, -114.8, 48.7, 5, -54], [228.2, -110.4, 48.7, 5, -54],
            [275, -275.9, 45.1, 7.5, 126.3], [285, -269.7, 45.3, 7.5, 126.3], [317.3, -249.5, 48.8, 5, -54], [322.5, -245.9, 48.7, 5, -54]];
        for (const [x, z, length, diameter, angle] of tanks) {
            const r = diameter / 2, turn = -angle * rad, y = r + 1.2 + groundDrop(x, z);
            add(tank, new THREE.CapsuleGeometry(r, Math.max(.1, length - diameter), 6, 16).rotateZ(Math.PI / 2).rotateY(turn).translate(x, y, z));
            for (const f of [-.35, 0, .35]) add(concrete, new THREE.BoxGeometry(1.2, 1.4, diameter * .8).rotateY(turn).translate(x + Math.cos(angle * rad) * f * length, .7 + groundDrop(x, z), z + Math.sin(angle * rad) * f * length));
        }
    }

    // Pad 39B as on Demo-2's day: a clean pad (its service structures gone) under three 600 ft lightning towers joined
    // by catenary wires, the sound suppression water tower, and the hydrogen and oxygen spheres.
    {
        const pad = pads[1], deck = pad.deck;
        // The mobile launcher's mount posts, six round the trench.
        for (const [x, z] of [[-1615, -2090], [-1615, -2108], [-1616, -2139], [-1655, -2090], [-1654, -2108], [-1655, -2138]]) add(concrete, new THREE.BoxGeometry(4, 6.5, 4).translate(x, deck + 3.25, z));
        const towers = [[-1510, -2151], [-1738, -1993], [-1779, -2179]];
        const lattice = canvasTexture(64, 128, (g, w, h) => {
            g.clearRect(0, 0, w, h); g.strokeStyle = '#d7dadb'; g.lineWidth = 6; g.strokeRect(3, -4, w - 6, h + 8);
            g.lineWidth = 3; g.beginPath(); g.moveTo(3, 0); g.lineTo(w - 3, h / 2); g.lineTo(3, h); g.moveTo(w - 3, 0); g.lineTo(3, h / 2); g.lineTo(w - 3, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
        }, [4, 1]);
        const latticeHeight = 152, mastTop = 183;
        const latticeMaterial = new THREE.MeshStandardMaterial({ map: lattice, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: .7, metalness: .3 });
        lattice.repeat.set(4, latticeHeight / 9);
        const tops = [];
        for (const [x, z] of towers) {
            const base = groundDrop(x, z);
            const body = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 7, latticeHeight, 4, 1, true).rotateY(Math.PI / 4), latticeMaterial);
            body.position.set(x, base + latticeHeight / 2, z); body.renderOrder = 1; group.add(body);
            add(0x6d7276, new THREE.BoxGeometry(5.6, 1.4, 5.6).translate(x, base + latticeHeight, z));
            rod(0xd8d8d2, [x, base + latticeHeight, z], [x, base + mastTop, z], .9, 8);   // the fibreglass mast
            tops.push(new THREE.Vector3(x, base + mastTop - 2, z));
        }
        // Catenary wires between the masts' tops, sagging, and from each down to an anchor beyond the pad.
        const wire = [];
        const hang = (a, b, sag) => { for (let k = 0; k < 40; k++) { const f0 = k / 40, f1 = (k + 1) / 40; for (const f of [f0, f1]) wire.push(new THREE.Vector3().lerpVectors(a, b, f).setY(THREE.MathUtils.lerp(a.y, b.y, f) - sag * 4 * f * (1 - f))); } };
        for (let k = 0; k < 3; k++) hang(tops[k], tops[(k + 1) % 3], 22);
        const middle = new THREE.Vector3(pad.x, 0, pad.z);
        for (const top of tops) { const out = top.clone().sub(middle).setY(0).setLength(330).add(top); out.y = groundDrop(out.x, out.z); hang(top, out, 14); }
        group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x2b2e31 })));
        waterTower(add, rod, [-1533, -2227]);
        add(tank, new THREE.SphereGeometry(11, 32, 20).translate(-1263, 11 + groundDrop(-1263, -2341), -2341));   // liquid hydrogen
        add(tank, new THREE.SphereGeometry(11, 32, 20).translate(-2033, 11 + groundDrop(-2033, -2357), -2357));   // liquid oxygen
    }

    // Trench walls and floors at both pads: concrete, the walls as tall as the mound beside them (and a low wall where
    // the trench runs on past the mound's foot); 39A's is scorched where the exhaust leaves it.
    for (const pad of pads) {
        const { half, north, south } = pad.trench, walls = [];
        for (const s of [-1, 1]) for (let z = pad.z - north; z < pad.z + south - 1e-6; z += 3) {
            const z1 = Math.min(pad.z + south, z + 3), x = pad.x + s * half;
            const h0 = Math.max(1.8, terrainHeight(x + s * .05, z)), h1 = Math.max(1.8, terrainHeight(x + s * .05, z1));
            walls.push(x, 0, z, x, h0, z, x, 0, z1, x, h0, z, x, h1, z1, x, 0, z1);
        }
        const back = pad.z + south;
        walls.push(pad.x - half, 0, back, pad.x + half, 0, back, pad.x - half, pad.deck, back, pad.x + half, 0, back, pad.x + half, pad.deck, back, pad.x - half, pad.deck, back);
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(walls, 3)); geometry.computeVertexNormals();
        const wallMesh = new THREE.Mesh(geometry, lit({ color: 0x9f9b92, side: THREE.DoubleSide })); group.add(wallMesh);
        const floor = new THREE.Mesh(new THREE.BoxGeometry(half * 2, .2, north + south), lit({ color: 0x3a3733 }));
        floor.position.set(pad.x, .1, pad.z + (south - north) / 2); group.add(floor);
        // The flame deflector: a ramp from under the mount down to the trench floor, turning the exhaust north.
        const deflector = new THREE.Mesh(new THREE.BoxGeometry(half * 2 - .2, 1.2, Math.hypot(pad.deck - 2, 28)), lit({ color: 0x4a4641 }));
        deflector.rotation.x = -Math.atan2(pad.deck - 2, 28); deflector.position.set(pad.x, (pad.deck - 2) / 2, pad.z + south - 14); group.add(deflector);
    }

    for (const [colour, geometries] of pieces) group.add(new THREE.Mesh(mergeGeometries(geometries, false), lit({ color: colour, roughness: .75, metalness: .2 })));
    return group;
}

// A sound suppression water tower: the tank 89 m up on four splayed legs with bracing.
export function waterTower(add, rod, [x, z]) {
    const steel = 0x8e9396, base = groundDrop(x, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(steel, [x + sx * 6, base, z + sz * 6], [x + sx * 3, base + 77, z + sz * 3], .45);
    for (let y = 12; y < 77; y += 13) {
        const w = 6 - 3 * y / 77;
        for (const s of [-1, 1]) { add(steel, new THREE.BoxGeometry(2 * w, .4, .4).translate(x, base + y, z + s * w)); add(steel, new THREE.BoxGeometry(.4, .4, 2 * w).translate(x + s * w, base + y, z)); }
    }
    add(0xdfe2e3, new THREE.SphereGeometry(6.5, 24, 16).scale(1, .9, 1).translate(x, base + 83, z));
}
