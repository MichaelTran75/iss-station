// Canadarm2's operations beside the arm: with Canadarm2, Dextre or the cargo vehicle selected, the pre-built operations
// (sequences.js; those that need the vehicle elsewhere than it is are left out)
// stand in a fixed place beside the inspector's card (left of it, tops level). Picking one plans it around the station
// as it stands and plays it (js/robotics/index.js); its entry then shows the step playing and how far along it is, and
// Stop eases it to a safe halt and takes the arm back. Where the inspector covers most of the view (a phone), the list
// sits at the top of the inspector's robotics panel instead.
import { viewport } from '../core/stage.js';
import { playSequence, roboticsStatus, stopSequence } from '../robotics/index.js';
import { sequences } from '../robotics/sequences.js';
import { statusText } from './robotics-tools.js';

const menu = document.getElementById('robotics-menu'), list = menu.querySelector('.robotics-menu-list');
const stateLine = menu.querySelector('.robotics-menu-state'), memoryLine = menu.querySelector('.robotics-menu-memory');
const stopButton = menu.querySelector('.robotics-menu-stop'), leader = document.getElementById('robotics-leader');
const inspector = document.getElementById('inspector'), tools = document.getElementById('robotics-tools');
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
        button.hidden = !active && !!sequence.cargo && sequence.cargo !== status.state.cargo.on;
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

// Where the list stands: fixed beside the inspector's card, on its left, tops level; it does not follow the arm. Without
// the card in view, at the right edge under the page's header.
const position = { shown: false };
const boxOf = (element, origin) => {
    if (!element || element.hidden || element.offsetParent === null) return null;
    const box = element.getBoundingClientRect();
    return box.width && box.height ? { left: box.left - origin.left, top: box.top - origin.top, right: box.right - origin.left, bottom: box.bottom - origin.top } : null;
};
// In the inspector's robotics panel (`inPanel`) or beside the card.
let docked = false;
function dock(inPanel) {
    if (inPanel === docked) return;
    docked = inPanel;
    menu.classList.toggle('in-panel', inPanel);
    if (inPanel) { tools.prepend(menu); menu.style.transform = ''; }
    else home.parent.insertBefore(menu, home.next);
    position.shown = false;
}
let lastTime = 0;
// Each frame from js/ui/controller.js render(): `visible` when Canadarm2, Dextre or the cargo vehicle is selected in a
// station view.
export function updateRoboticsMenu(visible) {
    const now = performance.now(), dt = lastTime ? Math.min(.1, (now - lastTime) / 1000) : 0;
    lastTime = now;
    leader.style.display = 'none';
    if (!visible) { if (!menu.hidden) { menu.hidden = true; position.shown = false; } return; }
    const width = viewport.clientWidth, origin = viewport.getBoundingClientRect();
    const panel = boxOf(inspector, origin);
    dock(!!panel && panel.right - panel.left > width * .6);
    if (menu.hidden) { menu.hidden = false; update(true); }
    else update(false, dt);
    if (docked) return;
    const chrome = document.querySelector('.viewport-chrome'), safeTop = chrome.offsetTop + 8, w = menu.offsetWidth;
    const left = panel ? Math.max(16, panel.left - 12 - w) : width - w - 16, top = panel ? Math.max(safeTop, panel.top) : safeTop + 40;
    if (!position.shown || position.left !== left || position.top !== top) {
        Object.assign(position, { left, top, shown: true });
        menu.style.transform = 'translate(' + left.toFixed(1) + 'px,' + top.toFixed(1) + 'px)';
    }
}
