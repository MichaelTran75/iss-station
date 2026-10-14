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
import { animationAt, animationDuration, boosterState, countdown, dracoBurns, droneship, eventAt, events, flightData, groundTrackEnd, inertialToPad, issAltitude, issPosition, launchEpoch, launchSite, missionAt, padFrame, paths, stageState, vehicleState, warpAt } from '../sim/ascent.js';
import { toScene } from '../orbit/sky.js';
import { createGround, mountHeight, padDeck } from './ground.js';
import { createExhaust } from './exhaust.js';
import { attitudePulses, dracoNozzles } from '../parts/draco.js';
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
    // The exhaust cloud at the pad and the trail up through the air, drifting on the day's wind.
    const exhaust = createExhaust(); scene.add(exhaust.group);
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
    const maxDots = 9000;
    // `turn(time)`: when Earth's turn is taken for the point at `time` (see js/sim/ascent.js, paths).
    // `lift(time)`: how far the model stands above the simulated point then (see place()), so the dots run through it.
    function trail(list, colour, turn, lift = () => 0) {
        const geometry = new THREE.BufferGeometry()
            .setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxDots * 3), 3))
            .setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxDots * 4), 4));
        const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, vertexColors: true, map: dotMap, transparent: true, depthWrite: false, alphaTest: .05 }));
        points.frustumCulled = false; points.renderOrder = 2; scene.add(points);
        points.userData = { inertial: list.map(entry => entry.r), times: list.map(entry => entry.t), path: list.map(() => new THREE.Vector3()), colour: new THREE.Color(colour), turn, lift };
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
    function turnTrails() {
        for (const name of ['rocket', 'booster']) {
            const { inertial, times, path, turn, lift } = trails[name].userData;
            for (let k = 0; k < path.length; k++) {
                const point = path[k].set(...inertialToPad(inertial[k], turn(times[k])));
                point.addScaledVector(raise.set(point.x, point.y + 6371000, point.z).normalize(), lift(times[k]));
            }
        }
        const iss = trails.iss.userData, anchor = Math.max(mission, groundTrackEnd);
        issTimes.forEach((f, k) => { iss.times[k] = Infinity; iss.path[k].set(...issPosition(mission + f * issPeriod, anchor)); });
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
    function curveAt(path, times, k, u, target) {
        const last = path.length - 1, at = j => Number.isFinite(times[j]) ? times[j] : j, i0 = Math.max(0, k - 1), i1 = Math.min(last, k + 2), span = at(k + 1) - at(k);
        if (!(span > 0)) return target.lerpVectors(path[k], path[k + 1], u);
        slopeA.subVectors(path[k + 1], path[i0]).divideScalar(at(k + 1) - at(i0));
        slopeB.subVectors(path[i1], path[k]).divideScalar(at(i1) - at(k));
        const u2 = u * u, u3 = u2 * u;
        return target.copy(path[k]).multiplyScalar(2 * u3 - 3 * u2 + 1).addScaledVector(slopeA, (u3 - 2 * u2 + u) * span)
            .addScaledVector(path[k + 1], 3 * u2 - 2 * u3).addScaledVector(slopeB, (u3 - u2) * span);
    }
    function layDots(points, eye) {
        const { path, times, colour } = points.userData, position = points.geometry.attributes.position, colours = points.geometry.attributes.color;
        let count = 0, k = 0, along = 0;   // segment k, fraction along it
        while (k < path.length - 1 && count < maxDots) {
            curveAt(path, times, k, along, dot);
            const time = times[k] + (times[k + 1] - times[k]) * along;
            position.setXYZ(count, dot.x, dot.y, dot.z);
            // Bright where it has flown, faint ahead; orbits flown more than two hours ago fade further.
            colours.setXYZW(count, colour.r, colour.g, colour.b, time > mission ? .42 : time > groundTrackEnd && mission - time > 7200 ? .14 : 1);
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
    function updateTrails() { trails.booster.visible = mission > eventAt('separation'); turnTrails(); }
    // The ISS: a marker and its label (the station itself is the station view's).
    const issMarker = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotMap, color: 0x91d8c3, sizeAttenuation: false, depthWrite: false, transparent: true }));
    issMarker.scale.setScalar(.022); issMarker.renderOrder = 3; scene.add(issMarker);
    const issLabel = document.createElement('div'); issLabel.className = 'orbit-label launch-iss-label'; issLabel.hidden = true; viewport.appendChild(issLabel);
    // From far out the vehicle the camera follows is a few pixels or less: a marker and label stand in for it.
    const vehicleMarker = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotMap, color: 0x9fe3ff, sizeAttenuation: false, depthWrite: false, depthTest: false, transparent: true }));
    vehicleMarker.scale.setScalar(.016); vehicleMarker.renderOrder = 3; scene.add(vehicleMarker);
    const vehicleLabel = document.createElement('div'); vehicleLabel.className = 'orbit-label launch-vehicle-label'; vehicleLabel.hidden = true; viewport.appendChild(vehicleLabel);
    const occluder = new THREE.Mesh(new THREE.SphereGeometry(6371000 - 3000, 128, 64), new THREE.MeshBasicMaterial({ colorWrite: false }));
    occluder.position.y = -6371000; occluder.renderOrder = -60; scene.add(occluder);

    const camera = new THREE.PerspectiveCamera(40, 1, .3, 5e6);
    const controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enabled: false, enableDamping: true, dampingFactor: .08, enablePan: false, minDistance: 5, maxDistance: 1e8, rotateSpeed: .5 });
    let auto = true;
    controls.addEventListener('start', () => setFollow(false));

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
            setFocus(event.booster ? 'booster' : 'rocket'); jump(event.at <= 0 ? 0 : animationAt(from, focus)); setFollow(true); setPlaying(true);
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
    function place(group, state, lift = standing) {
        group.position.set(...state.position);
        localUp.set(state.position[0], state.position[1] + 6371000, state.position[2]).normalize();
        group.position.addScaledVector(localUp, lift);
        group.quaternion.setFromUnitVectors(up, direction.set(...state.direction));
    }
    const separation = eventAt('separation'), ignition = eventAt('ses'), landing = eventAt('landing');
    // The booster comes down onto its legs' reach (2.8 m below the engines) for the landing.
    const boosterLift = time => standing - (standing - 2.8) * smooth(time, landing - 60, landing - 20);
    // Dragon's phasing burns: how far turned to burn attitude (0-1) and whether the Dracos are firing.
    const flip = new THREE.Quaternion(), sideways = new THREE.Vector3(1, 0, 0), firing = new Float32Array(dracoNozzles.length), turnPivot = new THREE.Vector3(), turnArm = new THREE.Vector3();
    function burnNow(mission) {
        for (const burn of dracoBurns) {
            const start = burn.at - burn.seconds / 2, end = burn.at + burn.seconds / 2;
            if (mission < start - burn.turn || mission > end + burn.turn) continue;
            const turned = smooth(mission, start - burn.turn, start - 25) * (1 - smooth(mission, end + 25, end + burn.turn));
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
        }
        else { capsule.position.copy(upper.position); capsule.quaternion.copy(upper.quaternion); }
        boosterNow = mission < separation ? state : boosterState(mission);
        if (mission < separation) { booster.position.copy(upper.position); booster.quaternion.copy(upper.quaternion); }
        else place(booster, boosterNow, boosterLift(mission));
        vehicle.setFins(smooth(mission - separation, 10, 16));
        vehicle.setLegs(smooth(mission, landing - 9, landing - 4));
        // Springs push Dragon off the second stage; it draws away at about 0.4 m/s.
        const dragonSince = mission - eventAt('dragon');
        if (dragonSince > 0 && !state.dragon) capsule.position.addScaledVector(axis, .4 * dragonSince + .004 * dragonSince * dragonSince);
        issMarker.position.set(...issPosition(mission, Math.max(mission, groundTrackEnd)));
        vehicle.setNose(smooth(mission, eventAt('nosecone'), eventAt('nosecone') + 6));
        // Engines: the Merlins as the simulation fires them (nine, throttled through Max-Q and for the crew's 3.1 g;
        // three for the entry burn; one, throttled, to land), and the vacuum Merlin.
        const engines = mission < separation ? Math.max(0, state.engines) : boosterNow.engines, now = performance.now() / 1000;
        const lit = mission < separation ? eventAt('ignition') : mission < flightData.landingStart - 1 ? flightData.entry : flightData.landingStart;   // when these engines lit
        vehicle.setFirstPlume({ engines, altitude: boosterNow.altitude, airspeed: boosterNow.speed, retro: mission > separation, since: mission - lit }, now);
        vehicle.setSecondPlume(state.engines < 0, now, mission - ignition);
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
    function light() {
        sunLocal.copy(sky.sun.position).normalize().applyQuaternion(frameInverse);
        daylight = THREE.MathUtils.clamp(.25 + sunLocal.y * 1.6, .15, 1);
        sunlight.intensity = 3.1 * smooth(sunLocal.y, -.08, .05);
        sunlight.position.copy(controls.target).addScaledVector(sunLocal, 2000); sunlight.target.position.copy(controls.target);
        skylight.intensity = .2 + .55 * daylight;
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
        const distance = toStation ? capsule.position.distanceTo(issMarker.position) : shown.downrange;
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
        stationButton.hidden = mission < eventAt('nosecone') + 6;
        const tiles = ground.status.loading;
        field('launch-source').textContent = (tiles ? 'Loading ground imagery (' + tiles + ' tiles)… · ' : '') + 'Simulated flight, fitted to NASA Demo-2 and DM-1 telemetry · model: Stanley Creative, CC BY 4.0 · imagery: USGS, NASA GIBS · buildings: © OpenStreetMap contributors · winds: Iowa Environmental Mesonet';
    }

    function update(delta) {
        if (playing) { time = Math.min(animationDuration(focus), time + delta); if (time >= animationDuration(focus)) setPlaying(false); }
        mission = missionAt(time, focus);
        sky.update(0, new Date(launchEpoch + mission * 1000));
        placeFrame(); pose(); light(); follow(delta); updateTrails();
        if (insetShown()) followInset(delta); else inset.snap = true;
        // The wheel speeds up with distance, from metres off the rocket out to whole orbits.
        controls.zoomSpeed = THREE.MathUtils.clamp(1 + .5 * Math.log10(Math.max(1, camera.position.distanceTo(controls.target) / 100)), 1, 4);
        controls.update(delta);
        camera.updateMatrixWorld();
        // The cloud and the trail, lit by the Sun and, near the pad, by the flame.
        flameDown.set(0, -1, 0).applyQuaternion(booster.quaternion);
        flame.position.copy(booster.position).addScaledVector(flameDown, 8 + vehicle.firstState.flame * .25);
        flame.strength = vehicle.firstState.strength * (1 - smooth(boosterNow.altitude, 150, 2500)) * 1.3;
        flame.range = 30 + vehicle.firstState.flame * .35;
        exhaust.update(mission, camera, sunLocal, daylight, flame);
        // Dragon's Dracos: the forward four through each phasing burn, attitude-trim pulses on its own before that.
        firing.fill(0);
        if (mission > eventAt('dragon') + 2) {
            const burn = burnNow(mission);
            if (burn.on > 0) for (let k = 0; k < 4; k++) firing[k] = burn.on * (.9 + .1 * Math.sin(time * 40 + k));
            else if (playing) attitudePulses(time, firing);
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
        // Two depth ranges, far then near, so orbits thousands of kilometres off sort against Earth as precisely as the
        // pad does a few metres off.
        renderer.autoClear = false; renderer.clearDepth();
        view.near = close; view.far = far; view.updateProjectionMatrix(); renderer.render(atmosphere, view);
        const split = 20000;
        if (close < split / 4) {
            view.near = split; view.far = far; view.updateProjectionMatrix(); renderer.render(scene, view); renderer.clearDepth();
            view.near = close; view.far = split * 1.02; view.updateProjectionMatrix(); renderer.render(scene, view);
        } else { view.near = close; view.far = far; view.updateProjectionMatrix(); renderer.render(scene, view); }
        renderer.autoClear = true;
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
        const show = active && projected.z < 1 && Math.abs(projected.x) < .97 && Math.abs(projected.y) < .95 && !behindEarth(camera.position, issMarker.position);
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
            active = true; controls.enabled = true; panel.hidden = false; sky.hideLabels();
            setFollow(true); snapCamera = true; resize(viewport.clientWidth, viewport.clientHeight);
            if (time >= animationDuration(focus)) jump(0);
            setPlaying(true);
        },
        leave() { active = false; controls.enabled = false; panel.hidden = true; insetElement.hidden = true; issLabel.hidden = vehicleLabel.hidden = true; setPlaying(false); },
        get active() { return active; },
        zoomBy(multiplier) {
            offset.subVectors(camera.position, controls.target);
            offset.setLength(THREE.MathUtils.clamp(offset.length() / multiplier, controls.minDistance, controls.maxDistance));
            camera.position.copy(controls.target).add(offset); setFollow(false);
        },
        site: launchSite, source: vehicle.source
    };
}
