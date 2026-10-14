// Rocket exhaust plumes from flight conditions. Pure model, no drawing.
// - The engine: Merlin 1D, chamber 9.7 MPa at full thrust, nozzle area ratio 16, exit 0.92 m across; the exhaust
//   expands with γ 1.22 from about 3,600 K. Isentropic expansion gives the exit state: Mach 3.68 at 62 kPa, so at sea
//   level the jet leaves overexpanded (its edge turns in and shock cells form), matches the air near 4 km and is
//   ever more underexpanded above. The vacuum Merlin's nozzle (area ratio 165, 3.0 m across) leaves at 1 kPa.
// - The jet: the fully expanded Mach number and diameter from the chamber-to-air pressure ratio; the first shock
//   cell's length (the Mach disk, Lewis & Carlson 1964) and the cells' spacing (Pack 1950); the edge's first turn
//   (Prandtl-Meyer).
// - Mixing, as for the jet engine on the airport page (its wind tunnel): the shear layer grows in proportion to
//   (1 − λ)/(1 + λ), λ the speed of the air streaming past over the jet's (Brown & Roshko 1974), so the hot core
//   stretches as the rocket speeds up; the core is longer for a faster jet (Lau, Morris & Fisher 1979: 4.2 + 1.1 M²
//   diameters) and shorter for a jet lighter than the air round it (√ of the density ratio, Witze 1974).
// - The flame: kerosene-rich exhaust keeps burning with the air it draws in (afterburning), several core lengths at low
//   altitude, fading with the oxygen as the air thins.
const gamma = 1.22, chamber = 9.72e6, chamberTemperature = 3600, gasConstant = 378;   // J/(kg K) for the exhaust
const half = (gamma - 1) / 2, power = gamma / (gamma - 1);
const areaRatio = mach => Math.pow((2 / (gamma + 1)) * (1 + half * mach * mach), (gamma + 1) / (2 * (gamma - 1))) / mach;
function machForArea(ratio) {   // supersonic branch
    let lo = 1, hi = 20;
    for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (areaRatio(mid) < ratio) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
}
const prandtlMeyer = mach => {
    const k = Math.sqrt((gamma + 1) / (gamma - 1)), s = Math.sqrt(Math.max(0, mach * mach - 1));
    return k * Math.atan(s / k) - Math.atan(s);
};
// The two nozzles: exit Mach and exit-to-chamber pressure fixed by the area ratio.
const nozzles = {
    merlin: { diameter: .92, ratio: 16 },
    mvac: { diameter: 3.04, ratio: 165 }
};
for (const nozzle of Object.values(nozzles)) {
    nozzle.mach = machForArea(nozzle.ratio);
    nozzle.pressure = Math.pow(1 + half * nozzle.mach ** 2, -power);   // as a fraction of the chamber's
}
export const merlinExit = { mach: nozzles.merlin.mach, pressure: nozzles.merlin.pressure * chamber };

// One engine's plume. `throttle` 0.4-1 scales the chamber pressure; `pressure` and `density` are the air's (Pa,
// kg/m³), `airspeed` the rocket's through it (m/s), `temperature` the air's (K). Lengths in metres.
export function enginePlume(kind, { throttle = 1, pressure, density, airspeed = 0, temperature = 288 }) {
    const nozzle = nozzles[kind], pc = chamber * Math.max(.3, throttle), pa = Math.max(pressure, .05);
    const exitPressure = nozzle.pressure * pc;
    // Fully expanded: from the chamber pressure straight down to the air's.
    const jetMach = Math.sqrt(Math.max(1.0001, (Math.pow(pc / pa, 1 / power) - 1) / half));
    const jetDiameter = nozzle.diameter * Math.sqrt(areaRatio(jetMach) / nozzle.ratio);
    const ratio = exitPressure / pa;
    // First shock cell: the Mach disk's distance for an underexpanded jet, about a diameter and a quarter when the
    // jet leaves overexpanded.
    const machDisk = ratio > 1 ? .69 * nozzle.diameter * nozzle.mach * Math.sqrt(gamma * ratio) : 1.25 * nozzle.diameter;
    const cell = 1.306 * jetDiameter * Math.sqrt(jetMach * jetMach - 1);
    const turn = Math.max(0, prandtlMeyer(jetMach) - prandtlMeyer(nozzle.mach));
    // Speeds and densities for the mixing.
    const jetTemperature = chamberTemperature / (1 + half * jetMach * jetMach);
    const jetSpeed = jetMach * Math.sqrt(gamma * gasConstant * jetTemperature);
    const lambda = Math.min(.92, Math.max(0, airspeed / jetSpeed));
    const coflow = (1 + lambda) / (1 - lambda);
    const densityRatio = density > 1e-9 ? (pa / (gasConstant * jetTemperature)) / density : 1;
    const core = jetDiameter * (4.2 + 1.1 * jetMach * jetMach) * Math.sqrt(Math.min(1, densityRatio)) * coflow;
    // Afterburning with the oxygen the air brings in: strong near sea level, gone by about 60 km.
    const oxygen = Math.sqrt(Math.min(1, density / 1.225));
    const flame = core * (1 + 4 * oxygen);
    return { exitPressure, ratio, jetMach, jetDiameter, machDisk, cell, turn, jetSpeed, lambda, coflow, core, flame, oxygen, jetTemperature };
}
// The first stage's nine Merlins together (they merge within a few metres): the same jet scaled to one nozzle of
// nine times the area, three diameters across.
export function clusterPlume(conditions, engines = 9) {
    const one = enginePlume('merlin', conditions), scale = Math.sqrt(Math.max(1, engines));
    return { ...one, jetDiameter: one.jetDiameter * scale, machDisk: one.machDisk * scale, core: one.core * scale, flame: one.flame * scale, engine: one };
}
