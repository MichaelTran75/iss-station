// A robotics state, and where it puts things: the arm's base frame and bodies, the tip's grapple frame, Dextre's body.
// Plain frames (kinematics.js), no scene, so the sequence compiler (motion.js) and the scene (index.js) agree.
//
// State: `base` the fixture the operating base holds and `end` which end that is ('A' or 'B'); `theta` the seven chain
// angles from that end (radians); `tip` the fixture the free end holds (or null) and `tipSnare` how far its snare is
// closed (0 to 1); `mbs` the Mobile Base System's centre along the truss (m); `dextre.on` the fixture Dextre stands
// on, or 'tip' while the arm holds it by the fixture on its head, and `dextre.roll` its body roll (radians).
import { FLIP, chain, identity, invert, multiply, screw } from './kinematics.js?v=44ee3feec6';
import { seat } from './fixtures.js?v=e8c0b95aaf';
import { MBS_HOME } from './layout.js?v=b4fe2c8612';

const radians = degrees => degrees.map(value => value * Math.PI / 180);
// Parked as first drawn: on the base's starboard fixture in a high arch in front of the starboard truss, held by LEE B
// as on 7 November 2026 (seen end for end, the arm looks the same).
export const REST = Object.freeze({ base: 'mbs-pdgf3', end: 'B', theta: radians([-108.1, 0, -68, 136, -68, 0, 108.1]), tip: null, tipSnare: 0, mbs: MBS_HOME, dextre: { on: 'mbs-pdgf2', roll: 0 } });
export const copyState = state => ({ ...state, theta: state.theta.slice(), dextre: { ...state.dextre } });

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
export function dextreBody(state) {
    if (state.dextre.on === 'tip') return multiply(tipFrame(state), FROM_HEAD);
    return multiply(multiply(seat(state.dextre.on, { mbs: state.mbs }), ON_FIXTURE), bodyRoll(state.dextre.roll));
}
// The grapple frame of fixture `id` for this state (Dextre's head fixture moves with Dextre).
export const fixtureFrame = (id, state) => seat(id, { mbs: state.mbs, dextre: id === 'dextre-pdgf' ? dextreBody(state) : null });
// The tip frame that sets Dextre's lower end effector on fixture `id`, while the arm holds it by its head.
export const tipFrameForDextreOn = (id, state) => multiply(multiply(multiply(seat(id, { mbs: state.mbs }), ON_FIXTURE), bodyRoll(state.dextre.roll)), HEAD);
