// The droneship the booster lands on (Demo-2's was "Of Course I Still Love You"): TAIGA-ZOE's "Space X Drone Barge"
// (Sketchfab, CC BY 4.0), made into data/droneship.json and assets/droneship/ by droneship.py with its mesh unchanged:
// the black deck with the landing target, the wings with their catwalks, the equipment at both ends, the railings, the
// hull and its thrusters. Metres: 300 ft long along x, 170 ft across the wings, the deck at y 0 with the target's centre
// at the origin. Each textured material carries its colour image and an ORM image (occlusion, roughness, metalness).
import * as THREE from 'three';
import { pmaArray } from '../core/pma.js';

export async function createDroneship(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not load ' + url + ' (HTTP ' + response.status + ').');
    const data = await response.json();
    const loader = new THREE.TextureLoader();
    const texture = (path, colour) => {
        const map = loader.load(path); map.flipY = false; map.anisotropy = 8;
        map.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        return map;
    };
    const materials = data.materials.map(definition => {
        const material = new THREE.MeshStandardMaterial({ roughness: definition.roughness, metalness: definition.metalness, side: THREE.DoubleSide });
        material.color.setRGB(...definition.color);
        if (definition.map) material.map = texture(definition.map, true);
        if (definition.orm) { const orm = texture(definition.orm, false); material.aoMap = material.roughnessMap = material.metalnessMap = orm; }
        return material;
    });
    const group = new THREE.Group(); group.name = 'droneship';
    for (const primitive of data.primitives) {
        const quantised = pmaArray(primitive.position, Int16Array), position = new Float32Array(quantised.length);
        for (let i = 0; i < quantised.length; i++) position[i] = quantised[i] * data.quantum;
        const normals = pmaArray(primitive.normal, Int8Array), normal = new Float32Array(normals.length);
        for (let i = 0; i < normals.length; i++) normal[i] = normals[i] / 127;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
        if (primitive.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(pmaArray(primitive.uv, Float32Array), 2));
        geometry.setIndex(new THREE.BufferAttribute(pmaArray(primitive.index, primitive.wide ? Uint32Array : Uint16Array), 1));
        const mesh = new THREE.Mesh(geometry, materials[primitive.material]); mesh.castShadow = mesh.receiveShadow = true;
        group.add(mesh);
    }
    return { group, source: data.source };
}
