// Robotics hardware shared by Canadarm2 (ssrms.js), the Mobile Base System (mobile-base.js), the station's grapple
// fixtures (fixtures.js) and Dextre: blanket finishes, a local hardware frame, camera heads, grapple fixtures and
// latching end effectors. `hardware(kit)` returns builders that add their pieces to that Kit.
import * as THREE from 'three';
import { Kit, material, palette, shapes, vertical } from '../core/kit.js';
import { payloadBlanket, payloadPillow } from '../core/surfaces.js';

const crumple = (u, v) => { const t = payloadBlanket.map.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(u, v); t.needsUpdate = true; return material(0xffffff, .9, .02, t); };
export const armBlanket = crumple(2, 2), boomBlanket = crumple(2, 12);
export const bronze = 0xa8854f, fixtureGrey = 0xc9ced0;
export const pillow = (x, y, z) => payloadPillow.clone().scale(x, y, z);

export function hardware(kit) {
    // Seams, collars and fittings use the hardware's local axis: local y along `axis`.
    function frame(center, axis) {
        const origin = new THREE.Vector3(...center);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(vertical, new THREE.Vector3(...axis).normalize());
        return {
            quaternion,
            point: (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(quaternion).add(origin).toArray(),
            add: (geometry, color) => kit.add(geometry.clone().applyQuaternion(quaternion), material(color), center, [1, 1, 1], [0, 0, 0], false),
            wrap: (geometry, surface) => kit.add(geometry.clone().applyQuaternion(quaternion), surface, center, [1, 1, 1], [0, 0, 0], false)
        };
    }
    const ring = (f, height, radius, tube, color) => f.add(new THREE.TorusGeometry(radius, tube, 6, 28).rotateX(Math.PI / 2).translate(0, height, 0), color);
    const box = (f, center, size, color) => f.add(new THREE.BoxGeometry(...size).translate(...center), color);
    const cylinder = (f, height, radius, length, color) => f.add(new THREE.CylinderGeometry(radius, radius, length, 24).translate(0, height, 0), color);
    function cameraHead(center, direction) {
        const camera = frame(center, direction);
        box(camera, [0, 0, 0], [.20, .28, .23], palette.white);
        box(camera, [0, .145, 0], [.17, .045, .19], palette.silver);
        cylinder(camera, .181, .071, .045, palette.dark);
        cylinder(camera, .207, .050, .010, palette.glass);
        const lamp = frame(camera.point(.122, .085, 0), direction);
        cylinder(lamp, .069, .038, .075, palette.silver);
        cylinder(lamp, .110, .031, .012, palette.white);
    }
    // Recessed bronze grapple head (a power and data grapple fixture): backing boss, pale capture rim, dark inset, three
    // radial guides and the central probe.
    function grappleFixture(center, normal) {
        const f = frame(center, normal);
        box(f, [0, -.022, 0], [.53, .10, .53], fixtureGrey);
        cylinder(f, -.01, .22, .17, 0x687476);
        cylinder(f, .060, .292, .052, bronze);
        cylinder(f, .091, .257, .012, 0x6f664d);
        ring(f, .10, .288, .019, 0xd4d1b6); ring(f, .101, .255, .012, bronze);
        for (let i = 0; i < 3; i++) {
            const a = i * Math.PI * 2 / 3; f.add(new THREE.BoxGeometry(.034, .025, .218).translate(0, .115, .123).rotateY(a), 0xc1b58c);
            kit.add(shapes.sphere, material(0xd1d2c9), f.point(Math.sin(a) * .245, .116, Math.cos(a) * .245), [.023, .018, .023], [0, 0, 0], false);
        }
        cylinder(f, .123, .045, .040, palette.silver); cylinder(f, .162, .022, .047, 0xe3e5db);
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; f.add(new THREE.CylinderGeometry(.013, .013, .012, 10).translate(Math.sin(a) * .274, .124, Math.cos(a) * .274), 0x757d77); }
    }
    // A latching end effector: blanketed barrel with four latch lobes, bronze-rimmed mouth and a grey base collar. The
    // snare wires inside the mouth are a separate group (`snare` below), so they can close.
    function endEffector(mouth, outward, { camera = false, scale = 1 } = {}) {
        const dir = new THREE.Vector3(...outward).normalize(), center = new THREE.Vector3(...mouth).addScaledVector(dir, -.5 * scale);
        const end = frame(center.toArray(), outward);
        end.wrap(new THREE.CylinderGeometry(.36 * scale, .36 * scale, 1.0 * scale, 32, 1), armBlanket);
        for (let lobe = 0; lobe < 4; lobe++) {
            const a = Math.PI / 4 + lobe * Math.PI / 2;
            end.wrap(new THREE.CylinderGeometry(.11 * scale, .11 * scale, .8 * scale, 16).translate(Math.cos(a) * .37 * scale, -.05 * scale, Math.sin(a) * .37 * scale), armBlanket);
        }
        ring(end, .5 * scale, .3 * scale, .045 * scale, bronze);
        cylinder(end, .44 * scale, .29 * scale, .02, palette.dark);
        cylinder(end, -.53 * scale, .38 * scale, .1 * scale, 0x9aa0a3);
        if (camera) {
            box(end, [.44, -.15, 0], [.16, .17, .16], palette.silver);
            cameraHead(end.point(.54, -.05, 0), outward);
        }
    }
    return { kit, frame, ring, box, cylinder, cameraHead, grappleFixture, endEffector };
}
// The three snare wires just inside an end effector's mouth, as their own group under `parent` (coordinates of the
// parent): `closeSnare(group, amount)` turns them a sixth of a turn and draws them in, as the snare ring does
// around a fixture's probe.
export function snare(parent, mouth, outward, scale = 1) {
    const group = new THREE.Group(), kit = new Kit(), points = [0, 1, 2].map(k => [Math.cos(k * Math.PI * 2 / 3) * .22 * scale, 0, Math.sin(k * Math.PI * 2 / 3) * .22 * scale]);
    for (let k = 0; k < 3; k++) kit.rod(points[k], points[(k + 1) % 3], .009, palette.rail);
    kit.finish(group); group.name = 'Snare';
    const dir = new THREE.Vector3(...outward).normalize();
    group.position.fromArray(mouth).addScaledVector(dir, -.04 * scale);
    group.quaternion.setFromUnitVectors(vertical, dir); group.userData.rest = group.quaternion.clone(); group.userData.closed = 0;
    parent.add(group);
    return group;
}
const twist = new THREE.Quaternion();
export function closeSnare(group, amount) {
    if (group.userData.closed === amount) return;
    group.userData.closed = amount;
    group.quaternion.copy(group.userData.rest).multiply(twist.setFromAxisAngle(vertical, amount * Math.PI / 3));
    group.scale.set(1 - .55 * amount, 1, 1 - .55 * amount);
}
