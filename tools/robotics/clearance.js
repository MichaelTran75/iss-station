// Clearance checker for Canadarm2, its base and Dextre: a development tool, injected into the page by run.mjs (not
// loaded by the page itself).
//
// The station's triangles (every part but the robotics, Dextre and Dragon, as the page shows them) go into a 0.5 m grid
// in station coordinates; the base's into a grid that rides with it; Dextre's into two, its base and its turning body.
// The arm stands as spheres along each of its eight bodies, Dextre as spheres up its body, shoulders and folded arms.
// test(state) (a pose.js state) gives the smallest gap in metres, and where it is, between the arm and the station, the
// base, Dextre and itself (bodies three or more apart), and between Dextre and the station and base. Within a metre of
// a fixture's seat nothing counts: end effectors and Dextre's own latch meet fixtures there.
window.roboticsClearance = async () => {
    const THREE = await import('three');
    const K = await import('./js/robotics/kinematics.js'), P = await import('./js/robotics/pose.js');
    const M = await import('./js/robotics/layout.js'), F = await import('./js/robotics/fixtures.js');
    const A = window.issAtlas, station = A.station;
    station.updateMatrixWorld(true);
    const toStation = station.matrixWorld.clone().invert();
    const grid = size => ({ size, cells: new Map(), tris: [] });
    const key = (i, j, k) => (i + 512) * 1048576 + (j + 512) * 1024 + (k + 512);
    function addMesh(g, mesh, matrix) {
        const pos = mesh.geometry.attributes.position, index = mesh.geometry.index, n = index ? index.count : pos.count;
        if (!pos || !pos.array.length) return;
        const v = new THREE.Vector3(), corner = i => { v.fromBufferAttribute(pos, i).applyMatrix4(matrix); return [v.x, v.y, v.z]; };
        for (let f = 0; f < n; f += 3) {
            const a = corner(index ? index.getX(f) : f), b = corner(index ? index.getX(f + 1) : f + 1), c = corner(index ? index.getX(f + 2) : f + 2);
            const t = g.tris.length / 9; g.tris.push(...a, ...b, ...c);
            const lo = [0, 1, 2].map(d => Math.floor(Math.min(a[d], b[d], c[d]) / g.size)), hi = [0, 1, 2].map(d => Math.floor(Math.max(a[d], b[d], c[d]) / g.size));
            if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > 20000) continue;
            for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) {
                const id = key(i, j, k); let list = g.cells.get(id); if (!list) g.cells.set(id, list = []); list.push(t);
            }
        }
    }
    // The distance from point p to the triangle at offset o (closest point by regions, after Ericson).
    function triangleDistance(p, T, o) {
        const ax = T[o], ay = T[o + 1], az = T[o + 2], bx = T[o + 3], by = T[o + 4], bz = T[o + 5], cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
        const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az, apx = p[0] - ax, apy = p[1] - ay, apz = p[2] - az;
        const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
        let q;
        if (d1 <= 0 && d2 <= 0) q = [ax, ay, az];
        else {
            const bpx = p[0] - bx, bpy = p[1] - by, bpz = p[2] - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
            if (d3 >= 0 && d4 <= d3) q = [bx, by, bz];
            else {
                const vc = d1 * d4 - d3 * d2;
                if (vc <= 0 && d1 >= 0 && d3 <= 0) { const t = d1 / (d1 - d3); q = [ax + t * abx, ay + t * aby, az + t * abz]; }
                else {
                    const cpx = p[0] - cx, cpy = p[1] - cy, cpz = p[2] - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
                    if (d6 >= 0 && d5 <= d6) q = [cx, cy, cz];
                    else {
                        const vb = d5 * d2 - d1 * d6;
                        if (vb <= 0 && d2 >= 0 && d6 <= 0) { const t = d2 / (d2 - d6); q = [ax + t * acx, ay + t * acy, az + t * acz]; }
                        else {
                            const va = d3 * d6 - d5 * d4;
                            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const t = (d4 - d3) / ((d4 - d3) + (d5 - d6)); q = [bx + t * (cx - bx), by + t * (cy - by), bz + t * (cz - bz)]; }
                            else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; q = [ax + abx * v + acx * w, ay + aby * v + acy * w, az + abz * v + acz * w]; }
                        }
                    }
                }
            }
        }
        return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    }
    let stamp = 0; const seen = new Map();
    function nearest(g, p, r) {
        stamp++; let best = Infinity;
        const lo = p.map(c => Math.floor((c - r) / g.size)), hi = p.map(c => Math.floor((c + r) / g.size));
        for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) {
            const list = g.cells.get(key(i, j, k)); if (!list) continue;
            for (const t of list) { if (seen.get(t) === stamp) continue; seen.set(t, stamp); const d = triangleDistance(p, g.tris, t * 9); if (d < best) best = d; }
        }
        return best;
    }
    // The station as shown, and which part each triangle belongs to.
    const skip = new Set(['robotics', 'dextre', 'dragon']), world = grid(.5), owner = [];
    const meshMatrix = mesh => toStation.clone().multiply(mesh.matrixWorld);
    for (const entry of A.parts.values()) {
        if (skip.has(entry.id) || !entry.group.visible) continue;
        entry.group.traverse(o => {
            if (!o.isMesh || !o.visible || o.userData.interior || o.userData.puff || !o.geometry?.attributes.position) return;
            const before = world.tris.length / 9; addMesh(world, o, meshMatrix(o));
            for (let t = before; t < world.tris.length / 9; t++) owner[t] = entry.id;
        });
    }
    // The base at home, in station coordinates; Dextre's base and body, each in its own frame.
    const { carriage } = A.parts.get('robotics').group.userData.robotics, baseGrid = grid(.25);
    const savedX = carriage.position.x; carriage.position.x = 0; station.updateMatrixWorld(true);
    carriage.traverse(o => { if (o.isMesh && o.geometry?.attributes.position) addMesh(baseGrid, o, meshMatrix(o)); });
    carriage.position.x = savedX; station.updateMatrixWorld(true);
    const dextre = A.parts.get('dextre').group, body = dextre.userData.body, dextreBaseGrid = grid(.25), dextreBodyGrid = grid(.25);
    dextre.updateMatrixWorld(true);
    const dInverse = dextre.matrixWorld.clone().invert(), bInverse = body.matrixWorld.clone().invert();
    dextre.traverse(o => {
        if (!o.isMesh || !o.geometry?.attributes.position) return;
        let up = o.parent, inBody = false; while (up && up !== dextre) { if (up === body) inBody = true; up = up.parent; }
        addMesh(inBody ? dextreBodyGrid : dextreBaseGrid, o, (inBody ? bInverse : dInverse).clone().multiply(o.matrixWorld));
    });
    // The arm's spheres [x, y, z, radius] in the arm frame at zero, LEE A's half (B0..B3; B4..B7 by the half turn):
    // end effector, roll, yaw and pitch housings, then boom 1 with its end fittings, camera and electronics boxes.
    const half = [
        [[.15, 0, 0, .42], [.5, 0, 0, .42], [.85, 0, 0, .42], [1.15, 0, 0, .32]],
        [[1.4, 0, 0, .3], [1.6, 0, -.12, .25], [1.9, 0, -.12, .3]],
        [[1.9, 0, .12, .3], [1.9, -.15, .55, .32]],
        [[1.9, .15, .55, .3], [2.0, .5, .55, .3], ...Array.from({ length: 22 }, (_, k) => [2.3 + k * .28, .5, .55, .24]), [8.7, .5, .55, .3], [8.8, .15, .55, .33], [4.8, .92, .55, .2], [3.42, .5, .89, .2], [7.28, .5, .21, .2]]
    ];
    const flip = ([x, y, z, r]) => [K.ARM_LENGTH - x, -y, z, r];
    const spheres = [...half, ...half.slice().reverse().map(list => list.map(flip))];
    // Dextre's [x, y, z, radius, on the base] in its body frame (it stands along +y).
    const dextreSpheres = [[0, .3, 0, .33, 1], [0, 1.0, 0, .36], [0, 1.4, 0, .36], [0, 1.8, 0, .36], [0, 2.2, 0, .36], [0, 3.1, 0, .3], [-.75, 2.75, 0, .25], [.75, 2.75, 0, .25], [-1.05, 2.75, 0, .25], [1.05, 2.75, 0, .25], [-1.1, 2.0, .03, .2], [1.1, 2.0, .03, .2], [-1.12, 1.25, .05, .2], [1.12, 1.25, .05, .2], [-1.07, .95, .4, .16], [1.07, .95, .4, .16], [-1.02, .62, .72, .2], [1.02, .62, .72, .2], [-1.02, .2, .72, .2], [1.02, .2, .72, .2]];
    const { apply } = K, distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    function test(state) {
        const frames = K.bodyFrames(state.theta, P.baseFrame(state), state.end), shift = state.mbs - M.MBS_HOME;
        const seats = [...F.fixtures.keys()].map(id => apply(P.fixtureFrame(id, state), [0, 0, 0]));
        const near = [apply(P.baseFrame(state), [0, 0, 0]), ...(state.tip ? [apply(P.tipFrame(state), [0, 0, 0])] : []), ...seats];
        const dBody = P.dextreBody(state), dBase = K.multiply(dBody, P.bodyRoll(-state.dextre.roll));
        const dBodyInverse = K.invert(dBody), dBaseInverse = K.invert(dBase);
        const min = { station: Infinity, base: Infinity, dextre: Infinity, self: Infinity, dextreOut: Infinity };
        let worst = { clearance: Infinity };
        const note = (kind, d, where) => { if (d < min[kind]) min[kind] = d; if (d < worst.clearance) worst = { clearance: d, what: kind, ...where }; };
        const placed = [];
        frames.forEach((m, b) => spheres[b].forEach(([x, y, z, r]) => {
            const p = apply(m, [x, y, z]); placed.push({ b, p, r });
            if (near.some(q => distance(p, q) < 1.05)) return;
            const where = { body: b, at: p };
            note('station', nearest(world, p, r + .6) - r, where);
            note('base', nearest(baseGrid, [p[0] - shift, p[1], p[2]], r + .6) - r, where);
            note('dextre', Math.min(nearest(dextreBodyGrid, apply(dBodyInverse, p), r + .6), nearest(dextreBaseGrid, apply(dBaseInverse, p), r + .6)) - r, where);
        }));
        for (const [x, y, z, r, onBase] of dextreSpheres) {
            const p = apply(onBase ? dBase : dBody, [x, y, z]);
            if (near.some(q => distance(p, q) < 1.0)) continue;
            const d = Math.min(nearest(world, p, r + .6), nearest(baseGrid, [p[0] - shift, p[1], p[2]], r + .6)) - r;
            note('dextreOut', d, { at: p });
        }
        for (const a of placed) for (const c of placed) if (c.b - a.b >= 3) note('self', distance(a.p, c.p) - a.r - c.r, { body: a.b + '/' + c.b, at: a.p });
        if (worst.what === 'station' || worst.what === 'dextreOut') worst.part = whichPart(worst.at);
        worst.clearance = +worst.clearance.toFixed(3); worst.at = worst.at?.map(v => +v.toFixed(2));
        for (const kind in min) min[kind] = Number.isFinite(min[kind]) ? +min[kind].toFixed(3) : null;
        return { ...worst, min };
    }
    // The station part nearest a point (for reports).
    function whichPart(p) {
        let best = Infinity, id = null;
        const lo = p.map(c => Math.floor((c - 1) / world.size)), hi = p.map(c => Math.floor((c + 1) / world.size));
        for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) {
            const list = world.cells.get(key(i, j, k)); if (!list) continue;
            for (const t of list) { const d = triangleDistance(p, world.tris, t * 9); if (d < best) { best = d; id = owner[t]; } }
        }
        return id;
    }
    return { test, whichPart, triangles: world.tris.length / 9 };
};
