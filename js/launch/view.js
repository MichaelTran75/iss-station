// Launch view: Falcon 9 lifts Crew Dragon off LC-39A and climbs to orbit, as on Demo-2: liftoff, Max-Q, engine
// cutoff, stage separation (the booster flips and opens its grid fins), second-stage burn and cutoff, Dragon's
// separation and its nose cone opening. The model (js/sim/ascent.js) gives the path and the times; this view draws it
// close up, over the ground round the pad (js/launch/ground.js) and the real sky at the time of the launch
// (js/orbit/sky.js), both at true scale. Two passes: the sky in kilometres from where the camera really is, then the
// pad, the ground and the vehicle in metres in the pad's frame. Loaded the first time the view opens.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { renderer, viewport } from '../core/stage.js';
import { animationAt, animationDuration, countdown, eventAt, events, launchEpoch, launchSite, missionAt, padFrame, vehicleState, warpAt } from '../sim/ascent.js';
import { toScene } from '../orbit/sky.js';
import { createGround, mountHeight } from './ground.js';
import { createVehicle } from './vehicle.js';

const smooth = (value, from, to) => THREE.MathUtils.smoothstep(value, from, to);

export async function createLaunchView(sky) {
    const vehicle = await createVehicle('data/falcon-9.json?v=c3aff529d7');
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

    const camera = new THREE.PerspectiveCamera(40, 1, .3, 5e6);
    const controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enabled: false, enableDamping: true, dampingFactor: .08, enablePan: false, minDistance: 5, maxDistance: 3e6, rotateSpeed: .5 });
    let auto = true;
    controls.addEventListener('start', () => setFollow(false));

    // Time: animation seconds, played with the model's warp; the mission clock follows.
    let time = 0, mission = countdown, playing = true, active = false;
    const panel = document.getElementById('launch-panel'), field = id => document.getElementById(id);
    const playButton = field('launch-play'), followButton = field('launch-follow'), stationButton = field('launch-station');
    function setFollow(value) { auto = value; followButton.setAttribute('aria-pressed', String(value)); }
    function setPlaying(value) { playing = value; playButton.textContent = value ? 'Pause' : 'Play'; playButton.setAttribute('aria-pressed', String(!value)); }
    playButton.addEventListener('click', () => { if (time >= animationDuration) time = 0; setPlaying(!playing); });
    field('launch-restart').addEventListener('click', () => { jump(0); setPlaying(true); });
    followButton.addEventListener('click', () => setFollow(true));
    const list = field('launch-events');
    const items = events.map(event => {
        const item = document.createElement('li'), button = document.createElement('button');
        button.type = 'button'; button.innerHTML = '<span>' + clock(event.at) + '</span>' + event.label;
        button.addEventListener('click', () => { jump(event.at <= 0 ? 0 : animationAt(event.at - 4)); setFollow(true); setPlaying(true); });
        item.append(button); list.append(item); return item;
    });
    function clock(seconds) { const s = Math.abs(seconds < 0 ? Math.floor(seconds) : Math.floor(seconds)); return (seconds < 0 ? 'T−' : 'T+') + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
    let snapCamera = true;
    function jump(to) { time = to; mission = missionAt(time); snapCamera = true; }

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

    // Vehicle poses at a mission time.
    const up = new THREE.Vector3(0, 1, 0), turn = new THREE.Quaternion(), flip = new THREE.Quaternion(), xAxis = new THREE.Vector3(1, 0, 0);
    const stackPose = (at, position, quaternion) => {
        const state = vehicleState(at);
        position.set(...state.position).y += mountHeight;
        quaternion.setFromUnitVectors(up, new THREE.Vector3(...state.direction));
        return state;
    };
    // The booster coasts on from separation (pneumatic pushers part the stages at about 1 m/s), flips tail-first on its
    // nitrogen thrusters and opens its grid fins; it falls out of the picture long before its entry burn. Both stages
    // fall alike, so the booster is placed by its motion relative to the second stage: the push, then the second stage
    // drawing ahead on its vacuum engine at about 8.5 m/s².
    const separation = eventAt('separation'), ignition = eventAt('ses');
    const separationPose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
    stackPose(separation, separationPose.position, separationPose.quaternion);
    const axis = new THREE.Vector3(), state = { altitude: 0, downrange: 0, speed: 0 };
    function pose() {
        Object.assign(state, stackPose(mission, upper.position, upper.quaternion));
        axis.set(0, 1, 0).applyQuaternion(upper.quaternion);
        capsule.position.copy(upper.position); capsule.quaternion.copy(upper.quaternion);
        if (mission < separation) { booster.position.copy(upper.position); booster.quaternion.copy(upper.quaternion); vehicle.setFins(0); }
        else {
            const since = mission - separation, burning = Math.max(0, mission - ignition);
            booster.position.copy(upper.position).addScaledVector(axis.set(0, 1, 0).applyQuaternion(separationPose.quaternion), -(1.1 * since + 4.25 * burning * burning));
            booster.quaternion.copy(separationPose.quaternion).multiply(flip.setFromAxisAngle(xAxis, Math.PI * smooth(since, 4, 40)));
            vehicle.setFins(smooth(since, 10, 16));
            axis.set(0, 1, 0).applyQuaternion(upper.quaternion);
        }
        booster.visible = mission < 330;
        // Springs push Dragon off the second stage; it draws away at about 0.4 m/s.
        const dragonSince = mission - eventAt('dragon');
        if (dragonSince > 0) capsule.position.addScaledVector(axis, .4 * dragonSince + .004 * dragonSince * dragonSince);
        vehicle.setNose(smooth(mission, eventAt('nosecone'), eventAt('nosecone') + 6));
        // Engines: nine Merlins to cutoff (throttled back through Max-Q), then the vacuum Merlin to its cutoff.
        const thrust = mission < eventAt('ignition') || mission >= eventAt('meco') ? 0 : mission < 0 ? .6 + .4 * smooth(mission, -3, -.5) : mission > 40 && mission < 68 ? .78 : 1;
        vehicle.setFirstPlume(thrust, state.altitude, performance.now() / 1000);
        vehicle.setSecondPlume(mission >= eventAt('ses') && mission < eventAt('seco'), performance.now() / 1000);
        ground.updateSmoke(mission, daylight);
    }

    // Camera: a spot by the pad for liftoff, then alongside the stack, close in on each separation, and on Dragon at
    // the end. It follows until someone drags it; it keeps following the vehicle with their angle after that.
    const target = new THREE.Vector3(), goalTarget = new THREE.Vector3(), goalOffset = new THREE.Vector3(), offset = new THREE.Vector3();
    const side = new THREE.Vector3(), back = new THREE.Vector3(), point = new THREE.Vector3(), lookout = new THREE.Vector3(150, 14, 175);
    function stackPoint(group, height, target) { return target.set(0, height, 0).applyQuaternion(group.quaternion).add(group.position); }
    function goal() {
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
    function follow(delta) {
        goal();
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

    let readoutClock = 0;
    function readout() {
        field('launch-clock').textContent = clock(mission);
        field('launch-rate').textContent = playing ? '×' + warpAt(mission) : 'PAUSED';
        let current = { label: 'TERMINAL COUNT' };
        for (const event of events) if (mission >= event.at) current = event;
        field('launch-event').textContent = current.label;
        field('launch-altitude').textContent = state.altitude < 1000 ? state.altitude.toFixed(0) + ' m' : (state.altitude / 1000).toFixed(1) + ' km';
        field('launch-speed').textContent = Math.round(state.speed * 3.6).toLocaleString('en-US') + ' km/h';
        field('launch-downrange').textContent = (state.downrange / 1000).toFixed(state.downrange < 1e4 ? 1 : 0) + ' km';
        field('launch-stage').textContent = mission < separation ? 'Falcon 9 + Dragon' : mission < eventAt('dragon') ? 'Second stage + Dragon' : 'Dragon';
        items.forEach((item, k) => item.classList.toggle('done', mission >= events[k].at));
        stationButton.hidden = mission < eventAt('nosecone') + 6;
        const tiles = ground.status.loading;
        field('launch-source').textContent = (tiles ? 'Loading ground imagery (' + tiles + ' tiles)… · ' : '') + 'Times: NASA (Demo-2) · altitude, speed: DM-1 telemetry · model: Stanley Creative, CC BY 4.0 · imagery: USGS, NASA GIBS';
    }

    function update(delta) {
        if (playing) { time = Math.min(animationDuration, time + delta); if (time >= animationDuration) setPlaying(false); }
        mission = missionAt(time);
        sky.update(0, new Date(launchEpoch + mission * 1000));
        placeFrame(); pose(); light(); follow(delta);
        controls.update(delta);
        readoutClock -= delta;
        if (readoutClock <= 0) { readout(); readoutClock = .1; }
    }

    // Draw: the sky from the camera's true place on the globe, then the pad's frame over it.
    const skyCamera = new THREE.PerspectiveCamera(40, 1, 1, 1e9);
    function render() {
        camera.updateMatrixWorld();
        const distance = camera.position.distanceTo(controls.target);
        camera.near = Math.max(.3, distance * .004); camera.far = 5e6; camera.updateProjectionMatrix();
        skyCamera.position.copy(camera.position).multiplyScalar(.001).applyQuaternion(frame).add(padWorld);
        skyCamera.quaternion.multiplyQuaternions(frame, camera.quaternion);
        skyCamera.fov = camera.fov; skyCamera.aspect = camera.aspect;
        skyCamera.updateMatrixWorld();
        sky.prepare(skyCamera, 'launch');
        const altitude = skyCamera.position.length() - 6371;
        skyCamera.near = Math.max(1, altitude * .3); skyCamera.updateProjectionMatrix();
        renderer.render(sky.scene, skyCamera);
        ground.updateSky(camera, altitude * 1000, sunLocal, sunLocal.y);
        ground.sky.scale.setScalar(Math.max(1, camera.near * 5 / 1000));
        renderer.autoClear = false; renderer.clearDepth(); renderer.render(atmosphere, camera); renderer.render(scene, camera); renderer.autoClear = true;
    }
    function resize(width, height) { camera.aspect = width / height; camera.updateProjectionMatrix(); sky.resize(width, height); }

    return {
        camera, controls, update, render, resize,
        get mission() { return mission; },
        set onStation(callback) { stationButton.onclick = callback; },
        enter() {
            active = true; controls.enabled = true; panel.hidden = false; sky.hideLabels();
            setFollow(true); snapCamera = true; resize(viewport.clientWidth, viewport.clientHeight);
            if (time >= animationDuration) jump(0);
            setPlaying(true);
        },
        leave() { active = false; controls.enabled = false; panel.hidden = true; setPlaying(false); },
        get active() { return active; },
        zoomBy(multiplier) {
            offset.subVectors(camera.position, controls.target);
            offset.setLength(THREE.MathUtils.clamp(offset.length() / multiplier, controls.minDistance, controls.maxDistance));
            camera.position.copy(controls.target).add(offset); setFollow(false);
        },
        site: launchSite, source: vehicle.source
    };
}
