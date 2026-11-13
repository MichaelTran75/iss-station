// Canadarm2 & Mobile Base System: the part. The hardware, its kinematics, the fixtures, ISS Live and the pre-built
// sequences live in js/robotics/ (README: "Canadarm2 và Dextre chuyển động"); the scene moves it from there
// (js/robotics/index.js).
import * as THREE from 'three';
import { Kit, palette } from '../core/kit.js';
import { part, parts } from '../core/station.js';
import { buildMobileBase } from '../robotics/mobile-base.js';
import { buildArm } from '../robotics/ssrms.js';
import { fixtures } from '../robotics/fixtures.js';
import { fixtureGrey, hardware } from '../robotics/hardware.js';
import { bodyFrames } from '../robotics/kinematics.js';
import { REST, baseFrame } from '../robotics/pose.js';

part('robotics', 'Canadarm2 & Mobile Base System', '19 / CANADA - CSA', 'Canadarm2 rides the Mobile Base System along the rails on the forward face of the integrated truss. Its seven joints (three shoulder, one elbow, three wrist) and two booms are wrapped in white blankets; identical latching end effectors grasp fixtures with cable snares, so either end can be the base and the arm can walk end over end between fixtures. Parked as in the supplied reference renders, in a high arch in front of the starboard truss; with ISS Live it takes the telemetered joint angles, base and transporter position, and below are three pre-built operations. Joint-angle conventions and most fixture positions are inferred or illustrative.', [['Deployed reach', '17.6 m'], ['Joints / cameras', '7 / 4']], [9.5, 12.2, -.9], (kit, group) => {
    const carriage = buildMobileBase(group);
    // The lettering on each boom faces up in the parked pose.
    const frames = bodyFrames(REST.theta, baseFrame(REST), REST.end), up = [3, 4].map(k => [frames[k][1], frames[k][5], frames[k][9]]);
    const { bodies, snares } = buildArm(group, { up });
    // The foot restraint an operation fits to the free end (js/robotics/sequences.js): a grapple adapter the end effector
    // holds, the foot plate with a toe bar the boots slide under and heel clips behind them, and an ingress aid with a handle in front of the waist. Built
    // in the tip frame (js/robotics/pose.js tipFrame: x back along the arm, y to the rider's left, z ahead of the
    // rider), soles at x = -CREW_SOLE; js/robotics/index.js places it and scales it in. The post and the handle have
    // spheres of their own in js/robotics/collision.js (CREW_SPHERES): move one, move the other.
    const seat = new THREE.Group(), into = new Kit(), along = [0, 0, Math.PI / 2];
    seat.name = 'Canadarm2 foot restraint'; seat.visible = false; seat.raycast = () => seat.visible;
    into.cylinder([-.05, 0, 0], .25, .14, fixtureGrey, along); into.cylinder([-.19, 0, 0], .06, .16, palette.silver, along);
    into.box([-.285, 0, .03], [.03, .46, .42], palette.gold);
    into.rod([-.41, -.225, .17], [-.41, .225, .17], .011, palette.dark);
    for (const y of [-.225, 0, .225]) into.rod([-.30, y, .17], [-.41, y, .17], .011, palette.dark);
    for (const side of [-1, 1]) into.box([-.32, side * .125, -.167], [.04, .12, .025], palette.dark);
    into.rod([-.285, 0, .23], [-1.55, 0, .33], .022, palette.silver); into.rod([-1.55, -.19, .33], [-1.55, .19, .33], .019, palette.gold);
    into.box([-1.55, 0, .33], [.06, .06, .06], palette.silver);
    into.finish(seat); group.add(seat);
    group.userData.robotics = { carriage, bodies, snares, seat };
});
// The fixed fixtures' grapple heads (js/robotics/fixtures.js), each drawn into its module's group; the base and Dextre
// draw their own.
for (const entry of fixtures.values()) {
    if (entry.host !== 'station' || !parts.has(entry.part)) continue;
    const host = parts.get(entry.part).group, group = new THREE.Group(), kit = new Kit();
    hardware(kit).grappleFixture(entry.center, entry.normal); kit.finish(group); group.name = entry.name;
    // Fixtures are in station coordinates; module groups sit directly in the station.
    host.updateMatrix(); group.applyMatrix4(host.matrix.clone().invert()); host.add(group);
}
