// Launch view: Falcon 9 lifts Crew Dragon off LC-39A and climbs to orbit, as on Demo-2: liftoff, Max-Q, engine
// cutoff, stage separation, second-stage burn and cutoff, Dragon's separation and its nose cone opening, its phasing
// burns, and the proximity operations to contact and hooks closed at the ISS (the station view's own model, drawn
// where the station flies); and the
// booster's own flight back: flip, grid fins, entry burn, landing burn, legs, touchdown on the droneship. The flight
// simulation (js/sim/ascent.js) gives both paths and the times; this view draws them
// close up, over the ground round the pad (js/launch/ground.js) and the real sky at the time of the launch
// (js/orbit/sky.js), both at true scale. Two passes: the sky in kilometres from where the camera really is, then the
// pad, the ground and the vehicle in metres in the pad's frame. Loaded the first time the view opens.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { hemisphere as stationSky, renderer, scene as stationScene, sunlight as stationSun, viewport } from '../core/stage.js';
import { markShadowsDirty } from '../core/quality.js';
import { parts } from '../core/station.js';
import { approach } from '../parts/dragon.js';
import { rendezvousGuide } from '../ui/rendezvous-guide.js';
import { air, animationAt, animationDuration, boosterState, contactTime, countdown, dockingTime, dracoBurns, droneship, eventAt, events, flightData, groundTrackEnd, issAltitude, issFrame, issPosition, launchEpoch, launchSite, merlinSpool, missionAt, padFrame, padTransform, paths, proximity, rendezvousTime, spoolUp, stageState, tailOff, turnBack, vehicle as vehicleModel, vehicleState, warpAt } from '../sim/ascent.js';
import { toScene } from '../orbit/sky.js';
import { createGround, mountHeight, padDeck } from './ground.js';
import { createExhaust } from './exhaust.js';
import { attitudePulses, dracoNozzles, dracoThrust, selectDracos } from '../parts/draco.js';
import { createDroneship } from './droneship.js';
import { createPartLabels } from './part-labels.js';
import { createEngineAudio } from './engine-audio.js';
import { createVehicle } from './vehicle.js';

const smooth = (value, from, to) => THREE.MathUtils.smoothstep(value, from, to);

export async function createLaunchView(sky) {
    const [vehicle, bargeModel] = await Promise.all([createVehicle('data/falcon-9.json?v=fa4c1d9cea'), droneship ? createDroneship('data/droneship.json?v=023f40087f') : null]);
    const scene = new THREE.Scene();
    const environment = new THREE.PMREMGenerator(renderer);
    scene.environment = environment.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .45;
    const sunlight = new THREE.DirectionalLight(0xfff4e6, 3.1), skylight = new THREE.HemisphereLight(0xc4d8f5, 0x5f5646, .7);
    scene.add(sunlight, sunlight.target, skylight);
    // The atmosphere is drawn on its own before the rest (it blends over the sky behind; drawn with the scene's
    // transparent objects it would veil the ground).
    const ground = createGround(), atmosphere = new THREE.Scene(); scene.add(ground.group); atmosphere.add(ground.sky);
    // The exhaust cloud at the pad and the trail up through the air, drifting on the day's wind.
    const exhaust = createExhaust(); scene.add(exhaust.group);
    // Booster, second stage and Dragon fly together until each separation.
    const booster = new THREE.Group(), upper = new THREE.Group(), capsule = new THREE.Group();
    booster.add(vehicle.firstStage); upper.add(vehicle.secondStage); capsule.add(vehicle.dragon);
    scene.add(booster, upper, capsule);
    // The droneship where the booster comes down (js/launch/droneship.js), its deck level with the landing point.
    const barge = new THREE.Group();
    if (bargeModel) {
        barge.add(bargeModel.group);
        // The sea round it: the barge floats with 3 m of freeboard (the rest of its hull and its thrusters under the
        // water), and the water fades out over a few kilometres into the ocean drawn with the globe.
        const fade = document.createElement('canvas'); fade.width = fade.height = 256;
        const f = fade.getContext('2d'), gradient = f.createRadialGradient(128, 128, 0, 128, 128, 128);
        gradient.addColorStop(0, '#fff'); gradient.addColorStop(.3, '#fff'); gradient.addColorStop(1, '#000');
        f.fillStyle = gradient; f.fillRect(0, 0, 256, 256);
        const sea = new THREE.Mesh(new THREE.CircleGeometry(2500, 72).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0b2a55, roughness: .32, metalness: 0, transparent: true, alphaMap: new THREE.CanvasTexture(fade) }));
        sea.position.y = -3; sea.receiveShadow = true; sea.renderOrder = -1; barge.add(sea);
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
    const maxDots = 24000;
    // `turn(time)`: when Earth's turn is taken for the point at `time` (see js/sim/ascent.js, paths).
    // `lift(time)`: how far the model stands above the simulated point then (see place()), so the dots run through it.
    function trail(list, colour, turn, lift = () => 0) {
        const geometry = new THREE.BufferGeometry()
            .setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxDots * 3), 3))
            .setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxDots * 4), 4));
        const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, vertexColors: true, map: dotMap, transparent: true, depthWrite: false, alphaTest: .05 }));
        points.frustumCulled = false; points.renderOrder = 2; scene.add(points);
        points.userData = { inertial: list.map(entry => entry.r), times: list.map(entry => entry.t), path: list.map(() => new THREE.Vector3()), colour: new THREE.Color(colour), turn, lift, laidFor: new THREE.Vector3(Infinity, 0, 0), laidAt: NaN };
        return points;
    }
    // The rocket and Dragon: during the ascent, its track over the ground it flew over, and the orbits ahead as they
    // will stand in space at its end; afterwards the orbits as they stand in space now, with the ascent track turned
    // along so the line stays unbroken from the launch up to the station. (Drawn over the turning ground, hours of
    // orbits would wind round the globe like a cage.)
    const orbitTurn = time => time <= groundTrackEnd ? time + Math.max(0, mission - groundTrackEnd) : Math.max(mission, groundTrackEnd);
    const trails = { rocket: trail(paths.rocket, 0x9fe3ff, orbitTurn, () => standing), booster: trail(paths.booster, 0xffb35c, time => time, time => boosterLift(time)) };
    // The station's orbit, a revolution ahead of it, turned the same way as Dragon's orbits.
    const issPeriod = 2 * Math.PI * Math.sqrt((6371000 + issAltitude) ** 3 / 3.986004418e14), issTimes = Array.from({ length: 181 }, (_, k) => k / 180);
    trails.iss = trail(issTimes.map(() => ({ t: 0, r: [0, 0, 0] })), 0x91d8c3, null);
    // Dragon's path for the proximity operations, about the moving station: the transfer from Waypoint 0, the docking
    // axis from Waypoint 1 to the hold at Waypoint 2, and on to the port (straight between its points).
    const approachPlan = (() => {
        const transfer = proximity.phases[0].seconds, samples = proximity.path(160);
        // It joins on where the ascent's line ends: the capsule frame's base, behind the ring at Waypoint 0.
        const list = [{ t: rendezvousTime - 1, local: [-400, -(vehicle.secondStageTop + vehicle.dragonTop - vehicle.dragonRingY), 0] }];
        samples.forEach((at, k) => list.push({ t: rendezvousTime + (k <= 160 ? transfer * k / 160 : k === 161 ? proximity.phases[1].end : proximity.phases[3].end), local: at }));
        return list;
    })();
    trails.approach = trail(approachPlan.map(entry => ({ t: entry.t, r: [0, 0, 0] })), 0x9fe3ff, null);
    trails.approach.userData.straight = true;
    // Each point is turned back once by Earth's rotation to its own time where it takes one (the ascent's track, the
    // booster's), or kept inertial (Dragon's orbits); then each frame one transform turns them all, for the time the
    // ascent's points have run on past the end of the ascent and for the time the orbits stand at. The booster's path
    // never changes after that.
    let prepared = false, turnedAt = NaN;
    function prepareTrails() {
        for (const name of ['rocket', 'booster']) {
            const data = trails[name].userData;
            data.fixed = data.inertial.map((r, k) => name === 'booster' || data.times[k] <= groundTrackEnd ? turnBack(r, data.times[k]) : r);
            data.lifts = data.times.map(time => data.lift(time));
        }
        applyTurn(trails.booster.userData, 0, trails.booster.userData.path.length, padTransform(0));
        prepared = true;
    }
    function applyTurn(data, from, to, transform) {
        const { m, offset } = transform, { fixed, path, lifts } = data;
        for (let k = from; k < to; k++) {
            const [x, y, z] = fixed[k], point = path[k];
            point.set(m[0] * x + m[1] * y + m[2] * z + offset[0], m[3] * x + m[4] * y + m[5] * z + offset[1], m[6] * x + m[7] * y + m[8] * z + offset[2]);
            point.addScaledVector(raise.set(point.x, point.y + 6371000, point.z).normalize(), lifts[k]);
        }
    }
    const ascentPoints = trails.rocket.userData.times.findIndex(time => time > groundTrackEnd);
    function turnTrails() {
        if (!prepared) prepareTrails();
        if (mission === turnedAt) return;
        turnedAt = mission;
        const rocket = trails.rocket.userData;
        applyTurn(rocket, 0, ascentPoints, padTransform(Math.max(0, mission - groundTrackEnd)));
        applyTurn(rocket, ascentPoints, rocket.path.length, padTransform(Math.max(mission, groundTrackEnd)));
        const iss = trails.iss.userData, anchor = Math.max(mission, groundTrackEnd);
        issTimes.forEach((f, k) => { iss.times[k] = Infinity; portAt(mission + f * issPeriod, anchor, iss.path[k]); });
        if (trails.approach.visible) {
            const plan = trails.approach.userData;
            approachPlan.forEach((entry, k) => plan.path[k].copy(dock.port).addScaledVector(dock.radial, entry.local[0]).addScaledVector(dock.along, entry.local[1]).addScaledVector(dock.cross, entry.local[2]));
        }
    }
    const dot = new THREE.Vector3(), earthCentre = new THREE.Vector3(0, -6371000, 0), toDot = new THREE.Vector3(), raise = new THREE.Vector3();
    // Hidden behind Earth from `eye`?
    function behindEarth(eye, point) {
        toDot.subVectors(point, eye); const length = toDot.length(); toDot.divideScalar(length);
        const along = earthCentre.clone().sub(eye).dot(toDot);
        if (along <= 0 || along >= length) return false;
        return eye.clone().addScaledVector(toDot, along).distanceTo(earthCentre) < 6371000 - 2000;
    }
    // A point a fraction `u` of the way from sample k to k + 1 on a cubic through them, its slopes taken from the
    // neighbouring samples by time (or by count where the samples carry no times, as the station's orbit). Joined
    // straight, samples 10 s apart in orbit would cut inside the curve by up to 100 m.
    const slopeA = new THREE.Vector3(), slopeB = new THREE.Vector3();
    function curveAt(path, times, k, u, target, straight = false) {
        const last = path.length - 1, at = j => Number.isFinite(times[j]) ? times[j] : j, i0 = Math.max(0, k - 1), i1 = Math.min(last, k + 2), span = at(k + 1) - at(k);
        if (!(span > 0) || straight) return target.lerpVectors(path[k], path[k + 1], u);
        slopeA.subVectors(path[k + 1], path[i0]).divideScalar(at(k + 1) - at(i0));
        slopeB.subVectors(path[i1], path[k]).divideScalar(at(i1) - at(k));
        const u2 = u * u, u3 = u2 * u;
        return target.copy(path[k]).multiplyScalar(2 * u3 - 3 * u2 + 1).addScaledVector(slopeA, (u3 - 2 * u2 + u) * span)
            .addScaledVector(path[k + 1], 3 * u2 - 2 * u3).addScaledVector(slopeB, (u3 - u2) * span);
    }
    // Dots at fixed places along a path: on a lattice of arc length from its start whose spacing, a power of two in
    // metres, follows the distance from the camera (about 1° apart on screen), so they hold still as the camera moves
    // instead of sliding along with it; between two spacings the in-between dots fade. They are laid outward from where
    // the vehicle is now, forward to the end and then back to the start, so when the budget runs out on 18 hours of
    // orbits it runs out far away. They are written relative to the camera's place and the points moved there (world
    // coordinates in the millions of metres, in 32-bit floats, would shake by half a metre close up), and laid again
    // only when the time or the camera has moved.
    // Each vehicle covers its own stretch of the line: no dots inside the booster, the second stage or Dragon (their
    // bodies as they stand this frame, a cylinder 2.4 m round each axis). The path ahead of a rocket in flight runs up
    // through its body, and there the fixed dots would stream back through it as it flies; the path itself stays
    // fixed in space, as it must.
    const bodies = [{ group: booster, from: -1, to: () => vehicle.separationY + 1 }, { group: upper, from: () => vehicle.separationY - 6, to: () => vehicle.secondStageTop + 1 },
        { group: capsule, from: () => vehicle.secondStageTop - 1, to: () => vehicle.dragonTop + 1 }].map(body => ({ ...body, start: new THREE.Vector3(), axis: new THREE.Vector3(), low: 0, high: 0 }));
    const bodyRadius = 2.4, fromBody = new THREE.Vector3();
    function placeBodies() {
        for (const body of bodies) {
            body.start.copy(body.group.position); body.axis.set(0, 1, 0).applyQuaternion(body.group.quaternion);
            body.low = typeof body.from === 'function' ? body.from() : body.from; body.high = body.to();
        }
    }
    const insideBody = point => bodies.some(body => {
        const along = fromBody.subVectors(point, body.start).dot(body.axis);
        return along > body.low && along < body.high && fromBody.lengthSq() - along * along < bodyRadius * bodyRadius;
    });
    function layDots(points, eye) {
        const data = points.userData, { path, times, colour, straight } = data, position = points.geometry.attributes.position, colours = points.geometry.attributes.color;
        if (data.laidAt === mission && data.laidFor.equals(eye)) return;
        data.laidAt = mission; data.laidFor.copy(eye);
        placeBodies();
        points.position.copy(eye); points.updateMatrixWorld();
        const last = path.length - 1;
        if (last < 1) { points.geometry.setDrawRange(0, 0); return; }
        const along = data.along ||= new Float64Array(path.length);
        for (let k = 0; k < last; k++) along[k + 1] = along[k] + path[k].distanceTo(path[k + 1]);
        let from = 0;
        if (Number.isFinite(times[0])) { let lo = 0, hi = last; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid] <= mission) lo = mid; else hi = mid; } from = lo; }
        let count = 0;
        // One step of the walk: the dot at arc length s on segment k, and the lattice spacing there.
        const place = (k, s, write = true) => {
            const length = along[k + 1] - along[k], u = length > 0 ? (s - along[k]) / length : 0;
            curveAt(path, times, k, u, dot, straight);
            const level = Math.log2(Math.max(1.5, dot.distanceTo(eye) * .017)), steps = Math.ceil(level), spacing = 2 ** (steps - 1);
            const time = times[k] + (times[k + 1] - times[k]) * u;
            // Bright where it has flown, faint ahead; orbits flown more than two hours ago fade further.
            const fade = Math.round(s / spacing) % 2 ? steps - level : 1, alpha = (time > mission ? .42 : time > groundTrackEnd && mission - time > 7200 ? .14 : 1) * fade;
            if (write && alpha > .05 && count < maxDots && !insideBody(dot)) {
                position.setXYZ(count, dot.x - eye.x, dot.y - eye.y, dot.z - eye.z);
                colours.setXYZW(count, colour.r, colour.g, colour.b, alpha);
                count++;
            }
            return spacing;
        };
        // Forward from the vehicle's segment to the end...
        let k = from, s = along[from];
        while (k < last && count < maxDots) {
            while (k < last && s > along[k + 1]) k++;
            if (k >= last) break;
            const spacing = place(k, s);
            s = (Math.floor(s / spacing + 1e-6) + 1) * spacing;
        }
        // ...then back from it to the start.
        k = from; s = along[from];
        let spacing = place(k, s, false); s = (Math.ceil(s / spacing - 1e-6) - 1) * spacing;
        while (k >= 0 && s >= 0 && count < maxDots) {
            while (k > 0 && s < along[k]) k--;
            spacing = place(k, s);
            s = (Math.ceil(s / spacing - 1e-6) - 1) * spacing;
        }
        position.needsUpdate = colours.needsUpdate = true; points.geometry.setDrawRange(0, count);
        position.clearUpdateRanges?.(); colours.clearUpdateRanges?.(); position.addUpdateRange?.(0, count * 3); colours.addUpdateRange?.(0, count * 4);
    }
    function updateTrails() { trails.booster.visible = mission > eventAt('separation'); trails.approach.visible = mission > rendezvousTime - 3600; turnTrails(); }
    // The ISS: a marker and its label (the station itself is the station view's).
    const issMarker = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotMap, color: 0x91d8c3, sizeAttenuation: false, depthWrite: false, transparent: true }));
    issMarker.scale.setScalar(.022); issMarker.renderOrder = 3; scene.add(issMarker);
    const issLabel = document.createElement('div'); issLabel.className = 'orbit-label launch-iss-label'; issLabel.hidden = true; viewport.appendChild(issLabel);
    // From far out the vehicle the camera follows is a few pixels or less: a marker and label stand in for it.
    const vehicleMarker = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotMap, color: 0x9fe3ff, sizeAttenuation: false, depthWrite: false, depthTest: false, transparent: true }));
    vehicleMarker.scale.setScalar(.016); vehicleMarker.renderOrder = 3; scene.add(vehicleMarker);
    const vehicleLabel = document.createElement('div'); vehicleLabel.className = 'orbit-label launch-vehicle-label'; vehicleLabel.hidden = true; viewport.appendChild(vehicleLabel);
    // The parts' names in the inside views.
    const partLabels = createPartLabels(viewport);
    // The countdown's last seconds over the scene.
    const countElement = document.createElement('div'); countElement.className = 'launch-count'; countElement.hidden = true; viewport.appendChild(countElement);
    const occluder = new THREE.Mesh(new THREE.SphereGeometry(6371000 - 3000, 128, 64), new THREE.MeshBasicMaterial({ colorWrite: false }));
    occluder.position.y = -6371000; occluder.renderOrder = -60; scene.add(occluder);

    const camera = new THREE.PerspectiveCamera(40, 1, .3, 5e6);
    renderer.localClippingEnabled = true;   // the cutaway (js/launch/internals.js)
    const controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enabled: false, enableDamping: true, dampingFactor: .08, enablePan: false, minDistance: 5, maxDistance: 1e8, rotateSpeed: .5 });
    let auto = true;
    let followBeforeDrag = true;
    controls.addEventListener('start', () => { followBeforeDrag = auto; setFollow(false); });

    // Time: animation seconds, played with the warp for what the camera follows (the rocket and Dragon, or the
    // booster); the mission clock follows.
    let time = 0, mission = countdown, playing = true, active = false, focus = 'rocket';
    const panel = document.getElementById('launch-panel'), field = id => document.getElementById(id);
    const playButton = field('launch-play'), followButton = field('launch-follow'), stationButton = field('launch-station');
    // Overview: the whole flight from above the orbit's plane, Earth in the middle, from the launch to the station.
    let overview = false;
    const overviewButton = field('launch-overview');
    function setFollow(value) { auto = value; if (value) setOverview(false); followButton.setAttribute('aria-pressed', String(value && !overview)); }
    function setOverview(value) { overview = value; overviewButton.setAttribute('aria-pressed', String(value)); followButton.setAttribute('aria-pressed', String(auto && !value)); }
    overviewButton.addEventListener('click', () => { auto = true; setOverview(!overview); });
    // Inside: the stages cut open (tanks, propellant, lines, engines).
    let inside = false;
    const insideButton = field('launch-inside');
    insideButton.addEventListener('click', () => { inside = !inside; vehicle.setCutaway(inside); insideButton.setAttribute('aria-pressed', String(inside)); });
    // Engine sound (js/launch/engine-audio.js): made on entering the view or on the first touch of it (the browser
    // plays sound only after the visitor has interacted), on or off as the visitor last left it.
    let audio = null, soundOn = true;
    try { soundOn = localStorage.getItem('iss.launch.sound') !== 'off'; } catch (error) { /* no storage: on */ }
    const soundButton = field('launch-sound');
    const syncSound = () => soundButton.setAttribute('aria-pressed', String(soundOn));
    syncSound();
    function startAudio() {
        if (audio) { if (active && audio.context.state === 'suspended') audio.context.resume(); return; }
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        try { audio = createEngineAudio(new Context()); audio.setMuted(!soundOn); audio.context.resume(); }
        catch (error) { audio = null; console.warn('Engine sound unavailable:', error); }
    }
    soundButton.addEventListener('click', () => {
        soundOn = !soundOn; syncSound();
        try { localStorage.setItem('iss.launch.sound', soundOn ? 'on' : 'off'); } catch (error) { /* not kept */ }
        startAudio(); audio?.setMuted(!soundOn);
    });
    viewport.addEventListener('pointerdown', () => { if (active) startAudio(); });
    document.addEventListener('visibilitychange', () => { if (!audio) return; if (document.hidden) audio.context.suspend(); else if (active) audio.context.resume(); });
    // Light-offs heard: the nine at T−3 s, the booster's three for its entry burn and its one to land (each 0.2 s after
    // its command).
    const lightOffs = [eventAt('ignition') + merlinSpool.delay, flightData.entry + merlinSpool.delay, flightData.landingStart + merlinSpool.delay];
    let heardAt = NaN;
    const jetWay = new THREE.Vector3(), toListener = new THREE.Vector3(), heard = new THREE.Vector3(), bargeSpot = new THREE.Vector3();
    // The booster's sonic boom as heard at the landing zone, by the droneship. Sound sent at t arrives at t + d/c (d the
    // distance to the barge, c the mean speed of sound between); over the stretch flown faster than sound the
    // wavefronts pile up where that arrival is earliest (the booster closing on the barge at the speed of sound), and
    // the boom arrives then: T+578 s, 33 s before touchdown, the booster still 2 km up in its landing burn (what it
    // sent from higher and faster arrives after, in reverse order). A camera riding along with the booster is never
    // crossed by its Mach cone: the boom is the landing zone's, heard while the camera is within 50 km of it.
    const boomAt = (() => {
        if (!droneship || !flightData.landing) return Infinity;
        let earliest = Infinity;
        for (let t = flightData.entry; t <= flightData.landing.at; t += .05) {
            const s = boosterState(t), sound = air(s.altitude).a;
            if (s.speed < sound) continue;
            const d = Math.hypot(s.position[0] - droneship.position[0], s.position[1] - droneship.position[1], s.position[2] - droneship.position[2]);
            earliest = Math.min(earliest, t + d / ((sound + 340.3) / 2));
        }
        return earliest;
    })();
    function updateAudio() {
        if (!audio) return;
        // The first stage's engines (the whole stack's until separation), heard at the camera.
        const r = camera.position.distanceTo(booster.position);
        const airAt = height => Math.min(1, air(Math.max(0, height)).rho / 1.225);
        const cameraHeight = camera.position.distanceTo(earthCentreLocal) - 6371000;
        jetWay.set(0, -1, 0).applyQuaternion(booster.quaternion);
        toListener.subVectors(camera.position, booster.position).normalize();
        heard.copy(booster.position).project(camera);
        const before = heardAt, jumped = !(Math.abs(mission - heardAt) < 1.5);
        heardAt = mission;
        // The boom, as the clock passes its arrival (not on a jump), the camera near the landing zone.
        const fromBarge = droneship ? camera.position.distanceTo(bargeSpot.set(...droneship.position)) : Infinity;
        if (!jumped && before < boomAt && mission >= boomAt && fromBarge < 5e4) audio.boom(Math.min(1, 6000 / Math.max(6000, fromBarge)));
        audio.update({
            thrust: Math.max(0, boosterNow.engines) / 9, distance: r, air: Math.sqrt(airAt(boosterNow.altitude) * airAt(cameraHeight)),
            angle: Math.acos(Math.max(-1, Math.min(1, jetWay.dot(toListener)))), pan: heard.z < 1 ? heard.x : 0,
            impinge: 1 - smooth(boosterNow.altitude, 30, 200), lights: lightOffs.filter(at => mission >= at).length, jumped,
            warp: warpAt(mission, focus), quiet: !active || !playing
        });
    }
    // See-through: a left click on the rocket (a click, not a drag; within 24 px of it on screen counts, for a small
    // rocket far off) turns its skin half transparent with its line art, over the whole inside; again turns it back.
    // The click leaves the camera following as it was.
    let xray = false;
    const xrayButton = field('launch-xray');
    function setXray(on) { xray = on; vehicle.setXray(on); xrayButton.setAttribute('aria-pressed', String(on)); }
    xrayButton.addEventListener('click', () => setXray(!xray));
    const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster(), ends = [new THREE.Vector3(), new THREE.Vector3()];
    let pressed = null;
    renderer.domElement.addEventListener('pointerdown', event => { pressed = active && event.button === 0 ? { x: event.clientX, y: event.clientY, at: performance.now() } : null; });
    renderer.domElement.addEventListener('pointerup', event => {
        const press = pressed; pressed = null;
        if (!active || !press || event.button !== 0 || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5 || performance.now() - press.at > 500) return;
        const rect = renderer.domElement.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
        pointer.set(x / rect.width * 2 - 1, 1 - y / rect.height * 2);
        raycaster.setFromCamera(pointer, camera);
        let hit = raycaster.intersectObjects(vehicle.pickable, false).length > 0;
        // Near the stack's axis on screen: the booster, the upper stage, Dragon (after each separation they part).
        for (const [group, from, to] of [[booster, 0, vehicle.separationY], [upper, vehicle.separationY - 5, vehicle.secondStageTop], [capsule, vehicle.secondStageTop, vehicle.dragonTop]]) {
            if (hit) break;
            const [a, b] = ends.map((end, k) => end.set(0, k ? to : from, 0).applyMatrix4(group.matrixWorld).project(camera));
            if (a.z > 1 || b.z > 1) continue;
            const ax = (a.x + 1) / 2 * rect.width, ay = (1 - a.y) / 2 * rect.height, bx = (b.x + 1) / 2 * rect.width, by = (1 - b.y) / 2 * rect.height;
            const dx = bx - ax, dy = by - ay, u = THREE.MathUtils.clamp(((x - ax) * dx + (y - ay) * dy) / Math.max(1e-6, dx * dx + dy * dy), 0, 1);
            hit = Math.hypot(ax + u * dx - x, ay + u * dy - y) < 24;
        }
        if (!hit) return;
        setXray(!xray);
        if (followBeforeDrag) setFollow(true);
    });
    function setPlaying(value) { playing = value; playButton.textContent = value ? 'Pause' : 'Play'; playButton.setAttribute('aria-pressed', String(!value)); }
    playButton.addEventListener('click', () => { if (time >= animationDuration(focus)) time = 0; setPlaying(!playing); });
    const focusButtons = [...panel.querySelectorAll('[data-focus]')];
    function setFocus(name) {
        focus = name; time = animationAt(mission, focus);
        for (const button of focusButtons) button.setAttribute('aria-pressed', String(button.dataset.focus === name));
    }
    focusButtons.forEach(button => button.addEventListener('click', () => { setFocus(button.dataset.focus); setFollow(true); }));
    field('launch-restart').addEventListener('click', () => { jump(0); setPlaying(true); });
    followButton.addEventListener('click', () => { setFollow(true); snapCamera = true; });
    const list = field('launch-events');
    const items = events.map(event => {
        const item = document.createElement('li'), button = document.createElement('button');
        button.type = 'button'; button.innerHTML = '<span>' + clock(event.at) + '</span>' + event.label;
        button.addEventListener('click', () => {
            // A phasing burn starts as Dragon begins turning to burn attitude.
            const burn = dracoBurns.find(entry => Math.abs(entry.at - event.at) < 1), from = burn ? burn.at - burn.seconds / 2 - burn.turn : event.at - 4;
            setFocus(event.booster ? 'booster' : 'rocket'); jump(animationAt(Math.max(countdown, from), focus)); setFollow(true); setPlaying(true);
        });
        item.append(button); list.append(item); return item;
    });
    function clock(seconds) {
        const s = Math.abs(Math.floor(seconds)), two = n => String(n).padStart(2, '0');
        return (seconds < 0 ? 'T−' : 'T+') + (s >= 3600 ? Math.floor(s / 3600) + ':' + two(Math.floor(s / 60) % 60) : two(Math.floor(s / 60))) + ':' + two(s % 60);
    }
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
    const standing = padDeck + mountHeight;   // the engines' bottom above the ground on the pad
    // The stack stands with Dragon's side hatch toward the tower in the west (the crew access arm meets it there); the
    // whole vehicle keeps that roll in flight.
    const hatchToTower = new THREE.Quaternion().setFromAxisAngle(up, -Math.PI / 2);
    function place(group, state, lift = standing) {
        group.position.set(...state.position);
        localUp.set(state.position[0], state.position[1] + 6371000, state.position[2]).normalize();
        group.position.addScaledVector(localUp, lift);
        group.quaternion.setFromUnitVectors(up, direction.set(...state.direction)).multiply(hatchToTower);
    }
    const separation = eventAt('separation'), ignition = eventAt('ses'), landing = eventAt('landing');
    // The ISS: the station view's model, its docking port where Dragon's docking ring meets it. At Waypoint 0 the ascent
    // leaves Dragon 400 m straight below the station's point on its orbit, but Dragon's frame starts at the stack's base,
    // `standing` up from the simulated point, and its ring sits ahead of that: the port goes the same way, so the
    // ring stands exactly 400 m under it. The station's axes follow its orbit: zenith +y, its flight -z, the orbit's
    // normal -x (as in the station view).
    const middle = (vehicle.secondStageTop + vehicle.dragonTop) / 2, ringAhead = 2 * middle - vehicle.dragonRingY;   // ring ahead of the simulated point, nose turned to the station
    const dock = { port: new THREE.Vector3(), radial: new THREE.Vector3(), along: new THREE.Vector3(), cross: new THREE.Vector3(), ring: new THREE.Vector3(), matrix: new THREE.Matrix4(), inverse: new THREE.Matrix4(), near: false };
    const xAxis = new THREE.Vector3(), yAxis = new THREE.Vector3(), zAxis = new THREE.Vector3(), dockBasis = new THREE.Matrix4(), dockAttitude = new THREE.Quaternion();
    function portAt(time, turn, target) {
        const f = issFrame(time, turn);
        return target.set(...f.position).add(xAxis.set(...f.radial).multiplyScalar(standing)).add(yAxis.set(...f.along).multiplyScalar(ringAhead));
    }
    function placeStation(time) {
        const f = issFrame(time, Math.max(time, groundTrackEnd));
        dock.radial.set(...f.radial); dock.along.set(...f.along); dock.cross.set(...f.cross);
        dock.port.set(...f.position).addScaledVector(dock.radial, standing).addScaledVector(dock.along, ringAhead);
        dock.matrix.makeBasis(xAxis.copy(dock.cross).negate(), dock.radial, zAxis.copy(dock.along).negate());
        yAxis.copy(approach.port).applyMatrix4(dock.matrix);
        dock.matrix.setPosition(dock.port.x - yAxis.x, dock.port.y - yAxis.y, dock.port.z - yAxis.z);
        dock.inverse.copy(dock.matrix).invert();
    }
    // The booster comes down onto its legs' reach (2.8 m below the engines) for the landing.
    const boosterLift = time => standing - (standing - 2.8) * smooth(time, landing - 60, landing - 20);
    // Dragon's phasing burns: how far turned to burn attitude (0-1; heat shield along a burn that speeds it up) and
    // whether the Dracos are firing.
    const flip = new THREE.Quaternion(), sideways = new THREE.Vector3(1, 0, 0), firing = new Float32Array(dracoNozzles.length), turnPivot = new THREE.Vector3(), turnArm = new THREE.Vector3();
    const lastBurn = dracoBurns[dracoBurns.length - 1];
    function burnNow(mission) {
        for (const burn of dracoBurns) {
            // The last, at Waypoint 0, leaves Dragon with its nose to the station: it stays turned for the approach.
            const start = burn.at - burn.seconds / 2, end = burn.at + burn.seconds / 2, stays = burn === lastBurn;
            if (mission < start - burn.turn || (!stays && mission > end + burn.turn)) continue;
            // A burn that slows Dragon (the drop to the coelliptic orbit) needs no turn: nose ahead, the forward Dracos push back.
            const turned = (burn.prograde ? 1 : 0) * smooth(mission, start - burn.turn, start - 25) * (stays ? 1 : 1 - smooth(mission, end + 25, end + burn.turn));
            return { turned, on: mission >= start && mission <= end ? Math.min(1, (mission - start) / 2, (end - mission) / 2) : 0 };
        }
        return { turned: 0, on: 0 };
    }
    const axis = new THREE.Vector3();
    let state = vehicleState(countdown), boosterNow = state;
    function pose() {
        state = vehicleState(mission);
        place(upper, state.dragon ? stageState(mission) : state);
        upper.visible = mission < 5800;
        axis.set(0, 1, 0).applyQuaternion(upper.quaternion);
        if (state.dragon) {
            place(capsule, state);
            // Burn attitude: for each phasing burn Dragon turns its heat shield along the burn (the forward Dracos push
            // it backward) and turns back after.
            const burn = burnNow(mission);
            if (burn.turned > 0) {
                // Turned about the capsule's own middle (the group's origin is the stack's base, 60 m back).
                const middle = (vehicle.secondStageTop + vehicle.dragonTop) / 2, pivot = stackPoint(capsule, middle, turnPivot);
                capsule.quaternion.multiply(flip.setFromAxisAngle(sideways, Math.PI * burn.turned));
                capsule.position.copy(pivot).sub(turnArm.set(0, middle, 0).applyQuaternion(capsule.quaternion));
            }
            if (mission >= rendezvousTime) {
                // Proximity operations: the docking ring follows the model's path about the port (stopping at contact),
                // and Dragon rolls onto its docking attitude over two minutes (nose to the port, against the station's
                // flight; the nose cone's hinge, the capsule's -z, to zenith), turning about the ring.
                const local = state.proximity;
                dock.ring.copy(dock.port).addScaledVector(dock.radial, local.position[0]).addScaledVector(dock.along, Math.max(local.position[1], approach.contactGap)).addScaledVector(dock.cross, local.position[2]);
                dockAttitude.setFromRotationMatrix(dockBasis.makeBasis(xAxis.copy(dock.cross).negate(), yAxis.copy(dock.along).negate(), zAxis.copy(dock.radial).negate()));
                capsule.quaternion.slerp(dockAttitude, smooth(mission, rendezvousTime, rendezvousTime + 120));
                capsule.position.copy(dock.ring).sub(turnArm.set(0, vehicle.dragonRingY, 0).applyQuaternion(capsule.quaternion));
            }
        }
        else { capsule.position.copy(upper.position); capsule.quaternion.copy(upper.quaternion); }
        boosterNow = mission < separation ? state : boosterState(mission);
        if (mission < separation) { booster.position.copy(upper.position); booster.quaternion.copy(upper.quaternion); }
        else place(booster, boosterNow, boosterLift(mission));
        ground.updatePad(mission);
        vehicle.setFins(smooth(mission - separation, 10, 16));
        vehicle.setLegs(smooth(mission, landing - 9, landing - 4));
        // Springs push Dragon off the second stage; it draws away at about 0.4 m/s.
        const dragonSince = mission - eventAt('dragon');
        if (dragonSince > 0 && !state.dragon) capsule.position.addScaledVector(axis, .4 * dragonSince + .004 * dragonSince * dragonSince);
        issMarker.position.copy(dock.port);
        vehicle.setNose(smooth(mission, eventAt('nosecone'), eventAt('nosecone') + 6));
        // Engines: the Merlins as the simulation fires them (nine, throttled through Max-Q and for the crew's 3.1 g;
        // three for the entry burn; one, throttled, to land), and the vacuum Merlin.
        // Each engine spools up after its command and runs down at cutoff (sim/ascent.js), and the plumes follow.
        const now = performance.now() / 1000;
        const commanded = mission < separation ? eventAt('ignition') : mission < flightData.landingStart - 1 ? flightData.entry : flightData.landingStart;
        vehicle.setFirstPlume({ engines: Math.max(0, boosterNow.engines), lit: boosterNow.lit, altitude: boosterNow.altitude, airspeed: boosterNow.speed, retro: mission > separation, since: mission - commanded }, now);
        const afterSeco = mission - flightData.seco;
        vehicle.setSecondPlume(state.engines < 0 ? spoolUp(mission - ignition - merlinSpool.delay) : afterSeco >= 0 && afterSeco < 1.5 ? tailOff(afterSeco) : 0, now, mission - ignition);
    }

    // Camera: a spot by the pad for liftoff, then alongside the stack, close in on each separation, and on Dragon at
    // the end. It follows until someone drags it; it keeps following the vehicle with their angle after that.
    const target = new THREE.Vector3(), goalTarget = new THREE.Vector3(), goalOffset = new THREE.Vector3(), offset = new THREE.Vector3();
    const side = new THREE.Vector3(), back = new THREE.Vector3(), point = new THREE.Vector3(), lookout = new THREE.Vector3(150, 32, 175);
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
            goalTarget.lerp(point.set(0, padDeck + 30, 0), 1 - smooth(mission, 0, 12));   // the pad stays in frame for the first seconds
            goalOffset.copy(lookout).sub(goalTarget);
            // Through the terminal count, close in from the south-west (the sunlit side, clear of the tower) as the
            // strongback's cradles let go and it leans back.
            goalOffset.lerp(point.set(-55, -2, 45), 1 - smooth(mission, -40, -12));
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
        if (mission >= rendezvousTime) {
            // The approach: between Dragon and the port, from the station's port side, above and aft (the station
            // view's framing for Dragon), far enough to hold both, closing in as Dragon nears.
            const range = state.proximity ? state.proximity.range : 400, blend = smooth(mission, rendezvousTime, rendezvousTime + 90);
            stackPoint(capsule, middle, goalTarget).lerp(dock.port, .45 * blend);
            const reach = 30 + 1.3 * range;
            point.copy(dock.cross).multiplyScalar(165).addScaledVector(dock.radial, 70).addScaledVector(dock.along, -75).setLength(reach);
            back.set(0, -1, 0).applyQuaternion(capsule.quaternion);
            side.crossVectors(back, up); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
            goalOffset.copy(side).multiplyScalar(30).addScaledVector(back, 6).addScaledVector(up, 5).lerp(point, blend);
            return;
        }
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
    const centre = new THREE.Vector3(0, -6371000, 0), normal = new THREE.Vector3(), toVehicle = new THREE.Vector3(), issA = new THREE.Vector3(), issB = new THREE.Vector3();
    function overviewGoal(goalTarget, goalOffset) {
        // The orbit's plane from two points of the station's orbit a quarter-turn apart; look down on it at 30° from
        // over the vehicle, 4.4 Earth radii out, so the orbits cross Earth's face as ellipses (seen square-on they
        // would all hug the rim of the disc, the launch site with them).
        const anchor = Math.max(mission, groundTrackEnd);
        issA.set(...issPosition(mission, anchor)).sub(centre); issB.set(...issPosition(mission + 1390, anchor)).sub(centre);
        normal.crossVectors(issA, issB).normalize();
        toVehicle.copy(focus === 'booster' ? booster.position : capsule.position).sub(centre).normalize();
        goalTarget.copy(centre);
        goalOffset.copy(normal).multiplyScalar(.5).addScaledVector(toVehicle, .87).normalize().multiplyScalar(6371000 * 4.4 * Math.max(1, 1.3 / camera.aspect));   // further back on a tall screen
    }
    const overviewEye = new THREE.Vector3();
    function follow(delta) {
        if (overview) {
            // Fly out (and stay) in a straight line: both ends lie on the vehicle's side of Earth.
            overviewGoal(goalTarget, goalOffset);
            const ease = snapCamera ? 1 : 1 - Math.exp(-1.8 * delta); snapCamera = false;
            controls.target.lerp(goalTarget, ease); camera.position.lerp(overviewEye.copy(goalTarget).add(goalOffset), ease);
            return;
        }
        goal(focus, goalTarget, goalOffset);
        offset.subVectors(camera.position, controls.target);
        if (snapCamera) { offset.copy(goalOffset); snapCamera = false; }
        else if (auto) offset.lerp(goalOffset, 1 - Math.exp(-2.2 * delta));
        controls.target.copy(goalTarget); camera.position.copy(goalTarget).add(offset);
    }

    // Light: the Sun where it was at liftoff time; the ground's imagery dims when it is low.
    const sunLocal = new THREE.Vector3();
    let daylight = 1;
    // In flight the vehicles have the Sun unless Earth's shadow covers them (a cylinder behind Earth); near the ground,
    // the Sun's height over the pad sets the light.
    const toTarget = new THREE.Vector3(), earthCentreLocal = new THREE.Vector3(0, -6371000, 0);
    function sunlitAt(point) {
        toTarget.subVectors(point, earthCentreLocal);
        const along = toTarget.dot(sunLocal);
        return along > 0 || toTarget.addScaledVector(sunLocal, -along).length() > 6371000 ? 1 : 0;
    }
    function light() {
        sunLocal.copy(sky.sun.position).normalize().applyQuaternion(frameInverse);
        daylight = THREE.MathUtils.clamp(.25 + sunLocal.y * 1.6, .15, 1);
        const high = smooth(controls.target.distanceTo(earthCentreLocal) - 6371000, 20000, 60000), lit = sunlitAt(controls.target);
        sunlight.intensity = 3.1 * THREE.MathUtils.lerp(smooth(sunLocal.y, -.08, .05), lit, high);
        sunlight.position.copy(controls.target).addScaledVector(sunLocal, 2000); sunlight.target.position.copy(controls.target);
        skylight.intensity = THREE.MathUtils.lerp(.2 + .55 * daylight, .3, high);
        // The reflections' environment dims in Earth's shadow too, as the station's own fill does there.
        scene.environmentIntensity = .45 * THREE.MathUtils.lerp(1, .2 + .8 * lit, high);
        ground.setDaylight(daylight);
    }

    let readoutClock = 0, lastReached = null;
    const flame = { position: new THREE.Vector3(), strength: 0, range: 40 }, flameDown = new THREE.Vector3();
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
        // Once Dragon flies on its own, the distance that matters is the one to the station.
        const toStation = focus === 'rocket' && mission > eventAt('dragon'), downrange = field('launch-downrange');
        downrange.previousElementSibling.textContent = toStation ? 'Range to ISS' : 'Downrange';
        const distance = toStation ? (state.proximity ? state.proximity.range : stackPoint(capsule, vehicle.dragonRingY, point).distanceTo(dock.port)) : shown.downrange;
        downrange.textContent = distance < 1e4 && toStation ? distance.toFixed(0) + ' m' : (distance / 1000).toFixed(distance < 1e4 ? 1 : 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' km';
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
        stationButton.hidden = mission < dockingTime;
        const tiles = ground.status.loading;
        field('launch-source').textContent = (tiles ? 'Loading ground imagery (' + tiles + ' tiles)… · ' : '') + 'Simulated flight, fitted to NASA Demo-2 and DM-1 telemetry · models: Falcon 9 by Stanley Creative, droneship by TAIGA-ZOE (CC BY 4.0) · imagery: USGS, NASA GIBS · buildings: © OpenStreetMap contributors · winds: Iowa Environmental Mesonet';
    }

    // The approach's Dracos: each burn of the transfer for as long as it would take (a second at least on screen), and
    // pulses while Dragon holds its speed profile on the docking axis, against the commanded acceleration in Dragon's
    // own frame (the capsule's x, -z, y). The cone is long open: the forward four can fire.
    const commanded = new THREE.Vector3(), inverseAttitude = new THREE.Quaternion();
    const approachBurns = proximity.impulses.map(impulse => {
        const size = Math.hypot(...impulse.deltaV), seconds = size * vehicleModel.payload / (4 * dracoThrust * .894), warp = proximity.state(impulse.mission).warp;
        return { at: impulse.mission, length: Math.max(seconds, .9 * warp), deltaV: impulse.deltaV.map(v => v / (size || 1)) };
    });
    function approachFiring(local) {
        let strength = 0, lvlh = null;
        for (const burn of approachBurns) if (local >= burn.at && local < burn.at + burn.length) { strength = 1; lvlh = burn.deltaV; }
        if (!strength) {
            const thrust = state.proximity?.thrust || [0, 0, 0], size = Math.hypot(...thrust), pulse = (time * 1.4) % 1;
            if (size > 1e-5 && pulse < .22) { strength = THREE.MathUtils.clamp(size / 2e-3, .55, 1) * (1 - pulse / .22); lvlh = thrust.map(v => v / size); }
        }
        if (!strength) return false;
        commanded.set(0, 0, 0).addScaledVector(dock.radial, lvlh[0]).addScaledVector(dock.along, lvlh[1]).addScaledVector(dock.cross, lvlh[2]);
        commanded.applyQuaternion(inverseAttitude.copy(capsule.quaternion).invert());
        commanded.set(commanded.x, -commanded.z, commanded.y).normalize();
        selectDracos(commanded, true, strength, firing);
        return true;
    }
    // T−3, −2, −1 and LIFTOFF in large type over the free part of the view: each second's number swells in from 135%,
    // holds and fades in its last 0.3 s; LIFTOFF stays 1.4 s. Run on the mission clock, so paused, warped or jumped
    // to, it shows what that moment shows.
    let countShown = '';
    function countdownOverlay() {
        const show = active && mission > -3 && mission < 1.4;
        countElement.hidden = !show;
        if (!show) { countShown = ''; return; }
        const word = mission >= 0, text = word ? 'LIFTOFF' : String(Math.ceil(-mission - 1e-9));
        const s = word ? mission / 1.4 : Number(text) + mission;   // 0-1 through this one
        const swell = word ? 1.15 - .15 * smooth(s, 0, .2) : 1.35 - .35 * smooth(s, 0, .25);
        const opacity = word ? smooth(s, 0, .08) * (1 - smooth(s, .6, 1)) : smooth(s, 0, .12) * (1 - smooth(s, .7, 1));
        if (countShown !== text) {
            countShown = text; countElement.textContent = text; countElement.classList.toggle('word', word);
            const box = viewport.getBoundingClientRect(), side = panel.hidden ? 0 : Math.max(0, panel.getBoundingClientRect().right - box.left);
            countElement.style.left = ((side + viewport.clientWidth) / 2).toFixed(0) + 'px';
        }
        countElement.style.opacity = opacity.toFixed(3);
        countElement.style.transform = 'translate(-50%, -50%) scale(' + swell.toFixed(3) + ')';
    }
    function update(delta) {
        if (playing) { time = Math.min(animationDuration(focus), time + delta); if (time >= animationDuration(focus)) setPlaying(false); }
        mission = missionAt(time, focus);
        countdownOverlay();
        sky.update(0, new Date(launchEpoch + mission * 1000));
        placeFrame(); placeStation(mission); pose(); light(); follow(delta); updateTrails();
        if (insetShown()) followInset(delta); else inset.snap = true;
        // The wheel speeds up with distance, from metres off the rocket out to whole orbits.
        controls.zoomSpeed = THREE.MathUtils.clamp(1 + .5 * Math.log10(Math.max(1, camera.position.distanceTo(controls.target) / 100)), 1, 4);
        controls.update(delta);
        camera.updateMatrixWorld();
        updateAudio();
        // Inside: the propellant left in each stage, from the simulated masses (the stack's until separation, then the
        // booster's; the second stage's from its ignition to the end of the ascent simulation, then what stayed).
        if (inside || xray) {
            const v = vehicleModel, before = mission < separation;
            const first = before ? state.mass - v.s1Dry - v.s2Dry - v.s2Prop - v.payload : boosterNow.mass - v.s1Dry;
            const second = mission < ignition ? v.s2Prop : vehicleState(Math.min(mission, flightData.stack[flightData.stack.length - 1].t)).mass - v.s2Dry - v.payload;
            const left = { first: first / v.s1Prop, second: second / v.s2Prop };
            vehicle.updateCutaway(camera, left);
            partLabels.update(camera, { first: vehicle.firstStage, second: vehicle.secondStage }, left, { first: v.s1Prop, second: v.s2Prop });
            // The see-through view's lines: dark against the sky, light against space (by the camera's height).
            if (xray) vehicle.xrayContrast(smooth(camera.position.distanceTo(earthCentreLocal) - 6371000, 25000, 70000));
        } else partLabels.hide();
        // The cloud and the trail, lit by the Sun and, near the pad, by the flame.
        flameDown.set(0, -1, 0).applyQuaternion(booster.quaternion);
        flame.position.copy(booster.position).addScaledVector(flameDown, 8 + vehicle.firstState.flame * .25);
        flame.strength = vehicle.firstState.strength * (1 - smooth(boosterNow.altitude, 150, 2500)) * 1.3;
        flame.range = 30 + vehicle.firstState.flame * .35;
        exhaust.update(mission, camera, sunLocal, daylight, flame);
        // Dragon's Dracos: the forward four through each phasing burn, attitude-trim pulses on its own before that.
        firing.fill(0);
        if (mission > eventAt('dragon') + 2 && mission < contactTime) {
            const burn = burnNow(mission);
            if (burn.on > 0) for (let k = 0; k < 4; k++) firing[k] = burn.on * (.9 + .1 * Math.sin(time * 40 + k));
            else if (!(mission >= rendezvousTime && approachFiring(mission - rendezvousTime)) && playing) attitudePulses(time, firing);
            if (mission < eventAt('nosecone') + 6) for (let k = 0; k < 4; k++) firing[k] = 0;   // under the closed cone
        }
        vehicle.setDracos(playing ? delta : 0, firing);
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
        const distance = view.position.distanceTo(target), close = Math.max(.3, distance * .004), far = distance + 2.6e7;
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
        layDots(trails.rocket, view.position); layDots(trails.iss, view.position); if (trails.booster.visible) layDots(trails.booster, view.position);
        if (trails.approach.visible) layDots(trails.approach, view.position);
        dock.near = false;
        // Two depth ranges, far then near, so orbits thousands of kilometres off sort against Earth as precisely as the
        // pad does a few metres off.
        renderer.autoClear = false; renderer.clearDepth();
        view.near = close; view.far = far; view.updateProjectionMatrix(); renderer.render(atmosphere, view);
        const split = 20000;
        if (close < split / 4) {
            view.near = split; view.far = far; view.updateProjectionMatrix(); renderer.render(scene, view); renderer.clearDepth();
            view.near = close; view.far = split * 1.02; view.updateProjectionMatrix(); renderer.render(scene, view);
            drawStation(view);
        } else { view.near = close; view.far = far; view.updateProjectionMatrix(); renderer.render(scene, view); }
        renderer.autoClear = true;
    }
    // The station: the station view's own scene, seen from this camera carried into the station's frame, lit by the real
    // Sun (or left in Earth's shadow). Its own Dragon and the approach guide stand down (this view flies Dragon), and
    // its shadows are redrawn when the Sun has turned a degree against it.
    const stationCamera = new THREE.PerspectiveCamera(); stationCamera.matrixAutoUpdate = false; stationCamera.matrixWorldAutoUpdate = false;
    const stationLight = new THREE.Vector3(), shadowSun = new THREE.Vector3(9, 9, 9);
    function drawStation(view) {
        dock.near = view.position.distanceTo(dock.port) < 30000;
        if (!dock.near) return;
        stationCamera.projectionMatrix.copy(view.projectionMatrix); stationCamera.projectionMatrixInverse.copy(view.projectionMatrixInverse);
        stationCamera.matrixWorld.multiplyMatrices(dock.inverse, view.matrixWorld); stationCamera.matrixWorldInverse.copy(stationCamera.matrixWorld).invert();
        const dragonPart = parts.get('dragon').group, kept = [stationSun.position.clone(), stationSun.intensity, stationSky.intensity, dragonPart.visible, rendezvousGuide.visible];
        const sunlit = sunlitAt(dock.port);
        stationLight.copy(sunLocal).transformDirection(dock.inverse);
        stationSun.position.copy(stationLight).multiplyScalar(150); stationSun.intensity = 3.2 * sunlit; stationSky.intensity = .3 + .85 * sunlit;
        dragonPart.visible = false; rendezvousGuide.visible = false;
        if (stationLight.angleTo(shadowSun) > .017) { renderer.shadowMap.needsUpdate = true; shadowSun.copy(stationLight); }
        renderer.render(stationScene, stationCamera);
        stationSun.position.copy(kept[0]); [stationSun.intensity, stationSky.intensity, dragonPart.visible, rendezvousGuide.visible] = kept.slice(1);
    }
    // The ISS's label beside its marker, while it is on screen and not behind Earth; the vehicle's when far out.
    const projected = new THREE.Vector3();
    function placeLabel(element, point, text, show) {
        if (show) { projected.copy(point).project(camera); show = projected.z < 1 && Math.abs(projected.x) < .97 && Math.abs(projected.y) < .95 && !behindEarth(camera.position, point); }
        element.hidden = !show;
        if (!show) return;
        if (element.textContent !== text) element.textContent = text;
        element.style.transform = 'translate(' + ((projected.x * .5 + .5) * viewport.clientWidth + 12).toFixed(1) + 'px,' + ((-projected.y * .5 + .5) * viewport.clientHeight - 8).toFixed(1) + 'px)';
    }
    function placeVehicleLabel() {
        const followed = focus === 'booster' ? booster : capsule, shown = focus === 'booster' ? boosterNow : state;
        const far = camera.position.distanceTo(followed.position) > 6e4;
        vehicleMarker.visible = active && far && !behindEarth(camera.position, followed.position); vehicleMarker.position.copy(followed.position);
        const name = focus === 'booster' ? 'BOOSTER' : mission < eventAt('dragon') ? 'FALCON 9' : 'DRAGON';
        placeLabel(vehicleLabel, followed.position, name + ' · ' + (shown.altitude / 1000).toFixed(0) + ' km', active && far);
    }
    function placeIssLabel() {
        projected.copy(issMarker.position).project(camera);
        issMarker.visible = !dock.near;
        const show = active && !dock.near && projected.z < 1 && Math.abs(projected.x) < .97 && Math.abs(projected.y) < .95 && !behindEarth(camera.position, issMarker.position);
        issLabel.hidden = !show;
        if (!show) return;
        const range = camera.position.distanceTo(issMarker.position) < 2e6 ? capsule.position.distanceTo(issMarker.position) : null;
        issLabel.textContent = 'ISS · ' + (issAltitude / 1000).toFixed(0) + ' km' + (range !== null && mission > eventAt('dragon') ? ' · ' + (range < 1e4 ? range.toFixed(0) + ' m' : (range / 1000).toFixed(0) + ' km') + ' from Dragon' : '');
        issLabel.style.transform = 'translate(' + ((projected.x * .5 + .5) * viewport.clientWidth + 12).toFixed(1) + 'px,' + ((-projected.y * .5 + .5) * viewport.clientHeight - 8).toFixed(1) + 'px)';
    }
    const canvasBox = { left: 0, top: 0, height: 0 };
    function render() {
        draw(camera, controls.target); placeIssLabel(); placeVehicleLabel();
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
            active = true; controls.enabled = true; panel.hidden = false; sky.hideLabels(); startAudio();
            setFollow(true); snapCamera = true; resize(viewport.clientWidth, viewport.clientHeight);
            if (time >= animationDuration(focus)) jump(0);
            setPlaying(true);
        },
        leave() { active = false; controls.enabled = false; panel.hidden = true; insetElement.hidden = true; issLabel.hidden = vehicleLabel.hidden = countElement.hidden = true; partLabels.hide(); setPlaying(false); audio?.update({ thrust: 0, distance: 1e3, air: 0, angle: 0, pan: 0, impinge: 0, lights: 0, jumped: true, warp: 1, quiet: true }); shadowSun.set(9, 9, 9); markShadowsDirty(); },
        get active() { return active; },
        zoomBy(multiplier) {
            offset.subVectors(camera.position, controls.target);
            offset.setLength(THREE.MathUtils.clamp(offset.length() / multiplier, controls.minDistance, controls.maxDistance));
            camera.position.copy(controls.target).add(offset); setFollow(false);
        },
        site: launchSite, source: vehicle.source
    };
}
