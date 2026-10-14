// The ground round LC-39A for the Launch view: aerial imagery in four nested rings of map tiles, the pad's towers,
// the exhaust cloud at liftoff and the sky seen from inside the atmosphere. Metres in the pad's local frame (x east,
// y up, z south), the ground curved with the Earth.
// - Imagery: USGS National Map orthoimagery (public domain) at about 2 m, 17 m and 130 m a pixel round the pad, and
//   NASA's Blue Marble (GIBS, public domain) at about 1 km out to 1,100 km, its edge fading into the globe's own map; outside the US the USGS tiles are
//   transparent and the coarser ring shows through. Tiles load from those servers when the view first opens.
// - Structures are simplified: the fixed service structure with its lightning mast and the crew access arm swung back
//   (as at liftoff), the transporter-erector leaning back from the rocket, and the launch mount.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { launchSite, padFrame } from '../sim/ascent.js';

const earthRadius = 6371000, rad = Math.PI / 180;
const usgs = (z, x, y) => 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/' + z + '/' + y + '/' + x;
const gibs = (z, x, y) => 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/' + z + '/' + y + '/' + x + '.jpeg';
// Outer ring first: each ring covers 4 × 4 tiles round the pad.
const rings = [{ zoom: 7, url: gibs, segments: 16, fade: true }, { zoom: 10, url: usgs, segments: 8 }, { zoom: 13, url: usgs, segments: 3 }, { zoom: 16, url: usgs, segments: 2 }];
export const mountHeight = 6;   // the rocket stands on the launch mount, its engines 6 m above the pad deck

export function createGround() {
    const group = new THREE.Group(), pad = padFrame();
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    // Latitude and longitude (degrees) on the sphere to the pad's frame.
    function local(latitude, longitude, target) {
        const phi = latitude * rad, lambda = longitude * rad;
        const p = [earthRadius * Math.cos(phi) * Math.cos(lambda) - pad.position[0], earthRadius * Math.cos(phi) * Math.sin(lambda) - pad.position[1], earthRadius * Math.sin(phi) - pad.position[2]];
        return target.set(dot(p, pad.east), dot(p, pad.up), dot(p, pad.south));
    }
    const loader = new THREE.TextureLoader(), point = new THREE.Vector3();
    let pending = 0, failed = 0;
    const status = { get loading() { return pending; }, get failed() { return failed; } };
    rings.forEach(({ zoom, url, segments, fade }, level) => {
        const n = 2 ** zoom, tileX = (launchSite.longitude + 180) / 360 * n;
        const phi = launchSite.latitude * rad, tileY = (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2 * n;
        const x0 = Math.round(tileX) - 2, y0 = Math.round(tileY) - 2;
        for (let tx = x0; tx < x0 + 4; tx++) for (let ty = y0; ty < y0 + 4; ty++) {
            const positions = [], uvs = [], colours = [];
            const indices = [];
            for (let j = 0; j <= segments; j++) for (let i = 0; i <= segments; i++) {
                const u = i / segments, v = j / segments;
                const longitude = (tx + u) / n * 360 - 180, latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + v) / n))) / rad;
                local(latitude, longitude, point); positions.push(point.x, point.y, point.z); uvs.push(u, 1 - v);
                // The outermost ring thins out over its last third into the globe's map beyond it.
                const edge = Math.max(Math.abs(tx + u - x0 - 2), Math.abs(ty + v - y0 - 2)) / 2;
                colours.push(1, 1, 1, fade ? 1 - THREE.MathUtils.smoothstep(edge, .66, 1) : 1);
            }
            for (let j = 0; j < segments; j++) for (let i = 0; i < segments; i++) {
                const a = j * (segments + 1) + i, b = a + 1, c = a + segments + 1, d = c + 1;
                indices.push(a, c, b, b, c, d);
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geometry.setIndex(indices);
            if (fade) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 4));
            // Inner rings draw over outer ones; transparent pixels (no USGS coverage) leave the ring below showing.
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 * level, polygonOffsetUnits: -8 * level,
                ...(fade ? { vertexColors: true, transparent: true, depthWrite: false } : { alphaTest: .5 }) });
            const mesh = new THREE.Mesh(geometry, material); mesh.visible = false; mesh.renderOrder = -50 + level; mesh.frustumCulled = false;
            group.add(mesh);
            pending++;
            loader.load(url(zoom, tx, ty), texture => {
                texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; material.map = texture; material.needsUpdate = true; mesh.visible = true; pending--;
            }, undefined, () => { pending--; failed++; });
        }
    });

    // Structures. Steel lattice as merged boxes and rods.
    const pieces = new Map();
    const add = (colour, geometry) => { if (!pieces.has(colour)) pieces.set(colour, []); pieces.get(colour).push(geometry); };
    const box = (colour, [x, y, z], [w, h, d], rotation = [0, 0, 0]) => add(colour, new THREE.BoxGeometry(w, h, d).rotateX(rotation[0]).rotateY(rotation[1]).rotateZ(rotation[2]).translate(x, y, z));
    const rod = (colour, a, b, radius) => {
        const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), length = start.distanceTo(end);
        add(colour, new THREE.CylinderGeometry(radius, radius, length, 6).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize())).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2));
    };
    const steel = 0x8e9396, white = 0xe8e9e6, dark = 0x3b3f44, concrete = 0xb9b6ad;
    // Launch mount over the flame trench.
    box(concrete, [0, mountHeight / 2 - .5, 0], [14, mountHeight - 1, 14]);
    box(dark, [0, mountHeight - .3, 0], [7, .6, 7]);
    // Fixed service structure: 10 m square, 80 m to the roof, a 40 m mast above it.
    const tower = [-24, 0, 4], half = 5, top = 80;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(steel, [tower[0] + sx * half, top / 2, tower[2] + sz * half], [.9, top, .9]);
    for (let y = 8; y <= top; y += 8) {
        for (const s of [-1, 1]) { box(steel, [tower[0], y, tower[2] + s * half], [2 * half, .5, .5]); box(steel, [tower[0] + s * half, y, tower[2]], [.5, .5, 2 * half]); }
        for (const s of [-1, 1]) {
            rod(steel, [tower[0] - half, y - 8, tower[2] + s * half], [tower[0] + half, y, tower[2] + s * half], .18);
            rod(steel, [tower[0] + s * half, y - 8, tower[2] - half], [tower[0] + s * half, y, tower[2] + half], .18);
        }
        box(steel, [tower[0], y - .2, tower[2]], [2 * half, .25, 2 * half]);
    }
    rod(steel, [tower[0], top, tower[2]], [tower[0], top + 40, tower[2]], .45);
    // Crew access arm, swung back along the tower's side, with the white room at its end.
    box(white, [tower[0] + half + 1.5, 64, tower[2] - half - 8], [3, 3.2, 16]);
    box(white, [tower[0] + half + 1.5, 64, tower[2] - half - 17.5], [4, 4, 4]);
    // Transporter-erector, leaning back from the rocket after the clamps open.
    const lean = -.05;
    for (const s of [-1, 1]) box(dark, [6.2, 31, s * 2.4], [.9, 62, .9], [0, 0, lean]);
    for (let y = 4; y < 62; y += 6) box(dark, [6.2 - y * Math.sin(-lean), y, 0], [.6, .45, 5.2]);
    const structures = new THREE.Group();
    for (const [colour, geometries] of pieces) structures.add(new THREE.Mesh(mergeGeometries(geometries, false), new THREE.MeshStandardMaterial({ color: colour, roughness: .75, metalness: .2 })));
    group.add(structures);

    // Exhaust cloud at liftoff: puffs leave the flame trench northward, rise, swell and thin.
    const smokeMap = (() => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; const g = canvas.getContext('2d');
        const glow = g.createRadialGradient(32, 32, 0, 32, 32, 32); glow.addColorStop(0, 'rgba(255,255,255,.9)'); glow.addColorStop(.5, 'rgba(255,255,255,.45)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = glow; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(canvas);
    })();
    let seed = 7; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const puffs = Array.from({ length: 90 }, () => {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeMap, color: 0xe9e6e0, transparent: true, depthWrite: false }));
        sprite.renderOrder = 4; group.add(sprite);
        const side = random() < .75 ? -1 : 1;   // most of the exhaust leaves by the trench's north end
        return { sprite, born: random() * 16 - 2.5, speed: 22 + random() * 26, heading: side * (1 + (random() - .5) * .5), drift: (random() - .5) * .6, rise: 2 + random() * 5, size: 10 + random() * 14 };
    });
    function updateSmoke(mission, light) {
        for (const puff of puffs) {
            const age = mission - puff.born;
            puff.sprite.visible = age > 0 && age < 70;
            if (!puff.sprite.visible) continue;
            const travel = puff.speed * 9 * (1 - Math.exp(-age / 9));   // slows as it spreads
            puff.sprite.position.set(travel * puff.drift, 4 + puff.rise * age * .8 + Math.sqrt(age) * 3, travel * -Math.sign(puff.heading) * Math.abs(puff.heading) * .8);
            puff.sprite.scale.setScalar(puff.size * (1 + age * .55));
            puff.sprite.material.opacity = Math.min(1, age * 2) * Math.max(0, 1 - age / 70) * .85;
            puff.sprite.material.color.setScalar(.25 + .7 * light);
        }
    }

    // The sky from inside the atmosphere: blue overhead, paler at the horizon, a glow round the Sun; it thins out on the
    // way up and is gone by about 60 km, leaving space (drawn behind by the real sky).
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: { sun: { value: new THREE.Vector3(0, 1, 0) }, up: { value: new THREE.Vector3(0, 1, 0) }, thickness: { value: 1 }, daylight: { value: 1 } },
        vertexShader: 'varying vec3 vDirection; void main() { vDirection = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 sun; uniform vec3 up; uniform float thickness; uniform float daylight; varying vec3 vDirection;
            void main() {
                vec3 direction = normalize(vDirection);
                float elevation = dot(direction, up);
                vec3 zenith = mix(vec3(.03, .07, .2), vec3(.16, .36, .78), thickness);
                vec3 horizon = mix(vec3(.18, .3, .55), vec3(.62, .76, .92), thickness);
                vec3 colour = mix(horizon, zenith, pow(clamp(elevation, 0., 1.), .45));
                float toSun = max(dot(direction, sun), 0.);
                colour += vec3(1., .95, .85) * (pow(toSun, 600.) * 4. + pow(toSun, 12.) * .25 * thickness);
                gl_FragColor = vec4(colour * daylight, clamp(thickness * 1.15, 0., 1.));
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`,
        side: THREE.BackSide, depthTest: false, depthWrite: false, transparent: true
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), skyMaterial); sky.renderOrder = -100; sky.frustumCulled = false;
    // Atmosphere for a camera at `altitude` metres, with the Sun `sunElevation` (sine) above its horizon.
    function updateSky(camera, altitude, sunDirection, sunElevation) {
        sky.position.copy(camera.position);
        const thickness = Math.max(0, 1 - altitude / 60000) ** 2.2;
        skyMaterial.uniforms.thickness.value = thickness;
        skyMaterial.uniforms.sun.value.copy(sunDirection);
        skyMaterial.uniforms.up.value.set(camera.position.x, camera.position.y + earthRadius, camera.position.z).normalize();
        skyMaterial.uniforms.daylight.value = THREE.MathUtils.clamp(.15 + sunElevation * 3, .12, 1);
        sky.visible = thickness > .003;
    }
    // Daylight on the imagery (its own lighting is baked in): dim it when the Sun is low.
    function setDaylight(light) { for (const mesh of group.children) if (mesh.material?.isMeshBasicMaterial) mesh.material.color.setScalar(light); }

    return { group, sky, updateSky, updateSmoke, setDaylight, status };
}
