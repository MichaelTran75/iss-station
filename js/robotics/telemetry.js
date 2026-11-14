// ISS Live robotics telemetry (NASA's ISSLIVE feed, js/orbit/live.js): Canadarm2's base and joint angles, its tip end
// effector, Dextre's base and body roll, and where the Mobile Transporter stands. Item names and codes after ISS Mimic
// and canadarm-live (bfeist). Two readings: 7 November 2026, the arm on MBS PDGF 3 by LEE B, SR..WR 200.0, 200.0,
// -90.0, -155.0, -105.0, -110.0, 5.0 degrees, tip released; Dextre on MBS PDGF 2 by its body LEE, body roll 60.0; the
// transporter at worksite 1, 2169.16 cm. 14 November 2026, the same base and Dextre, SR..WR 245.0, 52.0, -77.0, -115.0,
// 0, 0, 0; the transporter at worksite 4, 287.02 cm.
//
// What the angles are measured from is not published. This page reads them as they come: with all seven at zero the
// arm lies straight, as kinematics.js lays it out (roll axes along the booms, the yaw and pitch axes across them, as
// canadarm-live draws its model), each angle positive by the right hand about its axis. Under that reading both poses
// stand clear: on 14 November the arm stands up from the base over the truss, elbow high. Reading yaw and pitch a
// quarter turn off (an earlier guess from the SSRMS papers' zero) folds the 14 November pose through itself by
// 0.28 m, so no route could reach it. Of the 64 sign choices with no offset, 6 keep both poses clear (the shoulder and
// wrist yaw signs stay open); all positive is the plainest. Inferred, not official.
import { fixtureByCode } from './fixtures.js';
import { LIMIT } from './kinematics.js';

export const roboticsItems = {
    CSASSRMS002: 'ssrmsBase', CSASSRMS003: 'ssrmsOperatingBase', CSASSRMS011: 'ssrmsTip',
    CSASSRMS004: 'SR', CSASSRMS005: 'SY', CSASSRMS006: 'SP', CSASSRMS007: 'EP', CSASSRMS008: 'WP', CSASSRMS009: 'WY', CSASSRMS010: 'WR',
    CSASPDM0002: 'spdmBase', CSASPDM0020: 'spdmRoll',
    CSAMT000001: 'mtPosition', CSAMT000002: 'mtWorksite'
};
export const JOINT_NAMES = ['SR', 'SY', 'SP', 'EP', 'WP', 'WY', 'WR'];
// The model's chain angle = sign × (reading + offset), in degrees.
export const convention = { sign: [1, 1, 1, 1, 1, 1, 1], offset: [0, 0, 0, 0, 0, 0, 0] };
const toRadians = Math.PI / 180;
// An angle past a joint's travel (±270°) is the same angle a turn back: the joint cannot stand there.
const withinTravel = angle => angle > LIMIT ? angle - 2 * Math.PI : angle < -LIMIT ? angle + 2 * Math.PI : angle;
export const fromReadings = readings => readings.map((value, i) => withinTravel(convention.sign[i] * (value + convention.offset[i]) * toRadians));
const wrap = degrees => ((degrees % 360) + 540) % 360 - 180;
export const toReadings = theta => theta.map((value, i) => wrap(value / toRadians * convention.sign[i] - convention.offset[i]));
export const tipStates = ['released', 'captive', 'captured'];

// What the latest readings say, in the model's terms; a part not heard (or at a place this page does not know) is null.
export function liveRobotics(values) {
    const result = { arm: null, dextre: null, mbs: null };
    const base = fixtureByCode(values.ssrmsBase), readings = JOINT_NAMES.map(name => values[name]);
    if (base && base.host !== 'dextre' && readings.every(Number.isFinite) && Number.isFinite(values.ssrmsOperatingBase)) {
        result.arm = { base: base.id, end: values.ssrmsOperatingBase === 5 ? 'B' : 'A', theta: fromReadings(readings), readings, tip: tipStates[values.ssrmsTip] || 'released' };
    }
    const dextreBase = values.spdmBase === 19 ? 'tip' : fixtureByCode(values.spdmBase)?.id;
    if (dextreBase && dextreBase !== 'dextre-pdgf') result.dextre = { on: dextreBase, roll: Number.isFinite(values.spdmRoll) ? values.spdmRoll * toRadians : 0 };
    // The transporter's position read as centimetres from the truss's centre, starboard positive (worksite 1, in S3,
    // read 2169 cm; S1 ends 21 m out): inferred.
    if (Number.isFinite(values.mtPosition)) result.mbs = { x: values.mtPosition / 100, worksite: Number.isFinite(values.mtWorksite) && values.mtWorksite > 0 ? 'WS' + values.mtWorksite : null };
    return result;
}
