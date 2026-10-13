// Pressurized module hulls: the barrel with its skin, handholds and conduits, generic end interfaces, and
// radial port stubs.
import * as THREE from 'three';
import { Kit, material, palette, shapes } from './kit.js';
import { ring } from './station.js';
import { quiltPanel, quiltPanels, quiltSeam } from './surfaces.js';

function tubeModule(kit, length, radius, options = {}) {
    // The quilted skin sits 45 mm proud of the pressure shell, where fittings met the flat panels' faces.
    const half = length / 2, quilted = options.skin === 'quilted' && !options.profile, skinLift = .045;
    const profile = options.profile || [[0, 1], [1, 1]];
    function bodyRadius(depth) {
        const fraction = THREE.MathUtils.clamp((depth + half) / length, 0, 1);
        let end = profile.findIndex(point => point[0] >= fraction);
        end = Math.max(1, end < 0 ? profile.length - 1 : end);
        const start = profile[end - 1], finish = profile[end];
        return radius * THREE.MathUtils.lerp(start[1], finish[1], (fraction - start[0]) / (finish[0] - start[0]));
    }
    function surfacePoint(angle, depth, lift = 0) {
        const radial = bodyRadius(depth) + lift;
        return [Math.cos(angle) * radial, Math.sin(angle) * radial, depth];
    }
    if (options.profile) kit.add(new THREE.LatheGeometry(profile.map(point => new THREE.Vector2(radius * point[1], length * (point[0] - .5))), 32),
        material(options.color || palette.hull), [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
    // A hollow module keeps no end discs; its end hardware closes the shell, so the interior stays empty.
    else if (options.hollow) kit.add(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), material(options.color || palette.hull), [0, 0, 0], [radius, length, radius], [Math.PI / 2, 0, 0]);
    else kit.cylinder([0, 0, 0], radius, length, options.color || palette.hull);
    // Modules with measured CBMs supply their own end interfaces.
    for (const side of [-1, 1]) {
        if (options.endInterfaceSides && !options.endInterfaceSides.includes(side)) continue;
        genericEndInterface(kit, side, bodyRadius(side * half), half, options.hollow);
    }
    // Shield panel joins remain shallow; fasteners are schematic, not an engineering layout.
    const bays = Math.max(3, Math.round(length / 1.35));
    for (let bay = 0; bay <= bays; bay++) {
        // The quilted skin keeps only the end frames; its seams divide the bays.
        if (quilted && bay > 0 && bay < bays) continue;
        const depth = -half + bay * length / bays;
        ring(kit, [0, 0, depth], bodyRadius(depth) + (quilted ? skinLift + .012 : .014), 'z', bay % 3 === 0 ? palette.silver : palette.hull, .032);
    }
    if (!quilted) for (let seam = 0; seam < 12; seam++) {
        const angle = seam * Math.PI / 6;
        kit.line(profile.map(point => surfacePoint(angle, length * (point[0] - .5), .025)));
    }
    if (quilted) {
        // Kibo-style skin: sixteen columns of quilted panels in every bay, over dark seams.
        kit.add(new THREE.CylinderGeometry(radius + skinLift - .005, radius + skinLift - .005, length, 64, 1, true), quiltSeam, [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0], false);
        for (let bay = 0; bay < bays; bay++) for (let column = 0; column < 16; column++) {
            const z0 = -half + bay * length / bays, a0 = column * Math.PI / 8;
            quiltPanel(kit, radius + skinLift, z0 + .016, z0 + length / bays - .016, a0 + .005, a0 + Math.PI / 8 - .005, quiltPanels[(bay + column) % 2]);
        }
    } else if (!options.profile) for (let belt = 0; belt < 8; belt++) {
        const angle = belt * Math.PI / 4;
        for (let bay = 0; bay < bays; bay++) {
            const depth = -half + (bay + .5) * length / bays;
            const panelWidth = radius * .63, panelLength = length / bays - .12;
            const center = [Math.sin(angle) * (radius + .025), Math.cos(angle) * (radius + .025), depth];
            kit.box(center, [panelWidth, .065, panelLength], (bay + belt) % 5 === 0 ? palette.white : (bay + belt) % 7 === 0 ? 0xbec5c1 : palette.hull, [0, 0, -angle], false);
            // Two diagonally opposed captive fasteners on each removable panel.
            for (const corner of [-1, 1]) {
                const offset = corner * (panelWidth * .5 - .10);
                kit.box([center[0] + Math.cos(angle) * offset + Math.sin(angle) * .043, center[1] - Math.sin(angle) * offset + Math.cos(angle) * .043, depth + corner * (panelLength * .5 - .10)], [.085, .035, .09], palette.silver, [0, 0, -angle], false);
            }
        }
    }
    // EVA handholds sit on paired standoffs and follow tapered hull sections.
    const handles = Math.max(1, Math.floor(length / 1.65));
    for (const angle of [Math.PI / 4, Math.PI * 3 / 4, Math.PI * 1.5]) {
        for (let handle = 0; handle < handles; handle++) {
            const depth = -half + (handle + .5) * length / handles;
            const railHalf = Math.min(options.handholdHalfLength ?? .34, length / handles * .27);
            const a = surfacePoint(angle, depth - railHalf, .16), b = surfacePoint(angle, depth + railHalf, .16);
            kit.rod(a, b, .033, palette.gold);
            for (const endpoint of [depth - railHalf, depth + railHalf]) {
                kit.rod(surfacePoint(angle, endpoint, .045), surfacePoint(angle, endpoint, .16), .033, palette.gold);
                kit.box(surfacePoint(angle, endpoint, .052), [.14, .07, .13], palette.silver, [0, 0, angle - Math.PI / 2], false);
            }
        }
    }
    // Service routes clear the flat MMOD facets; tapered shells have no plates.
    function servicePoint(angle, depth, lift) {
        if (options.profile) return surfacePoint(angle, depth, lift);
        const normal = Math.round(angle / (Math.PI / 4)) * Math.PI / 4;
        const skin = quilted ? radius + skinLift : (radius + .0575) / Math.cos(angle - normal);
        return [Math.cos(angle) * (skin + lift), Math.sin(angle) * (skin + lift), depth];
    }
    // Parallel service conduits and occasional covered junction boxes.
    for (const angle of [.08 * Math.PI, 1.08 * Math.PI]) {
        const depths = [-half + .24, ...profile.slice(1, -1).map(point => length * (point[0] - .5)), half - .24].sort((a, b) => a - b);
        for (const delta of [-.035, .035]) {
            for (let segment = 1; segment < depths.length; segment++) kit.rod(servicePoint(angle + delta, depths[segment - 1], .045), servicePoint(angle + delta, depths[segment], .045), .028, delta < 0 ? palette.silver : palette.rail);
        }
        for (let clamp = 1; clamp < bays; clamp++) {
            const depth = -half + clamp * length / bays;
            kit.box(servicePoint(angle, depth, .035), [.24, .085, .18], palette.hull, [0, 0, angle - Math.PI / 2], false);
        }
        if (length > 3) {
            kit.box(servicePoint(angle, half * .45, .025), [.42, .06, .52], palette.silver, [0, 0, angle - Math.PI / 2]);
            kit.box(servicePoint(angle, half * .45, .12), [.38, .20, .48], palette.white, [0, 0, angle - Math.PI / 2]);
        }
    }
}
// The generic berthing interface on a tube end (local z axis): a shallow dome, a short neck, rings, bolts and
// latches. A hollow module draws only the outward half of the dome.
const outwardDome = new THREE.SphereGeometry(1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2);
export function genericEndInterface(kit, side, endRadius, half, hollow = false) {
    if (hollow) kit.add(outwardDome, material(palette.silver), [0, 0, side * half], [endRadius * .97, endRadius * .29, endRadius * .97], [side * Math.PI / 2, 0, 0], false);
    else kit.sphere([0, 0, side * half], [endRadius * .97, endRadius * .97, endRadius * .29], palette.silver);
    kit.cylinder([0, 0, side * (half + .30)], endRadius * .57, .65, palette.white);
    ring(kit, [0, 0, side * (half + .56)], endRadius * .59, 'z', palette.silver, .065);
    ring(kit, [0, 0, side * (half + .67)], endRadius * .56, 'z', palette.dark, .08);
    kit.cylinder([0, 0, side * (half + .68)], endRadius * .42, .045, palette.silver);
    ring(kit, [0, 0, side * (half + .712)], endRadius * .40, 'z', palette.hull, .025);
    for (let bolt = 0; bolt < 12; bolt++) {
        const angle = bolt * Math.PI / 6;
        kit.add(shapes.lowCylinder, material(palette.rail), [Math.cos(angle) * endRadius * .49, Math.sin(angle) * endRadius * .49, side * (half + .74)], [.055, .065, .055], [Math.PI / 2, 0, 0], false);
    }
    for (let latch = 0; latch < 4; latch++) {
        const angle = latch * Math.PI / 2 + Math.PI / 4;
        kit.box([Math.cos(angle) * endRadius * .61, Math.sin(angle) * endRadius * .61, side * (half + .43)], [.18, .12, .27], palette.silver, [0, 0, angle - Math.PI / 2], false);
    }
}
// Build into a local frame, then merge into the kit at `position` with `rotation`.
export function placedKit(kit, position, rotation, build) {
    const local = new THREE.Group(); const innerKit = new Kit(); build(innerKit); innerKit.finish(local);
    local.rotation.set(...rotation); local.position.fromArray(position); local.updateMatrixWorld(true);
    local.traverse(child => {
        if (child.isMesh) kit.add(child.geometry.clone().applyMatrix4(child.matrixWorld), material(child.material.color.getHex(), child.material.roughness, child.material.metalness, child.material.map), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
        else if (child.isLineSegments) kit.outlines.push(child.geometry.clone().applyMatrix4(child.matrixWorld));
    });
}
export function moduleAt(kit, position, length, radius, axis = 'z', options = {}) {
    placedKit(kit, position, axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0], innerKit => tubeModule(innerKit, length, radius, options));
}
// A radial port stub on a cylindrical node whose axis runs along z through `center`: the wall rises from its
// saddle on the pressure shell to a flat port face `face` from the node axis and is closed there, so none of it
// lies inside the node. `axis` is 'x' or 'y'; `sign` picks the side.
export function radialPortStub(kit, center, hullRadius, stubRadius, face, axis, sign, color = palette.hull) {
    const steps = 64, positions = [], uv = [], indices = [];
    const point = (across, along, out) => axis === 'x'
        ? [center[0] + sign * out, center[1] + across, center[2] + along]
        : [center[0] + across, center[1] + sign * out, center[2] + along];
    for (let row = 0; row < 2; row++) for (let i = 0; i <= steps; i++) {
        const a = i / steps * Math.PI * 2, across = Math.cos(a) * stubRadius, along = Math.sin(a) * stubRadius;
        positions.push(...point(across, along, row ? face : Math.sqrt(hullRadius * hullRadius - across * across) - .01)); uv.push(i / steps, row);
    }
    for (let i = 0; i < steps; i++) { const a = i, b = i + steps + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
    // Wind the wall outward whatever the side.
    const p = i => new THREE.Vector3().fromArray(positions, i * 3);
    const normal = p(steps + 1).sub(p(0)).cross(p(1).sub(p(0))), outward = axis === 'x' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    if (normal.dot(outward) < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    const wall = new THREE.BufferGeometry(); wall.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    wall.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); wall.setIndex(indices); wall.computeVertexNormals();
    kit.add(wall, material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    const faceCenter = point(0, 0, face);
    kit.add(new THREE.CircleGeometry(stubRadius, steps), material(color), faceCenter, [1, 1, 1], axis === 'x' ? [0, sign * Math.PI / 2, 0] : [-sign * Math.PI / 2, 0, 0], false);
    ring(kit, faceCenter, stubRadius + .014, axis, palette.silver, .032);
    return { face: faceCenter, radius: stubRadius };
}
