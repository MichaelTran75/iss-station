// Entry point. boot.js loads core/data.js first, so every module below builds synchronously and in this order:
// the order of the imports is the order the scene is assembled in. Then the page starts.
import * as THREE from 'three';
import { app, camera, controls, renderer, scene, station } from './core/stage.js';
import { applyQuality, quality } from './core/quality.js';
import './core/kit.js';
import { modernParts, parts, wings } from './core/station.js';
import './core/cbm.js';
import './core/surfaces.js';
import './core/hull.js';
import './core/pma.js';
import './core/payloads.js';
import './parts/truss.js';
import './parts/power.js';
import './parts/irosa.js';
import './parts/thermal.js';
import './parts/destiny.js';
import './parts/unity.js';
import './parts/harmony.js';
import './parts/kibo.js';
import './parts/columbus.js';
import './parts/tranquility.js';
import './parts/quest.js';
import './parts/leonardo.js';
import './parts/zarya.js';
import './parts/zvezda.js';
import './parts/nauka.js';
import './parts/prichal.js';
import { approach, dragonFlightBounds, updateApproach } from './parts/dragon.js';
import './parts/soyuz.js';
import './parts/robotics.js';
import './parts/beam.js';
import './parts/bishop.js';
import './parts/poisk.js';
import './parts/rassvet.js';
import './parts/z1.js';
import './parts/external-payloads.js';
import './parts/assembly.js';
import { loadZ1Maintenance, z1EVA } from './figures/eva.js';
import { earthTextureState } from './ui/backdrop.js';
import { scheduleLineArt } from './ui/ghost.js';
import './ui/rendezvous-guide.js';
import { adoptEvaFigure, advance, configuration, currentView, focusPart, labels, motion, notify, render, resize,
    restartApproach, selected, selectPart, setConfiguration, setView, stationBounds, getOrbitView } from './ui/controller.js';

const loading = document.getElementById('loading');
window.issAtlas = { z1EVA, scene, station, renderer, camera, controls, parts, wings, labels, stationBounds, modernParts, approach, dragonFlightBounds, updateApproach, restartApproach, setConfiguration, setView, selectPart, focusPart, render, advance, resize, get selected() { return selected; }, get motion() { return motion; }, get configuration() { return configuration; }, get earthTextureState() { return earthTextureState; }, get currentView() { return currentView; }, get orbitView() { return getOrbitView(); } };
applyQuality(quality.tier); setConfiguration('modern');
// Shader programs link in parallel (KHR_parallel_shader_compile) so the page keeps responding while they build.
// At most 1.5 s: a background tab slows the readiness polling to once a second or less, so after that the first
// frame goes ahead and finishes any remaining programs itself.
try { await Promise.race([renderer.compileAsync(scene, camera), new Promise(resolve => setTimeout(resolve, 1500))]); } catch (error) { console.warn('Shader precompile skipped:', error); }
resize(); setView('reverse'); advance(0); scheduleLineArt();
window.lucide?.createIcons();
if (!window.lucide) window.addEventListener('load', () => window.lucide?.createIcons(), { once: true });
loading.style.opacity = '0'; loading.style.pointerEvents = 'none'; setTimeout(() => { loading.hidden = true; }, 400);
app.dataset.ready = 'true';
loadZ1Maintenance(adoptEvaFigure);
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => advance(Math.min(clock.getDelta(), .06)));
document.fonts.ready.then(() => render());
renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); notify('Graphics paused. Reload the page to restore the station.'); });
