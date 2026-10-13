// Z1 truss & communications.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { Kit, material, palette, shapes, vertical } from '../core/kit.js';
import { part, ring, trackingDishes } from '../core/station.js';
import { mliBump, mliTexture } from '../core/surfaces.js';

part('z1', 'Z1 truss & communications', '24 / ATTITUDE & COMMUNICATIONS', 'Z1 sits above Unity and carries four control-moment gyroscopes, power electronics and communications hardware. Its forward face carries a large ring frame and a hinged cable tray, each side is cut in by a triangular equipment recess, and two large insulated covers fill most of the aft face. The prime Ku-band dish on the upright mast slowly tracks in an illustrative motion; the spare on the angled port boom stays parked. A spacewalker climbs hand over hand up the forward face, clips a waist tether to the worksite handhold, takes a pistol grip tool from the chest mini-workstation and drives the four service-panel bolts in a cross pattern. The steel safety tether runs from a reel at the left hip, under the handholds and Unity handrails, to the ring around Quest\'s EVA hatch. Fine fittings are schematic.', [['Installed', 'OCT 2000'], ['Control-moment gyros', '4']], [0, 7.9, 12], (kit, group) => {
    group.userData.controlMomentGyroscopes = 4;
    group.userData.kuBandAntennas = 2;
    group.userData.referenceViews = 6;
    group.userData.rebuild = '2026-10-01: near-cubic blanket body after the supplied Z1 truss renders';
    // Body frame: +x starboard, -z forward, +y zenith. The body is centred over Unity's zenith port.
    const cz = 12, halfW = 2.05, halfD = 1.85, floorY = 3.85, wallTop = 7.40, bandTop = 7.58, deckTop = 7.68;
    const front = cz - halfD, aft = cz + halfD, wallBase = floorY + .12, wallMid = (wallBase + wallTop) / 2, wallHeight = wallTop - wallBase;
    group.userData.bodyEnvelope = { floorY, deckTop, width: halfW * 2, depth: halfD * 2 };
    const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7 + 45.3) * 43758.5453; return n - Math.floor(n); };
    function noise(x, y, s) { const xx = x / s, yy = y / s, ix = Math.floor(xx), iy = Math.floor(yy), fx = xx - ix, fy = yy - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v); }
    // The shared MLI blanket, repeated twice across each face.
    const z1Crumple = mliTexture.clone(); z1Crumple.repeat.set(2, 2); z1Crumple.needsUpdate = true;
    const z1Bump = mliBump.clone(); z1Bump.repeat.set(2, 2); z1Bump.needsUpdate = true;
    const z1Blanket = new THREE.MeshStandardMaterial({ color: 0xf2f3ec, map: z1Crumple, bumpMap: z1Bump, bumpScale: .037, roughness: .94, metalness: .10 });
    // The recessed bay walls take a slightly greyer copy so the cavities read against the outer panels.
    const bayBlanket = z1Blanket.clone(); bayBlanket.color.setHex(0xc3c7c4);
    // Tan deck and tray plate, grey metal, white plates, bronze handholds and a dark interior.
    const tan = material(0x8f8064, .84, .1), tanDark = material(0x6f644f, .86, .1), ringGrey = material(0xb4b9b9, .55, .35), plateGrey = material(0xa1a7a8, .62, .32);
    const whitePlate = material(0xe6e7e1, .72, .08), interior = material(0x25272b, .92, .04), holeDark = material(0x1b1d20, .9, .05), harnessWhite = material(0xf1f2eb, .85, .03), bronzeTone = 0xa57b4a;
    // Brown sealant with pale speckles lines the ring opening and the forward base strip.
    const speckleCanvas = document.createElement('canvas'); speckleCanvas.width = speckleCanvas.height = 256;
    { const g = speckleCanvas.getContext('2d'); g.fillStyle = '#7d6c56'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 2600; i++) { g.fillStyle = hash(i, 23) > .4 ? 'rgba(228,222,206,.85)' : 'rgba(48,40,32,.7)'; g.beginPath(); g.arc(hash(i, 3) * 256, hash(i, 11) * 256, .5 + hash(i, 17) * 1.3, 0, Math.PI * 2); g.fill(); } }
    const speckled = (u, v) => { const t = new THREE.CanvasTexture(speckleCanvas); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(u, v); t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return material(0xffffff, .8, .18, t); };
    // Riveted back panel seen through the ring.
    const rivetCanvas = document.createElement('canvas'); rivetCanvas.width = rivetCanvas.height = 256;
    { const g = rivetCanvas.getContext('2d'); g.fillStyle = '#857660'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(58,48,37,.55)'; g.lineWidth = 2; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(0, k * 64); g.lineTo(256, k * 64); g.stroke(); g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64, 256); g.stroke(); } g.fillStyle = 'rgba(214,206,186,.9)'; for (let row = 0; row < 4; row++) for (let col = 0; col < 32; col++) { g.beginPath(); g.arc(4 + col * 8, 10 + row * 64, 1.6, 0, Math.PI * 2); g.fill(); } }
    const rivetTexture = new THREE.CanvasTexture(rivetCanvas); rivetTexture.colorSpace = THREE.SRGBColorSpace; rivetTexture.wrapS = rivetTexture.wrapT = THREE.RepeatWrapping; rivetTexture.repeat.set(2, 2);
    const rivetPanel = material(0xffffff, .82, .15, rivetTexture);
    const slab = (surface, center, size, rotation = [0, 0, 0]) => kit.add(shapes.box, surface, center, size, rotation, false);
    const drape = (points, r = .017, surface = harnessWhite) => kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(24, points.length * 10), r, 8, false), surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    function tube(target, start, end, radius, color, outlined = false) {
        const from = new THREE.Vector3(...start), axis = new THREE.Vector3(...end).sub(from), length = axis.length();
        const placed = shapes.cylinder.clone().scale(radius, length, radius).translate(0, length / 2, 0);
        placed.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vertical, axis.normalize())).translate(from.x, from.y, from.z);
        target.add(placed, material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], outlined);
    }
    function hoop(target, center, normal, radius, thickness, color) {
        const placed = new THREE.TorusGeometry(radius, thickness, 8, 56).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal).normalize()));
        target.add(placed.translate(...center), material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    function beam(a, b, width, depth, surface = tan) {
        const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from), mid = from.clone().add(to).multiplyScalar(.5);
        const g = new THREE.BoxGeometry(width, depth, delta.length()).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.normalize()));
        kit.add(g, surface, mid.toArray(), [1, 1, 1], [0, 0, 0], false);
    }
    // An oriented frame: p(a, b, c) = origin + a·u + b·v + c·(u × v). Geometry built in (a, b, c) is placed by its matrix.
    function frame(origin, u, v) {
        const U = new THREE.Vector3(...u).normalize(), V = new THREE.Vector3(...v).normalize(), W = U.clone().cross(V), O = new THREE.Vector3(...origin);
        const matrix = new THREE.Matrix4().makeBasis(U, V, W).setPosition(O);
        const add = (geometry, surface) => kit.add(geometry.applyMatrix4(matrix), surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
        return {
            p: (a, b, c = 0) => O.clone().addScaledVector(U, a).addScaledVector(V, b).addScaledVector(W, c).toArray(), add,
            box: (center, size, surface, turn = 0) => add(new THREE.BoxGeometry(...size).rotateZ(turn).translate(...center), surface)
        };
    }
    // A round connector boss: a short drum on `normal` with a pale rim and a dark bore.
    function boss(center, normal, r, depth, color = 0xdcded9) {
        const n = new THREE.Vector3(...normal).normalize(), q = new THREE.Quaternion().setFromUnitVectors(vertical, n), c0 = new THREE.Vector3(...center);
        const put = (geometry, surface, offset) => kit.add(geometry.applyQuaternion(q).translate(...c0.clone().addScaledVector(n, offset).toArray()), surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
        put(new THREE.CylinderGeometry(r, r, depth, 40), material(color, .6, .18), depth / 2);
        put(new THREE.TorusGeometry(r * .66, r * .09, 8, 36).rotateX(-Math.PI / 2), material(0xf2f2ee, .5, .1), depth);
        put(new THREE.CircleGeometry(r * .42, 32).rotateX(-Math.PI / 2), holeDark, depth + .004);
    }
    // A bronze U-handhold standing off a face along `n`.
    function staple(A, B, n, h = .07, r = .014) {
        const a2 = A.map((value, i) => value + n[i] * h), b2 = B.map((value, i) => value + n[i] * h);
        kit.rod(A, a2, r, bronzeTone); kit.rod(B, b2, r, bronzeTone); kit.rod(a2, b2, r, bronzeTone);
    }
    // A soft, rolled-edge cushion: a rounded box whose outer (+z) face puffs out, with gathered creases and an optional dent along its top.
    function cushion(width, height, depth, radius, bulge, seed, dent = 0, dentAt = 0, taper = 0) {
        const g = new THREE.BoxGeometry(width, height, depth, 30, 24, 10), p = g.attributes.position, v = new THREE.Vector3(), core = new THREE.Vector3();
        const ix = width / 2 - radius, iy = height / 2 - radius, iz = depth / 2 - radius;
        for (let i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i);
            core.set(THREE.MathUtils.clamp(v.x, -ix, ix), THREE.MathUtils.clamp(v.y, -iy, iy), THREE.MathUtils.clamp(v.z, -iz, iz));
            const out = v.clone().sub(core); if (out.lengthSq() > 1e-10) out.setLength(radius); v.copy(core).add(out);
            const u = v.x / (width / 2), t = v.y / (height / 2), face = THREE.MathUtils.clamp(v.z / (depth / 2), 0, 1);
            const swell = bulge * (1 - u ** 4) * (1 - t ** 4) * face;
            v.x *= (1 + .05 * (1 - t * t) * (.4 + .6 * face)) * (1 - taper * Math.max(0, -t) ** 2);
            const gather = .028 * (noise((u + 1) * 140 + seed * 9, (t + 1) * 160, 23) - .5) + .012 * (noise((u + 1) * 300, (t + 1) * 260 + seed * 7, 9) - .5);
            v.z += swell + gather * face;
            if (dent) v.y -= dent * Math.exp(-(((u - dentAt) / .2) ** 2)) * Math.max(0, t) ** 3 * (.35 + .65 * face);
            v.y += .02 * (noise((u + 1) * 90 + seed, (v.z + 1) * 70, 15) - .5) * Math.max(0, Math.abs(t) - .6);
            p.setXYZ(i, v.x, v.y, v.z);
        }
        // Average normals across the box's split face seams so the rolled edges shade smoothly.
        g.computeVertexNormals();
        const nrm = g.attributes.normal, sums = new Map(), key = i => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
        for (let i = 0; i < p.count; i++) { const k = key(i), s = sums.get(k) || [0, 0, 0]; s[0] += nrm.getX(i); s[1] += nrm.getY(i); s[2] += nrm.getZ(i); sums.set(k, s); }
        for (let i = 0; i < p.count; i++) { const s = sums.get(key(i)), l = Math.hypot(...s) || 1; nrm.setXYZ(i, s[0] / l, s[1] / l, s[2] / l); }
        return g;
    }

    // Z1's smooth cylinder and shallow upper flare follow GLB node 26.
    // Adapt the measured section to the existing mounting plane and 70% body scale.
    const z1JointScale = 1.42 / 1.07548, z1JointRise = .88 / .68514;
    const z1JointRadius = 1.04638 * z1JointScale, z1JointBore = .91889 * z1JointScale;
    const z1JointProfile = [
        [z1JointRadius, 2.95], [z1JointRadius, 2.95 + .43294 * z1JointRise], [1.42, 3.83],
        [z1JointBore, 3.83], [z1JointBore, 3.01], [1.0, 3.01], [1.0, 2.95], [z1JointRadius, 2.95]
    ];
    // A closed annular wall leaves the central mounting bore open.
    let z1JointArea = 0;
    for (let i = 0; i < z1JointProfile.length - 1; i++) z1JointArea += z1JointProfile[i][0] * z1JointProfile[i+1][1] - z1JointProfile[i+1][0] * z1JointProfile[i][1];
    if (z1JointArea < 0) z1JointProfile.reverse();
    kit.add(new THREE.LatheGeometry(z1JointProfile.map(p => new THREE.Vector2(...p)), 64), material(0xc7cdca, .6, .3), [0, 0, cz], [1, 1, 1], [0, 0, 0], false);
    ring(kit, [0, 2.976, cz], z1JointRadius + .006, 'y', 0x727d78, .018);
    ring(kit, [0, 3.814, cz], 1.414, 'y', palette.silver, .017);
    group.userData.berthingInterface = {
        source: 'ISS_stationary.glb / node 26 smooth drum and shallow upper flare',
        sourceProfile: [[0, 1.04638], [.43294, 1.04638], [.68514, 1.07548]],
        mountedBottomY: 2.95, mountedTopY: 3.566, bodyScale: .70,
        keptUnitySeat: true, adaptedToExistingHeight: true
    };
    // ---- Body: blanket walls, corner posts, a white top band and floor, and a dark interior under the open deck. ----
    slab(z1Blanket, [0, floorY + .05, cz], [4.18, .14, 3.78]);
    const ringY = 5.76, ringOuter = 1.55, ringInner = 1.18;
    const frontShape = new THREE.Shape([[-2.0, wallBase], [2.0, wallBase], [2.0, wallTop], [-2.0, wallTop]].map(p => new THREE.Vector2(...p)));
    const opening = new THREE.Path(); opening.absarc(0, ringY, ringInner + .02, 0, Math.PI * 2, true); frontShape.holes.push(opening);
    const frontWall = new THREE.ExtrudeGeometry(frontShape, { depth: .1, bevelEnabled: false, curveSegments: 72 });
    { const uv = frontWall.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * .25, uv.getY(i) * .25); }
    kit.add(frontWall, z1Blanket, [0, 0, front], [1, 1, 1], [0, 0, 0], false);
    slab(z1Blanket, [0, wallMid, aft - .05], [4.0, wallHeight, .1]);
    // Each side is cut in by a triangular recess. Its slanted wall starts flush at the forward corner and runs back and inward to the
    // deepest line, .9 inside the outer face; a return wall then steps straight back out, and a flat aft section carries the trunnions.
    // The top band, a triangular ceiling plate and the floor close the recess. Most side equipment mounts on the slanted wall.
    const slantFront = front + .05, deepZ = 12.55, cutDepth = .9, slantLength = Math.hypot(cutDepth, deepZ - slantFront), slantU = [cutDepth / slantLength, (deepZ - slantFront) / slantLength];
    // A point on side s's slanted wall: t metres from the forward corner toward the deepest line, at height y and d out from the wall face.
    const onSlant = (s, t, y, d) => [s * (halfW - slantU[0] * t + slantU[1] * d), y, slantFront + slantU[1] * t + slantU[0] * d];
    const slantNormal = s => [s * slantU[1], 0, slantU[0]];
    const slantBox = (s, t, y, size, surface, d0 = 0) => frame(onSlant(s, t, y, d0 + size[2] / 2), [slantU[0], 0, -s * slantU[1]], [0, 1, 0]).box([0, 0, 0], size, surface);
    for (const s of [-1, 1]) {
        slantBox(s, slantLength / 2, wallMid, [slantLength + .08, wallHeight, .1], z1Blanket, -.1);
        slab(bayBlanket, [s * (halfW - (cutDepth + .08) / 2), wallMid, deepZ], [cutDepth + .08, wallHeight, .1]);
        slab(z1Blanket, [s * (halfW - .05), wallMid, (deepZ + aft) / 2], [.1, wallHeight, aft - deepZ]);
        const roof = new THREE.Shape([[s * (halfW + .02), slantFront - .03], [s * (halfW - cutDepth - .09), deepZ + .05], [s * (halfW + .02), deepZ + .05]].map(q => new THREE.Vector2(...q)));
        kit.add(new THREE.ExtrudeGeometry(roof, { depth: .04, bevelEnabled: false }).rotateX(Math.PI / 2), bayBlanket, [0, wallTop, 0], [1, 1, 1], [0, 0, 0], false);
        kit.add(new THREE.ExtrudeGeometry(roof, { depth: .01, bevelEnabled: false }).rotateX(Math.PI / 2), interior, [0, wallTop + .01, 0], [1, 1, 1], [0, 0, 0], false);
    }
    for (const sx of [-1, 1]) for (const z of [front + .03, aft - .03]) slab(z1Blanket, [sx * (halfW - .03), wallMid, z], [.12, wallHeight, .12]);
    // A dark interior floor and liners follow the inside of every wall, including both slanted walls and their return walls.
    const apexIn = halfW - cutDepth - .12;
    const innerOutline = [[-1.9, front + .11], [1.9, front + .11], [apexIn, deepZ - .04], [apexIn, deepZ + .07], [1.94, deepZ + .07], [1.94, aft - .11], [-1.94, aft - .11], [-1.94, deepZ + .07], [-apexIn, deepZ + .07], [-apexIn, deepZ - .04]];
    kit.add(new THREE.ExtrudeGeometry(new THREE.Shape(innerOutline.map(q => new THREE.Vector2(...q))), { depth: .04, bevelEnabled: false }).rotateX(Math.PI / 2), interior, [0, 7.02, 0], [1, 1, 1], [0, 0, 0], false);
    innerOutline.forEach(([x0, z0], i) => { const [x1, z1] = innerOutline[(i + 1) % innerOutline.length]; slab(interior, [(x0 + x1) / 2, 7.2, (z0 + z1) / 2], [Math.hypot(x1 - x0, z1 - z0), .4, .01], [0, Math.atan2(-(z1 - z0), x1 - x0), 0]); });
    // Four gyroscope housings sit low in the open bays.
    for (const [x, z, r] of [[-.95, 11.1, .55], [.95, 11.1, .55], [-.8, 13.0, .48], [.8, 13.0, .48]]) { kit.cylinder([x, 7.1, z], r, .16, 0x50565a, [0, 0, 0]); kit.cylinder([x, 7.2, z], .2, .06, 0x3b4044, [0, 0, 0]); }
    const bandY = (wallTop + bandTop) / 2, bandH = bandTop - wallTop;
    for (const z of [front + .15, aft - .15]) slab(z1Blanket, [0, bandY, z], [4.16, bandH, .36]);
    slab(z1Blanket, [1.90, bandY, cz], [.36, bandH, 3.04]); slab(z1Blanket, [-1.78, bandY, cz], [.60, bandH, 3.04]);

    // ---- Zenith deck: tan rails with small bolt plates, an X of beams around a slotted centre plate and four ringed attach pads. ----
    const railY = bandTop + .05, deckBeamY = bandTop - .02;
    for (const z of [front + .17, aft - .17]) { slab(tan, [0, railY, z], [3.66, .1, .2]); for (let x = -1.5; x <= 1.51; x += .6) slab(plateGrey, [x, deckTop + .008, z], [.14, .016, .12]); }
    slab(tan, [1.88, railY, cz], [.2, .1, 3.14]); slab(tan, [-1.40, railY, cz], [.2, .1, 3.14]);
    beam([-1.48, deckBeamY, 10.48], [1.72, deckBeamY, 13.52], .22, .14); beam([1.72, deckBeamY, 10.48], [-1.48, deckBeamY, 13.52], .22, .14);
    for (const z of [cz - .62, cz + .62]) beam([-1.48, deckBeamY, z], [1.72, deckBeamY, z], .14, .12);
    slab(tan, [.12, deckBeamY + .02, cz], [1.0, .12, .72]); slab(holeDark, [.12, deckBeamY + .085, cz], [.56, .02, .16]);
    for (const [x, z] of [[1.45, front + .55], [-1.05, front + .55], [1.45, aft - .55], [-1.05, aft - .55]]) {
        slab(tan, [x, bandTop + .03, z], [.46, .08, .46]);
        kit.add(new THREE.RingGeometry(.085, .2, 48).rotateX(-Math.PI / 2), whitePlate, [x, bandTop + .072, z], [1, 1, 1], [0, 0, 0], false);
        kit.add(new THREE.CircleGeometry(.085, 32).rotateX(-Math.PI / 2), holeDark, [x, bandTop + .071, z], [1, 1, 1], [0, 0, 0], false);
    }
    // A tan support plate carries the upright mast across the starboard bay.
    slab(tan, [1.32, bandTop + .03, 11.35], [.9, .1, .76]);
    // Starboard outrigger: an open tan frame at deck level with a ringed fitting and a pin at its tip.
    const earTop = bandTop + .08;
    const earShape = new THREE.Shape([[2.0, 10.65], [2.86, 11.05], [2.86, 11.65], [2.0, 12.05]].map(p => new THREE.Vector2(...p)));
    earShape.holes.push(new THREE.Path([[2.18, 10.95], [2.46, 11.1], [2.46, 11.6], [2.18, 11.75]].map(p => new THREE.Vector2(...p))));
    kit.add(new THREE.ExtrudeGeometry(earShape, { depth: .1, bevelEnabled: false }).rotateX(Math.PI / 2), tan, [0, earTop, 0], [1, 1, 1], [0, 0, 0], false);
    kit.add(new THREE.RingGeometry(.07, .16, 40).rotateX(-Math.PI / 2), whitePlate, [2.66, earTop + .004, 11.35], [1, 1, 1], [0, 0, 0], false);
    kit.add(new THREE.CircleGeometry(.07, 24).rotateX(-Math.PI / 2), holeDark, [2.66, earTop + .003, 11.35], [1, 1, 1], [0, 0, 0], false);
    kit.cylinder([3.06, earTop - .05, 11.35], .05, .4, 0xb6bbbc, [0, 0, Math.PI / 2]); kit.cylinder([3.27, earTop - .05, 11.35], .068, .05, 0x8b9294, [0, 0, Math.PI / 2]);
    for (const [z0, z1] of [[10.92, 10.85], [11.78, 11.85]]) kit.rod([2.55, earTop - .1, z0], [2.1, 7.43, z1], .035, 0x8f8064);

    // ---- Forward face: a heavy ring frame with crossed braces, a notched white plate and a hub plate. ----
    const ringFrame = (profile, surface) => kit.add(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), 96).rotateX(-Math.PI / 2), surface, [0, ringY, front], [1, 1, 1], [0, 0, 0], false);
    ringFrame([[ringOuter, 0], [ringOuter, .16], [ringOuter, .16], [ringOuter - .08, .25], [ringOuter - .08, .25], [ringInner + .2, .25], [ringInner + .2, .25], [ringInner + .15, .235], [ringInner + .15, .235], [ringInner + .06, .235], [ringInner + .06, .235], [ringInner, .19]], ringGrey);
    ringFrame([[ringInner, .19], [ringInner, -.27]], speckled(14, 1));
    kit.add(new THREE.CircleGeometry(ringInner + .01, 72).rotateY(Math.PI), rivetPanel, [0, ringY, front + .27], [1, 1, 1], [0, 0, 0], false);
    for (const a of [Math.PI / 4, -Math.PI / 4]) slab(ringGrey, [0, ringY, front + .17], [.16, ringInner * 2, .1], [0, 0, a]);
    for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + k * Math.PI / 2, rIn = [-Math.cos(a), -Math.sin(a)], tangent = [-Math.sin(a), Math.cos(a)], end = [Math.cos(a) * (ringInner - .02), ringY + Math.sin(a) * (ringInner - .02)];
        for (const s of [-1, 1]) {
            const at = (along, inward) => new THREE.Vector2(end[0] + tangent[0] * s * along + rIn[0] * inward, end[1] + tangent[1] * s * along + rIn[1] * inward);
            kit.add(new THREE.ExtrudeGeometry(new THREE.Shape([at(.08, 0), at(.3, 0), at(.08, .26)]), { depth: .04, bevelEnabled: false }), whitePlate, [0, 0, front + .08], [1, 1, 1], [0, 0, 0], false);
        }
    }
    const bowTie = new THREE.Shape([[-.86, -.30], [-.30, -.30], [-.18, -.19], [.18, -.19], [.30, -.30], [.86, -.30], [.86, .30], [.40, .30], [.25, .06], [-.25, .06], [-.40, .30], [-.86, .30]].map(p => new THREE.Vector2(...p)));
    kit.add(new THREE.ExtrudeGeometry(bowTie, { depth: .06, bevelEnabled: false }), whitePlate, [0, ringY + .06, front + .03], [1, 1, 1], [0, 0, 0], false);
    slab(whitePlate, [0, ringY - .5, front + .1], [.32, .32, .05]);
    kit.add(new THREE.CircleGeometry(.075, 32).rotateY(Math.PI), holeDark, [0, ringY - .5, front + .074], [1, 1, 1], [0, 0, 0], false);
    // A white cable loop and a short peg to starboard of the ring; a speckled riveted strip along the base.
    for (const dx of [0, .055]) drape([[1.60 + dx, 6.55, front - .03], [1.60 + dx, 6.98, front - .05], [1.66 + dx, 7.16, front - .06], [1.76 + dx, 7.18, front - .06], [1.84 + dx, 7.02, front - .05], [1.86 + dx, 6.55, front - .03]], .024);
    kit.rod([1.72, 6.25, front], [1.72, 6.25, front - .3], .028, 0xb9bec0);
    slab(speckled(8, .5), [0, floorY + .21, front - .012], [4.0, .18, .03]);
    for (let x = -1.85; x <= 1.86; x += .285) kit.cylinder([x, floorY + .21, front - .03], .022, .02, 0xd6d0bd, [Math.PI / 2, 0, 0]);
    // ---- Hinged cable tray: a tan plate swung down and out below the ring, carrying white harnesses into its slots. ----
    const trayTilt = 30 * Math.PI / 180, trayLength = 1.75;
    const tray = frame([.15, floorY + .2, front - .07], [1, 0, 0], [0, -Math.cos(trayTilt), -Math.sin(trayTilt)]);
    const trayShape = new THREE.Shape([[-1.45, 0], [1.45, 0], [1.65, trayLength], [-1.65, trayLength]].map(p => new THREE.Vector2(...p)));
    for (const hole of [[[-1.44, 1.42], [-1.0, 1.42], [-1.0, 1.58], [-1.44, 1.58]], [[1.0, 1.42], [1.44, 1.42], [1.44, 1.58], [1.0, 1.58]], [[-.52, .62], [.52, .62], [.52, 1.26], [-.52, 1.26]]]) trayShape.holes.push(new THREE.Path(hole.map(p => new THREE.Vector2(...p))));
    tray.add(new THREE.ExtrudeGeometry(trayShape, { depth: .05, bevelEnabled: false }).translate(0, 0, -.025), tan);
    const railLength = Math.hypot(.2, trayLength), railTurn = Math.atan2(.2, trayLength);
    for (const s of [-1, 1]) tray.box([s * 1.55, trayLength / 2, .05], [.07, railLength, .1], tanDark, -s * railTurn);
    tray.box([0, trayLength - .03, .04], [3.2, .06, .08], tanDark);
    for (const b of [.82, 1.1]) tray.box([0, b, .075], [1.25, .05, .03], tan);
    tray.add(new THREE.CylinderGeometry(.045, .045, 2.9, 16).rotateZ(Math.PI / 2).translate(0, 0, -.02), plateGrey);
    for (const a of [-1.1, 0, 1.1]) tray.add(new THREE.CylinderGeometry(.06, .06, .22, 16).rotateZ(Math.PI / 2).translate(a, 0, -.02), plateGrey);
    for (const s of [-1, 1]) for (const b of [.5, 1.05]) tray.box([s * 1.17, b, .075], [.22, .05, .06], material(bronzeTone, .48, .5));
    // Harnesses: six run down the port side of the ring and over the tray (four through the window, two into the port slot);
    // two more leave the ring's starboard foot for the starboard slot.
    for (let k = 0; k < 6; k++) {
        const d = k * .048, lane = k < 4 ? -.42 + k * .14 : -1.12 - (k - 4) * .12, sink = k < 4 ? [1.17, 1.29] : [1.46, 1.56];
        drape([[-.55 - d, deckTop - .02, front + .08], [-.62 - d, bandTop, front - .07], [-.95 - d, 7.18, front - .05], [-1.6 - d * .5, 6.5, front - .045], [-1.72 - d * .5, 5.6, front - .045], [-1.5 + d * .3, 4.62, front - .045], [-.85 + d, 4.12, front - .05], tray.p(lane, .04, .06), tray.p(lane, .55, .06), tray.p(lane, sink[0], .035), tray.p(lane, sink[1], -.1)], .021);
    }
    for (let k = 0; k < 2; k++) {
        const lane = 1.12 + k * .12;
        drape([[1.22 + k * .06, 4.52, front - .04], [1.24 + k * .06, 4.2, front - .05], tray.p(lane, .04, .06), tray.p(lane, .7, .06), tray.p(lane, 1.46, .035), tray.p(lane, 1.56, -.1)], .021);
    }

    // ---- Port: on the slanted wall, twin connector boxes, a round umbilical boss, handholds and a stepped access panel, and near the deepest
    // line a box with a boss over a lower white box; harnesses hang in the deep corner. ----
    for (const t of [1.14, 1.78]) {
        slantBox(-1, t, 6.535, [.58, 1.17, .28], whitePlate);
        slantBox(-1, t, 6.535, [.52, 1.12, .012], plateGrey, .28);
        slantBox(-1, t, 6.56, [.42, 1.0, .02], whitePlate, .292);
        slantBox(-1, t + .08, 5.88, [.42, .14, .18], whitePlate);
        for (const y of [6.86, 6.6, 6.34]) slantBox(-1, t + .1, y, [.12, .1, .03], plateGrey, .312);
    }
    boss(onSlant(-1, .95, 6.05, 0), slantNormal(-1), .23, .34);
    for (const y of [5.5, 5.22]) staple(onSlant(-1, 1.25, y, 0), onSlant(-1, 1.5, y, 0), slantNormal(-1));
    slantBox(-1, 1.45, 4.6, [1.1, .7, .03], plateGrey);
    slantBox(-1, 1.18, 4.78, [.56, .34, .03], z1Blanket, .02);
    slantBox(-1, 1.46, 4.78, [.016, .34, .012], holeDark, .05); slantBox(-1, 1.18, 4.61, [.56, .016, .012], holeDark, .05);
    slantBox(-1, 2.25, 5.25, [.42, .6, .38], whitePlate); boss(onSlant(-1, 2.25, 5.25, .38), slantNormal(-1), .2, .2);
    slantBox(-1, 2.25, 4.45, [.5, .6, .44], whitePlate); slantBox(-1, 2.25, 4.45, [.44, .52, .01], plateGrey, .44);
    for (const x of [-1.25, -1.31]) drape([[x, 7.34, deepZ - .1], [x - .02, 6.3, deepZ - .09], [x + .01, 5.6, deepZ - .1], [x - .02, 4.8, deepZ - .09], [x, 3.99, deepZ - .1]], .013);
    drape([[-1.42, 7.36, deepZ - .16], [-1.46, 6.6, deepZ - .15], onSlant(-1, 2.25, 5.62, .25)]);

    // ---- Starboard: handholds, a hook and a harness on the slanted wall; near the deepest line a connector-box pair on a shelf (the forward
    // box carries a round boss) and a lower box with a boss; harnesses hang in the deep corner. ----
    for (const y of [5.6, 5.3]) staple(onSlant(1, .55, y, 0), onSlant(1, .8, y, 0), slantNormal(1));
    drape([onSlant(1, .95, 5.25, .02), onSlant(1, .95, 5.3, .14), onSlant(1, 1.0, 5.2, .2), onSlant(1, 1.1, 5.05, .16), onSlant(1, 1.12, 5.0, .06)], .03, whitePlate);
    drape([onSlant(1, 1.3, 7.33, .04), onSlant(1, 1.28, 6.9, .05), onSlant(1, 1.24, 5.9, .05), onSlant(1, 1.22, 5.45, .05), onSlant(1, 1.0, 4.6, .05), onSlant(1, .62, 4.08, .05), onSlant(1, .3, 4.03, .05), onSlant(1, .08, 4.03, .04)]);
    for (const [t, d] of [[1.58, .46], [2.04, .5]]) { slantBox(1, t, 6.65, [.44, .82, d], whitePlate); slantBox(1, t, 6.65, [.38, .76, .008], plateGrey, d); }
    boss(onSlant(1, 1.58, 6.8, .46), slantNormal(1), .17, .16);
    for (const y of [6.88, 6.65, 6.42]) slantBox(1, 2.1, y, [.14, .1, .02], plateGrey, .508);
    slantBox(1, 1.81, 6.21, [.96, .06, .5], whitePlate);
    slantBox(1, 1.97, 4.68, [.54, .84, .5], whitePlate); boss(onSlant(1, 1.97, 4.68, .5), slantNormal(1), .21, .1);
    for (const x of [1.25, 1.31, 1.37]) drape([[x, 7.34, deepZ - .1], [x + .02, 6.2, deepZ - .09], [x - .01, 5.3, deepZ - .1], [x + .02, 4.2, deepZ - .09], [x, 3.99, deepZ - .1]], .013);
    // Trunnion pins on perforated grey discs on the flat aft section of each side, near the top and bottom.
    for (const side of [-1, 1]) for (const y of [wallTop - .26, floorY + .32]) {
        const z = aft - .23, x = side * halfW, disc = new THREE.Shape(); disc.absarc(0, 0, .27, 0, Math.PI * 2, false);
        for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, rr = k % 2 ? .19 : .14, hole = new THREE.Path(); hole.absarc(Math.cos(a) * rr, Math.sin(a) * rr, .022, 0, Math.PI * 2, true); disc.holes.push(hole); }
        kit.add(new THREE.ExtrudeGeometry(disc, { depth: .035, bevelEnabled: false, curveSegments: 24 }).rotateY(side * Math.PI / 2), plateGrey, [x + side * .005, y, z], [1, 1, 1], [0, 0, 0], false);
        kit.cylinder([x + side * .05, y, z], .1, .1, 0x8b9294, [0, 0, Math.PI / 2]);
        kit.cylinder([x + side * .27, y, z], .055, .5, 0xb6bbbc, [0, 0, Math.PI / 2]);
        kit.cylinder([x + side * .5, y, z], .07, .05, 0x8b9294, [0, 0, Math.PI / 2]);
    }

    // ---- Aft face: a tan box and a framed grey door unit to port, two large stacked pillow covers and their waist strap. ----
    slab(tan, [-1.42, 6.28, aft + .2], [1.0, .82, .4]);
    slab(plateGrey, [-1.48, 4.98, aft + .06], [.82, 1.46, .12]);
    slab(material(0xbfc3c2, .58, .3), [-1.48, 4.98, aft + .125], [.64, 1.26, .02]);
    for (const y of [4.38, 5.58]) slab(plateGrey, [-1.48, y, aft + .14], [.5, .03, .02]);
    slab(plateGrey, [-.97, 5.38, aft + .1], [.2, .16, .2]); kit.rod([-.9, 5.38, aft + .2], [-.74, 5.44, aft + .34], .022, 0x9aa1a3); kit.rod([-.74, 5.44, aft + .34], [-.66, 5.5, aft + .3], .022, 0x9aa1a3);
    kit.add(cushion(2.74, 1.70, .6, .32, .22, 1, .34, .2), z1Blanket, [.6, 6.48, aft + .3], [1, 1, 1], [0, 0, 0], false);
    kit.add(cushion(2.7, 1.62, .56, .32, .18, 2, 0, 0, .1), z1Blanket, [.6, 4.80, aft + .28], [1, 1, 1], [0, 0, 0], false);
    slab(z1Blanket, [.6, 5.62, aft + .29], [2.74, .13, .58]);
    staple([-1.85, 4.05, aft], [-1.2, 4.05, aft], [0, 0, 1]);

    // ---- Two Ku-band antennas after the supplied reference renders: a dish on an upright grey mast to starboard and a dish on an
    // angled grey boom to port, each with a finned SGTRC box and white cable runs. Each head nests mount → azimuth turntable →
    // Y-yoke elevation axis → reflector, so tracking turns about real gimbal axes. The reflector has a rolled rim, a back plate with
    // four flat arms (the pair on the elevation axis reaching past the rim), a white feed cone and a four-leg support to the feed apex.
    // Sizes are representative.
    const focal = .78, aperture = .92, vertexLift = .30, bowl = r => vertexLift + r * r / (4 * focal);
    const antennaWhite = material(0xeef0ec, .5, .12), gimbalGrey = 0xb7bcbd, jointGrey = 0x8d9396, mastGrey = 0xbcc1c2, cableWhite = material(0xf2f2ee, .55, .05), sgtrcTone = 0xd9dccf;
    const cable = (target, points, radius = .012) => target.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(12, points.length * 8), radius, 6, false), cableWhite, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    function reflector(target) {
        // Two single-sided shells (the reversed profile faces into the bowl) keep shadow bias correct on both faces.
        const profile = [];
        for (let n = 0; n <= 20; n++) { const r = .07 + n / 20 * (aperture - .07); profile.push(new THREE.Vector2(r, bowl(r))); }
        target.add(new THREE.LatheGeometry(profile.slice().reverse(), 64), antennaWhite, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
        target.add(new THREE.LatheGeometry(profile.map(point => new THREE.Vector2(point.x, point.y - .03)), 64), material(0xd9dcda, .6, .1), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
        hoop(target, [0, bowl(aperture) - .012, 0], [0, 1, 0], aperture + .006, .03, 0xeef0ec);
        // Back plate and four flat arms; the pair on the elevation axis reaches past the rim and ends in small tabs.
        target.cylinder([0, vertexLift - .06, 0], .46, .035, gimbalGrey, [0, 0, 0]);
        for (const [a, length] of [[0, 1.2], [Math.PI, 1.2], [Math.PI / 2, .8], [-Math.PI / 2, .8]]) {
            target.box([Math.cos(a) * length / 2, vertexLift - .1, Math.sin(a) * length / 2], [length, .03, .09], gimbalGrey, [0, -a, 0]);
            if (length > 1) target.box([Math.cos(a) * length, vertexLift - .1, Math.sin(a) * length], [.05, .035, .24], gimbalGrey, [0, -a, 0]);
        }
        target.cylinder([0, .17, 0], .14, .26, gimbalGrey, [0, 0, 0]);
        target.box([0, .03, 0], [.24, .12, .22], gimbalGrey);
        // White feed cone on the axis; four thin legs meet at the apex plate with its three studs.
        target.add(new THREE.CylinderGeometry(.035, .095, .36, 24), antennaWhite, [0, vertexLift + .18, 0]);
        target.cylinder([0, vertexLift + .375, 0], .045, .03, 0xdadddb, [0, 0, 0]);
        const apexY = vertexLift + focal - .02;
        target.box([0, apexY, 0], [.15, .03, .15], 0xdadddb, [0, Math.PI / 4, 0]);
        for (let stud = 0; stud < 3; stud++) { const a = stud * Math.PI * 2 / 3; target.cylinder([Math.cos(a) * .045, apexY + .045, Math.sin(a) * .045], .012, .06, 0xdadddb, [0, 0, 0]); }
        for (let leg = 0; leg < 4; leg++) {
            const a = Math.PI / 4 + leg * Math.PI / 2;
            tube(target, [Math.cos(a) * .86, bowl(.86), Math.sin(a) * .86], [Math.cos(a) * .05, apexY, Math.sin(a) * .05], .012, 0xeef0ec);
        }
    }
    function antennaHead(parent, position, heading, tilt) {
        // Azimuth turntable and drive housing with a round side cap, then a Y-yoke of splayed cheeks carrying the
        // elevation cross-shaft, its pivot bosses and drive.
        const azimuth = new THREE.Group(); azimuth.position.fromArray(position); azimuth.rotation.y = heading - parent.rotation.y; parent.add(azimuth);
        const headKit = new Kit();
        headKit.cylinder([0, .03, 0], .19, .06, jointGrey, [0, 0, 0]);
        headKit.box([0, .13, 0], [.3, .16, .26], gimbalGrey);
        headKit.cylinder([0, .13, .15], .08, .05, jointGrey);
        for (const side of [-1, 1]) {
            headKit.box([side * .16, .33, 0], [.05, .34, .2], gimbalGrey, [0, 0, -side * .22]);
            headKit.cylinder([side * .2, .5, 0], .095, .06, jointGrey, [0, 0, Math.PI / 2]);
        }
        headKit.cylinder([0, .5, 0], .045, .46, gimbalGrey, [0, 0, Math.PI / 2]);
        headKit.cylinder([.3, .5, 0], .07, .12, jointGrey, [0, 0, Math.PI / 2]);
        // Service loops hang from the housing down past the turntable.
        for (const dz of [-.06, .02, .1]) cable(headKit, [[-.14, .2, dz], [-.27, .06, dz + .02], [-.22, -.2, dz], [-.1, -.32, dz]]);
        headKit.finish(azimuth);
        const elevation = new THREE.Group(); elevation.position.set(0, .5, 0); elevation.rotation.x = tilt; azimuth.add(elevation);
        const dishKit = new Kit(); reflector(dishKit); dishKit.finish(elevation);
        return { azimuth, elevation };
    }
    // A finned SGTRC box: body plus nine heat-sink fins on its outer (+x local) face, placed by `at(x, y)` in a frame turned by `turn` about z.
    function sgtrc(target, at, turn, length = .52, width = .34) {
        target.box(at(0, 0), [.2, length, width], sgtrcTone, [0, 0, turn]);
        for (let fin = 0; fin < 9; fin++) target.box(at(.15, -length / 2 + .05 + fin * (length - .1) / 8), [.1, .016, width - .02], 0xb5baab, [0, 0, turn], false);
    }
    // Port: a grey clevis on the wide port band, a grey boom rising outboard and aft with clipped cables and an SGTRC box under
    // its upper end, an elbow and a short upright section to the head.
    const boomMount = new THREE.Group(); boomMount.name = 'Redundant Ku-band antenna';
    boomMount.position.set(-1.78, bandTop, 12.75); boomMount.rotation.y = -2.687; group.add(boomMount);
    const boomKit = new Kit(), lean = 48 * Math.PI / 180, reach = 3.0, boomAxis = [Math.cos(lean), Math.sin(lean), 0], up = [-Math.sin(lean), Math.cos(lean), 0], headY = 4.2;
    const along = s => [.02 + boomAxis[0] * s, .24 + boomAxis[1] * s, 0];
    const off = (s, u, z = 0) => { const p = along(s); return [p[0] + up[0] * u, p[1] + up[1] * u, z]; };
    boomKit.box([0, .025, 0], [.6, .05, .58], palette.silver);
    for (const x of [-.24, .24]) for (const z of [-.24, .24]) boomKit.cylinder([x, .06, z], .025, .03, palette.dark, [0, 0, 0]);
    for (const z of [-.25, .25]) boomKit.box([.02, .2, z], [.32, .3, .05], jointGrey);
    boomKit.cylinder([.02, .24, 0], .055, .6, palette.silver);
    boomKit.box([-.2, .13, 0], [.14, .16, .3], gimbalGrey);
    tube(boomKit, along(0), along(.42), .2, jointGrey, true);
    tube(boomKit, along(.1), along(reach), .16, mastGrey, true);
    for (const s of [.95, 1.9]) hoop(boomKit, along(s), boomAxis, .165, .02, jointGrey);
    const elbow = along(reach);
    boomKit.sphere(elbow, [.2, .2, .2], jointGrey);
    boomKit.box([elbow[0], elbow[1] + .08, 0], [.3, .2, .3], jointGrey);
    boomKit.cylinder([elbow[0], (elbow[1] + headY) / 2 + .05, 0], .13, headY - elbow[1] - .1, mastGrey, [0, 0, 0]);
    boomKit.box([elbow[0] + .12, elbow[1] + .55, 0], [.06, .5, .2], gimbalGrey);
    boomKit.cylinder([elbow[0], headY - .05, 0], .17, .1, jointGrey, [0, 0, 0]);
    // Three white cables run up the boom's upper side under clips, then up the upright section.
    for (const dz of [-.05, 0, .05]) cable(boomKit, [...Array.from({ length: 12 }, (_, i) => { const s = .2 + i * (reach - .3) / 11; return off(s, .18 + .012 * Math.sin(i * 1.7 + dz * 40), dz); }), [elbow[0] - .2, elbow[1] + .3, dz], [elbow[0] - .16, elbow[1] + .9, dz], [elbow[0] - .15, headY - .2, dz]]);
    for (const s of [.5, 1.25, 2.0, 2.7]) boomKit.box(off(s, .18), [.06, .05, .16], jointGrey, [0, 0, lean], false);
    // SGTRC box on a short bracket under the upper boom, its long side along the boom and fins outward.
    boomKit.box(off(2.15, -.2), [.08, .1, .2], jointGrey, [0, 0, lean]);
    sgtrc(boomKit, (x, y) => off(2.15 + y, -.38 - x), lean + Math.PI / 2, .82, .56);
    boomKit.finish(boomMount);
    antennaHead(boomMount, [elbow[0], headY, 0], -Math.PI / 4, .05);
    // Starboard: an upright round mast on a gusseted foot with a collar and a slight jog, a bronze handrail, an SGTRC box swung
    // inboard on two stays and a clipped cable run.
    const mastMount = new THREE.Group(); mastMount.name = 'Prime Ku-band antenna';
    mastMount.position.set(1.3, bandTop + .08, 11.35); group.add(mastMount);
    const mastKit = new Kit();
    mastKit.box([0, .05, 0], [.56, .1, .52], palette.silver);
    for (const z of [-.2, .2]) mastKit.box([0, .2, z], [.44, .22, .04], jointGrey);
    mastKit.cylinder([0, .16, 0], .26, .1, jointGrey, [0, 0, 0]);
    mastKit.cylinder([0, 1.2, 0], .17, 2.1, mastGrey, [0, 0, 0]);
    ring(mastKit, [0, .7, 0], .17, 'y', jointGrey, .025);
    mastKit.cylinder([0, 2.3, 0], .21, .14, jointGrey, [0, 0, 0]);
    mastKit.box([-.02, 2.42, 0], [.36, .1, .3], jointGrey);
    mastKit.cylinder([-.04, 3.31, 0], .14, 1.7, mastGrey, [0, 0, 0]);
    ring(mastKit, [-.04, 3.5, 0], .14, 'y', jointGrey, .022);
    mastKit.cylinder([-.04, 4.18, 0], .17, .08, jointGrey, [0, 0, 0]);
    for (const y of [2.75, 3.45]) mastKit.add(shapes.box, material(bronzeTone, .48, .5), [.1, y, 0], [.12, .04, .04], [0, 0, 0], false);
    mastKit.rod([.16, 2.75, 0], [.16, 3.45, 0], .02, bronzeTone);
    // The SGTRC box hangs from a hinge bracket on the mast's inboard side, swung out on two stays; its fins face up and inboard.
    const hingeY = 1.55, swing = .5, hingeX = -.2, hinged = (x, y) => [hingeX + x * Math.cos(swing) + y * Math.sin(swing), hingeY - x * Math.sin(swing) + y * Math.cos(swing), 0];
    mastKit.box([-.17, hingeY, 0], [.08, .1, .22], jointGrey);
    mastKit.cylinder([hingeX, hingeY, 0], .03, .5, palette.silver);
    sgtrc(mastKit, (x, y) => hinged(-.1 - x, -.46 + y), -swing, .9, .6);
    const stayTop = hinged(-.02, -.9);
    for (const z of [-.14, .14]) tube(mastKit, [stayTop[0], stayTop[1], z], [-.14, .6, z], .018, palette.silver);
    // White cables run up the mast's aft side under clips, with a slack loop at the collar.
    for (const dx of [-.05, 0, .05]) cable(mastKit, [...Array.from({ length: 9 }, (_, i) => { const y = .25 + i * .25; return [dx, y, .2 + .01 * Math.sin(i * 1.3 + dx * 30)]; }), [dx + .04, 2.38, .3], [dx, 2.6, .19], [dx - .04, 3.2, .17], [dx - .04, 4.1, .17]]);
    for (const y of [.5, .95, 1.4, 1.85, 2.75, 3.25, 3.75]) mastKit.box([y > 2.3 ? -.04 : 0, y, y > 2.3 ? .16 : .2], [.16, .05, .05], jointGrey, [0, 0, 0], false);
    mastKit.finish(mastMount);
    const prime = antennaHead(mastMount, [-.04, 4.22, 0], .44, .12);
    trackingDishes.push({ ...prime, baseAzimuth: prime.azimuth.rotation.y, baseElevation: prime.elevation.rotation.x });
    // Deck harnesses: from the mast foot and the boom root forward to the bundle that drops down the forward face.
    for (let k = 0; k < 3; k++) {
        const d = k * .05;
        drape([[1.05, bandTop + .1, 11.2 + d], [.55, deckTop + .02, 10.95 + d], [-.1, deckTop + .03, 10.62 + d * .5], [-.5 - d, deckTop, 10.36]]);
        drape([[-1.62, bandTop + .03, 12.45 - d], [-1.3, deckTop + .02, 12.0 - d], [-.95, deckTop + .03, 11.2], [-.62 - d, deckTop, 10.38]]);
    }
});
