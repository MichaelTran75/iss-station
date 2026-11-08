// Canadarm2 kinematics: seven revolute joints in one chain, as a product of exponentials. Plain arithmetic, no three.js,
// so the same code poses the model, solves reaches and runs in tests. Matrices are 4 × 4, column-major (as three.js
// keeps them), in plain arrays.
//
// Arm frame, with the arm stretched out and every joint at zero: x along the arm from the mouth of LEE A (0) to the
// mouth of LEE B (17.6 m); the roll joints turn about x, the yaw joints about z, the pitch joints about y. As on the
// SSRMS, the axes meet in pairs: roll meets yaw on the roll line, and the pitch joint sits 0.55 m out along the yaw
// axis; the booms run 0.5 m either side of the roll line along the pitch axes, so they pass side by side at the elbow.
//
// The chain runs from the operating base (the end holding a fixture) to the tip: theta[0..6] are shoulder roll, yaw
// and pitch, elbow pitch, wrist pitch, yaw and roll, as telemetry names them. The arm is the same seen from either end:
// the half turn F about z through its middle takes LEE B to LEE A and each body to its opposite, so with LEE B as the
// base, the body k places from the base sits where body k would with LEE A as the base, times F (see `bodyFrames`).
export const ARM_LENGTH = 17.6, STACK = .55, BOOM_SIDE = .5;
export const JOINTS = [
    { name: 'SR', axis: [1, 0, 0], point: [1.25, 0, 0] },
    { name: 'SY', axis: [0, 0, 1], point: [1.9, 0, 0] },
    { name: 'SP', axis: [0, 1, 0], point: [1.9, 0, STACK] },
    { name: 'EP', axis: [0, 1, 0], point: [8.8, 0, STACK] },
    { name: 'WP', axis: [0, 1, 0], point: [15.7, 0, STACK] },
    { name: 'WY', axis: [0, 0, 1], point: [15.7, 0, 0] },
    { name: 'WR', axis: [1, 0, 0], point: [16.35, 0, 0] }
];
// Every SSRMS joint turns ±270 degrees.
export const LIMIT = 270 * Math.PI / 180;
export const TIP = [ARM_LENGTH, 0, 0];

export const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function multiply(a, b, out = new Array(16)) {
    const r = new Array(16);
    for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
        r[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
    }
    for (let i = 0; i < 16; i++) out[i] = r[i];
    return out;
}
export const apply = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
export const turn = (m, d) => [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]];
// A rigid transform's inverse.
export function invert(m) {
    const t = [m[12], m[13], m[14]];
    const r = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1];
    const p = turn(r, t); r[12] = -p[0]; r[13] = -p[1]; r[14] = -p[2];
    return r;
}
// A frame from its origin and its x, y and z axes (unit, right-handed).
export const frame = (origin, x, y, z) => [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, origin[0], origin[1], origin[2], 1];
// A turn by `angle` about the line through `point` along the unit `axis`.
export function screw(axis, point, angle) {
    const [x, y, z] = axis, c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
    const m = [t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0, t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0, t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0, 0, 0, 0, 1];
    const moved = turn(m, point); m[12] = point[0] - moved[0]; m[13] = point[1] - moved[1]; m[14] = point[2] - moved[2];
    return m;
}
// The half turn that swaps the ends: (x, y, z) to (17.6 - x, -y, z).
export const FLIP = [-1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, ARM_LENGTH, 0, 0, 1];
// The same pose described from the other end: roll and pitch keep their sense under the flip, yaw reverses.
export const reverse = theta => [theta[6], -theta[5], theta[4], theta[3], theta[2], -theta[1], theta[0]];

// The eight chain frames C0 (the base body, `base` itself) to C7 (the tip body) for joint angles `theta`.
export function chain(theta, base) {
    const frames = [base.slice()];
    let m = base.slice();
    for (let i = 0; i < 7; i++) { m = multiply(m, screw(JOINTS[i].axis, JOINTS[i].point, theta[i])); frames.push(m.slice()); }
    return frames;
}
// Each physical body's frame, LEE A's end first: with LEE B as the base the chain runs the other way.
export function bodyFrames(theta, base, end) {
    const frames = chain(theta, base);
    return end === 'A' ? frames : frames.reverse().map(m => multiply(m, FLIP));
}
// The tip's grapple frame for a chain tip body frame: as a base frame (`seat` in fixtures.js) is to the base body.
export const tipSeat = tipBody => multiply(tipBody, FLIP);

// Damped least squares toward a tip body frame `target` (the chain's C7), from `start`. Position is matched at the tip
// mouth, orientation by the three axes; with seven joints for six constraints, the spare freedom drifts toward
// `prefer` (default: the start) without disturbing the tip. Returns the angles and the residual (m, rad).
export function reach(target, start, base, { iterations = 400, prefer = start, tolerance = 1e-5, damping = .25, orientationWeight = 4 } = {}) {
    const theta = start.slice(), goal = apply(target, TIP);
    let positionError = Infinity, orientationError = Infinity;
    for (let step = 0; step < iterations; step++) {
        const frames = chain(theta, base), tipBody = frames[7], tip = apply(tipBody, TIP);
        const e = [goal[0] - tip[0], goal[1] - tip[1], goal[2] - tip[2], 0, 0, 0];
        for (let column = 0; column < 3; column++) {
            const have = [tipBody[column * 4], tipBody[column * 4 + 1], tipBody[column * 4 + 2]], want = [target[column * 4], target[column * 4 + 1], target[column * 4 + 2]];
            e[3] += .5 * (have[1] * want[2] - have[2] * want[1]); e[4] += .5 * (have[2] * want[0] - have[0] * want[2]); e[5] += .5 * (have[0] * want[1] - have[1] * want[0]);
        }
        positionError = Math.hypot(e[0], e[1], e[2]); orientationError = Math.hypot(e[3], e[4], e[5]);
        if (positionError < tolerance && orientationError < tolerance) break;
        for (let k = 3; k < 6; k++) e[k] *= orientationWeight;
        // Jacobian columns: each joint's axis and point in the world, from the frame before it.
        const J = [];
        for (let i = 0; i < 7; i++) {
            const w = turn(frames[i], JOINTS[i].axis), p = apply(frames[i], JOINTS[i].point), r = [tip[0] - p[0], tip[1] - p[1], tip[2] - p[2]];
            J.push([w[1] * r[2] - w[2] * r[1], w[2] * r[0] - w[0] * r[2], w[0] * r[1] - w[1] * r[0], w[0] * orientationWeight, w[1] * orientationWeight, w[2] * orientationWeight]);
        }
        // dtheta = J^T (J J^T + l^2 I)^-1 e, plus the drift toward `prefer` projected out of what the tip feels.
        const A = Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (_, c) => J.reduce((sum, column) => sum + column[r] * column[c], r === c ? damping * damping : 0)));
        const y = solve6(A, e), move = J.map(column => column.reduce((sum, value, r) => sum + value * y[r], 0));
        const drift = theta.map((value, i) => .05 * wrap(prefer[i] - value)), felt = J.map(() => 0);
        const Jd = [0, 1, 2, 3, 4, 5].map(r => J.reduce((sum, column, i) => sum + column[r] * drift[i], 0)), yd = solve6(A, Jd);
        for (let i = 0; i < 7; i++) felt[i] = J[i].reduce((sum, value, r) => sum + value * yd[r], 0);
        for (let i = 0; i < 7; i++) theta[i] = Math.max(-LIMIT, Math.min(LIMIT, theta[i] + move[i] + drift[i] - felt[i]));
    }
    return { theta, positionError, orientationError };
}
const wrap = angle => angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI));
// Gaussian elimination with partial pivoting for the small symmetric system above.
function solve6(A, b) {
    const n = b.length, m = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
        let pivot = c; for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
        [m[c], m[pivot]] = [m[pivot], m[c]];
        for (let r = c + 1; r < n; r++) { const f = m[r][c] / m[c][c]; for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k]; }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let sum = m[r][n]; for (let k = r + 1; k < n; k++) sum -= m[r][k] * x[k]; x[r] = sum / m[r][r]; }
    return x;
}
