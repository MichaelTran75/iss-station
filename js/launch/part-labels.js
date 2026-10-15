// Names of the parts inside Falcon 9 for the inside views (see-through and cutaway), from the landmarks in
// js/launch/internals.js. The labels stand beside the rocket (both stages together until they separate), square to
// its axis on screen, taking turns on either side going up it (so neighbours sit on opposite sides), each with a
// leader line to its part; labels on one side keep apart along the axis by their own size (above and below when the
// rocket lies across the screen). The tanks give the propellant left in them. Close-up parts are named only when the
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
    const a = new THREE.Vector2(), b = new THREE.Vector2(), u = new THREE.Vector2(), n = new THREE.Vector2(), point = new THREE.Vector3();
    const firstOrigin = new THREE.Vector3(), secondOrigin = new THREE.Vector3(), firstAxis = new THREE.Vector3(), secondAxis = new THREE.Vector3();
    const measure = item => { item.width = item.label.offsetWidth || item.text.length * 6.2; item.height = item.label.offsetHeight || 14; };
    // `stages` the two stage groups; `left` the share of each stage's propellant left; `loads` each stage's full load (kg).
    function update(camera, stages, left, loads) {
        const width = viewport.clientWidth, height = viewport.clientHeight;
        const toScreen = (vector, out) => { vector.project(camera); out.set((vector.x + 1) / 2 * width, (1 - vector.y) / 2 * height); return vector.z < 1; };
        layer.hidden = false;
        for (const item of items) item.shown = false;
        stages.first.updateMatrixWorld(); stages.second.updateMatrixWorld();
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
            const across = Math.abs(u.x) > Math.abs(u.y);   // the body lies across the screen: labels above and below
            const offset = 1.9 * metres + 34;   // clear of the skin
            const list = [];
            for (const item of items) {
                if (!body.names.includes(item.mark.stage) || (item.mark.tier === 2 && 48 * metres < 420)) continue;
                if (!toScreen(point.copy(item.at).applyMatrix4(stages[item.mark.stage].matrixWorld), item.screen)) continue;
                item.t = (item.screen.x - a.x) * u.x + (item.screen.y - a.y) * u.y;
                list.push(item);
            }
            list.sort((p, q) => p.t - q.t);
            const sides = { [-1]: [], [1]: [] };
            list.forEach((item, k) => { item.side = k % 2 ? 1 : -1; sides[item.side].push(item); });
            for (const side of [-1, 1]) {
                const column = sides[side];
                // Text first (its size sets the spacing), then apart along the axis by the labels' own extent.
                for (const item of column) {
                    let text = item.mark.name;
                    if (item.mark.holds) {
                        const tonnes = loads[item.mark.stage] * Math.max(0, left[item.mark.stage]) * (item.mark.holds === 'oxygen' ? oxygenShare : 1 - oxygenShare) / 1000;
                        text += ' · ' + (tonnes >= 10 ? tonnes.toFixed(0) : tonnes.toFixed(1)) + ' t';
                    }
                    if (item.text !== text || item.width === undefined) { item.label.textContent = text; item.text = text; item.label.hidden = false; measure(item); }
                    item.extent = across ? item.width : item.height;
                }
                for (let k = 1; k < column.length; k++) column[k].t = Math.max(column[k].t, column[k - 1].t + (column[k - 1].extent + column[k].extent) / 2 + 3);
                for (const item of column) {
                    const x = a.x + u.x * item.t + n.x * side * offset, y = a.y + u.y * item.t + n.y * side * offset;
                    if (x < 0 || x > width || y < 0 || y > height) continue;
                    item.shown = true;
                    const shift = across ? 'translate(-50%,' + (n.y * side >= 0 ? '4px' : 'calc(-100% - 4px)') + ')' : 'translate(' + (n.x * side >= 0 ? '4px' : 'calc(-100% - 4px)') + ',-50%)';
                    item.label.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) ' + shift;
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
