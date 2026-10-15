// Names of the parts inside Falcon 9 for the inside views (see-through and cutaway), from the landmarks in
// js/launch/internals.js. The labels stand beside the rocket (both stages together until they separate), square to
// its axis on screen, taking turns on either side going up it (so neighbours sit on opposite sides; each keeps its
// side and its place whatever the camera does, so nothing jumps), each with a leader line to its part; labels on one
// side keep apart along the axis by their own size (above and below when the rocket lies across the screen). Placed
// from this frame's pose, so they ride with the rocket at any speed. The tanks give the propellant left in them. Close-up parts are named only when the
// rocket is large on screen, and none when it is small.
import * as THREE from 'three';
import { landmarks } from './internals.js';

const svgNS = 'http://www.w3.org/2000/svg';
// Each stage's length on its axis (from the bottom of the engines): the first stage to the top of the interstage,
// the second from its nozzle's exit to its top.
const spans = { first: [0, 48.7], second: [43.5, 58] };
const oxygenShare = 2.36 / 3.36;   // of the propellant's mass

export function createPartLabels(viewport) {
    const layer = document.createElement('div'); layer.className = 'launch-parts'; layer.hidden = true;
    const svg = document.createElementNS(svgNS, 'svg'); layer.appendChild(svg); viewport.appendChild(layer);
    const items = landmarks.map(mark => {
        const label = document.createElement('div'); label.className = 'orbit-label launch-part-label'; label.textContent = mark.name; layer.appendChild(label);
        const line = document.createElementNS(svgNS, 'line'), dot = document.createElementNS(svgNS, 'circle'); dot.setAttribute('r', '2.2');
        svg.append(line, dot);
        return { mark, label, line, dot, at: new THREE.Vector3(...mark.at), screen: new THREE.Vector2(), t: 0, shown: false, text: mark.name };
    });
    // Each label keeps its side and its place in its column whatever the camera does: by height up the rocket, the
    // main parts taking turns left and right, the close-up parts starting on the other side.
    for (const tier of [1, 2]) items.filter(item => item.mark.tier === tier).sort((p, q) => p.at.y - q.at.y).forEach((item, k) => { item.side = (k + tier) % 2 ? 1 : -1; });
    const a = new THREE.Vector2(), b = new THREE.Vector2(), u = new THREE.Vector2(), n = new THREE.Vector2(), point = new THREE.Vector3();
    const firstOrigin = new THREE.Vector3(), secondOrigin = new THREE.Vector3(), firstAxis = new THREE.Vector3(), secondAxis = new THREE.Vector3();
    const measure = item => { item.width = item.label.offsetWidth || item.text.length * 6.2; item.height = item.label.offsetHeight || 14; };
    // `stages` the two stage groups; `left` the share of each stage's propellant left; `loads` each stage's full load (kg).
    function update(camera, stages, left, loads) {
        const width = viewport.clientWidth, height = viewport.clientHeight;
        const toScreen = (vector, out) => { vector.project(camera); out.set((vector.x + 1) / 2 * width, (1 - vector.y) / 2 * height); return vector.z < 1; };
        layer.hidden = false;
        for (const item of items) item.shown = false;
        // This frame's pose (the vehicle's groups were just moved; last frame's matrices would leave the labels a
        // frame behind, 30 m near MECO, and shaking with the frame time).
        stages.first.updateWorldMatrix(true, false); stages.second.updateWorldMatrix(true, false);
        // Until separation the two stages are one body on one axis, and their labels share the columns.
        firstOrigin.setFromMatrixPosition(stages.first.matrixWorld); secondOrigin.setFromMatrixPosition(stages.second.matrixWorld);
        firstAxis.set(0, 1, 0).transformDirection(stages.first.matrixWorld); secondAxis.set(0, 1, 0).transformDirection(stages.second.matrixWorld);
        const joined = firstOrigin.distanceTo(secondOrigin) < .5 && firstAxis.dot(secondAxis) > .9999;
        const bodies = joined ? [{ names: ['first', 'second'], from: spans.first[0], to: spans.second[1] }] : [{ names: ['first'], from: spans.first[0], to: spans.first[1] }, { names: ['second'], from: spans.second[0], to: spans.second[1] }];
        for (const body of bodies) {
            const object = stages[body.names[0]];
            const bottomInFront = toScreen(point.set(0, body.from, 0).applyMatrix4(object.matrixWorld), a), topInFront = toScreen(point.set(0, body.to, 0).applyMatrix4(object.matrixWorld), b);
            const length = a.distanceTo(b), metres = length / (body.to - body.from);
            if (!bottomInFront || !topInFront || 48 * metres < 140) continue;
            u.subVectors(b, a).normalize(); n.set(-u.y, u.x);
            const offset = 1.9 * metres + 34;   // clear of the skin
            const list = [];
            for (const item of items) {
                if (!body.names.includes(item.mark.stage) || (item.mark.tier === 2 && 48 * metres < 420)) continue;
                if (!toScreen(point.copy(item.at).applyMatrix4(stages[item.mark.stage].matrixWorld), item.screen)) continue;
                item.t = (item.screen.x - a.x) * u.x + (item.screen.y - a.y) * u.y;
                list.push(item);
            }
            list.sort((p, q) => p.at.y - q.at.y);
            const sides = { [-1]: [], [1]: [] };
            for (const item of list) sides[item.side].push(item);
            for (const side of [-1, 1]) {
                const column = sides[side];
                // Outward from the rocket on this side, and where on its box a label meets its leader line: the edge
                // facing the rocket, sliding round the box as the rocket turns on screen (so nothing jumps).
                const dx = n.x * side, dy = n.y * side, most = Math.max(Math.abs(dx), Math.abs(dy)) || 1, alongX = (1 - dx / most) / 2, alongY = (1 - dy / most) / 2;
                // Text first (its size sets the spacing), then apart along the axis by the labels' own extent along it.
                for (const item of column) {
                    let text = item.mark.name;
                    if (item.mark.holds) {
                        const tonnes = loads[item.mark.stage] * Math.max(0, left[item.mark.stage]) * (item.mark.holds === 'oxygen' ? oxygenShare : 1 - oxygenShare) / 1000;
                        text += ' · ' + (tonnes >= 10 ? tonnes.toFixed(0) : tonnes.toFixed(1)) + ' t';
                    }
                    if (item.text !== text || item.width === undefined) { item.label.textContent = text; item.text = text; item.label.hidden = false; measure(item); }
                    item.extent = Math.abs(u.x) * item.width + Math.abs(u.y) * item.height;
                }
                for (let k = 1; k < column.length; k++) column[k].t = Math.max(column[k].t, column[k - 1].t + (column[k - 1].extent + column[k].extent) / 2 + 3);
                for (const item of column) {
                    const x = a.x + u.x * item.t + dx * offset, y = a.y + u.y * item.t + dy * offset;
                    const boxLeft = x + 4 * dx - alongX * item.width, boxTop = y + 4 * dy - alongY * item.height;
                    if (boxLeft < 0 || boxLeft + item.width > width || boxTop < 0 || boxTop + item.height > height) continue;
                    item.shown = true;
                    item.label.style.transform = 'translate(' + boxLeft.toFixed(1) + 'px,' + boxTop.toFixed(1) + 'px)';
                    item.line.setAttribute('x1', item.screen.x.toFixed(1)); item.line.setAttribute('y1', item.screen.y.toFixed(1));
                    item.line.setAttribute('x2', x.toFixed(1)); item.line.setAttribute('y2', y.toFixed(1));
                    item.dot.setAttribute('cx', item.screen.x.toFixed(1)); item.dot.setAttribute('cy', item.screen.y.toFixed(1));
                }
            }
        }
        for (const item of items) { item.label.hidden = !item.shown; item.line.style.display = item.dot.style.display = item.shown ? '' : 'none'; }
    }
    function hide() { layer.hidden = true; }
    return { update, hide };
}
