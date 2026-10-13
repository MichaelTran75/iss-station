// Columbus laboratory.
import * as THREE from 'three';
import { assetData } from '../core/data.js';
import { renderer } from '../core/stage.js';
import { Kit, material, palette, shapes, vertical } from '../core/kit.js';
import { part, parts, ring } from '../core/station.js';
import { pmaArray } from '../core/pma.js';

// BEGIN COLUMBUS CREW REFERENCE: 'Human' by doctortex (CC BY 4.0), the clothed body only (no shoes' insides, no sunglasses,
// no eyelashes). Metres, quantised to 1/4096 m, in the model's own frame: x to the figure's left, y up, z forward, soles at
// y = 0. Meshes were decimated by quadric edge collapse and the skin hidden under the shirt and shorts was cut away (a
// 3 cm band stays under each hem, sunk 1 cm). `colors` are linear RGB bytes baked from the model's textures: skin and
// eyes in colour, fabric as shading only. `skin` holds, per vertex, its three strongest bones and the weights of the
// second and third. `bones` is the 52-bone Mixamo rig as [name, parent, translation, rotation] in the bind pose; `poses`
// are local rotations per bone and `roots` the hip position for each crew member, solved from hand, foot, pelvis, chest
// and gaze targets. `axes` are bone-local axes for finger curl, elbow and wrist bend and head turns.
const columbusCrewHuman = assetData.columbusCrewHuman;
// END COLUMBUS CREW REFERENCE
// BEGIN COLUMBUS CREW MOTION: work loops for Crew 1 (30 s) and Crew 3 (36 s), keyed from the same solver. Each key is a
// full pose (int16 quaternions per bone, key by key), the hip position and a root transform: for Crew 1 an offset and
// turn from its place at the laptop, for Crew 3 the transform of the group it floats in. `type` and `pad` say when
// Crew 1 types or works the touchpad. `axes` are bone-local axes for breathing and for the floating legs.
const columbusCrewMotion = assetData.columbusCrewMotion;
// END COLUMBUS CREW MOTION
part('columbus', 'Columbus laboratory', '09 / EUROPE - ESA', 'Europe\'s laboratory, drawn after ESA\'s cutaway illustration. A 75%-transparent section of the hull shows racks along the far wall and deck of a square aisle, three crew at work (one at a laptop who types, stops to read, uses the touchpad, reaches up to a rack switch and now and then turns, one hand still on the laptop, to watch the crew member beside him with his chin on his fist; one with both hands in the glovebox; one who holds a rack rail while working a panel, then pushes off and glides to the next rail) and the Harmony hatch at the far end; the near-wall and overhead racks are left out so the cabin stays in view. The outboard end cone carries a platform with SOLAR and a gold instrument box above, and a white frame of finned instrument boxes below. Rack contents, crew poses and payload shapes are illustrative.', [['Joined station', 'FEB 2008'], ['Hull window', '75% transparent']], [4.965376, 1.0, -4.7], (kit, group) => {
    group.position.x = -1.134624;
    group.userData.connectionTranslation = [-1.134624, 0, 0];
    // Rebuilt after ESA's Columbus cutaway illustration. Local frame: the module axis is z (+z outboard, toward the
    // payloads; -z toward Harmony), +x faces forward (world -z) and +y is zenith. Over the forward-upper half, from the
    // deck edge over the top and from the outboard cone to the last ring frame, the opaque shell gives way to a
    // 75%-transparent skin; the near-wall and overhead rack rows are left out so the cabin stays in view.
    const tube = new THREE.Group(), shell = new THREE.Group(), framework = new THREE.Group(), interior = new THREE.Group(), external = new THREE.Group();
    tube.name = 'Columbus module'; shell.name = 'Columbus shell and end cones'; framework.name = 'Columbus exposed frames';
    interior.name = 'Columbus cabin'; external.name = 'Columbus external payloads';
    tube.position.set(6.1, 0, -4.7); tube.rotation.y = Math.PI / 2; group.add(tube); tube.add(shell, framework, interior, external);
    const R = 2.15, Rp = 1.98, barrel = 2.45, coneEnd = 3.4, coneR = 1.3, aisle = .95, rackDepth = .72;
    const open = { a0: -58 * Math.PI / 180, a1: 122 * Math.PI / 180, z0: -2.15, z1: barrel };
    const at = (r, a, z) => [Math.cos(a) * r, Math.sin(a) * r, z];
    const twoSided = (color, roughness = .7, metalness = .22) => { const m = material(color, roughness, metalness).clone(); m.side = THREE.DoubleSide; return m; };
    const shellKit = new Kit(), frameKit = new Kit(), cabinKit = new Kit(), payloadKit = new Kit(), racks = [], crew = [];
    // A band of a surface of revolution from (r0, z0) to (r1, z1) over angles a0..a1. Double-sided, so winding is free.
    function sweep(target, r0, z0, r1, z1, a0, a1, surface) {
        const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 32))), positions = [], uvs = [], indices = [];
        for (let row = 0; row < 2; row++) for (let i = 0; i <= steps; i++) {
            positions.push(...at(row ? r1 : r0, a0 + (a1 - a0) * i / steps, row ? z1 : z0)); uvs.push(i / steps, row);
        }
        for (let i = 0; i < steps; i++) { const j = i + steps + 1; indices.push(i, i + 1, j, j, i + 1, j + 1); }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices); geometry.computeVertexNormals();
        target.add(geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    function quad(target, corners, surface) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
        geometry.setIndex([0, 1, 2, 0, 2, 3]); geometry.computeVertexNormals();
        target.add(geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    function arc(target, r, z, a0, a1, radius, color) {
        const points = [], steps = Math.max(8, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 40)));
        for (let i = 0; i <= steps; i++) points.push(new THREE.Vector3(...at(r, a0 + (a1 - a0) * i / steps, z)));
        target.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps * 2, radius, 6, false), material(color, .6, .3), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    const fastenerShape = new THREE.CylinderGeometry(.018, .018, .014, 8), fastenerMetal = material(0x5d6664, .5, .45);
    const fastener = (target, r, a, z) => target.add(fastenerShape.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vertical, new THREE.Vector3(Math.cos(a), Math.sin(a), 0))), fastenerMetal, at(r, a, z), [1, 1, 1], [0, 0, 0], false);
    const railAlong = (target, a, za, zb) => {
        target.rod(at(R + .1, a, za), at(R + .1, a, zb), .016, palette.gold);
        for (const z of [za, zb]) target.rod(at(R + .006, a, z), at(R + .1, a, z), .013, palette.gold);
    };

    // Shell: MMOD bumper panels in twelve columns and four bays over a dark base skin that reads as the seams.
    const seamSkin = twoSided(0x5f6866, .8, .2), panelSkins = [0xcdd1cb, 0xc3c9c5, 0xd6d9d2, 0xbfc6c2].map(c => twoSided(c, .64, .3));
    sweep(shellKit, R - .005, -barrel, R - .005, open.z0, 0, Math.PI * 2, seamSkin);
    sweep(shellKit, R - .005, open.z0, R - .005, barrel, open.a1, open.a0 + Math.PI * 2, seamSkin);
    const bays = [-barrel, open.z0, -1.05, .1, 1.28, barrel];
    for (let bay = 0; bay < 5; bay++) for (let k = 0; k < 12; k++) {
        if (bay > 0 && k >= 6) continue; // these six columns form the opening
        const a0 = open.a1 + k * Math.PI / 6 + .006, a1 = a0 + Math.PI / 6 - .012, z0 = bays[bay] + .018, z1 = bays[bay + 1] - .018;
        sweep(shellKit, R + .004, z0, R + .004, z1, a0, a1, panelSkins[(bay * 5 + k * 3) % 4]);
        for (const a of [a0 + .03, (a0 + a1) / 2, a1 - .03]) for (const z of [z0 + .06, z1 - .06]) fastener(shellKit, R + .012, a, z);
        if ((bay + k) % 3 === 0) railAlong(shellKit, a0 + .09, z0 + .28, z1 - .28);
    }
    // Truncated end cones in twelve sector panels, rimmed at both edges.
    const lerp = (u, v, t) => u + (v - u) * t;
    for (const end of [-1, 1]) {
        const reach = end < 0 ? 2.778732 : coneEnd, neckR = end < 0 ? 1.103418 : coneR;
        sweep(shellKit, R - .005, end * barrel, neckR - .005, end * reach, 0, Math.PI * 2, seamSkin);
        for (let k = 0; k < 12; k++) {
            const a0 = open.a1 + k * Math.PI / 6 + .008, a1 = a0 + Math.PI / 6 - .016;
            sweep(shellKit, lerp(R, neckR, .03) + .004, end * lerp(barrel, reach, .03), lerp(R, neckR, .97) + .004, end * lerp(barrel, reach, .97), a0, a1, panelSkins[(k * 3 + (end > 0 ? 1 : 2)) % 4]);
            if (k % 3 === 1) { const a = (a0 + a1) / 2; shellKit.rod(at(lerp(R, neckR, .3) + .09, a, end * lerp(barrel, reach, .3)), at(lerp(R, neckR, .72) + .09, a, end * lerp(barrel, reach, .72)), .016, palette.gold); }
        }
        ring(shellKit, [0, 0, end * barrel], R + .012, 'z', palette.silver, .035);
        ring(shellKit, [0, 0, end * reach], neckR + .01, 'z', palette.silver, .03);
    }
    // Outboard end: a stepped rim and a dished central cover with radial ribs.
    sweep(shellKit, coneR, coneEnd, 1.18, coneEnd, 0, Math.PI * 2, twoSided(0xb7beba));
    sweep(shellKit, 1.18, coneEnd, 1.18, coneEnd + .09, 0, Math.PI * 2, twoSided(0xc9cdc7));
    ring(shellKit, [0, 0, coneEnd + .09], 1.185, 'z', palette.silver, .03);
    const dishDepth = .17, dishZ = r => coneEnd + .09 - dishDepth * (1 - (r / 1.16) ** 2);
    const dishProfile = []; for (let i = 0; i <= 14; i++) { const r = 1.16 * (1 - i / 14); dishProfile.push(new THREE.Vector2(r, dishZ(r))); }
    shellKit.add(new THREE.LatheGeometry(dishProfile, 56).rotateX(Math.PI / 2), twoSided(0x8f9895, .5, .38), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    for (let rib = 0; rib < 8; rib++) {
        const a = rib * Math.PI / 4;
        shellKit.rod(at(.2, a, dishZ(.2) + .02), at(1.1, a, dishZ(1.1) + .02), .02, palette.silver);
    }
    shellKit.cylinder([0, 0, dishZ(0) + .03], .2, .06, palette.silver);
    // Compact inboard cone terminates at the shared Harmony passive CBM.
    group.userData.inboardJoint = { barrelPlane: 2.515376, throatPlane: 2.186644, radius: 1.103418 };
    // A small gold box on the near side of the barrel by the Harmony end, as in the illustration.
    shellKit.add(shapes.box, material(0xc49a2c, .6, .45), at(R + .17, .1, -2.15), [.3, .36, .34], [0, 0, .1]);
    // ESA mark and the module name on the lower forward hull, as a patch that follows the barrel.
    {
        const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256; const g = canvas.getContext('2d');
        g.fillStyle = '#0d3b8c'; g.beginPath(); g.arc(118, 128, 92, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#f3f5f8'; g.font = 'bold 150px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('e', 120, 120);
        g.fillStyle = '#0d3b8c'; g.textAlign = 'left'; g.font = 'bold 150px Arial, sans-serif'; g.fillText('esa', 232, 122);
        g.fillStyle = '#16306f'; g.font = 'italic bold 108px Arial, sans-serif'; g.fillText('Columbus', 520, 130);
        const ink = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2 });
        ink.map.colorSpace = THREE.SRGBColorSpace; ink.userData.decal = true;
        const za = -.25, zb = -2.05, aMid = -72 * Math.PI / 180, half = .225 / R, nu = 20, nv = 6, positions = [], uvs = [], index = [];
        for (let q = 0; q <= nv; q++) for (let p = 0; p <= nu; p++) { positions.push(...at(R + .018, aMid - half + 2 * half * q / nv, za + (zb - za) * p / nu)); uvs.push(p / nu, q / nv); }
        for (let q = 0; q < nv; q++) for (let p = 0; p < nu; p++) { const A = q * (nu + 1) + p, B = A + 1, C = A + nu + 1, D = C + 1; index.push(A, B, C, B, D, C); }
        const patch = new THREE.BufferGeometry(); patch.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); patch.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); patch.setIndex(index); patch.computeVertexNormals();
        shellKit.add(patch, ink, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    // Cut faces show the wall section around the opening, with a beam along each long edge.
    const cutFace = twoSided(0xe4e6df, .82, .08);
    for (const a of [open.a0, open.a1]) quad(shellKit, [at(Rp, a, open.z0), at(R + .012, a, open.z0), at(R + .012, a, open.z1), at(Rp, a, open.z1)], cutFace);
    for (const z of [open.z0, open.z1]) sweep(shellKit, Rp, z, R + .012, z, open.a0, open.a1, cutFace);
    for (const a of [open.a0, open.a1]) {
        frameKit.rod(at(2.066, a, open.z0), at(2.066, a, open.z1), .045, 0xd6d9d2);
        for (let n = 1; n < 12; n++) frameKit.box(at(2.066, a, open.z0 + (open.z1 - open.z0) * n / 12), [.13, .13, .05], 0xbfc4be, [0, 0, a], false);
    }
    // Ring frames exposed at both ends of the opening: two arcs joined by an X lattice.
    for (const z of [open.z0 + .02, open.z1 - .06]) {
        const lo = open.a0 - .04, hi = open.a1 + .04, n = 16;
        for (const r of [1.72, 1.96]) arc(frameKit, r, z, lo, hi, .032, 0xdfe2db);
        for (let i = 0; i < n; i++) {
            const a = lo + (hi - lo) * i / n, b = lo + (hi - lo) * (i + 1) / n;
            frameKit.rod(at(1.72, a, z), at(1.96, b, z), .016, 0xc5c9c3);
            frameKit.rod(at(1.96, a, z), at(1.72, b, z), .016, 0xc5c9c3);
        }
    }
    shellKit.finish(shell); frameKit.finish(framework);
    // The see-through section: a 75%-transparent outer skin, drawn from outside only, so the module reads closed.
    const clearSkin = new THREE.MeshStandardMaterial({ color: 0xd3d8d4, roughness: .35, metalness: .08, transparent: true, opacity: .25, depthWrite: false });
    const glazing = new THREE.Group(), glazingKit = new Kit(); glazing.name = 'Columbus see-through hull section';
    sweep(glazingKit, R + .002, open.z0, R + .002, open.z1, open.a0, open.a1, clearSkin);
    // Panel seams continue faintly across it; kept out of the selection tint with the skin itself.
    for (let k = 1; k < 6; k++) { const a = open.a0 + k * Math.PI / 6; glazingKit.line([at(R + .006, a, open.z0), at(R + .006, a, open.z1)]); }
    for (const z of bays.slice(2, -1)) glazingKit.line(Array.from({ length: 25 }, (_, i) => at(R + .006, open.a0 + (open.a1 - open.a0) * i / 24, z)));
    glazingKit.finish(glazing); shell.add(glazing);
    glazing.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; object.renderOrder = 2; } });

    // Cabin: the pressure-shell liner and closed end bulkheads.
    const linerSkin = twoSided(0xd8dbd3, .85, .06);
    sweep(cabinKit, Rp, -barrel, Rp, open.z0, 0, Math.PI * 2, linerSkin);
    sweep(cabinKit, Rp, open.z0, Rp, barrel, open.a1, open.a0 + Math.PI * 2, linerSkin);
    function panelTexture(kind, seed) {
        const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 416;
        const g = canvas.getContext('2d');
        let state = seed * 7919 + 13; const rand = () => { state = (state * 16807) % 2147483647; return (state - 1) / 2147483646; };
        const tones = { lab: ['#e5e7df', '#d5d9d1', '#eef0e8'], floor: ['#b3b8b2', '#a6aca7', '#bdc2bc'], ceiling: ['#8c9490', '#7e8783', '#98a09b'], stow: ['#dde0d7', '#d0d4cc', '#e5e7df'] }[kind];
        g.fillStyle = tones[0]; g.fillRect(0, 0, 256, 416);
        for (let y = 6; y < 404;) {
            const h = Math.min(410 - y, 42 + Math.floor(rand() * 70));
            g.fillStyle = tones[Math.floor(rand() * 3)]; g.fillRect(6, y, 244, h - 4);
            g.strokeStyle = 'rgba(70,80,76,.55)'; g.lineWidth = 1.5; g.strokeRect(6.5, y + .5, 243, h - 5);
            if (kind === 'lab') {
                const style = Math.floor(rand() * 4);
                if (style === 0) for (let k = 0; k < 8; k++) { g.fillStyle = k % 3 ? '#4f5a57' : '#2f6f63'; g.fillRect(16 + k * 27, y + 10, 14, 9); }
                if (style === 1) { g.fillStyle = '#2d4e57'; g.fillRect(140, y + 8, 96, Math.min(h - 18, 44)); g.fillStyle = '#7fc4b7'; g.fillRect(147, y + 14, 60, 3); g.fillRect(147, y + 21, 80, 3); }
                if (style === 2) for (let k = 0; k < 5; k++) { g.fillStyle = '#6f7a76'; g.beginPath(); g.arc(26 + k * 30, y + h / 2 - 2, 8, 0, Math.PI * 2); g.fill(); g.fillStyle = '#c9cec7'; g.beginPath(); g.arc(26 + k * 30, y + h / 2 - 2, 3.5, 0, Math.PI * 2); g.fill(); }
                if (style === 3) { g.fillStyle = '#9aa39e'; g.fillRect(16, y + h / 2 - 4, 120, 6); g.fillStyle = '#b4382f'; g.fillRect(222, y + 9, 14, 8); }
                g.fillStyle = '#6b7470'; g.fillRect(16, y + h - 15, 52, 3);
            } else if (kind === 'floor') {
                if (rand() < .5) { g.fillStyle = '#cfb349'; g.fillRect(20 + rand() * 150, y + 8, 30, 8); }
                g.strokeStyle = 'rgba(60,66,64,.5)';
                for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(20, y + 16 + k * 8); g.lineTo(92, y + 16 + k * 8); g.stroke(); }
            } else if (kind === 'ceiling') {
                if (rand() < .5) for (let k = 0; k < 9; k++) { g.fillStyle = '#5c6562'; g.fillRect(20 + k * 24, y + 10, 12, h - 26); }
                else { g.fillStyle = '#6a736f'; g.fillRect(20, y + 10, 100, h - 26); g.fillRect(136, y + 10, 100, h - 26); }
            } else {
                for (let k = 0; k < 4; k++) { g.strokeStyle = 'rgba(80,90,86,.6)'; g.strokeRect(12 + k * 60, y + 6, 54, h - 16); g.fillStyle = '#8e9893'; g.fillRect(30 + k * 60, y + h / 2 - 4, 18, 4); }
            }
            g.fillStyle = '#6a726e';
            for (const xx of [12, 244]) for (const yy of [y + 7, y + h - 11]) { g.beginPath(); g.arc(xx, yy, 2.2, 0, Math.PI * 2); g.fill(); }
            y += h;
        }
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return texture;
    }
    // One rack: its front faces +x at x = 0 and its body runs back to -x; height along y, width along z.
    const rackBody = material(0x9ea8a3, .78, .18), rackPost = 0xd1d5ce;
    function rackUnit(name, texture, extras) {
        const rack = new THREE.Group(), rk = new Kit(); rack.name = name;
        rk.add(shapes.box, rackBody, [-rackDepth / 2, 0, 0], [rackDepth - .02, 1.68, 1.0], [0, 0, 0], false);
        rk.add(new THREE.PlaneGeometry(.99, 1.64), material(0xffffff, .82, .05, texture), [.004, 0, 0], [1, 1, 1], [0, Math.PI / 2, 0], false);
        for (const z of [-.5, .5]) rk.box([-.02, 0, z], [.07, 1.72, .045], rackPost, [0, 0, 0], false);
        for (const y of [-.845, .845]) rk.box([-.02, y, 0], [.07, .045, 1.04], rackPost, [0, 0, 0], false);
        if (extras) extras(rk);
        rk.finish(rack); racks.push(rack); return rack;
    }
    const laptopCanvas = document.createElement('canvas'); laptopCanvas.width = 160; laptopCanvas.height = 104;
    const lg = laptopCanvas.getContext('2d'), sky = lg.createLinearGradient(0, 0, 0, 104);
    sky.addColorStop(0, '#2a5fae'); sky.addColorStop(1, '#173a78'); lg.fillStyle = sky; lg.fillRect(0, 0, 160, 104);
    lg.fillStyle = '#e8eef5'; lg.beginPath(); lg.arc(60, 50, 24, 0, Math.PI * 2); lg.fill();
    lg.fillStyle = '#d6573f'; lg.fillRect(92, 26, 42, 28); lg.fillStyle = '#6fc1a1'; lg.fillRect(92, 60, 42, 14);
    const laptopScreen = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(laptopCanvas) }); laptopScreen.map.colorSpace = THREE.SRGBColorSpace;
    // Far-wall and deck rows; the overhead and near-wall rows lie inside the cut.
    const rows = [
        { name: 'Wall rack', position: z => [-aisle, 0, z], roll: 0, kind: 'lab' },
        { name: 'Deck rack', position: z => [0, -aisle, z], roll: Math.PI / 2, kind: 'floor' }
    ];
    rows.forEach((row, rowIndex) => [-1.65, -.55, .55, 1.65].forEach((z, bay) => {
        const unit = rackUnit(row.name + ' ' + (bay + 1), panelTexture(row.kind, rowIndex * 10 + bay + 1), rk => {
            if (rowIndex === 0 && bay === 3) {
                // A fold-out shelf with the laptop that the first crew member is using.
                rk.box([.19, .02, -.26], [.36, .03, .48], 0xc3c8c2, [0, 0, 0], false);
                rk.box([.22, .045, -.26], [.24, .018, .34], 0x2d3134, [0, 0, 0], false);
                rk.box([.1, .16, -.26], [.018, .22, .34], 0x2d3134, [0, 0, .32], false);
                rk.add(new THREE.PlaneGeometry(.3, .19).rotateY(Math.PI / 2).rotateZ(.32), laptopScreen, [.112, .163, -.26], [1, 1, 1], [0, 0, 0], false);
            }
            if (rowIndex === 0 && bay === 2) {
        // A glovebox: a light frame with a clear top and two round glove ports, where the second crew member works.
        rk.box([.15, .3, -.1], [.3, .36, .62], 0xc7ccc9, [0, 0, 0], false);
        rk.box([.17, .495, -.1], [.25, .03, .56], 0x9db7bf, [0, 0, 0], false);
        for (const z of [-.23, .03]) { rk.add(new THREE.TorusGeometry(.07, .016, 8, 24), material(0x5c6461, .5, .3), [.305, .3, z], [1, 1, 1], [0, Math.PI / 2, 0], false); rk.add(new THREE.CircleGeometry(.066, 20), material(0x23292b, .8, .1), [.302, .3, z], [1, 1, 1], [0, Math.PI / 2, 0], false); }
        rk.box([.31, .43, -.1], [.02, .05, .5], 0x8b9491, [0, 0, 0], false);
    }
            if (rowIndex === 1) for (const y of [-.25, .35]) {
                // Deck foot-restraint loops.
                rk.rod([.05, y, -.22], [.05, y, .22], .012, palette.dark);
                for (const zz of [-.22, .22]) rk.rod([.005, y, zz], [.05, y, zz], .01, palette.dark);
            }
            if (rowIndex === 0) for (const y of [-.55, .1, .6]) rk.rod([.03, y, -.3], [.03, y, .1], .01, 0x7c8581);
        });
        unit.position.fromArray(row.position(z)); unit.rotation.z = row.roll; interior.add(unit);
    }));
    // Corner strips: a light bar along the far overhead edge, utility rails along both deck edges.
    const lamp = new THREE.MeshBasicMaterial({ color: 0xf8f5e6 });
    cabinKit.box([-.905, .905, 0], [.1, .1, 4.36], 0xd9dcd4, [0, 0, 0], false);
    cabinKit.add(shapes.box, lamp, [-.86, .86, 0], [.03, .03, 4.2], [0, 0, Math.PI / 4], false);
    for (const sx of [-1, 1]) {
        cabinKit.box([sx * .905, -.905, 0], [.1, .1, 4.36], 0x88918d, [0, 0, 0], false);
        cabinKit.rod([sx * .83, -.83, -2.1], [sx * .83, -.83, 2.1], .018, palette.gold);
    }
    // A dark service duct and equipment boxes run above the far wall, under the remaining roof.
    cabinKit.box([-1.13, 1.2, 0], [.38, .34, 4.3], 0x4b5351, [0, 0, 0], false);
    for (let i = 0; i < 6; i++) cabinKit.box([-1.02, 1.0, -1.9 + i * .76], [.16, .12, .5], i % 2 ? 0x6b7571 : 0x3d4543, [0, 0, 0], false);
    // The cut edge of the deck row shows its lattice side frame, as in the illustration.
    for (const [yTop, yBottom] of [[-.98, -1.44]]) {
        const x = .93, zA = open.z0 + .04, zB = open.z1 - .06, n = 9;
        for (const y of [yTop, yBottom]) cabinKit.rod([x, y, zA], [x, y, zB], .02, 0xd4d7d0);
        for (let i = 0; i < n; i++) {
            const za = zA + (zB - zA) * i / n, zb = zA + (zB - zA) * (i + 1) / n;
            cabinKit.rod([x, yTop, za], [x, yBottom, zb], .012, 0xbfc3bd); cabinKit.rod([x, yBottom, za], [x, yTop, zb], .012, 0xbfc3bd);
        }
    }
    // Harmony-end bulkhead: a closed hatch in a rounded frame, stowage above it and a hand-hold either side.
    const bulkhead = twoSided(0xe1e3dc, .85, .06);
    sweep(cabinKit, 0, -barrel + .02, Rp, -barrel + .02, 0, Math.PI * 2, bulkhead);
    sweep(cabinKit, 0, barrel - .02, Rp, barrel - .02, 0, Math.PI * 2, bulkhead);
    const roundedSquare = (half, radius) => {
        const s = new THREE.Shape(); s.moveTo(-half + radius, -half); s.lineTo(half - radius, -half); s.quadraticCurveTo(half, -half, half, -half + radius);
        s.lineTo(half, half - radius); s.quadraticCurveTo(half, half, half - radius, half); s.lineTo(-half + radius, half);
        s.quadraticCurveTo(-half, half, -half, half - radius); s.lineTo(-half, -half + radius); s.quadraticCurveTo(-half, -half, -half + radius, -half); return s;
    };
    const hatchFrame = roundedSquare(.68, .3); hatchFrame.holes.push(roundedSquare(.56, .24));
    cabinKit.add(new THREE.ExtrudeGeometry(hatchFrame, { depth: .07, bevelEnabled: false, curveSegments: 8 }), material(0xb4bab6, .6, .3), [0, -.05, -barrel + .02], [1, 1, 1], [0, 0, 0], false);
    cabinKit.add(new THREE.ExtrudeGeometry(roundedSquare(.555, .235), { depth: .04, bevelEnabled: false, curveSegments: 8 }), material(0xf1f2ec, .8, .06), [0, -.05, -barrel + .025], [1, 1, 1], [0, 0, 0], false);
    cabinKit.cylinder([0, .2, -barrel + .07], .09, .012, palette.glass);
    ring(cabinKit, [0, .2, -barrel + .075], .1, 'z', palette.silver, .012);
    cabinKit.rod([-.28, -.3, -barrel + .09], [.28, -.3, -barrel + .09], .018, palette.dark);
    for (const x of [-.28, .28]) cabinKit.rod([x, -.3, -barrel + .065], [x, -.3, -barrel + .09], .014, palette.dark);
    for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) cabinKit.box([-.62 + col * .31, .72 + row * .12, -barrel + .09], [.28, .1, .12], row ? 0x4b5452 : 0x5d6764, [0, 0, 0], false);
    for (const x of [-.85, .85]) cabinKit.rod([x, -.5, -barrel + .1], [x, .45, -barrel + .1], .016, palette.gold);
    for (const [x, y, w, h] of [[-.5, 1.35, .9, .5], [.5, 1.35, .9, .5], [0, -1.35, 1.2, .45]]) cabinKit.box([x, y, -barrel + .1], [w, h, .16], 0x505a57, [0, 0, 0], false);
    // Two cabin lamps light the aisle.
    for (const z of [1.1, -1.0]) { const light = new THREE.PointLight(0xf3f6ec, 1.3, 4.5, 1.1); light.position.set(0, .55, z); interior.add(light); }
    const utilities = new THREE.Group(); utilities.name = 'Cabin liner, bulkheads and services'; cabinKit.finish(utilities); interior.add(utilities);

    // Crew: three copies of the supplied human model, each with its own copy of the model's skeleton. A solver placed the
    // hips, chest and head and reached each hand and foot with a two-bone chain that bends like an elbow or a knee: Crew 1's
    // fingertips rest on the laptop keys, Crew 2's hands are through the glovebox ports, Crew 3 floats in the neutral
    // posture of weightlessness. Clothing colours differ per crew member; the shading comes from the model's textures.
    const human = columbusCrewHuman, humanPoints = pmaArray(human.positions, Int16Array), humanPosition = new Float32Array(humanPoints.length);
    for (let i = 0; i < humanPoints.length; i++) humanPosition[i] = humanPoints[i] * human.quantum;
    const humanBones = pmaArray(human.skin, Uint8Array), humanCount = humanPosition.length / 3;
    const humanSkinIndex = new Uint16Array(humanCount * 4), humanSkinWeight = new Float32Array(humanCount * 4);
    for (let i = 0; i < humanCount; i++) {
        const second = humanBones[i * 5 + 3] / 255, third = humanBones[i * 5 + 4] / 255;
        for (let k = 0; k < 3; k++) humanSkinIndex[i * 4 + k] = humanBones[i * 5 + k];
        humanSkinWeight[i * 4] = Math.max(0, 1 - second - third); humanSkinWeight[i * 4 + 1] = second; humanSkinWeight[i * 4 + 2] = third;
    }
    const humanParts = ['skin', 'shirt', 'shorts', 'shoes', 'hair', 'eyes'], humanGroups = humanParts.map(name => pmaArray(human.groups[name], Uint16Array));
    const humanBody = new THREE.BufferGeometry(), humanIndex = new Uint16Array(humanGroups.reduce((count, group) => count + group.length, 0));
    humanBody.setAttribute('position', new THREE.BufferAttribute(humanPosition, 3));
    humanBody.setAttribute('skinIndex', new THREE.BufferAttribute(humanSkinIndex, 4)); humanBody.setAttribute('skinWeight', new THREE.BufferAttribute(humanSkinWeight, 4));
    let humanStart = 0; humanGroups.forEach((group, k) => { humanIndex.set(group, humanStart); humanBody.addGroup(humanStart, group.length, k); humanStart += group.length; });
    humanBody.setIndex(new THREE.BufferAttribute(humanIndex, 1)); humanBody.computeVertexNormals();
    const humanColors = Float32Array.from(pmaArray(human.colors, Uint8Array), value => value / 255);
    humanBody.setAttribute('color', new THREE.BufferAttribute(humanColors, 3));
    const skinBase = human.tones.skin;
    // Stripes run across a shirt by height in the bind pose (6 cm bands), so they stay crisp and follow the body as it bends.
    const humanHeightUv = new THREE.BufferAttribute(new Float32Array(humanCount * 2), 2);
    for (let i = 0; i < humanCount; i++) humanHeightUv.setXY(i, 0, humanPosition[i * 3 + 1] / .12);
    function stripeMap([dark, light]) {
        const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 64; const g = canvas.getContext('2d');
        g.fillStyle = light; g.fillRect(0, 0, 2, 32); g.fillStyle = dark; g.fillRect(0, 32, 2, 32);
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; return texture;
    }
    const humanAxis = list => new THREE.Vector3(...list);
    function crewMember(name, pose, look, place) {
        const geometry = new THREE.BufferGeometry();
        for (const key of ['position', 'normal', 'skinIndex', 'skinWeight']) geometry.setAttribute(key, humanBody.attributes[key]);
        geometry.setAttribute('color', humanBody.attributes.color); if (look.stripes) geometry.setAttribute('uv', humanHeightUv);
        geometry.setIndex(humanBody.index); for (const group of humanBody.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
        // Skin keeps the baked texture, tinted from the model's own tone to this crew member's; fabric takes its colour here.
        const tone = new THREE.Color(look.skin), fabric = hex => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(1 / human.tones.cloth), vertexColors: true, roughness: .88, metalness: .02, side: THREE.DoubleSide });
        const materials = [
            new THREE.MeshStandardMaterial({ color: new THREE.Color(tone.r / skinBase[0], tone.g / skinBase[1], tone.b / skinBase[2]), vertexColors: true, roughness: .6, metalness: .02 }),
            look.stripes ? Object.assign(fabric(0xffffff), { map: stripeMap(look.stripes) }) : fabric(look.shirt), fabric(look.shorts), fabric(look.shoes), fabric(look.hair),
            new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .04 })
        ];
        const bones = human.bones.map(([boneName]) => Object.assign(new THREE.Bone(), { name: boneName }));
        human.bones.forEach(([, parent, x, y, z, qx, qy, qz, qw], i) => { bones[i].position.set(x, y, z); bones[i].quaternion.set(qx, qy, qz, qw); if (parent >= 0) bones[parent].add(bones[i]); });
        const body = new THREE.SkinnedMesh(geometry, materials); body.name = name + ' / body'; body.frustumCulled = false; body.add(bones[0]);
        body.updateMatrixWorld(true); body.bind(new THREE.Skeleton(bones));
        bones.forEach((bone, i) => bone.quaternion.fromArray(human.poses[pose], i * 4)); bones[0].position.fromArray(human.roots[pose]);
        const person = new THREE.Group(); person.name = name; person.add(body);
        person.position.fromArray(place.position); person.rotation.set(0, place.yaw, 0, 'YXZ');
        person.userData.bones = Object.fromEntries(bones.map(bone => [bone.name, bone])); person.userData.boneList = bones; person.userData.yaw = place.yaw;
        person.userData.rest = { position: person.position.clone(), quaternion: person.quaternion.clone(), root: bones[0].position.clone(), bones: Object.fromEntries(bones.map(bone => [bone.name, bone.quaternion.clone()])) };
        interior.add(person); crew.push(person); return person;
    }
    // At the laptop on the outboard rack, leaning in with the fingertips on the keys: green shirt, blue shorts.
    crewMember('Crew 1', 'typist', { skin: 0xc29270, shirt: 0x235f43, shorts: 0x2f5c8c, shoes: 0xe2e2dc, hair: 0x2b2420 }, { position: [-.2, -aisle, 1.39], yaw: -Math.PI / 2 });
    // Floating at the glovebox with one knee raised and both hands through its ports: white shirt, blue shorts.
    crewMember('Crew 2', 'gloves', { skin: 0xd0a07f, shirt: 0xeeede8, shorts: 0x2f6f9a, shoes: 0x2c7d86, hair: 0x2c2622 }, { position: [-.4, -aisle + .1, .45], yaw: -Math.PI / 2 });
    // Floating free in the neutral posture of weightlessness (arms forward, hips and knees bent): striped shirt.
    const crew3 = crewMember('Crew 3', 'floater', { skin: 0xe1b597, stripes: ['#26357e', '#f1f1ec'], shorts: 0x24386f, shoes: 0xf0f0ec, hair: 0x4a3324 }, { position: [0, -.9, 0], yaw: 0 });
    // Crew 3 floats in a group that carries it along the aft wall racks: it holds a rail with one hand and works a panel
    // with the other, pushes off, glides about 0.8 m to the next rail, catches it and works there, then comes back.
    const hover = new THREE.Group(); hover.name = 'Crew 3 float'; hover.add(crew3); interior.add(hover);
    const motion = crewTracksFrom(columbusCrewMotion);
    crewPlay(crew[0], motion.typist, 0); crewPlay(crew3, motion.floater, 0, hover);
    interior.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; } });

    // External payloads on the outboard cone: SOLAR on a tower above, a gold instrument box hanging outboard
    // of the upper deck, and an EuTEF-style instrument pallet below. Shapes follow the illustration only.
    const foilCanvas = document.createElement('canvas'); foilCanvas.width = 256; foilCanvas.height = 256;
    const fg = foilCanvas.getContext('2d'); fg.fillStyle = '#b8962f'; fg.fillRect(0, 0, 256, 256);
    let noiseState = 97; const noise = () => { noiseState = (noiseState * 16807) % 2147483647; return (noiseState - 1) / 2147483646; };
    for (let i = 0; i < 900; i++) {
        const x = noise() * 256, y = noise() * 256;
        fg.fillStyle = ['#e0c562aa', '#6b5423aa', '#f4dc7aaa', '#8e7029aa'][i % 4];
        fg.beginPath(); fg.moveTo(x, y); fg.lineTo(x + 4 + noise() * 16, y - 7); fg.lineTo(x + 12, y + 5); fg.closePath(); fg.fill();
    }
    const foilMap = new THREE.CanvasTexture(foilCanvas); foilMap.colorSpace = THREE.SRGBColorSpace;
    const foil = material(0xffffff, .72, .38, foilMap), khaki = 0xb9a86a, bracketTone = 0xd8dbd4;
    const coneRadius = z => R + (coneR - R) * (z - barrel) / (coneEnd - barrel);
    // Plates of the upper platform and the lower frame: a perforated grid and a waffle grid of square recesses.
    const plateCanvas = draw => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256; draw(canvas.getContext('2d')); const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; };
    const perforated = plateCanvas(g => { g.fillStyle = '#dfe2dd'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) { g.fillStyle = '#7d8582'; g.beginPath(); g.arc(13 + i * 25.6, 13 + j * 25.6, 7.5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#4a5250'; g.beginPath(); g.arc(14, 14, 0, 0, 1); g.fill(); } });
    const waffle = plateCanvas(g => { g.fillStyle = '#e6e8e3'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) { const x = 3 + i * 25.6, y = 3 + j * 25.6, s = g.createLinearGradient(x, y, x + 20, y + 20); s.addColorStop(0, '#9da3a0'); s.addColorStop(1, '#f4f5f1'); g.fillStyle = s; g.fillRect(x, y, 20, 20); g.fillStyle = '#c3c8c4'; g.fillRect(x + 6, y + 6, 8, 8); } });
    const onCone = (x, side, z) => { const r = coneRadius(z); return [x, side * Math.sqrt(Math.max(0, r * r - x * x)), z]; };
    {
        const side = 1, deckY = side * 1.86;
        for (const x of [-.62, .62]) {
            const a = onCone(x, side, 2.78), b = onCone(x, side, 3.3), c = [x, deckY - side * .05, 4.52];
            for (const [p, q] of [[a, b], [a, c], [b, c]]) payloadKit.rod(p, q, .04, bracketTone);
            payloadKit.box(a, [.18, .16, .2], palette.white, [0, 0, 0], false); payloadKit.box(b, [.18, .16, .2], palette.white, [0, 0, 0], false);
        }
        for (const z of [2.78, 3.3]) payloadKit.rod(onCone(-.62, side, z), onCone(.62, side, z), .03, bracketTone);
        payloadKit.rod(onCone(-.62, side, 2.78), onCone(.62, side, 3.3), .025, bracketTone); payloadKit.rod(onCone(.62, side, 2.78), onCone(-.62, side, 3.3), .025, bracketTone);
        payloadKit.add(shapes.box, material(0xffffff, .72, .14, perforated), [0, deckY, 3.78], [1.44, .06, 1.6], [0, 0, 0], false);
        for (const x of [-.72, .72]) payloadKit.rod([x, deckY, 2.98], [x, deckY, 4.58], .028, bracketTone);
        for (let n = 1; n < 6; n++) payloadKit.line([[-.7, deckY + side * .032, 2.98 + n * .267], [.7, deckY + side * .032, 2.98 + n * .267]]);
    }
    // SOLAR: a tapering tower, a gimbal and a tilted gold instrument box with its sensor window.
    const towerBase = [[-.3, 3.5], [.3, 3.5], [.3, 4.1], [-.3, 4.1]], towerTop = [[-.1, 3.7], [.1, 3.7], [.1, 3.9], [-.1, 3.9]], yBase = 1.89, yTop = 2.78;
    towerBase.forEach(([x, z], i) => {
        payloadKit.rod([x, yBase, z], [towerTop[i][0], yTop, towerTop[i][1]], .03, khaki);
        const [nx, nz] = towerBase[(i + 1) % 4];
        payloadKit.rod([x, yBase + .02, z], [nx, yBase + .02, nz], .025, khaki);
        payloadKit.rod([x, yBase, z], [towerTop[(i + 1) % 4][0], yTop, towerTop[(i + 1) % 4][1]], .016, khaki);
    });
    payloadKit.cylinder([0, yTop + .05, 3.8], .09, .5, palette.dark, [0, 0, Math.PI / 2]);
    const solar = new THREE.Group(), sk = new Kit(); solar.position.set(0, yTop + .26, 3.8); solar.rotation.set(-.55, .3, 0);
    sk.add(shapes.box, foil, [0, 0, 0], [.95, .42, .6]);
    sk.box([.12, .214, .05], [.34, .01, .26], 0xeef0ec, [0, 0, 0], false);
    for (let i = 0; i < 4; i++) sk.cylinder([-.3 + i * .07, .215, -.16], .022, .012, palette.dark, [0, 0, 0]);
    sk.cylinder([-.3, .1, .31], .06, .06, palette.white);
    sk.finish(solar); external.add(solar);
    payloadKit.box([.4, 2.02, 3.3], [.36, .26, .34], palette.white); payloadKit.box([-.42, 2.03, 3.35], [.34, .28, .36], 0x2b3033);
    payloadKit.cylinder([.4, 2.06, 4.35], .09, .18, palette.white, [0, 0, 0]);
    // The gold instrument box hangs outboard of the upper deck, its open face holding three white instruments.
    payloadKit.add(shapes.box, foil, [0, 1.3, 4.62], [1.05, .95, 1.2]);
    payloadKit.box([0, 1.3, 5.225], [.86, .74, .02], 0xa9c6d6, [0, 0, 0], false);
    for (const [x, y] of [[-.22, 1.46], [.2, 1.46], [0, 1.12]]) { payloadKit.cylinder([x, y, 5.3], .1, .16, 0xe9ebe6); ring(payloadKit, [x, y, 5.38], .1, 'z', palette.silver, .012); }
    for (const x of [-.5, .5]) payloadKit.rod([x, 1.8, 4.1], [x, 1.83, 4.5], .025, bracketTone);
    // Lower payload frame, after the close-up: an L of white plates below the outboard cone (a waffle-grid wall facing forward and a
    // floor running back under the cone) on triangulated struts. Clusters of finned grey boxes stand off the wall, handhold plates line
    // its top and a long gold-foil box runs outboard beneath them.
    const wallX = .3, wallY = [-1.22, -2.48], wallZ = [3.48, 4.56], floorY = -2.5;
    payloadKit.add(shapes.box, material(0xffffff, .7, .12, waffle), [wallX - .035, (wallY[0] + wallY[1]) / 2, (wallZ[0] + wallZ[1]) / 2], [.07, wallY[0] - wallY[1], wallZ[1] - wallZ[0]], [0, 0, 0], false);
    payloadKit.box([wallX, wallY[0] - .05, (wallZ[0] + wallZ[1]) / 2], [.16, .1, wallZ[1] - wallZ[0] + .1], 0xe9ebe6);
    for (const z of wallZ) payloadKit.box([wallX, (wallY[0] + floorY) / 2, z], [.16, wallY[0] - floorY + .1, .1], 0xe9ebe6);
    payloadKit.add(shapes.box, material(0xffffff, .7, .12, waffle), [-.09, floorY, 3.6], [1.0, .06, 1.92], [0, 0, 0], false);
    payloadKit.box([.41, floorY, 3.6], [.06, .1, 1.94], 0xe9ebe6); payloadKit.box([-.6, floorY, 3.6], [.06, .1, 1.94], 0xe9ebe6);
    const strutTone = 0xe3e5e0, nodes = { c1: onCone(.45, -1, 2.72), c2: onCone(-.45, -1, 2.72), c3: onCone(.25, -1, 3.28), wallTop: [wallX, wallY[0], wallZ[0]], floorFwd: [.41, floorY, 2.68], floorAft: [-.6, floorY, 2.68], floorOut: [-.6, floorY, 4.5] };
    for (const [p, q] of [['c3', 'wallTop'], ['c1', 'wallTop'], ['c1', 'floorFwd'], ['c2', 'floorAft'], ['c2', 'floorOut'], ['c1', 'floorAft']]) payloadKit.rod(nodes[p], nodes[q], .028, strutTone);
    for (const key of ['c1', 'c2', 'c3']) payloadKit.sphere(nodes[key], [.055, .055, .055], strutTone);
    // Finned instrument boxes: a light body, a dark ribbed face toward the viewer and ribs along the top.
    function finnedBox(z, y, w, h, depth) {
        const x = wallX + depth / 2;
        payloadKit.box([x, y, z], [depth, h, w], 0xb7bcb9);
        payloadKit.box([wallX + depth + .006, y, z], [.012, h * .86, w * .86], 0x4d5355, [0, 0, 0], false);
        for (let rib = 0; rib < 6; rib++) payloadKit.box([wallX + depth + .015, y - h * .36 + rib * h * .144, z], [.01, .012, w * .82], 0x8e9593, [0, 0, 0], false);
        for (let rib = 0; rib < 5; rib++) payloadKit.box([x, y + h / 2 + .008, z - w * .36 + rib * w * .18], [depth * .9, .014, .012], 0x7f8684, [0, 0, 0], false);
        for (const s of [-1, 1]) payloadKit.box([x, y, z + s * (w / 2 + .004)], [depth * .92, h * .8, .006], 0x9aa09d, [0, 0, 0], false);
    }
    for (const z of [4.08, 4.38]) for (const y of [-1.58, -1.88]) finnedBox(z, y, .28, .28, .55);
    for (const y of [-1.58, -1.88]) finnedBox(3.68, y, .3, .28, .45);
    for (const z of [3.72, 4.05]) finnedBox(z, -2.24, .3, .3, .5);
    // Handhold plates with four bolt holes and a yellow handrail each, along the top of the wall.
    for (const z of [3.66, 4.02, 4.38]) {
        payloadKit.box([wallX + .01, -1.34, z], [.02, .1, .27], 0xdfe2dd, [0, 0, 0], false);
        for (let k = 0; k < 4; k++) payloadKit.cylinder([wallX + .022, -1.34, z - .09 + k * .06], .016, .006, 0x3c4442, [0, 0, Math.PI / 2]);
        for (const dz of [-.1, .1]) payloadKit.rod([wallX + .02, -1.3, z + dz], [wallX + .08, -1.27, z + dz], .012, 0xe2b81f);
        payloadKit.rod([wallX + .08, -1.27, z - .1], [wallX + .08, -1.27, z + .1], .013, 0xe2b81f);
    }
    payloadKit.add(shapes.box, foil, [.53, -2.26, 4.86], [.46, .28, 1.1]);
    payloadKit.add(shapes.box, foil, [.18, floorY - .1, 3.0], [.34, .14, .32]); payloadKit.cylinder([.18, floorY - .22, 3.0], .07, .12, 0x2f3436, [0, 0, 0]);
    for (const z of [2.9, 3.55]) payloadKit.rod([.41, floorY + .03, z], [.47, floorY + .06, z], .012, 0xe2b81f);
    payloadKit.rod([.47, floorY + .06, 2.9], [.47, floorY + .06, 3.55], .013, 0xe2b81f);
    payloadKit.finish(external);

    group.userData.reconstruction = 'After the ESA cutaway illustration: MMOD shell with a see-through section, square rack aisle, crew and external payloads';
    group.userData.seeThrough = { angleStart: open.a0, angleEnd: open.a1, axialStart: open.z0, axialEnd: open.z1, opacity: .25 };
    group.userData.equipmentRacks = racks.length; group.userData.crewFigures = crew.length; group.userData.externalBrackets = 2;
    group.userData.lab = { tube, shell, interior, framework, racks, crew, external, hover, motion, open };
});
// Columbus crew at work. Crew 1 and Crew 3 play keyed work loops: between keys every bone follows a Catmull-Rom curve
// in time, so the motion flows through the keys rather than stopping at each. On top come breathing, small irregular
// head movements, typing and, for the floating crew member, drifting legs. Crew 2 bobs at the glovebox and works the gloves.
function crewTracksFrom(data) {
    const tracks = {};
    for (const [name, track] of Object.entries(data.tracks)) {
        const raw = pmaArray(track.poses, Int16Array), count = track.times.length;
        tracks[name] = { ...track, count, bones: raw.length / count / 4, quats: Float32Array.from(raw, value => value / 32767) };
    }
    return tracks;
}
// The key segment around `time` (the last key repeats the first) and a Hermite curve through it. Tangents are the
// harmonic mean of the slopes on either side, and zero where a value turns back, so nothing overshoots its keys: a hand
// lands on the keys and stops, while a glide between evenly spaced keys keeps its speed.
function crewCurve(track, time) {
    const cycle = track.cycle, t = ((time % cycle) + cycle) % cycle, times = track.times, n = track.count;
    let i = 0; while (i < n - 2 && t >= times[i + 1]) i++;
    const t0 = times[i], t1 = times[i + 1], dt = t1 - t0, s = (t - t0) / dt, s2 = s * s, s3 = s2 * s;
    const prev = i > 0 ? i - 1 : n - 2, next = i + 2 < n ? i + 2 : 1, tp = i > 0 ? times[i - 1] : times[n - 2] - cycle, tn = i + 2 < n ? times[i + 2] : cycle + times[1];
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = 3 * s2 - 2 * s3, h11 = s3 - s2;
    const tangent = (before, after) => before * after <= 0 ? 0 : 2 / (1 / before + 1 / after);
    return (values, stride, k) => {
        const p0 = values[i * stride + k], p1 = values[(i + 1) * stride + k], slope = (p1 - p0) / dt;
        const m0 = tangent((p0 - values[prev * stride + k]) / (t0 - tp), slope), m1 = tangent(slope, (values[next * stride + k] - p1) / (tn - t1));
        return h00 * p0 + h10 * dt * m0 + h01 * p1 + h11 * dt * m1;
    };
}
// Poses the bones and places the figure: `root` is the group Crew 3 floats in; Crew 1 is offset from its own place.
function crewPlay(person, track, time, root) {
    const curve = crewCurve(track, time), stride = track.bones * 4, r = k => curve(track.root, 6, k);
    person.userData.boneList.forEach((bone, b) => bone.quaternion.set(curve(track.quats, stride, b * 4), curve(track.quats, stride, b * 4 + 1), curve(track.quats, stride, b * 4 + 2), curve(track.quats, stride, b * 4 + 3)).normalize());
    person.userData.boneList[0].position.set(curve(track.hips, 3, 0), curve(track.hips, 3, 1), curve(track.hips, 3, 2));
    if (root) { root.position.set(r(0), r(1), r(2)); root.rotation.set(r(3), r(4), r(5), 'YXZ'); }
    else { const rest = person.userData.rest.position; person.position.set(rest.x + r(0), rest.y + r(1), rest.z + r(2)); person.rotation.set(r(3), person.userData.yaw + r(4), r(5), 'YXZ'); }
    const level = values => values ? THREE.MathUtils.clamp(curve(values, 1, 0), 0, 1) : 0;
    return { type: level(track.type), pad: level(track.pad) };
}
const crewTurn = new THREE.Quaternion(), crewForward = new THREE.Vector3(0, 0, 1);
// How much Crew 1's thought shows (0-1): while he rests his chin on his fist and watches the glovebox.
export const crewThought = { element: document.getElementById('crew-thought'), level: 0 };
const crewAxes = (() => { const a = columbusCrewHuman.axes, v = list => new THREE.Vector3(...list), out = { headYaw: v(a.headYaw), headPitch: v(a.headPitch) };
    for (const group of ['flex', 'elbow', 'wrist']) for (const [bone, axis] of Object.entries(a[group])) out[bone] = v(axis);
    for (const [bone, axis] of Object.entries(columbusCrewMotion.axes)) out[bone] = v(axis); return out; })();
export function updateColumbusCrew(time) {
    const { crew: [typist, gloves, floater], hover, motion } = parts.get('columbus').group.userData.lab;
    // Each turn is applied on top of the solved pose, about a bone-local axis.
    const turn = (person, bone, ...steps) => {
        const target = person.userData.bones[bone]; target.quaternion.copy(person.userData.rest.bones[bone]);
        for (const [axis, angle] of steps) target.quaternion.multiply(crewTurn.setFromAxisAngle(axis, angle));
    };
    const add = (person, bone, axis, angle) => person.userData.bones[bone].quaternion.multiply(crewTurn.setFromAxisAngle(axis, angle));
    const look = (person, yaw, pitch) => turn(person, 'Head', [crewAxes.headYaw, yaw], [crewAxes.headPitch, pitch]);
    const work = crewPlay(typist, motion.typist, time); crewPlay(floater, motion.floater, time, hover);
    const turnTime = time % motion.typist.cycle;
    crewThought.level = THREE.MathUtils.smoothstep(turnTime, 17.9, 18.3) - THREE.MathUtils.smoothstep(turnTime, 21, 21.4);
    // Breathing (about 4 s a breath) and small head movements that never quite repeat.
    for (const [person, rate, phase] of [[typist, 1.5, 0], [floater, 1.37, 1.1]]) {
        const breath = Math.sin(time * rate + phase);
        add(person, 'Spine1', crewAxes.Spine1, .006 * breath); add(person, 'Spine2', crewAxes.Spine2, .01 * breath);
        add(person, 'Head', crewAxes.headYaw, .018 * Math.sin(time * .53 + phase) + .01 * Math.sin(time * 1.31 + 2 * phase));
        add(person, 'Head', crewAxes.headPitch, .012 * Math.sin(time * .71 + phase) + .007 * Math.sin(time * 1.7 + phase));
    }
    // Crew 1 types in bursts while `type` is up: each finger lifts off its key and comes back down onto it, finger by
    // finger (the solved keys rest the fingertips on the key tops). It taps the touchpad while `pad` is up.
    const burst = THREE.MathUtils.smoothstep(Math.sin(time * .55), -.2, .5), tap = phase => burst * Math.max(0, Math.sin(time * 9 + phase)) ** 2;
    for (const [side, offset] of [['Left', 0], ['Right', 2.1]]) {
        [['Index', 0], ['Middle', 1.3], ['Ring', 2.6]].forEach(([finger, delay]) => {
            const k = tap(offset + delay) * work.type, base = side + 'Hand' + finger;
            add(typist, base + '1', crewAxes[base + '1'], -.26 * k); add(typist, base + '2', crewAxes[base + '2'], -.1 * k);
        });
        add(typist, side + 'Hand', crewAxes[side + 'Hand'], -.03 * tap(offset + .6) * work.type);
    }
    add(typist, 'RightHandIndex1', crewAxes.RightHandIndex1, .16 * work.pad * Math.max(0, Math.sin(time * 4.5)) ** 3);
    // Crew 3's legs drift a little on their own: knees and hips out of step.
    add(floater, 'LeftLeg', crewAxes.LeftLeg, .07 * Math.sin(time * .47)); add(floater, 'RightLeg', crewAxes.RightLeg, .06 * Math.sin(time * .39 + 1.9));
    add(floater, 'LeftUpLeg', crewAxes.LeftUpLeg, .035 * Math.sin(time * .31 + .7)); add(floater, 'RightUpLeg', crewAxes.RightUpLeg, .03 * Math.sin(time * .43 + 2.4));
    gloves.position.copy(gloves.userData.rest.position); gloves.position.y += .012 * Math.sin(time * .7);
    gloves.quaternion.copy(gloves.userData.rest.quaternion).multiply(crewTurn.setFromAxisAngle(crewForward, .015 * Math.sin(time * .5)));
    turn(gloves, 'LeftForeArm', [crewAxes.LeftForeArm, .06 * Math.sin(time * 1.1)]); turn(gloves, 'RightForeArm', [crewAxes.RightForeArm, .06 * Math.sin(time * 1.1 + 1.7)]);
    look(gloves, .05 * Math.sin(time * .45), .02 * Math.sin(time * .6));
}
