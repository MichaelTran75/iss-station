// Line art worker: finds the crease (> threshold) and boundary edges drawn over ghosted parts, off the main thread.
// Message: {meshes: [{position: Float32Array, index: Uint16Array | Uint32Array | null, matrix: Float64Array(16)}], degrees}.
// Reply: {points: Float32Array} — every mesh's segments moved by its matrix and joined in order (as mergeGeometries does).

// Crease and boundary edges, as THREE.EdgesGeometry finds them, but on typed-array hashes rather than string keys:
// corners weld on a 0.1 mm grid, and an edge shared by two faces is kept when their normals part by more than the threshold.
function creaseSegments(position, index, degrees) {
    const vertexCount = position.length / 3, corners = index ? index.length : vertexCount;
    const cosLimit = Math.cos(degrees * Math.PI / 180), tableSize = count => 1 << Math.ceil(Math.log2(Math.max(16, count * 2)));
    const weldSize = tableSize(vertexCount), weldSlots = new Int32Array(weldSize).fill(-1), grid = new Int32Array(vertexCount * 3), weld = new Int32Array(vertexCount);
    let welded = 0;
    for (let v = 0; v < vertexCount; v++) {
        const x = Math.round(position[v * 3] * 1e4), y = Math.round(position[v * 3 + 1] * 1e4), z = Math.round(position[v * 3 + 2] * 1e4);
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
        const i0 = index ? index[face * 3] : face * 3, i1 = index ? index[face * 3 + 1] : face * 3 + 1, i2 = index ? index[face * 3 + 2] : face * 3 + 2;
        if (weld[i0] === weld[i1] || weld[i1] === weld[i2] || weld[i0] === weld[i2]) continue;
        const ux = position[i1 * 3] - position[i0 * 3], uy = position[i1 * 3 + 1] - position[i0 * 3 + 1], uz = position[i1 * 3 + 2] - position[i0 * 3 + 2];
        const vx = position[i2 * 3] - position[i0 * 3], vy = position[i2 * 3 + 1] - position[i0 * 3 + 1], vz = position[i2 * 3 + 2] - position[i0 * 3 + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, length = Math.hypot(nx, ny, nz);
        if (length < 1e-12) continue;
        normals[face * 3] = nx / length; normals[face * 3 + 1] = ny / length; normals[face * 3 + 2] = nz / length;
        visit(face, i0, i1); visit(face, i1, i2); visit(face, i2, i0);
    }
    for (let slot = 0; slot < edgeSize; slot++) if (edgeUses[slot] === 1) segments.push(edgeFrom[slot], edgeTo[slot]);
    return segments;
}

self.onmessage = ({ data }) => {
    const pieces = [];
    let total = 0;
    for (const { position, index, matrix: e } of data.meshes) {
        const segments = creaseSegments(position, index, data.degrees);
        if (!segments.length) continue;
        // Matrix4.applyMatrix4 on each end point (column-major, with the projective divide).
        const points = new Float32Array(segments.length * 3);
        for (let i = 0; i < segments.length; i++) {
            const v = segments[i], x = position[v * 3], y = position[v * 3 + 1], z = position[v * 3 + 2];
            const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
            points[i * 3] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
            points[i * 3 + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
            points[i * 3 + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
        }
        pieces.push(points); total += points.length;
    }
    const merged = new Float32Array(total);
    let offset = 0;
    for (const points of pieces) { merged.set(points, offset); offset += points.length; }
    self.postMessage({ points: merged }, [merged.buffer]);
};
