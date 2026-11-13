// Pre-built sequences (sequences.js) and planned routes (planner.js) become timed segments here, and a time on the plan
// becomes a state (pose.js). `compile(steps, start)` runs the steps from `start`, solving each reach as it comes: a
// joint move to a point short of the fixture (left out when a planned route already stands the arm there), a straight
// approach along its normal, the snare. Walking (rebase) swaps base and tip, so the arm moves end over end. A route's
// `path` is a list of poses (radians) from the pose it starts in, evenly spaced, played at an even pace. Each segment
// keeps the step it comes from and what part of it it plays, for the look-ahead in index.js. The cargo vehicle
// arrives up the nadir to its capture point, is berthed in two straight runs (to under the port, then up) and leaves
// the other way round; the fixture on it is reached and released like any other. Timing follows the
// hardware, shown faster: joints at most 4 degrees a second and approaches 4 cm a second (×12), the transporter
// 2.5 cm a second (×80). With a spacewalker on the foot restraint (pose.js `crew`) a move is paced by how far it
// carries them instead: 10 cm a second (×12), with a share for the joints' turn so a turn on the spot is slow too.
// Fitting the restraint, boarding, the work and alighting are segments of their own (kinds 'fit', 'board', 'work',
// 'alight'); `sample` says which of the last three plays and how far along it is (`crew.act`, `crew.u`), for the figure
// (js/figures/rider.js).
import { FLIP, LIMIT, multiply, reach, reverse } from './kinematics.js?v=44ee3feec6';
import { fixtures } from './fixtures.js?v=00abdcef15';
import { CARGO_CAPTURE, CARGO_FAR, CARGO_READY, REST, baseFrame, cargoFixtureAt, copyState, crewFrame, fixtureFrame, tipFrame, tipFrameForDextreOn } from './pose.js?v=f186b91cd6';

export const ARM_SPEEDUP = 12, RIDE_SPEEDUP = 80, CARGO_SPEEDUP = 60;
const toRadians = Math.PI / 180, jointRate = 4 * toRadians * ARM_SPEEDUP, approachRate = .04 * ARM_SPEEDUP, rideRate = .025 * RIDE_SPEEDUP;
// Carried on the restraint: metres a second for the spacewalker, and the metres each radian of the busiest joint counts
// for; poses along the way no more than this far apart (radians).
const crewRate = .1 * ARM_SPEEDUP, crewTurn = 2.5, crewStep = 4 * toRadians, CREW_ACTS = new Set(['board', 'work', 'alight']);
// Smoothstep easing peaks at 1.5 times the mean rate, so durations allow for it.
const ease = t => t * t * (3 - 2 * t), peak = 1.5;
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = angle => angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI)), PITCH = new Set([2, 3, 4]);
const withinTravel = angle => angle > LIMIT ? angle - 2 * Math.PI : angle < -LIMIT ? angle + 2 * Math.PI : angle;
// A frame moved `distance` along its own x axis (out along a fixture's normal, for grapple frames).
const outAlong = (m, distance) => { const r = m.slice(); r[12] += m[0] * distance; r[13] += m[1] * distance; r[14] += m[2] * distance; return r; };
// The tip body frame (C7) that puts the tip's grapple frame on `target`.
const tipBodyFor = target => multiply(target, FLIP);
const onCargo = id => fixtures.get(id)?.host === 'cargo';

export function compile(steps, start) {
    const segments = [];
    let state = copyState(start), problem = null;
    // Each segment knows the step it comes from (`step`, its index here; `source`, the operation's step a planned step
    // stands for) and what part of it it plays (`kind`: 'standoff', 'approach', 'snare' and so on).
    let index = 0, source = 0;
    const push = (label, duration, to, speedup = ARM_SPEEDUP, path = null, kind = '') => {
        segments.push({ label, duration, from: copyState(state), to: copyState(to), path, speedup, step: index, source, kind });
        state = copyState(to);
    };
    // Joint-space move, the short way round each joint within its limits.
    const move = (label, theta, extra = {}, kind = 'move') => {
        const to = { ...copyState(state), ...extra, theta: theta.slice() };
        const turn = Math.max(...theta.map((value, i) => Math.abs(value - state.theta[i])));
        push(label, Math.max(1.5, peak * turn / jointRate), to, ARM_SPEEDUP, null, kind);
    };
    // The same with the spacewalker aboard, through `points` (joint-linear between them): at an even pace for the rider.
    const carry = (label, points, kind) => {
        const path = [points[0].slice()], lengths = [0], probe = copyState(state);
        for (let k = 1; k < points.length; k++) {
            const a = points[k - 1], b = points[k], parts = Math.max(1, Math.ceil(Math.max(...b.map((value, i) => Math.abs(value - a[i]))) / crewStep));
            for (let n = 1; n <= parts; n++) path.push(a.map((value, i) => lerp(value, b[i], n / parts)));
        }
        let before = crewFrame(probe);
        for (let k = 1; k < path.length; k++) {
            probe.theta = path[k];
            const at = crewFrame(probe), turn = Math.max(...path[k].map((value, i) => Math.abs(value - path[k - 1][i])));
            lengths.push(lengths[k - 1] + Math.hypot(at[12] - before[12], at[13] - before[13], at[14] - before[14]) + crewTurn * turn);
            before = at;
        }
        push(label, Math.max(2, peak * lengths.at(-1) / crewRate), { ...copyState(state), theta: path.at(-1).slice() }, ARM_SPEEDUP, path, kind);
        segments.at(-1).lengths = lengths;
    };
    const aboard = () => state.crew.on === 'tip';
    // The move to a stand-off pose, left out when the arm already stands there (a planned route took it there).
    const standOff = (label, theta) => { if (Math.max(...theta.map((value, i) => Math.abs(value - state.theta[i]))) > 1e-3) move(label, theta, {}, 'standoff'); };
    // Solve for the tip frame `target` from `guess`, noting how far off the answer stays.
    const solve = (target, guess, label) => {
        const result = reach(tipBodyFor(target), guess, baseFrame(state), { prefer: guess });
        if (result.positionError > .005 || result.orientationError > .005) problem ||= label + ': ' + result.positionError.toFixed(3) + ' m off';
        return result.theta;
    };
    // A straight run of the tip from its frame now to `target`, solved in short steps.
    const straight = (label, target, extra = {}, kind = 'approach') => {
        const from = tipFrame(state), steps = 10, path = [state.theta.slice()];
        let guess = state.theta;
        for (let k = 1; k <= steps; k++) {
            const t = k / steps, frame = from.map((value, i) => i >= 12 && i <= 14 ? lerp(value, target[i], t) : t < 1 ? value : target[i]);
            guess = solve(k === steps ? target : frame, guess, label); path.push(guess.slice());
        }
        const length = Math.hypot(target[12] - from[12], target[13] - from[13], target[14] - from[14]);
        push(label, Math.max(1.5, peak * length / approachRate), { ...copyState(state), ...extra, theta: path[steps] }, ARM_SPEEDUP, path, kind);
    };
    const via = degrees => degrees ? degrees.map(value => value * toRadians) : state.theta;
    for (const step of steps) {
        const label = step.label || '';
        source = step.source ?? index;
        if (step.home) {
            // Back to the parked pose (the base and end it uses must already be the parked ones): roll and yaw joints the
            // short way round, within their travel; pitch joints to the parked angles themselves (a pitch joint taken
            // the short way could fold the booms through each other, the elbow from -155 to -224 degrees).
            if (state.mbs !== REST.mbs) push(label, Math.max(2, peak * Math.abs(REST.mbs - state.mbs) / rideRate), { ...copyState(state), mbs: REST.mbs }, RIDE_SPEEDUP, null, 'ride');
            move(label, REST.theta.map((value, i) => PITCH.has(i) ? value : withinTravel(state.theta[i] + wrap(value - state.theta[i]))), { dextre: { ...state.dextre, roll: state.dextre.on === 'tip' ? state.dextre.roll : 0 } });
        } else if (step.move) { const theta = step.move.map(value => value * toRadians); if (aboard()) carry(label, [state.theta, theta], 'move'); else move(label, theta); }
        else if (step.path && aboard()) carry(label, [state.theta, ...step.path.slice(1)], 'path');
        else if (step.path) {
            const path = step.path.map(theta => theta.slice()); path[0] = state.theta.slice();
            // How far along the path each point stands (the turn of the joint that turns most), so the arm keeps an
            // even pace whatever the spacing of the points.
            const lengths = [0];
            for (let k = 1; k < path.length; k++) lengths.push(lengths[k - 1] + Math.max(...path[k].map((value, i) => Math.abs(value - path[k - 1][i]))));
            push(label, Math.max(1.5, peak * lengths.at(-1) / jointRate), { ...copyState(state), theta: path.at(-1).slice() }, ARM_SPEEDUP, path.length > 1 ? path : null, 'path');
            if (path.length > 1) segments.at(-1).lengths = lengths;
        }
        else if (step.reach) {
            // Stand off along the fixture's normal, approach, close the snare.
            const target = fixtureFrame(step.reach, state), standoff = step.standoff ?? 1;
            standOff(label, solve(outAlong(target, standoff), via(step.via), label));
            straight(label, target);
            // A free-flying vehicle is the arm's once the snare has closed; a berthed one stays on its port.
            const caught = onCargo(step.reach) && state.cargo.on === 'free' ? { cargo: { on: 'tip', range: 0 } } : {};
            push(label, 1.5, { ...copyState(state), tip: step.reach, tipSnare: 1, ...caught }, ARM_SPEEDUP, null, 'snare');
        } else if (step.walk) {
            // The tip's fixture becomes the base; the old base's snare opens and that end backs away.
            const old = state.base;
            state = { ...copyState(state), base: state.tip, end: state.end === 'A' ? 'B' : 'A', theta: reverse(state.theta), tip: old, tipSnare: 1 };
            push(label, 1.5, { ...copyState(state), tipSnare: 0 }, ARM_SPEEDUP, null, 'snare');
            straight(label, outAlong(fixtureFrame(old, state), step.standoff ?? 1), { tip: null }, 'backoff');
        } else if (step.release) {
            // A vehicle held away from its port flies free where it is let go.
            const held = state.tip, freed = onCargo(held) && state.cargo.on === 'tip' ? { cargo: { on: 'free', range: 0 } } : {};
            push(label, 1.5, { ...copyState(state), tipSnare: 0, ...freed }, ARM_SPEEDUP, null, 'snare');
            straight(label, outAlong(fixtureFrame(held, state), step.standoff ?? 1), { tip: null }, 'backoff');
        } else if (step.take) {
            // The arm holds Dextre by its head; Dextre lets go of its fixture and is lifted straight off it.
            const from = fixtureFrame(state.dextre.on, state), lift = step.lift ?? 1;
            state = { ...copyState(state), dextre: { ...state.dextre, on: 'tip' } };
            const target = tipFrame(state); target[12] += from[0] * lift; target[13] += from[1] * lift; target[14] += from[2] * lift;
            straight(label, target, {}, 'lift');
        } else if (step.stow) {
            // Dextre back onto a fixture: stand off, approach, Dextre latches on; the arm then lets go of its head.
            const target = tipFrameForDextreOn(step.stow, state), normal = fixtureFrame(step.stow, state), standoff = step.standoff ?? 1;
            const before = target.slice(); before[12] += normal[0] * standoff; before[13] += normal[1] * standoff; before[14] += normal[2] * standoff;
            standOff(label, solve(before, via(step.via), label));
            straight(label, target);
            push(label, 1.5, { ...copyState(state), dextre: { ...state.dextre, on: step.stow } }, ARM_SPEEDUP, null, 'snare');
        } else if (step.arrive) {
            // The vehicle comes up the nadir and holds at its capture point.
            state = { ...copyState(state), cargo: { on: 'free', range: CARGO_FAR } };
            push(label, step.arrive, { ...copyState(state), cargo: { on: 'free', range: 0 } }, CARGO_SPEEDUP, null, 'arrive');
        } else if (step.berth) {
            // The held vehicle to under its port, straight up onto it, then the port's bolts take it.
            straight(label, cargoFixtureAt(CARGO_READY), {}, 'carry');
            straight(label, cargoFixtureAt([0, 0, 0]), {}, 'carry');
            push(label, 2, { ...copyState(state), cargo: { on: 'berth', range: 0 } }, ARM_SPEEDUP, null, 'latch');
        } else if (step.unberth) {
            // The port lets go of the vehicle the arm holds; straight down, then out to where it is let go.
            push(label, 2, { ...copyState(state), cargo: { on: 'tip', range: 0 } }, ARM_SPEEDUP, null, 'latch');
            straight(label, cargoFixtureAt(CARGO_READY), {}, 'carry');
            straight(label, cargoFixtureAt(CARGO_CAPTURE), {}, 'carry');
        } else if (step.depart) push(label, step.depart, { ...copyState(state), cargo: { on: 'away', range: CARGO_FAR } }, CARGO_SPEEDUP, null, 'depart');
        else if (step.roll !== undefined) {
            const roll = step.roll * toRadians;
            push(label, Math.max(1.5, peak * Math.abs(roll - state.dextre.roll) / jointRate), { ...copyState(state), dextre: { ...state.dextre, roll } }, ARM_SPEEDUP, null, 'roll');
        } else if (step.ride !== undefined) push(label, Math.max(2, peak * Math.abs(step.ride - state.mbs) / rideRate), { ...copyState(state), mbs: step.ride }, RIDE_SPEEDUP, null, 'ride');
        else if (step.seat !== undefined) push(label, 2, { ...copyState(state), crew: { ...state.crew, seat: step.seat ? 1 : 0 } }, ARM_SPEEDUP, null, 'fit');
        else if (step.board) push(label, step.board, { ...copyState(state), crew: { ...state.crew, on: 'tip' } }, ARM_SPEEDUP, null, 'board');
        else if (step.work) push(label, step.work, copyState(state), ARM_SPEEDUP, null, 'work');
        else if (step.alight) push(label, step.alight, { ...copyState(state), crew: { ...state.crew, on: 'inside' } }, ARM_SPEEDUP, null, 'alight');
        else if (step.wait) push(label, step.wait, copyState(state), ARM_SPEEDUP, null, 'wait');
        index++;
    }
    return { segments, duration: segments.reduce((sum, segment) => sum + segment.duration, 0), problem, end: state };
}
// The state `time` seconds into a plan, and the segment playing.
export function sample(plan, time) {
    let t = time;
    for (const segment of plan.segments) {
        if (t > segment.duration) { t -= segment.duration; continue; }
        const s = ease(Math.max(0, t / segment.duration)), state = copyState(segment.from), { from, to } = segment;
        if (segment.path) {
            // A planned path by how far along it is (`lengths`); an approach's points are already evenly spaced along
            // the tip's straight line.
            const { path, lengths } = segment;
            let k, f;
            if (lengths) {
                const w = s * lengths.at(-1);
                let lo = 0, hi = lengths.length - 1;
                while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (lengths[mid] <= w) lo = mid; else hi = mid; }
                k = Math.min(path.length - 2, lo);
                const span = lengths[k + 1] - lengths[k];
                f = span > 1e-12 ? Math.min(1, (w - lengths[k]) / span) : 0;
            } else { const at = s * (path.length - 1); k = Math.min(path.length - 2, Math.floor(at)); f = at - k; }
            state.theta = path[k].map((value, i) => lerp(value, path[k + 1][i], f));
        } else state.theta = from.theta.map((value, i) => lerp(value, to.theta[i], s));
        state.mbs = lerp(from.mbs, to.mbs, s); state.tipSnare = lerp(from.tipSnare, to.tipSnare, s);
        state.dextre.roll = lerp(from.dextre.roll, to.dextre.roll, s);
        // The vehicle slows all the way in (and gathers speed all the way out): fast far off, a crawl at the station.
        const u = Math.min(1, Math.max(0, t / segment.duration));
        state.cargo.range = segment.kind === 'arrive' ? CARGO_FAR * (1 - u) ** 3 : segment.kind === 'depart' ? CARGO_FAR * u ** 3 : lerp(from.cargo.range, to.cargo.range, s);
        state.crew.seat = lerp(from.crew.seat, to.crew.seat, s);
        // Discrete changes (the base, what the tip holds, where Dextre and the spacewalker are) take effect at the
        // segment's end.
        if (s >= 1) { Object.assign(state, { base: to.base, end: to.end, tip: to.tip }); state.dextre.on = to.dextre.on; state.cargo.on = to.cargo.on; state.crew.on = to.crew.on; }
        else if (CREW_ACTS.has(segment.kind)) { state.crew.act = segment.kind; state.crew.u = u; }
        return { state, segment };
    }
    const last = plan.segments.at(-1);
    return { state: copyState(plan.end), segment: last || null, done: true };
}
