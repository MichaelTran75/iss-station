// Zvezda service module.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { material, palette, vertical } from '../core/kit.js';
import { part, ring } from '../core/station.js';

part('zvezda', 'Zvezda service module', '14 / LIFE SUPPORT & PROPULSION', 'Zvezda brought living quarters, life support and propulsion to the station in 2000. The first long-duration crew arrived that November.', [['Joined station', '2000'], ['Length', '13.1 m']], [0, 2, 34.5], (kit, group) => {
    // Rebuilt from the three supplied Zvezda screenshots. Dimensions are visual estimates.
    // The connected module axes retain their positions; paired collars now share their mating planes.
    const copper = 0x885b3f, white = 0xd9dcd5, silver = 0xaeb5b3, dark = 0x232b32;
    const aftFace = 41.65, wingZ = 33.60;
    const hullProfile = [[29.84, 0.8296719475], [30.10, 0.8296719475], [31 + Math.sqrt(1.2 ** 2 - .80 ** 2), .80], [31.94, .82], [32.34, .82], [32.42, 1.04], [32.72, 1.52], [35.20, 1.52], [35.94, 2.11], [38.90, 2.11], [aftFace, 2.11]];
    function hullRadius(z) {
        const i = Math.max(1, hullProfile.findIndex(p => p[0] >= THREE.MathUtils.clamp(z, 29.84, aftFace)));
        const a = hullProfile[i - 1], b = hullProfile[i]; return THREE.MathUtils.lerp(a[1], b[1], THREE.MathUtils.clamp((z - a[0]) / (b[0] - a[0]), 0, 1));
    }
    const onHull = (a, z, lift = 0) => [Math.cos(a) * (hullRadius(z) + lift), Math.sin(a) * (hullRadius(z) + lift), z];
    const radial = a => new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    function shell(start, end, surface, lift = 0) {
        const points = [[start, hullRadius(start)], ...hullProfile.filter(p => p[0] > start && p[0] < end), [end, hullRadius(end)]];
        const geometry = new THREE.LatheGeometry(points.map(([z, r]) => new THREE.Vector2(r + lift, z)), 96).rotateX(Math.PI / 2);
        // Keep the main barrel's texture rows while inserting the short cylindrical neck ahead of its shoulder.
        if (start > 31.8 && start < 32 && end === 35.94) {
            const uv = geometry.attributes.uv, position = geometry.attributes.position;
            for (let i = 0; i < uv.count; i++) {
                const z = position.getZ(i);
                const v = z <= 32.72 ? .4 + .2 * (z - start) / (32.72 - start)
                    : z <= 35.20 ? .6 + .2 * (z - 32.72) / (35.20 - 32.72) : .8 + .2 * (z - 35.20) / .74;
                uv.setY(i, v);
            }
        }
        kit.add(geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    // Fine procedural blanket relief keeps the self-contained HTML independent of external textures.
    const blanketCanvas = document.createElement('canvas'); blanketCanvas.width = 512; blanketCanvas.height = 512;
    const bc = blanketCanvas.getContext('2d'), pixels = bc.createImageData(512, 512);
    const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7 + 19.3) * 43758.5453; return (n - Math.floor(n)) * 2 - 1; };
    const noise = (x, y, size) => {
        const xx = x / size, yy = y / size, ix = Math.floor(xx), iy = Math.floor(yy), fx = xx - ix, fy = yy - iy;
        const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
        return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v);
    };
    for (let y = 0; y < 512; y++)for (let x = 0; x < 512; x++) {
        const value = THREE.MathUtils.clamp(216 + noise(x, y, 53) * 9 + noise(x, y, 19) * 6 + noise(x, y, 6) * 3 + hash(x, y) * 2, 0, 255), i = (y * 512 + x) * 4;
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
    }
    bc.putImageData(pixels, 0, 0);
    const blanketTexture = new THREE.CanvasTexture(blanketCanvas); blanketTexture.colorSpace = THREE.SRGBColorSpace;
    blanketTexture.wrapS = blanketTexture.wrapT = THREE.RepeatWrapping; blanketTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const relief = blanketTexture.clone(); relief.colorSpace = THREE.NoColorSpace; relief.needsUpdate = true;
    const blanket = material(0xf0f1e9, .85, .14, blanketTexture).clone(); blanket.bumpMap = relief; blanket.bumpScale = .009;
    const aluminum = material(0xd4d8d5, .68, .38, blanketTexture).clone(); aluminum.bumpMap = relief; aluminum.bumpScale = .006;
    const aftSkin = material(0x727b81, .65, .39, blanketTexture).clone(); aftSkin.bumpMap = relief; aftSkin.bumpScale = .004;
    shell(31 + Math.sqrt(1.2 ** 2 - .80 ** 2), 35.94, blanket); shell(35.94, 38.90, aluminum); shell(38.90, aftFace, aftSkin);
    group.userData.referenceViews = 3;
    group.userData.reconstruction = 'Reference-only stepped hull, forward solar roots and detailed aft bulkhead';
    group.userData.hullProfile = hullProfile;
    group.userData.solarWingRootZ = wingZ; group.userData.solarWings = 2; group.userData.solarBaysPerWing = 5; group.userData.solarBlankets = 20;
    group.userData.aftFaceZ = aftFace; group.userData.dockingBoreRadius = .84; group.userData.interfaceCenters = { forward: [0, 0, 29.84], zenith: [0, 1.30, 31], nadir: [0, -1.50, 31], aft: [0, 0, 41.88] };
    group.userData.aftAntenna = { base: [0, 1.64, 41.65], head: [0, 1.99, 44.15] };
    // The spherical hub is opened at four circular seats. Each neck starts on its seat,
    // so no complete cylinder runs through the sphere or leaves a ledge at the shoulder.
    const node = [0, 0, 31], nodeRadius = 1.2;
    const radialSeat = Math.sqrt(nodeRadius ** 2 - .80 ** 2);
    const forwardPortRadius = 0.8296719475, forwardSeat = Math.sqrt(nodeRadius ** 2 - forwardPortRadius ** 2);
    const cuts = [{axis: 1, sign: 1, limit: radialSeat}, {axis: 1, sign: -1, limit: radialSeat},
        {axis: 2, sign: 1, limit: radialSeat}, {axis: 2, sign: -1, limit: forwardSeat}];
    const sphere = new THREE.SphereGeometry(nodeRadius, 96, 64), source = sphere.attributes.position;
    const hubPositions = [], hubNormals = [], hubUV = [];
    function clippedFace(polygon, plane) {
        const out = [];
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length];
            const da = a[plane.axis] * plane.sign - plane.limit, db = b[plane.axis] * plane.sign - plane.limit;
            if (da <= 0) out.push(a);
            if ((da <= 0) !== (db <= 0)) {
                const t = da / (da - db), p = a.map((v, axis) => v + (b[axis] - v) * t);
                p[plane.axis] = plane.limit * plane.sign;
                const axes = [0, 1, 2].filter(axis => axis !== plane.axis);
                const scale = Math.sqrt(nodeRadius ** 2 - plane.limit ** 2) / Math.hypot(...axes.map(axis => p[axis]));
                axes.forEach(axis => p[axis] *= scale); out.push(p);
            }
        }
        return out;
    }
    for (let i = 0; i < sphere.index.count; i += 3) {
        let polygon = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(source, sphere.index.getX(i + k)).toArray());
        for (const cut of cuts) { if (polygon.length < 3) break; polygon = clippedFace(polygon, cut); }
        for (let k = 1; k + 1 < polygon.length; k++) {
            const triangle = [polygon[0], polygon[k], polygon[k + 1]];
            const u = triangle.map(p => (Math.atan2(p[2], p[0]) / (Math.PI * 2) + 1) % 1);
            if (Math.max(...u) - Math.min(...u) > .5) u.forEach((v, index) => { if (v < .5) u[index] += 1; });
            triangle.forEach((p, index) => {
                hubPositions.push(...p); hubNormals.push(...new THREE.Vector3(...p).normalize().toArray());
                hubUV.push(u[index], Math.acos(THREE.MathUtils.clamp(p[1] / nodeRadius, -1, 1)) / Math.PI);
            });
        }
    }
    const hub = new THREE.BufferGeometry();
    hub.setAttribute('position', new THREE.Float32BufferAttribute(hubPositions, 3));
    hub.setAttribute('normal', new THREE.Float32BufferAttribute(hubNormals, 3));
    hub.setAttribute('uv', new THREE.Float32BufferAttribute(hubUV, 2));
    kit.add(hub, blanket, node, [1, 1, 1], [0, 0, 0], false); sphere.dispose();
    function connectorSkin(profile, axis, surface) {
        const points = [...profile].sort((a, b) => a[0] - b[0]).map(([distance, radius]) => new THREE.Vector2(radius, distance));
        const geometry = new THREE.LatheGeometry(points, 96);
        if (axis === 'z') geometry.rotateX(Math.PI / 2);
        kit.add(geometry, surface, axis === 'y' ? node : [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    // The short GLB-style forward collar now seats on Zarya's extended terminal adapter.
    const zaryaFace=29.84,zaryaFaceRadius=0.7682588348468345,frontDepth=31-forwardSeat-zaryaFace;
    connectorSkin([[zaryaFace,zaryaFaceRadius],[zaryaFace+frontDepth*.04079/.226669,0.8388661709949639],[31-forwardSeat,forwardPortRadius]],'z',material(silver,.60,.38));
    ring(kit,[0,0,zaryaFace],zaryaFaceRadius+.001,'z',0x56605e,.010);
    ring(kit,[0,0,zaryaFace+frontDepth*.04079/.226669],0.8388661709949639+.002,'z',white,.014);
    ring(kit,[0,0,31-forwardSeat],forwardPortRadius+.006,'z',white,.014);
    for(let i=0;i<8;i++) {const a=i*Math.PI/4+Math.PI/8;
        kit.box([Math.cos(a)*(0.8388661709949639+.014),Math.sin(a)*(0.8388661709949639+.014),zaryaFace+.086],[.09,.060,.095],silver,[0,0,a],false);}
    const neckRail=(z,lift)=>[-(forwardPortRadius+lift)*Math.cos(.18),-(forwardPortRadius+lift)*Math.sin(.18),z];
    kit.rod(neckRail(29.985,0),neckRail(29.985,.065),.012,copper);
    kit.rod(neckRail(30.080,0),neckRail(30.080,.065),.012,copper);
    kit.rod(neckRail(29.985,.065),neckRail(30.080,.065),.016,copper);
    // The Poisk and Nauka collars mate at y +1.30 and -1.50 respectively.
    // The spherical seats and the necks have the same radius at their shared boundary.
    for (const [side, face] of [[1, 1.30], [-1, 1.50]]) {
        const profile = [[radialSeat, .80], [face - .18, .80], [face - .12, .86], [face - .085, .90], [face, .90]];
        connectorSkin(profile.map(([y, r]) => [side * y, r]), 'y', material(silver, .60, .38));
        ring(kit, [0, side * (radialSeat + .025), 31], .814, 'y', white, .018);
        ring(kit, [0, side * (face - .12), 31], .869, 'y', white, .018);
        ring(kit, [0, side * face, 31], .901, 'y', 0x56605e, .012);
        for (let latch = 0; latch < 8; latch++) {
            const a = latch * Math.PI / 4 + Math.PI / 8;
            kit.box([Math.cos(a) * .92, side * (face - .035), 31 + Math.sin(a) * .92], [.11, .15, .105], silver, [0, -a, 0], false);
            kit.cylinder([Math.cos(a) * .925, side * (face - .12), 31 + Math.sin(a) * .925], .025, .035, palette.rail, [0, 0, 0]);
        }
    }
    // A softly domed service cover and its small T latch are visible on the near side of the reference.
    const coverRadius = .66, coverSphereRadius = nodeRadius + .016;
    const cover = new THREE.SphereGeometry(coverSphereRadius, 64, 28, 0, Math.PI * 2, 0, Math.asin(coverRadius / coverSphereRadius)).rotateZ(-Math.PI / 2);
    kit.add(cover, aluminum, node, [1, 1, 1], [0, 0, 0], false);
    const coverX = Math.sqrt(coverSphereRadius ** 2 - coverRadius ** 2);
    ring(kit, [coverX, 0, 31], coverRadius, 'x', 0xb7beb8, .009);
    kit.box([1.232, .04, 31.05], [.028, .105, .028], 0x56605e, [0, 0, 0], false);
    kit.box([1.239, .088, 31.05], [.033, .022, .095], 0x56605e, [0, 0, 0], false);
    for (const side of [-1, 1]) for (const zSign of [-1, 1]) {
        const y = side * .54, z = 31 + zSign * .64, x = Math.sqrt(nodeRadius ** 2 - y * y - (z - 31) ** 2);
        kit.box([x + .035, y, z], [.085, .075, .16], 0x8c9591, [side * -.2, zSign * .25, 0], false);
    }
    group.userData.connectionRebuild = 'Clipped spherical hub; GLB-shaped Zarya terminal joint; existing Poisk and Nauka collars retained';
    group.userData.nodeSeats = { radius: nodeRadius, radial: radialSeat, forward: forwardSeat, neckRadii: { forward: forwardPortRadius, radial: .80 } };
    group.userData.connectionFaces = { zarya: {axis:'z', coordinate:29.84, radius:0.7682588348468345}, poisk: {axis:'y', coordinate:1.30, radius:.90}, nauka: {axis:'y', coordinate:-1.50, radius:.90} };
    // The port face: a raised circular panel edge enclosing a finned grille, a copper pipe on a plate and a
    // copper handrail that runs down the sphere between two copper arcs.
    kit.add(new THREE.TorusGeometry(.78, .014, 6, 64).rotateY(Math.PI / 2), material(palette.silver), [-Math.sqrt(nodeRadius ** 2 - .78 ** 2), 0, 31], [1, 1, 1], [0, 0, 0], false);
    kit.box([-1.13, -.47, 31], [.03, .15, .64], palette.silver);
    for (const z of [30.75, 31.25]) kit.box([-1.09, -.47, z], [.07, .06, .06], palette.silver, [0, 0, 0], false);
    for (let fin = 0; fin < 14; fin++) kit.cylinder([-1.152, -.47, 30.74 + fin * .04], .011, .1, palette.dark, [0, 0, 0]);
    kit.box([-1.16, -.2, 30.72], [.02, .17, .17], palette.hull);
    kit.rod([-1.19, -.14, 30.65], [-1.19, -.26, 30.8], .022, copper);
    const railPoint = y => [-(Math.sqrt(nodeRadius ** 2 - y * y - .12 ** 2) + .09), y, 31.12];
    const railHeights = [-.95, -.78, -.6, -.42, -.24, -.06, .12, .28];
    for (let i = 1; i < railHeights.length; i++) kit.rod(railPoint(railHeights[i - 1]), railPoint(railHeights[i]), .016, copper);
    for (const y of [-.95, .28]) kit.rod(railPoint(y), [-(Math.sqrt(nodeRadius ** 2 - y * y - .12 ** 2) - .02), y, 31.12], .014, copper);
    for (const [y, radius, standoff] of [[-.72, 1.06, Math.sqrt(nodeRadius ** 2 - .72 ** 2)], [-.98, 1.0, .8]]) {
        const arc = 2.6;
        kit.add(new THREE.TorusGeometry(radius, .018, 4, 40, arc).rotateX(Math.PI / 2).rotateY(arc / 2 - Math.PI), material(copper), [0, y, 31], [1, 1, 1], [0, 0, 0], false);
        for (const t of [-1.1, -.4, .4, 1.1]) kit.rod([-Math.cos(t) * standoff, y, 31 + Math.sin(t) * standoff], [-Math.cos(t) * radius, y, 31 + Math.sin(t) * radius], .014, copper);
    }
    // A small round window above the panel, clear of the zenith neck.
    const onNode = (normal, lift) => new THREE.Vector3(...node).addScaledVector(normal, nodeRadius + lift).toArray();
    const facing = (geometry, normal) => geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal));
    const windowNormal = new THREE.Vector3(-.6, .55, -.58).normalize();
    kit.add(facing(new THREE.CircleGeometry(.16, 32), windowNormal), material(palette.white), onNode(windowNormal, .01), [1, 1, 1], [0, 0, 0], false);
    kit.add(facing(new THREE.CircleGeometry(.1, 32), windowNormal), material(palette.glass, .2, .5), onNode(windowNormal, .018), [1, 1, 1], [0, 0, 0], false);
    kit.add(facing(new THREE.TorusGeometry(.12, .018, 6, 32), windowNormal), material(palette.silver), onNode(windowNormal, .02), [1, 1, 1], [0, 0, 0], false);
    // Short insulated neck between the spherical node and the flared working-compartment shoulder.
    // Its straight section runs from z 31.94 to 32.34; the existing station/module axes remain fixed.
    ring(kit, [0, 0, 31.955], .837, 'z', white, .022);
    ring(kit, [0, 0, 32.315], .837, 'z', silver, .022);
    ring(kit, [0, 0, 32.355], .861, 'z', white, .015);
    const neckPoint = (angle, z, lift = 0) => [Math.cos(angle) * (.82 + lift), Math.sin(angle) * (.82 + lift), z];
    // Small raised plates and a U-shaped grip follow the exposed side in the supplied close-up.
    const neckGripAngle = .45;
    for (const z of [32.055, 32.245]) kit.rod(neckPoint(neckGripAngle, z), neckPoint(neckGripAngle, z, .09), .014, silver);
    kit.rod(neckPoint(neckGripAngle, 32.055, .09), neckPoint(neckGripAngle, 32.245, .09), .018, 0x7f8984);
    for (const [angle, z] of [[.98, 32.02], [1.34, 32.21]]) {
        kit.box(neckPoint(angle, z, .05), [.16, .075, .12], silver, [0, 0, angle - Math.PI / 2], false);
        kit.box(neckPoint(angle, z, .093), [.14, .024, .10], 0x56605e, [0, 0, angle - Math.PI / 2], false);
    }
    group.userData.shortForwardNeck = { start: 31.94, end: 32.34, radius: .82, shoulderEnd: 32.72, construction: 'procedural' };
    // The neck and shoulder carry two copper rails, a row of connectors, a disc antenna and boxes,
    // ending at a copper ring handrail with rungs around the compartment's front edge.
    const onCone = (angle, z, lift) => [Math.cos(angle) * (hullRadius(z) + lift), Math.sin(angle) * (hullRadius(z) + lift), z];
    for (const angle of [3.49, 3.72]) for (let i = 1; i <= 3; i++) kit.rod(onCone(angle, 31.98 + (i - 1) * .075, .07), onCone(angle, 31.98 + i * .075, .07), .016, copper);
    for (let n = 0; n < 7; n++) {
        const z = 32.00 + n * .028, angle = 3.93;
        kit.add(new THREE.CylinderGeometry(.024, .024, .07, 8).rotateZ(angle - Math.PI / 2), material(palette.dark), onCone(angle, z, .03), [1, 1, 1], [0, 0, 0], false);
    }
    kit.rod(onCone(2.62, 32.10, 0), onCone(2.62, 32.10, .17), .016, palette.silver);
    kit.add(new THREE.CylinderGeometry(.1, .1, .018, 20).rotateZ(2.62 - Math.PI / 2), material(palette.white), onCone(2.62, 32.10, .18), [1, 1, 1], [0, 0, 0]);
    kit.box(onCone(2.95, 32.0, .08), [.18, .16, .2], palette.white, [0, 0, 2.95 - Math.PI / 2]);
    kit.box(onCone(2.3, 32.05, .07), [.2, .14, .16], palette.white, [0, 0, 2.3 - Math.PI / 2]);
    kit.add(new THREE.TorusGeometry(1.72, .022, 5, 72), material(copper), [0, 0, 32.8], [1, 1, 1], [0, 0, 0], false);
    for (let rung = 0; rung < 16; rung++) {
        const a = rung * Math.PI / 8 + Math.PI / 16;
        kit.rod([Math.cos(a) * hullRadius(32.8), Math.sin(a) * hullRadius(32.8), 32.8], [Math.cos(a) * 1.72, Math.sin(a) * 1.72, 32.8], .014, copper);
    }
    // Rolled white seams separate the narrow cylinder, flared shoulder and two broad silver barrel bands.
    for (const z of [32.74, 33.48, 35.16, 35.94, 37.43, 38.88]) {
        shell(z - .031, z + .031, material(white, .77, .12), .025);
        ring(kit, [0, 0, z - .045], hullRadius(z) + .029, 'z', silver, .012);
        ring(kit, [0, 0, z + .045], hullRadius(z) + .029, 'z', white, .016);
    }
    // Narrow meridian seams follow every change of diameter.
    for (let seam = 0; seam < 12; seam++) {
        const a = seam * Math.PI / 6;
        const route = [32.72, 33.48, 35.16, 35.20, 35.94].map(z => onHull(a, z, .012));
        for (let i = 1; i < route.length; i++)kit.rod(route[i - 1], route[i], .009, 0xb7beb7);
    }
    function patch(a, z, width, length, color, lift = .018) {
        const radius = hullRadius(z), span = width / radius;
        kit.add(new THREE.CylinderGeometry(radius + lift, radius + lift, length, 16, 1, true, a - span / 2 + Math.PI / 2, span), material(color, .79, .20), [0, 0, z], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    }
    function surfaceCylinder(a, z, radius, length, color, lift) {
        const normal = radial(a), rot = new THREE.Quaternion().setFromUnitVectors(vertical, normal);
        kit.add(new THREE.CylinderGeometry(radius, radius, length, 24).applyQuaternion(rot), material(color), onHull(a, z, lift), [1, 1, 1], [0, 0, 0], false);
    }
    function handhold(a, z0, z1, rise = .13, color = copper) {
        kit.rod(onHull(a, z0, .015), onHull(a, z0, rise), .016, color);
        kit.rod(onHull(a, z0, rise), onHull(a, z1, rise), .023, color);
        kit.rod(onHull(a, z1, rise), onHull(a, z1, .015), .016, color);
    }
    // Louvres and squared copper handholds sit in two longitudinal bays on the small forward cylinder.
    for (const z of [33.12, 34.36]) {
        const a = Math.PI / 2, bayLength = z === 33.12 ? .70 : 1.02;
        kit.box(onHull(a, z, .029), [.35, .05, bayLength], white, [0, 0, 0], false);
        for (let slat = 0; slat < 11; slat++) {
            const depth = z - (bayLength - .16) / 2 + slat * (bayLength - .16) / 10;
            kit.box(onHull(a, depth, .065), [.28, .045, .024], silver, [-.38, 0, 0], false);
            kit.box(onHull(a, depth + .022, .049), [.27, .012, .018], dark, [0, 0, 0], false);
        }
        for (const railAngle of [a - .33, a + .33]) handhold(railAngle, z - bayLength / 2 - .04, z + bayLength / 2 + .04, .14);
    }
    kit.box([0, 1.58, 33.61], [.28, .045, .25], silver, [0, 0, 0], false);
    for (const x of [-.085, 0, .085]) for (const z of [33.535, 33.61, 33.685]) kit.cylinder([x, 1.625, z], .022, .063, dark, [0, 0, 0]);
    // Subtle rounded service-panel seams are fitted to the blanket, avoiding the old oversized tile boxes.
    function blanketLoop(a, z, w, l) {
        const path = new THREE.Shape(), r = .12;
        path.moveTo(-w / 2 + r, -l / 2); path.lineTo(w / 2 - r, -l / 2); path.quadraticCurveTo(w / 2, -l / 2, w / 2, -l / 2 + r); path.lineTo(w / 2, l / 2 - r); path.quadraticCurveTo(w / 2, l / 2, w / 2 - r, l / 2); path.lineTo(-w / 2 + r, l / 2); path.quadraticCurveTo(-w / 2, l / 2, -w / 2, l / 2 - r); path.lineTo(-w / 2, -l / 2 + r); path.quadraticCurveTo(-w / 2, -l / 2, -w / 2 + r, -l / 2);
        const points = path.getPoints(9).map(p => new THREE.Vector3(...onHull(a + p.x / hullRadius(z + p.y), z + p.y, .026)));
        kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 72, .011, 5, true), material(0xb4bcb5), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    for (const a of [.48, 2.67, 4.32, 5.35]) for (const z of [33.10, 34.4]) blanketLoop(a, z, .72, z === 33.10 ? .70 : 1.08);
    // Two copper conduit runs continue across the widening shoulder.
    for (const a of [.69, 2.45]) {
        const route = [32.85, 33.1, 34.3, 35.05, 35.2, 35.94, 36.2].map(z => onHull(a, z, .054));
        for (let i = 1; i < route.length; i++)kit.rod(route[i - 1], route[i], .017, copper);
        for (const z of [32.95, 34.6, 35.8]) kit.rod(onHull(a, z, .01), onHull(a, z, .078), .026, silver);
    }
    for (const z of [35.24, 35.56]) {
        const radius = hullRadius(z) + .10;
        ring(kit, [0, 0, z], radius, 'z', copper, .017);
        for (let n = 0; n < 8; n++) { const a = n * Math.PI / 4; kit.rod(onHull(a, z), onHull(a, z, .1), .013, copper); }
    }
    // Short black rounded covers repeat along the two large barrel bands, as visible in the plan view.
    for (const z of [37.18, 38.64]) for (let n = 0; n < 6; n++) {
        const a = Math.PI / 6 + n * Math.PI / 3, seat = onHull(a, z, .073);
        kit.box(onHull(a, z - .08, .026), [.19, .045, .36], white, [0, 0, a - Math.PI / 2], false);
        kit.add(new THREE.SphereGeometry(1, 20, 16), material(0x202a30, .36, .51), seat, [.10, .14, .25], [0, 0, a - Math.PI / 2], false);
    }
    patch(Math.PI / 2, 36.20, .72, .59, 0x707879);
    for (const a of [0, Math.PI]) patch(a, 36.25, .23, .67, silver);
    patch(Math.PI / 2 + .97, 37.68, .64, .24, 0x505b5e);
    // A visible porthole on each flank of the broad band; fine rim layers stay close to the hull.
    for (const a of [.15, Math.PI - .15]) {
        const z = 38.02, normal = radial(a), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        const face = (g, col, lift) => kit.add(g.applyQuaternion(q), material(col, .36, .35), onHull(a, z, lift), [1, 1, 1], [0, 0, 0], false);
        face(new THREE.CircleGeometry(.24, 40), dark, .021);
        face(new THREE.RingGeometry(.177, .219, 40), silver, .030);
        face(new THREE.CircleGeometry(.172, 40), 0x52636b, .029);
        face(new THREE.TorusGeometry(.203, .014, 6, 40), white, .037);
    }
    // The aft shroud is long and full diameter, with two rows of bolted curved rectangular panels.
    for (let sector = 0; sector < 12; sector++) {
        const a = sector * Math.PI / 6, half = Math.PI / 12 - .025;
        for (const [z0, z1] of [[38.95, 40.12], [40.17, 41.56]]) {
            patch(a, (z0 + z1) / 2, (half * 2) * 2.11, z1 - z0, (sector % 4 === 1) ? 0x747c80 : 0x626c73, .013);
            for (const edge of [-half, half]) kit.rod(onHull(a + edge, z0, .028), onHull(a + edge, z1, .028), .012, silver);
            for (const z of [z0, z1]) {
                const route = []; for (let i = 0; i <= 10; i++)route.push(onHull(a - half + i * 2 * half / 10, z, .027));
                for (let i = 1; i < route.length; i++)kit.rod(route[i - 1], route[i], .011, silver);
            }
            for (const edge of [-half + .057, half - .057]) for (const z of [z0 + .085, z1 - .085]) {
                surfaceCylinder(a + edge, z, .030, .012, 0xcbd0cb, .037);
                surfaceCylinder(a + edge, z, .013, .014, dark, .046);
            }
            surfaceCylinder(a, (z0 + z1) / 2, .013, .012, dark, .031);
        }
    }
    for (const z of [38.91, 40.145, 41.60]) ring(kit, [0, 0, z], 2.129, 'z', silver, .021);
    for (const a of [.50, 2.59, 4.05, 5.62]) {
        kit.rod(onHull(a, 39.13, .024), onHull(a, 39.50, .15), .014, silver);
        surfaceCylinder(a, 39.50, .025, .055, dark, .14);
    }
    // Two mirrored wings: five bays, a narrow cell-covered central spine, and deeper outer two bays.
    // Their hubs are on the small cylinder, well forward of the shoulder and aft shroud.
    const solarCanvas = document.createElement('canvas'); solarCanvas.width = 300; solarCanvas.height = 180;
    const sc = solarCanvas.getContext('2d'); sc.fillStyle = '#050b10'; sc.fillRect(0, 0, 300, 180);
    for (let x = 0; x < 10; x++)for (let y = 0; y < 6; y++) {
        sc.fillStyle = (x + y) % 4 === 0 ? '#0a171e' : '#071219'; sc.fillRect(x * 30 + 1, y * 30 + 1, 28, 28);
    }
    sc.strokeStyle = '#728c94'; sc.lineWidth = .7; sc.beginPath();
    for (let i = 0; i <= 10; i++) { sc.moveTo(i * 30, 0); sc.lineTo(i * 30, 180); }
    for (let i = 0; i <= 6; i++) { sc.moveTo(0, i * 30); sc.lineTo(300, i * 30); } sc.stroke();
    sc.fillStyle = '#aec5c8'; for (let x = 0; x <= 10; x++)for (let y = 0; y <= 6; y++)sc.fillRect(x * 30 - 1, y * 30 - 1, 2, 2);
    const solarTexture = new THREE.CanvasTexture(solarCanvas); solarTexture.colorSpace = THREE.SRGBColorSpace; solarTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const solarSkin = material(0xffffff, .73, .18, solarTexture).clone(); solarSkin.side = THREE.DoubleSide;
    const bayWidth = 2.58, rootX = 2.17;
    for (const side of [-1, 1]) {
        kit.cylinder([side * 1.54, 0, wingZ], .33, .22, dark, [0, 0, Math.PI / 2]);
        ring(kit, [side * 1.668, 0, wingZ], .29, 'x', silver, .032);
        kit.cylinder([side * 1.79, 0, wingZ], .14, .25, silver, [0, 0, Math.PI / 2]);
        kit.rod([side * 1.8, 0, wingZ], [side * (rootX + 5 * bayWidth), 0, wingZ], .052, dark);
        for (let bay = 0; bay < 5; bay++) {
            const x = side * (rootX + (bay + .5) * bayWidth), w = bayWidth - .07, depth = bay < 3 ? 1.47 : 1.64;
            for (const row of [-1, 1]) {
                const z = wingZ + row * (.20 + depth / 2);
                kit.box([x, 0, z], [w, .032, depth], dark, [0, 0, 0], false);
                for (const face of [-1, 1]) kit.add(new THREE.PlaneGeometry(w - .022, depth - .025), solarSkin, [x, face * .02, z], [1, 1, 1], [face > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0], false);
                for (const edge of [-1, 1]) {
                    kit.rod([x - w / 2, .012, z + edge * depth / 2], [x + w / 2, .012, z + edge * depth / 2], .014, silver);
                    kit.rod([x + edge * w / 2, .012, z - depth / 2], [x + edge * w / 2, .012, z + depth / 2], .014, silver);
                }
            }
            const ends = [x - w / 2, x + w / 2], spine = [];
            for (const [dx, dz] of [[-.5, -.12], [.5, -.12], [.53, -.065], [.53, .065], [.5, .12], [-.5, .12], [-.53, .065], [-.53, -.065], [-.5, -.12]]) spine.push([x + dx * (w - .06) / 1.06, .025, wingZ + dz]);
            for (let i = 1; i < spine.length; i++)kit.rod(spine[i - 1], spine[i], .024, silver);
            const texture = solarTexture.clone(); texture.repeat.set(1, 1 / 6); texture.needsUpdate = true;
            const spineSkin = material(0xffffff, .73, .18, texture); spineSkin.side = THREE.DoubleSide;
            kit.add(new THREE.PlaneGeometry(w - .17, .19), spineSkin, [x, .027, wingZ], [1, 1, 1], [-Math.PI / 2, 0, 0], false);
            for (const edge of [-1, 1]) kit.rod([side * (rootX + bay * bayWidth), -.036, wingZ + edge * .13], [side * (rootX + bay * bayWidth), -.036, wingZ + edge * (.20 + depth)], .023, silver);
        }
        for (const edge of [-1, 1]) kit.rod([side * 1.72, 0, wingZ], [side * rootX, 0, wingZ + edge * .13], .032, silver);
    }
    // Full-diameter blue-grey aft bulkhead with a deep dark docking recess and bright annular lip.
    const aftBlue = material(0x465369, .72, .29), recess = material(0x151c26, .43, .38).clone(); recess.side = THREE.DoubleSide;
    kit.add(new THREE.RingGeometry(1.16, 2.11, 96), aftBlue, [0, 0, aftFace], [1, 1, 1], [0, 0, 0], false);
    ring(kit, [0, 0, aftFace - .013], 2.092, 'z', 0x667381, .043);
    kit.add(new THREE.LatheGeometry([[.84, 40.95], [.86, 41.28], [1.18, 41.65]].map(([r, z]) => new THREE.Vector2(r, z)), 64).rotateX(Math.PI / 2), recess, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    kit.add(new THREE.LatheGeometry([[1.17, 41.60], [1.12, 41.72], [.98, 41.86], [.98, 41.88]].map(([r, z]) => new THREE.Vector2(r, z)), 64).rotateX(Math.PI / 2), recess, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    kit.add(new THREE.RingGeometry(.845, .98, 64), material(0xb6c0c5, .43, .51), [0, 0, 41.887], [1, 1, 1], [0, 0, 0], false);
    kit.add(new THREE.LatheGeometry([[.84, 40.96], [.845, 41.88]].map(([r, z]) => new THREE.Vector2(r, z)), 64).rotateX(Math.PI / 2), recess, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    ring(kit, [0, 0, 41.875], .986, 'z', dark, .022);
    kit.cylinder([0, 0, 40.94], .84, .016, 0x080e16);
    // Recessed radial fittings remain behind the existing Soyuz collar when it is visible.
    for (let rib = 0; rib < 12; rib++) {
        const a = rib * Math.PI / 6;
        kit.rod([Math.cos(a) * .24, Math.sin(a) * .24, 40.957], [Math.cos(a) * .80, Math.sin(a) * .80, 41.008], .013, 0x56616b);
    }
    // Two hollow, flared side outlets. Their dark throats are inset, not painted flush on the face.
    for (const side of [-1, 1]) {
        const x = side * 1.62, y = -.02, z = aftFace + .15;
        kit.add(new THREE.CylinderGeometry(.305, .235, .29, 40, 1, true).rotateX(Math.PI / 2), material(silver, .4, .62), [x, y, z], [1, 1, 1], [0, 0, 0], false);
        kit.add(new THREE.CylinderGeometry(.28, .214, .275, 40, 1, true).rotateX(Math.PI / 2), recess, [x, y, z + .007], [1, 1, 1], [0, 0, 0], false);
        kit.cylinder([x, y, aftFace + .024], .217, .013, 0x080e16);
        ring(kit, [x, y, aftFace + .295], .294, 'z', silver, .016);
    }
    // Triangular pads, small sensor housings and the bottom T-shaped target match the aft reference.
    for (const [a, r] of [[.55, 1.72], [2.25, 1.57], [3.96, 1.83], [5.16, 1.78]]) {
        const center = [Math.cos(a) * r, Math.sin(a) * r, aftFace + .052];
        kit.add(new THREE.CylinderGeometry(.175, .175, .075, 3).rotateX(Math.PI / 2).rotateZ(a), material(white), center);
        kit.cylinder([center[0], center[1], aftFace + .102], .032, .024, dark);
    }
    kit.box([-.33, .92, aftFace + .087], [.25, .22, .14], silver);
    kit.box([-.33, .92, aftFace + .163], [.15, .14, .025], 0x4f606f, [0, 0, 0], false);
    kit.box([0, -1.62, aftFace + .075], [1.15, .11, .075], white, [0, 0, 0], false);
    kit.box([0, -1.81, aftFace + .075], [.075, .34, .075], white, [0, 0, 0], false);
    ring(kit, [0, -1.982, aftFace + .10], .09, 'z', silver, .020);
    for (const side of [-1, 1]) kit.box([side * .60, -1.62, aftFace + .07], [.18, .16, .065], white, [0, 0, side * .34], false);
    // Copper runs around the docking cowl and across the face terminate on small standoff brackets.
    function faceRail(points) {
        const p = points.map(([x, y]) => [x, y, aftFace + .10]);
        for (let i = 1; i < p.length; i++)kit.rod(p[i - 1], p[i], .018, copper);
        for (const i of [0, p.length - 1]) kit.rod([p[i][0], p[i][1], aftFace], p[i], .017, copper);
    }
    faceRail([[-1.65, .78], [-1.27, .78], [-1.27, 1.43], [-.76, 1.43]]);
    faceRail([[-1.75, -.63], [-1.26, -.63], [-1.26, -1.36], [-.42, -1.36]]);
    faceRail([[-1.74, -.78], [-1.42, -.78], [-1.42, -1.51], [-.52, -1.51]]);
    faceRail([[1.87, .53], [1.43, .53], [1.29, .36]]);
    for (const [a, span, r] of [[.57, .37, 1.18], [2.5, .25, 1.25], [4.65, .39, 1.18]]) {
        const path = []; for (let i = 0; i <= 18; i++) { const b = a + i * span / 18; path.push([Math.cos(b) * r, Math.sin(b) * r]); } faceRail(path);
    }
    for (let bracket = 0; bracket < 12; bracket++) {
        const a = bracket * Math.PI / 6 + .055;
        kit.box(onHull(a, 41.47, .046), [.18, .07, .30], silver, [0, 0, a - Math.PI / 2], false);
        const rim = (angle, lift) => [Math.cos(angle) * (2.11 + lift), Math.sin(angle) * (2.11 + lift), 41.47];
        kit.rod(rim(a - .10, .02), rim(a - .10, .15), .014, copper);
        kit.rod(rim(a - .10, .15), rim(a + .10, .15), .021, copper);
        kit.rod(rim(a + .10, .15), rim(a + .10, .02), .014, copper);
    }
    // Clustered end-mounted fittings in the shroud's rim pockets.
    for (const a of [Math.PI / 2, Math.PI * 1.5]) {
        patch(a, 41.36, .51, .36, 0x242d34, .035);
        for (const da of [-.065, 0, .065]) for (const z of [41.28, 41.40]) surfaceCylinder(a + da, z, .040, .10, silver, .085);
    }
    // A small aft-pointing cross-tip antenna and a flat white target sit to the lower right of the port.
    const probe = [1.16, -.94, aftFace + .065];
    kit.cylinder(probe, .19, .040, silver);
    kit.rod([probe[0], probe[1], aftFace + .08], [probe[0], probe[1], aftFace + 1.13], .015, copper);
    for (const [dx, dy] of [[.115, 0], [0, .115]]) kit.rod([probe[0] - dx, probe[1] - dy, aftFace + 1.075], [probe[0] + dx, probe[1] + dy, aftFace + 1.075], .012, silver);
    // The large white antenna projects aft from a hinge on the end face, rather than lying along the hull.
    kit.cylinder([0, 1.64, 41.88], .31, .46, white);
    ring(kit, [0, 1.64, 41.76], .315, 'z', silver, .02);
    kit.cylinder([0, 1.64, 42.16], .115, .52, silver, [0, 0, Math.PI / 2]);
    const mastBase = new THREE.Vector3(0, 1.64, 42.18), mastEnd = new THREE.Vector3(0, 1.99, 43.99), mastAxis = mastEnd.clone().sub(mastBase).normalize();
    kit.rod(mastBase.toArray(), mastEnd.toArray(), .085, silver);
    const sleeveStart = mastBase.clone().addScaledVector(mastAxis, .22), sleeveEnd = mastEnd.clone().addScaledVector(mastAxis, -.13);
    kit.add(new THREE.CylinderGeometry(.16, .16, sleeveStart.distanceTo(sleeveEnd), 6).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vertical, mastAxis)), material(white, .83, .11), sleeveStart.clone().lerp(sleeveEnd, .5).toArray(), [1, 1, 1], [0, 0, 0], false);
    kit.add(new THREE.CylinderGeometry(.34, .34, .30, 6, 1, true).rotateX(Math.PI / 2), material(white), [0, 1.99, 44.12], [1, 1, 1], [0, 0, 0], false);
    kit.cylinder([0, 1.99, 43.969], .294, .018, white);
    const dishPoints = [[0, 44.20], [.09, 44.207], [.18, 44.232], [.28, 44.270], [.35, 44.315]].map(([r, z]) => new THREE.Vector2(r, z));
    kit.add(new THREE.LatheGeometry(dishPoints, 48).rotateX(Math.PI / 2), recess, [0, 1.99, 0], [1, 1, 1], [0, 0, 0], false);
    ring(kit, [0, 1.99, 44.316], .352, 'z', silver, .016);
    kit.cylinder([0, 1.99, 44.253], .026, .08, silver);
    kit.box([.35, 1.99, 44.12], [.13, .08, .17], white, [0, .35, 0], false);
});
