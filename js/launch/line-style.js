// The pad and every building round it drawn as the station's X-ray (js/ui/ghost.js): each face a ghost of itself,
// its own colour at a tenth of its opacity and writing no depth, so whatever stands behind shows through; over that
// the crease (normals part by more than 50°) and boundary edges in the station's line-art green. The rocket, the
// ground's imagery and the sky keep their own look; the solid rocket and the ground hide the lines behind them.
// - Edges are found once in the station's line-art worker and added under the mesh, so a moving part (the
//   strongback, its cradles, the clamps) takes them along. Spheres have no creases, so each sphere's outline is
//   drawn for the camera that draws it (the circle where its surface turns away, set in onBeforeRender).
// - The lattice towers' see-through texture and the wires take the line colour.
// - Ghosts cast no shadows. Off puts the original materials and shadows back and hides the lines.
import * as THREE from 'three';
import { ghostOpacity } from '../core/station.js';

const LINE = 0x43544e, CREASE = 50;
// Thicker than the station's own (.0824): there many ghosts' lines overlap on paper, here they lie over a photograph.
const ink = new THREE.LineBasicMaterial({ color: LINE, transparent: true, opacity: .496, depthWrite: false });
function ghostOf(material) {
    const ghost = material.clone();
    Object.assign(ghost, { transparent: true, opacity: (material.transparent ? material.opacity : 1) * ghostOpacity, depthWrite: false, alphaTest: 0 });
    // The lattice texture (see-through between its members) is the towers' only drawing: inked, not faded.
    if (material.transparent && material.map) { ghost.opacity = .55 * material.opacity; ghost.color?.setHex(LINE); }
    ghost.emissive?.set(0x000000); ghost.needsUpdate = true;
    return ghost;
}

// `root`: the ground's group; meshes marked userData.imagery are left alone. `spheres`: [{c: Vector3, r}] in root's frame.
export function createLineStyle(root, spheres) {
    const meshes = [], lines = [], swaps = new Map(), ghosts = new Map();
    root.traverse(object => {
        if (object.isMesh && !object.userData.imagery && object.geometry?.attributes.position) meshes.push(object);
        else if (object.isLineSegments || object.isLine) object.material.color?.setHex(LINE);
    });
    for (const mesh of meshes) {
        const list = [].concat(mesh.material), drawn = list.map(material => { if (!ghosts.has(material)) ghosts.set(material, ghostOf(material)); return ghosts.get(material); });
        swaps.set(mesh, { original: mesh.material, drawn: Array.isArray(mesh.material) ? drawn : drawn[0], shadow: mesh.castShadow });
    }
    // Sphere outlines: a unit circle placed for each camera.
    const circle = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, k) => new THREE.Vector3(Math.cos(k / 96 * Math.PI * 2), Math.sin(k / 96 * Math.PI * 2), 0)));
    const toCamera = new THREE.Vector3(), centre = new THREE.Vector3(), z = new THREE.Vector3(0, 0, 1), turn = new THREE.Quaternion(), size = new THREE.Vector3();
    const outlines = spheres.map(({ c, r }) => {
        const loop = new THREE.LineLoop(circle, ink); loop.frustumCulled = false; loop.matrixAutoUpdate = false; root.add(loop);
        loop.onBeforeRender = (renderer, scene, camera) => {
            centre.copy(c).applyMatrix4(root.matrixWorld);
            toCamera.setFromMatrixPosition(camera.matrixWorld).sub(centre);
            const d = Math.max(toCamera.length(), r * 1.0001); toCamera.divideScalar(d);
            // The circle where the surface turns away from the camera: nearer the camera than the centre, a little smaller.
            centre.addScaledVector(toCamera, r * r / d);
            const radius = r * Math.sqrt(1 - (r * r) / (d * d)) * 1.002;
            loop.matrixWorld.compose(centre, turn.setFromUnitVectors(z, toCamera), size.setScalar(radius));
        };
        return loop;
    });
    // Edges, one mesh at a time through the worker (or here if it cannot start).
    let pending = meshes.slice(), worker = null, on = false, current = null;
    const attach = (mesh, points) => {
        if (!points.length) return;
        const segments = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(points, 3)), ink);
        segments.visible = on; segments.raycast = () => {}; mesh.add(segments); lines.push(segments);
    };
    const identity = Float64Array.from(new THREE.Matrix4().elements);
    function send() {
        current = pending.shift();
        if (!current) { worker?.terminate(); worker = null; return; }
        const g = current.geometry;
        worker.postMessage({ meshes: [{ position: g.attributes.position.array.slice(), index: g.index ? g.index.array.slice() : null, matrix: identity }], degrees: CREASE });
    }
    function startEdges() {
        try { worker = new Worker(new URL('../workers/line-art.js?v=8b3d432c47', import.meta.url), { type: 'module' }); } catch { worker = null; }
        if (!worker) { for (const mesh of pending.splice(0)) attach(mesh, new Float32Array(new THREE.EdgesGeometry(mesh.geometry, CREASE).attributes.position.array)); return; }
        worker.onmessage = ({ data }) => { attach(current, data.points); send(); };
        worker.onerror = event => { event.preventDefault(); worker.terminate(); worker = null; if (current) pending.unshift(current); for (const mesh of pending.splice(0)) attach(mesh, new Float32Array(new THREE.EdgesGeometry(mesh.geometry, CREASE).attributes.position.array)); };
        send();
    }
    let started = false;
    function setOn(value) {
        on = value;
        for (const [mesh, swap] of swaps) { mesh.material = on ? swap.drawn : swap.original; mesh.castShadow = on ? false : swap.shadow; }
        for (const segments of lines) segments.visible = on;
        for (const loop of outlines) loop.visible = on;
        if (on && !started) { started = true; startEdges(); }
    }
    // The ghosts keep their materials' own lighting; nothing to set for the daylight.
    function setLight() {}
    function dispose() { worker?.terminate(); for (const segments of lines) segments.geometry.dispose(); circle.dispose(); for (const ghost of ghosts.values()) ghost.dispose(); }
    return { setOn, setLight, dispose, get on() { return on; }, get edges() { return lines.reduce((n, s) => n + s.geometry.attributes.position.count / 2, 0); }, get pending() { return pending.length + (current && worker ? 1 : 0); } };
}
