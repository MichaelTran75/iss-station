// BEAM expandable module.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { Kit, material, palette, vertical } from '../core/kit.js';
import { part, ring } from '../core/station.js';
import { curvedCbmSaddle } from '../core/cbm.js';

part('beam', 'BEAM expandable module', '20 / EXPANDABLE HABITAT', 'BEAM is attached to Tranquility\'s aft port. Expanded in May 2016, its flexible multilayer shell surrounds a cargo stowage volume monitored by sensors. The quilted fabric barrel, the large aft bulkhead with its handholds and fixtures, and the Bigelow Aerospace and flag markings follow the supplied reference render; seams and fittings are schematic.', [['Expanded size', '~4.0 x 3.2 m'], ['Attachment', 'Tranquility aft']], [-7, 1.1, 16.55], (kit, group) => {
    group.userData.moduleLength = 4.0; group.userData.moduleDiameter = 3.24;
    group.userData.attachment = 'Tranquility aft';
    group.userData.referenceViews = 1;
    group.userData.rebuild = '2026-10-01: quilted barrel, large aft bulkhead and markings after the supplied render';
    const cx = -7, baseZ = 14.34;
    // BEAM is absent from the supplied older GLB. Adapt its CBM saddle shape to
    // the existing Node 3 hull, keeping BEAM's current body and location unchanged.
    const nodeSaddle = new THREE.Group(), nodeSaddleKit = new Kit();
    nodeSaddle.name = 'BEAM / Tranquility curved CBM saddle';
    nodeSaddle.position.set(cx, 0, 12);
    curvedCbmSaddle(nodeSaddleKit, 2.15, [
        [1.060, 'plane', 2.180], [1.115, 'plane', 2.180],
        [1.190, 'plane', 2.168], [1.240, 'shell', .012],
        [1.285, 'shell', .012], [1.285, 'shell', .030],
        [1.060, 'shell', .030], [1.060, 'plane', 2.180]
    ]);
    nodeSaddle.userData.interface = { source: 'Adapted CBM shape; BEAM absent from supplied GLB',
        hullRadius: 2.15, flatFace: 14.180, rootDepths: [.012, .030], axis: 'Z' };
    nodeSaddleKit.finish(nodeSaddle); group.add(nodeSaddle);

    // Side profile as (radius, distance aft of the berthing plane): a round shoulder off the collar, a full barrel and a long,
    // rounded roll into the rim of the large aft bulkhead.
    const control = [[1.06, .30], [1.24, .37], [1.39, .5], [1.5, .7], [1.57, .95], [1.61, 1.3], [1.625, 1.8], [1.62, 2.3], [1.6, 2.75], [1.56, 3.1], [1.49, 3.4], [1.39, 3.63], [1.28, 3.8], [1.2, 3.89], [1.17, 3.91]];
    const spline = new THREE.SplineCurve(control.map(([r, z]) => new THREE.Vector2(r, z)));
    const rows = 110, around = 192, gores = 12, bands = [.30, .92, 1.56, 2.2, 2.84, 3.46, 3.91];
    const profile = spline.getSpacedPoints(rows).map(p => [p.x, p.y]);
    // Quilted panels puff out between the sewn seams; meandering longitudinal creases ripple the fabric. Every term is periodic
    // in the angle so the shell closes cleanly.
    function radiusAt(a, r0, zl) {
        const k = bands.findIndex((b, i) => i < bands.length - 1 && zl <= bands[i + 1]), z0 = bands[Math.max(0, k)], z1 = bands[Math.max(0, k) + 1];
        const fz = THREE.MathUtils.clamp((zl - z0) / (z1 - z0), 0, 1), fa = ((a / (Math.PI * 2 / gores)) % 1 + 1) % 1;
        const puff = .046 * (r0 / 1.62) ** 2 * Math.pow(Math.sin(Math.PI * fa), .75) * Math.pow(Math.sin(Math.PI * fz), .75);
        const crease = .009 * Math.sin(37 * a + 2.2 * Math.sin(1.3 * zl + 3 * a)) + .006 * Math.sin(61 * a + 2.8 * Math.sin(2.1 * zl - 5 * a)) + .004 * Math.sin(97 * a + 1.7 * Math.sin(3.4 * zl));
        return r0 + puff + crease * (r0 / 1.62);
    }
    const surface = (a, zl, r0, lift = 0) => { const r = radiusAt(a, r0, zl) + lift; return [cx + Math.cos(a) * r, Math.sin(a) * r, baseZ + zl]; };
    const profileAt = zl => { let j = profile.findIndex(p => p[1] >= zl); if (j <= 0) return profile[Math.max(0, j)][0]; const [ra, za] = profile[j - 1], [rb, zb] = profile[j]; return ra + (rb - ra) * (zl - za) / (zb - za); };
    // White, softly crinkled fabric: a mottled ground under short, slightly wandering creases that mostly run along the module.
    const fabricCanvas = document.createElement('canvas'); fabricCanvas.width = fabricCanvas.height = 512;
    {
        const g = fabricCanvas.getContext('2d'); g.fillStyle = '#ebe8df'; g.fillRect(0, 0, 512, 512);
        let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
        for (let i = 0; i < 420; i++) { const x = rnd() * 512, y = rnd() * 512, r = 14 + rnd() * 40; g.fillStyle = rnd() > .5 ? 'rgba(255,255,252,.10)' : 'rgba(160,156,146,.07)'; g.beginPath(); g.ellipse(x, y, r * .45, r, 0, 0, Math.PI * 2); g.fill(); }
        for (let i = 0; i < 1900; i++) {
            const x = rnd() * 512, y = rnd() * 512, l = 8 + rnd() * 26, tilt = (rnd() - .5) * .9, bend = (rnd() - .5) * 7;
            const ex = x + Math.sin(tilt) * l, ey = y + Math.cos(tilt) * l;
            g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + ex) / 2 + bend, (y + ey) / 2, ex, ey);
            const dark = rnd() > .45; g.lineWidth = 1.2 + rnd() * 2.6; g.strokeStyle = dark ? 'rgba(140,138,128,.20)' : 'rgba(255,255,252,.55)'; g.stroke();
            if (dark) { g.translate(1.4, 0); g.lineWidth *= .7; g.strokeStyle = 'rgba(255,255,252,.35)'; g.stroke(); g.translate(-1.4, 0); }
        }
    }
    const fabricMap = new THREE.CanvasTexture(fabricCanvas); fabricMap.colorSpace = THREE.SRGBColorSpace; fabricMap.wrapS = fabricMap.wrapT = THREE.RepeatWrapping; fabricMap.repeat.set(9, 3); fabricMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const fabricBump = fabricMap.clone(); fabricBump.colorSpace = THREE.NoColorSpace; fabricBump.needsUpdate = true;
    const fabric = new THREE.MeshStandardMaterial({ color: 0xf1efe8, map: fabricMap, bumpMap: fabricBump, bumpScale: .018, roughness: .93, metalness: .03 });
    // The quilted shell, built directly so the puffed panels and creases follow the exact profile.
    {
        const positions = [], uvs = [], index = [];
        for (let j = 0; j <= rows; j++) for (let i = 0; i <= around; i++) {
            const a = i / around * Math.PI * 2, [r0, zl] = profile[j];
            positions.push(...surface(a, zl, r0)); uvs.push(i / around, j / rows);
        }
        for (let j = 0; j < rows; j++) for (let i = 0; i < around; i++) {
            const p = j * (around + 1) + i, q = p + 1, s = p + around + 1, t = s + 1;
            index.push(p, q, s, q, t, s);
        }
        const shell = new THREE.BufferGeometry(); shell.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); shell.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); shell.setIndex(index);
        shell.computeVertexNormals();
        const normal = shell.attributes.normal;
        for (let j = 0; j <= rows; j++) {
            const p = j * (around + 1), q = p + around, n = [0, 1, 2].map(k => normal.array[p * 3 + k] + normal.array[q * 3 + k]), l = Math.hypot(...n);
            for (const v of [p, q]) normal.setXYZ(v, n[0] / l, n[1] / l, n[2] / l);
        }
        kit.add(shell, fabric, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    // Sewn seams: gores along the barrel and circumferential bands, raised slightly in the creases between panels.
    const seam = material(0xd5d2c6, .9, .03);
    for (let k = 0; k < gores; k++) {
        const a = k * Math.PI * 2 / gores;
        kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(profile.filter((_, j) => j % 2 === 0).map(([r0, zl]) => new THREE.Vector3(...surface(a, zl, r0, .006)))), 70, .011, 6, false), seam, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    for (const zl of bands.slice(1, -1)) {
        const r0 = profileAt(zl);
        kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 96 }, (_, i) => new THREE.Vector3(...surface(i / 96 * Math.PI * 2, zl, r0, .006))), true), 192, .011, 6, true), seam, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    // Bigelow Aerospace wordmark above a US flag on the upper port side near the collar, as a decal that follows the quilting.
    {
        const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 640;
        const g = canvas.getContext('2d');
        g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.font = 'italic 900 158px Arial Black, Arial, sans-serif'; g.lineJoin = 'round';
        g.lineWidth = 16; g.strokeStyle = '#24387c'; g.strokeText('BIGELOW', 512, 205);
        g.fillStyle = '#c62a30'; g.fillText('BIGELOW', 512, 205);
        g.font = 'italic 700 46px Arial, sans-serif'; g.fillStyle = '#24387c'; g.fillText('AEROSPACE', 640, 262);
        const fx = 352, fy = 318, fw = 330, fh = 196;
        for (let s = 0; s < 13; s++) { g.fillStyle = s % 2 ? '#f6f6f2' : '#c3283a'; g.fillRect(fx, fy + s * fh / 13, fw, fh / 13 + .5); }
        g.fillStyle = '#25356f'; g.fillRect(fx, fy, fw * .4, fh * 7 / 13);
        g.fillStyle = '#f6f6f2'; for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) { g.beginPath(); g.arc(fx + 12 + col * 21 + (row % 2) * 10, fy + 12 + row * 19, 4, 0, Math.PI * 2); g.fill(); }
        const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const ink = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: .9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 }); ink.userData.decal = true;
        const z0 = 1.0, z1 = 2.0, aTop = 2.36, aBottom = 2.36 + .62 / 1.62, nu = 24, nv = 12, positions = [], uvs = [], index = [];
        for (let q = 0; q <= nv; q++) for (let p = 0; p <= nu; p++) {
            const zl = z0 + (z1 - z0) * p / nu, a = aBottom - (aBottom - aTop) * q / nv;
            positions.push(...surface(a, zl, profileAt(zl), .026)); uvs.push(p / nu, q / nv);
        }
        for (let q = 0; q < nv; q++) for (let p = 0; p < nu; p++) { const A = q * (nu + 1) + p, B = A + 1, C = A + nu + 1, D = C + 1; index.push(A, B, C, B, D, C); }
        const decal = new THREE.BufferGeometry(); decal.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); decal.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); decal.setIndex(index); decal.computeVertexNormals();
        kit.add(decal, ink, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    // Dark berthing collar on Tranquility's aft port, with lighter flange rings and bolt heads.
    kit.cylinder([cx, 0, baseZ - .03], 1.1, .62, 0x4f565a);
    ring(kit, [cx, 0, baseZ + .27], 1.12, 'z', 0x9aa1a3, .034); ring(kit, [cx, 0, baseZ - .28], 1.12, 'z', 0x7b8386, .03);
    for (let bolt = 0; bolt < 16; bolt++) { const a = bolt * Math.PI / 8; kit.box([cx + Math.cos(a) * 1.11, Math.sin(a) * 1.11, baseZ + .1], [.06, .06, .08], 0x8d9496, [0, 0, a], false); }
    // Large aft bulkhead: a rolled rim where the fabric ends, a flat white disc with an inner hatch ring, two gold handholds,
    // a small grey plate and two black grapple fixtures with gold fittings on brackets at its upper edge.
    const endZ = baseZ + 3.93, white = 0xe9e8e2, gold = 0xc9a447;
    kit.add(new THREE.TorusGeometry(1.11, .085, 16, 96), material(white, .7, .08), [cx, 0, endZ], [1, 1, 1], [0, 0, 0], false);
    kit.cylinder([cx, 0, endZ + .04], 1.1, .1, white);
    const face = endZ + .09;
    kit.add(new THREE.TorusGeometry(.86, .014, 8, 96), material(0xc9cbc8, .6, .2), [cx, 0, face + .004], [1, 1, 1], [0, 0, 0], false);
    kit.cylinder([cx, 0, face + .01], .84, .02, 0xeeeee9);
    for (const side of [-1, 1]) {
        const x = cx + side * .32;
        for (const y of [-.28, .32]) kit.rod([x, y, face + .02], [x, y, face + .1], .016, gold);
        kit.rod([x, -.3, face + .1], [x, .34, face + .1], .022, gold);
    }
    kit.box([cx - .04, .78, face + .025], [.18, .09, .03], 0x6e7477, [0, 0, 0], false);
    function fixture(a, normal, r) {
        const base = new THREE.Vector3(cx + Math.cos(a) * 1.11, Math.sin(a) * 1.11, endZ + .02), n = new THREE.Vector3(...normal).normalize();
        const top = base.clone().addScaledVector(n, .2), q = new THREE.Quaternion().setFromUnitVectors(vertical, n);
        kit.rod(base.toArray(), top.toArray(), .04, white);
        kit.add(new THREE.BoxGeometry(.05, .2, .2).applyQuaternion(q), material(white, .7, .08), base.clone().addScaledVector(n, .09).toArray(), [1, 1, 1], [0, 0, 0], false);
        const put = (geometry, color, offset) => kit.add(geometry.applyQuaternion(q), material(color, .45, .35), top.clone().addScaledVector(n, offset).toArray(), [1, 1, 1], [0, 0, 0], false);
        put(new THREE.CylinderGeometry(r, r, .035, 40), palette.black, 0);
        put(new THREE.CylinderGeometry(.05, .06, .12, 16), gold, .07);
        for (let blade = 0; blade < 3; blade++) put(new THREE.BoxGeometry(.05, .03, r * .75).translate(0, 0, r * .42).rotateY(blade * Math.PI * 2 / 3), gold, .03);
    }
    fixture(1.75, [-.1, 1, .25], .24);
    fixture(.7, [.55, .45, .7], .21);
});
