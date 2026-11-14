// Launch Complex 39A's structures as an architect's sheet: A1, ink on paper, every line a true projection of the model
// in this view, all edges shown (no hidden-line removal), as on Demo-2's day at T−4:30 (the transporter-erector
// upright, its cradles closed on the rocket).
// - Members come from the builders as they make them (js/launch/ground.js `drawn`, and site.js / complex.js for what
//   stands within 600 m): a box draws its twelve edges, a rod or cone its outline (two lines and the ends; a centre
//   line when thinner than 0.4 mm on paper), a sphere its circle, a line its polyline; each in the frame of the part it
//   moves with. The rocket's lines are its skin's crease and boundary edges (40°, the line-art worker of the station).
// - The hardstand from the same height function the ground uses (complex.js `terrainHeight`): marching squares at grade
//   and at the deck, the trench cut from them, slope hachures down the gradient.
// - Views: south elevation (looking north), isometric from the south-east, pad plan, site plan, section A–A along the
//   flame trench (looking west). Each takes the largest standard scale that fits its cell.
// - Figures in the notes: NASA KSC fact sheet on LC-39 (FS-2004-03-005-KSC), NASA's Commercial Crew blog on the crew
//   access arm (2018); the model's own numbers are what the dimensions read.
import * as THREE from 'three';
import { inTrench, padDeck, pads, terrainHeight } from './complex.js';

const pad = pads[0], deck = padDeck, ft = .3048;
const SHEET = [841, 594];
const SCALES = [100, 200, 250, 300, 400, 500, 750, 1000, 1250, 1500, 2000, 2500, 4000, 5000, 7500, 10000];
const WEIGHT = { cut: .5, heavy: .35, main: .25, member: .18, fine: .13, hair: .09 };
const INK = '#1f2428', PAPER = '#f4efe4', MONO = "'IBM Plex Mono', ui-monospace, monospace", TITLE = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const V = () => new THREE.Vector3();
const fmt = (x, d = 2) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
const feet = m => Math.round(m / ft) + '′';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ---- 3D primitives in the pad's frame (x east, y up, z south). ----
// {t: 'seg', a, b, w} · {t: 'rod', a, b, r0, r1} · {t: 'ball', c, r}
function gather(ground, rocketSegments) {
    const inverse = new THREE.Matrix4().copy(ground.group.matrixWorld).invert(), frames = new Map();
    const frameOf = f => { if (!f) return null; if (!frames.has(f)) frames.set(f, new THREE.Matrix4().multiplyMatrices(inverse, f.matrixWorld)); return frames.get(f); };
    const point = (p, m) => { const v = new THREE.Vector3(...p); return m ? v.applyMatrix4(m) : v; };
    const items = [], sections = [];
    const m4 = new THREE.Matrix4(), r4 = new THREE.Matrix4();
    for (const d of ground.drawn) {
        const m = frameOf(d.f);
        if (d.k === 'box') {
            const [w, h, l] = d.s, thin = Math.min(w, h, l);
            const weight = thin >= .8 ? 'main' : thin >= .4 ? 'member' : thin >= .2 ? 'fine' : 'hair';
            m4.makeTranslation(...d.c).multiply(r4.makeRotationZ(d.r[2])).multiply(r4.makeRotationY(d.r[1])).multiply(r4.makeRotationX(d.r[0]));
            if (m) m4.premultiply(m);
            const corners = [];
            for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? w / 2 : -w / 2, i & 2 ? h / 2 : -h / 2, i & 4 ? l / 2 : -l / 2).applyMatrix4(m4));
            for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) items.push({ t: 'seg', a: corners[i], b: corners[i | bit], w: weight });
            // A box crossing the section plane (x = 0) unrotated about y and z: its cut face, for section A–A.
            if (!m && !d.r[1] && !d.r[2] && Math.abs(d.c[0]) < w / 2) sections.push({ c: d.c, h, l, rx: d.r[0] });
        } else if (d.k === 'rod') items.push({ t: 'rod', a: point(d.a, m), b: point(d.b, m), r0: d.r, r1: d.r });
        else if (d.k === 'cone') items.push({ t: 'rod', a: point(d.a, m), b: point(d.b, m), r0: d.r0, r1: d.r1 });
        else if (d.k === 'sphere') items.push({ t: 'ball', c: point(d.c, m), r: d.r });
        else if (d.k === 'line') for (let i = 1; i < d.p.length; i++) items.push({ t: 'seg', a: point(d.p[i - 1], m), b: point(d.p[i], m), w: d.wire ? 'hair' : 'fine' });
        else if (d.k === 'prism') for (let i = 0; i < d.ring.length; i++) {
            const [x0, z0] = d.ring[i], [x1, z1] = d.ring[(i + 1) % d.ring.length];
            for (const y of [d.y0, d.y1]) items.push({ t: 'seg', a: new THREE.Vector3(x0, y, z0), b: new THREE.Vector3(x1, y, z1), w: 'member' });
            items.push({ t: 'seg', a: new THREE.Vector3(x0, d.y0, z0), b: new THREE.Vector3(x0, d.y1, z0), w: 'fine' });
        } else if (d.k === 'stretched') {
            const a = d.mesh.position.clone(), b = new THREE.Vector3(0, d.mesh.scale.y, 0).applyQuaternion(d.mesh.quaternion).add(a);
            items.push({ t: 'rod', a, b, r0: d.r, r1: d.r });
        }
    }
    const rocket = [];
    for (let i = 0; i < rocketSegments.length; i += 6) rocket.push({ t: 'seg', a: new THREE.Vector3(rocketSegments[i], rocketSegments[i + 1], rocketSegments[i + 2]), b: new THREE.Vector3(rocketSegments[i + 3], rocketSegments[i + 4], rocketSegments[i + 5]), w: 'fine', rocket: true });
    return { items, rocket, sections, terrain: terrainItems() };
}

// ---- The hardstand: its grade and deck outlines, the trench, slope hachures. ----
const mound = (x, z) => terrainHeight(x, z);
const trench = { x: pad.trench.half, north: -pad.trench.north, south: pad.trench.south };
const wallTop = z => Math.max(1.8, mound(trench.x + .05, z));
function contours(level, x0, x1, z0, z1, step) {
    const out = [], nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step);
    const h = []; for (let j = 0; j <= nz; j++) { const row = []; for (let i = 0; i <= nx; i++) row.push(mound(x0 + i * step, z0 + j * step)); h.push(row); }
    const at = (i0, j0, i1, j1) => { const a = h[j0][i0], b = h[j1][i1], f = (level - a) / (b - a); return [x0 + (i0 + (i1 - i0) * f) * step, z0 + (j0 + (j1 - j0) * f) * step]; };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const c = [h[j][i] > level, h[j][i + 1] > level, h[j + 1][i + 1] > level, h[j + 1][i] > level];
        const edges = [];
        if (c[0] !== c[1]) edges.push(at(i, j, i + 1, j));
        if (c[1] !== c[2]) edges.push(at(i + 1, j, i + 1, j + 1));
        if (c[2] !== c[3]) edges.push(at(i + 1, j + 1, i, j + 1));
        if (c[3] !== c[0]) edges.push(at(i, j + 1, i, j));
        for (let k = 0; k + 1 < edges.length; k += 2) out.push([edges[k], edges[k + 1]]);
    }
    return out;
}
let terrainCache = null;
function terrainItems() {
    if (terrainCache) return terrainCache;
    const items = [], inCut = (x, z) => Math.abs(x) < trench.x && z > trench.north && z < trench.south;
    for (const [level, y, weight] of [[.05, 0, 'main'], [deck - .05, deck, 'heavy']]) for (const [[ax, az], [bx, bz]] of contours(level, -110, 110, -110, 300, 1)) {
        if (inCut((ax + bx) / 2, (az + bz) / 2)) continue;
        items.push({ t: 'seg', a: new THREE.Vector3(ax, y, az), b: new THREE.Vector3(bx, y, bz), w: weight });
    }
    // The trench: its walls' tops and feet, the back wall under the mount, the far end.
    for (const s of [-1, 1]) for (let z = trench.north; z < trench.south - 1e-6; z += 2) {
        const z1 = Math.min(trench.south, z + 2), x = s * trench.x;
        items.push({ t: 'seg', a: new THREE.Vector3(x, wallTop(z), z), b: new THREE.Vector3(x, wallTop(z1), z1), w: 'heavy' });
        items.push({ t: 'seg', a: new THREE.Vector3(x, 0, z), b: new THREE.Vector3(x, 0, z1), w: 'member' });
    }
    for (const [z, y] of [[trench.south, deck], [trench.north, 1.8]]) {
        items.push({ t: 'seg', a: new THREE.Vector3(-trench.x, y, z), b: new THREE.Vector3(trench.x, y, z), w: 'heavy' });
        for (const s of [-1, 1]) items.push({ t: 'seg', a: new THREE.Vector3(s * trench.x, 0, z), b: new THREE.Vector3(s * trench.x, y, z), w: 'member' });
    }
    // Hachures down each slope from the deck's edge, every 3 m, long and short in turn.
    // (On the 1 m grid the deck's edges fall on grid lines, so each start is on the slope, not on the flat beside it.)
    let k = 0, n = 0;
    for (const [[ax, az], [bx, bz]] of contours(deck - .05, -110, 110, -110, 300, 1)) {
        if (n++ % 3) continue;
        const x = (ax + bx) / 2, z = (az + bz) / 2;
        if (inCut(x, z) || Math.abs(x) < trench.x + 1 && z < trench.south) continue;
        const long = k++ % 2 === 0, p = new THREE.Vector2(x, z), line = [];
        for (let n = 0; n < 200; n++) {
            const h = mound(p.x, p.y); line.push(new THREE.Vector3(p.x, h, p.y));
            if (h < (long ? .1 : deck * .62)) break;
            const gx = mound(p.x + .25, p.y) - mound(p.x - .25, p.y), gz = mound(p.x, p.y + .25) - mound(p.x, p.y - .25), g = Math.hypot(gx, gz);
            if (g < 1e-6) break;
            p.x -= gx / g * .75; p.y -= gz / g * .75;
        }
        if (line.length > 1) items.push({ t: 'seg', a: line[0], b: line[line.length - 1], w: 'hair', hachure: true });
    }
    return (terrainCache = items);
}

// ---- Clipping and projection. ----
function clip(a, b, box) {
    let t0 = 0, t1 = 1;
    for (let axis = 0; axis < 3; axis++) {
        const p = a.getComponent(axis), d = b.getComponent(axis) - p, lo = box[0][axis], hi = box[1][axis];
        if (Math.abs(d) < 1e-12) { if (p < lo || p > hi) return null; continue; }
        let ta = (lo - p) / d, tb = (hi - p) / d; if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return null;
    }
    return [t0, t1];
}
const views = {
    elevation: p => [p.x, p.y],
    iso: p => [(p.x - p.z) / Math.SQRT2, (-p.x + 2 * p.y - p.z) / Math.sqrt(6)],
    plan: p => [p.x, -p.z],
    section: p => [-p.z, p.y]
};

// A view drawn into its cell: primitives clipped to `box`, projected, scaled to the largest standard scale that fits.
function drawView(spec, data) {
    const project = views[spec.projection], box = spec.box;
    const prims = [], A = V(), Bv = V();
    for (const item of [...data.terrain, ...data.items, ...(spec.rocket ? data.rocket : [])]) {
        if (item.hachure && !spec.hachures) continue;
        if (item.t === 'ball') {
            const c = item.c; if (c.x < box[0][0] - item.r || c.x > box[1][0] + item.r || c.z < box[0][2] - item.r || c.z > box[1][2] + item.r || c.y > box[1][1] + item.r) continue;
            prims.push({ t: 'circle', c: project(c), r: item.r }); continue;
        }
        const range = clip(item.a, item.b, box); if (!range) continue;
        A.lerpVectors(item.a, item.b, range[0]); Bv.lerpVectors(item.a, item.b, range[1]);
        if (item.t === 'seg') prims.push({ t: 'seg', a: project(A), b: project(Bv), w: item.w });
        else prims.push({ t: 'rod', a: project(A), b: project(Bv), r0: THREE.MathUtils.lerp(item.r0, item.r1, range[0]), r1: THREE.MathUtils.lerp(item.r0, item.r1, range[1]) });
    }
    for (const extra of spec.extra2d || []) prims.push(extra);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    const grow = ([u, v], r = 0) => { u0 = Math.min(u0, u - r); u1 = Math.max(u1, u + r); v0 = Math.min(v0, v - r); v1 = Math.max(v1, v + r); };
    for (const p of prims) if (p.t === 'circle') grow(p.c, p.r); else { grow(p.a, p.r0 || 0); grow(p.b, p.r1 || 0); }
    if (spec.bounds) [u0, u1, v0, v1] = [Math.min(u0, spec.bounds[0]), Math.max(u1, spec.bounds[1]), Math.min(v0, spec.bounds[2]), Math.max(v1, spec.bounds[3])];
    const [cx0, cy0, cx1, cy1] = spec.cell, pad = spec.margin || [6, 6, 6, 14];   // left, top, right, bottom (the title)
    const room = [cx1 - cx0 - pad[0] - pad[2], cy1 - cy0 - pad[1] - pad[3]];
    const scale = spec.scale || SCALES.find(s => (u1 - u0) * 1000 / s <= room[0] && (v1 - v0) * 1000 / s <= room[1]) || SCALES[SCALES.length - 1];
    const k = 1000 / scale, ox = cx0 + pad[0] + (room[0] - (u1 - u0) * k) / 2, oy = cy0 + pad[1] + (room[1] - (v1 - v0) * k) / 2;
    const at = ([u, v]) => [ox + (u - u0) * k, oy + (v1 - v) * k];
    const paths = {}; for (const w of Object.keys(WEIGHT)) paths[w] = [];
    const r2 = x => Math.round(x * 100) / 100;
    const line = (w, p, q) => { const [x0, y0] = at(p), [x1, y1] = at(q); if (Math.hypot(x1 - x0, y1 - y0) < .04) return; paths[w].push('M' + r2(x0) + ' ' + r2(y0) + 'L' + r2(x1) + ' ' + r2(y1)); };
    const circles = [];
    for (const p of prims) {
        if (p.t === 'seg') { line(p.w, p.a, p.b); continue; }
        if (p.t === 'circle') { const [x, y] = at(p.c); circles.push([r2(x), r2(y), r2(p.r * k)]); continue; }
        const du = p.b[0] - p.a[0], dv = p.b[1] - p.a[1], length = Math.hypot(du, dv), width = 2 * Math.max(p.r0, p.r1) * k;
        if (length * k < .05) { if (width > .3) { const [x, y] = at(p.a); circles.push([r2(x), r2(y), r2(Math.max(p.r0, p.r1) * k)]); } continue; }
        const w = Math.max(p.r0, p.r1) >= .3 ? 'main' : Math.max(p.r0, p.r1) >= .12 ? 'member' : 'fine';
        if (width < .4) { line(w === 'main' ? 'member' : w, p.a, p.b); continue; }
        const nu = -dv / length, nv = du / length;
        const a0 = [p.a[0] + nu * p.r0, p.a[1] + nv * p.r0], a1 = [p.a[0] - nu * p.r0, p.a[1] - nv * p.r0];
        const b0 = [p.b[0] + nu * p.r1, p.b[1] + nv * p.r1], b1 = [p.b[0] - nu * p.r1, p.b[1] - nv * p.r1];
        line(w === 'main' ? 'member' : 'fine', a0, b0); line(w === 'main' ? 'member' : 'fine', a1, b1); line('hair', a0, a1); line('hair', b0, b1);
    }
    return { spec, scale, k, at, paths, circles, bounds: [u0, u1, v0, v1], box: [ox, oy, ox + (u1 - u0) * k, oy + (v1 - v0) * k] };
}

// ---- Sheet graphics. ----
function svgOf(view) {
    let out = '';
    for (const [w, list] of Object.entries(view.paths)) if (list.length) out += '<path stroke-width="' + WEIGHT[w] + '" d="' + list.join('') + '"/>';
    for (const [x, y, r] of view.circles) out += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" stroke-width="' + WEIGHT.member + '"/>';
    return out;
}
const text = (x, y, s, size = 2.4, anchor = 'start', extra = '') => '<text x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" font-size="' + size + '" text-anchor="' + anchor + '" fill="' + INK + '" stroke="none"' + extra + '>' + esc(s) + '</text>';
const stroke = (d, w = WEIGHT.fine, extra = '') => '<path d="' + d + '" stroke-width="' + w + '"' + extra + '/>';
const P = (x, y) => x.toFixed(2) + ' ' + y.toFixed(2);
// A dimension between two sheet points along their line, offset to one side; architectural ticks; text above the line.
function dimension(a, b, offset, label, size = 2.2) {
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length, nx = -uy * offset, ny = ux * offset;
    const p = [a[0] + nx, a[1] + ny], q = [b[0] + nx, b[1] + ny], ex = -uy * Math.sign(offset), ey = ux * Math.sign(offset);
    let out = stroke('M' + P(a[0] + ex * 1.2, a[1] + ey * 1.2) + 'L' + P(p[0] + ex * 1.5, p[1] + ey * 1.5) + 'M' + P(b[0] + ex * 1.2, b[1] + ey * 1.2) + 'L' + P(q[0] + ex * 1.5, q[1] + ey * 1.5), WEIGHT.hair);
    out += stroke('M' + P(p[0] - ux * 1.5, p[1] - uy * 1.5) + 'L' + P(q[0] + ux * 1.5, q[1] + uy * 1.5), WEIGHT.fine);
    for (const [x, y] of [p, q]) out += stroke('M' + P(x - .9 * (ux - uy), y - .9 * (uy + ux)) + 'L' + P(x + .9 * (ux - uy), y + .9 * (uy + ux)), WEIGHT.member);
    let angle = Math.atan2(uy, ux) * 180 / Math.PI; if (angle > 90 || angle <= -90) angle += angle > 0 ? -180 : 180;
    const mx = (p[0] + q[0]) / 2 + Math.sin(angle * Math.PI / 180) * 1.1, my = (p[1] + q[1]) / 2 - Math.cos(angle * Math.PI / 180) * 1.1;
    out += text(mx, my, label, size, 'middle', ' transform="rotate(' + angle.toFixed(1) + ' ' + mx.toFixed(2) + ' ' + my.toFixed(2) + ')"');
    return out;
}
// A level mark: a triangle on the level's line, the line out from the structure, the level and its name.
function levelMark(x0, x1, y, label, sub) {
    let out = stroke('M' + P(x0, y) + 'L' + P(x1 + 3.5, y), WEIGHT.hair, ' stroke-dasharray="1.2 .8"');
    out += '<path d="M' + P(x1, y) + 'l-1.3 -2.2h2.6z" fill="' + INK + '" stroke="none"/>';
    out += text(x1 + 4.5, y - .5, label, 2.3) + (sub ? text(x1 + 4.5, y + 2.4, sub, 1.8, 'start', ' fill-opacity=".75"') : '');
    return out;
}
function viewTitle(view, number, name, sub) {
    const [x0, , x1] = view.spec.cell, y = view.spec.cell[3] - 5.5, cx = (view.box[0] + view.box[2]) / 2;
    let out = '<circle cx="' + (cx - 40).toFixed(2) + '" cy="' + (y - 1.6).toFixed(2) + '" r="4" stroke-width="' + WEIGHT.member + '"/>' + text(cx - 40, y - .2, String(number), 4, 'middle', ' font-family="' + TITLE + '"');
    out += text(cx - 34, y - 1.5, name, 4.6, 'start', ' font-family="' + TITLE + '" font-weight="600" letter-spacing=".04em"');
    out += stroke('M' + P(cx - 34, y) + 'L' + P(Math.min(x1 - 4, cx + 52), y), WEIGHT.member);
    out += text(cx - 34, y + 3.4, sub + '   SCALE 1:' + view.scale, 2.1);
    return out;
}
function scaleBar(x, y, k, metres) {
    let out = '', step = metres / 5;
    for (let i = 0; i < 5; i++) out += '<rect x="' + (x + i * step * k).toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + (step * k).toFixed(2) + '" height="1.2" fill="' + (i % 2 ? PAPER : INK) + '" stroke-width="' + WEIGHT.hair + '"/>';
    for (let i = 0; i <= 5; i += i === 0 ? 1 : 4) out += text(x + i * step * k, y + 4.2, String(Math.round(i * step)), 1.9, 'middle');
    return out + text(x + metres * k + 2, y + 1.3, 'm', 1.9);
}
function northArrow(x, y) {
    return '<circle cx="' + x + '" cy="' + y + '" r="5" stroke-width="' + WEIGHT.fine + '"/><path d="M' + P(x, y - 6.5) + 'L' + P(x + 2.2, y + 3.5) + 'L' + P(x, y + 1.8) + 'z" fill="' + INK + '" stroke="none"/>' + text(x, y - 7.8, 'N', 3, 'middle', ' font-family="' + TITLE + '" font-weight="600"');
}
// Labels in a column beside a view with leaders to their points, spread so they do not overlap; side 0 puts each on
// the side of the view nearer its point.
function callouts(view, list, side, gap = 4.2) {
    if (side === 0) {
        const middle = (view.box[0] + view.box[2]) / 2, near = left => list.filter(([p]) => (view.at(p)[0] < middle) === left);
        return callouts(view, near(true), -1, gap) + callouts(view, near(false), 1, gap);
    }
    const edge = side < 0 ? view.box[0] - 4 : view.box[2] + 4, placed = list.map(([p, label]) => ({ p: view.at(p), label })).sort((a, b) => a.p[1] - b.p[1]);
    for (let i = 1; i < placed.length; i++) placed[i].y = Math.max(placed[i].p[1], (placed[i - 1].y ?? placed[i - 1].p[1]) + gap);
    placed[0] && (placed[0].y ??= placed[0].p[1]);
    let out = '';
    for (const c of placed) {
        const y = c.y ?? c.p[1];
        out += '<circle cx="' + c.p[0].toFixed(2) + '" cy="' + c.p[1].toFixed(2) + '" r=".5" fill="' + INK + '" stroke="none"/>';
        out += stroke('M' + P(c.p[0], c.p[1]) + 'L' + P(edge - side * 3, y) + 'L' + P(edge, y), WEIGHT.hair);
        out += text(edge + side * 1, y + .8, c.label, 2.2, side < 0 ? 'end' : 'start');
    }
    return out;
}

// ---- The sheet. ----
export function buildSheet({ ground, rocketSegments, stack }) {
    const data = gather(ground, rocketSegments);
    const fss = { x: -31.3, z: -9.7, half: 6.1 }, roof = deck + 247 * ft, crane = deck + 265 * ft, mast = deck + 347 * ft, crew = deck + 217 * ft;
    const base = deck + stack.mount, top = base + stack.height;
    // Cells (mm): elevation, isometric, pad plan, site plan, section, title block.
    const cells = { elevation: [14, 14, 262, 462], iso: [262, 14, 520, 462], plan: [520, 14, 827, 262], site: [520, 262, 827, 462], section: [14, 462, 520, 580], title: [520, 462, 827, 580] };
    // Profiles: the mound seen from the south (across x), and along the trench's axis cut (`cut`) or seen beyond it.
    const across = x => { let h = 0; for (let z = -70; z <= 60; z += 1) h = Math.max(h, mound(x, z)); return h; };
    const profile = (z, cut) => { if (cut) return inTrench(0, z) ? 0 : mound(0, z); let h = 0; for (let x = -60; x <= 60; x += 1) h = Math.max(h, mound(x, z)); return h; };
    const curve = (z0, z1, cut, w) => { const out = []; for (let z = z0; z < z1; z += .5) out.push({ t: 'seg', a: [-z, profile(z, cut)], b: [-(z + .5), profile(z + .5, cut)], w }); return out; };
    const rise = (x0, x1, w) => { const out = []; for (let x = x0; x < x1; x += .5) out.push({ t: 'seg', a: [x, across(x)], b: [x + .5, across(x + .5)], w }); return out; };
    const ground2d = (u0, u1) => [{ t: 'seg', a: [u0, 0], b: [u1, 0], w: 'cut' }];

    const elevation = drawView({ projection: 'elevation', cell: cells.elevation, box: [[-50, -1, -70], [20, 130, 50]], rocket: true, margin: [14, 8, 54, 16],
        extra2d: [...rise(-50, 20, 'heavy'), ...ground2d(-50, 20)] }, data);
    const iso = drawView({ projection: 'iso', cell: cells.iso, box: [[-40, -1, -28], [14, 130, 46]], rocket: true, hachures: true, margin: [38, 8, 38, 16] }, data);
    const plan = drawView({ projection: 'plan', cell: cells.plan, box: [[-100, -1, -135], [115, 200, 75]], rocket: true, hachures: true, margin: [10, 14, 34, 16] }, data);
    const site = drawView({ projection: 'plan', cell: cells.site, box: [[-430, -1, -290], [410, 200, 520]], hachures: false, margin: [10, 8, 46, 16] }, data);
    // Section A–A: what lies west of the plane x = 0, the cut ground and the cut members.
    const sectionFill = [];
    const section = drawView({ projection: 'section', cell: cells.section, box: [[-22, -1, -100], [0, 46, 64]], rocket: true, margin: [52, 6, 52, 14],
        extra2d: [...curve(-100, 64, false, 'fine'), ...curve(-100, 64, true, 'cut'), ...ground2d(-64, 100)] }, data);
    {
        // The cut earth under the deck and ramp: a closed outline along the cut profile, filled with the hatch.
        const points = []; for (let z = -100; z <= 64; z += .5) points.push(section.at([-z, profile(z, true)]));
        points.push(section.at([-64, 0]), section.at([100, 0]));
        sectionFill.push('<path d="M' + points.map(p => P(...p)).join('L') + 'z" fill="url(#earth)" stroke="none"/>');
        // Members cut by the plane (the deflector, the mount's girders): solid.
        for (const s of data.sections) {
            const c = Math.cos(s.rx), sn = Math.sin(s.rx), corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
                const y = b * s.h / 2, z = a * s.l / 2;   // rotated about x: y' = y c − z s, z' = y s + z c
                return section.at([-(s.c[2] + y * sn + z * c), s.c[1] + y * c - z * sn]);
            });
            sectionFill.push('<path d="M' + corners.map(p => P(...p)).join('L') + 'z" fill="' + INK + '" fill-opacity=".85" stroke-width="' + WEIGHT.heavy + '"/>');
        }
    }

    let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + SHEET[0] + ' ' + SHEET[1] + '" width="' + SHEET[0] + 'mm" height="' + SHEET[1] + 'mm" font-family="' + MONO + '" fill="' + INK + '">';
    svg += '<defs><pattern id="earth" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V2.2" stroke="' + INK + '" stroke-width=".12"/></pattern></defs>';
    svg += '<rect width="' + SHEET[0] + '" height="' + SHEET[1] + '" fill="' + PAPER + '"/>';
    svg += '<g fill="none" stroke="' + INK + '" stroke-linecap="round" stroke-linejoin="round">';
    svg += '<rect x="7" y="7" width="' + (SHEET[0] - 14) + '" height="' + (SHEET[1] - 14) + '" stroke-width="' + WEIGHT.cut + '"/>';
    for (const [x0, y0, x1, y1] of [cells.iso, cells.plan, cells.site, cells.section, cells.title]) svg += '<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" stroke-width="' + WEIGHT.member + '"/>';
    svg += sectionFill.join('');
    for (const view of [elevation, iso, plan, site, section]) svg += svgOf(view);
    svg += '</g><g stroke="' + INK + '" fill="none">';

    // 1 · South elevation: levels on the right, the level scale up the tower's west face, dimensions below grade and
    // beside the rocket.
    {
        const v = elevation, right = v.at([20, 0])[0], fssRight = v.at([fss.x + fss.half, 0])[0];
        const levels = [
            [0, '−12.00  GRADE', 'GROUND ROUND THE PAD'], [deck, '±0.00  PAD DECK', '+14.6 (48′) ABOVE SEA LEVEL'],
            [deck + 27 * ft, '+8.23 (27′)  FIRST LEVEL', '12 LEVELS AT 6.10 (20′)'], [crew, '+66.14 (217′)  CREW ACCESS LEVEL', '265′ ABOVE SEA LEVEL · ADDED 2018'],
            [roof, '+75.29 (247′)  TOP LEVEL', null], [crane, '+80.77 (265′)  HAMMERHEAD CRANE', null],
            [top, '+' + fmt(top - deck) + ' (' + feet(top - deck) + ')  TOP OF DRAGON', null], [mast, '+105.77 (347′)  LIGHTNING MAST TIP', '80′ FIBREGLASS MAST, STAINLESS CATENARY N–S']
        ].sort((a, b) => a[0] - b[0]);
        let last = Infinity;
        for (const [y, label, sub] of levels) { let sy = v.at([0, y])[1]; if (sy > last - 5.5) sy = last - 5.5; last = sy; svg += levelMark(fssRight, right, sy, label, sub); }
        // The level scale beside the tower's west face: a tick at each of the twelve levels.
        const sx = v.at([fss.x - fss.half - 4.5, 0])[0];
        svg += stroke('M' + P(sx, v.at([0, deck])[1]) + 'L' + P(sx, v.at([0, roof])[1]), WEIGHT.fine);
        for (let k = 0; k < 12; k++) { const y = v.at([0, deck + (27 + 20 * k) * ft])[1]; svg += stroke('M' + P(sx - .8, y) + 'L' + P(sx + .8, y), WEIGHT.fine) + text(sx - 1.4, y + .7, String(27 + 20 * k) + '′', 1.6, 'end'); }
        const below = v.at([0, 0])[1];
        svg += dimension(v.at([fss.x - fss.half, deck]), v.at([fss.x + fss.half, deck]), below - v.at([0, deck])[1] + 8, '12.19 (40′) FSS');
        svg += dimension(v.at([fss.x + fss.half, deck]), v.at([0, deck]), below - v.at([0, deck])[1] + 8, fmt(-fss.x - fss.half, 1) + ' TO THE ROCKET');
        svg += dimension(v.at([-1.83, base]), v.at([1.83, base]), below - v.at([0, base])[1] + 14, '⌀3.66');
        svg += dimension(v.at([1.83, base]), v.at([1.83, top]), 14, fmt(stack.height, 1) + ' (' + feet(stack.height) + ') FALCON 9 + CREW DRAGON');
        svg += dimension(v.at([3.5, deck + 1]), v.at([3.5, deck + 67]), 22, '66.0 STRONGBACK');
        svg += dimension(v.at([-46, 0]), v.at([-46, deck]), -5, '12.00');
        svg += scaleBar(v.box[0] + 2, v.spec.cell[3] - 21, v.k, 20);
        svg += viewTitle(v, 1, 'SOUTH ELEVATION', 'LOOKING NORTH · AS AT T−4:30');
    }
    // 2 · Isometric, called out.
    {
        const v = iso, q = (x, y, z) => views.iso({ x, y, z });
        svg += callouts(v, [
            [q(fss.x, mast, fss.z), 'LIGHTNING MAST'], [q(fss.x + 8, crane - .7, fss.z), 'HAMMERHEAD CRANE'], [q(fss.x - fss.half, deck + 50, fss.z - fss.half), 'FIXED SERVICE STRUCTURE'],
            [q(fss.x - fss.half - .6, crew - 1, fss.z), 'SLIDE-WIRE BASKETS'], [q(fss.x, deck + 20, fss.z - fss.half - 1.6), 'ELEVATOR'], [q(-31.4, deck + 20, 6), 'CREW ACCESS ANNEX']
        ], -1);
        svg += callouts(v, [
            [q(0, top - 2, 0), 'CREW DRAGON'], [q(-23.4, crew + 1.5, -12), 'CREW ACCESS ARM'], [q(-23.4, crew + 1.8, -23.4), 'WHITE ROOM'], [q(1.8, deck + 40, 0), 'FALCON 9'],
            [q(2.8, deck + 50, 3.4), 'TRANSPORTER-ERECTOR'], [q(10.6, deck + 2, 4.6), 'LAUNCH MOUNT'], [q(0, 4, -40), 'FLAME TRENCH'], [q(3.5, 9, 30), 'TE FRAME ON THE RAMP']
        ], 1);
        svg += viewTitle(v, 2, 'ISOMETRIC', 'FROM THE SOUTH-EAST · ALL EDGES SHOWN');
    }
    // 3 · Pad plan.
    {
        const v = plan, a = (x, z) => v.at([x, -z]);
        svg += dimension(a(-pad.west, -pad.north), a(pad.east, -pad.north), -7, fmt(pad.west + pad.east, 1) + ' (' + feet(pad.west + pad.east) + ') DECK');
        svg += dimension(a(pad.east, -pad.north), a(pad.east, pad.south), -7, fmt(pad.north + pad.south, 1) + ' (' + feet(pad.north + pad.south) + ')');
        svg += dimension(a(-trench.x, -80), a(trench.x, -80), 4, '18.0 (59′)', 1.9);
        svg += dimension(a(-22, .4), a(-22, -25.6), -4, '26.0 (85′) CREW ACCESS ARM', 1.9);
        svg += callouts(v, [[[fss.x, -fss.z], 'FSS'], [[10.6, 0], 'LAUNCH MOUNT'], [[0, -3.4], 'TRANSPORTER-ERECTOR'], [[0, 60], 'FLAME TRENCH, DEFLECTOR UNDER THE MOUNT'],
            [[99.8, 127.1], 'WATER TOWER'], [[4.5, -80], 'RAILS, RAMP 5 % TO THE HANGAR'], [[-60, 9], 'SLIDE WIRES WEST']], 1, 3.8);
        // Section mark A–A on the trench's axis, arrows looking west.
        for (const z of [-118, 96]) { const [x, y] = a(0, z); svg += '<path d="M' + P(x, y) + 'l-3.5 0" stroke-width="' + WEIGHT.heavy + '"/><path d="M' + P(x - 3.5, y) + 'l1.6 -1.1v2.2z" fill="' + INK + '"/>' + text(x + 1.2, y + 1, 'A', 3, 'start', ' font-family="' + TITLE + '" font-weight="600"'); }
        svg += stroke('M' + P(...a(0, -116)) + 'L' + P(...a(0, 94)), WEIGHT.fine, ' stroke-dasharray="6 1.2 1 1.2"');
        svg += northArrow(v.spec.cell[2] - 14, v.spec.cell[1] + 14);
        svg += scaleBar(v.box[0] + 2, v.spec.cell[3] - 21, v.k, 50);
        svg += viewTitle(v, 3, 'PAD PLAN', 'HARDSTAND, TRENCH AND STRUCTURES');
    }
    // 4 · Site plan.
    {
        const v = site, a = (x, z) => v.at([x, -z]);
        svg += callouts(v, [[[-398.2, 257.8], 'LOX SPHERE 900,000 GAL (3,407 m³)'], [[372.2, 241.8], 'LH2 SPHERE 850,000 GAL (3,218 m³)'], [[99.8, 127.1], 'WATER TOWER 300,000 GAL'],
            [[0, 0], 'PAD 39A'], [[-392, 10], 'SLIDE-WIRE LANDING ZONE'], [[-5.7, -459.4], 'HORIZONTAL INTEGRATION FACILITY'], [[4.5, -200], 'RAMP AND TE RAILS']], 1, 4);
        svg += northArrow(v.spec.cell[2] - 14, v.spec.cell[1] + 14);
        svg += scaleBar(v.box[0] + 2, v.spec.cell[3] - 21, v.k, 200);
        svg += viewTitle(v, 4, 'SITE PLAN', 'LC-39A WITHIN 600 m');
    }
    // 5 · Section A–A.
    {
        const v = section, s = (z, y) => v.at([-z, y]);
        svg += callouts(v, [[[0, base + 22], 'FALCON 9'], [[3.4, deck + 25], 'STRONGBACK'], [[4.6, base - 1], 'LAUNCH MOUNT, HOLD-DOWN CLAMPS'], [[-8, 6], 'FLAME DEFLECTOR'],
            [[-50, 0], 'TRENCH FLOOR AT GRADE'], [[-40, deck], 'TRENCH WALL TOP, PAD DECK'], [[60, 11], 'RAMP TO THE HANGAR'], [[20, 4], 'CUT EARTH FILL UNDER THE DECK'],
            [[14, 13.6], 'TE FRAME AND HYDRAULIC CYLINDERS']].map(([[z, y], l]) => [[-z, y], l]), 0, 3.6);
        svg += dimension(s(-75, 0), s(-75, deck), 5, '12.00 TRENCH');
        svg += viewTitle(v, 5, 'SECTION A–A', 'ALONG THE FLAME TRENCH, LOOKING WEST');
    }
    // Title block and notes.
    {
        const [x0, y0, x1] = cells.title;
        let y = y0 + 9;
        svg += text(x0 + 5, y + 1, 'LAUNCH COMPLEX 39A · PAD STRUCTURES', 7.6, 'start', ' font-family="' + TITLE + '" font-weight="600" letter-spacing=".03em"'); y += 6.6;
        svg += text(x0 + 5, y, 'KENNEDY SPACE CENTER, FLORIDA · AS ON 30 MAY 2020 (DEMO-2)', 2.7); y += 4.4;
        svg += stroke('M' + P(x0, y) + 'L' + P(x1, y), WEIGHT.member); y += 4.4;
        const notes = [
            'STRUCTURAL NOTES',
            '1  FIXED SERVICE STRUCTURE: STEEL LATTICE TOWER 12.19 (40′) SQUARE, CORNER AND MID-FACE COLUMNS, CROSS-BRACED BAYS;',
            '   12 LEVELS AT 6.10 (20′), THE FIRST 8.23 (27′) ABOVE THE DECK; TOP 75.29 (247′); HAMMERHEAD CRANE 80.77 (265′);',
            '   80′ FIBREGLASS MAST TO 105.77 (347′), A 1″ STAINLESS CABLE OVER IT TO ANCHORS NORTH AND SOUTH.',
            '2  CREW ACCESS LEVEL 66.14 (217′) ABOVE THE DECK, ADDED 2018 ON A BRACED ANNEX; ARM 26 (85′) WITH WHITE ROOM.',
            '3  TRANSPORTER-ERECTOR: TWIN LATTICE LEGS 66 m, FOUR CRADLE PAIRS, HINGED AT THE MOUNT, TWO HYDRAULIC CYLINDERS.',
            '4  FLAME TRENCH: CONCRETE AND REFRACTORY BRICK, 58′ WIDE, 42′ DEEP, 490′ LONG (NASA); STEEL DEFLECTOR.',
            '5  HARDSTAND 390′ × 325′, DECK 48′ ABOVE SEA LEVEL; WATER TOWER 290′, 300,000 GAL; LOX NW, LH2 NE.',
            '6  DIMENSIONS IN METRES (FEET) AND READ FROM THE MODEL; LEVELS FROM THE PAD DECK. MODEL DEPTH OF THE TRENCH',
            '   12.00 AGAINST 42′ (12.80); WATER TOWER TOP FROM 2019 LIDAR 81 m AGAINST 290′ PUBLISHED.'
        ];
        for (const [i, line] of notes.entries()) { svg += text(x0 + 5, y, line, i ? 2.05 : 2.5, 'start', i ? '' : ' font-weight="600"'); y += i ? 3.6 : 4.4; }
        y += 1.2; svg += stroke('M' + P(x0, y) + 'L' + P(x1, y), WEIGHT.member); y += 4.4;
        svg += text(x0 + 5, y, 'SOURCES  NASA KSC FACT SHEET FS-2004-03-005 (LC-39) · NASA COMMERCIAL CREW (CREW ACCESS ARM, 2018)', 1.9); y += 3.2;
        svg += text(x0 + 5, y, '         USGS 3DEP LIDAR 2019 · OPENSTREETMAP CONTRIBUTORS', 1.9); y += 4.4;
        svg += text(x0 + 5, y, 'DRAWN FROM THE MODEL IN THIS PAGE · TRUE PROJECTIONS, ALL EDGES · A1', 2.1);
        svg += text(x1 - 5, y, 'SHEET 1 / 1 · ISS ATLAS', 2.8, 'end', ' font-weight="600"');
    }
    svg += '</g></svg>';
    return { svg, views: { elevation, iso, plan, site, section }, counts: { members: ground.drawn.length, rocket: data.rocket.length } };
}

// ---- On screen: the sheet in its panel, zoomed with the wheel (or a pinch on a trackpad) about the pointer, dragged
// to pan, a double click to fit; saved as SVG. ----
export function showSheet(root, svg, fileName) {
    const holder = root.querySelector('.pad-drawing-sheet');
    holder.innerHTML = svg;
    const el = holder.querySelector('svg'); el.removeAttribute('width'); el.removeAttribute('height');
    const full = [0, 0, SHEET[0], SHEET[1]]; let box = [...full];
    const apply = () => el.setAttribute('viewBox', box.map(n => n.toFixed(2)).join(' '));
    const toSheet = (x, y) => { const point = el.createSVGPoint(); point.x = x; point.y = y; return point.matrixTransform(el.getScreenCTM().inverse()); };
    holder.onwheel = event => {
        event.preventDefault();
        const f = Math.exp(event.deltaY * (event.ctrlKey ? .01 : .0015)), at = toSheet(event.clientX, event.clientY);
        const w = THREE.MathUtils.clamp(box[2] * f, 12, SHEET[0] * 1.2), k = w / box[2];
        box = [at.x - (at.x - box[0]) * k, at.y - (at.y - box[1]) * k, w, box[3] * k]; apply();
    };
    let drag = null;
    holder.onpointerdown = event => { drag = { x: event.clientX, y: event.clientY, box: [...box], scale: 1 / el.getScreenCTM().a }; holder.setPointerCapture(event.pointerId); };
    holder.onpointermove = event => { if (!drag) return; box[0] = drag.box[0] - (event.clientX - drag.x) * drag.scale; box[1] = drag.box[1] - (event.clientY - drag.y) * drag.scale; apply(); };
    holder.onpointerup = holder.onpointercancel = () => { drag = null; };
    holder.ondblclick = () => { box = [...full]; apply(); };
    apply();
    root.querySelector('.pad-drawing-save').onclick = () => {
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), link = document.createElement('a');
        link.href = url; link.download = fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    };
}
