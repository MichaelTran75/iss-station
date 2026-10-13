// Poisk / MRM-2 airlock.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { material, shapes, vertical } from '../core/kit.js';
import { part, parts, ring } from '../core/station.js';

part('poisk', 'Poisk / MRM-2 airlock', '22 / RUSSIAN AIRLOCK & RESEARCH', 'Poisk is attached to the space-facing port of Zvezda. Its rounded, blanket-covered body carries two side EVA hatches, exterior handrails and dish antennas. The outward docking end includes a recessed collar, central probe and perimeter fittings. Equipment placement and dimensions are illustrative.', [['Installed', '12 NOV 2009'], ['Length / diameter', '4.9 / 2.55 m']], [0, 3.9, 31], (kit, group) => {
    group.userData.attachment = 'Zvezda zenith';
    group.userData.evaHatches = 2;
    group.userData.referenceViews = 2;
    group.userData.reconstruction = '2026-09-30 supplied Poisk front and docking-end references';
    group.userData.interfaceCenter = [0, 1.30, 31];
    // All geometry remains in the original station frame. The probe points away from Zvezda.
    const silver = 0xb5bab7, white = 0xe0e2dc, dark = 0x434746, rail = 0xaaa791, ochre = 0xa77331;
    const metal = material(silver, .51, .55), hardware = material(0x7b8381, .58, .43);
    const profile = [[.73, 1.72], [.76, 1.91], [.91, 2.10], [1.045, 2.27], [1.065, 2.48], [1.065, 3.02], [1.105, 3.24], [1.20, 3.52], [1.273, 3.86], [1.275, 4.18], [1.24, 4.63], [1.14, 5.05], [.98, 5.40], [.78, 5.70]];
    function radiusAt(y) {
        const i = Math.max(1, profile.findIndex(p => p[1] >= Math.min(y, 5.70))), a = profile[i - 1], b = profile[i];
        const t = THREE.MathUtils.clamp((y - a[1]) / (b[1] - a[1]), 0, 1), s = t * t * (3 - 2 * t);
        return a[0] + (b[0] - a[0]) * s;
    }
    const point = (a, y, lift = 0) => [Math.cos(a) * (radiusAt(y) + lift), y, 31 + Math.sin(a) * (radiusAt(y) + lift)];
    function pipe(points, r = .016, color = rail) {
        kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(20, points.length * 5), r, 6, false), material(color, .66, .3), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    function arc(y, r, a0, a1, tube = .018, color = rail) {
        pipe(Array.from({ length: 33 }, (_, i) => { const a = a0 + (a1 - a0) * i / 32; return [r * Math.cos(a), y, 31 + r * Math.sin(a)]; }), tube, color);
    }
    // Self-contained, deterministic crinkled MLI maps, scoped to Poisk materials.
    const clothCanvas = document.createElement('canvas'); clothCanvas.width = clothCanvas.height = 512;
    const ctx = clothCanvas.getContext('2d'), pixels = ctx.createImageData(512, 512);
    const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7 + 73.9) * 43758.5453; return v - Math.floor(v); };
    function noise(x, y, s) { const xx = x / s, yy = y / s, ix = Math.floor(xx), iy = Math.floor(yy), fx = xx - ix, fy = yy - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v); }
    for (let y = 0; y < 512; y++)for (let x = 0; x < 512; x++) {
        const warp = noise(x, y, 45) * 22, n = noise(x + warp, y - warp, 11), crease = Math.pow(1 - Math.abs(n * 2 - 1), 12);
        const value = 220 + (noise(x, y, 60) - .5) * 12 + (noise(x, y, 4) - .5) * 8 - crease * 27 + hash(x, y) * 3, i = (y * 512 + x) * 4;
        pixels.data[i] = value; pixels.data[i + 1] = value + 2; pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    for (let i = 0; i < 1450; i++) {
        const x = hash(i, 11) * 512, y = hash(i, 19) * 512, len = 4 + hash(i, 29) * 20, a = hash(i, 41) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a + .35) * len * .45, y + Math.sin(a + .35) * len * .45); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.strokeStyle = 'rgba(103,111,106,.18)'; ctx.lineWidth = .65; ctx.stroke();
        ctx.translate(.8, .8); ctx.strokeStyle = 'rgba(255,255,250,.33)'; ctx.stroke(); ctx.translate(-.8, -.8);
    }
    const clothMap = new THREE.CanvasTexture(clothCanvas); clothMap.colorSpace = THREE.SRGBColorSpace; clothMap.wrapS = clothMap.wrapT = THREE.RepeatWrapping; clothMap.repeat.set(3, 2); clothMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const bumpMap = clothMap.clone(); bumpMap.colorSpace = THREE.NoColorSpace; bumpMap.needsUpdate = true;
    const blanket = new THREE.MeshStandardMaterial({ color: 0xf3f4ed, map: clothMap, bumpMap, bumpScale: .030, roughness: .89, metalness: .13 });
    const panel = blanket.clone(); panel.map = clothMap.clone(); panel.map.repeat.set(.65, .65); panel.map.needsUpdate = true; panel.bumpMap = bumpMap.clone(); panel.bumpMap.repeat.set(.65, .65); panel.bumpMap.needsUpdate = true; panel.bumpScale = .014;
    const pos = [], uv = [], idx = [], around = 128, along = 104;
    for (let j = 0; j <= along; j++)for (let i = 0; i <= around; i++) {
        const t = j / along, y = 1.72 + (5.70 - 1.72) * t, a = i / around * Math.PI * 2;
        const wrinkle = (.006 * Math.sin(a * 37 + Math.sin(t * 22) * 2) + .003 * Math.sin(a * 61 - t * 33)) * Math.sin(Math.PI * t);
        const r = radiusAt(y) + wrinkle; pos.push(Math.cos(a) * r, y, 31 + Math.sin(a) * r); uv.push(i / around, t);
    }
    for (let j = 0; j < along; j++)for (let i = 0; i < around; i++) { const a = j * (around + 1) + i, b = a + around + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const shell = new THREE.BufferGeometry(); shell.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); shell.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); shell.setIndex(idx); shell.computeVertexNormals();
    const normals = shell.attributes.normal;
    for (let j = 0; j <= along; j++) { const a = j * (around + 1), b = a + around, n = new THREE.Vector3().fromBufferAttribute(normals, a).add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize(); normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(b, n.x, n.y, n.z); }
    kit.add(shell, blanket, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    // Broad docking flange seats directly on the matching Zvezda zenith flange at y = 1.30.
    kit.cylinder([0, 1.335, 31], .90, .07, silver, [0, 0, 0]);
    kit.cylinder([0, 1.565, 31], .78, .39, silver, [0, 0, 0]);
    ring(kit, [0, 1.365, 31], .896, 'y', white, .014);
    group.userData.serviceModuleFace = {axis: 'y', coordinate: 1.30, radius: .90};
    kit.add(new THREE.CylinderGeometry(.765, .765, .26, 64), panel, [0, 1.77, 31], [1, 1, 1], [0, 0, 0], false);
    for (const y of [1.655, 1.895]) ring(kit, [0, y, 31], .775, 'y', silver, .021);
    // Sparse stitched blanket boundaries; no rigid tile grid over the pressure hull.
    for (const y of [2.17, 3.13, 4.62, 5.53]) arc(y, radiusAt(y) + .009, 0, Math.PI * 2, .008, 0xc4c8c1);
    for (const a of [.45, 1.72, 2.55, 3.96, 5.22]) pipe(profile.map(([, y]) => point(a, y, .012)), .006, 0xbcc1b9);
    // A local tangent frame: +v follows the upside-down elevation reference, +w faces outwards.
    function frame(a, y, r = radiusAt(y)) {
        const n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), u = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), v = new THREE.Vector3(0, -1, 0);
        const m = new THREE.Matrix4().makeBasis(u, v, n), rot = new THREE.Euler().setFromRotationMatrix(m);
        const base = new THREE.Vector3(Math.cos(a) * r, y, 31 + Math.sin(a) * r);
        return { p: (x, z, w = 0) => base.clone().addScaledVector(u, x).addScaledVector(v, z).addScaledVector(n, w).toArray(), rot: [rot.x, rot.y, rot.z] };
    }
    function localBox(f, p, size, surface = metal) { kit.add(shapes.box, surface, f.p(...p), size, f.rot, false); }
    function localDisc(f, p, r, depth, surface) { const g = new THREE.CylinderGeometry(r, r, depth, 64).rotateX(Math.PI / 2); kit.add(g, surface, f.p(...p), [1, 1, 1], f.rot, false); }
    function localRing(f, p, r, tube, surface = metal) { kit.add(new THREE.TorusGeometry(r, tube, 8, 72), surface, f.p(...p), [1, 1, 1], f.rot, false); }
    function label(f, text, p, w, h, color = '#bb892e', turn = 0) {
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128; const c = canvas.getContext('2d'); c.font = '600 100px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color; c.translate(256, 66); c.scale(472 / Math.max(1, c.measureText(text).width), 1); c.fillText(text, 0, 0);
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const ink = new THREE.MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, roughness: .95, polygonOffset: true, polygonOffsetFactor: -2 }); ink.userData.decal = true; kit.add(new THREE.PlaneGeometry(w, h).rotateZ(turn), ink, f.p(...p), [1, 1, 1], f.rot, false);
    }
    for (const [a, name] of [[Math.PI, 'ВЛ2'], [0, 'ВЛ1']]) {
        const f = frame(a, 3.91, 1.238);
        localDisc(f, [0, 0, .025], .566, .10, hardware); localRing(f, [0, 0, .084], .554, .019, metal);
        localDisc(f, [0, 0, .087], .529, .026, panel);
        // Centered pale inspection cover as visible in the reference, with concentric inset rings.
        localDisc(f, [0, 0, .109], .171, .018, metal); localDisc(f, [0, 0, .121], .142, .013, material(0xc4c8c4, .83, .09));
        localRing(f, [0, 0, .127], .147, .012, material(0x909794, .8, .18));
        for (const x of [-.59, .59]) {
            for (const v of [-.17, .17]) localBox(f, [x, v, .075], [.08, .055, .09]);
            kit.rod(f.p(x, -.17, .13), f.p(x, .17, .13), .018, silver);
        }
        for (const v of [-.31, .31]) { kit.rod(f.p(-.085, v, .14), f.p(.085, v, .14), .016, silver); for (const x of [-.085, .085]) kit.rod(f.p(x, v, .11), f.p(x, v, .14), .013, silver); }
        for (const sign of [-1, 1]) {
            const pts = Array.from({ length: 21 }, (_, i) => { const t = (28 + i * 6.2) * Math.PI / 180; return f.p(.64 * Math.cos(t), sign * .64 * Math.sin(t), .11); }); pipe(pts, .018, rail);
            for (const x of [-.33, .33]) kit.rod(f.p(x, sign * .49, .03), f.p(x, sign * .555, .115), .018, silver);
        }
        label(f, name, [-.34, 0, .13], .37, .145, '#be8626', Math.PI / 2);
    }
    // Reference-facing rectangular patches and round equipment covers.
    const front = frame(Math.PI, 3.91, 1.238), neck = frame(Math.PI, 2.72, 1.062);
    localBox(neck, [.30, 0, .02], [.72, .84, .055], hardware); localBox(neck, [.30, 0, .056], [.686, .802, .028], panel);
    localDisc(neck, [-.44, .07, .020], .235, .050, material(0x575c59, .88, .10)); localRing(neck, [-.44, .07, .049], .228, .012, hardware);
    for (const [a, y, r] of [[Math.PI + .70, 3.70, .26], [Math.PI - .70, 3.98, .23], [.78, 4.36, .18], [4.79, 3.42, .16]]) { const f = frame(a, y, radiusAt(y) - .015); localDisc(f, [0, 0, .026], r, .07, panel); localRing(f, [0, 0, .06], r - .01, .008, material(0xc4c8c2, .8, .18)); }
    const lower = frame(Math.PI, 4.94, radiusAt(4.94)); localBox(lower, [-.35, 0, .035], [1.07, .26, .055], hardware); localBox(lower, [-.35, 0, .069], [1.04, .225, .018], panel);
    const heel = frame(Math.PI, 5.44, radiusAt(5.44)); localBox(heel, [0, 0, .02], [.48, .22, .045], panel);
    // Slim stand-off rails around three belts, supported by discrete attachment feet.
    for (const [y, r] of [[2.03, .98], [3.14, 1.27], [4.67, 1.40]]) {
        arc(y, r, 0, Math.PI * 2, .016, rail);
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; kit.rod(point(a, y, .005), [Math.cos(a) * r, y, 31 + Math.sin(a) * r], .018, silver); }
    }
    // Curving perimeter cables and triangular blanket brackets, visible in both references.
    for (const a of [Math.PI / 2 - .13, Math.PI / 2 + .13, Math.PI * 1.5 - .13, Math.PI * 1.5 + .13]) {
        const cable = [point(a, 4.66, .11), point(a, 4.95, .34), point(a, 5.35, .29), point(a, 5.65, .10)]; pipe(cable, .012, rail);
    }
    function fin(a, y, extent = .40) {
        const f = frame(a, y, radiusAt(y) - .02), g = new THREE.BufferGeometry();
        const vertices = [...f.p(-.13, -.22, 0), ...f.p(.13, -.22, 0), ...f.p(.13, .16, extent), ...f.p(-.13, .16, extent)];
        g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); const foil = panel.clone(); foil.side = THREE.DoubleSide; kit.add(g, foil, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
        kit.rod(f.p(-.13, .16, extent), f.p(.13, .16, extent), .018, silver); kit.rod(f.p(0, -.22, .02), f.p(0, .16, extent), .020, silver);
    }
    for (const a of [Math.PI / 2, Math.PI * 1.5]) fin(a, 4.64, .36);
    for (const a of [.55, 2.1, 3.8, 5.4]) fin(a, 5.36, .25);
    // Exposed docking ring: ochre recessed bowl, large central probe and radial spring fingers.
    const twoMetal = metal.clone(); twoMetal.side = THREE.DoubleSide;
    kit.add(new THREE.CylinderGeometry(.79, .78, .20, 72, 1, true), panel, [0, 5.72, 31], [1, 1, 1], [0, 0, 0], false);
    kit.add(new THREE.RingGeometry(.555, .80, 80).rotateX(-Math.PI / 2), twoMetal, [0, 5.83, 31], [1, 1, 1], [0, 0, 0], false);
    ring(kit, [0, 5.83, 31], .79, 'y', silver, .024);
    const bowl = new THREE.LatheGeometry([[.22, 5.49], [.32, 5.50], [.46, 5.60], [.56, 5.80], [.555, 5.835]].map(p => new THREE.Vector2(...p)), 80);
    const bowlMat = material(ochre, .71, .34).clone(); bowlMat.side = THREE.DoubleSide; kit.add(bowl, bowlMat, [0, 0, 31], [1, 1, 1], [0, 0, 0], false);
    kit.cylinder([0, 5.50, 31], .25, .035, dark, [0, 0, 0]);
    const probeProfile = [[.19, 5.49], [.29, 5.59], [.315, 5.74], [.27, 5.93], [.21, 6.04], [.18, 6.06], [.155, 6.20], [.113, 6.235], [.107, 6.29], [.077, 6.35], [.025, 6.385], [0, 6.39]];
    kit.add(new THREE.LatheGeometry(probeProfile.map(p => new THREE.Vector2(...p)), 64), material(dark, .63, .40), [0, 0, 31], [1, 1, 1], [0, 0, 0], false);
    ring(kit, [0, 6.235, 31], .11, 'y', silver, .014);
    for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), t = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), vertices = [];
        for (const [r, y, w] of [[.185, 6.045, -.035], [.185, 6.045, .035], [.365, 5.81, .047], [.365, 5.81, -.047]]) vertices.push(n.x * r + t.x * w, y, 31 + n.z * r + t.z * w);
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); const finger = material(0x747b78, .59, .48).clone(); finger.side = THREE.DoubleSide; kit.add(g, finger, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5, r = .682, p = [Math.cos(a) * r, 5.865, 31 + Math.sin(a) * r];
        kit.box(p, [.095, .048, .22], silver, [0, -a, 0], false);
        kit.box([p[0], 5.894, p[2]], [.044, .018, .168], 0x6e7673, [0, -a, 0], false);
        const b = a + .21; kit.cylinder([Math.cos(b) * .766, 5.904, 31 + Math.sin(b) * .766], .025, .125, silver, [0, 0, 0]);
        kit.cylinder([Math.cos(b) * .766, 5.969, 31 + Math.sin(b) * .766], .017, .011, dark, [0, 0, 0]);
    }
    // The neck-end dish, lateral dish and compact aerials reproduce the reference silhouettes.
    function dish(center, normal, radius, gold = false) {
        const n = new THREE.Vector3(...normal).normalize(), q = new THREE.Quaternion().setFromUnitVectors(vertical, n);
        const dishProfile = [[0, 0], [radius * .28, .004], [radius * .55, .018], [radius * .78, .050], [radius, .10 * radius / .35]];
        const g = new THREE.LatheGeometry(dishProfile.map(p => new THREE.Vector2(...p)), 64).applyQuaternion(q);
        const surface = material(gold ? 0xb9a16b : 0xc6cbc6, .61, gold ? .35 : .47).clone(); surface.side = THREE.DoubleSide;
        kit.add(g, surface, center, [1, 1, 1], [0, 0, 0], false);
        const rimDepth = .10 * radius / .35, tip = new THREE.Vector3(...center).addScaledVector(n, rimDepth + .06);
        const ringGeom = new THREE.TorusGeometry(radius, .014, 8, 64).rotateX(Math.PI / 2).applyQuaternion(q);
        kit.add(ringGeom, metal, new THREE.Vector3(...center).addScaledVector(n, rimDepth).toArray(), [1, 1, 1], [0, 0, 0], false);
        for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; const end = new THREE.Vector3(Math.cos(a) * radius, rimDepth, Math.sin(a) * radius).applyQuaternion(q).add(new THREE.Vector3(...center)); kit.rod(end.toArray(), tip.toArray(), .008, silver); }
        kit.rod(center, tip.toArray(), .016, silver);
    }
    const crown = frame(Math.PI, 1.67, .81);
    for (const x of [-.14, .14]) kit.rod(crown.p(x, -.47, -.05), crown.p(x, 0, .15), .024, silver);
    dish(crown.p(0, .02, .19), [-1, 0, 0], .285, true);
    const sideDish = frame(Math.PI * 1.53, 4.88, radiusAt(4.88));
    kit.rod(sideDish.p(0, 0, 0), sideDish.p(.13, -.45, .73), .029, silver);
    dish(sideDish.p(.13, -.45, .73), [-.45, .30, -.84], .36);
    const aftDish = frame(.67, 5.18, radiusAt(5.18));
    kit.rod(aftDish.p(0, 0, 0), aftDish.p(0, .08, .40), .027, silver);
    dish(aftDish.p(0, .08, .40), [.67, .22, .71], .26);
    for (const a of [Math.PI * .52, Math.PI * 1.48]) {
        const f = frame(a, 2.35, radiusAt(2.35));
        localBox(f, [0, 0, .07], [.17, .15, .17]); kit.rod(f.p(0, 0, .12), f.p(0, .09, .84), .015, silver);
        const end = f.p(0, .09, .84); kit.cylinder(end, .075, .10, white, [0, 0, 0]);
        if (a < Math.PI) { kit.rod(f.p(0, .05, .84), f.p(0, .43, .84), .010, silver); kit.rod(f.p(-.13, .08, .84), f.p(.13, .08, .84), .010, silver); }
        else { dish([end[0], end[1] - .055, end[2]], [0, -1, 0], .11); }
    }
    for (const a of [Math.PI * .68, Math.PI * 1.25]) {
        const f = frame(a, 5.15, radiusAt(5.15)); localDisc(f, [0, 0, .09], .14, .025, metal); kit.rod(f.p(0, 0, .10), f.p(0, .025, .36), .040, white); localDisc(f, [0, .025, .37], .047, .04, metal);
    }
    // Narrow longitudinal strap on the lower reference face, with a metal end tab.
    const strap = []; for (let i = 0; i <= 18; i++) { const y = 4.66 + i * .061; strap.push(point(Math.PI - .31, y, .07)); } pipe(strap, .018, rail);
    for (const y of [4.66, 5.75]) { const f = frame(Math.PI - .31, y, radiusAt(Math.min(y, 5.7)) + .04); localBox(f, [0, 0, 0], [.09, .16, .033]); }
    const marks = frame(4.62, 4.25, radiusAt(4.25) + .025);
    label(marks, 'ПОИСК', [0, .05, .03], .72, .19, '#b88524');
    const flagCanvas = document.createElement('canvas'); flagCanvas.width = 384; flagCanvas.height = 128;
    const fc = flagCanvas.getContext('2d'); fc.fillStyle = '#e7e9e5'; fc.fillRect(0, 0, 384, 128);
    fc.fillStyle = '#f7f7f4'; fc.fillRect(135, 18, 115, 30); fc.fillStyle = '#2e4a9a'; fc.fillRect(135, 48, 115, 30); fc.fillStyle = '#af3938'; fc.fillRect(135, 78, 115, 30);
    fc.fillStyle = '#c43e39'; fc.beginPath(); fc.arc(323, 48, 24, 0, Math.PI * 2); fc.fill(); fc.fillStyle = '#34424b'; fc.font = 'italic 16px sans-serif'; fc.fillText('ЭНЕРГИЯ', 272, 103);
    fc.strokeStyle = '#626d77'; fc.lineWidth = 5; fc.beginPath(); fc.ellipse(58, 60, 31, 16, -.5, 0, Math.PI * 2); fc.stroke(); fc.fillStyle = '#ad3638'; fc.fillRect(48, 27, 8, 45);
    const flagMap = new THREE.CanvasTexture(flagCanvas); flagMap.colorSpace = THREE.SRGBColorSpace;
    const flagMat = new THREE.MeshStandardMaterial({ map: flagMap, roughness: .88, metalness: 0 }); flagMat.userData.decal = true;
    kit.add(new THREE.PlaneGeometry(.98, .30), flagMat, marks.p(0, -.50, .02), [1, 1, 1], marks.rot, false);
    group.userData.referenceFeatures = { roundedBlanketHull: true, centeredHatchInsets: 2, ochreDockingBowl: true, radialProbeFingers: 12, dockingLatches: 10, largeDishes: 3 };
});

// Apply independent copies of Poisk's MLI finish to Nauka's insulated surfaces.
{
    let referenceSkin;
    parts.get('poisk').group.traverse(object => {
        const m = object.material;
        if (!referenceSkin && m?.map && m?.bumpMap && Math.abs(m.bumpScale - .030) < 1e-8 && Math.abs(m.roughness - .89) < 1e-8) referenceSkin = m;
    });
    if (!referenceSkin) throw new Error('Poisk blanket finish is unavailable');
    const scales = { lab: [5, 4], adapter: [3.5, 2], airlock: [2.4, 1.4], cover: [.65, .65] };
    for (const id of ['nauka', 'prichal']) {
        const variants = new Map();
        parts.get(id).group.traverse(object => {
            const kind = object.material?.userData?.poiskSkin; if (!kind) return;
            if (!variants.has(kind)) {
                const skin = referenceSkin.clone(); skin.name = 'Poisk MLI / ' + id + ' / ' + kind;
                skin.map = referenceSkin.map.clone(); skin.map.repeat.set(...scales[kind]); skin.map.needsUpdate = true;
                skin.bumpMap = referenceSkin.bumpMap.clone(); skin.bumpMap.repeat.set(...scales[kind]); skin.bumpMap.needsUpdate = true;
                if (kind === 'cover') skin.bumpScale = .014;
                skin.userData = { ...skin.userData, poiskSkin: kind, skinReference: 'Poisk / MRM-2' };
                variants.set(kind, skin);
            }
            object.material = variants.get(kind);
        });
        parts.get(id).group.userData.skinReference = 'Poisk / MRM-2';
    }
}
