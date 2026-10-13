// Orbit view: the ISS where it is now, over a globe at true scale. Positions come from SGP4 (js/sim/orbit.js) on the
// latest TLE from CelesTrak, or the copy in data/orbits.json when CelesTrak does not answer; the Sun's real direction
// lights the day side. The orbit is drawn as flown in inertial space, the ground track under it (45 minutes back, 90
// ahead) turns with Earth. Time runs live or faster. The module loads the first time the view opens. Scene units are
// kilometres; the axes are the inertial (TEME) frame turned so +y points north. More objects (satellites, a supply ship
// on its way up) join through addOrbiter().
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { renderer, viewport } from '../core/stage.js';
import { earthRadius, groundTrack, orbitPath, orbiter, stateAt, sunDirection } from '../sim/orbit.js';

const celestrak = norad => 'https://celestrak.org/NORAD/elements/gp.php?CATNR=' + norad + '&FORMAT=TLE';
const cacheHours = 2;   // CelesTrak asks clients not to fetch the same elements more often than every two hours
// Inertial (x to the equinox, z north) to scene axes, and Earth-fixed coordinates to the globe's own frame (the same
// mapping: the globe turns by the sidereal angle about +y).
const toScene = ({ x, y, z }, target = new THREE.Vector3()) => target.set(x, z, -y);

// Elements for an object: a fresh cached copy, else CelesTrak, else the copy that ships with the page.
async function loadElements(norad) {
    const key = 'iss-atlas-tle-' + norad;
    try {
        const cached = JSON.parse(localStorage.getItem(key));
        if (cached && Date.now() - cached.fetched < cacheHours * 3600000) return { tle: cached.tle, source: 'CelesTrak', fetched: cached.fetched };
    } catch (error) { /* storage blocked: fetch instead */ }
    try {
        const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 5000);
        const response = await fetch(celestrak(norad), { signal: abort.signal }); clearTimeout(timer);
        const tle = (await response.text()).split('\n').map(line => line.trim()).filter(line => /^[12] /.test(line));
        if (!response.ok || tle.length !== 2) throw new Error('no elements');
        try { localStorage.setItem(key, JSON.stringify({ tle, fetched: Date.now() })); } catch (error) { /* not cached */ }
        return { tle, source: 'CelesTrak', fetched: Date.now() };
    } catch (error) {
        const response = await fetch('data/orbits.json?v=2da50c9f88');
        const data = await response.json(), entry = data.objects.find(object => object.norad === norad);
        return { tle: entry.tle, source: 'CelesTrak (copy of ' + data.fetched.slice(0, 10) + ')', fetched: Date.parse(data.fetched) };
    }
}

function glowTexture(draw) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    draw(canvas.getContext('2d')); return new THREE.CanvasTexture(canvas);
}

export async function createOrbitView() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 100, 3e6);
    camera.position.set(0, 14000, 38000);
    const controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enabled: false, enableDamping: true, dampingFactor: .08, enablePan: false, minDistance: earthRadius + 2500, maxDistance: 160000, rotateSpeed: .45, zoomSpeed: .8 });

    // Earth: the day map lit by the Sun, city lights on the night side, a soft terminator.
    const loader = new THREE.TextureLoader();
    const uniforms = { dayMap: { value: null }, nightMap: { value: null }, hasDay: { value: 0 }, hasNight: { value: 0 }, sunDirection: { value: new THREE.Vector3(1, 0, 0) } };
    for (const [name, url] of [['day', 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'], ['night', 'https://threejs.org/examples/textures/planets/earth_lights_2048.png']]) {
        loader.load(url, texture => {
            texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
            uniforms[name + 'Map'].value = texture; uniforms['has' + name[0].toUpperCase() + name.slice(1)].value = 1;
        });
    }
    const earth = new THREE.Mesh(new THREE.SphereGeometry(earthRadius, 128, 64), new THREE.ShaderMaterial({
        uniforms,
        vertexShader: 'varying vec2 vUv; varying vec3 vNormalW; void main() { vUv = uv; vNormalW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform sampler2D dayMap; uniform sampler2D nightMap; uniform float hasDay; uniform float hasNight; uniform vec3 sunDirection;
            varying vec2 vUv; varying vec3 vNormalW;
            void main() {
                float light = dot(normalize(vNormalW), sunDirection), day = smoothstep(-.1, .16, light);
                vec3 dayColor = hasDay > .5 ? texture2D(dayMap, vUv).rgb : vec3(.05, .12, .2);
                vec3 nightColor = hasNight > .5 ? texture2D(nightMap, vUv).rgb * vec3(1., .78, .48) * 1.5 : vec3(0.);
                gl_FragColor = vec4(mix(nightColor + dayColor * .03, dayColor * (.07 + 1.1 * max(light, 0.)), day), 1.);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`
    }));
    scene.add(earth);
    // Atmosphere: a rim glow, brighter on the day side.
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.028, 96, 48), new THREE.ShaderMaterial({
        uniforms: { sunDirection: uniforms.sunDirection },
        vertexShader: 'varying vec3 vNormal; varying vec3 vNormalW; void main() { vNormal = normalize(normalMatrix * normal); vNormalW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 sunDirection; varying vec3 vNormal; varying vec3 vNormalW; void main() { float rim = pow(max(0., .66 + dot(vNormal, vec3(0., 0., 1.))), 3.); float lit = .25 + .75 * smoothstep(-.35, .35, dot(normalize(vNormalW), sunDirection)); gl_FragColor = vec4(vec3(.35, .62, 1.) * rim * lit, 1.); }',
        side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
    }));
    scene.add(atmosphere);
    // Stars, and the Sun far off in its real direction.
    const stars = [];
    let seed = 91;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 2200; k++) {
        const u = random() * 2 - 1, angle = random() * Math.PI * 2, spread = Math.sqrt(1 - u * u);
        stars.push(Math.cos(angle) * spread * 1.6e6, u * 1.6e6, Math.sin(angle) * spread * 1.6e6);
    }
    scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(stars, 3)),
        new THREE.PointsMaterial({ color: 0xdfe6ee, size: 1.4, sizeAttenuation: false, transparent: true, opacity: .75, depthWrite: false })));
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(g => {
        const glow = g.createRadialGradient(32, 32, 0, 32, 32, 32); glow.addColorStop(0, '#fff'); glow.addColorStop(.18, 'rgba(255,246,220,.95)'); glow.addColorStop(1, 'rgba(255,220,160,0)');
        g.fillStyle = glow; g.fillRect(0, 0, 64, 64);
    }), depthWrite: false, sizeAttenuation: false, blending: THREE.AdditiveBlending }));
    sunGlow.scale.setScalar(.09); scene.add(sunGlow);

    // Orbiting objects: marker, label, orbit, ground track, line to the ground.
    const orbiters = [], lineMaterials = [];
    const markerMap = colour => glowTexture(g => {
        g.fillStyle = colour; g.beginPath(); g.arc(32, 32, 9, 0, Math.PI * 2); g.fill();
        g.strokeStyle = colour; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.stroke();
    });
    function addOrbiter({ id, name, label, norad, colour = '#91d8c3', track = true }) {
        const entry = { id, name, label: label || name, norad, colour, object: null, state: null, source: '', fetched: 0, trackAt: 0 };
        entry.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerMap(colour), sizeAttenuation: false, depthWrite: false }));
        entry.marker.scale.setScalar(.026); entry.marker.renderOrder = 3; entry.marker.visible = false; scene.add(entry.marker);
        // Lines a few pixels wide (Line2), coloured per vertex.
        entry.orbit = new Line2(new LineGeometry(), new LineMaterial({ vertexColors: true, linewidth: 2.2, transparent: true, depthWrite: false }));
        entry.track = new Line2(new LineGeometry(), new LineMaterial({ vertexColors: true, linewidth: 1.8, transparent: true, depthWrite: false }));
        lineMaterials.push(entry.orbit.material, entry.track.material);
        entry.track.visible = track; earth.add(entry.track); scene.add(entry.orbit);
        entry.nadir = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: .45, depthWrite: false }));
        scene.add(entry.nadir);
        entry.element = document.createElement('div'); entry.element.className = 'orbit-label'; entry.element.hidden = true; viewport.appendChild(entry.element);
        entry.ready = loadElements(norad).then(({ tle, source, fetched }) => { entry.object = orbiter(name, tle[0], tle[1]); entry.source = source; entry.fetched = fetched; });
        orbiters.push(entry);
        return entry;
    }
    const iss = addOrbiter({ id: 'iss', name: 'ISS (ZARYA)', label: 'ISS', norad: 25544 });

    // Lines with a colour fade: dim behind the object, bright ahead of it.
    function setFadedLine(line, points, colour, nowIndex) {
        const base = new THREE.Color(colour), positions = new Float32Array(points.length * 3), colours = new Float32Array(points.length * 3);
        points.forEach((point, k) => {
            positions.set([point.x, point.y, point.z], k * 3);
            const ahead = k >= nowIndex, fade = ahead ? 1 - .55 * (k - nowIndex) / Math.max(1, points.length - nowIndex) : .18 + .3 * k / Math.max(1, nowIndex);
            colours.set([base.r * fade, base.g * fade, base.b * fade], k * 3);
        });
        line.geometry.dispose();
        line.geometry = new LineGeometry().setPositions(positions).setColors(colours);
    }
    function refreshPaths(entry, date) {
        const period = entry.object.period;
        const orbit = orbitPath(entry.object, date, -period / 2, period / 2, 240).map(point => toScene(point));
        setFadedLine(entry.orbit, orbit, entry.colour, 120);
        const track = groundTrack(entry.object, date, -45, 90, 270, earthRadius + 10).map(point => toScene(point));
        setFadedLine(entry.track, track, '#ffc766', 90);
        entry.trackAt = date.getTime();
    }

    // Time: live, or running ahead at a warp. `offset` is how far the shown time is ahead of the clock.
    const time = { offset: 0, warp: 1 };
    const panel = document.getElementById('orbit-panel');
    const field = id => document.getElementById(id);
    const warpButtons = [...panel.querySelectorAll('[data-warp]')];
    function setWarp(warp) {
        time.warp = warp; if (warp === 1) time.offset = 0;
        for (const button of warpButtons) button.setAttribute('aria-pressed', String(+button.dataset.warp === warp));
        for (const entry of orbiters) entry.trackAt = 0;
    }
    warpButtons.forEach(button => button.addEventListener('click', () => setWarp(+button.dataset.warp)));
    let follow = true;
    const followButton = field('orbit-follow');
    const setFollow = value => { follow = value; followButton.setAttribute('aria-pressed', String(value)); };
    followButton.addEventListener('click', () => setFollow(!follow));
    controls.addEventListener('start', () => setFollow(false));

    const position = new THREE.Vector3(), velocity = new THREE.Vector3(), sunVector = new THREE.Vector3(), desired = new THREE.Vector3(), normal = new THREE.Vector3();
    let readoutClock = 0, active = false, placed = false;
    const pad = value => String(value).padStart(2, '0');
    const utc = date => date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()) + ' ' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds()) + ' UTC';
    const age = ms => ms < 3600000 ? Math.round(ms / 60000) + ' min' : ms < 172800000 ? Math.round(ms / 3600000) + ' h' : Math.round(ms / 86400000) + ' days';
    function updateReadout(date) {
        const state = iss.state;
        field('orbit-clock').textContent = utc(date);
        field('orbit-rate').textContent = time.warp === 1 ? 'LIVE' : '×' + time.warp;
        if (!state) { field('orbit-source').textContent = iss.object ? 'SGP4 failed for this time' : 'Loading orbital elements…'; return; }
        field('orbit-altitude').textContent = state.height.toFixed(1) + ' km';
        field('orbit-speed').textContent = state.speed.toFixed(2) + ' km/s';
        field('orbit-place').textContent = Math.abs(state.latitude).toFixed(1) + '° ' + (state.latitude >= 0 ? 'N' : 'S') + ' · ' + Math.abs(state.longitude).toFixed(1) + '° ' + (state.longitude >= 0 ? 'E' : 'W');
        field('orbit-period').textContent = iss.object.period.toFixed(2) + ' min';
        field('orbit-inclination').textContent = iss.object.inclination.toFixed(2) + '°';
        field('orbit-light').textContent = state.shadow >= .99 ? 'Earth’s shadow' : state.shadow > .01 ? 'Penumbra' : 'Sunlight';
        field('orbit-source').textContent = 'SGP4 · ' + iss.source + ' · elements ' + age(Date.now() - iss.object.epoch.getTime()) + ' old';
    }

    function update(delta) {
        if (time.warp !== 1) time.offset += delta * 1000 * (time.warp - 1);
        const date = new Date(Date.now() + time.offset);
        toScene(sunDirection(date), sunVector); uniforms.sunDirection.value.copy(sunVector);
        for (const entry of orbiters) {
            if (!entry.object) continue;
            entry.state = stateAt(entry.object, date);
            if (!entry.state) { entry.marker.visible = false; continue; }
            toScene(entry.state.position, position); toScene(entry.state.velocity, velocity);
            entry.marker.position.copy(position); entry.marker.visible = true;
            const ends = entry.nadir.geometry.attributes.position;
            ends.setXYZ(0, position.x, position.y, position.z); desired.copy(position).setLength(earthRadius + 10);
            ends.setXYZ(1, desired.x, desired.y, desired.z); ends.needsUpdate = true;
            // Paths every 30 s of shown time (less often while time runs fast).
            if (Math.abs(date.getTime() - entry.trackAt) > Math.max(30000, time.warp * 250)) refreshPaths(entry, date);
            if (entry === iss) {
                earth.rotation.y = entry.state.gmst;
                // Following: the camera rides above and a little behind the station, so the orbit ahead stays in view.
                // Above the station, a little behind it and off to the north of its orbital plane, so the orbit reads
                // as a ring round Earth rather than edge-on.
                const view = () => desired.copy(position).normalize().addScaledVector(velocity.clone().normalize(), -.22)
                    .addScaledVector(normal.crossVectors(position, velocity).normalize(), .3);
                if (!placed) { camera.position.copy(view()).setLength(fitDistance); controls.update(); placed = true; }
                if (follow) {
                    view().setLength(camera.position.length());
                    camera.position.lerp(desired, 1 - Math.exp(-2.5 * delta)).setLength(desired.length());
                }
            }
        }
        sunGlow.position.copy(sunVector).multiplyScalar(1.2e6);
        controls.update(delta);
        readoutClock -= delta;
        if (readoutClock <= 0) { updateReadout(date); readoutClock = .25; }
    }
    // Labels beside their markers, hidden behind Earth.
    const projected = new THREE.Vector3(), toObject = new THREE.Vector3();
    function placeLabels() {
        const width = viewport.clientWidth, height = viewport.clientHeight;
        for (const entry of orbiters) {
            let show = active && entry.marker.visible;
            if (show) {
                // Hidden when the line of sight to it passes through Earth.
                toObject.copy(entry.marker.position).sub(camera.position);
                const length = toObject.length(); toObject.divideScalar(length);
                const along = -camera.position.dot(toObject), closest = camera.position.clone().addScaledVector(toObject, along).length();
                show = !(along > 0 && along < length && closest < earthRadius);
                projected.copy(entry.marker.position).project(camera);
                show = show && Math.abs(projected.x) < .97 && Math.abs(projected.y) < .95;
            }
            entry.element.hidden = !show;
            if (!show) continue;
            const text = entry.label + ' · ' + entry.state.height.toFixed(0) + ' km';
            if (entry.element.textContent !== text) entry.element.textContent = text;
            entry.element.style.transform = 'translate(' + ((projected.x * .5 + .5) * width + 14).toFixed(1) + 'px,' + ((-projected.y * .5 + .5) * height - 8).toFixed(1) + 'px)';
        }
    }
    // The globe sits in the open space between the header, the tool dock and (on narrow screens) the readout panel, at the
    // distance where the orbit just fits it.
    let fitDistance = 36000;
    function resize(width, height) {
        const chrome = document.querySelector('.viewport-chrome'), top = viewport.getBoundingClientRect().top;
        let upper = chrome.offsetTop + 34, lower = Math.min(chrome.offsetTop + chrome.clientHeight, document.querySelector('.dock').getBoundingClientRect().top - top - 8);
        const box = panel.getBoundingClientRect();
        if (!panel.hidden && box.width > width * .6) lower = Math.min(lower, box.top - top - 6);
        const region = Math.max(120, lower - upper), shift = (upper + lower) / 2 - height / 2, half = Math.tan(camera.fov * Math.PI / 360);
        camera.aspect = width / height; camera.setViewOffset(width, height, 0, -shift, width, height); camera.updateProjectionMatrix();
        fitDistance = 7700 / Math.sin(Math.min(Math.atan(half * region / height), Math.atan(half * width / height)));
        if (placed) camera.position.setLength(THREE.MathUtils.clamp(fitDistance, controls.minDistance, controls.maxDistance));
        for (const material of lineMaterials) material.resolution.set(width, height);
    }
    return {
        scene, camera, controls, orbiters, iss, addOrbiter, setWarp, setFollow, time,
        ready: iss.ready,
        enter() { active = true; controls.enabled = true; panel.hidden = false; setWarp(time.warp); setFollow(true); resize(viewport.clientWidth, viewport.clientHeight); },
        leave() { active = false; controls.enabled = false; panel.hidden = true; for (const entry of orbiters) entry.element.hidden = true; },
        update, resize,
        render() { camera.updateMatrixWorld(); placeLabels(); renderer.render(scene, camera); },
        zoomBy(multiplier) { camera.position.setLength(THREE.MathUtils.clamp(camera.position.length() / multiplier, controls.minDistance, controls.maxDistance)); },
        // True when a click at client coordinates lands on the ISS marker.
        hitsStation(clientX, clientY) {
            if (!iss.marker.visible || iss.element.hidden) return false;
            const bounds = renderer.domElement.getBoundingClientRect();
            projected.copy(iss.marker.position).project(camera);
            return Math.hypot((projected.x * .5 + .5) * bounds.width + bounds.left - clientX, (-projected.y * .5 + .5) * bounds.height + bounds.top - clientY) < 24;
        }
    };
}
