// Kibo laboratory.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { Kit, material, palette, vertical } from '../core/kit.js';
import { part, ring } from '../core/station.js';
import { curvedCbmSaddle } from '../core/cbm.js';
import { hullBadge, quiltMap } from '../core/surfaces.js';

part('kibo', 'Kibo laboratory', '08 / JAPAN - JAXA', 'Japan\'s laboratory: the pressurized module, with its logistics module on top and the Japanese flag on its forward side, leads to a 12-interface exposed facility carrying payloads on its deck and edges, including the ICS dish. The six-joint main arm has two long booms and a short wrist boom. The exposed deck, seven edge payloads and parked arm follow the supplied 3D reference; surface details are procedural.', [['Main lab length', '11.2 m'], ['External interfaces', '12']], [-8.689909, 2, -4.7], (kit, group) => {
    // Move the complete lab and its EF/arm together to the compact reference interface.
    group.position.x = 1.310091;
    group.userData.connectionTranslation = [1.310091, 0, 0];
    // Pressurized Module after reference photography: a 4.4 m barrel of quilted silver MMOD panels in sixteen columns
    // and nine bays, gold handrails along the seams, the Japanese flag on the forward side, short end cones, the
    // Harmony berthing collar and the collar that meets the exposed-facility berthing mechanism. Angles run from
    // forward (0) over the top (90 degrees).
    const pmZ = -4.7, pmR = 2.2, pmA = -3.5, pmB = -14.05, pmBays = 9, pmColumns = 16;
    const onPM = (a, r, x) => [x, Math.sin(a) * r, pmZ - Math.cos(a) * r];
    const twoSided = (color, roughness = .62, metalness = .3, map = null) => { const m = material(color, roughness, metalness, map).clone(); m.side = THREE.DoubleSide; return m; };
    function sweepX(r0, x0, r1, x1, a0, a1, surface) {
        const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 32))), positions = [], uvs = [], indices = [];
        for (let row = 0; row < 2; row++) for (let i = 0; i <= steps; i++) { positions.push(...onPM(a0 + (a1 - a0) * i / steps, row ? r1 : r0, row ? x1 : x0)); uvs.push(i / steps, row); }
        // Wind every strip outward (away from the axis, and away from the module middle on the end faces) so
        // lighting and the shadow normal bias act on the outer skin.
        const corner = k => new THREE.Vector3().fromArray(positions, k * 3), faceNormal = corner(1).sub(corner(0)).cross(corner(steps + 1).sub(corner(0)));
        const outward = faceNormal.dot(new THREE.Vector3(Math.sign((x0 + x1) / 2 - (pmA + pmB) / 2) * .5, Math.sin(a0), -Math.cos(a0))) > 0;
        for (let i = 0; i < steps; i++) { const j = i + steps + 1; indices.push(...(outward ? [i, i + 1, j, j, i + 1, j + 1] : [i, j, i + 1, j, j + 1, i + 1])); }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices); geometry.computeVertexNormals();
        kit.add(geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    const pmSeam = twoSided(0x5f6866, .8, .2), pmPanels = [twoSided(0xffffff, .5, .38, quiltMap), twoSided(0xe9ece9, .5, .38, quiltMap)];
    sweepX(pmR - .006, pmA, pmR - .006, pmB, 0, Math.PI * 2, pmSeam);
    const bayEdge = n => pmA + (pmB - pmA) * n / pmBays;
    for (let bay = 0; bay < pmBays; bay++) for (let k = 0; k < pmColumns; k++) {
        const a0 = k * Math.PI * 2 / pmColumns + .005, a1 = a0 + Math.PI * 2 / pmColumns - .01;
        sweepX(pmR + .004, bayEdge(bay) - .016, pmR + .004, bayEdge(bay + 1) + .016, a0, a1, pmPanels[(bay + k) % 2]);
    }
    // The GLB Kibo inboard bulkhead is a flat annulus, unlike Columbus's cone.
    const lerp = (u, v, t) => u + (v - u) * t, inboardBore = 1.103418;
    sweepX(pmR - .006, pmA, inboardBore, pmA, 0, Math.PI * 2, pmSeam);
    for (let k = 0; k < pmColumns; k++) {
        const a0 = k * Math.PI * 2 / pmColumns + .008, a1 = a0 + Math.PI * 2 / pmColumns - .016;
        sweepX(pmR - .018, pmA + .001, inboardBore + .01, pmA + .001, a0, a1, pmPanels[k % 2]);
    }
    ring(kit, [pmA + .004, 0, pmZ], pmR + .012, 'x', palette.silver, .022);
    ring(kit, [pmA + .006, 0, pmZ], inboardBore + .006, 'x', palette.silver, .018);
    group.userData.inboardJoint = { plane: -2.189909, radius: inboardBore, profile: 'Flat annular bulkhead with nested CBM cuff' };
    // Closed outboard bulkhead and low projecting airlock from GLB node94.
    // The barrel and Harmony-side collar keep their existing dimensions.
    kit.cylinder([pmB - .018, 0, pmZ], pmR, .036, palette.hull, [0, 0, Math.PI / 2]);
    ring(kit, [pmB - .041, 0, pmZ], pmR - .018, 'x', palette.silver, .03);
    for (let k = 0; k < pmColumns; k++) {
        const a0 = k * Math.PI * 2 / pmColumns + .009, a1 = a0 + Math.PI * 2 / pmColumns - .018;
        sweepX(pmR - .065, pmB - .038, 1.11, pmB - .041, a0, a1, pmPanels[k % 2]);
    }
    const airlockY = -.214441, airlockZ = -4.612287, airlockR = .943679;
    const bottomAngle = Math.asin((-1.086284 - airlockY) / airlockR);
    const airlockShape = new THREE.Shape();
    airlockShape.absarc(0, 0, airlockR, bottomAngle, Math.PI - bottomAngle, false); airlockShape.closePath();
    const housing = new THREE.ExtrudeGeometry(airlockShape, { depth: .488235, bevelEnabled: false, curveSegments: 32 });
    kit.add(housing, material(palette.white), [pmB, airlockY, airlockZ], [1, 1, 1], [0, -Math.PI / 2, 0]);
    const doorShape = new THREE.Shape(), dw = .809943, dh = .976726, cr = .135;
    doorShape.moveTo(-dw / 2 + cr, -dh / 2);
    doorShape.lineTo(dw / 2 - cr, -dh / 2); doorShape.quadraticCurveTo(dw / 2, -dh / 2, dw / 2, -dh / 2 + cr);
    doorShape.lineTo(dw / 2, dh / 2 - cr); doorShape.quadraticCurveTo(dw / 2, dh / 2, dw / 2 - cr, dh / 2);
    doorShape.lineTo(-dw / 2 + cr, dh / 2); doorShape.quadraticCurveTo(-dw / 2, dh / 2, -dw / 2, dh / 2 - cr);
    doorShape.lineTo(-dw / 2, -dh / 2 + cr); doorShape.quadraticCurveTo(-dw / 2, -dh / 2, -dw / 2 + cr, -dh / 2);
    const door = new THREE.ExtrudeGeometry(doorShape, { depth: .02737, bevelEnabled: false, curveSegments: 8 });
    kit.add(door, material(palette.silver), [-14.522, -.166451, -4.663179], [1, 1.04, 1.04], [0, -Math.PI / 2, 0]);
    kit.add(new THREE.ShapeGeometry(doorShape, 16), material(palette.hull), [-14.552, -.166451, -4.663179], [.94, .94, 1], [0, -Math.PI / 2, 0]);
    kit.rod([-14.576, -.08, -4.93], [-14.576, -.30, -4.93], .023, palette.gold);
    for (const y of [-.08, -.30]) kit.rod([-14.548, y, -4.93], [-14.576, y, -4.93], .017, palette.gold);
    for (const [y, z] of [[.654461, -5.602682], [.608299, -3.741911]]) {
        kit.cylinder([pmB - .048, y, z], .4193, .028, palette.hull, [0, 0, Math.PI / 2]);
        ring(kit, [pmB - .064, y, z], .409, 'x', palette.silver, .017);
    }
    group.userData.outboardBulkhead = { x: pmB, bridgeCenter: [-14.299, -1.56130433, -4.61228676] };
    // Gold handrails in rows along the seams, one per bay; the rows beside the top clear the logistics module.
    for (let row = 0; row < 8; row++) {
        const a = Math.PI / 8 + row * Math.PI / 4;
        for (let bay = 0; bay < pmBays; bay++) {
            if ((row === 1 || row === 2) && (bay === 6 || bay === 7)) continue;
            const xa = lerp(bayEdge(bay), bayEdge(bay + 1), .18), xb = lerp(bayEdge(bay), bayEdge(bay + 1), .82);
            kit.rod(onPM(a, pmR + .1, xa), onPM(a, pmR + .1, xb), .022, 0xc39a45);
            for (const x of [xa, xb]) kit.rod(onPM(a, pmR + .008, x), onPM(a, pmR + .1, x), .016, 0xc39a45);
        }
    }
    // The Japanese flag above "JAPAN" on the forward side, as photographed.
    const flagCanvas = document.createElement('canvas'); flagCanvas.width = 512; flagCanvas.height = 448;
    const fl = flagCanvas.getContext('2d');
    fl.fillStyle = '#f4f4ef'; fl.fillRect(0, 0, 512, 448);
    fl.strokeStyle = '#9aa29e'; fl.lineWidth = 4; fl.strokeRect(40, 30, 432, 288);
    fl.fillStyle = '#c8202c'; fl.beginPath(); fl.arc(256, 174, 86, 0, Math.PI * 2); fl.fill();
    fl.fillStyle = '#9b1c26'; fl.font = '700 92px sans-serif'; fl.textAlign = 'center'; fl.textBaseline = 'middle'; fl.fillText('JAPAN', 256, 392, 470);
    const flagMap = new THREE.CanvasTexture(flagCanvas); flagMap.colorSpace = THREE.SRGBColorSpace; flagMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const flagSkin = material(0xffffff, .8, .02, flagMap).clone(); flagSkin.side = THREE.DoubleSide;
    flagSkin.polygonOffset = true; flagSkin.polygonOffsetFactor = -2; flagSkin.polygonOffsetUnits = -2; flagSkin.userData.decal = true;
    const flag = new THREE.PlaneGeometry(1.2, 1.05, 1, 12), flagPoints = flag.attributes.position;
    for (let i = 0; i < flagPoints.count; i++) {
        const along = flagPoints.getX(i), a = -.1 + flagPoints.getY(i) / (pmR + .012);
        flagPoints.setXYZ(i, -10.4 - along, Math.sin(a) * (pmR + .012), pmZ - Math.cos(a) * (pmR + .012));
    }
    flag.computeVertexNormals(); kit.add(flag, flagSkin, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    // A bronze grapple fixture and a flat service plate on the forward side.
    const pdgfNormal = new THREE.Vector3(0, Math.sin(.09), -Math.cos(.09)), pdgfTurn = new THREE.Quaternion().setFromUnitVectors(vertical, pdgfNormal);
    const pdgfAt = lift => new THREE.Vector3(...onPM(.09, pmR, -7.0)).addScaledVector(pdgfNormal, lift).toArray();
    kit.add(new THREE.CylinderGeometry(.34, .34, .06, 24).applyQuaternion(pdgfTurn), material(0x8c6a3a, .55, .45), pdgfAt(.03));
    kit.add(new THREE.CylinderGeometry(.22, .22, .08, 24).applyQuaternion(pdgfTurn), material(0x6d5230, .5, .5), pdgfAt(.07));
    kit.add(new THREE.CylinderGeometry(.05, .05, .22, 12).applyQuaternion(pdgfTurn), material(palette.silver), pdgfAt(.16));
    sweepX(pmR + .02, -4.9, pmR + .02, -5.9, .04, .3, twoSided(0xc3c8c4, .6, .25));
    kit.line([onPM(.04, pmR + .026, -4.9), onPM(.04, pmR + .026, -5.9)]); kit.line([onPM(.3, pmR + .026, -4.9), onPM(.3, pmR + .026, -5.9)]);
    group.userData.exposedFacilityInterfaces = 12;
    group.userData.roboticArmJoints = 6;
    group.userData.roboticArmBooms = 3;
    group.userData.logisticsModuleDiameter = 4.4;
    // JAXA ELM-PS: 4.4 m diameter; one lower CBM and external upper
    // mounting hardware. The dark top recess is capped, not an open hull.
    // Berthed at the outboard end of the Pressurized Module, beside the arm base, as photographed.
    // https://iss.jaxa.jp/en/kibo/about/kibo/jlp/
    const elmX = -11.7, elmZ = -4.7;
    // The source Kibo port has a curved saddle below the ELM's flat receiving cuff.
    // Seat the retained collar around its entire circumference, not just at the crown.
    const elmSaddle = new THREE.Group(), elmSaddleKit = new Kit();
    elmSaddle.name = 'Kibo / ELM curved CBM saddle';
    elmSaddle.position.set(elmX, 0, elmZ); elmSaddle.rotation.x = -Math.PI / 2;
    curvedCbmSaddle(elmSaddleKit, pmR, [
        [1.005, 'plane', 2.235], [1.218, 'plane', 2.235],
        [1.238, 'plane', 2.217], [1.238, 'shell', .012],
        [1.290, 'shell', .012], [1.290, 'shell', .030],
        [1.005, 'shell', .030], [1.005, 'plane', 2.235]
    ]);
    elmSaddle.userData.interface = { source: 'ISS_stationary.glb nodes 85 / 94',
        hullRadius: pmR, flatFace: 2.235, rootDepths: [.012, .030], axis: 'Y' };
    elmSaddleKit.finish(elmSaddle); group.add(elmSaddle);

    kit.cylinder([elmX, 2.35, elmZ], 1.04, .40, palette.silver, [0, 0, 0]);
    for (const y of [2.19, 2.51]) {
        kit.cylinder([elmX, y, elmZ], 1.22, .10, palette.hull, [0, 0, 0]);
        ring(kit, [elmX, y, elmZ], 1.22, 'y', palette.silver, .045);
    }
    kit.add(new THREE.CylinderGeometry(2.2, 1.22, .40, 48), material(palette.silver), [elmX, 2.72, elmZ]);
    kit.cylinder([elmX, 4.50, elmZ], 2.2, 3.16, palette.hull, [0, 0, 0]);
    kit.add(new THREE.CylinderGeometry(1.40, 2.20, .32, 48), material(palette.silver), [elmX, 6.24, elmZ]);
    for (const y of [2.94, 3.98, 5.02, 6.07]) ring(kit, [elmX, y, elmZ], 2.22, 'y', palette.silver, .033);
    for (let sector = 0; sector < 12; sector++) {
        const angle = sector * Math.PI / 6;
        for (let row = 0; row < 3; row++) {
            const y = 3.46 + row * 1.04;
            const patch = new THREE.CylinderGeometry(2.219, 2.219, .96, 6, 1, true, angle + .022, Math.PI / 6 - .044);
            kit.add(patch, material((sector + row) % 5 === 0 ? 0xb9c0be : palette.hull), [elmX, y, elmZ], [1, 1, 1], [0, 0, 0], false);
            for (const a of [angle + .07, angle + Math.PI / 6 - .07]) {
                for (const dy of [-.40, .40]) kit.sphere([elmX + Math.sin(a) * 2.235, y + dy, elmZ + Math.cos(a) * 2.235], [.028, .028, .028], palette.silver);
            }
        }
        // Long narrow skin seams follow the actual cylindrical wall.
        kit.rod([elmX + Math.sin(angle) * 2.227, 3.00, elmZ + Math.cos(angle) * 2.227], [elmX + Math.sin(angle) * 2.227, 6.03, elmZ + Math.cos(angle) * 2.227], .014, palette.silver);
    }
    kit.cylinder([elmX, 6.40, elmZ], 1.30, .10, palette.silver, [0, 0, 0]);
    kit.cylinder([elmX, 6.454, elmZ], 1.13, .018, 0xc5cac6, [0, 0, 0]);
    // Low boxes, a small dome and a fitting on the closed top, as photographed.
    for (const [dx, dz, w, h, d] of [[-.55, .35, .42, .22, .32], [.45, -.5, .36, .2, .5], [.1, .62, .3, .16, .3]]) kit.box([elmX + dx, 6.465 + h / 2, elmZ + dz], [w, h, d], palette.white);
    kit.add(new THREE.SphereGeometry(.26, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), material(palette.white), [elmX + .55, 6.47, elmZ + .45]);
    kit.cylinder([elmX - .4, 6.5, elmZ - .5], .16, .06, palette.silver, [0, 0, 0]);
    ring(kit, [elmX, 6.465, elmZ], 1.17, 'y', palette.white, .057);
    for (let bolt = 0; bolt < 16; bolt++) {
        const a = bolt * Math.PI / 8;
        kit.cylinder([elmX + Math.sin(a) * 1.15, 2.572, elmZ + Math.cos(a) * 1.15], .035, .03, palette.rail, [0, 0, 0]);
    }
    // External cable and grapple fittings stay on the ELM shell.
    const elmRoute = [[elmX + .62, 2.33, elmZ - .88], [elmX + .69, 2.73, elmZ - 1.78], [elmX + .73, 3.06, elmZ - 2.12], [elmX + .73, 5.91, elmZ - 2.12]];
    for (let i = 1; i < elmRoute.length; i++) kit.rod(elmRoute[i - 1], elmRoute[i], .042, palette.white);
    for (const y of [3.08, 4.15, 5.31, 5.91]) kit.box([elmX + .73, y, elmZ - 2.12], [.17, .16, .12], palette.silver);
    // Fine vertical ribs, gold handrails and orange trunnion fittings, as photographed and illustrated.
    for (let rib = 0; rib < 36; rib++) {
        const a = rib * Math.PI / 18 + Math.PI / 36;
        kit.line([[elmX + Math.sin(a) * 2.232, 2.98, elmZ + Math.cos(a) * 2.232], [elmX + Math.sin(a) * 2.232, 6.02, elmZ + Math.cos(a) * 2.232]]);
    }
    for (let rail = 0; rail < 8; rail++) {
        const a = rail * Math.PI / 4 + Math.PI / 12, at = (r, y) => [elmX + Math.sin(a) * r, y, elmZ + Math.cos(a) * r];
        for (const [y0, y1] of [[3.25, 4.15], [4.85, 5.75]]) {
            kit.rod(at(2.33, y0), at(2.33, y1), .017, palette.gold);
            for (const y of [y0, y1]) kit.rod(at(2.225, y), at(2.33, y), .013, palette.gold);
        }
    }
    for (let t = 0; t < 4; t++) {
        const a = t * Math.PI / 2 + Math.PI / 4;
        for (const y of [3.0, 6.02]) kit.box([elmX + Math.sin(a) * 2.28, y, elmZ + Math.cos(a) * 2.28], [.22, .2, .22], 0xd0772b, [0, a, 0]);
    }

    // EF coordinates measured from ISS_stationary.glb node92. The 180-degree
    // frame preserves its asymmetric offset while keeping the PM barrel fixed.
    const ef = new THREE.Group(), efKit = new Kit();
    ef.name = 'Kibo exposed facility';
    ef.position.set(-14.96561222, -1.56130433, -4.61228676);
    ef.rotation.y = Math.PI;
    const deckCenter = [2.63489580, -.09498987, 1.02988231];
    const deckSize = [4.88252544, 1.24332023, 3.15405440];
    const deckTop = .52667028, nearEdge = -.54714489, farEdge = 2.60690951;
    ef.userData.reference = 'ISS_stationary.glb / node92';
    ef.userData.deckCenter = deckCenter;
    ef.userData.deckSize = deckSize;
    efKit.box(deckCenter, deckSize, palette.silver);
    efKit.box([deckCenter[0], deckTop + .012, deckCenter[2]], [deckSize[0] - .045, .024, deckSize[2] - .045], 0xdad6c8);
    // Thin perimeter seams and thermal blanket fasteners follow the actual edges.
    for (const z of [nearEdge + .05, farEdge - .05]) {
        efKit.box([deckCenter[0], deckTop + .038, z], [deckSize[0] - .10, .035, .045], palette.hull);
        for (let x = .35; x < 5.0; x += .30) efKit.cylinder([x, deckTop + .060, z], .016, .014, palette.rail, [0, 0, 0]);
        for (const y of [-.50, .24]) efKit.rod([.28, y, z], [4.99, y, z], .018, palette.hull);
    }
    for (const x of [.25, 5.02]) efKit.box([x, deckTop + .035, deckCenter[2]], [.045, .035, deckSize[2] - .08], palette.hull);
    for (let x = 1.15; x < 4.9; x += 1.15) {
        efKit.rod([x, deckTop + .029, nearEdge + .09], [x, deckTop + .029, farEdge - .09], .006, 0xbfc2b9);
        for (const z of [nearEdge - .005, farEdge + .005]) efKit.rod([x, -.64, z], [x, .43, z], .012, palette.hull);
    }
    // Low bridge beneath the PM airlock; its root touches the existing barrel end.
    const bridgeStart = -.91561222, bridgeEnd = .19363292;
    efKit.box([bridgeStart + .249, 0, 0], [.498, .95004, 1.059], palette.white);
    efKit.cylinder([(-.41761222 + bridgeEnd) / 2, 0, 0], .443684, bridgeEnd + .41761222, palette.white, [0, 0, Math.PI / 2]);
    for (const x of [bridgeStart + .02, -.10, .16]) {
        efKit.cylinder([x, 0, 0], .448, .065, palette.silver, [0, 0, Math.PI / 2]);
        ring(efKit, [x, 0, 0], .446, 'x', palette.hull, .022);
    }
    for (const z of [-.32, .32]) efKit.rod([bridgeStart + .1, -.31, z], [.22, -.47, z], .035, palette.silver);
    ef.userData.bridgeEndpoints = [[bridgeStart, 0, 0], [bridgeEnd, 0, 0]];

    // Ten perimeter sockets, measured from the reference, support the long payloads.
    const edgeStations = [.973, 2.128, 3.2837, 4.439];
    const edgeMounts = [];
    for (const x of edgeStations) for (const side of [-1, 1]) {
        const edge = side < 0 ? nearEdge : farEdge;
        efKit.box([x, -.3807, edge + side * .14944], [.68463, .59339, .29889], palette.hull);
        efKit.box([x, -.38442, edge + side * .37039], [.59685, .51689, .143], palette.silver);
        edgeMounts.push([x, -.38442, edge + side * .44189]);
        ring(efKit, [x, -.38442, edge + side * .445], .20, 'z', palette.rail, .023);
    }
    for (const [x, y, z] of [[5.22945, -.38070, -.01997], [5.23873, -.40997, 2.06760]]) {
        efKit.box([x, y, z], [.29889, .59339, .68463], palette.hull);
        efKit.box([x + .22, y, z], [.143, .51689, .59685], palette.silver);
        edgeMounts.push([x + .2915, y, z]);
    }
    ef.userData.perimeterSockets = edgeMounts;
    // The three low octagonal deck fittings are visible in the supplied top view.
    for (const [x, z, turn] of [[3.2994, .04147, 0], [3.29937, 1.98494, 0], [4.56943, 1.02644, Math.PI / 2]]) {
        efKit.add(new THREE.CylinderGeometry(.342, .342, .29812, 8), material(palette.hull), [x, deckTop + .14906, z], [1, 1, .867], [0, turn + Math.PI / 8, 0]);
        ring(efKit, [x, deckTop + .307, z], .238, 'y', palette.rail, .024);
        efKit.cylinder([x, deckTop + .302, z], .184, .025, palette.white, [0, 0, 0]);
        efKit.cylinder([x, deckTop + .323, z], .064, .025, palette.rail, [0, 0, 0]);
        for (let n = 0; n < 3; n++) {
            const a = n * Math.PI * 2 / 3;
            efKit.cylinder([x + .139 * Math.cos(a), deckTop + .327, z + .139 * Math.sin(a)], .035, .025, palette.dark, [0, 0, 0]);
        }
    }
    // Compact deck ORUs and gold handles retain the procedural render.
    const deckPanel = (x, z, w, d) => {
        const h = .413904;
        efKit.box([x, deckTop + h / 2, z], [w, h, d], palette.white);
        for (const dx of [-w * .32, w * .32]) for (const dz of [-d * .30, d * .30]) {
            efKit.box([x + dx, deckTop + h + .014, z + dz], [.065, .025, .085], 0x929c99, [0, 0, 0], false);
            efKit.cylinder([x + dx, deckTop + h + .034, z + dz], .015, .02, palette.rail, [0, 0, 0]);
        }
        efKit.rod([x - w * .17, deckTop + h + .041, z], [x + w * .17, deckTop + h + .041, z], .016, palette.gold);
    };
    for (let n = 0; n < 4; n++) deckPanel(.66 + n * .51, 1.13, .44, .63);
    for (let n = 0; n < 2; n++) deckPanel(4.08 + n * .49, .12, .40, .57);
    for (let n = 0; n < 2; n++) deckPanel(3.94 + n * .45, 2.10, .37, .50);
    for (const [x, z] of [[.68, .08], [1.20, .08], [2.57, .47], [2.69, 1.26]]) {
        efKit.box([x, deckTop + .1, z], [.27, .15, .29], palette.silver);
        efKit.box([x, deckTop + .19, z], [.19, .03, .19], palette.hull);
    }
    const grapple = (k, x, y, z) => {
        k.cylinder([x, y + .019, z], .29, .038, 0xb5a887, [0, 0, 0]);
        ring(k, [x, y + .041, z], .267, 'y', palette.silver, .016);
        k.cylinder([x, y + .057, z], .061, .064, palette.silver, [0, 0, 0]);
        for (let n = 0; n < 3; n++) {
            const a = n * Math.PI * 2 / 3 + .2;
            k.rod([x + Math.cos(a) * .061, y + .070, z + Math.sin(a) * .061], [x + Math.cos(a) * .19, y + .10, z + Math.sin(a) * .19], .016, palette.silver);
        }
    };
    for (const [x, z] of [[2.03545, 2.01681], [2.03612, .04295]]) grapple(efKit, x, deckTop + .025, z);
    // Four corner outriggers lie beside, rather than outside a widened deck.
    for (const x of [.23965, 5.03015]) for (const [edge, z] of [[nearEdge, -1.26174], [farEdge, 3.32151]]) {
        efKit.rod([x, .3695, edge], [x, .3695, z], .035, palette.silver);
        efKit.box([x, .3695, z], [.63459, .40898, .028], 0xbaae8d);
        efKit.box([x, .3695, z], [.055, .48, .14], palette.silver);
    }
    // The two lower support triangles remain attached to the distal deck structure.
    for (const z of [.181, 1.879]) {
        efKit.rod([4.46, -.71665, z], [5.04, -2.22, z], .036, palette.silver);
        efKit.rod([5.02, -.71665, z], [5.04, -2.22, z], .036, palette.silver);
        efKit.rod([4.46, -.71665, z], [5.02, -.71665, z], .035, palette.silver);
    }
    efKit.finish(ef);
    // Seven instruments, including OCO-3 and ECOSTRESS, which are separate
    // scene roots in the source file rather than children of node92.
    const payloads = [
        { name: 'Forward instrument', center: [.97290647, -.38442150, 4.00344181], size: [.82702392, 1.03377688, 1.90928817], grapple: [.97432876, .171, 3.6762414] },
        { name: 'OCO-3', center: [2.11076593, -.48857705, 3.82613015], size: [.73736095, 1.01999962, 1.84064102], grapple: [2.12838, .0795, 3.66207] },
        { name: 'ICS dish payload', center: [4.43893480, -.38442168, 4.00616074], size: [.82702351, 1.03377688, 1.91472626], grapple: [4.44037437, .171, 3.67623997], dish: true },
        { name: 'Opposite-side instrument', center: [3.28366208, -.38442147, -1.84965289], size: [.82702398, 1.033777, 1.72123647], grapple: [3.28435612, .171, -1.61647487] },
        { name: 'CATS', center: [4.43893181, -.38442209, -1.77815232], size: [.82702425, 1.03377694, 1.86423737], grapple: [4.43708, .168, -1.59513] },
        { name: 'Distal instrument', center: [6.48581505, -.41369241, 2.06650233], size: [1.90928888, 1.033777, .82702386], grapple: [6.162961, .14517, 2.06468153] },
        { name: 'ECOSTRESS', center: [6.37842846, -.37841497, -.01551128], size: [1.99905968, .77874541, .80000114], grapple: [6.21752, .14017, -.01508] }
    ];
    ef.userData.payloads = payloads;
    for (const payload of payloads) {
        const assembly = new THREE.Group(), pk = new Kit(); assembly.name = 'Kibo EF / ' + payload.name;
        const [x, y, z] = payload.center, [w, h, d] = payload.size;
        assembly.userData.referenceCenter = payload.center; assembly.userData.referenceSize = payload.size;
        // Fold lines on white thermal covers, with a recessed well for the ICS reflector.
        if (payload.dish) {
            pk.box([x, y, 3.526], [w, h, .954], palette.white);
            pk.box([x, y - h / 2 + .06, 4.484], [w, .12, .96], palette.silver);
            for (const side of [-1, 1]) pk.box([x + side * (w / 2 - .025), y, 4.484], [.05, h, .96], palette.white);
            pk.box([x, y, 4.939], [w, h, .05], palette.white);
            pk.add(new THREE.SphereGeometry(.3552, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), material(palette.silver, .32, .7), [4.445709, -.472, 4.427698], [1, .595, 1]);
            ring(pk, [4.445709, -.467, 4.427698], .3552, 'y', palette.hull, .017);
        } else {
            pk.box(payload.center, payload.size, palette.white);
            for (let n = 0; n < 5; n++) {
                const zz = z - d * .43 + n * d * .21;
                pk.rod([x - w * .43, y + h / 2 + .009, zz], [x + w * .43, y + h / 2 + .012, zz + d * .025], .006, 0xc5cac5);
            }
        }
        for (const side of [-1, 1]) {
            const xx = x + side * w * .501;
            for (let n = 0; n < 4; n++) {
                const zz = z - d * .40 + n * d * .26;
                pk.rod([xx, y - h * .42, zz], [xx, y + h * .41, zz + d * .05], .008, 0xc5cac5);
            }
        }
        const coverTop = y + h / 2, fixtureBase = payload.grapple[1];
        if (fixtureBase > coverTop) pk.cylinder([payload.grapple[0], (coverTop + fixtureBase) / 2, payload.grapple[2]], .17, fixtureBase - coverTop + .005, palette.hull, [0, 0, 0]);
        grapple(pk, ...payload.grapple);
        if (payload.name === 'OCO-3') {
            pk.box([x, y, z + d / 2 + .012], [.52, .48, .025], 0x5e6b70);
            pk.cylinder([x, y + h / 2 + .029, z + .60], .098, .035, palette.silver, [0, 0, 0]);
        } else if (!payload.dish) {
            const alongX = w > d, outward = Math.sign(z - deckCenter[2]);
            pk.box([x + (alongX ? w / 2 + .006 : 0), y, z + (alongX ? 0 : outward * (d / 2 + .006))], alongX ? [.015, h * .64, d * .66] : [w * .66, h * .64, .015], 0x82908f, [0, 0, 0], false);
        }
        pk.finish(assembly); ef.add(assembly);
    }
    group.add(ef);
    group.userData.exposedPayloads = 7;
    group.userData.referenceDeckFittings = 3;

    // Reference pose: the two long JEMRMS booms run along the deck,
    // with six joint centers measured from GLB nodes91 through86.
    const jemJoints = [[-14.04973583, .87617767, -6.38100929], [-14.80628853, 1.17227912, -6.05433578], [-14.80625992, 1.58075106, -6.58349724], [-18.87270527, 1.58075106, -6.04686089], [-22.94708042, 1.58075106, -5.52672882], [-23.39033108, 2.09615254, -5.53832550]];
    group.userData.jemJointCenters = jemJoints;
    // Shaft axes differ from joint origins: the elbow/wrist housings step sideways.
    const jemBooms = [
        { start: [-14.71328, 1.58075106, -6.57210], end: [-19.01376, 1.58075106, -6.57210], radius: .1461 },
        { start: [-18.86140, 1.58075106, -6.05519], end: [-23.08941, 1.58075106, -6.05519], radius: .1586 }
    ];
    group.userData.jemBoomCenterlines = jemBooms;
    group.userData.jemLongBoomLengths = jemBooms.map(b => new THREE.Vector3(...b.start).distanceTo(new THREE.Vector3(...b.end)));
    const arm = new THREE.Group(), armKit = new Kit(); arm.name = 'Kibo JEMRMS reference pose';
    armKit.box([-14.085, .876, -6.381], [.14, .61, .64], palette.silver);
    for (const dz of [-.23, .23]) armKit.rod([-14.075, .56, -6.381 + dz], jemJoints[1], .045, palette.silver);
    jemJoints.forEach((joint, index) => {
        const rotation = index === 0 || index === 4 ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
        armKit.cylinder(joint, .20, .39, palette.white, rotation);
        armKit.cylinder(joint, .207, .064, palette.silver, rotation);
        if (index < jemJoints.length - 1 && index !== 2 && index !== 3) armKit.rod(joint, jemJoints[index + 1], .16, palette.white);
    });
    jemBooms.forEach((boom, i) => {
        const a = new THREE.Vector3(...boom.start), b = new THREE.Vector3(...boom.end);
        armKit.rod(boom.start, boom.end, boom.radius, palette.white);
        const cable = point => point.clone().add(new THREE.Vector3(0, 0, -boom.radius - .011)).toArray();
        armKit.rod(cable(a.clone().lerp(b, .055)), cable(a.clone().lerp(b, .945)), .012, palette.silver);
        for (const t of [.10, .29, .49, .69, .89]) armKit.rod(a.clone().lerp(b, t).toArray(), a.clone().lerp(b, t + .014).toArray(), boom.radius + .009, palette.hull);
        const nextJoint = jemJoints[i + 3];
        armKit.rod([nextJoint[0], nextJoint[1], boom.end[2]], nextJoint, .16, palette.white);
        armKit.cylinder([nextJoint[0], nextJoint[1], boom.end[2]], .205, .09, palette.silver);
    });
    // Joint-mounted cameras and short wrist section follow the same arm pose.
    for (const index of [3, 5]) {
        const [x, y, z] = jemJoints[index];
        armKit.box([x, y + .03, z - .30], [.27, .20, .22], palette.white);
        armKit.cylinder([x, y + .03, z - .44], .069, .09, palette.dark);
        armKit.rod([x, y, z - .16], [x, y, z - .25], .028, palette.silver);
    }
    const [wristX, wristY, wristZ] = jemJoints[5];
    armKit.rod(jemJoints[5], [wristX - 1.20, wristY, wristZ], .125, palette.white);
    armKit.add(new THREE.CylinderGeometry(.19, .19, .43, 28, 1, true), material(palette.white), [wristX - 1.20, wristY, wristZ], [1, 1, 1], [0, 0, Math.PI / 2]);
    ring(armKit, [wristX - 1.415, wristY, wristZ], .19, 'x', palette.silver, .024);
    armKit.cylinder([wristX - 1.31, wristY, wristZ], .165, .02, palette.dark, [0, 0, Math.PI / 2]);
    for (let n = 0; n < 3; n++) {
        const a = n * Math.PI * 2 / 3, b = a + Math.PI * 2 / 3;
        armKit.rod([wristX - 1.37, wristY + Math.cos(a) * .15, wristZ + Math.sin(a) * .15], [wristX - 1.37, wristY + Math.cos(b) * .15, wristZ + Math.sin(b) * .15], .01, palette.silver);
    }
    armKit.finish(arm); group.add(arm);
    hullBadge(kit, 'KIBO', [-7.3, 0, -4.7], 2.23, [1.3, .34], 'x');
});
