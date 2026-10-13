// Photovoltaic wings.
import * as THREE from 'three';
import { Kit, material, palette } from '../core/kit.js';
import { part, powerChannels, ring, solarRootX, solarStations, solarWingStagger, solarWingY, wings } from '../core/station.js';
import { panel } from '../core/surfaces.js';

part('power', 'Photovoltaic wings', '02 / ELECTRICAL POWER', 'Eight original solar-array wings unfold into sixteen dark photovoltaic blankets around deployable lattice masts. Rotary joints orient the cell faces toward sunlight. The two wings of each module sit one above the other; their mast canisters enter one beta-gimbal frame from opposite faces.', [['Original wings', '8 / 16 blankets'], ['Array span', '~73 m']], [48, 7, -17], (kit, group) => {
    group.userData.mastCanisters = 8;
    group.userData.photovoltaicModules = 4;
    group.userData.wingStagger = { axis: 'vertical', offset: solarWingStagger, upper: 'aft wing' };
    for (const across of solarStations) for (const direction of [-1, 1]) {
        const wing = new THREE.Group(), wingKit = new Kit(); wing.position.set(solarRootX(across), solarWingY(direction), 4 + direction * 2.35);
        const channel = powerChannels[across][direction < 0 ? 0 : 1];
        wing.name = (across < 0 ? 'Port' : 'Starboard') + ' photovoltaic wing / ' + channel;
        wing.userData.channel = channel;
        // Blankets drawn 5% longer than the measured 32.6 m; the mast and the tip fittings are placed from the blanket
        // end, so they ride out with it.
        const blanketStart = 1.35, blanketLength = 32.6 * 1.05, blanketEnd = blanketStart + blanketLength, blanketMiddle = blanketStart + blanketLength / 2;
        const blanketWidth = 5.8, previousGap = .92, blanketGap = previousGap * 2;
        const blanketOffset = (blanketWidth + blanketGap) / 2;
        const spreaderWidth = 2 * blanketWidth + blanketGap + .22;
        wing.userData.blanketGap = blanketGap;
        wing.userData.centralCableCount = 4;
        for (const side of [-1, 1]) {
            const blanketX = side * blanketOffset;
            panel(wingKit, [blanketX, 0, direction * blanketMiddle], blanketWidth, blanketLength);
            // Thin fold battens sit on the flexible blanket, following the
            // existing texture divisions instead of forming a rigid grid.
            for (let fold = 1; fold < 32; fold++) {
                const depth = direction * (blanketStart + blanketLength * fold / 32);
                for (const face of [-1, 1]) wingKit.box([blanketX, face * .038, depth], [5.72, .012, .029], 0x9b8768, [0, 0, 0], false);
            }
            // Reinforced edge hems remain thin and clear of the mast bay.
            for (const edge of [-1, 1]) {
                const x = blanketX + edge * 2.885;
                wingKit.box([x, .034, direction * blanketMiddle], [.035, .009, blanketLength - .08], palette.foil, [0, 0, 0], false);
            }
        }
        // Four continuous longitudinal members are the four lines in the
        // reference gap. Remove duplicate inner wires and simplify the
        // distant bracing to the four lines requested in the reference.
        // The short root cage retains the visible square-truss structure.
        // NASA: https://ntrs.nasa.gov/citations/20120008397
        const mastCorners = [[-.36, -.32], [.36, -.32], [.36, .08], [-.36, .08]];
        for (const [x, y] of mastCorners) {
            wingKit.rod([x, y, direction * .85], [x, y, direction * (blanketEnd - .01)], .018, palette.silver);
        }
        for (const side of [-1, 1]) {
            const blanketX = side * blanketOffset;
            // The blanket storage box has a shallow lid, separate end caps
            // and transverse hinge barrels, rather than a plain white block.
            wingKit.box([blanketX, -.22, direction * 1.2], [5.95, .58, .68], palette.white);
            wingKit.box([blanketX, .09, direction * 1.2], [5.66, .05, .5], palette.foil);
            for (const end of [-1, 1]) {
                wingKit.box([blanketX + end * 2.98, -.22, direction * 1.2], [.075, .59, .72], palette.silver, [0, 0, 0], false);
                wingKit.box([blanketX + end * 2.77, -.12, direction * 1.54], [.24, .27, .13], palette.white);
            }
            for (const offset of [-2.4, -1.2, 0, 1.2, 2.4]) {
                wingKit.box([blanketX + offset, -.23, direction * .84], [.12, .32, .08], palette.dark, [0, 0, 0], false);
                wingKit.cylinder([blanketX + offset, .082, direction * 1.48], .071, .29, palette.silver, [0, 0, Math.PI / 2]);
                wingKit.box([blanketX + offset, -.23, direction * 1.551], [.16, .16, .030], palette.hull, [0, 0, 0], false);
            }
            // Outer tension lines follow the widened blanket perimeter.
            const x = side * (blanketOffset + blanketWidth / 2 + .12), y = -.095;
            wingKit.rod([x, y, direction * 1.47], [x, y, direction * (blanketEnd - .15)], .011, palette.foil);
            for (const depth of [1.47, blanketEnd - .15]) {
                wingKit.box([x, -.031, direction * depth], [.12, .15, .16], palette.silver, [0, 0, 0], false);
                wingKit.cylinder([x, y, direction * (depth < 2 ? 1.66 : blanketEnd - .34)], .027, .23, palette.silver);
            }
            wingKit.rod([x, -.031, direction * (blanketEnd - .15)], [x, -.031, direction * (blanketEnd + .085)], .038, palette.silver);
        }
        // A full-width tip channel terminates in the reference's faceted
        // central housing and swept clevis cheeks, with four cable sockets.
        wingKit.box([0, 0, direction * (blanketEnd + .18)], [spreaderWidth, .27, .041], palette.silver, [0, 0, 0], false);
        for (const height of [-.14, .14]) wingKit.box([0, height, direction * (blanketEnd + .085)], [spreaderWidth, .035, .28], palette.white, [0, 0, 0], false);
        const tipShape = new THREE.Shape();
        tipShape.moveTo(-.53, -.23); tipShape.lineTo(-.35, -.43);
        tipShape.lineTo(.35, -.43); tipShape.lineTo(.53, -.23);
        tipShape.lineTo(.53, .23); tipShape.lineTo(.35, .43);
        tipShape.lineTo(-.35, .43); tipShape.lineTo(-.53, .23); tipShape.closePath();
        const tipCase = new THREE.ExtrudeGeometry(tipShape, { depth: .43, bevelEnabled: true, bevelSize: .055, bevelThickness: .055, bevelSegments: 1, steps: 1 });
        wingKit.add(tipCase, material(palette.white), [0, -.01, direction * (blanketEnd + .03)], [1, 1, 1], [0, direction < 0 ? Math.PI : 0, 0]);
        const tipFace = new THREE.ShapeGeometry(tipShape);
        wingKit.add(tipFace, material(palette.silver), [0, -.01, direction * (blanketEnd + .526)], [.83, .83, 1], [0, direction < 0 ? Math.PI : 0, 0], false);
        for (const side of [-1, 1]) {
            wingKit.box([side * spreaderWidth / 2, 0, direction * (blanketEnd + .085)], [.040, .29, .28], palette.silver, [0, 0, 0], false);
        }
        for (const [x, y] of mastCorners) {
            wingKit.box([x, y, direction * (blanketEnd - .04)], [.10, .10, .21], palette.silver);
            wingKit.cylinder([x, y, direction * (blanketEnd - .09)], .046, .30, palette.silver);
        }
        wingKit.cylinder([0, .09, direction * (blanketEnd + .105)], .084, 1.35, palette.silver, [0, 0, Math.PI / 2]);
        // One axial mast canister per wing runs from the blanket boxes into the module's beta-gimbal frame, where its
        // BGA sits near mid-depth above or below the partner canister (reference image).
        // The opposed pairs and support relationships follow NASA's
        // STS-115 description; cover seams / dimensions follow the image.
        wing.userData.mastCanister = { axis: 'z', length: 3.12, diameter: 1.18 };
        wingKit.cylinder([0, 0, direction * -.59], .59, 3.12, palette.hull);
        wingKit.cylinder([0, 0, direction * -2.075], .62, .15, palette.silver);
        wingKit.cylinder([0, 0, direction * -2.18], .405, .08, palette.silver);
        ring(wingKit, [0, 0, direction * -2.14], .57, 'z', palette.dark, .030);
        wingKit.cylinder([0, 0, direction * .96], .59, .14, palette.white);
        for (const depth of [-1.90, -.60, .70, .965]) ring(wingKit, [0, 0, direction * depth], .597, 'z', depth === .965 ? palette.dark : palette.silver, .026);
        // Subtle longitudinal seams remain on the barrel surface.
        for (const angle of [Math.PI * .22, Math.PI * .78, Math.PI * 1.22, Math.PI * 1.78]) {
            const x = Math.cos(angle) * .594, y = Math.sin(angle) * .594;
            wingKit.rod([x, y, direction * -1.89], [x, y, direction * .69], .012, palette.silver);
        }
        for (let bolt = 0; bolt < 8; bolt++) {
            const angle = bolt * Math.PI / 4;
            wingKit.cylinder([Math.cos(angle) * .51, Math.sin(angle) * .51, direction * 1.039], .024, .026, palette.rail);
        }
        for (const side of [-1, 1]) {
            wingKit.box([side * .29, 0, direction * 1.135], [.12, .56, .27], palette.white);
            wingKit.rod([side * .31, -.24, direction * 1.06], [side * .47, -.22, direction * 1.40], .06, palette.silver);
            // Swept shoulders seat the blanket storage beam on the cap.
            wingKit.rod([side * .48, -.10, direction * .94], [side * .70, -.15, direction * 1.16], .075, palette.silver);
            wingKit.rod([side * .70, -.15, direction * 1.16], [side * 1.0, -.15, direction * 1.20], .075, palette.silver);
            wingKit.box([side * .95, -.15, direction * 1.20], [.20, .30, .39], palette.white);
        }
        // Low drive/electrical enclosure stays attached to the inboard end.
        wingKit.box([.67, -.27, direction * -1.72], [.29, .41, .57], palette.white);
        wingKit.box([.827, -.27, direction * -1.72], [.026, .29, .43], palette.silver, [0, 0, 0], false);
        wingKit.rod([.53, -.21, direction * -1.71], [.68, -.21, direction * -1.71], .065, palette.silver);
        wingKit.box([0, -.025, direction * 1.2], [spreaderWidth - .08, .21, .32], palette.white);
        wingKit.finish(wing); group.add(wing); wings.push({ group: wing, direction, across, channel, base: 0 });
    }
});
