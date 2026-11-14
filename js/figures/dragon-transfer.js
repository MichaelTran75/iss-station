// Crew Dragon's crew come aboard after docking. The clock is approach.docked (js/parts/dragon.js): animation seconds
// since contact. Order and real spacing of events follow NASA's coverage of Demo-2 (31 May 2020) and Crew-1 (17 Nov
// 2020): contact and soft capture; hard capture about 11 minutes later, when twelve hooks close; leak checks and
// pressurisation of the vestibule, while the crew take their suits off (they come aboard in shirts); Harmony's forward
// hatch, opened by the station crew about 2 h 20 min after contact; Dragon's own hatch about 25 minutes later; then
// the crew float through one at a time, head first, pulling themselves through each hatchway by its rim, and are
// greeted in Harmony; the welcome ceremony follows about 40 minutes after the hatch opened. The waits run compressed
// (transferPhase() gives the warp for the readout); the transfer itself runs in real time at about 0.4 m/s.
//
// The station crew who open Harmony's hatch and greet them are the three working in Columbus: they leave the lab soon
// after contact, float through Columbus's hatch into Harmony, wait at its forward hatch, and once the ceremony is over
// go back to the lab, where the lab's own figures take over (js/figures/crew-story.js shows and hides them). The
// arrivals come aboard in the shirts they flew in; after the ceremony they change in Harmony's crew quarters, two at a
// time (the shirt pulled over the head is the moment the colours change), and float off to where the crew's day has
// them: each one's figure there takes over once they reach it (crew-story.js), and one with nothing on the schedule
// goes on into Destiny and fades.
//
// The figures are the Columbus crew model, posed every frame (js/figures/pose-kit.js) in Dragon's own frame, under the
// cabin fittings. They show whatever is selected: while Dragon is not, its cabin keeps only the crew (js/parts/dragon.js
// setDragonShell). Routes run along the module axes through the hatches (route()); speeds are the transfer's 0.42 m/s.
// Paths, posture and the hatch shapes are illustrative.
import * as THREE from 'three';
import { Kit, material } from '../core/kit.js';
import { parts } from '../core/station.js';
import { approach, dragon, showCabin } from '../parts/dragon.js';
import { B, actor, at, basis, basisZ, begin, curl, face, hold, mix, own, ownPoint, rad, ramp, smooth, span, spin, wrap } from './pose-kit.js';

const detail = dragon.group.userData.detail, { cabin, fittings, seats, tunnelTop, tunnelRadius } = detail;
const group = new THREE.Group(); group.name = 'Crew transfer'; fittings.add(group);
// Dragon's frame, docked: Harmony's axis runs 0.73 m above Dragon's (PMA-2's offset), its forward hatch (station
// z -8.45) 2.73 m beyond the face of the docking ring.
const harmonyY = -approach.port.y, hatchZ = -8.45 - approach.port.z;

export const tune = {
    sit: [.02, .08],                 // hips in the seat's frame: y toward the backrest, z up it
    wait: [-.08, .22], tilt: 20,     // lifted off the seat, tipped toward the display (degrees)
    speed: .42, accel: 1.6,          // m/s through the hatchways, seconds to reach it and to stop
    // Legs: hip flexion, knee flexion, ankle, spread (radians).
    legs: { seat: [1.5, 1.45, .05, .06], wait: [1.3, 1.35, .15, .08], glide: [.12, .45, .5, .05], idle: [.55, .85, .3, .08] }
};
// Animation seconds since contact. Each arrival is staggered from these.
const T = { hard: 4, leak: 10, doff: 12, unbuckle: 18.2, harmony: 26, hatch: 31, transfer: 34, gap: 9 };

const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
const P = V(), P2 = V(), F = V(), N = V(), PL = V(), U = V(), X = V(), D = V(), H = V(), M = V(), R = V(), S1 = V(), S2 = V();
const swingOut = V(), q1 = Q(), q2 = Q(), q3 = Q(), groupQ = Q(), upW = V(), frontWorld = V();
// Station up and the ceremony's facing, in the world (kept each frame: the station may be turned).
const flat = v => v.addScaledVector(upW, -v.dot(upW));
const toWorld = (v, out) => out.copy(v).applyMatrix4(group.matrixWorld);
const localPoint = (x, y, z, out) => out.set(x, y, z).applyMatrix4(group.matrixWorld);
const localDir = (x, y, z, out) => out.set(x, y, z).applyQuaternion(groupQ);

// ---- Hatches: Dragon's, at the top of its tunnel, hinged on the port side and opening into the cabin (it stands clear
// of the way through); Harmony's forward hatch, a rounded square hinged on the starboard side, opening into the node. ----
const dragonHatch = new THREE.Group(), harmonyHatch = new THREE.Group();
{
    const kit = new Kit(), r = tunnelRadius - .03;
    kit.add(new THREE.CylinderGeometry(r, r, .05, 40), material(0xd3d7d9, .62, .18), [r, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    kit.add(new THREE.TorusGeometry(r - .02, .012, 6, 40), material(0x8d9397, .5, .4), [r, 0, -.027], [1, 1, 1], [0, 0, 0], false);
    kit.box([2 * r - .12, 0, -.05], [.028, .2, .028], 0x3b4148, [0, 0, 0], false);
    kit.finish(dragonHatch); dragonHatch.name = 'Dragon forward hatch';
    dragonHatch.position.set(-r, 0, tunnelTop - .03); group.add(dragonHatch);
}
{
    const kit = new Kit(), shape = new THREE.Shape(), w = 1, h = 1, c = .18;
    shape.moveTo(-w + c, -h / 2); shape.lineTo(-c, -h / 2); shape.quadraticCurveTo(0, -h / 2, 0, -h / 2 + c); shape.lineTo(0, h / 2 - c);
    shape.quadraticCurveTo(0, h / 2, -c, h / 2); shape.lineTo(-w + c, h / 2); shape.quadraticCurveTo(-w, h / 2, -w, h / 2 - c);
    shape.lineTo(-w, -h / 2 + c); shape.quadraticCurveTo(-w, -h / 2, -w + c, -h / 2);
    const panel = new THREE.ExtrudeGeometry(shape, { depth: .06, bevelEnabled: false, curveSegments: 6 }); panel.translate(0, 0, -.03);
    kit.add(panel, material(0xd6d9d6, .64, .16), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    kit.add(new THREE.CircleGeometry(.075, 24), material(0x23303b, .15, .5), [-.5, .22, -.032], [1, 1, 1], [0, Math.PI, 0], false);
    kit.box([-.86, 0, -.06], [.04, .26, .04], 0x3b4148, [0, 0, 0], false);
    kit.finish(harmonyHatch); harmonyHatch.name = 'Harmony forward hatch';
    harmonyHatch.position.set(w / 2, harmonyY, hatchZ); group.add(harmonyHatch);
    harmonyHatch.userData.keepShown = true;
}

// ---- Arms: a hand target is a palm point, the finger and palm directions, the elbow's pole, and the curl. ----
const arm = () => ({ p: V(), f: V(), n: V(), pole: V(), curl: .3, depth: .025, along: .08 });
function setArm(o, p, f, n, pole, c, depth = .025, along = .08) {
    o.p.copy(p); o.f.copy(f).normalize(); o.n.copy(n).normalize(); o.pole.copy(pole).normalize(); o.curl = c; o.depth = depth; o.along = along; return o;
}
function blendArm(o, b, k) {
    if (k <= 0) return o;
    if (k >= 1) return setArm(o, b.p, b.f, b.n, b.pole, b.curl, b.depth, b.along);
    o.p.lerp(b.p, k); o.f.lerp(b.f, k).normalize(); o.n.lerp(b.n, k).normalize(); o.pole.lerp(b.pole, k).normalize();
    o.curl = mix(o.curl, b.curl, k); o.depth = mix(o.depth, b.depth, k); o.along = mix(o.along, b.along, k); return o;
}
const inverse = new THREE.Matrix4();
// Hand targets stay clear of the cabin wall (12 cm in from the lining).
function keepInside(p) {
    const local = M.copy(p).applyMatrix4(inverse);
    if (local.z > -.75 || local.z < detail.floorZ) return p;
    const r = Math.hypot(local.x, local.y), limit = detail.wallRadius(local.z) - .12;
    if (r > limit) { local.x *= limit / r; local.y *= limit / r; p.copy(local.applyMatrix4(group.matrixWorld)); }
    return p;
}
const applyArm = (a, S, o) => { keepInside(o.p); hold(a, S, o.p, o.f, o.n, o.pole, o.depth, o.along); curl(a, S, o.curl); };
// Floating relaxed: forearms up in front of the chest, elbows out (the neutral posture of weightlessness).
const neutralArm = (a, side, o, t) => setArm(o, ownPoint(a, side * .22, .2 + .015 * Math.sin(t * .5 + side), .22, P), own(a, side * .1, .45, 1, F),
    own(a, -side * .45, -1, .15, N), own(a, side * .45, -.75, -.5, PL), .4);
// Seated, the hand on the thigh, fingers toward the knee.
function lapArm(a, side, S, o) {
    at(a.bones[S.upLeg], P); at(a.bones[S.leg], P2); F.copy(P2).sub(P);
    P.lerp(P2, .55).addScaledVector(own(a, 0, 1, 0, U), .075);
    return setArm(o, P, F, own(a, 0, -1, 0, N), own(a, side * .5, -.3, -.8, PL), .25, .02);
}
const buckleArm = (a, side, o) => setArm(o, ownPoint(a, side * .06, .12, .17, P), own(a, -side, .2, 0, F), own(a, 0, 0, -1, N), own(a, side * .4, -.6, -.5, PL), .6, .02);
const leadArm = (a, side, o, reach = 1.1) => setArm(o, ownPoint(a, side * .16, reach, .1, P), own(a, side * .05, 1, .1, F), own(a, 0, 0, 1, N), own(a, side * .3, 0, -.6, PL), .3);
const trailArm = (a, side, o) => setArm(o, ownPoint(a, side * .21, 0, .06, P), own(a, 0, -1, .1, F), own(a, -side, 0, .15, N), own(a, side * .15, .2, -1, PL), .35);
const waveArm = (a, side, o, beat) => setArm(o, ownPoint(a, side * (.36 + .04 * beat), .8, .25, P), own(a, side * .1 + .2 * beat, 1, .05, F),
    own(a, 0, .05, 1, N), own(a, side, -.6, 0, PL), .05);
// For the ceremony photo: hands folded in front, the right over the back of the left.
const claspArm = (a, side, o) => side > 0
    ? setArm(o, ownPoint(a, .03, .07, .2, P), own(a, -1, -.25, .1, F), own(a, 0, .1, -1, N), own(a, .35, -.5, -.7, PL), .45, .02)
    : setArm(o, ownPoint(a, -.02, .08, .245, P), own(a, 1, -.25, .1, F), own(a, 0, .1, -1, N), own(a, -.35, -.5, -.7, PL), .4, .02);
// The flight display's lower edge, palm on the glass (the display's frame: js/parts/dragon.js).
const displayUp = new THREE.Vector3(0, .7317, .6816), displayFace = new THREE.Vector3(0, .6816, -.7317);
const displayArm = (a, side, x, o) => setArm(o, localPoint(-x, .04 - .21 * .7317 - .03 * .6816, -2.135 - .21 * .6816 + .03 * .7317, P),
    localDir(displayUp.x, displayUp.y, displayUp.z, F), localDir(-displayFace.x, -displayFace.y, -displayFace.z, N), own(a, side * .3, -.8, -.4, PL), .7);

// Legs from the bind pose: spread, then hip and knee flexion and the ankle, about the figure's own axes.
const legs = V();
function poseLegs(a, [hip, knee, ankle, spread], t, phase = 0) {
    own(a, 1, 0, 0, X); own(a, 0, 0, 1, legs);
    for (const [S, side, k] of [[B.L, 1, 0], [B.R, -1, 1.9]]) {
        spin(a.bones[S.upLeg], legs, side * spread);
        spin(a.bones[S.upLeg], X, -hip - .04 * Math.sin(t * .37 + phase + k));
        spin(a.bones[S.leg], X, knee + .05 * Math.sin(t * .43 + phase + k));
        spin(a.bones[S.foot], X, ankle);
    }
}
const blendLegs = (out, a, b, k) => { for (let i = 0; i < 4; i++) out[i] = mix(a[i], b[i], k); return out; };
// Head toward a point, the neck taking part of the turn.
function look(a, point, weight) {
    if (weight <= 0) return;
    at(a.bones[B.head], H); D.copy(point).sub(H).normalize(); own(a, 0, 1, 0, U); basisZ(D, U, q1);
    a.bones[B.neck].getWorldQuaternion(q2); face(a.bones[B.neck], q2.slerp(q3.copy(q1).multiply(a.model[B.neck]), .45 * weight));
    a.bones[B.head].getWorldQuaternion(q2); face(a.bones[B.head], q2.slerp(q3.copy(q1).multiply(a.model[B.head]), weight));
}
function breathe(a, t, rate, depth = .009) { const b = depth * Math.sin(t * rate); own(a, 1, 0, 0, X); spin(a.bones[B.chest], X, -b); spin(a.bones[B.upper], X, -b); }

// Fading in or out: transparent only while between.
function fade(materials, k, state) {
    const clear = k < 1;
    if (state.clear !== clear) { state.clear = clear; for (const m of materials) { m.transparent = clear; m.needsUpdate = true; } }
    for (const m of materials) m.opacity = Math.max(0, Math.min(1, k));
}
const materialsOf = object => { const list = []; object.traverse(child => { if (child.isMesh) list.push(...(Array.isArray(child.material) ? child.material : [child.material])); }); return list; };

// ---- The four arriving: polo shirts, in the order they go through (the middle seats first). ----
const looks = [
    { skin: 0xd6a582, shirt: 0x1d2b45, shorts: 0x3b3f47, shoes: 0x8f9396, hair: 0x6b4a2e },
    { skin: 0x8a5a3c, shirt: 0x26292e, shorts: 0x5b5446, shoes: 0x2b2d31, hair: 0x15110e },
    { skin: 0xe8c0a0, shirt: 0x203a57, shorts: 0x2c2f35, shoes: 0x585d63, hair: 0xa07a4c },
    { skin: 0xc49272, shirt: 0x2f3a33, shorts: 0x4a4f57, shoes: 0x2d3034, hair: 0x2a1f19 }
];
const turns = [1, 2, 0, 3];
// Where they float once aboard, for the ceremony: a front row facing the port side (the arrivals, the greeter at the
// hatchway end), two of the station crew behind it and higher, where they waited.
const frontRow = [[-.05, .38, 6.04], [-.05, .36, 5.38], [-.05, .4, 4.72], [-.05, .37, 4.06]], hostSpots = [[-.05, .4, 3.34], [.55, 1.12, 4.39], [.55, 1.08, 5.05]];
const ceremonyFront = new THREE.Vector3(-1, 0, .35).normalize(), stationUp = new THREE.Vector3(0, 1, 0);
const greetAt = new THREE.Vector3(-.02, harmonyY - .34, hatchZ + .45), host1At = new THREE.Vector3(-.6, harmonyY - .28, hatchZ + 1.05);
// Rims pulled on in passing: Dragon's hatchway with the hand on the side the body comes from, the docking ring with the
// other, Harmony's hatchway with the right.
const rimsFrom = side => [{ at: new THREE.Vector3(side * .28, -.2, tunnelTop + .01), axisY: 0, side }, { at: new THREE.Vector3(-side * .26, -.2, .02), axisY: 0, side: -side },
    { at: new THREE.Vector3(-.47, harmonyY - .15, hatchZ), axisY: harmonyY, side: -1 }];

const crew = seats.map((seat, index) => {
    const a = actor('Crew Dragon / crew ' + (index + 1), looks[index], group), turn = turns.indexOf(index);
    const up = new THREE.Vector3(0, 0, 1).applyQuaternion(seat.quaternion), front = new THREE.Vector3(0, -1, 0).applyQuaternion(seat.quaternion);
    const sit = new THREE.Vector3(0, tune.sit[0], tune.sit[1]).applyMatrix4(seat.matrix), sitQ = basis(up, front, Q());
    const tilt = rad(tune.tilt), upW = up.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(front, Math.sin(tilt));
    const frontW = front.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(up, -Math.sin(tilt));
    // The outer two wait a little outboard, clear of the middle two as they leave.
    const wait = new THREE.Vector3(0, tune.wait[0], tune.wait[1]).applyMatrix4(seat.matrix), waitQ = basis(upW, frontW, Q());
    if (Math.abs(seat.position.x) > .6) wait.x += Math.sign(seat.position.x) * .08;
    // The head's path: up over the display, along the axis through Dragon's tunnel, PMA-2's offset and into Harmony.
    const x = seat.position.x, path = new THREE.CatmullRomCurve3([wait.clone(), wait.clone().addScaledVector(upW, .6), new THREE.Vector3(x * .85, .66, -2.15),
        new THREE.Vector3(x * .3, .45, -1.55), new THREE.Vector3(0, .1, -1.1), new THREE.Vector3(0, 0, -.45), new THREE.Vector3(0, .05, .6),
        new THREE.Vector3(0, .45, 1.7), new THREE.Vector3(0, harmonyY, hatchZ - .13), new THREE.Vector3(0, harmonyY + .02, hatchZ + .62)], false, 'centripetal');
    path.arcLengthDivisions = 360;
    const lengths = path.getLengths(360), body = lengths[40], length = lengths[360];
    const glide = (length - body) / tune.speed + tune.accel;
    const doff = T.doff + 1.25 * turn, unbuckle = T.unbuckle + .9 * turn, go = T.transfer + T.gap * turn;
    const times = { doff, unbuckle, rise: unbuckle + 2.1, go, pivot: go + glide, greet: go + glide + 2, move: go + glide + 5.1, spot: go + glide + 9.6 };
    // The suit seated here fades out as the figure fades in.
    const suit = materialsOf(seat).filter(m => m.userData.astronaut);
    const suitMeshes = []; seat.traverse(child => { if (child.isMesh && (Array.isArray(child.material) ? child.material : [child.material]).some(m => m.userData.astronaut)) suitMeshes.push(child); });
    const greetQ = basis(stationUp, P.copy(host1At).sub(greetAt).setY(0), Q());
    const spot = new THREE.Vector3(...frontRow[turn]), spotQ = basis(stationUp, ceremonyFront, Q());
    const grip = x < 0 ? 1 : -1;     // the hand on the display: the one nearer the middle
    return { a, index, turn, seat, rims: rimsFrom(x < 0 ? -1 : 1), sit, sitQ, wait, waitQ, frontW, path, body, length, glide, times, suit, greetQ, spot, spotQ, grip, x, suitMeshes,
        skin: materialsOf(a.person), shown: { clear: false }, suitState: { clear: false }, arms: [arm(), arm(), arm()], end: { p: V(), q: Q() } };
});
// The station crew: one at the hatchway greeting each arrival, two higher up in the node.
// The station crew: the Columbus crew (same people, same clothes), one at the hatchway greeting each arrival, two
// higher up in the node.
const lab = parts.get('columbus').group.userData.lab, quarters = parts.get('harmony').group.userData.quarters;
const labFigures = lab.crew.map(person => wrap(person, person.parent));
const hosts = lab.looks.map((look, index) => ({ a: actor('Station crew / welcome ' + (index + 1), look, group), index, home: index ? new THREE.Vector3(...hostSpots[index]) : host1At.clone(),
    spot: new THREE.Vector3(...hostSpots[index]), arms: [arm(), arm(), arm()], lab: labFigures[index], out: null, back: null, state: 'lab' }));
// What the arrivals change into: their own skin and hair, station clothes, socks.
const stationLooks = [{ shirt: 0xb8452f, shorts: 0xc9b68f, shoes: 0x34373c }, { shirt: 0x9aa3a8, shorts: 0x22262b, shoes: 0x3a3d42 },
    { shirt: 0x27406b, shorts: 0x6e6a5b, shoes: 0x9a9da0 }, { shirt: 0x7a3b5c, shorts: 0x3d4048, shoes: 0x7f8488 }].map((clothes, i) => ({ skin: looks[i].skin, hair: looks[i].hair, ...clothes }));
const byTurn = [...crew].sort((p, q) => p.turn - q.turn);
// The greeter takes its place once the last arrival has taken theirs.
const hostMove = Math.max(...crew.map(c => c.times.spot)), ceremony = Math.max(...crew.map(c => c.times.spot), hostMove + 4.5) + 1;
group.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; } });

// ---- Readout: [animation seconds, phase, mission seconds since contact]. Between two steps the warp is the ratio. ----
// After the ceremony (`settle`): the Columbus crew go back to the lab, the arrivals change and go their ways.
const settle = ceremony + 24, changeTime = 6.5, pairGap = 14;
const steps = [[0, 'SOFT CAPTURE', 0], [T.hard, 'HARD CAPTURE', 10], [T.leak, 'LEAK CHECKS', 660], [T.harmony, 'HARMONY HATCH OPEN', 8460],
    [T.hatch, 'DRAGON HATCH OPEN', 9960], [T.transfer, 'CREW TRANSFER', 9963], [ceremony, 'WELCOME CEREMONY', 9963 + ceremony - T.transfer],
    [ceremony + 4, 'WELCOME CEREMONY', 12240], [settle, 'CREW SETTLING IN', 13440], [settle + 1, 'CREW SETTLING IN', 13441]];
for (const c of crew) c.times.leaveSpot = settle + (c.turn >= 2 ? pairGap : 0) + .8 * (c.turn % 2);
export function transferPhase(time = approach.docked) {
    let k = 0; while (k < steps.length - 1 && time >= steps[k + 1][0]) k++;
    const next = steps[k + 1], warp = next ? (next[2] - steps[k][2]) / (next[0] - steps[k][0]) : 1;
    return steps[k][1] + (warp >= 1.5 ? ' ×' + Math.round(warp) : '');
}

// ---- Glide: the head runs along the path, the hips follow it, the body between them. ----
const travel = V();
function glidePose(c, t, outP, outQ) {
    const span0 = c.length - c.body, u = Math.min(Math.max(t, 0), c.glide), v = tune.speed, ta = tune.accel;
    const run = u < ta ? .5 * v / ta * u * u : u > c.glide - ta ? span0 - .5 * v / ta * (c.glide - u) ** 2 : .5 * v * ta + v * (u - ta);
    const s = c.body + Math.min(span0, Math.max(0, run));
    c.path.getPointAt(s / c.length, H); c.path.getPointAt(Math.max(0, s - c.body) / c.length, outP);
    c.path.getTangentAt(s / c.length, travel).applyQuaternion(groupQ);
    // Mostly in Dragon's vertical plane: drifting in from an outer seat the body moves sideways rather than turning.
    U.copy(H).sub(outP); U.x *= .2; U.normalize();
    const level = ramp(s, c.body, c.body + 1.2), roll = .06 * Math.sin(t * .7 + c.index);
    D.copy(c.frontW).multiplyScalar(1 - level).add(P2.set(Math.sin(roll), -1, 0).multiplyScalar(level));
    basis(U, D, outQ);
    return s;
}

function poseArrival(c, t) {
    const a = c.a, w = c.times, [left, right, spare] = c.arms;
    // Suit and figure: the swap while the crew take their suits off.
    const shown = ramp(t, w.doff, w.doff + 1.6);
    fade(c.suit, 1 - shown, c.suitState); for (const mesh of c.suitMeshes) mesh.visible = shown < 1;
    c.home = false;
    if (t >= w.leaveSpot) { settleArrival(c, t); return; }
    c.booth = c.out = null; if (c.dressed) dressAs(c, false);
    a.person.visible = shown > 0; if (!a.person.visible) return;
    fade(c.skin, shown, c.shown);
    // Root: seated, lifted off the seat, gliding, upright to greet, then to the ceremony spot.
    const lift = ramp(t, w.rise, w.rise + 1.8);
    let legsNow = blendLegs([0, 0, 0, 0], tune.legs.seat, tune.legs.wait, lift), s = 0;
    if (t < w.go) {
        P.copy(c.sit).lerp(c.wait, lift); q1.copy(c.sitQ).slerp(c.waitQ, lift);
        P.y += .01 * Math.sin(t * .4 + c.index) * lift; P.x += .008 * Math.sin(t * .31 + c.index * 2) * lift;
    } else if (t < w.pivot) {
        s = glidePose(c, t - w.go, P, q1);
        blendLegs(legsNow, tune.legs.wait, tune.legs.glide, ramp(t, w.go + .8, w.go + 3.2));
    } else {
        glidePose(c, c.glide, c.end.p, c.end.q);
        const up = ramp(t, w.pivot, w.greet), go = ramp(t, w.move, w.move + 4.5);
        P.copy(c.end.p).lerp(greetAt, up); q1.copy(c.end.q).slerp(c.greetQ, up);
        P.lerp(c.spot, go); q1.slerp(c.spotQ, go);
        P.y += .01 * Math.sin(t * .37 + c.index) * go; P.z += .008 * Math.sin(t * .29 + c.index) * go;
        blendLegs(legsNow, tune.legs.glide, tune.legs.idle, up);
    }
    begin(a, P, q1);
    breathe(a, t, 1.5 + .1 * c.index);
    poseLegs(a, legsNow, t, c.index);
    // Head: the display while seated, the hatchway while waiting, ahead while gliding (the neck extended), then the
    // host, then the camera side; each change eases from the last.
    const ahead = t < w.pivot ? ramp(t, w.go, w.go + 1) : 1 - ramp(t, w.pivot, w.pivot + 1);
    if (t < w.pivot) look(a, localPoint(0, .04 - .04 * lift, -2.135 + 1.635 * lift, M), .7 * (1 - ahead));
    else {
        const k = ramp(t, w.move, w.move + 3);
        toWorld(host1At, M).addScaledVector(upW, .55).lerp(toWorld(c.spot, R).addScaledVector(frontWorld, 4).addScaledVector(upW, .7 + .1 * Math.sin(t * .2 + c.index)), k);
        look(a, M, mix(ramp(t, w.pivot + .4, w.greet), .6, k));
    }
    if (ahead > 0) { own(a, 1, 0, 0, X); spin(a.bones[B.neck], X, -.26 * ahead); spin(a.bones[B.head], X, -.3 * ahead); }
    // Arms.
    for (const [S, side, o] of [[B.L, 1, left], [B.R, -1, right]]) {
        if (t < w.go) {
            lapArm(a, side, S, o);
            blendArm(o, buckleArm(a, side, spare), span(t, w.unbuckle, w.unbuckle + .7, w.unbuckle + 1.4, w.unbuckle + 2.1));
            const held = side === c.grip ? displayArm(a, side, -c.x - side * .14, spare) : trailArm(a, side, spare);
            blendArm(o, held, lift);
        } else if (t < w.pivot) {
            if (side === c.grip) displayArm(a, side, -c.x - side * .14, o); else trailArm(a, side, o);
            const into = ramp(t, w.go + .6, w.go + 2.4);    // the hands push off, then reach ahead once above the display
            blendArm(o, leadArm(a, side, spare, side < 0 ? 1.1 : 1.0), into);
            // The hand swings forward on its way up, so the elbow does not fold past the shoulder.
            o.p.addScaledVector(own(a, 0, 0, 1, swingOut), .28 * Math.sin(Math.PI * into));
            // A rim within reach ahead of the shoulder is held while the body pulls up to it, then let go.
            at(a.bones[S.arm], S1);
            for (const rim of c.rims) {
                if (rim.side !== side) continue;
                toWorld(rim.at, R); const d = D.copy(R).sub(S1).dot(travel), far = D.length();
                const grab = ramp(d, .7, .45) * (1 - ramp(d, .15, -.3)) * (1 - ramp(far, .62, .85)); if (grab <= 0) continue;
                localPoint(0, rim.axisY, rim.at.z, P2); N.copy(R).sub(P2).normalize();
                blendArm(o, setArm(spare, R, travel, N, own(a, side * .4, 0, -1, PL), .95, .02, .07), grab);
            }
        } else {
            // From reaching ahead to floating relaxed as the body turns upright.
            leadArm(a, side, o, side < 0 ? 1.1 : 1.0);
            blendArm(o, neutralArm(a, side, spare, t), ramp(t, w.pivot, w.pivot + 2.2));
            blendArm(o, claspArm(a, side, spare), ramp(t, w.spot - 1.5, w.spot + 1));
            // Handshake with the station crew member at the hatchway, right hands.
            if (side < 0) {
                const shake = span(t, w.greet, w.greet + .8, w.greet + 2.4, w.greet + 3);
                if (shake > 0) { shakePoint(c, t, M); blendArm(o, setArm(spare, M.addScaledVector(own(a, 1, 0, 0, N), -.022), flat(F.copy(M).sub(at(a.bones[B.chest], P2))), N, own(a, side, -1, -.3, PL), .75, .02, .08), shake); }
            }
        }
        applyArm(a, S, o);
    }
}
// The handshake meets midway between the two, at chest height, pumping twice.
function shakePoint(c, t, out) {
    toWorld(greetAt, S1); toWorld(host1At, S2);
    out.copy(S1).add(S2).multiplyScalar(.5).addScaledVector(upW, .2 + .025 * Math.sin((t - c.times.greet - .8) * Math.PI * 4) * span(t, c.times.greet + .8, c.times.greet + 1, c.times.greet + 2, c.times.greet + 2.3));
    return out;
}

// ---- Floating from place to place, outside Dragon: routes along the module axes through the hatchways. ----
const stationRoot = dragon.group.parent, stationInverse = new THREE.Matrix4(), axisY = -.25;
const fromStation = (p, out) => out.copy(p).applyMatrix4(stationRoot.matrixWorld).applyMatrix4(inverse);
const toStation = (p, out) => out.copy(p).applyMatrix4(group.matrixWorld).applyMatrix4(stationInverse);
// Each hatchway as the two points either side of it, station frame (Columbus and Kibo off Harmony's sides, then
// Destiny, Unity, Tranquility in a line).
const gates = {
    'columbus|harmony': [[2.7, axisY, -4.8], [.9, axisY, -4.8]], 'kibo|harmony': [[-2.6, axisY, -5.7], [-.9, axisY, -5.7]],
    'harmony|destiny': [[0, axisY, -1.6], [0, axisY, .6]], 'destiny|unity': [[0, axisY, 8.2], [0, axisY, 10.2]], 'unity|tranquility': [[-1.6, axisY, 12], [-3, axisY, 12]]
};
const chain = ['columbus', 'harmony', 'destiny', 'unity', 'tranquility'];
const zone = p => p.z < -.7 ? p.x > 1.6 ? 'columbus' : p.x < -1.6 ? 'kibo' : 'harmony' : p.z < 8.7 ? 'destiny' : p.x < -2.3 ? 'tranquility' : 'unity';
export function route(from, to) {
    const points = [from.clone()];
    const pass = (x, y) => { const forward = gates[x + '|' + y]; for (const q of forward || [...gates[y + '|' + x]].reverse()) points.push(new THREE.Vector3(...q)); };
    let a = zone(from), b = zone(to);
    if (a === 'kibo') { pass('kibo', 'harmony'); a = 'harmony'; }
    const intoKibo = b === 'kibo'; if (intoKibo) b = 'harmony';
    for (let i = chain.indexOf(a), j = chain.indexOf(b); i !== j; i += Math.sign(j - i)) pass(chain[i], chain[i + Math.sign(j - i)]);
    if (intoKibo) pass('harmony', 'kibo');
    if (to.y < -1.2) points.push(new THREE.Vector3(to.x, axisY, to.z));   // down into the Cupola: over it first
    points.push(to.clone());
    return points;
}
// A trip: the hips along a smooth path (group frame) at the transfer speed, head first and belly to the deck between
// an upright start and an upright end; `target` (optional) gives the pose to finish in, live, for the last 1.6 s.
const DOWN = new THREE.Vector3(0, -1, 0), SIDE = new THREE.Vector3(1, 0, 0), tangent = V(), tripLegs = [0, 0, 0, 0];
function makeTrip(stationPoints, t0, startQ, target) {
    const kept = [];
    for (const point of stationPoints) { const p = fromStation(point, V()); if (!kept.length || p.distanceTo(kept[kept.length - 1]) > .25) kept.push(p); }
    if (kept.length < 2) kept.push(kept[0].clone().add(new THREE.Vector3(0, 0, .05)));
    const path = new THREE.CatmullRomCurve3(kept, false, 'centripetal'); path.arcLengthDivisions = 400;
    const length = path.getLength(), glide = length / tune.speed + tune.accel;
    return { path, length, t0, glide, end: t0 + glide, startQ: startQ.clone(), target };
}
function poseTrip(a, arms, tr, t, phase) {
    const u = THREE.MathUtils.clamp(t - tr.t0, 0, tr.glide), v = tune.speed, ta = tune.accel;
    const run = u < ta ? .5 * v / ta * u * u : u > tr.glide - ta ? tr.length - .5 * v / ta * (tr.glide - u) ** 2 : .5 * v * ta + v * (u - ta);
    const s = THREE.MathUtils.clamp(run / tr.length, 0, 1);
    tr.path.getPointAt(s, P); tr.path.getTangentAt(s, tangent);
    basis(tangent, Math.abs(tangent.y) > .85 ? SIDE : DOWN, q1);
    q2.copy(tr.startQ).slerp(q1, ramp(u, 0, 1.4)); q1.copy(q2);
    const travel = ramp(u, .3, 1.6) * (1 - ramp(t, tr.end - 1.8, tr.end - .2));
    if (tr.target) { const k = ramp(t, tr.end - 1.6, tr.end + .4); if (k > 0) { tr.target(R, q2); P.lerp(R, k); q1.slerp(q2, k); } }
    poseFloat(a, arms, t, P, q1, travel, phase);
}
// Floating, from relaxed (travel 0) to reaching ahead with the body stretched out (1).
function poseFloat(a, arms, t, position, quaternion, travel, phase, armsFn) {
    begin(a, position, quaternion);
    breathe(a, t, 1.45 + .1 * phase);
    poseLegs(a, blendLegs(tripLegs, tune.legs.idle, tune.legs.glide, travel), t, phase);
    if (travel > 0) { own(a, 1, 0, 0, X); spin(a.bones[B.neck], X, -.26 * travel); spin(a.bones[B.head], X, -.3 * travel); }
    const [left, right, spare] = arms;
    for (const [S, side, o] of [[B.L, 1, left], [B.R, -1, right]]) {
        neutralArm(a, side, o, t + phase);
        if (travel > 0) blendArm(o, leadArm(a, side, spare, side < 0 ? 1.1 : 1.0), travel);
        if (armsFn) armsFn(a, side, o, spare);
        applyArm(a, S, o);
    }
}
// A figure's pose to finish a trip in: its hips and its own frame (bone = frame × model), in the group frame.
const finishOn = w => (outP, outQ) => { at(w.bones[0], outP).applyMatrix4(inverse); w.bones[0].getWorldQuaternion(outQ).multiply(q3.copy(w.model[0]).invert()).premultiply(q3.copy(groupQ).invert()); return true; };
const finishAt = (p, q) => (outP, outQ) => { outP.copy(p); outQ.copy(q); return true; };

// ---- The Columbus crew as hosts: out of the lab soon after contact, back once the ceremony is over. ----
const hostLeave = k => 1 + 2.2 * k, hostBack = k => settle + 1.5 * k;
function hostFacing(h, out) { D.copy(h.index === 0 ? greetAt : M.set(0, harmonyY, hatchZ)).sub(h.home).setY(0).normalize(); return basis(stationUp, D, out); }
// Returns whether the host is out of the lab.
function stepHost(h, t) {
    const a = h.a, k = h.index;
    if (t < hostLeave(k)) { h.out = h.back = null; a.person.visible = false; return false; }
    if (!h.out) {
        const from = V(), fromQ = Q(); finishOn(h.lab)(from, fromQ);
        h.out = makeTrip(route(toStation(from, from), toStation(h.home, V())), hostLeave(k), fromQ, finishAt(h.home.clone(), hostFacing(h, Q())));
    }
    a.person.visible = true;
    if (t < h.out.end + .4) { poseTrip(a, h.arms, h.out, t, 3 + k); return true; }
    if (t < hostBack(k)) { h.back = null; poseHost(h, t); return true; }
    if (!h.back) {
        // From where the ceremony left it, upright, facing the camera side.
        const to = V(); finishOn(h.lab)(to, Q());
        h.back = makeTrip(route(toStation(h.spot, V()), toStation(to, to)), hostBack(k), basis(stationUp, ceremonyFront, Q()), finishOn(h.lab));
    }
    if (t < h.back.end + .4) { poseTrip(a, h.arms, h.back, t, 3 + k); return true; }
    a.person.visible = false; return false;
}

// ---- The arrivals settle in: change in the crew quarters, then go where the day has them. ----
let destinationOf = () => null;     // person (0-3, by seat) → a posed figure (pose-kit wrap) to become, or null
const boothPose = (bed, outP, outQ) => {
    bed.home.updateWorldMatrix(true, false);
    outP.set(-.08, bed.bed.hips[1], bed.bed.hips[2]).applyMatrix4(bed.home.matrixWorld).applyMatrix4(inverse);
    bed.home.getWorldQuaternion(outQ).multiply(basis(stationUp, SIDE, q3)).premultiply(q3.copy(groupQ).invert());
};
function dressAs(c, station) { if (c.dressed === station) return; c.dressed = station; lab.dress(c.a.person, station ? stationLooks[c.index] : looks[c.index]); }
// Off with the shirt and on with the other: hands to the hem, up over the head, down again.
function changeArms(k) {
    const hem = span(k, 0, .14, .86, 1), lift = span(k, .16, .4, .6, .84);
    return (a, side, o, spare) => {
        blendArm(o, setArm(spare, ownPoint(a, side * .13, -.02, .14, P), own(a, -side * .4, -1, .25, F), own(a, 0, .1, -1, N), own(a, side * .5, -.3, -.6, PL), .75, .02), hem);
        blendArm(o, setArm(spare, ownPoint(a, side * .09, .64, .07, P), own(a, 0, 1, 0, F), own(a, -side, 0, 0, N), own(a, side * .8, .1, -.2, PL), .65, .02), lift);
    };
}
function settleArrival(c, t) {
    const a = c.a, w = c.times, bed = quarters.beds[c.turn % 2];
    a.person.visible = true; fade(c.skin, 1, c.shown);
    if (!c.booth) {
        boothPose(bed, R, q2); c.boothAt = { p: R.clone(), q: q2.clone() };
        c.booth = makeTrip(route(toStation(c.spot, V()), toStation(R, V())), w.leaveSpot, c.spotQ, finishAt(c.boothAt.p, c.boothAt.q));
    }
    const change = c.booth.end + .4, off = change + changeTime;
    if (t < change) { c.out = null; dressAs(c, false); poseTrip(a, c.arms, c.booth, t, c.index); return; }
    if (t < off) {
        const k = (t - change) / changeTime; dressAs(c, k >= .5); c.out = null;
        poseFloat(a, c.arms, t, c.boothAt.p, c.boothAt.q, 0, c.index, changeArms(k));
        look(a, ownPoint(a, 0, .1, .6, M), .3);
        return;
    }
    dressAs(c, true);
    if (!c.out) {
        const figure = destinationOf(c.index), from = toStation(c.boothAt.p, V());
        const to = V(); if (figure) { finishOn(figure)(to, Q()); toStation(to, to); } else to.set(0, axisY - .05, 3.4);
        c.out = makeTrip(route(from, to), off, c.boothAt.q, figure ? finishOn(figure) : null); c.out.figure = figure;
    }
    if (t < c.out.end + .4) {
        poseTrip(a, c.arms, c.out, t, c.index);
        if (!c.out.figure) fade(c.skin, 1 - ramp(t, c.out.end - 1.6, c.out.end + .3), c.shown);
        return;
    }
    a.person.visible = false; c.home = true;
}

function poseHost(h, t) {
    const a = h.a, [left, right, spare] = h.arms, k = h.index;
    // Each arrival in turn: its greeting (the greeter leans in), its approach (all look), its wave (the two higher up).
    // The windows overlap from one arrival to the next, so every blend runs over all of them.
    const greeting = byTurn.map(c => span(t, c.times.greet - .2, c.times.greet + .5, c.times.greet + 2.6, c.times.greet + 3.2));
    const leave = k === 0 ? ramp(t, hostMove, hostMove + 4.5) : 0, toCeremony = ramp(t, ceremony - 1, ceremony + 2);
    P.copy(h.home).lerp(h.spot, leave);
    P.y += .012 * Math.sin(t * .35 + k * 2); P.x += .01 * Math.sin(t * .27 + k);
    if (k === 0) greeting.forEach(g => { if (g > 0) P.lerp(D.copy(greetAt).lerp(host1At, .8), g); });
    // Facing: the hatchway while waiting (the greeter toward the arrival), the port side for the ceremony.
    D.copy(k === 0 ? greetAt : M.set(0, harmonyY, hatchZ)).sub(P).setY(0); if (D.lengthSq() < 1e-4) D.set(0, 0, -1);
    D.normalize().lerp(ceremonyFront, Math.max(leave, toCeremony)).normalize();
    basis(stationUp, D, q1); begin(a, P, q1);
    breathe(a, t, 1.4 + .12 * k);
    poseLegs(a, tune.legs.idle, t, 3 + k);
    // Gaze: the hatchway, the head of whoever is coming in, the camera side at the ceremony.
    localPoint(0, harmonyY, hatchZ, M);
    for (const c of byTurn) {
        const w = c.times, watch = span(t, w.go + c.glide * .5, w.go + c.glide * .5 + 1, w.move, w.move + 1);
        if (watch > 0) { at(c.a.bones[B.head], R); M.lerp(R, watch); }
    }
    M.lerp(toWorld(h.spot, R).addScaledVector(frontWorld, 4).addScaledVector(upW, .7), toCeremony);
    look(a, M, .7);
    for (const [S, side, o] of [[B.L, 1, left], [B.R, -1, right]]) {
        neutralArm(a, side, o, t + k);
        blendArm(o, claspArm(a, side, spare), k === 0 ? ramp(t, hostMove + 3, hostMove + 5) : ramp(t, ceremony - .5, ceremony + 2.5));
        for (const c of byTurn) {
            const w = c.times;
            if (k === 0 && side < 0) {
                const shake = span(t, w.greet, w.greet + .8, w.greet + 2.4, w.greet + 3);
                if (shake > 0) { shakePoint(c, t, M); blendArm(o, setArm(spare, M.addScaledVector(own(a, 1, 0, 0, N), -.022), flat(F.copy(M).sub(at(a.bones[B.chest], P2))), N, own(a, side, -1, -.3, PL), .75, .02, .08), shake); }
            } else if (k === 0) {
                // The other hand on the arrival's right shoulder.
                const clasp = span(t, w.greet + .5, w.greet + 1.1, w.greet + 2.3, w.greet + 2.9);
                if (clasp > 0) {
                    const b = c.a; at(b.bones[B.R.arm], R); own(b, 0, 1, 0, U); own(b, 0, 0, 1, F);
                    R.addScaledVector(U, .085).addScaledVector(F, -.02);
                    blendArm(o, setArm(spare, R, P2.copy(F).negate().addScaledVector(U, -.3), N.copy(U).negate(), own(a, side, -.6, -.2, PL), .45, .02, .07), clasp);
                }
            } else if (side > 0) {
                // A wave from the two higher up.
                const beat = Math.sin((t - w.pivot) * Math.PI * 2.4), wave = span(t, w.pivot - .3, w.pivot + .5, w.greet + 1.6, w.greet + 2.4) * (k === 1 ? 1 : .8);
                if (wave > 0) blendArm(o, waveArm(a, side, spare, beat), wave);
            }
        }
        applyArm(a, S, o);
    }
}

// Who is where, for js/figures/crew-story.js: each host out of the lab, each arrival (by seat) at its place in the day.
const progress = { docked: false, hostsAway: [false, false, false], home: [false, false, false, false], done: false };
export const dragonTransfer = {
    group, crew, hosts, tune, times: T, ceremony, settle, dragonHatch, harmonyHatch, stationLooks, progress, route,
    setDestinations(fn) { destinationOf = fn; },
    // Harmony turns to line art from just before its hatch opens.
    get harmonyOpen() { return approach.time >= approach.duration && approach.docked >= T.harmony - .5; }
};
export function updateDragonTransfer(force = false) {
    if (!dragon.group.visible && !force) return;
    const docked = approach.time >= approach.duration, t = docked ? approach.docked : 0;
    group.updateWorldMatrix(true, false); group.getWorldQuaternion(groupQ); inverse.copy(group.matrixWorld).invert(); stationInverse.copy(stationRoot.matrixWorld).invert();
    harmonyHatch.visible = docked;
    localDir(0, 1, 0, upW); localDir(ceremonyFront.x, ceremonyFront.y, ceremonyFront.z, frontWorld);
    harmonyHatch.rotation.y = rad(100) * ramp(t, T.harmony + .3, T.harmony + 3.5);
    dragonHatch.rotation.y = rad(100) * ramp(t, T.hatch + .3, T.hatch + 2.8);
    for (const c of crew) poseArrival(c, t);
    hosts.forEach((h, k) => { progress.hostsAway[k] = stepHost(h, t); });
    crew.forEach(c => { progress.home[c.index] = c.home; });
    progress.docked = docked; progress.done = docked && progress.home.every(Boolean) && !progress.hostsAway.some(Boolean);
}
updateDragonTransfer(true);
showCabin(false);
