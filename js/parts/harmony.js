// Harmony / Node 2.
import * as THREE from 'three';
import { Kit, material, palette } from '../core/kit.js';
import { part, pma2BaseZ, pmaReferenceLength, pmaReferenceOffset, ring } from '../core/station.js';
import { cbmHarmonyRear, cbmHarmonyScale, cbmPassiveRadius, cbmReferenceRadial, referenceActiveCBM, referenceFreeCbm,
    referencePassiveCBM } from '../core/cbm.js';
import { hullBadge, labelTexture, quiltPanel, quiltPanels, quiltSeam } from '../core/surfaces.js';
import { referencePma } from '../core/pma.js';

part('harmony', 'Harmony / Node 2', '07 / RESEARCH JUNCTION', 'Harmony connects Destiny with the European Columbus and Japanese Kibo laboratories. The forward adapter receives commercial crew vehicles. Compact stepped CBM joints seat both laboratories against the radial ports; inclined collar brackets reinforce the axial connections.', [['Joined station', '2007'], ['Length', '7.2 m']], [0, 2.2, -4.65], (kit, group) => {
    // Node 2 after reference imagery: a 4.3 m cylinder closed by shallow conical end bulkheads rather than the
    // generic domed ends, each with twelve sector seams, rim handrails and a raised berthing collar. The
    // four radial collars follow the reference node and meet the laboratory interfaces.
    const rimZ = end => end < 0 ? -8.25 : -1.05;
    const neckR = end => end < 0 ? 1.28 : cbmPassiveRadius;
    const bulkheadRise = end => end < 0 ? .25 / .87 : (cbmHarmonyRear + 1.05) / (2.15 - cbmPassiveRadius);
    const endZ = (end, r) => rimZ(end) + end * (2.15 - r) * bulkheadRise(end);
    const onEnd = (end, angle, r, lift = 0) => {
        const slope = bulkheadRise(end), normalZ = 1 / Math.hypot(1, slope), normalR = slope * normalZ;
        return [Math.cos(angle) * (r + lift * normalR), Math.sin(angle) * (r + lift * normalR), endZ(end, r) + end * lift * normalZ];
    };
    for (const profile of [[[1.28, -8.5], [2.15, -8.25], [2.15, -5.95]], [[2.15, -3.35], [2.15, -1.05], [cbmPassiveRadius, cbmHarmonyRear]]]) kit.add(new THREE.LatheGeometry(profile.map(([r,z])=>new THREE.Vector2(r,z)),64),material(palette.hull),[0,0,0],[1,1,1],[Math.PI/2,0,0]);
    // Radial CBM belt rebuilt from the Harmony node in ISS_stationary.glb.
    // The GLB has four saddle-mounted collars and shallow inset covers. Dimensions are
    // normalized to the existing 2.15 m hull radius; occupied ports meet the current laboratories.
    const portZ = -4.7, beltR = 2.156, collarR = 1.17, boreR = 1.045, freeFace = 2.168;
    const collarSkin = material(0xc7ceca, .52, .34);
    // Four curved shell quadrants, each with a circular opening cut through the shell.
    for (let face = 0; face < 4; face++) {
        const base = face * Math.PI / 2, positions = [], normals = [], uv = [], indices = [], steps = 128, rows = 4;
        for (let row = 0; row <= rows; row++) for (let i = 0; i <= steps; i++) {
            const phi = i / steps * Math.PI * 2, cx = Math.cos(phi), sz = Math.sin(phi);
            const limit = Math.min((beltR / Math.SQRT2) / Math.max(1e-8, Math.abs(cx)), (sz > 0 ? 1.35 : 1.25) / Math.max(1e-8, Math.abs(sz)));
            const d = THREE.MathUtils.lerp(collarR, limit, row / rows), tangent = cx * d, along = sz * d;
            const angle = base + Math.asin(tangent / beltR);
            positions.push(Math.cos(angle) * beltR, Math.sin(angle) * beltR, portZ + along);
            normals.push(Math.cos(angle), Math.sin(angle), 0); uv.push(face + i / steps, row / rows);
        }
        for (let row = 0; row < rows; row++) for (let i = 0; i < steps; i++) {
            const a = row * (steps + 1) + i, b = a + steps + 1;
            indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
        // Ensure the shell winding faces outward independently of the quadrant.
        const p = i => new THREE.Vector3().fromArray(positions, i * 3);
        if (p(indices[1]).sub(p(indices[0])).cross(p(indices[2]).sub(p(indices[0]))).dot(new THREE.Vector3().fromArray(normals, indices[0] * 3)) < 0) {
            for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]; geometry.setIndex(indices);
        }
        kit.add(geometry, material(0xa3aaa8, .7, .2), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    function radialPort(axis, sign, occupied = false) {
        const local = new THREE.Group(), portKit = new Kit(); local.name = 'Harmony ' + (axis === 'x' ? (sign < 0 ? 'Kibo collar' : 'Columbus collar') : (sign > 0 ? 'zenith hatch' : 'nadir hatch'));
        const turn = axis === 'x' ? -sign * Math.PI / 2 : sign < 0 ? Math.PI : 0;
        local.rotation.z = turn; local.position.z = portZ; group.add(local);
        // The rim root follows the curved hull; its outer face is a planar berthing ring.
        const positions = [], uv = [], indices = [], steps = 96;
        for (let row = 0; row < 2; row++) for (let i = 0; i <= steps; i++) {
            const a = i / steps * Math.PI * 2, x = Math.cos(a) * collarR, z = Math.sin(a) * collarR;
            positions.push(x, row ? freeFace : Math.sqrt(beltR * beltR - x * x) - .006, z); uv.push(i / steps, row);
        }
        for (let i = 0; i < steps; i++) {const a=i,b=i+steps+1;indices.push(a,b,a+1,b,b+1,a+1);}
        const saddle = new THREE.BufferGeometry(); saddle.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); saddle.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); saddle.setIndex(indices); saddle.computeVertexNormals();
        if(occupied) portKit.add(saddle, collarSkin, [0,0,0], [1,1,1], [0,0,0], false);
        const lathe = (profile,surface) => portKit.add(new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)),96),surface,[0,0,0],[1,1,1],[0,0,0],false);
        if(occupied) {lathe([[collarR,freeFace],[1.135,freeFace+.015],[1.09,freeFace+.015],[boreR,freeFace-.035],[boreR,1.85]],collarSkin);ring(portKit,[0,freeFace+.006,0],1.137,'y',palette.silver,.015);}
        if (occupied) {
            // Reference lab cuffs interlock with the node saddle instead of a long exposed tube.
            const neck = sign < 0 ? 2.189909 : 2.186644, radialScale = .9348886982;
            const sleeve = new THREE.Group(), sleeveKit = new Kit();
            sleeve.name = sign < 0 ? 'Kibo passive CBM' : 'Columbus passive CBM';
            sleeve.rotation.x = -Math.PI / 2;
            sleeve.userData.cbm = referencePassiveCBM(sleeveKit, neck, -1, radialScale, radialScale);
            sleeveKit.finish(sleeve); local.add(sleeve);
            // The seating lip closes onto the lab's annular face; a thin gasket marks the seam.
            lathe([[1.135, freeFace + .015], [1.105, neck + .010], [1.090, neck + .010], [1.090, freeFace + .015]], collarSkin);
            ring(portKit, [0, neck - .003, 0], 1.109, 'y', 0x69736d, .008);
            local.userData.matingFace = { axis: 'x', coordinate: sign * neck, z: -4.7, radius: 1.103418 };
        } else {
            // Free port: the GLB's covered CBM, its inspection ring toward the forward end as on the source node.
            local.userData.cover = { ...referenceFreeCbm(portKit, { hullRadius: beltR }), face: freeFace, source: 'ISS_stationary.glb / 26 Harmony Node 2' };
        }
        portKit.finish(local); return local;
    }
    const harmonyPorts = {kibo:radialPort('x',-1,true),columbus:radialPort('x',1,true),zenith:radialPort('y',1),nadir:radialPort('y',-1)};
    group.userData.radialPorts = harmonyPorts;
    for (const end of [-1, 1]) {
        ring(kit, [0, 0, rimZ(end)], 2.162, 'z', palette.silver, .03);
        for (let seam = 0; seam < 12; seam++) { const a = (seam + .5) * Math.PI / 6; kit.line([onEnd(end, a, neckR(end) + .05, .008), onEnd(end, a, 2.14, .008)]); }
        // Rim handrails alternate between tangential bars and radial bars across the sector panels.
        for (let sector = 0; sector < 12; sector++) {
            const a = sector * Math.PI / 6, [p, q] = sector % 2 ? [[a, 1.55], [a, 1.97]] : [[a - .12, 1.95], [a + .12, 1.95]];
            kit.rod(onEnd(end, p[0], p[1], .09), onEnd(end, q[0], q[1], .09), .03, palette.gold);
            for (const [angle, r] of [p, q]) kit.rod(onEnd(end, angle, r), onEnd(end, angle, r, .09), .024, palette.gold);
        }
        // The rear passive collar nests into Destiny's active collar.
        // The forward active collar follows the original PMA-2 flange without moving its mesh.
        group.userData.cbm ||= {};
        if (end > 0) group.userData.cbm.destiny = referencePassiveCBM(kit, cbmHarmonyRear, 1, cbmHarmonyScale, cbmReferenceRadial);
        else {
            const seat = .17316627502441406;
            group.userData.cbm.pma2 = referenceActiveCBM(kit, -8.5, a => -(a <= seat ? a * (.22 / seat) : .22 + a - seat), 1);
        }
    }
    // Kibo-style quilted MMOD panels over dark seams: twelve columns in two rows around the forward and aft bays,
    // and only the four diagonal panels in the middle bay, leaving recesses around the radial ports.
    for (const [z0, z1] of [[-8.25, -5.95], [-3.35, -1.05]]) kit.add(new THREE.CylinderGeometry(2.166, 2.166, z1 - z0, 64, 1, true), quiltSeam, [0, 0, (z0 + z1) / 2], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    [[-8.25, -5.95], [-5.95, -3.35], [-3.35, -1.05]].forEach(([z0, z1], bay) => {
        const middle = (z0 + z1) / 2;
        [[z0 + .04, middle - .016], [middle + .016, z1 - .04]].forEach(([za, zb], row) => {
            if (bay === 1) for (let k = 0; k < 4; k++) { const c = Math.PI / 4 + k * Math.PI / 2; quiltPanel(kit, 2.172, za, zb, c - .14, c + .14, quiltPanels[(k + row) % 2]); }
            else for (let k = 0; k < 12; k++) quiltPanel(kit, 2.172, za, zb, k * Math.PI / 6 + .006, (k + 1) * Math.PI / 6 - .006, quiltPanels[(k + row + bay) % 2]);
        });
    });
    for (const z of [-5.95, -3.35]) ring(kit, [0, 0, z], 2.175, 'z', palette.silver, .02);
    // Gold handrails run along longitudinal seams, clear of the top badge, and along the diagonal panels.
    const seamRail = (a, zc, half) => {
        const at = (z, r) => [Math.cos(a) * r, Math.sin(a) * r, z];
        kit.rod(at(zc - half, 2.27), at(zc + half, 2.27), .033, palette.gold);
        for (const z of [zc - half, zc + half]) kit.rod(at(z, 2.172), at(z, 2.27), .026, palette.gold);
    };
    for (const [zc, angles] of [[-7.1, [30, 150, 210, 270, 330]], [-2.2, [30, 90, 150, 210, 270, 330]]]) for (const degrees of angles) seamRail(degrees * Math.PI / 180, zc, .45);
    for (let k = 0; k < 4; k++) seamRail(Math.PI / 4 + k * Math.PI / 2, -4.65, .4);
    // ESA and NASA stickers on the forward bulkhead's upper-starboard sectors, facing the starboard view.
    const sticker = (text, angle) => {
        const normal = new THREE.Vector3(Math.cos(angle) * .276, Math.sin(angle) * .276, -.961).normalize();
        const up = new THREE.Vector3(0, 1, 0).addScaledVector(normal, -normal.y).normalize(), right = new THREE.Vector3().crossVectors(up, normal);
        const turn = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
        const ink = material(0xffffff, .85, 0, labelTexture(text, '#1f4e96'));
        ink.alphaTest = .25; ink.polygonOffset = true; ink.polygonOffsetFactor = -1; ink.polygonOffsetUnits = -1; ink.userData.decal = true;
        kit.box(onEnd(-1, angle, 1.62, .012), [.46, .3, .016], palette.white, [turn.x, turn.y, turn.z], false);
        kit.add(new THREE.PlaneGeometry(text.length < 4 ? 1.5 : 1.25, text.length < 4 ? .375 : .31), ink, onEnd(-1, angle, 1.62, .024), [1, 1, 1], [turn.x, turn.y, turn.z], false);
    };
    sticker('esa', Math.PI / 3); sticker('NASA', 0);
    // PMA-2 uses the identical reference mesh and scale as PMA-1, facing forward.
    const pma2 = referencePma('PMA-2 / GLB reference structure', [0, 0, pma2BaseZ], [0, Math.PI, 0]);
    group.add(pma2);
    group.userData.pma2 = {
        reconstruction: 'Supplied GLB mesh, verified against USDZ; same size as PMA-1',
        flangeCenter: [0, 0, pma2BaseZ],
        dockingFace: [0, -pmaReferenceOffset, pma2BaseZ - pmaReferenceLength],
        adapter: pma2, referenceSize: pma2.userData.referenceSize
    };
    hullBadge(kit, 'HARMONY', [0, 0, -6.75], 2.225, [1.8, .38]);
});
