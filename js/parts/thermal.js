// Thermal control radiators.
import * as THREE from 'three';
import { Kit, material, palette, shapes } from '../core/kit.js';
import { part, radiatorBankX, radiatorBankZ, radiatorTrussSurfaceZ, ring } from '../core/station.js';
import { radiatorFace } from '../core/surfaces.js';

part('thermal', 'Thermal control radiators', '04 / HEAT REJECTION', 'Two external ammonia loops reject heat through six articulated radiator wings. Each wing has eight white-coated 3.4 × 2.7 m panels, with parallel flow channels, edge manifolds, articulated hinges and flexible connections. The channel detail and shallow folded pose follow the supplied visual reference.', [['Radiator wings / panels', '6 / 48'], ['Panel dimensions', '3.4 × 2.7 m']], [radiatorBankX, 8.3, radiatorBankZ + 12.9], (kit, group) => {
    group.userData.radiators = [];
    group.userData.radiatorBanks = [];
    // NASA ATCS overview, pp. 14–19: three eight-panel ORUs share one
    // radiator beam and TRRJ per loop. This is a vertical illustrative pose.
    // https://www.nasa.gov/wp-content/uploads/2021/02/473486main_iss_atcs_overview.pdf
    for (const side of [-1, 1]) {
        const bank = new THREE.Group(), beamKit = new Kit();
        bank.name = (side < 0 ? 'Port' : 'Starboard') + ' common radiator beam';
        bank.position.set(side * radiatorBankX, 6.8, radiatorBankZ);
        bank.userData.panelCount = 24;
        bank.userData.rootBackshield = 'Three separate trays, folded side channels and paired tapered root webs';
        bank.userData.rootReference = {file: 'ISS_stationary.glb', nodes: [53, 68], sourceWidth: 4.17826, sourceTrayWidth: 2.73082};
        // Reconstruct node 53/68 profiles with the existing scene materials.
        // GLB root: three closed trays, two folded side channels, six webs
        // and a transverse saddle. The central tray has no circular cutout.
        // Adapt only root depth/span to the unchanged first-panel seats.
        const leafPitch = 3.72, rootYScale = .962, rootZScale = .77;
        const rootY = y => (y - .00947) * rootYScale;
        const rootZ = z => -.70 - z * rootZScale;
        bank.userData.stripGap = +(leafPitch - 3.455).toFixed(3);
        bank.userData.rootAdaptation = {spanScale: rootYScale, depthScale: rootZScale, rearSeatZ: -.70};
        // Extrude a measured X/Z section along Y. All profiles remain
        // editable code; no source textures or station mesh are embedded.
        const rootSection = (profile, y0, y1, color) => {
            const shape = new THREE.Shape();
            profile.forEach(([x, z], index) => index ? shape.lineTo(x, rootZ(z)) : shape.moveTo(x, rootZ(z)));
            shape.closePath();
            const geometry = new THREE.ExtrudeGeometry(shape, {depth: rootY(y1) - rootY(y0), bevelEnabled: false});
            geometry.rotateX(Math.PI / 2); geometry.translate(0, rootY(y1), 0);
            beamKit.add(geometry, material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
        };
        const rootTrays = [
            {y0: -5.6525, y1: -1.9479, z0: -.46792, z1: -.53254},
            {y0: -1.8572, y1: 1.8453, z0: -.52580, z1: -.52706},
            {y0: 1.9710, y1: 5.6755, z0: -.53254, z1: -.46792}
        ];
        for (const tray of rootTrays) {
            const y0 = rootY(tray.y0), y1 = rootY(tray.y1);
            const z0 = rootZ(tray.z0), z1 = rootZ(tray.z1);
            const tilt = Math.atan2(z1 - z0, y1 - y0), center = [0, (y0 + y1) / 2, (z0 + z1) / 2];
            const height = Math.hypot(y1 - y0, z1 - z0), depth = .1576 * rootZScale;
            beamKit.box(center, [2.73082, height, depth], palette.hull, [tilt, 0, 0], false);
            const onTray = (x, y, z) => [x, center[1] + y * Math.cos(tilt) - z * Math.sin(tilt), center[2] + y * Math.sin(tilt) + z * Math.cos(tilt)];
            // Fine ribs, centre tape and two shallow retaining clips follow
            // the GLB facing detail, redrawn in this scene's pale finish.
            for (const face of [-1, 1]) {
                for (let rib = 0; rib < 24; rib++) {
                    beamKit.box(onTray(0, -height / 2 + .09 + rib * (height - .18) / 23, face * (depth / 2 + .002)), [2.68, .013, .006], 0xb6beb9, [tilt, 0, 0], false);
                }
                beamKit.box(onTray(0, 0, face * (depth / 2 + .004)), [.12, height - .04, .009], 0xc2c9c4, [tilt, 0, 0], false);
                for (const y of [-.95, .95]) beamKit.box(onTray(0, y, face * (depth / 2 + .016)), [.22, .105, .034], palette.silver, [tilt, 0, 0], false);
            }
            for (const y of [-height / 2, height / 2]) beamKit.box(onTray(0, y, 0), [2.77, .044, depth + .025], palette.silver, [tilt, 0, 0], false);
            // Narrow seat strips close the source's small web/tray gap after
            // adapting the root to the existing panel seats.
            for (const edge of [-1, 1]) beamKit.box(onTray(edge * .377, 0, depth / 2 + .018), [.105, height - .18, .070], palette.silver, [tilt, 0, 0], false);
        }
        // GLB rail section: broad outer lip, two inclined webs and a
        // narrow bottom. Its folded depth replaces the old flat strips.
        const channel = [[1.36538, -.45369], [1.92511, -.45369], [1.92511, -.51510], [1.68884, -.77633], [1.59160, -.77633], [1.36538, -.53489]];
        for (const edge of [-1, 1]) {
            rootSection(channel.map(([x, z]) => [edge * x, z]), -5.40619, 5.40945, palette.silver);
            // Rectangular channel bays correspond to the repeated recesses
            // visible on the source rails; the rims remain light aluminium.
            for (let bay = 0; bay < 18; bay++) {
                const y = rootY(-5.40619 + (bay + .5) * 10.81564 / 18);
                beamKit.box([edge * 1.65, y, rootZ(-.45369) - .004], [.25, .445, .008], 0x8f9993, [0, 0, 0], false);
                beamKit.box([edge * 1.65, y, rootZ(-.77633) + .005], [.088, .445, .010], palette.rail, [0, 0, 0], false);
            }
        }
        // The supplied mesh uses a broad shallow saddle, not the former
        // oversized round barrel. Its rear face seats on the four legs.
        rootSection([[-2.08916, -.35035], [2.08910, -.35035], [2.08910, -.15120], [.42015, 0], [-.42021, 0], [-2.08916, -.15120]], -.420127, .420127, palette.silver);
        // Two bearing pads join the saddle to the folded rails across the
        // reference mesh's nominal gap; no floating cross-member remains.
        for (const edge of [-1, 1]) beamKit.box([edge * 1.65, rootY(0), -.39], [.30, .70, .11], palette.silver, [0, 0, 0], false);
        for (const upper of [false, true]) for (const dx of [-.49, .49]) {
            const x = side * radiatorBankX + dx, y = upper ? 8.4 : 5.3;
            kit.box([x, y, radiatorTrussSurfaceZ + .065], [.26, .24, .13], palette.silver);
            kit.rod([x, y, radiatorTrussSurfaceZ + .14], [x, 6.8 + (upper ? .34 : -.34), radiatorBankZ - .67], .075, palette.silver);
        }
        // Small source-side fitting at X=1.99, Y=-1.91. This belongs to
        // the common beam; it does not require six oversized valve boxes.
        beamKit.box([1.95, rootY(-1.9086), -.305], [.26, .20, .10], palette.silver, [0, 0, 0], false);
        beamKit.box([2.015, rootY(-1.9086), rootZ(-.6764)], [.11, .5476 * rootYScale, .4241 * rootZScale], palette.silver, [0, 0, 0], false);
        beamKit.box([1.9861, rootY(-1.9086), rootZ(-.9105)], [.5865, .5948 * rootYScale, .1124 * rootZScale], palette.hull, [0, 0, 0], false);
        const wheelCenter = [2.0035, rootY(-1.9086), rootZ(-1.04)];
        beamKit.cylinder([2.0035, wheelCenter[1], rootZ(-1.00)], .031, .195, palette.silver);
        ring(beamKit, wheelCenter, .18, 'z', palette.foil, .020);
        for (let spoke = 0; spoke < 3; spoke++) {
            const angle = spoke * Math.PI * 2 / 3;
            beamKit.rod(wheelCenter, [wheelCenter[0] + .17 * Math.cos(angle), wheelCenter[1] + .17 * Math.sin(angle), wheelCenter[2]], .017, palette.silver);
        }
        // Each web is a thin sloping plate with a relieved forward lip.
        // Outline coordinates come from the GLB; the paired plates converge
        // toward the first radiator panel instead of filling that space.
        const rootWebs = [
            [[-5.6063,-.59561],[-2.0489,-.65770],[-2.0681,-1.75986],[-2.2585,-1.75654],[-2.2562,-1.62840],[-5.4329,-1.57292],[-5.4352,-1.70112],[-5.6255,-1.69780]],
            [[-1.7598,-.65272],[1.7982,-.65394],[1.7978,-1.75624],[1.6074,-1.75618],[1.6075,-1.62804],[-1.5698,-1.62695],[-1.5698,-1.75509],[-1.7602,-1.75503]],
            [[2.0719,-.65770],[5.6293,-.59561],[5.6486,-1.69780],[5.4582,-1.70112],[5.4559,-1.57292],[2.2793,-1.62840],[2.2816,-1.75654],[2.0912,-1.75986]]
        ];
        rootWebs.forEach(profile => {
            const shape = new THREE.Shape();
            profile.forEach(([y, z], index) => index ? shape.lineTo(y, z) : shape.moveTo(y, z)); shape.closePath();
            const geometry = new THREE.ExtrudeGeometry(shape, {depth: .0745, bevelEnabled: false});
            const positions = geometry.attributes.position;
            const slope = (profile[1][1] - profile[0][1]) / (profile[1][0] - profile[0][0]);
            for (let i = 0; i < positions.count; i++) {
                const y = positions.getX(i), z = positions.getY(i), inset = positions.getZ(i);
                const baseZ = profile[0][1] + (y - profile[0][0]) * slope;
                const x = .404825 + (z - baseZ) * (.24438 / 1.10352) - inset;
                positions.setXYZ(i, x, rootY(y), rootZ(z));
            }
            geometry.computeVertexNormals();
            for (const edge of [-1, 1]) {
                const web = geometry.clone();
                if (edge < 0) {
                    web.scale(-1, 1, 1);
                    const indices = []; for (let i = 0; i < positions.count; i += 3) indices.push(i, i + 2, i + 1);
                    web.setIndex(indices); web.computeVertexNormals();
                }
                beamKit.add(web, material(palette.white), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
            }
        });
        for (let leaf = 0; leaf < 3; leaf++) {
            const offset = (leaf - 1) * leafPitch;
            const radiator = new THREE.Group(), radiatorKit = new Kit();
            radiator.name = (side < 0 ? 'Port' : 'Starboard') + ' HRS radiator ' + (leaf + 1);
            radiator.position.set(0, offset, 0);
            radiator.userData.panelCount = 8;
            radiator.userData.surface = 'White thermal coating';
            radiator.userData.flowChannelsPerPanel = 9;
            radiator.userData.hingeSeams = 7;
            const coating = material(0xffffff, .88, .04, radiatorFace);
            const panelCore = material(0xf3f5f1, .86, .05);
            for (let section = 0; section < 8; section++) {
                const depth = 2.0 + section * 2.82;
                const tilt = (section % 2 ? -1 : 1) * .045;
                const c = Math.cos(tilt), sn = Math.sin(tilt);
                const at = (x, y, z) => [x * c + z * sn, y, depth - x * sn + z * c];
                // A shallow alternating fold makes all eight rigid panels legible.
                radiatorKit.add(shapes.box, panelCore, [0, 0, depth], [.09, 3.4, 2.7], [0, tilt, 0], false);
                for (const face of [-1, 1]) {
                    radiatorKit.add(new THREE.PlaneGeometry(2.62, 3.32), coating, at(face * .047, 0, 0), [1, 1, 1], [0, tilt + face * Math.PI / 2, 0], false);
                    // Low-profile flow channels are bonded to each radiating skin.
                    for (let channel = 0; channel < 9; channel++) {
                        const y = -1.44 + channel * .36;
                        radiatorKit.rod(at(face * .057, y, -1.19), at(face * .057, y, 1.19), .015, 0xdce3df);
                    }
                    for (const end of [-1, 1]) {
                        radiatorKit.rod(at(face * .074, -1.51, end * 1.19), at(face * .074, 1.51, end * 1.19), .028, 0xe4e9e5);
                    }
                }
                // Pale aluminum perimeter channels and rear stiffening stringers.
                for (const height of [-1.7, 1.7]) radiatorKit.box(at(0, height, 0), [.15, .055, 2.72], 0xd6ded9, [0, tilt, 0], false);
                for (const end of [-1, 1]) radiatorKit.box(at(0, 0, end * 1.35), [.15, 3.4, .055], 0xd6ded9, [0, tilt, 0], false);
                for (const y of [-.91, .91]) radiatorKit.box(at(-.089, y, 0), [.075, .052, 2.60], 0xe5eae6, [0, tilt, 0], false);
                for (const y of [-1.61, 1.61]) for (const end of [-1, 1]) {
                    radiatorKit.add(shapes.lowCylinder, material(0x9baaa3), at(.083, y, end * 1.28), [.024, .025, .024], [0, tilt, Math.PI / 2], false);
                }
                if (section < 7) {
                    const jointX = sn * 1.35, jointZ = depth + 1.41;
                    // Three clevises share the hinge axis across each panel seam.
                    for (const y of [-1.38, 0, 1.38]) {
                        radiatorKit.cylinder([jointX, y, jointZ], .068, .25, 0xdbe2de, [0, 0, 0]);
                        radiatorKit.cylinder([jointX, y, jointZ], .032, .31, 0x899891, [0, 0, 0]);
                        for (const end of [-1, 1]) radiatorKit.box([jointX, y, jointZ + end * .09], [.075, .17, .16], 0xe5eae6, [0, 0, 0], false);
                    }
                    // Short insulated hose loops bridge the articulated panel gaps.
                    for (const y of [-1.51, 1.51]) {
                        const path = new THREE.CatmullRomCurve3([
                            new THREE.Vector3(...at(.075, y, 1.19)),
                            new THREE.Vector3(jointX + .16, y, jointZ - .11),
                            new THREE.Vector3(jointX + .16, y, jointZ + .11),
                            new THREE.Vector3(.075 * c + 1.19 * sn, y, depth + 2.82 + .075 * sn - 1.19 * c)
                        ]);
                        radiatorKit.add(new THREE.TubeGeometry(path, 10, .022, 6, false), material(0xc6d1cb), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                    }
                }
            }
            // Small hinge pins seat the tapered root cheeks on the unchanged
            // first-panel edge. Leave the eight-panel generation above intact.
            for (const y of [-1.60, 1.60]) {
                radiatorKit.cylinder([0, y, .645], .041, .34, palette.silver, [0, 0, Math.PI / 2]);
            }
            radiatorKit.finish(radiator); bank.add(radiator); group.userData.radiators.push(radiator);
        }
        beamKit.finish(bank); group.add(bank); group.userData.radiatorBanks.push(bank);
    }
});
