// Minimal Earth for the Orbit view (always, in place of the photographed Earth): a plain globe with only coastlines
// and country borders, no clouds and no text; the surface wind at the shown time, as a colour for its speed and as
// streaks drifting with it; and the tropical cyclones now active, each a swirl mark with its track so far (solid) and
// its forecast (dashed), coloured by strength, inside a faint cone of uncertainty. It has two looks, for the Orbit
// view's two backgrounds (js/orbit/theme.js): on the page's paper (light) and on black (dark). Everything hangs on the
// globe, in its own Earth-fixed frame (y north, as js/orbit/sky.js maps it), and loads the first time the map shows.
// - Coastlines and borders: Natural Earth 1:50m through world-atlas (TopoJSON). An arc two countries share is a land
//   border; an arc one country uses alone is coast.
// - Wind: NOAA GFS 10 m wind on a 1° grid, the three-hourly step nearest the shown time, from NOAA's copy on AWS
//   (js/orbit/gfs.js: two GRIB2 fields, about 150 kB); if that fails, from the PacIOOS ERDDAP server (OPeNDAP binary,
//   about 290 kB gzipped). The two do not agree exactly (about 1 m/s rms at the same time). Streaks are seeded over the part of the globe on screen, one for
//   every 150 square pixels of it, and move 3 pixels a second for each m/s, so they look alike from a whole globe down
//   to a close view: from about 80,000 times faster than the air (whole globe) to 4,000 times (closest). The speed
//   colours the globe through a palette up to 30 m/s (stronger wind keeps the last colour); the panel shows it.
// - Rain: NOAA GFS surface precipitation rate, same sources and step, 0.5° grid (about 210 kB from AWS, 257 kB from
//   PacIOOS): the model's rate, a mean over its last 3-6 hour interval, not rain observed. Coloured on a
//   log scale from `rainLow` (below it the layer is clear) to `rainTop` mm/h, over the wind colour when both show.
// - Layers: wind (colour and streaks) and rain switch on and off apart (setLayer); a layer switched off is not fetched.
// - Storms: GDACS (European Commission JRC and the United Nations), from JTWC and NHC advisories; reloaded every half
//   hour. Under the official forecast, each storm's 51 tracks from the newest ECMWF ensemble run (js/orbit/storm-ensemble.js,
//   ECMWF open data, CC BY 4.0) for the next 5 days, thin and faint, coloured by each run's strongest wind at each step:
//   where they bunch the forecast is sure, where they fan out it is not.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { loadEnsemble } from './storm-ensemble.js';
import { loadGfs } from './gfs.js?v=69d98d0b25';
import { quality } from '../core/quality.js';
import { earthRadius } from '../sim/orbit.js';

const bordersSource = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json';
const windSource = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ncep_global.dods?';
const stormSource = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC&alertlevel=green;orange;red';
const degree = Math.PI / 180, threeHours = 3 * 3600000;
// Heights above the surface, km: clear of the sphere's flat facets (they sag up to 2.5 km below it), and in this order.
const speedRadius = earthRadius + 1, rainRadius = earthRadius + 1.5, bordersRadius = earthRadius + 2, streaksRadius = earthRadius + 3, equatorRadius = earthRadius + 4, coneRadius = earthRadius + 5, ensembleRadius = earthRadius + 6, trackRadius = earthRadius + 7;
// Ensemble tracks: how far ahead (hours), and the strongest wind (m/s) where a storm turns tropical storm (34 kt) and
// typhoon or hurricane (64 kt).
const ensembleHours = 120, stormWind = 17.5, typhoonWind = 33;

// Latitude and longitude (degrees) to the globe's own frame, `radius` km from the centre.
export function onGlobe(latitude, longitude, radius, target = new THREE.Vector3()) {
    const phi = latitude * degree, lambda = longitude * degree, across = Math.cos(phi);
    return target.set(across * Math.cos(lambda) * radius, Math.sin(phi) * radius, -across * Math.sin(lambda) * radius);
}
// [longitude, latitude] points with more put in so that none is more than `step` degrees from the next: the chords
// between them then stay on the surface, and a line follows the map as drawn (a border along a parallel stays on it).
function densify(points, step) {
    const out = [points[0]];
    for (let k = 1; k < points.length; k++) {
        const [lon0, lat0] = points[k - 1], [lon1, lat1] = points[k];
        const across = ((lon1 - lon0 + 540) % 360) - 180, up = lat1 - lat0;
        const parts = Math.max(1, Math.ceil(Math.max(Math.abs(across), Math.abs(up)) / step));
        for (let s = 1; s <= parts; s++) out.push([lon0 + across * s / parts, lat0 + up * s / parts]);
    }
    return out;
}

// The swirl drawn for a tropical cyclone: a ring with two arms winding out clockwise, as the bands of a storm turning
// counterclockwise do (northern hemisphere); mirrored for the south.
function swirl(south) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 4.5; g.lineCap = 'round';
    g.beginPath(); g.arc(32, 32, 8.5, 0, Math.PI * 2); g.stroke();
    for (const start of [90, 270]) {
        g.beginPath();
        for (let t = 0; t <= 1.0001; t += .1) {
            const angle = (start - 115 * t) * degree, radius = 8.5 + 15 * t, x = Math.cos(angle) * radius * (south ? -1 : 1), y = Math.sin(angle) * radius;
            t === 0 ? g.moveTo(32 + x, 32 - y) : g.lineTo(32 + x, 32 - y);
        }
        g.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
// The map on black (dark Orbit view) and on the page's paper (light, the default; js/orbit/theme.js): coastlines and
// borders (colour, opacity); the equator; streaks (colour; added to black, laid on paper); storms by strength on GDACS tracks
// (tropical depression, tropical storm, hurricane / typhoon) and their cones; the wind speed palette (m/s, colour) and
// how much darker the night side is.
const windTop = 30;   // m/s at the end of the palette; stronger wind keeps its last colour
const rainLow = .1, rainTop = 20, rainStride = 1;   // mm/h: clear below rainLow, last colour from rainTop; grid step in 0.5° cells
const resolutionOf = stride => stride === 1 ? '0p50' : '1p00';   // the GFS file on AWS with that grid
const looks = {
    dark: {
        coast: [0xd4dde6, .78], border: [0x8996a4, .5], equator: 0xff4a3a, streak: [.9, .95, 1], additive: true,
        storm: { TD: '#ffd9a8', TS: '#ffa25c', HU: '#ff5a3c' }, cone: ['#ffb27a', .3], ensemble: .3,
        wind: [[0, '#0b1622'], [2, '#102639'], [4, '#15394f'], [6, '#1b5160'], [8, '#23695f'], [10, '#5c7d43'], [13, '#9a8a3c'], [16, '#b9733a'], [20, '#b44a3d'], [25, '#943766'], [30, '#b29ad6']],
        rain: [[.1, '#2d64ac'], [1, '#4596e6'], [5, '#9fd2ff'], [20, '#f4f8ff']], rainOpacity: [.5, .95],
        night: .5
    },
    light: {
        coast: [0x2f302b, .85], border: [0x857e6d, .6], equator: 0xc8281e, streak: [.1, .11, .12], additive: false,
        storm: { TD: '#b9813a', TS: '#c45a1f', HU: '#a8261a' }, cone: ['#a95a28', .45], ensemble: .32,
        wind: [[0, '#ebe4d4'], [2, '#e2e1d0'], [4, '#cddccf'], [6, '#acd0c6'], [8, '#8abeb8'], [10, '#d6c87f'], [13, '#e0a65d'], [16, '#d47944'], [20, '#bb4a39'], [25, '#8f2f4c'], [30, '#5c2350']],
        rain: [[.1, '#8fb6dc'], [1, '#4a82c4'], [5, '#24489a'], [20, '#4b2577']], rainOpacity: [.55, .95],
        night: .14
    }
};
// Where a rain rate (mm/h) falls on its log scale, 0 to 1.
const rainPlace = rate => Math.log(rate / rainLow) / Math.log(rainTop / rainLow);
function paletteTexture(stops, place = speed => speed / windTop) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 1;
    const g = canvas.getContext('2d'), gradient = g.createLinearGradient(0, 0, 256, 0);
    for (const [value, colour] of stops) gradient.addColorStop(place(value), colour);
    g.fillStyle = gradient; g.fillRect(0, 0, 256, 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = false; texture.minFilter = texture.magFilter = THREE.LinearFilter;
    return texture;
}

export function createEarthMap(earth) {
    const group = new THREE.Group(); group.visible = false; earth.add(group);
    const lineMaterials = [];
    let look = looks.dark;
    const layers = { wind: true, rain: false };
    const state = { borders: 'idle', wind: 'idle', windTime: null, windStep: NaN, windAsked: -Infinity, rain: 'idle', rainTime: null, rainStep: NaN, rainAsked: -Infinity, storms: 'idle', stormsAt: -Infinity, stormCount: 0, ensemble: 'idle', ensembleAt: -Infinity, ensembleRun: null, ensembleCount: 0 };

    // Coastlines stronger than land borders.
    const outlines = { coast: null, border: null };
    function paintOutlines() {
        for (const kind of ['coast', 'border']) if (outlines[kind]) { outlines[kind].color.set(look[kind][0]); outlines[kind].opacity = look[kind][1]; }
    }
    async function loadBorders() {
        state.borders = 'loading';
        try {
            const topology = await (await fetch(bordersSource)).json();
            const [scaleX, scaleY] = topology.transform.scale, [moveX, moveY] = topology.transform.translate;
            const arcs = topology.arcs.map(arc => { let x = 0, y = 0; return arc.map(([dx, dy]) => [(x += dx) * scaleX + moveX, (y += dy) * scaleY + moveY]); });
            const uses = new Uint8Array(arcs.length);
            const count = list => { for (const item of list) Array.isArray(item) ? count(item) : uses[item < 0 ? ~item : item]++; };
            for (const country of topology.objects.countries.geometries) if (country.arcs) count(country.arcs);
            const coast = [], border = [], point = new THREE.Vector3();
            arcs.forEach((arc, index) => {
                const target = uses[index] > 1 ? border : coast;
                for (let k = 1; k < arc.length; k++) {
                    const [lon0, lat0] = arc[k - 1], [lon1, lat1] = arc[k];
                    // Edges of the flat map, not of any country: the cut along the 180° meridian, the South Pole's edge.
                    if ((Math.abs(lon0) > 179.99 && Math.abs(lon1) > 179.99) || (lat0 < -89.9 && lat1 < -89.9)) continue;
                    const piece = densify([arc[k - 1], arc[k]], .5);
                    for (let s = 1; s < piece.length; s++) for (const [lon, lat] of [piece[s - 1], piece[s]]) { onGlobe(lat, lon, bordersRadius, point); target.push(point.x, point.y, point.z); }
                }
            });
            const lines = (positions, kind) => {
                const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)),
                    new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
                lines.renderOrder = 1; group.add(lines); outlines[kind] = lines.material;
            };
            lines(coast, 'coast'); lines(border, 'border'); paintOutlines();
            state.borders = 'ready';
        } catch (error) { state.borders = 'failed'; console.warn('Earth map: borders unavailable', error); }
    }

    // GFS fields at one step from the ERDDAP server: { fields: [Float32Array], time }, each field rows from 90°N to 90°S
    // by columns from 0° east, `stride` 0.5° cells apart (2: 181 × 360).
    async function loadGrid(step, names, stride) {
        const time = new Date(step).toISOString().slice(0, 19) + 'Z', grid = '[(' + time + ')][(90):' + stride + ':(-90)][(0):' + stride + ':(359.5)]';
        const response = await fetch(windSource + encodeURIComponent(names.map(name => name + grid).join(',')));
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const buffer = await response.arrayBuffer(), bytes = new Uint8Array(buffer), marker = [10, 68, 97, 116, 97, 58, 10];   // "\nData:\n"
        let offset = -1;
        for (let k = 0; k < Math.min(bytes.length, 8192) && offset < 0; k++) if (marker.every((byte, m) => bytes[k + m] === byte)) offset = k + marker.length;
        if (offset < 0) throw new Error('no data block');
        // OPeNDAP binary (XDR, big-endian): each array is its length twice, then the values; each grid is its array,
        // then its time, latitude and longitude maps.
        const view = new DataView(buffer);
        const floats = () => { const n = view.getUint32(offset), out = new Float32Array(n); offset += 8; for (let k = 0; k < n; k++) out[k] = view.getFloat32(offset + k * 4); offset += n * 4; return out; };
        const doubles = () => { const n = view.getUint32(offset), out = new Float64Array(n); offset += 8; for (let k = 0; k < n; k++) out[k] = view.getFloat64(offset + k * 8); offset += n * 8; return out; };
        const rows = 360 / stride + 1, columns = 720 / stride, fields = [];
        let times = null;
        for (const name of names) {
            const field = floats(), at = doubles(); doubles(); doubles();
            if (field.length !== rows * columns) throw new Error('unexpected grid ' + name + ' ' + field.length);
            fields.push(field); times ||= at;
        }
        return { fields, time: new Date(times[0] * 1000) };
    }

    // GFS fields: from AWS, else PacIOOS. { fields, time, from }, `from` naming the run and the source for the panel.
    async function loadFields(step, names, stride) {
        try {
            const grid = await loadGfs(step, names, resolutionOf(stride));
            return { ...grid, from: 'run ' + pad(grid.run.getUTCHours()) + 'Z ' + grid.run.getUTCDate() + ' ' + grid.run.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }) + ', AWS' };
        } catch (error) {
            console.warn('Earth map: GFS on AWS unavailable, trying PacIOOS', error);
            return { ...await loadGrid(step, names, stride), from: 'PacIOOS' };
        }
    }

    // Wind grid: u (east) and v (north), m/s, 181 rows from 90°N to 90°S by 360 columns from 0° to 359°E.
    let windU = null, windV = null, sampledU = 0, sampledV = 0;
    async function loadWind(step) {
        state.windStep = step; state.windAsked = performance.now(); state.wind = windU ? state.wind : 'loading';
        try {
            const { fields: [u, v], time, from } = await loadFields(step, ['ugrd10m', 'vgrd10m'], 2);
            windU = u; windV = v; state.windTime = time; state.windFrom = from; state.wind = 'ready';
            paintSpeed();
        } catch (error) {
            // Keep any grid already shown; try again in a minute.
            if (!windU) state.wind = 'failed';
            state.windAsked = performance.now() + 40000; console.warn('Earth map: wind unavailable', error);
        }
    }
    function sample(latitude, longitude) {
        const row = Math.min(179.999, Math.max(0, 90 - latitude)), column = (longitude + 360) % 360;
        const r = Math.floor(row), c = Math.floor(column) % 360, fr = row - r, fc = column - Math.floor(column), c1 = (c + 1) % 360;
        const i00 = r * 360 + c, i01 = r * 360 + c1, i10 = i00 + 360, i11 = i01 + 360;
        sampledU = (windU[i00] + (windU[i01] - windU[i00]) * fc) * (1 - fr) + (windU[i10] + (windU[i11] - windU[i10]) * fc) * fr;
        sampledV = (windV[i00] + (windV[i01] - windV[i00]) * fc) * (1 - fr) + (windV[i10] + (windV[i11] - windV[i10]) * fc) * fr;
    }

    // Wind speed as colour, under everything else: a shell 1 km above the globe (the globe's own facets, scaled, so it
    // stays over them) coloured from a 1° speed map through the look's palette, a little darker by night.
    const speedData = new Uint8Array(360 * 180);
    const speedMap = new THREE.DataTexture(speedData, 360, 180, THREE.RedFormat, THREE.UnsignedByteType);
    speedMap.wrapS = THREE.RepeatWrapping; speedMap.minFilter = speedMap.magFilter = THREE.LinearFilter; speedMap.generateMipmaps = false;
    const palettes = { dark: paletteTexture(looks.dark.wind), light: paletteTexture(looks.light.wind) };
    const speedLayer = new THREE.Mesh(earth.geometry, new THREE.ShaderMaterial({
        uniforms: { speedMap: { value: speedMap }, palette: { value: palettes.dark }, sunDirection: { value: earth.material.uniforms.sunDirection.value }, night: { value: looks.dark.night } },
        vertexShader: 'varying vec2 vUv; varying vec3 vNormalW; void main() { vUv = uv; vNormalW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: `uniform sampler2D speedMap, palette; uniform vec3 sunDirection; uniform float night; varying vec2 vUv; varying vec3 vNormalW;
            void main() {
                vec3 colour = texture2D(palette, vec2(texture2D(speedMap, vUv).r, .5)).rgb;
                float day = smoothstep(-.1, .16, dot(normalize(vNormalW), sunDirection));
                gl_FragColor = vec4(colour * (1. - night * (1. - day)), 1.);
                #include <colorspace_fragment>
            }`
    }));
    speedLayer.scale.setScalar(speedRadius / earthRadius); speedLayer.visible = false; speedLayer.raycast = () => {}; group.add(speedLayer);
    // Texel centres from 179.5° W and 89.5° S, the way the sphere's map runs (u from 180° W, v from the South Pole).
    function paintSpeed() {
        for (let row = 0; row < 180; row++) for (let column = 0; column < 360; column++) {
            sample(row - 89.5, column - 179.5);
            speedData[row * 360 + column] = Math.min(255, Math.round(Math.sqrt(sampledU * sampledU + sampledV * sampledV) / windTop * 255));
        }
        speedMap.needsUpdate = true;
    }

    // Rain as colour over the wind's: a shell a little above it, clear where it is dry, the rate's place on the log
    // scale in one byte (0 dry). The grid as fetched, one texel to a grid point, 90°N row last (v runs from the south).
    const rainColumns = 720 / rainStride, rainRows = 360 / rainStride + 1, rainData = new Uint8Array(rainColumns * rainRows);
    const rainMap = new THREE.DataTexture(rainData, rainColumns, rainRows, THREE.RedFormat, THREE.UnsignedByteType);
    rainMap.wrapS = THREE.RepeatWrapping; rainMap.minFilter = rainMap.magFilter = THREE.LinearFilter; rainMap.generateMipmaps = false;
    const rainPalettes = { dark: paletteTexture(looks.dark.rain, rainPlace), light: paletteTexture(looks.light.rain, rainPlace) };
    const rainLayer = new THREE.Mesh(earth.geometry, new THREE.ShaderMaterial({
        uniforms: { rainMap: { value: rainMap }, palette: { value: rainPalettes.dark }, sunDirection: { value: earth.material.uniforms.sunDirection.value }, night: { value: looks.dark.night },
            opacity: { value: new THREE.Vector2(...looks.dark.rainOpacity) }, columns: { value: rainColumns }, rows: { value: rainRows } },
        vertexShader: 'varying vec2 vUv; varying vec3 vNormalW; void main() { vUv = uv; vNormalW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        // The sphere's u runs from 180° W, the grid's columns from 0°: half a turn round. v from the South Pole to the
        // North, texel centres on the grid's points (the poles' rows sit on the texture's edges).
        fragmentShader: `uniform sampler2D rainMap, palette; uniform vec3 sunDirection; uniform float night, columns, rows; uniform vec2 opacity; varying vec2 vUv; varying vec3 vNormalW;
            void main() {
                vec2 at = vec2(vUv.x + .5 + .5 / columns, (vUv.y * (rows - 1.) + .5) / rows);
                float place = texture2D(rainMap, at).r;
                if (place < .002) discard;
                vec3 colour = texture2D(palette, vec2(clamp((place * 255. - 1.) / 254., 0., 1.), .5)).rgb;
                float day = smoothstep(-.1, .16, dot(normalize(vNormalW), sunDirection));
                float alpha = smoothstep(0., .25, place) * mix(opacity.x, opacity.y, place);   // drizzle fades out: soft edges, no lone cells
                gl_FragColor = vec4(colour * (1. - night * (1. - day)), alpha);
                #include <colorspace_fragment>
            }`,
        transparent: true, depthWrite: false
    }));
    rainLayer.scale.setScalar(rainRadius / earthRadius); rainLayer.visible = false; rainLayer.renderOrder = .5; rainLayer.raycast = () => {}; group.add(rainLayer);
    let rainShown = false;
    async function loadRain(step) {
        state.rainStep = step; state.rainAsked = performance.now(); state.rain = rainShown ? state.rain : 'loading';
        try {
            const { fields: [rate], time, from } = await loadFields(step, ['pratesfc'], rainStride);
            for (let row = 0; row < rainRows; row++) for (let column = 0; column < rainColumns; column++) {
                const value = rate[row * rainColumns + column] * 3600;   // kg m-2 s-1 to mm/h
                rainData[(rainRows - 1 - row) * rainColumns + column] = value >= rainLow ? 1 + Math.round(Math.min(1, rainPlace(value)) * 254) : 0;
            }
            rainMap.needsUpdate = true; rainShown = true; state.rainTime = time; state.rainFrom = from; state.rain = 'ready';
        } catch (error) {
            if (!rainShown) state.rain = 'failed';
            state.rainAsked = performance.now() + 40000; console.warn('Earth map: rain unavailable', error);
        }
    }

    // Streaks: each a particle and the places it passed, one every `tick`, faint toward the tail. Each step between two
    // places is a thin quad turned to face the screen, drawn instanced: its two ends read the same position buffer one
    // place apart, its strength is its particle's (one value per `trail` instances), and the step from one streak's tail
    // to the next one's head is dropped.
    const count = quality.ceiling === 'high' ? 6000 : 3000, trail = 24, tick = 1 / 25, points = count * trail;
    const positions = new Float32Array((points + 1) * 3), strengths = new Float32Array(count);
    const age = new Float32Array(count), life = new Float32Array(count).fill(-1);
    const placeBuffer = new THREE.InstancedInterleavedBuffer(positions, 3, 1).setUsage(THREE.DynamicDrawUsage);
    const strength = new THREE.InstancedBufferAttribute(strengths, 1, false, trail).setUsage(THREE.DynamicDrawUsage);
    const streakGeometry = new THREE.InstancedBufferGeometry();
    streakGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3));
    streakGeometry.setIndex([0, 1, 2, 2, 1, 3]);
    streakGeometry.setAttribute('placeA', new THREE.InterleavedBufferAttribute(placeBuffer, 3, 0));
    streakGeometry.setAttribute('placeB', new THREE.InterleavedBufferAttribute(placeBuffer, 3, 3));
    streakGeometry.setAttribute('strength', strength);
    streakGeometry.instanceCount = 0;
    const resolution = new THREE.Vector2();
    const streaks = new THREE.Mesh(streakGeometry, new THREE.ShaderMaterial({
        uniforms: { resolution: { value: resolution }, width: { value: 1.7 }, ink: { value: new THREE.Vector3(...looks.dark.streak) }, additive: { value: 1 } },
        defines: { TRAIL: trail },
        vertexShader: `
            attribute vec3 placeA, placeB; attribute float strength;
            uniform vec2 resolution; uniform float width; varying float vAlpha, vAcross;
            void main() {
                int k = gl_InstanceID % TRAIL;
                vec4 a = projectionMatrix * modelViewMatrix * vec4(placeA, 1.), b = projectionMatrix * modelViewMatrix * vec4(placeB, 1.);
                vec2 along = (b.xy / b.w - a.xy / a.w) * resolution;
                float size = length(along);
                vec2 across = size > 1e-4 ? vec2(-along.y, along.x) / size : vec2(0., 1.);
                vec4 p = position.y < .5 ? a : b;
                p.xy += across * position.x * width / resolution * p.w;
                gl_Position = k < TRAIL - 1 ? p : vec4(0., 0., 2., 1.);
                vAlpha = strength * pow(1. - (float(k) + position.y) / float(TRAIL - 1), 1.4); vAcross = position.x;
            }`,
        // A soft edge: about a pixel of full strength in the middle of the 1.7 px quad. Light added to black, ink laid on paper.
        fragmentShader: 'uniform vec3 ink; uniform float additive; varying float vAlpha, vAcross; void main() { float a = vAlpha * (1. - smoothstep(.3, 1., abs(vAcross))); gl_FragColor = additive > .5 ? vec4(ink * a, a) : vec4(ink, a * .75); }',
        // Both faces: which way a quad winds on screen depends on the way its streak runs.
        side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    streaks.frustumCulled = false; streaks.renderOrder = 2; streaks.visible = false; streaks.raycast = () => {};
    group.add(streaks);
    // On screen, CSS pixels: a streak moves `pace` per second for each m/s of wind, and there is one for every `spacing`
    // of the globe's disc.
    const pace = 3, spacing = 150;
    const local = new THREE.Vector3(), centre = new THREE.Vector3(), across1 = new THREE.Vector3(), across2 = new THREE.Vector3();
    const toClip = new THREE.Matrix4();
    let since = 0, active = 0, m0 = 0, m1 = 0, m3 = 0, m4 = 0, m5 = 0, m7 = 0, m8 = 0, m9 = 0, m11 = 0, m12 = 0, m13 = 0, m15 = 0;
    // On the screen (a little margin) and in front of the camera? (x, y, z) a unit vector in the globe's frame.
    const onScreen = (x, y, z) => {
        const w = (m3 * x + m7 * y + m11 * z) * streaksRadius + m15;
        if (w <= 0) return false;
        const sx = (m0 * x + m4 * y + m8 * z) * streaksRadius + m12, sy = (m1 * x + m5 * y + m9 * z) * streaksRadius + m13;
        return Math.abs(sx) < w * 1.03 && Math.abs(sy) < w * 1.03;
    };
    function moveStreaks(delta, camera) {
        earth.updateMatrixWorld(); earth.worldToLocal(local.copy(camera.position));
        const distance = local.length(), seen = Math.asin(Math.min(1, earthRadius / distance)), halfHeight = camera.fov * degree / 2;
        // Hidden once the globe is a small disc (the Earth & Moon and Sun frames).
        streaks.visible = layers.wind && !!windU && seen > halfHeight * .08;
        if (!streaks.visible) { since = 0; return; }
        // A fixed step, so the tails are as long at any frame rate.
        since += Math.max(0, delta);
        if (since < tick) return;
        since = Math.min(since - tick, tick);
        // The cap of the globe the camera sees: everything above its horizon, or less when the view is close enough for
        // the globe to overfill the frame (the camera looks at Earth's centre then).
        centre.copy(local).divideScalar(distance);
        const horizon = Math.acos(Math.min(1, earthRadius / distance));
        const halfDiagonal = Math.atan(Math.tan(halfHeight) * Math.hypot(1, camera.aspect));
        const reach = distance * Math.sin(halfDiagonal) / earthRadius;
        const cap = reach >= 1 ? horizon : Math.min(horizon, Math.asin(reach) - halfDiagonal), cosCap = Math.cos(cap);
        across1.set(0, 1, 0).cross(centre); if (across1.lengthSq() < 1e-8) across1.set(1, 0, 0).cross(centre);
        across1.normalize(); across2.crossVectors(centre, across1);
        const e = toClip.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(earth.matrixWorld).elements;
        m0 = e[0]; m1 = e[1]; m3 = e[3]; m4 = e[4]; m5 = e[5]; m7 = e[7]; m8 = e[8]; m9 = e[9]; m11 = e[11]; m12 = e[12]; m13 = e[13]; m15 = e[15];
        // How many: the globe's disc on screen, clipped to the frame.
        const height = resolution.y || 800, width = resolution.x || 1200, focal = height / 2 / Math.tan(halfHeight);
        const radius = focal * Math.tan(seen), half = Math.min(radius, width / 2);
        let area = 0;
        for (let s = 0; s < 24; s++) { const x = -half + (s + .5) * half / 12; area += 2 * Math.min(height / 2, Math.sqrt(Math.max(0, radius * radius - x * x))) * half / 12; }
        // Close up (the globe overfilling the frame) half as many: from the disc just filling the frame's diagonal to
        // 2.2 times it (about the closest zoom).
        const fill = Math.min(1, Math.max(0, (radius / Math.hypot(width / 2, height / 2) - 1) / 1.2)), closeUp = 1 - .5 * fill * fill * (3 - 2 * fill);
        const wanted = Math.max(200, Math.round(Math.min(count, area / spacing) * closeUp));
        for (let i = wanted; i < active; i++) life[i] = -1;
        active = wanted;
        // Radians of the globe per second per m/s, from the pixels a radian spans below the camera.
        const step = pace * tick / (focal * earthRadius / Math.max(1, distance - earthRadius));
        // Every place one step back along its streak at once (the head then moves on, or is set anew).
        positions.copyWithin(3, 0, active * trail * 3 - 3);
        const cx = centre.x, cy = centre.y, cz = centre.z;
        for (let i = 0; i < active; i++) {
            const base = i * trail * 3;
            // The head was the second place before the shift.
            let x = positions[base + 3] / streaksRadius, y = positions[base + 4] / streaksRadius, z = positions[base + 5] / streaksRadius;
            age[i] += tick;
            if (life[i] < 0 || age[i] > life[i] || x * cx + y * cy + z * cz < cosCap || !onScreen(x, y, z)) {
                // A new streak anywhere on the cap, evenly by area, and on screen if a few tries find a place there; the
                // first ones start part way through their lives, so they do not all fade in together.
                for (let attempt = 0; attempt < 6; attempt++) {
                    const cosT = 1 - Math.random() * (1 - cosCap), sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT)), turn = Math.random() * Math.PI * 2;
                    const a = Math.cos(turn) * sinT, b = Math.sin(turn) * sinT;
                    x = cx * cosT + across1.x * a + across2.x * b; y = cy * cosT + across1.y * a + across2.y * b; z = cz * cosT + across1.z * a + across2.z * b;
                    if (onScreen(x, y, z)) break;
                }
                for (let k = 1; k < trail; k++) { positions[base + k * 3] = x * streaksRadius; positions[base + k * 3 + 1] = y * streaksRadius; positions[base + k * 3 + 2] = z * streaksRadius; }
                const fresh = life[i] < 0;
                life[i] = 1.5 + Math.random() * 2.5; age[i] = fresh ? Math.random() * life[i] : 0;
            }
            const sinLat = Math.max(-1, Math.min(1, y)), cosLat = Math.sqrt(x * x + z * z);
            if (cosLat < 1e-4) {   // on a pole: hidden, and born again elsewhere next step
                positions[base] = positions[base + 3]; positions[base + 1] = positions[base + 4]; positions[base + 2] = positions[base + 5];
                strengths[i] = 0; life[i] = 0; continue;
            }
            sample(Math.asin(sinLat) / degree, Math.atan2(-z, x) / degree);
            // East is (-sin λ, 0, -cos λ), north (-sin φ cos λ, cos φ, sin φ sin λ).
            const cosLon = x / cosLat, sinLon = -z / cosLat, east = sampledU * step, north = sampledV * step;
            x += -east * sinLon - north * sinLat * cosLon; y += north * cosLat; z += -east * cosLon + north * sinLat * sinLon;
            const length = Math.sqrt(x * x + y * y + z * z) / streaksRadius;
            positions[base] = x / length; positions[base + 1] = y / length; positions[base + 2] = z / length;
            // Calm air faint; a fresh streak fades in while its tail grows (so it is not a bright dot), an old one out.
            strengths[i] = Math.min(1, .3 + Math.sqrt(sampledU * sampledU + sampledV * sampledV) / 12) * Math.max(0, Math.min(1, age[i] / .8, (life[i] - age[i]) / .6));
        }
        streakGeometry.instanceCount = active * trail - 1;
        placeBuffer.clearUpdateRanges(); placeBuffer.addUpdateRange(0, active * trail * 3); placeBuffer.needsUpdate = true;
        strength.clearUpdateRanges(); strength.addUpdateRange(0, active); strength.needsUpdate = true;
    }

    // The equator, a red line over the streaks.
    const equatorMaterial = new LineMaterial({ color: looks.dark.equator, linewidth: 1.4, transparent: true, opacity: .9, depthWrite: false, toneMapped: false });
    {
        const positions = [], point = new THREE.Vector3();
        for (let lon = -180; lon <= 180; lon += .5) { onGlobe(0, lon, equatorRadius, point); positions.push(point.x, point.y, point.z); }
        const equator = new Line2(new LineGeometry().setPositions(positions), equatorMaterial);
        equator.renderOrder = 3; equator.raycast = () => {}; group.add(equator);
    }

    // Storms now active (the last advisory within 36 h), kept so that they can be drawn again in the other look.
    const storms = new THREE.Group(); group.add(storms);
    const marks = [];
    let stormData = [];
    function trackLine(points, radius, colour, { dashed = false, width = 1.6, opacity = .9 } = {}) {
        const material = new LineMaterial({ color: colour, linewidth: width, transparent: true, opacity, depthWrite: false, toneMapped: false, dashed, dashSize: 55, gapSize: 38 });
        lineMaterials.push(material);
        const positions = [], point = new THREE.Vector3();
        for (const [lon, lat] of densify(points, .5)) { onGlobe(lat, lon, radius, point); positions.push(point.x, point.y, point.z); }
        const line = new Line2(new LineGeometry().setPositions(positions), material);
        if (dashed) line.computeLineDistances();
        line.renderOrder = 4; storms.add(line); return line;
    }
    // The ECMWF ensemble's tracks (the newest run, refreshed every 3 hours; runs come every 12), drawn with the storms.
    let ensemble = null;
    async function loadTracks() {
        state.ensemble = 'loading'; state.ensembleAt = performance.now();
        try {
            ensemble = await loadEnsemble(); state.ensemble = 'ready'; state.ensembleRun = new Date(ensemble.run);
            if (stormData.length) drawStorms();
        } catch (error) { state.ensemble = 'failed'; console.warn('Earth map: ensemble tracks unavailable', error); }
    }
    // The ensemble storm for a GDACS storm: the one whose runs start (on average) within 4° of it.
    function ensembleFor(lon, lat) {
        let best = null, nearest = 4;
        for (const storm of ensemble?.storms || []) {
            const starts = storm.members.map(member => member.points[0]).filter(point => point[0] === 0);
            if (!starts.length) continue;
            const across = starts.reduce((sum, point) => sum + ((point[2] - lon + 540) % 360) - 180, 0) / starts.length;
            const up = starts.reduce((sum, point) => sum + point[1], 0) / starts.length - lat;
            const distance = Math.hypot(across * Math.cos(lat * degree), up);
            if (distance < nearest) { nearest = distance; best = storm; }
        }
        return best;
    }
    // One storm's runs as one set of thin segments, each coloured by the run's strongest wind at its end.
    function ensembleLines(storm) {
        const positions = [], colours = [], from = new THREE.Vector3(), to = new THREE.Vector3(), colour = new THREE.Color();
        for (const { points } of storm.members) {
            if (points[0][0] !== 0) continue;
            for (let k = 1; k < points.length && points[k][0] <= ensembleHours; k++) {
                const wind = points[k][4] ?? 0;
                colour.set(wind >= typhoonWind ? look.storm.HU : wind >= stormWind ? look.storm.TS : look.storm.TD);
                const path = densify([[points[k - 1][2], points[k - 1][1]], [points[k][2], points[k][1]]], .5);
                for (let s = 1; s < path.length; s++) {
                    onGlobe(path[s - 1][1], path[s - 1][0], ensembleRadius, from); onGlobe(path[s][1], path[s][0], ensembleRadius, to);
                    positions.push(from.x, from.y, from.z, to.x, to.y, to.z); colours.push(colour.r, colour.g, colour.b, colour.r, colour.g, colour.b);
                }
            }
        }
        if (!positions.length) return 0;
        const material = new LineMaterial({ vertexColors: true, linewidth: 1, transparent: true, opacity: look.ensemble, depthWrite: false, toneMapped: false });
        lineMaterials.push(material);
        const lines = new LineSegments2(new LineSegmentsGeometry().setPositions(positions).setColors(colours), material);
        lines.renderOrder = 3; lines.raycast = () => {}; storms.add(lines);
        return storm.members.length;
    }
    async function loadStorms() {
        state.storms = 'loading'; state.stormsAt = performance.now();
        const now = Date.now(), day = ms => new Date(ms).toISOString().slice(0, 10);
        try {
            const list = await (await fetch(stormSource + '&fromDate=' + day(now - 8 * 86400000) + '&toDate=' + day(now + 86400000))).json();
            const active = list.features.filter(feature => feature.properties.iscurrent === 'true' && now - Date.parse(feature.properties.todate + 'Z') < 36 * 3600000);
            const shapes = await Promise.all(active.map(feature => fetch(feature.properties.url.geometry).then(response => response.json()).catch(() => null)));
            stormData = shapes.map((shape, k) => shape && { lon: active[k].geometry.coordinates[0], lat: active[k].geometry.coordinates[1], features: shape.features }).filter(Boolean);
            drawStorms(); state.storms = 'ready';
        } catch (error) { state.storms = 'failed'; console.warn('Earth map: storms unavailable', error); }
    }
    function drawStorms() {
        for (const child of [...storms.children]) { if (!child.isSprite) child.geometry.dispose(); child.material.map?.dispose(); child.material.dispose(); storms.remove(child); }
        lineMaterials.length = 0; marks.length = 0; state.ensembleCount = 0;
        const colour = label => look.storm[label] || look.storm.TS;
        for (const { lon, lat, features } of stormData) {
            const runs = ensembleFor(lon, lat);
            if (runs && ensembleLines(runs)) state.ensembleCount++;
            let strength = 'TS';
            for (const feature of features) {
                const { Class: kind, forecast, polygonlabel: label } = feature.properties, geometry = feature.geometry;
                if (geometry.type === 'LineString') {
                    trackLine(geometry.coordinates, trackRadius, colour(label), { dashed: !!forecast, opacity: forecast ? .8 : .95 });
                    if (!forecast && geometry.coordinates.some(([x, y]) => Math.abs(x - lon) < .05 && Math.abs(y - lat) < .05)) strength = label;
                } else if (kind === 'Poly_Cones') {
                    for (const ring of geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map(polygon => polygon[0])) trackLine(ring, coneRadius, look.cone[0], { width: 1, opacity: look.cone[1] });
                }
            }
            const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: swirl(lat < 0), color: colour(strength), sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true, toneMapped: false }));
            onGlobe(lat, lon, trackRadius + 3, mark.position); mark.scale.setScalar(.034); mark.renderOrder = 5;
            storms.add(mark); marks.push(mark);
        }
        state.stormCount = marks.length;
        if (resolution.x) resize(resolution.x, resolution.y);
    }

    // The look on paper or on black, as js/orbit/sky.js passes it.
    function setTheme(name) {
        const light = name === 'light';
        look = light ? looks.light : looks.dark;
        paintOutlines(); equatorMaterial.color.set(look.equator);
        const streak = streaks.material;
        streak.uniforms.ink.value.set(...look.streak); streak.uniforms.additive.value = look.additive ? 1 : 0;
        streak.blending = look.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
        speedLayer.material.uniforms.palette.value = light ? palettes.light : palettes.dark;
        speedLayer.material.uniforms.night.value = look.night;
        rainLayer.material.uniforms.palette.value = light ? rainPalettes.light : rainPalettes.dark;
        rainLayer.material.uniforms.night.value = look.night; rainLayer.material.uniforms.opacity.value.set(...look.rainOpacity);
        if (stormData.length) drawStorms();
    }
    // The palettes as CSS gradients for the panel's legends; null for a layer off or not yet on the globe.
    const gradient = (stops, place) => 'linear-gradient(90deg, ' + stops.map(([value, colour]) => colour + ' ' + +(place(value) * 100).toFixed(2) + '%').join(', ') + ')';
    const legend = () => ({ wind: layers.wind && windU ? gradient(look.wind, speed => speed / windTop) : null, rain: layers.rain && rainShown ? gradient(look.rain, rainPlace) : null });
    function setLayer(name, on) { layers[name] = !!on; }

    const toCamera = new THREE.Vector3(), worldPosition = new THREE.Vector3(), normal = new THREE.Vector3(), worldScale = new THREE.Vector3();
    function resize(width, height) { resolution.set(width, height); equatorMaterial.resolution.set(width, height); for (const material of lineMaterials) material.resolution.set(width, height); }
    function frame(delta, camera, date) {
        const clock = performance.now();
        if (state.borders === 'idle') loadBorders();
        const step = Math.round(date.getTime() / threeHours) * threeHours;
        // A new grid when the shown time reaches another three-hourly step (often while time runs fast), at most every
        // 20 s; after a failure, again a minute later.
        if (layers.wind && (step !== state.windStep || state.wind === 'failed') && clock - state.windAsked > 20000) loadWind(step);
        if (layers.rain && (step !== state.rainStep || state.rain === 'failed') && clock - state.rainAsked > 20000) loadRain(step);
        speedLayer.visible = layers.wind && !!windU; rainLayer.visible = layers.rain && rainShown;
        if (state.storms !== 'loading' && clock - state.stormsAt > 30 * 60000) loadStorms();
        if (state.ensemble !== 'loading' && clock - state.ensembleAt > (state.ensemble === 'failed' ? 10 * 60000 : 3 * 3600000)) loadTracks();
        moveStreaks(delta, camera);
        // Swirl marks are drawn over everything, so each hides once its storm turns away behind the globe, and all of them
        // once the globe is a small disc. Their size follows the globe on screen (about 60 pixels on a whole globe on a
        // large screen, 20 on a phone, no larger when close); a sprite of fixed screen size spans its scale times the
        // projection's y focal length in clip space.
        const height = resolution.y || 800, globePixels = height / 2 / Math.tan(camera.fov * degree / 2) * Math.tan(Math.asin(Math.min(1, earthRadius / local.length())));
        const markScale = marks.length ? Math.min(62, Math.max(20, globePixels * .29)) * 2 / (camera.projectionMatrix.elements[5] * height * storms.getWorldScale(worldScale).y) : 0;
        for (const mark of marks) {
            mark.scale.setScalar(markScale);
            mark.getWorldPosition(worldPosition); normal.copy(worldPosition).normalize();
            mark.visible = globePixels > 40 && toCamera.subVectors(camera.position, worldPosition).dot(normal) > 0;
        }
    }
    const pad = value => String(value).padStart(2, '0');
    function status() {
        const wind = state.wind === 'ready' ? 'NOAA GFS 10 m · ' + state.windTime.getUTCDate() + ' ' + state.windTime.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }) + ' ' + pad(state.windTime.getUTCHours()) + ':00 UTC (' + state.windFrom + ')'
            : state.wind === 'failed' ? 'unavailable' : 'loading…';
        const storms = state.storms === 'ready' ? (state.stormCount ? state.stormCount + ' active' : 'none active') : state.storms === 'failed' ? 'unavailable' : 'loading…';
        const run = state.ensembleRun, tracks = state.ensemble === 'ready' ? 'ECMWF ensemble ' + run.getUTCDate() + ' ' + run.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }) + ' ' + pad(run.getUTCHours()) + ' UTC, 51 runs, 5 days'
            : state.ensemble === 'failed' ? 'unavailable' : 'loading…';
        const rain = state.rain === 'ready' ? 'NOAA GFS model rate · ' + state.rainTime.getUTCDate() + ' ' + state.rainTime.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }) + ' ' + pad(state.rainTime.getUTCHours()) + ':00 UTC (' + state.rainFrom + ')'
            : state.rain === 'failed' ? 'unavailable' : 'loading…';
        return (layers.wind ? 'Wind: ' + wind + ' · ' : '') + (layers.rain ? 'Rain: ' + rain + ' · ' : '') + 'Storms: GDACS, ' + storms + ' · Tracks: ' + tracks + ' · Borders: Natural Earth';
    }
    return { group, show(on) { group.visible = on; }, frame, resize, status, setTheme, legend, setLayer, layers };
}
