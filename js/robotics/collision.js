// How far Canadarm2 (and Dextre) stands from everything else in a state (pose.js), read from the clearance fields
// (field.js) of the station's rigid bodies. Plain arithmetic: the robotics worker plans with it (planner.js), and the
// page watches the moving arrays, radiators and Dragon ahead of the arm with it (index.js).
//
// A world holds the fields and where each body stands: the fixed station (in station coordinates), the bodies the
// scene turns or moves (SARJs, solar wings, radiators, antennas, Dragon, the window shutter: each in its own frame,
// placed by placeBodies), and the robotics' own: the base's carriage (station coordinates with the base at home,
// slid along x), Dextre's base and its turning body (their frames follow the state). The arm stands as spheres along
// its eight bodies, Dextre as spheres up its body, shoulders and folded arms; tools/robotics/clearance.js measures
// the same spheres against the triangles themselves.
import { ARM_LENGTH, JOINTS, invert, multiply } from './kinematics.js?v=44ee3feec6';
import { fixtures } from './fixtures.js?v=e8c0b95aaf';
import { MBS_HOME } from './layout.js?v=b4fe2c8612';
import { baseFrame, bodyRoll, dextreBody, fixtureFrame } from './pose.js?v=8d51479503';
import { fieldDistance } from './field.js?v=180c067b77';

// A field reads up to 7.5 cm long next to thin edges (field.js): every reading loses this much first.
export const MARGIN = .08;
// The arm's spheres [x, y, z, radius] in the arm frame at zero, LEE A's half (bodies 0 to 3; 4 to 7 by the half turn
// that swaps the ends): end effector, roll, yaw and pitch housings, then boom 1 with its end fittings, camera and
// electronics boxes.
const half = [
    [[.15, 0, 0, .42], [.5, 0, 0, .42], [.85, 0, 0, .42], [1.15, 0, 0, .32]],
    [[1.4, 0, 0, .3], [1.6, 0, -.12, .25], [1.9, 0, -.12, .3]],
    [[1.9, 0, .12, .3], [1.9, -.15, .55, .32]],
    [[1.9, .15, .55, .3], [2.0, .5, .55, .3], ...Array.from({ length: 22 }, (_, k) => [2.3 + k * .28, .5, .55, .24]), [8.7, .5, .55, .3], [8.8, .15, .55, .33], [4.8, .92, .55, .2], [3.42, .5, .89, .2], [7.28, .5, .21, .2]]
];
const flip = ([x, y, z, r]) => [ARM_LENGTH - x, -y, z, r];
export const ARM_SPHERES = [...half, ...half.slice().reverse().map(list => list.map(flip))];
// Dextre's [x, y, z, radius, on the base] in its body frame (it stands along +y).
export const DEXTRE_SPHERES = [[0, .3, 0, .33, 1], [0, 1.0, 0, .36], [0, 1.4, 0, .36], [0, 1.8, 0, .36], [0, 2.2, 0, .36], [0, 3.1, 0, .3], [-.75, 2.75, 0, .25], [.75, 2.75, 0, .25], [-1.05, 2.75, 0, .25], [1.05, 2.75, 0, .25], [-1.1, 2.0, .03, .2], [1.1, 2.0, .03, .2], [-1.12, 1.25, .05, .2], [1.12, 1.25, .05, .2], [-1.07, .95, .4, .16], [1.07, .95, .4, .16], [-1.02, .62, .72, .2], [1.02, .62, .72, .2], [-1.02, .2, .72, .2], [1.02, .2, .72, .2]];
// How far from its roll axis any part of Dextre's body reaches (its wrists and tool changers, about 1.3 m).
export const DEXTRE_REACH = 1.5;
// Spheres within these distances of a fixture's seat are not counted: end effectors meet fixtures there.
const ARM_SEAT_ZONE = 1.05, DEXTRE_SEAT_ZONE = 1.0;

// The spheres as the chain sees them from either end: from LEE B, chain body j is physical body 7 - j turned by the
// half turn (kinematics.js `bodyFrames`). `local` in the chain body's frame, `link` the chain body, and the pairs of
// spheres three or more bodies apart, which self-collision checks.
function sphereSet(end) {
    const list = [];
    for (let j = 0; j < 8; j++) for (const s of end === 'A' ? ARM_SPHERES[j] : ARM_SPHERES[7 - j].map(flip)) list.push([j, ...s]);
    const set = { count: list.length, link: new Int8Array(list.length), local: new Float64Array(list.length * 3), radius: new Float64Array(list.length) };
    list.forEach(([j, x, y, z, r], i) => { set.link[i] = j; set.local.set([x, y, z], i * 3); set.radius[i] = r; });
    const pairs = [];
    for (let i = 0; i < list.length; i++) for (let k = i + 1; k < list.length; k++) if (Math.abs(list[i][0] - list[k][0]) >= 3) pairs.push(i, k);
    set.pairs = new Int16Array(pairs);
    // REACH[j]: how far any sphere beyond joint j can be from that joint, measured along the chain (each hop lies in one
    // rigid body, so it holds in every pose). Turning joint j by d radians moves no sphere more than REACH[j] × d.
    const point = JOINTS.map(joint => joint.point), hop = k => Math.hypot(point[k + 1][0] - point[k][0], point[k + 1][1] - point[k][1], point[k + 1][2] - point[k][2]);
    set.reach = new Float64Array(7);
    for (let j = 0; j < 7; j++) for (const [link, x, y, z, r] of list) {
        if (link <= j) continue;
        let length = Math.hypot(x - point[link - 1][0], y - point[link - 1][1], z - point[link - 1][2]) + r;
        for (let k = j; k < link - 1; k++) length += hop(k);
        set.reach[j] = Math.max(set.reach[j], length);
    }
    return set;
}
const SETS = { A: sphereSet('A'), B: sphereSet('B') };
export const REACH = SETS.A.reach;
// The same while the arm carries Dextre by its head: Dextre reaches about 3.6 m from the tip's mouth.
export const CARRY_REACH = REACH.map((reach, j) => {
    const point = JOINTS.map(joint => joint.point);
    let length = Math.hypot(ARM_LENGTH - point[6][0], point[6][1], point[6][2]) + 3.6;
    for (let k = j; k < 6; k++) length += Math.hypot(point[k + 1][0] - point[k][0], point[k + 1][1] - point[k][1], point[k + 1][2] - point[k][2]);
    return Math.max(reach, length);
});
const MAX_SPHERES = SETS.A.count;

// A world from built fields: [{ id, kind: 'station' | 'scene' | 'carriage' | 'dextre-base' | 'dextre-body', what,
// field, center, radius, frame }], `center` and `radius` bounding the body's triangles in its own frame, `frame` (scene
// bodies) where it stood when built.
export function createWorld(bodies) {
    const world = { station: null, carriage: null, dextreBase: null, dextreBody: null, scene: [], ready: true };
    for (const body of bodies) {
        const entry = { ...body, at: body.center.slice(), frame: new Float64Array(body.frame || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), inverse: new Float64Array(16) };
        entry.inverse.set(invert(Array.from(entry.frame)));
        if (body.kind === 'scene') world.scene.push(entry);
        else world[{ station: 'station', carriage: 'carriage', 'dextre-base': 'dextreBase', 'dextre-body': 'dextreBody' }[body.kind]] = entry;
    }
    placeBodies(world, {});
    return world;
}
// Where the scene's bodies stand now: frames (body to station, column-major) by body id; bodies left out keep theirs.
export function placeBodies(world, frames) {
    for (const body of world.scene) {
        const m = frames[body.id];
        if (m) { body.frame.set(m); body.inverse.set(invert(Array.from(m))); }
        const f = body.frame, c = body.center;
        body.at[0] = f[0] * c[0] + f[4] * c[1] + f[8] * c[2] + f[12]; body.at[1] = f[1] * c[0] + f[5] * c[1] + f[9] * c[2] + f[13]; body.at[2] = f[2] * c[0] + f[6] * c[1] + f[10] * c[2] + f[14];
    }
}

// The chain frames C0..C7 (kinematics.js `chain`) into `out`, without allocating.
const chainFrames = new Float64Array(8 * 16);
function chainInto(theta, base, F = chainFrames) {
    for (let i = 0; i < 16; i++) F[i] = base[i];
    for (let j = 0; j < 7; j++) {
        const { axis: [ax, ay, az], point: [px, py, pz] } = JOINTS[j], c = Math.cos(theta[j]), s = Math.sin(theta[j]), t = 1 - c;
        const r00 = t * ax * ax + c, r10 = t * ax * ay + s * az, r20 = t * ax * az - s * ay;
        const r01 = t * ax * ay - s * az, r11 = t * ay * ay + c, r21 = t * ay * az + s * ax;
        const r02 = t * ax * az + s * ay, r12 = t * ay * az - s * ax, r22 = t * az * az + c;
        const tx = px - (r00 * px + r01 * py + r02 * pz), ty = py - (r10 * px + r11 * py + r12 * pz), tz = pz - (r20 * px + r21 * py + r22 * pz);
        const m = j * 16, o = m + 16;
        for (let row = 0; row < 3; row++) {
            const a0 = F[m + row], a1 = F[m + 4 + row], a2 = F[m + 8 + row], a3 = F[m + 12 + row];
            F[o + row] = a0 * r00 + a1 * r10 + a2 * r20;
            F[o + 4 + row] = a0 * r01 + a1 * r11 + a2 * r21;
            F[o + 8 + row] = a0 * r02 + a1 * r12 + a2 * r22;
            F[o + 12 + row] = a0 * tx + a1 * ty + a2 * tz + a3;
        }
        F[o + 3] = 0; F[o + 7] = 0; F[o + 11] = 0; F[o + 15] = 1;
    }
    return F;
}
const placed = new Float64Array(MAX_SPHERES * 3), skip = new Uint8Array(MAX_SPHERES), seats = [];
const dextrePoint = [0, 0, 0];
// The distance from (x, y, z) in station coordinates to body `b`, its frame's inverse `m` and the centre of its bound
// `at` in station coordinates: the band when the bound is further than that.
function bodyDistance(b, m, at, x, y, z, pad) {
    const dx = x - at[0], dy = y - at[1], dz = z - at[2], reach = b.radius + b.field.band + pad;
    if (dx * dx + dy * dy + dz * dz > reach * reach) return b.field.band;
    return fieldDistance(b.field, m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
}
const transform = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const carriageInverse = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), carriageAt = [0, 0, 0];
let dextreBaseInverse = null, dextreBodyInverse = null, dextreBaseAt = null, dextreBodyAt = null;
// Details of the tightest place found by the last call with `detail`.
export const tightest = { clearance: Infinity, what: '', body: null, at: [0, 0, 0] };

// The smallest gap (m) between the arm and everything else in `state`: the fixed station, the scene's bodies as
// placed, the base's carriage, Dextre and the arm itself (bodies three or more apart). Readings lose `margin`; scene
// bodies (which move on their own) lose `moving` more. Options: `seats` 'own' (spheres near the base's seat, the held
// fixture's and Dextre's are not counted) or 'all' (near every fixture's, as the pre-built sequences were checked:
// their approaches meet fixtures), `dextre` (also Dextre's own spheres against the station, base and scene),
// `fixed` / `scene` / `self` false to leave those out, `stop` to return as soon as the gap is below it, `detail` to
// fill `tightest`.
export function clearance(world, state, { margin = MARGIN, moving = 0, seats: seatRule = 'own', dextre = false, fixed = true, scene = true, self = true, stop = -Infinity, detail = false } = {}) {
    const base = baseFrame(state), F = chainInto(state.theta, base), set = SETS[state.end], n = set.count;
    for (let i = 0; i < n; i++) {
        const m = set.link[i] * 16, x = set.local[i * 3], y = set.local[i * 3 + 1], z = set.local[i * 3 + 2];
        placed[i * 3] = F[m] * x + F[m + 4] * y + F[m + 8] * z + F[m + 12];
        placed[i * 3 + 1] = F[m + 1] * x + F[m + 5] * y + F[m + 9] * z + F[m + 13];
        placed[i * 3 + 2] = F[m + 2] * x + F[m + 6] * y + F[m + 10] * z + F[m + 14];
    }
    // Seats where spheres are not counted: the base's, the held fixture's (the tip's mouth) and, for Dextre, its own.
    seats.length = 0;
    seats.push(base[12], base[13], base[14]);
    if (state.tip) { const t = 7 * 16; seats.push(F[t] * ARM_LENGTH + F[t + 12], F[t + 1] * ARM_LENGTH + F[t + 13], F[t + 2] * ARM_LENGTH + F[t + 14]); }
    let dextreSeat = null;
    if (seatRule === 'all') for (const id of fixtures.keys()) { const f = fixtureFrame(id, state); seats.push(f[12], f[13], f[14]); }
    else if (state.dextre.on !== 'tip') { const f = fixtureFrame(state.dextre.on, state); dextreSeat = [f[12], f[13], f[14]]; }
    for (let i = 0; i < n; i++) {
        skip[i] = 0;
        for (let k = 0; k < seats.length; k += 3) {
            const dx = placed[i * 3] - seats[k], dy = placed[i * 3 + 1] - seats[k + 1], dz = placed[i * 3 + 2] - seats[k + 2];
            if (dx * dx + dy * dy + dz * dz < ARM_SEAT_ZONE * ARM_SEAT_ZONE) { skip[i] = 1; break; }
        }
    }
    const shift = state.mbs - MBS_HOME, carriage = world.carriage;
    if (carriage) { carriageInverse[12] = -shift; carriageAt[0] = carriage.center[0] + shift; carriageAt[1] = carriage.center[1]; carriageAt[2] = carriage.center[2]; }
    const needDextre = fixed && world.dextreBase;
    let dBody = null, dBase = null;
    if (needDextre || dextre) {
        dBody = dextreBody(state); dBase = multiply(dBody, bodyRoll(-state.dextre.roll));
        dextreBodyInverse = invert(dBody); dextreBaseInverse = invert(dBase);
        if (world.dextreBase) { dextreBaseAt = transform(dBase, world.dextreBase.center); dextreBodyAt = transform(dBody, world.dextreBody.center); }
    }
    let worst = Infinity;
    const note = (value, what, body, x, y, z) => {
        worst = value;
        if (detail) { tightest.clearance = value; tightest.what = what; tightest.body = body; tightest.at[0] = x; tightest.at[1] = y; tightest.at[2] = z; }
    };
    if (detail) tightest.clearance = Infinity;
    for (let i = 0; i < n; i++) {
        if (skip[i]) continue;
        const x = placed[i * 3], y = placed[i * 3 + 1], z = placed[i * 3 + 2], r = set.radius[i] + margin;
        if (fixed) {
            let d = fieldDistance(world.station.field, x, y, z) - r;
            if (d < worst) note(d, 'station', set.link[i], x, y, z);
            if (carriage) { d = bodyDistance(carriage, carriageInverse, carriageAt, x, y, z, r) - r; if (d < worst) note(d, 'base', set.link[i], x, y, z); }
            if (needDextre) {
                d = Math.min(bodyDistance(world.dextreBase, dextreBaseInverse, dextreBaseAt, x, y, z, r), bodyDistance(world.dextreBody, dextreBodyInverse, dextreBodyAt, x, y, z, r)) - r;
                if (d < worst) note(d, 'dextre', set.link[i], x, y, z);
            }
        }
        if (scene) for (const b of world.scene) {
            const d = bodyDistance(b, b.inverse, b.at, x, y, z, r + moving) - r - moving;
            if (d < worst) note(d, b.what, set.link[i], x, y, z);
        }
        if (worst < stop) return worst;
    }
    if (self) {
        const pairs = set.pairs, radius = set.radius;
        for (let p = 0; p < pairs.length; p += 2) {
            const i = pairs[p], k = pairs[p + 1], dx = placed[i * 3] - placed[k * 3], dy = placed[i * 3 + 1] - placed[k * 3 + 1], dz = placed[i * 3 + 2] - placed[k * 3 + 2];
            const reach = radius[i] + radius[k] + worst;
            if (reach <= 0 || dx * dx + dy * dy + dz * dz >= reach * reach) continue;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - radius[i] - radius[k];
            if (d < worst) note(d, 'self', set.link[i] + '/' + set.link[k], placed[i * 3], placed[i * 3 + 1], placed[i * 3 + 2]);
        }
        if (worst < stop) return worst;
    }
    // Dextre against the station, the base and the scene (it does not meet the arm here: the arm's spheres meet its
    // fields above).
    if (dextre) for (const [x0, y0, z0, r0, onBase] of DEXTRE_SPHERES) {
        const m = onBase ? dBase : dBody;
        dextrePoint[0] = m[0] * x0 + m[4] * y0 + m[8] * z0 + m[12]; dextrePoint[1] = m[1] * x0 + m[5] * y0 + m[9] * z0 + m[13]; dextrePoint[2] = m[2] * x0 + m[6] * y0 + m[10] * z0 + m[14];
        const [x, y, z] = dextrePoint, r = r0 + margin;
        let near = false;
        for (let k = 0; k < seats.length && !near; k += 3) near = (x - seats[k]) ** 2 + (y - seats[k + 1]) ** 2 + (z - seats[k + 2]) ** 2 < DEXTRE_SEAT_ZONE * DEXTRE_SEAT_ZONE;
        if (dextreSeat) near ||= (x - dextreSeat[0]) ** 2 + (y - dextreSeat[1]) ** 2 + (z - dextreSeat[2]) ** 2 < DEXTRE_SEAT_ZONE * DEXTRE_SEAT_ZONE;
        if (near) continue;
        if (fixed) {
            const d = Math.min(fieldDistance(world.station.field, x, y, z), carriage ? bodyDistance(carriage, carriageInverse, carriageAt, x, y, z, r) : Infinity) - r;
            if (d < worst) note(d, 'dextre-out', 'dextre', x, y, z);
        }
        if (scene) for (const b of world.scene) {
            const d = bodyDistance(b, b.inverse, b.at, x, y, z, r + moving) - r - moving;
            if (d < worst) note(d, 'dextre-' + b.what, 'dextre', x, y, z);
        }
    }
    return worst;
}
