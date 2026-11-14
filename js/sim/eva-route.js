// Translation path of the two EVA crew: out of Quest's hatch, round the crew lock and along the equipment lock,
// over Unity's zenith side and up Z1's forward ramp to the worksite. Pure geometry in station metres, shared by the
// motion model (js/sim/eva.js, which moves the crew along it) and the page (js/figures/eva.js, which draws the
// handrails and the routed safety tethers). No meshes, no scene access.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const rad = THREE.MathUtils.degToRad, V = (x, y, z) => new THREE.Vector3(x, y, z);
// Keypoints: [handrail point, outward normal, hip offset]. The hips ride `reach` out from the rail along the normal.
// Quest's axis runs along x at y 0, z 12 (angle from nadir toward forward toward zenith); Unity's along z.
// out, along: extra metres the hips stand off there, radially and along Quest's axis.
const onQuest = (x, a, r, nx = 0, out = 0, along = 0) => [V(x, -r * Math.cos(rad(a)), 12 - r * Math.sin(rad(a))), V(nx, -Math.cos(rad(a)), -Math.sin(rad(a))).normalize(),
    [along, -out * Math.cos(rad(a)), -out * Math.sin(rad(a))]];
const onUnity = (a, z, r = 2.305) => [V(r * Math.cos(rad(a)), r * Math.sin(rad(a)), z), V(Math.cos(rad(a)), Math.sin(rad(a)), 0)];
const at = (p, n, o) => [V(...p), V(...n).normalize(), o];
const ramp = [0, .486, -.874];   // outward normal of Z1's forward ramp
const keys = {
    // Inside the crew lock, head first down through the hatch to the forward point of the hatch's handrail ring; from
    // there along the handrails (trunkRails, below).
    trunk: [at([7.37, .30, 11.44], [0, 0, 1]), at([7.37, -.55, 11.44], [0, 0, 1]), at([7.37, -1.14, 11.33], [0, 0, 1]), at([7.37, -1.30, 11.02], [0, -.92, .39])],
    // The lead keeps to the ramp's port side, then swings out to the handholds on the port edge of the face.
    lead: [onUnity(100, 9.62), onUnity(112, 9.66), at([-.9, 2.5, 9.93], [0, .6, -.8], [0, .21, -.05]), at([-.9, 2.86, 10.03], ramp), at([-.9, 3.3, 10.273], ramp, [-.2, 0, 0]),
        at([-1.2, 3.80, 10.595], [0, 0, -1], [-.23, 0, 0])],
    helper: [onUnity(98, 9.62), at([-.45, 2.5, 9.93], [0, .6, -.8], [0, .09, 0]), at([-.45, 2.86, 10.03], ramp), at([-.45, 3.3, 10.273], ramp), at([-.45, 3.60, 10.43], ramp)]
};
// The handrails of the way out, as on the station: separate straight bars of standard lengths, each on two short posts
// (the bar `standoff` off the surface), set along a module's axis or round it, a hand's reach apart; none crosses from
// one module to the next (between Quest's inboard end and Unity the crew reach across). In travel order:
// - crew lock: two round its forward side next to the hatch, one along it at 140° (none on the collar: the way passes
//   a via point there, below);
// - equipment lock: one up its outboard end face from r 1.58, two along it at 164° (between the gas-tank covers), one down its
//   inboard end face to the neck;
// - Unity: one along it beside Quest, two round its zenith side to the foot of Z1.
// Quest angles count from nadir toward forward (as onQuest), Unity's from starboard toward zenith (as onUnity).
const standoff = .12;
const qPoint = (x, a, r) => V(x, -r * Math.cos(rad(a)), 12 - r * Math.sin(rad(a)));
const qNormal = (a, along = 0, out = 1) => V(along, -out * Math.cos(rad(a)), -out * Math.sin(rad(a))).normalize();
// A bar on a cone face of Quest (profile points [x, r] at either end), radial at angle a from radius r0 to r1.
function qFace(a, [xa, ra], [xb, rb], r0, r1) {
    const length = Math.hypot(xb - xa, rb - ra), along = (rb - ra) / length, out = -(xb - xa) / length, n = qNormal(a, along, out);
    const on = r => qPoint(xa + (xb - xa) * (r - ra) / (rb - ra), a, r).addScaledVector(n, standoff);
    return { a: on(r0), b: on(r1), na: n, nb: n.clone() };
}
const qAround = (x, r, a0, a1) => ({ a: qPoint(x, a0, r + standoff), b: qPoint(x, a1, r + standoff), na: qNormal(a0), nb: qNormal(a1) });
const qAlong = (a, r, x0, x1) => ({ a: qPoint(x0, a, r + standoff), b: qPoint(x1, a, r + standoff), na: qNormal(a), nb: qNormal(a) });
const unityRadius = 2.185;
const uPoint = (a, z) => V((unityRadius + standoff) * Math.cos(rad(a)), (unityRadius + standoff) * Math.sin(rad(a)), z), uNormal = a => V(Math.cos(rad(a)), Math.sin(rad(a)), 0);
const uAround = (z, a0, a1) => ({ a: uPoint(a0, z), b: uPoint(a1, z), na: uNormal(a0), nb: uNormal(a1) });
const uAlong = (a, z0, z1) => ({ a: uPoint(a, z0), b: uPoint(a, z1), na: uNormal(a), nb: uNormal(a) });
// Between bars the way may pass a `via` point (no bar there): where the crew lock meets the equipment lock's end face
// (a concave corner) the body swings out and up before the face, the hips held off it (hip offset, as at()); from the
// hatch's handrail ring the way curves up onto the crew lock.
const via = (point, normal, offset) => ({ via: [point, normal.normalize(), offset] });
const trunkWay = [
    via(qPoint(7.36, 46, 1.40), qNormal(46), [0, 0, 0]),
    qAround(7.30, .96, 58, 82), qAround(7.30, .96, 92, 120), qAlong(140, .96, 7.10, 6.50),
    via(qPoint(6.30, 150, 1.38), qNormal(150, .75, .66), [.10, ...qNormal(150).multiplyScalar(.08).toArray().slice(1)]),
    qFace(162, [6.015, 1.10], [5.78, 2.05], 1.58, 1.98), qAlong(164, 2.10, 5.55, 4.80), qAlong(164, 2.10, 4.55, 3.85), qFace(164, [3.57, 1.98], [3.39, .87], 1.90, 1.10),
    uAlong(32, 11.40, 10.80), uAround(10.15, 44, 64), uAround(9.62, 72, 90)
];
export const trunkRails = trunkWay.filter(item => !item.via);
// The route's rail: the bars' ends (and a middle point on the longer ones) after the hatch, and the via points.
for (const item of trunkWay) {
    if (item.via) { keys.trunk.push(item.via); continue; }
    keys.trunk.push([item.a.clone(), item.na.clone()]);
    if (item.a.distanceTo(item.b) > .6) keys.trunk.push([item.a.clone().lerp(item.b, .5), item.na.clone().lerp(item.nb, .5).normalize()]);
    keys.trunk.push([item.b.clone(), item.nb.clone()]);
}
export const evaPath = {
    reach: .46,        // hips to handrail
    chord: .45,        // the body lies along the chord through the rail this far ahead of the hips …
    chest: .36,        // the chest keeps at least this far from the rail: the body stands off inside a concave corner
    neck: .33,         // chest to helmet along the body
    headRoom: .3,      // the helmet keeps this far from the rail ahead
    standMost: .15,    // … by at most this much, so the handholds stay within reach
    lean: .17,         // the chest leans this far (radians) toward the rail on the way
    trail: .85,        // … and this far behind them, where the feet are: the legs are the long end of the body
    settle: 1.0,       // over the last metre the body turns from the path into its first worksite pose
    tetherStart: 1.86, // arc of the hatch ring's forward point, where both safety tethers are hooked
    helperOffset: [.98, 0, 0]   // the helper's handholds, worksite and fairlead: the lead's, moved along the face
};
// Handholds: [x, y, z, tangent, normal] per grip, in path order. Trunk grips are shared: the hatch's rim and its
// handrail ring, then grips along each bar of trunkRails, about 0.28 m apart (added below).
export const evaHolds = {
    trunk: [
        [7.37, .24, 11.44, 0, -1, .01, 0, 0, 1], [7.37, -.04, 11.447, 0, -1, .026, 0, 0, 1], [7.37, -.32, 11.45, 0, -1, -.009, 0, 0, 1],
        [7.37, -.599, 11.436, 0, -.997, -.079, 0, .002, 1], [7.37, -.878, 11.412, 0, -.992, -.128, 0, .051, .999], [7.37, -1.143, 11.328, .001, -.8, -.6, 0, -.004, 1],
        [7.371, -1.298, 11.1, -.002, -.259, -.966, 0, -.75, .661]],
    lead: [
        [-.264, 2.291, 9.616, -.992, -.122, .015, -.115, .993, 0], [-.536, 2.228, 9.621, -.933, -.36, -.002, -.232, .973, .006], [-.947, 2.102, 9.86, 0, 0, 1, -.411, .912, 0],
        [-.9, 2.7, 9.93, 1, 0, 0, 0, 0, -1], [-.89, 3.016, 10.105, .077, .876, .476, 0, .562, -.827], [-.89, 3.256, 10.247, -.149, .847, .51, 0, .517, -.856],
        [-.984, 3.48, 10.385, -.458, .747, .482, 0, .357, -.934], [-1.123, 3.683, 10.518, -.503, .722, .475, 0, .128, -.992]],
    helper: [
        [-.264, 2.291, 9.616, -.992, -.122, .015, -.115, .993, 0], [-.442, 2.262, 9.9, 0, 0, 1, -.192, .981, 0], [-.45, 2.7, 9.93, 1, 0, 0, 0, 0, -1],
        [-.45, 2.979, 10.087, 0, .882, .472, 0, .535, -.845], [-.45, 3.22, 10.228, 0, .863, .505, 0, .496, -.868]]
};
// Handrail bars: [end a, end b, normal a, normal b, post a, post b]. The trunk's are trunkRails (added below), then
// the bar across the foot of Z1's ramp.
export const evaBars = {
    trunk: [[-1, 2.7, 9.93, -.3, 2.7, 9.93, 0, 0, -1, 0, 0, -1, .07, .07]],
    lead: [
        [-.175, 2.3, 9.615, -.619, 2.194, 9.622, -.076, .997, 0, -.267, .964, .011, .113, .087], [-.947, 2.102, 9.63, -.947, 2.102, 10.09, -.411, .912, 0, -.411, .912, 0, .115, .115], [-.897, 2.936, 10.064, -.91, 3.332, 10.292, 0, .535, -.845, 0, .471, -.882, .103, .104],
        [-.945, 3.411, 10.341, -1.167, 3.748, 10.561, 0, .418, -.908, 0, .053, -.999, .048, .125]],
    helper: [
        [-.442, 2.262, 9.72, -.442, 2.262, 10.18, -.192, .981, 0, -.192, .981, 0, .115, .115], [-.45, 2.898, 10.047, -.45, 3.299, 10.273, 0, .511, -.859, 0, .486, -.874, .099, .104]]
};
for (const bar of trunkRails) {
    const way = bar.b.clone().sub(bar.a), length = way.length(), count = Math.max(2, Math.round(length / .28));
    way.divideScalar(length);
    for (let i = 0; i < count; i++) {
        const k = (i + .5) / count, point = bar.a.clone().lerp(bar.b, k), normal = bar.na.clone().lerp(bar.nb, k).normalize();
        evaHolds.trunk.push([...point.toArray(), ...way.toArray(), ...normal.toArray()]);
    }
}
evaBars.trunk.unshift(...trunkRails.map(bar => [...bar.a.toArray(), ...bar.b.toArray(), ...bar.na.toArray(), ...bar.nb.toArray(), standoff, standoff]));

const smooth = value => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
// role: 'lead' or 'helper'. task: { anchor: local point of the rail beside the hips at the start of the worksite
// climb, offset: where that role's task frame sits, grips: the two local rail points held at that start (left, right),
// fairlead: local point where the safety tether leaves the structure for the crew's reel }.
export function createEvaRoute(role, task) {
    const list = keys.trunk.concat(keys[role]);
    const curve = new THREE.CatmullRomCurve3(list.map(k => k[0]), false, 'centripetal'); curve.arcLengthDivisions = 800;
    const normals = new THREE.CatmullRomCurve3(list.map(k => k[1]), false, 'centripetal');
    const offsets = new THREE.CatmullRomCurve3(list.map(k => V(...(k[2] || [0, 0, 0]))), false, 'centripetal');
    const length = curve.getLength();
    const anchor = V(...task.anchor), taskOffset = V(...task.offset), identity = new THREE.Quaternion();
    const ahead = V(0, 0, 0), behind = V(0, 0, 0), basis = new THREE.Matrix4(), seat = anchor.clone().add(taskOffset), spoke = V(0, 0, 0);
    const param = s => curve.getUtoTmapping(THREE.MathUtils.clamp(s / length, 0, 1));
    // Rail point and outward normal at arc s.
    function rail(s, point, normal) { const t = param(s); curve.getPoint(t, point); if (normal) normals.getPoint(t, normal).normalize(); return point; }
    // Frame whose +y runs along the path and whose -z points away from the structure, turned from a tangent and a normal.
    function turned(tangent, normal, quaternion) {
        const z = normal.clone().negate(); z.addScaledVector(tangent, -z.dot(tangent)).normalize();
        return quaternion.setFromRotationMatrix(basis.makeBasis(new THREE.Vector3().crossVectors(tangent, z), tangent, z));
    }
    // Extra distance from the rail, filled in below: where the rail turns in toward the chest the body stands off.
    const stand = new Float32Array(Math.ceil(length / .05) + 2);
    const standOff = s => { const x = Math.min(Math.max(s, 0), length) / .05, i = Math.floor(x); return stand[i] + (stand[i + 1] - stand[i]) * (x - i); };
    // Where the hips ride at arc s; past the end of the rail the path runs straight on.
    const lastTangent = curve.getTangent(1), reachPoint = V(0, 0, 0);
    function hipPath(s, out) {
        const t = param(Math.min(s, length));
        return curve.getPoint(t, out).add(offsets.getPoint(t, reachPoint)).addScaledVector(normals.getPoint(t, reachPoint).normalize(), evaPath.reach + standOff(s))
            .addScaledVector(lastTangent, Math.max(0, s - length));
    }
    // Body frame at arc s: the worksite frame carried along the path (its rail on the handrails, +y along the path).
    const leanTurn = new THREE.Quaternion(), leanAxis = V(0, 0, 0);
    function frameAt(s, position, quaternion) {
        const t = param(s), point = curve.getPoint(t), normal = normals.getPoint(t).normalize();
        // The body lies along the chord through the rail a torso ahead of the hips and a leg behind them.
        rail(Math.min(length, s + evaPath.chord), ahead); rail(Math.max(0, s - evaPath.trail), behind);
        turned(ahead.sub(behind).normalize(), normal, quaternion); hipPath(s, behind);
        // Blended about the anchor (the rail point under the hands), not about the frame's far-off origin.
        const w = smooth((s - (length - evaPath.settle)) / evaPath.settle);
        position.copy(point).add(offsets.getPoint(t)).addScaledVector(normal, standOff(s));
        // The chest leans in toward the rail about the hips, so the arms stay bent between handholds; the legs trail out.
        leanTurn.setFromAxisAngle(leanAxis.crossVectors(ahead, normal).normalize(), -evaPath.lean);
        quaternion.premultiply(leanTurn); position.sub(behind).applyQuaternion(leanTurn).add(behind);
        if (w > 0) { position.lerp(seat, w); quaternion.slerp(identity, w); }
        return position.sub(spoke.copy(anchor).applyQuaternion(quaternion));
    }
    const samples = Array.from({ length: Math.ceil(length / .02) + 1 }, (_, i) => rail(Math.min(length, i * .02), V(0, 0, 0)));
    // The chest (a torso ahead of the hips along the leaning body) keeps evaPath.chest from every part of the rail.
    {
        const chest = V(0, 0, 0), head = V(0, 0, 0), line = V(0, 0, 0), normal = V(0, 0, 0), probe = V(0, 0, 0), count = stand.length - 1;
        for (let pass = 0; pass < 4; pass++) for (let i = 0; i < count; i++) {
            const s = Math.min(length, i * .05); normals.getPoint(param(s), normal).normalize();
            rail(Math.min(length, s + evaPath.chord), line).sub(rail(Math.max(0, s - evaPath.trail), probe)).normalize();
            line.multiplyScalar(Math.cos(evaPath.lean)).addScaledVector(normal, -Math.sin(evaPath.lean));
            hipPath(s, chest).addScaledVector(line, evaPath.chord); head.copy(chest).addScaledVector(line, evaPath.neck);
            let nearest = Infinity, above = Infinity;
            for (let j = Math.max(0, Math.round((s - 1) / .02)), end = Math.min(samples.length - 1, Math.round((s + 1.6) / .02)); j <= end; j += 2) { nearest = Math.min(nearest, samples[j].distanceToSquared(chest)); above = Math.min(above, samples[j].distanceToSquared(head)); }
            stand[i] = Math.min(evaPath.standMost, stand[i] + Math.max(0, evaPath.chest - Math.sqrt(nearest), evaPath.headRoom - Math.sqrt(above)));
        }
        // Spread along the path so the body moves out and back in gradually, and none at the worksite end.
        const peak = Array.from(stand, (_, i) => Math.max(...stand.subarray(Math.max(0, i - 4), i + 5)));
        for (let i = 0; i < stand.length; i++) {
            let sum = 0, weight = 0;
            for (let j = -8; j <= 8; j++) { const w = 9 - Math.abs(j); sum += w * peak[Math.min(count, Math.max(0, i + j))]; weight += w; }
            stand[i] = sum / weight * (1 - smooth((i * .05 - (length - evaPath.settle - .4)) / .4));
        }
    }
    // Grips in path order with the arc each is beside; the last two are the rail points held when the climb starts.
    const arcOf = point => { let best = 0, distance = Infinity; samples.forEach((sample, i) => { const d = sample.distanceToSquared(point); if (d < distance) { distance = d; best = i; } }); return Math.min(length, best * .02); };
    const grips = evaHolds.trunk.concat(evaHolds[role]).map(([x, y, z, tx, ty, tz, nx, ny, nz]) => {
        const point = V(x, y, z); return { s: arcOf(point), point, quaternion: turned(V(tx, ty, tz).normalize(), V(nx, ny, nz).normalize(), new THREE.Quaternion()) };
    }).filter(grip => grip.s < length - .12).sort((a, b) => a.s - b.s);
    const last = task.grips.map(p => ({ s: length + p[1] - task.anchor[1], point: V(...p).add(taskOffset), quaternion: identity.clone() }));
    const hands = { left: [last[0]], right: [last[1]] };
    for (let i = grips.length - 1, side = 'right'; i >= 0; i--, side = side === 'right' ? 'left' : 'right') hands[side].unshift(grips[i]);
    // Where a hand is at body arc s: on a grip, or swinging to the next one. The swing for a pair of grips is centred
    // where their midpoint is `lead` ahead of the hips and lasts 46 % of their spacing. The glove speeds up over the
    // first quarter of the swing, holds, and slows over the last quarter: its peak is 2.9 times the body's speed.
    const glide = x => x < .25 ? x * x * 8 / 3 : x > .75 ? 1 - (1 - x) * (1 - x) * 8 / 3 : (x - .125) * 4 / 3;
    function hand(side, s, lead = .56) {
        const list = hands[side]; let i = 0;
        while (i < list.length - 2 && s > (list[i + 1].s + list[i + 2].s) / 2 - lead - .23 * (list[i + 2].s - list[i + 1].s)) i++;
        const a = list[i], b = list[Math.min(i + 1, list.length - 1)], centre = (a.s + b.s) / 2 - lead, half = .23 * (b.s - a.s);
        const raw = half > 0 ? THREE.MathUtils.clamp((s - (centre - half)) / (2 * half), 0, 1) : 1, e = glide(raw);
        return { point: a.point.clone().lerp(b.point, e), quaternion: a.quaternion.clone().slerp(b.quaternion, e), swing: Math.sin(Math.PI * e), raw };
    }
    // Arc of the rail point nearest to a point, searched around body arc s.
    function near(point, s) {
        let best = s, distance = Infinity;
        for (let arc = Math.max(0, s - .3), end = Math.min(length, s + 1.3); arc <= end; arc += .02) {
            const d = rail(arc, ahead).distanceToSquared(point); if (d < distance) { distance = d; best = arc; }
        }
        return best;
    }
    // Safety tether laid beside the handrails from the hook on the hatch ring to this crew's fairlead. The control points
    // are evenly spaced in body arc and the curve is read by parameter, so a body arc maps straight to a place on it.
    const side = role === 'lead' ? -1 : 1, step = .25, count = Math.floor((length - .3 - evaPath.tetherStart) / step) + 1, laid = [];
    for (let i = 0; i < count; i++) {
        const arc = evaPath.tetherStart + i * step, point = V(0, 0, 0), normal = V(0, 0, 0), settle = smooth(i * step / .3);
        rail(arc, point, normal); rail(arc + .05, ahead).sub(rail(arc - .05, behind)).normalize();
        laid.push(point.addScaledVector(normal, -.06 * settle).addScaledVector(ahead.cross(normal), side * .03 * settle));
    }
    const fairlead = V(...task.fairlead).add(taskOffset);
    laid.push(fairlead.clone().add(V(-.075, -.11, -.003)), fairlead.clone().add(V(-.045, -.02, 0)), fairlead);
    const line = new THREE.CatmullRomCurve3(laid, false, 'centripetal'); line.getUtoTmapping = u => u;
    // Share of the line that is laid when the hips are at arc s: it leaves the rails a little behind the reel, and
    // runs on to the fairlead as the crew settle at the worksite.
    function paid(s) {
        const base = THREE.MathUtils.clamp((s - .35 - evaPath.tetherStart) / step, 0, count - 1) / (laid.length - 1);
        return base + (1 - base) * smooth((s - (length - evaPath.settle)) / evaPath.settle);
    }
    return { role, length, rail, near, standOff, frameAt, turned, hand, hands, grips, tether: { line, paid, segments: (laid.length - 1) * 8 } };
}

// When each crew is where. The helper leaves the airlock first and waits at the worksite; the lead follows, works
// for one task period and goes back first. Both translate at `speed` with a gentle start and stop, `spacing` apart
// along the shared way (hips to hips: a body reaches about a metre ahead of its hips and a metre behind, so this
// leaves a metre and a half between the lead's gloves and the helper's boots). The lead's own way to the worksite is
// longer than the helper's, so on the way back the helper waits that much longer before setting off.
export function createEvaTimeline(lengths, taskPeriod) {
    const speed = .14, ease = 2.5, spacing = 3.5, gap = spacing / speed, pause = 12;
    const travel = { lead: lengths.lead / speed + ease, helper: lengths.helper / speed + ease };
    const arrive = { helper: travel.helper, lead: gap + travel.lead }, lag = Math.max(0, lengths.lead - lengths.helper) / speed;
    const depart = { helper: 0, lead: gap }, leave = { lead: arrive.lead + taskPeriod, helper: arrive.lead + taskPeriod + gap + lag };
    const home = { lead: leave.lead + travel.lead, helper: leave.helper + travel.helper }, period = home.helper + pause;
    // Arc after `time` seconds of a move of `length`: constant speed between an eased start and stop.
    const moved = (time, length, total) => {
        const t = Math.min(time, total - time);
        const d = t >= ease ? speed * (t - ease / 2) : speed * t * t / (2 * ease);
        return time <= total / 2 ? d : length - d;
    };
    function at(role, time) {   // { mode: 'inside' | 'route' | 'task', s: arc along the path, local: seconds at the worksite }
        const t = ((time % period) + period) % period, length = lengths[role];
        if (t < depart[role] || t >= home[role]) return { mode: 'inside', s: 0, local: 0, t };
        if (t < arrive[role]) return { mode: 'route', s: moved(t - depart[role], length, travel[role]), local: 0, t };
        if (t < leave[role]) return { mode: 'task', s: length, local: t - arrive[role], t };
        return { mode: 'route', s: length - moved(t - leave[role], length, travel[role]), local: 0, t };
    }
    return { speed, period, depart, arrive, leave, home, stay: { lead: taskPeriod, helper: leave.helper - arrive.helper }, at };
}
