// Shared materials and primitive shapes, and Kit: it collects a part's pieces, then merges them into one mesh per
// material plus one set of outline edges.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const palette = { hull: 0xc9ceca, white: 0xe8eae5, silver: 0xa6aeac, dark: 0x292b32, rail: 0x8b918f, foil: 0xaaa087, gold: 0xa18c58, glass: 0x163442, accent: 0x247c6f, radiator: 0xbec3bf, black: 0x16171d, blue: 0x313544 };
const materials = new Map();
export function material(color, roughness = .62, metalness = .25, map = null) {
    const key = [color, roughness, metalness, map?.uuid || ''].join('|');
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness, map }));
    return materials.get(key);
}
export const shapes = { box: new THREE.BoxGeometry(1, 1, 1), cylinder: new THREE.CylinderGeometry(1, 1, 1, 24), lowCylinder: new THREE.CylinderGeometry(1, 1, 1, 10), sphere: new THREE.SphereGeometry(1, 24, 16) };
const transform = new THREE.Object3D();
export const vertical = new THREE.Vector3(0, 1, 0);
const temporaryVector = new THREE.Vector3();
// Kit merges keep each source's index buffer (shared corners are stored once, about a third of the expanded size), and
// a source geometry's outline edges are found once and then only copied and moved. Both give identical geometry.
const outlineCache = new WeakMap();
function outlineEdges(geometry) {
    const version = geometry.attributes.position.version + ':' + (geometry.index ? geometry.index.version : -1);
    let cached = outlineCache.get(geometry);
    if (!cached || cached.version !== version) { cached = { version, edges: new THREE.EdgesGeometry(geometry, 32) }; outlineCache.set(geometry, cached); }
    return cached.edges;
}
function sequentialIndex(count) {
    const index = new (count > 65535 ? Uint32Array : Uint16Array)(count);
    for (let i = 0; i < count; i++) index[i] = i;
    return new THREE.BufferAttribute(index, 1);
}
export class Kit {
    constructor() { this.batches = new Map(); this.outlines = []; }
    add(geometry, surface, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], outlined = true) {
        transform.position.fromArray(position); transform.scale.fromArray(scale); transform.rotation.set(...rotation); transform.updateMatrix();
        const placed = geometry.clone().applyMatrix4(transform.matrix);
        if (!placed.index) placed.setIndex(sequentialIndex(placed.attributes.position.count));
        if (!this.batches.has(surface)) this.batches.set(surface, []);
        this.batches.get(surface).push(placed);
        if (outlined) { const edges = outlineEdges(geometry); if (edges.attributes.position.count) this.outlines.push(edges.clone().applyMatrix4(transform.matrix)); }
    }
    box(position, scale, color = palette.hull, rotation = [0, 0, 0], outlined = true) { this.add(shapes.box, material(color), position, scale, rotation, outlined); }
    cylinder(position, radius, length, color = palette.hull, rotation = [Math.PI / 2, 0, 0]) { this.add(shapes.cylinder, material(color), position, [radius, length, radius], rotation); }
    sphere(position, scale, color = palette.white) { this.add(shapes.sphere, material(color), position, scale, [0, 0, 0], false); }
    rod(start, end, radius = .08, color = palette.rail) {
        const direction = new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
        const length = direction.length();
        if (length < .0001) return;
        const geometry = shapes.lowCylinder.clone().scale(radius, length, radius);
        geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vertical, direction.normalize()));
        geometry.translate((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2);
        this.add(geometry, material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    line(points) {
        const positions = [];
        for (let index = 1; index < points.length; index++) positions.push(...points[index - 1], ...points[index]);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.outlines.push(geometry);
    }
    finish(parent) {
        for (const [surface, geometries] of this.batches) {
            const mesh = new THREE.Mesh(mergeGeometries(geometries, false), surface.clone());
            mesh.castShadow = !surface.userData.decal; mesh.receiveShadow = true; parent.add(mesh);
        }
        if (this.outlines.length) {
            const edges = new THREE.LineSegments(mergeGeometries(this.outlines, false), new THREE.LineBasicMaterial({ color: 0x43544e, transparent: true, opacity: .38 }));
            edges.userData.outline = true; parent.add(edges);
        }
        this.batches.clear(); this.outlines.length = 0;
    }
}
