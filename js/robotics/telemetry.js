// ISS Live robotics telemetry (NASA's ISSLIVE feed, js/orbit/live.js): Canadarm2's base and joint angles, its tip end
// effector, Dextre's base and body roll, and where the Mobile Transporter stands. Item names and codes after ISS Mimic
// and canadarm-live (bfeist), read on 7 November 2026: the arm on MBS PDGF 3 by LEE B, SR..WR 200.0, 200.0, -90.0,
// -155.0, -105.0, -110.0, 5.0 degrees, tip released; Dextre on MBS PDGF 2 by its body LEE, body roll 60.0; the
// transporter at worksite 1, 2169.16 cm.
//
// What the angles are measured from is not published. This page reads them as the SSRMS papers do (Xu 2013, Qin 2023):
// with all seven at zero the booms lie in line across both end effectors' axes, the shoulder and wrist yaw axes along
// the booms and the pitch axes parallel to the roll axes; each angle counts positive by the right hand about its axis
// as kinematics.js lays it out. In this model's terms: yaw and pitch offset by a quarter turn (the table below). Under
// that reading the 7 November pose stands folded above the base at worksite 1, 0.69 m clear of the station
// (tools/robotics/check.js); but so do about a quarter of the 2048 readings that differ from it in sign or quarter
// turn, so the choice rests on the papers, not on that fit. Inferred, not official.
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
export const convention = { sign: [1, 1, 1, 1, 1, 1, 1], offset: [0, 90, 90, 0, 90, -90, 0] };
const toRadians = Math.PI / 180;
// An angle past a joint's travel (±270°) is the same angle a turn back: the joint cannot stand there (the reading of 200
// for the shoulder yaw on 7 November is 290 in the model's terms, so -70).
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
