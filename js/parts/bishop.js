// Bishop research airlock.
import * as THREE from 'three';
import { material, palette, shapes } from '../core/kit.js';
import { part, ring } from '../core/station.js';
import { badge } from '../core/surfaces.js';

part('bishop', 'Bishop research airlock', '21 / COMMERCIAL RESEARCH', 'Bishop was installed on Tranquility\'s port end in December 2020. Canadarm2 removes the bell-shaped airlock to expose its contents to space. It has six external payload sites; surface fittings and shielding are schematic.', [['Installed', '19 DEC 2020'], ['External payload sites', '6']], [-11.32, 1.0, 12], (kit, group) => {
    group.userData.attachment = 'Tranquility port';
    group.userData.externalPayloadSites = 6; group.userData.grappleFixtures = 2;
    // The ~2.1 m wide, ~1.8 m long bell is an approximate visual envelope.
    // NASA's guide confirms the no-hatch bell-jar architecture and CBM interface.
    const rootX = -10.29;
    const profile = [[1.025, 0], [1.025, .84], [1.012, 1.11], [.95, 1.37], [.79, 1.61], [.50, 1.77], [0, 1.84]];
    // Lathe Y axis rotates toward station port (-X).
    kit.add(new THREE.LatheGeometry(profile.map(([r, d]) => new THREE.Vector2(r, d)), 40), material(palette.white, .61, .26), [rootX, 0, 12], [1, 1, 1], [0, 0, Math.PI / 2], false);
    kit.cylinder([rootX + .10, 0, 12], 1.105, .23, palette.silver, [0, 0, Math.PI / 2]);
    ring(kit, [rootX + .23, 0, 12], 1.11, 'x', palette.dark, .042);
    ring(kit, [rootX - .06, 0, 12], 1.035, 'x', palette.silver, .037);
    ring(kit, [rootX - .85, 0, 12], 1.040, 'x', palette.silver, .029);
    for (let bolt = 0; bolt < 16; bolt++) {
        const a = bolt * Math.PI / 8;
        kit.add(shapes.lowCylinder, material(palette.rail), [rootX + .245, Math.cos(a) * 1.02, 12 + Math.sin(a) * 1.02], [.022, .028, .022], [0, 0, Math.PI / 2], false);
    }
    // Faceted MMOD shield panels and restrained seams distinguish the rigid shell.
    for (let panelIndex = 0; panelIndex < 12; panelIndex++) {
        const a = panelIndex * Math.PI / 6, ny = Math.cos(a), nz = Math.sin(a);
        kit.box([rootX - .47, ny * 1.025, 12 + nz * 1.025], [.72, .034, .48], panelIndex % 3 === 0 ? palette.hull : palette.white, [a, 0, 0], false);
        for (const along of [.19, .75]) kit.box([rootX - along, ny * 1.048, 12 + nz * 1.048], [.05, .024, .055], palette.silver, [a, 0, 0], false);
        kit.line(profile.slice(1).map(([r, d]) => [rootX - d, ny * (r + .012), 12 + nz * (r + .012)]));
    }
    // Six unoccupied external payload attachment pads; no specific 2023 payload assumed.
    for (let site = 0; site < 6; site++) {
        const a = site * Math.PI / 3 + Math.PI / 6, ny = Math.cos(a), nz = Math.sin(a);
        kit.box([rootX - .50, ny * 1.08, 12 + nz * 1.08], [.38, .10, .34], palette.silver, [a, 0, 0]);
        kit.box([rootX - .50, ny * 1.139, 12 + nz * 1.139], [.20, .025, .18], palette.dark, [a, 0, 0], false);
    }
    // Two robotic grapple fixtures on different shell faces.
    function bishopGrapple(origin, normal) {
        const o = new THREE.Vector3(...origin), n = new THREE.Vector3(...normal);
        const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
        const angles = [rotation.x, rotation.y, rotation.z];
        const at = d => o.clone().addScaledVector(n, d).toArray();
        kit.add(shapes.cylinder, material(palette.silver), at(.02), [.23, .08, .23], angles);
        kit.add(shapes.cylinder, material(palette.silver), at(.20), [.055, .29, .055], angles, false);
        kit.add(shapes.cylinder, material(palette.dark), at(.36), [.11, .055, .11], angles, false);
        for (const offset of [-1, 1]) kit.box([origin[0] + offset * .17, origin[1] + normal[1] * .07, origin[2] + normal[2] * .07], [.085, .08, .13], palette.white);
    }
    bishopGrapple([rootX - 1.12, .99, 12], [0, 1, 0]);
    bishopGrapple([rootX - 1.05, 0, 10.99], [0, 0, -1]);
    // Folded EVA handrails, Wi-Fi antenna paddles and a short protected cable run.
    for (const side of [-1, 1]) {
        const y = side * .76, z = 12.79;
        kit.rod([rootX - .21, y, z], [rootX - .76, y, z], .025, palette.gold);
        for (const d of [.21, .76]) kit.rod([rootX - d, y * .90, 12 + (z - 12) * .90], [rootX - d, y, z], .025, palette.gold);
    }
    for (const side of [-1, 1]) {
        kit.box([rootX - 1.38, side * .46, 12.82], [.24, .23, .09], palette.white, [0, .28, 0]);
        kit.box([rootX - 1.39, side * .46, 12.875], [.17, .15, .025], palette.silver, [0, .28, 0], false);
    }
    kit.rod([rootX - .19, .91, 12.51], [rootX - .94, .91, 12.51], .019, palette.dark);
    badge(kit, 'BISHOP', [rootX - .46, 1.155, 12], [.66, .20]);
});
