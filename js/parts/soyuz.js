// Soyuz spacecraft.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { Kit, material, shapes } from '../core/kit.js';
import { part, ring } from '../core/station.js';

// Soyuz reconstructed only from the two supplied spacecraft images.
// The existing Zvezda connection is retained; the probe is seated in the docked collar.
part('soyuz', 'Soyuz spacecraft', '18 / VISITING SPACECRAFT', 'A rounded orbital compartment and bell-shaped descent capsule are wrapped in dark thermal blankets. A white aft skirt, green optical mast, external harnesses and two narrow, cross-braced solar wings follow the supplied reference images. Shown connected to Zvezda; small fittings and hidden aft details are illustrative.', [['Crew seats', '3'], ['Main sections', 'Orbital · descent · service']], [0, 1, 45.6], (kit, group) => {
    group.userData.detailPass = 'two-user-images-only';
    group.userData.referenceViews = 2;
    group.userData.blanketFinish = 'Charcoal woven insulation with gathered seams';
    group.userData.solarWings = 2; group.userData.solarBaysPerWing = 4;
    group.userData.solarWingRootZ = 46.92;
    group.userData.dockingCollarRadius = .77 + .044;
    group.userData.dockingProbePose = 'Seated inside the existing docked collar';
    group.userData.greenOpticalMast = true;
    const dark = 0x292c31, seam = 0x505359, silver = 0xc0c8c9, white = 0xe7e9e3;
    const olive = 0x696947, copper = 0x866947, green = 0x315d3a;
    const smallSphere = new THREE.SphereGeometry(1, 10, 8);
    const bead = (point, scale, color) => kit.add(smallSphere, material(color), point, scale, [0, 0, 0], false);
    const polar = (angle, radius, z) => [Math.cos(angle) * radius, Math.sin(angle) * radius, z];
    function pipe(points, radius, color) {
        kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(12, points.length * 3), radius, 6, false), material(color, .88, .08), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    // Fine woven surface and low relief folds replace the former tan shell.
    const clothCanvas = document.createElement('canvas'); clothCanvas.width = 1024; clothCanvas.height = 512;
    const clothContext = clothCanvas.getContext('2d'); clothContext.fillStyle = '#414348'; clothContext.fillRect(0, 0, 1024, 512);
    for (let y = 0; y < 512; y += 2)for (let x = 0; x < 1024; x += 2) {
        const n = (x * 17 + y * 31) % 19, v = 54 + n;
        clothContext.fillStyle = `rgb(${v},${v + 2},${v + 6})`; clothContext.fillRect(x, y, 1.5, 1.5);
    }
    for (let fold = 0; fold < 28; fold++) {
        const x = fold * 1024 / 28;
        clothContext.strokeStyle = fold % 2 ? '#55575b88' : '#25272b88'; clothContext.lineWidth = 1.3;
        clothContext.beginPath(); clothContext.moveTo(x, 0); clothContext.bezierCurveTo(x + 22, 150, x - 18, 320, x + 3, 512); clothContext.stroke();
    }
    const clothMap = new THREE.CanvasTexture(clothCanvas); clothMap.colorSpace = THREE.SRGBColorSpace; clothMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const cloth = material(0xffffff, .97, .015, clothMap);
    const bumpCanvas = document.createElement('canvas'); bumpCanvas.width = 256; bumpCanvas.height = 256;
    const bc = bumpCanvas.getContext('2d'); bc.fillStyle = '#808080'; bc.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 2)for (let x = 0; x < 256; x += 2) { const v = 90 + (x * 11 + y * 19) % 70; bc.fillStyle = `rgb(${v},${v},${v})`; bc.fillRect(x, y, 1, 1); }
    cloth.bumpMap = new THREE.CanvasTexture(bumpCanvas); cloth.bumpScale = .012;
    function insulatedHull(z0, z1, radiusAt, gather = 1) {
        const pos = [], uv = [], indices = [], around = 160, along = 64;
        for (let j = 0; j <= along; j++)for (let i = 0; i <= around; i++) {
            const a = i / around * Math.PI * 2, t = j / along, z = z0 + (z1 - z0) * t;
            const ripple = (.007 * Math.sin(a * 31 + 4.8 * t + 1.5 * Math.sin(t * 7 + a * 3)) + .003 * Math.sin(a * 47 - 3 * Math.sin(t * 5 + a * 2))) * Math.sin(Math.PI * t) * gather;
            pos.push(...polar(a, radiusAt(z) + ripple, z)); uv.push(i / around, t);
        }
        for (let j = 0; j < along; j++)for (let i = 0; i < around; i++) {
            const a = j * (around + 1) + i, b = a + around + 1; indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
        const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geom.setIndex(indices); geom.computeVertexNormals();
        // Join the shading normals across the cloth texture's wrap seam.
        const normals = geom.attributes.normal;
        for (let j = 0; j <= along; j++) {
            const a = j * (around + 1), b = a + around, n = new THREE.Vector3().fromBufferAttribute(normals, a).add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize();
            normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(b, n.x, n.y, n.z);
        }
        kit.add(geom, cloth, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    const orbitalRadius = z => 1.29 * Math.sqrt(Math.max(0, 1 - ((z - 43.05) / 1.29) ** 2));
    const descentProfile = [[44.12, .59], [44.28, .71], [44.52, .91], [44.85, 1.10], [45.20, 1.23], [45.64, 1.29], [45.99, 1.275], [46.12, 1.24]];
    function descentRadius(z) { let i = descentProfile.findIndex(p => p[0] >= z); i = Math.max(1, i < 0 ? descentProfile.length - 1 : i); const a = descentProfile[i - 1], b = descentProfile[i]; return THREE.MathUtils.lerp(a[1], b[1], THREE.MathUtils.clamp((z - a[0]) / (b[0] - a[0]), 0, 1)); }
    insulatedHull(41.99, 44.18, orbitalRadius, .65);
    insulatedHull(44.12, 46.12, descentRadius, 1.55);
    // Gathered fabric gores and overlapping stitched blanket edges.
    for (let gore = 0; gore < 12; gore++) {
        const a = gore * Math.PI / 6, points = [];
        for (let i = 0; i <= 24; i++) { const z = 42.08 + i * 2.01 / 24; points.push(polar(a + .022 * Math.sin(i * .27), orbitalRadius(z) + .012, z)); }
        pipe(points, .009, 0x55575b);
    }
    for (let gore = 0; gore < 18; gore++) {
        const a = gore * Math.PI / 9, points = [];
        for (let i = 0; i <= 24; i++) { const z = 44.22 + i * 1.82 / 24; points.push(polar(a + .025 * Math.sin(i * .19), descentRadius(z) + .017, z)); }
        pipe(points, .010, gore % 3 === 0 ? 0x5c5b57 : 0x33363a);
    }
    ring(kit, [0, 0, 44.18], .635, 'z', 0x504d45, .023);
    ring(kit, [0, 0, 46.105], 1.265, 'z', 0x646760, .033);
    // Hollow docking collar stays within the already fitted Zvezda bore.
    const collarMat = material(0x8f9899, .49, .56).clone(); collarMat.side = THREE.DoubleSide;
    kit.add(new THREE.CylinderGeometry(.73, .73, 1.04, 48, 1, true), collarMat, [0, 0, 41.60], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    for (const z of [41.14, 41.34, 41.93]) ring(kit, [0, 0, z], .77, 'z', silver, .044);
    ring(kit, [0, 0, 41.24], .73, 'z', dark, .031);
    // Bolted annular docking face, shield brackets and the central probe assembly.
    const annulus = material(0xaeb8b6, .49, .52).clone(); annulus.side = THREE.DoubleSide;
    kit.add(new THREE.RingGeometry(.55, .91, 64), annulus, [0, 0, 42.018], [1, 1, 1], [0, Math.PI, 0], false);
    ring(kit, [0, 0, 42.03], .905, 'z', dark, .039); ring(kit, [0, 0, 42.006], .576, 'z', silver, .024);
    for (let latch = 0; latch < 8; latch++) {
        const a = latch * Math.PI / 4;
        kit.box(polar(a, .875, 42.09), [.17, .13, .23], dark, [0, 0, a], false);
        kit.cylinder(polar(a, .812, 41.995), .033, .041, silver);
        kit.box(polar(a, .615, 41.99), [.12, .12, .10], white, [0, 0, a], false);
    }
    kit.cylinder([0, 0, 41.97], .30, .23, 0xb9c2c4);
    kit.add(new THREE.CylinderGeometry(.13, .29, .27, 24), material(silver, .36, .61), [0, 0, 41.73], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    kit.cylinder([0, 0, 41.435], .072, .33, silver);
    kit.cylinder([0, 0, 41.225], .09, .09, dark);
    for (const side of [-1, 1]) kit.rod([side * .10, 0, 41.20], [side * .16, 0, 41.12], .027, dark);
    // Orbital side hatch: a dark cover, pale rim and a separate small viewing window.
    kit.cylinder([0, 1.238, 43.26], .43, .075, dark, [0, 0, 0]); ring(kit, [0, 1.285, 43.26], .43, 'y', silver, .022);
    kit.cylinder([0, 1.287, 43.26], .391, .023, 0x32353a, [0, 0, 0]);
    kit.rod([-.19, 1.318, 43.18], [.19, 1.318, 43.18], .017, 0x777e7e);
    for (const side of [-1, 1]) {
        kit.cylinder([side * 1.235, -.13, 43.03], .158, .062, 0x9caaa9, [0, 0, Math.PI / 2]);
        kit.cylinder([side * 1.274, -.13, 43.03], .126, .026, 0x0f2532, [0, 0, Math.PI / 2]);
        ring(kit, [side * 1.291, -.13, 43.03], .127, 'x', dark, .014);
    }
    // A second window sits in the descent capsule's cloth-covered wall.
    const wa = -.20, wz = 45.17, wr = descentRadius(wz);
    const windowGroup = new THREE.Group(), wk = new Kit();
    wk.cylinder([0, 0, 0], .164, .062, 0x8d8070); wk.cylinder([0, 0, -.041], .126, .025, 0x102332); ring(wk, [0, 0, -.058], .14, 'z', silver, .018);
    wk.finish(windowGroup); windowGroup.position.fromArray(polar(wa, wr + .025, wz)); windowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(Math.cos(wa), Math.sin(wa), 0)); group.add(windowGroup);
    // A stitched rectangular parachute cover follows the capsule side.
    const coverAngle = -1.0, cover = [];
    for (const [a, z] of [[coverAngle - .30, 44.87], [coverAngle + .30, 44.87], [coverAngle + .30, 45.63], [coverAngle - .30, 45.63], [coverAngle - .30, 44.87]]) cover.push(polar(a, descentRadius(z) + .025, z));
    pipe(cover, .014, 0x6f7066);
    // Close-fitting dark service band; no exposed long inter-module spacer.
    insulatedHull(46.12, 46.86, z => THREE.MathUtils.lerp(1.255, 1.32, (z - 46.12) / .74), .35);
    for (const z of [46.15, 46.71, 46.84]) ring(kit, [0, 0, z], z > 46.8 ? 1.33 : 1.28, 'z', z > 46.8 ? dark : 0x646c69, .024);
    // White aft shell, a broad unbroken skin with a dark end rim.
    const skirt = [[1.31, 46.84], [1.40, 46.98], [1.43, 47.15], [1.39, 47.83], [1.30, 48.23]];
    kit.add(new THREE.LatheGeometry(skirt.map(([r, z]) => new THREE.Vector2(r, z)), 64), material(0xeff0e9, .85, .07), [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    kit.cylinder([0, 0, 48.235], 1.30, .048, white); ring(kit, [0, 0, 48.263], 1.30, 'z', dark, .057);
    for (let panel = 0; panel < 12; panel++) {
        const a = panel * Math.PI / 6; kit.line([polar(a, 1.435, 47.15), polar(a, 1.396, 47.83), polar(a, 1.305, 48.19)]);
        for (const z of [47.24, 47.86]) bead(polar(a, z < 47.5 ? 1.426 : 1.389, z), [.020, .020, .020], 0xb3bdb6);
    }
    // Olive exterior cable runs, retaining straps and the green optical mast.
    for (const side of [-1, 1]) {
        const path = [[side * .19, .66, 44.23], [side * .35, 1.03, 44.62], [side * .43, 1.35, 45.12], [side * .45, 1.46, 45.80], [side * .40, 1.38, 46.26], [side * .25, 1.33, 46.62]];
        pipe(path, .044, olive);
        for (const i of [1, 3, 4]) kit.box(path[i], [.12, .11, .08], copper, [0, 0, 0], false);
    }
    kit.add(new THREE.CylinderGeometry(.15, .15, 1.11, 16), material(0x77724d, .97, .02), [.38, 1.37, 45.92], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    for (const z of [45.46, 46.04, 46.38]) ring(kit, [.38, 1.37, z], .154, 'z', copper, .021);
    kit.box([-.28, 1.275, 45.84], [.31, .12, .47], olive, [0, 0, 0], false);
    kit.cylinder([-.28, 1.415, 45.84], .165, .17, green, [0, 0, 0]);
    kit.cylinder([-.28, 1.70, 45.84], .077, .45, green, [0, 0, 0]);
    for (const y of [1.49, 1.73, 1.91]) ring(kit, [-.28, y, 45.84], .095, 'y', 0x9baf91, .016);
    kit.box([-.28, 2.015, 45.84], [.245, .235, .25], green, [0, 0, 0], false);
    kit.cylinder([-.28, 2.015, 45.699], .066, .028, 0x12251a); ring(kit, [-.28, 2.015, 45.682], .067, 'z', silver, .011);
    kit.cylinder([-.417, 2.015, 45.84], .045, .024, dark, [0, 0, Math.PI / 2]);
    // Copper handrails and compact connector clusters around the instrument band.
    for (const angle of [.40, 2.48]) {
        const p = []; for (const [a, z] of [[angle, 46.72], [angle, 46.20], [angle + .30, 46.20], [angle + .30, 46.63]]) p.push(polar(a, 1.35, z)); pipe(p, .019, copper);
        for (const z of [46.32, 46.53]) for (const da of [0, .13]) {
            const a = angle + .53 + da; bead(polar(a, 1.335, z), [.045, .045, .045], silver);
        }
    }
    // Four square leaves per wing: pale perimeter frames and visible X braces.
    const cellCanvas = document.createElement('canvas'); cellCanvas.width = 512; cellCanvas.height = 512;
    const cc = cellCanvas.getContext('2d'); cc.fillStyle = '#c1bda6'; cc.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 32; row++)for (let col = 0; col < 24; col++) {
        cc.fillStyle = ['#57594f', '#676857', '#73715d', '#4f544e'][(row * 7 + col * 3) % 4]; cc.fillRect(col * 512 / 24 + 1.2, row * 16 + 1.2, 512 / 24 - 2.4, 13.6);
        cc.fillStyle = '#b3aa86'; cc.fillRect(col * 512 / 24 + 10.1, row * 16 + 1.2, .7, 13.6);
    }
    const cells = new THREE.CanvasTexture(cellCanvas); cells.colorSpace = THREE.SRGBColorSpace; cells.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const cellMat = material(0xffffff, .72, .20, cells), frame = 0xe0e5de, wingZ = 46.92;
    for (const side of [-1, 1]) {
        kit.cylinder([side * 1.45, 0, wingZ], .15, .29, silver, [0, 0, Math.PI / 2]);
        for (const end of [-1, 1]) kit.rod([side * 1.48, 0, wingZ], [side * 1.70, 0, wingZ + end * .655], .037, frame);
        for (let bay = 0; bay < 4; bay++) {
            const x = side * (1.70 + (bay + .5) * 1.24), w = 1.17, d = 1.31;
            kit.box([x, 0, wingZ], [w, .042, d], 0x656658, [0, 0, 0], false);
            for (const face of [-1, 1]) {
                kit.add(new THREE.PlaneGeometry(w - .035, d - .035), cellMat, [x, face * .023, wingZ], [1, 1, 1], [-face * Math.PI / 2, 0, 0], false);
                for (const diagonal of [-1, 1]) kit.rod([x - w * .48, face * .052, wingZ - diagonal * d * .48], [x + w * .48, face * .052, wingZ + diagonal * d * .48], .016, frame);
                kit.rod([x - w * .48, face * .079, wingZ], [x + w * .48, face * .079, wingZ], .022, frame);
                kit.add(shapes.lowCylinder, material(frame), [x, face * .079, wingZ], [.045, .15, .045], [0, 0, Math.PI / 2], false);
            }
            for (const end of [-1, 1]) {
                kit.box([x + end * w / 2, 0, wingZ], [.044, .12, d + .075], frame, [0, 0, 0], false);
                kit.box([x, 0, wingZ + end * d / 2], [w, .12, .044], frame, [0, 0, 0], false);
                kit.cylinder([side * (1.70 + bay * 1.24), 0, wingZ + end * .43], .050, .14, silver);
            }
        }
    }
    // Dish antennas and white sensor caps around the orbital docking end.
    function dish(center, direction, radius) {
        const n = new THREE.Vector3(...direction).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        const geom = new THREE.LatheGeometry([[0, 0], [radius * .40, .018], [radius * .72, .047], [radius, .085]].map(([r, z]) => new THREE.Vector2(r, z)), 24).applyQuaternion(q);
        const face = material(0xe0e3db, .69, .20).clone(); face.side = THREE.DoubleSide; kit.add(geom, face, center, [1, 1, 1], [0, 0, 0], false);
        const a = new THREE.Vector3(...center), b = a.clone().addScaledVector(n, .13); kit.rod(a.toArray(), b.toArray(), .014, silver); bead(b.toArray(), [.025, .025, .025], dark);
    }
    for (const side of [-1, 1]) {
        kit.rod([side * .89, .20, 42.31], [side * 1.44, .34, 42.38], .029, silver);
        dish([side * 1.44, .34, 42.38], [side * .72, .10, -.7], .235);
        kit.box([side * .89, .20, 42.34], [.18, .18, .30], dark, [0, 0, 0], false);
    }
    kit.rod([.36, 1.05, 42.54], [.64, 1.44, 42.52], .026, silver);
    kit.box([.64, 1.40, 42.52], [.28, .22, .25], white, [.3, 0, .2], false);
    dish([.64, 1.59, 42.49], [.15, .55, -.84], .19);
    kit.rod([-.45, -.97, 42.24], [-.62, -1.45, 42.12], .025, silver); dish([-.62, -1.45, 42.12], [0, -.45, -1], .18);
    for (const [a, z] of [[.66, 42.51], [2.35, 42.67], [4.05, 42.53]]) bead(polar(a, orbitalRadius(z) + .045, z), [.115, .115, .115], white);
    // Short service-skirt fittings visible in the reference; no oversized engine extension.
    for (const angle of [.58, 2.54, 3.73, 5.70]) {
        const n = new THREE.Vector3(Math.cos(angle), Math.sin(angle), .12).normalize();
        const nozzle = new THREE.CylinderGeometry(.085, .05, .16, 12, 1, true).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
        kit.add(nozzle, material(silver, .52, .48), polar(angle, 1.375, 47.90), [1, 1, 1], [0, 0, 0], false);
        bead(polar(angle, 1.34, 47.87), [.10, .10, .10], white);
    }
    kit.cylinder([0, 0, 48.286], .38, .045, dark); ring(kit, [0, 0, 48.315], .38, 'z', silver, .020);
    kit.rod([.30, -1.27, 48.07], [.32, -1.57, 48.39], .026, green);
    // Only legible markings in the reference are reproduced: Soyuz and the tricolor.
    const patchCanvas = document.createElement('canvas'); patchCanvas.width = 512; patchCanvas.height = 256;
    const pc = patchCanvas.getContext('2d'); pc.fillStyle = '#e5e6df'; pc.fillRect(0, 0, 512, 256);
    pc.fillStyle = '#b33132'; pc.font = 'bold 76px sans-serif'; pc.textAlign = 'center'; pc.fillText('СОЮЗ', 256, 86);
    for (const [i, color] of ['#ffffff', '#285895', '#b43b3c'].entries()) { pc.fillStyle = color; pc.fillRect(158, 119 + i * 31, 196, 31); }
    const label = new THREE.CanvasTexture(patchCanvas); label.colorSpace = THREE.SRGBColorSpace;
    const pp = [], pu = []; for (let j = 0; j < 8; j++)for (let i = 0; i < 12; i++)for (const [ii, jj] of [[i, j], [i + 1, j], [i, j + 1], [i, j + 1], [i + 1, j], [i + 1, j + 1]]) {
        const a = 2.02 + ii / 12 * .51, z = 42.87 + jj / 8 * .45; pp.push(...polar(a, orbitalRadius(z) + .025, z)); pu.push(ii / 12, jj / 8);
    }
    const patchGeom = new THREE.BufferGeometry(); patchGeom.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); patchGeom.setAttribute('uv', new THREE.Float32BufferAttribute(pu, 2)); patchGeom.computeVertexNormals();
    kit.add(patchGeom, material(0xffffff, .91, .02, label), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
});
