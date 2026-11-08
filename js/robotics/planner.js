// Canadarm2's routes: from one state (pose.js) to another with the same base, end, held fixture and Dextre stand, as
// steps for motion.js: joint paths, Dextre's roll, the Mobile Transporter's ride. Every moment of a route keeps the arm
// (and Dextre, when the arm carries it) REQUIRED clear of the station, the base, Dextre and itself, after the fields'
// margin (collision.js), and MOVING more from the bodies that move on their own (arrays, radiators, antennas, Dragon)
// as they stood when asked.
//
// A joint path is tried straight, then through poses known to be clear (the parked pose, the poses of the pre-built
// operations, poses earlier routes went through: `memory`), then searched for with RRT-Connect (Kuffner and LaValle,
// 2000) in joint space, the distance between two poses taken as how far any sphere can move between them. The path
// found is shortened by random shortcuts, its corners cut (Chaikin) and its points spaced evenly. Every piece is
// checked continuously: over a move no sphere travels further than Σ REACH_j |Δθ_j| (plus the ride, plus Dextre's roll
// times its reach), so a step no longer than the gap it starts from cannot pass through anything (conservative
// advancement).
//
// To ride, the arm first takes a pose that stays clear along the whole stretch of rail (one it stands in, the parked
// pose, the ride poses found offline, or one an earlier ride used), the transporter rides, and the arm unfolds at the
// far end. The cheap checks come first for every such pose (straight moves, then through one known pose); a search
// then grows toward all of them at once, so the one easiest to reach is found and a hard one does not use up the
// route's work. A start or goal the fields find too close already (a telemetered pose this model does not quite fit) is let
// off: near it the gap asked for falls, rising again as the arm moves away. With `adapt`, a goal too close is moved to
// the nearest clear pose instead (an operation's pose that a solar wing has turned into). The planners are generators
// that yield often, so the worker can take a cancel between slices.
import { LIMIT } from './kinematics.js?v=44ee3feec6';
import { compile } from './motion.js?v=9a2f0b5c59';
import { REST, copyState } from './pose.js?v=8d51479503';
import { CARRY_REACH, DEXTRE_REACH, REACH, clearance } from './collision.js?v=6f3c17fd88';
import { RIDE_POSES, sequences } from './sequences.js?v=28a949284e';

export const REQUIRED = .05, MOVING = .25;
const TURN = 2 * Math.PI, PITCH = new Set([2, 3, 4]), toRadians = Math.PI / 180;
// RRT-Connect: the longest step (m any sphere moves), how often a tree grows toward the other, how much work at most;
// and how many clearance readings one route may take (about two seconds in the worker) before it gives up.
const STEP = 3, GOAL_BIAS = .15, NODES = 5000, BUDGET = 100000;
// How fast the gap asked for comes back when a start or goal is let off (per metre a sphere moves).
const RECOVER = .25;
// Poses known to be clear somewhere: the parked pose and every pose the pre-built operations move through.
const KNOWN = [REST.theta, ...sequences.flatMap(sequence => sequence.steps.filter(step => step.move).map(step => step.move.map(v => v * toRadians)))];

const lerp = (a, b, s) => a.map((value, j) => value + (b[j] - value) * s);
const same = (a, b) => a.every((value, j) => Math.abs(value - b[j]) < 1e-9);
const distanceWith = reach => (a, b) => { let sum = 0; for (let j = 0; j < 7; j++) sum += reach[j] * Math.abs(a[j] - b[j]); return sum; };
// The distance between two poses: how far any sphere can move between them (m).
export const distance = distanceWith(REACH);
// `theta` with each roll and yaw joint a whole turn either way, within the limits; pitch joints keep the values given
// (so a telemetered pose is reached exactly as read). Combinations nearest `near` first, at most `count`.
function representations(theta, near, count = 4) {
    const options = theta.map((value, j) => PITCH.has(j) ? [value] : [value, value - TURN, value + TURN].filter(v => Math.abs(v) <= LIMIT + 1e-9));
    let list = [[]];
    for (const choices of options) list = list.flatMap(prefix => choices.map(v => [...prefix, v]));
    return list.sort((a, b) => distance(a, near) - distance(b, near)).slice(0, count);
}
function random(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const seedOf = states => Math.round(1e6 * states.reduce((sum, s) => sum * 1.3 + s.theta.reduce((a, v) => a + v, 0) + s.mbs, 0));

// How clear a route keeps: as asked (STRICT), or, when no route keeps that, just clear of everything after the fields'
// margin (RELAXED: a telemetered pose a wing nearly touches in this model is still reached by a route, not a jump).
const STRICT = { required: REQUIRED, moving: MOVING }, RELAXED = { required: 0, moving: 0 };
// Everything one route needs: the gap in a pose, continuous checks along moves, rides and rolls.
function planning(world, context, rand, { required, moving } = STRICT) {
    const carrying = context.dextre.on === 'tip', reach = carrying ? CARRY_REACH : REACH, metric = distanceWith(reach);
    const probe = copyState(context), options = { moving, dextre: carrying };
    // `limit`: the readings this route may take, lowered for a while to keep part of them for what comes after.
    const p = { evaluations: 0, limit: BUDGET, letOff: [], metric, rand, spent: () => p.evaluations > p.limit };
    p.gap = (theta, mbs, roll) => {
        p.evaluations++;
        probe.theta = theta; probe.mbs = mbs; probe.dextre.roll = roll;
        return clearance(world, probe, options) - required;
    };
    p.allowance = theta => { let a = 0; for (const { at, slack } of p.letOff) a = Math.max(a, slack - RECOVER * metric(theta, at)); return a; };
    p.letOffFor = (theta, mbs, roll) => { const g = p.gap(theta, mbs, roll); return g < 0 ? [{ at: theta, slack: .02 - g }] : []; };
    p.free = (theta, mbs, roll) => p.gap(theta, mbs, roll) + p.allowance(theta) >= 0;
    // Conservative advancement along a straight joint move a → b at a fixed ride position and roll.
    p.moveClear = (a, b, mbs, roll) => {
        const bound = metric(a, b) * (p.letOff.length ? 1 + RECOVER : 1);
        if (bound < 1e-9) return p.free(a, mbs, roll);
        for (let s = 0; ;) {
            const theta = s === 0 ? a : s === 1 ? b : lerp(a, b, s), g = p.gap(theta, mbs, roll) + p.allowance(theta);
            if (g < 0) return false;
            if (s === 1) return true;
            const ds = g / bound;
            if (ds < 2e-4) return false;
            s = Math.min(1, s + ds);
        }
    };
    // The same along the rail (every sphere moves with the base: a metre a metre) or through Dextre's roll.
    p.sweepClear = (theta, mbs0, mbs1, roll0, roll1) => {
        const bound = Math.abs(mbs1 - mbs0) + DEXTRE_REACH * Math.abs(roll1 - roll0);
        if (bound < 1e-9) return p.free(theta, mbs0, roll0);
        for (let s = 0; ;) {
            const g = p.gap(theta, mbs0 + (mbs1 - mbs0) * s, roll0 + (roll1 - roll0) * s) + p.allowance(theta);
            if (g < 0) return false;
            if (s === 1) return true;
            const ds = g / bound;
            if (ds < 2e-4) return false;
            s = Math.min(1, s + ds);
        }
    };
    // The clear pose nearest `goal` (random tries in growing neighbourhoods), or null.
    p.nearestClear = function* (goal, mbs, roll) {
        for (const scale of [.03, .06, .12, .25, .5, .8]) {
            let best = null, bestDistance = Infinity;
            for (let k = 0; k < 60; k++) {
                if (k % 10 === 0) yield;
                const theta = goal.map((v, j) => Math.max(-LIMIT, Math.min(LIMIT, v + (rand() * 2 - 1) * scale)));
                const d = metric(theta, goal);
                if (d < bestDistance && p.gap(theta, mbs, roll) >= 0) { best = theta; bestDistance = d; }
            }
            if (best) return best;
        }
        return null;
    };
    return p;
}

// RRT-Connect from any of `starts` to any of `goals` (each tree grows from all its roots at once, so the easiest pair
// is found first); a list of poses from one start to one goal, or null.
function* connect(p, starts, goals, mbs, roll) {
    let A = { nodes: starts.slice(), parent: starts.map(() => -1), root: 'start' }, B = { nodes: goals.slice(), parent: goals.map(() => -1), root: 'goal' };
    const nearest = (tree, q) => { let best = 0, bestDistance = Infinity; for (let k = 0; k < tree.nodes.length; k++) { const d = p.metric(tree.nodes[k], q); if (d < bestDistance) { bestDistance = d; best = k; } } return best; };
    const extend = (tree, target) => {
        const k = nearest(tree, target), from = tree.nodes[k], d = p.metric(from, target);
        const q = d > STEP ? lerp(from, target, STEP / d) : target;
        if (!p.moveClear(from, q, mbs, roll)) return -1;
        tree.nodes.push(q); tree.parent.push(k); return tree.nodes.length - 1;
    };
    const trace = (tree, k) => { const list = []; for (; k >= 0; k = tree.parent[k]) list.push(tree.nodes[k]); return list; };
    while (A.nodes.length + B.nodes.length < NODES && !p.spent()) {
        yield;
        const target = p.rand() < GOAL_BIAS ? B.nodes[Math.floor(p.rand() * B.nodes.length)] : Array.from({ length: 7 }, () => (p.rand() * 2 - 1) * LIMIT);
        const k = extend(A, target);
        if (k >= 0) {
            const q = A.nodes[k];
            for (let n = 0; n < 200; n++) {
                const m = extend(B, q);
                if (m < 0) break;
                if (p.metric(B.nodes[m], q) < 1e-9) {
                    const a = trace(A, k).reverse(), b = trace(B, m).slice(1);
                    return A.root === 'start' ? [...a, ...b] : [...b.reverse(), ...a.reverse()];
                }
            }
        }
        [A, B] = [B, A];
    }
    return null;
}
// Random shortcuts between two points anywhere along the path (each a straight move, checked).
function* shorten(p, path, mbs, roll, tries = 120) {
    for (let t = 0; t < tries && path.length > 2; t++) {
        yield;
        const lengths = [0];
        for (let k = 1; k < path.length; k++) lengths.push(lengths[k - 1] + p.metric(path[k - 1], path[k]));
        const total = lengths.at(-1); if (total < 1e-6) break;
        let u = p.rand() * total, v = p.rand() * total; if (u > v) [u, v] = [v, u];
        const at = w => { let k = 1; while (k < path.length - 1 && lengths[k] < w) k++; return [k, lerp(path[k - 1], path[k], (w - lengths[k - 1]) / Math.max(1e-12, lengths[k] - lengths[k - 1]))]; };
        const [i, a] = at(u), [j, b] = at(v);
        if (j <= i) continue;
        if (p.moveClear(a, b, mbs, roll)) path.splice(i, j - i, a, b);
    }
    return path.filter((theta, k) => k === 0 || !same(theta, path[k - 1]));
}
// Corners cut a quarter of the way along each side, three rounds, where the cut is clear (Chaikin).
function* round(p, path, mbs, roll) {
    for (let pass = 0; pass < 3 && path.length > 2; pass++) {
        const out = [path[0]];
        for (let k = 1; k < path.length - 1; k++) {
            yield;
            const a = lerp(path[k], path[k - 1], .25), b = lerp(path[k], path[k + 1], .25);
            if (p.moveClear(a, b, mbs, roll)) out.push(a, b); else out.push(path[k]);
        }
        out.push(path.at(-1)); path = out;
    }
    return path;
}
// Evenly spaced points (every 1.5 degrees of the joint that turns most), each corner kept, so every piece stays on a
// piece already checked.
function spaced(path) {
    const out = [path[0]], step = 1.5 * toRadians;
    for (let k = 1; k < path.length; k++) {
        const turn = Math.max(...path[k].map((v, j) => Math.abs(v - path[k - 1][j]))), n = Math.max(1, Math.ceil(turn / step));
        for (let i = 1; i <= n; i++) out.push(lerp(path[k - 1], path[k], i / n));
    }
    return out;
}
// A clear joint path a → b (b's roll and yaw joints a turn either way) at a fixed ride position and roll, or null.
// `level` 0: straight; 1: straight or through one known pose; 2: or searched for.
function* armPath(p, a, b, mbs, roll, level, memory) {
    if (same(a, b)) return [a];
    p.letOff = p.letOffFor(a, mbs, roll);
    const goals = representations(b, a);
    p.letOff.push(...goals.flatMap(g => p.letOffFor(g, mbs, roll)));
    for (const g of goals) { yield; if (p.moveClear(a, g, mbs, roll)) return [a, g]; }
    if (level < 1) return null;
    const vias = [...KNOWN, ...memory.map(entry => entry.theta)].flatMap(v => representations(v, a, 2))
        .map(v => ({ v, cost: p.metric(a, v) + p.metric(v, goals[0]) })).sort((x, y) => x.cost - y.cost).slice(0, 24);
    for (const { v } of vias) {
        yield;
        if (!p.free(v, mbs, roll) || !p.moveClear(a, v, mbs, roll)) continue;
        for (const g of goals) if (p.moveClear(v, g, mbs, roll)) return [a, v, g];
    }
    if (level < 2) return null;
    return yield* connect(p, [a], goals, mbs, roll);
}
// A path made short, smooth and even, and the poses it turns at (worth remembering).
function* finish(p, path, mbs, roll) {
    const short = yield* shorten(p, path, mbs, roll);
    return { path: spaced(yield* round(p, short, mbs, roll)), corners: short.slice(1, -1) };
}

// Plans `from` → `to`; returns { ok, steps, learned, end, adapted, relaxed, reason, evaluations }. `memory`: poses
// earlier routes went through ([{ theta, ride, base, end, dextre }], radians; those for another base, end or Dextre
// stand are left out); `adapt`: move a goal that is not clear to the nearest clear pose; `stay`: a ride or roll ends in
// the pose it was made in (whatever the goal's joints); `labels` for the steps. When no route keeps the clearance asked
// for, one that only keeps clear is looked for (`relaxed`).
export function* route(world, from, to, options = {}) {
    if (from.base !== to.base || from.end !== to.end || from.tip !== to.tip || from.dextre.on !== to.dextre.on) return { ok: false, reason: 'base, end, held fixture or Dextre differ' };
    if (from.tip && from.tip !== 'dextre-pdgf') return { ok: false, reason: 'the tip holds a fixture' };
    const strict = yield* attempt(world, from, to, options, STRICT);
    if (strict.ok) return strict;
    const relaxed = yield* attempt(world, from, to, options, RELAXED);
    return relaxed.ok ? { ...relaxed, relaxed: true, evaluations: strict.evaluations + relaxed.evaluations } : { ...strict, evaluations: strict.evaluations + relaxed.evaluations };
}
function* attempt(world, from, to, { memory = [], adapt = false, labels = {}, stay = false }, margins) {
    const p = planning(world, from, random(seedOf([from, to])), margins);
    // Memory from routes with the same base, end and Dextre stand; what this one learns is kept with those.
    const context = { base: from.base, end: from.end, dextre: from.dextre.on };
    memory = memory.filter(entry => entry.base === undefined || (entry.base === context.base && entry.end === context.end && entry.dextre === context.dextre));
    let goal = to.theta, adapted = false;
    const rides = to.mbs !== from.mbs, rolls = to.dextre.roll !== from.dextre.roll, keep = stay && (rides || rolls);
    if (adapt && !keep && p.gap(goal, to.mbs, to.dextre.roll) < 0) {
        const near = yield* p.nearestClear(goal, to.mbs, to.dextre.roll);
        if (near) { goal = near; adapted = true; }
    }
    const label = { out: 'Arm to a pose clear for the ride', roll: 'Dextre turns its body', ride: 'Mobile Transporter to ' + to.mbs.toFixed(1) + ' m', in: 'Arm to its pose', ...labels };
    const failed = () => ({ ok: false, reason: 'no clear route found', evaluations: p.evaluations });
    // The route through a ride pose `c`: its leg out (at the start's place on the rail and roll), the roll and the
    // ride, its leg back; each leg smoothed under its own let-off.
    function* assemble(c) {
        const steps = [], learned = [], end = c.out ? c.out.at(-1) : from.theta;
        if (c.out && c.out.length > 1) { p.letOff = c.outLetOff; const { path, corners } = yield* finish(p, c.out, from.mbs, from.dextre.roll); steps.push({ path, label: label.out }); learned.push(...corners.map(theta => ({ theta }))); }
        if (rolls) steps.push({ roll: to.dextre.roll / toRadians, label: label.roll });
        if (rides) { steps.push({ ride: to.mbs, label: label.ride }); learned.push({ theta: end, ride: true }); }
        if (c.back.length > 1) { p.letOff = c.backLetOff; const { path, corners } = yield* finish(p, c.back, to.mbs, to.dextre.roll); steps.push({ path, label: label.in }); learned.push(...corners.map(theta => ({ theta }))); }
        return { ok: true, steps, learned: learned.map(entry => ({ ...entry, ...context })), end: c.back.at(-1), adapted, evaluations: p.evaluations };
    }
    // The leg back from where `c`'s leg out ends; with `stay` the arm keeps the pose it rode in.
    function* legBack(c, level) {
        const end = c.out.at(-1);
        c.back = keep ? [end] : yield* armPath(p, end, goal, to.mbs, to.dextre.roll, level, memory);
        c.backLetOff = p.letOff;
        return !!c.back;
    }
    // A search that may take at most `share` of the readings left.
    function* within(share, search) {
        const limit = p.limit;
        p.limit = Math.min(limit, p.evaluations + (limit - p.evaluations) * share);
        try { return yield* search; } finally { p.limit = limit; }
    }

    // An arm move only: straight, through a known pose, or searched for.
    if (!rides && !rolls) {
        for (const level of [1, 2]) {
            const back = yield* armPath(p, from.theta, goal, to.mbs, to.dextre.roll, level, memory);
            if (back) return yield* assemble({ out: null, back, backLetOff: p.letOff });
        }
        return failed();
    }
    // The poses to ride (or roll) in that stay clear the whole way, cheapest first: no move at all, the goal, then
    // known clear poses.
    const ridePoses = from.base === REST.base && from.end === REST.end ? RIDE_POSES.map(v => v.map(x => x * toRadians)) : [];
    const clear = [];
    for (const pose of [from.theta, goal, ...ridePoses, REST.theta, ...memory.filter(entry => entry.ride).map(entry => entry.theta)]
        .flatMap(v => representations(v, from.theta, 1)).filter((v, k, list) => list.findIndex(w => same(w, v)) === k)
        .sort((x, y) => p.metric(from.theta, x) - p.metric(from.theta, y) + (keep ? 0 : p.metric(x, goal) - p.metric(y, goal)))) {
        yield;
        if (p.spent()) break;
        p.letOff = [];
        if (rolls && !p.sweepClear(pose, from.mbs, from.mbs, from.dextre.roll, to.dextre.roll)) continue;
        if (rides && !p.sweepClear(pose, from.mbs, to.mbs, to.dextre.roll, to.dextre.roll)) continue;
        clear.push({ pose, out: null, back: null });
    }
    // Each leg straight for every ride pose, then straight or through one known pose.
    for (const level of [0, 1]) {
        for (const c of clear) {
            yield;
            if (p.spent()) break;
            if (!c.out) {
                c.out = yield* armPath(p, from.theta, c.pose, from.mbs, from.dextre.roll, level, memory);
                if (!c.out) continue;
                c.outLetOff = p.letOff;
            }
            if (yield* legBack(c, level)) return yield* assemble(c);
        }
    }
    // Searched for. A leg back from the ride poses reached (from all of them at once), with half what is left when
    // other ride poses are still to be tried.
    const reached = clear.filter(c => c.out), rest = clear.filter(c => !c.out);
    if (reached.length && !keep && !p.spent()) {
        const starts = reached.map(c => c.out.at(-1)), goals = representations(goal, starts[0]);
        p.letOff = [...starts, ...goals].flatMap(theta => p.letOffFor(theta, to.mbs, to.dextre.roll));
        const path = yield* within(rest.length ? .5 : 1, connect(p, starts, goals, to.mbs, to.dextre.roll));
        if (path) {
            const c = reached.find(c => same(c.out.at(-1), path[0]));
            c.back = path; c.backLetOff = p.letOff;
            return yield* assemble(c);
        }
    }
    // A leg out toward all the others at once: the one easiest to reach is reached first (so a hard one does not use up
    // the route's work), then its leg back is looked for; if there is none, the search goes on toward the rest.
    while (rest.length && !p.spent()) {
        yield;
        const goals = rest.flatMap(c => representations(c.pose, from.theta, 2).map(theta => ({ c, theta })));
        p.letOff = p.letOffFor(from.theta, from.mbs, from.dextre.roll);
        const path = yield* connect(p, [from.theta], goals.map(g => g.theta), from.mbs, from.dextre.roll);
        if (!path) break;
        const c = goals.find(g => same(g.theta, path.at(-1))).c;
        c.out = path; c.outLetOff = p.letOff;
        if ((yield* legBack(c, 1)) || (yield* within(.5, legBack(c, 2)))) return yield* assemble(c);
        rest.splice(rest.indexOf(c), 1);
    }
    return failed();
}

// A pre-built operation (sequences.js) planned for the station as it stands: each free move (home, move, ride, and the
// move to a reach's or a stow's stand-off pose) becomes a route, a home or move pose moved clear if a solar wing or a
// radiator has turned into it; approaches, latching, walking, Dextre's roll and waits keep their pre-built form.
// Returns { ok, steps, learned, adapted, rough, relaxed, log } with `steps` for motion.js from `from`, each tagged with
// the operation's step it comes from (`source`); `relaxed` counts the moves only a relaxed route was found for,
// `rough` those no route was found for at all (kept as built), `log` each route's outcome.
export function* planSteps(world, from, steps, { memory = [] } = {}) {
    let state = copyState(from);
    const out = [], learned = [], log = [];
    let adapted = 0, rough = 0, relaxed = 0, evaluations = 0;
    for (let k = 0; k < steps.length; k++) {
        const step = steps[k];
        yield;
        let free = null, approach = null;
        if (step.home || step.move || step.ride !== undefined) free = step;
        else if (step.reach || step.stow) {
            // The stand-off pose, as motion.js finds it from the step's seed; the approach then starts from where the
            // arm stands (its seed the pose reached, so motion.js adds no move).
            const standoff = compile([step], state).segments.find(segment => segment.kind === 'standoff');
            approach = step;
            if (standoff) free = { target: standoff.to.theta };
        }
        if (!free) {
            const rest = approach ? { ...approach, via: state.theta.map(v => v / toRadians), source: k } : { ...step, source: k };
            out.push(rest); state = compile([rest], state).end; continue;
        }
        const target = free.target ? { ...copyState(state), theta: free.target } : compile([free], state).end;
        const labels = { out: step.label, roll: step.label, ride: step.label, in: step.label };
        // A ride step keeps the arm in the pose it rides in; the next move unfolds it.
        const result = yield* route(world, state, target, { memory: memory.concat(learned), adapt: !approach, stay: step.ride !== undefined, labels });
        evaluations += result.evaluations || 0;
        log.push({ step: k, ok: result.ok, adapted: !!result.adapted, relaxed: !!result.relaxed, evaluations: result.evaluations || 0, reason: result.reason || '' });
        if (result.ok) {
            out.push(...result.steps.map(s => ({ ...s, source: k, relaxed: !!result.relaxed })));
            learned.push(...result.learned);
            if (result.adapted) adapted++;
            if (result.relaxed) relaxed++;
            state = { ...copyState(target), theta: result.end.slice() };
        } else {
            rough++;
            out.push({ ...(free.target ? { path: [state.theta, free.target] } : free), label: step.label, source: k, rough: true });
            state = target;
        }
        if (approach) {
            const rest = { ...approach, via: state.theta.map(v => v / toRadians), source: k };
            out.push(rest); state = compile([rest], state).end;
        }
    }
    return { ok: true, steps: out, learned, adapted, rough, relaxed, evaluations, end: state, log };
}

// A planner run to the end at once (tools).
export function runNow(job) { let step; do step = job.next(); while (!step.done); return step.value; }
