// Robotics in the scene: Canadarm2's eight bodies, the Mobile Base System's carriage, Dextre and the cargo vehicle the
// arm captures (js/parts/cygnus.js), set each frame from a state (pose.js). The vehicle's place is part of the state and
// only operations change it: the parked and live poses keep it where it is. So are the foot restraint an operation fits
// to the free end and the spacewalker on it (js/figures/rider.js draws the figure from `crewView`). The state comes
// from the parked pose (REST), ISS Live telemetry (telemetry.js), or an operation
// (sequences.js) playing.
//
// Nothing cuts. A small change of the parked or live pose glides (critically damped, as the solar arrays do when ISS
// Live switches on); a big one (ISS Live switched on or off, the way back after an operation) is a route the robotics
// worker plans around the station, the solar arrays and radiators where they stand now, Dragon and the arm itself
// (map.js, planner.js): the transporter rides along the rails with the arm in a pose clear all the way, and the arm
// unfolds at the far end. The arm holds still the moment it takes to plan one. An operation is planned the same way
// before it plays: its free moves become routes, a pose a solar wing has turned into is moved clear, and the
// approaches, latching and walking keep their pre-built form. Poses the routes went through are remembered in this
// browser (localStorage) and tried first next time.
//
// While anything plays, the arm looks two seconds ahead against the bodies that move on their own: if one is turning
// into its way, the plan eases to a stop; a free move is planned again from there, and a pre-built approach waits
// until the way is clear. Stop eases an operation to a halt as soon as the arm is back on its own base with nothing
// in hand (it plays on until then), and a route takes it to the parked or live pose. Only a change the arm cannot
// move through (a new base or end, Dextre on another fixture) cuts, as does a goal no clear route reaches and anything
// with Scene animation off.
// Operations pause with Scene animation.
import * as THREE from 'three';
import { parts } from '../core/station.js';
import { live, watchItems } from '../orbit/live.js';
import { closeSnare } from './hardware.js';
import { JOINTS, LIMIT, TIP, apply, bodyFrames, multiply } from './kinematics.js';
import { MBS_REACH } from './layout.js';
import { setCarriage } from './mobile-base.js';
import { compile, sample } from './motion.js';
import { REST, baseFrame, bodyRoll, cargoBody, copyState, crewFrame, dextreBody, tipFrame } from './pose.js';
import { sequences } from './sequences.js';
import { liveRobotics, roboticsItems } from './telemetry.js';
import { clearance, tightest } from './collision.js';
import { buildMap, currentWorld, map, requestPlan } from './map.js';
import { REQUIRED } from './planner.js';

watchItems(roboticsItems);
const { carriage, bodies, snares, seat } = parts.get('robotics').group.userData.robotics;
const roboticsEntry = parts.get('robotics'), dextreGroup = parts.get('dextre').group, dextreBodyGroup = dextreGroup.userData.body;
const cargoEntry = parts.get('cygnus'), cargoGroup = cargoEntry.group.userData.body;
// The vehicle's silhouette for the operations menu, in its own frame: four lines along the hull and each array's rim
// (the arrays lie across the axis, js/parts/cygnus.js).
const CARGO_OUTLINE = [...[[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].map(([x, z]) => [[x, 0, z], [x, -7.9, z]]), ...[-3.42, 3.42].map(x => [[x - 1.85, -7.45, 0], [x, -7.45, 1.85], [x + 1.85, -7.45, 0], [x, -7.45, -1.85], [x - 1.85, -7.45, 0]])];
// The spacewalker the arm carries, for js/figures/rider.js: where the foot restraint holds the hips (`at`, a station
// matrix: x to the left, y to the head, z ahead), whether the rider is on it, and the act under way with its progress.
export const crewView = { seat: 0, on: 'inside', act: '', u: 0, at: new Array(16).fill(0) };
let shown = copyState(REST), speed = { theta: new Array(7).fill(0), mbs: 0, roll: 0, snare: 0 }, followLive = false, applied = '';
// What plays: a compiled plan (motion.js), its clock and a time scale that eases to 0 to stop it. `run.kind` is
// 'route' or 'sequence'; `run.stop` why it is stopping ('user', 'goal', 'conflict', 'action').
let run = null;
// A plan being made in the worker: { kind: 'route' | 'sequence', goal, sequence, cancel }.
let request = null;
// An operation asked for while a route has to stop first; a Stop asked for while an operation is planned again.
let queued = null, stopLater = false;
// The last thing worth saying about the arm: why it waits, what went wrong.
let note = '';

const matrix = new THREE.Matrix4(), scale = new THREE.Vector3();
const place = (object, m) => matrix.fromArray(m).decompose(object.position, object.quaternion, scale);
// Sets the scene from a state; false when nothing changed.
function show(state) {
    const key = [state.base, state.end, state.tip, state.dextre.on, state.cargo.on, state.cargo.range.toFixed(3), state.crew.seat.toFixed(3), state.crew.on, state.crew.act || '', (state.crew.u || 0).toFixed(4), state.mbs.toFixed(4), state.tipSnare.toFixed(3), state.dextre.roll.toFixed(4), ...state.theta.map(value => value.toFixed(5))].join('|');
    if (key === applied) return false;
    applied = key;
    setCarriage(carriage, state.mbs);
    const frames = bodyFrames(state.theta, baseFrame(state), state.end);
    frames.forEach((m, k) => place(bodies[k], m));
    const baseSnare = state.end === 'A' ? 0 : 1;
    closeSnare(snares[baseSnare], 1); closeSnare(snares[1 - baseSnare], state.tipSnare);
    place(dextreGroup, multiply(dextreBody(state), bodyRoll(-state.dextre.roll)));
    dextreBodyGroup.rotation.y = state.dextre.roll;
    // The label (and the operations menu) points at the elbow.
    roboticsEntry.anchor.fromArray(apply(frames[3], JOINTS[3].point));
    // What the operations menu keeps clear of: the arm from joint to joint and Dextre's body, in station coordinates.
    const dextreAt = dextreBody(state);
    roboticsEntry.outline = [[apply(frames[0], [0, 0, 0]), ...JOINTS.map((joint, k) => apply(frames[k], joint.point)), apply(frames[7], TIP)], [apply(dextreAt, [0, 0, 0]), apply(dextreAt, [0, 3.5, 0])]];
    // The foot restraint grows out of the free end as it is fitted; its rider stands along the outline while aboard.
    const crewAt = crewFrame(state);
    seat.visible = state.crew.seat > .001;
    if (seat.visible) { place(seat, tipFrame(state)); seat.scale.setScalar(state.crew.seat); }
    Object.assign(crewView, { seat: state.crew.seat, on: state.crew.on, act: state.crew.act || '', u: state.crew.u || 0 });
    for (let i = 0; i < 16; i++) crewView.at[i] = crewAt[i];
    if (state.crew.on === 'tip' || state.crew.act) roboticsEntry.outline.push([apply(crewAt, [0, -1.0, 0]), apply(crewAt, [0, .8, 0])]);
    // The cargo vehicle: away it is not drawn (nor picked, labelled or offered in the component list).
    const cargoAt = cargoBody(state), away = state.cargo.on === 'away';
    place(cargoGroup, cargoAt); cargoGroup.visible = !away; cargoEntry.absent = away;
    cargoEntry.anchor.fromArray(apply(cargoAt, [0, -3.6, 0]));
    if (!away && state.cargo.range < 20) for (const polyline of CARGO_OUTLINE) roboticsEntry.outline.push(polyline.map(point => apply(cargoAt, point)));
    return true;
}
show(shown);

// The pose ISS Live gives, filled in from the parked pose where it says nothing (or names a place this page lacks).
export function liveGoal() {
    const reading = liveRobotics(live.values), goal = copyState(REST);
    if (reading.mbs) goal.mbs = Math.max(-MBS_REACH, Math.min(MBS_REACH, reading.mbs.x));
    if (reading.arm) Object.assign(goal, { base: reading.arm.base, end: reading.arm.end, theta: reading.arm.theta.slice(), tip: null, tipSnare: reading.arm.tip === 'released' ? 0 : 1 });
    if (reading.dextre) goal.dextre = { on: reading.dextre.on, roll: reading.dextre.roll };
    return { goal, reading };
}
const wrap = angle => angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI)), PITCH = new Set([2, 3, 4]);
// One step of a critically damped spring: an offset from the goal and its rate, `dt` later (as js/ui/controller.js).
const glideRate = 4 / 3;
function settle(offset, rate, dt) {
    const push = rate + glideRate * offset, decay = Math.exp(-glideRate * dt);
    return [(offset + push * dt) * decay, (rate - glideRate * push * dt) * decay];
}
// A glide is only safe over a short way: a joint path between two distant poses, with the base riding along the truss
// at the same time, can sweep the booms through modules. Small changes (telemetry following a real move) glide; a big
// one is a route.
const far = (goal, from) => Math.abs(goal.mbs - from.mbs) > .5 || Math.abs(goal.dextre.roll - from.dextre.roll) > .35 || goal.theta.some((value, i) => Math.abs(PITCH.has(i) ? value - from.theta[i] : wrap(value - from.theta[i])) > .35);
const sameParts = (a, b) => a.base === b.base && a.end === b.end && a.dextre.on === b.dextre.on;
const still = () => { speed = { theta: new Array(7).fill(0), mbs: 0, roll: 0, snare: 0 }; };
// A joint past its travel (±270°) stands as it would a turn back; plans start from angles within it.
const withinTravel = angle => angle > LIMIT ? angle - 2 * Math.PI : angle < -LIMIT ? angle + 2 * Math.PI : angle;
const planFrom = () => { shown.theta = shown.theta.map(withinTravel); return copyState(shown); };
function glideTo(goal, dt) {
    const step = (value, target, rate) => { const [offset, next] = settle(value - target, rate, dt); return Math.abs(offset) < 1e-6 && Math.abs(next) < 1e-6 ? [target, 0] : [target + offset, next]; };
    // Roll and yaw joints turn the short way round to an angle (a reading of 200 degrees and one of -160 are the same
    // pose); the pitch joints go the way their readings say, so the elbow never folds the booms through each other.
    for (let i = 0; i < 7; i++) [shown.theta[i], speed.theta[i]] = step(shown.theta[i], PITCH.has(i) ? goal.theta[i] : shown.theta[i] + wrap(goal.theta[i] - shown.theta[i]), speed.theta[i]);
    [shown.mbs, speed.mbs] = step(shown.mbs, goal.mbs, speed.mbs);
    [shown.dextre.roll, speed.roll] = step(shown.dextre.roll, goal.dextre.roll, speed.roll);
    [shown.tipSnare, speed.snare] = step(shown.tipSnare, goal.tipSnare, speed.snare);
    shown.tip = goal.tip;
    // A foot restraint left on the free end (an operation stopped before its rider boarded) comes off here.
    if (shown.crew.seat > 0) shown.crew.seat = Math.max(0, shown.crew.seat - dt / 2);
}
// A vehicle neither berthed nor away belongs to an operation under way: a cut sends it away. The foot restraint and
// its rider belong to one too: a cut takes them off.
const cut = goal => { shown = copyState(goal); if (shown.cargo.on !== 'berth') shown.cargo = { on: 'away', range: 0 }; shown.crew = { ...REST.crew }; still(); };
// The parked and live poses say nothing of the vehicle or of the foot restraint: a goal keeps them as they are.
const withCargo = goal => ({ ...goal, cargo: { ...shown.cargo }, crew: { seat: shown.crew.seat, on: shown.crew.on } });

// What the routes learn: poses they went through, kept in this browser (at most 30, the latest first) and offered to
// the planner as places worth trying.
const MEMORY = 'iss.robotics.routes';
let memory = [];
try { const saved = JSON.parse(localStorage.getItem(MEMORY) || '[]'); if (Array.isArray(saved)) memory = saved.filter(entry => Array.isArray(entry?.theta) && entry.theta.length === 7 && entry.theta.every(Number.isFinite)); } catch { memory = []; }
function learn(result) {
    if (!result?.learned?.length) return;
    const now = Date.now();
    for (const entry of result.learned) {
        const theta = entry.theta.map(value => Math.round(value * 1e4) / 1e4);
        const known = memory.find(m => m.base === entry.base && m.end === entry.end && m.dextre === entry.dextre && !!m.ride === !!entry.ride && !!m.crew === !!entry.crew && m.theta.every((value, j) => Math.abs(value - theta[j]) < .02));
        if (known) known.at = now; else memory.push({ theta, ride: !!entry.ride, base: entry.base, end: entry.end, dextre: entry.dextre, crew: !!entry.crew, at: now });
    }
    memory = memory.sort((a, b) => b.at - a.at).slice(0, 30);
    try { localStorage.setItem(MEMORY, JSON.stringify(memory)); } catch { /* private browsing: kept for this visit */ }
}

const forgetRequest = () => { request?.cancel(); request = null; };
function startRun(kind, plan, extra = {}) {
    run = { kind, plan, clock: 0, scale: 1, target: 1, stop: '', watch: 0, wait: 0, ...extra };
    if (plan.problem) console.warn('Robotics:', plan.problem);
}
// A route from where the arm stands to `goal`; it holds still until the plan comes.
function routeTo(goal, replans = 0) {
    still();
    const from = planFrom(), job = requestPlan({ from, to: copyState(goal), memory });
    const mine = request = { kind: 'route', goal: copyState(goal), cancel: job.cancel };
    job.promise.then(result => {
        if (request !== mine) return;
        request = null;
        if (result.reason === 'cancelled') return;
        learn(result);
        note = result.ok ? '' : 'No clear route found: set at once';
        // Without a clear route the arm is set in the goal at once: a straight move would sweep it through the station,
        // Dextre or itself.
        if (!result.ok) { console.warn('Robotics route:', result.reason); cut(goal); return; }
        const steps = result.steps;
        startRun('route', compile(steps, from), { goal: copyState(goal), replans, watched: replans < 4, loose: result.relaxed ? new Set(steps.map((step, k) => k)) : new Set() });
    });
}
// An operation planned from where the arm stands, from step `first` on (after a stop for a moving part, `home` and
// `replans` carry over). A new one starts from the parked pose, cut to, if the arm stands on another base or end, or
// Dextre on another fixture: its pre-built steps start there.
function planSequence(sequence, first = 0, home = null, replans = 0) {
    still();
    if (first === 0 && (!sameParts(shown, REST) || shown.tip)) cut(withCargo(REST));
    // A foot restraint an earlier operation left fitted stays only for an operation that uses it.
    if (first === 0 && !sequence.steps.some(step => 'seat' in step)) shown.crew = { ...REST.crew };
    const from = planFrom(), steps = sequence.steps.slice(first);
    home ||= { base: from.base, end: from.end, dextre: { on: from.dextre.on } };
    const job = requestPlan({ from, steps, memory });
    // A new operation still being planned has not moved the arm, so Stop drops it; one planned again mid-way stops
    // once it is settled.
    const mine = request = { kind: 'sequence', sequence, cancel: job.cancel, replan: replans > 0 };
    job.promise.then(result => {
        if (request !== mine) return;
        request = null;
        if (result.reason === 'cancelled') return;
        learn(result);
        if (!result.ok) console.warn('Robotics operation:', result.reason);
        if (result.rough) note = result.rough + (result.rough > 1 ? ' moves' : ' move') + ' without a clear route';
        else if (!replans) note = '';
        if (result.log?.some(entry => !entry.ok || entry.relaxed)) console.info('Robotics operation', sequence.id, 'from step', first, result.log);
        // A move planned again and again (a wing turning with the arm) plays on unwatched after the fourth time. Moves
        // with only a relaxed route are watched for real contact; those with none are not watched.
        const planned = result.ok ? result.steps : [];
        const loose = new Set(planned.filter(step => step.relaxed).map(step => step.source)), rough = new Set(planned.filter(step => step.rough).map(step => step.source));
        startRun('sequence', compile(result.ok ? result.steps : steps, from), { sequence, first, home, replans, watched: replans < 4, stopAsked: !!stopLater, loose, rough });
        stopLater = false;
    });
}

// The look-ahead: the arm over the next two seconds of the plan against the bodies that move on their own, where they
// stand now. A conflict is a reading below REQUIRED (below contact, for a move with only a relaxed route) that is also
// worse than now (a start already too close, as some telemetered poses are, is moved away from, not stopped at).
const AHEAD = 2, EVERY = .1, CONTACT = -.03;
const watchOptions = { fixed: false, self: false, seats: 'all', detail: true };
function conflictAhead() {
    const world = currentWorld();
    if (!world) return null;
    const now = sample(run.plan, run.clock).state, at = (state, carrying) => clearance(world, state, { ...watchOptions, dextre: carrying });
    const current = at(now, now.dextre.on === 'tip');
    for (let ahead = .25; ahead <= AHEAD; ahead += .25) {
        const { state, segment, done } = sample(run.plan, run.clock + ahead);
        if (done) break;
        if (run.rough?.has(segment.source)) continue;
        const gap = at(state, state.dextre.on === 'tip');
        if (gap < (run.loose?.has(segment.source) ? CONTACT : REQUIRED) && gap < current - .01) return { what: tightest.what, in: ahead };
    }
    return null;
}
const FREE = new Set(['move', 'path', 'ride', 'standoff']);
const named = what => ({ array: 'Solar array', radiator: 'Radiator', antenna: 'Antenna', dragon: 'Dragon', station: 'Window shutter' })[what.replace(/^(dextre|crew)-/, '')] || 'Moving part';
// The arm back on its own base with nothing in hand and nobody on the foot restraint: an operation may stop here.
const settled = state => run && sameParts(state, run.home) && !state.tip && state.crew.on === 'inside' && !state.crew.act;

function advanceRun(dt, goal) {
    // The time scale eases to its target in about half a second.
    run.scale = run.target > run.scale ? Math.min(run.target, run.scale + dt / .5) : Math.max(run.target, run.scale - dt / .5);
    run.clock += dt * run.scale;
    const { state, segment, done } = sample(run.plan, run.clock);
    shown = state;
    if (done) {
        const finished = run; run = null;
        if (finished.stop === 'action' && queued) { const next = queued; queued = null; planSequence(next); }
        return;
    }
    // A route whose goal has moved far (ISS Live switched again) stops and plans anew from where it stopped.
    if (run.kind === 'route' && !run.stop && (!sameParts(goal, run.goal) || far(goal, run.goal))) stopRun('goal');
    // Stop asked for: as soon as the arm is settled.
    if (run.kind === 'sequence' && run.stopAsked && !run.stop && settled(state)) stopRun('user');
    // Waiting for a moving part to clear a pre-built step: resume once the next seconds are clear.
    if (run.stop === 'conflict' && run.waiting) {
        if ((run.wait -= dt) <= 0) {
            run.wait = .5;
            if (!conflictAhead()) { run.stop = ''; run.waiting = false; run.target = 1; note = ''; if (run.stopAsked && settled(shown)) stopRun('user'); }
        }
        return;
    }
    if (run.watched && !run.stop && (run.watch -= dt) <= 0) {
        run.watch = EVERY;
        const conflict = conflictAhead();
        if (conflict) { stopRun('conflict'); note = named(conflict.what) + ' ahead: stopping'; run.segment = segment; run.blocker = conflict.what; }
    }
    if (run.stop && run.scale === 0) resume(run, goal);
}
function stopRun(why) { run.stop = why; run.target = 0; }
// What follows a stop: a free move planned again from here, a pre-built step waiting, a new route, the next operation.
function resume(stopped, goal) {
    const { kind, stop, sequence, first = 0, segment, home, replans = 0, blocker = '' } = stopped;
    if (stop === 'conflict' && kind === 'sequence') {
        if (segment && FREE.has(segment.kind)) {
            note = named(blocker) + ' in the way: planning again';
            run = null; stopLater = !!stopped.stopAsked;
            planSequence(sequence, first + segment.source, home, replans + 1);
        } else { run.waiting = true; run.wait = .5; note = named(blocker) + ' in the way: waiting'; }
        return;
    }
    run = null;
    if (stop === 'action' && queued) { const next = queued; queued = null; planSequence(next); }
    else if (stop === 'conflict' && sameParts(goal, shown)) { note = named(blocker) + ' in the way: planning again'; routeTo(goal, replans + 1); }
    // 'user' and 'goal': the idle logic plans a route from here.
}
function idle(goal, dt) {
    if (sameParts(goal, shown) && !far(goal, shown)) { glideTo(goal, dt); return; }
    if (!sameParts(goal, shown) || (shown.tip && shown.tip !== 'dextre-pdgf') || shown.crew.on === 'tip') { cut(goal); return; }
    routeTo(goal);
}

// Every frame (js/ui/controller.js advance): true while something moved.
export function updateRobotics(delta, motion) {
    const dt = Math.min(delta, .1), goal = withCargo(followLive ? liveGoal().goal : REST);
    if (!motion) {
        // Operations and routes pause where they are; with nothing playing the pose is set at once.
        if (!run) { if (request?.kind === 'route') forgetRequest(); if (!request) cut(goal); }
        return show(shown);
    }
    if (run) advanceRun(dt, goal);
    else if (request) {
        // While a route is being planned the arm holds still; a goal that moves far from it asks again.
        if (request.kind === 'route' && (!sameParts(goal, request.goal) || far(goal, request.goal))) { forgetRequest(); idle(goal, dt); }
    } else idle(goal, dt);
    return show(shown);
}
// Pre-built operations, planned from where the arm stands for the station as it stands; one at a time. One that names
// where the cargo vehicle must be (`cargo`) plays only then.
export function playSequence(id) {
    const sequence = sequences.find(entry => entry.id === id);
    if (!sequence || (run?.kind === 'sequence') || request?.kind === 'sequence' || (sequence.cargo && sequence.cargo !== shown.cargo.on)) return null;
    note = ''; stopLater = false;
    if (run) { queued = sequence; stopRun('action'); return sequence; }
    forgetRequest();
    planSequence(sequence);
    return sequence;
}
export function stopSequence() {
    queued = null;
    // Planned again after a stop for a moving part: the stop carries over to the new plan.
    if (request?.kind === 'sequence') { if (request.replan) stopLater = true; else forgetRequest(); return; }
    if (run?.kind !== 'sequence') return;
    run.stopAsked = true;
    if (settled(shown)) { run.waiting = false; stopRun('user'); }
}

export function setRoboticsLive(on) { followLive = on; }
// The map is built a few seconds after the page opens, while it idles.
setTimeout(() => (window.requestIdleCallback || (callback => setTimeout(callback, 0)))(() => buildMap(), { timeout: 4000 }), 3000);

// For the inspector and the operations menu: what is shown and why.
export function roboticsStatus() {
    const playingSequence = run?.kind === 'sequence' ? run.sequence : request?.kind === 'sequence' ? request.sequence : queued;
    const at = run ? sample(run.plan, run.clock) : null;
    let phase = 'idle';
    if (request) phase = map.state === 'ready' ? 'planning' : 'mapping';
    else if (run?.waiting) phase = 'waiting';
    else if (run?.stop) phase = 'stopping';
    else if (run) phase = run.kind;
    return {
        state: shown, phase, sequence: playingSequence || null, step: at?.segment || null, clock: run?.clock ?? 0, duration: run?.plan.duration ?? 0,
        progress: run ? Math.min(1, run.clock / Math.max(run.plan.duration, 1e-6)) : 0, stopping: !!run?.stopAsked || run?.stop === 'user', note,
        map: { state: map.state, progress: map.progress }, live: followLive ? liveGoal().reading : null, followLive, remembered: memory.length
    };
}
