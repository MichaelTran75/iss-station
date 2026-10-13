// Nauka multipurpose laboratory.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { Kit, material, palette, shapes, vertical } from '../core/kit.js';
import { part, ring } from '../core/station.js';
import { payloadBlanket, payloadPillow } from '../core/surfaces.js';

part('nauka', 'Nauka multipurpose laboratory', '15 / SCIENCE & OPERATIONS', 'Nauka docked to Zvezda in July 2021. The Russian laboratory supports research and the seven-joint European Robotic Arm. Its insulated laboratory, white radiator panels, stepped service compartment and framed solar wings follow the supplied photographic and rendered references. The inherited arm pose remains illustrative.', [['Joined station', '2021'], ['ERA joints', '7']], [0, -7.5, 31], (kit, group) => {
    // Reconstructed from the supplied front photograph and oblique render.
    // Local -Y runs from Zvezda to the separately modelled lower adapter; the shared Russian offset is applied later.
    const axisZ = 31, silver = 0xbfc5bc, seam = 0x969d91, ivory = 0xd9d6bf, white = 0xe9ede7, copper = 0xa35e24;
    const foilMap = payloadBlanket.map.clone(); foilMap.wrapS = foilMap.wrapT = THREE.RepeatWrapping; foilMap.repeat.set(5, 9); foilMap.needsUpdate = true;
    const foil = material(ivory, .87, .17, foilMap).clone(), panel = material(white, .79, .10), dark = material(0x303c3c, .76, .15);
    foil.userData.poiskSkin = 'lab';
    const coverSkin = foil.clone(); coverSkin.userData.poiskSkin = 'cover';
    // Broad laboratory above a distinct shoulder and narrower service compartment.
    const profile = [[-10.20, 1.10], [-9.96, 1.43], [-9.66, 1.64], [-9.38, 1.68], [-9.15, 1.63], [-7.04, 1.63], [-6.82, 1.69], [-6.58, 1.91], [-6.29, 2.10], [-3.10, 2.10], [-2.85, 2.06], [-2.57, 1.76], [-2.32, 1.36], [-2.20, 1.05]];
    function radius(y) { let i = profile.findIndex(p => p[0] >= y); i = Math.max(1, i < 0 ? profile.length - 1 : i); const a = profile[i - 1], b = profile[i]; return THREE.MathUtils.lerp(a[1], b[1], THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1)); }
    const around = (a, r, y) => [Math.sin(a) * r, y, axisZ + Math.cos(a) * r];
    const surface = (a, y, lift = 0) => around(a, radius(y) + lift, y);
    const samples = []; for (let i = 1; i < profile.length; i++) { const a = profile[i - 1], b = profile[i], n = Math.max(2, Math.ceil((b[0] - a[0]) / .13)); for (let j = i === 1 ? 0 : 1; j <= n; j++)samples.push(new THREE.Vector2(THREE.MathUtils.lerp(a[1], b[1], j / n), THREE.MathUtils.lerp(a[0], b[0], j / n))); }
    const hull = new THREE.LatheGeometry(samples, 96), hp = hull.attributes.position;
    for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i), a = Math.atan2(x, z), r = Math.hypot(x, z), fade = Math.min(1, (-2.2 - y) * 4, (y + 10.2) * 4); const wrinkle = (Math.sin(a * 39 + y * 23) * Math.sin(a * 17 - y * 31) + .45 * Math.cos(a * 61 + y * 43)) * .004 * fade; hp.setXYZ(i, x * (1 + wrinkle / r), y, z * (1 + wrinkle / r)); }
    hull.computeVertexNormals(); kit.add(hull, foil, [0, 0, axisZ], [1, 1, 1], [0, 0, 0], false);
    function tube(points, r = .014, color = silver) { kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(20, points.length * 6), r, 6, false), material(color, .8, .18), [0, 0, 0], [1, 1, 1], [0, 0, 0], false); }
    function surfaceTube(a, ys, lift = .045, r = .012, color = seam) { tube(ys.map(y => surface(a, y, lift)), r, color); }
    function hoop(y, r = radius(y) + .025, t = .021, color = silver) { ring(kit, [0, y, axisZ], r, 'y', color, t); }
    function axial(center, normal, geometry, mat) { geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vertical, new THREE.Vector3(...normal).normalize())); kit.add(geometry, typeof mat === 'number' ? material(mat) : mat, center, [1, 1, 1], [0, 0, 0], false); }
    function cap(a, y, r = .18, lift = .09, color = copper) { const normal = [Math.sin(a), 0, Math.cos(a)], p = surface(a, y, lift); axial(p, normal, new THREE.CylinderGeometry(r * 1.17, r * 1.17, .10, 12), silver); axial(surface(a, y, lift + .07), normal, new THREE.CylinderGeometry(r, r * .95, .09, 32), color); const rim = new THREE.TorusGeometry(r * .91, .017, 6, 32).rotateX(Math.PI / 2); axial(surface(a, y, lift + .12), normal, rim, 0xd39a4f); }
    function patch(a, y, w, h, d = .055, color = ivory, lift = .04) { const p = surface(a, y, lift + d * .5); if (color === ivory || color === 0xe2dfcb) kit.add(shapes.box, coverSkin, p, [w, h, d], [0, a, 0], false); else kit.box(p, [w, h, d], color, [0, a, 0], false); }
    function handrail(a, y, h = .53) { const lo = y - h / 2, hi = y + h / 2; kit.rod(surface(a, lo, .08), surface(a, lo, .20), .019, silver); kit.rod(surface(a, hi, .08), surface(a, hi, .20), .019, silver); tube([surface(a, lo, .20), surface(a, y, .20), surface(a, hi, .20)], .026, 0xccc8a9); }
    // Original docking interfaces keep both connected modules seated on their existing axes.
    for (const [y, r] of [[-2.2, 1.05], [-10.2, 1.10]]) kit.add(shapes.sphere, foil, [0, y, axisZ], [r, r * .16, r], [0, 0, 0], false);
    // The upper adapter flares smoothly into Nauka's existing shoulder, with its 0.90 m flange
    // ending exactly at Zvezda's nadir face y = -1.50.
    const upperConnector = new THREE.LatheGeometry([[-2.20, 1.04], [-2.15, 1.01], [-2.02, .78], [-1.62, .78], [-1.58, .90], [-1.50, .90]].map(([y, r]) => new THREE.Vector2(r, y)), 96);
    kit.add(upperConnector, material(silver, .62, .38), [0, 0, axisZ], [1, 1, 1], [0, 0, 0], false);
    hoop(-1.58, .90, .015, white); hoop(-2.03, .795, .020, silver);
    group.userData.serviceModuleFace = {axis: 'y', coordinate: -1.50, radius: .90};
    for (const [y, sign, endRadius] of [[-10.2, -1, 1.47]]) {
        kit.cylinder([0, y + sign * .30, axisZ], endRadius * .57, .65, white, [0, 0, 0]);
        hoop(y + sign * .56, endRadius * .59, .065, silver); hoop(y + sign * .67, endRadius * .56, .08, 0x47514e);
        kit.cylinder([0, y + sign * .68, axisZ], endRadius * .42, .045, silver, [0, 0, 0]);
        hoop(y + sign * .712, endRadius * .40, .025, white);
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; axial(around(a, endRadius * .49, y + sign * .74), [0, sign, 0], new THREE.CylinderGeometry(.055, .055, .065, 8), silver); }
    }
    // Blanket seam belts, longitudinal sewn joins and short service-line clamps.
    for (const y of [-2.84, -3.10, -6.32, -6.65, -7.13, -8.48, -9.26, -9.66, -9.92]) hoop(y, radius(y) + .032, y === -6.32 ? .038 : .019);
    for (const a of [.25, 1.12, 1.96, 2.53, 3.03, 3.77, 4.56, 5.42, 5.99]) surfaceTube(a, profile.map(p => p[0]), .018, .008, 0xb9bbaa);
    // Tall white radiator panels leave a deep, exposed front service corridor.
    const radiatorSpecs = [{ a: 2.49, span: .57 }, { a: 3.88, span: .74 }, { a: .38, span: .86 }, { a: 5.54, span: .64 }];
    const panelY = -4.71, panelH = 3.64, panelR = 2.245;
    for (const spec of radiatorSpecs) {
        const a0 = spec.a - spec.span / 2, a1 = spec.a + spec.span / 2;
        const shell = new THREE.CylinderGeometry(panelR, panelR, panelH, 32, 1, true, a0, spec.span); const skin = panel.clone(); skin.side = THREE.DoubleSide; kit.add(shell, skin, [0, panelY, axisZ], [1, 1, 1], [0, 0, 0], false);
        for (const a of [a0, a1]) { kit.rod(around(a, panelR + .005, panelY - panelH / 2), around(a, panelR + .005, panelY + panelH / 2), .025, 0xd8ded7); for (const y of [-3.14, -4.64, -6.25]) kit.rod(surface(a, y, .02), around(a, panelR - .012, y), .037, silver); }
        for (const y of [panelY - panelH / 2, panelY + panelH / 2]) { const pts = []; for (let j = 0; j <= 16; j++)pts.push(around(a0 + j * spec.span / 16, panelR + .009, y)); tube(pts, .024, white); }
        for (let j = 1; j < 33; j++) { const y = panelY - panelH / 2 + j * panelH / 33, pts = []; for (let k = 0; k <= 12; k++)pts.push(around(a0 + .024 + k * (spec.span - .048) / 12, panelR + .015, y)); tube(pts, .004, j % 6 === 0 ? 0xcbd3ce : 0xe1e6e0); }
        for (const y of [-3.08, -6.35]) for (const a of [a0 + .045, a1 - .045]) { axial(around(a, panelR + .018, y), [Math.sin(a), 0, Math.cos(a)], new THREE.CylinderGeometry(.024, .024, .014, 8), silver); }
    }
    // The flank has a separate louvered radiator, with raised horizontal flow channels.
    const louverA = 4.77, louverSpan = .47, louverR = 2.20;
    const lv = new THREE.CylinderGeometry(louverR, louverR, 2.42, 24, 1, true, louverA - louverSpan / 2, louverSpan); const lvm = panel.clone(); lvm.side = THREE.DoubleSide; kit.add(lv, lvm, [0, -5.16, axisZ], [1, 1, 1], [0, 0, 0], false);
    for (let j = 0; j < 16; j++) { const y = -6.29 + j * .15, pts = []; for (let k = 0; k <= 12; k++)pts.push(around(louverA - louverSpan / 2 + .018 + k * (louverSpan - .036) / 12, louverR + .026, y)); tube(pts, .021, 0xe0e6de); }
    // Dark tapered recess at the top of the front corridor, with foil-clad avionics beneath it.
    const gapA = Math.PI;
    patch(gapA, -3.34, .41, .68, .085, 0x303937, .062);
    const hood = new THREE.ConeGeometry(.245, .46, 4, 1, true).rotateY(Math.PI / 4); kit.add(hood, dark, surface(gapA, -3.56, .15), [1, 1, 1], [Math.PI, 0, 0], false);
    for (const [a, y, w, h] of [[3.09, -3.98, .42, .35], [3.15, -4.48, .33, .32], [3.03, -5.07, .44, .57], [3.19, -5.69, .39, .39], [3.05, -6.15, .35, .24], [1.73, -3.71, .39, .33], [5.02, -6.70, .26, .43]]) {
        patch(a, y, w + .075, h + .07, .06, silver, .10); kit.add(payloadPillow.clone().scale(w, h, .14), coverSkin, surface(a, y, .22), [1, 1, 1], [0, a, 0], false);
    }
    for (const a of [2.99, 3.26]) { surfaceTube(a, [-3.65, -4.0, -4.6, -5.1, -5.8, -6.45], .11, .019, silver); for (const y of [-4.1, -4.91, -5.87]) patch(a, y, .17, .08, .045, silver, .12); }
    // Sparse fittings and amber covers on the lower service barrel, staggered as in the photograph.
    for (const [a, y, r] of [[2.34, -7.29, .22], [3.98, -7.13, .25], [2.51, -8.98, .21], [3.84, -9.10, .24]]) { patch(a, y, .66, .65, .07, 0xc7c7b6, .04); cap(a, y, r, .17, copper); handrail(a + .26, y + .04, .40); }
    cap(3.22, -8.26, .155, .09, 0x293a3e);
    for (const [a, y, w, h] of [[3.00, -7.58, .43, .45], [3.52, -8.66, .38, .43], [4.59, -7.56, .39, .58], [1.68, -8.03, .31, .38], [5.39, -9.0, .33, .27], [.2, -8.15, .49, .46]]) patch(a, y, w, h, .05, 0xe2dfcb, .028);
    for (const a of [1.91, 3.58, 5.01]) { surfaceTube(a, [-6.63, -7.03, -7.64, -8.39, -9.10, -9.62], .11, .027, silver); for (const y of [-7.28, -8.52, -9.29]) patch(a, y, .19, .095, .055, silver, .10); }
    for (const [a, y] of [[2.06, -7.97], [3.48, -7.8], [4.32, -8.20], [5.82, -7.69], [2.85, -9.53], [.61, -9.34], [1.51, -4.18], [1.52, -5.44]]) handrail(a, y, .57);
    // Small dark valve clusters, silver flanges and thermal-blanket fastening tabs.
    for (const [a, y] of [[4.44, -8.7], [1.28, -7.32], [3.07, -9.64]]) {
        patch(a, y, .24, .43, .09, 0x828a7e, .08);
        for (const dy of [-.13, 0, .13]) for (const da of [-.043, .043]) cap(a + da, y + dy, .039, .20, 0x343c38);
    }
    for (const y of [-6.48, -9.66]) for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6 + .08; patch(a, y, .15, .16, .042, 0xc4c8ba, .056); }
    // The paired octagonal instrument targets remain above the radiator rim.
    for (const a of [2.56, 3.98]) { const p = surface(a, -2.63, .035); axial(p, [Math.sin(a) * .8, .6, Math.cos(a) * .8], new THREE.CylinderGeometry(.12, .16, .13, 8), silver); }
    // Dark, warm solar-cell blankets: six framed bays on either side of a central deployment spar.
    const cellCanvas = document.createElement('canvas'); cellCanvas.width = 768; cellCanvas.height = 768; const cg = cellCanvas.getContext('2d'); cg.fillStyle = '#252a2c'; cg.fillRect(0, 0, 768, 768);
    for (let y = 0; y < 24; y++)for (let x = 0; x < 24; x++) { cg.fillStyle = ['#303235', '#34383a', '#353430', '#2b3033'][(x * 7 + y * 3) % 4]; cg.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); cg.fillStyle = '#9d9d8960'; cg.fillRect(x * 32 + 15, y * 32 + 2, 1, 28); }
    cg.strokeStyle = '#c2b696'; cg.lineWidth = 4; for (let k = 0; k <= 4; k++) { cg.beginPath(); cg.moveTo(k * 192, 0); cg.lineTo(k * 192, 768); cg.moveTo(0, k * 192); cg.lineTo(768, k * 192); cg.stroke(); }
    const cells = new THREE.CanvasTexture(cellCanvas); cells.colorSpace = THREE.SRGBColorSpace; cells.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const cellMat = material(0xffffff, .78, .18, cells);
    for (const side of [-1, 1]) {
        const y = -6.7, z = 32.2;
        kit.rod([side * 1.24, y, z], [side * 3.04, y, z], .115, silver); kit.cylinder([side * 2.22, y, z], .31, .39, white, [0, 0, Math.PI / 2]); ring(kit, [side * 2.47, y, z], .30, 'x', silver, .032);
        kit.box([side * 2.94, y, z], [.32, .37, .37], silver); kit.rod([side * 3.02, y, z], [side * 12.56, y, z], .073, 0x8c938b);
        for (let bay = 0; bay < 6; bay++)for (const row of [-1, 1]) {
            const x = side * (3.82 + bay * 1.59), cy = y + row * .90, w = 1.53, h = 1.65;
            kit.box([x, cy, z], [w, h, .055], 0x5c625b, [0, 0, 0], false);
            for (const face of [-1, 1]) kit.add(new THREE.PlaneGeometry(w - .06, h - .06), cellMat, [x, cy, z + face * .031], [1, 1, 1], [0, face < 0 ? Math.PI : 0, 0], false);
            for (const dx of [-w / 2, w / 2]) kit.box([x + dx, cy, z], [.032, h + .025, .071], 0xc4c7b4, [0, 0, 0], false);
            for (const dy of [-h / 2, h / 2]) kit.box([x, cy + dy, z], [w, .032, .071], 0xc4c7b4, [0, 0, 0], false);
            for (const dx of [-.54, .54]) kit.box([x + dx, y + row * .065, z], [.14, .115, .10], silver, [0, 0, 0], false);
        }
    }
    // Three-bay deployed radiator after the supplied 10:29 reference.
    // The marked root is in the exposed front service corridor; the bank opens toward -X from that carrier.
    const radiatorCenter = [-4.115, -4.4, 28.47], radiatorWidth = 7.2, radiatorHeight = 3.2;
    const radiatorGroup = new THREE.Group(); radiatorGroup.name = 'Nauka three-panel deployed radiator'; radiatorGroup.position.fromArray(radiatorCenter); radiatorGroup.rotation.y = Math.PI; group.add(radiatorGroup);
    const radiatorKit = new Kit(), bayWidth = 2.29, gap = .165;
    for (let bay = 0; bay < 3; bay++) {
        const x = -radiatorWidth / 2 + bayWidth / 2 + bay * (bayWidth + gap);
        radiatorKit.box([x, 0, 0], [bayWidth, radiatorHeight, .075], white, [0, 0, 0], false);
        // Rolled perimeter edges, small corner fasteners, and restrained thermal-panel seams.
        for (const y of [-1.6, 1.6]) radiatorKit.box([x, y, 0], [bayWidth + .025, .035, .094], 0xd5d9cf, [0, 0, 0], false);
        for (const side of [-1, 1]) {
            radiatorKit.box([x + side * bayWidth / 2, 0, 0], [.032, 3.22, .094], 0xc4cbc2, [0, 0, 0], false);
            for (const y of [-1.47, 1.47]) for (const face of [-1, 1]) radiatorKit.cylinder([x + side * (bayWidth / 2 - .095), y, face * .054], .019, .013, silver);
        }
        for (const y of bay === 2 ? [-1.18, -.47, .30, 1.02] : [-1.25, 1.25]) for (const face of [-1, 1]) radiatorKit.box([x, y, face * .043], [bayWidth - .11, .012, .010], 0xcbd1c7, [0, 0, 0], false);
    }
    // Two dark folding spines separate the three white bays; four knuckles per spine make the joints legible.
    for (let hinge = 0; hinge < 2; hinge++) {
        const x = -radiatorWidth / 2 + bayWidth + gap / 2 + hinge * (bayWidth + gap);
        radiatorKit.box([x, 0, .015], [.095, 3.27, .11], 0x3c4541, [0, 0, 0], false);
        for (const y of [-1.49, -.52, .52, 1.49]) {
            radiatorKit.cylinder([x, y, 0], .085, .21, silver, [0, 0, 0]);
            for (const side of [-1, 1]) radiatorKit.box([x + side * .075, y, 0], [.15, .085, .09], 0xd4d8cd, [0, 0, 0], false);
        }
    }
    // Root shaft is parallel to the module axis. The rotated bank puts it at x=-.46, z=28.45.
    const rootX = -radiatorWidth / 2;
    radiatorKit.rod([rootX - .055, -1.57, .02], [rootX - .055, 1.57, .02], .067, 0x68746c);
    for (const y of [-1.36, 1.36]) radiatorKit.cylinder([rootX - .055, y, .02], .12, .26, silver, [0, 0, 0]);
    // Slim longitudinal carrier in the corridor, clear of the white curved radiator edges and equipment pillows.
    const carrierX = -.46, carrierZ = 28.82, hingeZ = 28.45;
    const carrierGroup = new THREE.Group(); carrierGroup.name = 'Nauka radiator corridor carrier and hinge'; group.add(carrierGroup);
    const mountKit = new Kit();
    mountKit.box([carrierX, -4.4, carrierZ], [.12, 3.50, .13], 0xc2c8b7, [0, 0, 0], false);
    for (const y of [-2.93, -3.91, -4.92, -5.89]) {
        const angle = Math.PI + Math.asin(-carrierX / radius(y));
        const embedded = surface(angle, y, -.025), shoe = surface(angle, y, .018);
        mountKit.box(shoe, [.22, .22, .105], 0xb5bdad, [0, angle, 0], false);
        mountKit.rod(embedded, [carrierX, y, carrierZ], .051, silver);
        mountKit.cylinder([carrierX, y, carrierZ - .073], .025, .016, 0x747d70);
    }
    // Paired triangular webs project from the fixed carrier into two compact hinge bearing blocks.
    const web = new THREE.Shape(); web.moveTo(0, -.22); web.lineTo(0, .22); web.lineTo(.43, 0); web.closePath();
    const webGeometry = new THREE.ExtrudeGeometry(web, { depth: .045, bevelEnabled: false }).rotateY(Math.PI / 2);
    for (const y of [-3.04, -5.76]) {
        mountKit.box([carrierX, y, 28.835], [.35, .40, .105], 0xbac1b1, [0, 0, 0], false);
        for (const side of [-1, 1]) mountKit.add(webGeometry, material(0xb8c0ae, .69, .27), [carrierX + side * .125 - .0225, y, 28.88], [1, 1, 1], [0, 0, 0], false);
        mountKit.box([carrierX, y, hingeZ], [.36, .22, .25], 0xbfc6b7, [0, 0, 0], false);
        mountKit.cylinder([carrierX, y, hingeZ], .124, .30, silver, [0, 0, 0]);
        for (const dy of [-.175, .175]) mountKit.cylinder([carrierX, y + dy, hingeZ], .143, .047, 0x7d8878, [0, 0, 0]);
        for (const dx of [-.125, .125]) mountKit.cylinder([carrierX + dx, y, hingeZ - .136], .027, .02, 0x727d70);
    }
    // Two restrained flexible service loops bridge the fixed carrier and the moving first bay.
    for (const y of [-3.45, -5.30]) for (const dz of [0, .045]) {
        const points = [[carrierX - .025, y, 28.76 + dz], [carrierX - .12, y - .06, 28.57 + dz], [carrierX - .13, y - .20, 28.30 + dz], [carrierX - .34, y - .22, 28.28 + dz], [carrierX - .42, y - .06, 28.41 + dz]];
        mountKit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 32, .017, 7, false), material(0xbfc5b9, .79, .14), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
        mountKit.box(points[0], [.12, .10, .10], silver, [0, 0, 0], false);
        mountKit.box(points[4], [.12, .10, .10], silver, [0, 0, 0], false);
    }
    mountKit.finish(carrierGroup);
    // Small outboard service fittings visible on the reference's final bay.
    for (const x of [2.25, 3.08]) radiatorKit.box([x, 1.70, .045], [.20, .22, .16], 0x747d70, [0, 0, 0], false);
    for (const y of [-.65, .35]) radiatorKit.box([1.58, y, -.066], [.16, .075, .075], 0xb29f78, [0, 0, 0], false);
    radiatorKit.finish(radiatorGroup);
    group.userData.relocatedRadiator = { center: radiatorCenter, size: [radiatorWidth, radiatorHeight, .075], bayCount: 3, bayWidth, gap, normal: [0, 0, 1], solarArrayNormal: [0, 0, -1], parallelToSolarArrays: true, hingeAxis: [0, 1, 0], mount: 'exposed front corridor below black hood, as marked by the user', root: [-.46, -4.4, 28.45], extensionDirection: [-1, 0, 0], carrierPosition: [-.46, -4.4, 28.82], triangularClevisCount: 2, carrierFootCount: 4, reference: '2026-09-30 22:38 marked correction and 22:29 hinge reference', dimensionsAreReferenceProportions: true, widthToHullDiameter: 7.2 / 4.2, heightToHullDiameter: 3.2 / 4.2 };
    // A short saddle carries the inherited ERA root from the narrower service barrel.
    kit.box([1.81, -7.1, 31], [.57, .65, .68], silver, [0, 0, 0], false);
    group.userData.referenceViews = 2; group.userData.hullProfile = profile; group.userData.radiatorPanels = 4; group.userData.louveredPanel = true; group.userData.solarBaysPerWing = 6; group.userData.solarWingRootY = -6.7; group.userData.lowerInterface = [0, -10.43, 31]; group.userData.eraPosePreserved = true;
    // ESA: two insulated limbs, seven joints and interchangeable end effectors.
    // Folded outboard and beneath Nauka's array plane to avoid hull intersections.
    group.userData.eraJoints = 7;
    const eraJoints = [[2.4, -7.1, 31], [2.8, -7.1, 31], [3.1, -7.55, 31], [6.2, -10.4, 31], [9.0, -7.4, 31], [9.2, -6.95, 31], [9.65, -6.95, 31]];
    kit.box([2.10, -7.1, 31], [.23, .84, .92], palette.silver);
    kit.cylinder([2.19, -7.1, 31], .33, .35, palette.white, [0, 0, Math.PI / 2]);
    ring(kit, [2.4, -7.1, 31], .28, 'x', palette.dark, .045);
    eraJoints.forEach((joint, index) => {
        const rotation = index === 3 ? [Math.PI / 2, 0, 0] : index % 2 ? [0, 0, 0] : [0, 0, Math.PI / 2];
        kit.cylinder(joint, .235, .36, palette.white, rotation);
        kit.cylinder(joint, .247, .07, palette.dark, rotation);
        if (index < eraJoints.length - 1) {
            const next = eraJoints[index + 1];
            kit.rod(joint, next, .135, palette.white);
            if (index === 2 || index === 3) {
                // Narrow wrap bands read as insulation seams without extra meshes.
                for (const fraction of [.10, .27, .44, .61, .78, .92]) {
                    const a = joint.map((value, axis) => THREE.MathUtils.lerp(value, next[axis], fraction));
                    const b = joint.map((value, axis) => THREE.MathUtils.lerp(value, next[axis], fraction + .018));
                    kit.rod(a, b, .143, palette.silver);
                }
                const railA = joint.map((value, axis) => THREE.MathUtils.lerp(value, next[axis], .29));
                const railB = joint.map((value, axis) => THREE.MathUtils.lerp(value, next[axis], .66));
                const raisedA = [railA[0], railA[1], railA[2] + .29];
                const raisedB = [railB[0], railB[1], railB[2] + .29];
                kit.rod(railA, raisedA, .025, palette.gold);
                kit.rod(railB, raisedB, .025, palette.gold);
                kit.rod(raisedA, raisedB, .032, palette.gold);
                kit.rod([joint[0], joint[1], joint[2] - .145], [next[0], next[1], next[2] - .145], .018, palette.dark);
            }
        }
    });
    // Identical barrel-shaped interfaces at the base and free wrist.
    for (const [x, y] of [[2.40, -7.1], [9.90, -6.95]]) {
        kit.cylinder([x, y, 31], .27, .42, palette.white, [0, 0, Math.PI / 2]);
        const faceX = x < 3 ? x - .24 : x + .24;
        kit.cylinder([faceX, y, 31], .20, .045, palette.dark, [0, 0, Math.PI / 2]);
        ring(kit, [faceX, y, 31], .24, 'x', palette.silver, .035);
        for (const side of [-1, 1]) kit.box([x, y + side * .25, 31], [.19, .075, .14], palette.silver);
    }
    for (const [x, y] of [[2.88, -7.12], [6.2, -10.4], [9.25, -6.95]]) {
        kit.box([x, y, 31.34], [.32, .25, .28], palette.white);
        kit.cylinder([x, y, 31.51], .09, .10, palette.dark);
        kit.cylinder([x, y, 31.57], .063, .025, palette.glass);
        kit.box([x + .22, y, 31.38], [.13, .17, .18], palette.silver);
    }
});
