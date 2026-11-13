// Cygnus XL, the cargo vehicle Canadarm2 captures and berths (the Capture and Release operations of the arm).
import * as THREE from 'three';
import { Kit, material, palette } from '../core/kit.js';
import { part, ring } from '../core/station.js';
import { hardware } from '../robotics/hardware.js';

// Built in the vehicle's own frame (group.userData.body): the origin is the centre of the berthing ring's face, +y runs
// through the hatch into the station, and the grapple fixture looks along -z (js/robotics/fixtures.js keeps the same
// place for it). Where the body is, and whether it shows at all, come from js/robotics/index.js; a hidden body cannot
// be picked. Sizes follow the published ones (about 8 m long, 3.07 m across, two round 3.7 m arrays); shapes are
// simplified.
const FIXTURE = [0, -6.95, -1.27], ARRAY_X = 3.6, ARRAY_Y = -7, ARRAY_RADIUS = 1.85, GORES = 10;
function cells() {
    const size = 512, canvas = document.createElement('canvas'), c = canvas.getContext('2d'), mid = size / 2;
    canvas.width = canvas.height = size;
    c.fillStyle = '#1b2433'; c.fillRect(0, 0, size, size);
    c.strokeStyle = '#3a4a63'; c.lineWidth = 1.2;
    for (let r = mid / 9; r < mid; r += mid / 9) { c.beginPath(); c.arc(mid, mid, r, 0, Math.PI * 2); c.stroke(); }
    for (let i = 0; i < GORES * 4; i++) {
        const a = i * Math.PI * 2 / (GORES * 4);
        c.strokeStyle = i % 4 ? '#2c3a50' : '#a9b0b3'; c.lineWidth = i % 4 ? 1 : 3;
        c.beginPath(); c.moveTo(mid + Math.cos(a) * mid * .09, mid + Math.sin(a) * mid * .09); c.lineTo(mid + Math.cos(a) * mid, mid + Math.sin(a) * mid); c.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    return texture;
}
part('cygnus', 'Cygnus XL', '18 / VISITING SPACECRAFT', 'Northrop Grumman\'s cargo vehicle. It does not dock by itself: it holds still about ten metres below the station, Canadarm2 takes it by the grapple fixture on its service module and berths it on Unity\'s nadir port. It is not part of the configuration drawn here; the arm\'s Capture and Release operations bring it in and send it away.', [['Length', 'about 8 m'], ['Diameter', '3.07 m'], ['Cargo', 'about 5,000 kg'], ['Berthing port', 'Unity nadir'], ['Solar arrays', 'two, 3.7 m across']], [0, -6.1, 12], (kit, group) => {
    const body = new THREE.Group(), into = new Kit(); body.name = 'Cygnus body'; group.add(body); group.userData.body = body;
    body.visible = false; body.raycast = () => body.visible;
    const white = palette.white, silver = palette.silver, dark = palette.dark, blanket = material(0xeceee9, .84, .05), foil = material(palette.foil, .5, .45);
    const tube = (top, bottom, length, y, surface, segments = 48) => into.add(new THREE.CylinderGeometry(top, bottom, length, segments, 1), surface, [0, y, 0]);
    // Berthing ring and hatch, the cone behind them, the pressurised module with its bands.
    tube(1.19, 1.19, .2, -.1, material(silver));
    into.add(new THREE.RingGeometry(1.0, 1.19, 48), material(palette.rail), [0, .002, 0], [1, 1, 1], [-Math.PI / 2, 0, 0], false);
    into.add(new THREE.CircleGeometry(1.0, 48), material(dark), [0, -.04, 0], [1, 1, 1], [-Math.PI / 2, 0, 0], false);
    into.add(new THREE.CircleGeometry(.42, 32), material(silver), [0, -.035, 0], [1, 1, 1], [-Math.PI / 2, 0, 0], false);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; into.box([Math.cos(a) * 1.095, -.005, Math.sin(a) * 1.095], [.12, .05, .12], dark, [0, -a, 0], false); }
    tube(1.19, 1.535, .7, -.55, blanket);
    tube(1.535, 1.535, 5.4, -3.6, blanket);
    for (const y of [-.95, -2.28, -3.6, -4.92, -6.25]) ring(into, [0, y, 0], 1.54, 'y', silver, .03);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; into.rod([Math.cos(a) * 1.56, -1.2, Math.sin(a) * 1.56], [Math.cos(a) * 1.56, -6.0, Math.sin(a) * 1.56], .018, palette.rail); }
    // Service module: foil drum, engine, thruster blocks, star tracker and the antenna.
    tube(1.535, 1.15, .2, -6.4, material(silver));
    tube(1.15, 1.15, 1.25, -7.125, foil);
    ring(into, [0, -6.52, 0], 1.155, 'y', silver, .025); ring(into, [0, -7.73, 0], 1.155, 'y', silver, .025);
    into.add(new THREE.CircleGeometry(1.15, 48), material(dark), [0, -7.752, 0], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    tube(.13, .26, .16, -7.83, material(dark), 24);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; into.box([Math.cos(a) * 1.19, -7.5, Math.sin(a) * 1.19], [.16, .2, .16], silver, [0, -a, 0]); }
    into.box([.55, -6.75, 1.17], [.22, .26, .1], dark); into.cylinder([-.5, -7.2, 1.2], .16, .06, white);
    // Two round arrays on short booms, their faces along the vehicle's axis.
    const panel = new THREE.MeshStandardMaterial({ map: cells(), roughness: .42, metalness: .3, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
        const x = side * ARRAY_X;
        into.rod([side * 1.13, ARRAY_Y, 0], [side * (ARRAY_X - ARRAY_RADIUS + .12), ARRAY_Y, 0], .045, silver);
        into.add(new THREE.CircleGeometry(ARRAY_RADIUS, GORES * 4), panel, [x, ARRAY_Y, 0], [1, 1, 1], [0, 0, 0], false);
        into.cylinder([x, ARRAY_Y, 0], .17, .07, silver);
        ring(into, [x, ARRAY_Y, 0], ARRAY_RADIUS, 'z', silver, .016);
        for (let i = 0; i < GORES; i++) { const a = i * Math.PI * 2 / GORES; into.rod([x, ARRAY_Y, .012], [x + Math.cos(a) * ARRAY_RADIUS, ARRAY_Y + Math.sin(a) * ARRAY_RADIUS, .012], .012, silver); }
    }
    // The grapple fixture Canadarm2 takes, on a pedestal on the forward side of the service module.
    into.box([FIXTURE[0], FIXTURE[1], FIXTURE[2] + .1], [.5, .5, .1], silver);
    hardware(into).grappleFixture(FIXTURE, [0, 0, -1]);
    into.finish(body);
});
