// Falcon 9 ascent with Crew Dragon, from the pad to Dragon's separation and the opening of its nose cone. Pure model,
// no drawing: times, events, the flight path and the animation's time warp.
// - Event times are NASA's published Demo-2 timeline (30 May 2020, LC-39A, booster landing on the droneship).
// - Altitude, downrange distance and speed come from the webcast telemetry of DM-1 (2 March 2019: same pad, same
//   orbit, same droneship profile; shahar603/Telemetry-Data, public domain), compressed 3.5% in time so its engine
//   cutoffs fall on Demo-2's. The speed is the webcast's, relative to the ground.
// - The ground track leaves the pad on a 44.5° azimuth (north-east, up the US east coast to the ISS's 51.6° orbit).
// Distances in metres in the pad's local frame: x east, y up, z south, origin on the ground at the pad.

export const launchSite = { name: 'LC-39A', latitude: 28.60822, longitude: -80.60411, azimuth: 44.5 };
export const launchEpoch = Date.UTC(2020, 4, 30, 19, 22, 45);   // Demo-2 liftoff, 15:22:45 EDT
const earthRadius = 6371000;

// DM-1 telemetry samples [time s, speed m/s, altitude km, downrange km]; the last row continues the second stage's
// last measured acceleration to its cutoff.
const telemetry = [[0, 0, 0, 0], [10, 34.1, .178, .07], [20, 81.4, .747, .221], [30, 136.4, 1.828, .446], [45, 227.9, 4.585, 1], [60, 286.5, 8.338, 1.842],
    [75, 385.3, 13.138, 3.118], [90, 560.6, 19.903, 5.347], [105, 778.6, 29.233, 9.13], [120, 1049.7, 41.384, 15.495], [135, 1385.8, 56.611, 25.586],
    [150, 1714.7, 74.605, 40.295], [155, 1839.2, 81.2, 46.306], [160, 1870.6, 88.05, 52.69], [170, 1822.2, 101.117, 65.595], [180, 1837.4, 113.743, 78.84],
    [200, 1879.8, 137.462, 107.377], [220, 1935.4, 158.534, 139.088], [240, 2016, 176.161, 174.289], [270, 2216.4, 196.29, 234.167], [300, 2491.9, 209.868, 303.261],
    [330, 2829.7, 217.796, 382.514], [360, 3226.1, 220.731, 473.143], [390, 3685.8, 219.574, 576.638], [420, 4218.6, 215.43, 694.931], [450, 4850.6, 209.815, 830.568],
    [480, 5563.3, 204.201, 986.561], [510, 6434.7, 199.496, 1165.828], [520, 6778.9, 198.437, 1231.851], [530, 7082.8, 197.738, 1301.161], [546, 7580, 197.3, 1418]];
const compress = 527 / 546;   // DM-1 seconds to Demo-2 seconds
const samples = telemetry.map(([t, speed, altitude, downrange]) => [t * compress, speed, altitude * 1000, downrange * 1000]);

export const events = [
    { at: -3, key: 'ignition', label: 'ENGINE IGNITION' },
    { at: 0, key: 'liftoff', label: 'LIFTOFF' },
    { at: 58, key: 'maxq', label: 'MAX-Q' },
    { at: 153, key: 'meco', label: 'MAIN ENGINE CUTOFF' },
    { at: 156, key: 'separation', label: 'STAGE SEPARATION' },
    { at: 164, key: 'ses', label: 'SECOND-STAGE IGNITION' },
    { at: 435, key: 'entry', label: 'BOOSTER ENTRY BURN' },
    { at: 527, key: 'seco', label: 'SECOND-STAGE CUTOFF' },
    { at: 562, key: 'landing', label: 'BOOSTER LANDS ON DRONESHIP' },
    { at: 720, key: 'dragon', label: 'DRAGON SEPARATION' },
    { at: 766, key: 'nosecone', label: 'NOSE CONE OPENS' }
];
export const eventAt = key => events.find(event => event.key === key).at;
export const countdown = -10, ascentDuration = 800;   // the view opens ten seconds before liftoff

// Time warp by stretch of the flight: real time at liftoff and round each separation, faster in between.
const warps = [[countdown, 1], [20, 6], [140, 1.5], [180, 16], [500, 3], [540, 17], [708, 2.5]];
export function warpAt(mission) { let warp = 1; for (const [from, value] of warps) if (mission >= from) warp = value; return warp; }
// Animation seconds to mission seconds and back.
const marks = [[0, countdown]];
for (let k = 1; k <= warps.length; k++) {
    const [from, warp] = warps[k - 1], to = k < warps.length ? warps[k][0] : ascentDuration;
    marks.push([marks[k - 1][0] + (to - from) / warp, to]);
}
export const animationDuration = marks[marks.length - 1][0];
export function missionAt(animation) {
    for (let k = 1; k < marks.length; k++) if (animation <= marks[k][0]) { const [a0, m0] = marks[k - 1], [a1, m1] = marks[k]; return m0 + (animation - a0) / (a1 - a0) * (m1 - m0); }
    return ascentDuration;
}
export function animationAt(mission) {
    for (let k = 1; k < marks.length; k++) if (mission <= marks[k][1]) { const [a0, m0] = marks[k - 1], [a1, m1] = marks[k]; return a0 + (mission - m0) / (m1 - m0) * (a1 - a0); }
    return animationDuration;
}

// Monotone cubic (Fritsch-Carlson) through the samples, so the climb never overshoots between rows.
function monotone(column) {
    const n = samples.length, x = samples.map(row => row[0]), y = samples.map(row => row[column]), slope = [], tangent = [];
    for (let k = 0; k < n - 1; k++) slope.push((y[k + 1] - y[k]) / (x[k + 1] - x[k]));
    tangent.push(slope[0]);
    for (let k = 1; k < n - 1; k++) tangent.push(slope[k - 1] * slope[k] <= 0 ? 0 : (slope[k - 1] + slope[k]) / 2);
    tangent.push(slope[n - 2]);
    for (let k = 0; k < n - 1; k++) {
        if (slope[k] === 0) { tangent[k] = tangent[k + 1] = 0; continue; }
        const a = tangent[k] / slope[k], b = tangent[k + 1] / slope[k], h = a * a + b * b;
        if (h > 9) { const t = 3 / Math.sqrt(h); tangent[k] = t * a * slope[k]; tangent[k + 1] = t * b * slope[k]; }
    }
    return time => {
        if (time <= x[0]) return y[0];
        if (time >= x[n - 1]) return y[n - 1] + tangent[n - 1] * (time - x[n - 1]);
        let k = 0; while (time > x[k + 1]) k++;
        const h = x[k + 1] - x[k], s = (time - x[k]) / h, s2 = s * s, s3 = s2 * s;
        return (2 * s3 - 3 * s2 + 1) * y[k] + (s3 - 2 * s2 + s) * h * tangent[k] + (-2 * s3 + 3 * s2) * y[k + 1] + (s3 - s2) * h * tangent[k + 1];
    };
}
const speedAt = monotone(1), altitudeAt = monotone(2), downrangeAt = monotone(3);
const seco = eventAt('seco');
// After cutoff Dragon and the second stage coast on in orbit, near 197 km.
const coastSpeed = 7580;
export function flight(mission) {
    if (mission <= seco) return { altitude: Math.max(0, altitudeAt(mission)), downrange: Math.max(0, downrangeAt(mission)), speed: Math.max(0, speedAt(mission)) };
    return { altitude: altitudeAt(seco), downrange: downrangeAt(seco) + coastSpeed * (mission - seco), speed: coastSpeed };
}

// A point `downrange` metres along the ground track and `altitude` up, in the pad's local frame (Earth's curvature
// included: by second-stage cutoff the vehicle is 1,400 km out and the pad is far below its horizon).
const rad = Math.PI / 180, azimuth = launchSite.azimuth * rad;
export function trackPoint(downrange, altitude, target = [0, 0, 0]) {
    const angle = downrange / earthRadius, r = earthRadius + altitude;
    // In the pad's frame: up is y; the track's direction on the ground is (sin az east, cos az north).
    const along = r * Math.sin(angle), up = r * Math.cos(angle) - earthRadius;
    target[0] = along * Math.sin(azimuth); target[1] = up; target[2] = -along * Math.cos(azimuth);
    return target;
}
// Where the vehicle is and which way it flies (unit vector), at a mission time.
export function vehicleState(mission) {
    const now = flight(mission), position = trackPoint(now.downrange, now.altitude);
    const step = mission < 12 ? 0 : 1, ahead = flight(mission + 1), behind = flight(Math.max(0, mission - step));
    let direction;
    if (mission < 12) direction = [0, 1, 0];   // straight up off the pad
    else {
        const a = trackPoint(ahead.downrange, ahead.altitude), b = trackPoint(behind.downrange, behind.altitude);
        direction = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        const length = Math.hypot(...direction); direction = direction.map(value => value / length);
        // Ease from vertical into the pitch-over between 12 and 22 s.
        const blend = Math.min(1, (mission - 12) / 10);
        direction = [direction[0] * blend, direction[1] * blend + (1 - blend), direction[2] * blend];
        const norm = Math.hypot(...direction); direction = direction.map(value => value / norm);
    }
    return { ...now, position, direction };
}
// The pad's local frame on the globe: east, up and south in Earth-fixed coordinates (x toward 0° longitude on the
// equator, y toward 90° E, z north), and the pad's position, in metres.
export function padFrame() {
    const phi = launchSite.latitude * rad, lambda = launchSite.longitude * rad;
    const east = [-Math.sin(lambda), Math.cos(lambda), 0];
    const north = [-Math.sin(phi) * Math.cos(lambda), -Math.sin(phi) * Math.sin(lambda), Math.cos(phi)];
    const up = [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
    return { east, up, south: north.map(value => -value), position: up.map(value => value * earthRadius) };
}
