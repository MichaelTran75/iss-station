// Launch view: Falcon 9 lifts Crew Dragon off LC-39A and climbs to orbit, as on Demo-2: liftoff, Max-Q, engine
// cutoff, stage separation, second-stage burn and cutoff, Dragon's separation and its nose cone opening; and the
// booster's own flight back: flip, grid fins, entry burn, landing burn, legs, touchdown on the droneship. The flight
// simulation (js/sim/ascent.js) gives both paths and the times; this view draws them
// close up, over the ground round the pad (js/launch/ground.js) and the real sky at the time of the launch
// (js/orbit/sky.js), both at true scale. Two passes: the sky in kilometres from where the camera really is, then the
// pad, the ground and the vehicle in metres in the pad's frame. Loaded the first time the view opens.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { renderer, viewport } from '../core/stage.js';
import { animationAt, animationDuration, boosterState, countdown, droneship, eventAt, events, launchEpoch, launchSite, missionAt, padFrame, paths, vehicleState, warpAt } from '../sim/ascent.js';
import { toScene } from '../orbit/sky.js';
import { createGround, mountHeight } from './ground.js';
import { createVehicle } from './vehicle.js';

const smooth = (value, from, to) => THREE.MathUtils.smoothstep(value, from, to);

export async function createLaunchView(sky) {
    const vehicle = await createVehicle('data/falcon-9.json?v=fa4c1d9cea');
    const scene = new THREE.Scene();
    const environment = new THREE.PMREMGenerator(renderer);
    scene.environment = environment.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .45;
    const sunlight = new THREE.DirectionalLight(0xfff4e6, 3.1), skylight = new THREE.HemisphereLight(0xc4d8f5, 0x5f5646, .7);
    scene.add(sunlight, sunlight.target, skylight);
    // The atmosphere is drawn on its own before the rest (it blends over the sky behind; drawn with the scene's
    // transparent objects it would veil the ground).
    const ground = createGround(), atmosphere = new THREE.Scene(); scene.add(ground.group); atmosphere.add(ground.sky);
    // Booster, second stage and Dragon fly together until each separation.
    const booster = new THREE.Group(), upper = new THREE.Group(), capsule = new THREE.Group();
    booster.add(vehicle.firstStage); upper.add(vehicle.secondStage); capsule.add(vehicle.dragon);
    scene.add(booster, upper, capsule);
    // The droneship where the booster comes down: a 91 × 52 m barge with the landing target painted on its deck.
    const barge = new THREE.Group();
    if (droneship) {
        const deck = document.createElement('canvas'); deck.width = 512; deck.height = 292;
        const g = deck.getContext('2d'); g.fillStyle = '#4b4f53'; g.fillRect(0, 0, 512, 292);
        g.strokeStyle = '#e8e8e2'; g.lineWidth = 9; g.beginPath(); g.arc(256, 146, 108, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 22; g.beginPath(); g.moveTo(196, 86); g.lineTo(316, 206); g.moveTo(316, 86); g.lineTo(196, 206); g.stroke();
        const deckMap = new THREE.CanvasTexture(deck); deckMap.colorSpace = THREE.SRGBColorSpace; deckMap.anisotropy = 8;
        const hull = new THREE.MeshStandardMaterial({ color: 0x3a3e43, roughness: .7, metalness: .3 });
        const top = new THREE.MeshStandardMaterial({ map: deckMap, roughness: .8 });
        barge.add(new THREE.Mesh(new THREE.BoxGeometry(91, 6, 52), [hull, hull, top, hull, hull, hull]));
        barge.children[0].position.y = -3;
        for (const side of [-1, 1]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(91, 3, 1), hull); wall.position.set(0, 1.5, side * 26); barge.add(wall); }
        barge.position.set(...droneship.position);
        barge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...droneship.up));
        scene.add(barge);
    }
    // Both flight paths as dotted lines: bright where the vehicle has been, faint ahead. The dots are laid along the
    // path (one-second points from the simulation, joined straight: over a second the path bends by under a metre) at
    // a spacing that grows with the distance from the camera, so they stay about 1° apart on screen near and far.
    // Earth's bulk hides the stretches beyond the horizon (an invisible sphere a little below the ground writes only
    // depth).
    const dotMap = (() => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32; const g = canvas.getContext('2d');
        g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 12, 0, Math.PI * 2); g.fill(); return new THREE.CanvasTexture(canvas);
    })();
    const maxDots = 3000;
    function trail(list, colour) {
        const geometry = new THREE.BufferGeometry()
            .setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxDots * 3), 3))
            .setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxDots * 4), 4));
        const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, vertexColors: true, map: dotMap, transparent: true, depthWrite: false, alphaTest: .05 }));
        points.frustumCulled = false; points.renderOrder = 2; scene.add(points);
        points.userData = { path: list.map(entry => new THREE.Vector3(...entry.position)), times: list.map(entry => entry.t), colour: new THREE.Color(colour) };
        return points;
    }
    const trails = { rocket: trail(paths.rocket, 0x9fe3ff), booster: trail(paths.booster, 0xffb35c) };
    const dot = new THREE.Vector3();
    function layDots(points, eye) {
        const { path, times, colour } = points.userData, position = points.geometry.attributes.position, colours = points.geometry.attributes.color;
        let count = 0, k = 0, along = 0;   // segment k, fraction along it
        while (k < path.length - 1 && count < maxDots) {
            dot.lerpVectors(path[k], path[k + 1], along);
            const time = times[k] + (times[k + 1] - times[k]) * along;
            position.setXYZ(count, dot.x, dot.y, dot.z);
            colours.setXYZW(count, colour.r, colour.g, colour.b, time <= mission ? 1 : .42);
            count++;
            let step = Math.max(1.5, dot.distanceTo(eye) * .017);
            while (step > 0 && k < path.length - 1) {
                const left = path[k].distanceTo(path[k + 1]) * (1 - along);
                if (step < left) { along += step / path[k].distanceTo(path[k + 1]); step = 0; }
                else { step -= left; k++; along = 0; }
            }
        }
        position.needsUpdate = colours.needsUpdate = true; points.geometry.setDrawRange(0, count);
    }
    function updateTrails() { trails.booster.visible = mission > eventAt('separation'); }
    const occluder = new THREE.Mesh(new THREE.SphereGeometry(6371000 - 3000, 128, 64), new THREE.MeshBasicMaterial({ colorWrite: false }));
    occluder.position.y = -6371000; occluder.renderOrder = -60; scene.add(occluder);

    const camera = new THREE.PerspectiveCamera(40, 1, .3, 5e6);
    const controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enabled: false, enableDamping: true, dampingFactor: .08, enablePan: false, minDistance: 5, maxDistance: 3e6, rotateSpeed: .5 });
    let auto = true;
    controls.addEventListener('start', () => setFollow(false));

    // Time: animation seconds, played with the warp for what the camera follows (the rocket and Dragon, or the
    // booster); the mission clock follows.
    let time = 0, mission = countdown, playing = true, active = false, focus = 'rocket';
    const panel = document.getElementById('launch-panel'), field = id => document.getElementById(id);
    const playButton = field('launch-play'), followButton = field('launch-follow'), stationButton = field('launch-station');
    function setFollow(value) { auto = value; followButton.setAttribute('aria-pressed', String(value)); }
    function setPlaying(value) { playing = value; playButton.textContent = value ? 'Pause' : 'Play'; playButton.setAttribute('aria-pressed', String(!value)); }
    playButton.addEventListener('click', () => { if (time >= animationDuration(focus)) time = 0; setPlaying(!playing); });
    const focusButtons = [...panel.querySelectorAll('[data-focus]')];
    function setFocus(name) {
        focus = name; time = animationAt(mission, focus);
        for (const button of focusButtons) button.setAttribute('aria-pressed', String(button.dataset.focus === name));
    }
    focusButtons.forEach(button => button.addEventListener('click', () => { setFocus(button.dataset.focus); setFollow(true); }));
    field('launch-restart').addEventListener('click', () => { jump(0); setPlaying(true); });
    followButton.addEventListener('click', () => setFollow(true));
    const list = field('launch-events');
    const items = events.map(event => {
        const item = document.createElement('li'), button = document.createElement('button');
        button.type = 'button'; button.innerHTML = '<span>' + clock(event.at) + '</span>' + event.label;
        button.addEventListener('click', () => {
            setFocus(event.booster ? 'booster' : 'rocket'); jump(event.at <= 0 ? 0 : animationAt(event.at - 4, focus)); setFollow(true); setPlaying(true);
        });
        item.append(button); list.append(item); return item;
    });
    function clock(seconds) { const s = Math.abs(seconds < 0 ? Math.floor(seconds) : Math.floor(seconds)); return (seconds < 0 ? 'T−' : 'T+') + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
    let snapCamera = true;
    function jump(to) { time = to; mission = missionAt(time, focus); snapCamera = true; }

    // The pad's frame on the globe (the sky's Earth turns under it with the date).
    const pad = padFrame(), toKm = vector => ({ x: vector[0] / 1000, y: vector[1] / 1000, z: vector[2] / 1000 });
    const padLocal = toScene(toKm(pad.position)), axes = [pad.east, pad.up, pad.south].map(axis => toScene({ x: axis[0], y: axis[1], z: axis[2] }));
    const padWorld = new THREE.Vector3(), frame = new THREE.Quaternion(), frameInverse = new THREE.Quaternion(), basis = new THREE.Matrix4();
    const column = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    function placeFrame() {
        padWorld.copy(padLocal).applyQuaternion(sky.earth.quaternion);
        axes.forEach((axis, k) => column[k].copy(axis).applyQuaternion(sky.earth.quaternion));
        frame.setFromRotationMatrix(basis.makeBasis(column[0], column[1], column[2])); frameInverse.copy(frame).invert();
    }

    // Poses at a mission time: positions from the simulation (the rocket's base raised onto the launch mount, the
    // booster's onto its legs), the long axis along the thrust or, for the falling booster, tail-first into the air.
    const up = new THREE.Vector3(0, 1, 0), localUp = new THREE.Vector3(), direction = new THREE.Vector3();
    function place(group, state, lift = mountHeight) {
        group.position.set(...state.position);
        localUp.set(state.position[0], state.position[1] + 6371000, state.position[2]).normalize();
        group.position.addScaledVector(localUp, lift);
        group.quaternion.setFromUnitVectors(up, direction.set(...state.direction));
    }
    const separation = eventAt('separation'), ignition = eventAt('ses'), landing = eventAt('landing');
    const axis = new THREE.Vector3();
    let state = vehicleState(countdown), boosterNow = state;
    function pose() {
        state = vehicleState(mission);
        place(upper, state);
        axis.set(0, 1, 0).applyQuaternion(upper.quaternion);
        capsule.position.copy(upper.position); capsule.quaternion.copy(upper.quaternion);
        boosterNow = mission < separation ? state : boosterState(mission);
        if (mission < separation) { booster.position.copy(upper.position); booster.quaternion.copy(upper.quaternion); }
        else place(booster, boosterNow, mountHeight - 3.2 * smooth(mission, landing - 60, landing - 20));   // down onto its legs' reach (2.8 m below the engines)
        vehicle.setFins(smooth(mission - separation, 10, 16));
        vehicle.setLegs(smooth(mission, landing - 9, landing - 4));
        // Springs push Dragon off the second stage; it draws away at about 0.4 m/s.
        const dragonSince = mission - eventAt('dragon');
        if (dragonSince > 0) capsule.position.addScaledVector(axis, .4 * dragonSince + .004 * dragonSince * dragonSince);
        vehicle.setNose(smooth(mission, eventAt('nosecone'), eventAt('nosecone') + 6));
        // Engines: the Merlins as the simulation fires them (nine, throttled through Max-Q and for the crew's 3.1 g;
        // three for the entry burn; one, throttled, to land), and the vacuum Merlin.
        const engines = mission < separation ? Math.max(0, state.engines) : boosterNow.engines;
        vehicle.setFirstPlume(engines, boosterNow.altitude, performance.now() / 1000);
        vehicle.setSecondPlume(state.engines < 0, performance.now() / 1000);
        ground.updateSmoke(mission, daylight);
    }

    // Camera: a spot by the pad for liftoff, then alongside the stack, close in on each separation, and on Dragon at
    // the end. It follows until someone drags it; it keeps following the vehicle with their angle after that.
    const target = new THREE.Vector3(), goalTarget = new THREE.Vector3(), goalOffset = new THREE.Vector3(), offset = new THREE.Vector3();
    const side = new THREE.Vector3(), back = new THREE.Vector3(), point = new THREE.Vector3(), lookout = new THREE.Vector3(150, 14, 175);
    function stackPoint(group, height, target) { return target.set(0, height, 0).applyQuaternion(group.quaternion).add(group.position); }
    function goal(kind, goalTarget, goalOffset) {
        if (kind === 'booster' && mission > separation + 1) {
            // The booster: alongside as it falls tail-first, then low by the barge for the landing.
            stackPoint(booster, 24, goalTarget);
            back.set(...boosterNow.direction).negate();   // its tail leads
            side.crossVectors(back, up); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
            const near = smooth(mission, landing - 45, landing - 15);
            goalOffset.copy(side).multiplyScalar(130 - 40 * near).addScaledVector(back, -30 + 20 * near).addScaledVector(up, 25 - 30 * near + 40 * smooth(mission, landing, landing + 8));
            return;
        }
        back.set(0, -1, 0).applyQuaternion(upper.quaternion);
        side.crossVectors(back, up); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
        if (mission < 26) {
            stackPoint(upper, 36, goalTarget);
            goalTarget.lerp(point.set(0, 30, 0), 1 - smooth(mission, 0, 12));   // the pad stays in frame for the first seconds
            goalOffset.copy(lookout).sub(goalTarget);
            // Ease out toward the chase position from 18 s.
            const blend = smooth(mission, 18, 26);
            point.copy(side).multiplyScalar(170).addScaledVector(back, 60).addScaledVector(up, -20);
            goalOffset.lerp(point, blend);
            return;
        }
        if (mission < 145) { stackPoint(upper, 36, goalTarget); goalOffset.copy(side).multiplyScalar(150).addScaledVector(back, 50).addScaledVector(up, 15); return; }
        if (mission < 215) {
            // Between the stages while they part, then on the second stage as the booster drops behind.
            stackPoint(upper, 46, goalTarget);
            if (mission > separation) goalTarget.lerp(stackPoint(booster, 47, point), .5 * (1 - smooth(mission, ignition, ignition + 6)));
            goalOffset.copy(side).multiplyScalar(62).addScaledVector(back, 10 + 40 * smooth(mission, ignition, ignition + 10)).addScaledVector(up, 6);
            return;
        }
        if (mission < 700) { stackPoint(upper, 54, goalTarget); goalOffset.copy(side).multiplyScalar(75).addScaledVector(back, 35).addScaledVector(up, 10); return; }
        stackPoint(capsule, vehicle.secondStageTop + 4, goalTarget);
        goalTarget.lerp(stackPoint(upper, vehicle.secondStageTop, point), .35 * (1 - smooth(mission, eventAt('dragon') + 4, eventAt('dragon') + 24)));
        goalOffset.copy(side).multiplyScalar(30).addScaledVector(back, 6).addScaledVector(up, 5);
    }
    // Corner screen: the other vehicle from separation on (the booster flying home while the main view stays with
    // Dragon, or the reverse), on its own camera that eases like the main one. A click on it swaps the two.
    const inset = { camera: new THREE.PerspectiveCamera(40, 1.6, .3, 5e6), target: new THREE.Vector3(), offset: new THREE.Vector3(), goalOffset: new THREE.Vector3(), snap: true };
    const insetElement = field('launch-inset'), insetText = insetElement.querySelector('span'), insetName = insetElement.querySelector('b');
    const insetKind = () => focus === 'rocket' ? 'booster' : 'rocket';
    const insetShown = () => active && mission > separation + 2 && (focus === 'booster' || mission < landing + 45);
    insetElement.addEventListener('click', () => { setFocus(insetKind()); setFollow(true); snapCamera = inset.snap = true; });
    function followInset(delta) {
        goal(insetKind(), inset.target, inset.goalOffset);
        if (inset.snap) { inset.offset.copy(inset.goalOffset); inset.snap = false; } else inset.offset.lerp(inset.goalOffset, 1 - Math.exp(-2.2 * delta));
        inset.camera.position.copy(inset.target).add(inset.offset); inset.camera.up.set(0, 1, 0); inset.camera.lookAt(inset.target);
    }
    function follow(delta) {
        goal(focus, goalTarget, goalOffset);
        offset.subVectors(camera.position, controls.target);
        if (snapCamera) { offset.copy(goalOffset); snapCamera = false; }
        else if (auto) offset.lerp(goalOffset, 1 - Math.exp(-2.2 * delta));
        controls.target.copy(goalTarget); camera.position.copy(goalTarget).add(offset);
    }

    // Light: the Sun where it was at liftoff time; the ground's imagery dims when it is low.
    const sunLocal = new THREE.Vector3();
    let daylight = 1;
    function light() {
        sunLocal.copy(sky.sun.position).normalize().applyQuaternion(frameInverse);
        daylight = THREE.MathUtils.clamp(.25 + sunLocal.y * 1.6, .15, 1);
        sunlight.intensity = 3.1 * smooth(sunLocal.y, -.08, .05);
        sunlight.position.copy(controls.target).addScaledVector(sunLocal, 2000); sunlight.target.position.copy(controls.target);
        skylight.intensity = .2 + .55 * daylight;
        ground.setDaylight(daylight);
    }

    let readoutClock = 0, lastReached = null;
    const speedText = metres => Math.round(metres * 3.6).toLocaleString('en-US') + ' km/h';
    function readout() {
        field('launch-clock').textContent = clock(mission);
        field('launch-rate').textContent = playing ? '×' + warpAt(mission, focus) : 'PAUSED';
        let current = { label: 'TERMINAL COUNT' };
        for (const event of events) if (mission >= event.at && (!event.booster || focus === 'booster')) current = event;
        field('launch-event').textContent = current.label;
        // The numbers of what the camera follows.
        const shown = focus === 'booster' ? boosterNow : state;
        field('launch-altitude').textContent = shown.altitude < 1000 ? shown.altitude.toFixed(0) + ' m' : (shown.altitude / 1000).toFixed(1) + ' km';
        field('launch-speed').textContent = speedText(shown.speed);
        field('launch-inertial').textContent = speedText(shown.inertial);
        field('launch-downrange').textContent = (shown.downrange / 1000).toFixed(shown.downrange < 1e4 ? 1 : 0) + ' km';
        field('launch-load').textContent = (mission < 0 ? 1 : shown.load).toFixed(2) + ' g';
        field('launch-q').textContent = (shown.q / 1000).toFixed(shown.q < 1e4 ? 1 : 0) + ' kPa';
        items.forEach((item, k) => item.classList.toggle('done', mission >= events[k].at));
        const reached = items.filter(item => item.classList.contains('done')).pop();
        if (reached && reached !== lastReached) { lastReached = reached; list.scrollTop = Math.max(0, reached.offsetTop - list.offsetTop - 40); }
        insetElement.hidden = !insetShown();
        if (!insetElement.hidden) {
            const other = insetKind() === 'booster' ? boosterNow : state, label = insetKind() === 'booster' ? 'BOOSTER' : mission < eventAt('dragon') ? 'SECOND STAGE + DRAGON' : 'DRAGON';
            insetName.textContent = label;
            insetText.textContent = other.landed ? 'ON THE DRONESHIP' : (other.altitude < 1000 ? other.altitude.toFixed(0) + ' m' : (other.altitude / 1000).toFixed(1) + ' km') + ' · ' + speedText(other.speed);
        }
        stationButton.hidden = mission < eventAt('nosecone') + 6;
        const tiles = ground.status.loading;
        field('launch-source').textContent = (tiles ? 'Loading ground imagery (' + tiles + ' tiles)… · ' : '') + 'Simulated flight, fitted to NASA Demo-2 and DM-1 telemetry · model: Stanley Creative, CC BY 4.0 · imagery: USGS, NASA GIBS';
    }

    function update(delta) {
        if (playing) { time = Math.min(animationDuration(focus), time + delta); if (time >= animationDuration(focus)) setPlaying(false); }
        mission = missionAt(time, focus);
        sky.update(0, new Date(launchEpoch + mission * 1000));
        placeFrame(); pose(); light(); follow(delta); updateTrails();
        if (insetShown()) followInset(delta); else inset.snap = true;
        controls.update(delta);
        readoutClock -= delta;
        if (readoutClock <= 0) { readout(); readoutClock = .1; }
    }

    // Draw: the sky from the camera's true place on the globe, then the pad's frame over it; then the corner screen the
    // same way in its own patch of the canvas.
    const skyCamera = new THREE.PerspectiveCamera(40, 1, 1, 1e9);
    function draw(view, target) {
        view.updateMatrixWorld();
        if (view.view?.enabled) skyCamera.setViewOffset(view.view.fullWidth, view.view.fullHeight, view.view.offsetX, view.view.offsetY, view.view.width, view.view.height);
        else skyCamera.clearViewOffset();
        const distance = view.position.distanceTo(target);
        view.near = Math.max(.3, distance * .004); view.far = 5e6; view.updateProjectionMatrix();
        skyCamera.position.copy(view.position).multiplyScalar(.001).applyQuaternion(frame).add(padWorld);
        skyCamera.quaternion.multiplyQuaternions(frame, view.quaternion);
        skyCamera.fov = view.fov; skyCamera.aspect = view.aspect;
        skyCamera.updateMatrixWorld();
        sky.prepare(skyCamera, 'launch');
        const altitude = skyCamera.position.length() - 6371;
        skyCamera.near = Math.max(1, altitude * .3); skyCamera.updateProjectionMatrix();
        renderer.render(sky.scene, skyCamera);
        ground.updateSky(view, altitude * 1000, sunLocal, sunLocal.y);
        ground.sky.scale.setScalar(Math.max(1, view.near * 5 / 1000));
        layDots(trails.rocket, view.position); if (trails.booster.visible) layDots(trails.booster, view.position);
        renderer.autoClear = false; renderer.clearDepth(); renderer.render(atmosphere, view); renderer.render(scene, view); renderer.autoClear = true;
    }
    const canvasBox = { left: 0, top: 0, height: 0 };
    function render() {
        draw(camera, controls.target);
        if (insetElement.hidden) return;
        const box = insetElement.getBoundingClientRect(), page = renderer.domElement.getBoundingClientRect();
        const x = box.left - page.left, y = page.height - (box.top - page.top) - box.height;
        inset.camera.aspect = box.width / box.height;
        renderer.setScissorTest(true); renderer.setScissor(x, y, box.width, box.height); renderer.setViewport(x, y, box.width, box.height);
        renderer.setClearColor(0x000000, 1); renderer.clear();
        draw(inset.camera, inset.target);
        renderer.setClearColor(0x000000, 0); renderer.setScissorTest(false); renderer.setViewport(0, 0, page.width, page.height);
        ground.updateSky(camera, 0, sunLocal, sunLocal.y);
    }
    // The vehicle sits in the open space between the header and the tool dock (on narrow screens, above the panel),
    // and the corner screen just under the view's title.
    function resize(width, height) {
        const chrome = document.querySelector('.viewport-chrome'), top = viewport.getBoundingClientRect().top;
        let lower = Math.min(chrome.offsetTop + chrome.clientHeight, document.querySelector('.dock').getBoundingClientRect().top - top - 8);
        const box = panel.getBoundingClientRect();
        if (!panel.hidden && box.width > width * .6) lower = Math.min(lower, box.top - top - 6);
        const upper = chrome.offsetTop + 34, shift = (upper + lower) / 2 - height / 2;
        camera.aspect = width / height; camera.setViewOffset(width, height, 0, -shift, width, height); camera.updateProjectionMatrix();
        insetElement.style.top = Math.max(64, chrome.offsetTop + 44) + 'px';
        sky.resize(width, height);
    }

    return {
        camera, controls, scene, update, render, resize,
        get mission() { return mission; },
        set onStation(callback) { stationButton.onclick = callback; },
        enter() {
            active = true; controls.enabled = true; panel.hidden = false; sky.hideLabels();
            setFollow(true); snapCamera = true; resize(viewport.clientWidth, viewport.clientHeight);
            if (time >= animationDuration(focus)) jump(0);
            setPlaying(true);
        },
        leave() { active = false; controls.enabled = false; panel.hidden = true; insetElement.hidden = true; setPlaying(false); },
        get active() { return active; },
        zoomBy(multiplier) {
            offset.subVectors(camera.position, controls.target);
            offset.setLength(THREE.MathUtils.clamp(offset.length() / multiplier, controls.minDistance, controls.maxDistance));
            camera.position.copy(controls.target).add(offset); setFollow(false);
        },
        site: launchSite, source: vehicle.source
    };
}
