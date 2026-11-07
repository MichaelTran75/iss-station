// Rassvet / MRM-1.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { Kit, material, shapes } from '../core/kit.js';
import { part, parts, ring } from '../core/station.js';
import { russianDockingBand } from './zarya.js';

part('rassvet', 'Rassvet / MRM-1', '23 / RUSSIAN DOCKING & STORAGE', 'Rassvet extends below Zarya. Its experiment airlock and radiator, carried up in 2010, moved to Nauka in 2023; three debris shields now cover the forward face where the airlock sat. The external fittings follow the supplied reference views.', [['Installed', '18 MAY 2010'], ['Debris shields', 'AUG 2023']], [0, -3.9, 17.8], (kit, group) => {
    group.position.y = .45;
    group.userData.attachment = 'Zarya nadir'; group.userData.dockingPorts = 2;
    group.userData.interfaceCenter = [0, -1.40, 17.8];
    group.userData.reconstruction = '2026-09-30 four supplied Rassvet reference views';
    group.userData.externalOutfitting = 'November 2026: debris shields on the forward face; airlock and radiator on Nauka since 2023';
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
    const blanket = skin('hull', [3.2, 3]), patch = skin('patch', [.65, .65], .014);
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
    // The experiment airlock and the radiator that Rassvet carried up in 2010 were moved to Nauka by the European
    // Robotic Arm in April and May 2023 (see the Nauka lower adapter); their saddle rails and carrier frame went with
    // them. In August 2023 cosmonauts fitted micrometeoroid debris shields on the forward face where the airlock sat:
    // three curved panels on stand-offs, with a handrail along each. Panel shapes are illustrative.
    const shieldSkin = material(0xd5d8d1, .74, .18).clone(); shieldSkin.side = THREE.DoubleSide;
    const shieldArc = .92, shieldHeight = .66;
    for (const y of [-2.98, -3.72, -4.46]) {
        const r = radiusAt(y) + .075;
        kit.add(new THREE.CylinderGeometry(r, r, shieldHeight, 40, 1, true, Math.PI - shieldArc / 2, shieldArc), shieldSkin, [0, y, 17.8], [1, 1, 1], [0, 0, 0], false);
        for (const edge of [-1, 1]) {
            const arc = []; for (let i = 0; i <= 12; i++) arc.push(point(-Math.PI / 2 - shieldArc / 2 + shieldArc * i / 12, y + edge * shieldHeight / 2, .078));
            for (let i = 1; i < arc.length; i++) kit.rod(arc[i - 1], arc[i], .011, silver);
        }
        for (const a of [-Math.PI / 2 - shieldArc * .42, -Math.PI / 2, -Math.PI / 2 + shieldArc * .42]) for (const dy of [-.22, .22]) kit.rod(point(a, y + dy, .005), point(a, y + dy, .07), .016, silver);
        kit.rod(point(-Math.PI / 2 - .3, y + .16, .13), point(-Math.PI / 2 + .3, y + .16, .13), .016, 0xd8b043);
        for (const a of [-Math.PI / 2 - .3, -Math.PI / 2 + .3]) kit.rod(point(a, y + .16, .08), point(a, y + .16, .13), .016, 0xd8b043);
    }
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
    group.userData.referenceFeatures = { roundedBlanketHull: true, transverseAirlock: false, debrisShields: 3, stowedRadiator: false, sideEquipmentPanels: 6 };
});
