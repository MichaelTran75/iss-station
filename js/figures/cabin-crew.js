// Crew at work inside Tranquility: one exercising on the resistive exerciser, one passing through between the two
// hatches (out with a wave, back hugging a cargo bag), and one in the Cupola with a camera. They are the Columbus
// crew model (lab.addCrew) posed here every frame, with no baked clips: the body is placed, then each limb is solved
// to a target. All of the solving is in world space, so a figure can live in any frame of the station.
//
// Conventions of the model: bone +y runs to the next joint; a hand's +y is its fingers and +z the palm's normal; the
// figure's own frame (the group, origin at the hips) has +y to the head, +z to the front and +x to its left.
import * as THREE from 'three';
import { parts } from '../core/station.js';
import { Kit, material } from '../core/kit.js';

const lab = parts.get('columbus').group.userData.lab, node = parts.get('tranquility').group;
const { tube, ared, open } = node.userData.cabin, cupola = node.userData.cupola;
const B = { hips: 0, spine: 1, chest: 2, upper: 3, neck: 4, head: 5,
    L: { arm: 7, fore: 8, hand: 9, fingers: 10, upLeg: 48, leg: 49, foot: 50 }, R: { arm: 26, fore: 27, hand: 28, fingers: 29, upLeg: 44, leg: 45, foot: 46 } };
// Finger bones follow the hand in this order, three joints each.
const FINGER = { Middle: 0, Thumb: 3, Index: 6, Ring: 9, Pinky: 12 };

const clamp01 = x => Math.min(1, Math.max(0, x)), smooth = x => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const ramp = (t, a, b) => smooth((t - a) / (b - a)), span = (t, a, b, c, d) => ramp(t, a, b) * (1 - ramp(t, c, d));
const mix = (a, b, k) => a + (b - a) * k, rad = THREE.MathUtils.degToRad;
const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
const qa = Q(), qb = Q(), qc = Q(), m4 = new THREE.Matrix4(), euler = new THREE.Euler();
const s0 = V(), e0 = V(), w0 = V(), dir0 = V(), bend0 = V(), k0 = V(), x0 = V(), y0 = V(), z0 = V();
const at = (bone, out) => out.setFromMatrixPosition(bone.matrixWorld);

// Turns a bone by a world rotation, about its own joint.
function turnWorld(bone, q) { bone.parent.getWorldQuaternion(qa); bone.quaternion.premultiply(qc.copy(qa).invert().multiply(q).multiply(qa)); bone.updateMatrixWorld(true); }
function swing(bone, from, to) { turnWorld(bone, qb.setFromUnitVectors(from.normalize(), to.normalize())); }
function spin(bone, axis, angle) { turnWorld(bone, qb.setFromAxisAngle(axis, angle)); }
// Gives a bone a world orientation outright.
function face(bone, q) { bone.parent.getWorldQuaternion(qa); bone.quaternion.copy(qa.invert()).multiply(q); bone.updateMatrixWorld(true); }
// Orientation whose +y is `y` and whose +z is as near `z` as that allows; basisZ keeps +z and bends +y.
function basis(y, z, out) { y0.copy(y).normalize(); z0.copy(z).addScaledVector(y0, -z.dot(y0)).normalize(); x0.crossVectors(y0, z0); return out.setFromRotationMatrix(m4.makeBasis(x0, y0, z0)); }
function basisZ(z, y, out) { z0.copy(z).normalize(); y0.copy(y).addScaledVector(z0, -y.dot(z0)).normalize(); x0.crossVectors(y0, z0); return out.setFromRotationMatrix(m4.makeBasis(x0, y0, z0)); }
// Two-bone solve: the end joint goes to `target` (as far as the limb reaches), the middle joint bends toward `pole`.
function reach(upper, lower, end, target, pole) {
    at(upper, s0); at(lower, e0); at(end, w0);
    const a = s0.distanceTo(e0), b = e0.distanceTo(w0);
    dir0.copy(target).sub(s0); const d = THREE.MathUtils.clamp(dir0.length(), Math.abs(a - b) + .01, a + b - .004); dir0.normalize();
    const along = (a * a - b * b + d * d) / (2 * d), out = Math.sqrt(Math.max(0, a * a - along * along));
    bend0.copy(pole).addScaledVector(dir0, -pole.dot(dir0)).normalize();
    k0.copy(dir0).multiplyScalar(along).addScaledVector(bend0, out);
    swing(upper, e0.sub(s0), k0);
    at(lower, e0); at(end, w0); k0.copy(s0).addScaledVector(dir0, d).sub(e0);
    swing(lower, w0.sub(e0), k0);
}
// Moves a share of the hand's twist about the forearm into the forearm, so the wrist does not wring.
function shareTwist(fore, hand, bind, share) {
    const axis = x0.copy(hand.position).normalize(), turn = qb.copy(hand.quaternion).multiply(qc.copy(bind).invert());
    const along = turn.x * axis.x + turn.y * axis.y + turn.z * axis.z, length = Math.hypot(along, turn.w);
    if (length < 1e-5) return;
    const sign = turn.w < 0 ? -1 : 1; qc.set(axis.x * along * sign / length, axis.y * along * sign / length, axis.z * along * sign / length, turn.w * sign / length);
    qb.identity().slerp(qc, share); fore.quaternion.multiply(qb); hand.quaternion.premultiply(qb.invert()); fore.updateMatrixWorld(true);
}

function actor(name, look, home) {
    const person = lab.addCrew(name, look, home), bones = person.userData.boneList, bind = person.userData.bind, model = [];
    bones.forEach((bone, i) => { const parent = bones.indexOf(bone.parent); model[i] = parent < 0 ? bind[i].clone() : model[parent].clone().multiply(bind[i]); });
    const flex = bones.map(bone => lab.axes.flex[bone.name] ? new THREE.Vector3(...lab.axes.flex[bone.name]) : null);
    return { person, bones, bind, model, flex, home, world: Q(), homeWorld: Q() };
}
// Back to the bind pose, hips at the given place of the home frame.
function begin(a, position, quaternion) {
    a.bones.forEach((bone, i) => bone.quaternion.copy(a.bind[i])); a.bones[0].position.set(0, 0, 0);
    a.person.position.copy(position); a.person.quaternion.copy(quaternion); a.person.updateWorldMatrix(true, true);
    a.home.getWorldQuaternion(a.homeWorld); a.world.copy(a.homeWorld).multiply(quaternion);
}
const own = (a, x, y, z, out) => out.set(x, y, z).applyQuaternion(a.world);                       // direction, figure frame
const ownPoint = (a, x, y, z, out) => out.set(x, y, z).applyMatrix4(a.person.matrixWorld);       // point, figure frame
const homeDir = (a, x, y, z, out) => out.set(x, y, z).applyQuaternion(a.homeWorld);
const homePoint = (a, x, y, z, out) => out.set(x, y, z).applyMatrix4(a.home.matrixWorld);
// Hand to a palm point: `fingers` and `palm` are world directions, the palm's centre lands on `point`.
const hq = Q(), wrist = V();
function hold(a, S, point, fingers, palm, pole, depth = .025, along = .08) {
    basis(fingers, palm, hq); wrist.copy(point).addScaledVector(y0, -along).addScaledVector(z0, -depth);
    reach(a.bones[S.arm], a.bones[S.fore], a.bones[S.hand], wrist, pole);
    face(a.bones[S.hand], hq); shareTwist(a.bones[S.fore], a.bones[S.hand], a.bind[S.hand], .5);
}
function curl(a, S, amount, thumb = amount * .5, index = amount) {
    for (const [finger, first] of Object.entries(FINGER)) for (let k = 0; k < 3; k++) {
        const i = S.fingers + first + k, axis = a.flex[i]; if (!axis) continue;
        const angle = finger === 'Thumb' ? (k ? [0, .5, .6][k] * thumb : 0) : [.8, 1, .6][k] * (finger === 'Index' ? index : amount);
        a.bones[i].quaternion.multiply(qb.setFromAxisAngle(axis, angle));
    }
}
const prop = (kit, name, parent) => { const group = new THREE.Group(); group.name = name; kit.finish(group); parent.add(group);
    group.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; } }); return group; };

export const tune = {
    lifter: { bar: [.47, -.125], grip: .40, ankle: [.03, .112, .17], toe: .21, lean: [8, 28], depth: .27, hips: .962, fist: .105, forehead: [.125, .1] },
    traveller: { line: [.24, .12, .28], speed: .28, chest: [-.35, -.94] },
    watcher: { hips: -2.60, off: .13, side: .10, tilt: 18, eye: [.07, .09], post: -3.15 }
};

// ---- The exerciser's user: squats with the bar on the shoulders, eight at a time, then a breather. ----
const lifter = actor('Tranquility crew / exercising', { skin: 0x8d5b3c, shirt: 0x9aa3a8, shorts: 0x22262b, shoes: 0x3a3d42, hair: 0x18120f }, tube);
const A = V(), Bv = V(), C = V(), D = V(), E = V(), F = V(), G = V(), H = V(), q0 = Q(), q1 = Q(), q2 = Q(), q3 = Q(), down = new THREE.Vector3(0, -1, 0);
// Hips and bar for a squat depth: the bar rides the lift arm's arc, the hips sit where that puts the shoulders.
function stance(p, depth, ease, out) {
    const lean = rad(mix(p.lean[0], p.lean[1], depth) - 3 * ease), c = Math.cos(lean), s = Math.sin(lean);
    const hy = ared.top + p.hips - p.depth * depth, by = hy + p.bar[0] * c - p.bar[1] * s;
    const bx = ared.pivot[0] + Math.sqrt(Math.max(0, ared.reach ** 2 - (by - ared.pivot[1]) ** 2));
    out.lean = lean; out.hy = hy; out.by = by; out.bx = bx; out.hx = bx - (p.bar[0] * s + p.bar[1] * c); return out;
}
const pose = {};
function updateLifter(time) {
    const a = lifter, p = tune.lifter, bones = a.bones, loop = 50, rep = 4.4, work = 8 * rep, t = time % loop, u = t % rep, rest = t - work, pause = loop - work;
    const depth = t >= work ? 0 : u < 2 ? smooth(u / 2) : u < 2.15 ? 1 : 1 - smooth((u - 2.15) / 1.8);
    const ease = rest > 0 ? span(rest, 0, 1.6, pause - 1.6, pause) : 0;
    const ankleX = stance(p, 0, 0, pose).hx - p.ankle[0];
    stance(p, depth, ease, pose);
    begin(a, A.set(pose.hx, pose.hy, ared.z), q0.setFromEuler(euler.set(pose.lean, Math.PI / 2, 0, 'YXZ')));
    // The machine follows the bar.
    const swingAngle = Math.atan2(pose.by - ared.pivot[1], pose.bx - ared.pivot[0]); ared.arm.rotation.z = swingAngle;
    ared.rods.forEach((rod, i) => {
        rod.position.set(ared.pivot[0] + ared.rodFrom * ared.reach * Math.cos(swingAngle), ared.pivot[1] + ared.rodFrom * ared.reach * Math.sin(swingAngle), ared.rodTo[i][2]);
        rod.quaternion.setFromUnitVectors(down, A.fromArray(ared.rodTo[i]).sub(rod.position).normalize());
    });
    // Breathing, deeper after the set.
    const hard = rest > 0 ? 1 - ramp(rest, 3, pause - 1) : ramp(t, 4, work), breath = Math.sin(time * mix(1.6, 2.9, hard)) * mix(.008, .024, hard);
    own(a, 1, 0, 0, A); spin(bones[B.chest], A, -breath); spin(bones[B.upper], A, -breath);
    // Legs to the foot plate, feet flat and turned out a little.
    for (const [S, side] of [[B.L, -1], [B.R, 1]]) {
        homePoint(a, ankleX, ared.top + p.ankle[1], ared.z + side * p.ankle[2], A); homeDir(a, 1, .1, side * .45, Bv);
        reach(bones[S.upLeg], bones[S.leg], bones[S.foot], A, Bv);
        face(bones[S.foot], q1.copy(a.homeWorld).multiply(q2.setFromEuler(euler.set(0, Math.PI / 2 - side * p.toe, 0, 'YXZ'))).multiply(a.model[S.foot]));
    }
    // Head: level through the squat; a look down while wiping the brow, then a glance at the hatch.
    const wipe = rest > 0 ? span(rest, 2.5, 4.6, 7.4, 9.5) : 0, glance = rest > 0 ? span(rest, 9.8, 11.2, 12.6, 13.8) : 0;
    const nod = .16 * wipe + .02 * Math.sin(time * .7), yaw = .6 * glance + .03 * Math.sin(time * .43);
    face(bones[B.neck], q1.copy(a.homeWorld).multiply(q2.setFromEuler(euler.set(pose.lean * .6 + nod * .4, Math.PI / 2 - yaw * .4, 0, 'YXZ'))).multiply(a.model[B.neck]));
    face(bones[B.head], q1.copy(a.homeWorld).multiply(q2.setFromEuler(euler.set(pose.lean * .25 + nod, Math.PI / 2 - yaw, 0, 'YXZ'))).multiply(a.model[B.head]));
    // Hands on the bar; in the breather the right one lets go and wipes the brow.
    for (const [S, side] of [[B.L, -1], [B.R, 1]]) {
        homePoint(a, pose.bx, pose.by, ared.z + side * p.grip, A);                      // the bar inside the fist
        own(a, -side * .12, 1, -.05, Bv); own(a, 0, .12, 1, C); own(a, -side * .25, -1, -.45, D);
        const free = side > 0 ? wipe : 0;
        if (free > 0) {
            basis(Bv, C, q2); A.addScaledVector(z0, -.03);       // palm centre on the bar side
            const head = bones[B.head]; at(head, E); head.getWorldQuaternion(q3);
            const sweep = .045 * Math.sin((rest - 4.6) * Math.PI * 2 / 1.4) * span(rest, 4.6, 5, 7, 7.4);
            F.set(0, 1, 0).applyQuaternion(q3); G.set(0, 0, 1).applyQuaternion(q3); H.set(1, 0, 0).applyQuaternion(q3);
            E.addScaledVector(F, p.forehead[0]).addScaledVector(G, p.forehead[1] + .012).addScaledVector(H, sweep - .02);
            A.lerp(E, free).addScaledVector(own(a, -.5, 0, .6, E), .09 * Math.sin(Math.PI * free));
            Bv.copy(H).multiplyScalar(.85).addScaledVector(F, .5); C.copy(G).negate(); basis(Bv, C, q3); q2.slerp(q3, free);
            Bv.set(0, 1, 0).applyQuaternion(q2); C.set(0, 0, 1).applyQuaternion(q2);
            D.lerp(own(a, -.6, -1, .25, E), free).normalize();
            hold(a, S, A, Bv, C, D, .02, mix(p.fist, .08, free)); curl(a, S, mix(1.3, .25, free));
        } else { hold(a, S, A, Bv, C, D, .03, p.fist); curl(a, S, 1.3, 1); }
    }
}

// ---- The one passing through: Unity to the far hatch with a wave, back later with a cargo bag. ----
const traveller = actor('Tranquility crew / passing through', { skin: 0xe0b592, shirt: 0xb8452f, shorts: 0xc9b68f, shoes: 0xf0f0ea, hair: 0x7a4a26 }, tube);
const bagKit = new Kit();
bagKit.box([0, 0, 0], [.42, .32, .24], 0xeeeee8, [0, 0, 0], false);
for (const x of [-.11, .11]) bagKit.box([x, 0, 0], [.035, .326, .246], 0x40607c, [0, 0, 0], false);
bagKit.box([0, .05, .122], [.14, .08, .004], 0xd9b23c, [0, 0, 0], false);
const bag = prop(bagKit, 'Cargo transfer bag', traveller.person); bag.position.set(0, .33, .27);
function updateTraveller(time) {
    const a = traveller, p = tune.traveller, bones = a.bones, loop = 64, t = time % loop, from = open.z1 + 1.12, to = open.z0 - 1.12, length = from - to;
    const back = t >= 33, start = back ? 33 : 1, along = (t - start) * p.speed;
    a.person.visible = along > 0 && along < length; if (!a.person.visible) return;
    const way = back ? 1 : -1, z = back ? to + along : from - along; bag.visible = back;
    const roll = .09 * Math.sin(time * .31 + 1), c = Math.cos(roll), s = Math.sin(roll);
    // The line swings wide of the exerciser and the body follows it.
    const wide = z => p.line[0] + p.line[2] * span(z, ared.z - 1.9, ared.z - .5, ared.z + .5, ared.z + 1.9), slope = (wide(z + .05) - wide(z - .05)) / .1;
    A.set(.03 * Math.sin(time * .23) + slope * way, .05 + .02 * Math.sin(time * .37), way); Bv.set(p.chest[0] * c - p.chest[1] * s, p.chest[0] * s + p.chest[1] * c, 0);
    begin(a, C.set(wide(z), p.line[1] + .012 * Math.sin(time * .5), z), basis(A, Bv, q0));
    own(a, 1, 0, 0, A); own(a, 0, 1, 0, Bv);
    // Looking ahead: the back, neck and head arch; the head turns to the exerciser when passing it.
    const near = span(z, ared.z - .5, ared.z + .2, ared.z + 1.1, ared.z + 1.9), turn = (back ? -.75 : .8) * near, nod = back ? .1 * span(z, ared.z - .2, ared.z + .1, ared.z + .3, ared.z + .7) : 0;
    spin(bones[B.chest], A, -.1); spin(bones[B.upper], A, -.12 + .012 * Math.sin(time * 1.5));
    spin(bones[B.neck], A, -.3 + .06 * Math.abs(turn)); spin(bones[B.head], A, -.36 + .08 * Math.abs(turn) + nod);
    spin(bones[B.neck], Bv, turn * .4); spin(bones[B.head], Bv, turn * .6);
    // Legs trail, knees a little bent, toes relaxed.
    for (const [S, phase] of [[B.L, 0], [B.R, 2.1]]) {
        spin(bones[S.upLeg], A, -.1 - .07 * Math.sin(time * .55 + phase)); spin(bones[S.leg], A, .42 + .12 * Math.sin(time * .47 + phase)); spin(bones[S.foot], A, .5);
    }
    if (back) {
        // Both arms around the bag.
        for (const [S, side] of [[B.L, 1], [B.R, -1]]) {
            ownPoint(a, side * .1, .31, .395, C); own(a, -side, .12, .1, D); own(a, 0, .1, -1, E); own(a, side, -.6, .2, F);
            hold(a, S, C, D, E, F, .012); curl(a, S, .22);
        }
        return;
    }
    // Out: the right hand leads, the left waves to the exerciser on the way past.
    const wave = span(z, ared.z + .35, ared.z + .9, ared.z + 1.5, ared.z + 2.1), beat = Math.sin((t - start) * Math.PI * 1.5);
    ownPoint(a, -.22, .89 + .015 * Math.sin(time * .6), .15, C); own(a, .2, .95, .15, D); own(a, .15, -.2, .95, E); own(a, -1, -.3, .5, F);
    hold(a, B.R, C, D, E, F); curl(a, B.R, .3);
    ownPoint(a, mix(.24, .42, wave), mix(.36, .56 + .025 * beat * wave, wave), mix(.28, -.04, wave), C);
    own(a, mix(-.2, .15, wave), mix(.9, .45 + .45 * beat * wave, wave), mix(.35, -.85, wave), D); own(a, mix(-.2, 1, wave), mix(-.3, 0, wave), mix(.9, .1, wave), E);
    own(a, 1, -.5, mix(-.2, .3, wave), F);
    hold(a, B.L, C, D, E, F); curl(a, B.L, mix(.3, .08, wave));
}

// ---- In the Cupola: head toward the Earth, a camera, and now and then a hand on the window frame. ----
const watcher = actor('Tranquility crew / at the Cupola windows', { skin: 0xd9a77f, shirt: 0x27406b, shorts: 0x6e6a5b, shoes: 0xe9e9e4, hair: 0x3a2a1e }, node);
const cameraKit = new Kit();
cameraKit.box([0, 0, 0], [.14, .095, .065], 0x1b1d20, [0, 0, 0], false); cameraKit.box([0, .06, -.005], [.06, .03, .05], 0x1b1d20, [0, 0, 0], false);
cameraKit.cylinder([0, -.005, .085], .039, .11, 0x26292d); cameraKit.cylinder([0, -.005, .142], .042, .012, 0x54595e);
cameraKit.add(new THREE.CircleGeometry(.033, 20), material(0x31465c, .15, .6), [0, -.005, .149], [1, 1, 1], [0, 0, 0], false);
const camera = prop(cameraKit, 'Camera', node);
const facet = 2, theta = facet * Math.PI / 3 + Math.PI / 6, outward = [Math.sin(theta), 0, Math.cos(theta)], corner = [Math.sin(theta - Math.PI / 6), 0, Math.cos(theta - Math.PI / 6)];
function updateWatcher(time) {
    const a = watcher, p = tune.watcher, bones = a.bones, t = time % 40, [cx, cz] = cupola.center;
    const raise = span(t, 14, 17, 24, 27), out = span(t, 28.5, 31.2, 35.5, 38.2);
    const tilt = rad(p.tilt + 1.5 * Math.sin(time * .29)) + .05 * out, c = Math.cos(tilt), s = Math.sin(tilt), lean = .05 * Math.sin(time * .21) + .12 * out;
    // Head toward nadir, tipped back from the window so the body already faces down through it.
    A.set(-outward[0] * s + corner[0] * lean, -c, -outward[2] * s + corner[2] * lean); Bv.set(outward[0] * c, -s, outward[2] * c);
    const aside = p.side + .05 * out;
    begin(a, C.set(cx + outward[0] * p.off + corner[0] * aside, p.hips + .012 * Math.sin(time * .4), cz + outward[2] * p.off + corner[2] * aside), basis(A, Bv, q0));
    own(a, 1, 0, 0, A);
    const breath = .008 * Math.sin(time * 1.45); spin(bones[B.chest], A, -.05 - breath); spin(bones[B.upper], A, -.06 - breath);
    for (const [S, phase] of [[B.L, 0], [B.R, 1.7]]) { spin(bones[S.upLeg], A, -.25 - .05 * Math.sin(time * .33 + phase)); spin(bones[S.leg], A, .5 + .08 * Math.sin(time * .41 + phase)); spin(bones[S.foot], A, .45); }
    // Gaze: through the pane, drifting; steadier behind the camera; further down when holding the frame.
    const pan = (.22 * Math.sin(time * .17) + .08 * Math.sin(time * .41)) * (1 - .7 * raise), dip = .57 + .07 * Math.sin(time * .23) * (1 - raise) + .3 * out;
    homeDir(a, outward[0] * .82 + corner[0] * pan, -dip, outward[2] * .82 + corner[2] * pan, Bv).normalize(); own(a, 0, 1, 0, C);
    basisZ(Bv, C, q1); bones[B.neck].getWorldQuaternion(q2); face(bones[B.neck], q2.slerp(q3.copy(q1).multiply(a.model[B.neck]), .45));
    face(bones[B.head], q3.copy(q1).multiply(a.model[B.head]));
    // The camera: at the chest, or up at the eye. Both hands carry it; the left leaves it for the frame.
    const head = bones[B.head]; at(head, D); E.set(0, 1, 0).applyQuaternion(q1);
    D.addScaledVector(E, p.eye[0] - .012).addScaledVector(Bv, p.eye[1] + .075);                      // camera centre at the eye
    at(bones[B.upper], F); F.addScaledVector(own(a, 0, .02, .27, G), 1); own(a, 0, .34, .94, G); own(a, 0, 1, 0, H);
    basisZ(G, H, q2); const shot = Math.max(0, ...[18.6, 20.4, 22.5].map(at0 => 1 - Math.abs(t - at0) / .22));
    F.lerp(D, raise); q2.slerp(q1, raise);
    camera.position.copy(node.worldToLocal(D.copy(F))); camera.quaternion.copy(a.homeWorld).invert().multiply(q2);
    const cf = G.set(0, 0, 1).applyQuaternion(q2), cu = H.set(0, 1, 0).applyQuaternion(q2), cl = E.set(1, 0, 0).applyQuaternion(q2);
    C.copy(F).addScaledVector(cl, -.084).addScaledVector(cu, -.012); D.copy(cu).multiplyScalar(.85).addScaledVector(cf, .5);
    hold(a, B.R, C, D, cl, own(a, -.5, -1, -.25, A), .02); curl(a, B.R, .55, .4, .55 + .3 * shot);
    C.copy(F).addScaledVector(cf, .085).addScaledVector(cu, -.05); D.copy(cf).multiplyScalar(.55).addScaledVector(cl, -.83); Bv.copy(cu);
    own(a, .5, -1, -.25, A);
    if (out > 0) {
        // The corner of the cabin wall between this pane and the next, palm flat on it and fingers up the slope.
        const r = cupola.wall(p.post) - .03, y = p.post;
        homePoint(a, cx + corner[0] * r, y, cz + corner[2] * r, F); C.lerp(F, out).addScaledVector(own(a, 0, -.3, .5, F), .06 * Math.sin(Math.PI * out));
        homeDir(a, corner[0] * .76, -.65, corner[2] * .76, F); homeDir(a, corner[0] * .65, .76, corner[2] * .65, G);
        basis(D, Bv, q1); basis(G, F, q3); q1.slerp(q3, out); D.set(0, 1, 0).applyQuaternion(q1); Bv.set(0, 0, 1).applyQuaternion(q1);
    }
    hold(a, B.L, C, D, Bv, A, .03); curl(a, B.L, mix(.3, .7, out));
}

export function updateCabinCrew(time) {
    if (!node.visible) return;
    updateLifter(time); updateTraveller(time); updateWatcher(time);
}
export const cabinCrew = { lifter, traveller, watcher, tune, bag, camera, update: updateCabinCrew };
updateCabinCrew(0);
