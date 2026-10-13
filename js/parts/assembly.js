// Final placement: the Russian segment moves onto the rebuilt PMA-1, the truss drops to its height, and Z1
// shrinks about its berthing face on Unity.
import * as THREE from 'three';
import { parts, russianSegmentOffset, trussDrop } from '../core/station.js';

// Keep the connected Russian modules in one translated frame after PMA-1 is rebuilt.
// Add to existing placements (including Rassvet's .45 collar adjustment); local geometry and labels stay paired.
for (const id of ['zarya', 'zvezda', 'nauka', 'prichal', 'soyuz', 'poisk', 'rassvet']) {
    parts.get(id).group.position.add(russianSegmentOffset);
}
// Lower the truss with everything it carries; Destiny's strut heads and Canadarm2's base were built at this height.
for (const id of ['truss', 'power', 'irosa', 'thermal', 's3payloads', 'p3payloads']) parts.get(id).group.position.y -= trussDrop;

// Reduce all Z1 hardware by 30%, keeping the lower berthing face fixed on Unity.
export const z1Group = parts.get('z1').group, z1Scale = .70;
const z1Mount = new THREE.Vector3(0, 2.95, 12);
z1Group.scale.setScalar(z1Scale);
z1Group.position.copy(z1Mount).multiplyScalar(1 - z1Scale);
