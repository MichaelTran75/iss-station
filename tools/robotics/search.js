// Study for run.mjs: search the three sequences' intermediate poses and seeds again (as on 8 November 2026), and print
// each as the steps to paste into js/robotics/sequences.js, with its smallest clearance and length.
const parked = P.REST.theta.map(v => Math.round(v * 1800 / Math.PI) / 10);
const toParked = { move: parked, label: 'Parked pose' }, home = { home: true, label: 'Parked on MBS PDGF 3' };
// Destiny's fixture is reached with the base 7.5 m out along S1: from its home it is too close to reach.
const walk = [
    { pick: home },
    { pick: { ride: 10, label: 'Mobile Transporter out along S1' } },
    { pick: { reach: 'lab-pdgf', label: 'Free end to the Destiny fixture' }, follow: [{ walk: true, label: 'Destiny fixture becomes the base' }, { wait: 2, label: 'Standing on Destiny' }] },
    { pick: { reach: 'mbs-pdgf3', label: 'Free end back to MBS PDGF 3' }, follow: [{ walk: true, label: 'MBS becomes the base again' }] },
    { pick: toParked },
    { pick: home }
];
// Dextre is carried at least 5 m from its fixture.
const seat = P.fixtureFrame('mbs-pdgf2', P.REST);
const away = state => { const m = P.dextreBody({ ...state, dextre: { on: 'tip', roll: 0 } }); return Math.hypot(m[12] - seat[12], m[13] - seat[13], m[14] - seat[14]) > 5; };
const dextre = [
    { pick: home },
    { pick: { reach: 'dextre-pdgf', label: 'Grapple Dextre\'s head fixture' }, follow: [{ take: true, label: 'Dextre lets go of MBS PDGF 2' }] },
    { pick: { pose: true, label: 'Dextre carried out' }, accept: away, follow: [{ roll: 60, label: 'Dextre turns its body' }, { wait: 2, label: 'At the worksite' }, { roll: 0, label: 'Dextre turns back' }] },
    { pick: { stow: 'mbs-pdgf2', label: 'Dextre back onto MBS PDGF 2' }, follow: [{ release: true, label: 'Let go of Dextre' }] },
    { pick: toParked },
    { pick: home }
];
// At worksite 1, the pose of 7 November 2026; the pitch joints keep their readings' sense, so the elbow does not fold
// the booms through each other on the way.
const reading = T.fromReadings([200, 200, -90, -155, -105, -110, 5]), near = planner.nearest(reading, P.REST.theta);
const seventh = near.map((v, i) => Math.round((i >= 2 && i <= 4 ? reading[i] : v) * 1800 / Math.PI) / 10);
const ride = [
    { pick: home },
    { pick: { ride: 21.69, label: 'Mobile Transporter to worksite 1 (S3)' } },
    { pick: { move: seventh, label: 'The pose of 7 November 2026' }, follow: [{ wait: 3, label: 'At worksite 1, as on 7 November 2026' }] },
    { pick: toParked },
    { pick: { ride: 2.5, label: 'Back above Destiny' } },
    { pick: home }
];
const out = {};
for (const [id, groups] of Object.entries({ walk, dextre, ride })) {
    const result = planner.plan(groups);
    out[id] = { seconds: result.duration, clearance: result.clearance, problem: result.problem, report: result.report, steps: result.steps.map(step => JSON.stringify(step)) };
}
return out;
