// Clearance fields (collision.js): for one rigid body (the station's fixed structure, a solar wing, a radiator wing,
// the base…), the distance from each point of a lattice to the body's nearest triangle, kept only within `band` of
// the body, one byte a point, in sparse blocks of 8 × 8 × 8 points. A query interpolates the eight lattice points
// around it; beyond the band it reads the band.
//
// Built from the page's own triangles: exact distances at the lattice points next to each triangle (closest point by
// regions, after Ericson), then each point hands its nearest surface point on to its six neighbours, nearest first,
// out to the band. Measured against exact distances (8 November 2026, the station's 1.8 million fixed triangles, 0.25 m
// lattice): 0.8 s, 1 MB; at 0.15 to 0.6 m from a surface the field reads at most 7.5 cm long and 14 cm short (long
// next to thin edges, where interpolation rounds the corner off), so collision.js takes a margin off every reading.
// Plain arithmetic, no imports: it runs in the clearance worker (js/workers/clearance-map.js) and on the main thread.
export const BLOCK = 8;
const VOLUME = BLOCK * BLOCK * BLOCK;

// `lo`, `hi`: the body's bounds in its own frame (m). add() takes a mesh's positions (any stride), its index (or
// null) and the matrix from the mesh to the body's frame (column-major); finish() returns the field.
export function fieldBuilder(lo, hi, { spacing = .25, band = 1 } = {}) {
    const pad = band + 2 * spacing, origin = [lo[0] - pad, lo[1] - pad, lo[2] - pad];
    const size = [0, 1, 2].map(d => Math.ceil((hi[d] - lo[d] + 2 * pad) / spacing) + 1);
    const blocks = size.map(n => Math.ceil(n / BLOCK));
    const blockOf = new Int32Array(blocks[0] * blocks[1] * blocks[2]).fill(-1);
    let count = 0, capacity = 256;
    let squared = new Float32Array(capacity * VOLUME).fill(Infinity), nearest = new Float32Array(capacity * VOLUME * 3), where = new Int32Array(capacity * 3);
    function grow() {
        const more = capacity * 2, s = new Float32Array(more * VOLUME).fill(Infinity), n = new Float32Array(more * VOLUME * 3), w = new Int32Array(more * 3);
        s.set(squared); n.set(nearest); w.set(where);
        squared = s; nearest = n; where = w; capacity = more;
    }
    // The index of lattice point (i, j, k), its block made if need be; -1 outside the lattice.
    function point(i, j, k) {
        if (i < 0 || j < 0 || k < 0 || i >= size[0] || j >= size[1] || k >= size[2]) return -1;
        const key = ((i >> 3) * blocks[1] + (j >> 3)) * blocks[2] + (k >> 3);
        let block = blockOf[key];
        if (block < 0) {
            if (count === capacity) grow();
            block = blockOf[key] = count++;
            where[block * 3] = i >> 3; where[block * 3 + 1] = j >> 3; where[block * 3 + 2] = k >> 3;
        }
        return block * VOLUME + ((i & 7) * BLOCK + (j & 7)) * BLOCK + (k & 7);
    }
    const seed = spacing, seedSquared = seed * seed, bandSquared = band * band, q = [0, 0, 0];
    // The point of triangle abc closest to p, into q.
    function closest(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
        const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
        const apx = px - ax, apy = py - ay, apz = pz - az;
        const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
        if (d1 <= 0 && d2 <= 0) { q[0] = ax; q[1] = ay; q[2] = az; return; }
        const bpx = px - bx, bpy = py - by, bpz = pz - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
        if (d3 >= 0 && d4 <= d3) { q[0] = bx; q[1] = by; q[2] = bz; return; }
        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) { const t = d1 / (d1 - d3); q[0] = ax + t * abx; q[1] = ay + t * aby; q[2] = az + t * abz; return; }
        const cpx = px - cx, cpy = py - cy, cpz = pz - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { q[0] = cx; q[1] = cy; q[2] = cz; return; }
        const vb = d5 * d2 - d1 * d6;
        if (vb <= 0 && d2 >= 0 && d6 <= 0) { const t = d2 / (d2 - d6); q[0] = ax + t * acx; q[1] = ay + t * acy; q[2] = az + t * acz; return; }
        const va = d3 * d6 - d5 * d4;
        if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const t = (d4 - d3) / ((d4 - d3) + (d5 - d6)); q[0] = bx + t * (cx - bx); q[1] = by + t * (cy - by); q[2] = bz + t * (cz - bz); return; }
        const denominator = 1 / (va + vb + vc), v = vb * denominator, w = vc * denominator;
        q[0] = ax + abx * v + acx * w; q[1] = ay + aby * v + acy * w; q[2] = az + abz * v + acz * w;
    }
    let triangles = 0;
    // Exact distances at the lattice points within one spacing of triangle abc.
    function triangle(ax, ay, az, bx, by, bz, cx, cy, cz) {
        triangles++;
        const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - seed - origin[0]) / spacing)), i1 = Math.min(size[0] - 1, Math.floor((Math.max(ax, bx, cx) + seed - origin[0]) / spacing));
        const j0 = Math.max(0, Math.ceil((Math.min(ay, by, cy) - seed - origin[1]) / spacing)), j1 = Math.min(size[1] - 1, Math.floor((Math.max(ay, by, cy) + seed - origin[1]) / spacing));
        const k0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - seed - origin[2]) / spacing)), k1 = Math.min(size[2] - 1, Math.floor((Math.max(az, bz, cz) + seed - origin[2]) / spacing));
        if (i0 > i1 || j0 > j1 || k0 > k1) return;
        // The triangle's plane, to pass over points too far from it cheaply.
        let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay), ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        const length = Math.hypot(nx, ny, nz), flat = length > 1e-12;
        if (flat) { nx /= length; ny /= length; nz /= length; }
        for (let i = i0; i <= i1; i++) {
            const px = origin[0] + i * spacing;
            for (let j = j0; j <= j1; j++) {
                const py = origin[1] + j * spacing;
                for (let k = k0; k <= k1; k++) {
                    const pz = origin[2] + k * spacing;
                    if (flat && Math.abs((px - ax) * nx + (py - ay) * ny + (pz - az) * nz) > seed) continue;
                    closest(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz);
                    const dx = px - q[0], dy = py - q[1], dz = pz - q[2], d = dx * dx + dy * dy + dz * dz;
                    if (d > seedSquared) continue;
                    const id = point(i, j, k);
                    if (d < squared[id]) { squared[id] = d; nearest[id * 3] = q[0]; nearest[id * 3 + 1] = q[1]; nearest[id * 3 + 2] = q[2]; }
                }
            }
        }
    }
    function add(positions, index, matrix, stride = 3, offset = 0) {
        const m = matrix, vertices = (positions.length - offset) / stride | 0, at = new Float32Array(vertices * 3);
        for (let v = 0; v < vertices; v++) {
            const x = positions[v * stride + offset], y = positions[v * stride + offset + 1], z = positions[v * stride + offset + 2];
            at[v * 3] = m[0] * x + m[4] * y + m[8] * z + m[12]; at[v * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; at[v * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
        }
        const corners = index ? index.length : vertices;
        for (let f = 0; f + 2 < corners; f += 3) {
            const a = (index ? index[f] : f) * 3, b = (index ? index[f + 1] : f + 1) * 3, c = (index ? index[f + 2] : f + 2) * 3;
            triangle(at[a], at[a + 1], at[a + 2], at[b], at[b + 1], at[b + 2], at[c], at[c + 1], at[c + 2]);
        }
    }
    // Hand each point's nearest surface point on to its neighbours, nearest first (buckets 2 mm wide).
    function spread() {
        const width = .002, buckets = Array.from({ length: Math.ceil(band / width) + 2 }, () => []), last = buckets.length - 1;
        for (let id = 0; id < count * VOLUME; id++) if (squared[id] < Infinity) buckets[Math.min(last, Math.floor(Math.sqrt(squared[id]) / width))].push(id);
        const steps = [1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1];
        for (let b = 0; b <= last; b++) {
            const list = buckets[b];
            for (let n = 0; n < list.length; n++) {
                const id = list[n], block = Math.floor(id / VOLUME), local = id - block * VOLUME;
                const i = where[block * 3] * BLOCK + (local >> 6), j = where[block * 3 + 1] * BLOCK + ((local >> 3) & 7), k = where[block * 3 + 2] * BLOCK + (local & 7);
                const qx = nearest[id * 3], qy = nearest[id * 3 + 1], qz = nearest[id * 3 + 2];
                for (let s = 0; s < 18; s += 3) {
                    const ni = i + steps[s], nj = j + steps[s + 1], nk = k + steps[s + 2];
                    const dx = origin[0] + ni * spacing - qx, dy = origin[1] + nj * spacing - qy, dz = origin[2] + nk * spacing - qz;
                    // Single precision, as stored: a candidate equal to the stored distance is no better.
                    const d = Math.fround(dx * dx + dy * dy + dz * dz);
                    if (d > bandSquared) continue;
                    const other = point(ni, nj, nk);
                    if (other < 0 || d >= squared[other]) continue;
                    squared[other] = d; nearest[other * 3] = qx; nearest[other * 3 + 1] = qy; nearest[other * 3 + 2] = qz;
                    buckets[Math.min(last, Math.max(b, Math.floor(Math.sqrt(d) / width)))].push(other);
                }
            }
            buckets[b] = null;
        }
    }
    function finish() {
        spread();
        const values = new Uint8Array(count * VOLUME);
        for (let id = 0; id < values.length; id++) values[id] = squared[id] < Infinity ? Math.min(255, Math.round(Math.sqrt(squared[id]) / band * 255)) : 255;
        return { origin, spacing, band, size, blocks, blockOf, values, triangles };
    }
    return { add, triangle, finish };
}

// The distance from (x, y, z), in the body's frame, to the body: at most the band.
export function fieldDistance(field, x, y, z) {
    const { origin, spacing, size, blocks, blockOf, values } = field;
    const u = (x - origin[0]) / spacing, v = (y - origin[1]) / spacing, w = (z - origin[2]) / spacing;
    if (u < 0 || v < 0 || w < 0 || u >= size[0] - 1 || v >= size[1] - 1 || w >= size[2] - 1) return field.band;
    const i = Math.floor(u), j = Math.floor(v), k = Math.floor(w), fu = u - i, fv = v - j, fw = w - k;
    let sum = 0;
    for (let c = 0; c < 8; c++) {
        const ii = i + (c >> 2), jj = j + ((c >> 1) & 1), kk = k + (c & 1);
        const block = blockOf[((ii >> 3) * blocks[1] + (jj >> 3)) * blocks[2] + (kk >> 3)];
        const value = block < 0 ? 255 : values[block * VOLUME + ((ii & 7) * BLOCK + (jj & 7)) * BLOCK + (kk & 7)];
        sum += value * (c >> 2 ? fu : 1 - fu) * ((c >> 1) & 1 ? fv : 1 - fv) * (c & 1 ? fw : 1 - fw);
    }
    return sum / 255 * field.band;
}
