// External payloads (AMS-02, ELC-1 to ELC-4, ESP-3) rebuilt from the reference model's components.
import * as THREE from 'three';
import { assetData } from './data.js';
import { Kit, material, shapes } from './kit.js';
import { carrierGrid, payloadAttachSite, payloadBlanket, payloadCanvas } from './surfaces.js';

// BEGIN PAYLOAD REFERENCE: AMS-02, ELC-1 to ELC-4 and ESP-3, measured on the supplied GLB (nodes 64, 62, 63, 61, 76
// and 77) and redrawn in this scene's materials. Each GLB component is a box, an extruded outline, a lathe or a
// hexahedron; the small irregular fittings (grapple-fixture cams, trunnion caps, soft bags) keep their welded
// shape. Values are station-axis metres from the payload's truss contact; surface classes come from the GLB atlas
// region or shade of each component.
const payloadReference = assetData.payloadReference;
// Scaled with the pressurized modules: Harmony's radius here over the GLB's.
const payloadReferenceScale = 2.15 / 2.299739;
const payloadBlanketWrap = payloadBlanket.map.clone();
payloadBlanketWrap.wrapS = payloadBlanketWrap.wrapT = THREE.RepeatWrapping; payloadBlanketWrap.repeat.set(.8, .8); payloadBlanketWrap.needsUpdate = true;
const payloadDecal = (width, height, draw) => {
    const surface = material(0xffffff, .8, .05, payloadCanvas(width, height, draw)).clone();
    surface.polygonOffset = true; surface.polygonOffsetFactor = -1; surface.polygonOffsetUnits = -1; surface.userData.decal = true;
    return surface;
};
const payloadSkins = {
    dark: material(0x6f767a, .7, .2), mid: material(0x969da0, .62, .25), light: material(0xbcc2c3, .58, .2),
    panel: material(0xd4d8d5, .64, .1), bronze: material(0x9a7448, .42, .6), blanket: payloadBlanket,
    blanketWrap: Object.assign(payloadBlanket.clone(), { map: payloadBlanketWrap }), deck: material(0x8c9183, .72, .25),
    deckGrid: material(0xffffff, .86, .12, carrierGrid), amsCase: material(0xb8bdbf, .45, .45), amsTop: material(0xa7acae, .8, .05),
    emblem: material(0xe2e4e0, .7, .05), radiator: material(0xe7e9e5, .72, .04), strap: 0xc0c6be, handle: 0x69706a,
    // Serpentine heat pipes in two loops over a riveted panel, after the GLB radiator image.
    amsRadiator: material(0xffffff, .5, .3, payloadCanvas(256, 256, g => {
        g.fillStyle = '#cdd1d2'; g.fillRect(0, 0, 256, 256);
        g.strokeStyle = '#9ba1a4'; g.lineWidth = 7; g.lineJoin = 'round';
        for (const x0 of [26, 138]) {
            g.beginPath(); g.moveTo(x0, 30);
            for (let pass = 0; pass < 4; pass++) { const x = x0 + pass * 28, y = pass % 2 ? 30 : 226; g.lineTo(x, y); if (pass < 3) g.lineTo(x + 28, y); }
            g.stroke();
        }
        g.fillStyle = '#a7adaf'; for (let x = 12; x < 256; x += 22) for (const y of [10, 246]) { g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill(); }
        g.strokeStyle = '#8f9598'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 250);
    })),
    // The octagonal top cover, lettered twice as on the GLB, around the central disc.
    amsLettering: payloadDecal(512, 512, g => {
        g.fillStyle = '#a3a9ab'; g.fillRect(0, 0, 512, 512);
        g.fillStyle = '#5d6f86'; g.beginPath(); g.arc(256, 256, 54, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#2b2f36'; g.font = '800 104px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AMS', 256, 132);
        g.save(); g.translate(256, 380); g.rotate(Math.PI); g.fillText('AMS', 0, 0); g.restore();
    }),
    // AMS-02 mission patch: a shield with the blue field, red arc and white lettering.
    amsPatch: payloadDecal(128, 160, g => {
        const shield = () => { g.beginPath(); g.moveTo(10, 10); g.lineTo(118, 10); g.lineTo(118, 96); g.quadraticCurveTo(118, 130, 64, 152); g.quadraticCurveTo(10, 130, 10, 96); g.closePath(); };
        g.fillStyle = '#f1f2ee'; g.fillRect(0, 0, 128, 160);
        shield(); g.fillStyle = '#23407a'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#d9dcd9'; g.stroke();
        g.strokeStyle = '#c8323a'; g.lineWidth = 7; g.beginPath(); g.arc(64, 112, 42, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
        g.fillStyle = '#ffffff'; g.font = '700 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AMS-02', 64, 52);
    })
};
const payloadAxis = (geometry, index) => [geometry.attributes.position.getX, geometry.attributes.position.getY, geometry.attributes.position.getZ][index];
// Planar UVs over a geometry's own extent on two local axes, so a canvas covers it once.
function payloadFitUv(geometry, a = 0, b = 1) {
    geometry.computeBoundingBox();
    const position = geometry.attributes.position, uv = geometry.attributes.uv, box = geometry.boundingBox;
    const lo = box.min.toArray(), span = box.max.toArray().map((value, index) => Math.max(value - lo[index], 1e-6));
    const getA = payloadAxis(geometry, a), getB = payloadAxis(geometry, b);
    for (let i = 0; i < position.count; i++) uv.setXY(i, (getA.call(position, i) - lo[a]) / span[a], (getB.call(position, i) - lo[b]) / span[b]);
    return geometry;
}
function payloadShape(outline, holes = []) {
    const trace = (points, path) => {
        for (let i = 0; i < points.length; i += 2) i ? path.lineTo(points[i], points[i + 1]) : path.moveTo(points[i], points[i + 1]);
        path.closePath(); return path;
    };
    const shape = trace(outline, new THREE.Shape());
    for (const hole of holes) shape.holes.push(trace(hole, new THREE.Path()));
    return shape;
}
const payloadPrism = (outline, holes, depth) => new THREE.ExtrudeGeometry(payloadShape(outline, holes), { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
function payloadLathe(profile, segments, phiStart, phiLength) {
    const points = [];
    for (let i = 0; i < profile.length; i += 2) points.push(new THREE.Vector2(profile[i], profile[i + 1]));
    return new THREE.LatheGeometry(points, segments, phiStart, phiLength);
}
// A hexahedron from its eight corners, indexed by the signs of a box corner: x + 2y + 4z.
function payloadHexahedron(corners) {
    const geometry = new THREE.BoxGeometry(1, 1, 1), position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
        const k = (position.getX(i) > 0 ? 1 : 0) + (position.getY(i) > 0 ? 2 : 0) + (position.getZ(i) > 0 ? 4 : 0);
        position.setXYZ(i, corners[k * 3], corners[k * 3 + 1], corners[k * 3 + 2]);
    }
    geometry.computeVertexNormals(); return geometry;
}
// A welded GLB fitting, smooth-shaded for the soft bags, with box-projected UVs in metres.
function payloadMesh(points, faces, smooth) {
    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); geometry.setIndex(faces);
    if (!smooth) geometry = geometry.toNonIndexed();
    geometry.computeVertexNormals();
    const position = geometry.attributes.position, normal = geometry.attributes.normal, uv = new Float32Array(position.count * 2);
    for (let i = 0; i < position.count; i++) {
        const ax = Math.abs(normal.getX(i)), ay = Math.abs(normal.getY(i)), az = Math.abs(normal.getZ(i));
        uv[i * 2] = ax >= ay && ax >= az ? position.getZ(i) : position.getX(i);
        uv[i * 2 + 1] = ay > ax && ay >= az ? position.getZ(i) : position.getY(i);
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geometry;
}
// Piping round the outer face of a blanketed box and two raised handling straps, as on the GLB blankets. The outer
// face is the one across `axis` on `side`.
function payloadBlanketDetail(kit, centre, size, axis, side) {
    const [i, j] = [0, 1, 2].filter(k => k !== axis);
    const at = (offset, u, v) => { const p = [...centre]; p[axis] += side * (size[axis] / 2 + offset); p[i] += u; p[j] += v; return p; };
    const wi = size[i], wj = size[j];
    for (const u of [-wi * .455, wi * .455]) kit.rod(at(.007, u, -wj * .44), at(.007, u, wj * .44), .006, payloadSkins.strap);
    for (const v of [-wj * .455, wj * .455]) kit.rod(at(.007, -wi * .44, v), at(.007, wi * .44, v), .006, payloadSkins.strap);
    const long = wi >= wj, reach = Math.min(.16, (long ? wi : wj) * .2);
    for (const offset of [-.25, .25]) {
        const across = (long ? wj : wi) * offset, point = (lift, along) => long ? at(lift, along, across) : at(lift, across, along);
        const path = [point(0, -reach), point(.031, -reach * .73), point(.031, reach * .73), point(0, reach)];
        for (let k = 1; k < path.length; k++) kit.rod(path[k - 1], path[k], .010, payloadSkins.handle);
    }
}
// The stowed radiator's stacked panels show on its narrow faces; a frame borders the broad outer face.
function payloadRadiatorDetail(kit, centre, size, side) {
    const [x, y, z] = centre, [sx, sy, sz] = size;
    for (const end of [-1, 1]) for (let k = 1; k < 10; k++)
        kit.box([x - sx / 2 + sx * k / 10, y, z + end * (sz / 2 + .008)], [.014, sy * .96, .016], 0xb3b8ba, [0, 0, 0], false);
    const face = x + side * (sx / 2 + .012);
    for (const end of [-1, 1]) {
        kit.box([face, y + end * (sy / 2 - .05), z], [.024, .06, sz - .04], 0xc5c9c8, [0, 0, 0], false);
        kit.box([face, y, z + end * (sz / 2 - .05)], [.024, sy - .04, .06], 0xc5c9c8, [0, 0, 0], false);
    }
}
// A measured part's geometry and its placement [position, scale, rotation]; hexahedra and welded meshes carry
// their own coordinates.
export function measuredGeometry(part, smooth = false) {
    switch (part[0]) {
        case 'b': return shapes.box;
        case 'p': return payloadPrism(part[9], part[10], part[8]);
        case 'l': return payloadLathe(part[11], part[8], part[9], part[10]);
        case 'h': return payloadHexahedron(part[2]);
        default: return payloadMesh(part[2], part[3], smooth);
    }
}
export function measuredPlacement(part) {
    if (part[0] === 'b') return [part.slice(2, 5), part.slice(5, 8), part.slice(8, 11)];
    if (part[0] === 'p' || part[0] === 'l') return [part.slice(2, 5), [1, 1, 1], part.slice(5, 8)];
    return [[0, 0, 0], [1, 1, 1], [0, 0, 0]];
}
// One payload as an assembly whose truss contact sits on `mount`.
function referencePayload(name, mount) {
    const payload = payloadReference.payloads[name], assembly = new THREE.Group(), kit = new Kit();
    assembly.name = name; assembly.position.fromArray(mount); assembly.scale.setScalar(payloadReferenceScale);
    assembly.userData.reference = { source: payloadReference.source + ' / ' + payload.nodeName, contact: payload.contact, size: payload.size, parts: payload.parts.length, scale: payloadReferenceScale };
    const deck = payload.parts.find(part => part[1] === 'deck'), core = payload.parts.find(part => part[1] === 'amsCase');
    const local = new THREE.Euler(), axis = new THREE.Vector3();
    // Which way a part's local z axis faces, relative to a reference point (the deck or the AMS core).
    const facing = (part, origin) => {
        local.set(part[5], part[6], part[7]); axis.set(0, 0, 1).applyEuler(local);
        return Math.sign(axis.dot(new THREE.Vector3(part[2] - origin[2], part[3] - origin[3], part[4] - origin[4]))) || 1;
    };
    for (const part of payload.parts) {
        const [kind, skin] = part, geometry = measuredGeometry(part, skin === 'blanket'), [centre, scale, turn] = measuredPlacement(part);
        if (skin === 'amsRadiator') payloadFitUv(geometry);
        kit.add(geometry, payloadSkins[skin === 'blanket' && kind !== 'b' ? 'blanketWrap' : skin], centre, scale, turn);
        if (kind === 'b' && deck) {
            const outward = Math.sign(centre[0] - deck[2]) || 1;
            if (skin === 'blanket') payloadBlanketDetail(kit, centre, scale, 0, outward);
            if (skin === 'radiator') payloadRadiatorDetail(kit, centre, scale, outward);
        }
        if (kind !== 'p') continue;
        const depth = part[8], outline = part[9];
        if (skin === 'deck') {
            // The shared 9-by-6 grid on both faces, nine cells along the deck's long side.
            geometry.computeBoundingBox();
            const box = geometry.boundingBox, width = box.max.x - box.min.x - .32, height = box.max.y - box.min.y - .32;
            for (const side of [-1, 1]) {
                const grid = new THREE.PlaneGeometry(Math.max(width, height), Math.min(width, height));
                if (height > width) grid.rotateZ(Math.PI / 2);
                if (side < 0) grid.rotateY(Math.PI);
                grid.translate((box.max.x + box.min.x) / 2, (box.max.y + box.min.y) / 2, side * (depth / 2 + .004));
                kit.add(grid, payloadSkins.deckGrid, centre, [1, 1, 1], turn, false);
            }
        }
        if (skin === 'amsCase') {
            // Circumferential ribs on the magnet's vacuum case.
            let radius = 0;
            for (let i = 0; i < outline.length; i += 2) radius = Math.max(radius, Math.hypot(outline[i], outline[i + 1]));
            for (let k = 0; k < 14; k++) kit.add(new THREE.TorusGeometry(radius + .004, .013, 6, 48).translate(0, 0, -depth / 2 + depth * (k + .5) / 14), payloadSkins.light, centre, [1, 1, 1], turn, false);
        }
        if ((skin === 'amsTop' && depth < .1 || skin === 'emblem') && core) {
            // Lettering on the cover's outer face; the mission patch upright on each emblem panel.
            const side = facing(part, core);
            const decal = skin === 'emblem' ? new THREE.PlaneGeometry(.42, .52) : payloadFitUv(new THREE.ShapeGeometry(payloadShape(outline)));
            if (side < 0) decal.rotateY(Math.PI);
            if (skin === 'emblem') {
                const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion().setFromEuler(local.set(...turn)).invert());
                decal.rotateZ(Math.atan2(-up.x, up.y));
            }
            decal.translate(0, 0, side * (depth / 2 + .003));
            kit.add(decal, payloadSkins[skin === 'emblem' ? 'amsPatch' : 'amsLettering'], centre, [1, 1, 1], turn, false);
        }
    }
    kit.finish(assembly);
    return assembly;
}
// GLB contact stations keep their place between the segment's end frames: 21.081 and 26.249 m from the centreline
// in the GLB, 16 and 22.7 m here. P3 mirrors S3, as its sites do in the GLB.
const payloadStation = glbX => Math.sign(glbX) * (16 + 6.7 * (Math.abs(glbX) - 21.08088) / 5.16853);
// AMS-02 sits 0.25 m outboard of its mapped station: its inboard radiators would otherwise cut the edge of the S1
// radiator bank, which stays on its fixed centreline.
const payloadStationShift = { 'AMS-02': .25 };
// A reference payload on its own attach-site bridge, the bridge sized to the payload's footprint.
export function seatedPayload(kit, name) {
    const payload = payloadReference.payloads[name], up = payload.face, x = payloadStation(payload.contact[0]) + (payloadStationShift[name] || 0);
    payloadAttachSite(kit, x, up, payload.footprint.map(v => v * payloadReferenceScale));
    return referencePayload(name, [x, up > 0 ? 9.05 : 4.98, 4]);
}
// END PAYLOAD REFERENCE
