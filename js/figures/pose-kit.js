// Posing for the crew model of Columbus (lab.addCrew) wherever a module uses it: Tranquility (js/figures/cabin-crew.js),
// the Crew Dragon transfer (js/figures/dragon-transfer.js), the Columbus crew's day (js/figures/lab-crew.js). No baked
// clips: the body is placed, then each limb is solved
// to a target, all in world space, so a figure can live in any frame of the station.
//
// Conventions of the model: bone +y runs to the next joint; a hand's +y is its fingers and +z the palm's normal; the
// figure's own frame (the group, origin at the hips) has +y to the head, +z to the front and +x to its left.
// basis() leaves the axes it built in `basisAxes` (x, y, z), for callers that place things on them.
import * as THREE from 'three';
import { parts } from '../core/station.js';

const lab = parts.get('columbus').group.userData.lab;
export const B = { hips: 0, spine: 1, chest: 2, upper: 3, neck: 4, head: 5,
    L: { arm: 7, fore: 8, hand: 9, fingers: 10, upLeg: 48, leg: 49, foot: 50 }, R: { arm: 26, fore: 27, hand: 28, fingers: 29, upLeg: 44, leg: 45, foot: 46 } };
// Finger bones follow the hand in this order, three joints each.
export const FINGER = { Middle: 0, Thumb: 3, Index: 6, Ring: 9, Pinky: 12 };

export const clamp01 = x => Math.min(1, Math.max(0, x)), smooth = x => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export const ramp = (t, a, b) => smooth((t - a) / (b - a)), span = (t, a, b, c, d) => ramp(t, a, b) * (1 - ramp(t, c, d));
export const mix = (a, b, k) => a + (b - a) * k, rad = THREE.MathUtils.degToRad;
const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
const qa = Q(), qb = Q(), qc = Q(), m4 = new THREE.Matrix4();
const s0 = V(), e0 = V(), w0 = V(), dir0 = V(), bend0 = V(), k0 = V(), x0 = V(), y0 = V(), z0 = V();
export const at = (bone, out) => out.setFromMatrixPosition(bone.matrixWorld);

// Turns a bone by a world rotation, about its own joint.
export function turnWorld(bone, q) { bone.parent.getWorldQuaternion(qa); bone.quaternion.premultiply(qc.copy(qa).invert().multiply(q).multiply(qa)); bone.updateMatrixWorld(true); }
export function swing(bone, from, to) { turnWorld(bone, qb.setFromUnitVectors(from.normalize(), to.normalize())); }
export function spin(bone, axis, angle) { turnWorld(bone, qb.setFromAxisAngle(axis, angle)); }
// Gives a bone a world orientation outright.
export function face(bone, q) { bone.parent.getWorldQuaternion(qa); bone.quaternion.copy(qa.invert()).multiply(q); bone.updateMatrixWorld(true); }
// Orientation whose +y is `y` and whose +z is as near `z` as that allows; basisZ keeps +z and bends +y.
export function basis(y, z, out) { y0.copy(y).normalize(); z0.copy(z).addScaledVector(y0, -z.dot(y0)).normalize(); x0.crossVectors(y0, z0); return out.setFromRotationMatrix(m4.makeBasis(x0, y0, z0)); }
export function basisZ(z, y, out) { z0.copy(z).normalize(); y0.copy(y).addScaledVector(z0, -y.dot(z0)).normalize(); x0.crossVectors(y0, z0); return out.setFromRotationMatrix(m4.makeBasis(x0, y0, z0)); }
// Two-bone solve: the end joint goes to `target` (as far as the limb reaches), the middle joint bends toward `pole`.
export function reach(upper, lower, end, target, pole) {
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
export function shareTwist(fore, hand, bind, share) {
    const axis = x0.copy(hand.position).normalize(), turn = qb.copy(hand.quaternion).multiply(qc.copy(bind).invert());
    const along = turn.x * axis.x + turn.y * axis.y + turn.z * axis.z, length = Math.hypot(along, turn.w);
    if (length < 1e-5) return;
    const sign = turn.w < 0 ? -1 : 1; qc.set(axis.x * along * sign / length, axis.y * along * sign / length, axis.z * along * sign / length, turn.w * sign / length);
    qb.identity().slerp(qc, share); fore.quaternion.multiply(qb); hand.quaternion.premultiply(qb.invert()); fore.updateMatrixWorld(true);
}

// A figure to pose: a new one in `home` (actor), or one that exists already, such as the Columbus crew (wrap).
export function wrap(person, home) {
    const bones = person.userData.boneList, bind = person.userData.bind, model = [];
    bones.forEach((bone, i) => { const parent = bones.indexOf(bone.parent); model[i] = parent < 0 ? bind[i].clone() : model[parent].clone().multiply(bind[i]); });
    const flex = bones.map(bone => lab.axes.flex[bone.name] ? new THREE.Vector3(...lab.axes.flex[bone.name]) : null);
    return { person, bones, bind, model, flex, home, world: Q(), homeWorld: Q() };
}
export const actor = (name, look, home) => wrap(lab.addCrew(name, look, home), home);
// Back to the bind pose, hips at the given place of the home frame.
export function begin(a, position, quaternion) {
    a.bones.forEach((bone, i) => bone.quaternion.copy(a.bind[i])); a.bones[0].position.set(0, 0, 0);
    a.person.position.copy(position); a.person.quaternion.copy(quaternion); a.person.updateWorldMatrix(true, true);
    a.home.getWorldQuaternion(a.homeWorld); a.world.copy(a.homeWorld).multiply(quaternion);
}
export const own = (a, x, y, z, out) => out.set(x, y, z).applyQuaternion(a.world);                       // direction, figure frame
export const ownPoint = (a, x, y, z, out) => out.set(x, y, z).applyMatrix4(a.person.matrixWorld);       // point, figure frame
export const homeDir = (a, x, y, z, out) => out.set(x, y, z).applyQuaternion(a.homeWorld);
export const homePoint = (a, x, y, z, out) => out.set(x, y, z).applyMatrix4(a.home.matrixWorld);
// Hand to a palm point: `fingers` and `palm` are world directions, the palm's centre lands on `point`.
const hq = Q(), wrist = V();
export function hold(a, S, point, fingers, palm, pole, depth = .025, along = .08) {
    basis(fingers, palm, hq); wrist.copy(point).addScaledVector(y0, -along).addScaledVector(z0, -depth);
    reach(a.bones[S.arm], a.bones[S.fore], a.bones[S.hand], wrist, pole);
    face(a.bones[S.hand], hq); shareTwist(a.bones[S.fore], a.bones[S.hand], a.bind[S.hand], .5);
}
export function curl(a, S, amount, thumb = amount * .5, index = amount) {
    for (const [finger, first] of Object.entries(FINGER)) for (let k = 0; k < 3; k++) {
        const i = S.fingers + first + k, axis = a.flex[i]; if (!axis) continue;
        const angle = finger === 'Thumb' ? (k ? [0, .5, .6][k] * thumb : 0) : [.8, 1, .6][k] * (finger === 'Index' ? index : amount);
        a.bones[i].quaternion.multiply(qb.setFromAxisAngle(axis, angle));
    }
}
export const prop = (kit, name, parent) => { const group = new THREE.Group(); group.name = name; kit.finish(group); parent.add(group);
    group.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; } }); return group; };
export const basisAxes = { x: x0, y: y0, z: z0 };
