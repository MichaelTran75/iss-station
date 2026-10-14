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
        return { r: add(s.r, add(add(k1.r, k2.r, 2), add(k4.r, k3.r, 2)), step / 6), v: add(s.v, add(add(k1.v, k2.v, 2), add(k4.v, k3.v, 2)), step / 6), m: s.m + (k1.m + 2 * k2.m + 2 * k3.m + k4.m) * step / 6 };
    }
    const orbit = s => {
        const r = length(s.r), speed = length(s.v), a = -mu / (2 * (speed * speed / 2 - mu / r)), hv = cross(s.r, s.v), e = Math.sqrt(Math.max(0, 1 - dot(hv, hv) / (mu * a)));
        return { a, perigee: a * (1 - e) - R, apogee: a * (1 + e) - R, inclination: Math.acos(hv[2] / length(hv)) / rad };
    };
    const targetA = R + (p.orbit[0] + p.orbit[1]) / 2;
    const stack = [], booster = [];
    let s = { r: padStart.slice(), v: cross(spin, padStart), m: v.s1Dry + v.s1Prop + v.s2Dry + v.s2Prop + v.payload };
    let attitude = unit(padStart), seco = null, maxQ = { q: 0, at: 0 }, reserve = 0, separated = null, insertion = null;
    stack.push({ t: 0, r: s.r, v: s.v, m: s.m, q: 0, load: 0, engines: 9, attitude });   // on the pad at liftoff
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
        const info = {}, before = s;
        s = rk4(s, mode, info);
        // Cutoff inside a step: redo it at the fraction of thrust that reaches the orbit's energy exactly.
        if (mode.vacuum && orbit(s).a >= targetA) {
            const energy = st => length(st.v) ** 2 / 2 - mu / length(st.r), goal = -mu / (2 * targetA);
            const fraction = Math.max(0, Math.min(1, (goal - energy(before)) / (energy(s) - energy(before))));
            s = rk4(before, { ...mode, throttle: mode.throttle * fraction }, info);
        }
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
    if (b) booster.push({ t: guidance.separation, r: b.r, v: b.v, m: b.m, q: 0, load: 0, engines: 0, retro: retro(b) });
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
        if (length(b.r) - R <= 0) {
            landing = { at: now, speed: length(airVelocity(b)), r: b.r, m: b.m };
            if (booster[booster.length - 1].t < now - 1e-9) booster.push({ t: now, r: b.r, v: b.v, m: b.m, q: info.q, load: info.load, engines: burning, retro: retro(b) });   // the touchdown itself
        }
    }
    return { stack, booster, seco, maxQ, reserve, insertion, entry, landingStart, landing, apogee, separatedAttitude: separated?.attitude };
}
export const flightData = simulate();
const sim = flightData;

// From orbit to the ISS: Dragon's phasing over the next 18 hours, two-body (no drag or J2) with impulsive Draco burns,
// from the stack's state at the end of the ascent (plus Dragon's own drift off the second stage) to Waypoint 0, 400 m
// below the station, where the station view's approach (js/sim/rendezvous.js) begins. Demo-2 made soft contact at
// 14:16 UTC on 31 May, 18 h 53 min after liftoff; that approach takes 45 min from Waypoint 0 to contact, so Dragon
// reaches Waypoint 0 at 18 h 08 min. The burns climb in Hohmann pairs, as Dragon's phasing does: up to 380 km after
// two and a half hours, to 400 km (20 km under the station, its coelliptic orbit) after eleven, and at terminal phase
// initiation a last half-orbit transfer to 419.6 km that ends at the waypoint. The ISS flies a circular 420 km orbit
// in the same plane, placed where this rendezvous meets it (the real station's position on 30 May 2020 would need its
// elements from then).
export const issAltitude = 420e3, rendezvousTime = 67995 - 2700;   // contact 18 h 53 min 15 s after liftoff, less the approach
const phasingStep = 10, issRadius = R + issAltitude, waypointRadius = issRadius - 400;
const halfTransfer = (from, to) => Math.PI * Math.sqrt(((from + to) / 2) ** 3 / mu);
function propagate(state, duration, burnsAt) {
    // RK4 under gravity alone; `burnsAt(time, state)` may change the velocity at the scheduled instants.
    const derivative = st => ({ r: st.v, v: scale(st.r, -mu / Math.pow(length(st.r), 3)) });
    let s = state, t = s.t;
    const list = [{ t, r: s.r, v: s.v }];   // the start sits on the 10 s grid (the ascent ends at 800 s)
    const stepTo = (st, h) => {
        const k1 = derivative(st), at = (k, f) => ({ r: add(st.r, k.r, f), v: add(st.v, k.v, f) });
        const k2 = derivative(at(k1, h / 2)), k3 = derivative(at(k2, h / 2)), k4 = derivative(at(k3, h));
        return { r: add(st.r, add(add(k1.r, k2.r, 2), add(k4.r, k3.r, 2)), h / 6), v: add(st.v, add(add(k1.v, k2.v, 2), add(k4.v, k3.v, 2)), h / 6) };
    };
    // Steps land on a 10 s grid (a burn between grid points splits the step), so the samples stay evenly spaced.
    while (t < duration - 1e-9) {
        const next = Math.min(duration, (Math.floor(t / phasingStep + 1e-7) + 1) * phasingStep), due = burnsAt ? burnsAt.next(t, next) : null;
        if (due !== null && due < next - 1e-9) { s = { ...stepTo(s, due - t), t: due }; t = due; s = { ...s, v: burnsAt.apply(s) }; continue; }
        s = { ...stepTo(s, next - t), t: next }; t = next;
        if (due !== null) s = { ...s, v: burnsAt.apply(s) };
        list.push({ t, r: s.r, v: s.v });
    }
    return list;
}
const horizontal = s => unit(cross(cross(s.r, s.v), s.r));
const dragonPhasing = (() => {
    const end = sim.stack[sim.stack.length - 1], since = end.t - guidance.dragon, axis = end.attitude;
    const start = { t: end.t, r: add(end.r, axis, .4 * since + .004 * since * since), v: add(end.v, axis, .4 + .008 * since) };
    // The burns: [time, kind, target radius]. A raise sets the speed whose transfer orbit peaks at the target; the
    // circularization half an orbit later sets circular speed there.
    const plan = [];
    const raise = (at, to, label, circularLabel) => { plan.push({ at, to, label, kind: 'raise' }); plan.push({ at: null, to, label: circularLabel, kind: 'circular', after: plan.length - 1 }); };
    raise(9000, R + 380e3, 'PHASING BURN · TO 380 km', 'CIRCULARIZATION · 380 km');
    raise(40000, R + 400e3, 'HEIGHT ADJUST · TO 400 km', 'COELLIPTIC BURN · 400 km');
    raise(rendezvousTime - halfTransfer(R + 400e3, waypointRadius), waypointRadius, 'TERMINAL PHASE INITIATION', 'WAYPOINT 0 · 400 m BELOW THE ISS');
    const burns = [];
    const schedule = {
        next(from, to) { const burn = plan.find(b => b.at !== null && !b.done && b.at > from + 1e-9 && b.at <= to + 1e-9); return burn ? burn.at : null; },
        apply(s) {
            const burn = plan.find(b => b.at !== null && !b.done && Math.abs(b.at - s.t) < 1e-6), r = length(s.r);
            const speed = burn.kind === 'raise' ? Math.sqrt(mu * (2 / r - 2 / (r + burn.to))) : Math.sqrt(mu / r);
            const v = scale(horizontal(s), speed);
            burn.done = true; burns.push({ at: s.t, label: burn.label, deltaV: length(add(v, s.v, -1)) });
            if (burn.kind === 'raise') { const circular = plan[plan.indexOf(burn) + 1]; circular.at = s.t + halfTransfer(r, burn.to); }
            return v;
        }
    };
    const list = propagate(start, rendezvousTime + 600, schedule);
    return { list, burns };
})();
// The ISS: circular, in Dragon's plane, 400 m above Dragon at the waypoint.
const meeting = sampleAt(dragonPhasing.list, rendezvousTime);
const issNormal = unit(cross(meeting.r, meeting.v)), issMeet = scale(unit(meeting.r), issRadius), issRate = Math.sqrt(mu / issRadius ** 3);
export function issAt(time) {
    const angle = issRate * (time - rendezvousTime), c = Math.cos(angle), s = Math.sin(angle), k = issNormal, v = issMeet;
    return add(add(scale(v, c), cross(k, v), s), k, dot(k, v) * (1 - c));
}
// The second stage after Dragon leaves: it coasts on (in flight it is sent down to burn up over the Pacific).
const stagePhasing = propagate({ t: sim.stack[sim.stack.length - 1].t, r: sim.stack[sim.stack.length - 1].r, v: sim.stack[sim.stack.length - 1].v }, 6000, null);

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
    { at: guidance.nosecone, key: 'nosecone', label: 'NOSE CONE OPENS' },
    ...dragonPhasing.burns.map((burn, k) => ({ at: Math.round(burn.at), key: k === dragonPhasing.burns.length - 1 ? 'waypoint' : 'burn' + k, label: burn.label, deltaV: burn.deltaV }))
].sort((a, b) => a.at - b.at);
export const eventAt = key => events.find(event => event.key === key).at;
export const countdown = -10, ascentDuration = rendezvousTime + 20;   // from ten seconds before liftoff to Waypoint 0

// Dragon's phasing burns on its four forward Dracos (1.6 kN on 12.5 t): when, how long, and the window round each
// for turning to burn attitude (heat shield along the burn) and back.
export const dracoBurns = dragonPhasing.burns.map(burn => ({ at: burn.at, seconds: burn.deltaV * vehicle.payload / (4 * 400), turn: 150 }));
// Time warp by stretch of the flight: real time at liftoff and round each separation, faster in between, slower
// round Dragon's burns so its turn and its Dracos show. Following the booster, real time round its burns and landing
// instead.
function slowForBurns(plan, warp) {
    const out = plan.slice();
    for (const burn of dracoBurns) {
        const from = burn.at - burn.seconds / 2 - burn.turn - 20, to = burn.at + burn.seconds / 2 + burn.turn + 20;
        const before = out.filter(([at]) => at <= from).pop()[1], after = out.filter(([at]) => at <= to).pop()[1];
        if (before < 1000) continue;   // only out in the long coasts (the last burn, at Waypoint 0, already plays slowly)
        for (let k = out.length - 1; k >= 0; k--) if (out[k][0] > from && out[k][0] <= to) out.splice(k, 1);
        out.push([from, warp], [to, after]);
        out.sort((a, b) => a[0] - b[0]);
    }
    return out;
}
const warpPlans = {
    rocket: slowForBurns([[countdown, 1], [20, 6], [140, 1.5], [180, 16], [eventAt('seco') - 25, 3], [eventAt('seco') + 13, 17], [708, 2.5], [790, 60], [1000, 1500], [rendezvousTime - 1500, 150], [rendezvousTime - 150, 15]], 90),
    booster: [[countdown, 1], [20, 6], [140, 1.5], [185, 12], [eventAt('entry') - 6, 1.5], [eventAt('entry') + 26, 8], [eventAt('landingburn') - 12, 1], [eventAt('landing') + 6, 12], [eventAt('landing') + 60, 1500], [rendezvousTime - 1500, 150], [rendezvousTime - 150, 15]]
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
    // Outside the samples, carry on along the velocity: holding the end sample still would put it where the vehicle
    // was at another time, which over the turning Earth is tens of metres off at once.
    const first = list[0], last = list[list.length - 1];
    if (time <= first.t) return { ...first, t: time, r: add(first.r, first.v, time - first.t) };
    if (time >= last.t) return { ...last, t: time, r: add(last.r, last.v, time - last.t) };
    // Samples are evenly spaced except a last, shorter step (a touchdown): guess the segment, then settle it.
    let k = Math.min(list.length - 2, Math.max(0, Math.floor((time - first.t) / (list[1].t - first.t))));
    while (k < list.length - 2 && list[k + 1].t < time) k++;
    while (k > 0 && list[k].t > time) k--;
    const a = list[k], b = list[k + 1], dt = b.t - a.t, u = (time - a.t) / dt;
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
    if (mission <= 0) {
        // On the pad: the engines light at T−3 s and run up to full thrust against the hold-down clamps.
        const f = Math.min(1, Math.max(0, (mission + 3) / 2.5)), engines = mission >= -3 ? 9 * (.6 + .4 * f * f * (3 - 2 * f)) : 0;
        return { position: [0, 0, 0], direction: [0, 1, 0], altitude: 0, downrange: 0, speed: 0, inertial: omega * R * Math.cos(phi), q: 0, load: 1, mass: sim.stack[0].m, engines };
    }
    if (mission <= guidance.end) { const entry = sampleAt(sim.stack, mission); return describe(entry, mission, entry.attitude); }
    // Dragon on its own, nose along its flight.
    const entry = { ...sampleAt(dragonPhasing.list, mission), m: vehicle.payload, q: 0, load: 0, engines: 0 };
    return { ...describe(entry, mission, unit(entry.v)), dragon: true };
}
// The second stage after the end of the ascent simulation.
export function stageState(mission) {
    const entry = { ...sampleAt(stagePhasing, mission), m: vehicle.s2Dry, q: 0, load: 0, engines: 0 };
    return describe(entry, mission, unit(entry.v));
}
// The ISS in the pad's frame at a time, drawn with Earth turned as at `turn` (see paths).
export const issPosition = (time, turn = time) => toPad(issAt(time), turn, true);
export const inertialToPad = (r, turn) => toPad(r, turn, true);
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
// The flight paths as inertial points with their times: the rocket and Dragon from liftoff to Waypoint 0 (a point a
// second for the ascent, every 10 s in orbit), the booster from separation to the barge. The view turns them into the
// pad's frame: the ascent and the booster where they flew over the turning Earth (each at its own time), Dragon's
// orbits as they stand in space now (all at the present time, or at the end of the ascent before then), so the line
// runs on unbroken from the ground track into orbit and up to the station.
export const paths = {
    rocket: [...Array.from({ length: guidance.end + 1 }, (_, t) => ({ t, r: sampleAt(sim.stack, t).r })),
        ...dragonPhasing.list.filter(entry => entry.t > guidance.end && entry.t <= rendezvousTime).map(entry => ({ t: entry.t, r: entry.r }))],
    booster: sim.landing ? Array.from({ length: Math.floor(sim.landing.at - guidance.separation) + 1 }, (_, k) => {
        const t = guidance.separation + k; return { t, r: sampleAt(sim.booster, t).r };
    }) : []
};
export const groundTrackEnd = guidance.end;   // up to here the rocket's path follows the ground
export const summary = {
    phasing: dragonPhasing.burns, rendezvousTime,
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
