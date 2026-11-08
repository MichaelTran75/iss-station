// Canadarm2's operations beside the arm: with Canadarm2 or Dextre selected, the pre-built operations (sequences.js)
// float next to the elbow on a leader line, as the scene's labels do. Picking one plans it around the station as it
// stands and plays it (js/robotics/index.js); its entry then shows the step playing and how far along it is, and Stop
// eases it to a safe halt and takes the arm back. The list keeps clear of the inspector, the component picker and the
// dock, and follows the elbow smoothly as the arm and the camera move. Where the inspector covers most of the view (a
// phone), the arm is behind it, so the list sits at the top of the inspector's robotics panel instead.
import * as THREE from 'three';
import { camera, viewport } from '../core/stage.js';
import { parts } from '../core/station.js';
import { playSequence, roboticsStatus, stopSequence } from '../robotics/index.js';
import { sequences } from '../robotics/sequences.js';
import { statusText } from './robotics-tools.js';

const menu = document.getElementById('robotics-menu'), list = menu.querySelector('.robotics-menu-list');
const stateLine = menu.querySelector('.robotics-menu-state'), memoryLine = menu.querySelector('.robotics-menu-memory');
const stopButton = menu.querySelector('.robotics-menu-stop'), leader = document.getElementById('robotics-leader');
const line = leader.querySelector('path'), dot = leader.querySelector('circle');
const entry = parts.get('robotics'), inspector = document.getElementById('inspector'), tools = document.getElementById('robotics-tools');
const home = { parent: menu.parentElement, next: menu.nextSibling };
const items = sequences.map(sequence => {
    const button = document.createElement('button'), title = document.createElement('b'), detail = document.createElement('small'), bar = document.createElement('i');
    button.type = 'button'; button.dataset.sequence = sequence.id; button.setAttribute('aria-pressed', 'false');
    title.textContent = sequence.title; detail.textContent = sequence.summary || ''; bar.className = 'robotics-menu-bar'; bar.append(document.createElement('i'));
    button.append(title, detail, bar); list.append(button);
    button.addEventListener('click', () => { playSequence(sequence.id); update(true); });
    return { sequence, button, detail, bar: bar.firstChild };
});
stopButton.addEventListener('click', () => { stopSequence(); update(true); });

// The text, at most four times a second.
let wait = 0;
function update(now = false, delta = 0) {
    if (!now && (wait -= delta) > 0) return;
    wait = .25;
    const status = roboticsStatus(), busy = !!status.sequence, text = statusText(status);
    for (const { sequence, button, detail, bar } of items) {
        const active = status.sequence?.id === sequence.id;
        button.setAttribute('aria-pressed', String(active));
        button.disabled = busy && !active;
        const shown = active ? (status.phase === 'sequence' || status.phase === 'waiting' || status.phase === 'stopping' ? (status.step?.label || '') : status.phase === 'planning' || status.phase === 'mapping' ? 'Planning around the station…' : 'Next, after the arm stops') : sequence.summary || '';
        if (detail.textContent !== shown) detail.textContent = shown;
        const progress = active && status.phase !== 'planning' && status.phase !== 'mapping' ? status.progress : 0;
        bar.style.transform = 'scaleX(' + progress.toFixed(4) + ')';
    }
    stopButton.hidden = !busy;
    stopButton.textContent = status.stopping ? 'Stopping…' : 'Stop';
    stopButton.disabled = status.stopping;
    if (stateLine.textContent !== text) stateLine.textContent = text;
    const memory = status.map.state === 'ready' ? 'Clearance map ready · ' + status.remembered + (status.remembered === 1 ? ' pose' : ' poses') + ' learned from routes'
        : status.map.state === 'building' ? 'Mapping the station’s clearances…' : status.map.state === 'failed' ? 'Clearance map unavailable' : 'Clearance map builds shortly';
    if (memoryLine.textContent !== memory) memoryLine.textContent = memory;
}

// Where the list stands: beside the elbow, on whichever side keeps it clear of the page's panels, eased toward that
// place so it does not jitter as the arm moves.
const anchor = new THREE.Vector3(), position = { x: 0, y: 0, shown: false };
let lastTime = 0;
const boxOf = (element, origin) => {
    if (!element || element.hidden || element.offsetParent === null) return null;
    const box = element.getBoundingClientRect();
    return box.width && box.height ? { left: box.left - origin.left, top: box.top - origin.top, right: box.right - origin.left, bottom: box.bottom - origin.top } : null;
};
const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
// In the inspector's robotics panel (`inPanel`) or floating beside the arm.
let docked = false;
function dock(inPanel) {
    if (inPanel === docked) return;
    docked = inPanel;
    menu.classList.toggle('in-panel', inPanel);
    if (inPanel) { tools.prepend(menu); menu.style.transform = ''; leader.style.display = 'none'; }
    else home.parent.insertBefore(menu, home.next);
    position.shown = false;
}
// Each frame from js/ui/controller.js render(): `visible` when Canadarm2 or Dextre is selected in a station view.
export function updateRoboticsMenu(visible) {
    const now = performance.now(), dt = lastTime ? Math.min(.1, (now - lastTime) / 1000) : 0;
    lastTime = now;
    if (!visible) { if (!menu.hidden) { menu.hidden = true; leader.style.display = 'none'; position.shown = false; } return; }
    const width = viewport.clientWidth, height = viewport.clientHeight, origin = viewport.getBoundingClientRect();
    const panel = boxOf(inspector, origin);
    dock(!!panel && panel.right - panel.left > width * .6);
    if (menu.hidden) { menu.hidden = false; update(true); }
    else update(false, dt);
    if (docked) return;
    const chrome = document.querySelector('.viewport-chrome'), safeTop = chrome.offsetTop + 8, safeBottom = chrome.offsetTop + chrome.clientHeight - 8;
    const w = menu.offsetWidth, h = menu.offsetHeight;
    entry.group.localToWorld(anchor.copy(entry.anchor)).project(camera);
    const onScreen = anchor.z > -1 && anchor.z < 1 && Math.abs(anchor.x) < 1 && Math.abs(anchor.y) < 1;
    const ax = (anchor.x * .5 + .5) * width, ay = (-anchor.y * .5 + .5) * height;
    const occupied = ['#inspector', '.component-picker', '.dock', '.viewport-meta', '.approach-status', '.interior-focus', '.orientation'].map(selector => boxOf(document.querySelector(selector), origin)).filter(Boolean);
    const gap = width < 600 ? 22 : 46, clampX = x => Math.max(16, Math.min(width - w - 16, x)), clampY = y => Math.max(safeTop, Math.min(Math.max(safeTop, safeBottom - h), y));
    let best = null;
    for (const [dx, dy] of [[1, -1], [1, 1], [-1, -1], [-1, 1]]) {
        const left = clampX(dx > 0 ? ax + gap : ax - gap - w), top = clampY(dy < 0 ? ay - h - 18 : ay + 18);
        const box = { left: left - 8, top: top - 8, right: left + w + 8, bottom: top + h + 8 };
        const score = occupied.reduce((sum, other) => sum + overlap(box, other), 0) * 4 + Math.hypot(left + w / 2 - ax, top + h / 2 - ay);
        if (!best || score < best.score) best = { left, top, score };
    }
    if (!position.shown) Object.assign(position, { x: best.left, y: best.top, shown: true });
    else { const ease = 1 - Math.exp(-8 * dt); position.x += (best.left - position.x) * ease; position.y += (best.top - position.y) * ease; }
    menu.style.transform = 'translate(' + position.x.toFixed(1) + 'px,' + position.y.toFixed(1) + 'px)';
    leader.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    leader.style.display = onScreen ? '' : 'none';
    if (!onScreen) return;
    // The leader runs from the elbow to the nearer side of the list, level with its title.
    const endX = ax > position.x + w / 2 ? position.x + w : position.x, endY = Math.max(position.y + 12, Math.min(position.y + h - 12, ay));
    line.setAttribute('d', 'M ' + ax.toFixed(1) + ' ' + ay.toFixed(1) + ' L ' + endX.toFixed(1) + ' ' + endY.toFixed(1));
    dot.setAttribute('cx', ax.toFixed(1)); dot.setAttribute('cy', ay.toFixed(1));
}
