// The Columbus crew's day: a 140 s cycle built around their work loops (js/parts/columbus.js). Crew 1 (laptop) and
// Crew 3 (aft racks) play their loop, an act posed here every frame with js/figures/pose-kit.js, then the loop again;
// Crew 2 works through glovebox tasks with a break.
// - Crew 3, 36-104 s: lets go of its rail and drifts upright to the glovebox, watches Crew 2's sample with a hand on
//   that shoulder, drifts on to the laptop end along the open side of the aisle and talks there with Crew 1 (a hand on
//   the rack, looks, nods, an open-palm gesture), then drifts back to its rail.
// - Crew 1, 35-105 s: stretches, types, follows Crew 3 in with the eyes, greets it, points at the screen, works the
//   touchpad, nods, watches it go and types on.
// - Crew 2: work, work, pause (hands out of the gloves and turned to the talk at the laptop end), work, work, tool; this
//   schedule runs 14.1 s behind the others so the sample is up while Crew 3 watches.
// Who is on shift follows the crew's day (js/figures/crew-day.js, through js/figures/crew-story.js): all three ('day'),
// one alone at the laptop on Crew 1's loop ('laptop'; the crew take turns, so that figure is dressed as whoever's turn it
// is), or nobody.
// Each act starts and ends in the first pose of the loop it interrupts: Crew 1's changes are added on top of that pose,
// Crew 3's full-body pose blends out of it and back into it.
import * as THREE from 'three';
import { parts } from '../core/station.js';
import { updateColumbusCrew } from '../parts/columbus.js';
import { B, FINGER, at, basis, begin, curl, face, hold, mix, own, ownPoint, ramp, reach, shareTwist, span, spin, wrap } from './pose-kit.js';

const lab = parts.get('columbus').group.userData.lab, { interior, hover } = lab, [typist, gloves, floater] = lab.crew;
export const cycle = 140;
export const day = {
    typist: [35, 105],                 // act; the 35 s loop before and after
    floater: [36, 104],                // act; the 36 s loop before and after
    glove: { lag: 14.1, tasks: [['work', 0], ['work', 26], ['pause', 52], ['work', 74], ['work', 100], ['tool', 126]] }
};
export const tune = { speed: .42, accel: 1.6, legs: { float: [.5, .85, .3, .08], drift: [.3, .7, .35, .06] } };

const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
const P = V(), H = V(), U = V(), D = V(), F = V(), N = V(), X = V(), M = V(), R = V(), S0 = V(), E0 = V(), W = V(), travel = V();
const q1 = Q(), q2 = Q(), q3 = Q(), up = new THREE.Vector3(0, 1, 0), scale = V(), m4 = new THREE.Matrix4(), inverse = new THREE.Matrix4();
const local = (x, y, z, out) => out.set(x, y, z).applyMatrix4(interior.matrixWorld);           // cabin point → world
const localDir = (x, y, z, out) => out.set(x, y, z).transformDirection(interior.matrixWorld);  // cabin direction → world
const loopTime = (t, [start, end]) => t < start ? t : t >= end ? t - end : 0;

// ---- Arms: a palm point, finger and palm directions, the elbow's pole, the curl (as in js/figures/dragon-transfer.js). ----
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
// Hand targets stay inside the cabin: rack faces, deck, the cut-away side, the end bulkheads.
function keepInside(p) {
    M.copy(p).applyMatrix4(inverse.copy(interior.matrixWorld).invert());
    M.set(Math.min(.85, Math.max(-.92, M.x)), Math.min(.88, Math.max(-.9, M.y)), Math.min(2.3, Math.max(-2.3, M.z)));
    return p.copy(M).applyMatrix4(interior.matrixWorld);
}
const applyArm = (a, S, o) => { keepInside(o.p); hold(a, S, o.p, o.f, o.n, o.pole, o.depth, o.along); curl(a, S, o.curl); };
const neutralArm = (a, side, o, t) => setArm(o, ownPoint(a, side * .22, .2 + .015 * Math.sin(t * .5 + side), .22, P), own(a, side * .1, .45, 1, F),
    own(a, -side * .45, -1, .15, N), own(a, side * .45, -.75, -.5, X), .4);

// Legs from the bind pose: spread, then hip and knee flexion and the ankle, about the figure's own axes.
function poseLegs(a, [hip, knee, ankle, spread], t) {
    own(a, 1, 0, 0, X); own(a, 0, 0, 1, D);
    for (const [S, side, k] of [[B.L, 1, 0], [B.R, -1, 1.9]]) {
        spin(a.bones[S.upLeg], D, side * spread);
        spin(a.bones[S.upLeg], X, -hip - .04 * Math.sin(t * .37 + k));
        spin(a.bones[S.leg], X, knee + .05 * Math.sin(t * .43 + k));
        spin(a.bones[S.foot], X, ankle);
    }
}
const blendLegs = (out, a, b, k) => { for (let i = 0; i < 4; i++) out[i] = mix(a[i], b[i], k); return out; };
// Head toward a point, the neck taking part of the turn; a target too far round behind the shoulder is let go.
function look(a, point, weight) {
    if (weight <= 0) return;
    at(a.bones[B.head], H); D.copy(point).sub(H).normalize(); own(a, 0, 0, 1, F);
    weight *= 1 - ramp(Math.acos(Math.max(-1, Math.min(1, D.dot(F)))), 1.3, 1.65); if (weight <= 0) return;
    own(a, 0, 1, 0, U); m4.makeBasis(X.crossVectors(U, D).normalize(), U.crossVectors(D, X), D); q1.setFromRotationMatrix(m4);
    a.bones[B.neck].getWorldQuaternion(q2); face(a.bones[B.neck], q2.slerp(q3.copy(q1).multiply(a.model[B.neck]), .45 * weight));
    a.bones[B.head].getWorldQuaternion(q2); face(a.bones[B.head], q2.slerp(q3.copy(q1).multiply(a.model[B.head]), weight));
}
// A nod: the head dips and comes back in 0.7 s around each time.
const nod = (t, times) => times.reduce((sum, at0) => sum + Math.max(0, Math.sin(Math.PI * (t - at0) / .7)) * (t > at0 && t < at0 + .7 ? 1 : 0), 0);

// ---- Crew 3: the visitor. ----
const a3 = wrap(floater, hover), base3 = { q: a3.bones.map(() => Q()), p: V(), r: Q() };
// Spots in the cabin frame: hips, facing, forward lean.
const spot = (hips, front, lean) => ({ hips: new THREE.Vector3(...hips), front: new THREE.Vector3(...front).normalize(), lean });
const spots = {
    home: spot([-.36, .18, -1.6], [-1, 0, 0], .25),
    glovebox: spot([-.06, .2, -.1], [-.79, 0, .62], .3),
    laptop: spot([-.42, .1, 2.1], [-.75, 0, -.55], .15)
};
// Each leg drifts the hips along a path on the open side of the aisle, clear of the others, the body upright: it turns
// from the spot's facing to the leg's `lane` and back to the next spot's, and leans into its speed.
const legs = [
    { go: 39.6, from: 'home', to: 'glovebox', lane: [.2, 0, 1], via: [[.25, .25, -1.15], [.4, .26, -.55], [.2, .25, -.1]] },
    { go: 57.5, from: 'glovebox', to: 'laptop', lane: [0, 0, 1], via: [[.3, .27, .15], [.45, .25, .75], [.46, .25, 1.4], [.36, .23, 1.88], [0, .17, 2.13]] },
    { go: 84.5, from: 'laptop', to: 'home', lane: [0, 0, -1], via: [[.02, .2, 2.0], [.38, .24, 1.78], [.46, .25, 1.2], [.46, .25, .5], [.42, .25, -.3], [.14, .22, -1.1]] }
].map(leg => {
    const from = spots[leg.from], to = spots[leg.to];
    const path = new THREE.CatmullRomCurve3([from.hips, ...leg.via.map(p => new THREE.Vector3(...p)), to.hips], false, 'centripetal');
    path.arcLengthDivisions = 400; const length = path.getLength(), time = length / tune.speed + tune.accel;
    return { ...leg, from, to, path, length, time, end: leg.go + time, lane: new THREE.Vector3(...leg.lane).normalize() };
});
// Facing by heading angle, so a turn goes the short way round.
const heading = v => Math.atan2(v.x, v.z), facing = (angle, out) => out.set(Math.sin(angle), 0, Math.cos(angle));
const turnTo = (from, to, k) => { let d = to - from; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2)); return from + d * k; };
// Where the body is at time t of the act, and what it is doing.
const root = { p: V(), q: Q() }, nameOf = s => Object.keys(spots).find(name => spots[name] === s);
function visitorRoot(t) {
    let at0 = spots.home, leg = null;
    for (const l of legs) { if (t < l.go) break; at0 = l.to; if (t < l.end) { leg = l; break; } }
    if (!leg) {
        root.p.copy(at0.hips); root.p.y += .01 * Math.sin(t * .37); root.p.z += .008 * Math.sin(t * .29);
        U.copy(up).addScaledVector(at0.front, Math.tan(at0.lean)); basis(U, at0.front, root.q);
        return { phase: nameOf(at0), speed: 0 };
    }
    // Trapezoid speed along the path.
    const u = t - leg.go, v = tune.speed, ta = tune.accel, travelled = leg.length;
    const run = u < ta ? .5 * v / ta * u * u : u > leg.time - ta ? travelled - .5 * v / ta * (leg.time - u) ** 2 : .5 * v * ta + v * (u - ta);
    const s = Math.min(1, Math.max(0, run / travelled)), speed = u < ta ? u / ta : u > leg.time - ta ? (leg.time - u) / ta : 1;
    leg.path.getPointAt(s, root.p); leg.path.getTangentAt(s, travel);
    const turnIn = ramp(u, 0, 2.4), turnOut = ramp(u, leg.time - 3, leg.time);
    const angle = turnTo(turnTo(heading(leg.from.front), heading(leg.lane), turnIn), heading(leg.to.front), turnOut);
    facing(angle, F);
    U.copy(up).addScaledVector(F, Math.tan(mix(leg.from.lean, leg.to.lean, turnOut))).addScaledVector(travel, Math.tan(.42 * speed));
    basis(U, F, root.q);
    return { phase: 'drift', leg, speed, u };
}
// Hand holds, cabin frame: the home rail, the rack face beside the laptop; Crew 2's right shoulder is read each frame.
const holds = { rail: [-.885, .6, -1.86], rack: [-.915, .38, 2.16] };
const o3 = { L: arm(), R: arm(), spare: arm() };
function railArm(a, side, o) {
    return setArm(o, local(...holds.rail, P), localDir(0, 1, 0, F), localDir(-1, 0, 0, N), own(a, side * .5, -.6, -.3, X), 1.05, .03, .07);
}
function rackArm(a, side, o) {
    return setArm(o, local(...holds.rack, P), localDir(0, .85, .5, F), localDir(-1, 0, 0, N), own(a, side * .6, -.6, -.2, X), .35, .015, .08);
}
const shoulder = V();
function shoulderArm(a, side, o) {
    at(gloves.userData.bones.RightArm, shoulder); localDir(0, 1, 0, U);
    shoulder.addScaledVector(U, .075).addScaledVector(localDir(1, 0, 0, F), .02);
    return setArm(o, shoulder, localDir(-1, -.35, -.1, F), U.negate(), own(a, side * .6, -.5, -.3, X), .45, .02, .07);
}
function gestureArm(a, side, o, t) {
    const beat = Math.sin(t * 3.1);
    return setArm(o, ownPoint(a, side * .08, .3 + .02 * beat, .26, P), own(a, side * .3, .2, 1, F), own(a, 0, 1, .2 + .15 * beat, N), own(a, side * .6, -.7, -.2, X), .12);
}
// While drifting the free hands come forward a little, ready to catch.
const driftArm = (a, side, o, t) => setArm(o, ownPoint(a, side * .2, .34 + .015 * Math.sin(t * .6 + side), .26, P), own(a, side * .15, .6, 1, F),
    own(a, -side * .3, -1, .3, N), own(a, side * .5, -.7, -.4, X), .35);
const holdOf = { home: railArm, laptop: rackArm, glovebox: shoulderArm }, holdSide = { home: -1, laptop: 1, glovebox: 1 };
// Where each spot's eyes go.
function gazeAt(place, t, out) {
    if (place === 'home') return local(-.9, .3, -1.4, out);
    if (place === 'glovebox') return local(-.8, .5, .42, out).lerp(at(gloves.userData.bones.Head, R), .6 * span(t, 51.6, 52.4, 53.6, 54.4));
    const toCrew1 = Math.max(span(t, 67.4, 68.2, 69.2, 70), span(t, 74.4, 75.2, 77, 77.8), span(t, 80.4, 81.2, 84, 84.6));
    return local(-.84, .17, 1.39, out).lerp(at(typist.userData.bones.Head, R), toCrew1);
}

let legsNow = [0, 0, 0, 0];
function poseVisitor(t) {
    const a = a3, state = visitorRoot(t), [left, right, spare] = [o3.L, o3.R, o3.spare], { phase, leg } = state;
    begin(a, root.p, root.q);
    const breath = .009 * Math.sin(t * 1.37 + 1.1); own(a, 1, 0, 0, X); spin(a.bones[B.chest], X, -breath); spin(a.bones[B.upper], X, -breath);
    // Legs: the neutral posture, trailing a little with speed.
    poseLegs(a, blendLegs(legsNow, tune.legs.float, tune.legs.drift, state.speed), t);
    // Head: the spot's work or talk; while drifting, the next spot (and at first, the way out).
    if (leg) {
        const ahead = ramp(state.u, .2, 1.6) * (1 - ramp(state.u, leg.time - 1.4, leg.time));
        gazeAt(nameOf(leg.from), t, M); look(a, M, .8 * (1 - ramp(state.u, 0, .8)));
        gazeAt(nameOf(leg.to), t, M); look(a, M, .8 * ramp(state.u, leg.time - 1.6, leg.time));
        look(a, M.copy(root.p).addScaledVector(travel, 2).applyMatrix4(interior.matrixWorld), .7 * ahead);
    } else {
        if (phase === 'home' && t < 60) look(a, local(.1, .5, -.2, M), .8 * ramp(t, 37.6, 39));
        else look(a, gazeAt(phase, t, M), phase === 'home' ? .7 : .85 * (phase === 'laptop' ? 1 - ramp(t, 84.3, 84.8) : 1));
        if (phase === 'laptop') { own(a, 1, 0, 0, X); spin(a.bones[B.head], X, .16 * nod(t, [68.6, 72.8, 76.2, 82.4])); }
    }
    // Arms: hold on at a spot, let go as the drift starts, hands forward on the way, the next hold caught on arrival.
    for (const [S, side, o] of [[B.L, 1, left], [B.R, -1, right]]) {
        if (!leg) {
            neutralArm(a, side, o, t);
            if (holdSide[phase] === side) {
                const on = phase === 'glovebox' ? span(t, 48.2, 49.2, 56.2, 57) : phase === 'laptop' ? 1 - ramp(t, 84.3, 84.9) : 1;
                blendArm(o, holdOf[phase](a, side, spare), on);
            } else if (phase === 'laptop') blendArm(o, gestureArm(a, side, spare, t), Math.max(span(t, 74.8, 75.6, 76.6, 77.4), span(t, 82.4, 83, 83.6, 84.2)));
        } else {
            const from = nameOf(leg.from), to = nameOf(leg.to), u = state.u;
            neutralArm(a, side, o, t);
            if (holdSide[from] === side && from !== 'glovebox') blendArm(o, holdOf[from](a, side, spare), 1 - ramp(u, .4, 1.2));
            blendArm(o, driftArm(a, side, spare, t), ramp(u, .6, 2) * (1 - ramp(u, leg.time - 2.6, leg.time - 1)));
            if (holdSide[to] === side && to !== 'glovebox') blendArm(o, holdOf[to](a, side, spare), ramp(u, leg.time - 1.5, leg.time - .3));
        }
        applyArm(a, S, o);
    }
}
// Crew 3's loop pose under the act, kept to blend from (hips in the cabin frame, every other bone as it is).
function hipsInCabin(out, outQ) { m4.multiplyMatrices(inverse.copy(interior.matrixWorld).invert(), a3.bones[0].matrixWorld).decompose(out, outQ, scale); }
function keepBase() { floater.updateWorldMatrix(true, true); a3.bones.forEach((bone, i) => base3.q[i].copy(bone.quaternion)); hipsInCabin(base3.p, base3.r); }
function fromBase(k) {
    hipsInCabin(P, q1);
    floater.position.copy(base3.p).lerp(P, k); floater.quaternion.copy(base3.r).slerp(q1, k);
    a3.bones[0].position.set(0, 0, 0); a3.bones[0].quaternion.identity();
    for (let i = 1; i < a3.bones.length; i++) { q2.copy(a3.bones[i].quaternion); a3.bones[i].quaternion.copy(base3.q[i]).slerp(q2, k); }
}

// ---- Crew 1: changes on top of the loop's first pose. ----
const a1 = wrap(typist, interior);
const hand1 = { L: { w: V(), q: Q(), pole: V() }, R: { w: V(), q: Q(), pole: V() } }, goal = { w: V(), q: Q(), pole: V() };
function baseHand(a, S, o) { at(a.bones[S.hand], o.w); a.bones[S.hand].getWorldQuaternion(o.q); at(a.bones[S.fore], E0); at(a.bones[S.arm], S0); o.pole.copy(E0).sub(S0); }
// A palm placed as hold() would place it, as the wrist point and hand orientation to blend toward.
function palmGoal(point, fingers, palm, pole, along, depth) {
    basis(fingers, palm, goal.q); goal.w.copy(point).addScaledVector(F.set(0, 1, 0).applyQuaternion(goal.q), -along).addScaledVector(N.set(0, 0, 1).applyQuaternion(goal.q), -depth);
    goal.pole.copy(pole); return goal;
}
function toward(o, g, k) { if (k > 0) { o.w.lerp(g.w, k); o.q.slerp(g.q, k); o.pole.lerp(g.pole, k); } }
function placeHand(a, S, o, k) {
    if (k <= 0) return;
    reach(a.bones[S.arm], a.bones[S.fore], a.bones[S.hand], o.w, o.pole); face(a.bones[S.hand], o.q); shareTwist(a.bones[S.fore], a.bones[S.hand], a.bind[S.hand], .5 * k);
}
const flexBy = (a, S, finger, angles, k) => { for (let j = 0; j < 3; j++) { const i = S.fingers + FINGER[finger] + j; if (a.flex[i]) a.bones[i].quaternion.multiply(q1.setFromAxisAngle(a.flex[i], angles[j] * k)); } };
const straighten = (a, S, finger, k) => { for (let j = 0; j < 3; j++) { const i = S.fingers + FINGER[finger] + j; a.bones[i].quaternion.slerp(a.bind[i], k); } };
function poseTypist(t) {
    const a = a1, bones = a.bones;
    typist.updateWorldMatrix(true, true); typist.getWorldQuaternion(a.world); interior.getWorldQuaternion(a.homeWorld);
    baseHand(a, B.L, hand1.L); baseHand(a, B.R, hand1.R);
    const stretch = span(t, 37, 38.9, 40.7, 42.6), point = span(t, 70, 70.9, 73.4, 74.3), pad = span(t, 77.6, 78.3, 79.8, 80.5);
    const toCrew3 = Math.max(span(t, 62.6, 64, 69.4, 70.2), span(t, 74.4, 75.2, 77.2, 78), span(t, 80.4, 81.2, 86, 87));
    // Back: arches in the stretch, turns toward Crew 3 while talking.
    own(a, 1, 0, 0, X); localDir(0, 1, 0, U);
    for (const [bone, share] of [[B.spine, .3], [B.chest, .35], [B.upper, .35]]) { spin(bones[bone], X, -.2 * share * stretch); spin(bones[bone], U, .28 * share * toCrew3); }
    // Head: up with the stretch; to Crew 3 and back to the screen; nods.
    own(a, 1, 0, 0, X); spin(bones[B.neck], X, -.12 * stretch); spin(bones[B.head], X, -.16 * stretch);
    look(a, at(floater.userData.bones.Head, M), .9 * toCrew3);
    own(a, 1, 0, 0, X); spin(bones[B.head], X, .15 * nod(t, [68.2, 76.2, 82, 83.4]));
    // Arms. Stretch: hands up past the sides of the head, fingers laced above it, palms to the ceiling.
    at(bones[B.head], H);
    for (const [S, side, o] of [[B.L, 1, hand1.L], [B.R, -1, hand1.R]]) {
        if (stretch > 0) {
            own(a, 0, 1, 0, U); own(a, 1, 0, 0, X); own(a, 0, 0, 1, W);
            M.copy(H).addScaledVector(U, .3).addScaledVector(X, side * .055).addScaledVector(W, .03);
            palmGoal(M, D.copy(X).multiplyScalar(-side).addScaledVector(U, .35), U, R.copy(X).multiplyScalar(side * .8).addScaledVector(U, .1).addScaledVector(W, -.4), .08, .02);
            // On the way up and down the hands pass beside the head, not through the face.
            toward(o, goal, stretch); o.w.addScaledVector(X, side * .22 * Math.sin(Math.PI * stretch)).addScaledVector(W, .06 * Math.sin(Math.PI * stretch));
        }
        if (side < 0 && point > 0) {
            // The index finger to the screen, tapping it twice.
            const tap = .014 * (Math.max(0, Math.sin(Math.PI * (t - 71.2) / .5)) * (t > 71.2 && t < 71.7) + Math.max(0, Math.sin(Math.PI * (t - 72.3) / .5)) * (t > 72.3 && t < 72.8));
            local(-.815 - tap, .215, 1.43, M); localDir(-1, -.22, .1, D); localDir(0, -1, -.1, N);
            palmGoal(M, D, N, own(a, -.6, -.7, -.2, R), .175, 0); toward(o, goal, point);
        }
        if (side < 0 && pad > 0) { local(-.538, .195, 1.384, M); goal.w.copy(M); goal.q.copy(o.q); goal.pole.copy(o.pole); toward(o, goal, pad); }
        placeHand(a, S, o, Math.max(stretch, side < 0 ? Math.max(point, pad) : 0));
    }
    if (stretch > 0) for (const [S] of [[B.L], [B.R]]) for (const finger of ['Index', 'Middle', 'Ring', 'Pinky']) straighten(a, S, finger, .7 * stretch);
    if (point > 0) {
        straighten(a, B.R, 'Index', point);
        for (const finger of ['Middle', 'Ring', 'Pinky']) flexBy(a, B.R, finger, [1.1, 1.3, .8], point);
        flexBy(a, B.R, 'Thumb', [0, .5, .5], point);
    }
    if (pad > 0) flexBy(a, B.R, 'Index', [.25, .1, 0], pad * Math.max(0, Math.sin(t * 4.5)) ** 3);
}

// ---- The day. ----
const glove = { task: 'work', time: 0, look: { yaw: -.6, pitch: .08, twist: -.15, weight: 0 } };
function gloveAt(t) {
    const g = ((t - day.glove.lag) % cycle + cycle) % cycle, tasks = day.glove.tasks;
    let i = tasks.length - 1; while (i > 0 && g < tasks[i][1]) i--;
    glove.task = tasks[i][0]; glove.time = g - tasks[i][1];
    glove.look.weight = span(t, 51.5, 52.3, 53.6, 54.4);
    return glove;
}
const clock = { typist: 0, floater: 0, typing: 1, thought: 1, glove };
export const labCrew = { day, tune, legs, spots, cycle, a1, a3, now: 0 };
const solo = { typist: 0, floater: 0, typing: 1, thought: 1, glove: { task: 'work', time: 0 } };
let shown = '';
// `away`: per figure (Crew 1-3), out of the lab for now (js/figures/crew-story.js): hidden, still posed.
function show(mode, away) {
    const key = mode + away.join(); if (key === shown) return; shown = key;
    typist.visible = mode !== 'none' && !away[0]; gloves.visible = mode === 'day' && !away[1]; floater.visible = mode === 'day' && !away[2];
}
const nobodyAway = [false, false, false];
export function updateLabCrew(elapsed, mode = 'day', pose = true, away = nobodyAway) {
    show(mode, away);
    if (!pose || mode === 'none') return;
    if (mode === 'laptop') { solo.typist = solo.floater = elapsed; updateColumbusCrew(elapsed, solo); return; }
    const t = ((elapsed % cycle) + cycle) % cycle; labCrew.now = t;
    clock.typist = loopTime(t, day.typist); clock.floater = loopTime(t, day.floater);
    clock.typing = t < day.typist[0] || t >= day.typist[1] ? 1 : Math.max(1 - ramp(t, 35.2, 36), span(t, 43.4, 44.2, 60.4, 61.2), ramp(t, 87.6, 88.6));
    gloveAt(t);
    floater.position.copy(floater.userData.rest.position); floater.quaternion.copy(floater.userData.rest.quaternion);
    updateColumbusCrew(elapsed, clock);
    // Crew 3 first: Crew 1 looks at it.
    const k = t < day.floater[0] || t >= day.floater[1] ? 0 : ramp(t, 37.4, 39.4) * (1 - ramp(t, 100.8, 103.6));
    if (k > 0) {
        if (k < 1) keepBase();
        hover.position.set(0, 0, 0); hover.quaternion.identity(); hover.updateMatrixWorld(true);
        poseVisitor(t);
        if (k < 1) fromBase(k);
        floater.updateMatrixWorld(true);
    }
    if (t > day.typist[0] && t < day.typist[1]) poseTypist(t);
}
