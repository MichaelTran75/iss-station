// Nauka lower adapter & airlock.
import * as THREE from 'three';
import { Kit, material, palette } from '../core/kit.js';
import { part, ring } from '../core/station.js';

// Retain the existing selection key for saved links; the label identifies
// the reference hardware correctly. This is Nauka's lower adapter/airlock.
part('prichal', 'Nauka lower adapter & airlock', '16 / EXPERIMENT AIRLOCK', 'The lower adapter carries Nauka\'s insulated experiment airlock, with a circular end hatch, layered rings, arched handrails, service fittings and a projecting equipment frame. The airlock was transferred from Rassvet in May 2023.', [['Assembly', 'Nauka lower adapter'], ['Airlock installed', 'MAY 2023']], [0, -11.8, 29.4], (kit, group) => {
    const center = new THREE.Vector3(0, -11.70, 31);
    group.userData.assembly = 'Nauka lower adapter and experiment airlock';
    group.userData.referenceViews = 4;
    group.userData.attachment = 'Nauka lower axial collar';
    group.userData.sixPortNode = false;
    group.userData.airlockAxis = [0, 0, -1];
    group.userData.airlockFace = [0, -11.70, 27.42];
    const blanket = material(0xd7d9d3, .9, .06).clone(), seamColor = 0xb5bbb5;
    blanket.userData.poiskSkin = 'adapter';
    const airlockBlanket = blanket.clone(); airlockBlanket.userData.poiskSkin = 'airlock';
    const hatchSkin = blanket.clone(); hatchSkin.userData.poiskSkin = 'cover';
    // Slightly flattened spherical insulation, with shallow wrinkles.
    const shell = new THREE.SphereGeometry(1, 64, 40);
    const positions = shell.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        const a = Math.atan2(z, x), b = Math.acos(THREE.MathUtils.clamp(y, -1, 1));
        const wrinkle = .009 * Math.sin(a * 17 + b * 13) * Math.sin(b * 19) + .005 * Math.cos(a * 31 - b * 9);
        positions.setXYZ(i, x * (1.47 + wrinkle), y * (1.39 + wrinkle), z * (1.47 + wrinkle));
    }
    shell.computeVertexNormals(); kit.add(shell, blanket, center.toArray(), [1, 1, 1], [0, 0, 0], false);
    const onShell = (a, b, lift = .014) => [Math.sin(b) * Math.cos(a) * (1.47 + lift), center.y + Math.cos(b) * (1.39 + lift), 31 + Math.sin(b) * Math.sin(a) * (1.47 + lift)];
    for (let gore = 0; gore < 12; gore++) {
        const a = gore * Math.PI / 6, points = [];
        for (let i = 0; i <= 28; i++)points.push(onShell(a, .26 + i * (Math.PI - .52) / 28));
        for (let i = 1; i < points.length; i++)kit.rod(points[i - 1], points[i], .009, seamColor);
    }
    for (const b of [.72, 1.58, 2.37]) {
        const points = []; for (let i = 0; i <= 64; i++)points.push(onShell(i * Math.PI / 32, b));
        for (let i = 1; i < points.length; i++)kit.rod(points[i - 1], points[i], .012, seamColor);
    }
    // Short neck meets the existing lower collar of the main laboratory.
    kit.cylinder([0, -10.43, 31], .87, .42, palette.white, [0, 0, 0]);
    for (const y of [-10.28, -10.44]) ring(kit, [0, y, 31], .89, 'y', palette.silver, .035);
    // A closed lower connection ring, as visible under the reference body.
    kit.cylinder([0, -13.015, 31], .91, .17, palette.dark, [0, 0, 0]);
    kit.cylinder([0, -13.115, 31], .88, .08, palette.silver, [0, 0, 0]);
    ring(kit, [0, -13.14, 31], .87, 'y', palette.hull, .038);
    // A low opposite-side circular closure does not mimic another long airlock.
    kit.cylinder([0, -11.7, 32.37], .68, .18, palette.silver);
    kit.cylinder([0, -11.7, 32.48], .59, .055, palette.dark);
    ring(kit, [0, -11.7, 32.51], .61, 'z', palette.rail, .038);
    // Raised handholds seat on the sphere away from the airlock opening.
    for (const a of [.2, 1.0, 2.0, 2.75]) {
        const points = [onShell(a, .72, 0), onShell(a, .77, .09), onShell(a, 1.05, .09), onShell(a, 1.10, 0)];
        for (let i = 1; i < points.length; i++)kit.rod(points[i - 1], points[i], .026, palette.gold);
    }
    // Airlock is modelled in local +Z, then faces station-forward (-Z).
    const airlock = new THREE.Group(), lockKit = new Kit();
    airlock.name = 'Nauka experiment airlock / reference reconstruction';
    airlock.position.copy(center); airlock.rotation.y = Math.PI;
    const profile = [[1.04, .78], [1.26, .92], [1.40, 1.10], [1.60, 1.10], [1.71, .98], [2.94, .98], [3.08, 1.055], [3.32, 1.075], [3.51, 1.03]];
    const body = new THREE.LatheGeometry(profile.map(([z, r]) => new THREE.Vector2(r, z)), 64).rotateX(Math.PI / 2);
    lockKit.add(body, airlockBlanket, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    // Recessed black gasket, stacked flange bands and captive latches.
    for (const [z, r, w, color] of [[1.31, 1.00, .14, palette.dark], [1.43, 1.13, .085, palette.silver], [1.58, 1.125, .05, palette.white], [1.76, 1.00, .045, seamColor], [2.87, .999, .028, seamColor], [3.08, 1.075, .06, palette.silver], [3.27, 1.097, .055, palette.white], [3.47, 1.05, .04, palette.silver]]) {
        lockKit.cylinder([0, 0, z], r, w, color);
    }
    for (let latch = 0; latch < 8; latch++) {
        const a = latch * Math.PI / 4;
        lockKit.box([Math.cos(a) * 1.135, Math.sin(a) * 1.135, 1.46], [.18, .18, .23], palette.hull, [0, 0, a], false);
        lockKit.cylinder([Math.cos(a) * 1.155, Math.sin(a) * 1.155, 1.585], .035, .025, palette.rail);
    }
    // Shallow wrap folds follow the cylindrical barrel instead of a rigid grid.
    for (let fold = 0; fold < 24; fold++) {
        const a = fold * Math.PI / 12, points = [];
        for (let i = 0; i <= 14; i++) {
            const z = 1.79 + i * .073, angle = a + .012 * Math.sin(i * .63 + fold);
            const r = .988 + .005 * Math.sin(i * .91 + fold * 1.3);
            points.push([Math.cos(angle) * r, Math.sin(angle) * r, z]);
        }
        for (let i = 1; i < points.length; i++)lockKit.rod(points[i - 1], points[i], .0055, 0xc1c6bf);
    }
    // Broad closed end hatch, with an offset dark hemispherical viewport.
    const hatch = new THREE.Shape(); hatch.absarc(0, 0, 1.025, 0, Math.PI * 2, false);
    const windowHole = new THREE.Path(); windowHole.absarc(-.32, -.39, .275, 0, Math.PI * 2, true); hatch.holes.push(windowHole);
    lockKit.add(new THREE.ExtrudeGeometry(hatch, { depth: .055, bevelEnabled: true, bevelSize: .014, bevelThickness: .012, bevelSegments: 2, steps: 1, curveSegments: 48 }), hatchSkin, [0, 0, 3.51], [1, 1, 1], [0, 0, 0], false);
    lockKit.cylinder([-.32, -.39, 3.53], .277, .065, palette.dark);
    lockKit.sphere([-.32, -.39, 3.574], [.245, .245, .055], 0x19303c);
    ring(lockKit, [-.32, -.39, 3.573], .273, 'z', palette.silver, .015);
    // Two arched longitudinal handrails; all feet touch the barrel.
    for (const angle of [Math.PI * .22, Math.PI * .78, Math.PI * 1.30]) {
        const radial = r => [Math.cos(angle) * r, Math.sin(angle) * r];
        const path = [[...radial(.97), 1.80], [...radial(1.17), 1.97], [...radial(1.20), 2.61], [...radial(1.04), 2.85]];
        lockKit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(...p))), 32, .026, 8, false), material(palette.rail), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
        for (const z of [1.80, 2.85]) lockKit.box([...radial(.994), z], [.13, .13, .13], palette.silver, [0, 0, angle], false);
    }
    // Side access covers and a capped connector match the asymmetric fittings.
    for (const side of [-1, 1]) {
        lockKit.cylinder([side * .972, .26, 2.19], .215, .13, palette.hull, [0, 0, Math.PI / 2]);
        lockKit.cylinder([side * 1.048, .26, 2.19], .235, .035, palette.silver, [0, 0, Math.PI / 2]);
        lockKit.cylinder([side * 1.01, -.25, 2.57], .14, .20, palette.dark, [0, 0, Math.PI / 2]);
        lockKit.cylinder([side * 1.10, -.25, 2.57], .11, .035, palette.rail, [0, 0, Math.PI / 2]);
    }
    // Thin triangular feet support the two end bands, without blocking the hatch.
    for (const z of [1.55, 3.23]) for (const side of [-1, 1]) {
        const shape = new THREE.Shape(); shape.moveTo(side * .44, -.87); shape.lineTo(side * .81, -.83); shape.lineTo(side * .68, -1.42); shape.lineTo(side * .50, -1.33); shape.closePath();
        lockKit.add(new THREE.ExtrudeGeometry(shape, { depth: .085, bevelEnabled: false }), material(palette.hull), [0, 0, z - .0425], [1, 1, 1], [0, 0, 0], false);
    }
    // Copper-coloured open equipment frame, visible beside the front cover.
    const copper = 0x875333;
    for (const v of [-.45, -.25, -.05, .15]) lockKit.rod([-.89, v, 3.34], [-.89, v, 5.11], .025, copper);
    for (const z of [3.34, 3.52, 5.11]) {
        lockKit.rod([-.89, -.48, z], [-.89, .18, z], .033, copper);
        lockKit.box([-.89, -.15, z], [.105, .72, .06], copper, [0, 0, 0], false);
    }
    for (const v of [-.45, .15]) {
        lockKit.rod([-1.02, v, 3.34], [-1.02, v, 5.11], .019, copper);
        for (const z of [3.34, 5.11]) lockKit.rod([-1.02, v, z], [-.89, v, z], .022, copper);
    }
    lockKit.box([-.93, -.15, 3.25], [.20, .60, .24], palette.silver, [0, 0, 0], false);
    // Small paired antenna/target stalks connect to brackets on the adapter.
    lockKit.rod([.98, .10, 1.04], [1.16, .12, 1.18], .048, palette.silver);
    lockKit.box([1.16, .12, 1.18], [.22, .26, .25], palette.silver);
    lockKit.rod([1.16, .12, 1.18], [1.91, .30, 1.70], .034, palette.silver);
    lockKit.cylinder([1.91, .30, 1.70], .14, .05, palette.hull);
    ring(lockKit, [1.91, .30, 1.73], .145, 'z', palette.rail, .021);
    lockKit.rod([1.91, .30, 1.73], [1.91, .30, 1.95], .032, palette.silver);
    lockKit.box([-.40, .93, 1.44], [.25, .24, .29], palette.silver);
    lockKit.finish(airlock); group.add(airlock);
    // Angled bronze service cover bridges the upper shoulder visually.
    kit.box([.98, -10.35, 30.36], [.34, .82, .16], copper, [0, .3, -.28]);
    kit.rod([.89, -10.67, 30.53], [.98, -10.35, 30.39], .046, palette.silver);
});
