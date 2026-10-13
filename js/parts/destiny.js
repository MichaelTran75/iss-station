// Destiny laboratory.
import * as THREE from 'three';
import { Kit, material, palette, shapes } from '../core/kit.js';
import { destinyShutter, part, ring, trussDrop } from '../core/station.js';
import { cbmDestinyFront, cbmDestinyRear, cbmHarmonyScale, cbmReferenceRadial, cbmUnityScale, referenceActiveCBM,
    referenceCbmCone } from '../core/cbm.js';
import { hullBadge } from '../core/surfaces.js';
import { moduleAt } from '../core/hull.js';

part('destiny', 'Destiny laboratory', '05 / US LABORATORY', 'Destiny supports US research and Earth observation. Four permanent S0 strut groups connect above its hull; an observation window and protective shutter face Earth below. Mount fittings and the open shutter pose are illustrative.', [['Support groups', '2 bipods + 2 tripods'], ['Strut legs', '10']], [0, 2.2, 4], (kit, group) => {
    moduleAt(kit, [0, 0, 4], 8.5, 2.15, 'z', { handholdHalfLength: .24, skin: 'quilted', endInterfaceSides: [] }); hullBadge(kit, 'DESTINY', [0, 0, 3.9], 2.225, [3.1, .42]);
    // Replace intersecting generic domes with source-shaped conical CBM interfaces.
    referenceCbmCone(kit, -.25, cbmDestinyFront, 2.15, 1.28884 * cbmReferenceRadial);
    referenceCbmCone(kit, 8.25, cbmDestinyRear, 2.15, 1.28884 * cbmReferenceRadial);
    group.userData.cbm = {
        harmony: referenceActiveCBM(kit, cbmDestinyFront, a => -a * cbmHarmonyScale, cbmReferenceRadial),
        unity: referenceActiveCBM(kit, cbmDestinyRear, a => a * cbmUnityScale, cbmReferenceRadial)
    };
    for (const depth of [1, 6.5]) kit.box([0, 2.4, depth], [1.2, .4, .8], palette.white);
    // Four permanent S0 groups: two forward bipods and two aft tripods.
    // Group count follows JAXA / STS-110; local fittings and pose are schematic.
    for (const side of [-1, 1]) {
        const n = [side * Math.SQRT1_2, Math.SQRT1_2];
        const tangent = [Math.SQRT1_2, -side * Math.SQRT1_2];
        const face = [0, 0, -side * Math.PI / 4];
        // The aft third leg lands on a cross-member tied to both lower rails.
        kit.rod([side * 4.25, 5.3 - trussDrop, 2.3], [side * 4.25, 5.3 - trussDrop, 4.0], .11, palette.silver);
        kit.rod([side * 4.25, 5.3 - trussDrop, 4.0], [side * 4.25, 5.95 - trussDrop, 5.7], .11, palette.silver);
        for (const depth of [1.4, 6.55]) {
            const aft = depth > 4;
            const at = (radial, offset = 0, dz = 0) => [n[0] * radial + tangent[0] * offset, n[1] * radial + tangent[1] * offset, depth + dz];
            // Each shoe sits into a shield facet, clear of the adjacent EVA handles.
            kit.box(at(2.245), [.76, .16, .86], palette.silver, face);
            kit.box(at(2.337), [.61, .035, .70], palette.white, face);
            for (const offset of [-.28, .28]) for (const dz of (aft ? [-.30, 0, .30] : [-.30, .30])) {
                kit.add(shapes.lowCylinder, material(palette.rail), at(2.367, offset, dz), [.047, .065, .047], face, false);
            }
            const lower = at(2.43);
            for (const dz of [-.20, .20]) kit.box(at(2.43, 0, dz), [.34, .34, .10], palette.silver, face);
            kit.cylinder(lower, .115, .56, palette.dark);
            for (const dz of [-.30, .30]) kit.cylinder(at(2.43, 0, dz), .14, .055, palette.silver);
            kit.sphere(lower, [.155, .155, .155], palette.silver);
            const uppers = aft
                ? [[side * 2.55, 5.95 - trussDrop, 5.7], [side * 4.25, 5.95 - trussDrop, 5.7], [side * 4.25, 5.3 - trussDrop, 4.0]]
                : [[side * 2.55, 5.3 - trussDrop, 2.3], [side * 4.25, 5.3 - trussDrop, 2.3]];
            for (const upper of uppers) {
                const a = new THREE.Vector3(...lower), b = new THREE.Vector3(...upper);
                const lerp = t => a.clone().lerp(b, t).toArray();
                // Nested tubes and two restrained clamshell collars describe each strut.
                kit.rod(lower, upper, .105, palette.silver);
                kit.rod(lerp(.16), lerp(.79), .126, palette.hull);
                for (const t of [.18, .78]) kit.rod(lerp(t - .025), lerp(t + .025), .153, palette.white);
                kit.box([upper[0], upper[1] - .01, upper[2]], [.46, .28, .46], palette.white);
                kit.sphere(upper, [.15, .15, .15], palette.silver);
                kit.cylinder(upper, .13, .54, palette.silver);
            }
            if (aft) {
                // A seated hull terminal feeds a harness clipped to the outer aft leg.
                kit.box(at(2.245, side * .40, .20), [.29, .12, .29], palette.silver, face);
                const terminal = at(2.355, side * .40, .20);
                kit.box(terminal, [.25, .20, .25], palette.silver, face);
                const start = at(2.46, side * .40, .20);
                const a = new THREE.Vector3(...lower), b = new THREE.Vector3(...uppers[1]);
                const direction = b.clone().sub(a).normalize();
                const offset = new THREE.Vector3(side, 0, 0);
                offset.addScaledVector(direction, -offset.dot(direction)).normalize().multiplyScalar(.172);
                const cableAt = t => a.clone().lerp(b, t).add(offset).toArray();
                const end = [side * 4.43, 5.83 - trussDrop, 5.7];
                kit.box(end, [.22, .20, .26], palette.silver);
                const cable = [start, cableAt(.12), cableAt(.96), end];
                for (let segment = 1; segment < cable.length; segment++) kit.rod(cable[segment - 1], cable[segment], .028, palette.foil);
                for (const t of [.24, .50, .76, .93]) {
                    const point = a.clone().lerp(b, t);
                    kit.rod(point.clone().addScaledVector(direction, -.035).toArray(), point.clone().addScaledVector(direction, .035).toArray(), .145, palette.silver);
                    kit.rod(point.toArray(), cableAt(t), .035, palette.silver);
                }
            }
        }
    }
    // NASA: 0.508 m nadir aperture, four panes, protective shutter + gearbox.
    // Cover outline, hinge axis and cycle timing are an illustrative mechanism study.
    const windowZ = 4.85, windowKit = new Kit(), windowAssembly = new THREE.Group();
    windowAssembly.name = 'Destiny observation window and shutter';
    windowKit.box([0, -2.235, windowZ], [.92, .09, 1.00], palette.white);
    windowKit.cylinder([0, -2.31, windowZ], .40, .12, palette.silver, [0, 0, 0]);
    windowKit.cylinder([0, -2.38, windowZ], .254, .026, palette.glass, [0, 0, 0]);
    ring(windowKit, [0, -2.397, windowZ], .278, 'y', palette.dark, .024);
    ring(windowKit, [0, -2.405, windowZ], .39, 'y', palette.white, .035);
    ring(windowKit, [0, -2.414, windowZ], .328, 'y', palette.silver, .018);
    for (let bolt = 0; bolt < 8; bolt++) {
        const a = bolt * Math.PI / 4, x = Math.sin(a) * .365, z = windowZ + Math.cos(a) * .365;
        windowKit.add(shapes.lowCylinder, material(palette.rail), [x, -2.44, z], [.023, .035, .023], [0, 0, 0], false);
        windowKit.box([x, -2.459, z], [.023, .002, .005], palette.dark, [0, a, 0], false);
    }
    for (const dz of [-.27, .27]) {
        windowKit.box([.47, -2.355, windowZ + dz], [.18, .27, .12], palette.silver);
        windowKit.cylinder([.47, -2.48, windowZ + dz], .068, .18, palette.dark);
        for (const offset of [-.1, .1]) windowKit.cylinder([.47, -2.48, windowZ + dz + offset], .074, .025, palette.silver);
    }
    windowKit.rod([.47, -2.48, windowZ - .38], [.47, -2.48, windowZ + .48], .037, palette.silver);
    windowKit.box([.51, -2.37, windowZ + .49], [.25, .27, .22], palette.white);
    windowKit.cylinder([.51, -2.52, windowZ + .49], .068, .065, palette.silver, [0, 0, 0]);
    windowKit.box([-.44, -2.32, windowZ], [.16, .15, .15], palette.silver);
    windowKit.box([-.44, -2.42, windowZ], [.10, .08, .08], palette.dark);
    windowKit.finish(windowAssembly); group.add(windowAssembly);
    const pivot = new THREE.Group(), coverKit = new Kit();
    pivot.name = 'Hinged protective window shutter'; pivot.position.set(.47, -2.48, windowZ);
    coverKit.cylinder([-.47, -.03, 0], .42, .07, palette.white, [0, 0, 0]);
    coverKit.cylinder([-.47, -.070, 0], .36, .012, palette.hull, [0, 0, 0]);
    ring(coverKit, [-.47, .016, 0], .375, 'y', palette.dark, .020);
    // Shallow stiffeners, captive fasteners and hinge leaves move as one rigid cover.
    for (const z of [-.17, .17]) coverKit.box([-.47, -.086, z], [.63, .025, .035], palette.silver);
    for (const z of [-.27, .27]) {
        coverKit.box([-.12, -.025, z], [.24, .06, .09], palette.silver);
        coverKit.cylinder([0, 0, z], .060, .10, palette.silver);
    }
    for (let bolt = 0; bolt < 8; bolt++) {
        const a = bolt * Math.PI / 4;
        coverKit.add(shapes.lowCylinder, material(palette.rail), [-.47 + Math.sin(a) * .38, -.077, Math.cos(a) * .38], [.016, .026, .016], [0, 0, 0], false);
    }
    coverKit.box([-.86, -.01, 0], [.10, .08, .09], palette.silver);
    coverKit.finish(pivot); windowAssembly.add(pivot);
    pivot.rotation.z = destinyShutter.angle; destinyShutter.pivot = pivot;
    group.userData.windowAssembly = windowAssembly;
    group.userData.windowDiameter = .508; group.userData.s0Legs = 10;
});
