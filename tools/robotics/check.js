// Study for run.mjs: the smallest clearance (m) of each pre-built sequence (sampled every degree), of the parked pose,
// of the ISS Live pose of 7 November 2026, and of the base with Dextre and the parked arm all along the rails.
const out = { triangles: clear.triangles, sequences: {} };
for (const sequence of S.sequences) {
    const plan = MO.compile(sequence.steps, P.REST), worst = planner.clearanceOf(plan, 0, 1);
    out.sequences[sequence.id] = { seconds: +plan.duration.toFixed(1), problem: plan.problem, clearance: worst.clearance, where: [worst.what, worst.body, worst.part, worst.label, worst.t].filter(v => v !== undefined && v !== null).join(' · ') };
}
const short = r => ({ clearance: r.clearance, where: [r.what, r.body, r.part].filter(v => v !== undefined && v !== null).join(' · '), min: r.min });
out.parked = short(clear.test(P.REST));
const reading = T.liveRobotics({ ssrmsBase: 11, ssrmsOperatingBase: 5, ssrmsTip: 0, SR: 200, SY: 200, SP: -90, EP: -155, WP: -105, WY: -110, WR: 5, spdmBase: 8, spdmRoll: 60.03, mtPosition: 2169.16, mtWorksite: 1 });
out.live7November = short(clear.test({ ...P.copyState(P.REST), base: reading.arm.base, end: reading.arm.end, theta: reading.arm.theta, mbs: reading.mbs.x, dextre: reading.dextre }));
// Where along the rails the parked arm or Dextre comes closer than 0.2 m to something.
out.railsTight = [];
for (let x = -22.4; x <= 22.41; x += .5) { const r = clear.test({ ...P.copyState(P.REST), mbs: x }); if (r.clearance < .2) out.railsTight.push(x.toFixed(1) + ' m: ' + r.clearance + ' ' + r.what + ' ' + (r.part || '')); }
return out;
