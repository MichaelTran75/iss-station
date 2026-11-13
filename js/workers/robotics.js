// Robotics worker: builds the clearance fields of the station's rigid bodies from their triangles (field.js), keeps
// them, and plans Canadarm2's routes and operations against them (planner.js), so the page never waits on either.
// Messages from the page (js/robotics/map.js):
//   { type: 'build', bodies: [{ id, kind, what, lo, hi, frame, meshes: [{ position, index, matrix, stride, offset }] }] }
//     answered by { type: 'progress', done, total } along the way, then { type: 'built', bodies, ms }: each body with
//     its field (a copy: the worker keeps its own), the centre and radius bounding its triangles.
//   { type: 'plan', id, from, to, frames, memory } (a route), or { type: 'plan', id, from, steps, frames, memory } (a
//     pre-built operation planned for the station as it stands), answered by { type: 'route', id, result }.
//   { type: 'cancel', id }.
import { fieldBuilder } from '../robotics/field.js?v=180c067b77';
import { createWorld, placeBodies } from '../robotics/collision.js?v=ee93b5170b';
import { planSteps, route } from '../robotics/planner.js?v=b33acbc219';

let world = null;
const cancelled = new Set();
const triangles = mesh => (mesh.index ? mesh.index.length : (mesh.position.length - (mesh.offset || 0)) / (mesh.stride || 3)) / 3;

function build(bodies) {
    const started = performance.now(), total = bodies.reduce((sum, body) => sum + body.meshes.reduce((s, m) => s + triangles(m), 0), 0);
    let done = 0, reported = 0;
    const built = [];
    for (const body of bodies) {
        const builder = fieldBuilder(body.lo, body.hi);
        for (const mesh of body.meshes) {
            builder.add(mesh.position, mesh.index, mesh.matrix, mesh.stride || 3, mesh.offset || 0);
            done += triangles(mesh);
            if (done - reported > total / 20) { reported = done; self.postMessage({ type: 'progress', done, total }); }
        }
        const field = builder.finish(), center = [0, 1, 2].map(d => (body.lo[d] + body.hi[d]) / 2);
        const radius = Math.hypot(...[0, 1, 2].map(d => (body.hi[d] - body.lo[d]) / 2));
        built.push({ id: body.id, kind: body.kind, what: body.what, frame: body.frame, field, center, radius });
    }
    world = createWorld(built);
    self.postMessage({ type: 'built', bodies: built, ms: Math.round(performance.now() - started) });
}

// A plan runs in slices of about 30 ms, so a newer request or a cancel can get in between.
async function plan({ id, from, to, steps, frames, memory }) {
    if (!world) { self.postMessage({ type: 'route', id, result: { ok: false, reason: 'no map' } }); return; }
    placeBodies(world, frames || {});
    const started = performance.now(), job = steps ? planSteps(world, from, steps, { memory }) : route(world, from, to, { memory });
    let step;
    while (true) {
        const until = performance.now() + 30;
        do step = job.next(); while (!step.done && performance.now() < until);
        if (step.done) break;
        await new Promise(resolve => setTimeout(resolve, 0));
        if (cancelled.has(id)) { cancelled.delete(id); return; }
    }
    self.postMessage({ type: 'route', id, result: { ...step.value, ms: Math.round(performance.now() - started) } });
}

self.onmessage = ({ data }) => {
    try {
        if (data.type === 'build') build(data.bodies);
        else if (data.type === 'plan') plan(data).catch(error => self.postMessage({ type: 'route', id: data.id, result: { ok: false, reason: String(error && error.stack || error) } }));
        else if (data.type === 'cancel') cancelled.add(data.id);
    } catch (error) {
        self.postMessage({ type: 'error', message: String(error && error.stack || error) });
    }
};
