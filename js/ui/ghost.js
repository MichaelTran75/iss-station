// Ghost context: while a part is selected, every other visible part drops to 10% opacity and keeps only its line
// art, the crease (> 50°) and boundary edges of its meshes. Line art is built once, in idle slices after load, one
// parent group at a time, so moving assemblies (wings, dishes, shutters, Dragon) carry their own. It lives on
// layer 1, which the camera renders but picking and shadows ignore.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { camera } from '../core/stage.js';
import { query } from '../core/quality.js';
import { ghostOpacity, parts } from '../core/station.js';
import { releaseLines } from '../core/release.js';

const lineArtDegrees = 50, lineArtLayer = 1;
const lineArtMaterial = new THREE.LineBasicMaterial({ color: 0x43544e, transparent: true, opacity: .42, depthWrite: false });
const ghostMaterials = new Map();
camera.layers.enable(lineArtLayer);
export function ghostMaterial(source) {
    let ghost = ghostMaterials.get(source);
    if (!ghost) {
        ghost = source.clone();
        Object.assign(ghost, { transparent: true, opacity: (source.transparent ? source.opacity : 1) * ghostOpacity, depthWrite: false, alphaTest: 0 });
        ghost.emissive?.set(0x000000); ghost.needsUpdate = true;
        ghostMaterials.set(source, ghost);
    }
    return ghost;
}
// Crease and boundary edges, as THREE.EdgesGeometry finds them, but on typed-array hashes rather than string
// keys: corners weld on a 0.1 mm grid, and an edge shared by two faces is kept when their normals part by more
// than the threshold. Returns segment end points.
export function creaseSegments(geometry, degrees) {
    const position = geometry.attributes.position, index = geometry.index, corners = index ? index.count : position.count;
    const cosLimit = Math.cos(degrees * Math.PI / 180), tableSize = count => 1 << Math.ceil(Math.log2(Math.max(16, count * 2)));
    const weldSize = tableSize(position.count), weldSlots = new Int32Array(weldSize).fill(-1), grid = new Int32Array(position.count * 3), weld = new Int32Array(position.count);
    let welded = 0;
    for (let v = 0; v < position.count; v++) {
        const x = Math.round(position.getX(v) * 1e4), y = Math.round(position.getY(v) * 1e4), z = Math.round(position.getZ(v) * 1e4);
        let slot = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & (weldSize - 1);
        for (;;) {
            const id = weldSlots[slot];
            if (id === -1) { weldSlots[slot] = welded; grid[welded * 3] = x; grid[welded * 3 + 1] = y; grid[welded * 3 + 2] = z; weld[v] = welded++; break; }
            if (grid[id * 3] === x && grid[id * 3 + 1] === y && grid[id * 3 + 2] === z) { weld[v] = id; break; }
            slot = (slot + 1) & (weldSize - 1);
        }
    }
    const edgeSize = tableSize(corners), edgeLow = new Int32Array(edgeSize).fill(-1), edgeHigh = new Int32Array(edgeSize), edgeFace = new Int32Array(edgeSize);
    const edgeFrom = new Int32Array(edgeSize), edgeTo = new Int32Array(edgeSize), edgeUses = new Uint8Array(edgeSize), normals = new Float32Array(corners), segments = [];
    const visit = (face, from, to) => {
        const a = weld[from], b = weld[to], low = Math.min(a, b), high = Math.max(a, b);
        let slot = (Math.imul(low, 0x9e3779b1) ^ Math.imul(high, 0x85ebca77)) & (edgeSize - 1);
        for (;;) {
            if (edgeLow[slot] === -1) { edgeLow[slot] = low; edgeHigh[slot] = high; edgeFace[slot] = face; edgeFrom[slot] = from; edgeTo[slot] = to; edgeUses[slot] = 1; return; }
            if (edgeLow[slot] === low && edgeHigh[slot] === high) {
                const other = edgeFace[slot] * 3, own = face * 3;
                if (edgeUses[slot] === 1 && normals[other] * normals[own] + normals[other + 1] * normals[own + 1] + normals[other + 2] * normals[own + 2] <= cosLimit) segments.push(from, to);
                edgeUses[slot] = 2; return;
            }
            slot = (slot + 1) & (edgeSize - 1);
        }
    };
    for (let face = 0; face < corners / 3; face++) {
        const i0 = index ? index.getX(face * 3) : face * 3, i1 = index ? index.getX(face * 3 + 1) : face * 3 + 1, i2 = index ? index.getX(face * 3 + 2) : face * 3 + 2;
        if (weld[i0] === weld[i1] || weld[i1] === weld[i2] || weld[i0] === weld[i2]) continue;
        const ux = position.getX(i1) - position.getX(i0), uy = position.getY(i1) - position.getY(i0), uz = position.getZ(i1) - position.getZ(i0);
        const vx = position.getX(i2) - position.getX(i0), vy = position.getY(i2) - position.getY(i0), vz = position.getZ(i2) - position.getZ(i0);
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, length = Math.hypot(nx, ny, nz);
        if (length < 1e-12) continue;
        normals[face * 3] = nx / length; normals[face * 3 + 1] = ny / length; normals[face * 3 + 2] = nz / length;
        visit(face, i0, i1); visit(face, i1, i2); visit(face, i2, i0);
    }
    for (let slot = 0; slot < edgeSize; slot++) if (edgeUses[slot] === 1) segments.push(edgeFrom[slot], edgeTo[slot]);
    const points = new Float32Array(segments.length * 3);
    for (let i = 0; i < segments.length; i++) { points[i * 3] = position.getX(segments[i]); points[i * 3 + 1] = position.getY(segments[i]); points[i * 3 + 2] = position.getZ(segments[i]); }
    return points;
}
export function scheduleLineArt() {
    const jobs = new Map();
    for (const entry of parts.values()) entry.group.traverse(child => {
        if (!child.isMesh || child.isSkinnedMesh || child.userData.interior || child.userData.puff) return;   // no outlines on thruster exhaust
        if (!jobs.has(child.parent)) jobs.set(child.parent, { entry, parent: child.parent, meshes: [] });
        jobs.get(child.parent).meshes.push(child);
    });
    const queue = [...jobs.values()];
    const attach = (job, geometry) => {
        const lines = new THREE.LineSegments(geometry, lineArtMaterial);
        lines.userData.lineArt = true; lines.layers.set(lineArtLayer); lines.visible = !!job.entry.ghost; job.parent.add(lines);
        releaseLines(lines);   // dropped here once on the GPU (js/core/release.js)
    };
    // The edges are found in a worker (js/workers/line-art.js), one parent group at a time; this thread only
    // copies each group's vertex arrays across and adds the finished lines.
    let worker = null, current = null;
    if (query.get('worker') !== '0' && typeof Worker === 'function') {
        try { worker = new Worker(new URL('../workers/line-art.js?v=8b3d432c47', import.meta.url), { type: 'module' }); } catch (error) { worker = null; }
    }
    const send = () => {
        current = queue.shift();
        if (!current) { worker.terminate(); return; }
        const meshes = current.meshes.map(mesh => {
            mesh.updateMatrix();
            const geometry = mesh.geometry;
            return { position: geometry.attributes.position.array.slice(), index: geometry.index ? geometry.index.array.slice() : null, matrix: Float64Array.from(mesh.matrix.elements) };
        });
        worker.postMessage({ meshes, degrees: lineArtDegrees }, meshes.flatMap(mesh => mesh.index ? [mesh.position.buffer, mesh.index.buffer] : [mesh.position.buffer]));
    };
    // Without a worker the same search runs here in idle slices of at most 10 ms.
    const build = job => {
        const pieces = [];
        for (const mesh of job.meshes) {
            const points = creaseSegments(mesh.geometry, lineArtDegrees);
            if (!points.length) continue;
            mesh.updateMatrix();
            pieces.push(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(points, 3)).applyMatrix4(mesh.matrix));
        }
        if (pieces.length) attach(job, pieces.length > 1 ? mergeGeometries(pieces, false) : pieces[0]);
    };
    const later = step => window.requestIdleCallback ? requestIdleCallback(step, { timeout: 250 }) : setTimeout(step, 16);
    const step = () => {
        const start = performance.now();
        while (queue.length && performance.now() - start < 10) build(queue.shift());
        if (queue.length) later(step);
    };
    if (worker) {
        worker.onmessage = ({ data }) => {
            if (data.points.length) attach(current, new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(data.points, 3)));
            send();
        };
        worker.onerror = event => { event.preventDefault(); worker.terminate(); worker = null; if (current) queue.unshift(current); later(step); };
        send();
    } else later(step);
}
