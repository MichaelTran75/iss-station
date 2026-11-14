// The crew away from the work stations: three more figures (the Columbus crew model, posed every frame by
// js/figures/pose-kit.js, no baked clips) who go where the crew's day puts them (js/figures/crew-day.js):
// - asleep in Harmony's two crew quarters in view through the station night, zipped into the sleeping bags on the back
//   walls, hands folded, head tipped, breathing slowly (js/parts/living.js);
// - at Unity's galley table for lunch and dinner: one eats from a pouch with a spoon, one drinks from a drink pouch, one
//   holds a tortilla and talks with the other hand; feet in the foot loops, heads turning to whoever is talking;
// - one on Tranquility's treadmill while the others work, held down by a harness on two bungees.
// Aboard, the crew go in socks (feet hooked under foot loops, not walked on); trainers only to run. The model's feet
// are shoes, so the shoe surface takes a sock colour. Which crew member each figure is, and so its clothes, socks or
// trainers, is set by js/figures/crew-story.js.
// A figure moves to its place's frame when its role changes; with no role it is hidden and not posed.
import * as THREE from 'three';
import { parts } from '../core/station.js';
import { Kit, material } from '../core/kit.js';
import { B, actor, at, basis, basisZ, begin, curl, face, hold, homeDir, homePoint, mix, own, ownPoint, prop, reach, span, spin, smooth } from './pose-kit.js';

const harmony = parts.get('harmony').group, unity = parts.get('unity').group, tranquility = parts.get('tranquility').group;
const quarters = harmony.userData.quarters, galley = unity.userData.galley, node3 = tranquility.userData.cabin, t2 = node3.t2;
const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
const P = V(), C = V(), D = V(), E = V(), F = V(), G = V(), H = V(), N = V(), PL = V(), M = V(), T = V(), S0 = V(), UP = V(), FRONT = V();
const lookFrom = V(), lookTo = V(), lookAhead = V(), lookUp = V(), mouthUp = V(), lq1 = Q(), lq2 = Q(), lq3 = Q();
const q0 = Q(), q1 = Q(), q2 = Q(), q3 = Q(), euler = new THREE.Euler(), m4 = new THREE.Matrix4(), inverse = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
const Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);

export const tune = {
    mouth: [.015, .105],                 // from the head bone: up, forward
    sleeper: { hips: .01, nod: .14, roll: .2 },
    diners: { loop: [12, 14, 16], lean: [.16, .1, .05] },
    runner: { stride: .74, reach: .3, lift: .2, hips: .9, lean: rad(6) }
};
function rad(degrees) { return degrees * Math.PI / 180; }

const looks = [
    { skin: 0xb98a66, shirt: 0x2a3550, shorts: 0x8a7f66, shoes: 0x7f8488, hair: 0x231b16 },
    { skin: 0xe6c19f, shirt: 0xb9c0c6, shorts: 0x24282c, shoes: 0x2e3136, hair: 0xa8743d },
    { skin: 0x7b5038, shirt: 0x6b2a35, shorts: 0x2e3b55, shoes: 0xd8d8d2, hair: 0x15100d }
];
const crew = looks.map((look, i) => { const a = actor('Crew ' + (i + 4) + ' / off the work stations', look, quarters.cabin); a.person.visible = false; a.role = null; return a; });
function move(a, home) { if (a.home !== home) { home.add(a.person); a.home = home; } }

// ---- Props, each in the frame of where it is used, placed from world space every frame. ----
const spoonKit = new Kit();
spoonKit.rod([0, 0, 0], [0, 0, .12], .005, 0xc9ced0);
spoonKit.add(new THREE.SphereGeometry(.022, 12, 8), material(0xc9ced0, .3, .8), [0, 0, .14], [.8, .3, 1.1], [0, 0, 0], false);
const spoon = prop(spoonKit, 'Spoon', galley.cabin);
const drinkKit = new Kit();
drinkKit.box([0, 0, 0], [.075, .12, .022], 0xe6e2d4, [0, 0, 0], false); drinkKit.box([0, -.01, .012], [.06, .06, .002], 0xc0533a, [0, 0, 0], false);
drinkKit.rod([0, .06, 0], [0, .11, 0], .004, 0xf2f2ee);
const drink = prop(drinkKit, 'Drink pouch', galley.cabin);
const tortillaKit = new Kit();
tortillaKit.add(new THREE.CylinderGeometry(.1, .1, .004, 24), material(0xe2cfa0, .9, .02), [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0], false);
const tortilla = prop(tortillaKit, 'Tortilla', galley.cabin);
const harnessKit = new Kit();
harnessKit.add(new THREE.TorusGeometry(.165, .028, 8, 28), material(0x3b4044, .8, .1), [0, 0, 0], [1, .78, 1], [0, 0, 0], false);
const harness = prop(harnessKit, 'Treadmill harness', node3.tube);
const cordMaterial = material(0x22262a, .8, .05);
const cords = [0, 1].map(() => { const cord = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 1, 6).translate(0, .5, 0), cordMaterial); cord.name = 'Treadmill bungee'; cord.userData.interior = true; node3.tube.add(cord); return cord; });
const props = [spoon, drink, tortilla, harness, ...cords];
// An object at a world position and orientation, in its parent's frame.
function place(object, position, quaternion) {
    object.parent.updateWorldMatrix(true, false);
    m4.compose(position, quaternion, one).premultiply(inverse.copy(object.parent.matrixWorld).invert()); m4.decompose(object.position, object.quaternion, object.scale);
}
// Upright in its home frame, leaning `lean` toward `front`.
function stand(a, hips, front, lean) {
    UP.copy(Y).multiplyScalar(Math.cos(lean)).addScaledVector(front, Math.sin(lean));
    begin(a, hips, basis(UP, FRONT.copy(front).multiplyScalar(Math.cos(lean)).addScaledVector(Y, -Math.sin(lean)), q0));
}
// Head (and a share of the neck) turned toward a world point, `amount` of the way from straight ahead.
function look(a, target, amount = 1) {
    const head = a.bones[B.head]; at(head, lookFrom); lookTo.copy(target).sub(lookFrom).normalize(); own(a, 0, 0, 1, lookAhead); lookTo.lerp(lookAhead, 1 - amount).normalize();
    own(a, 0, 1, 0, lookUp); basisZ(lookTo, lookUp, lq1);
    a.bones[B.neck].getWorldQuaternion(lq2); face(a.bones[B.neck], lq2.slerp(lq3.copy(lq1).multiply(a.model[B.neck]), .45));
    face(head, lq3.copy(lq1).multiply(a.model[B.head]));
}
function mouthOf(a, out) {
    const head = a.bones[B.head]; at(head, out); head.getWorldQuaternion(lq2);
    return out.addScaledVector(mouthUp.set(0, 1, 0).applyQuaternion(lq2), tune.mouth[0]).addScaledVector(mouthUp.set(0, 0, 1).applyQuaternion(lq2), tune.mouth[1]);
}
// Feet in front of the hips at a world point each, knees forward; soles turned to `yaw` in the home frame.
function feet(a, points, yaw, pitch = 0) {
    for (const [S, k] of [[B.L, 0], [B.R, 1]]) {
        reachLeg(a, S, points[k]);
        face(a.bones[S.foot], q1.copy(a.homeWorld).multiply(q2.setFromEuler(euler.set(pitch, yaw, 0, 'YXZ'))).multiply(a.model[S.foot]));
    }
}
const reachLeg = (a, S, point) => { own(a, 0, -.2, 1, PL); reachLimb(a, S, point, PL); };
// Hip through knee to ankle.
const reachLimb = (a, S, point, pole) => reach(a.bones[S.upLeg], a.bones[S.leg], a.bones[S.foot], point, pole);

// ---- Asleep in a crew quarters booth (its rack frame: back wall at -x, head end +y). ----
function sleep(a, bed, time, k) {
    const p = tune.sleeper, [hx, hy, hz] = bed.bed.hips, b = a.bones;
    begin(a, P.set(hx, hy + p.hips * Math.sin(time * .21 + k), hz), basis(Y, FRONT.set(1, 0, 0), q0));
    const breath = .02 * Math.sin(time * 1.1 + k * 2.3), X = own(a, 1, 0, 0, M), fwd = own(a, 0, 0, 1, T);
    spin(b[B.chest], X, -breath); spin(b[B.upper], X, -breath * .6);
    spin(b[B.neck], X, p.nod * .6); spin(b[B.head], X, p.nod * .5 + .03 * Math.sin(time * .13 + k));
    spin(b[B.head], fwd, (k ? -1 : 1) * (p.roll + .05 * Math.sin(time * .09 + k)));
    for (const S of [B.L, B.R]) { spin(b[S.upLeg], X, -.08); spin(b[S.leg], X, .16); spin(b[S.foot], X, .3); }
    // Hands folded on the belly, the left over the right.
    for (const [S, side] of [[B.R, -1], [B.L, 1]]) {
        ownPoint(a, -side * .03, side > 0 ? .07 : .02, .13, C); own(a, -side, .15, 0, F); own(a, 0, 0, -1, N); own(a, side, -.4, -.5, PL);
        hold(a, S, C, F, N, PL, .02); curl(a, S, .55);
    }
}

// ---- At the galley table (Unity's cabin frame). ----
const [tx, ty, tz] = galley.table.centre;
const seats = [
    { hips: [-.53, -.05, 1.8], front: [1, 0, 0], loops: [[-.45, 1.68], [-.45, 1.92]] },
    { hips: [.67, -.05, 1.7], front: [-1, 0, 0], loops: [[.62, 1.82], [.62, 1.58]] },
    { hips: [.05, .0, 1.02], front: [0, 0, 1], loops: null }
];
const headOf = (seat, out) => out.set(seat.hips[0], seat.hips[1] + .62, seat.hips[2]).applyMatrix4(galley.cabin.matrixWorld);
function dine(a, k, time) {
    const seat = seats[k], b = a.bones, loop = tune.diners.loop[k], t = (time + k * 5.3) % loop;
    FRONT.fromArray(seat.front);
    stand(a, P.fromArray(seat.hips).add(D.set(.012 * Math.sin(time * .31 + k), .015 * Math.sin(time * .43 + k), 0)), D.copy(FRONT), tune.diners.lean[k]);
    const X = own(a, 1, 0, 0, M), breath = .01 * Math.sin(time * 1.4 + k);
    spin(b[B.chest], X, -breath);
    // Legs: feet in the loops (knees forward), or floating free.
    if (seat.loops) {
        const yaw = Math.atan2(seat.front[0], seat.front[2]);
        feet(a, seat.loops.map(([x, z], i) => homePoint(a, x, -.95 + .1, z, i ? H : G)), yaw, .1);
    } else for (const [S, phase] of [[B.L, 0], [B.R, 1.9]]) {
        spin(b[S.upLeg], X, -.45 - .06 * Math.sin(time * .37 + phase)); spin(b[S.leg], X, .75 + .1 * Math.sin(time * .29 + phase)); spin(b[S.foot], X, .4);
    }
    // Who is talking: the one with the tortilla most of the time, the others now and then.
    const talker = t < loop * .45 ? 2 : t < loop * .75 ? (k + 1) % 3 : (k + 2) % 3, other = talker === k ? (k + 1) % 3 : talker;
    headOf(seats[other], T);
    if (k === 0) { // spoon
        const scoop = t < 2.4, up = span(t, 2.4, 3.9, 4.8, 6.3);
        look(a, scoop || (t > 6.3 && t < 7.5) ? homePoint(a, tx - .12, ty, tz + .02, S0) : T, scoop ? .8 : .55);
        mouthOf(a, N);
        const pouch = homePoint(a, tx - .12, ty + .02, tz + .02, C), rest = P.copy(pouch).addScaledVector(own(a, -.08, .1, -.05, D), 1);
        if (scoop) rest.copy(pouch).addScaledVector(own(a, -.05 + .03 * Math.cos(t * 5), .07, -.06 + .02 * Math.sin(t * 5), D), 1);
        const atMouth = D.copy(N).addScaledVector(own(a, -.03, -.03, .17, E), 1);
        P.lerp(atMouth, smooth(up));
        const tip = F.copy(N).lerp(pouch, 1 - up);
        const dir = G.copy(tip).sub(P).normalize();
        place(spoon, H.copy(P).addScaledVector(dir, .01), q1.setFromUnitVectors(Z, dir));
        hold(a, B.R, P, dir, own(a, .8, .5, 0, E), own(a, -1, -.6, -.3, PL), .015, .05); curl(a, B.R, .9, .6, .8);
        // The left hand steadies the pouch on the table.
        homePoint(a, tx - .14, ty + .03, tz - .1, C); homeDir(a, 1, 0, -.3, F); homeDir(a, 0, -1, 0, D);
        hold(a, B.L, C, F, D, own(a, 1, -.5, -.5, PL), .02); curl(a, B.L, .35);
    } else if (k === 1) { // drink pouch
        const sip = span(t, 6, 7.2, 8.4, 9.6);
        look(a, T, mix(.6, .1, sip));
        mouthOf(a, N);
        const rest = ownPoint(a, -.13, .1, .3, C), atMouth = D.copy(N).addScaledVector(own(a, -.01, -.1, .06, E), 1);
        P.copy(rest).lerp(atMouth, smooth(sip));
        const up = F.copy(N).sub(P).normalize().lerp(own(a, 0, 1, 0, E), 1 - sip).normalize();
        const palm = own(a, 1, 0, .3, H).normalize();
        place(drink, G.copy(P).addScaledVector(palm, .035), q1.setFromUnitVectors(Y, up));
        hold(a, B.R, P, up, palm, own(a, -1, -.6, -.2, PL), .02, .05); curl(a, B.R, .75, .6);
        homePoint(a, tx + .22, ty + .03, tz + .12, C); homeDir(a, -1, 0, .2, F); homeDir(a, 0, -1, 0, D);
        hold(a, B.L, C, F, D, own(a, 1, -.5, -.5, PL), .02); curl(a, B.L, .25);
    } else { // tortilla, talking with the right hand
        const bite = span(t, 10, 11.2, 12.2, 13.4), talking = talker === 2;
        look(a, T, mix(.65, .2, bite));
        mouthOf(a, N);
        const held = ownPoint(a, .1, .14, .27, C), atMouth = D.copy(N).addScaledVector(own(a, .06, -.05, .09, E), 1);
        P.copy(held).lerp(atMouth, smooth(bite));
        const palm = own(a, -.2, 1, 0, F).normalize().lerp(own(a, -1, .2, 0, E), bite).normalize();
        place(tortilla, G.copy(P).addScaledVector(palm, .03), q1.setFromUnitVectors(Z, palm));
        hold(a, B.L, P, own(a, -.3, .1, 1, E).normalize(), palm, own(a, 1, -.5, -.4, PL), .02); curl(a, B.L, .45);
        const g = talking ? 1 : .25;
        ownPoint(a, -.16 + .07 * g * Math.sin(time * 1.3), .2 + .06 * g * Math.sin(time * 2.1 + 1), .3 + .05 * g * Math.sin(time * .9), C);
        hold(a, B.R, C, own(a, .3, .6, 1, F).normalize(), own(a, .4, .3, .8, D).normalize(), own(a, -1, -.6, -.3, PL), .02); curl(a, B.R, .3);
    }
}

// ---- On the treadmill (Tranquility's module frame), facing forward (+x). ----
function run(a, time) {
    const p = tune.runner, b = a.bones, phase = time / p.stride * Math.PI * 2;
    const hx = t2.x + .015 * Math.sin(phase * .5), hy = t2.top + p.hips + .025 * Math.cos(phase * 2);
    stand(a, P.set(hx, hy, t2.z), D.set(1, 0, 0), p.lean);
    const X = own(a, 1, 0, 0, M), up = own(a, 0, 1, 0, T);
    spin(b[B.upper], up, .1 * Math.sin(phase)); spin(b[B.chest], X, -.015 * Math.sin(phase * 2));
    // Feet: back along the belt in stance, lifted and brought forward in the swing. The left is the figure's +x (-z here).
    for (const [S, offset, side] of [[B.L, 0, -1], [B.R, Math.PI, 1]]) {
        const f = phase + offset, swing = Math.sin(f) < 0, lift = swing ? -Math.sin(f) * p.lift : 0;
        homePoint(a, hx + .03 + p.reach * Math.cos(f), t2.top + .09 + lift, t2.z + side * .1, C);
        own(a, 0, -.15, 1, PL); reachLimb(a, S, C, PL);
        face(b[S.foot], q1.copy(a.homeWorld).multiply(q2.setFromEuler(euler.set(swing ? .45 * -Math.sin(f) : 0, Math.PI / 2, 0, 'YXZ'))).multiply(a.model[S.foot]));
    }
    look(a, homePoint(a, hx + 3, hy + .55, t2.z, E), .9);
    // Arms bent, swinging against the legs.
    for (const [S, side, offset] of [[B.L, 1, Math.PI], [B.R, -1, 0]]) {
        const s = Math.cos(phase + offset);
        ownPoint(a, side * .2, .3 + .04 * Math.max(0, s), .1 + .17 * s, C);
        hold(a, S, C, own(a, -side * .25, .35, 1, F).normalize(), own(a, -side, 0, 0, D), own(a, side * .25, -.3, -1, PL), .02, .06); curl(a, S, 1.2);
    }
    // Harness at the waist, a bungee down from each side to the rails.
    ownPoint(a, 0, .07, 0, C); place(harness, C, q1.setFromUnitVectors(Z, up));
    cords.forEach((cord, i) => {
        const side = i ? 1 : -1; ownPoint(a, -side * .16, .06, 0, C);
        homePoint(a, ...t2.anchors[i], D);
        const length = F.copy(D).sub(C).length(); F.normalize();
        place(cord, C, q1.setFromUnitVectors(Y, F)); cord.scale.set(1, length, 1);
    });
}

// ---- Roles by the crew's day. ----
const roleList = on => on.sleepers ? ['sleep0', 'sleep1', null] : on.diners ? ['dine0', 'dine1', 'dine2'] : on.runner ? ['run', null, null] : [null, null, null];
const homeOf = role => role === 'run' ? node3.tube : role.startsWith('sleep') ? quarters.beds[+role.slice(-1)].home : galley.cabin;
const partOf = role => role === 'run' ? tranquility : role.startsWith('sleep') ? harmony : unity;
// `away`: per figure, on shift but not there yet (js/figures/crew-story.js): posed, not shown. Who wears what (socks,
// trainers on the treadmill) is dressed by crew-story.js.
const nobodyAway = [false, false, false];
export function updateLivingCrew(time, on = {}, pose = true, away = nobodyAway) {
    const roles = roleList(on);
    crew.forEach((a, i) => {
        const role = roles[i], changed = role !== a.role;
        a.role = role; a.person.visible = !!role && !away[i];
        if (!role) return;
        if (changed) move(a, homeOf(role));
        if (!partOf(role).visible || !(pose || changed)) return;
        if (role === 'run') run(a, time);
        else if (role.startsWith('sleep')) sleep(a, quarters.beds[+role.slice(-1)], time, +role.slice(-1));
        else dine(a, +role.slice(-1), time);
    });
    spoon.visible = roles[0] === 'dine0' && !away[0]; drink.visible = roles[1] === 'dine1' && !away[1]; tortilla.visible = roles[2] === 'dine2' && !away[2];
    harness.visible = cords[0].visible = cords[1].visible = roles[0] === 'run' && !away[0];
}
export const livingCrew = { crew, tune, props, roleList, update: updateLivingCrew };
