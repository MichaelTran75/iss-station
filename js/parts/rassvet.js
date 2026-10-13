// Rassvet / MRM-1.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { Kit, material, shapes } from '../core/kit.js';
import { part, parts, ring } from '../core/station.js';
import { russianDockingBand } from './zarya.js';

part('rassvet', 'Rassvet / MRM-1', '23 / RUSSIAN DOCKING & STORAGE', 'Rassvet extends below Zarya. This reference configuration shows the blanket-covered module carrying its transverse experiment airlock, stowed radiator and external support frame. The external payload arrangement follows the supplied reference views.', [['Installed', '18 MAY 2010'], ['Reference configuration', 'AIRLOCK & RADIATOR STOWED']], [0, -3.9, 17.8], (kit, group) => {
    group.position.y = .45;
    group.userData.attachment = 'Zarya nadir'; group.userData.dockingPorts = 2;
    group.userData.interfaceCenter = [0, -1.40, 17.8];
    group.userData.reconstruction = '2026-09-30 four supplied Rassvet reference views';
    group.userData.externalOutfitting = 'Reference configuration with transverse airlock and stowed radiator';
    group.userData.skinReference = 'Poisk / MRM-2';
    const silver = 0xb7bdb8, rail = 0x999f95, dark = 0x353c3b, white = 0xf1f2ec, red = 0xd64724;
    const metal = material(silver, .60, .40), paint = material(white, .81, .12);
    let poiskSkin;
    parts.get('poisk').group.traverse(o => { const m = o.material; if (!poiskSkin && m?.map && m?.bumpMap && Math.abs(m.bumpScale - .030) < 1e-8 && Math.abs(m.roughness - .89) < 1e-8) poiskSkin = m; });
    if (!poiskSkin) throw new Error('Poisk blanket finish is unavailable for Rassvet');
    function skin(name, repeat, bump = .03) {
        const m = poiskSkin.clone(); m.name = 'Poisk MLI / rassvet / ' + name;
        m.map = poiskSkin.map.clone(); m.map.repeat.set(...repeat); m.map.needsUpdate = true;
        m.bumpMap = poiskSkin.bumpMap.clone(); m.bumpMap.repeat.set(...repeat); m.bumpMap.needsUpdate = true;
        m.bumpScale = bump; m.userData = { skinReference: 'Poisk / MRM-2', poiskSkin: name }; return m;
    }
    const blanket = skin('hull', [3.2, 3]), patch = skin('patch', [.65, .65], .014), airlockSkin = skin('airlock', [1.5, 1.1], .014);
    const goldSkin = skin('gold-cover', [1.2, 1.2], .025); goldSkin.color.setHex(0xd99735); goldSkin.roughness = .77; goldSkin.metalness = .30;
    const profile = [[.72, -7.02], [.79, -6.84], [1.02, -6.50], [1.15, -6.20], [1.175, -5.98], [1.175, -2.75], [1.12, -2.43], [.93, -2.06], [.74, -1.80], [.70, -1.71]];
    function radiusAt(y) { let i = profile.findIndex(p => p[1] >= y); i = Math.max(1, i < 0 ? profile.length - 1 : i); const a = profile[i - 1], b = profile[i], t = THREE.MathUtils.clamp((y - a[1]) / (b[1] - a[1]), 0, 1); return a[0] + (b[0] - a[0]) * t * t * (3 - 2 * t); }
    const point = (a, y, lift = 0) => [Math.cos(a) * (radiusAt(y) + lift), y, 17.8 + Math.sin(a) * (radiusAt(y) + lift)];
    function pipe(points, r = .013, color = rail) { kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(20, points.length * 5), r, 7, false), material(color, .74, .26), [0, 0, 0], [1, 1, 1], [0, 0, 0], false); }
    function arc(y, lift = 0, r = .01, color = rail, a0 = 0, a1 = Math.PI * 2) { pipe(Array.from({ length: 65 }, (_, i) => point(a0 + (a1 - a0) * i / 64, y, lift)), r, color); }
    function frame(a, y, lift = 0) { const n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), u = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)), v = new THREE.Vector3(0, 1, 0), rot = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n)), base = new THREE.Vector3(...point(a, y, lift)); return { p: (x, dy, d = 0) => base.clone().addScaledVector(u, x).addScaledVector(v, dy).addScaledVector(n, d).toArray(), rot: [rot.x, rot.y, rot.z] }; }
    const box = (f, p, size, surface = metal) => kit.add(shapes.box, surface, f.p(...p), size, f.rot, false);
    const disc = (f, p, r, depth, surface = metal) => kit.add(new THREE.CylinderGeometry(r, r, depth, 56).rotateX(Math.PI / 2), surface, f.p(...p), [1, 1, 1], f.rot, false);
    const hoop = (f, p, r, t = .014, surface = metal) => kit.add(new THREE.TorusGeometry(r, t, 8, 64), surface, f.p(...p), [1, 1, 1], f.rot, false);
    // Continuous rounded pressure hull, with the same crinkled blanket maps as Poisk.
    const pos = [], uv = [], idx = [], around = 128, along = 112;
    for (let j = 0; j <= along; j++)for (let i = 0; i <= around; i++) {
        const t = j / along, y = -7.02 + 5.31 * t, a = i / around * Math.PI * 2, r = radiusAt(y) + (.0045 * Math.sin(a * 39 + Math.sin(t * 28)) + .0025 * Math.sin(a * 71 - t * 31)) * Math.sin(Math.PI * t);
        pos.push(Math.cos(a) * r, y, 17.8 + Math.sin(a) * r); uv.push(i / around, t);
    }
    for (let j = 0; j < along; j++)for (let i = 0; i < around; i++) { const a = j * (around + 1) + i, b = a + around + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const shell = new THREE.BufferGeometry(); shell.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); shell.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); shell.setIndex(idx); shell.computeVertexNormals();
    const normals = shell.attributes.normal; for (let j = 0; j <= along; j++) { const a = j * (around + 1), b = a + around, n = new THREE.Vector3().fromBufferAttribute(normals, a).add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize(); normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(b, n.x, n.y, n.z); }
    kit.add(shell, blanket, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    for (const [y, r] of [[-7.01, .72], [-1.72, .70]]) kit.add(new THREE.SphereGeometry(1, 48, 24), patch, [0, y, 17.8], [r, .095, r], [0, 0, 0], false);
    // Mirror the measured Rassvet ring into the fixed body datum; its face meets Zarya at y=-.93.
    const receiverScale=.76/.66023, dockingFace=-.93-group.position.y;
    const cuffProfile=[[3.131308,.66023],[3.19177,.684758],[3.24550,.684758],[3.32364,.66757],[3.392018,.62374],
        [3.392018,.45189],[3.131308,.5200]].map(([y,r])=>[dockingFace+y-3.392018,r*receiverScale]);
    russianDockingBand(kit,cuffProfile,'y',[0,0,17.8]);
    const cuffBase=dockingFace+3.131308-3.392018;
    russianDockingBand(kit,[[-1.77,.735],[-1.68,.75],[cuffBase,.76],[cuffBase,.598],[-1.77,.598]],'y',[0,0,17.8]);
    kit.add(new THREE.CylinderGeometry(.758,.758,.25,64),patch,[0,-1.68,17.8],[1,1,1],[0,0,0],false);
    kit.cylinder([0,dockingFace-.01,17.8],.518,.014,dark,[0,0,0]);
    group.userData.interfaceCenter=[0,dockingFace,17.8];
    group.userData.referenceDockingJoints={source:'ISS_stationary.glb / node 23',localFace:dockingFace,stationFace:-.93,faceRadius:.62374*receiverScale,outerRadius:.684758*receiverScale};
    kit.add(new THREE.LatheGeometry([[.17, -1.48], [.20, -1.35], [.12, -1.23], [.07, -1.14], [0, -1.11]].map(p => new THREE.Vector2(...p)), 48), material(dark, .64, .35), [0, 0, 17.8], [1, 1, 1], [0, 0, 0], false);
    const doubleMetal = metal.clone(); doubleMetal.side = THREE.DoubleSide;
    kit.add(new THREE.CylinderGeometry(.76, .76, .32, 64, 1, true), doubleMetal, [0, -7.16, 17.8], [1, 1, 1], [0, 0, 0], false);
    kit.add(new THREE.CylinderGeometry(.769, .769, .23, 64, 1, true), patch, [0, -7.12, 17.8], [1, 1, 1], [0, 0, 0], false);
    kit.cylinder([0, -7.19, 17.8], .60, .02, dark, [0, 0, 0]); ring(kit, [0, -7.345, 17.8], .78, 'y', white, .045); ring(kit, [0, -7.39, 17.8], .64, 'y', silver, .028);
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; kit.box([Math.cos(a) * .75, -7.35, 17.8 + Math.sin(a) * .75], [.09, .085, .14], silver, [0, -a, 0], false); }
    // Sparse blanket joints and exterior belt handrails leave broad soft insulated surfaces.
    for (const y of [-2.08, -2.74, -5.98, -6.68]) arc(y, .008, .0065, 0xbcc2b8);
    for (const a of [.45, 1.55, 2.62, 3.65, 4.65, 5.56]) pipe(profile.map(([, y]) => point(a, y, .008)), .006, 0xbcc2b8);
    for (const y of [-2.77, -3.58, -5.40, -6.35]) {
        arc(y, .055, .012, 0xb3a17a, -.12, Math.PI + .12);
        for (const a of [.1, 1.12, 2.05, 3.04]) kit.rod(point(a, y, .015), point(a, y, .065), .014, silver);
    }
    for (const a of [.37, 2.77]) pipe([point(a, -1.92, .04), point(a, -2.18, .15), point(a, -2.71, .14), point(a, -3.0, .05)], .015, rail);
    // Side faces have long white equipment blankets, handrails and diagonal carriers.
    for (const side of [-1, 1]) {
        const sideAngle = side === 1 ? 0 : Math.PI;
        for (const u of [-.60, .49, .81]) { const f = frame(sideAngle - u / 1.175, -4.56, .015); box(f, [0, .10, .045], [.28, 1.76, .09], patch); box(f, [0, .10, .096], [.26, 1.74, .02], paint); }
        for (const y of [-2.42, -3.3, -5.85, -6.51]) {
            const h = frame(side === 1 ? 0 : Math.PI, y, .03); for (const u of [-.42, .42]) box(h, [u, 0, .07], [.08, .095, .13]);
            kit.rod(h.p(-.42, 0, .14), h.p(.42, 0, .14), .018, silver);
        }
        kit.rod([side * 1.22, -3.48, 16.82], [side * 1.22, -5.02, 17.63], .033, silver);
        for (const t of [.18, .55, .85]) { const y = -3.48 - 1.54 * t, z = 16.82 + .81 * t; kit.box([side * 1.22, y, z], [.14, .15, .12], silver, [.47, 0, 0], false); }
    }
    // The airlock sits crosswise on the forward face: one gold cover and one white domed end.
    const airlockCenter = [0, -2.82, 15.83], airlockLength = 2.22, airlockRadius = .64;
    const airlockGroup = new THREE.Group(); airlockGroup.name = 'Rassvet transverse stowed experiment airlock'; group.add(airlockGroup);
    const ak = new Kit();
    ak.add(new THREE.CylinderGeometry(airlockRadius, airlockRadius, airlockLength, 72), airlockSkin, airlockCenter, [1, 1, 1], [0, 0, Math.PI / 2], false);
    for (const x of [-1.075, 1.075]) {
        ak.cylinder([x, -2.82, 15.83], .662, .058, silver, [0, 0, Math.PI / 2]); ring(ak, [x, -2.82, 15.83], .672, 'x', dark, .016);
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ak.box([x, -2.82 + Math.cos(a) * .70, 15.83 + Math.sin(a) * .70], [.07, .13, .075], silver, [a, 0, 0], false); }
    }
    ak.add(new THREE.SphereGeometry(1, 64, 40), goldSkin, [-1.13, -2.82, 15.83], [.20, .627, .627], [0, 0, 0], false);
    ak.add(new THREE.SphereGeometry(1, 64, 40), paint, [1.13, -2.82, 15.83], [.21, .627, .627], [0, 0, 0], false);
    ring(ak, [-1.135, -2.82, 15.83], .618, 'x', 0xb68134, .022); ring(ak, [1.135, -2.82, 15.83], .618, 'x', silver, .024);
    // Small front panel, black connector row and top fittings visible in the broad elevation.
    ak.box([.61, -2.88, 15.18], [.47, .23, .035], 0xc4d0cb, [0, 0, 0], false);
    ak.box([-.59, -2.53, 15.24], [.55, .26, .085], dark, [0, 0, 0], false);
    for (let i = 0; i < 5; i++) { ak.box([-.37 - i * .105, -2.53, 15.192], [.054, .18, .020], white, [0, 0, 0], false); for (const y of [-2.59, -2.47]) ak.cylinder([-.37 - i * .105, y, 15.173], .011, .012, dark); }
    ak.cylinder([.02, -2.11, 15.83], .14, .24, 0xb0803e, [0, 0, 0]); ak.cylinder([.02, -1.987, 15.83], .19, .04, silver, [0, 0, 0]);
    ak.cylinder([.70, -2.08, 15.83], .055, .25, silver, [0, 0, 0]);
    ak.cylinder([0, -3.00, 15.19], .14, .12, silver);
    ak.cylinder([0, -3.00, 15.14], .18, .055, 0xaa9a68); ring(ak, [0, -3.00, 15.105], .174, 'z', silver, .012);
    for (const a of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) ak.rod([0, -3, 15.08], [Math.cos(a) * .16, -3 + Math.sin(a) * .16, 15.08], .012, silver);
    ak.finish(airlockGroup);
    // Open saddle rails support the airlock from the cylindrical hull; no floating end discs.
    for (const x of [-.92, .92]) {
        const zTop = 17.8 - Math.sqrt(radiusAt(-2.27) ** 2 - x * x), zBottom = 17.8 - Math.sqrt(radiusAt(-3.38) ** 2 - x * x);
        for (const [y, zHull] of [[-2.27, zTop], [-3.38, zBottom]]) { kit.rod([x, y, zHull + .025], [x, y, 15.88], .030, silver); kit.box([x, y, zHull], [.16, .16, .12], silver, [0, 0, 0], false); }
        kit.rod([x, -2.27, 15.88], [x, -3.38, 15.88], .027, silver);
        kit.rod([x, -2.27, zTop], [x, -3.38, 15.88], .027, silver);
        kit.rod([x, -3.38, zBottom], [x, -2.27, 15.88], .027, silver);
    }
    // Two wide transverse carrier bars end in four red circular plates, seen edge-on from the front.
    const carrierGroup = new THREE.Group(); carrierGroup.name = 'Rassvet radiator stowage frame'; group.add(carrierGroup); const rk = new Kit();
    for (const y of [-3.68, -6.46]) {
        // Dog-leg center section clears the front skin while the red beam ends sit closer to the body.
        rk.rod([-.66, y, 16.48], [.66, y, 16.48], .048, silver);
        for (const side of [-1, 1]) { rk.rod([side * .66, y, 16.48], [side * .90, y, 16.84], .048, silver); rk.rod([side * .90, y, 16.84], [side * 1.94, y, 16.84], .048, silver); }
        for (const side of [-1, 1]) {
            rk.cylinder([side * 1.96, y, 16.84], .275, .050, red, [0, 0, Math.PI / 2]);
            rk.cylinder([side * 2.015, y, 16.84], .057, .16, silver, [0, 0, Math.PI / 2]);
            for (const a of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) rk.cylinder([side * 1.991, y + Math.cos(a) * .17, 16.84 + Math.sin(a) * .17], .023, .012, dark, [0, 0, Math.PI / 2]);
            const anchor = [side * .89, y, 17.8 - Math.sqrt(radiusAt(y) ** 2 - .89 ** 2)];
            rk.rod(anchor, [side * 1.80, y, 16.84], .040, silver); rk.box(anchor, [.20, .20, .15], silver, [0, 0, 0], false);
        }
    }
    for (const side of [-1, 1]) {
        rk.rod([side * 1.85, -3.68, 16.84], [side * 1.37, -4.31, 16.27], .032, silver);
        rk.rod([side * 1.85, -6.46, 16.84], [side * 1.37, -5.70, 16.27], .032, silver);
        rk.rod([side * .86, -6.13, 17.00], [side * 1.34, -5.79, 16.32], .034, silver);
        for (const z of [16.19, 16.31, 16.43]) {
            rk.rod([side * 1.39, -3.95, z], [side * 1.39, -5.86, z], .022, silver);
            for (const y of [-3.95, -5.86]) rk.rod([side * 1.30, y, z], [side * 1.39, y, z], .022, silver);
        }
        for (const y of [-3.95, -5.86]) rk.rod([side * 1.39, y, 16.19], [side * 1.39, y, 16.43], .025, silver);
    }
    // A single broad white radiator in the front view; three close parallel edges appear in side views.
    const radiatorCenter = [0, -4.86, 16.25], radiatorSize = [2.72, 2.10, .075];
    rk.box(radiatorCenter, radiatorSize, white, [0, 0, 0], false);
    for (const x of [-1.367, 1.367]) rk.box([x, -4.86, 16.26], [.027, 2.14, .096], silver, [0, 0, 0], false);
    for (const y of [-3.802, -5.918]) rk.box([0, y, 16.26], [2.76, .027, .096], silver, [0, 0, 0], false);
    for (const x of [-1.30, 1.30]) for (const y of [-3.88, -4.54, -5.18, -5.84]) rk.cylinder([x, y, 16.20], .017, .012, silver);
    for (const x of [-.97, .97]) for (const y of [-3.94, -5.78]) rk.box([x, y, 16.19], [.037, .28, .045], silver, [0, 0, 0], false);
    rk.finish(carrierGroup);
    // Lower oblique equipment bracket and antenna are distinctive in the two side views.
    const a = -.47, f = frame(a, -6.28, .04), base = f.p(0, 0, .02), tip = f.p(0, -.45, .64);
    kit.rod(base, tip, .034, silver); kit.rod(f.p(.18, .03, .02), f.p(.18, -.45, .64), .023, silver);
    box(f, [.09, -.35, .52], [.28, .46, .10], material(dark)); box(f, [.09, -.62, .81], [.40, .20, .07], paint);
    for (const u of [0, .18]) kit.rod(f.p(u, -.35, .52), f.p(u, -.62, .81), .024, silver);
    const antenna = [1.05, -6.98, 16.60]; kit.rod([.55, -6.64, 16.98], antenna, .023, silver); kit.cylinder(antenna, .073, .10, silver, [0, 0, 0]);
    kit.rod([1.05, -6.98, 16.60], [1.05, -7.17, 16.60], .012, silver); kit.rod([.89, -7.08, 16.60], [1.21, -7.08, 16.60], .012, silver);
    // Circular grapple fixture on the opposite side, with three radial spokes.
    const grapple = frame(0, -5.75, .045); disc(grapple, [-.36, 0, .06], .245, .055, paint); hoop(grapple, [-.36, 0, .096], .215, .026, material(0xb9aa78, .7, .25));
    disc(grapple, [-.36, 0, -.025], .11, .25, metal);
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; kit.rod(grapple.p(-.36, 0, .125), grapple.p(-.36 + Math.cos(a) * .17, Math.sin(a) * .17, .125), .024, 0xb4a675); }
    // Reference-facing Cyrillic wordmark, Russian flag and compact agency marks on both sides.
    function decal(f, canvas, p, w, h) { const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); const ink = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: .95, polygonOffset: true, polygonOffsetFactor: -2 }); ink.userData.decal = true; kit.add(new THREE.PlaneGeometry(w, h), ink, f.p(...p), [1, 1, 1], f.rot, false); }
    for (const a of [0, Math.PI]) {
        const letters = document.createElement('canvas'); letters.width = 768; letters.height = 128; const c = letters.getContext('2d'); c.fillStyle = '#c83832'; c.font = '500 105px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('РАССВЕТ', 384, 66);
        if (a === Math.PI) decal(frame(a, -6.03, .025), letters, [0, 0, .02], 1.38, .23);
        const marks = document.createElement('canvas'); marks.width = 512; marks.height = 192; const m = marks.getContext('2d'); m.fillStyle = '#f5f5ed'; m.fillRect(0, 0, 512, 192); m.fillStyle = '#c73129'; m.beginPath(); m.arc(128, 77, 46, 0, Math.PI * 2); m.strokeStyle = '#bfc8c1'; m.lineWidth = 7; m.stroke(); m.fillRect(119, 40, 12, 63); m.font = 'italic 32px Arial'; m.fillText('ЭНЕРГИЯ', 268, 127); m.fillStyle = '#334350'; m.font = '20px Arial'; m.fillText('РОСКОСМОС', 38, 159);
        decal(frame(a, -5.66, .026), marks, [0, 0, .02], .92, .23);
        const flag = document.createElement('canvas'); flag.width = 180; flag.height = 120; const fc = flag.getContext('2d'); for (const [i, col] of ['#f5f5ef', '#234692', '#c5333c'].entries()) { fc.fillStyle = col; fc.fillRect(0, i * 40, 180, 40); }
        decal(frame(a, -3.65, .040), flag, [0, 0, .02], .43, .25);
    }
    group.userData.referenceFeatures = { roundedBlanketHull: true, transverseAirlock: true, airlockCenter, airlockAxis: [1, 0, 0], airlockEndColors: { negativeX: 'gold', positiveX: 'white' }, stowedRadiator: true, radiatorCenter, radiatorSize, redCarrierEndplates: 4, carrierCrossbars: 2, sideEquipmentPanels: 6 };
});
