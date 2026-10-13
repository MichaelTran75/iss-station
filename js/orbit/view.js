// Orbit view: the real sky (js/orbit/sky.js) from outside. Three frames: ISS (the camera rides above and a little behind
// the station, the globe at true scale), Moon (Earth and the Moon side by side) and Sun (Earth on its path round the
// Sun). The camera flies between them; dragging or zooming frees it, and zoom speeds up with distance so the wheel
// reaches the Sun. Time runs live or faster. Loaded the first time the view opens.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { renderer, viewport } from '../core/stage.js';
import { earthRadius } from '../sim/orbit.js';
import { toScene } from './sky.js';

export function createOrbitView(sky) {
    const camera = new THREE.PerspectiveCamera(28, 1, 100, 1e9);
    camera.position.set(0, 14000, 38000);
    const controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enabled: false, enableDamping: true, dampingFactor: .08, enablePan: false, minDistance: earthRadius + 2500, maxDistance: 6e8, rotateSpeed: .45, zoomSpeed: .8 });
    const panel = document.getElementById('orbit-panel'), field = id => document.getElementById(id);

    // Time rate: live, ×60, ×600. Leaving the view returns to live.
    const warpButtons = [...panel.querySelectorAll('[data-warp]')];
    function setWarp(warp) {
        sky.time.warp = warp; if (warp === 1) sky.time.offset = 0;
        for (const button of warpButtons) button.setAttribute('aria-pressed', String(+button.dataset.warp === warp));
        for (const entry of sky.orbiters) entry.trackAt = 0;
    }
    warpButtons.forEach(button => button.addEventListener('click', () => setWarp(+button.dataset.warp)));
    // Frames; null once the camera is taken by hand.
    const frameButtons = [...panel.querySelectorAll('[data-frame]')];
    let frameName = 'iss';
    function setFrame(name) { frameName = name; for (const button of frameButtons) button.setAttribute('aria-pressed', String(button.dataset.frame === name)); }
    frameButtons.forEach(button => button.addEventListener('click', () => setFrame(button.dataset.frame)));
    controls.addEventListener('start', () => setFrame(null));

    // Where the chosen frame wants the camera. ISS: above the station, a little behind it and off to the north of its
    // orbital plane, so the orbit reads as a ring round Earth. Moon and Sun: square to the line from Earth to the body
    // and 40 degrees above the ecliptic, where the Moon's orbit and Earth's lie, so both show as open ellipses; far enough
    // to hold Earth and the body side by side.
    const goalTarget = new THREE.Vector3(), goalPosition = new THREE.Vector3(), direction = new THREE.Vector3(), position = new THREE.Vector3(), velocity = new THREE.Vector3();
    const obliquity = 23.44 * Math.PI / 180, eclipticNorth = new THREE.Vector3(0, Math.cos(obliquity), Math.sin(obliquity));
    const normal = new THREE.Vector3(), offset = new THREE.Vector3(), goalOffset = new THREE.Vector3();
    let fitDistance = 36000, placed = false;
    function frameGoal() {
        if (frameName === 'iss') {
            const state = sky.iss.state;
            if (!state) return false;
            toScene(state.position, position); toScene(state.velocity, velocity);
            direction.copy(position).normalize().addScaledVector(velocity.normalize(), -.22).addScaledVector(normal.crossVectors(position, velocity).normalize(), .3).normalize();
            goalTarget.set(0, 0, 0); goalPosition.copy(direction).multiplyScalar(fitDistance);
            return true;
        }
        const body = frameName === 'moon' ? sky.moon.position : sky.sun.position;
        goalTarget.copy(body).multiplyScalar(.5);
        direction.crossVectors(body, eclipticNorth).normalize().multiplyScalar(Math.cos(.7)).addScaledVector(eclipticNorth, Math.sin(.7));
        const across = Math.tan(camera.fov * Math.PI / 360) * camera.aspect;   // the pair lies across the screen
        goalPosition.copy(goalTarget).addScaledVector(direction, body.length() * .5 * 1.4 / across);
        return true;
    }

    let readoutClock = 0, active = false;
    const pad = value => String(value).padStart(2, '0');
    const utc = date => date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()) + ' ' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds()) + ' UTC';
    const age = ms => ms < 3600000 ? Math.round(ms / 60000) + ' min' : ms < 172800000 ? Math.round(ms / 3600000) + ' h' : Math.round(ms / 86400000) + ' days';
    function updateReadout() {
        const state = sky.iss.state, iss = sky.iss;
        field('orbit-clock').textContent = utc(sky.time.date);
        field('orbit-rate').textContent = sky.time.warp === 1 ? 'LIVE' : '×' + sky.time.warp;
        field('orbit-moon').textContent = Math.round(sky.moon.position.length()).toLocaleString('en-US') + ' km · ' + sky.moonLit() + '% lit';
        if (!state) { field('orbit-source').textContent = iss.object ? 'SGP4 failed for this time' : 'Loading orbital elements…'; return; }
        field('orbit-altitude').textContent = state.height.toFixed(1) + ' km';
        field('orbit-speed').textContent = state.speed.toFixed(2) + ' km/s';
        field('orbit-place').textContent = Math.abs(state.latitude).toFixed(1) + '° ' + (state.latitude >= 0 ? 'N' : 'S') + ' · ' + Math.abs(state.longitude).toFixed(1) + '° ' + (state.longitude >= 0 ? 'E' : 'W');
        field('orbit-period').textContent = iss.object.period.toFixed(2) + ' min';
        field('orbit-inclination').textContent = iss.object.inclination.toFixed(2) + '°';
        field('orbit-light').textContent = state.shadow >= .99 ? 'Earth’s shadow' : state.shadow > .01 ? 'Penumbra' : 'Sunlight';
        field('orbit-source').textContent = 'SGP4 · ' + iss.source + ' · elements ' + age(Date.now() - iss.object.epoch.getTime()) + ' old · Sun and Moon: astronomy-engine';
    }

    function update(delta) {
        sky.update(delta);
        if (frameName && frameGoal()) {
            if (!placed) { controls.target.copy(goalTarget); camera.position.copy(goalPosition); placed = true; }
            // Fly: the target slides, the direction turns, the distance changes on a log scale (Earth to Sun is 5000×).
            const ease = 1 - Math.exp(-2.4 * delta);
            offset.subVectors(camera.position, controls.target); goalOffset.subVectors(goalPosition, goalTarget);
            const length = Math.exp(THREE.MathUtils.lerp(Math.log(offset.length()), Math.log(goalOffset.length()), ease));
            offset.normalize().lerp(goalOffset.normalize(), ease).normalize();
            controls.target.lerp(goalTarget, ease);
            camera.position.copy(controls.target).addScaledVector(offset, length);
        }
        const distance = camera.position.distanceTo(controls.target);
        controls.zoomSpeed = THREE.MathUtils.clamp(.8 + .45 * Math.log10(Math.max(1, distance / 40000)), .8, 3);
        controls.update(delta);
        readoutClock -= delta;
        if (readoutClock <= 0) { updateReadout(); readoutClock = .25; }
    }
    // The globe sits in the open space between the header, the tool dock and (on narrow screens) the readout panel, at the
    // distance where the ISS orbit just fits it.
    function resize(width, height) {
        const chrome = document.querySelector('.viewport-chrome'), top = viewport.getBoundingClientRect().top;
        let upper = chrome.offsetTop + 34, lower = Math.min(chrome.offsetTop + chrome.clientHeight, document.querySelector('.dock').getBoundingClientRect().top - top - 8);
        const box = panel.getBoundingClientRect();
        if (!panel.hidden && box.width > width * .6) lower = Math.min(lower, box.top - top - 6);
        const region = Math.max(120, lower - upper), shift = (upper + lower) / 2 - height / 2, half = Math.tan(camera.fov * Math.PI / 360);
        camera.aspect = width / height; camera.setViewOffset(width, height, 0, -shift, width, height); camera.updateProjectionMatrix();
        fitDistance = 7700 / Math.sin(Math.min(Math.atan(half * region / height), Math.atan(half * width / height)));
        sky.resize(width, height);
    }
    const projected = new THREE.Vector3();
    return {
        camera, controls, setWarp, setFrame,
        get frame() { return frameName; },
        enter() { active = true; controls.enabled = true; panel.hidden = false; setWarp(sky.time.warp); setFrame('iss'); resize(viewport.clientWidth, viewport.clientHeight); },
        leave() { active = false; controls.enabled = false; panel.hidden = true; setWarp(1); sky.hideLabels(); },
        update, resize,
        render() { camera.updateMatrixWorld(); sky.prepare(camera, 'orbit'); if (active) sky.placeLabels(camera, 'orbit'); renderer.render(sky.scene, camera); },
        zoomBy(multiplier) {
            setFrame(null);
            offset.subVectors(camera.position, controls.target);
            offset.setLength(THREE.MathUtils.clamp(offset.length() / multiplier, controls.minDistance, controls.maxDistance));
            camera.position.copy(controls.target).add(offset);
        },
        // True when a click at client coordinates lands on the ISS marker.
        hitsStation(clientX, clientY) {
            const marker = sky.iss.marker;
            if (!marker.visible || sky.iss.element.hidden) return false;
            const bounds = renderer.domElement.getBoundingClientRect();
            projected.copy(marker.position).project(camera);
            return Math.hypot((projected.x * .5 + .5) * bounds.width + bounds.left - clientX, (-projected.y * .5 + .5) * bounds.height + bounds.top - clientY) < 24;
        }
    };
}
