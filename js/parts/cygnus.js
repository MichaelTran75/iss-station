// Cygnus XL, the cargo vehicle Canadarm2 captures and berths (the Capture and Release operations of the arm).
import * as THREE from 'three';
import { Kit, material, palette } from '../core/kit.js';
import { part, ring } from '../core/station.js';
import { payloadCanvas } from '../core/surfaces.js';
import { hardware } from '../robotics/hardware.js';

// Built in the vehicle's own frame (group.userData.body): the origin is the centre of the berthing ring's face and +y
// runs through the hatch into the station. Where the body is, and whether it shows at all, come from
// js/robotics/index.js; a hidden body cannot be picked.
//
// Sizes follow the published ones and NASA's photographs of the XL flights: 7.89 m long and 3.07 m across; a
// pressurised module of four rings of eight pressed debris shields behind a short white cone and the passive berthing
// ring; a 1.4 m service module in crinkled foil, narrower than the cargo module, ending in the wide launch adapter
// ring; two ten-gore UltraFlex arrays 3.7 m across, shallow cones on booms that reach their hubs, cells looking aft.
// Angles run about the axis from +z towards +x (as CylinderGeometry counts them): the name plates look along -z.
//
// Two grapple fixtures are drawn. The real one stands on the aft deck beside the main engine. The arm drawn here cannot
// reach under a berthed vehicle to it, so it takes a second, illustrative one on the side of the service module
// (FIXTURE, the place js/robotics/fixtures.js keeps): the space in front of that one stays clear of equipment.
const FIXTURE = [0, -6.95, -1.27];
const RADIUS = 1.535, RING = 1.19, CONE_END = -.62, SECTION = 1.35, SECTIONS = 4, BARREL_END = CONE_END - SECTION * SECTIONS;
const PANELS = 8, PANEL = Math.PI * 2 / PANELS, NAME_SIDE = Math.PI;
const SKIRT_END = -6.36, SKIRT_RADIUS = 1.24, DRUM = 1.16, DRUM_END = -7.70, ADAPTER = 1.33, DECK = -7.79;
const ARRAY_X = 3.42, ARRAY_Y = -7.45, ARRAY_RADIUS = 1.85, ARRAY_RISE = .14, GORES = 10, WEDGE = Math.PI / GORES;
const hash = (a, b = 0, c = 0) => { const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + 12.9) * 43758.5453; return n - Math.floor(n); };

// One debris shield as it lies on the barrel: bare aluminium, the gap to its neighbours, two rows of rivets inside it.
const plate = () => payloadCanvas(256, 256, c => {
    c.fillStyle = '#c3c7c0'; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 220; i++) { c.fillStyle = `rgba(${hash(i) > .5 ? '255,255,255' : '70,78,72'},${.01 + hash(i, 3) * .02})`; c.fillRect(hash(i, 7) * 256, 0, 1 + hash(i, 5) * 2, 256); }
    c.strokeStyle = '#5d645f'; c.lineWidth = 5; c.strokeRect(0, 0, 256, 256);
    for (const inset of [10, 19]) for (let p = inset; p <= 256 - inset; p += 9.44) for (const [x, y] of [[p, inset], [p, 256 - inset], [inset, p], [256 - inset, p]]) {
        c.fillStyle = '#7d847e'; c.beginPath(); c.arc(x, y, 1.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#e4e7e1'; c.fillRect(x - 1, y - 1, 1, 1);
    }
});
// Crumpled foil: flat facets of many greys, drawn again across each edge so the image tiles.
const crinkle = () => payloadCanvas(256, 256, c => {
    c.fillStyle = '#d3d7db'; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 560; i++) {
        const x = hash(i, 1) * 256, y = hash(i, 2) * 256, shade = 142 + Math.round(hash(i, 3) ** 1.3 * 110), reach = 9 + hash(i, 4) * 24;
        c.fillStyle = `rgba(${shade},${shade + 3},${shade + 6},.86)`;
        for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
            c.beginPath();
            for (let k = 0; k < 3; k++) { const a = hash(i, 5 + k) * Math.PI * 2, d = reach * (.4 + hash(i, 9 + k) * .6); c.lineTo(x + ox + Math.cos(a) * d, y + oy + Math.sin(a) * d); }
            c.closePath(); c.fill();
        }
    }
});
// An array's blanket in plan, hub at the centre and two corners on the horizontal: ten gores, each with its strings of
// cells running out along it, bare film left along the folds and round the hub. `back` is the film side, where the
// cells show through as a grid.
const blanket = back => payloadCanvas(back ? 512 : 1024, back ? 512 : 1024, c => {
    const size = back ? 512 : 1024, mid = size / 2, apothem = mid * Math.cos(WEDGE), half = mid * Math.sin(WEDGE), pitch = size / 46, cell = pitch * .84, slope = Math.tan(WEDGE);
    c.fillStyle = back ? '#7c5c18' : '#b56428'; c.fillRect(0, 0, size, size);
    for (let gore = 0; gore < GORES; gore++) {
        c.save(); c.translate(mid, mid); c.rotate((gore * 2 + 1) * WEDGE);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(apothem, -half); c.lineTo(apothem, half); c.closePath(); c.clip();
        c.fillStyle = back ? '#946c1c' : '#cf7a31'; c.fillRect(0, -half, apothem, half * 2);
        for (let column = -8; column < 8; column++) {
            const y = (column + .5) * pitch, lane = Math.abs(column + .5) | 0, bare = hash(gore, column < 0 ? 1 : 2) < .3 ? .2 : 0;
            const inner = Math.max((Math.abs(y) + pitch * .62) / slope, mid * (.27 + .05 * (lane % 3) + bare));
            for (let x = apothem - pitch * 1.12, row = 0; x >= inner; x -= pitch, row++) {
                const mark = hash(gore * 16 + column, row, 5) < .014;
                c.fillStyle = mark ? (back ? '#efe6c4' : '#e6e9e2') : back ? (hash(gore, column, row) < .5 ? '#775614' : '#7e5c17') : (hash(gore, column, row) < .5 ? '#182036' : '#1e2946');
                c.fillRect(x, y - cell / 2, cell, cell);
            }
        }
        c.restore();
    }
    c.translate(mid, mid);
    for (let fold = 0; fold < GORES; fold++) {
        const a = fold * 2 * WEDGE;
        c.strokeStyle = back ? '#4f3d12' : '#e0924a'; c.lineWidth = size / 512; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * mid, Math.sin(a) * mid); c.stroke();
    }
    for (let dot = 0; dot < GORES * 2; dot++) { const a = dot * WEDGE; c.fillStyle = '#e3e8ee'; c.beginPath(); c.arc(Math.cos(a) * mid * .2, Math.sin(a) * mid * .2, size / 256, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#9da3a5'; c.beginPath(); c.arc(0, 0, mid * .045, 0, Math.PI * 2); c.fill();
});
// The two name plates, one above the other.
const plates = () => payloadCanvas(512, 512, c => {
    c.fillStyle = '#f4f5f1'; c.fillRect(0, 0, 512, 512);
    c.strokeStyle = '#8c928e'; c.lineWidth = 6; c.strokeRect(3, 3, 506, 250); c.strokeRect(3, 259, 506, 250);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#c3272f'; c.font = 'italic 800 132px sans-serif'; c.fillText('Cygnus', 256, 138, 440);
    c.fillStyle = '#2b3a67'; for (let stripe = 0; stripe < 3; stripe++) c.fillRect(70, 44 + stripe * 12, 150 - stripe * 26, 5);
    c.fillStyle = '#1f4e96'; c.font = '800 86px sans-serif'; c.fillText('NORTHROP', 256, 342, 450); c.fillText('GRUMMAN', 256, 434, 450);
});
// Part of a shell about the axis, from `theta` on through `sweep`: radius `top` at y0 down to `bottom` at y1.
const shell = (top, bottom, y0, y1, theta = 0, sweep = Math.PI * 2, steps = 48) => new THREE.CylinderGeometry(top, bottom, y0 - y1, steps, 1, true, theta, sweep).translate(0, (y0 + y1) / 2, 0);
// A pressed pad on the barrel: a low boss over theta0..theta1 and y0 down to y1, its sides sloped.
function pad(theta0, theta1, y0, y1, rise = .018, bevel = .035) {
    const span = theta1 - theta0, steps = Math.max(2, Math.round(span / (Math.PI / 40))), edge = bevel / RADIUS;
    const angles = [theta0, ...Array.from({ length: steps + 1 }, (_, i) => theta0 + edge + (span - 2 * edge) * i / steps), theta1];
    const rows = [y0, y0 - bevel, y1 + bevel, y1], count = angles.length, positions = [], indices = [];
    for (let row = 0; row < 4; row++) for (let k = 0; k < count; k++) {
        const radius = RADIUS + .003 + (row > 0 && row < 3 && k > 0 && k < count - 1 ? rise : 0);
        positions.push(Math.sin(angles[k]) * radius, rows[row], Math.cos(angles[k]) * radius);
    }
    for (let row = 0; row < 3; row++) for (let k = 0; k < count - 1; k++) { const a = row * count + k, b = a + 1, c = a + count, d = c + 1; indices.push(a, c, b, b, c, d); }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
}
part('cygnus', 'Cygnus XL', '18 / VISITING SPACECRAFT', 'Northrop Grumman\'s cargo vehicle, first flown in 2025: a pressurised module built by Thales Alenia Space on a service module with one main engine, 32 thrusters and two round UltraFlex arrays. It does not dock by itself: it holds still below the station, Canadarm2 takes it and berths it on Unity\'s nadir port. The real grapple fixture stands on the aft deck beside the engine; the arm drawn here takes a second one on the side of the service module. The vehicle is not part of the configuration drawn here; the arm\'s Capture and Release operations bring it in and send it away.', [['Length', '7.89 m'], ['Diameter', '3.07 m'], ['Cargo', 'about 5,000 kg'], ['Pressurised volume', '36 m³'], ['Berthing port', 'Unity nadir'], ['Solar arrays', 'two UltraFlex, 3.7 m across, 3.5 kW'], ['Main engine', 'BT-4']], [0, -6.1, 12], (kit, group) => {
    const body = new THREE.Group(), into = new Kit(); body.name = 'Cygnus body'; group.add(body); group.userData.body = body;
    body.visible = false; body.raycast = () => body.visible;
    const white = palette.white, silver = palette.silver, dark = palette.dark, aluminium = 0xc3c7c0, bright = 0xd2d6d8, tan = 0xa98f52;
    const shield = material(0xffffff, .5, .35, plate()), metal = material(aluminium, .5, .35), blanketWhite = material(0xf1f2ec, .9, .03);
    const creases = crinkle(); creases.wrapS = creases.wrapT = THREE.RepeatWrapping;
    const crumple = (color, u, v, roughness, metalness) => {
        const map = creases.clone(); map.repeat.set(u, v); map.needsUpdate = true;
        const bumpMap = creases.clone(); bumpMap.colorSpace = THREE.NoColorSpace; bumpMap.repeat.set(u, v); bumpMap.needsUpdate = true;
        return new THREE.MeshStandardMaterial({ color, map, bumpMap, bumpScale: .035, roughness, metalness });
    };
    const foil = crumple(0xffffff, 7, 1.4, .3, .3), deckFoil = crumple(0xffffff, 2.6, 2.6, .3, .3), blackFoil = crumple(0x3d3f46, 8, .5, .42, .3);
    const put = (geometry, surface, outlined = false) => into.add(geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], outlined);
    const disc = (radius, y, surface, up = false, inner = 0) => put((inner ? new THREE.RingGeometry(inner, radius, 48) : new THREE.CircleGeometry(radius, 48)).rotateX(up ? -Math.PI / 2 : Math.PI / 2).translate(0, y, 0), surface);
    // A place on the vehicle's side: geometry made with +z out of the skin, +y forward and +x round the body is set
    // `radius` from the axis at `theta`.
    const mount = (theta, y, radius) => {
        const matrix = new THREE.Matrix4().makeRotationY(theta).setPosition(Math.sin(theta) * radius, y, Math.cos(theta) * radius);
        return (geometry, surface, outlined = true) => put(geometry.applyMatrix4(matrix), typeof surface === 'number' ? material(surface) : surface, outlined);
    };
    const block = (x, y, z, at = [0, 0, 0]) => new THREE.BoxGeometry(x, y, z).translate(...at);
    // A thruster: its bell opens along `direction` from `from`.
    const aim = new THREE.Quaternion(), down = new THREE.Vector3(0, -1, 0);
    const bell = (from, direction, length = .085, exit = .042) => {
        const d = new THREE.Vector3(...direction).normalize();
        return new THREE.CylinderGeometry(exit * .36, exit, length, 12).applyQuaternion(aim.setFromUnitVectors(down, d)).translate(from[0] + d.x * length / 2, from[1] + d.y * length / 2, from[2] + d.z * length / 2);
    };

    // Passive berthing ring: the seal face, alignment guides, capture fittings and bolts round the hatch.
    put(shell(RING, RING, 0, -.2), material(silver), true);
    put(shell(RING + .05, RING + .05, -.15, -.2), material(bright)); disc(RING + .05, -.15, material(bright), true, RING); disc(RING + .05, -.2, material(bright), false, RING);
    disc(RING, .002, material(palette.rail), true, 1.0);
    for (const radius of [1.045, 1.14]) ring(into, [0, .003, 0], radius, 'y', dark, .006);
    disc(1.0, -.04, material(dark), true);
    // The hatch: a square plate with stiffening ribs, a latch at each corner, the window and the handle.
    into.box([0, -.036, 0], [.94, .012, .94], silver); for (const side of [-1, 1]) { into.box([side * .455, -.026, 0], [.03, .02, .94], bright, [0, 0, 0], false); into.box([0, -.026, side * .455], [.94, .02, .03], bright, [0, 0, 0], false); into.box([side * .2, -.028, 0], [.022, .012, .88], bright, [0, 0, 0], false); }
    for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) into.box([x * .4, -.024, z * .4], [.09, .024, .09], dark, [0, 0, 0], false);
    disc(.11, -.029, material(palette.glass), true); ring(into, [0, -.027, 0], .11, 'y', dark, .01);
    into.box([.33, -.014, 0], [.04, .03, .34], bright, [0, 0, 0], false); into.cylinder([-.33, -.022, .2], .04, .016, tan, [0, 0, 0]);
    for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4, guide = mount(a, -.005, 1.095), latch = mount(a + Math.PI / 4, -.1, RING);
        guide(block(.12, .05, .12), dark, false); latch(block(.22, .14, .07, [0, 0, .03]), bright); latch(block(.1, .08, .05, [0, 0, .08]), dark, false);
    }
    for (let i = 0; i < 16; i++) { const a = (i + .5) * Math.PI / 8; put(new THREE.CylinderGeometry(.017, .017, .012, 8).translate(Math.sin(a) * 1.095, .004, Math.cos(a) * 1.095), material(bright)); }
    // Forward cone under white blankets, a seam for each shield, and the proximity antennas on its shoulder.
    put(shell(RING, RADIUS, -.2, CONE_END), blanketWhite);
    for (let i = 0; i < PANELS; i++) { const a = NAME_SIDE + (i + .5) * PANEL; into.rod([Math.sin(a) * (RING + .012), -.2, Math.cos(a) * (RING + .012)], [Math.sin(a) * (RADIUS + .01), CONE_END, Math.cos(a) * (RADIUS + .01)], .011, silver); }
    for (const a of [NAME_SIDE - .5, NAME_SIDE + 2.2]) { const seat = mount(a, -.44, 1.39); seat(block(.16, .1, .12, [0, 0, .04]), bright); seat(new THREE.CylinderGeometry(.03, .045, .09, 12).rotateX(Math.PI / 2).translate(0, 0, .14), white, false); }
    // The barrel: four rings of eight shields, two pressed pads on each; white blankets over two shields of the first
    // three rings; a strap between rings.
    for (let section = 0; section < SECTIONS; section++) {
        const y0 = CONE_END - section * SECTION, y1 = y0 - SECTION, middle = (y0 + y1) / 2;
        for (let panel = 0; panel < PANELS; panel++) {
            const theta = NAME_SIDE + (panel - .5) * PANEL, covered = section < 3 && (panel === 1 || panel === 2);
            put(shell(RADIUS, RADIUS, y0, y1, theta, PANEL, 6), shield);
            if (covered) put(shell(RADIUS + .016, RADIUS + .016, y0 - .07, y1 + .07, theta + .035, PANEL - .07, 6), blanketWhite, true);
            else for (const [top, bottom] of [[y0 - .1, middle + .05], [middle - .05, y1 + .1]]) put(pad(theta + .075, theta + PANEL - .075, top, bottom), metal, true);
        }
    }
    for (let band = 0; band <= SECTIONS; band++) {
        const y = CONE_END - band * SECTION;
        put(shell(RADIUS + .004, RADIUS + .004, y + .06, y - .06), material(0x4f5652)); put(shell(RADIUS + .013, RADIUS + .013, y + .034, y - .034), material(bright, .4, .45));
        for (let lug = 0; lug < 4; lug++) mount(NAME_SIDE + (lug * 2 + .5) * PANEL, y, RADIUS)(block(.09, .1, .05, [0, 0, .03]), white, false);
    }
    for (const [section, panel, side] of [[3, 0, 1], [3, 4, 1], [3, 6, -1], [2, 5, 1], [1, 7, -1], [0, 4, 1]]) mount(NAME_SIDE + panel * PANEL + side * .12, CONE_END - (section + .5) * SECTION, RADIUS + .004)(new THREE.CylinderGeometry(.045, .045, .012, 16).rotateX(Math.PI / 2), white, false);
    // Name plates on the two pads of the second ring that look along -z.
    const names = material(0xffffff, .8, 0, plates()); names.polygonOffset = true; names.polygonOffsetFactor = -1; names.polygonOffsetUnits = -1; names.userData.decal = true;
    for (const [top, bottom, v0] of [[-2.15, -2.53, .5], [-2.76, -3.16, 0]]) {
        const label = shell(RADIUS + .023, RADIUS + .023, top, bottom, NAME_SIDE - .26, .52, 8), uv = label.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) / 2);
        put(label, names);
    }

    // Aft skirt in black blankets, then the service module: a foil drum, the launch adapter ring and the aft deck.
    put(shell(RADIUS, SKIRT_RADIUS, BARREL_END - .034, SKIRT_END, 0, Math.PI * 2, 48), blackFoil);
    put(shell(SKIRT_RADIUS, DRUM, SKIRT_END, SKIRT_END - .03), blackFoil);
    put(shell(DRUM, DRUM, SKIRT_END - .03, DRUM_END), foil);
    for (const y of [SKIRT_END - .05, -7.0, DRUM_END + .03]) ring(into, [0, y, 0], DRUM + .004, 'y', bright, .012);
    put(shell(DRUM, ADAPTER, DRUM_END + .05, DRUM_END), material(bright, .35, .45));
    put(shell(ADAPTER, ADAPTER, DRUM_END, DECK), material(bright, .35, .45), true); disc(ADAPTER, DECK, material(bright, .35, .45), false, ADAPTER - .07);
    ring(into, [0, DRUM_END, 0], ADAPTER, 'y', silver, .014); ring(into, [0, DECK, 0], ADAPTER, 'y', silver, .014);
    disc(ADAPTER - .07, DECK + .004, deckFoil);
    for (let i = 0; i < 24; i++) { const a = (i + .5) * Math.PI / 12; put(new THREE.CylinderGeometry(.014, .014, .012, 8).translate(Math.sin(a) * (ADAPTER - .035), DECK - .004, Math.cos(a) * (ADAPTER - .035)), material(silver)); }
    // Main engine in its heat shield at the centre of the deck.
    put(shell(.3, .46, DECK - .05, DECK + .004, 0, Math.PI * 2, 32), deckFoil); disc(.3, DECK - .05, material(0x24262b), false);
    put(new THREE.CylinderGeometry(.075, .2, .25, 28).translate(0, DECK - .075, 0), material(0x8c7c62, .38, .5), true);
    disc(.185, DECK - .201, material(0x0d0e11), false); ring(into, [0, DECK - .2, 0], .193, 'y', 0xb7a98a, .009);
    // The real grapple fixture on the deck: white base, pale plate, three cam arms round the grapple pin.
    const fixtureZ = -.72;
    into.cylinder([0, DECK - .05, fixtureZ], .3, .1, 0xf0f1eb, [0, 0, 0]); into.cylinder([0, DECK - .11, fixtureZ], .21, .03, 0xcfc8a8, [0, 0, 0]);
    ring(into, [0, DECK - .1, fixtureZ], .29, 'y', bright, .012);
    for (let arm = 0; arm < 3; arm++) { const a = arm * Math.PI * 2 / 3 + Math.PI; into.box([Math.sin(a) * .1, DECK - .135, fixtureZ + Math.cos(a) * .1], [.036, .03, .2], 0xb19a52, [0, a, 0], false); }
    into.cylinder([0, DECK - .17, fixtureZ], .02, .12, bright, [0, 0, 0]); into.sphere([0, DECK - .235, fixtureZ], [.03, .022, .03], bright);
    // Deck fittings: fill and drain valves, a low-gain antenna, two foil boxes.
    for (const [x, z] of [[.62, .5], [.78, .28]]) { into.cylinder([x, DECK - .04, z], .035, .08, bright, [0, 0, 0]); into.cylinder([x, DECK - .09, z], .022, .03, tan, [0, 0, 0]); }
    into.cylinder([-.78, DECK - .03, .52], .07, .06, white, [0, 0, 0]); into.rod([-.78, DECK - .06, .52], [-.78, DECK - .2, .52], .012, silver);
    into.box([-.5, DECK - .05, .82], [.3, .1, .22], bright); into.box([.2, DECK - .04, .95], [.22, .08, .2], bright);

    // Round the drum, clear of the grapple fixture's side: three sensor heads, radiators, antennas, a cable tray.
    for (const [theta, y] of [[-.42, -6.72], [.08, -6.66], [-.2, -7.2]]) {
        const head = mount(theta, y, DRUM);
        head(block(.34, .26, .15, [0, 0, .075]), 0xf0f1eb); head(block(.3, .22, .012, [0, 0, .156]), bright, false);
        for (const side of [-1, 1]) head(block(.105, .12, .012, [side * .075, 0, .163]), 0x101216, false);
    }
    for (const [theta, y, width, height, color] of [[.8, -6.95, .58, .5, 0x27313c], [-1.0, -7.02, .5, .56, 0x27313c], [2.2, -7.05, .46, .5, 0x27313c], [-2.25, -7.0, .54, .56, 0xeceee8]]) {
        const face = mount(theta, y, DRUM);
        face(block(width + .06, height + .06, .03, [0, 0, .015]), bright); face(block(width, height, .012, [0, 0, .036]), material(color, .22, .45), false);
        for (let line = 1; line < 4; line++) face(block(width, .006, .004, [0, (line / 4 - .5) * height, .044]), color === 0x27313c ? 0x55606b : 0xb9bdb6, false);
    }
    for (const theta of [.45, -1.55]) { const patch = mount(theta, -6.52, DRUM); patch(new THREE.CylinderGeometry(.07, .07, .03, 20).rotateX(Math.PI / 2).translate(0, 0, .02), white, false); patch(new THREE.CylinderGeometry(.02, .02, .05, 10).rotateX(Math.PI / 2).translate(0, 0, .05), tan, false); }
    for (const theta of [1.25, -1.85]) { const tray = mount(theta, (SKIRT_END + DRUM_END) / 2, DRUM); tray(block(.09, 1.2, .05, [0, 0, .025]), bright, false); }
    for (const [theta, y, width, height, depth] of [[.31, -7.3, .3, .22, .1], [-.52, -7.15, .24, .2, .12], [1.71, -6.75, .34, .3, .12], [-1.61, -6.8, .32, .3, .1]]) {
        // Foil-wrapped boxes: their faces take as much of the crumpled image as the same area of the drum does.
        const box = block(width, height, depth, [0, 0, depth / 2]), uv = box.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * width * .14, uv.getY(i) * height * .76);
        mount(theta, y, DRUM)(box, foil);
    }
    // Two star tracker baffles on a bracket, looking out and forward.
    for (const theta of [-1.22, -.9]) {
        const tracker = mount(theta, -6.58, DRUM);
        tracker(block(.16, .12, .08, [0, 0, .04]), bright, false);
        tracker(new THREE.CylinderGeometry(.075, .05, .17, 16).rotateX(Math.PI / 2 - .5).translate(0, .05, .15), 0xe9ebe6); tracker(new THREE.CircleGeometry(.068, 16).rotateX(-.5).translate(0, .0925, .2277), 0x101216, false);
    }
    // 32 thrusters: a block of four at each quarter, forward and aft.
    for (let quarter = 0; quarter < 4; quarter++) for (const aft of [false, true]) {
        const pod = mount(Math.PI / 4 + quarter * Math.PI / 2, aft ? -7.5 : -6.58, DRUM);
        pod(block(.24, .2, .15, [0, 0, .07]), material(bright, .35, .45));
        for (const [from, direction] of [[[0, 0, .145], [0, 0, 1]], [[.12, 0, .09], [1, 0, .25]], [[-.12, 0, .09], [-1, 0, .25]], [[0, aft ? -.1 : .1, .1], aft ? [0, -1, .2] : [0, .55, .85]]]) pod(bell(from, direction), material(0x8d9396, .4, .5), false);
    }

    // Two UltraFlex arrays: ten flat gores from a raised hub to the rim, cells aft; behind each, the boom from the drive
    // on the drum to the hub, the spar beyond it and a rib along every fold.
    const cells = new THREE.MeshStandardMaterial({ map: blanket(false), roughness: .32, metalness: .15 }), film = new THREE.MeshStandardMaterial({ map: blanket(true), roughness: .55, metalness: .3 });
    for (const side of [-1, 1]) {
        const x = side * ARRAY_X, hub = [x, ARRAY_Y + ARRAY_RISE, 0], corner = k => [x + Math.cos(k * 2 * WEDGE) * ARRAY_RADIUS, ARRAY_Y, Math.sin(k * 2 * WEDGE) * ARRAY_RADIUS];
        for (const back of [false, true]) {
            const positions = [], uvs = [], lift = back ? .003 : 0;
            for (let gore = 0; gore < GORES; gore++) for (const point of back ? [hub, corner(gore + 1), corner(gore)] : [hub, corner(gore), corner(gore + 1)]) {
                positions.push(point[0], point[1] + lift, point[2]); uvs.push(.5 + (point[0] - x) / (2 * ARRAY_RADIUS), .5 + point[2] / (2 * ARRAY_RADIUS));
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.computeVertexNormals();
            put(geometry, back ? film : cells);
        }
        for (let k = 0; k < GORES; k++) {
            const a = corner(k), b = corner(k + 1);
            into.rod(a, b, .007, silver); into.rod([hub[0], hub[1] + .012, hub[2]], [a[0], a[1] + .012, a[2]], .008, tan);
        }
        const inner = corner(side > 0 ? 5 : 0), outer = corner(side > 0 ? 0 : 5), root = [side * (DRUM + .2), ARRAY_Y + .1, 0];
        for (const end of [inner, outer]) into.rod([hub[0], hub[1] - .014, 0], [end[0], end[1] - .014, 0], .014, bright);
        into.cylinder(hub, .12, .09, bright, [0, 0, 0]); into.cylinder([hub[0], hub[1] + .06, 0], .06, .05, silver, [0, 0, 0]);
        // Drive under orange film on the drum, the lattice boom to the hub, the spar on to the far corner.
        into.box([side * (DRUM + .1), ARRAY_Y + .08, 0], [.26, .3, .34], 0xc0732e);
        into.rod(root, [hub[0], hub[1] + .07, 0], .034, tan);
        for (let collar = 1; collar < 8; collar++) { const t = collar / 8; put(new THREE.TorusGeometry(.04, .008, 4, 12).rotateY(Math.PI / 2).translate(root[0] + (hub[0] - root[0]) * t, root[1] + (hub[1] + .07 - root[1]) * t, 0), material(bright)); }
        into.rod([hub[0], hub[1] + .05, 0], [outer[0], outer[1] + .03, 0], .016, bright);
        for (const z of [-.13, .13]) into.rod([side * (DRUM + .18), ARRAY_Y + .04, z], [inner[0], inner[1] + .02, 0], .014, silver);
    }
    // The fixture the arm takes, on a pedestal on the side of the service module that looks forward while berthed.
    into.box([FIXTURE[0], FIXTURE[1], FIXTURE[2] + .1], [.5, .5, .1], silver);
    hardware(into).grappleFixture(FIXTURE, [0, 0, -1]);
    into.finish(body);
});
