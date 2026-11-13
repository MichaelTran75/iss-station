// The real sky round Earth, at the shown time: Earth with day, night and clouds, the ISS on its orbit, the Moon and
// the Sun where they are, and the stars. Units are kilometres with Earth's centre at the origin; the axes are the
// inertial frame of date (x toward the vernal equinox, z north) turned so +y points north. Two views draw it: the
// Orbit view (js/orbit/view.js), and the station's Earth backdrop, drawn at true scale behind the station
// (renderBehind). It loads the first time either opens. More objects (satellites, a supply ship on its way up) join
// through addOrbiter(). In the Orbit view Earth can also be drawn as a map with live wind and storms (earth-map.js).
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { renderer, viewport } from '../core/stage.js';
import { quality } from '../core/quality.js';
import { loadElements } from './elements.js';
import { attitude } from './attitude.js';
import { createEarthMap } from './earth-map.js';
import { createEarthTiles } from './earth-tiles.js?v=7ac43c3344';
import { orbitTheme } from './theme.js';
import { earthPath, earthRadius, groundTrack, moonLit, moonPath, moonPosition, moonRadius, orbitPath, orbiter, siderealAngle, stateAt,
    sunPosition, sunRadius } from '../sim/orbit.js';

// Inertial to scene axes; Earth-fixed coordinates map the same way into the globe's own frame, which turns by the
// sidereal angle about +y.
export const toScene = ({ x, y, z }, target = new THREE.Vector3()) => target.set(x, z, -y);
// Earth day, night and detail maps from Solar System Scope (CC BY 4.0), resized for the three.js examples; the Moon map
// is the three.js examples' own.
const textures = 'https://threejs.org/examples/textures/planets/';
// On phones and other modest devices (the quality tier starts below high: js/core/quality.js) the 4K Earth maps are
// drawn down to 2K once loaded: a quarter of the memory on the GPU (about 100 MB less for the three), and seen from
// orbit height hardly different.
const halveLarge = quality.ceiling !== 'high';
function halved(texture) {
    const image = texture.image, canvas = document.createElement('canvas');
    canvas.width = image.width / 2; canvas.height = image.height / 2;
    const g = canvas.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(image, 0, 0, canvas.width, canvas.height);
    return new THREE.CanvasTexture(canvas);
}
function canvasTexture(size, draw) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    draw(canvas.getContext('2d'), size); return new THREE.CanvasTexture(canvas);
}
const glowMap = (inner, outer) => canvasTexture(64, g => {
    const glow = g.createRadialGradient(32, 32, 0, 32, 32, 32); glow.addColorStop(0, '#fff'); glow.addColorStop(.18, inner); glow.addColorStop(1, outer);
    g.fillStyle = glow; g.fillRect(0, 0, 64, 64);
});
const dotMap = colour => canvasTexture(64, g => {
    g.fillStyle = colour; g.beginPath(); g.arc(32, 32, 9, 0, Math.PI * 2); g.fill();
    g.strokeStyle = colour; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.stroke();
});
const roundDot = canvasTexture(32, g => {
    const glow = g.createRadialGradient(16, 16, 0, 16, 16, 16); glow.addColorStop(0, '#fff'); glow.addColorStop(.55, '#fff'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow; g.fillRect(0, 0, 32, 32);
});

export function createSky() {
    const scene = new THREE.Scene(), loader = new THREE.TextureLoader(), anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const load = (file, apply, colour = true) => loader.load(textures + file, texture => {
        if (halveLarge && texture.image.width > 2048) texture = halved(texture);
        if (colour) texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = anisotropy; apply(texture);
    });

    // Earth: the day map lit by the Sun, with the detail map's clouds over it and a glint of the Sun on open water;
    // city lights on the night side; a soft terminator. Detail map: red relief, green roughness (0 on water), blue clouds.
    const uniforms = { dayMap: { value: null }, nightMap: { value: null }, detailMap: { value: null }, hasDay: { value: 0 }, hasNight: { value: 0 },
        hasDetail: { value: 0 }, sunDirection: { value: new THREE.Vector3(1, 0, 0) }, mapStyle: { value: 0 }, mapLight: { value: 0 } };
    load('earth_day_4096.jpg', texture => { uniforms.dayMap.value = texture; uniforms.hasDay.value = 1; });
    load('earth_night_4096.jpg', texture => { uniforms.nightMap.value = texture; uniforms.hasNight.value = 1; });
    load('earth_bump_roughness_clouds_4096.jpg', texture => { uniforms.detailMap.value = texture; uniforms.hasDetail.value = 1; }, false);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(earthRadius, 160, 80), new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPositionW;
            void main() { vUv = uv; vNormalW = normalize(mat3(modelMatrix) * normal); vec4 world = modelMatrix * vec4(position, 1.0); vPositionW = world.xyz; gl_Position = projectionMatrix * viewMatrix * world; }`,
        fragmentShader: `uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D detailMap; uniform float hasDay; uniform float hasNight; uniform float hasDetail; uniform vec3 sunDirection; uniform float mapStyle; uniform float mapLight;
            varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPositionW;
            void main() {
                vec3 normal = normalize(vNormalW);
                float light = dot(normal, sunDirection), day = smoothstep(-.1, .16, light);
                vec3 detail = hasDetail > .5 ? texture2D(detailMap, vUv).rgb : vec3(.5, 1., 0.);
                float clouds = smoothstep(.2, 1., detail.b), water = 1. - smoothstep(.05, .3, detail.g);
                if (mapStyle > .5) {
                    // Map: no clouds, no lights, no glint. Dark: dark land, darker sea, a little lighter by day. Light (the
                    // page's paper, not tone mapped): land a shade lighter than the paper, sea a shade darker, night dimmer.
                    vec3 dark = mix(vec3(.0085, .0112, .015), vec3(.0042, .0062, .0092), water) * (.5 + .5 * day);
                    vec3 paper = mix(vec3(.815, .74, .6), vec3(.64, .6, .5), water) * (.84 + .16 * day);
                    gl_FragColor = vec4(mix(dark, paper, mapLight), 1.);
                } else {
                    vec3 dayColor = hasDay > .5 ? texture2D(dayMap, vUv).rgb : vec3(.05, .12, .2);
                    dayColor = mix(dayColor, vec3(.92), clouds * .9);
                    vec3 nightColor = hasNight > .5 ? texture2D(nightMap, vUv).rgb * vec3(1., .82, .55) * 1.4 * (1. - clouds * .8) : vec3(0.);
                    vec3 halfway = normalize(sunDirection + normalize(cameraPosition - vPositionW));
                    float glint = pow(max(dot(normal, halfway), 0.), 400.) * water * (1. - clouds) * max(light, 0.) * .55;
                    gl_FragColor = vec4(mix(nightColor + dayColor * .025, dayColor * (.06 + 1.1 * max(light, 0.)) + glint, day), 1.);
                }
                #if defined( TONE_MAPPING )
                    if (mapStyle < .5 || mapLight < .5) gl_FragColor.rgb = toneMapping(gl_FragColor.rgb);
                #endif
                #include <colorspace_fragment>
            }`
    }));
    scene.add(earth);
    const earthMap = createEarthMap(earth);
    const earthTiles = createEarthTiles(earth, uniforms.sunDirection);   // the Cupola view's sharper ground (renderFrom)
    // The Orbit view's Earth is always the wind map; the photographed Earth stays behind the station and in Launch.
    let lastDelta = 0;
    // Atmosphere: a rim glow, brighter on the day side; dimmer and greyer round the map. On paper (the light Orbit view)
    // a thin blue rim laid over the page instead (added light would only bleach it), and none round the map.
    const photoGlow = new THREE.Vector3(.35, .62, 1), mapGlow = new THREE.Vector3(.1, .14, .2), paperGlow = new THREE.Vector3(.36, .55, .78);
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.028, 128, 64), new THREE.ShaderMaterial({
        uniforms: { sunDirection: uniforms.sunDirection, glow: { value: photoGlow.clone() }, additive: { value: 1 } },
        vertexShader: 'varying vec3 vNormal; varying vec3 vNormalW; void main() { vNormal = normalize(normalMatrix * normal); vNormalW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 sunDirection; uniform vec3 glow; uniform float additive; varying vec3 vNormal; varying vec3 vNormalW; void main() { float rim = pow(max(0., .66 + dot(vNormal, vec3(0., 0., 1.))), 3.); float lit = .2 + .8 * smoothstep(-.35, .35, dot(normalize(vNormalW), sunDirection)); gl_FragColor = additive > .5 ? vec4(glow * rim * lit, 1.) : vec4(glow, clamp(rim * (.35 + .65 * lit) * 1.6, 0., .85)); }',
        side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
    }));
    scene.add(atmosphere);
    // Stars on a unit sphere that rides with the camera, scaled just inside the far plane each frame.
    const starPositions = [];
    let seed = 91;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 2600; k++) {
        const u = random() * 2 - 1, angle = random() * Math.PI * 2, spread = Math.sqrt(1 - u * u);
        starPositions.push(Math.cos(angle) * spread, u, Math.sin(angle) * spread);
    }
    const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3)),
        new THREE.PointsMaterial({ color: 0xdfe6ee, size: 1.4, sizeAttenuation: false, transparent: true, opacity: .75, depthWrite: false }));
    stars.renderOrder = -2; stars.frustumCulled = false; scene.add(stars);

    // The Sun: its disc at true size and distance, and a glow of fixed screen size so it shows at any distance.
    const sun = new THREE.Group();
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(sunRadius, 48, 24), new THREE.MeshBasicMaterial({ color: 0xfff6e0 }));
    sun.add(sunDisc);
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap('rgba(255,246,220,.95)', 'rgba(255,220,160,0)'), depthWrite: false, sizeAttenuation: false, blending: THREE.AdditiveBlending }));
    sunGlow.scale.setScalar(.08); sun.add(sunGlow); scene.add(sun);
    // The Moon, lit by the Sun, so its phase is the real one; its near side faces Earth.
    const moonMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
    load('moon_1024.jpg', texture => { moonMaterial.map = texture; moonMaterial.needsUpdate = true; });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(moonRadius, 64, 32), moonMaterial); scene.add(moon);
    const sunlight = new THREE.DirectionalLight(0xffffff, 2.4); sunlight.target = moon; scene.add(sunlight);
    scene.add(new THREE.AmbientLight(0x8fa6c8, .12));   // earthshine, so the Moon's dark side still shows as a disc
    // Markers for bodies too small to see from far out.
    const marker = colour => {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: roundDot, color: colour, sizeAttenuation: false, depthWrite: false, depthTest: false }));
        sprite.scale.setScalar(.012); sprite.renderOrder = 4; sprite.visible = false; scene.add(sprite); return sprite;
    };
    const earthMarker = marker(0x6fa8dc), moonMarker = marker(0xc9ccd1);
    // Labels (page elements) for the Orbit view.
    const label = className => { const element = document.createElement('div'); element.className = 'orbit-label ' + className; element.hidden = true; viewport.appendChild(element); return element; };
    const bodies = [
        { name: 'EARTH', element: label('body'), object: earth, radius: earthRadius, marker: earthMarker },
        { name: 'MOON', element: label('body'), object: moon, radius: moonRadius, marker: moonMarker },
        { name: 'SUN', element: label('sun'), object: sun, radius: sunRadius, marker: null }
    ];

    // Faded lines (Line2, a few pixels wide): dim behind the moving body, bright ahead of it.
    const lineMaterials = [];
    function line(width) {
        const material = new LineMaterial({ vertexColors: true, linewidth: width, transparent: true, depthWrite: false });
        lineMaterials.push(material); return new Line2(new LineGeometry(), material);
    }
    // Faded toward the background: black, or the page's paper in the light Orbit view (`lineTheme`).
    let lineTheme = 'dark';
    const paper = new THREE.Color('#e2d6c0'), black = new THREE.Color(0, 0, 0), faded = new THREE.Color();
    function fadeColours(count, nowIndex, colour) {
        const base = new THREE.Color(colour), toward = lineTheme === 'light' ? paper : black, colours = new Float32Array(count * 3);
        for (let k = 0; k < count; k++) {
            const fade = k >= nowIndex ? 1 - .55 * (k - nowIndex) / Math.max(1, count - nowIndex) : .18 + .3 * k / Math.max(1, nowIndex);
            faded.copy(toward).lerp(base, fade); colours.set([faded.r, faded.g, faded.b], k * 3);
        }
        return colours;
    }
    // Line colours, dark and light Orbit view.
    const ink = { moon: ['#c9d1d9', '#5f6670'], earth: ['#e0c27a', '#8a6a2a'], track: ['#ffc766', '#b4691d'] };
    const inkFor = pair => pair[lineTheme === 'light' ? 1 : 0];
    function setFadedLine(target, points, colour, nowIndex) {
        const positions = new Float32Array(points.length * 3);
        points.forEach((point, k) => positions.set([point.x, point.y, point.z], k * 3));
        target.geometry.dispose();
        target.geometry = new LineGeometry().setPositions(positions).setColors(fadeColours(points.length, nowIndex, colour));
    }
    const moonOrbit = line(1.5), earthOrbit = line(1.4);
    scene.add(moonOrbit, earthOrbit);

    // Orbiting objects: marker, label, orbit, ground track and a line down to the ground for the Orbit view; the orbit
    // as a ring of dots for the backdrop.
    const orbiters = [];
    function addOrbiter({ id, name, label: shortName, norad, colour = '#91d8c3', lightColour = '#246c60', showTrack = true }) {
        const entry = { id, name, label: shortName || name, norad, colour, lightColour, showTrack, object: null, state: null, source: '', fetched: 0, trackAt: 0 };
        entry.dotMaps = [dotMap(colour), dotMap(lightColour)];
        entry.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: entry.dotMaps[0], sizeAttenuation: false, depthWrite: false }));
        entry.marker.scale.setScalar(.026); entry.marker.renderOrder = 3; entry.marker.visible = false; scene.add(entry.marker);
        entry.orbit = line(2.2); entry.track = line(1.8);
        earth.add(entry.track); scene.add(entry.orbit);
        entry.nadir = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: .45, depthWrite: false }));
        scene.add(entry.nadir);
        const dots = () => {
            const points = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, vertexColors: true, map: roundDot, transparent: true, depthWrite: false }));
            points.visible = false; scene.add(points); return points;
        };
        entry.dots = dots(); entry.ring = dots();
        entry.element = label('');
        entry.ready = loadElements(norad).then(({ tle, source, fetched }) => { entry.object = orbiter(name, tle[0], tle[1]); entry.source = source; entry.fetched = fetched; });
        orbiters.push(entry);
        return entry;
    }
    const iss = addOrbiter({ id: 'iss', name: 'ISS (ZARYA)', label: 'ISS', norad: 25544 });
    function refreshPaths(entry, date) {
        const period = entry.object.period;
        const orbit = orbitPath(entry.object, date, -period / 2, period / 2, 240).map(point => toScene(point));
        setFadedLine(entry.orbit, orbit, lineTheme === 'light' ? entry.lightColour : entry.colour, 120);
        if (entry.showTrack) setFadedLine(entry.track, groundTrack(entry.object, date, -45, 90, 270, earthRadius + 10).map(point => toScene(point)), inkFor(ink.track), 90);
        // Dots for the backdrop, bright ahead and dim behind: a third of a revolution round the station, fading out at both
        // ends so the far side of the orbit does not hook up over Earth's limb seen from close; and the whole revolution for
        // the backdrop seen from far out.
        const base = new THREE.Color(entry.colour);
        const fill = (target, points, level) => {
            const positions = new Float32Array(points.length * 3), colours = new Float32Array(points.length * 4);
            points.forEach((point, k) => {
                toScene(point, position); positions.set([position.x, position.y, position.z], k * 3);
                colours.set([base.r, base.g, base.b, level(k / (points.length - 1) * 2 - 1)], k * 4);
            });
            target.geometry.dispose();
            target.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3)).setAttribute('color', new THREE.BufferAttribute(colours, 4));
        };
        fill(entry.dots, orbitPath(entry.object, date, -period / 6, period / 6, 700), from => (from >= 0 ? 1 : .45) * (1 - THREE.MathUtils.smoothstep(Math.abs(from), .55, 1)));
        fill(entry.ring, orbitPath(entry.object, date, -period / 2, period / 2, 1024), from => from >= 0 ? 1 - .45 * from : .45 - .25 * -from);
        entry.trackAt = date.getTime();
    }

    // Time: live, or running ahead at a warp. `offset` is how far the shown time is ahead of the clock.
    const time = { offset: 0, warp: 1, date: new Date() };
    const position = new THREE.Vector3(), velocity = new THREE.Vector3(), towardEarth = new THREE.Vector3(), north = new THREE.Vector3(), side = new THREE.Vector3();
    const basis = new THREE.Matrix4();
    const paths = { moonAt: NaN, earthAt: NaN };
    let lit = 0;
    // `at`: draw the sky at that date instead (the Launch view replays a past launch); the orbiters then wait.
    function update(delta, at) {
        lastDelta = delta;
        if (time.warp !== 1 && !at) time.offset += delta * 1000 * (time.warp - 1);
        const date = time.date = at || new Date(Date.now() + time.offset);
        toScene(sunPosition(date), sun.position);
        uniforms.sunDirection.value.copy(sun.position).normalize();
        toScene(moonPosition(date), moon.position);
        sunlight.position.copy(sun.position);
        // Tidally locked: the map's centre (+x on the sphere) faces Earth, north up.
        towardEarth.copy(moon.position).negate().normalize();
        north.set(0, 1, 0).addScaledVector(towardEarth, -towardEarth.y).normalize();
        moon.quaternion.setFromRotationMatrix(basis.makeBasis(towardEarth, north, side.crossVectors(towardEarth, north)));
        earth.rotation.y = siderealAngle(date);
        if (!(Math.abs(date - paths.moonAt) < 3600000 * Math.max(1, time.warp / 60))) {
            setFadedLine(moonOrbit, moonPath(date, 240).map(point => toScene(point)), inkFor(ink.moon), 120); paths.moonAt = date.getTime(); lit = moonLit(date);
        }
        if (!(Math.abs(date - paths.earthAt) < 86400000)) { setFadedLine(earthOrbit, earthPath(date, 360).map(point => toScene(point)), inkFor(ink.earth), 180); paths.earthAt = date.getTime(); }
        for (const entry of orbiters) {
            if (!entry.object || at) continue;
            entry.state = stateAt(entry.object, date);
            if (!entry.state) { entry.marker.visible = false; continue; }
            toScene(entry.state.position, position);
            entry.marker.position.copy(position);
            const ends = entry.nadir.geometry.attributes.position;
            ends.setXYZ(0, position.x, position.y, position.z); towardEarth.copy(position).setLength(earthRadius + 10);
            ends.setXYZ(1, towardEarth.x, towardEarth.y, towardEarth.z); ends.needsUpdate = true;
            // Paths every 30 s of shown time (less often while time runs fast).
            if (Math.abs(date.getTime() - entry.trackAt) > Math.max(30000, time.warp * 250)) refreshPaths(entry, date);
        }
    }

    // Before drawing: what each view shows, the stars round the camera, and clipping planes that fit the scene from where
    // the camera is (the near plane a quarter of the way to the nearest surface, or closer than `nearest` km, the far
    // plane past Earth's orbit).
    const cameraDistance = new THREE.Vector3();
    // The Orbit view on paper (light) or black (dark): what shows against the background changes with it. Colours meant
    // for the paper are shown as given (no tone mapping); the dark sky keeps it.
    let appliedTheme = 'dark';
    const untoned = (material, on) => { if (material.toneMapped === on) { material.toneMapped = !on; material.needsUpdate = true; } };
    function applyTheme(theme) {
        const light = theme === 'light';
        appliedTheme = lineTheme = theme;
        stars.visible = !light;
        uniforms.mapLight.value = light ? 1 : 0;
        atmosphere.material.uniforms.additive.value = light ? 0 : 1; atmosphere.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
        // The Sun: a white-hot disc and glow added to black; an amber disc and halo laid on paper.
        sunDisc.material.color.set(light ? 0xe8962e : 0xfff6e0); untoned(sunDisc.material, light);
        sunGlow.material.color.set(light ? 0xf0a640 : 0xffffff); sunGlow.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending; untoned(sunGlow.material, light);
        earthMarker.material.color.set(light ? 0x2f6f9f : 0x6fa8dc); moonMarker.material.color.set(light ? 0x5f6670 : 0xc9ccd1);
        for (const material of [earthMarker.material, moonMarker.material, ...lineMaterials]) untoned(material, light);
        for (const entry of orbiters) {
            entry.marker.material.map = entry.dotMaps[light ? 1 : 0]; untoned(entry.marker.material, light);
            entry.nadir.material.color.set(light ? entry.lightColour : entry.colour); untoned(entry.nadir.material, light);
            entry.trackAt = -Infinity;   // its paths again, in the new colours
        }
        paths.moonAt = paths.earthAt = NaN;
        earthMap.setTheme(theme);
    }
    function prepare(camera, mode, nearest = Infinity) {
        earthTiles.group.visible = false;   // renderFrom alone shows them
        const orbitView = mode === 'orbit', fromEarth = camera.position.length();
        // The Orbit view's background (js/orbit/theme.js); the backdrop behind the station and the Launch view are dark.
        const theme = orbitView ? orbitTheme.name : 'dark';
        if (theme !== appliedTheme) applyTheme(theme);
        for (const entry of orbiters) {
            entry.marker.visible = orbitView && !!entry.state && fromEarth < 3e5;
            entry.orbit.visible = entry.nadir.visible = orbitView && fromEarth < 3e5;
            entry.track.visible = orbitView && entry.showTrack && fromEarth < 3e5;
            entry.dots.visible = entry.ring.visible = false;   // the backdrop picks one in renderBehind
        }
        moonOrbit.visible = orbitView && fromEarth > 1.2e5;
        earthOrbit.visible = orbitView && fromEarth > 4e6;
        // The atmosphere's glow sits 178 km up, a limb seen from afar; from lower down (the Launch view climbing through
        // 100-400 km) it would hang as a band over the horizon, so it settles toward 50 km as the camera comes down.
        atmosphere.scale.setScalar((1 + THREE.MathUtils.clamp(Math.max(0, (fromEarth - earthRadius) / 420) ** 1.5 * .028, .008, .028)) / 1.028);
        nearest = Math.min(nearest, fromEarth - earthRadius * 1.03, cameraDistance.subVectors(camera.position, moon.position).length() - moonRadius);
        camera.near = Math.max(.001, nearest * .25); camera.far = fromEarth + 3.2e8; camera.updateProjectionMatrix();
        stars.position.copy(camera.position); stars.scale.setScalar(camera.far * .9);
        // Markers stand in for Earth and the Moon once their discs shrink below a few pixels.
        const pixelsPerRadian = viewport.clientHeight / 2 / Math.tan(camera.fov * Math.PI / 360);
        for (const body of bodies) {
            if (!body.marker) continue;
            body.marker.position.copy(body.object.position);
            body.marker.visible = body.radius / cameraDistance.subVectors(camera.position, body.object.position).length() * pixelsPerRadian < 2.5;
        }
        // The map (Orbit view only): its own Earth, a quieter rim, no labels.
        const mapOn = orbitView, light = theme === 'light';
        uniforms.mapStyle.value = mapOn ? 1 : 0;
        atmosphere.visible = !(light && mapOn); atmosphere.material.uniforms.glow.value.copy(light ? paperGlow : mapOn ? mapGlow : photoGlow);
        earthMap.show(mapOn); viewport.classList.toggle('earth-map', mapOn);
        if (mapOn) earthMap.frame(lastDelta, camera, time.date);
    }
    // Labels beside their objects (Orbit view only), hidden when Earth is in the way or off screen.
    const projected = new THREE.Vector3(), toObject = new THREE.Vector3();
    function blockedByEarth(camera, point) {
        toObject.copy(point).sub(camera.position);
        const length = toObject.length(); toObject.divideScalar(length);
        const along = -camera.position.dot(toObject), closest = camera.position.clone().addScaledVector(toObject, along).length();
        return along > 0 && along < length && closest < earthRadius;
    }
    function placeLabel(camera, element, point, text, show, clearOfEarth = true) {
        if (show) { projected.copy(point).project(camera); show = projected.z < 1 && Math.abs(projected.x) < .97 && Math.abs(projected.y) < .95 && !(clearOfEarth && blockedByEarth(camera, point)); }
        element.hidden = !show;
        if (!show) return;
        if (element.textContent !== text) element.textContent = text;
        // Right of the object, or left of it where the right edge would cut the label off.
        const x = (projected.x * .5 + .5) * viewport.clientWidth, width = element.offsetWidth, left = x + 14 + width > viewport.clientWidth - 8 ? x - 14 - width : x + 14;
        element.style.transform = 'translate(' + left.toFixed(1) + 'px,' + ((-projected.y * .5 + .5) * viewport.clientHeight - 8).toFixed(1) + 'px)';
    }
    const million = km => (km / 1e6).toFixed(1) + ' million km';
    function placeLabels(camera, mode) {
        const orbitView = mode === 'orbit', fromEarth = camera.position.length();
        for (const entry of orbiters) placeLabel(camera, entry.element, entry.marker.position, entry.label + ' · ' + (entry.state ? entry.state.height.toFixed(0) : '–') + ' km', orbitView && entry.marker.visible);
        // From far enough out Earth and the Moon share a few pixels: one label for both.
        const earthOnScreen = projected.copy(earth.position).project(camera).clone(), moonOnScreen = projected.copy(moon.position).project(camera);
        const together = Math.hypot((earthOnScreen.x - moonOnScreen.x) * viewport.clientWidth, (earthOnScreen.y - moonOnScreen.y) * viewport.clientHeight) / 2 < 40;
        placeLabel(camera, bodies[0].element, earth.position, together ? 'EARTH & MOON' : 'EARTH', orbitView && fromEarth > 1.5e5, false);
        placeLabel(camera, bodies[1].element, moon.position, 'MOON · ' + Math.round(moon.position.length()).toLocaleString('en-US') + ' km · ' + Math.round(lit * 100) + '% lit', orbitView && !together);
        placeLabel(camera, bodies[2].element, sun.position, 'SUN · ' + million(sun.position.length()), orbitView);
    }
    function hideLabels() { for (const element of [...orbiters.map(entry => entry.element), ...bodies.map(body => body.element)]) element.hidden = true; }
    function resize(width, height) { for (const material of lineMaterials) material.resolution.set(width, height); earthMap.resize(width, height); }

    // The station's Earth backdrop, at true scale. The station is drawn with an orthographic camera; the sky behind it is
    // drawn by the perspective camera that shows the same picture at the station camera's target. Its eye sits back
    // along the view by the distance at which a 45° field of view spans the station's frame there, and its frustum is
    // shifted as the station's frame is, so the target falls on the same pixel in both and the station keeps its real
    // size against Earth, the Moon and the Sun.
    // - The station frame (starboard +x, zenith +y, aft +z) is the ISS's local vertical, local horizontal frame turned
    //   by its attitude (js/orbit/attitude.js: -XVV, end for end, as flown in November 2026, or ISS Live's): Earth
    //   stays below and the ground is the ground under the ISS now, sliding toward the station's forward end at -XVV.
    // - Framed close, the eye is a few hundred metres from the station, and Earth is what the crew see from 420 km: the
    //   horizon 20° below level and the ground sliding past at 7.7 km/s. Zoomed out, the eye pulls away: Earth shrinks
    //   to a globe once the frame is thousands of kilometres high, and the station to a dot (`marked`: the ISS marker and
    //   its label stand in for it). Panning moves the eye with the target, so close in the station slides over a
    //   distant Earth, and far out Earth moves with it.
    const backdropCamera = new THREE.PerspectiveCamera(45, 1, 1, 1e9), halfView = Math.tan(22.5 * Math.PI / 180);
    const zenith = new THREE.Vector3(), starboard = new THREE.Vector3(), aft = new THREE.Vector3(), frame = new THREE.Quaternion(), stationTurn = new THREE.Quaternion();
    const axes = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const look = new THREE.Vector3(), eye = new THREE.Vector3();
    // The station's frame in the sky: `position` (km) and the turn `frame` from station axes to sky axes.
    function stationFrame() {
        toScene(iss.state.position, position); toScene(iss.state.velocity, velocity);
        zenith.copy(position).normalize(); starboard.crossVectors(velocity, zenith).normalize(); aft.crossVectors(starboard, zenith);
        // The station's axes: row i of the attitude's turn gives axis i in the +XVV frame (starboard, zenith, aft).
        const turn = attitude.turn;
        axes.forEach((axis, i) => axis.set(0, 0, 0).addScaledVector(starboard, turn[3 * i]).addScaledVector(zenith, turn[3 * i + 1]).addScaledVector(aft, turn[3 * i + 2]));
        frame.setFromRotationMatrix(basis.makeBasis(axes[0], axes[1], axes[2]));
    }
    function renderBehind(stationCamera, target, width, height, marked) {
        if (!iss.state) return false;
        stationFrame();
        stationCamera.getWorldQuaternion(stationTurn);
        backdropCamera.quaternion.multiplyQuaternions(frame, stationTurn);
        // The station camera's frame at its target, in metres (OrthographicCamera keeps the frame's centre as it zooms).
        const halfWidth = (stationCamera.right - stationCamera.left) / (2 * stationCamera.zoom), halfHeight = (stationCamera.top - stationCamera.bottom) / (2 * stationCamera.zoom);
        const centreX = (stationCamera.right + stationCamera.left) / 2, centreY = (stationCamera.top + stationCamera.bottom) / 2;
        const distance = halfHeight / halfView;   // metres, target to eye
        stationCamera.getWorldDirection(look);
        eye.copy(target).addScaledVector(look, -distance).multiplyScalar(.001).applyQuaternion(frame);
        backdropCamera.position.copy(position).add(eye);
        backdropCamera.aspect = halfWidth / halfHeight;
        backdropCamera.setViewOffset(width, height, centreX / (2 * halfWidth) * width, -centreY / (2 * halfHeight) * height, width, height);
        const kilometres = distance / 1000;
        prepare(backdropCamera, 'backdrop', marked ? kilometres * 2 : Infinity);
        for (const entry of orbiters) { entry.dots.visible = !!entry.state && kilometres <= 8000; entry.ring.visible = !!entry.state && kilometres > 8000; }
        // Far enough out for the Moon, Earth, the Moon and the Sun are named as in the Orbit view, and the ISS, a few
        // pixels off Earth's limb by then, gives way to Earth's own label.
        const fromEarth = backdropCamera.position.length(), named = fromEarth > 1.5e5;
        iss.marker.visible = marked && !named;
        backdropCamera.updateMatrixWorld();
        placeLabel(backdropCamera, iss.element, iss.marker.position, 'ISS · ' + iss.state.height.toFixed(0) + ' km', iss.marker.visible);
        placeLabel(backdropCamera, bodies[0].element, earth.position, 'EARTH', named, false);
        placeLabel(backdropCamera, bodies[1].element, moon.position, 'MOON · ' + Math.round(moon.position.length()).toLocaleString('en-US') + ' km · ' + Math.round(lit * 100) + '% lit', named);
        placeLabel(backdropCamera, bodies[2].element, sun.position, 'SUN · ' + million(sun.position.length()), named);
        resize(width, height);
        renderer.render(scene, backdropCamera);
        return true;
    }
    // The sky as an eye aboard the station sees it (the Cupola view): `stationCamera` is a perspective camera in the
    // station's scene (metres); the same eye, turned and placed by the station's frame, draws Earth here, with the
    // day's picture in tiles over the ground it looks at (js/orbit/earth-tiles.js).
    const insideCamera = new THREE.PerspectiveCamera(60, 1, 1, 1e9), lookEast = new THREE.Vector3(), lookNorth = new THREE.Vector3();
    const inside = { bearing: 0, off: 0 };   // where that eye looks: compass bearing over the ground and angle off straight down, degrees
    function renderFrom(stationCamera, width, height, delta) {
        if (!iss.state) return false;
        stationFrame();
        stationCamera.getWorldQuaternion(stationTurn);
        insideCamera.quaternion.multiplyQuaternions(frame, stationTurn);
        stationCamera.getWorldPosition(eye);
        insideCamera.position.copy(position).add(eye.multiplyScalar(.001).applyQuaternion(frame));
        insideCamera.fov = stationCamera.fov; insideCamera.aspect = stationCamera.aspect;
        const offset = stationCamera.view;
        if (offset?.enabled) insideCamera.setViewOffset(offset.fullWidth, offset.fullHeight, offset.offsetX, offset.offsetY, offset.width, offset.height);
        else insideCamera.clearViewOffset();
        prepare(insideCamera, 'backdrop');
        iss.marker.visible = false; hideLabels();
        insideCamera.getWorldDirection(look); lookEast.set(0, 1, 0).cross(zenith).normalize(); lookNorth.crossVectors(zenith, lookEast);
        inside.off = Math.acos(THREE.MathUtils.clamp(-look.dot(zenith), -1, 1)) * 180 / Math.PI;
        inside.bearing = (Math.atan2(look.dot(lookEast), look.dot(lookNorth)) * 180 / Math.PI + 360) % 360;
        insideCamera.updateMatrixWorld();
        earthTiles.group.visible = true; earthTiles.frame(insideCamera, height, delta);
        resize(width, height);
        renderer.render(scene, insideCamera);
        return true;
    }
    // Nothing shows the sky (the station without its Earth backdrop): the GPU's copies of its maps and meshes are let
    // go, about 130 MB with the 4K maps. Each is uploaded again from the copy kept here the next time it is drawn.
    function release() {
        scene.traverse(object => {
            if (object.geometry && !object.isSprite) object.geometry.dispose();
            for (const surface of [].concat(object.material || [])) {
                for (const value of Object.values(surface)) if (value?.isTexture) value.dispose();
                for (const uniform of Object.values(surface.uniforms || {})) if (uniform.value?.isTexture) uniform.value.dispose();
            }
        });
    }
    return { scene, earth, moon, sun, iss, orbiters, addOrbiter, time, update, prepare, placeLabels, hideLabels, resize, renderBehind, renderFrom, inside, tiles: earthTiles, release, moonLit: () => Math.round(lit * 100), ready: iss.ready,
        mapStatus: () => earthMap.status(), mapLegend: () => earthMap.legend(), mapLayers: earthMap.layers, setMapLayer: earthMap.setLayer };
}
