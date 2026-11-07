// The 5 November 2026 configuration on Harmony's zenith port: PMA-3 with its docking adapter, and a cargo Dragon.
import * as THREE from 'three';
import { part, pmaReferenceLength, pmaReferenceOffset } from '../core/station.js';
import { referencePma } from '../core/pma.js';
import { dragonHull } from './dragon.js';

// Harmony's zenith berthing face (harmony.js: port at z -4.7, free face 2.168 m above the axis). PMA-3 is the PMA-2
// reference mesh turned from Harmony's forward axis onto the zenith axis (+z of the mesh to +y); its offset docking end
// leans aft.
const zenithFace = new THREE.Vector3(0, 2.168, -4.7), pmaTurn = [-Math.PI / 2, 0, 0];
// The docking ring's face, 0.19 m inboard of the guide-petal tips (as on PMA-2), on the offset axis.
const ringFace = new THREE.Vector3(0, zenithFace.y + pmaReferenceLength - .19, zenithFace.z + pmaReferenceOffset);
part('pma3', 'PMA-3 / IDA-3', '07 / RESEARCH JUNCTION', 'Pressurised Mating Adapter 3 on Harmony\'s zenith port, carrying the International Docking Adapter that commercial crew and cargo vehicles dock to. The same reference mesh as PMA-2 on Harmony\'s forward port.', [['Port', 'Harmony zenith'], ['Docking standard', 'IDSS']], [0, 3.6, -4.3], (kit, group) => {
    group.add(referencePma('PMA-3 / GLB reference structure', zenithFace.toArray(), pmaTurn));
    group.userData.dockingRing = ringFace.toArray();
});
// Same pose relative to its adapter as Crew Dragon on PMA-2 (petals interleaved): nose down onto the ring, the nose
// cone open and hinged toward the forward end. The gap matches Crew Dragon's contact gap.
part('cargo-dragon', 'Cargo Dragon CRS-35', '18 / VISITING SPACECRAFT', 'SpaceX\'s cargo Dragon, docked nose-down on the zenith adapter with its nose cone open. It shares Crew Dragon\'s capsule and trunk without the seats, cockpit controls and abort engines. Pressurised cargo rides in the capsule and unpressurised cargo in the trunk. The hull is the Crew Dragon model with its windows plated over; details are illustrative.', [['Port', 'Harmony zenith (IDA-3)'], ['Crew', 'None (cargo)']], [0, 8.2, -3.97], (kit, group) => {
    const { group: hull, noseCone, openAngle } = dragonHull(true);
    noseCone.rotation.x = openAngle;
    hull.rotation.set(Math.PI / 2, 0, Math.PI);
    hull.position.copy(ringFace).add(new THREE.Vector3(0, .003, 0));
    group.add(hull);
});
