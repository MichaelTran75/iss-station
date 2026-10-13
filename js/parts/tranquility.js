// Tranquility & Cupola.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { Kit, material, palette, shapes, vertical } from '../core/kit.js';
import { part, ring } from '../core/station.js';
import { referenceCbmCone, referenceFreeCbm, referencePassiveCBM } from '../core/cbm.js';
import { hullBadge } from '../core/surfaces.js';
import { moduleAt } from '../core/hull.js';

part('tranquility', 'Tranquility & Cupola', '10 / HABITATION & OBSERVATION', 'Tranquility houses life-support equipment. Cupola has six trapezoidal side windows, an 80 cm circular Earth-facing window and protective external shutters; it supports Earth observation and robotic operations. The shutters are shown folded open and the glazing is drawn 75% transparent, showing the cabin and its robotic workstation.', [['Joined station', '2010'], ['Cupola windows', '6 side + 1 nadir']], [-7, -2, 12], (kit, group) => {
    moduleAt(kit, [-6.3, 0, 12], 6.7, 2.15, 'x', { skin: 'quilted', endInterfaceSides: [-1] });
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
    cabin.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = true; } });
    const glazing = new THREE.Group(); glazing.name = 'Cupola glazing (75% transparent)'; glazingKit.finish(glazing); group.add(glazing);
    glazing.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; object.renderOrder = 2; } });

    // Inboard of the zenith port, so the lettering stays clear of its collar.
    hullBadge(kit, 'NODE 3', [-4.35, 0, 12], 2.225, [2.4, .40], 'x');
});
