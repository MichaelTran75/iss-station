// Canadarm2 (SSRMS) as eight rigid bodies, built in the arm frame at the stretched-out zero pose (kinematics.js), each
// in its own group so that it can be set by its frame. From LEE A: B0 the end effector and half the shoulder roll
// joint; B1 roll to yaw; B2 yaw to pitch; B3 boom 1; B4 boom 2; B5 pitch to yaw; B6 yaw to roll; B7 half the wrist roll
// joint and LEE B. Each joint is a blanketed housing round a white drum, split across the joint so that each half turns
// with its own body. The arm is symmetric end for end (the half turn F in kinematics.js takes each body to its
// opposite), apart from the lettering and the blue band near LEE B.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { Kit, palette } from '../core/kit.js';
import { ARM_LENGTH, BOOM_SIDE, JOINTS, STACK } from './kinematics.js';
import { armBlanket, boomBlanket, hardware, pillow, snare } from './hardware.js';

const [SR, SY, SP, EP, WP, WY, WR] = JOINTS.map(joint => joint.point);
// Housing sizes: across the axis, then along it.
const housing = { roll: [.52, .5], yaw: [.52, .5], pitch: [.52, .62], elbow: [.6, .62] };
// One half of a joint housing, on the `sign` side of the joint along `axis`.
function half(hw, center, axis, sign, [size, length]) {
    const f = hw.frame(center, axis);
    f.wrap(pillow(size, length * .46, size).translate(0, sign * length / 4, 0), armBlanket);
    hw.cylinder(f, sign * (length / 2 + .04) / 2, .24, length / 2 + .04, palette.white);
    hw.ring(f, sign * (length / 2 + .02), .245, .02, palette.dark);
    hw.cylinder(f, sign * (length / 2 + .045), .19, .02, palette.silver);
}
const lettering = (() => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 512; const g = canvas.getContext('2d');
    g.translate(44, 488); g.rotate(-Math.PI / 2); g.font = 'italic 48px Georgia, "Times New Roman", serif'; g.fillStyle = '#3a3f45'; g.fillText('Canadarm', 0, 0);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const ink = new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: .3, roughness: .8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    ink.userData.decal = true; return ink;
})();
// A boom from the shoulder or wrist pitch joint at x0 to the elbow at x1, `side` of the roll line along y: end fittings
// beside the joint housings, a blanketed tube with collars, electronics boxes above and below, a camera on the outer side
// looking toward the elbow, the lettering facing `up` (a direction in the arm frame) and, on boom 2, a blue band near
// LEE B. Boom 2 is boom 1 turned end for end.
function boom(hw, x0, x1, side, { up, blue = false }) {
    const y = side * BOOM_SIDE, z = STACK, dir = Math.sign(x1 - x0), length = Math.abs(x1 - x0), span = length - .6;
    for (const [x, toward] of [[x0, dir], [x1, -dir]]) hw.kit.add(pillow(.56, .36, .5), armBlanket, [x + toward * .1, y, z], [1, 1, 1], [0, 0, 0], false);
    const middle = [(x0 + x1) / 2, y, z], frame = hw.frame(middle, [1, 0, 0]);
    frame.wrap(new THREE.CylinderGeometry(.19, .19, span, 28, 1), boomBlanket);
    for (const end of [-1, 1]) { hw.cylinder(frame, end * (span / 2 - .1), .235, .16, palette.white); hw.ring(frame, end * (span / 2 - .19), .236, .018, palette.silver); }
    const at = t => x0 + dir * length * t;
    for (const [t, above] of [[.22, 1], [.78, -1]]) hw.kit.add(pillow(.52, .3, .3), armBlanket, [at(t), y, z + above * .34], [1, 1, 1], [0, 0, 0], false);
    const cameraX = at(.42);
    hw.kit.rod([cameraX, y + side * .18, z], [cameraX, y + side * .3, z], .04, palette.silver);
    hw.cameraHead([cameraX, y + side * .42, z], [dir, 0, 0]);
    // The lettering faces `up`: CylinderGeometry measures its angle from local z toward local x.
    const facing = new THREE.Vector3(...up).setX(0).normalize().applyQuaternion(frame.quaternion.clone().invert());
    const angle = Math.atan2(facing.x, facing.z), towardElbow = x0 < x1 ? .12 : -.12;
    frame.wrap(new THREE.CylinderGeometry(.194, .194, 1.9, 6, 1, true, angle - .45, .9).translate(0, towardElbow * span, 0), lettering);
    if (blue) hw.cylinder(frame, (x1 > x0 ? -1 : 1) * (span / 2 - .55), .197, .14, 0x2a56a8);
}
// The eight bodies, added to `parent`; `up` gives each boom the arm-frame direction its lettering faces. Returns the
// bodies (LEE A's first) and the two snares (LEE A's, LEE B's).
export function buildArm(parent, { up = [[0, 0, 1], [0, 0, 1]] } = {}) {
    const bodies = [], snares = [];
    const body = (name, build) => {
        const kit = new Kit(), group = new THREE.Group(); group.name = name; group.userData.armBody = bodies.length;
        build(hardware(kit)); kit.finish(group); parent.add(group); bodies.push(group); return group;
    };
    const [roll, yaw, pitch] = [[1, 0, 0], [0, 0, 1], [0, 1, 0]];
    const a = body('Canadarm2 LEE A', hw => { hw.endEffector([0, 0, 0], [-1, 0, 0], { camera: true }); half(hw, SR, roll, -1, housing.roll); });
    snares.push(snare(a, [0, 0, 0], [-1, 0, 0]));
    body('Canadarm2 shoulder roll', hw => {
        half(hw, SR, roll, 1, housing.roll); half(hw, SY, yaw, -1, housing.yaw);
        hw.kit.add(pillow(.3, .4, .24), armBlanket, [SR[0] + .35, 0, -.12], [1, 1, 1], [0, 0, 0], false);
    });
    body('Canadarm2 shoulder yaw', hw => {
        half(hw, SY, yaw, 1, housing.yaw); half(hw, SP, pitch, -1, housing.pitch);
        hw.kit.add(pillow(.4, .26, .12), armBlanket, [SY[0], -.13, .27], [1, 1, 1], [0, 0, 0], false);
    });
    body('Canadarm2 boom 1', hw => { half(hw, SP, pitch, 1, housing.pitch); half(hw, EP, pitch, 1, housing.elbow); boom(hw, SP[0], EP[0], 1, { up: up[0] }); });
    body('Canadarm2 boom 2', hw => { half(hw, EP, pitch, -1, housing.elbow); half(hw, WP, pitch, -1, housing.pitch); boom(hw, WP[0], EP[0], -1, { up: up[1], blue: true }); });
    body('Canadarm2 wrist pitch', hw => {
        half(hw, WP, pitch, 1, housing.pitch); half(hw, WY, yaw, 1, housing.yaw);
        hw.kit.add(pillow(.4, .26, .12), armBlanket, [WY[0], .13, .27], [1, 1, 1], [0, 0, 0], false);
    });
    body('Canadarm2 wrist yaw', hw => {
        half(hw, WY, yaw, -1, housing.yaw); half(hw, WR, roll, -1, housing.roll);
        hw.kit.add(pillow(.3, .4, .24), armBlanket, [WR[0] - .35, 0, -.12], [1, 1, 1], [0, 0, 0], false);
    });
    const b = body('Canadarm2 LEE B', hw => { half(hw, WR, roll, 1, housing.roll); hw.endEffector([ARM_LENGTH, 0, 0], [1, 0, 0], { camera: true }); });
    snares.push(snare(b, [ARM_LENGTH, 0, 0], [1, 0, 0]));
    return { bodies, snares };
}
