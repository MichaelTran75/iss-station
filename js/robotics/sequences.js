// Pre-built Canadarm2 operations, as steps for motion.js: `home` (back to the parked pose), `move` (joint angles, degrees,
// from the base), `reach` (the free end to a fixture: stand off, approach, close the snare; `via` seeds the solution),
// `walk` (the held fixture becomes the base, the old base is let go: end over end), `release`, `take` (Dextre lets go of
// its fixture while the arm holds its head), `stow` (Dextre back onto a fixture), `roll` (Dextre's body), `ride` (the
// Mobile Transporter, metres along the truss) and `wait` (seconds). The choreography is illustrative; the timing
// follows the hardware's rates, shown faster.
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
    ] }
];
