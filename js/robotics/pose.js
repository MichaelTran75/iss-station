// A robotics state, and where it puts things: the arm's base frame and bodies, the tip's grapple frame, Dextre's body.
// Plain frames (kinematics.js), no scene, so the sequence compiler (motion.js) and the scene (index.js) agree.
//
// State: `base` the fixture the operating base holds and `end` which end that is ('A' or 'B'); `theta` the seven chain
// angles from that end (radians); `tip` the fixture the free end holds (or null) and `tipSnare` how far its snare is
// closed (0 to 1); `mbs` the Mobile Base System's centre along the truss (m); `dextre.on` the fixture Dextre stands
// on, or 'tip' while the arm holds it by the fixture on its head, and `dextre.roll` its body roll (radians);
// `cargo.on` where the visiting cargo vehicle is ('away' out of sight, 'free' flying below the station, 'tip' held by
// the arm, 'berth' on the port) and `cargo.range` how far below its capture point it still is while free (m);
// `crew.seat` how far the foot restraint is fitted to the free end (0 to 1) and `crew.on` where the spacewalker who
// rides it is ('inside' the airlock or 'tip', feet in the restraint). A state sampled from a plan may also carry
// `crew.act` and `crew.u` (motion.js); a copy drops them.
import { FLIP, chain, frame, identity, invert, multiply, screw } from './kinematics.js?v=44ee3feec6';
import { fixtures, seat } from './fixtures.js?v=00abdcef15';
import { MBS_HOME } from './layout.js?v=b4fe2c8612';

const radians = degrees => degrees.map(value => value * Math.PI / 180);
// Parked as first drawn: on the base's starboard fixture in a high arch in front of the starboard truss, held by LEE B
// as on 7 November 2026 (seen end for end, the arm looks the same).
export const REST = Object.freeze({ base: 'mbs-pdgf3', end: 'B', theta: radians([-108.1, 0, -68, 136, -68, 0, 108.1]), tip: null, tipSnare: 0, mbs: MBS_HOME, dextre: { on: 'mbs-pdgf2', roll: 0 }, cargo: Object.freeze({ on: 'away', range: 0 }), crew: Object.freeze({ seat: 0, on: 'inside' }) });
export const copyState = state => ({ ...state, theta: state.theta.slice(), dextre: { ...state.dextre }, cargo: { ...(state.cargo || REST.cargo) }, crew: { seat: (state.crew || REST.crew).seat, on: (state.crew || REST.crew).on } });

// Dextre on a fixture: its lower end effector's mouth on the grapple frame, +y out along the normal, shoulders (+x)
// along the clocking (fixtures.js frames have x out, z along the clocking).
const ON_FIXTURE = [0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1];
// The grapple frame of the fixture on Dextre's head, in its body's frame.
const HEAD = seat('dextre-pdgf', { dextre: identity() }), FROM_HEAD = invert(HEAD);
export const bodyRoll = roll => screw([0, 1, 0], [0, 0, 0], roll);

export const baseFrame = state => seat(state.base, { mbs: state.mbs });
export const armChain = state => chain(state.theta, baseFrame(state));
// The free end's grapple frame: matched to a fixture's, the tip holds it (and could stand on it as a base).
export const tipFrame = state => multiply(armChain(state)[7], FLIP);
// The spacewalker on the foot restraint, in the tip's frame: the body runs straight out from the free end, soles on the
// plate CREW_SOLE beyond the mouth and hips CREW_HIP beyond it. The body's own frame has its origin at the hips, x to
// the left, y to the head and z forward, in metres.
export const CREW_HIP = 1.31, CREW_SOLE = .30;
const ON_SEAT = frame([-CREW_HIP, 0, 0], [0, 1, 0], [-1, 0, 0], [0, 0, 1]);
export const crewFrame = state => multiply(tipFrame(state), ON_SEAT);
export function dextreBody(state) {
    if (state.dextre.on === 'tip') return multiply(tipFrame(state), FROM_HEAD);
    return multiply(multiply(seat(state.dextre.on, { mbs: state.mbs }), ON_FIXTURE), bodyRoll(state.dextre.roll));
}
// The cargo vehicle's body frame: origin on its berthing ring's face, +y through the hatch (toward the station), axes
// along the station's wherever it is. Berthed, the ring meets Unity's nadir port. It is captured CARGO_CAPTURE from
// there (below, forward and to starboard: straight below the port its fixture is out of the arm's reach from Destiny),
// carried to CARGO_READY under the port, then straight up. It comes and goes along the nadir, CARGO_FAR at most.
const CARGO_BERTH = [0, -2.53, 12];
export const CARGO_CAPTURE = [1, -3, -3], CARGO_READY = [0, -1.2, 0], CARGO_FAR = 180;
export const cargoFrame = (offset, range = 0) => frame([CARGO_BERTH[0] + offset[0], CARGO_BERTH[1] + offset[1] - range, CARGO_BERTH[2] + offset[2]], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const GRAPPLE = seat('cygnus-fgf', { cargo: identity() }), FROM_GRAPPLE = invert(GRAPPLE);
export function cargoBody(state) {
    const cargo = state.cargo || REST.cargo;
    if (cargo.on === 'tip') return multiply(tipFrame(state), FROM_GRAPPLE);
    return cargo.on === 'berth' ? cargoFrame([0, 0, 0]) : cargoFrame(CARGO_CAPTURE, cargo.on === 'away' ? CARGO_FAR : cargo.range);
}
// The tip frame that holds the vehicle `offset` from its berth.
export const cargoFixtureAt = offset => seat('cygnus-fgf', { cargo: cargoFrame(offset) });
// The grapple frame of fixture `id` for this state (the fixtures on Dextre and on the vehicle move with them).
export function fixtureFrame(id, state) {
    const host = fixtures.get(id).host;
    return seat(id, { mbs: state.mbs, dextre: host === 'dextre' ? dextreBody(state) : null, cargo: host === 'cargo' ? cargoBody(state) : null });
}
// The tip frame that sets Dextre's lower end effector on fixture `id`, while the arm holds it by its head.
export const tipFrameForDextreOn = (id, state) => multiply(multiply(multiply(seat(id, { mbs: state.mbs }), ON_FIXTURE), bodyRoll(state.dextre.roll)), HEAD);
