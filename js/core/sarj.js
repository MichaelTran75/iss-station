// Solar alpha rotary joints. Each SARJ turns everything outboard of it (P4 to P6 or S4 to S6, their photovoltaic wings
// and the iROSAs on them) about the truss axis through the joint. The parts keep their own groups, so each part gets a
// pivot per side on that axis and the page turns all of one side's pivots together (sarjPivots).
import * as THREE from 'three';
import { solarRotaryJointX } from './station.js';

// The joint axis in the truss frame (truss.js builds the SARJ rings at y 6.85, z 4; the parts that ride on it share
// the frame, all lowered together by trussDrop).
export const sarjAxis = { y: 6.85, z: 4 };
export const sarjPivots = { port: [], starboard: [] };
export function sarjPivot(group, side) {
    const pivot = new THREE.Group(); pivot.name = (side < 0 ? 'Port' : 'Starboard') + ' SARJ pivot';
    pivot.position.set(side * solarRotaryJointX, sarjAxis.y, sarjAxis.z); group.add(pivot);
    sarjPivots[side < 0 ? 'port' : 'starboard'].push(pivot); return pivot;
}
// Moves a child of the pivot's parent into the pivot without moving it on screen.
export function intoPivot(pivot, object) { object.position.sub(pivot.position); pivot.add(object); }
// Splits a part's merged meshes and outlines at the two joints: triangles and line segments whose centre lies outboard
// of a joint move into that side's pivot. The outboard meshes share the vertex arrays and take only their own triangles.
export function splitAtJoints(group) {
    const pivots = { [-1]: sarjPivot(group, -1), [1]: sarjPivot(group, 1) };
    const sideOf = x => x < -solarRotaryJointX ? -1 : x > solarRotaryJointX ? 1 : 0;
    for (const child of [...group.children]) {
        if (child.isMesh && child.geometry.index) {
            const geometry = child.geometry, position = geometry.attributes.position, index = geometry.index.array;
            const lists = { [-1]: [], 0: [], [1]: [] };
            for (let i = 0; i < index.length; i += 3) {
                const x = (position.getX(index[i]) + position.getX(index[i + 1]) + position.getX(index[i + 2])) / 3;
                lists[sideOf(x)].push(index[i], index[i + 1], index[i + 2]);
            }
            if (!lists[-1].length && !lists[1].length) continue;
            const Index = index.constructor;
            for (const side of [-1, 1]) {
                if (!lists[side].length) continue;
                const part = new THREE.BufferGeometry();
                for (const [name, attribute] of Object.entries(geometry.attributes)) part.setAttribute(name, attribute);
                part.setIndex(new THREE.BufferAttribute(new Index(lists[side]), 1));
                const mesh = new THREE.Mesh(part, child.material); mesh.castShadow = child.castShadow; mesh.receiveShadow = child.receiveShadow;
                Object.assign(mesh.userData, child.userData); mesh.position.copy(pivots[side].position).negate(); pivots[side].add(mesh);
            }
            if (lists[0].length) geometry.setIndex(new THREE.BufferAttribute(new Index(lists[0]), 1)); else group.remove(child);
        } else if (child.isLineSegments && !child.geometry.index) {
            const position = child.geometry.attributes.position.array, lists = { [-1]: [], 0: [], [1]: [] };
            for (let i = 0; i < position.length; i += 6) lists[sideOf((position[i] + position[i + 3]) / 2)].push(...position.subarray(i, i + 6));
            if (!lists[-1].length && !lists[1].length) continue;
            for (const side of [-1, 1]) {
                if (!lists[side].length) continue;
                const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lists[side], 3)), child.material);
                Object.assign(lines.userData, child.userData); lines.position.copy(pivots[side].position).negate(); pivots[side].add(lines);
            }
            child.geometry.setAttribute('position', new THREE.Float32BufferAttribute(lists[0], 3));
        }
    }
    return pivots;
}
