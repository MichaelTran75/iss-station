// Choreography search for js/robotics/sequences.js: a development tool, injected into the page by run.mjs after
// clearance.js.
//
// plan(groups) builds a sequence group by group. A group is { pick, follow }: `pick` is the step to choose a way for,
// `follow` the steps that come with it (a walk after a reach, say), checked together with it. For a reach or a stow,
// the inverse kinematics is solved from many random seeds (and from poses already passed through), and each solution's
// whole segment is checked; if none is clear, the move goes through one or two intermediate poses. A move, home or
// ride is tried straight, then through intermediate poses; { pose: true } picks a clear free pose (where Dextre is
// carried to), filtered by the group's `accept`. Every candidate is scored by its smallest clearance (enough at
// 0.3 m), then by its length. The result is the step list for sequences.js, with the poses in degrees.
window.roboticsPlanner = async clear => {
    const MO = await import('./js/robotics/motion.js'), P = await import('./js/robotics/pose.js'), K = await import('./js/robotics/kinematics.js');
    const degrees = r => r * 180 / Math.PI, TURN = 2 * Math.PI, LIMIT = 270 * Math.PI / 180, ENOUGH = .3;
    let seed = 12345; const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const randomPose = () => Array.from({ length: 7 }, () => random() * TURN - Math.PI);
    // The same pose with each joint turned by whole turns to lie nearest `near`, within the limits.
    const nearest = (theta, near) => theta.map((v, i) => { let best = v; for (const k of [-2, -1, 1, 2]) { const w = v + k * TURN; if (Math.abs(w) <= LIMIT && Math.abs(w - near[i]) < Math.abs(best - near[i])) best = w; } return best; });
    const toDegrees = theta => theta.map(v => Math.round(degrees(v) * 10) / 10);
    // Samples a segment every `step` degrees of the joint that turns most (and every 15 cm of ride, 3 degrees of roll).
    function samples(segment, step) {
        let turn = 0;
        if (segment.path) for (let k = 1; k < segment.path.length; k++) turn += Math.max(...segment.path[k].map((v, i) => Math.abs(v - segment.path[k - 1][i])));
        else turn = Math.max(...segment.to.theta.map((v, i) => Math.abs(v - segment.from.theta[i])));
        return Math.max(2, Math.ceil(degrees(turn) / step), Math.ceil(Math.abs(segment.to.mbs - segment.from.mbs) / .15), Math.ceil(degrees(Math.abs(segment.to.dextre.roll - segment.from.dextre.roll)) / 3));
    }
    // The tightest moment of a compiled plan, from segment `from` on.
    function clearanceOf(plan, from = 0, step = 2) {
        let t0 = 0, worst = { clearance: Infinity };
        plan.segments.forEach((segment, k) => {
            if (k >= from) {
                const n = samples(segment, step);
                for (let j = 0; j <= n; j++) {
                    const t = t0 + Math.min(segment.duration - 1e-6, segment.duration * j / n), r = clear.test(MO.sample(plan, t).state);
                    if (r.clearance < worst.clearance) worst = { ...r, label: segment.label, t: +t.toFixed(2) };
                }
            }
            t0 += segment.duration;
        });
        return worst;
    }
    const better = (a, b) => { const ga = Math.min(a.clearance, ENOUGH), gb = Math.min(b.clearance, ENOUGH); return Math.abs(ga - gb) > 1e-6 ? ga > gb : a.duration < b.duration; };
    // Where the tip waits before its approach, for a reach or a stow.
    function standoff(pick, state) {
        const d = pick.standoff ?? 1, out = (m, normal) => { const r = m.slice(); r[12] += normal[0] * d; r[13] += normal[1] * d; r[14] += normal[2] * d; return r; };
        if (pick.reach) { const m = P.fixtureFrame(pick.reach, state); return out(m, m); }
        return out(P.tipFrameForDextreOn(pick.stow, state), P.fixtureFrame(pick.stow, state));
    }
    const clearPose = (state, theta, margin = .4) => clear.test({ ...P.copyState(state), theta }).clearance > margin;
    function randomClearPoses(state, count) {
        const list = [];
        for (let k = 0; k < count * 40 && list.length < count; k++) { const v = nearest(randomPose(), state.theta); if (clearPose(state, v)) list.push(v); }
        return list;
    }
    function plan(groups, { seeds = 300, keep = 10, vias = 24, start = P.REST, randomSeed = 12345 } = {}) {
        seed = randomSeed;
        let state = P.copyState(start), steps = [];
        const report = [], visited = [P.copyState(start)];
        for (const group of groups) {
            const pick = group.pick, follow = group.follow || [], from = P.copyState(state);
            let best = null;
            const consider = (candidate, note) => {
                const compiled = MO.compile([...candidate, ...follow], from);
                if (compiled.problem) return;
                const worst = clearanceOf(compiled, 0, 3), entry = { candidate, clearance: worst.clearance, worst, duration: compiled.duration, note, end: compiled.end };
                if (!best || better(entry, best)) best = entry;
            };
            // Poses already passed through on this base (latest first): going back the way the arm came is clear.
            const known = () => visited.filter(v => v.base === from.base && v.end === from.end && v.dextre.on === from.dextre.on).reverse()
                .map(v => nearest(v.theta, from.theta)).filter((v, k, list) => list.findIndex(w => w.every((x, i) => Math.abs(x - v[i]) < 1e-3)) === k);
            const through = (make, note) => {
                const singles = [...known(), ...randomClearPoses(from, vias)], label = group.viaLabel || pick.label;
                for (const v of singles) { consider([{ move: toDegrees(v), label }, ...make(v)], note); if (best && best.clearance >= ENOUGH) return; }
                for (let k = 0; k < vias && (!best || best.clearance < ENOUGH); k++) {
                    const a = singles[Math.floor(random() * singles.length)], b = singles[Math.floor(random() * singles.length)];
                    if (a && b && a !== b) consider([{ move: toDegrees(a), label }, { move: toDegrees(b), label }, ...make(b)], note + ' ×2');
                }
            };
            if (pick.reach || pick.stow) {
                const tip = K.multiply(standoff(pick, from), K.FLIP), solutions = [], prior = known();
                for (let n = 0; n < seeds + prior.length; n++) {
                    const guess = n < prior.length ? prior[n] : randomPose(), r = K.reach(tip, guess, P.baseFrame(from), { prefer: guess, iterations: 800 });
                    if (r.positionError > 1e-3 || r.orientationError > 1e-3) continue;
                    const theta = nearest(r.theta, from.theta);
                    solutions.push({ theta, clearance: clear.test({ ...P.copyState(from), theta }).clearance });
                }
                solutions.sort((a, b) => b.clearance - a.clearance);
                for (const s of solutions.slice(0, keep)) consider([{ ...pick, via: toDegrees(s.theta) }], 'seed');
                for (const v of prior) consider([{ ...pick, via: toDegrees(v) }], 'known seed');
                if (!best || best.clearance < ENOUGH) for (const s of solutions.slice(0, 3)) through(() => [{ ...pick, via: toDegrees(s.theta) }], 'via + seed');
            } else if (pick.pose) {
                for (const v of randomClearPoses(from, vias * 4)) if (!group.accept || group.accept({ ...P.copyState(from), theta: v })) consider([{ move: toDegrees(v), label: pick.label }], 'pose');
            } else {
                consider([pick], 'direct');
                if (!best || best.clearance < ENOUGH) through(() => [pick], 'via');
            }
            if (!best) { report.push({ pick: pick.label, failed: true }); break; }
            steps = [...steps, ...best.candidate, ...follow]; state = best.end;
            for (const segment of MO.compile([...best.candidate, ...follow], from).segments) visited.push(P.copyState(segment.to));
            report.push({ pick: pick.label, note: best.note, clearance: +best.clearance.toFixed(3), duration: +best.duration.toFixed(1), worst: best.worst.what + ' ' + (best.worst.body ?? '') + ' ' + (best.worst.part || '') });
        }
        const compiled = MO.compile(steps, start), fine = clearanceOf(compiled, 0, 1);
        return { steps, report, duration: +compiled.duration.toFixed(1), problem: compiled.problem, clearance: fine.clearance, tightest: fine };
    }
    return { plan, clearanceOf, nearest };
};
