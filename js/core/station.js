// The part registry (part() builds a selectable assembly into the station), state shared by several parts, and
// the layout constants that tie the parts together.
import * as THREE from 'three';
import { station } from './stage.js';
import { Kit, material, palette } from './kit.js';

export const parts = new Map();
export const wings = [];
export const trackingDishes = [];
export const destinyShutter = {
    pivot: null, openAngle: Math.PI * .84, angle: Math.PI * .84,
    target: Math.PI * .84, from: Math.PI * .84, progress: 1, duration: 2.8
};
// Ghosted parts (all but the selection) draw at this opacity, as does Dragon's hull in the cabin view.
export const ghostOpacity = .1;
// Shared full-size PMA envelope from the supplied GLB, cross-checked against the USDZ mesh.
export const pmaReferenceLength = 2.6519663333892822, pmaReferenceOffset = 0.7347772121429443;
export const pma1BaseZ = 15.45, pma2BaseZ = -8.72;
// Keep the Russian docking face seated on the rebuilt PMA-1's outward interface.
export const russianSegmentOffset = new THREE.Vector3(0, pmaReferenceOffset, pma1BaseZ + pmaReferenceLength - 17.04);
// User-specified centerlines for the radiator banks and the solar rotary joints.
export const radiatorBankX = 14;
// The integrated truss and everything it carries sit this much lower over Destiny than first drawn, which shortens
// the S0 support struts by about 45%.
export const trussDrop = 1.6;
// Truss member sections measured on the supplied GLB, in metres. They are box tubes: chords give [across, height],
// frames and braces a square side or [along the truss, across]. Only the S5/P5 cage is tubular, its struts swelling
// from 0.064 at the end fittings to 0.133 mid-length.
export const trussSections = {
    S0: { fore: [.152, .152], knee: [.152, .21], aft: [.152, .152], frame: .116, web: [.116, .16], brace: .132, aftBrace: .107 },
    S1: { fore: [.152, .152], aft: [.152, .21], frame: .105, brace: .105, deckBrace: .132 },
    S3: { fore: [.092, .116], aft: [.152, .116], frame: .098, brace: .106 },
    S4: { fore: [.16, .11], aft: [.16, .11], frame: .10, brace: .08 },
    S5: { strut: [.064, .133], frame: [.098, .15] },
    S6: { fore: [.16, .11], aft: [.16, .11], frame: .075, endPost: [.106, .158], brace: .075 },
    SARJ: { strut: .08, seat: .066 }
};
// Seat the mounting pads on the aft chord surface of the narrow S1/P1 segments.
// The bank's .785-deep root stays .08 beyond that surface, clear of covers.
export const radiatorTrussSurfaceZ = 4 + trussSections.S1.aft[0] / 2; // S1/P1's narrow aft chords
export const radiatorBankZ = radiatorTrussSurfaceZ + .785 + .08;
export const solarRotaryJointX = 23.5; // Align with the truss post marked in the reference.
export const solarStations = [-48, -32, 32, 48];
// Image-directed outboard offset: move each terminal wing as one
// connected assembly, including its canister and iROSA modification kit.
export const solarRootX = across => across + (Math.abs(across) === 48 ? Math.sign(across) * 1.60 : 0);
// The two wings of a module sit one above the other in its beta-gimbal frame, on the same station along the truss:
// the aft wing's mast canister runs in through the upper half and the forward wing's through the lower half, so
// the two pass without meeting. Port and starboard are mirror images.
export const solarWingStagger = .72, solarPocketHalf = 1.1;
export const solarWingY = direction => 6.8 + direction * solarWingStagger;
export const inSolarPocket = x => solarStations.some(root => Math.abs(root) === 32 && Math.abs(root - x) < solarPocketHalf);
// Channel groupings follow NASA's ISS electrical power system overview.
// Forward/aft is a schematic pose; beta-gimbal rotation varies in orbit.
export const powerChannels = { '-48': ['2B', '4B'], '-32': ['4A', '2A'], '32': ['1A', '3A'], '48': ['1B', '3B'] };
export const augmentedChannels = new Set(['2B', '4B', '4A', '1A', '3A', '1B']);
export const modernParts = new Set(['irosa', 'nauka', 'prichal', 'tranquility', 'leonardo', 'beam', 'bishop', 'poisk', 'rassvet', 's3payloads', 'p3payloads']);
export function part(id, name, category, description, facts, anchor, builder) {
    const group = new THREE.Group(); group.name = name; group.userData.part = id;
    const kit = new Kit(); builder(kit, group); kit.finish(group); station.add(group);
    const entry = { id, name, category, description, facts, anchor: new THREE.Vector3(...anchor), group };
    parts.set(id, entry); return entry;
}
export function ring(kit, center, radius, axis = 'z', color = palette.silver, tube = .055) {
    const rotation = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    kit.add(new THREE.TorusGeometry(radius, tube, 6, 32), material(color), center, [1, 1, 1], rotation, false);
}
