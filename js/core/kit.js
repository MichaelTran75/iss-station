// Shared materials and primitive shapes, and Kit: it collects a part's pieces, then merges them into one mesh per kind
// of surface (pieces that differ only in colour, roughness and metalness draw together) plus one set of outline edges.
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
// A standard surface that takes its roughness and metalness per vertex (attribute `surface`) and its colour from the
// vertex colours, so pieces of many colours and finishes draw together. Clones keep the behaviour (the hook is on the
// class, and Material.copy leaves it alone).
export class KitSurface extends THREE.MeshStandardMaterial {
    constructor(parameters) { super(parameters); this.isKitSurface = true; this.vertexColors = true; }
    onBeforeCompile(shader) {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 surface;\nvarying vec2 vSurface;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvSurface = surface;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vSurface;')
            .replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace('float roughnessFactor = roughness;', 'float roughnessFactor = vSurface.x;'))
            .replace('#include <metalnessmap_fragment>', THREE.ShaderChunk.metalnessmap_fragment.replace('float metalnessFactor = metalness;', 'float metalnessFactor = vSurface.y;'));
    }
    customProgramCacheKey() { return 'kit-surface'; }
}
const textureSlots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'emissiveMap', 'aoMap', 'bumpMap', 'lightMap', 'displacementMap', 'envMap'];
// Only plain surfaces share: a textured one keeps its own mesh (it needs its uv, and parts look textured finishes up by
// their material: js/parts/poisk.js, rassvet.js), and so does one tagged for later use (Nauka's and Prichal's blankets
// are found by userData.poiskSkin and given Poisk's textured finish).
const sharable = surface => surface.type === 'MeshStandardMaterial' && !surface.isKitSurface && !surface.vertexColors
    && !textureSlots.some(slot => surface[slot]) && Object.keys(surface.userData).every(key => key === 'decal');
// Everything about a plain surface except colour, roughness and metalness.
const surfaceClass = s => [s.emissive.getHex(), s.emissiveIntensity, s.transparent, s.opacity, s.alphaTest,
    s.side, s.shadowSide, s.depthWrite, s.depthTest, s.colorWrite, s.polygonOffset, s.polygonOffsetFactor, s.polygonOffsetUnits, s.flatShading, s.wireframe,
    s.blending, s.envMapIntensity, s.toneMapped, s.fog, s.visible, s.normalScale.x, s.normalScale.y, s.bumpScale, s.aoMapIntensity, s.alphaToCoverage,
    s.premultipliedAlpha, s.dithering, s.userData.decal ? 1 : 0].join('|');
// A piece ready to merge with others of its class: position and normal as plain floats, plus its colour (linear, as
// vertex colours are) and its roughness and metalness, in 16-bit fractions.
const asFloats = attribute => attribute.isInterleavedBufferAttribute || attribute.normalized || !(attribute.array instanceof Float32Array)
    ? new THREE.Float32BufferAttribute(Array.from({ length: attribute.count * attribute.itemSize }, (_, i) => attribute.getComponent(Math.floor(i / attribute.itemSize), i % attribute.itemSize)), attribute.itemSize)
    : attribute;
function paint(geometry, surface) {
    const piece = new THREE.BufferGeometry(), count = geometry.attributes.position.count;
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    piece.setAttribute('position', asFloats(geometry.attributes.position)); piece.setAttribute('normal', asFloats(geometry.attributes.normal));
    piece.setIndex(geometry.index);
    const colour = new Uint16Array(count * 3), finish = new Uint16Array(count * 2), fraction = value => Math.round(THREE.MathUtils.clamp(value, 0, 1) * 65535);
    const [r, g, b] = [surface.color.r, surface.color.g, surface.color.b].map(fraction), roughness = fraction(surface.roughness), metalness = fraction(surface.metalness);
    for (let v = 0; v < count; v++) {
        colour[v * 3] = r; colour[v * 3 + 1] = g; colour[v * 3 + 2] = b;
        finish[v * 2] = roughness; finish[v * 2 + 1] = metalness;
    }
    piece.setAttribute('color', new THREE.BufferAttribute(colour, 3, true)); piece.setAttribute('surface', new THREE.BufferAttribute(finish, 2, true));
    return piece;
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
        // Standard surfaces that differ only in colour, roughness and metalness share one mesh and one draw: the colour
        // becomes a vertex colour and the two surface values a vertex attribute that KitSurface reads (see below).
        const classes = new Map();
        for (const [surface, geometries] of this.batches) {
            if (!sharable(surface)) {
                const mesh = new THREE.Mesh(mergeGeometries(geometries, false), surface.clone());
                mesh.castShadow = !surface.userData.decal; mesh.receiveShadow = true; parent.add(mesh); continue;
            }
            const key = surfaceClass(surface);
            if (!classes.has(key)) classes.set(key, { surface, pieces: [] });
            classes.get(key).pieces.push([surface, geometries]);
        }
        // A class draws in runs of up to 65,535 corners, so each run keeps a 16-bit index.
        for (const { surface, pieces } of classes.values()) {
            const shared = new KitSurface().copy(surface); shared.vertexColors = true; shared.color.set(0xffffff);
            let run = [], corners = 0;
            const draw = () => {
                if (!run.length) return;
                const mesh = new THREE.Mesh(mergeGeometries(run, false), shared);
                mesh.castShadow = !surface.userData.decal; mesh.receiveShadow = true; parent.add(mesh); run = []; corners = 0;
            };
            for (const [source, geometries] of pieces) for (const geometry of geometries) {
                const piece = paint(geometry, source), count = piece.attributes.position.count;
                if (!piece.index) piece.setIndex(sequentialIndex(count));
                if (corners + count > 65535) draw();
                run.push(piece); corners += count;
            }
            draw();
        }
        if (this.outlines.length) {
            const edges = new THREE.LineSegments(mergeGeometries(this.outlines, false), new THREE.LineBasicMaterial({ color: 0x43544e, transparent: true, opacity: .38 }));
            edges.userData.outline = true; parent.add(edges);
        }
        this.batches.clear(); this.outlines.length = 0;
    }
}
