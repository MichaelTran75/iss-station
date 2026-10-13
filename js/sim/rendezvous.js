// Crew Dragon's proximity operations at the ISS: Waypoint 0 to soft capture and hooks closed. Timing follows the Crew-2
// timeline (NASA/SpaceX, 24 April 2021): Waypoint 0, 400 m below the station, at 04:25 EDT; Waypoint 1, 220 m out on
// the docking axis, at 04:49; Waypoint 2, 20 m out, at 05:00 with a hold for the go/no-go; approach resumes at 05:05;
// contact and capture at IDA-2 on Harmony forward at 05:10; hooks closed at 05:23. Demo-2 closed at about 0.30 m/s on
// the docking axis and slowed to about 0.10 m/s near the station.
//
// Relative motion follows the Clohessy-Wiltshire (Hill) equations for a circular reference orbit:
//     x'' = 3n²x + 2n y'        y'' = -2n x'        z'' = -n²z
// in the station's local frame (LVLH, metres, origin on the docking port): x radial (up, away from Earth), y along-track
// (the station's velocity; Harmony forward and its docking axis face +y), z cross-track (the orbit normal, x × y).
// From Waypoint 0 to Waypoint 1 Dragon coasts after one burn, on the two-impulse CW transfer that takes 24 minutes.
// Along the docking axis it flies a set speed profile; holding a straight line then takes a small radial thrust
// against the Coriolis term (-2n y'), which the model reports with every other thrust so the page can show the Dracos.
// Pure functions: no three.js, no DOM, so the model can also run in the animation worker.

// The animation compresses time, more on the long legs than near the station. Each phase: mission seconds and warp.
const phases = [
    { key: 'transfer', label: 'TRANSFER TO WP1', seconds: 1440, warp: 60 },
    { key: 'vbar', label: 'V-BAR APPROACH', seconds: 660, warp: 30 },
    { key: 'hold', label: 'HOLD AT WP2', seconds: 300, warp: 30 },
    { key: 'final', label: 'FINAL APPROACH', seconds: 300, warp: 4 },
    { key: 'capture', label: 'SOFT CAPTURE', seconds: 780, warp: 60 }
];
export const rendezvousWaypoints = [
    { name: 'WP0', note: '400 m below', position: [-400, 0, 0] },
    { name: 'WP1', note: '220 m, docking axis', position: [0, 220, 0] },
    { name: 'WP2', note: '20 m hold', position: [0, 20, 0] }
];
// ISS mean motion: 15.4884 revolutions a day, a period of 92.97 minutes (CelesTrak TLE, epoch 12 October 2026).
export const issMeanMotion = 2 * Math.PI * 15.48844 / 86400;   // rad/s
export const keepOutSphereRadius = 200;           // m, about the station's centre of mass
export const contactSpeed = .05;                  // m/s at the docking ring

// Piecewise-linear speed through knots [[t, v], ...]: distance covered, speed and acceleration at time t.
function speedProfile(knots) {
    const at = t => {
        let covered = 0;
        for (let k = 1; k < knots.length; k++) {
            const [t0, v0] = knots[k - 1], [t1, v1] = knots[k];
            const slope = (v1 - v0) / (t1 - t0);
            if (t <= t1) { const dt = Math.max(0, t - t0); return { distance: covered + v0 * dt + slope * dt * dt / 2, speed: v0 + slope * dt, accel: slope }; }
            covered += (v0 + v1) / 2 * (t1 - t0);
        }
        return { distance: covered, speed: knots[knots.length - 1][1], accel: 0 };
    };
    return at;
}
// Knots with one unknown cruise speed, solved so the profile covers `distance` (distance is linear in the cruise speed).
function solvedProfile(build, distance, duration) {
    const covered = cruise => speedProfile(build(cruise))(duration).distance;
    const base = covered(0), perUnit = covered(1) - base;
    const cruise = (distance - base) / perUnit;
    return { cruise, at: speedProfile(build(cruise)) };
}

export function createRendezvous(meanMotion) {
    const n = meanMotion;
    // CW state transition over t for the in-plane state (x, y, vx, vy).
    const propagate = (t, [x, y, vx, vy]) => {
        const c = Math.cos(n * t), s = Math.sin(n * t);
        return [
            (4 - 3 * c) * x + s / n * vx + 2 * (1 - c) / n * vy,
            6 * (s - n * t) * x + y - 2 * (1 - c) / n * vx + (4 * s - 3 * n * t) / n * vy,
            3 * n * s * x + c * vx + 2 * s * vy,
            -6 * n * (1 - c) * x - 2 * s * vx + (4 * c - 3) * vy
        ];
    };
    // Two-impulse transfer from WP0 to WP1 in the transfer time: the departure velocity that arrives on WP1.
    const [w0, w1, w2] = rendezvousWaypoints.map(waypoint => waypoint.position);
    const transferTime = phases[0].seconds;
    const c = Math.cos(n * transferTime), s = Math.sin(n * transferTime);
    const rv = [[s / n, 2 * (1 - c) / n], [-2 * (1 - c) / n, (4 * s - 3 * n * transferTime) / n]];
    const drift = propagate(transferTime, [w0[0], w0[1], 0, 0]);
    const gap = [w1[0] - drift[0], w1[1] - drift[1]], det = rv[0][0] * rv[1][1] - rv[0][1] * rv[1][0];
    const departure = [(rv[1][1] * gap[0] - rv[0][1] * gap[1]) / det, (-rv[1][0] * gap[0] + rv[0][0] * gap[1]) / det];
    const arrival = propagate(transferTime, [w0[0], w0[1], ...departure]);
    // Docking-axis legs: from the transfer's arrival speed up to a cruise and down to rest at WP2; then from rest to a
    // slow cruise and down to the contact speed. Cruise speeds are solved to meet the timeline.
    const vbarTime = phases[1].seconds, finalTime = phases[3].seconds;
    const vbar = solvedProfile(cruise => [[0, -arrival[3]], [60, cruise], [vbarTime - 150, cruise], [vbarTime, 0]], w1[1] - w2[1], vbarTime);
    const final = solvedProfile(cruise => [[0, 0], [30, cruise], [finalTime - 60, cruise], [finalTime, contactSpeed]], w2[1], finalTime);

    let mission = 0, anim = 0;
    for (const phase of phases) {
        Object.assign(phase, { start: mission, end: mission + phase.seconds, animStart: anim, animEnd: anim + phase.seconds / phase.warp });
        mission = phase.end; anim = phase.animEnd;
    }
    const impulses = [
        { mission: 0, deltaV: [departure[0], departure[1], 0] },
        { mission: phases[1].start, deltaV: [-arrival[2], 0, 0] }
    ];

    // State at a mission time: position and velocity (m, m/s, LVLH), the thrust acceleration holding the profile
    // (m/s², zero while coasting), phase and range.
    function state(t) {
        t = Math.min(Math.max(t, 0), mission);
        const phase = phases.find(item => t < item.end) || phases[phases.length - 1], local = t - phase.start;
        let position, velocity, thrust = [0, 0, 0];
        if (phase.key === 'transfer') {
            const [x, y, vx, vy] = propagate(local, [w0[0], w0[1], ...departure]);
            position = [x, y, 0]; velocity = [vx, vy, 0];
        } else if (phase.key === 'vbar' || phase.key === 'final') {
            const profile = phase.key === 'vbar' ? vbar.at(local) : final.at(local), from = phase.key === 'vbar' ? w1[1] : w2[1];
            position = [0, from - profile.distance, 0]; velocity = [0, -profile.speed, 0];
            // Commanded acceleration minus the CW acceleration at this state (x = 0, x' = 0): radial -2n y', axial y''.
            thrust = [-2 * n * velocity[1], -profile.accel, 0];
        } else if (phase.key === 'hold') {
            // On the V-bar at rest is an equilibrium of the CW equations: no thrust.
            position = [0, w2[1], 0]; velocity = [0, 0, 0];
        } else { position = [0, 0, 0]; velocity = [0, 0, 0]; }
        const label = phase.key === 'transfer' && local < 90 ? 'WAYPOINT 0' : phase.key === 'capture' ? local >= phase.seconds ? 'DOCKED' : local > 480 ? 'HARD CAPTURE' : 'SOFT CAPTURE' : phase.label;
        return { mission: t, phase: phase.key, label, warp: phase.warp, position, velocity, thrust, range: Math.hypot(...position) };
    }
    // Mission time for an animation time, and back.
    const missionAt = time => {
        const phase = phases.find(item => time < item.animEnd) || phases[phases.length - 1];
        return Math.min(phase.end, phase.start + (time - phase.animStart) * phase.warp);
    };
    const animAt = t => {
        const phase = phases.find(item => t < item.end) || phases[phases.length - 1];
        return phase.animStart + (Math.min(t, phase.end) - phase.start) / phase.warp;
    };
    // The planned path from WP0 to the port, for drawing.
    function path(samples = 160) {
        const points = [];
        for (let k = 0; k <= samples; k++) points.push(state(phases[0].seconds * k / samples).position);
        points.push(w2, [0, 0, 0]);
        return points;
    }
    // What remains of the path at a mission time: the rest of the transfer, then the docking axis to the port.
    const transferSamples = Array.from({ length: 49 }, (_, k) => ({ t: phases[0].seconds * k / 48, at: state(phases[0].seconds * k / 48).position }));
    const pathAhead = t => [...transferSamples.filter(sample => sample.t > t).map(sample => sample.at), state(t).position, [0, 0, 0]];
    return {
        meanMotion: n, phases, impulses, state, missionAt, animAt, path, pathAhead,
        duration: anim, missionDuration: mission,
        departureDeltaV: Math.hypot(...departure), vbarCruise: vbar.cruise, finalCruise: final.cruise,
        phaseStart: key => phases.find(item => item.key === key).animStart
    };
}
