// Tranquility & Cupola.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { Kit, material, palette, shapes, vertical } from '../core/kit.js';
import { part, ring } from '../core/station.js';
import { referenceCbmCone, referenceFreeCbm, referencePassiveCBM } from '../core/cbm.js';
import { hullBadge } from '../core/surfaces.js';
import { moduleAt } from '../core/hull.js';

part('tranquility', 'Tranquility & Cupola', '10 / HABITATION & OBSERVATION', 'Tranquility houses life-support equipment. Cupola has six trapezoidal side windows, an 80 cm circular Earth-facing window and protective external shutters; it supports Earth observation and robotic operations. The shutters are shown folded open and the glazing is drawn 75% transparent, showing the cabin and its robotic workstation. A band of Tranquility\'s hull is drawn the same way: inside, one crew member squats on the resistive exerciser, one floats through between the hatches and one photographs the Earth from the Cupola.', [['Joined station', '2010'], ['Cupola windows', '6 side + 1 nadir']], [-7, -2, 12], (kit, group) => {
    // The two bays next to Unity are see-through over the forward and forward-zenith side (module frame: z along the
    // axis toward Unity, angle 0 forward, a quarter turn zenith); nodeCabin() furnishes them.
    const open = { a0: -Math.PI / 4, a1: 3 * Math.PI / 8, z0: .67, z1: 3.35 };
    moduleAt(kit, [-6.3, 0, 12], 6.7, 2.15, 'x', { skin: 'quilted', endInterfaceSides: [-1], window: open });
    nodeCabin(group, open);
    // The short inboard cone and passive CBM meet Unity's radial active collar.
    // Node 3's barrel, Cupola and all other ports keep their existing placement.
    const unityCollar = new THREE.Group(), unityCollarKit = new Kit();
    unityCollar.name = 'Tranquility / Unity passive CBM';
    unityCollar.position.z = 12; unityCollar.rotation.y = -Math.PI / 2;
    referenceCbmCone(unityCollarKit, 2.950, 2.775, 2.15, 1.179501);
    unityCollar.userData.cbm = referencePassiveCBM(unityCollarKit, 2.775, -1, .62);
    unityCollarKit.finish(unityCollar); group.add(unityCollar);
    // The zenith port is free, as on the GLB node: its covered CBM shares the radial-port station with Cupola,
    // Leonardo and BEAM. The collar stands clear of the quilted skin with its root sunk through it, and the
    // inspection ring points to the outboard (Bishop) end.
    const zenithPort = new THREE.Group(), zenithKit = new Kit();
    zenithPort.name = 'Tranquility / zenith free CBM';
    zenithPort.position.set(-7, 0, 12); zenithPort.rotation.y = Math.PI / 2;
    zenithPort.userData.cover = referenceFreeCbm(zenithKit, { hullRadius: 2.31, seat: .15 });
    zenithKit.finish(zenithPort); group.add(zenithPort);

    group.userData.cupolaWindows = 7;
    group.userData.cupolaNadirWindowDiameter = .8;
    group.userData.cupolaWindowOpacity = .25;
    group.userData.cupolaShutters = { side: 6, top: 1, pose: 'Folded open' };
    // Cupola after the supplied photograph: a round base skirt, a hexagonal dome of thick white frames around six
    // trapezoidal side windows and the circular Earth-facing window, gold handrails on the ribs, a bronze grapple
    // fixture, and seven open shutters whose dark, stud-dotted inner faces are rimmed in bronze. The glazing is 75%
    // transparent, so the cabin behind it (hatch to Node 3, robotic workstation displays) shows through.
    const cx = -7, cz = 12, yBase = -2.72, yTop = -3.57, baseRadius = 1.34, topRadius = .66;
    const apothem = r => r * Math.cos(Math.PI / 6), drop = apothem(baseRadius) - apothem(topRadius), rise = yBase - yTop, slant = Math.hypot(drop, rise);
    const halfAt = y => baseRadius / 2 - (baseRadius - topRadius) / 2 * y / slant; // half-length of a facet at height y
    const frameWhite = material(0xeceee9, .58, .1), bronzeRim = material(0xa8854f, .45, .5), handrailGold = 0xc9a64a, ribWhite = 0xf0f1ec;
    const studs = (() => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256; const g = canvas.getContext('2d');
        g.fillStyle = '#2b2f35'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#e4e4dc';
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.beginPath(); g.arc(16 + i * 32, 16 + j * 32, 3.4, 0, Math.PI * 2); g.fill(); }
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2.5, 2.5); texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return texture;
    })();
    const dotted = material(0xffffff, .7, .15, studs);
    const glass = new THREE.MeshStandardMaterial({ color: 0x86a9bd, roughness: .06, metalness: .1, transparent: true, opacity: .25, depthWrite: false });
    const glazingKit = new Kit(), cabinKit = new Kit();
    const place = (geometry, surface, matrix, target = kit) => target.add(geometry.applyMatrix4(matrix), surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    function roundedPolygon(target, points, radius) {
        for (let i = 0; i < points.length; i++) {
            const p = points[i], prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
            const toPrev = new THREE.Vector2(prev[0] - p[0], prev[1] - p[1]).normalize(), toNext = new THREE.Vector2(next[0] - p[0], next[1] - p[1]).normalize();
            const a = [p[0] + toPrev.x * radius, p[1] + toPrev.y * radius], b = [p[0] + toNext.x * radius, p[1] + toNext.y * radius];
            if (i === 0) target.moveTo(...a); else target.lineTo(...a);
            target.quadraticCurveTo(p[0], p[1], ...b);
        }
        target.closePath(); return target;
    }
    const loop = (path, matrix, z) => { const points = path.getSpacedPoints(64).slice(0, -1); return new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p.x, p.y, z).applyMatrix4(matrix)), true); };
    // Facet k: x along the base edge, y up the slant toward the top window, z along the outward normal.
    const facetFrame = k => {
        const theta = k * Math.PI / 3 + Math.PI / 6, n = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));
        const U = new THREE.Vector3(-Math.cos(theta), 0, Math.sin(theta));
        const V = n.clone().multiplyScalar(-drop / slant).add(new THREE.Vector3(0, -rise / slant, 0));
        const N = n.clone().multiplyScalar(rise / slant).add(new THREE.Vector3(0, -drop / slant, 0));
        return { theta, n, matrix: new THREE.Matrix4().makeBasis(U, V, N).setPosition(new THREE.Vector3(cx, yBase, cz).addScaledVector(n, apothem(baseRadius))) };
    };
    // Round base skirt on a short adapter that runs up into Node 3's hull.
    const skirt = [[1.12, -2.72], [1.34, -2.72], [1.41, -2.66], [1.44, -2.58], [1.41, -2.50], [1.30, -2.44], [1.02, -2.40], [1.02, -1.85]];
    kit.add(new THREE.LatheGeometry(skirt.map(([r, y]) => new THREE.Vector2(r, y)), 72), frameWhite, [cx, 0, cz], [1, 1, 1], [0, 0, 0], false);
    ring(kit, [cx, -2.40, cz], 1.03, 'y', palette.silver, .03);
    for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; kit.add(shapes.sphere, bronzeRim, [cx + 1.44 * Math.sin(a), -2.58, cz + 1.44 * Math.cos(a)], [.035, .035, .035], [0, 0, 0], false); }
    // Six framed trapezoidal windows, each with a bronze-hinged shutter folded open toward the skirt.
    const shutterShape = roundedPolygon(new THREE.Shape(), [[-.55, .03], [.55, .03], [.29, .90], [-.29, .90]], .07);
    const shutterTray = new THREE.ExtrudeGeometry(shutterShape, { depth: .06, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 1 }).translate(0, 0, .012);
    const shutterFace = new THREE.ShapeGeometry(shutterShape, 6).rotateY(Math.PI).translate(0, 0, -.004);
    const hingeY = .10, shutterOpen = 110 * Math.PI / 180;
    for (let k = 0; k < 6; k++) {
        const { matrix } = facetFrame(k);
        const outline = new THREE.Shape([[-halfAt(0), 0], [halfAt(0), 0], [halfAt(slant), slant], [-halfAt(slant), slant]].map(p => new THREE.Vector2(...p)));
        const pane = [[-(halfAt(.13) - .11), .13], [halfAt(.13) - .11, .13], [halfAt(slant - .12) - .11, slant - .12], [-(halfAt(slant - .12) - .11), slant - .12]];
        outline.holes.push(roundedPolygon(new THREE.Path(), pane, .06));
        place(new THREE.ExtrudeGeometry(outline, { depth: .10, bevelEnabled: false }).translate(0, 0, -.10), frameWhite, matrix);
        place(new THREE.ShapeGeometry(roundedPolygon(new THREE.Shape(), pane, .06), 6).translate(0, 0, -.045), glass, matrix, glazingKit);
        kit.add(new THREE.TubeGeometry(loop(roundedPolygon(new THREE.Path(), pane, .06), matrix, -.006), 72, .016, 6, true), material(0x7b8388), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
        const hinge = new THREE.Matrix4().makeRotationX(shutterOpen).premultiply(new THREE.Matrix4().makeTranslation(0, hingeY, 0)).premultiply(matrix);
        place(shutterTray.clone(), bronzeRim, hinge); place(shutterFace.clone(), dotted, hinge);
        kit.rod(new THREE.Vector3(-.42, hingeY, .02).applyMatrix4(matrix).toArray(), new THREE.Vector3(.42, hingeY, .02).applyMatrix4(matrix).toArray(), .03, 0x8f7248);
    }
    // Rounded white edges: base and top hexagons and the six ribs between windows.
    const vertex = (radius, y, i) => [cx + radius * Math.sin(i * Math.PI / 3), y, cz + radius * Math.cos(i * Math.PI / 3)];
    for (let i = 0; i < 6; i++) {
        kit.rod(vertex(baseRadius, yBase, i), vertex(baseRadius, yBase, i + 1), .045, ribWhite);
        kit.rod(vertex(topRadius, yTop, i), vertex(topRadius, yTop, i + 1), .04, ribWhite);
        kit.rod(vertex(baseRadius, yBase, i), vertex(topRadius, yTop, i), .05, ribWhite);
        kit.sphere(vertex(topRadius, yTop, i), [.05, .05, .05], ribWhite);
        // A gold handrail stands off each rib near the top window.
        const along = t => new THREE.Vector3(...vertex(baseRadius, yBase, i)).lerp(new THREE.Vector3(...vertex(topRadius, yTop, i)), t);
        const out = new THREE.Vector3(Math.sin(i * Math.PI / 3) * .712, -.570, Math.cos(i * Math.PI / 3) * .712).normalize();
        const rail = [.55, .90].map(t => along(t).addScaledVector(out, .10));
        kit.rod(rail[0].toArray(), rail[1].toArray(), .026, handrailGold);
        for (const t of [.55, .90]) kit.rod(along(t).addScaledVector(out, .04).toArray(), along(t).addScaledVector(out, .10).toArray(), .02, handrailGold);
        if (i === 2) {
            // Bronze grapple fixture with a tri-spoke hub and a dark handle, on a short standoff.
            const q = new THREE.Quaternion().setFromUnitVectors(vertical, out), p = along(.33);
            kit.add(new THREE.CylinderGeometry(.06, .06, .12, 12).applyQuaternion(q), material(palette.silver), p.clone().addScaledVector(out, .07).toArray(), [1, 1, 1], [0, 0, 0], false);
            kit.add(new THREE.CylinderGeometry(.17, .17, .03, 28).applyQuaternion(q), bronzeRim, p.clone().addScaledVector(out, .14).toArray(), [1, 1, 1], [0, 0, 0], false);
            for (let s = 0; s < 3; s++) {
                const spoke = new THREE.BoxGeometry(.03, .02, .14).translate(0, 0, .07).rotateY(s * Math.PI * 2 / 3).applyQuaternion(q);
                kit.add(spoke, bronzeRim, p.clone().addScaledVector(out, .165).toArray(), [1, 1, 1], [0, 0, 0], false);
            }
            kit.add(new THREE.BoxGeometry(.44, .03, .05).applyQuaternion(q), material(palette.dark), p.clone().addScaledVector(out, .19).toArray(), [1, 1, 1], [0, 0, 0], false);
        }
    }
    // Top plate around the 80 cm Earth-facing window (outer face at yTop, facing nadir).
    const topFrame = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0)).setPosition(new THREE.Vector3(cx, yTop, cz));
    const topPlate = new THREE.Shape(Array.from({ length: 6 }, (_, i) => new THREE.Vector2(topRadius * Math.sin(i * Math.PI / 3), topRadius * Math.cos(i * Math.PI / 3))));
    const topHole = new THREE.Path(); topHole.absarc(0, 0, .42, 0, Math.PI * 2, true); topPlate.holes.push(topHole);
    place(new THREE.ExtrudeGeometry(topPlate, { depth: .10, bevelEnabled: false, curveSegments: 36 }).translate(0, 0, -.10), frameWhite, topFrame);
    const topPane = new THREE.Shape(); topPane.absarc(0, 0, .43, 0, Math.PI * 2, false);
    place(new THREE.ShapeGeometry(topPane, 36).translate(0, 0, -.04), glass, topFrame, glazingKit);
    ring(kit, [cx, yTop - .015, cz], .47, 'y', 0xe3e5e0, .05);
    ring(kit, [cx, yTop - .004, cz], .425, 'y', 0x7b8388, .016);
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; kit.add(shapes.lowCylinder, material(palette.dark), [cx + .545 * Math.sin(a), yTop - .01, cz + .545 * Math.cos(a)], [.016, .02, .016], [0, 0, 0], false); }
    // The round top shutter swings out on a short arm and lies beside the dome, its dotted inner face toward Earth.
    {
        const theta = 4 * Math.PI / 3 + Math.PI / 6, n = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta)), reach = apothem(topRadius) + .08;
        const hingePoint = new THREE.Vector3(cx, yTop - .05, cz).addScaledVector(n, reach);
        const frame = new THREE.Matrix4().makeBasis(new THREE.Vector3(-Math.cos(theta), 0, Math.sin(theta)), n.clone().negate(), new THREE.Vector3(0, -1, 0)).setPosition(hingePoint);
        const swing = new THREE.Matrix4().makeRotationX(188 * Math.PI / 180).premultiply(frame);
        const disc = new THREE.Shape(); disc.absarc(0, reach, .50, 0, Math.PI * 2, false);
        place(new THREE.ExtrudeGeometry(disc, { depth: .06, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 1, curveSegments: 36 }).translate(0, 0, .012), bronzeRim, swing);
        place(new THREE.ShapeGeometry(disc, 36).rotateY(Math.PI).translate(0, 0, -.004), dotted, swing);
        kit.rod(hingePoint.toArray(), new THREE.Vector3(0, reach - .5, .03).applyMatrix4(swing).toArray(), .035, 0x8f7248);
        kit.add(shapes.box, bronzeRim, hingePoint.toArray(), [.22, .08, .12], [0, theta, 0], false);
    }
    // Cabin behind the glazing: dim walls (seen from outside only), the hatch into Node 3 and two workstation displays.
    const cabinWall = new THREE.MeshStandardMaterial({ color: 0xb3b8b6, roughness: .8, metalness: .05, side: THREE.BackSide });
    cabinKit.add(new THREE.CylinderGeometry(1.10, .50, .70, 6, 1, false), cabinWall, [cx, -3.145, cz], [1, 1, 1], [0, 0, 0], false);
    cabinKit.add(new THREE.CylinderGeometry(.44, .44, .012, 36), material(0x1d2226, .8, .1), [cx, -2.80, cz], [1, 1, 1], [0, 0, 0], false);
    cabinKit.add(new THREE.TorusGeometry(.46, .03, 8, 36), material(0x9aa1a3), [cx, -2.805, cz], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    const screen = new THREE.MeshStandardMaterial({ color: 0x1d4c66, emissive: 0x2f7aa0, emissiveIntensity: .55, roughness: .35, metalness: .1 });
    for (const dz of [-.21, .21]) {
        cabinKit.add(shapes.box, material(0x2b2f35, .6, .2), [cx - .30, -3.02, cz + dz], [.03, .26, .36], [0, 0, 0], false);
        cabinKit.add(shapes.box, screen, [cx - .283, -3.02, cz + dz], [.006, .22, .32], [0, 0, 0], false);
        cabinKit.add(shapes.box, material(0x9aa1a3), [cx - .30, -2.845, cz + dz], [.03, .10, .03], [0, 0, 0], false);
    }
    const cabin = new THREE.Group(); cabin.name = 'Cupola cabin'; cabinKit.finish(cabin); group.add(cabin);
    // wall: the cabin wall's corner radius at a height.
    group.userData.cupola = { center: [cx, cz], yBase, yTop, baseRadius, topRadius, hatchY: -2.80, home: cabin, wall: y => 1.10 - .60 * (-2.795 - y) / .70 };
    cabin.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = true; } });
    const glazing = new THREE.Group(); glazing.name = 'Cupola glazing (75% transparent)'; glazingKit.finish(glazing); group.add(glazing);
    glazing.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; object.renderOrder = 2; } });

    // Inboard of the zenith port, so the lettering stays clear of its collar.
    hullBadge(kit, 'NODE 3', [-4.35, 0, 12], 2.225, [2.4, .40], 'x');
});

// Node 3's cabin behind the see-through section: cut faces and exposed frames around the opening, a 75%-transparent
// skin over it, the liner, a rack row on the aft wall and one under the deck, a bulkhead with an open hatch at each
// end, and the resistive exerciser (ARED) on the deck: a foot plate, a frame with two vacuum cylinders, and a lift arm
// whose bar the crew member carries on the shoulders. The arm and its piston rods are separate meshes that
// js/figures/cabin-crew.js moves; the overhead and forward rack rows are left out so the cabin stays in view.
function nodeCabin(group, open) {
    const tube = new THREE.Group(), interior = new THREE.Group(), frames = new THREE.Group();
    tube.name = 'Tranquility module frame'; interior.name = 'Tranquility cabin'; frames.name = 'Tranquility exposed frames';
    tube.position.set(-6.3, 0, 12); tube.rotation.y = Math.PI / 2; group.add(tube); tube.add(frames, interior);
    const R = 2.15, Ro = 2.197, Rp = 1.98, aisle = .95, rackDepth = .72, span = open.z1 - open.z0, mid = (open.z0 + open.z1) / 2;
    const at = (r, a, z) => [Math.cos(a) * r, Math.sin(a) * r, z];
    const twoSided = (color, roughness = .7, metalness = .22) => { const m = material(color, roughness, metalness).clone(); m.side = THREE.DoubleSide; return m; };
    const frameKit = new Kit(), cabinKit = new Kit(), glazingKit = new Kit();
    function sweep(target, r0, z0, r1, z1, a0, a1, surface) {
        const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 32))), positions = [], indices = [];
        for (let row = 0; row < 2; row++) for (let i = 0; i <= steps; i++) positions.push(...at(row ? r1 : r0, a0 + (a1 - a0) * i / steps, row ? z1 : z0));
        for (let i = 0; i < steps; i++) { const j = i + steps + 1; indices.push(i, i + 1, j, j, i + 1, j + 1); }
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices); geometry.computeVertexNormals(); target.add(geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    function arc(target, r, z, a0, a1, radius, color) {
        const points = [], steps = Math.max(8, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 40)));
        for (let i = 0; i <= steps; i++) points.push(new THREE.Vector3(...at(r, a0 + (a1 - a0) * i / steps, z)));
        target.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps * 2, radius, 6, false), material(color, .6, .3), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    // Cut faces of the wall, 6 mm clear of the barrel's own end face, a beam along each long edge, and a ring frame
    // of two arcs and a lattice at each end.
    const cutFace = twoSided(0xe4e6df, .82, .08);
    for (const a of [open.a0, open.a1]) {
        const corners = [at(Rp, a, open.z0), at(Ro, a, open.z0), at(Ro, a, open.z1), at(Rp, a, open.z1)], face = new THREE.BufferGeometry();
        face.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3)); face.setIndex([0, 1, 2, 0, 2, 3]); face.computeVertexNormals();
        frameKit.add(face, cutFace, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
        frameKit.rod(at(2.07, a, open.z0), at(2.07, a, open.z1), .045, 0xd6d9d2);
        for (let n = 1; n < 8; n++) frameKit.box(at(2.07, a, open.z0 + span * n / 8), [.13, .13, .05], 0xbfc4be, [0, 0, a], false);
    }
    for (const z of [open.z0 + .006, open.z1 - .006]) sweep(frameKit, Rp, z, Ro, z, open.a0, open.a1, cutFace);
    // The grapple fixture on this side of the node stands on a longeron across the opening, with a doubler under it.
    const mount = { a: Math.PI / 4, z: 1.7 };
    frameKit.rod(at(2.12, mount.a, open.z0), at(2.12, mount.a, open.z1), .05, 0xd6d9d2);
    frameKit.cylinder(at(Ro - .035, mount.a, mount.z), .40, .07, 0xd6d9d2, [0, 0, mount.a - Math.PI / 2]);
    for (const z of [open.z0 + .07, open.z1 - .07]) {
        const lo = open.a0 - .03, hi = open.a1 + .03, n = 10;
        for (const r of [1.72, 1.96]) arc(frameKit, r, z, lo, hi, .032, 0xdfe2db);
        for (let i = 0; i < n; i++) {
            const a = lo + (hi - lo) * i / n, b = lo + (hi - lo) * (i + 1) / n;
            frameKit.rod(at(1.72, a, z), at(1.96, b, z), .016, 0xc5c9c3); frameKit.rod(at(1.96, a, z), at(1.72, b, z), .016, 0xc5c9c3);
        }
    }
    frameKit.finish(frames);
    // The clear skin stays part of the hull for the robotic arm's clearance map (userData.shell).
    const clearSkin = new THREE.MeshStandardMaterial({ color: 0xd3d8d4, roughness: .35, metalness: .08, transparent: true, opacity: .25, depthWrite: false });
    const glazing = new THREE.Group(); glazing.name = 'Tranquility see-through hull section';
    sweep(glazingKit, Ro, open.z0, Ro, open.z1, open.a0, open.a1, clearSkin);
    for (const a of [-Math.PI / 8, 0, Math.PI / 8, Math.PI / 4]) glazingKit.line([at(Ro + .004, a, open.z0), at(Ro + .004, a, open.z1)]);
    glazingKit.line(Array.from({ length: 19 }, (_, i) => at(Ro + .004, open.a0 + (open.a1 - open.a0) * i / 18, 2.01)));
    glazingKit.finish(glazing); tube.add(glazing);
    glazing.traverse(object => { object.userData.interior = true; object.userData.shell = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; object.renderOrder = 2; } });

    // Liner and the two bulkheads, each with an open hatch that reads dark.
    sweep(cabinKit, Rp, open.z0, Rp, open.z1, open.a1, open.a0 + Math.PI * 2, twoSided(0xd8dbd3, .85, .06));
    const bulkhead = twoSided(0xe1e3dc, .85, .06), beyond = new THREE.MeshBasicMaterial({ color: 0x14181a, side: THREE.DoubleSide });
    const roundedSquare = (half, radius) => {
        const s = new THREE.Shape(); s.moveTo(-half + radius, -half); s.lineTo(half - radius, -half); s.quadraticCurveTo(half, -half, half, -half + radius);
        s.lineTo(half, half - radius); s.quadraticCurveTo(half, half, half - radius, half); s.lineTo(-half + radius, half);
        s.quadraticCurveTo(-half, half, -half, half - radius); s.lineTo(-half, -half + radius); s.quadraticCurveTo(-half, -half, -half + radius, -half); return s;
    };
    const hatchFrame = roundedSquare(.68, .3); hatchFrame.holes.push(roundedSquare(.56, .24));
    for (const [z, side] of [[open.z0 + .02, 1], [open.z1 - .02, -1]]) {
        sweep(cabinKit, 0, z, R - .003, z, 0, Math.PI * 2, bulkhead);
        cabinKit.add(new THREE.ExtrudeGeometry(hatchFrame, { depth: .07, bevelEnabled: false, curveSegments: 8 }), material(0xb4bab6, .6, .3), [0, 0, side > 0 ? z : z - .07], [1, 1, 1], [0, 0, 0], false);
        cabinKit.add(new THREE.ShapeGeometry(roundedSquare(.565, .24), 8), beyond, [0, 0, z + side * .012], [1, 1, 1], [0, 0, 0], false);
        for (const x of [-.82, .82]) {
            cabinKit.rod([x, -.4, z + side * .1], [x, .4, z + side * .1], .016, palette.gold);
            for (const y of [-.4, .4]) cabinKit.rod([x, y, z], [x, y, z + side * .1], .013, palette.gold);
        }
        // Soft stowage bags strapped above the hatch.
        for (let i = 0; i < 3; i++) cabinKit.box([-.5 + i * .5, 1.02, z + side * .13], [.44, .34, .22], [0xe9eae4, 0xdcdfd8, 0xe4e1d6][i], [0, 0, 0], false);
        cabinKit.box([0, 1.02, z + side * .245], [1.5, .03, .012], 0x40607c, [0, 0, 0], false);
    }
    // Rack fronts: lockers and equipment panels drawn once on a canvas.
    function fronts(seed, equipment) {
        const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 384; const g = canvas.getContext('2d');
        let state = seed * 9301 + 49297; const random = () => (state = (state * 9301 + 49297) % 233280) / 233280;
        g.fillStyle = '#d9dcd5'; g.fillRect(0, 0, 256, 384);
        for (let row = 0; row < 6; row++) for (let column = 0; column < 2; column++) {
            const x = 8 + column * 124, y = 8 + row * 62, w = 116, h = 54, kind = equipment ? random() : 1;
            g.fillStyle = kind < .3 ? '#39424a' : kind < .5 ? '#b9c3c4' : '#eceee8'; g.fillRect(x, y, w, h);
            g.strokeStyle = '#8b938f'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
            if (kind < .3) { g.fillStyle = ['#5fd0a0', '#e9b44c', '#6aa7e0'][Math.floor(random() * 3)]; for (let i = 0; i < 5; i++) g.fillRect(x + 10 + i * 20, y + 12, 10, 5); g.fillStyle = '#9fb0b8'; g.fillRect(x + 10, y + 28, 70, 14); }
            else { g.fillStyle = '#5c6562'; g.fillRect(x + w / 2 - 16, y + h - 14, 32, 5); g.fillStyle = random() < .5 ? '#2f5f8f' : '#b5533c'; g.fillRect(x + 8, y + 8, 26, 9); }
        }
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return texture;
    }
    const rackBody = material(0x9ea8a3, .78, .18), rackPost = 0xd1d5ce, width = span / 2 - .04;
    [mid - span / 4, mid + span / 4].forEach((z, bay) => {
        // Aft wall: fronts face forward (+x). Deck: fronts face up.
        cabinKit.add(shapes.box, rackBody, [-aisle - rackDepth / 2, 0, z], [rackDepth - .02, 1.86, width], [0, 0, 0], false);
        cabinKit.add(new THREE.PlaneGeometry(width - .03, 1.82).rotateY(Math.PI / 2), material(0xffffff, .82, .05, fronts(bay + 1, true)), [-aisle + .004, 0, z], [1, 1, 1], [0, 0, 0], false);
        cabinKit.add(shapes.box, rackBody, [0, -aisle - rackDepth / 2, z], [1.86, rackDepth - .02, width], [0, 0, 0], false);
        cabinKit.add(new THREE.PlaneGeometry(1.82, width - .03).rotateX(-Math.PI / 2), material(0xffffff, .82, .05, fronts(bay + 5, false)), [0, -aisle + .004, z], [1, 1, 1], [0, 0, 0], false);
        for (const edge of [-width / 2, width / 2]) { cabinKit.box([-aisle + .02, 0, z + edge], [.07, 1.9, .045], rackPost, [0, 0, 0], false); cabinKit.box([0, -aisle + .02, z + edge], [1.9, .07, .045], rackPost, [0, 0, 0], false); }
        for (const y of [-.5, .15, .62]) cabinKit.rod([-aisle + .05, y, z - .32], [-aisle + .05, y, z + .1], .012, 0x7c8581);
    });
    // A light bar along the aft overhead edge, a service duct above it, and gold rails along the deck edges.
    cabinKit.box([-.905, .905, mid], [.1, .1, span - .08], 0xd9dcd4, [0, 0, 0], false);
    cabinKit.add(shapes.box, new THREE.MeshBasicMaterial({ color: 0xf8f5e6 }), [-.86, .86, mid], [.03, .03, span - .2], [0, 0, Math.PI / 4], false);
    cabinKit.box([-1.13, 1.2, mid], [.38, .34, span - .1], 0x4b5351, [0, 0, 0], false);
    for (const sx of [-1, 1]) cabinKit.rod([sx * .86, -.9, open.z0 + .1], [sx * .86, -.9, open.z1 - .1], .018, palette.gold);

    // The exerciser. Its user faces forward (+x) with the bar across the shoulders, along the module axis.
    const ared = { z: 1.55, top: -aisle + .06, pivot: [-.84, .45], reach: .5355, rodFrom: .45, rodTo: [], rods: [] };
    const steel = 0xaab1af, dark = 0x2c3136;
    cabinKit.box([-.30, -aisle + .03, ared.z], [.66, .06, .92], dark, [0, 0, 0], false);
    for (const dz of [-.3, .3]) cabinKit.box([-.26, -aisle + .064, ared.z + dz], [.4, .008, .2], 0x6f777a, [0, 0, 0], false);
    for (const side of [-1, 1]) {
        const z = ared.z + side * .56;
        cabinKit.rod([-.86, -aisle, z], [-.86, ared.pivot[1] + .07, z], .032, steel);
        cabinKit.rod([-.86, -aisle + .02, z], [-.46, -aisle + .02, z], .028, steel);
        cabinKit.rod([-.78, -aisle + .04, z], [-.78, -.28, z], .095, 0xc9cdc6);
        cabinKit.rod([-.78, -.28, z], [-.78, -.25, z], .07, dark);
        ared.rodTo.push([-.78, -.27, z]);
    }
    cabinKit.rod([-.86, ared.pivot[1] + .05, ared.z - .56], [-.86, ared.pivot[1] + .05, ared.z + .56], .028, steel);
    cabinKit.rod([ared.pivot[0], ared.pivot[1], ared.z - .6], [ared.pivot[0], ared.pivot[1], ared.z + .6], .022, dark);
    const utilities = new THREE.Group(); utilities.name = 'Tranquility liner, racks and exerciser'; cabinKit.finish(utilities); interior.add(utilities);
    // Moving parts: the lift arm about the pivot (its x axis runs out to the bar) and a piston rod each side.
    const armKit = new Kit(), arm = new THREE.Group(); arm.name = 'Exerciser lift arm';
    for (const side of [-1, 1]) armKit.rod([0, 0, side * .56], [ared.reach, 0, side * .56], .026, steel);
    armKit.rod([ared.reach, 0, -.62], [ared.reach, 0, .62], .017, 0x3b4146);
    for (const side of [-1, 1]) armKit.rod([ared.reach, 0, side * .09], [ared.reach, 0, side * .2], .034, 0x1d2023);
    armKit.finish(arm); arm.position.set(ared.pivot[0], ared.pivot[1], ared.z); interior.add(arm); ared.arm = arm;
    for (const side of [-1, 1]) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .8, 10).translate(0, -.4, 0), material(0xdfe3e1, .3, .7)); rod.name = 'Exerciser piston rod';
        interior.add(rod); ared.rods.push(rod);
    }
    interior.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; } });
    group.userData.seeThrough = { angleStart: open.a0, angleEnd: open.a1, axialStart: open.z0, axialEnd: open.z1, opacity: .25 };
    group.userData.cabin = { tube, interior, open, aisle, ared };
}
