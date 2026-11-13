// Pre-built Canadarm2 operations, as steps for motion.js: `home` (back to the parked pose), `move` (joint angles, degrees,
// from the base), `reach` (the free end to a fixture: stand off, approach, close the snare; `via` seeds the solution),
// `walk` (the held fixture becomes the base, the old base is let go: end over end), `release`, `take` (Dextre lets go of
// its fixture while the arm holds its head), `stow` (Dextre back onto a fixture), `roll` (Dextre's body), `ride` (the
// Mobile Transporter, metres along the truss) and `wait` (seconds). For the cargo vehicle (pose.js `cargo`): `arrive` (it
// comes up to the capture point, over so many seconds), `berth` (held by the arm: to the ready point under the port,
// then straight onto it, and latched), `unberth` (the way back out to the capture point) and `depart`. An operation's
// `cargo` names where the vehicle must be for it to be offered. For the spacewalker (pose.js `crew`): `seat` (the foot
// restraint goes onto, or comes off, the free end), `board` (out of the Quest hatch and onto it, over so many seconds),
// `work` and `alight` (the way back in); a move marked `exact` ends at that very pose, whatever has turned in the way,
// because the figure boards and works there (js/figures/rider.js). The choreography is illustrative; the timing follows
// the hardware's rates, shown faster.
//
// The intermediate poses and the seeds were found offline, by searching joint paths against the station's triangles
// (tools/robotics/): with the arrays as drawn, every moment of every operation keeps the arm at least 0.17 m from the
// station, the base, Dextre and itself. On the page each operation is planned again before it plays (planner.js
// planSteps), for the arrays and radiators where they stand then: these poses are its goals and its first guesses.
// Changing a fixture, a pose or the hardware means searching again (README: "Canadarm2 và Dextre chuyển động").
const PARKED = [-108.1, 0, -68, 136, -68, 0, 108.1];
// Poses (degrees, on MBS PDGF 3 by LEE B) that stay clear the whole length of the rails, with Dextre on its fixture:
// planner.js rides in one of these when the parked pose is not clear along the way (near the ends of the rails the
// parked arch reaches the inboard wings). Found by searching the clearance map (js/robotics/map.js) over the rails
// every 0.4 m, then checked against the arrays and radiators at every 30 degrees of SARJ, three BGA and three TRRJ
// angles: each keeps 0.32 m or more from them in all of those, and 0.25 m or more from the station, the base, Dextre
// and itself.
export const RIDE_POSES = [
    [-121.3, 23.1, -132.7, 56.8, -59.8, -23.8, 122.8],
    [-94.8, -47.9, -98.8, -19.2, -130, 91.7, 28.2],
    [-108.6, -79.5, -81.4, 2.7, -124.5, 84.4, 137.9],
    [-136.7, -134.1, -44.6, 5.3, -41.8, 117.2, 42.8]
];
// The capture and the release are worked from Destiny's fixture: from the Mobile Base System the vehicle's fixture,
// below Unity, is out of reach. Both walk out and back as 'Walk to Destiny' does.
const TO_DESTINY = [
    { home: true, label: 'Parked on MBS PDGF 3' },
    { ride: 10, label: 'Mobile Transporter out along S1' },
    { move: [-98.4, -116.9, -195.3, -79.7, -161.4, 76.1, -11.3], label: 'Free end to the Destiny fixture' },
    { move: [-230.3, -133.2, -82.1, -35.2, -176.5, 96.4, -0.7], label: 'Free end to the Destiny fixture' },
    { reach: 'lab-pdgf', via: [-249.4, -20.8, -128.5, -87.8, 55.4, -12.8, -63.8], label: 'Free end to the Destiny fixture' },
    { walk: true, label: 'Destiny fixture becomes the base' }
], FROM_DESTINY = [
    { reach: 'mbs-pdgf3', via: [-64.6, 11.7, 48.1, -75.6, -133.4, 19.5, -249.8], label: 'Free end back to MBS PDGF 3' },
    { walk: true, label: 'MBS becomes the base again' },
    { move: [-139.2, -125.4, -139.7, 24.2, 142.7, 110.7, 78], label: 'Parked pose' },
    { move: [-119.5, -61.8, -129.3, -5.6, -118.1, 106.2, 26.6], label: 'Parked pose' },
    { move: PARKED, label: 'Parked pose' },
    { home: true, label: 'Parked on MBS PDGF 3' }
];
// The spacewalker's poses (on MBS PDGF 3, rails at 11.5 m). BOARD lays the rider level 1.3 m below the Quest hatch, face
// to nadir, the helmet under the hatch and the foot plate out to one side (hips 0.56 m from its axis): the handle then
// stands where gloves coming out of the hatch find it. WORK holds the rider face up under ESP-2, the pallet beside the
// airlock, the underside of one of its equipment boxes 0.74 m ahead and the work point at [6.3, -1.47, 7.4] before the left
// shoulder. Both were solved with the rider's spheres counted (collision.js CREW_SPHERES); measured on the triangles
// (tools/robotics/clearance.js) the rider keeps 0.74 m at BOARD, 0.31 m at WORK and 0.27 m on the way between them.
const BOARD = [102.34, -54.12, -129.24, -46.43, 164.31, -190.16, 7.31], WORK = [133.84, -36.68, -144.34, -42.89, 119.91, -222.33, -131.29];
export const sequences = [
    { id: 'walk', title: 'Walk to Destiny', summary: 'End over end onto the lab and back', steps: [
        { home: true, label: 'Parked on MBS PDGF 3' },
        // From the base's home the fixture is too close to reach without folding into the truss.
        { ride: 10, label: 'Mobile Transporter out along S1' },
        { move: [-98.4, -116.9, -195.3, -79.7, -161.4, 76.1, -11.3], label: 'Free end to the Destiny fixture' },
        { move: [-230.3, -133.2, -82.1, -35.2, -176.5, 96.4, -0.7], label: 'Free end to the Destiny fixture' },
        { reach: 'lab-pdgf', via: [-249.4, -20.8, -128.5, -87.8, 55.4, -12.8, -63.8], label: 'Free end to the Destiny fixture' },
        { walk: true, label: 'Destiny fixture becomes the base' },
        { wait: 2, label: 'Standing on Destiny' },
        { reach: 'mbs-pdgf3', via: [-64.6, 11.7, 48.1, -75.6, -133.4, 19.5, -249.8], label: 'Free end back to MBS PDGF 3' },
        { walk: true, label: 'MBS becomes the base again' },
        { move: [-139.2, -125.4, -139.7, 24.2, 142.7, 110.7, 78], label: 'Parked pose' },
        { move: [-119.5, -61.8, -129.3, -5.6, -118.1, 106.2, 26.6], label: 'Parked pose' },
        { move: PARKED, label: 'Parked pose' },
        { home: true, label: 'Parked on MBS PDGF 3' }
    ] },
    { id: 'dextre', title: 'Carry Dextre', summary: 'Lift it off its fixture, turn it, set it back', steps: [
        { home: true, label: 'Parked on MBS PDGF 3' },
        { move: [-119.5, -61.8, -129.3, -5.6, -118.1, 106.2, 26.6], label: 'Grapple Dextre\'s head fixture' },
        { reach: 'dextre-pdgf', via: [-189.9, -172.7, -127.3, 111.9, 99.2, -5, -83.2], label: 'Grapple Dextre\'s head fixture' },
        { take: true, label: 'Dextre lets go of MBS PDGF 2' },
        { move: [-170.7, -102.9, -214.6, 16.2, 82.5, 110.1, -53.1], label: 'Dextre carried out' },
        { roll: 60, label: 'Dextre turns its body' },
        { wait: 2, label: 'At the worksite' },
        { roll: 0, label: 'Dextre turns back' },
        { stow: 'mbs-pdgf2', via: [-183.8, -197.2, -136.5, 115.8, -75.2, 176.2, 73.1], label: 'Dextre back onto MBS PDGF 2' },
        { release: true, label: 'Let go of Dextre' },
        { move: [-106.5, -99.8, -150, 28.3, -107.9, 122.6, 214.9], label: 'Parked pose' },
        { move: PARKED, label: 'Parked pose' },
        { home: true, label: 'Parked on MBS PDGF 3' }
    ] },
    // At worksite 1 the arm takes the pose ISS Live gave there on 7 November 2026 (SR..WR 200, 200, -90, -155, -105,
    // -110, 5 degrees, read as telemetry.js reads them).
    { id: 'ride', title: 'Ride to worksite 1', summary: 'Along the rails to S3, as on 7 November', steps: [
        { home: true, label: 'Parked on MBS PDGF 3' },
        { ride: 21.69, label: 'Mobile Transporter to worksite 1 (S3)' },
        { move: [-80.5, -79.7, -191.6, 95, -190.7, 69.9, 45.9], label: 'The pose of 7 November 2026' },
        { move: [-160, -70, 0, -155, -15, 160, 5], label: 'The pose of 7 November 2026' },
        { wait: 3, label: 'At worksite 1, as on 7 November 2026' },
        { move: [-184, -72.2, -119.6, -118.1, 140.8, 111.3, 107.1], label: 'Parked pose' },
        { move: PARKED, label: 'Parked pose' },
        { ride: 2.5, label: 'Back above Destiny' },
        { home: true, label: 'Parked on MBS PDGF 3' }
    ] },
    { id: 'eva', title: 'Carry a spacewalker', summary: 'From Quest to ESP-2 on the foot restraint', steps: [
        { home: true, label: 'Parked on MBS PDGF 3' },
        { seat: true, label: 'Foot restraint onto the free end' },
        { ride: 11.5, label: 'Mobile Transporter out along S1' },
        { move: BOARD, exact: true, label: 'Free end below the Quest hatch' },
        { board: 26, label: 'Out of the hatch, onto the foot restraint' },
        { move: WORK, exact: true, label: 'Spacewalker carried to ESP-2' },
        { work: 22, label: 'At work under ESP-2' },
        { move: BOARD, exact: true, label: 'Spacewalker carried back to Quest' },
        { alight: 26, label: 'Off the foot restraint, in through the hatch' },
        { move: PARKED, label: 'Parked pose' },
        { ride: 2.5, label: 'Back above Destiny' },
        { home: true, label: 'Parked on MBS PDGF 3' },
        { seat: false, label: 'Foot restraint taken off' }
    ] },
    // The vehicle holds 3 m below, 3 m forward and 1 m to starboard of its berthed place, fixture forward: there the arm
    // reaches it from Destiny and can carry it under the port and up without a joint near its travel.
    { id: 'capture', title: 'Capture Cygnus', summary: 'Take the cargo ship, berth it on Unity', cargo: 'away', steps: [
        ...TO_DESTINY,
        { arrive: 26, label: 'Cygnus comes up to the capture point' },
        { reach: 'cygnus-fgf', via: [97.6, -20.9, -111.6, -29.7, -59.2, 67.8, 89.1], label: 'Grapple Cygnus' },
        { berth: true, label: 'Cygnus onto Unity\'s nadir port' },
        { release: true, label: 'Let go of Cygnus' },
        ...FROM_DESTINY
    ] },
    { id: 'release', title: 'Release Cygnus', summary: 'Unberth the cargo ship, let it go', cargo: 'berth', steps: [
        ...TO_DESTINY,
        { reach: 'cygnus-fgf', via: [99, -41.5, -116, -58.3, -19.1, 47.7, 80], label: 'Grapple Cygnus' },
        { unberth: true, label: 'Cygnus off Unity, out to the release point' },
        { release: true, label: 'Let go of Cygnus' },
        { depart: 22, label: 'Cygnus leaves' },
        ...FROM_DESTINY
    ] }
];
