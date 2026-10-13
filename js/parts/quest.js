// Quest airlock.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { Kit, material, palette, shapes, vertical } from '../core/kit.js';
import { part, ring } from '../core/station.js';
import { referencePassiveCBM } from '../core/cbm.js';
import { carrierGrid, payloadBlanket, payloadPillow } from '../core/surfaces.js';

part('quest', 'Quest airlock', '11 / EXTRAVEHICULAR ACTIVITY', 'A wide equipment lock connects Unity to the narrower crew lock. The EVA hatch faces below the crew lock inside a circular handrail, two blanketed tool containers ride on the opposite side, and five pentagonal gas-tank covers with bronze tri-lobe fittings surround the equipment lock. ESP-2 sits beside the airlock with a gridded pallet, six blanketed equipment boxes, corner trunnions and a grapple fixture. Exterior details follow the supplied references.', [['Joined station', '2001'], ['Chambers', 'Equipment + crew lock']], [5.15, 2.12, 12], (kit, group) => {
    // Reference-only reconstruction: keep the Unity interface fixed.
    group.userData.referenceViews = 7;
    group.userData.highPressureGasTanks = 5;
    group.userData.facetedTankCovers = 5;
    group.userData.tankCoverSection = 'Pentagon: flat face on the equipment lock, ridge outward';
    group.userData.toolContainers = 2;
    group.userData.evaHatch = { center: [7.37, -1.12, 12], radius: .73, normal: [0, -1, 0], window: false, handrail: 'Full ring on eight posts' };
    group.userData.unityInterface = [3.04, 0, 12];
    // The passive cuff follows the supplied Quest CBM profile. Its root enters
    // the existing equipment-lock shoulder without changing either airlock chamber.
    const unityCollar = new THREE.Group(), unityCollarKit = new Kit();
    unityCollar.name = 'Quest / Unity passive CBM';
    unityCollar.position.z = 12; unityCollar.rotation.y = Math.PI / 2;
    unityCollar.userData.cbm = referencePassiveCBM(unityCollarKit, 3.441, -1);
    unityCollarKit.finish(unityCollar); group.add(unityCollar);

    group.userData.equipmentLock = { start: 3.63, end: 5.69, radius: 2.10 };
    group.userData.crewLock = { start: 6.04, end: 8.76, radius: .96, collarRadius: 1.12 };
    group.userData.outboardFace = 'Closed cap: four quadrant panels under gold X straps and eight latches; no axial docking port';
    const tan = 0xb39a74, gold = material(0xc2a25a, .38, .55), bronze = material(0xa2865e, .45, .45), trim = 0xc3cacb, inset = 0xaab4b7, recess = 0x4a545b;
    const fastenerShape = new THREE.SphereGeometry(1, 8, 6);
    // Light, matte white-silver skin with soft handling marks and fine scuffs, after the reference views.
    const texCanvas = document.createElement('canvas'); texCanvas.width = 512; texCanvas.height = 512;
    const ctx = texCanvas.getContext('2d'); ctx.fillStyle = '#e2e5e4'; ctx.fillRect(0, 0, 512, 512);
    let seed = 11; const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < 90; i++) {
        const x = rand() * 512, y = rand() * 512, r = 12 + rand() * 60, dark = rand() > .35, spot = ctx.createRadialGradient(x, y, 0, x, y, r);
        spot.addColorStop(0, dark ? `rgba(118,126,131,${.03 + rand() * .045})` : `rgba(255,255,255,${.06 + rand() * .08})`); spot.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = spot; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    for (let i = 0; i < 160; i++) {
        const x = rand() * 512, y = rand() * 512, l = 3 + rand() * 14, a = rand() * Math.PI;
        ctx.strokeStyle = `rgba(90,98,104,${.04 + rand() * .08})`; ctx.lineWidth = .6 + rand(); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    const skin = new THREE.CanvasTexture(texCanvas); skin.colorSpace = THREE.SRGBColorSpace; skin.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const shell = material(0xf1f3f2, .66, .14, skin), shield = material(0xffffff, .62, .12, skin), shadowShield = material(0xe0e4e4, .64, .14, skin), white = material(0xf4f4f0, .7, .08, skin);
    const on = (x, radius, angle) => [x, radius * Math.cos(angle), 12 + radius * Math.sin(angle)];
    const facing = normal => new THREE.Quaternion().setFromUnitVectors(vertical, new THREE.Vector3(...normal).normalize());
    function patch(x0, x1, r0, r1, a0, a1, surface) {
        const pos = [], uv = [], steps = 8;
        for (let i = 0; i < steps; i++) {
            const a = a0 + (a1 - a0) * i / steps, b = a0 + (a1 - a0) * (i + 1) / steps;
            const points = [on(x0, r0, a), on(x0, r0, b), on(x1, r1, a), on(x1, r1, b)];
            const order = x0 === x1 && r1 > r0 ? [0, 2, 1, 2, 3, 1] : [0, 1, 2, 2, 1, 3];
            for (const j of order) { pos.push(...points[j]); uv.push(j > 1 ? 1 : 0, j % 2 ? (i + 1) / steps : i / steps); }
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); kit.add(g, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    function curve(x, radius, a0, a1, tube = .014, color = trim) {
        const points = []; for (let i = 0; i <= 10; i++)points.push(new THREE.Vector3(...on(x, radius, a0 + (a1 - a0) * i / 10)));
        kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 10, tube, 5, false), material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    function framedTile(x0, x1, r, a0, a1, surface, braces = false) {
        patch(x0, x1, r, r, a0, a1, surface);
        for (const a of [a0, a1]) kit.rod(on(x0, r + .025, a), on(x1, r + .025, a), .019, trim);
        for (const x of [x0, x1]) curve(x, r + .025, a0, a1, .018);
        // An inset pressed-metal frame and shallow diagonals match the large lock's panels.
        const da = (a1 - a0) * .105, dx = (x1 - x0) * .09;
        for (const a of [a0 + da, a1 - da]) kit.rod(on(x0 + dx, r + .033, a), on(x1 - dx, r + .033, a), .011, inset);
        for (const x of [x0 + dx, x1 - dx]) curve(x, r + .033, a0 + da, a1 - da, .011, inset);
        if (braces) for (const reverse of [false, true]) for (let i = 0; i < 6; i++) {
            const point = t => on(x0 + dx + (x1 - x0 - 2 * dx) * t, r + .047, reverse ? a1 - da - (a1 - a0 - 2 * da) * t : a0 + da + (a1 - a0 - 2 * da) * t);
            kit.rod(point(i / 6), point((i + 1) / 6), .013, inset);
        }
        for (const x of [x0 + .07, x1 - .07]) for (const a of [a0 + .035, a1 - .035]) kit.add(fastenerShape, material(0xdee5e4), on(x, r + .035, a), [.022, .022, .022], [0, 0, 0], false);
    }
    // A round port: pale ring around a dark centre, flush on a surface with the given outward normal.
    function port(at, normal, radius = .11) {
        const q = facing(normal), n = new THREE.Vector3(...normal).normalize(), p = new THREE.Vector3(...at);
        kit.add(new THREE.CylinderGeometry(radius, radius, .02, 20).applyQuaternion(q), material(0xf3f3ef, .6, .08), p.clone().addScaledVector(n, .01).toArray(), [1, 1, 1], [0, 0, 0], false);
        kit.add(new THREE.CylinderGeometry(radius * .5, radius * .5, .024, 16).applyQuaternion(q), material(0x3a4147, .5, .3), p.clone().addScaledVector(n, .014).toArray(), [1, 1, 1], [0, 0, 0], false);
    }
    // A tan edge clip; its local y follows the radial direction at `angle` (size: axial, radial, tangential).
    const clip = (x, radius, angle, size) => kit.box(on(x, radius, angle), size, tan, [angle, 0, 0], false);
    // Short, concentric neck seats on Unity's existing starboard flange.
    kit.cylinder([3.22, 0, 12], .84, .36, 0xd4d9da, [0, 0, Math.PI / 2]);
    for (const x of [3.055, 3.38]) ring(kit, [x, 0, 12], .84, 'x', x < 3.1 ? recess : trim, .045);
    const profile = [[0, 3.39], [.87, 3.39], [1.98, 3.57], [2.10, 3.63], [2.10, 5.69], [2.05, 5.78], [1.10, 6.015], [.96, 6.04], [.96, 8.76], [0, 8.76]];
    kit.add(new THREE.LatheGeometry(profile.map(([radius, x]) => new THREE.Vector2(radius, x)), 64), shell, [0, 0, 12], [1, 1, 1], [0, 0, -Math.PI / 2], false);
    // Two axial rows of curved, cross-braced panels around the equipment lock; panels clear of the tank covers carry round ports.
    for (let belt = 0; belt < 12; belt++)for (let row = 0; row < 2; row++) {
        const a = belt * Math.PI / 6 + .035, b = a + Math.PI / 6 - .070, x = 3.68 + row * 1.005, mid = (a + b) / 2;
        framedTile(x, x + .92, 2.117, a, b, belt % 3 === 0 ? shadowShield : shield, true);
        if ((row === 0 ? [0, 2, 9, 11] : [2, 9]).includes(belt)) port(on(x + .24, 2.168, mid), [0, Math.cos(mid), Math.sin(mid)]);
    }
    for (const x of [3.63, 4.66, 5.70]) {
        ring(kit, [x, 0, 12], 2.12, 'x', trim, .043);
        ring(kit, [x + .063, 0, 12], 2.119, 'x', inset, .015);
    }
    // Tan clips straddle the front rim where the drum meets its annular bulkhead.
    for (let k = 0; k < 24; k++)clip(5.70, 2.15, k * Math.PI / 12 + Math.PI / 24, [.16, .06, .13]);
    // Wide shallow annular bulkhead, divided into radial trapezoid shields with round ports and small vents.
    const coneX = r => 5.794 + (2.04 - r) * .25;
    const coneFrame = angle => { const c = Math.cos(angle), s = Math.sin(angle); return new THREE.Matrix4().makeBasis(new THREE.Vector3(.970, .243 * c, .243 * s), new THREE.Vector3(-.243, .970 * c, .970 * s), new THREE.Vector3(0, -s, c)); };
    const onCone = (geometry, r, angle, lift, color) => { const n = new THREE.Vector3(.970, .243 * Math.cos(angle), .243 * Math.sin(angle)); kit.add(geometry.applyMatrix4(coneFrame(angle)), material(color), new THREE.Vector3(...on(coneX(r), r, angle)).addScaledVector(n, lift).toArray(), [1, 1, 1], [0, 0, 0], false); };
    for (let sector = 0; sector < 16; sector++) {
        const a = sector * Math.PI / 8 + .02, b = a + Math.PI / 8 - .04, mid = (a + b) / 2;
        patch(5.794, 6.024, 2.04, 1.12, a, b, sector % 4 === 0 ? shadowShield : shield);
        for (const angle of [a, b]) kit.rod(on(5.809, 2.03, angle), on(6.039, 1.13, angle), .019, trim);
        curve(5.815, 1.99, a, b, .014, trim); curve(6.028, 1.16, a, b, .016, trim);
        if (sector % 2 === 0) { const r = 1.62; port(new THREE.Vector3(...on(coneX(r), r, mid)).toArray(), [.970, .243 * Math.cos(mid), .243 * Math.sin(mid)], .1); }
        else for (const r of [1.46, 1.80]) onCone(new THREE.BoxGeometry(.03, .15, .06), r, mid, .012, recess);
    }
    ring(kit, [5.787, 0, 12], 2.06, 'x', trim, .035);
    for (let k = 0; k < 12; k++)onCone(new THREE.BoxGeometry(.04, .10, .12), 1.26, k * Math.PI / 6 + Math.PI / 12, .02, tan);
    // A broad collar seats the crew lock on the bulkhead.
    kit.add(new THREE.CylinderGeometry(1.12, 1.12, .22, 48, 1), shell, [6.15, 0, 12], [1, 1, 1], [0, 0, Math.PI / 2], false);
    for (const x of [6.045, 6.255]) ring(kit, [x, 0, 12], 1.12, 'x', trim, .03);
    ring(kit, [6.27, 0, 12], 1.0, 'x', recess, .022);
    for (let k = 0; k < 8; k++)clip(6.15, 1.14, k * Math.PI / 4 + Math.PI / 8, [.12, .05, .12]);
    // Long slim crew lock: four axial bays and eight shield strips.
    for (let belt = 0; belt < 8; belt++)for (let row = 0; row < 4; row++) {
        const a = belt * Math.PI / 4 + .04, x = 6.31 + row * .60;
        framedTile(x, x + .55, .977, a, a + Math.PI / 4 - .08, belt % 3 === 0 ? shadowShield : shield);
    }
    for (const x of [6.285, 6.885, 7.485, 8.085]) ring(kit, [x, 0, 12], .995, 'x', trim, .027);
    ring(kit, [8.74, 0, 12], 1.0, 'x', trim, .04);
    for (let k = 0; k < 8; k++)clip(8.72, 1.035, k * Math.PI / 4 + Math.PI / 8, [.12, .05, .12]);
    // Outboard cap: four quadrant panels under gold X straps, a central hub and eight black latches.
    kit.cylinder([8.786, 0, 12], .968, .060, recess, [0, 0, Math.PI / 2]);
    for (let quadrant = 0; quadrant < 4; quadrant++) {
        const a = quadrant * Math.PI / 2 + Math.PI / 4 + .05, b = a + Math.PI / 2 - .10;
        patch(8.823, 8.823, .13, .90, a, b, shield);
        curve(8.83, .88, a, b, .016, trim); curve(8.83, .15, a, b, .014, trim);
    }
    for (let k = 0; k < 4; k++) { const angle = Math.PI / 4 + k * Math.PI / 2; kit.add(shapes.box, gold, on(8.842, .52, angle), [.03, .78, .075], [angle, 0, 0], false); }
    for (let k = 0; k < 8; k++) { const angle = Math.PI / 8 + k * Math.PI / 4; kit.box(on(8.838, .80, angle), [.03, .10, .05], 0x1e2328, [angle, 0, 0], false); }
    kit.cylinder([8.855, 0, 12], .12, .05, trim, [0, 0, Math.PI / 2]);
    kit.cylinder([8.885, 0, 12], .06, .03, recess, [0, 0, Math.PI / 2]);
    ring(kit, [8.822, 0, 12], .954, 'x', trim, .032);
    // Five pentagonal gas-tank covers: a flat face rests on the equipment lock and the ridge points outward.
    const tankShape = new THREE.Shape();
    tankShape.moveTo(-.62, 0); tankShape.lineTo(.62, 0); tankShape.lineTo(.62, .60); tankShape.lineTo(0, 1.04); tankShape.lineTo(-.62, .60); tankShape.closePath();
    const tankGeometry = new THREE.ExtrudeGeometry(tankShape, { depth: 1.57, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 2, steps: 1 });
    const tankAngles = [Math.atan2(-1.63, 1.50), Math.atan2(1.63, 1.50), Math.atan2(-1.62, -1.55), Math.PI, Math.atan2(1.62, -1.55)];
    const tankInner = 2.23, tankFace = 5.465;
    for (const angle of tankAngles) {
        const radial = new THREE.Vector3(0, Math.cos(angle), Math.sin(angle)), across = new THREE.Vector3(0, Math.sin(angle), -Math.cos(angle));
        kit.add(tankGeometry.clone().applyMatrix4(new THREE.Matrix4().makeBasis(across, radial, new THREE.Vector3(1, 0, 0))), white, [3.855, radial.y * tankInner, 12 + radial.z * tankInner], [1, 1, 1], [0, 0, 0], false);
        // Saddles carry each cover clear of the braced panels.
        for (const x of [3.99, 5.26]) kit.box(on(x, 2.20, angle), [.23, .07, .66], 0xc5ccce, [angle, 0, 0], false);
        // Bronze tri-lobe fitting in a pale disc on the outboard end, with a dark handling slot toward the ridge.
        const fitting = on(tankFace, tankInner + .50, angle);
        ring(kit, fitting, .17, 'x', tan, .026);
        kit.cylinder([tankFace + .004, fitting[1], fitting[2]], .15, .02, 0xefe8d6, [0, 0, Math.PI / 2]);
        for (let k = 0; k < 3; k++) { const phi = angle + k * 2 * Math.PI / 3; kit.add(shapes.box, bronze, [tankFace + .02, fitting[1] + .065 * Math.cos(phi), fitting[2] + .065 * Math.sin(phi)], [.025, .12, .045], [phi, 0, 0], false); }
        kit.add(shapes.cylinder, bronze, [tankFace + .03, fitting[1], fitting[2]], [.03, .04, .03], [0, 0, Math.PI / 2], false);
        kit.box(on(tankFace + .004, tankInner + .82, angle), [.02, .16, .045], recess, [angle, 0, 0], false);
    }
    // Tan handholds run along the exposed side of both locks.
    for (const angle of [-Math.PI / 2, Math.PI / 2]) {
        for (const [x0, x1, radius] of [[3.80, 4.48, 2.22], [4.85, 5.53, 2.22], [6.37, 6.71, 1.08], [7.53, 7.89, 1.08], [8.21, 8.55, 1.08]]) {
            kit.rod(on(x0, radius, angle), on(x1, radius, angle), .024, tan);
            for (const x of [x0, x1]) kit.rod(on(x, radius - .12, angle), on(x, radius, angle), .021, tan);
        }
    }
    // Bronze half-dome fittings with short stems sit low on both sides of the drum.
    for (const a of [Math.PI / 2 + .30, -Math.PI / 2 - .30]) for (const x of [3.95, 5.05]) {
        const q = facing([0, Math.cos(a), Math.sin(a)]);
        kit.add(new THREE.BoxGeometry(.30, .05, .30).applyQuaternion(q), material(0xb6bdbf), on(x, 2.19, a), [1, 1, 1], [0, 0, 0], false);
        kit.add(new THREE.SphereGeometry(.15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).applyQuaternion(q), bronze, on(x, 2.21, a), [1, 1, 1], [0, 0, 0], false);
        kit.add(new THREE.CylinderGeometry(.02, .02, .16, 8).applyQuaternion(q), material(0xe8ebea), on(x, 2.43, a), [1, 1, 1], [0, 0, 0], false);
        kit.add(new THREE.BoxGeometry(.14, .025, .03).applyQuaternion(q), material(0xe8ebea), on(x, 2.51, a), [1, 1, 1], [0, 0, 0], false);
    }
    // Two blanketed tool containers stand on short posts opposite the EVA hatch.
    for (const x of [6.78, 7.91]) {
        kit.add(payloadPillow, payloadBlanket, [x, 1.21, 12], [.9, .36, 1.2]);
        for (const dz of [-.3, .3]) kit.box([x, 1.402, 12 + dz], [.92, .02, .035], 0x6d7478, [0, 0, 0], false);
        for (const dz of [-.45, .45]) for (const dx of [-.3, .3]) kit.box([x + dx, .945, 12 + dz], [.12, .16, .10], trim, [0, 0, 0], false);
    }
    // A square mounting pad and broad circular EVA hatch face nadir inside a full handrail ring on eight posts.
    kit.box([7.37, -.922, 12], [1.72, .15, 1.72], 0xe3e6e4, [0, 0, 0], false);
    kit.cylinder([7.37, -1.045, 12], .79, .12, trim, [0, 0, 0]);
    ring(kit, [7.37, -1.11, 12], .754, 'y', recess, .026);
    kit.cylinder([7.37, -1.13, 12], .722, .060, 0xeceeec, [0, 0, 0]);
    kit.sphere([7.37, -1.163, 12], [.709, .033, .709], 0xe6e9e6);
    ring(kit, [7.37, -1.176, 12], .715, 'y', trim, .019);
    for (let bolt = 0; bolt < 16; bolt++) {
        const a = bolt * Math.PI / 8;
        kit.add(shapes.lowCylinder, material(0x8d9aa0), [7.37 + .77 * Math.cos(a), -1.141, 12 + .77 * Math.sin(a)], [.020, .026, .020], [0, 0, 0], false);
    }
    for (const dx of [-.78, .78]) {
        kit.box([7.37 + dx, -1.12, 12], [.19, .13, .19], trim, [0, 0, 0], false);
        kit.cylinder([7.37 + dx, -1.16, 12], .052, .21, 0x8f9ea3);
    }
    const railPoints = []; for (let i = 0; i < 48; i++) { const a = i * Math.PI * 2 / 48; railPoints.push(new THREE.Vector3(7.37 + .98 * Math.cos(a), -1.30, 12 + .98 * Math.sin(a))); }
    kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPoints, true), 72, .026, 8, true), material(0xd6dbdc, .5, .35), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4; kit.rod([7.37 + .98 * Math.cos(a), -1.30, 12 + .98 * Math.sin(a)], [7.37 + .84 * Math.cos(a), -.998, 12 + .84 * Math.sin(a)], .022, trim); }
    // ESP-2, measured from ISS_stationary.glb node98. Keep the existing Quest
    // shell untouched; the short standoffs clear its reconstructed external fittings.
    const espReference = {"frame":{"center":[-2.433600425720215,-0.4962615966796875,1.7574214935302734],"size":[4.408411026000977,0.24416431784629822,2.745187759399414]},"boxes":[{"center":[-3.5902554988861084,-0.10363024473190308,1.2221364974975586],"size":[0.9028515815734863,0.4220227003097534,1.6528005599975586],"face":"+Y"},{"center":[-2.021188259124756,-0.0003467947244644165,1.7136070728302002],"size":[1.6819241046905518,0.710566520690918,1.3688387870788574],"face":"+Y"},{"center":[-3.784752368927002,-1.0977609157562256,1.735267162322998],"size":[0.6535656452178955,0.8625581860542297,0.6535673141479492],"face":"-Y"},{"center":[-2.432023048400879,-0.940069317817688,2.3394360542297363],"size":[1.109541416168213,0.5471722483634949,1.1171400547027588],"face":"-Y"},{"center":[-2.432023525238037,-0.8260753154754639,1.1709983348846436],"size":[0.7371609210968018,0.3191828727722168,0.9385504722595215],"face":"-Y"},{"center":[-0.9995006322860718,-1.0331650972366333,1.951857566833496],"size":[1.1475398540496826,0.7105661034584045,1.101944923400879],"face":"-Y"}],"feet":[{"center":[-3.6631579399108887,-0.3444088101387024,1.3100090026855469],"size":[0.9423494338989258,0.05954298377037048,1.3216943740844727]},{"center":[-2.0216450691223145,-0.3444088101387024,1.7162699699401855],"size":[1.7935054302215576,0.05954298377037048,1.497121810913086]},{"center":[-3.7885518074035645,-0.6424136757850647,1.761866569519043],"size":[0.7523620128631592,0.048140525817871094,0.8739538192749023]},{"center":[-2.435823440551758,-0.6424142718315125,2.3517727851867676],"size":[1.2539336681365967,0.0481414794921875,1.2178096771240234]},{"center":[-2.4282236099243164,-0.6424145698547363,1.1275675296783447],"size":[0.843555212020874,0.04814213514328003,1.1546063423156738]},{"center":[-0.9995009899139404,-0.6481137275695801,1.9480582475662231],"size":[1.2691335678100586,0.05954068899154663,1.231135606765747]}],"cleats":[{"center":[-4.664804935455322,-0.4964250326156616,0.5673933029174805],"size":[0.05399799346923828,0.2622762620449066,0.3614788055419922]},{"center":[-4.664804935455322,-0.4964250326156616,2.9474501609802246],"size":[0.05399799346923828,0.2622762620449066,0.3614790439605713]},{"center":[-0.20239615440368652,-0.4964250326156616,0.5673935413360596],"size":[0.05399799346923828,0.2622762620449066,0.3614792823791504]},{"center":[-0.20239615440368652,-0.4964250326156616,2.9474499225616455],"size":[0.05399799346923828,0.2622762620449066,0.3614788055419922]}],"brackets":[{"center":[-4.758139610290527,-0.6091766953468323,0.5177109241485596],"size":[0.1326732635498047,0.4085850417613983,0.6345868110656738]},{"center":[-4.758139610290527,-0.6091766953468323,2.9971330165863037],"size":[0.1326732635498047,0.4085850417613983,0.6345868110656738]},{"center":[-0.10906112194061279,-0.6091766953468323,0.5177114009857178],"size":[0.13267254829406738,0.4085850417613983,0.6345868110656738]},{"center":[-0.10906112194061279,-0.6091766953468323,2.9971327781677246],"size":[0.13267254829406738,0.4085850417613983,0.6345870494842529]}],"pins":[{"center":[-4.925086498260498,-0.496174693107605,0.517711877822876],"size":[0.20816898345947266,0.0690336525440216,0.06903505325317383]},{"center":[-4.925086498260498,-0.496174693107605,2.997133731842041],"size":[0.20816898345947266,0.0690336525440216,0.06903505325317383]},{"center":[0.05788600444793701,-0.496174693107605,0.5177106857299805],"size":[0.20816874504089355,0.0690336525440216,0.06903457641601562]},{"center":[0.05788600444793701,-0.496174693107605,2.9971323013305664],"size":[0.20816874504089355,0.0690336525440216,0.06903457641601562]}],"grapple":{"center":[-2.232088565826416,-0.49725794792175293,3.2567856311798096],"size":[0.5948470830917358,0.5948482751846313,0.006696224212646484]},"grappleBracket":{"center":[-2.2320871353149414,-0.4962625503540039,3.1169278621673584],"size":[0.15496325492858887,0.24416318535804749,0.2730722427368164]},"attachments":[{"outline":[[-1.9931000471115112,-0.10599999874830246],[-1.9393999576568604,-0.15970000624656677],[-1.6650999784469604,-0.15770000219345093],[-1.5784000158309937,-0.25360000133514404],[-1.5780999660491943,-0.5077000260353088],[-1.363700032234192,-0.767300009727478],[-1.363700032234192,-1.197700023651123],[-1.1562999486923218,-1.197700023651123],[-1.1562999486923218,-0.767300009727478],[-0.9336000084877014,-0.5077000260353088],[-0.9344000220298767,-0.25360000133514404],[-0.8471999764442444,-0.15770000219345093],[0.04899999871850014,-0.15440000593662262],[0.13009999692440033,-0.09399999678134918],[0.16179999709129333,0.0034000000450760126],[0.13009999692440033,0.10090000182390213],[0.04580000042915344,0.16120000183582306],[-1.9393999576568604,0.1573999971151352],[-1.9937000274658203,0.10170000046491623]],"z":0.06809234619140625,"depth":0.10898256301879883},{"outline":[[-1.3772000074386597,-1.1155999898910522],[-1.114799976348877,-1.1155999898910522],[-0.642300009727478,-0.8173999786376953],[-0.64410001039505,-0.009200000204145908],[-1.2101999521255493,0.21629999577999115],[-1.2888000011444092,0.21629999577999115],[-1.8543000221252441,-0.00839999970048666],[-1.8526999950408936,-0.8198000192642212]],"z":0.3444395065307617,"depth":0.1089468002319336}],"posts":[{"center":[0.0,-8.940696716308594e-08,0.11682701110839844],"size":[0.2899947166442871,0.2899962067604065,0.23365402221679688]},{"center":[-1.257485270500183,1.043081283569336e-07,0.17221975326538086],"size":[0.2899954319000244,0.2899964153766632,0.3444404602050781]}]};
    const esp2 = new THREE.Group(), espKit = new Kit();
    esp2.name = 'Quest / ESP-2 external stowage platform';
    esp2.position.set(3.9005081398, -.3388640347, 9.5834058433);
    esp2.rotation.y = Math.PI;
    esp2.scale.set(.9914940659, .9131470520, .9131470520);
    esp2.userData.source = 'ISS_stationary.glb / node98';
    esp2.userData.reference = espReference;
    esp2.userData.shellClearanceOffset = .20;
    esp2.userData.grid = [9, 6];
    const frameColor = 0x8c9183, frameEdge = 0xb4b9ab;
    // The scalloped long edges end in four projecting corner shoulders.
    const frameOutline = [[-4.637806,.384828],[-4.48986,.384828],[-4.26299,.53445],[-.60422,.53445],[-.37734,.384828],[-.229395,.384828],[-.229395,3.130015],[-.37734,3.130015],[-.60422,2.98039],[-4.26299,2.98039],[-4.48986,3.130015],[-4.637806,3.130015]];
    const frameShape = new THREE.Shape(frameOutline.map(([x, z]) => new THREE.Vector2(x, z)));
    frameShape.closePath();
    espKit.add(new THREE.ExtrudeGeometry(frameShape, { depth: .24416432, bevelEnabled: false }), material(frameColor, .72, .25), [0, -.37417945, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
    // The shared recessed 9-by-6 grid, on both faces.
    const gridSkin = material(0xffffff, .86, .12, carrierGrid);
    // Each grid stands 4 mm off its frame face; at 0.4 mm the two surfaces fought for the same depth.
    const frameTop = -.37417945, frameBottom = frameTop - .24416432;
    for (const side of [-1, 1]) {
        const y = side > 0 ? frameTop + .004 : frameBottom - .004;
        espKit.add(new THREE.PlaneGeometry(4.17, 2.36), gridSkin, [-2.43360043, y, 1.75742149], [1, 1, 1], [side > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0], false);
        for (let i = 0; i < frameOutline.length; i++) {
            const a = frameOutline[i], b = frameOutline[(i + 1) % frameOutline.length];
            espKit.rod([a[0], y + side * .006, a[1]], [b[0], y + side * .006, b[1]], .013, frameEdge);
        }
    }
    // Thin equipment adapter plates contact each outer face of the pallet.
    for (const foot of espReference.feet) espKit.box(foot.center, foot.size, 0xb7bdaf);
    // Six thermal-covered ORUs: four face the reference camera and two sit behind.
    const oruAssemblies = [];
    espReference.boxes.forEach((box, index) => {
        const unit = new THREE.Group(), unitKit = new Kit();
        unit.name = 'ESP-2 blanketed equipment ' + (index + 1);
        unit.userData.referenceBox = box;
        const [x, y, z] = box.center, [w, h, d] = box.size, side = box.face === '+Y' ? 1 : -1;
        unitKit.add(shapes.box, payloadBlanket, box.center, box.size);
        const faceY = y + side * h / 2;
        for (const dx of [-w * .455, w * .455]) unitKit.rod([x + dx, faceY + side * .007, z - d * .44], [x + dx, faceY + side * .007, z + d * .44], .006, 0xc0c6be);
        for (const dz of [-d * .455, d * .455]) unitKit.rod([x - w * .44, faceY + side * .007, z + dz], [x + w * .44, faceY + side * .007, z + dz], .006, 0xc0c6be);
        // Low U-shaped handling straps stand off the blankets, with visible sewn feet.
        for (const dx of [-w * .25, w * .25]) {
            const zz = Math.min(.16, d * .20), lift = side * .031;
            const points = [[x + dx, faceY, z - zz], [x + dx, faceY + lift, z - zz * .73], [x + dx, faceY + lift, z + zz * .73], [x + dx, faceY, z + zz]];
            for (let i = 1; i < points.length; i++) unitKit.rod(points[i - 1], points[i], .010, 0x69706a);
            for (const dz of [-zz, zz]) unitKit.box([x + dx, faceY + side * .006, z + dz], [.051, .013, .065], 0xb1b7ae, [0, 0, 0], false);
        }
        // A pair of handles on the tall sidewall remains visible in oblique views.
        if (h > .5) for (const dz of [-d * .22, d * .22]) {
            const xx = x + w / 2 + .024;
            unitKit.rod([xx, y - h * .14, z + dz], [xx, y + h * .14, z + dz], .01, 0x69706a);
            for (const yy of [y - h * .14, y + h * .14]) unitKit.rod([x + w / 2, yy, z + dz], [xx, yy, z + dz], .009, 0x69706a);
        }
        unitKit.finish(unit); esp2.add(unit); oruAssemblies.push(unit.name);
    });
    // Four corner cleats, flared trunnion plates and short outboard pins.
    for (const cleat of espReference.cleats) espKit.box(cleat.center, cleat.size, frameColor);
    for (const bracket of espReference.brackets) {
        const [x, y, z] = bracket.center, [w, h, d] = bracket.size;
        const profile = [[-.30,-.5],[.30,-.5],[.5,-.35],[.5,.35],[.30,.5],[-.30,.5],[-.5,.35],[-.5,-.35]];
        const outline = new THREE.Shape(profile.map(([u, v]) => new THREE.Vector2(u * d, v * h)));
        espKit.add(new THREE.ExtrudeGeometry(outline, { depth: w, bevelEnabled: false }), material(palette.silver), [x + w / 2, y, z], [1, 1, 1], [0, -Math.PI / 2, 0]);
        espKit.box([x, y + h * .29, z], [w + .012, .032, d * .85], frameEdge);
    }
    for (const pin of espReference.pins) {
        espKit.cylinder(pin.center, pin.size[1] / 2, pin.size[0], palette.silver, [0, 0, Math.PI / 2]);
        const outside = pin.center[0] < -2 ? -1 : 1;
        ring(espKit, [pin.center[0] + outside * pin.size[0] * .39, pin.center[1], pin.center[2]], .037, 'x', frameEdge, .008);
    }
    // Round grapple fixture at the outer edge, with central pin and three support arms.
    const [gx, gy, gz] = espReference.grapple.center;
    espKit.box(espReference.grappleBracket.center, espReference.grappleBracket.size, palette.silver);
    espKit.cylinder([gx, gy, gz], .29742, .009, palette.hull);
    ring(espKit, [gx, gy, gz + .007], .281, 'z', palette.silver, .020);
    ring(espKit, [gx, gy, gz + .011], .202, 'z', frameColor, .012);
    espKit.cylinder([gx, gy, gz + .131], .0223, .253, palette.silver);
    for (let i = 0; i < 3; i++) {
        const a = Math.PI / 2 + i * Math.PI * 2 / 3;
        espKit.rod([gx + Math.cos(a) * .18, gy + Math.sin(a) * .18, gz + .009], [gx + Math.cos(a) * .039, gy + Math.sin(a) * .039, gz + .085], .018, palette.silver);
    }
    espKit.box([gx, gy + .284, gz + .009], [.31, .029, .014], frameEdge);
    espKit.rod([gx, gy + .284, gz + .016], [gx, gy + .284, gz + .109], .006, palette.silver);
    // Two shaped attachment plates, copied as outlines rather than importing mesh data.
    for (const plate of espReference.attachments) {
        const shape = new THREE.Shape(plate.outline.map(p => new THREE.Vector2(...p))); shape.closePath();
        espKit.add(new THREE.ExtrudeGeometry(shape, { depth: plate.depth, bevelEnabled: false }), material(palette.silver), [0, 0, plate.z]);
    }
    for (const post of espReference.posts) espKit.cylinder(post.center, .145, post.size[2], palette.silver);
    // Connect the plate to the central inset edge of the pallet without a gap.
    espKit.box([-1.24832, -.49626, .506], [.83, .18, .142], palette.silver);
    // Adapt the two roots to the current Quest shell; their ends penetrate the shield slightly.
    const rootPosts = [0, -1.257481];
    for (const x of rootPosts) {
        espKit.cylinder([x, 0, -.194], .145, .388, palette.silver);
        espKit.cylinder([x, 0, -.365], .165, .036, frameEdge);
        ring(espKit, [x, 0, -.343], .161, 'z', palette.rail, .009);
    }
    esp2.userData.attachmentRoots = rootPosts.map(x => [x, 0, -.365]);
    esp2.userData.equipmentCount = 6;
    esp2.userData.cornerTrunnions = 4;
    espKit.finish(esp2); group.add(esp2);
    group.userData.externalStowagePlatform = { name: 'ESP-2', equipmentBoxes: 6, grid: [9, 6], cornerTrunnions: 4, outerGrapple: true };
});
