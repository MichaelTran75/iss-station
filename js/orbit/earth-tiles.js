// Sharper ground for the Cupola view (js/orbit/cupola-view.js): a recent day's true-colour picture of Earth from NASA
// GIBS (VIIRS on NOAA-20, corrected reflectance: the real clouds of that day), laid over the globe in tiles round the
// point below the camera. The globe's own 4K maps are 10 km to a texel; from 420 km a screen pixel is half a kilometre.
// - Pyramid: GIBS's EPSG:4326 "250m" set, 512 px tiles, 288° / 2^z across. Level 3 (36°, 7.8 km a texel) divides the
//   globe evenly (10 × 5) and is the coarsest used; level 8 (1.125°, 244 m) the finest, level 7 on modest devices.
// - Choice: from level 3, a tile within reach of the point below the camera is wanted; one inside the view whose
//   texels would show larger than `detail` screen pixels is split into its four children. Of a tile's ancestors every
//   other level is wanted with it (3, 5, 7), so a coarser picture shows until the finer one arrives. Tiles draw
//   coarse to fine without depth testing (all lie on the near side of the globe).
// - Look: lit by the Sun as the globe is, and let through to it where it is night (its city lights), where the day
//   has no picture (flat black: the polar night, a swath not yet processed) and toward the horizon (the outer ring
//   fades between `fadeFrom` and `reach`, so the seam with the globe's own map never shows as an edge).
// - Day: the last one whose mosaic is complete. Swaths arrive 3-5 h after they are flown and the day's last ones are
//   flown about 01:30 UTC of the next, so before 06:00 UTC it is the day before yesterday.
// - Memory: `keep` tiles at most (1.4 MB each on the GPU with mipmaps): the choice coarsens until it fits, and tiles
//   no longer wanted go first, oldest first. clear() drops all of them. GIBS answers no-store, so a tile dropped is
//   fetched again.
import * as THREE from 'three';
import { quality } from '../core/quality.js';
import { earthRadius } from '../sim/orbit.js';

const layer = 'VIIRS_NOAA20_CorrectedReflectance_TrueColor';
const source = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/' + layer + '/default/';
const modest = quality.ceiling !== 'high';
const base = 3, finest = modest ? 7 : 8, keep = modest ? 32 : 56, lanes = 6, detail = 1.25;
const reach = 19, fadeFrom = 14, rad = Math.PI / 180;   // degrees of arc from the point below the camera
const kilometresPerDegree = earthRadius * rad;

export function createEarthTiles(earth, sunDirection) {
    const group = new THREE.Group(); group.name = 'Earth tiles'; group.visible = false; earth.add(group);
    const day = new Date(Date.now() - 30 * 3600000).toISOString().slice(0, 10);
    const below = { value: new THREE.Vector3(1, 0, 0) }, fade = { value: new THREE.Vector2(Math.cos(reach * rad), Math.cos(fadeFrom * rad)) };
    const vertexShader = `uniform vec3 below; varying vec2 vUv; varying vec3 vNormalW; varying float vNear;
        void main() { vUv = uv; vec3 up = normalize(position); vNormalW = normalize(mat3(modelMatrix) * up); vNear = dot(up, below); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
    const fragmentShader = `uniform sampler2D map; uniform vec3 sunDirection; uniform vec2 fade; uniform float shown;
        varying vec2 vUv; varying vec3 vNormalW; varying float vNear;
        void main() {
            vec3 colour = texture2D(map, vUv).rgb;
            float light = dot(normalize(vNormalW), sunDirection), day = smoothstep(-.1, .16, light);
            float pictured = smoothstep(.0006, .0024, max(colour.r, max(colour.g, colour.b)));
            gl_FragColor = vec4(colour * (.06 + 1.1 * max(light, 0.)), day * pictured * smoothstep(fade.x, fade.y, vNear) * shown);
            #if defined( TONE_MAPPING )
                gl_FragColor.rgb = toneMapping(gl_FragColor.rgb);
            #endif
            #include <colorspace_fragment>
        }`;

    // One tile's patch of the sphere. The image is not flipped, so v runs from the north edge down.
    function patch(tile, bitmap) {
        const span = 288 / 2 ** tile.z, north = 90 - tile.row * span, west = -180 + tile.col * span, n = tile.z <= 4 ? 16 : 8;
        const positions = new Float32Array((n + 1) * (n + 1) * 3), uvs = new Float32Array((n + 1) * (n + 1) * 2), index = [];
        for (let j = 0, k = 0; j <= n; j++) for (let i = 0; i <= n; i++, k++) {
            const lat = (north - span * j / n) * rad, lon = (west + span * i / n) * rad, ring = Math.cos(lat) * earthRadius;
            positions.set([ring * Math.cos(lon), Math.sin(lat) * earthRadius, -ring * Math.sin(lon)], k * 3); uvs.set([i / n, j / n], k * 2);
            if (i < n && j < n) index.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); geometry.setIndex(index);
        geometry.computeBoundingSphere();
        const texture = new THREE.Texture(bitmap);
        Object.assign(texture, { colorSpace: THREE.SRGBColorSpace, flipY: false, anisotropy: 4, minFilter: THREE.LinearMipmapLinearFilter, needsUpdate: true });
        const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
            uniforms: { map: { value: texture }, shown: { value: 0 }, sunDirection, below, fade },
            vertexShader, fragmentShader, transparent: true, depthTest: false, depthWrite: false
        }));
        mesh.renderOrder = -20 + tile.z; mesh.visible = false; group.add(mesh);
        return mesh;
    }
    function drop(tile) {
        tiles.delete(tile.key); tile.gone = true;
        if (!tile.mesh) return;
        group.remove(tile.mesh); tile.mesh.geometry.dispose();
        const texture = tile.mesh.material.uniforms.map.value; texture.dispose(); texture.image?.close?.(); tile.mesh.material.dispose();
    }

    const tiles = new Map(), wanted = new Map(), stats = { bytes: 0, requests: 0, level: 0 };
    let loading = 0;
    async function fetchTile(want) {
        const tile = { ...want, state: 'loading', mesh: null, used: performance.now(), gone: false };
        tiles.set(tile.key, tile); loading++;
        try {
            const response = await fetch(source + day + '/250m/' + tile.z + '/' + tile.row + '/' + tile.col + '.jpg');
            if (!response.ok) throw new Error('GIBS ' + response.status);
            const blob = await response.blob(); stats.bytes += blob.size; stats.requests++;
            // A tile with nothing pictured is one flat black JPEG of 4.7 kB.
            if (blob.size < 6000) tile.state = 'empty';
            else {
                const bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
                if (tile.gone) bitmap.close(); else { tile.mesh = patch(tile, bitmap); tile.state = 'ready'; }
            }
        } catch (error) { tile.state = 'failed'; tile.until = performance.now() + 30000; }
        loading--;
    }

    // Which tiles the camera wants now.
    const eye = new THREE.Vector3(), up = new THREE.Vector3(), centre = new THREE.Vector3(), sunLocal = new THREE.Vector3(), turn = new THREE.Quaternion();
    const matrix = new THREE.Matrix4(), frustum = new THREE.Frustum(), sphere = new THREE.Sphere();
    let distance = 0, limit = 0, pixels = 0, coarsen = 1;
    function visit(z, row, col) {
        const span = 288 / 2 ** z, lat = (90 - (row + .5) * span) * rad, lon = (-180 + (col + .5) * span) * rad;
        centre.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
        // Half the tile's diagonal: its east-west side shortens with latitude.
        const half = span * .5 * Math.hypot(1, Math.max(Math.cos(lat), Math.cos(lat + span * .5 * rad), Math.cos(lat - span * .5 * rad)));
        const away = Math.acos(THREE.MathUtils.clamp(centre.dot(up), -1, 1)) / rad, nearest = Math.max(0, away - half);
        if (nearest > limit) return;
        sphere.center.copy(centre).multiplyScalar(earthRadius); sphere.radius = earthRadius * half * rad;
        const seen = frustum.intersectsSphere(sphere);
        if (z > base && !seen) return;
        const range = Math.sqrt(earthRadius * earthRadius + distance * distance - 2 * earthRadius * distance * Math.cos(nearest * rad));
        const split = seen && z < finest && span * kilometresPerDegree / 512 * pixels / range > coarsen * detail;
        // A tile that splits is kept on every other level only: its picture stands in while the finer ones load.
        if (!split || (z - base) % 2 === 0) wanted.set(z + '/' + row + '/' + col, { key: z + '/' + row + '/' + col, z, row, col, away });
        if (split) for (let k = 0; k < 4; k++) visit(z + 1, row * 2 + (k >> 1), col * 2 + (k & 1));
    }
    function choose(camera, height) {
        earth.updateMatrixWorld();
        earth.worldToLocal(eye.copy(camera.position)); distance = eye.length(); up.copy(eye).divideScalar(distance); below.value.copy(up);
        frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(earth.matrixWorld));
        pixels = height / 2 / Math.tan(camera.fov * rad / 2);
        limit = Math.min(reach, Math.acos(Math.min(1, earthRadius / distance)) / rad);
        // Deep in the night nothing of the picture would show. Where more tiles are wanted than may be kept (a wide
        // window, a look along the ground), the choice is made again a step coarser.
        sunLocal.copy(sunDirection.value).applyQuaternion(turn.copy(earth.quaternion).invert());
        coarsen = 1;
        do {
            wanted.clear();
            if (up.dot(sunLocal) > -.42) for (let row = 0; row < 5; row++) for (let col = 0; col < 10; col++) visit(base, row, col);
        } while (wanted.size > keep && (coarsen *= 1.4) < 6);
        const now = performance.now();
        for (const tile of tiles.values()) {
            if (wanted.has(tile.key)) tile.used = now;
            else if (tile.state === 'failed' && now > tile.until) tiles.delete(tile.key);
        }
        if (tiles.size > keep) {
            const idle = [...tiles.values()].filter(tile => !wanted.has(tile.key) && tile.state !== 'loading').sort((a, b) => a.used - b.used);
            while (tiles.size > keep && idle.length) drop(idle.shift());
        }
        // Coarse before fine, then the nearest first.
        const queue = [...wanted.values()].filter(want => !tiles.has(want.key)).sort((a, b) => a.z - b.z || a.away - b.away);
        while (loading < lanes && queue.length) fetchTile(queue.shift());
    }

    const lastLook = new THREE.Quaternion();
    let since = 1, lastFov = 0;
    return {
        group, day,
        // Every frame the tiles show: the choice is made again four times a second, or at once when the view turns or zooms.
        frame(camera, height, delta) {
            since += delta;
            if (since > .25 || camera.fov !== lastFov || camera.quaternion.angleTo(lastLook) > .03) { since = 0; lastFov = camera.fov; lastLook.copy(camera.quaternion); choose(camera, height); }
            else { earth.worldToLocal(eye.copy(camera.position)); below.value.copy(eye).normalize(); }
            let level = 0;
            for (const tile of tiles.values()) {
                if (!tile.mesh) continue;
                tile.mesh.visible = wanted.has(tile.key);
                if (!tile.mesh.visible) continue;
                const shown = tile.mesh.material.uniforms.shown;
                if (shown.value < 1) shown.value = Math.min(1, shown.value + delta / .35);
                level = Math.max(level, tile.z);
            }
            stats.level = level;
        },
        clear() { for (const tile of [...tiles.values()]) drop(tile); wanted.clear(); since = 1; },
        // What shows: tiles drawn, tiles on their way, bytes fetched so far, kilometres to a texel of the finest drawn.
        status() {
            let ready = 0;
            for (const tile of tiles.values()) if (tile.mesh?.visible) ready++;
            return { day, ready, loading, bytes: stats.bytes, requests: stats.requests, texel: stats.level ? 288 / 2 ** stats.level * kilometresPerDegree / 512 : 0 };
        }
    };
}
