// Falcon 9 with Crew Dragon, from the pad to orbit, and its booster's flight back to the droneship: a point-mass
// flight simulation, run once when the Launch view loads (about 25,000 steps). Pure model, no drawing.
// - Forces: nine Merlin 1D (914 kN and Isp 311 s in vacuum each, less 0.68 m² of nozzle exit times the air pressure),
//   the vacuum Merlin (981 kN, Isp 348 s), drag by Mach number on a 3.66 m body, gravity, in an inertial frame with
//   Earth turning under it; US Standard Atmosphere 1976. Mass falls as propellant burns.
// - Masses: first stage 25.6 t dry with 405 t of propellant, second stage 4 t with 107.5 t, Crew Dragon 12.5 t
//   (549 t at liftoff, as published).
// - Guidance: straight up for 10 s, a 1.9° pitch-over toward 31.6° (north-east of the ground), then a gravity turn
//   (thrust along the air-relative velocity). Throttled to 72% through Max-Q and held to 3.1 g for the crew. The second
//   stage steers by a linear-tangent law and cuts off on reaching its orbit. Fitted so cutoffs land on NASA's Demo-2
//   times and the climb on DM-1's webcast telemetry (shahar603/Telemetry-Data): at main engine cutoff 86.7 km and
//   1,888 m/s against 88 km and 1,871 m/s; orbit 202 × 216 km at 51.64°.
// - The booster: pushed 1 m/s off at separation, coasts and flips, fires three engines as it falls back through 70 km
//   (entry burn), falls tail-first with its grid fins out, and fires one engine to land, lit when that would just stop
//   it at the deck (a hoverslam: one Merlin cannot throttle below hover). Where it comes down is the droneship.
// Commanded times (cutoff, separations, nose cone) follow NASA's Demo-2 timeline; Max-Q, second-stage cutoff and the
// booster's burns and landing are where the simulation puts them.
// Output in the pad's local frame (metres; x east, y up, z south; origin on the ground at the pad, turning with Earth).

export const launchSite = { name: 'LC-39A', latitude: 28.60822, longitude: -80.60411 };
export const launchEpoch = Date.UTC(2020, 4, 30, 19, 22, 45);   // Demo-2 liftoff, 15:22:45 EDT
const mu = 3.986004418e14, R = 6371000, omega = 7.2921159e-5, g0 = 9.80665, rad = Math.PI / 180;
export const vehicle = {
    s1Dry: 25600, s1Prop: 405000, s2Dry: 4000, s2Prop: 107500, payload: 12500, area: 10.52,
    merlinVac: 914e3, merlinIsp: 311, merlinExit: .681, mvacVac: 981e3, mvacIsp: 348
};
const guidance = {
    kick: 1.9, kickStart: 10, kickEnd: 20, azimuth: 31.6424, bucket: [38, 70, .72], gLimit: 3.1,
    meco: 153, separation: 156, ses: 164, pitch0: 5.96134, pitchRate: -.000271072, orbit: [202e3, 216e3],
    entryAltitude: 70e3, entryLength: 20, tailArea: 1.6, landingCap: 6000, dragon: 720, nosecone: 766, end: 800
};

// US Standard Atmosphere 1976: [km, density kg/m³, pressure Pa, speed of sound m/s], log-linear between rows.
const atmosphere = [[0, 1.225, 101325, 340.3], [5, .7364, 54048, 320.5], [10, .4135, 26500, 299.5], [15, .1948, 12111, 295.1], [20, .08891, 5529, 295.1],
    [25, .04008, 2549, 298.4], [30, .01841, 1197, 301.7], [40, .003996, 287.1, 317.2], [50, .001027, 79.78, 329.8], [60, 3.097e-4, 21.96, 314.1],
    [70, 8.283e-5, 5.221, 297.1], [80, 1.846e-5, 1.052, 282.5], [90, 3.416e-6, .1836, 274.1], [100, 5.604e-7, .032, 274], [120, 2.222e-8, .0025, 274],
    [150, 2.076e-9, 4.5e-4, 274], [200, 2.541e-10, 8.5e-5, 274]];
export function air(height) {
    const km = height / 1000;
    if (km <= 0) return { rho: 1.225, p: 101325, a: 340.3 };
    if (km >= 200) return { rho: 0, p: 0, a: 274 };
    let k = 0; while (atmosphere[k + 1][0] < km) k++;
    const [k0, r0, p0, a0] = atmosphere[k], [k1, r1, p1, a1] = atmosphere[k + 1], f = (km - k0) / (k1 - k0);
    return { rho: r0 * Math.pow(r1 / r0, f), p: p0 * Math.pow(p1 / p0, f), a: a0 + (a1 - a0) * f };
}
// Drag coefficient by Mach number: nose first (the stack), and tail first with the grid fins out (the booster).
const cdNose = [[0, .3], [.8, .34], [1, .52], [1.2, .58], [2, .44], [3, .36], [5, .3], [10, .28]];
const cdTail = [[0, .9], [.8, 1], [1, 1.25], [1.3, 1.35], [2, 1.2], [4, 1.05], [10, 1]];
function table(rows, x) {
    if (x <= rows[0][0]) return rows[0][1];
    for (let k = 1; k < rows.length; k++) if (x <= rows[k][0]) { const f = (x - rows[k - 1][0]) / (rows[k][0] - rows[k - 1][0]); return rows[k - 1][1] + f * (rows[k][1] - rows[k - 1][1]); }
    return rows[rows.length - 1][1];
}
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => scale(a, 1 / (length(a) || 1));
const spin = [0, 0, omega];
const airVelocity = s => add(s.v, cross(spin, s.r), -1);

// The simulation. Inertial frame: z north, the pad on the x-z plane at liftoff.
const phi = launchSite.latitude * rad, padStart = [R * Math.cos(phi), 0, R * Math.sin(phi)];
function simulate() {
    const v = vehicle, p = guidance, step = .05, keep = 4;   // samples every 0.2 s
    const mdotMerlin = v.merlinVac / (v.merlinIsp * g0), mdotMvac = v.mvacVac / (v.mvacIsp * g0);
    const heading = (r, azimuth) => { const up = unit(r), east = unit(cross([0, 0, 1], up)), north = cross(up, east); return add(scale(east, Math.sin(azimuth * rad)), north, Math.cos(azimuth * rad)); };
    // Forces on a state for a mode: { engines, vacuum, throttle, direction(state, airVelocity, up), tail }.
    function derivative(s, mode, info) {
        const h = length(s.r) - R, atm = air(h), up = unit(s.r), vAir = airVelocity(s), speed = length(vAir);
        const gravity = scale(s.r, -mu / Math.pow(length(s.r), 3));
        let thrust = [0, 0, 0], mdot = 0;
        if (mode.engines) {
            const force = mode.vacuum ? v.mvacVac * mode.throttle : mode.engines * (v.merlinVac * mode.throttle - v.merlinExit * atm.p);
            mdot = mode.vacuum ? mdotMvac * mode.throttle : mode.engines * mdotMerlin * mode.throttle;
            thrust = scale(mode.direction(s, vAir, up), force);
        }
        const q = .5 * atm.rho * speed * speed, cd = table(mode.tail ? cdTail : cdNose, speed / atm.a), area = v.area * (mode.tail ? p.tailArea : 1);
        const drag = speed > 0 ? scale(vAir, -q * cd * area / speed) : [0, 0, 0];
        const felt = add(scale(thrust, 1 / s.m), scale(drag, 1 / s.m));
        if (info) Object.assign(info, { q, load: length(felt) / g0, thrust: length(thrust) });
        return { r: s.v, v: add(gravity, felt), m: -mdot };
    }
    function rk4(s, mode, info) {
        const k1 = derivative(s, mode, info), at = (k, f) => ({ r: add(s.r, k.r, f), v: add(s.v, k.v, f), m: s.m + k.m * f });
        const k2 = derivative(at(k1, step / 2), mode), k3 = derivative(at(k2, step / 2), mode), k4 = derivative(at(k3, step), mode);
        return { r: add(s.r, add(add(k1.r, k2.r, 2), add(k3.r, k4.r, 2)), step / 6), v: add(s.v, add(add(k1.v, k2.v, 2), add(k3.v, k4.v, 2)), step / 6), m: s.m + (k1.m + 2 * k2.m + 2 * k3.m + k4.m) * step / 6 };
    }
    const orbit = s => {
        const r = length(s.r), speed = length(s.v), a = -mu / (2 * (speed * speed / 2 - mu / r)), hv = cross(s.r, s.v), e = Math.sqrt(Math.max(0, 1 - dot(hv, hv) / (mu * a)));
        return { a, perigee: a * (1 - e) - R, apogee: a * (1 + e) - R, inclination: Math.acos(hv[2] / length(hv)) / rad };
    };
    const targetA = R + (p.orbit[0] + p.orbit[1]) / 2;
    const stack = [], booster = [];
    let s = { r: padStart.slice(), v: cross(spin, padStart), m: v.s1Dry + v.s1Prop + v.s2Dry + v.s2Prop + v.payload };
    let attitude = unit(padStart), seco = null, maxQ = { q: 0, at: 0 }, reserve = 0, separated = null, insertion = null;
    for (let k = 0; ; k++) {
        const t = k * step;
        if (t > p.end + 1e-9) break;
        let mode = { engines: 0 }, throttle = 1;
        if (t < p.meco) {
            const atm = air(length(s.r) - R), full = 9 * (v.merlinVac - v.merlinExit * atm.p);
            throttle = Math.max(.4, Math.min(t > p.bucket[0] && t < p.bucket[1] ? p.bucket[2] : 1, p.gLimit * g0 * s.m / full));
            mode = { engines: 9, throttle, direction: (st, vAir, up) => {
                if (t < p.kickStart) return up;
                if (t < p.kickEnd) { const angle = p.kick * rad * (t - p.kickStart) / (p.kickEnd - p.kickStart); return unit(add(scale(up, Math.cos(angle)), heading(st.r, p.azimuth), Math.sin(angle))); }
                return unit(vAir);
            } };
        } else if (t >= p.ses && seco === null) {
            mode = { engines: 1, vacuum: true, throttle: 1, direction: (st, vAir, up) => {
                const level = unit(add(st.v, up, -dot(st.v, up))), pitch = Math.atan(Math.tan(p.pitch0 * rad) - p.pitchRate * (t - p.ses));
                return unit(add(scale(level, Math.cos(pitch)), up, Math.sin(pitch)));
            } };
        }
        if (mode.engines) attitude = mode.direction(s, airVelocity(s), unit(s.r));
        const info = {};
        s = rk4(s, mode, info);
        if (t < p.meco && info.q > maxQ.q) maxQ = { q: info.q, at: t };
        const now = t + step;
        if (Math.abs(now - p.meco) < step / 2) reserve = s.m - v.s1Dry - v.s2Dry - v.s2Prop - v.payload;
        if (Math.abs(now - p.separation) < step / 2) {
            separated = { r: s.r.slice(), v: add(s.v, attitude, -1), m: v.s1Dry + reserve, attitude: attitude.slice() };   // pushers: 1 m/s apart
            s.m -= v.s1Dry + reserve;
        }
        if (now >= p.ses && seco === null && orbit(s).a >= targetA) { seco = now; insertion = orbit(s); }
        if (k % keep === keep - 1) stack.push({ t: now, r: s.r, v: s.v, m: s.m, q: info.q, load: info.load, engines: mode.engines ? (mode.vacuum ? -1 : 9 * throttle) : 0, attitude });
    }
    // The booster's own flight.
    let b = separated, entry = null, landingStart = null, landing = null, apogee = 0;
    const retro = st => scale(unit(airVelocity(st)), -1);
    for (let k = 0; b && !landing; k++) {
        const t = guidance.separation + k * step;
        if (t > p.end) break;
        const h = length(b.r) - R, vAir = airVelocity(b), speed = length(vAir), descent = -dot(vAir, unit(b.r));
        apogee = Math.max(apogee, h);
        let mode = { engines: 0, tail: t > p.separation + 30 }, burning = 0;
        if (entry === null && descent > 0 && h < p.entryAltitude) entry = t;
        if (entry !== null && t < entry + p.entryLength) { mode = { engines: 3, throttle: 1, tail: true, direction: retro }; burning = 3; }
        else if (entry !== null) {
            const atm = air(h), oneEngine = v.merlinVac - v.merlinExit * atm.p, g = mu / Math.pow(length(b.r), 2);
            const stopping = speed * speed / (2 * Math.max(.5, .85 * oneEngine / b.m - g));
            if (landingStart === null && h < p.landingCap && descent > 0 && h < 1.15 * stopping) landingStart = t;
            if (landingStart !== null) {
                const need = (speed * speed / (2 * Math.max(.5, h)) + g) * b.m / oneEngine;
                if (need >= .4) { mode = { engines: 1, throttle: Math.min(1, need), tail: true, direction: retro }; burning = Math.min(1, need); }
            }
        }
        const info = {};
        b = { ...rk4(b, mode, info), attitude: b.attitude };
        const now = t + step;
        if (k % keep === keep - 1) booster.push({ t: now, r: b.r, v: b.v, m: b.m, q: info.q, load: info.load, engines: burning, retro: retro(b) });
        if (length(b.r) - R <= 0) landing = { at: now, speed: length(airVelocity(b)), r: b.r, m: b.m };
    }
    return { stack, booster, seco, maxQ, reserve, insertion, entry, landingStart, landing, apogee, separatedAttitude: separated?.attitude };
}
export const flightData = simulate();
const sim = flightData;

export const events = [
    { at: -3, key: 'ignition', label: 'ENGINE IGNITION' },
    { at: 0, key: 'liftoff', label: 'LIFTOFF' },
    { at: Math.round(sim.maxQ.at), key: 'maxq', label: 'MAX-Q · ' + (sim.maxQ.q / 1000).toFixed(0) + ' kPa' },
    { at: guidance.meco, key: 'meco', label: 'MAIN ENGINE CUTOFF' },
    { at: guidance.separation, key: 'separation', label: 'STAGE SEPARATION' },
    { at: guidance.ses, key: 'ses', label: 'SECOND-STAGE IGNITION' },
    { at: Math.round(sim.entry), key: 'entry', label: 'BOOSTER ENTRY BURN', booster: true },
    { at: Math.round(sim.seco), key: 'seco', label: 'SECOND-STAGE CUTOFF' },
    { at: Math.round(sim.landingStart), key: 'landingburn', label: 'BOOSTER LANDING BURN', booster: true },
    { at: Math.round(sim.landing.at), key: 'landing', label: 'BOOSTER LANDS ON DRONESHIP', booster: true },
    { at: guidance.dragon, key: 'dragon', label: 'DRAGON SEPARATION' },
    { at: guidance.nosecone, key: 'nosecone', label: 'NOSE CONE OPENS' }
].sort((a, b) => a.at - b.at);
export const eventAt = key => events.find(event => event.key === key).at;
export const countdown = -10, ascentDuration = guidance.end;   // the view opens ten seconds before liftoff

// Time warp by stretch of the flight: real time at liftoff and round each separation, faster in between. Following
// the booster, real time round its burns and landing instead.
const warpPlans = {
    rocket: [[countdown, 1], [20, 6], [140, 1.5], [180, 16], [eventAt('seco') - 25, 3], [eventAt('seco') + 13, 17], [708, 2.5]],
    booster: [[countdown, 1], [20, 6], [140, 1.5], [185, 12], [eventAt('entry') - 6, 1.5], [eventAt('entry') + 26, 8], [eventAt('landingburn') - 12, 1], [eventAt('landing') + 6, 12]]
};
function plan(name) {
    const warps = warpPlans[name], marks = [[0, countdown]];
    for (let k = 1; k <= warps.length; k++) { const [from, warp] = warps[k - 1], to = k < warps.length ? warps[k][0] : ascentDuration; marks.push([marks[k - 1][0] + (to - from) / warp, to]); }
    return { warps, marks };
}
const plans = { rocket: plan('rocket'), booster: plan('booster') };
export const animationDuration = focus => plans[focus].marks[plans[focus].marks.length - 1][0];
export function warpAt(mission, focus) { let warp = 1; for (const [from, value] of plans[focus].warps) if (mission >= from) warp = value; return warp; }
export function missionAt(animation, focus) {
    const marks = plans[focus].marks;
    for (let k = 1; k < marks.length; k++) if (animation <= marks[k][0]) { const [a0, m0] = marks[k - 1], [a1, m1] = marks[k]; return m0 + (animation - a0) / (a1 - a0) * (m1 - m0); }
    return ascentDuration;
}
export function animationAt(mission, focus) {
    const marks = plans[focus].marks;
    for (let k = 1; k < marks.length; k++) if (mission <= marks[k][1]) { const [a0, m0] = marks[k - 1], [a1, m1] = marks[k]; return a0 + (mission - m0) / (m1 - m0) * (a1 - a0); }
    return animationDuration(focus);
}

// Inertial to the pad's local frame at a time: turn back by Earth's rotation, then east, up, south at the pad.
const padUp = [Math.cos(phi), 0, Math.sin(phi)], padEast = [0, 1, 0], padNorth = [-Math.sin(phi), 0, Math.cos(phi)];
function toPad(vector, time, point) {
    const angle = -omega * time, c = Math.cos(angle), s = Math.sin(angle);
    let x = vector[0] * c - vector[1] * s, y = vector[0] * s + vector[1] * c, z = vector[2];
    if (point) { x -= padStart[0]; y -= padStart[1]; z -= padStart[2]; }
    const d = [x, y, z];
    return [dot(d, padEast), dot(d, padUp), -dot(d, padNorth)];
}
// Cubic Hermite between samples (positions with their velocities).
function sampleAt(list, time) {
    if (time <= list[0].t) return list[0];
    const last = list[list.length - 1];
    if (time >= last.t) return last;
    const dt = list[1].t - list[0].t, k = Math.min(list.length - 2, Math.floor((time - list[0].t) / dt)), a = list[k], b = list[k + 1], u = (time - a.t) / dt;
    const h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u, h01 = -2 * u ** 3 + 3 * u * u, h11 = u ** 3 - u * u;
    const r = [0, 1, 2].map(i => h00 * a.r[i] + h10 * dt * a.v[i] + h01 * b.r[i] + h11 * dt * b.v[i]);
    const vel = [0, 1, 2].map(i => a.v[i] + (b.v[i] - a.v[i]) * u);
    return { ...(u < .5 ? a : b), t: time, r, v: vel };
}
function describe(entry, time, direction) {
    return {
        position: toPad(entry.r, time, true), direction: unit(toPad(direction, time, false)), altitude: Math.max(0, length(entry.r) - R),
        downrange: Math.acos(Math.min(1, cosineAt(entry.r, time))) * R, speed: length(airVelocity(entry)), inertial: length(entry.v),
        q: entry.q || 0, load: entry.load || 0, mass: entry.m, engines: entry.engines || 0
    };
}
// Angle between the pad and the point under the vehicle (cosine), for the distance downrange.
function cosineAt(r, time) {
    const angle = -omega * time, c = Math.cos(angle), s = Math.sin(angle), fixed = [r[0] * c - r[1] * s, r[0] * s + r[1] * c, r[2]];
    return dot(unit(fixed), padUp);
}
// The rocket (first and second stage until separation, then the second stage with Dragon) at a mission time.
export function vehicleState(mission) {
    if (mission <= 0) return { position: [0, 0, 0], direction: [0, 1, 0], altitude: 0, downrange: 0, speed: 0, inertial: omega * R * Math.cos(phi), q: 0, load: 1, mass: sim.stack[0].m, engines: mission >= -3 ? 9 * .6 : 0 };
    const entry = sampleAt(sim.stack, mission);
    return describe(entry, mission, entry.attitude);
}
// The booster after separation: flipping tail-first over 4-40 s, then flying tail-first into the air stream.
export function boosterState(mission) {
    // Once down it stays on the barge: freeze the clock there, so Earth's turning does not carry its inertial
    // position away.
    const landed = sim.landing && mission >= sim.landing.at;
    if (landed) mission = sim.booster[sim.booster.length - 1].t;
    const entry = sampleAt(sim.booster, mission), since = mission - guidance.separation;
    const flip = since <= 4 ? 0 : since >= 40 ? 1 : (since - 4) / 36, eased = flip * flip * (3 - 2 * flip);
    // Turn from the separation attitude toward retrograde through the plane they share.
    const from = sim.separatedAttitude, to = entry.retro, angle = Math.acos(Math.max(-1, Math.min(1, dot(from, to)))) * eased;
    let axis = cross(from, to); if (length(axis) < 1e-6) axis = cross(from, [0, 0, 1]); axis = unit(axis);
    const c = Math.cos(angle), s = Math.sin(angle), turned = add(add(scale(from, c), cross(axis, from), s), axis, dot(axis, from) * (1 - c));
    const state = describe(entry, mission, eased >= 1 ? to : turned);
    if (landed) Object.assign(state, { speed: 0, inertial: omega * (R + state.altitude) * Math.cos(phi), engines: 0, load: 1, q: 0, landed: true });
    return state;
}
// Where the booster comes down: the droneship, in the pad's frame (position and its local up).
export const droneship = (() => {
    if (!sim.landing) return null;
    const position = toPad(sim.landing.r, sim.landing.at, true), up = unit([position[0], position[1] + R, position[2]]);
    return { position, up, downrange: Math.acos(cosineAt(sim.landing.r, sim.landing.at)) * R };
})();
// The two flight paths as dots, one a second, in the pad's frame (each where it was over the turning Earth then):
// the rocket and Dragon from liftoff, the booster from separation to the barge.
export const paths = {
    rocket: Array.from({ length: guidance.end + 1 }, (_, t) => ({ t, position: toPad(sampleAt(sim.stack, t).r, t, true) })),
    booster: sim.landing ? Array.from({ length: Math.floor(sim.landing.at - guidance.separation) + 1 }, (_, k) => {
        const t = guidance.separation + k; return { t, position: toPad(sampleAt(sim.booster, t).r, t, true) };
    }) : []
};
export const summary = {
    meco: describe(sampleAt(sim.stack, guidance.meco), guidance.meco, [0, 1, 0]), orbit: sim.insertion, maxQ: sim.maxQ, reserve: sim.reserve,
    boosterApogee: sim.apogee, landing: sim.landing && { at: sim.landing.at, speed: sim.landing.speed, propellantLeft: sim.landing.m - vehicle.s1Dry }
};

// The pad's frame on the globe: east, up and south in Earth-fixed coordinates (x toward 0° longitude on the equator,
// y toward 90° E, z north), and the pad's position, in metres.
export function padFrame() {
    const lambda = launchSite.longitude * rad;
    const east = [-Math.sin(lambda), Math.cos(lambda), 0];
    const north = [-Math.sin(phi) * Math.cos(lambda), -Math.sin(phi) * Math.sin(lambda), Math.cos(phi)];
    const up = [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
    return { east, up, south: north.map(value => -value), position: up.map(value => value * R) };
}
