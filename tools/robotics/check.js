// Study for run.mjs: the smallest clearance (m) of each pre-built sequence (sampled every degree), of the parked pose,
// of the ISS Live pose of 7 November 2026, and of the base with Dextre and the parked arm all along the rails. A
// sequence runs from the place of the cargo vehicle it asks for; one that asks for none runs twice, the vehicle away
// and berthed. Moves are joined straight in joint space here (the page plans its own routes round what is in the way).
const out = { triangles: clear.triangles, sequences: {} };
const berthed = { ...P.copyState(P.REST), cargo: { on: 'berth', range: 0 } };
for (const sequence of S.sequences) for (const [suffix, start] of sequence.cargo ? [['', sequence.cargo === 'berth' ? berthed : P.REST]] : [['', P.REST], [' (vehicle berthed)', berthed]]) {
    const plan = MO.compile(sequence.steps, start), worst = planner.clearanceOf(plan, 0, 1);
    out.sequences[sequence.id + suffix] = { seconds: +plan.duration.toFixed(1), problem: plan.problem, clearance: worst.clearance, where: [worst.what, worst.body, worst.part, worst.label, worst.t].filter(v => v !== undefined && v !== null).join(' · '), min: worst.min };
}
const short = r => ({ clearance: r.clearance, where: [r.what, r.body, r.part].filter(v => v !== undefined && v !== null).join(' · '), min: r.min });
out.parked = short(clear.test(P.REST));
const reading = T.liveRobotics({ ssrmsBase: 11, ssrmsOperatingBase: 5, ssrmsTip: 0, SR: 200, SY: 200, SP: -90, EP: -155, WP: -105, WY: -110, WR: 5, spdmBase: 8, spdmRoll: 60.03, mtPosition: 2169.16, mtWorksite: 1 });
out.live7November = short(clear.test({ ...P.copyState(P.REST), base: reading.arm.base, end: reading.arm.end, theta: reading.arm.theta, mbs: reading.mbs.x, dextre: reading.dextre }));
// Where along the rails the parked arm or Dextre comes closer than 0.2 m to something.
out.railsTight = [];
for (let x = -22.4; x <= 22.41; x += .5) { const r = clear.test({ ...P.copyState(P.REST), mbs: x }); if (r.clearance < .2) out.railsTight.push(x.toFixed(1) + ' m: ' + r.clearance + ' ' + r.what + ' ' + (r.part || '')); }
return out;
