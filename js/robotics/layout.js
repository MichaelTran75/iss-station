// Where the robotics hardware sits, as plain numbers: the Mobile Base System's cage and its grapple fixtures, how far
// the base runs along the truss, and how deep an end effector seats on a fixture. No three.js, so the robotics worker
// (js/workers/robotics.js) can load it with the rest of the arm's model: kinematics.js, fixtures.js, pose.js,
// motion.js, collision.js and planner.js import each other with their stamps ('./x.js?v=…'), as workers have no
// import map.

// The base's centre along the truss as drawn (above Destiny's starboard struts), and how far the carriage can run:
// the rails end 24.1 m out, the bogies stand 1.68 m either side of the centre.
export const MBS_HOME = 2.5, MBS_REACH = 22.4;
// A latched end effector's mouth sits this far out from the centre of the fixture it holds, the fixture's probe inside.
export const SEAT = .115;
// The base is built in its own mirrored cage frame (mobile-base.js): station = (0.7 - x, y - 3.045, z + 0.375), outward
// normals flip in x. The three canted, front-facing fixtures of the reference renders, and the starboard one LEE A held
// there.
const mbsX = -1.8, frameY = 7.715;
export const CAGE = {
    mbsX, frameY, baseZ: .65, fixtureX: -3.775, armY: 8.295, armZ: .65,
    heads: [{ p: [mbsX - 1.32, frameY + .17, -.74], n: [-.12, -.10, -1] }, { p: [mbsX + 1.32, frameY + .17, -.74], n: [.12, -.10, -1] }, { p: [mbsX + .94, frameY + 1.49, -.30], n: [.15, .05, -1] }]
};
const toStation = p => [.7 - p[0], p[1] - 3.045, p[2] + .375], normalToStation = n => [-n[0], n[1], n[2]];
// Numbered as the telemetry numbers the base's fixtures (which is which on the real base is not published: the
// assignment is illustrative, chosen so the live parking places fall where they were drawn): PDGF 3 is the
// starboard fixture the arm stands on, PDGF 2 the outboard front one Dextre stands on, clocked along the truss so that
// Dextre's shoulders run along it as drawn. In station coordinates with the base at home.
export const MBS_FIXTURES = {
    'mbs-pdgf1': { center: toStation(CAGE.heads[1].p), normal: normalToStation(CAGE.heads[1].n), up: [0, 1, 0] },
    'mbs-pdgf2': { center: toStation(CAGE.heads[0].p), normal: normalToStation(CAGE.heads[0].n), up: [1, 0, 0] },
    'mbs-pdgf3': { center: toStation([CAGE.fixtureX, CAGE.armY, CAGE.armZ]), normal: [1, 0, 0], up: [0, 0, 1] },
    'mbs-pdgf4': { center: toStation(CAGE.heads[2].p), normal: normalToStation(CAGE.heads[2].n), up: [0, 1, 0] }
};
