// Canadarm2 & Mobile Base System.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { Kit, material, palette, shapes, vertical } from '../core/kit.js';
import { part, trussDrop } from '../core/station.js';
import { payloadBlanket, payloadPillow } from '../core/surfaces.js';

part('robotics', 'Canadarm2 & Mobile Base System', '19 / CANADA - CSA', 'Canadarm2 rides the Mobile Base System along the rails on the forward face of the integrated truss. Its seven joints (three shoulder, one elbow, three wrist) and two booms are wrapped in white blankets; identical latching end effectors grasp fixtures with cable snares, and cameras on both end effectors and both booms assist operators. Shown after the supplied reference renders: the base on S0\'s forward face above Destiny, one end grappled to it and the arm raised in a high arch in front of the starboard truss.', [['Deployed reach', '17.6 m'], ['Joints / cameras', '7 / 4']], [9.5, 12.2, -.9], (kit, group) => {
    // World coordinates for the arm: the truss and its rails sit trussDrop lower than they are drawn. The base is built
    // in its own frame (x along the truss, y out from the rails, z across them) and stood on the forward-face rails.
    const mbsX = 2.5, railCenterY = (6.45 + 7.25) / 2 - trussDrop, railFace = 2.3 - .32 - .075, frameY = .5, tan = 0xb8a57b, mbsGrey = 0xc9ced0, bronze = 0xa8854f;
    let into = kit;
    const crumple = (u, v) => { const t = payloadBlanket.map.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(u, v); t.needsUpdate = true; return material(0xffffff, .9, .02, t); };
    const armBlanket = crumple(2, 2), boomBlanket = crumple(2, 12);
    // Arm pose: LEE "A" grapples the base's starboard fixture; shoulder roll, yaw and pitch, a boom up to the elbow, a boom
    // down to the wrist, then wrist pitch, yaw and roll to LEE "B". Both booms lie in one tilted plane, so the arm
    // reads as an arch from the side and from above.
    const mouthA = mbsX + 2.09, armY = railCenterY, armZ = railFace - .88;
    const rise = new THREE.Vector3(0, .95, -.31).normalize(), pitchAxis = new THREE.Vector3(1, 0, 0).cross(rise).normalize().toArray();
    const shoulder = new THREE.Vector3(mouthA + 2.6, armY + .45, armZ), elbow = shoulder.clone().add(new THREE.Vector3(2.32, 0, 0)).addScaledVector(rise, 5.75), wrist = shoulder.clone().add(new THREE.Vector3(4.64, 0, 0));
    const joints = [[mouthA + 1.3, armY, armZ], [mouthA + 2.0, armY, armZ], shoulder.toArray(), elbow.toArray(), wrist.toArray(), [wrist.x + .6, armY, armZ], [wrist.x + 1.3, armY, armZ]];
    const axes = [[1, 0, 0], [0, 0, 1], pitchAxis, pitchAxis, pitchAxis, [0, 0, 1], [1, 0, 0]];
    group.userData.joints = joints;
    group.userData.cameras = 4;
    group.userData.latchingEndEffectors = 2;
    group.userData.mobileBase = { x: mbsX, face: 'S0 forward face, above Destiny\'s starboard struts', grappleFixtures: 4, mastCamera: true, payloadOruAccommodation: true };
    // All seams, collars and fittings use the hardware's local axis.
    function hardwareFrame(center, axis) {
        const origin = new THREE.Vector3(...center);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(vertical, new THREE.Vector3(...axis).normalize());
        return {
            quaternion,
            point: (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(quaternion).add(origin).toArray(),
            add: (geometry, color) => into.add(geometry.clone().applyQuaternion(quaternion), material(color), center, [1, 1, 1], [0, 0, 0], false),
            wrap: (geometry, surface) => into.add(geometry.clone().applyQuaternion(quaternion), surface, center, [1, 1, 1], [0, 0, 0], false)
        };
    }
    function axialRing(frame, height, radius, tube, color) {
        frame.add(new THREE.TorusGeometry(radius, tube, 6, 28).rotateX(Math.PI / 2).translate(0, height, 0), color);
    }
    function localBox(frame, center, size, color) {
        frame.add(new THREE.BoxGeometry(...size).translate(...center), color);
    }
    function localCylinder(frame, height, radius, length, color) {
        frame.add(new THREE.CylinderGeometry(radius, radius, length, 24).translate(0, height, 0), color);
    }
    const pillow = (x, y, z) => payloadPillow.clone().scale(x, y, z);
    function cameraHead(center, direction) {
        const camera = hardwareFrame(center, direction);
        localBox(camera, [0, 0, 0], [.20, .28, .23], palette.white);
        localBox(camera, [0, .145, 0], [.17, .045, .19], palette.silver);
        localCylinder(camera, .181, .071, .045, palette.dark);
        localCylinder(camera, .207, .050, .010, palette.glass);
        const lamp = hardwareFrame(camera.point(.122, .085, 0), direction);
        localCylinder(lamp, .069, .038, .075, palette.silver);
        localCylinder(lamp, .110, .031, .012, palette.white);
    }
    // Recessed bronze grapple head: backing boss, pale capture rim, dark inset and three radial guides.
    function grappleFixture(center, normal) {
        const f = hardwareFrame(center, normal);
        localBox(f, [0, -.022, 0], [.53, .10, .53], mbsGrey);
        localCylinder(f, -.01, .22, .17, 0x687476);
        localCylinder(f, .060, .292, .052, bronze);
        localCylinder(f, .091, .257, .012, 0x6f664d);
        axialRing(f, .10, .288, .019, 0xd4d1b6); axialRing(f, .101, .255, .012, bronze);
        for (let i = 0; i < 3; i++) {
            const a = i * Math.PI * 2 / 3; f.add(new THREE.BoxGeometry(.034, .025, .218).translate(0, .115, .123).rotateY(a), 0xc1b58c);
            const q = f.point(Math.sin(a) * .245, .116, Math.cos(a) * .245); into.add(shapes.sphere, material(0xd1d2c9), q, [.023, .018, .023], [0, 0, 0], false);
        }
        localCylinder(f, .123, .045, .040, palette.silver); localCylinder(f, .162, .022, .047, 0xe3e5db);
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; f.add(new THREE.CylinderGeometry(.013, .013, .012, 10).translate(Math.sin(a) * .274, .124, Math.cos(a) * .274), 0x757d77); }
    }
    // A latching end effector: blanketed barrel with four latch lobes, bronze-rimmed snare mouth and a grey base collar.
    function endEffector(mouth, outward, withCamera, scale = 1) {
        const dir = new THREE.Vector3(...outward).normalize(), center = new THREE.Vector3(...mouth).addScaledVector(dir, -.5 * scale);
        const end = hardwareFrame(center.toArray(), outward);
        end.wrap(new THREE.CylinderGeometry(.36 * scale, .36 * scale, 1.0 * scale, 32, 1), armBlanket);
        for (let lobe = 0; lobe < 4; lobe++) {
            const a = Math.PI / 4 + lobe * Math.PI / 2;
            end.wrap(new THREE.CylinderGeometry(.11 * scale, .11 * scale, .8 * scale, 16).translate(Math.cos(a) * .37 * scale, -.05 * scale, Math.sin(a) * .37 * scale), armBlanket);
        }
        axialRing(end, .5 * scale, .3 * scale, .045 * scale, bronze);
        localCylinder(end, .44 * scale, .29 * scale, .02, palette.dark);
        for (let latch = 0; latch < 3; latch++) {
            const angle = latch * Math.PI * 2 / 3, next = angle + Math.PI * 2 / 3;
            into.rod(end.point(Math.cos(angle) * .22 * scale, .46 * scale, Math.sin(angle) * .22 * scale), end.point(Math.cos(next) * .22 * scale, .46 * scale, Math.sin(next) * .22 * scale), .009, palette.rail);
        }
        localCylinder(end, -.53 * scale, .38 * scale, .1 * scale, 0x9aa0a3);
        if (withCamera) {
            localBox(end, [.44, -.15, 0], [.16, .17, .16], palette.silver);
            cameraHead(end.point(.54, -.05, 0), outward);
        }
    }
    // Detailed Mobile Base System, seated on the supplied forward-face rail position.
    // The cage stays upright; its occupied fixture faces starboard to meet the unchanged reference arm.
    const mbs = new THREE.Group(); mbs.name = 'Mobile Base System';
    mbs.position.set(.7, -3.045, .375); mbs.scale.x = -1; group.add(mbs);
    const mbsKit = new Kit(); into = mbsKit;
    {
        const mbsX = -1.8, railTop = 7.215, frameY = 7.715, baseZ = .65;
        const fixtureX = -3.775, armY = 8.295, armZ = .65;
        const tan = 0xa89772, mbsGrey = 0xb5bebf;
        const toWorld = p => [.7 - p[0], p[1] - 3.045, p[2] + .375];
        // ---- Mobile transporter and supported forward working platform ----
        const charcoal = 0x596466, edgeGrey = 0x899697, frontZ = -.55, rearZ = 1.40;
        function strut(a, b, width = .10, depth = .13, color = charcoal) {
            const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), axis = bv.clone().sub(av), g = new THREE.BoxGeometry(width, depth, axis.length());
            g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.normalize()));
            into.add(g, material(color, .64, .39), av.add(bv).multiplyScalar(.5).toArray(), [1, 1, 1], [0, 0, 0], false);
        }
        function cableRun(points, r = .014, color = 0xd5d8d0) { into.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(24, points.length * 8), r, 7, false), material(color, .89, .04), [0, 0, 0], [1, 1, 1], [0, 0, 0], false); }
        function bolt(p, axis = [0, 0, -1], r = .027) { const f = hardwareFrame(p, axis); localCylinder(f, 0, r, .020, 0xbec6c1); localCylinder(f, .015, r * .40, .010, 0x4e5a58); }
        // Four bogies contact the supplied model's two forward-face rails.
        // In this mirrored cage frame, world Y = local Y - 3.045 and world Z = local Z + .375.
        for (const dx of [-1.48, 1.48]) {
            for (const y of [7.895, 8.695]) {
                into.cylinder([mbsX + dx, y, 1.38], .15, .19, 0x50595c, [0, 0, 0]);
                into.box([mbsX + dx, y, 1.19], [.40, .20, .18], edgeGrey, [0, 0, 0], false);
                strut([mbsX + dx, y, 1.17], [mbsX + dx, y, 1.36], .12, .10, charcoal);
            }
            strut([mbsX + dx, frameY, 1.19], [mbsX + dx, 8.795, 1.19], .19, .19, edgeGrey);
            strut([mbsX + dx, frameY, frontZ], [mbsX + dx, frameY, rearZ], .19, .21, edgeGrey);
            strut([mbsX + dx, frameY, baseZ], [mbsX + dx, 8.60, 1.19], .08, .10, charcoal);
        }
        for (const z of [frontZ, baseZ, rearZ]) strut([mbsX - 1.92, frameY, z], [mbsX + 1.92, frameY, z], .17, .17, edgeGrey);
        for (const dx of [-1.92, 1.92]) strut([mbsX + dx, frameY, frontZ], [mbsX + dx, frameY, rearZ], .15, .17, 0xc1c8c2);
        for (const z of [frontZ, rearZ]) {
            into.box([mbsX, frameY + .095, z], [3.86, .045, .24], 0xd3d7cf, [0, 0, 0], false);
            for (const dx of [-1.65, -.83, 0, .83, 1.65]) bolt([mbsX + dx, frameY + .124, z], [0, 1, 0], .025);
        }
        strut([mbsX - 1.42, frameY - .02, frontZ], [mbsX + 1.42, frameY - .02, rearZ], .075, .085, charcoal);
        strut([mbsX + 1.42, frameY - .02, frontZ], [mbsX - 1.42, frameY - .02, rearZ], .075, .085, charcoal);
        // A tall, narrow-topped trapezoidal space frame, open on every side.
        const lowY = frameY + .16, midY = frameY + 1.40, topY = frameY + 2.78;
        const lower = (s, back) => [mbsX + s * 1.30, lowY, back ? 1.32 : -.34];
        const middle = (s, back) => [mbsX + s * .86, midY, back ? 1.16 : -.07];
        const upper = (s, back) => [mbsX + s * .34, topY, back ? 1.03 : .26];
        for (const back of [false, true]) {
            for (const s of [-1, 1]) {
                strut(lower(s, back), upper(s, back), .14, .16, charcoal);
                const a = lower(s, back), b = upper(s, back); strut([a[0] + s * .095, a[1], a[2] - .06], [b[0] + s * .07, b[1], b[2] - .06], .055, .10, tan);
                into.box(lower(s, back), [.30, .13, .32], mbsGrey, [0, 0, 0], false); bolt([a[0], a[1] + .09, a[2]], [0, 1, 0]);
            }
            strut(lower(-1, back), lower(1, back), .14, .13, charcoal);
            strut(middle(-1, back), middle(1, back), .10, .12, edgeGrey);
            strut(upper(-1, back), upper(1, back), .14, .13, charcoal);
            strut(lower(-1, back), middle(1, back), .085, .12, charcoal); strut(lower(1, back), middle(-1, back), .085, .12, charcoal);
            strut(middle(-1, back), upper(1, back), .075, .10, tan); strut(middle(1, back), upper(-1, back), .075, .10, charcoal);
        }
        for (const s of [-1, 1]) {
            strut(lower(s, false), lower(s, true), .13, .14, charcoal); strut(middle(s, false), middle(s, true), .09, .12, edgeGrey); strut(upper(s, false), upper(s, true), .12, .14, charcoal);
            strut(lower(s, false), middle(s, true), .075, .10, tan); strut(lower(s, true), middle(s, false), .075, .10, charcoal);
            strut(middle(s, false), upper(s, true), .075, .10, tan);
        }
        // Inset equipment, mounting gussets and small blanket covers leave the trusswork legible.
        for (const [dx, y, z, w, h, d] of [[-.67, frameY + .75, .79, .34, .95, .48], [.50, frameY + .47, 1.22, .48, .43, .50], [.05, frameY + 1.64, .77, .48, .34, .45]]) {
            into.box([mbsX + dx, y, z], [w - .05, h - .05, d - .05], 0x79878a, [0, 0, 0], false);
            into.add(pillow(w, h, d), armBlanket, [mbsX + dx, y, z], [1, 1, 1], [0, 0, 0], false);
            for (const yy of [y - h * .37, y + h * .37]) into.box([mbsX + dx, yy, z - d * .60], [w * .85, .035, .024], 0xbec5c0, [0, 0, 0], false);
        }
        for (const s of [-1, 1]) {
            const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([mbsX + s * 1.14, lowY + .02, -.36, mbsX + s * .62, lowY + .02, -.36, mbsX + s * .97, lowY + .57, -.15], 3)); g.setIndex([0, 1, 2]); g.computeVertexNormals(); const cover = armBlanket.clone(); cover.side = THREE.DoubleSide; into.add(g, cover, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
            into.box([mbsX + s * 1.54, frameY + .20, baseZ], [.56, .24, 1.18], 0xd0d5ce, [0, 0, 0], false);
        }
        // Occupied starboard grapple after the cage mirror: transverse cradle joins the side frame and exactly shares LEE A's axis.
        strut([fixtureX + .08, armY, armZ], [mbsX - .86, midY, baseZ], .16, .20, edgeGrey);
        into.box([fixtureX + .23, armY, armZ], [.44, .53, .58], mbsGrey, [0, 0, 0], false);
        for (const z of [armZ - .25, armZ + .25]) into.box([fixtureX + .10, armY, z], [.50, .43, .06], charcoal, [0, 0, 0], false);
        grappleFixture([fixtureX, armY, armZ], [-1, 0, 0]);
        // Three canted, front-facing carriers match the visible circular heads in the reference.
        const heads = [{ p: [mbsX - 1.32, frameY + .17, -.74], n: [-.12, -.10, -1], from: lower(-1, false) }, { p: [mbsX + 1.32, frameY + .17, -.74], n: [.12, -.10, -1], from: lower(1, false) }, { p: [mbsX + .94, frameY + 1.49, -.30], n: [.15, .05, -1], from: middle(1, false) }];
        for (const h of heads) { strut(h.from, h.p, .13, .14, edgeGrey); grappleFixture(h.p, h.n); }
        // Dark cable service loops, white harness clips and connector panels under the forward sill.
        for (const s of [-1, 1]) {
            cableRun([[mbsX + s * 1.12, frameY + .14, -.23], [mbsX + s * 1.64, frameY - .11, -.29], [mbsX + s * 1.44, frameY - .37, .27], [mbsX + s * .75, frameY - .29, .70], [mbsX + s * .63, frameY + .39, .91]], .025, 0x535e5e);
            for (let k = 0; k < 3; k++)cableRun([[mbsX + s * .25 + k * .034, frameY + 1.68, .48], [mbsX + s * .40 + k * .034, frameY + 1.11, .53], [mbsX + s * .62 + k * .034, frameY + .46, .44], [mbsX + s * .88 + k * .034, frameY + .12, .26]], .011);
        }
        into.box([mbsX + .1, frameY + .18, -.42], [.57, .20, .12], 0xbec6c2, [0, 0, 0], false);
        for (const dx of [-.16, 0, .16]) into.cylinder([mbsX + .1 + dx, frameY + .18, -.495], .043, .035, 0x374747);
        // Short camera mast at the narrow top, on a bolted head plate.
        into.box([mbsX, topY + .075, .65], [.48, .11, .83], edgeGrey, [0, 0, 0], false);
        into.rod([mbsX, topY + .10, .65], [mbsX, topY + .43, .65], .048, palette.silver); cameraHead([mbsX, topY + .57, .65], [0, .04, -1]);
        // Payload/ORU accommodation remains a separate right-hand cradle behind the front fixture carriers.
        strut([mbsX + .90, frameY + .39, 1.32], [mbsX + 1.78, frameY + .39, 1.32], .18, .20, charcoal);
        endEffector([mbsX + 2.46, frameY + .39, 1.32], [1, 0, 0], false, .72);
        group.userData.mobileBase.frontFixtureCenters = heads.map(h => toWorld(h.p));


    }
    mbsKit.finish(mbs); into = kit;
    group.userData.grappleInterface = { fixture: [4.475, armY, armZ], fixtureNormal: [1, 0, 0], mouth: [mouthA, armY, armZ], mouthNormal: [-1, 0, 0], seatedOffset: .115 };
    group.userData.boomLengths = [shoulder.distanceTo(elbow), elbow.distanceTo(wrist)];
    group.userData.mobileBase.railCenterlinesY = [4.85, 5.65];
    group.userData.mobileBase.railContactFaceZ = railFace;
    group.userData.mobileBase.referenceOrigin = [mbsX, railCenterY, railFace];
    group.userData.armPoseSource = '02 ISS Space Station 3D.html';
    // ---- Canadarm2 ----
    // Seven joints: blanketed, box-like housings around a rotating drum with dark seams on its axis.
    for (let joint = 0; joint < joints.length; joint++) {
        const size = joint === 3 ? .8 : .66, housing = hardwareFrame(joints[joint], axes[joint]);
        housing.wrap(pillow(size, size * .92, size), armBlanket);
        localCylinder(housing, 0, .3, size + .08, palette.white);
        for (const side of [-1, 1]) {
            axialRing(housing, side * (size / 2 + .02), .305, .02, palette.dark);
            localCylinder(housing, side * (size / 2 + .045), .24, .02, palette.silver);
        }
    }
    // Short blanketed links between the shoulder and wrist joints.
    for (const [from, to] of [[0, 1], [1, 2], [4, 5], [5, 6]]) {
        const a = new THREE.Vector3(...joints[from]), b = new THREE.Vector3(...joints[to]), link = hardwareFrame(a.clone().lerp(b, .5).toArray(), b.clone().sub(a).toArray());
        link.wrap(pillow(.46, Math.max(.2, a.distanceTo(b) - .2), .46), armBlanket);
    }
    // Lettering that runs along each boom, set on the upper side.
    const lettering = (() => {
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 512; const g = canvas.getContext('2d');
        g.translate(44, 488); g.rotate(-Math.PI / 2); g.font = 'italic 48px Georgia, "Times New Roman", serif'; g.fillStyle = '#3a3f45'; g.fillText('Canadarm', 0, 0);
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const ink = new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: .3, roughness: .8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
        ink.userData.decal = true; return ink;
    })();
    // Two booms: blanketed tubes with end collars, electronics boxes, a camera/light each, the lettering, and a blue band near the wrist.
    for (const [from, to, cameraAt, blue] of [[shoulder, elbow, .42, false], [elbow, wrist, .58, true]]) {
        const axis = to.clone().sub(from), length = axis.length(), dir = axis.clone().normalize(), frame = hardwareFrame(from.clone().lerp(to, .5).toArray(), dir.toArray());
        const span = length - .6, side = new THREE.Vector3(...pitchAxis);
        frame.wrap(new THREE.CylinderGeometry(.19, .19, span, 28, 1), boomBlanket);
        for (const end of [-1, 1]) { localCylinder(frame, end * (span / 2 - .1), .235, .16, palette.white); axialRing(frame, end * (span / 2 - .19), .236, .018, palette.silver); }
        const at = t => from.clone().addScaledVector(dir, length * t);
        for (const [t, s] of [[.22, 1], [.78, -1]]) { const box = hardwareFrame(at(t).addScaledVector(side, s * .34).toArray(), dir.toArray()); box.wrap(pillow(.3, .52, .3), armBlanket); }
        const bracket = at(cameraAt).addScaledVector(side, -.3);
        kit.rod(at(cameraAt).addScaledVector(side, -.18).toArray(), bracket.toArray(), .04, palette.silver);
        cameraHead(bracket.addScaledVector(side, -.12).toArray(), dir.clone().multiplyScalar(from === shoulder ? 1 : -1).toArray());
        // The lettering faces the side of the boom nearest to straight up.
        const up = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize().applyQuaternion(frame.quaternion.clone().invert());
        const facing = Math.atan2(up.x, up.z);
        frame.wrap(new THREE.CylinderGeometry(.194, .194, 1.9, 6, 1, true, facing - .45, .9).translate(0, (from === shoulder ? .12 : -.12) * span, 0), lettering);
        if (blue) localCylinder(frame, span / 2 - .55, .197, .14, 0x2a56a8);
    }
    // LEE "A" grapples the base's starboard fixture; LEE "B" is free at the far end.
    endEffector([mouthA, armY, armZ], [-1, 0, 0], true);
    endEffector([wrist.x + 2.56, armY, armZ], [1, 0, 0], true);
    const armModel = new THREE.Group(); armModel.name = 'Canadarm2 reference pose'; kit.finish(armModel); group.add(armModel);
});
