// Dextre, the Special Purpose Dexterous Manipulator, parked on the Mobile Base System (5 November 2026 configuration).
import * as THREE from 'three';
import { material, palette } from '../core/kit.js';
import { part, parts, ring } from '../core/station.js';

// Built along +y from the mouth of its lower end effector (y = 0) to the grapple fixture on its head (about 3.5 m): x
// runs across the shoulders, z out of its front. Proportions follow the published sizes (3.5 m tall, two 3.35 m
// arms); the shapes are simplified and the parking place, the outboard front fixture of the base, is illustrative.
const base = parts.get('robotics').group.userData.mobileBase;
const fixture = new THREE.Vector3(...base.frontFixtureCenters[0]), outward = new THREE.Vector3(...base.frontFixtureNormals[0]).normalize();
part('dextre', 'Dextre', '19 / CANADA - CSA', 'Canada\'s two-armed robot for fine work outside the station, such as changing batteries and pumps. Canadarm2 carries it to a worksite by the grapple fixture on its head; here it is latched by its lower end effector to a fixture on the Mobile Base System, arms folded. Each arm has seven joints and ends in a tool changeout mechanism, and the head carries two cameras on pan-tilt units. Shapes and parking place are illustrative.', [['Height', '3.5 m'], ['Arms', '2 × 3.35 m, 7 joints each']], [0, 2.2, .5], (kit, group) => {
    const white = palette.white, silver = palette.silver, dark = palette.dark, grey = 0xc9ced0, blanket = material(0xf1f2ee, .86, .04);
    const box = (center, size, color = white, outlined = true) => kit.box(center, size, color, [0, 0, 0], outlined);
    const drum = (center, radius, length, axis, color = silver) => kit.cylinder(center, radius, length, color, axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]);
    // Lower end effector, latched over the base's fixture, and the body roll joint above it.
    kit.add(new THREE.CylinderGeometry(.30, .30, .55, 28, 1), blanket, [0, .275, 0]);
    ring(kit, [0, .02, 0], .30, 'y', dark, .03); ring(kit, [0, .53, 0], .30, 'y', silver, .025);
    drum([0, .70, 0], .33, .30, 'y'); ring(kit, [0, .70, 0], .335, 'y', dark, .02);
    // Body: a tall box with the tool holster and the stowage platform on its front.
    box([0, 1.70, 0], [.64, 1.70, .56]);
    for (const y of [1.05, 1.70, 2.35]) box([0, y, 0], [.66, .035, .58], dark, false);
    box([0, 1.45, .40], [.52, .62, .26], grey); box([0, 1.78, .55], [.86, .06, .52], grey);
    for (const x of [-.25, 0, .25]) kit.cylinder([x, 1.92, .55], .06, .22, dark, [0, 0, 0]);
    // Shoulder beam, the head with its two pan-tilt cameras, and the grapple fixture on top.
    box([0, 2.75, 0], [2.0, .40, .50]);
    box([0, 3.10, .02], [.58, .30, .48]);
    for (const x of [-.2, .2]) {
        kit.rod([x, 3.25, .12], [x, 3.38, .2], .03, silver);
        box([x, 3.42, .24], [.16, .14, .2], white); kit.cylinder([x, 3.42, .35], .045, .04, dark);
    }
    kit.cylinder([0, 3.30, -.06], .28, .1, grey, [0, 0, 0]); kit.cylinder([0, 3.37, -.06], .12, .06, 0x687476, [0, 0, 0]);
    kit.rod([0, 3.37, -.06], [0, 3.55, -.06], .035, silver);
    // Two arms folded down at the shoulders: shoulder joints, the upper boom, the elbow bent toward the front, the
    // forearm, the wrist joints and a tool changeout mechanism with its jaws.
    for (const side of [-1, 1]) {
        const x = side * 1.05, shoulder = [x, 2.75, 0], elbow = [side * 1.12, 1.25, .05], wrist = [side * 1.02, .62, .72];
        drum(shoulder, .20, .40, 'x'); drum([x, 2.50, 0], .19, .30, 'y'); drum([x, 2.28, 0], .18, .34, 'z');
        kit.add(new THREE.CylinderGeometry(.11, .11, 1, 14, 1), blanket, [(shoulder[0] + elbow[0]) / 2, (2.12 + elbow[1]) / 2, .025], [1, 2.12 - elbow[1], 1], [0, 0, 0]);
        drum(elbow, .17, .32, 'x'); ring(kit, elbow, .175, 'x', dark, .015);
        kit.rod(elbow, wrist, .10, white);
        drum(wrist, .15, .28, 'x'); drum([wrist[0], wrist[1] - .18, wrist[2]], .14, .22, 'y');
        box([wrist[0], wrist[1] - .48, wrist[2]], [.32, .38, .30], grey);
        for (const s of [-1, 1]) box([wrist[0] + s * .08, wrist[1] - .72, wrist[2]], [.05, .14, .18], dark, false);
    }
    // Stand on the base's fixture: +y along the fixture's outward normal, shoulders along the truss.
    const across = new THREE.Vector3(1, 0, 0).addScaledVector(outward, -outward.x).normalize();
    group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, outward, across.clone().cross(outward)));
    group.position.copy(fixture).addScaledVector(outward, .115);
});
