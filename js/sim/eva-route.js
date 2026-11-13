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
    // Inside the crew lock, head first down through the hatch, round the forward side of the hatch ring, up the
    // crew lock's forward side, over the collar onto the equipment lock, down its end to Unity and over the top.
    trunk: [at([7.37, .30, 11.44], [0, 0, 1]), at([7.37, -.55, 11.44], [0, 0, 1]), at([7.37, -1.14, 11.33], [0, 0, 1]), at([7.37, -1.30, 11.02], [0, -.92, .39]),
        onQuest(7.36, 50, 1.38), onQuest(7.34, 68, 1.10), onQuest(7.30, 92, 1.075), onQuest(7.12, 114, 1.09), onQuest(6.72, 128, 1.10),
        onQuest(6.34, 140, 1.16, 0, .12), onQuest(6.12, 150, 1.32, 0, .12, .05), onQuest(5.98, 153, 1.70, 1.6, 0, .08), onQuest(5.72, 156, 2.215, .35),
        onQuest(5.2, 158, 2.22), onQuest(4.4, 158, 2.22), onQuest(3.72, 158, 2.23), onQuest(3.44, 156, 1.80, -1.6), onQuest(3.24, 152, 1.36, -.5, .26),
        onQuest(2.75, 148, 1.325, 0, .2), onUnity(33, 11.0), onUnity(42, 10.5), onUnity(55, 9.98), onUnity(72, 9.66), onUnity(88, 9.62)],
    // The lead keeps to the ramp's port side, then swings out to the handholds on the port edge of the face.
    lead: [onUnity(100, 9.62), onUnity(112, 9.66), at([-.9, 2.5, 9.93], [0, .6, -.8], [0, .21, -.05]), at([-.9, 2.86, 10.03], ramp), at([-.9, 3.3, 10.273], ramp, [-.2, 0, 0]),
        at([-1.2, 3.80, 10.595], [0, 0, -1], [-.23, 0, 0])],
    helper: [onUnity(98, 9.62), at([-.45, 2.5, 9.93], [0, .6, -.8], [0, .09, 0]), at([-.45, 2.86, 10.03], ramp), at([-.45, 3.3, 10.273], ramp), at([-.45, 3.60, 10.43], ramp)]
};
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
// Handholds (tools: see README): [x, y, z, tangent, normal] per grip, in path order. Trunk grips are shared.
export const evaHolds = {
    trunk: [
        [7.37, .24, 11.44, 0, -1, .01, 0, 0, 1], [7.37, -.04, 11.447, 0, -1, .026, 0, 0, 1], [7.37, -.32, 11.45, 0, -1, -.009, 0, 0, 1],
        [7.37, -.599, 11.436, 0, -.997, -.079, 0, .002, 1], [7.37, -.878, 11.412, 0, -.992, -.128, 0, .051, .999], [7.37, -1.143, 11.328, .001, -.8, -.6, 0, -.004, 1],
        [7.371, -1.298, 11.1, -.002, -.259, -.966, 0, -.75, .661], [7.366, -1.119, 10.956, -.021, .994, -.105, 0, -.956, -.293], [7.358, -.839, 10.942, -.033, .999, .012, 0, -.614, -.789],
        [7.348, -.561, 10.971, -.046, .993, .113, 0, -.464, -.886], [7.334, -.283, 10.967, -.036, .988, -.151, 0, -.267, -.964], [7.31, -.007, 10.926, -.194, .98, -.044, 0, -.007, -1],
        [7.23, .258, 10.955, -.375, .906, .194, 0, .234, -.972], [7.079, .483, 11.018, -.74, .624, .252, 0, .437, -.899], [6.845, .615, 11.094, -.871, .407, .274, 0, .559, -.829],
        [6.605, .737, 11.169, -.863, .427, .269, 0, .664, -.748], [6.369, .867, 11.244, -.783, .563, .265, 0, .754, -.656], [6.18, 1.054, 11.327, -.586, .778, .226, -.016, .841, -.54],
        [6.055, 1.297, 11.305, -.294, .903, -.314, .435, .805, -.404], [5.966, 1.548, 11.219, -.361, .898, -.252, .844, .479, -.241], [5.872, 1.802, 11.148, -.373, .897, -.238, .666, .676, -.316],
        [5.718, 2.025, 11.099, -.842, .538, -.042, .328, .863, -.384], [5.448, 2.069, 11.133, -.982, -.047, .182, .119, .916, -.384], [5.171, 2.059, 11.17, -.998, .024, .057, -.013, .928, -.373],
        [4.891, 2.061, 11.175, -1, -.005, -.006, -.051, .928, -.369], [4.611, 2.059, 11.171, -1, -.008, -.018, -.018, .928, -.373], [4.332, 2.061, 11.168, -.998, .066, -.018, .004, .927, -.375],
        [4.054, 2.093, 11.159, -.993, .112, -.03, .049, .926, -.373], [3.775, 2.089, 11.16, -.961, -.269, .064, .036, .927, -.374], [3.573, 1.912, 11.203, -.497, -.842, .21, -.46, .823, -.335],
        [3.452, 1.667, 11.263, -.446, -.872, .202, -.846, .488, -.214], [3.356, 1.411, 11.323, -.292, -.932, .213, -.726, .617, -.304], [3.213, 1.183, 11.362, -.86, -.509, .007, -.416, .801, -.431],
        [2.943, 1.125, 11.337, -.986, -.037, -.16, -.166, .841, -.515], [2.67, 1.125, 11.279, -.972, .035, -.233, .089, .851, -.518], [2.399, 1.147, 11.209, -.955, .117, -.272, .458, .805, -.378],
        [2.138, 1.191, 11.12, -.901, .202, -.384, .759, .636, -.139], [1.911, 1.267, 10.978, -.634, .368, -.681, .837, .547, .003], [1.803, 1.391, 10.755, -.239, .482, -.843, .802, .597, .007],
        [1.726, 1.528, 10.524, -.398, .478, -.783, .749, .663, 0], [1.599, 1.66, 10.312, -.478, .473, -.74, .692, .722, 0], [1.453, 1.792, 10.113, -.572, .466, -.675, .628, .778, 0],
        [1.273, 1.919, 9.941, -.71, .445, -.546, .552, .834, 0], [1.062, 2.041, 9.804, -.796, .419, -.437, .459, .888, 0], [.828, 2.15, 9.697, -.88, .352, -.32, .358, .934, 0],
        [.569, 2.232, 9.633, -.965, .235, -.115, .246, .969, 0], [.294, 2.284, 9.621, -.991, .132, 0, .127, .992, 0], [.015, 2.306, 9.618, -1, .018, -.025, .007, 1, 0]],
    lead: [
        [-.264, 2.291, 9.616, -.992, -.122, .015, -.115, .993, 0], [-.536, 2.228, 9.621, -.933, -.36, -.002, -.232, .973, .006], [-.947, 2.102, 9.86, 0, 0, 1, -.411, .912, 0],
        [-.9, 2.7, 9.93, 1, 0, 0, 0, 0, -1], [-.89, 3.016, 10.105, .077, .876, .476, 0, .562, -.827], [-.89, 3.256, 10.247, -.149, .847, .51, 0, .517, -.856],
        [-.984, 3.48, 10.385, -.458, .747, .482, 0, .357, -.934], [-1.123, 3.683, 10.518, -.503, .722, .475, 0, .128, -.992]],
    helper: [
        [-.264, 2.291, 9.616, -.992, -.122, .015, -.115, .993, 0], [-.442, 2.262, 9.9, 0, 0, 1, -.192, .981, 0], [-.45, 2.7, 9.93, 1, 0, 0, 0, 0, -1],
        [-.45, 2.979, 10.087, 0, .882, .472, 0, .535, -.845], [-.45, 3.22, 10.228, 0, .863, .505, 0, .496, -.868]]
};
// Handrail bars: [end a, end b, normal a, normal b, post a, post b].
export const evaBars = {
    trunk: [
        [7.361, -.929, 10.945, 7.344, -.472, 10.979, 0, -.701, -.713, 0, -.412, -.911, .431, .149], [7.338, -.372, 10.978, 7.289, .08, 10.928, 0, -.343, -.939, 0, .073, -.997, .111, .099], [7.26, .175, 10.939, 7.008, .532, 11.042, 0, .159, -.987, 0, .48, -.877, .099, .12],
        [6.923, .578, 11.069, 6.527, .775, 11.194, 0, .523, -.852, 0, .694, -.72, .088, .159], [6.442, .82, 11.22, 6.129, 1.128, 11.34, 0, .726, -.688, -.005, .863, -.506, .119, .187], [6.084, 1.216, 11.33, 5.936, 1.629, 11.196, .142, .878, -.457, .813, .524, -.255, .248, .09],
        [5.903, 1.721, 11.171, 5.635, 2.059, 11.102, .749, .598, -.284, .256, .886, -.387, .084, .092], [5.537, 2.07, 11.116, 5.081, 2.061, 11.174, .18, .904, -.387, -.04, .928, -.371, .094, .104], [4.981, 2.062, 11.175, 4.522, 2.058, 11.17, -.052, .928, -.369, -.007, .927, -.374, .104, .061],
        [4.421, 2.058, 11.168, 3.964, 2.101, 11.157, 0, .927, -.375, .06, .926, -.373, .103, .148], [3.864, 2.102, 11.156, 3.532, 1.834, 11.223, .059, .926, -.373, -.662, .693, -.284, .149, .051], [3.49, 1.746, 11.244, 3.327, 1.328, 11.341, -.798, .555, -.233, -.634, .69, -.349, .075, .213],
        [3.28, 1.242, 11.357, 2.855, 1.123, 11.321, -.514, .761, -.397, -.091, .844, -.528, .225, .182], [2.758, 1.124, 11.3, 2.314, 1.159, 11.184, -.007, .848, -.53, .575, .759, -.304, .214, .213], [2.22, 1.174, 11.152, 1.863, 1.303, 10.912, .685, .696, -.216, .83, .558, .007, .291, .08],
        [1.826, 1.348, 10.831, 1.686, 1.57, 10.455, .817, .577, .008, .731, .682, 0, .078, .111], [1.641, 1.617, 10.379, 1.4, 1.834, 10.053, .711, .703, 0, .605, .796, 0, .02, .114], [1.336, 1.879, 9.992, .989, 2.078, 9.766, .579, .815, 0, .428, .904, 0, .113, .109],
        [.906, 2.117, 9.728, .481, 2.252, 9.625, .392, .92, 0, .208, .978, 0, .109, .109], [.383, 2.27, 9.622, -.075, 2.305, 9.616, .166, .986, 0, -.032, .999, 0, .109, .082], [-1, 2.7, 9.93, -.3, 2.7, 9.93, 0, 0, -1, 0, 0, -1, .07, .07]],
    lead: [
        [-.175, 2.3, 9.615, -.619, 2.194, 9.622, -.076, .997, 0, -.267, .964, .011, .113, .087], [-.947, 2.102, 9.63, -.947, 2.102, 10.09, -.411, .912, 0, -.411, .912, 0, .115, .115], [-.897, 2.936, 10.064, -.91, 3.332, 10.292, 0, .535, -.845, 0, .471, -.882, .103, .104],
        [-.945, 3.411, 10.341, -1.167, 3.748, 10.561, 0, .418, -.908, 0, .053, -.999, .048, .125]],
    helper: [
        [-.442, 2.262, 9.72, -.442, 2.262, 10.18, -.192, .981, 0, -.192, .981, 0, .115, .115], [-.45, 2.898, 10.047, -.45, 3.299, 10.273, 0, .511, -.859, 0, .486, -.874, .099, .104]]
};

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
// for one task period and goes back first. Both translate at `speed` with a gentle start and stop.
export function createEvaTimeline(lengths, taskPeriod) {
    const speed = .14, ease = 2.5, gap = 12, pause = 12;
    const travel = { lead: lengths.lead / speed + ease, helper: lengths.helper / speed + ease };
    const arrive = { helper: travel.helper, lead: gap + travel.lead };
    const depart = { helper: 0, lead: gap }, leave = { lead: arrive.lead + taskPeriod, helper: arrive.lead + taskPeriod + gap };
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
