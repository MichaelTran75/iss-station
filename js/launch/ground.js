// The ground round LC-39A for the Launch view: aerial imagery in four nested rings of map tiles, draped over the pads'
// raised hardstands, the pad's towers, Launch Complex 39 round it (js/launch/complex.js) and the sky seen from inside the
// atmosphere. Metres in the pad's local frame (x east, y up, z south), the ground curved with the Earth.
// - Imagery: USGS National Map orthoimagery (public domain) at about 2 m, 17 m and 130 m a pixel round the pad, and
//   NASA's Blue Marble (GIBS, public domain) at about 1 km out to 1,100 km, its edge fading into the globe's own map; outside the US the USGS tiles are
//   transparent and the coarser ring shows through. Tiles load from those servers when the view first opens.
// - The pad as on Demo-2's day, where the USGS image and OpenStreetMap put it, sized by NASA's figures: the hardstand 12 m
//   above the ground with the flame trench cut through it northward; the launch mount over the trench with its four
//   hold-down clamps and tail service masts; the fixed service structure (steel lattice, hammerhead crane, lightning mast
//   and its catenary), the annex SpaceX built up to the crew access level, the crew access arm swung clear (as at
//   liftoff) and the slide-wire escape baskets; the transporter-erector leaning back with its clamps open, its
//   umbilicals and hydraulic cylinders, and its frame down the ramp; the sound suppression water tower and the two
//   propellant spheres.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { launchSite, padFrame } from '../sim/ascent.js';
import { createComplex, inTrench, padDeck, pads, terrainHeight, terrainLines, waterTower } from './complex.js';

const earthRadius = 6371000, rad = Math.PI / 180;
const usgs = (z, x, y) => 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/' + z + '/' + y + '/' + x;
const gibs = (z, x, y) => 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/' + z + '/' + y + '/' + x + '.jpeg';
// Outer ring first: each ring covers 4 × 4 tiles round the pad.
const rings = [{ zoom: 7, url: gibs, segments: 16, fade: true }, { zoom: 10, url: usgs, segments: 8 }, { zoom: 13, url: usgs, segments: 3 }, { zoom: 16, url: usgs, segments: 2 }];
export { padDeck };
export const mountHeight = 4;   // the rocket stands on the launch mount, its engines 4 m above the pad deck (Dragon's hatch then meets the crew access arm, 217 ft up)

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
    // Tile fractions of a point in the pad's frame (flat-earth inverse: within the rings' tiles near the pads the
    // error is millimetres).
    const tileU = (x, n) => (launchSite.longitude + x / (earthRadius * Math.cos(launchSite.latitude * rad)) / rad + 180) / 360 * n;
    const tileV = (z, n) => { const phi = (launchSite.latitude - z / earthRadius / rad) * rad; return (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2 * n; };
    // The Sun at liftoff (61° up in the west-south-west) and a scratch normal, for the mounds' shading.
    const liftoffSun = new THREE.Vector3(-.476, .878, .056).normalize(), slope = new THREE.Vector3();
    // Which ring drapes each pad: the finest whose 4 × 4 tiles cover it (39A the 2 m ring, 39B the 17 m one).
    const corner = rings.map(({ zoom }) => {
        const n = 2 ** zoom, tileX = (launchSite.longitude + 180) / 360 * n;
        const phi = launchSite.latitude * rad, tileY = (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2 * n;
        return [Math.round(tileX) - 2, Math.round(tileY) - 2];
    });
    const drapedBy = pads.map(pad => {
        for (let level = rings.length - 1; level > 0; level--) {
            const n = 2 ** rings[level].zoom, u = tileU(pad.x, n) - corner[level][0], v = tileV(pad.z, n) - corner[level][1];
            if (u > .1 && u < 3.9 && v > .1 && v < 3.9) return level;
        }
        return -1;
    });
    rings.forEach(({ zoom, url, segments, fade }, level) => {
        const n = 2 ** zoom, [x0, y0] = corner[level];
        const draped = pads.filter((pad, k) => drapedBy[k] === level);
        for (let tx = x0; tx < x0 + 4; tx++) for (let ty = y0; ty < y0 + 4; ty++) {
            // The tile's own grid, and over a pad the terrain's lines too (every 3 m, and along the trench walls), so
            // the image follows the mound and the trench cuts cleanly.
            let us = Array.from({ length: segments + 1 }, (_, i) => i / segments), vs = us.slice();
            const near = draped.filter(pad => {
                const u = tileU(pad.x, n) - tx, v = tileV(pad.z, n) - ty, reach = 420 / (40075016 * Math.cos(launchSite.latitude * rad) / n);
                return u > -reach && u < 1 + reach && v > -reach && v < 1 + reach;
            });
            if (near.length) {
                const inside = f => f > 1e-6 && f < 1 - 1e-6;
                us = [...new Set([...us, ...terrainLines.xs.map(x => tileU(x, n) - tx).filter(inside)])].sort((a, b) => a - b);
                vs = [...new Set([...vs, ...terrainLines.zs.map(z => tileV(z, n) - ty).filter(inside)])].sort((a, b) => a - b);
            }
            const positions = [], uvs = [], colours = [], indices = [], columns = us.length;
            for (const v of vs) for (const u of us) {
                const longitude = (tx + u) / n * 360 - 180, latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + v) / n))) / rad;
                local(latitude, longitude, point);
                // Over the mounds the image's own (flat) lighting gets the slopes' shading added: darker turned away
                // from the Sun at liftoff, a little brighter toward it.
                let shade = 1;
                if (near.length) {
                    const h = terrainHeight(point.x, point.z);
                    if (h > 0) {
                        slope.set(terrainHeight(point.x - 1, point.z) - terrainHeight(point.x + 1, point.z), 2, terrainHeight(point.x, point.z - 1) - terrainHeight(point.x, point.z + 1)).normalize();
                        shade = THREE.MathUtils.clamp(slope.dot(liftoffSun) / liftoffSun.y, .5, 1.2);
                    }
                    point.y += h;
                }
                positions.push(point.x, point.y, point.z); uvs.push(u, 1 - v);
                // The outermost ring thins out over its last third into the globe's map beyond it.
                const edge = Math.max(Math.abs(tx + u - x0 - 2), Math.abs(ty + v - y0 - 2)) / 2;
                colours.push(shade, shade, shade, fade ? 1 - THREE.MathUtils.smoothstep(edge, .66, 1) : 1);
            }
            for (let j = 0; j < vs.length - 1; j++) for (let i = 0; i < columns - 1; i++) {
                const a = j * columns + i, b = a + 1, c = a + columns, d = c + 1;
                if (near.length) {
                    const cx = (positions[a * 3] + positions[d * 3]) / 2, cz = (positions[a * 3 + 2] + positions[d * 3 + 2]) / 2;
                    if (inTrench(cx, cz)) continue;
                }
                indices.push(a, c, b, b, c, d);
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geometry.setIndex(indices);
            if (fade || near.length) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 4));
            // Inner rings draw over outer ones; transparent pixels (no USGS coverage) leave the ring below showing. The
            // outer rings are pushed back rather than the inner ones pulled forward: pulled toward a low camera, the
            // ring under the pad would cover the foot of the mount and the rocket at grazing angles.
            const behind = rings.length - 1 - level;
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, polygonOffset: behind > 0, polygonOffsetFactor: 2 * behind, polygonOffsetUnits: 8 * behind,
                vertexColors: fade || near.length > 0, ...(fade ? { transparent: true, depthWrite: false } : { alphaTest: .5 }) });
            const mesh = new THREE.Mesh(geometry, material); mesh.visible = false; mesh.renderOrder = -50 + level; mesh.frustumCulled = false;
            group.add(mesh);
            pending++;
            loader.load(url(zoom, tx, ty), texture => {
                texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; material.map = texture; material.needsUpdate = true; mesh.visible = true; pending--;
            }, undefined, () => { pending--; failed++; });
        }
    });
    // Launch Complex 39 round the pad.
    group.add(createComplex());

    // Structures. Steel lattice as merged boxes and rods.
    const pieces = new Map();
    const add = (colour, geometry) => { if (!pieces.has(colour)) pieces.set(colour, []); pieces.get(colour).push(geometry); };
    const box = (colour, [x, y, z], [w, h, d], rotation = [0, 0, 0], into = add) => into(colour, new THREE.BoxGeometry(w, h, d).rotateX(rotation[0]).rotateY(rotation[1]).rotateZ(rotation[2]).translate(x, y, z));
    const rod = (colour, a, b, radius, into = add) => {
        const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), length = start.distanceTo(end);
        into(colour, new THREE.CylinderGeometry(radius, radius, length, 6).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize())).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2));
    };
    // A moving part: its pieces merged per colour under its own pivot (see updatePad).
    const surfaceFor = new Map(), surface = colour => { if (!surfaceFor.has(colour)) surfaceFor.set(colour, new THREE.MeshStandardMaterial({ color: colour, roughness: .75, metalness: .2 })); return surfaceFor.get(colour); };
    function movingPart(pivot, build) {
        const own = new Map(), into = (colour, geometry) => { if (!own.has(colour)) own.set(colour, []); own.get(colour).push(geometry); };
        build(into);
        for (const [colour, geometries] of own) pivot.add(new THREE.Mesh(mergeGeometries(geometries, false), surface(colour)));
        return pivot;
    }
    const steel = 0x8e9396, white = 0xe8e9e6, dark = 0x3b3f44, tank = 0xdfe2e3, grating = 0x6f7478;
    // Positions measured on the USGS image of the pad (x east, z south, metres from the launch mount). The tower's
    // and the water tower's lengths are cross-checked against their shadows in the same image. Everything on the
    // hardstand stands on its deck, 12 m up.
    const deck = padDeck, base = deck + mountHeight;
    // Launch mount (the reaction frame) over the trench's mouth: deep girders spanning the trench on legs outside its
    // walls, open in the middle for the exhaust. The four hold-down clamps face the cardinal directions (the east and
    // west ones on removable inserts, clear of Falcon Heavy's side cores); two tail service masts on the south side
    // carry the first stage's umbilicals to the octaweb.
    const frameTop = base - .6;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(dark, [sx * 10.6, deck + (frameTop - deck) / 2, sz * 4.6], [1.6, frameTop - deck, 1.6]);
    for (const s of [-1, 1]) {
        box(dark, [0, frameTop - .9, s * 4.6], [23, 1.8, 1.4]);
        box(dark, [s * 4.3, frameTop - .55, 0], [1.4, 1.1, 10.6]);
        box(dark, [s * 7.6, frameTop - .55, 0], [1, 1.1, 10.6]);
    }
    // Each clamp is a post with a jaw over the octaweb's edge, hinged at its foot: it swings back at release.
    const clamps = [];
    for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2, pivot = new THREE.Group();
        pivot.position.set(Math.cos(a) * 2.55, frameTop, Math.sin(a) * 2.55); pivot.rotation.y = -a;   // its +x points out from the rocket
        group.add(movingPart(pivot, into => { box(dark, [0, 1.75, 0], [.9, 3.5, .9], undefined, into); box(dark, [-.5, 3.25, 0], [1, .45, .75], undefined, into); }));
        clamps.push(pivot);
    }
    // The masts stand; their umbilical plates on the octaweb pull back and drop away at liftoff.
    const tsmPlates = [];
    for (const s of [-1, 1]) {
        box(steel, [s * 3.1, base + .9, 3], [.8, 3.4, .8]);
        const plate = new THREE.Group(); plate.position.set(s * 2.2, base + 2.3, 2.4); plate.userData.home = plate.position.clone();
        group.add(movingPart(plate, into => box(dark, [0, 0, 0], [1.6, .5, .5], undefined, into))); tsmPlates.push(plate);
    }

    // Fixed service structure, by NASA's figures: 40 ft square, levels every 20 ft from 27 ft over the deck, the tower's
    // top at 247 ft, the hammerhead crane to 265 ft and an 80 ft fibreglass lightning mast to 347 ft. It stands where
    // OpenStreetMap and the image put it, west of the rocket and a little north. Steel lattice: corner and mid-face
    // columns, beams and grating at each level, crossed bracing in every half-bay; an elevator shaft on the north face.
    const ft = .3048, tower = [-31.3, -9.7], half = 6.1, roof = 247 * ft, crane = 265 * ft, mastTop = 347 * ft, crew = 217 * ft;
    const [tx, tz] = tower;
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 0, 1]) if (sx || sz) box(steel, [tx + sx * half, deck + roof / 2, tz + sz * half], sx && sz ? [1, roof, 1] : [.55, roof, .55]);
    const levels = [0, ...Array.from({ length: 12 }, (_, k) => (27 + 20 * k) * ft)];
    for (let k = 1; k < levels.length; k++) {
        const y0 = deck + levels[k - 1], y = deck + levels[k];
        for (const s of [-1, 1]) { box(steel, [tx, y, tz + s * half], [2 * half, .7, .5]); box(steel, [tx + s * half, y, tz], [.5, .7, 2 * half]); }
        box(grating, [tx, y - .32, tz], [2 * half - .4, .16, 2 * half - .4]);
        for (const s of [-1, 1]) for (const [a, b] of [[-half, 0], [0, half]]) {
            rod(steel, [tx + a, y0, tz + s * half], [tx + b, y, tz + s * half], .15); rod(steel, [tx + b, y0, tz + s * half], [tx + a, y, tz + s * half], .15);
            rod(steel, [tx + s * half, y0, tz + a], [tx + s * half, y, tz + b], .15); rod(steel, [tx + s * half, y0, tz + b], [tx + s * half, y, tz + a], .15);
        }
    }
    box(grating, [tx, deck + roof + .2, tz], [2 * half + .6, .5, 2 * half + .6]);
    box(0xc5c9cb, [tx - 2.4, deck + roof / 2, tz - half - 1.6], [3.2, roof, 3.2]);   // elevator shaft
    // The hammerhead crane on the roof (turret and jib), and the mast on top of it.
    box(steel, [tx, deck + (roof + crane) / 2, tz], [3.4, crane - roof, 3.4]);
    box(steel, [tx + 4, deck + crane - .7, tz], [22, 1.4, 1.6]);
    box(dark, [tx - 6.2, deck + crane - 2, tz], [2.6, 2.4, 2.2]);   // counterweight
    add(0xd8d8d2, new THREE.CylinderGeometry(.22, .62, mastTop - crane, 10).translate(tx, deck + (crane + mastTop) / 2, tz));
    // The annex SpaceX built on the south side up to the crew access level (217 ft over the deck, 265 ft above the
    // sea): its own braced frame, stairs, and the deck the crew walks out from.
    const annex = { x0: -31.4, x1: -24.7, z0: -3.2, z1: 6, top: crew + 5 };
    for (const x of [annex.x0, annex.x1]) for (const z of [annex.z0, annex.z1]) box(steel, [x, deck + annex.top / 2, z], [.8, annex.top, .8]);
    for (let k = 1; k < levels.length && levels[k] < annex.top; k++) {
        const y0 = deck + levels[k - 1], y = deck + levels[k];
        box(steel, [(annex.x0 + annex.x1) / 2, y, annex.z1], [annex.x1 - annex.x0, .5, .4]); box(steel, [annex.x1, y, (annex.z0 + annex.z1) / 2], [.4, .5, annex.z1 - annex.z0]);
        rod(steel, [annex.x0, y0, annex.z1], [annex.x1, y, annex.z1], .13); rod(steel, [annex.x1, y0, annex.z1], [annex.x0, y, annex.z1], .13);
        rod(steel, [annex.x1, y0, annex.z0], [annex.x1, y, annex.z1], .13); rod(steel, [annex.x1, y0, annex.z1], [annex.x1, y, annex.z0], .13);
        rod(steel, [annex.x0 + 1.2, y0, annex.z0 + 1.5], [annex.x0 + 1.2, y, annex.z1 - 1.5], .12);   // stair flights, back and forth
    }
    box(grating, [(annex.x0 + annex.x1) / 2 + .5, deck + crew - .25, (annex.z0 + annex.z1) / 2], [annex.x1 - annex.x0 + 1, .5, annex.z1 - annex.z0]);
    box(white, [annex.x0 + 2.6, deck + crew + 1.6, annex.z0 + 2.6], [4.6, 3.4, 4.4]);   // crew access level room
    // Crew access arm (85 ft with its white room), on a hinge at the annex's east face: swung north along the tower's
    // east face, clear of the rocket, as at liftoff (it pivots east to meet Dragon's hatch, which faces the tower).
    const pivot = [annex.x1 - .2, deck + crew, .4], armX = pivot[0] + 1.6;
    add(steel, new THREE.CylinderGeometry(.5, .5, 7, 12).translate(pivot[0], pivot[1] + 1.5, pivot[2]));
    box(white, [armX, pivot[1] + 1.5, pivot[2] - 10.8], [2.6, 3, 21.6]);
    box(steel, [armX, pivot[1] - .5, pivot[2] - 10.8], [2.4, 1, 21.6]);
    for (let z = 0; z < 21; z += 3) rod(steel, [armX, pivot[1] - 1, pivot[2] - z], [armX, pivot[1], pivot[2] - z - 3], .09);
    rod(steel, [pivot[0], pivot[1] + 5, pivot[2]], [armX, pivot[1] + 3, pivot[2] - 12], .12);   // tie rod from the hinge post
    // Its windows: a row down both sides of the enclosed walkway.
    for (let z = 1.5; z < 20.5; z += 2.1) for (const s of [-1, 1]) box(0x2a3036, [armX + s * 1.31, pivot[1] + 1.75, pivot[2] - z - .7], [.04, .85, 1.4]);
    box(white, [armX, pivot[1] + 1.8, pivot[2] - 23.8], [4.4, 4, 4.4]);   // the white room
    box(dark, [armX + 2.21, pivot[1] + 1.4, pivot[2] - 23.8], [.04, 2.2, 1.2]);
    // Safety railings along both edges of the flame trench where it cuts through the hardstand: yellow posts every 2 m
    // with a top rail and a knee rail, from the mount north to where the drop runs out.
    for (const s of [-1, 1]) for (let z = -7; z > -100; z -= 2) {
        const x = s * 9.5, h0 = terrainHeight(x, z), h1 = terrainHeight(x, z - 2);
        if (h0 < 1.5) break;
        rod(0xd9b23a, [x, h0, z], [x, h0 + 1.1, z], .045);
        for (const rail of [.55, 1.1]) rod(0xd9b23a, [x, h0 + rail, z], [x, h1 + rail, z - 2], .035);
    }
    // Emergency egress: the refurbished shuttle-era slide-wire baskets, raised to the crew access level in 2018, their
    // wires running west down to the landing area beyond the pad's perimeter.
    const egress = [];
    for (let k = 0; k < 4; k++) {
        const z = tz - 3 + k * 2.2, from = new THREE.Vector3(tx - half - .6, deck + crew - 1, z), to = new THREE.Vector3(-392, 1.5, -18 + k * 3);
        box(0x9aa2a8, [from.x - 1, from.y - 1.8, z], [1.6, 1.4, 1.4]);
        for (let i = 0; i < 40; i++) for (const f of [i / 40, (i + 1) / 40]) egress.push(new THREE.Vector3().lerpVectors(from, to, f).setY(THREE.MathUtils.lerp(from.y, to.y, f) - 9 * 4 * f * (1 - f)));
    }
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(egress), new THREE.LineBasicMaterial({ color: 0x3a3e42 })));

    // Transporter-erector: the strongback on the rocket's south side, the side it came up the ramp from the hangar. Two
    // lattice legs joined by cross frames; at four heights a cradle of two arms, hinged on its face, that wraps the
    // rocket's south half with padded ends on the skin; the propellant and power lines up to the second stage's and
    // Dragon's umbilicals; the hinge at the mount with the two hydraulic cylinders that raised it; and the transporter
    // frame on its bogies down the ramp. In the terminal count the cradles open, then the strongback leans back 2°
    // (by T−4 min), clear of the rocket for liftoff (see updatePad).
    const lean = .035, tall = 66, teFront = 2.7;
    const strongback = new THREE.Group(); strongback.position.set(0, deck + 1, teFront + .7); group.add(strongback);
    const te = (x, h, z) => [x, h, z - teFront - .7];   // in the strongback's frame: its foot's hinge line, upright
    movingPart(strongback, into => {
        for (const s of [-1, 1]) {
            for (const dx of [-.7, .7]) for (const dz of [0, 1.4]) rod(dark, te(s * 2.8 + dx, 0, teFront + dz), te(s * 2.8 + dx, tall, teFront + dz), .17, into);
            for (let h = 0; h < tall; h += 4) {
                rod(dark, te(s * 2.8 - .7, h, teFront), te(s * 2.8 + .7, h + 4, teFront), .07, into); rod(dark, te(s * 2.8 + .7, h, teFront + 1.4), te(s * 2.8 - .7, h + 4, teFront + 1.4), .07, into);
                rod(dark, te(s * 2.8 + s * .7, h, teFront), te(s * 2.8 + s * .7, h + 4, teFront + 1.4), .07, into);
            }
        }
        for (let h = 2; h < tall; h += 8) { rod(dark, te(-2.1, h, teFront), te(2.1, h, teFront), .12, into); rod(dark, te(-2.1, h, teFront), te(2.1, h + 8, teFront), .08, into); }
        for (const [x, h] of [[-1.2, 46], [-.6, 46], [.6, 58], [1.2, 58]]) rod(steel, te(x, 0, teFront - .25), te(x, h, teFront - .25), .11, into);
        box(dark, te(0, 46, teFront - .6), [2.4, 1.2, .6], undefined, into); box(dark, te(0, 58, teFront - .6), [1.8, 1, .6], undefined, into);
    });
    // Cradle arms: in each arm's frame (its hinge on the strongback's face) an arc round the rocket's axis from the
    // rocket's south point round to its side, a pad at its end, and the link back to the hinge.
    const cradles = [], radius = 1.83 + .17;
    for (const h of [9, 25, 41, 55]) for (const s of [-1, 1]) {
        const pivot = new THREE.Group(); pivot.position.set(...te(s * 1.4, h, teFront)); strongback.add(pivot);
        const axis = [-s * 1.4, 0, -teFront], from = s > 0 ? 8 : 90, end = (s > 0 ? 8 : 172) * Math.PI / 180;
        movingPart(pivot, into => {
            // A box-section arm: two chords round the skin, 0.5 m apart, with posts between; the pad bears on the skin.
            for (const y of [-.25, .25]) into(dark, new THREE.TorusGeometry(radius + .1, .13, 6, 14, 82 * Math.PI / 180).rotateX(Math.PI / 2).rotateY(-from * Math.PI / 180).translate(axis[0], y, axis[2]));
            for (let a = 0; a <= 82; a += 20.5) { const angle = (from + a) * Math.PI / 180; box(dark, [axis[0] + Math.cos(angle) * (radius + .1), 0, axis[2] + Math.sin(angle) * (radius + .1)], [.18, .5, .18], undefined, into); }
            box(0x2a2d31, [axis[0] + Math.cos(end) * (radius - .02), 0, axis[2] + Math.sin(end) * (radius - .02)], [.3, .6, .3], undefined, into);
            for (const y of [-.25, .25]) rod(dark, [axis[0], y, axis[2] + radius + .1], [0, y, 0], .16, into);
        });
        cradles.push({ pivot, side: s });
    }
    // Hydraulic cylinders from the transporter frame to the strongback, stretched between their ends each frame.
    const cylinders = [-1, 1].map(s => {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, 1, 10).translate(0, .5, 0), surface(0xb9bdbf));
        group.add(mesh); return { mesh, foot: new THREE.Vector3(s * 2.8, deck + 1.2, 15), top: new THREE.Vector3(...te(s * 2.8, 14, teFront + .7)) };
    });
    // The transporter frame down the ramp, on bogies over the rails.
    for (let z = 6; z <= 44; z += 2) {
        const h = Math.max(terrainHeight(3.5, z), terrainHeight(3.5, z + 2));
        for (const s of [-1, 1]) box(dark, [s * 3.5, h + 1.6, z + 1], [.9, 1.6, 2.05]);
        if (z % 6 === 0) box(dark, [0, h + 1.6, z + 1], [7.9, .6, .5]);
        if (z % 12 === 4) for (const s of [-1, 1]) box(0x4c5156, [s * 4.5, h + .7, z + 1], [1.3, 1.1, 3.2]);
    }
    // Sound suppression water tower, 129 m north and 77 m east: tank 89 m up on four splayed legs.
    waterTower(add, rod, [77, -129]);
    // Propellant spheres at the pad's north corners (liquid oxygen west, the old hydrogen sphere east).
    add(tank, new THREE.SphereGeometry(9.4, 32, 20).translate(-402, 11, -273));
    add(tank, new THREE.SphereGeometry(10.6, 32, 20).translate(370, 12, -259));
    for (const [x, z, r] of [[-402, -273, 7], [370, -259, 8]]) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; rod(steel, [x + Math.cos(a) * r, 0, z + Math.sin(a) * r], [x + Math.cos(a) * r * .9, 9, z + Math.sin(a) * r * .9], .35); }
    const structures = new THREE.Group();
    for (const [colour, geometries] of pieces) structures.add(new THREE.Mesh(mergeGeometries(geometries, false), new THREE.MeshStandardMaterial({ color: colour, roughness: .75, metalness: .2 })));
    group.add(structures);
    // Lightning protection: a stainless cable from an anchor south of the tower up over the mast and down to an anchor
    // north of it, 340 m out each way.
    const wire = [];
    for (const s of [-1, 1]) for (let k = 0; k <= 40; k++) {
        const f = k / 40, sag = 30 * 4 * f * (1 - f);
        wire.push(new THREE.Vector3(tx, (deck + mastTop) * (1 - f) - sag * (1 - f * .3) + 1, tz + s * 340 * f));
    }
    const catenary = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire.flatMap((point, k) => k % 41 === 40 ? [] : [point, wire[k + 1]])), new THREE.LineBasicMaterial({ color: 0x2b2e31 }));
    group.add(catenary);

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

    // The pad through the count (mission seconds): the strongback's cradles open (T−4:22 to T−4:16) and it leans back
    // (T−4:15 to T−4:00); at T−0, once the nine Merlins pass their checks, the hold-down clamps swing back and the tail
    // service masts' umbilical plates pull away and drop.
    const up = new THREE.Vector3(0, 1, 0), reach = new THREE.Vector3(), topNow = new THREE.Vector3();
    function updatePad(mission) {
        const open = THREE.MathUtils.smoothstep(mission, -262, -256), back = THREE.MathUtils.smoothstep(mission, -255, -240);
        strongback.rotation.x = lean * back;
        for (const { pivot, side } of cradles) pivot.rotation.y = -side * 1.31 * open;
        const release = THREE.MathUtils.smoothstep(mission, -.05, .35);
        for (const clamp of clamps) clamp.rotation.z = -.5 * release;
        const drop = THREE.MathUtils.smoothstep(mission, 0, .3);
        for (const plate of tsmPlates) { plate.position.copy(plate.userData.home).add(reach.set(0, -1.1 * drop * drop, .9 * drop)); plate.rotation.x = .7 * drop; }
        strongback.updateMatrixWorld();
        for (const { mesh, foot, top } of cylinders) {
            strongback.localToWorld(topNow.copy(top)).sub(group.position);
            reach.subVectors(topNow, foot);
            mesh.position.copy(foot); mesh.quaternion.setFromUnitVectors(up, reach.clone().normalize()); mesh.scale.set(1, reach.length(), 1);
        }
    }
    updatePad(-270);
    return { group, sky, updateSky, setDaylight, status, updatePad };
}
