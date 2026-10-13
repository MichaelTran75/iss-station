// Pressurized mating adapters (PMA): mesh and textures taken unchanged from the reference model.
import * as THREE from 'three';
import { assetData, pmaTextures } from './data.js';
import { renderer } from './stage.js';

// BEGIN PMA REFERENCE ASSET: exact mesh, UVs and materials from the supplied models.
const pmaReferenceData = assetData.pmaReferenceData;
export const pmaArray = (encoded, ArrayType) => {
    const bytes = Uint8Array.from(atob(encoded), ch => ch.charCodeAt(0));
    return new ArrayType(bytes.buffer);
};
const pmaReferenceGeometry = pmaReferenceData.primitives.map(primitive => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pmaArray(primitive.position, Float32Array), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(pmaArray(primitive.normal, Float32Array), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(pmaArray(primitive.uv, Float32Array), 2));
    geometry.setIndex(new THREE.BufferAttribute(pmaArray(primitive.indices, primitive.indexType === 5123 ? Uint16Array : Uint32Array), 1));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
});
// Repaint only the PMA blanket islands in the source atlas to Harmony's #d6dad6 tone.
// Other atlas regions, coloured fittings, docking rings and all geometry stay unchanged.
function pmaHarmonyBlanketMap(original) {
    const canvas = document.createElement('canvas');
    canvas.width = original.image.width; canvas.height = original.image.height;
    const context = canvas.getContext('2d'); context.drawImage(original.image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height), rgba = pixels.data;
    for (let y = Math.floor(canvas.height * .135); y < Math.ceil(canvas.height * .447); y++) {
        for (let x = Math.floor(canvas.width * .185); x < Math.ceil(canvas.width * .495); x++) {
            const i = (y * canvas.width + x) * 4, r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
            if (Math.max(r, g, b) - Math.min(r, g, b) > 45) continue;
            const luminance = .2126 * r + .7152 * g + .0722 * b;
            const shade = 214 - luminance * .10;
            rgba[i] = shade; rgba[i + 1] = shade + 4; rgba[i + 2] = shade;
        }
    }
    context.putImageData(pixels, 0, 0);
    const map = new THREE.CanvasTexture(canvas); map.userData.harmonyBlanket = true; return map;
}
// The textures arrive with the model data (core/data.js), in material order.
const pmaReferenceMaterials = pmaReferenceData.materials.map((definition, index) => {
    const originalMap = pmaTextures[index];
    const blanket = definition.name === 'ISS_01_dull';
    const map = blanket ? pmaHarmonyBlanketMap(originalMap) : originalMap;
    map.flipY = false; map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const surface = new THREE.MeshStandardMaterial({ map, roughness: blanket ? .5 : definition.roughness, metalness: blanket ? .38 : definition.metalness });
    surface.name = definition.name; return surface;
});
export function referencePma(name, mount, rotation) {
    const assembly = new THREE.Group(); assembly.name = name;
    assembly.position.set(...mount); assembly.rotation.set(...rotation);
    assembly.userData.referenceSource = pmaReferenceData.source;
    assembly.userData.referenceSize = [2.5771868228912354, 3.196579337120056, 2.6519665306248754];
    assembly.userData.scale = 1;
    pmaReferenceGeometry.forEach((geometry, index) => {
        const mesh = new THREE.Mesh(geometry, pmaReferenceMaterials[pmaReferenceData.primitives[index].material]);
        mesh.castShadow = true; mesh.receiveShadow = true; assembly.add(mesh);
    });
    return assembly;
}
// END PMA REFERENCE ASSET
