// Interface: selection and the detail panel, views and camera framing, labels and overlays, the controls,
// and the frame loop (advance).
import * as THREE from 'three';
import { app, camera, controls, hemisphere, inspectionLight, renderer, rim, scene, station, studioLight, sunlight, viewport } from '../core/stage.js';
import { markShadowsDirty, updateShadows, updateStats, watchFrames } from '../core/quality.js';
import { destinyShutter, ghostOpacity, modernParts, parts, referenceParts, shownIn, trackingDishes, wings } from '../core/station.js';
import { crewThought } from '../parts/columbus.js';
import { updateCrew } from '../figures/crew-story.js';
import { crewLine } from '../figures/crew-day.js';
import { afterPaint, cancelViewLoading, noViewLoading, startViewLoading } from './view-loading.js';
import { dragonTransfer, transferPhase, updateDragonTransfer } from '../figures/dragon-transfer.js';
import { approach, approachPhase, approachStartTime, dragon, dragonBounds, dragonFlightBounds, lvlhToStation, rendezvous,
    setDragonShell, updateApproach, updateDragonCrew } from '../parts/dragon.js';
import { evaWorkerState, z1EVA } from '../figures/eva.js';
import { sarjPivots } from '../core/sarj.js';
import { bgaFor, orientSun, sarjFor, startSunTrack, sunTrack, updateSunTrack } from '../orbit/sun-track.js';
import { live, liveFresh, liveHeard, livePose, liveTurn, startLive, stopLive } from '../orbit/live.js';
import { attitude, attitudeName, datedTurn, inStation, setAttitude } from '../orbit/attitude.js';
import '../orbit/theme.js';   // the Orbit view's background switch, set before that view first opens
import { ghostFor } from './ghost.js';
import { updateRendezvousGuide } from './rendezvous-guide.js';
import { setRoboticsLive, updateRobotics } from '../robotics/index.js';
import { refresh as refreshRoboticsTools } from './robotics-tools.js';
import { updateRoboticsMenu } from './robotics-menu.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export let motion = !reducedMotion.matches, labelsEnabled = false, selected = null, currentView = 'reverse', configuration = 'modern', orbital = false, elapsed = 0;
let destinyDetail = 'supports', dragonDetail = 'approach';
const inspector = document.getElementById('inspector');
const componentSelect = document.getElementById('component-select');
for (const entry of parts.values()) {
    const option = document.createElement('option'); option.value = entry.id; option.textContent = entry.name; componentSelect.appendChild(option);
}
// The cargo vehicle's line, locked while the vehicle is away.
const cargoOption = componentSelect.querySelector('option[value="cygnus"]');
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
    irosa: ['NASA · iROSA installation, June 2023', 'https://www.nasa.gov/blogs/spacestation/2023/06/15/nasa-spacewalkers-finish-installing-roll-out-solar-array/'],
    thermal: ['NASA · Thermal systems, p. 203', 'https://www.nasa.gov/wp-content/uploads/2018/04/iss-operating_an_outpost-tagged.pdf'],
    truss: ['NASA · Station systems reference', 'https://www.nasa.gov/wp-content/uploads/2018/04/iss-operating_an_outpost-tagged.pdf'],
    tranquility: ['ESA · Cupola architecture', 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Node-3_Cupola/Cupola'],
    robotics: ['CSA · How Canadarm2 works', 'https://www.asc-csa.gc.ca/eng/iss/canadarm2/about.asp'],
    kibo: ['JAXA · Kibo components', 'https://humans-in-space.jaxa.jp/en/kibo/structure/'],
    aces: ['ESA · ACES finds its home in orbit', 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/ACES_finds_its_home_in_orbit'],
    leonardo: ['NASA · Leonardo relocation', 'https://www.nasa.gov/international-space-station/permanent-multipurpose-module/'],
    harmony: ['NASA · International docking adapter', 'https://www.nasa.gov/missions/station/meet-the-international-docking-adapter/'],
    nauka: ['ESA · European Robotic Arm', 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/International_Space_Station/European_Robotic_Arm']
};
const labelLayer = document.getElementById('labels'), leaders = document.getElementById('leaders');
const approachHud = document.getElementById('approach-hud'), approachDistLine = document.getElementById('approach-dist-line'), approachPortDot = document.getElementById('approach-port-dot'), approachDragonDot = document.getElementById('approach-dragon-dot'), approachDragonRing = document.getElementById('approach-dragon-ring'), approachDistBadge = document.getElementById('approach-distance-badge');
const svgNamespace = 'http://www.w3.org/2000/svg';
const labelSpecs = [['power', '02 / POWER', 'Solar array wings', 65, -58], ['thermal', '04 / THERMAL', 'Heat-rejection radiators', 52, 45], ['kibo', '08 / RESEARCH', 'Kibo laboratory', -133, -25], ['robotics', '19 / ROBOTICS', 'Canadarm2', 58, -44], ['zvezda', '14 / RUSSIAN SEGMENT', 'Zvezda', 60, 38], ['dragon', '17 / CREW', 'Crew Dragon', -100, 40]];
export const labels = labelSpecs.map(([id, code, title, offsetX, offsetY]) => {
    const element = document.createElement('button'); element.className = 'annotation'; element.innerHTML = '<span>' + code + '</span><b>' + title + '</b>'; element.setAttribute('aria-label', parts.get(id).name + ' details'); element.addEventListener('click', () => selectPart(id)); labelLayer.appendChild(element);
    const line = document.createElementNS(svgNamespace, 'path'), dot = document.createElementNS(svgNamespace, 'circle'); dot.setAttribute('r', '2'); leaders.append(line, dot);
    return { id, element, line, dot, offsetX, offsetY };
});
// The way into the Cupola view: a label below the station on screen, straight under the Cupola's nadir window, its
// leader line running vertically down from the window.
const cupolaLabel = (() => {
    const element = document.createElement('button'); element.className = 'annotation cupola-label';
    element.innerHTML = '<span>EARTH VIEW</span><b>Cupola</b>'; element.setAttribute('aria-label', 'Look at Earth from the Cupola');
    element.addEventListener('click', () => { selectPart(null); setView('cupola'); }); labelLayer.appendChild(element);
    const line = document.createElementNS(svgNamespace, 'path'), dot = document.createElementNS(svgNamespace, 'circle'); dot.setAttribute('r', '2.5'); line.classList.add('cupola-leader'); leaders.append(line, dot);
    return { element, line, dot, corner: new THREE.Vector3() };
})();
function setPressed(id, value) { document.getElementById(id).setAttribute('aria-pressed', String(value)); }
setPressed('motion-toggle', motion);
let toastTimer;
export function notify(message) { const toast = document.getElementById('toast'); toast.textContent = message; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 3500); }
// Ghost every visible part except the selection (Dragon keeps Harmony solid, its docking target, until Harmony's hatch
// opens to the arriving crew; the cargo Dragon keeps PMA-3).
let harmonyGhosted = false;
function applyGhost() {
    markShadowsDirty();
    harmonyGhosted = dragonTransfer.harmonyOpen;
    // Some parts are shown with what they work with: Dragon with the node it docks to, Canadarm2 and Dextre together.
    const companions = { 'cargo-dragon': ['pma3'], robotics: ['dextre', 'cygnus'], dextre: ['robotics', 'cygnus'], cygnus: ['robotics', 'dextre'] };
    const solid = selected ? new Set(selected === 'dragon' ? dragonDetail === 'cabin' || harmonyGhosted ? ['dragon'] : ['dragon', 'harmony'] : [selected, ...(companions[selected] || [])]) : null;
    for (const entry of parts.values()) {
        const ghost = solid !== null && !solid.has(entry.id);
        if (!!entry.ghost === ghost) continue;
        entry.ghost = ghost;
        entry.group.traverse(child => {
            if (child.userData.lineArt) { child.visible = ghost; return; }
            if (!child.isMesh || child.userData.puff) return;
            if (ghost) {
                child.userData.solidMaterial = child.material; child.userData.solidShadow = child.castShadow;
                child.material = Array.isArray(child.material) ? child.material.map(m => ghostFor(child, m)) : ghostFor(child, child.material); child.castShadow = false;
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
        child.material = Array.isArray(child.material) ? child.material.map(m => ghostFor(child, m)) : ghostFor(child, child.material); child.castShadow = false;
    });
    if (selected === 'z1') {
        figure.frame.traverse(child => { if (child.isMesh && child.material.emissive) { child.material.emissive.set(0x2e7c66); child.material.emissiveIntensity = .16; } });
        figure.restart();
    }
    markShadowsDirty();
    render();
}
// So does the spacewalker Canadarm2 carries: it is drawn with the arm, and shares its ghost and highlight.
let rider = null;
export function adoptRider(figure) {
    const entry = parts.get('robotics');
    rider = figure; entry.group.add(figure.group);
    figure.group.traverse(child => {
        if (!child.isMesh) return;
        if (entry.ghost) { child.userData.solidMaterial = child.material; child.userData.solidShadow = child.castShadow; child.material = ghostFor(child, child.material); child.castShadow = false; }
        else if (selected === 'robotics' && !child.userData.interior && child.material.emissive) { child.material.emissive.set(0x2e7c66); child.material.emissiveIntensity = .16; }
    });
}
export function selectPart(id) {
    setDragonShell(0);
    if (currentView === 'detail' && (id !== selected || !id)) setView('reverse');
    if (id && id !== 'columbus' && currentView === 'interior') setView('reverse');
    if (id && globeViews.has(currentView)) setView('reverse');
    if (id && modernParts.has(id) && configuration === 'reference') setConfiguration('modern');
    if (id && referenceParts.has(id) && configuration === 'modern') setConfiguration('reference');
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
    document.getElementById('robotics-tools').hidden = id !== 'robotics' && id !== 'dextre';
    refreshRoboticsTools(true);
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
            : cabinDetail ? 'The docked capsule with its hull 90% transparent. Four crew in SpaceX suits recline on the seat pallet under the flight display, with cargo stowed on the floor beneath them. The crew member in the outboard seat raises an arm, turns the hand palm-down and touches the display with the index finger. About 12 s after docking the crew change out of their suits; once both hatches are open they float out through the tunnel one at a time. Below the floor, the service bay holds propellant tanks between radial bulkheads. The suit is measured from the supplied model and seated for this view; the seats, display and bay layout are illustrative.'
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
const stationOnly = new THREE.Box3();   // the station without Dragon's approach: the Cupola's label stands above it
// The station's span across its arrays, for telling how large it is on screen.
let stationSpan = 109;
export function setConfiguration(name) {
    configuration = name; markShadowsDirty();
    for (const entry of parts.values()) entry.group.visible = shownIn(entry.id, name);
    stationBounds.makeEmpty();
    // Dragon may be hundreds of metres out on its approach: the station's frame takes only its last leg. Cygnus is
    // there only while Canadarm2 handles it.
    for (const entry of parts.values()) if (entry.group.visible && entry.id !== 'dragon' && entry.id !== 'cygnus') stationBounds.expandByObject(entry.group);
    const size = stationBounds.getSize(new THREE.Vector3()); stationSpan = Math.max(size.x, size.z);
    stationOnly.copy(stationBounds);
    stationBounds.union(dragonFlightBounds);
    setPressed('configuration-toggle', name === 'modern');
    document.getElementById('configuration-name').textContent = name === 'modern' ? '5 NOVEMBER 2026 / ILLUSTRATIVE CONFIGURATION' : 'CORE ELEMENTS / SIMPLIFIED COMPARISON';
    if (selected && !parts.get(selected).group.visible) selectPart(null);
    if (!globeViews.has(currentView)) setView(currentView === 'detail' ? 'reverse' : currentView);
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
    const from = flightsReady && !cutting && !reducedMotion.matches ? cameraState() : null;
    const center = bounds.getCenter(new THREE.Vector3());
    controls.target.copy(center); camera.up.set(0, 1, 0); camera.position.copy(center).add(direction); camera.lookAt(center); camera.updateMatrixWorld(true);
    setFrustum(framing(bounds, margin, clearDock));
    camera.zoom = 1; camera.updateProjectionMatrix(); controls.update();
    flight = null;
    if (from) startFlight(from, cameraState());
}
// A new framing flies there instead of cutting: target, direction (azimuth and elevation about the vertical, the way
// the orbit controls turn, so a zenith view never rolls at the end), distance and frustum ease together for 0.6–1.6 s.
// Zooming in pans first and narrows after; zooming out widens first. The first frame, resizes and reduced motion cut;
// touching the controls, the zoom buttons or auto-rotate ends a flight where it is.
let flight = null, flightsReady = false, cutting = false;
const flightSpherical = new THREE.Spherical();
function cameraState() {
    const half = (camera.top - camera.bottom) / 2;
    return { target: controls.target.clone(), offset: new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)),
        halfHeight: half / camera.zoom, shift: (camera.top + camera.bottom) / (2 * half) * camera.zoom, aspect: (camera.right - camera.left) / (camera.top - camera.bottom) };
}
function startFlight(from, to) {
    const turn = Math.atan2(Math.sin(to.offset.theta - from.offset.theta), Math.cos(to.offset.theta - from.offset.theta));
    const angle = Math.abs(turn) * Math.sin(Math.max(from.offset.phi, to.offset.phi)) + Math.abs(to.offset.phi - from.offset.phi);
    const scale = Math.abs(Math.log(to.halfHeight / from.halfHeight)), pan = from.target.distanceTo(to.target) / Math.max(from.halfHeight, to.halfHeight);
    const duration = THREE.MathUtils.clamp(.6 + .18 * scale + .25 * Math.min(pan, 2) + .6 * angle / Math.PI, .6, 1.6);
    if (duration <= .6 && scale < .01 && pan < .01 && angle < .01) return;
    flight = { from, to, turn, time: 0, duration, width: viewport.clientWidth, height: viewport.clientHeight };
    poseFlight(0);
}
function poseFlight(s) {
    const { from, to, turn } = flight, smooth = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
    const zoomingIn = to.halfHeight < from.halfHeight;
    const pan = smooth(zoomingIn ? s * 1.35 : s * 1.35 - .35), zoom = smooth(zoomingIn ? s * 1.35 - .35 : s * 1.35), orbit = smooth(s);
    controls.target.lerpVectors(from.target, to.target, pan);
    flightSpherical.set(Math.exp(THREE.MathUtils.lerp(Math.log(from.offset.radius), Math.log(to.offset.radius), orbit)),
        THREE.MathUtils.lerp(from.offset.phi, to.offset.phi, orbit), from.offset.theta + turn * orbit);
    camera.up.set(0, 1, 0); camera.position.setFromSpherical(flightSpherical).add(controls.target); camera.lookAt(controls.target);
    setFrustum({ halfHeight: Math.exp(THREE.MathUtils.lerp(Math.log(from.halfHeight), Math.log(to.halfHeight), zoom)), aspect: to.aspect, shift: THREE.MathUtils.lerp(from.shift, to.shift, zoom) });
    camera.zoom = 1; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}
function updateFlight(delta) {
    flight.time = Math.min(flight.duration, flight.time + Math.max(0, delta));
    poseFlight(flight.time / flight.duration);
    if (flight.time >= flight.duration) flight = null;
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
controls.addEventListener('start', () => { dragonFollow = false; flight = null; });
// Views of the real sky that take the canvas while they show (the station keeps running underneath), each loaded the
// first time it opens:
// - Orbit (js/orbit/view.js): the globe with the ISS where it is now.
// - Launch (js/launch/view.js): Falcon 9 lifting Crew Dragon off LC-39A, close up over the ground round the pad.
const globeViews = new Set(['orbit', 'launch', 'cupola']);
let orbitView = null, launchView = null, cupolaView = null, stationTexts = null;
const globeLoading = {};
export const getOrbitView = () => orbitView;
export const getLaunchView = () => launchView;
export const getCupolaView = () => cupolaView;
const globeView = () => currentView === 'orbit' ? orbitView : currentView === 'launch' ? launchView : currentView === 'cupola' ? cupolaView : null;
// The real sky (js/orbit/sky.js), shared by these views and the Earth backdrop; loaded the first time one opens.
let sky = null, skyLoading = null;
export const getSky = () => sky;
const loadSky = () => (skyLoading ||= import('../orbit/sky.js').then(module => (sky = module.createSky())));
// Real Sun (js/orbit/sun-track.js): at the shown time (the clock, or ahead of it while the Orbit view runs fast) the
// SARJs turn the outboard truss and the BGAs the wings so the cells face the Sun, the TRRJs hold the radiator wings at
// their parked angles, the key light comes from the Sun's direction and fades in Earth's shadow, and the fill dims a
// little with it, all under the attitude flown at the configuration's date (js/orbit/attitude.js). ISS Live
// (js/orbit/live.js) takes the joint angles and the attitude from NASA's telemetry instead. Off, the studio light and
// the schematic pose return. The joints and the attitude glide from one pose to the next (see `glide`).
let realSun = true, liveMode = false, sunClock = 0, litShown = -1, sunFixed = null;
const sunReach = new THREE.Vector3(...studioLight.sun).length(), sunShown = new THREE.Vector3(), sunLine = document.getElementById('sun-state');
// Radiator wings (js/parts/thermal.js): each turns about +z through its TRRJ; a big turn moves their shadows.
const { radiatorBanks, parkedTrrj, trrjClear } = parts.get('thermal').group.userData;
// Joints and attitude as drawn glide to the pose asked for (Real Sun, ISS Live, telemetry carried forward, the
// schematic pose) instead of jumping: switching ISS Live on turns the arrays and radiators to their telemetered angles,
// and the Sun and Earth round to the attitude flown, over about ten seconds. Each follows its goal on a critically
// damped spring. A goal that keeps moving (the arrays tracking the Sun, fast while time runs fast) is followed without
// lag, at the rate between its last two samples, so only a change of source or a jump eases in. SARJs and BGAs turn
// the short way round; a TRRJ stays within the turn its wing has clear. Without motion (Motion off, or reduced motion
// asked for) the pose is set at once.
const glideRate = 2 / 3;   // per second: a large turn is 99% done in about 10 s
const glideJoints = new Map(), turnGoal = datedTurn.slice();
let glideClock = 0, glideSource = '', turnSpeed = 0;
const wrapAngle = angle => angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI));
// One step of a critically damped spring (exact for any step): an offset from the goal and its rate, `dt` later.
function settle(offset, rate, dt) {
    const push = rate + glideRate * offset, decay = Math.exp(-glideRate * dt);
    return [(offset + push * dt) * decay, (rate - glideRate * push * dt) * decay];
}
// A joint: a SARJ ('port', 'starboard': all that side's pivots), a solar wing's BGA or a radiator wing's TRRJ.
function jointOf(key) {
    let joint = glideJoints.get(key);
    if (joint) return joint;
    let read, apply, full = true;
    if (typeof key === 'string') { const pivots = sarjPivots[key]; read = () => pivots[0]?.rotation.x ?? 0; apply = angle => { for (const pivot of pivots) pivot.rotation.x = angle; }; }
    else if (key.isObject3D) { full = false; read = () => key.rotation.z; apply = angle => { key.rotation.z = angle; }; }
    else { read = () => key.group.rotation.z; apply = angle => { key.group.rotation.z = angle; key.overlay?.quaternion.copy(key.group.quaternion); }; }
    const angle = read();
    glideJoints.set(key, joint = { shown: angle, speed: 0, goal: angle, rate: 0, at: glideClock, full, apply });
    return joint;
}
// A new goal for a joint; `jump` marks a change of source, which eases in rather than setting a rate.
function aim(key, angle, jump) {
    const joint = jointOf(key), since = glideClock - joint.at, expected = joint.goal + joint.rate * Math.min(since, 1.5);
    const goal = joint.full ? expected + wrapAngle(angle - expected) : angle, step = goal - joint.goal;
    // Rates above 1.2 rad/s are jumps: the SARJs turn 0.7 rad/s while time runs ×600.
    joint.rate = !jump && since > .05 && Math.abs(step) < 1.2 * since ? step / since : 0;
    joint.goal = goal; joint.at = glideClock;
    if (joint.full && Math.abs(goal) > 8 * Math.PI) { const turns = 2 * Math.PI * Math.round(goal / (2 * Math.PI)); joint.goal -= turns; joint.shown -= turns; }
}
// Each radiator wing takes its TRRJ angle (parked, or telemetered), drawn within the turn this model leaves it clear
// of its neighbours (js/parts/thermal.js); bank.userData.trrj keeps the angle asked for.
function poseJoints(port, starboard, bgaOf, trrj = parkedTrrj, jump = false) {
    aim('port', port, jump); aim('starboard', starboard, jump);
    for (const wing of wings) aim(wing, bgaOf(wing), jump);
    for (const bank of radiatorBanks) {
        const side = bank.userData.side < 0 ? 'port' : 'starboard', wanted = trrj[side] ?? parkedTrrj[side];
        bank.userData.trrj = wanted; aim(bank, Math.min(trrjClear[side][1], Math.max(trrjClear[side][0], wanted)), jump);
    }
}
// The attitude as drawn turns toward the one asked for the shortest way round; true while it moves.
const shownTurn = new THREE.Quaternion(), goalTurn = new THREE.Quaternion(), turnMatrix = new THREE.Matrix4();
const asQuaternion = (turn, target) => target.setFromRotationMatrix(turnMatrix.set(turn[0], turn[1], turn[2], 0, turn[3], turn[4], turn[5], 0, turn[6], turn[7], turn[8], 0, 0, 0, 0, 1));
function aimTurn(turn) { for (let i = 0; i < 9; i++) turnGoal[i] = turn[i]; }
function glideTurn(dt, instant) {
    if (turnGoal.every((value, i) => value === attitude.turn[i])) { turnSpeed = 0; return false; }
    const left = asQuaternion(attitude.turn, shownTurn).angleTo(asQuaternion(turnGoal, goalTurn));
    if (instant || left < 1e-5) { setAttitude(turnGoal); turnSpeed = 0; return true; }
    const [after, rate] = settle(left, -turnSpeed, dt); turnSpeed = -rate;
    shownTurn.slerp(goalTurn, 1 - Math.max(0, after) / left);
    const e = turnMatrix.makeRotationFromQuaternion(shownTurn).elements;
    setAttitude([e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]]);
    return true;
}
// Every frame: each joint and the attitude a step along; the light follows the attitude, the shadows a moving pose.
function glide(delta, instant = !motion) {
    const dt = Math.min(delta, .1);
    let moving = false;
    for (const joint of glideJoints.values()) {
        const goal = joint.goal + joint.rate * Math.min(glideClock - joint.at, 1.5);
        let shown = goal, speed = joint.rate;
        if (!instant) {
            const [offset, offsetRate] = settle(joint.shown - (goal - joint.rate * dt), joint.speed - joint.rate, dt);
            if (Math.abs(offset) > 1e-5 || Math.abs(offsetRate) > 1e-4) { shown = goal + offset; speed += offsetRate; moving ||= Math.abs(offset) > 2e-3; }
        } else moving ||= Math.abs(shown - joint.shown) > .005;
        joint.speed = speed;
        if (shown !== joint.shown) { joint.shown = shown; joint.apply(shown); }
    }
    if (glideTurn(dt, instant) && realSun && sunTrack.state === 'ready') { orientSun(); lightFrom(sunTrack.sun, sunTrack.shadow); moving = true; }
    if (moving) markShadowsDirty();
}
function lightFrom(sun, shadow) {
    const lit = 1 - shadow;
    sunlight.position.set(...sun).multiplyScalar(sunReach); sunlight.intensity = studioLight.intensity * lit;
    hemisphere.intensity = studioLight.hemisphere * (1 - .35 * shadow); rim.intensity = studioLight.rim * (1 - .5 * shadow);
    if (sunShown.distanceTo(sunlight.position) > sunReach * .004 || Math.abs(litShown - lit) > .02) { markShadowsDirty(); sunShown.copy(sunlight.position); litShown = lit; }
}
const degrees = radians => Math.round(radians * 180 / Math.PI);
// The station clock: now, or the time set ahead in the Orbit view, or a date fixed with showSunAt.
const stationDate = () => sunFixed || new Date(Date.now() + (sky ? sky.time.offset : 0));
// The Sun's line ends with the crew's block of the day.
const narrowMeta = matchMedia('(max-width: 760px)'), setSunLine = text => { sunLine.textContent = text + ' / ' + crewLine(narrowMeta.matches); };
function updateSun(delta) {
    if (!realSun || sunTrack.state !== 'ready' || (sunClock -= delta) > 0) return;
    sunClock = .5;
    const date = stationDate();
    if (!updateSunTrack(date)) return;
    const { shadow, change } = sunTrack;
    // Live telemetry stands in for the computed angles and attitude only at the clock's own time: fresh, or carried
    // forward from the last data while the station is out of contact.
    const heard = liveMode && !sunFixed && !(sky && sky.time.offset) && liveHeard(), fresh = heard && liveFresh();
    // A new source (Real Sun, the telemetry, the telemetry carried forward, or the clock moved off now) eases in.
    const source = (heard ? fresh ? 'live' : 'carried' : 'sun') + (sky && sky.time.offset ? ' ahead' : '') + (sunFixed ? ' fixed' : '');
    const jump = source !== glideSource; glideSource = source;
    aimTurn((heard && liveTurn(sunTrack.xvv)) || datedTurn);
    // The light from the Sun under the attitude as drawn; the joints' goals from the Sun under the attitude asked for.
    orientSun();
    const sun = inStation(sunTrack.xvv, turnGoal), name = attitudeName(turnGoal);
    if (heard) {
        const joints = livePose(sun, fresh), tip = bgaFor(sun); poseJoints(joints.port, joints.starboard, wing => joints.bga[wing.channel] ?? tip, joints.trrj, jump);
    } else poseJoints(sarjFor(sun), sarjFor(sun), () => bgaFor(sun), parkedTrrj, jump);
    lightFrom(sunTrack.sun, shadow);
    const light = shadow > .99 ? 'EARTH\'S SHADOW' : shadow > .01 ? 'PENUMBRA' : 'DAYLIGHT';
    const next = change ? ' / ' + (change.sunrise ? 'SUNRISE' : 'SUNSET') + ' IN ' + Math.max(1, Math.round((change.date - date) / 60000)) + ' MIN' : '';
    const beta = ' / BETA ' + degrees(sunTrack.beta) + '°';
    if (!liveMode) { setSunLine('REAL SUN / ' + name + ' / ' + light + next + beta); return; }
    if (fresh) { const v = live.values; setSunLine('ISS LIVE / ' + name + ' / SARJ ' + v.sarjPort.toFixed(1) + '° · ' + v.sarjStarboard.toFixed(1) + '° / ' + light + next + (Number.isFinite(v.beta) ? ' / BETA ' + v.beta.toFixed(1) + '°' : beta)); return; }
    if (heard) { setSunLine('ISS LIVE / NO SIGNAL, LAST DATA ' + Math.max(1, Math.round((Date.now() - live.received) / 60000)) + ' MIN AGO / PREDICTED / ' + name + ' / ' + light + next); return; }
    const why = live.state === 'failed' ? 'UNAVAILABLE' : live.state === 'on' && !live.aos ? 'NO SIGNAL (LOS)' : live.state === 'on' ? 'WAITING FOR DATA' : 'CONNECTING';
    setSunLine('ISS LIVE / ' + why + ' / COMPUTED SUN / ' + name + ' / ' + light + next);
}
function setLive(on) {
    liveMode = on; setPressed('live-toggle', on); sunClock = 0; setRoboticsLive(on);
    if (on) { if (!realSun) setRealSun(true); startLive(); } else { stopLive(); aimTurn(datedTurn); }
}
function setRealSun(on) {
    realSun = on; setPressed('sun-toggle', on); sunClock = 0; sunLine.hidden = !on;
    if (on) { sunLine.textContent = 'REAL SUN / LOADING'; startSunTrack().then(() => { if (sunTrack.state === 'failed' && realSun) sunLine.textContent = 'REAL SUN / UNAVAILABLE OFFLINE'; }); return; }
    if (liveMode) setLive(false);
    glideSource = 'schematic'; poseJoints(0, 0, wing => wing.base, { port: 0, starboard: 0 }, true); sunlight.position.set(...studioLight.sun); sunlight.intensity = studioLight.intensity;
    hemisphere.intensity = studioLight.hemisphere; rim.intensity = studioLight.rim; sunShown.set(0, 0, 0); litShown = -1; markShadowsDirty(); render();
}
const globeTexts = {
    orbit: ['06 / LOW EARTH ORBIT', 'SGP4 PREDICTION / NOT LIVE TELEMETRY', 'INERTIAL FRAME / NORTH UP'],
    launch: ['07 / FALCON 9 LAUNCH', 'DEMO-2 PROFILE / 30 MAY 2020 / LC-39A', 'PAD FRAME / NORTH-EAST TRACK'],
    cupola: ['08 / CUPOLA', 'EARTH BELOW / SGP4 PREDICTION', 'EYE IN THE CUPOLA / NADIR']
};
const globeLoaders = {
    orbit: step => afterPaint().then(() => Promise.all([import('../orbit/view.js'), loadSky()])).then(([module, loaded]) => { step('build'); return (orbitView = module.createOrbitView(loaded)); }),
    cupola: step => afterPaint().then(() => Promise.all([import('../orbit/cupola-view.js?v=eda2d80e58'), loadSky()])).then(([module, loaded]) => { step('build'); return (cupolaView = module.createCupolaView(loaded)); }),
    launch: step => {
        const loading = afterPaint().then(() => Promise.all([import('../launch/view.js'), loadSky()])).then(([module, loaded]) => { step('build'); return module.createLaunchView(loaded, launchResume); }).then(view => {
            view.onStation = toStation; if (globeLoading.launch === loading) launchView = view; return view;
        });
        return loading;
    }
};
// The Launch view is let go when left: its meshes, maps and sound go (js/launch/view.js, dispose()), and the next
// visit builds it again at the moment in the flight where this one left off.
let launchResume = null;
function dropLaunch() {
    const loading = globeLoading.launch;
    if (!loading) return;
    globeLoading.launch = null;
    loading.then(view => { launchResume = view.progress; view.dispose(); if (launchView === view) launchView = null; }, () => {});
}
function enterGlobe(name) {
    const configurationName = document.getElementById('configuration-name'), orientation = document.getElementById('orientation-text');
    if (!globeViews.has(currentView)) stationTexts = [configurationName.textContent, orientation.textContent];
    else if (currentView !== name) { globeView()?.leave(); if (currentView === 'launch') dropLaunch(); }
    currentView = name; app.dataset.sceneView = name; inspectionLight.visible = false; dragonFollow = false;
    // The Launch view draws the station itself for the docking: whole, not ghosted round a selected part.
    if (name === 'launch' && selected) selectPart(null);
    // The Cupola view looks out from inside the station: every part of the configuration, none ghosted.
    if (name === 'cupola') { if (selected) selectPart(null); for (const entry of parts.values()) entry.group.visible = shownIn(entry.id, configuration); applyGhost(); }
    controls.enabled = false; controls.autoRotate = false; setPressed('rotate-toggle', false);
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
    [document.getElementById('view-name').textContent, configurationName.textContent, orientation.textContent] = globeTexts[name];
    // A card with the step and the time taken shows while it loads (js/ui/view-loading.js).
    const job = globeLoading[name] ? noViewLoading : startViewLoading(name), loading = (globeLoading[name] ||= globeLoaders[name](job.step));
    loading.then(view => { if (currentView === name && globeLoading[name] === loading) { view.enter(); resize(); job.entered(); } else job.cancel(); }, error => {
        job.cancel(); globeLoading[name] = null; console.warn(name + ' view unavailable:', error); notify('The ' + name + ' view could not load.'); setView('reverse');
    });
}
function leaveGlobe() {
    if (!globeViews.has(currentView)) return;
    cancelViewLoading();
    globeView()?.leave(); controls.enabled = true;
    if (currentView === 'launch') dropLaunch();
    currentView = 'reverse'; app.dataset.sceneView = 'reverse';
    // Without its Earth backdrop the station shows no sky: the GPU lets go of its maps until something draws it again.
    if (!orbital) sky?.release();
    if (stationTexts) [document.getElementById('configuration-name').textContent, document.getElementById('orientation-text').textContent] = stationTexts;
}
// From the launch, once docked there, to the station view: Dragon at the port, over Earth.
function toStation() {
    setView('reverse');
    if (!orbital) toggleBackdrop();
    approach.time = approach.duration; approach.docked = 0; updateApproach(0); updateDragonTransfer(true); selectPart('dragon'); focusPart('dragon');
}
export function setView(name) {
    if (globeViews.has(name)) { enterGlobe(name); return; }
    leaveGlobe();
    inspectionLight.visible = false; dragonFollow = false;
    currentView = name; app.dataset.sceneView = name; controls.autoRotate = false; setPressed('rotate-toggle', false);
    for (const entry of parts.values()) entry.group.visible = name === 'interior' ? entry.id === 'columbus' : shownIn(entry.id, configuration);
    applyGhost();
    const bounds = name === 'interior' ? new THREE.Box3().setFromObject(parts.get('columbus').group) : stationBounds;
    fitBox(bounds, cameraDirection(name), name === 'interior' ? 1.25 : 1.16);
    setPressed('interior-focus', name === 'interior');
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
    document.getElementById('view-name').textContent = { overview: '01 / PORT FORWARD', reverse: '02 / STARBOARD FORWARD', zenith: '03 / ZENITH PLAN', forward: '04 / FORWARD ELEVATION', interior: '05 / COLUMBUS LABORATORY' }[name]; render();
}
export function focusPart(id) {
    leaveGlobe();
    if (id === 'columbus') { setView('interior'); return; }
    if (currentView === 'interior') setView('reverse');
    const windowDetail = id === 'destiny' && destinyDetail === 'window', cabinDetail = id === 'dragon' && dragonDetail === 'cabin';
    // A fixed envelope covers the whole shutter sweep so the camera never pumps.
    const bounds = windowDetail ? new THREE.Box3(new THREE.Vector3(-.68, -3.48, 4.15), new THREE.Vector3(1.56, -2.08, 5.55))
        : cabinDetail ? new THREE.Box3(new THREE.Vector3(-2.05, -2.05, -4.3), new THREE.Vector3(2.05, 2.05, .2)).applyMatrix4(dragon.group.matrixWorld)
        : id === 'dragon' ? dragonApproachBounds().clone() : new THREE.Box3().setFromObject(parts.get(id).group);
    if (id === 'dragon' && !cabinDetail) bounds.union(new THREE.Box3().setFromObject(parts.get('harmony').group));
    // Canadarm2's frame takes in Dextre, which it may be carrying.
    if (id === 'robotics') bounds.union(new THREE.Box3().setFromObject(parts.get('dextre').group));
    controls.autoRotate = false; setPressed('rotate-toggle', false);
    const detailDirections = { 'soyuz-ms29': [-160, -100, 140], 'progress-aft': [-160, 120, 160], 'progress-poisk': [-160, 120, 100], pma3: [-150, 110, -140], 'cargo-dragon': [-160, 90, -150], dextre: [140, 80, -160], aces: [150, -95, -140], destiny: [-110, 68, -145], poisk: [-155, 85, -140], rassvet: [-145, -85, -135], prichal: [-140, 20, -180], soyuz: [-160, 120, 160], beam: [-120, 80, 150], bishop: [-155, 100, -140], z1: [-85, 58, -165], s3payloads: [125, 70, -160], p3payloads: [-125, 70, -160], tranquility: [-100, -120, -155], robotics: [-40, 120, 150], thermal: [-155, 80, -100], irosa: [-100, 160, -130] };
    const direction = windowDetail ? new THREE.Vector3(65, -180, -105) : cabinDetail ? new THREE.Vector3(-100, -20, 35) : id === 'dragon' ? new THREE.Vector3(-165, 70, 75) : detailDirections[id] ? new THREE.Vector3(...detailDirections[id]) : cameraDirection('reverse');
    // The selected assembly stays solid; the rest of the station remains as ghosted line art for context.
    for (const entry of parts.values()) entry.group.visible = shownIn(entry.id, configuration);
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
    updateApproach(0); updateDragonTransfer(true);
    motion = !reducedMotion.matches;
    setPressed('motion-toggle', motion);
    if (selected === 'dragon' && dragonDetail === 'approach' && currentView === 'detail') focusPart('dragon');
    render();
}
// The cabin is shown docked: the approach jumps to its end before the camera frames the capsule.
function setDragonDetail(mode) {
    dragonDetail = mode;
    if (mode === 'cabin') { approach.time = approach.duration; approach.docked = 0; updateApproach(0); updateDragonTransfer(true); }
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
// `hidden`: the station is too small on screen for the line to mean anything.
function updateApproachDistance(hidden) {
    if (!approachHud || !approachDistLine || !approachDistBadge) return;
    const dragonPart = parts.get('dragon'), harmonyPart = parts.get('harmony');
    if (hidden || !dragonPart || !harmonyPart || currentView === 'interior' || !dragonPart.group.visible) {
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
    if (!Number.isFinite(x1 + y1 + x2 + y2)) { approachHud.style.display = 'none'; approachDistBadge.style.display = 'none'; return; }
    approachHud.style.display = ''; approachDistBadge.style.display = '';
    approachDistLine.setAttribute('x1', x1.toFixed(1)); approachDistLine.setAttribute('y1', y1.toFixed(1));
    approachDistLine.setAttribute('x2', x2.toFixed(1)); approachDistLine.setAttribute('y2', y2.toFixed(1));
    approachPortDot.setAttribute('cx', x1.toFixed(1)); approachPortDot.setAttribute('cy', y1.toFixed(1));
    approachDragonDot.setAttribute('cx', x2.toFixed(1)); approachDragonDot.setAttribute('cy', y2.toFixed(1));
    approachDragonDot.style.display = clipped ? 'none' : '';
    // A ring round Dragon while it is too small to pick out (against Earth, a few pixels of white).
    const dragonPixels = 8.1 * camera.zoom * width / (camera.right - camera.left);
    approachDragonRing.setAttribute('cx', x2.toFixed(1)); approachDragonRing.setAttribute('cy', y2.toFixed(1));
    approachDragonRing.style.display = clipped || dragonPixels > 26 || approach.time >= approach.duration ? 'none' : '';
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
// Columbus's hull and the crew are large enough to make out (20 px a metre or more: the laboratory's own view gives
// them 29 on a phone and 45 on a wide window; at 35, as before, a window under 1,150 px wide never showed it). Near
// the frame's right edge the bubble slides left over its tail, which stays on his head; its width is read as it
// appears.
let crewThoughtWidth = 0;
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
        show = pixelsPerMetre > 20 && Math.abs(top.x) < .95 && Math.abs(top.y) < .92 && top.z < 1 && angle > lab.open.a0 + .2 && angle < lab.open.a1 - .2;
        if (show) {
            const x = (top.x * .5 + .5) * width, bubble = element.lastElementChild;
            if (element.hidden) { element.hidden = false; crewThoughtWidth = bubble.offsetWidth; }
            element.style.transform = 'translate(' + x.toFixed(1) + 'px,' + ((-top.y * .5 + .5) * height).toFixed(1) + 'px)';
            element.style.opacity = crewThought.level.toFixed(2);
            bubble.style.left = Math.min(13, width - 8 - x - crewThoughtWidth).toFixed(1) + 'px';
        }
    }
    element.hidden = !show;
}
function updateLabels(hidden) {
    const width = viewport.clientWidth, height = viewport.clientHeight, occupied = [];
    const chrome = document.querySelector('.viewport-chrome');
    const safeTop = chrome.offsetTop, safeBottom = safeTop + chrome.clientHeight;
    leaders.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    // The Cupola's label stays while the part labels are switched off: it is the way into the Cupola view.
    labelLayer.hidden = hidden || !!selected || currentView === 'interior'; leaders.style.display = labelLayer.hidden ? 'none' : '';
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
    {
        // Cupola: centred under its nadir window, part way down to the station's lower edge on screen, lowered further
        // past the boxes already taken (or, short of room above the dock, raised past them), the line straight down.
        const { element, line, dot, corner } = cupolaLabel, tranquility = parts.get('tranquility'), cupola = tranquility.group.userData.cupola;
        const anchor = tranquility.group.localToWorld(new THREE.Vector3(cupola.center[0], cupola.yTop, cupola.center[1])).project(camera);
        const anchorX = (anchor.x * .5 + .5) * width, anchorY = (-anchor.y * .5 + .5) * height;
        let visible = tranquility.group.visible && Math.abs(anchor.x) < .97 && Math.abs(anchor.y) < .95 && anchor.z > -1 && anchor.z < 1;
        if (visible) {
            const labelWidth = element.offsetWidth || 70, labelHeight = element.offsetHeight || 34;
            const maximumTop = Math.min(safeBottom, document.querySelector('.dock').getBoundingClientRect().top - viewportBounds.top) - labelHeight - 10;
            const left = Math.max(16, Math.min(width - labelWidth - 16, anchorX - labelWidth / 2));
            let stationBottom = anchorY + 60;
            for (let k = 0; k < 8 && !stationOnly.isEmpty(); k++) {
                corner.set(k & 1 ? stationOnly.max.x : stationOnly.min.x, k & 2 ? stationOnly.max.y : stationOnly.min.y, k & 4 ? stationOnly.max.z : stationOnly.min.z).project(camera);
                if (corner.z < 1) stationBottom = Math.max(stationBottom, (-corner.y * .5 + .5) * height);
            }
            let top = anchorY + (stationBottom + 14 - anchorY) * .4;   // the leader 40 % of the way to the station's lower edge
            const hits = () => occupied.some(box => left < box.right + 8 && left + labelWidth > box.left - 8 && top < box.bottom + 8 && top + labelHeight > box.top - 8);
            for (let attempt = 0; attempt < 8 && hits() && top + labelHeight + 10 <= maximumTop; attempt++) top += labelHeight + 10;
            top = Math.min(maximumTop, top);
            // No room below (a phone, the dock, Dragon's badge): up over the station, the chip's own ground keeping it legible.
            while (hits() && top > anchorY + 24) top -= 8;
            visible = top > anchorY + 12 && !hits();
            if (visible) {
                occupied.push({ left, top, right: left + labelWidth, bottom: top + labelHeight });
                element.style.transform = 'translate(' + left.toFixed(1) + 'px,' + top.toFixed(1) + 'px)';
                const x = Math.max(left + 4, Math.min(left + labelWidth - 4, anchorX));
                line.setAttribute('d', 'M ' + x.toFixed(1) + ' ' + anchorY.toFixed(1) + ' L ' + x.toFixed(1) + ' ' + top.toFixed(1));
                dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', anchorY.toFixed(1));
            }
        }
        element.hidden = !visible; line.style.display = dot.style.display = visible ? '' : 'none';
    }
    for (const label of labels) {
        const mobile = width < 600, eligible = !mobile || ['power', 'kibo', 'zvezda', 'dragon'].includes(label.id);
        const entry = parts.get(label.id);
        const anchor = entry.group.localToWorld(entry.anchor.clone()).project(camera);
        const anchorX = (anchor.x * .5 + .5) * width, anchorY = (-anchor.y * .5 + .5) * height;
        const visible = labelsEnabled && entry.group.visible && !entry.absent && eligible && Math.abs(anchor.x) < .97 && Math.abs(anchor.y) < .95 && anchor.z > -1 && anchor.z < 1;
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
// Scale-bar lengths in metres: 1, 2 and 5 times each power of ten from a centimetre to a million kilometres.
const scaleSteps = Array.from({ length: 33 }, (_, k) => [1, 2, 5][k % 3] * 10 ** (Math.floor(k / 3) - 2));
const scaleText = metres => metres >= 1000 ? (metres / 1000).toLocaleString('en-US') + ' km' : +metres.toPrecision(1) + ' m';
export function render() {
    if (globeViews.has(currentView)) { updateRoboticsMenu(false); globeView()?.render(); return; }
    camera.updateMatrixWorld(true); if (inspectionLight.visible) inspectionLight.position.copy(camera.position);
    // Zoomed far out over Earth the station is a few pixels or less: its overlays stand down, and below 14 pixels the
    // backdrop's ISS marker shows where it is.
    const pixelsPerMetre = camera.zoom * viewport.clientWidth / (camera.right - camera.left), stationPixels = stationSpan * pixelsPerMetre;
    updateApproachDistance(stationPixels < 40); updateLabels(stationPixels < 40); updateCrewThought(); updateShutterControls();
    // Canadarm2's operations beside the arm, while it, Dextre or the cargo vehicle is selected (a vehicle that has
    // left hands the selection to the arm).
    const cargoAway = !!parts.get('cygnus').absent;
    if (cargoOption.disabled !== cargoAway) cargoOption.disabled = cargoAway;
    if (selected === 'cygnus' && cargoAway) selectPart('robotics');
    updateRoboticsMenu((selected === 'robotics' || selected === 'dextre' || selected === 'cygnus') && currentView !== 'interior' && stationPixels >= 40);
    const approachState = approach.time >= approach.duration ? transferPhase() : motion ? approachPhase() : 'PAUSED';
    const readout = rangeLabel(approach.range) + ' / ' + approachState;
    updateRendezvousGuide(currentView === 'detail' && selected === 'dragon' && dragonDetail === 'approach');
    const status = document.getElementById('approach-state');
    if (status.textContent !== readout) status.textContent = readout;
    const scaleMetres = scaleSteps.find(length => length * pixelsPerMetre >= 55) || scaleSteps[scaleSteps.length - 1];
    document.getElementById('scale-line').style.width = (scaleMetres * pixelsPerMetre).toFixed(1) + 'px';
    document.getElementById('scale-label').textContent = scaleText(scaleMetres);
    // Earth backdrop: the real sky behind the station first, at true scale, then the station over it.
    if (orbital && sky && sky.renderBehind(camera, controls.target, viewport.clientWidth, viewport.clientHeight, stationPixels < 14)) {
        renderer.autoClear = false; renderer.clearDepth(); renderer.render(scene, camera); renderer.autoClear = true;
    } else renderer.render(scene, camera);
}
export function resize() {
    const width = viewport.clientWidth, height = viewport.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    if (globeViews.has(currentView)) { globeView()?.resize(width, height); render(); return; }
    // A new pixel ratio alone keeps a flight going; a new viewport size cuts to the framing for it.
    if (flight && flight.width === width && flight.height === height) { render(); return; }
    cutting = true;
    try {
        if (currentView === 'interior') fitBox(new THREE.Box3().setFromObject(parts.get('columbus').group), cameraDirection('interior'), 1.25);
        else if (currentView === 'detail' && selected) focusPart(selected); else if (currentView !== 'detail') fitBox(stationBounds, cameraDirection(currentView));
    } finally { cutting = false; }
    render();
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { selectPart(null); setView(button.dataset.view); }));
document.querySelectorAll('.milestone').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.milestone').forEach(item => item.setAttribute('aria-pressed', String(item === button))); selectPart(button.dataset.part); }));
document.getElementById('destiny-supports').addEventListener('click', () => setDestinyDetail('supports'));
document.getElementById('destiny-window').addEventListener('click', () => setDestinyDetail('window'));
document.getElementById('dragon-approach').addEventListener('click', () => setDragonDetail('approach'));
document.getElementById('dragon-cabin').addEventListener('click', () => setDragonDetail('cabin'));
document.getElementById('dragon-launch').addEventListener('click', () => { selectPart(null); setView('launch'); });
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
// Over Earth, below the station's usual range, each press zooms four steps at once: from the station to the whole
// Earth and Moon is seven orders of magnitude.
const zoomSteps = () => orbital && camera.zoom < .45 ? 4 : 1;
for (const [id, multiplier] of [['zoom-in', 1.25], ['zoom-out', .8]]) document.getElementById(id).addEventListener('click', () => { if (globeViews.has(currentView)) { globeView()?.zoomBy(multiplier); return; } dragonFollow = false; flight = null; camera.zoom = THREE.MathUtils.clamp(camera.zoom * multiplier ** zoomSteps(), controls.minZoom, controls.maxZoom); camera.updateProjectionMatrix(); render(); });
document.getElementById('labels-toggle').addEventListener('click', () => { labelsEnabled = !labelsEnabled; setPressed('labels-toggle', labelsEnabled); render(); });
document.getElementById('rotate-toggle').addEventListener('click', () => { flight = null; controls.autoRotate = !controls.autoRotate; setPressed('rotate-toggle', controls.autoRotate); });
document.getElementById('motion-toggle').addEventListener('click', () => { motion = !motion; setPressed('motion-toggle', motion); render(); });
document.getElementById('configuration-toggle').addEventListener('click', () => setConfiguration(configuration === 'reference' ? 'modern' : 'reference'));
function toggleBackdrop() {
    orbital = !orbital; app.dataset.backdrop = orbital ? 'orbit' : 'space'; setPressed('backdrop-toggle', orbital);
    // With Earth behind it the station zooms out at true scale until Earth and the Moon's orbit fit the view (the frame
    // a million kilometres high); the station is a dot long before that.
    controls.minZoom = orbital ? 1e-7 : .45;
    if (camera.zoom < controls.minZoom) { camera.zoom = controls.minZoom; camera.updateProjectionMatrix(); }
    if (orbital) loadSky().then(loaded => { loaded.update(0); render(); }, error => { console.warn('Earth backdrop unavailable:', error); notify('The Earth backdrop could not load.'); });
    else { sky?.hideLabels(); if (!globeViews.has(currentView)) sky?.release(); }
    render();
}
document.getElementById('backdrop-toggle').addEventListener('click', toggleBackdrop);
document.getElementById('sun-toggle').addEventListener('click', () => setRealSun(!realSun));
document.getElementById('live-toggle').addEventListener('click', () => setLive(!liveMode));
// The real Sun starts once the station is on screen (js/main.js), so its libraries and elements load after the page.
export const startRealSun = () => setRealSun(realSun);
// Holds the real Sun at a date (null: the clock again); for checking poses at chosen times.
export { setLive };
export function showSunAt(date) { sunFixed = date; sunClock = 0; updateSun(0); glide(0, true); renderer.shadowMap.needsUpdate = true; render(); return { ...sunTrack }; }
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
    if (currentView === 'launch' || currentView === 'cupola') return;
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
    glideClock += delta;
    if (motion) {
        elapsed += delta; updateApproach(delta); updateShutter(delta); z1EVA.update(delta); updateDragonCrew(elapsed); updateDragonTransfer();
        if (selected === 'dragon' && dragonTransfer.harmonyOpen !== harmonyGhosted) applyGhost();
        if (!realSun || sunTrack.state !== 'ready') for (const wing of wings) aim(wing, wing.base + Math.sin(elapsed * .07) * .035 * wing.direction, false);
        // A small illustrative prime-antenna tracking arc about its azimuth and elevation axes; the spare stays parked.
        for (const dish of trackingDishes) {
            dish.azimuth.rotation.y = dish.baseAzimuth + Math.sin(elapsed * .11) * Math.PI / 30;
            dish.elevation.rotation.x = dish.baseElevation + Math.sin(elapsed * .16) * Math.PI / 60;
        }
    }
    // The crew: their story from the page opening (js/figures/crew-story.js), then their day by the station clock; posed
    // only with motion.
    updateCrew(elapsed, stationDate(), motion);
    updateSun(delta); glide(delta);
    // Canadarm2, the base and Dextre (js/robotics/): parked, live or a sequence. With motion the shadows refresh on their
    // own schedule; a jump needs them redrawn.
    const armMoved = updateRobotics(delta, motion), riderMoved = !!rider && rider.update(delta, motion);
    if ((armMoved || riderMoved) && !motion) markShadowsDirty();
    refreshRoboticsTools(false, delta);
    if (flight && !globeViews.has(currentView)) updateFlight(delta);
    else if (dragonFollow && currentView === 'detail' && selected === 'dragon' && dragonDetail === 'approach') followDragon(delta);
    if (globeViews.has(currentView)) globeView()?.update(delta);
    else if (orbital && sky) sky.update(delta);
    // The wheel speeds up below the station's usual range, so the reach out to the Moon takes a few dozen notches.
    controls.zoomSpeed = orbital && camera.zoom < .45 ? THREE.MathUtils.clamp(1 + 4 * Math.log10(.45 / camera.zoom), 1, 9) : 1;
    updateShadows(delta, motion);
    controls.update(delta); render();
    if (watchFrames(delta, motion)) resize();
    updateStats(delta, performance.now() - started, evaWorkerState);
    flightsReady = true;
}
