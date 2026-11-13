// Grapple fixtures Canadarm2 and Dextre can hold, under the telemetry's base-location codes, and the frames the arm
// holds them by. A fixture is a centre, an outward normal and a clocking direction across it: on the Mobile Base System
// in station coordinates with the base at home (layout.js), on Dextre and on the cargo vehicle in the body's frame,
// the rest in station coordinates. Only the base's fixtures, the one on Dextre's head and the Destiny fixture are part of the drawings;
// the places of the others are illustrative (the real ones are not published in a form this page can use).
import { frame } from './kinematics.js?v=44ee3feec6';
import { MBS_FIXTURES, MBS_HOME, SEAT } from './layout.js?v=b4fe2c8612';

const unit = v => { const length = Math.hypot(...v); return v.map(c => c / length); };
// A fixture on a module: `part` is the module it is drawn with (and ghosts and highlights with).
const station = (name, code, part, center, normal, up) => ({ name, code, host: 'station', part, center, normal: unit(normal), up });
export const fixtures = new Map(Object.entries({
    'lab-pdgf': station('Destiny PDGF', 1, 'destiny', [2.11, .77, 3.4], [.94, .342, 0], [0, 0, 1]),
    'node3-pdgf': station('Node 3 PDGF', 2, 'tranquility', [-4.6, 1.59, 10.41], [0, .707, -.707], [1, 0, 0]),
    'node2-pdgf': station('Node 2 PDGF', 4, 'harmony', [1.59, 1.59, -2.2], [.707, .707, 0], [0, 0, -1]),
    'mbs-pdgf1': { name: 'MBS PDGF 1', code: 7, host: 'mbs', ...MBS_FIXTURES['mbs-pdgf1'] },
    'mbs-pdgf2': { name: 'MBS PDGF 2', code: 8, host: 'mbs', ...MBS_FIXTURES['mbs-pdgf2'] },
    'mbs-pdgf3': { name: 'MBS PDGF 3', code: 11, host: 'mbs', ...MBS_FIXTURES['mbs-pdgf3'] },
    'mbs-pdgf4': { name: 'MBS PDGF 4', code: 13, host: 'mbs', ...MBS_FIXTURES['mbs-pdgf4'] },
    'fgb-pdgf': station('FGB PDGF', 14, 'zarya', [-.82, 2.15, 24.06], [-.5, .866, 0], [0, 0, 1]),
    // On Dextre's head, in its body frame (Dextre stands along +y; its front is +z).
    'dextre-pdgf': { name: 'Dextre PDGF', code: null, host: 'dextre', center: [0, 3.30, -.06], normal: [0, 1, 0], up: [0, 0, 1] },
    // On the cargo vehicle's service module, in its body frame (pose.js cargoFrame: +y through the hatch), on the side
    // that looks forward while it is berthed.
    'cygnus-fgf': { name: 'Cygnus grapple fixture', code: null, host: 'cargo', center: [0, -6.95, -1.27], normal: [0, 0, -1], up: [-1, 0, 0] }
}));
for (const [id, entry] of fixtures) { entry.id = id; entry.normal = unit(entry.normal); }
export const fixtureByCode = code => [...fixtures.values()].find(entry => entry.code === code) || null;

// The arm frame (kinematics.js) with LEE A latched on fixture `id`: its mouth SEAT out from the centre, x along the
// outward normal (LEE A looks back down it), z along the clocking. `hosts` gives where the movable hosts are: the
// base's centre along the truss (`mbs`, metres), Dextre's body frame and the cargo vehicle's (`dextre`, `cargo`:
// column-major matrices).
export function seat(id, hosts) {
    const entry = fixtures.get(id);
    let center = entry.center, normal = entry.normal, up = entry.up;
    if (entry.host === 'mbs') center = [center[0] + hosts.mbs - MBS_HOME, center[1], center[2]];
    if (entry.host === 'dextre' || entry.host === 'cargo') {
        const m = hosts[entry.host], point = p => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
        const direction = d => [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]];
        center = point(center); normal = unit(direction(normal)); up = direction(up);
    }
    const along = up[0] * normal[0] + up[1] * normal[1] + up[2] * normal[2];
    const z = unit([up[0] - along * normal[0], up[1] - along * normal[1], up[2] - along * normal[2]]);
    const y = [z[1] * normal[2] - z[2] * normal[1], z[2] * normal[0] - z[0] * normal[2], z[0] * normal[1] - z[1] * normal[0]];
    return frame([center[0] + normal[0] * SEAT, center[1] + normal[1] * SEAT, center[2] + normal[2] * SEAT], normal, y, z);
}
