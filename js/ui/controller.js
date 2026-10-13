// Interface: selection and the detail panel, views and camera framing, labels and overlays, the controls,
// and the frame loop (advance).
import * as THREE from 'three';
import { app, camera, controls, inspectionLight, renderer, scene, station, viewport } from '../core/stage.js';
import { markShadowsDirty, updateShadows, updateStats, watchFrames } from '../core/quality.js';
import { destinyShutter, ghostOpacity, modernParts, parts, trackingDishes, wings } from '../core/station.js';
import { crewThought, updateColumbusCrew } from '../parts/columbus.js';
import { approach, approachPhase, approachStartTime, dragon, dragonBounds, dragonFlightBounds, lvlhToStation, rendezvous,
    setDragonShell, updateApproach, updateDragonCrew } from '../parts/dragon.js';
import { evaWorkerState, z1EVA } from '../figures/eva.js';
import { ghostMaterial } from './ghost.js';
import { updateRendezvousGuide } from './rendezvous-guide.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export let motion = !reducedMotion.matches, labelsEnabled = false, selected = null, currentView = 'reverse', configuration = 'modern', orbital = false, elapsed = 0;
let destinyDetail = 'supports', dragonDetail = 'approach';
const inspector = document.getElementById('inspector');
const componentSelect = document.getElementById('component-select');
for (const entry of parts.values()) {
    const option = document.createElement('option'); option.value = entry.id; option.textContent = entry.name; componentSelect.appendChild(option);
}
componentSelect.addEventListener('change', () => {
    if (componentSelect.value) { const id = componentSelect.value; selectPart(id); focusPart(id); }
    else { selectPart(null); setView('reverse'); }
});
const assemblySource = ['NASA · Assembly elements', 'https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/'];
const detailSources = {
    destiny: ['NASA · Destiny and its observation window', 'https://www.nasa.gov/international-space-station/destiny-laboratory-module/'],
    poisk: ["NASA · Poisk MRM-2", "https://www.nasa.gov/international-space-station/poisk-mini-research-module-2-yezof/"],
    rassvet: ["NASA · Rassvet MRM-1", "https://www.nasa.gov/international-space-station/rassvet-mini-research-module/"],
    prichal: ["NASA · Nauka experiment airlock", "https://www.nasa.gov/blogs/spacestation/2023/05/03/cosmonauts-move-experiment-airlock-and-complete-spacewalk/"],
    soyuz: ['ESA · Soyuz modules and hardware', 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/The_Russian_Soyuz_spacecraft'],
    beam: ["NASA · BEAM dimensions and aft attachment", "https://www.nasa.gov/international-space-station/bigelow-expandable-activity-module-beam/"],
    bishop: ["NASA · Bishop port-side installation", "https://www.nasa.gov/blogs/spacestation/2020/12/21/new-science-airlock-expands-stations-research-capacity/"],
    z1: ['JAXA · Z1 structure and systems', 'https://iss.jaxa.jp/iss/3a/mis_z1truss_e.html'],
    irosa: ['NASA · June 2023 array installation', 'https://www.nasa.gov/blogs/spacestation/2023/06/15/nasa-spacewalkers-finish-installing-roll-out-solar-array/'],
    thermal: ['NASA · Thermal systems, p. 203', 'https://www.nasa.gov/wp-content/uploads/2018/04/iss-operating_an_outpost-tagged.pdf'],
    truss: ['NASA · Station systems reference', 'https://www.nasa.gov/wp-content/uploads/2018/04/iss-operating_an_outpost-tagged.pdf'],
    tranquility: ['ESA · Cupola architecture', 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Node-3_Cupola/Cupola'],
    robotics: ['CSA · How Canadarm2 works', 'https://www.asc-csa.gc.ca/eng/iss/canadarm2/about.asp'],
    kibo: ['JAXA · Kibo components', 'https://humans-in-space.jaxa.jp/en/kibo/structure/'],
    leonardo: ['NASA · Leonardo relocation', 'https://www.nasa.gov/international-space-station/permanent-multipurpose-module/'],
    harmony: ['NASA · International docking adapter', 'https://www.nasa.gov/missions/station/meet-the-international-docking-adapter/'],
    nauka: ['ESA · European Robotic Arm', 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/International_Space_Station/European_Robotic_Arm']
};
const labelLayer = document.getElementById('labels'), leaders = document.getElementById('leaders');
const approachHud = document.getElementById('approach-hud'), approachDistLine = document.getElementById('approach-dist-line'), approachPortDot = document.getElementById('approach-port-dot'), approachDragonDot = document.getElementById('approach-dragon-dot'), approachDistBadge = document.getElementById('approach-distance-badge');
const svgNamespace = 'http://www.w3.org/2000/svg';
const labelSpecs = [['power', '02 / POWER', 'Solar array wings', 65, -58], ['thermal', '04 / THERMAL', 'Heat-rejection radiators', 52, 45], ['kibo', '08 / RESEARCH', 'Kibo laboratory', -133, -25], ['robotics', '19 / ROBOTICS', 'Canadarm2', 58, -44], ['zvezda', '14 / RUSSIAN SEGMENT', 'Zvezda', 60, 38], ['dragon', '17 / CREW', 'Crew Dragon', -100, 40]];
export const labels = labelSpecs.map(([id, code, title, offsetX, offsetY]) => {
    const element = document.createElement('button'); element.className = 'annotation'; element.innerHTML = '<span>' + code + '</span><b>' + title + '</b>'; element.setAttribute('aria-label', parts.get(id).name + ' details'); element.addEventListener('click', () => selectPart(id)); labelLayer.appendChild(element);
    const line = document.createElementNS(svgNamespace, 'path'), dot = document.createElementNS(svgNamespace, 'circle'); dot.setAttribute('r', '2'); leaders.append(line, dot);
    return { id, element, line, dot, offsetX, offsetY };
});
function setPressed(id, value) { document.getElementById(id).setAttribute('aria-pressed', String(value)); }
setPressed('motion-toggle', motion);
let toastTimer;
export function notify(message) { const toast = document.getElementById('toast'); toast.textContent = message; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 3500); }
// Ghost every visible part except the selection (Dragon keeps Harmony solid, its docking target).
function applyGhost() {
    markShadowsDirty();
    const solid = selected ? new Set(selected === 'dragon' ? dragonDetail === 'cabin' ? ['dragon'] : ['dragon', 'harmony'] : [selected]) : null;
    for (const entry of parts.values()) {
        const ghost = solid !== null && !solid.has(entry.id);
        if (!!entry.ghost === ghost) continue;
        entry.ghost = ghost;
        entry.group.traverse(child => {
            if (child.userData.lineArt) { child.visible = ghost; return; }
            if (!child.isMesh) return;
            if (ghost) {
                child.userData.solidMaterial = child.material; child.userData.solidShadow = child.castShadow;
                child.material = Array.isArray(child.material) ? child.material.map(ghostMaterial) : ghostMaterial(child.material); child.castShadow = false;
            } else if (child.userData.solidMaterial) {
                child.material = child.userData.solidMaterial; child.castShadow = child.userData.solidShadow;
                delete child.userData.solidMaterial; delete child.userData.solidShadow;
            }
        });
    }
}
// The EVA figure arrives after the first frame: give it Z1's current ghost or highlight state.
export function adoptEvaFigure(figure) {
    if (parts.get('z1').ghost) figure.frame.traverse(child => {
        if (!child.isMesh) return;
        child.userData.solidMaterial = child.material; child.userData.solidShadow = child.castShadow;
        child.material = Array.isArray(child.material) ? child.material.map(ghostMaterial) : ghostMaterial(child.material); child.castShadow = false;
    });
    if (selected === 'z1') {
        figure.frame.traverse(child => { if (child.isMesh && child.material.emissive) { child.material.emissive.set(0x2e7c66); child.material.emissiveIntensity = .16; } });
        figure.restart();
    }
    markShadowsDirty();
    render();
}
export function selectPart(id) {
    setDragonShell(0);
    if (currentView === 'detail' && (id !== selected || !id)) setView('reverse');
    if (id && id !== 'columbus' && currentView === 'interior') setView('reverse');
    if (id && currentView === 'orbit') setView('reverse');
    if (id && modernParts.has(id) && configuration === 'reference') setConfiguration('modern');
    if (id === 'destiny' && selected !== 'destiny') destinyDetail = 'supports';
    if (id === 'dragon' && selected !== 'dragon') dragonDetail = 'approach';
    if (id === 'z1' && selected !== 'z1') z1EVA.restart();
    selected = id; componentSelect.value = id || "";
    document.querySelectorAll('.milestone').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.part === id)));
    for (const entry of parts.values()) entry.group.traverse(child => {
        // A ghosted mesh keeps its solid material aside; the highlight belongs on that one.
        const surface = child.userData.solidMaterial || child.material;
        if (child.isMesh && !child.userData.interior) { surface.emissive?.set(entry.id === id ? 0x2e7c66 : 0x000000); if (surface.emissive) surface.emissiveIntensity = entry.id === id ? .16 : 0; }
        if (child.userData.outline && !child.userData.interior) { child.material.color.set(entry.id === id ? 0x14776d : 0x43544e); child.material.opacity = entry.id === id ? .8 : .38; }
    });
    applyGhost();
    setDragonShell(id === 'dragon' ? dragonDetail === 'cabin' ? ghostOpacity : .25 : 0);
    inspector.hidden = !id;
    document.getElementById('eva-asset-credit').hidden = id !== 'z1';
    document.getElementById('dragon-asset-credit').hidden = id !== 'dragon';
    document.getElementById('columbus-asset-credit').hidden = id !== 'columbus';
    document.getElementById('destiny-tools').hidden = id !== 'destiny';
    document.getElementById('dragon-tools').hidden = id !== 'dragon';
    setPressed('dragon-approach', dragonDetail === 'approach');
    setPressed('dragon-cabin', dragonDetail === 'cabin');
    document.getElementById('shutter-controls').hidden = destinyDetail !== 'window';
    setPressed('destiny-supports', destinyDetail === 'supports');
    setPressed('destiny-window', destinyDetail === 'window');
    if (id) {
        const entry = parts.get(id), windowDetail = id === 'destiny' && destinyDetail === 'window', cabinDetail = id === 'dragon' && dragonDetail === 'cabin';
        document.getElementById('detail-code').textContent = entry.category; document.getElementById('detail-title').textContent = entry.name;
        document.getElementById('detail-description').textContent = windowDetail
            ? 'The Earth-facing observation window has a 0.508 m clear aperture and four panes. Its external shutter protects the glass. This close-up demonstrates the hinged cover; the outline, opening angle and timing are illustrative.'
            : cabinDetail ? 'The docked capsule with its hull 90% transparent. Four crew in SpaceX suits recline on the seat pallet under the flight display, with cargo stowed on the floor beneath them. The crew member in the outboard seat raises an arm, turns the hand palm-down and touches the display with the index finger. Below the floor, the service bay holds propellant tanks between radial bulkheads. The suit is measured from the supplied model and seated for this view; the seats, display and bay layout are illustrative.'
            : id === 'destiny' ? 'Two forward bipods and two aft tripods connect S0 to Destiny. Ten adjustable legs converge on four mounted shoes, with captive bolts, telescoping collars and secured cable runs. Small fittings and attachment positions are schematic.' : entry.description;
        const [sourceLabel, sourceUrl] = id === 'destiny' ? windowDetail
            ? ['NASA · Observation window', 'https://science.nasa.gov/earth/earth-observatory/human-spaceflight-factsheet/']
            : ['NASA · STS-110 support hardware', 'https://www.nasa.gov/wp-content/uploads/2023/05/spk-110-press-kit.pdf']
            : detailSources[id] || assemblySource;
        const detailFacts = windowDetail ? [['Clear aperture', '0.508 m'], ['Glass assembly', '4 panes']] : cabinDetail ? [['Crew', '4 seated'], ['Docked to', 'Harmony forward']] : entry.facts;
        const source = document.getElementById('detail-reference'); source.href = sourceUrl; source.textContent = sourceLabel + ' ↗';
        const facts = document.getElementById('detail-facts'); facts.replaceChildren();
        for (const [name, value] of detailFacts) { const pair = document.createElement('div'), term = document.createElement('dt'), definition = document.createElement('dd'); term.textContent = name; definition.textContent = value; pair.append(term, definition); facts.append(pair); }
    }
    render();
}
function cameraDirection(name) {
    if (name === 'interior') return new THREE.Vector3(75, 115, -190);
    if (name === 'zenith') return new THREE.Vector3(0, 240, .01);
    if (name === 'forward') return new THREE.Vector3(0, 44, -240);
    if (name === 'reverse') return new THREE.Vector3(155, 185, -155);
    return new THREE.Vector3(-155, 185, -155);
}
export const stationBounds = new THREE.Box3();
export function setConfiguration(name) {
    configuration = name; markShadowsDirty();
    for (const entry of parts.values()) entry.group.visible = !modernParts.has(entry.id) || name === 'modern';
    stationBounds.makeEmpty();
    // Dragon may be hundreds of metres out on its approach: the station's frame takes only its last leg.
    for (const entry of parts.values()) if (entry.group.visible && entry.id !== 'dragon') stationBounds.expandByObject(entry.group);
    stationBounds.union(dragonFlightBounds);
    setPressed('configuration-toggle', name === 'modern');
    document.getElementById('configuration-name').textContent = name === 'modern' ? 'JUNE 2023 / ILLUSTRATIVE CONFIGURATION' : 'CORE ELEMENTS / SIMPLIFIED COMPARISON';
    if (selected && !parts.get(selected).group.visible) selectPart(null);
    if (currentView !== 'orbit') setView(currentView === 'detail' ? 'reverse' : currentView);
}
// The orthographic frustum that frames `bounds` from the camera's present direction: half its height, the aspect, and
// the vertical shift (per unit of half-height) that centres the bounds in the space between the page's chrome (and,
// with `clearDock`, above the tool dock too).
function framing(bounds, margin, clearDock = false) {
    const inverse = camera.matrixWorldInverse;
    let minimumX = Infinity, maximumX = -Infinity, minimumY = Infinity, maximumY = -Infinity;
    for (const across of [bounds.min.x, bounds.max.x]) for (const height of [bounds.min.y, bounds.max.y]) for (const depth of [bounds.min.z, bounds.max.z]) {
        const projected = new THREE.Vector3(across, height, depth).applyMatrix4(inverse); minimumX = Math.min(minimumX, projected.x); maximumX = Math.max(maximumX, projected.x); minimumY = Math.min(minimumY, projected.y); maximumY = Math.max(maximumY, projected.y);
    }
    const width = viewport.clientWidth, height = Math.max(1, viewport.clientHeight);
    const chrome = document.querySelector('.viewport-chrome');
    let safeHeight = Math.max(80, chrome.clientHeight);
    if (clearDock) safeHeight = Math.max(80, Math.min(safeHeight, document.querySelector('.dock').getBoundingClientRect().top - viewport.getBoundingClientRect().top - 14 - chrome.offsetTop));
    const aspect = width / height;
    const halfHeight = Math.max((maximumY - minimumY) * margin * height / (2 * safeHeight), (maximumX - minimumX) * margin / (aspect * 2));
    return { halfHeight, aspect, shift: (chrome.offsetTop + safeHeight / 2 - height / 2) * 2 / height };
}
function setFrustum({ halfHeight, aspect, shift }) {
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight * (1 + shift); camera.bottom = halfHeight * (shift - 1);
}
function fitBox(bounds, direction, margin = 1.16, clearDock = false) {
    const damping = controls.enableDamping;
    controls.enableDamping = false; controls.update(0); controls.enableDamping = damping;
    const center = bounds.getCenter(new THREE.Vector3());
    controls.target.copy(center); camera.up.set(0, 1, 0); camera.position.copy(center).add(direction); camera.lookAt(center); camera.updateMatrixWorld(true);
    setFrustum(framing(bounds, margin, clearDock));
    camera.zoom = 1; camera.updateProjectionMatrix(); controls.update();
}
// Crew Dragon's approach view follows the capsule: the frame eases to hold Harmony, Dragon and the path still ahead of
// it, so it narrows from the whole transfer down to the docking ring, until someone takes the camera.
let dragonFollow = false;
// Wider than other close-ups: far out, Dragon sits at the frame's edge, by the tool dock.
const dragonMargin = 1.25;
const harmonyBox = new THREE.Box3(), followBox = new THREE.Box3(), followCenter = new THREE.Vector3(), pathPoint = new THREE.Vector3();
function dragonApproachBounds() {
    if (harmonyBox.isEmpty()) harmonyBox.setFromObject(parts.get('harmony').group);
    dragonBounds(followBox).union(harmonyBox);
    for (const point of rendezvous.pathAhead(approach.mission)) followBox.expandByPoint(lvlhToStation(point, pathPoint).add(approach.port));
    return followBox;
}
function followDragon(delta) {
    const bounds = dragonApproachBounds(), goal = framing(bounds, dragonMargin, true), ease = 1 - Math.exp(-3 * delta);
    const current = (camera.top - camera.bottom) / 2;
    const shift = bounds.getCenter(followCenter).sub(controls.target).multiplyScalar(ease);
    controls.target.add(shift); camera.position.add(shift);
    setFrustum({ ...goal, halfHeight: Math.exp(THREE.MathUtils.lerp(Math.log(current), Math.log(goal.halfHeight), ease)) });
    camera.updateProjectionMatrix();
}
controls.addEventListener('start', () => { dragonFollow = false; });
// Orbit view (js/orbit/view.js): the globe with the ISS where it is now, loaded the first time it opens. While it shows,
// its own camera and controls take the canvas; the station keeps running underneath.
let orbitView = null, orbitLoading = null, stationTexts = null;
export const getOrbitView = () => orbitView;
// The real sky (js/orbit/sky.js), shared by the Orbit view and the Earth backdrop; loaded the first time either opens.
let sky = null, skyLoading = null;
export const getSky = () => sky;
const loadSky = () => (skyLoading ||= import('../orbit/sky.js').then(module => (sky = module.createSky())));
function enterOrbit() {
    const configurationName = document.getElementById('configuration-name'), orientation = document.getElementById('orientation-text');
    if (currentView !== 'orbit') stationTexts = [configurationName.textContent, orientation.textContent];
    currentView = 'orbit'; app.dataset.sceneView = 'orbit'; inspectionLight.visible = false; dragonFollow = false;
    controls.enabled = false; controls.autoRotate = false; setPressed('rotate-toggle', false);
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === 'orbit')));
    document.getElementById('view-name').textContent = '06 / LOW EARTH ORBIT';
    configurationName.textContent = 'SGP4 PREDICTION / NOT LIVE TELEMETRY'; orientation.textContent = 'INERTIAL FRAME / NORTH UP';
    orbitLoading ||= Promise.all([import('../orbit/view.js'), loadSky()]).then(([module, loaded]) => (orbitView = module.createOrbitView(loaded)));
    orbitLoading.then(view => { if (currentView === 'orbit') { view.enter(); resize(); } }, error => {
        orbitLoading = null; console.warn('Orbit view unavailable:', error); notify('The orbit view could not load.'); setView('reverse');
    });
}
function leaveOrbit() {
    if (currentView !== 'orbit') return;
    orbitView?.leave(); controls.enabled = true;
    currentView = 'reverse'; app.dataset.sceneView = 'reverse';
    if (stationTexts) [document.getElementById('configuration-name').textContent, document.getElementById('orientation-text').textContent] = stationTexts;
}
export function setView(name) {
    if (name === 'orbit') { enterOrbit(); return; }
    leaveOrbit();
    inspectionLight.visible = false; dragonFollow = false;
    currentView = name; app.dataset.sceneView = name; controls.autoRotate = false; setPressed('rotate-toggle', false);
    for (const entry of parts.values()) entry.group.visible = name === 'interior' ? entry.id === 'columbus' : !modernParts.has(entry.id) || configuration === 'modern';
    applyGhost();
    const bounds = name === 'interior' ? new THREE.Box3().setFromObject(parts.get('columbus').group) : stationBounds;
    fitBox(bounds, cameraDirection(name), name === 'interior' ? 1.25 : 1.16);
    setPressed('interior-focus', name === 'interior');
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
    document.getElementById('view-name').textContent = { overview: '01 / PORT FORWARD', reverse: '02 / STARBOARD FORWARD', zenith: '03 / ZENITH PLAN', forward: '04 / FORWARD ELEVATION', interior: '05 / COLUMBUS LABORATORY' }[name]; render();
}
export function focusPart(id) {
    leaveOrbit();
    if (id === 'columbus') { setView('interior'); return; }
    if (currentView === 'interior') setView('reverse');
    const windowDetail = id === 'destiny' && destinyDetail === 'window', cabinDetail = id === 'dragon' && dragonDetail === 'cabin';
    // A fixed envelope covers the whole shutter sweep so the camera never pumps.
    const bounds = windowDetail ? new THREE.Box3(new THREE.Vector3(-.68, -3.48, 4.15), new THREE.Vector3(1.56, -2.08, 5.55))
        : cabinDetail ? new THREE.Box3(new THREE.Vector3(-2.05, -2.05, -4.3), new THREE.Vector3(2.05, 2.05, .2)).applyMatrix4(dragon.group.matrixWorld)
        : id === 'dragon' ? dragonApproachBounds().clone() : new THREE.Box3().setFromObject(parts.get(id).group);
    if (id === 'dragon' && !cabinDetail) bounds.union(new THREE.Box3().setFromObject(parts.get('harmony').group));
    controls.autoRotate = false; setPressed('rotate-toggle', false);
    const detailDirections = { destiny: [-110, 68, -145], poisk: [-155, 85, -140], rassvet: [-145, -85, -135], prichal: [-140, 20, -180], soyuz: [-160, 120, 160], beam: [-120, 80, 150], bishop: [-155, 100, -140], z1: [-85, 58, -165], s3payloads: [125, 70, -160], p3payloads: [-125, 70, -160], tranquility: [-100, -120, -155], robotics: [-40, 120, 150], thermal: [-155, 80, -100], irosa: [-100, 160, -130] };
    const direction = windowDetail ? new THREE.Vector3(65, -180, -105) : cabinDetail ? new THREE.Vector3(-100, -20, 35) : id === 'dragon' ? new THREE.Vector3(-165, 70, 75) : detailDirections[id] ? new THREE.Vector3(...detailDirections[id]) : cameraDirection('reverse');
    // The selected assembly stays solid; the rest of the station remains as ghosted line art for context.
    for (const entry of parts.values()) entry.group.visible = !modernParts.has(entry.id) || configuration === 'modern';
    applyGhost();
    inspectionLight.visible = windowDetail || cabinDetail || id === 'tranquility';
    currentView = 'detail'; app.dataset.sceneView = 'detail';
    // Far out on its approach Dragon spans hundreds of metres of frame: keep the camera beyond the near clipping plane.
    if (id === 'dragon' && !cabinDetail) direction.setLength(Math.max(direction.length(), bounds.getSize(new THREE.Vector3()).length()));
    fitBox(bounds, direction, windowDetail ? 1.32 : cabinDetail ? 1.12 : id === 'dragon' ? dragonMargin : 1.22, id === 'dragon' && !cabinDetail);
    dragonFollow = id === 'dragon' && !cabinDetail;
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', 'false'));
    document.getElementById('view-name').textContent = windowDetail ? 'DETAIL / DESTINY OBSERVATION WINDOW' : cabinDetail ? 'DETAIL / CREW DRAGON CABIN' : 'DETAIL / ' + parts.get(id).name.toUpperCase(); render();
}
export function restartApproach() {
    if (dragonDetail === 'cabin') { dragonDetail = 'approach'; if (selected === 'dragon') { selectPart('dragon'); focusPart('dragon'); } }
    approach.time = approachStartTime();
    updateApproach(0);
    motion = !reducedMotion.matches;
    setPressed('motion-toggle', motion);
    if (selected === 'dragon' && dragonDetail === 'approach' && currentView === 'detail') focusPart('dragon');
    render();
}
// The cabin is shown docked: the approach jumps to its end before the camera frames the capsule.
function setDragonDetail(mode) {
    dragonDetail = mode;
    if (mode === 'cabin') { approach.time = approach.duration; updateApproach(0); }
    selectPart('dragon'); focusPart('dragon');
}
function setDestinyDetail(mode) {
    destinyDetail = mode; selectPart('destiny'); focusPart('destiny');
}
function updateShutter(delta) {
    if (destinyShutter.progress >= 1) return;
    destinyShutter.progress = Math.min(1, destinyShutter.progress + delta / destinyShutter.duration);
    const t = destinyShutter.progress, eased = t * t * (3 - 2 * t);
    destinyShutter.angle = THREE.MathUtils.lerp(destinyShutter.from, destinyShutter.target, eased);
    destinyShutter.pivot.rotation.z = destinyShutter.angle;
}
function toggleShutter() {
    destinyShutter.from = destinyShutter.angle;
    destinyShutter.target = destinyShutter.target > 0 ? 0 : destinyShutter.openAngle;
    destinyShutter.progress = Math.abs(destinyShutter.target - destinyShutter.angle) < .000001 ? 1 : 0;
    if (reducedMotion.matches) updateShutter(destinyShutter.duration);
    render();
}
function updateShutterControls() {
    const moving = destinyShutter.progress < 1;
    const state = moving ? (motion ? '' : 'Paused · ') + (destinyShutter.target > 0 ? 'Opening' : 'Closing') : destinyShutter.target > 0 ? 'Open' : 'Closed';
    const status = document.getElementById('shutter-state');
    if (status.textContent !== state) status.textContent = state;
    const button = document.getElementById('shutter-toggle'), label = destinyShutter.target > 0 ? 'Close shutter' : 'Open shutter';
    if (button.textContent !== label) button.textContent = label;
}
const rangeLabel = range => (range >= 100 ? range.toFixed(0) : range.toFixed(1)) + ' m';
function updateApproachDistance() {
    if (!approachHud || !approachDistLine || !approachDistBadge) return;
    const dragonPart = parts.get('dragon'), harmonyPart = parts.get('harmony');
    if (!dragonPart || !harmonyPart || currentView === 'interior' || !dragonPart.group.visible) {
        approachHud.style.display = 'none'; approachDistBadge.style.display = 'none'; return;
    }
    const width = viewport.clientWidth, height = viewport.clientHeight;
    if (!width || !height) return;
    approachHud.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    const pPortWorld = harmonyPart.group.localToWorld(approach.port.clone());
    const pDragonWorld = dragonPart.group.localToWorld(approach.nose.clone());
    const vPort = pPortWorld.project(camera), vDragon = pDragonWorld.project(camera);
    if (vPort.z < -1.1 || vPort.z > 1.1 || vDragon.z < -1.1 || vDragon.z > 1.1) {
        approachHud.style.display = 'none'; approachDistBadge.style.display = 'none'; return;
    }
    const x1 = (vPort.x * .5 + .5) * width, y1 = (-vPort.y * .5 + .5) * height;
    let x2 = (vDragon.x * .5 + .5) * width, y2 = (-vDragon.y * .5 + .5) * height;
    // Dragon out of the frame: the line runs from the port to the frame's edge toward it, and the range sits there.
    const chrome = document.querySelector('.viewport-chrome'), inset = 26;
    const dockTop = document.querySelector('.dock').getBoundingClientRect().top - viewport.getBoundingClientRect().top;
    const left = inset, right = width - inset, top = chrome.offsetTop + inset, bottom = Math.min(chrome.offsetTop + chrome.clientHeight - inset, dockTop - 18);
    let clipped = false;
    if (x1 > left && x1 < right && y1 > top && y1 < bottom && (x2 < left || x2 > right || y2 < top || y2 > bottom)) {
        const dx = x2 - x1, dy = y2 - y1;
        const t = Math.min(dx < 0 ? (left - x1) / dx : dx > 0 ? (right - x1) / dx : 1, dy < 0 ? (top - y1) / dy : dy > 0 ? (bottom - y1) / dy : 1);
        x2 = x1 + dx * t; y2 = y1 + dy * t; clipped = true;
    }
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    if (maxX < -60 || minX > width + 60 || maxY < -60 || minY > height + 60) {
        approachHud.style.display = 'none'; approachDistBadge.style.display = 'none'; return;
    }
    approachHud.style.display = ''; approachDistBadge.style.display = '';
    approachDistLine.setAttribute('x1', x1.toFixed(1)); approachDistLine.setAttribute('y1', y1.toFixed(1));
    approachDistLine.setAttribute('x2', x2.toFixed(1)); approachDistLine.setAttribute('y2', y2.toFixed(1));
    approachPortDot.setAttribute('cx', x1.toFixed(1)); approachPortDot.setAttribute('cy', y1.toFixed(1));
    approachDragonDot.setAttribute('cx', x2.toFixed(1)); approachDragonDot.setAttribute('cy', y2.toFixed(1));
    approachDragonDot.style.display = clipped ? 'none' : '';
    const midX = clipped ? x2 : (x1 + x2) * .5, midY = clipped ? y2 : (y1 + y2) * .5;
    const linePixelDist = Math.hypot(x2 - x1, y2 - y1);
    let badgeX = midX, badgeY = midY;
    if (linePixelDist < 52 && !clipped) {
        let nx = -(y2 - y1), ny = (x2 - x1);
        const nLen = Math.hypot(nx, ny);
        if (nLen > 0.001) {
            nx /= nLen; ny /= nLen;
            if (ny > 0 || (Math.abs(ny) < 0.001 && nx < 0)) { nx = -nx; ny = -ny; }
            badgeX = midX + nx * 14; badgeY = midY + ny * 14;
        } else { badgeY = midY - 14; }
    }
    approachDistBadge.style.transform = 'translate(' + badgeX.toFixed(1) + 'px,' + badgeY.toFixed(1) + 'px) translate(-50%,-50%)';
    const rangeText = rangeLabel(approach.range) + (clipped ? ' · DRAGON' : '');
    if (approachDistBadge.textContent !== rangeText) approachDistBadge.textContent = rangeText;
}
// Crew 1's thought follows his head on screen. It shows only while the camera looks into the see-through side of
// Columbus's hull and the crew are large enough to read (about 35 px a metre or more, as in the laboratory's own view).
function updateCrewThought() {
    const element = crewThought.element, columbus = parts.get('columbus'), lab = columbus && columbus.group.userData.lab, person = lab && lab.crew[0];
    let show = !!person && crewThought.level > .01;
    for (let node = person; show && node; node = node.parent) if (!node.visible) show = false;
    if (show) {
        const width = viewport.clientWidth, height = viewport.clientHeight;
        const head = new THREE.Vector3().setFromMatrixPosition(person.userData.bones.Head.matrixWorld);
        const top = head.clone().add(new THREE.Vector3(0, .22, 0)).project(camera), base = head.clone().project(camera);
        const pixelsPerMetre = Math.hypot((top.x - base.x) * width / 2, (top.y - base.y) * height / 2) / .22;
        const toCamera = camera.getWorldDirection(new THREE.Vector3()).negate().applyQuaternion(lab.interior.getWorldQuaternion(new THREE.Quaternion()).invert());
        const angle = Math.atan2(toCamera.y, toCamera.x);
        show = pixelsPerMetre > 35 && Math.abs(top.x) < .95 && Math.abs(top.y) < .92 && top.z < 1 && angle > lab.open.a0 + .2 && angle < lab.open.a1 - .2;
        if (show) {
            element.style.transform = 'translate(' + ((top.x * .5 + .5) * width).toFixed(1) + 'px,' + ((-top.y * .5 + .5) * height).toFixed(1) + 'px)';
            element.style.opacity = crewThought.level.toFixed(2);
        }
    }
    element.hidden = !show;
}
function updateLabels() {
    const width = viewport.clientWidth, height = viewport.clientHeight, occupied = [];
    const chrome = document.querySelector('.viewport-chrome');
    const safeTop = chrome.offsetTop, safeBottom = safeTop + chrome.clientHeight;
    leaders.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    labelLayer.hidden = !labelsEnabled || !!selected || currentView === 'interior'; leaders.style.display = labelLayer.hidden ? 'none' : '';
    if (labelLayer.hidden) return;
    const viewportBounds = viewport.getBoundingClientRect();
    for (const selector of ['.approach-status', '.interior-focus', '.component-picker']) {
        const statusBounds = document.querySelector(selector).getBoundingClientRect();
        occupied.push({ left: statusBounds.left - viewportBounds.left, top: statusBounds.top - viewportBounds.top, right: statusBounds.right - viewportBounds.left, bottom: statusBounds.bottom - viewportBounds.top });
    }
    if (approachDistBadge && approachDistBadge.style.display !== 'none') {
        const badgeBounds = approachDistBadge.getBoundingClientRect();
        occupied.push({ left: badgeBounds.left - viewportBounds.left, top: badgeBounds.top - viewportBounds.top, right: badgeBounds.right - viewportBounds.left, bottom: badgeBounds.bottom - viewportBounds.top });
    }
    for (const label of labels) {
        const mobile = width < 600, eligible = !mobile || ['power', 'kibo', 'zvezda', 'dragon'].includes(label.id);
        const entry = parts.get(label.id);
        const anchor = entry.group.localToWorld(entry.anchor.clone()).project(camera);
        const anchorX = (anchor.x * .5 + .5) * width, anchorY = (-anchor.y * .5 + .5) * height;
        const visible = parts.get(label.id).group.visible && eligible && Math.abs(anchor.x) < .97 && Math.abs(anchor.y) < .95 && anchor.z > -1 && anchor.z < 1;
        label.element.hidden = !visible; label.line.style.display = label.dot.style.display = visible ? '' : 'none';
        if (!visible) continue;
        const labelWidth = label.element.offsetWidth, labelHeight = label.element.offsetHeight;
        const maximumTop = safeBottom - labelHeight - 72, minimumTop = safeTop + 44;
        if (maximumTop < minimumTop) { label.element.hidden = true; label.line.style.display = label.dot.style.display = 'none'; continue; }
        let left = Math.max(16, Math.min(width - labelWidth - 16, anchorX + label.offsetX * (mobile ? .55 : 1)));
        let top = Math.max(minimumTop, Math.min(maximumTop, anchorY + label.offsetY));
        for (let attempt = 0; attempt < 9; attempt++) {
            const collision = occupied.some(box => left < box.right + 10 && left + labelWidth > box.left - 10 && top < box.bottom + 10 && top + labelHeight > box.top - 10);
            if (!collision) break;
            top += attempt % 2 === 0 ? labelHeight + 12 : -(labelHeight + 12) * 2;
            top = Math.max(minimumTop, Math.min(maximumTop, top));
        }
        if (occupied.some(box => left < box.right + 6 && left + labelWidth > box.left - 6 && top < box.bottom + 6 && top + labelHeight > box.top - 6)) { label.element.hidden = true; label.line.style.display = label.dot.style.display = 'none'; continue; }
        occupied.push({ left, top, right: left + labelWidth, bottom: top + labelHeight });
        label.element.style.transform = 'translate(' + left.toFixed(1) + 'px,' + top.toFixed(1) + 'px)';
        const endX = anchorX > left + labelWidth / 2 ? left + labelWidth : left, endY = top + labelHeight - 2;
        label.line.setAttribute('d', 'M ' + anchorX.toFixed(1) + ' ' + anchorY.toFixed(1) + ' L ' + endX.toFixed(1) + ' ' + endY.toFixed(1));
        label.dot.setAttribute('cx', anchorX.toFixed(1)); label.dot.setAttribute('cy', anchorY.toFixed(1));
    }
}
export function render() {
    if (currentView === 'orbit') { if (orbitView) orbitView.render(); return; }
    camera.updateMatrixWorld(true); if (inspectionLight.visible) inspectionLight.position.copy(camera.position); updateApproachDistance(); updateLabels(); updateCrewThought(); updateShutterControls();
    const approachState = approach.time >= approach.duration ? 'DOCKED' : motion ? approachPhase() : 'PAUSED';
    const readout = rangeLabel(approach.range) + ' / ' + approachState;
    updateRendezvousGuide(currentView === 'detail' && selected === 'dragon' && dragonDetail === 'approach');
    const status = document.getElementById('approach-state');
    if (status.textContent !== readout) status.textContent = readout;
    const pixelsPerMetre = camera.zoom * viewport.clientWidth / (camera.right - camera.left);
    const scaleMetres = [.01, .02, .05, .1, .2, .5, 1, 2, 5, 10, 20, 50, 100].find(length => length * pixelsPerMetre >= 55) || 100;
    document.getElementById('scale-line').style.width = (scaleMetres * pixelsPerMetre).toFixed(1) + 'px';
    document.getElementById('scale-label').textContent = scaleMetres + ' m';
    // Earth backdrop: the real sky behind the station first, then the station over it.
    if (orbital && sky && sky.renderBehind(camera, viewport.clientWidth, viewport.clientHeight)) {
        renderer.autoClear = false; renderer.clearDepth(); renderer.render(scene, camera); renderer.autoClear = true;
    } else renderer.render(scene, camera);
}
export function resize() {
    const width = viewport.clientWidth, height = viewport.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    if (currentView === 'orbit') { orbitView?.resize(width, height); render(); return; }
    if (currentView === 'interior') fitBox(new THREE.Box3().setFromObject(parts.get('columbus').group), cameraDirection('interior'), 1.25);
    else if (currentView === 'detail' && selected) focusPart(selected); else if (currentView !== 'detail') fitBox(stationBounds, cameraDirection(currentView));
    render();
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { selectPart(null); setView(button.dataset.view); }));
document.querySelectorAll('.milestone').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.milestone').forEach(item => item.setAttribute('aria-pressed', String(item === button))); selectPart(button.dataset.part); }));
document.getElementById('destiny-supports').addEventListener('click', () => setDestinyDetail('supports'));
document.getElementById('destiny-window').addEventListener('click', () => setDestinyDetail('window'));
document.getElementById('dragon-approach').addEventListener('click', () => setDragonDetail('approach'));
document.getElementById('dragon-cabin').addEventListener('click', () => setDragonDetail('cabin'));
document.getElementById('shutter-toggle').addEventListener('click', toggleShutter);
document.getElementById('close-detail').addEventListener('click', () => selectPart(null));
document.getElementById('focus-detail').addEventListener('click', () => { if (selected) focusPart(selected); });
document.getElementById('dragon-focus').addEventListener('click', () => { selectPart('dragon'); focusPart('dragon'); });
approachDistBadge.addEventListener('click', () => { selectPart('dragon'); focusPart('dragon'); });
document.getElementById('interior-focus').addEventListener('click', () => { selectPart('columbus'); focusPart('columbus'); });
document.getElementById('replay-approach').addEventListener('click', restartApproach);
// Reset returns the scene to its opening state: configuration, camera, selection and every animation.
document.getElementById('reset').addEventListener('click', () => {
    selectPart(null); dragonDetail = 'approach'; destinyDetail = 'supports';
    setConfiguration('modern'); setView('reverse');
    elapsed = 0; z1EVA.restart();
    Object.assign(destinyShutter, { angle: destinyShutter.openAngle, target: destinyShutter.openAngle, from: destinyShutter.openAngle, progress: 1 });
    destinyShutter.pivot.rotation.z = destinyShutter.openAngle;
    restartApproach(); advance(0);
});
for (const [id, multiplier] of [['zoom-in', 1.25], ['zoom-out', .8]]) document.getElementById(id).addEventListener('click', () => { if (currentView === 'orbit') { orbitView?.zoomBy(multiplier); return; } dragonFollow = false; camera.zoom = THREE.MathUtils.clamp(camera.zoom * multiplier, controls.minZoom, controls.maxZoom); camera.updateProjectionMatrix(); render(); });
document.getElementById('labels-toggle').addEventListener('click', () => { labelsEnabled = !labelsEnabled; setPressed('labels-toggle', labelsEnabled); render(); });
document.getElementById('rotate-toggle').addEventListener('click', () => { controls.autoRotate = !controls.autoRotate; setPressed('rotate-toggle', controls.autoRotate); });
document.getElementById('motion-toggle').addEventListener('click', () => { motion = !motion; setPressed('motion-toggle', motion); render(); });
document.getElementById('configuration-toggle').addEventListener('click', () => setConfiguration(configuration === 'reference' ? 'modern' : 'reference'));
document.getElementById('backdrop-toggle').addEventListener('click', () => {
    orbital = !orbital; app.dataset.backdrop = orbital ? 'orbit' : 'space'; setPressed('backdrop-toggle', orbital);
    if (orbital) loadSky().then(loaded => { loaded.update(0); render(); }, error => { console.warn('Earth backdrop unavailable:', error); notify('The Earth backdrop could not load.'); });
    render();
});
document.getElementById('capture').addEventListener('click', () => {
    render(); const canvas = document.createElement('canvas'); canvas.width = renderer.domElement.width; canvas.height = renderer.domElement.height;
    const context = canvas.getContext('2d'); context.fillStyle = getComputedStyle(app).backgroundColor; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(renderer.domElement, 0, 0);
    context.fillStyle = getComputedStyle(app).color; context.font = '500 ' + Math.max(18, canvas.width * .014) + 'px sans-serif'; context.fillText('ISS / INTERNATIONAL SPACE STATION', canvas.width * .03, canvas.height * .94);
    canvas.toBlob(blob => { if (!blob) { notify('Image export is unavailable.'); return; } const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'ISS-' + configuration + '-' + (orbital ? 'orbital' : 'space') + '.png'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); notify('Station image exported.'); }, 'image/png');
});
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
let pointerStart = null;
renderer.domElement.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; controls.autoRotate = false; setPressed('rotate-toggle', false); });
renderer.domElement.addEventListener('pointerup', event => {
    if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
    pointerStart = null;
    // On the globe a click on the ISS goes back to the station.
    if (currentView === 'orbit') { if (orbitView?.hitsStation(event.clientX, event.clientY)) setView('reverse'); return; }
    const bounds = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
    // A solid part under the pointer wins over ghosted ones in front of it; a ghost alone selects its part.
    const hits = raycaster.intersectObjects(station.children.filter(group => group.visible), true).filter(intersection => intersection.object.isMesh);
    const hit = hits.find(intersection => !intersection.object.userData.solidMaterial) || hits[0];
    if (hit) { let object = hit.object; while (object && !object.userData.part) object = object.parent; if (object) selectPart(object.userData.part); } else selectPart(null);
});
window.addEventListener('keydown', event => { if (event.key === 'Escape') selectPart(null); });
reducedMotion.addEventListener('change', event => { if (event.matches) { motion = false; updateShutter(destinyShutter.duration); controls.autoRotate = false; setPressed('motion-toggle', false); setPressed('rotate-toggle', false); } });
new ResizeObserver(resize).observe(viewport);
export function advance(delta) {
    const started = performance.now();
    if (motion) {
        elapsed += delta; updateApproach(delta); updateShutter(delta); z1EVA.update(delta); updateDragonCrew(elapsed); updateColumbusCrew(elapsed);
        for (const wing of wings) { wing.group.rotation.z = wing.base + Math.sin(elapsed * .07) * .035 * wing.direction; if (wing.overlay) wing.overlay.quaternion.copy(wing.group.quaternion); }
        // A small illustrative prime-antenna tracking arc about its azimuth and elevation axes; the spare stays parked.
        for (const dish of trackingDishes) {
            dish.azimuth.rotation.y = dish.baseAzimuth + Math.sin(elapsed * .11) * Math.PI / 30;
            dish.elevation.rotation.x = dish.baseElevation + Math.sin(elapsed * .16) * Math.PI / 60;
        }
    }
    if (dragonFollow && currentView === 'detail' && selected === 'dragon' && dragonDetail === 'approach') followDragon(delta);
    if (currentView === 'orbit' && orbitView) orbitView.update(delta);
    else if (orbital && sky) sky.update(delta);
    updateShadows(delta, motion);
    controls.update(delta); render();
    if (watchFrames(delta, motion)) resize();
    updateStats(delta, performance.now() - started, evaWorkerState);
}
