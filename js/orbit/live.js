// ISS Live: NASA's public telemetry feed (Lightstreamer, adapter ISSLIVE), about once a second while a ground station
// is in contact (AOS). It gives the station's own rotary-joint angles and attitude, which the page then shows in place
// of the computed ones (js/ui/controller.js). Loaded on demand: the Lightstreamer client is a classic script from unpkg.
//
// Conventions (fitted to the telemetry, 0.3 degrees residual; not an official definition). Body frame: x forward, y
// starboard, z nadir; s the unit vector to the Sun. Port SARJ reads a = atan2(s_x, -s_z) (0: cells to zenith) and the
// starboard one 360 - a. Each BGA reads from p = asin(s_y): 2A and 4B 90 - p, 4A and 2B 270 + p, 1A and 3B 90 + p,
// 3A and 1B 270 - p. The attitude is a quaternion (scalar first) between the local-vertical frame and the body. Each
// TRRJ turns its radiator wing about the wing's aft-pointing long axis; both read the same way, which this page takes
// as a right-handed turn about that aft axis, positive tipping the zenith edge to port (inferred, not documented: under
// it the parked angles in ISS Mimic's recordings leave the two wings near parallel, and the starboard wing of loop A,
// the loop with less ammonia, edge to the Sun now).
const clientScript = 'https://unpkg.com/lightstreamer-client-web@9.2.3/lightstreamer.min.js';
const items = {
    S0000004: 'sarjPort', S0000003: 'sarjStarboard', S0000008: 'sarjPortMode', S0000009: 'sarjStarboardMode',
    S4000007: '1A', S4000008: '3A', S6000008: '1B', S6000007: '3B', P4000007: '2A', P4000008: '4A', P6000008: '2B', P6000007: '4B',
    S0000002: 'trrjPort', S0000001: 'trrjStarboard', S0000006: 'trrjPortMode', S0000007: 'trrjStarboardMode',
    USLAB000018: 'q0', USLAB000019: 'q1', USLAB000020: 'q2', USLAB000021: 'q3', USLAB000040: 'beta'
};
export const live = { state: 'off', values: {}, aos: false, stationTime: 0, received: 0, convention: null };
let client = null, loading = null;
function loadClient() {
    return loading ||= new Promise((resolve, reject) => {
        if (window.LightstreamerClient) { resolve(); return; }
        const script = document.createElement('script'); script.src = clientScript; script.async = true;
        script.onload = () => resolve(); script.onerror = () => { loading = null; reject(new Error('Lightstreamer client did not load')); };
        document.head.appendChild(script);
    });
}
// Station clock: hours since 00:00 UTC on 31 December of the previous year.
const stationDate = hours => Date.UTC(new Date().getUTCFullYear() - 1, 11, 31) + hours * 3600000;
export async function startLive() {
    if (live.state === 'on' || live.state === 'connecting') return;
    live.state = 'connecting';
    try { await loadClient(); } catch (error) { live.state = 'failed'; console.warn('ISS Live unavailable:', error); return; }
    if (live.state !== 'connecting') return;   // stopped while the client loaded
    client = new window.LightstreamerClient('https://push.lightstreamer.com', 'ISSLIVE');
    const values = new window.Subscription('MERGE', Object.keys(items), ['TimeStamp', 'Value']);
    values.addListener({ onItemUpdate(update) {
        const name = items[update.getItemName()], value = parseFloat(update.getValue('Value'));
        if (name && Number.isFinite(value)) { live.values[name] = value; live.received = Date.now(); }
    } });
    const signal = new window.Subscription('MERGE', ['TIME_000001'], ['TimeStamp', 'Value', 'Status.Class']);
    signal.addListener({ onItemUpdate(update) {
        live.aos = update.getValue('Status.Class') === '24';
        const hours = parseFloat(update.getValue('TimeStamp')); if (Number.isFinite(hours)) live.stationTime = stationDate(hours);
    } });
    client.addListener({ onStatusChange(status) { if (status.startsWith('CONNECTED')) live.state = 'on'; else if (status === 'DISCONNECTED' && live.state !== 'off') live.state = 'connecting'; } });
    client.subscribe(values); client.subscribe(signal); client.connect();
}
export function stopLive() { live.state = 'off'; live.aos = false; client?.disconnect(); client = null; }
// Heard at least once this session, and fresh: in contact and heard from within the last 10 s.
export const liveHeard = () => ['sarjPort', 'sarjStarboard'].every(name => name in live.values);
export const liveFresh = () => live.state === 'on' && live.aos && Date.now() - live.received < 10000 && liveHeard();

const toRadians = Math.PI / 180;
// Joint angles in the page's terms: each SARJ's turn about the station's +x axis, each wing's BGA turn about its mast
// (-p, as for the computed Sun: js/orbit/sun-track.js) and each radiator wing's TRRJ turn about +z (aft); a TRRJ not yet
// heard is left out.
export function liveJoints() {
    const v = live.values, phi = { '2A': 90 - v['2A'], '4B': 90 - v['4B'], '4A': v['4A'] - 270, '2B': v['2B'] - 270, '1A': v['1A'] - 90, '3B': v['3B'] - 90, '3A': 270 - v['3A'], '1B': 270 - v['1B'] };
    const bga = {}; for (const [channel, value] of Object.entries(phi)) if (Number.isFinite(value)) bga[channel] = -value * toRadians;
    const trrj = {}; if (Number.isFinite(v.trrjPort)) trrj.port = v.trrjPort * toRadians; if (Number.isFinite(v.trrjStarboard)) trrj.starboard = v.trrjStarboard * toRadians;
    return { port: -v.sarjPort * toRadians, starboard: v.sarjStarboard * toRadians, bga, trrj };
}
// The telemetered attitude as a turn from the +XVV frame to the station's (js/orbit/attitude.js). Which way the
// quaternion turns is settled against whichever SARJ is tracking the Sun (mode 5), from the computed +XVV Sun.
function turn(q, v, inverse) {
    const [w, x, y, z] = q, s = inverse ? -1 : 1;
    const r = [[1 - 2 * (y * y + z * z), 2 * (x * y - s * w * z), 2 * (x * z + s * w * y)], [2 * (x * y + s * w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - s * w * x)], [2 * (x * z - s * w * y), 2 * (y * z + s * w * x), 1 - 2 * (x * x + y * y)]];
    return r.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
}
const wrap = degrees => ((degrees % 360) + 540) % 360 - 180;
// Out of contact the last data are carried forward: a SARJ that was tracking (mode 5) keeps tracking the predicted Sun,
// a wing whose BGA sat within 5 degrees of the Sun's keeps doing so, and the rest hold their last angles.
export function livePose(sun, fresh) {
    const joints = liveJoints();
    if (fresh) return joints;
    const v = live.values, sarj = Math.atan2(sun[2], sun[1]), tip = Math.atan2(-sun[0], Math.hypot(sun[1], sun[2]));
    if (v.sarjPortMode === 5) joints.port = sarj;
    if (v.sarjStarboardMode === 5) joints.starboard = sarj;
    for (const channel in joints.bga) if (Math.abs(wrap((joints.bga[channel] - tip) / toRadians)) < 5) joints.bga[channel] = tip;
    return joints;
}
export function liveTurn(xvvSun) {
    const v = live.values, raw = [v.q0, v.q1, v.q2, v.q3];
    if (!raw.every(Number.isFinite) || Math.hypot(...raw) < .5) return null;
    const size = Math.hypot(...raw), q = raw.map(component => component / size);
    // +XVV station components to LVLH (x forward, y starboard, z nadir), and body components back to the station's.
    const toLvlh = s => [-s[2], s[0], -s[1]], toStation = b => [b[1], -b[2], -b[0]];
    const tracking = v.sarjPortMode === 5 ? v.sarjPort : v.sarjStarboardMode === 5 ? 360 - v.sarjStarboard : null;
    if (tracking !== null) {
        // A fit worse than 10 degrees either way means the computed Sun or the quaternion is stale: keep the last way.
        const miss = inverse => { const b = turn(q, toLvlh(xvvSun), inverse); return Math.abs(wrap(Math.atan2(b[0], -b[2]) / toRadians - tracking)); };
        live.miss = Math.min(miss(false), miss(true));
        if (live.miss < 10) live.convention = miss(false) <= miss(true) ? 'direct' : 'inverse';
    }
    // Until a tracking SARJ settles it, the way found against the port SARJ on 6 November 2026 (inverse, 0.75 degrees).
    const inverse = live.convention !== 'direct', columns = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(axis => toStation(turn(q, toLvlh(axis), inverse)));
    return [0, 1, 2].flatMap(row => columns.map(column => column[row]));
}
