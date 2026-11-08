// The clearance map: the station's own triangles, gathered by rigid body, made into clearance fields (field.js) by the
// robotics worker (js/workers/robotics.js), which then plans Canadarm2's routes against its copy (planner.js); the
// page keeps another (collision.js) to watch the moving bodies ahead of the arm (index.js). Built once, a few seconds
// after the page opens, in a second or two off the main thread (with ?worker=0, or where workers fail, on it).
//
// Rigid bodies: the fixed station (every part shown in the 2026 configuration but the robotics, Dextre and Dragon,
// without interiors, exhaust puffs or skinned figures); what the scene turns or moves on its own, each in its own
// frame (each side's SARJ, each solar wing with its iROSA, each radiator wing, each antenna's two axes, Dragon, the
// window shutter); and the robotics' own: the base's carriage, Dextre's base and body.
import * as THREE from 'three';
import { station } from '../core/stage.js';
import { query } from '../core/quality.js';
import { destinyShutter, parts, shownIn, trackingDishes, wings } from '../core/station.js';
import { sarjPivots } from '../core/sarj.js';
import { createWorld, placeBodies } from './collision.js';
import { fieldBuilder } from './field.js';
import { planSteps, route } from './planner.js';

export const map = { state: 'waiting', progress: 0, ms: 0, world: null };
let roots = [], worker = null, ready = null;
const toStation = new THREE.Matrix4(), relative = new THREE.Matrix4();
const frameOf = object => { object.updateWorldMatrix(true, false); return relative.multiplyMatrices(toStation, object.matrixWorld).elements.slice(); };
const sameFrame = (a, b) => a.every((value, i) => Math.abs(value - b[i]) < 1e-5);

// The bodies the scene moves on its own, by id: objects that move together share one body (each side's SARJ pivots
// turn together, an iROSA copies its wing).
function sceneRoots() {
    const list = [];
    const add = (id, what, objects) => {
        const groups = [];
        for (const object of objects.filter(Boolean)) {
            const frame = frameOf(object), group = groups.find(g => sameFrame(g.frame, frame));
            if (group) group.objects.push(object); else groups.push({ frame, objects: [object] });
        }
        groups.forEach((group, k) => list.push({ id: k ? id + '-' + k : id, what, ...group }));
    };
    add('sarj-port', 'array', sarjPivots.port); add('sarj-starboard', 'array', sarjPivots.starboard);
    wings.forEach((wing, k) => add('wing-' + k, 'array', [wing.group, wing.overlay]));
    (parts.get('thermal')?.group.userData.radiatorBanks || []).forEach((bank, k) => add('radiator-' + k, 'radiator', [bank]));
    trackingDishes.forEach((dish, k) => { add('antenna-' + k, 'antenna', [dish.azimuth]); add('antenna-' + k + '-dish', 'antenna', [dish.elevation]); });
    if (parts.has('dragon')) add('dragon', 'dragon', [parts.get('dragon').group]);
    if (destinyShutter.pivot) add('shutter', 'station', [destinyShutter.pivot]);
    return list;
}
const usable = (mesh, top) => {
    if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.userData.interior || mesh.userData.puff) return false;
    const position = mesh.geometry?.attributes?.position;
    if (!position || position.count < 3) return false;
    for (let o = mesh; o && o !== top; o = o.parent) if (!o.visible) return false;
    return true;
};
// A mesh as the worker takes it: positions (a plain Float32Array, or the interleaved one with its stride and offset),
// the index, and the matrix from the mesh to its body's frame.
const converted = new WeakMap();
function meshEntry(mesh, toBody, box) {
    const attribute = mesh.geometry.attributes.position, matrix = new THREE.Matrix4().multiplyMatrices(toBody, mesh.matrixWorld);
    let position, stride = 3, offset = 0;
    if (attribute.isInterleavedBufferAttribute && !attribute.normalized && attribute.data.array instanceof Float32Array) { position = attribute.data.array; stride = attribute.data.stride; offset = attribute.offset; }
    else if (!attribute.isInterleavedBufferAttribute && !attribute.normalized && attribute.array instanceof Float32Array) position = attribute.array;
    else {
        position = converted.get(attribute);
        if (!position) { position = new Float32Array(attribute.count * 3); for (let i = 0; i < attribute.count; i++) position.set([attribute.getX(i), attribute.getY(i), attribute.getZ(i)], i * 3); converted.set(attribute, position); }
    }
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox.clone().applyMatrix4(matrix));
    return { position, stride, offset, index: mesh.geometry.index ? mesh.geometry.index.array : null, matrix: Float64Array.from(matrix.elements) };
}
// Everything the worker needs to build the fields.
function gather() {
    station.updateMatrixWorld(true);
    toStation.copy(station.matrixWorld).invert();
    roots = sceneRoots();
    const owner = new Map();
    for (const root of roots) for (const object of root.objects) owner.set(object, root);
    const body = (id, kind, what, frame) => ({ id, kind, what, frame, meshes: [], box: new THREE.Box3(), toBody: new THREE.Matrix4().copy(new THREE.Matrix4().fromArray(frame)).invert().multiply(toStation) });
    const identity = new THREE.Matrix4().elements.slice();
    const fixed = body('station', 'station', 'station', identity), moving = new Map(roots.map(root => [root, body(root.id, 'scene', root.what, root.frame)]));
    for (const entry of parts.values()) {
        if (['robotics', 'dextre'].includes(entry.id) || !shownIn(entry.id, 'modern')) continue;
        entry.group.traverse(mesh => {
            if (!usable(mesh, entry.group)) return;
            let root = null;
            for (let o = mesh; o && o !== station && !root; o = o.parent) root = owner.get(o) || null;
            const into = root ? moving.get(root) : entry.id === 'dragon' ? null : fixed;
            if (into) into.meshes.push(meshEntry(mesh, into.toBody, into.box));
        });
    }
    // The base's carriage at home, Dextre's base and its body in their own frames.
    const robotics = parts.get('robotics').group, { carriage } = robotics.userData.robotics, x = carriage.position.x;
    carriage.position.x = 0; carriage.updateMatrixWorld(true);
    const base = body('carriage', 'carriage', 'base', identity);
    carriage.traverse(mesh => { if (usable(mesh, carriage)) base.meshes.push(meshEntry(mesh, base.toBody, base.box)); });
    carriage.position.x = x; carriage.updateMatrixWorld(true);
    const dextre = parts.get('dextre').group, dextreBody = dextre.userData.body;
    dextre.updateMatrixWorld(true);
    const dBase = body('dextre-base', 'dextre-base', 'dextre', identity), dBody = body('dextre-body', 'dextre-body', 'dextre', identity);
    dBase.toBody = dextre.matrixWorld.clone().invert(); dBody.toBody = dextreBody.matrixWorld.clone().invert();
    dextre.traverse(mesh => {
        if (!usable(mesh, dextre)) return;
        let inBody = false; for (let o = mesh.parent; o && o !== dextre; o = o.parent) if (o === dextreBody) inBody = true;
        const into = inBody ? dBody : dBase; into.meshes.push(meshEntry(mesh, into.toBody, into.box));
    });
    return [fixed, ...moving.values(), base, dBase, dBody].filter(b => b.meshes.length).map(({ id, kind, what, frame, meshes, box }) => ({ id, kind, what, frame, meshes, lo: box.min.toArray(), hi: box.max.toArray() }));
}
// The same work as the worker's, on this thread, a few milliseconds at a time.
function* buildHere(bodies) {
    const built = [], total = bodies.reduce((sum, b) => sum + b.meshes.length, 0);
    let done = 0;
    for (const b of bodies) {
        const builder = fieldBuilder(b.lo, b.hi);
        for (const mesh of b.meshes) { builder.add(mesh.position, mesh.index, mesh.matrix, mesh.stride, mesh.offset); map.progress = ++done / total; yield; }
        const center = [0, 1, 2].map(d => (b.lo[d] + b.hi[d]) / 2), radius = Math.hypot(...[0, 1, 2].map(d => (b.hi[d] - b.lo[d]) / 2));
        built.push({ id: b.id, kind: b.kind, what: b.what, frame: b.frame, field: builder.finish(), center, radius });
        yield;
    }
    return built;
}
const slices = (job, ms, done) => {
    const run = () => { const until = performance.now() + ms; let step; do step = job.next(); while (!step.done && performance.now() < until); if (step.done) done(step.value); else setTimeout(run, 0); };
    run();
};

const pending = new Map();
let nextId = 1;
// Builds the map (once); resolves when it is ready. A worker that fails hands the work to this thread.
export function buildMap() {
    if (ready) return ready;
    map.state = 'building';
    const started = performance.now();
    ready = new Promise(resolve => {
        const finish = bodies => { map.world = createWorld(bodies); map.state = 'ready'; map.progress = 1; map.ms = Math.round(performance.now() - started); resolve(map); };
        // Should this fail too, the map stays empty and plans answer at once (the arm then moves without them).
        const here = () => { try { slices(buildHere(gather()), 8, finish); } catch (error) { console.warn('Robotics map:', error); map.state = 'failed'; resolve(map); } };
        const fail = message => {
            console.warn('Robotics worker:', message);
            worker?.terminate(); worker = null;
            for (const answer of pending.values()) answer({ ok: false, reason: 'worker failed' });
            pending.clear();
            if (map.state === 'building') here();
        };
        if (query.get('worker') === '0' || typeof Worker === 'undefined') { here(); return; }
        try { worker = new Worker(new URL('../workers/robotics.js?v=3f8d05d4eb', import.meta.url), { type: 'module' }); } catch { worker = null; here(); return; }
        worker.onmessage = ({ data }) => {
            if (data.type === 'progress') map.progress = data.done / data.total;
            else if (data.type === 'built') finish(data.bodies);
            else if (data.type === 'route') { pending.get(data.id)?.(data.result); pending.delete(data.id); }
            else if (data.type === 'error') fail(data.message);
        };
        worker.onerror = event => { event.preventDefault?.(); fail(event.message || 'error'); };
        worker.postMessage({ type: 'build', bodies: gather() });
    });
    return ready;
}
// Where the scene's moving bodies stand now (body to station), by id.
export function sceneFrames() {
    toStation.copy(station.matrixWorld).invert();
    const frames = {};
    for (const root of roots) frames[root.id] = frameOf(root.objects[0]);
    return frames;
}
// The page's copy of the map, its moving bodies where the scene has them now.
export function currentWorld() {
    if (!map.world) return null;
    placeBodies(map.world, sceneFrames());
    return map.world;
}
// A plan (planner.js) for the station as it stands when the map is ready: a route { from, to } or a pre-built
// operation { from, steps }, with the poses earlier routes learned (`memory`). Returns { promise, cancel }.
export function requestPlan({ from, to = null, steps = null, memory = [] }) {
    const id = nextId++;
    let cancelled = false, answer = null;
    const promise = buildMap().then(() => new Promise(resolve => {
        answer = resolve;
        if (cancelled) { resolve({ ok: false, reason: 'cancelled' }); return; }
        if (!map.world) { resolve({ ok: false, reason: 'no map' }); return; }
        const frames = sceneFrames();
        if (worker) { pending.set(id, resolve); worker.postMessage({ type: 'plan', id, from, to, steps, frames, memory }); return; }
        placeBodies(map.world, frames);
        const job = steps ? planSteps(map.world, from, steps, { memory }) : route(map.world, from, to, { memory });
        slices({ next: () => cancelled ? { done: true, value: { ok: false, reason: 'cancelled' } } : job.next() }, 6, resolve);
    }));
    const cancel = () => {
        cancelled = true;
        if (pending.has(id)) { worker?.postMessage({ type: 'cancel', id }); pending.delete(id); answer?.({ ok: false, reason: 'cancelled' }); }
    };
    return { promise, cancel };
}
