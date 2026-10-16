// Vertex data the GPU holds and nothing on this side reads again is dropped from memory once the renderer has
// uploaded it: the normals and texture coordinates of the station's meshes (picking needs only their positions and
// indices, which stay) and all of their outline and line-art edges, which are never picked. Of the station's 95 MB of
// vertex data that is about 58 MB. An array is swapped for an empty one of its type rather than null, so a raycast
// that reads a dropped attribute (three.js fills in the hit's normal and texture coordinate) gets NaN instead of
// failing. Attributes rewritten after the build (dynamic usage) and instanced ones keep theirs. Nothing is uploaded
// again after a lost WebGL context; the page asks for a reload then anyway (js/main.js).
import * as THREE from 'three';

function drop() { this.array = new this.array.constructor(0); }
function release(attribute) {
    if (!attribute || attribute.isInterleavedBufferAttribute || attribute.isInstancedBufferAttribute || attribute.usage !== THREE.StaticDrawUsage || !attribute.array.length) return;
    attribute.onUpload(drop);
}
// Edges: kept out of picking, their bounds found first (for culling and framing).
export function releaseLines(lines) {
    const geometry = lines.geometry;
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    lines.raycast = () => {};
    release(geometry.attributes.position); release(geometry.index);
}
export function releaseAfterUpload(root) {
    root.traverse(object => {
        if (!object.geometry || object.isInstancedMesh) return;
        if (object.isMesh) for (const name of ['normal', 'uv', 'uv1', 'color', 'tangent']) release(object.geometry.attributes[name]);
        else if (object.userData.outline || object.userData.lineArt) releaseLines(object);
    });
}
