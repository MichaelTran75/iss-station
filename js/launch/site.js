// Everything else standing round the pads on Demo-2's day, from data/launch-site.json (made by launchsite.py): the
// buildings of Launch Complex 39, the KSC industrial area round the VAB and the Cape's pads to the south (SLC-41 and
// its Vertical Integration Facility, SLC-40), with the lightning towers, masts, light poles and flare stacks, the
// propellant spheres and the water towers. Metres in the pad's local frame (x east, y up, z south).
// - Footprints: OpenStreetMap (© OpenStreetMap contributors, ODbL); where it has none, USA Structures (FEMA/ORNL).
// - Heights, and whether a structure stood there at all: USGS 3DEP lidar flown in January and February 2019 (the
//   Starship tower and tank farm at 39A, 39B's new hydrogen sphere and the hangars SpaceX built since are left out).
//   Each roof is flat at its measured level; a roof with two clear levels comes as two blocks. The spheres and water
//   tanks are fitted to the lidar's points.
// - Roofs take their colour from the USGS image of them; walls a pale cladding with a hint of it.
// - Lightning towers: steel lattice to seven eighths of their height and a mast above, the four round SLC-40 and SLC-41
//   joined by catenary wires (round the pad and across it, over the rocket); the wires are too thin for the lidar,
//   so they hang where the towers' tops are.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundDrop, latticeBody, latticeMaterial, terrainHeight } from './complex.js';

const tank = 0xdfe2e3, steel = 0x8e9396;

// Pale siding for the walls (faint panel joints every metre, a darker band at the foot) and a roof membrane; both
// tinted by the vertex colours.
function canvasTexture(size, draw, every) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    draw(canvas.getContext('2d'), size);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1 / every, 1 / every);
    return texture;
}
const sidingMap = () => canvasTexture(64, (g, s) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(80,86,92,.22)'; for (let x = 0; x < s; x += 16) g.fillRect(x, 0, 2, s);   // joints every metre (16 px)
    g.fillStyle = 'rgba(255,255,255,.5)'; for (let x = 4; x < s; x += 16) g.fillRect(x, 0, 1, s);
}, 4);
const roofMap = () => canvasTexture(64, (g, s) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(70,74,78,.12)'; for (let y = 0; y < s; y += 8) g.fillRect(0, y, s, 1);
}, 4);

export function createSite(data) {
    const group = new THREE.Group(); group.name = 'launch site';
    const colour = new THREE.Color();

    // Buildings: walls and roofs, each one geometry for the lot.
    const walls = { position: [], normal: [], color: [], uv: [] }, roofs = { position: [], normal: [], color: [], uv: [] };
    const push = (into, p, n, c, uv) => { into.position.push(...p); into.normal.push(...n); into.color.push(c.r, c.g, c.b); into.uv.push(...uv); };
    const wallColour = new THREE.Color(), shaded = new THREE.Color();
    const ringOf = flat => { const ring = []; for (let i = 0; i < flat.length; i += 2) ring.push([flat[i] / 10, flat[i + 1] / 10]); return ring; };
    const area = ring => { let a = 0; for (let i = 0; i < ring.length; i++) { const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % ring.length]; a += x0 * z1 - x1 * z0; } return a / 2; };
    const base = (x, z) => groundDrop(x, z) + terrainHeight(x, z) - .3;   // a little into the ground
    // A wall along a ring from the ground (or `bottom`) up to `top`, facing out of the solid (`facing` +1 for an outer
    // ring, -1 for a courtyard's); texture coordinates in metres along and up it. The foot of a wall is a little darker
    // (over its first 6 m), as the ground shades it.
    function wallRing(ring, top, facing, bottom) {
        const sign = Math.sign(area(ring)) * facing;
        let run = 0;
        for (let i = 0; i < ring.length; i++) {
            const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], length = Math.hypot(bx - ax, bz - az);
            if (length < .05) continue;
            const nx = (bz - az) / length * sign, nz = -(bx - ax) / length * sign;
            const a0 = bottom ?? base(ax, az), b0 = bottom ?? base(bx, bz);
            const corners = [[ax, a0, az, run, 0], [bx, b0, bz, run + length, 0], [bx, top, bz, run + length, top - b0], [ax, top, az, run, top - a0]];
            // Wound to face (nx, nz): a triangle from the edge up has its normal along (-dz, dx).
            const order = (-(bz - az) * nx + (bx - ax) * nz) > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
            for (const k of order) {
                const [x, y, z, u, v] = corners[k];
                shaded.copy(wallColour).multiplyScalar(bottom !== undefined ? 1 : k < 2 ? .78 : .78 + .22 * Math.min(1, v / 6));
                push(walls, [x, y, z], [nx, 0, nz], shaded, [u, v]);
            }
            run += length;
        }
    }
    // A flat roof at `y` over the ring (and its courtyards), facing up (or down for a canopy's underside).
    function roof(ring, holes, y, up, tint) {
        const contour = ring.map(([x, z]) => new THREE.Vector2(x, z)), voids = holes.map(h => h.map(([x, z]) => new THREE.Vector2(x, z)));
        const points = [...contour, ...voids.flat()];
        for (const face of THREE.ShapeUtils.triangulateShape(contour, voids)) {
            const [a, b, c] = face.map(i => points[i]);
            // y of the triangle's normal: (b - a) × (c - a) in (x, y, z) with the triangle flat at y.
            const ny = (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
            const order = (ny > 0) === up ? [a, b, c] : [a, c, b];
            for (const p of order) push(roofs, [p.x, y, p.y], [0, up ? 1 : -1, 0], tint, [p.x, p.y]);
        }
    }
    const posts = [];
    for (const building of data.buildings) {
        const ring = ringOf(building.p), holes = (building.q || []).map(ringOf);
        let cx = 0, cz = 0, highest = -Infinity;
        for (const [x, z] of ring) { cx += x / ring.length; cz += z / ring.length; highest = Math.max(highest, terrainHeight(x, z)); }
        const top = Math.max(groundDrop(cx, cz) + building.h, groundDrop(cx, cz) + highest + 1);
        colour.set('#' + building.r); wallColour.set('#' + building.w);
        if (building.c) {
            // A canopy: a slab 0.5 m deep on posts at its corners.
            wallRing(ring, top, 1, top - .5);
            roof(ring, holes, top, true, colour); roof(ring, holes, top - .5, false, wallColour);
            if (ring.length <= 8) for (const [x, z] of ring) posts.push(new THREE.BoxGeometry(.3, top - .5 - base(x, z), .3).translate(x, (top - .5 + base(x, z)) / 2, z));
            continue;
        }
        wallRing(ring, top, 1);
        for (const hole of holes) wallRing(hole, top, -1);
        roof(ring, holes, top, true, colour);
    }
    const geometry = into => {
        const g = new THREE.BufferGeometry();
        for (const [name, size] of [['position', 3], ['normal', 3], ['color', 3], ['uv', 2]]) g.setAttribute(name, new THREE.Float32BufferAttribute(into[name], size));
        return g;
    };
    group.add(new THREE.Mesh(geometry(walls), new THREE.MeshStandardMaterial({ map: sidingMap(), vertexColors: true, roughness: .8, metalness: .05 })));
    group.add(new THREE.Mesh(geometry(roofs), new THREE.MeshStandardMaterial({ map: roofMap(), vertexColors: true, roughness: .9, metalness: .02 })));

    // Solid pieces merged per colour.
    const pieces = new Map();
    const add = (hex, g) => { if (!pieces.has(hex)) pieces.set(hex, []); pieces.get(hex).push(g); };
    const rod = (hex, a, b, radius, sides = 6) => {
        const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
        add(hex, new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), sides).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize())).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2));
    };
    for (const post of posts) add(0x9a9c9a, post);

    // Towers. Lattice bodies share the see-through lattice of 39B's towers (js/launch/complex.js).
    const lattice = latticeMaterial(), wires = [], tops = [];
    const latticeTower = (x, z, foot, height, bottomHalf, topHalf) => {
        const body = new THREE.Mesh(latticeBody(bottomHalf, topHalf, height), lattice);
        body.position.set(x, foot + height / 2, z); body.renderOrder = 1; group.add(body);
    };
    const hang = (a, b, sag) => { for (let k = 0; k < 40; k++) for (const f of [k / 40, (k + 1) / 40]) wires.push(new THREE.Vector3().lerpVectors(a, b, f).setY(THREE.MathUtils.lerp(a.y, b.y, f) - sag * 4 * f * (1 - f))); };
    for (const tower of data.towers) {
        const { x, z } = tower, foot = groundDrop(x, z) + terrainHeight(x, z), top = groundDrop(x, z) + tower.h, tall = top - foot;
        if (tower.k === 'lightning') {
            const steelTop = tall * .875;
            latticeTower(x, z, foot, steelTop, 4.5, 1.6);
            add(0x6d7276, new THREE.BoxGeometry(3.8, 1.2, 3.8).translate(x, foot + steelTop, z));
            rod(0xd8d8d2, [x, foot + steelTop, z], [x, top, z], .55, 8);   // the mast
        } else if (tower.k === 'mast') {
            if (tall > 120) {
                // A guyed mast (KSC's weather tower), three guys at three heights out to anchors 60% of its height away.
                latticeTower(x, z, foot, tall, 1.1, 1.1);
                for (let k = 0; k < 3; k++) {
                    const a = k * Math.PI * 2 / 3 + .3, anchor = [x + Math.cos(a) * tall * .6, foot, z + Math.sin(a) * tall * .6];
                    for (const f of [.35, .65, .95]) wires.push(new THREE.Vector3(...anchor), new THREE.Vector3(x, foot + tall * f, z));
                }
            } else latticeTower(x, z, foot, tall, 3, .8);
            rod(steel, [x, top - 3, z], [x, top, z], .12);
        } else if (tower.k === 'light') {
            rod(0xa8acae, [x, foot, z], [x, top - .6, z], .22);
            add(0x5a5e62, new THREE.BoxGeometry(1.8, 1.2, .6).translate(x, top - .6, z));
        } else {
            rod(0x7a7e82, [x, foot, z], [x, top, z], .45, 10);   // a flare stack
            add(0x3b3f44, new THREE.CylinderGeometry(.6, .6, .8, 10).translate(x, top - .4, z));
        }
        tops.push(new THREE.Vector3(x, top - 1.5, z));
    }
    // Catenary wires over SLC-40 and SLC-41: tower to tower round the pad, and across it.
    for (const ring of data.catenaries) {
        for (let k = 0; k < ring.length; k++) { const a = tops[ring[k]], b = tops[ring[(k + 1) % ring.length]]; hang(a, b, a.distanceTo(b) * .05); }
        if (ring.length === 4) for (const [i, j] of [[0, 2], [1, 3]]) hang(tops[ring[i]], tops[ring[j]], tops[ring[i]].distanceTo(tops[ring[j]]) * .05);
    }
    if (wires.length) group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wires), new THREE.LineBasicMaterial({ color: 0x2b2e31 })));

    // Propellant spheres on eight columns to their equators.
    for (const { x, z, y, r } of data.spheres) {
        const foot = groundDrop(x, z);
        add(tank, new THREE.SphereGeometry(r, 32, 20).translate(x, foot + y, z));
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; rod(steel, [x + Math.cos(a) * r * .92, foot, z + Math.sin(a) * r * .92], [x + Math.cos(a) * r * .9, foot + y, z + Math.sin(a) * r * .9], .35); }
    }
    // Sound suppression water towers: the tank on four splayed legs with bracing.
    for (const { x, z, y, r } of data.waterTowers) {
        const foot = groundDrop(x, z), legTop = y - r * .75;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(steel, [x + sx * 6, foot, z + sz * 6], [x + sx * 3, foot + legTop, z + sz * 3], .45);
        for (let h = 12; h < legTop; h += 13) {
            const w = 6 - 3 * h / legTop;
            for (const s of [-1, 1]) { add(steel, new THREE.BoxGeometry(2 * w, .4, .4).translate(x, foot + h, z + s * w)); add(steel, new THREE.BoxGeometry(.4, .4, 2 * w).translate(x + s * w, foot + h, z)); }
        }
        add(tank, new THREE.SphereGeometry(r, 24, 16).translate(x, foot + y, z));
    }
    for (const [hex, geometries] of pieces) group.add(new THREE.Mesh(mergeGeometries(geometries, false), new THREE.MeshStandardMaterial({ color: hex, roughness: .75, metalness: .2 })));
    return group;
}
