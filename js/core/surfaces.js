// Painted surfaces: canvas textures (labels, solar cells, radiators, quilted skin, MLI blankets) and the
// materials, decals and panels built on them.
import * as THREE from 'three';
import { renderer } from './stage.js';
import { material, palette } from './kit.js';

export function labelTexture(text, color = '#344b42') {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext('2d');
    // Transparent ink: the hull itself remains visible between letters.
    context.fillStyle = color; context.font = '600 62px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 256, 66, 470);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); return texture;
}
function decalMaterial(text) {
    const ink = material(0xffffff, .85, 0, labelTexture(text));
    ink.alphaTest = .25; ink.polygonOffset = true; ink.polygonOffsetFactor = -1;
    ink.polygonOffsetUnits = -1; ink.userData.decal = true;
    return ink;
}
export function badge(kit, text, position, size, rotation = [-Math.PI / 2, 0, 0]) {
    kit.add(new THREE.PlaneGeometry(size[0], size[1]), decalMaterial(text), position, [1, 1, 1], rotation, false);
}
export function hullBadge(kit, text, center, radius, size, axis = 'z', angle = Math.PI / 2) {
    // The long edge follows the module axis; the short edge wraps its skin.
    const geometry = new THREE.PlaneGeometry(size[0], size[1], 1, 12);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const along = -positions.getX(i), a = angle + positions.getY(i) / radius;
        const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
        positions.setXYZ(i, axis === 'x' ? along : x, y, axis === 'x' ? -x : along);
    }
    geometry.computeVertexNormals();
    kit.add(geometry, decalMaterial(text), center, [1, 1, 1], [0, 0, 0], false);
}
// Cell detail is procedural: no image assets are needed for the station.
function solarTexture(modern = false, back = false) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 1536;
    const context = canvas.getContext('2d');
    context.fillStyle = back ? '#735030' : modern ? '#101c2a' : '#62472e'; context.fillRect(0, 0, 768, 1536);
    const columns = modern ? 18 : 24, rows = modern ? 80 : 128;
    const cellWidth = 768 / columns, cellHeight = 1536 / rows;
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
        const shade = (row * 17 + column * 7) % 5;
        context.fillStyle = back ? ['#876039', '#795632', '#825b36', '#916840', '#795a3b'][shade] : modern ? ['#1b3047', '#20394f', '#1b354c', '#253f57', '#1d344c'][shade] : ['#33303e', '#3b3440', '#413743', '#342f3b', '#3f3540'][shade];
        context.fillRect(column * cellWidth + .8, row * cellHeight + .8, cellWidth - 1.6, cellHeight - 1.6);
        context.fillStyle = back ? '#c19c6655' : '#b1b2bd66';
        for (const bus of [.25, .75]) context.fillRect(column * cellWidth + cellWidth * bus, row * cellHeight + 1, .55, cellHeight - 2);
    }
    // Fold lines and transverse conductors remain legible at close range.
    for (let band = 0; band <= 32; band++) {
        context.fillStyle = back ? '#493721' : '#a48d70'; context.fillRect(0, band * 48, 768, 1.4);
        context.fillStyle = '#ffffff18'; context.fillRect(0, band * 48 + 2, 768, 2);
    }
    context.fillStyle = '#b7a082'; context.fillRect(0, 0, 3, 1536); context.fillRect(765, 0, 3, 1536);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return texture;
}
export const legacySolar = solarTexture(), legacyBack = solarTexture(false, true), modernSolar = solarTexture(true);
// White thermal coating with fine parallel flow-channel seams, following
// the supplied close-up. Raised channels and hinges are modeled below.
function radiatorTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 648;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fafbf8'; context.fillRect(0, 0, 512, 648);
    // Fine, restrained coating grain; no photovoltaic cell grid.
    for (let row = 0; row < 648; row += 4) {
        context.fillStyle = row % 12 ? '#f4f6f3' : '#ffffff';
        context.fillRect(0, row, 512, 1);
    }
    for (let channel = 0; channel < 9; channel++) {
        const y = 648 * (.5 + (-1.44 + channel * .36) / 3.32);
        context.fillStyle = '#d9dfdc'; context.fillRect(18, y - 1, 476, 2);
        context.fillStyle = '#ffffff'; context.fillRect(18, y + 1, 476, 2);
    }
    context.strokeStyle = '#d0d8d4'; context.lineWidth = 2;
    context.strokeRect(7, 7, 498, 634);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return texture;
}
export const radiatorFace = radiatorTexture();
// Kibo-style quilted MMOD skin, shared by the pressurized modules: pressed pockets inside a plain border on each
// curved panel, laid over dark seams.
function quiltTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 160;
    const context = canvas.getContext('2d'); context.fillStyle = '#d6dad6'; context.fillRect(0, 0, 128, 160);
    for (let column = 0; column < 3; column++) for (let row = 0; row < 5; row++) {
        const x = 10 + column * 37, y = 10 + row * 29;
        context.fillStyle = (column + row) % 2 ? '#c8cdc9' : '#ced2ce'; context.fillRect(x, y, 33, 25);
        context.strokeStyle = 'rgba(95,105,101,.45)'; context.lineWidth = 1.2; context.strokeRect(x + .5, y + .5, 32, 24);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return texture;
}
export const quiltMap = quiltTexture(), quiltSeam = material(0x5f6866, .8, .2);
export const quiltPanels = [material(0xffffff, .5, .38, quiltMap), material(0xe9ece9, .5, .38, quiltMap)];
// One curved quilted panel on a cylinder about the z axis (angle 0 = +x, a quarter turn = +y), wound outward.
export function quiltPanel(kit, radius, z0, z1, a0, a1, surface) {
    if (z0 > z1) [z0, z1] = [z1, z0];
    if (a0 > a1) [a0, a1] = [a1, a0];
    const steps = Math.max(2, Math.ceil((a1 - a0) / (Math.PI / 32))), positions = [], uvs = [], indices = [];
    for (let row = 0; row < 2; row++) for (let i = 0; i <= steps; i++) {
        const a = a0 + (a1 - a0) * i / steps;
        positions.push(Math.cos(a) * radius, Math.sin(a) * radius, row ? z1 : z0); uvs.push(i / steps, row);
    }
    for (let i = 0; i < steps; i++) { const j = i + steps + 1; indices.push(i, i + 1, j, j, i + 1, j + 1); }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    kit.add(geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
}
export function panel(kit, center, width, length, modern = false) {
    kit.box(center, [width, .055, length], palette.black, [0, 0, 0], false);
    kit.add(new THREE.PlaneGeometry(width - .08, length - .08), material(0xffffff, .78, .12, modern ? modernSolar : legacySolar), [center[0], center[1] + .032, center[2]], [1, 1, 1], [-Math.PI / 2, 0, 0], false);
    kit.add(new THREE.PlaneGeometry(width - .08, length - .08), material(0xffffff, .88, .06, modern ? modernSolar : legacyBack), [center[0], center[1] - .032, center[2]], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    for (const side of [-1, 1]) kit.rod([center[0] + side * width / 2, center[1], center[2] - length / 2], [center[0] + side * width / 2, center[1], center[2] + length / 2], modern ? .045 : .028, palette.silver);
    for (const end of [-1, 1]) kit.box([center[0], center[1], center[2] + end * length / 2], [width + .22, .16, .18], palette.silver);
}
// Shared payload surfaces: a canvas-texture helper, crumpled white blankets and pillow-shaped covers.
export function payloadCanvas(width, height, draw) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; draw(canvas.getContext('2d'));
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return texture;
}
// White multilayer insulation (MLI) used by every blanket: dense irregular creases and low-relief folds.
const mliCanvas = (() => {
    const blanketCanvas = document.createElement('canvas'); blanketCanvas.width = blanketCanvas.height = 512;
    const c = blanketCanvas.getContext('2d'), pix = c.createImageData(512, 512);
    const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7 + 45.3) * 43758.5453; return n - Math.floor(n); };
    function noise(x, y, s) { const xx = x / s, yy = y / s, ix = Math.floor(xx), iy = Math.floor(yy), fx = xx - ix, fy = yy - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v); }
    for (let y = 0; y < 512; y++)for (let x = 0; x < 512; x++) {
        const n = noise(x + noise(x, y, 39) * 23, y - noise(x, y, 47) * 17, 9), ridge = Math.pow(1 - Math.abs(n * 2 - 1), 13), v = 229 + (noise(x, y, 44) - .5) * 15 + (noise(x, y, 3) - .5) * 8 - ridge * 29, i = (y * 512 + x) * 4;
        pix.data[i] = v; pix.data[i + 1] = v + 2; pix.data[i + 2] = v + 1; pix.data[i + 3] = 255;
    }
    c.putImageData(pix, 0, 0);
    for (let i = 0; i < 2100; i++) {
        const x = hash(i, 5) * 512, y = hash(i, 19) * 512, a = hash(i, 27) * Math.PI * 2, l = 4 + hash(i, 33) * 19;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a + .45) * l * .44, y + Math.sin(a + .45) * l * .44); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        c.lineWidth = .65; c.strokeStyle = 'rgba(98,107,101,.22)'; c.stroke(); c.translate(.7, .7); c.strokeStyle = 'rgba(255,255,250,.55)'; c.stroke(); c.translate(-.7, -.7);
    }
    return blanketCanvas;
})();
export const mliTexture = new THREE.CanvasTexture(mliCanvas); mliTexture.colorSpace = THREE.SRGBColorSpace; mliTexture.wrapS = mliTexture.wrapT = THREE.RepeatWrapping; mliTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
export const mliBump = mliTexture.clone(); mliBump.colorSpace = THREE.NoColorSpace; mliBump.needsUpdate = true;
export const payloadBlanket = new THREE.MeshStandardMaterial({ color: 0xf2f3ec, map: mliTexture, bumpMap: mliBump, bumpScale: .037, roughness: .94, metalness: .10 });
// The carriers' recessed 9-by-6 deck grid, after the GLB deck image; ESP-2 and the truss payload carriers share it.
export const carrierGrid = payloadCanvas(720, 480, g => {
    g.fillStyle = '#929688'; g.fillRect(0, 0, 720, 480);
    for (let row = 0; row < 6; row++) for (let col = 0; col < 9; col++) {
        const x = col * 80, y = row * 80;
        g.fillStyle = (row + col) % 3 ? '#4f574c' : '#555d52'; g.fillRect(x + 9, y + 9, 62, 62);
        g.strokeStyle = '#717a6b'; g.lineWidth = 3; g.strokeRect(x + 11, y + 11, 58, 58);
        g.fillStyle = '#626d5e'; g.fillRect(x + 22, y + 33, 35, 15);
        for (const dx of [3, 77]) for (const dy of [3, 77]) {
            g.fillStyle = '#adb1a2'; g.beginPath(); g.arc(x + dx, y + dy, 3, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#545c50'; g.beginPath(); g.arc(x + dx, y + dy, 1.4, 0, Math.PI * 2); g.fill();
        }
    }
});
// A blanketed payload bulges gently on every face; its edges stay square.
export const payloadPillow = new THREE.BoxGeometry(1, 1, 1, 6, 6, 6);
{
    const puff = payloadPillow.attributes.position;
    for (let i = 0; i < puff.count; i++) {
        const v = [puff.getX(i), puff.getY(i), puff.getZ(i)], k = v.findIndex(c => Math.abs(Math.abs(c) - .5) < 1e-6);
        const [a, b] = [0, 1, 2].filter(axis => axis !== k).map(axis => 1 - (2 * v[axis]) ** 2);
        v[k] += Math.sign(v[k]) * .07 * a * b; puff.setXYZ(i, ...v);
    }
    payloadPillow.computeVertexNormals();
}
// Attach sites for the truss payloads: a bridge above the rails (zenith, up = 1) or under the lower chords (nadir,
// up = -1), with a latch. The bridge covers the seated payload's footprint [xmin, xmax, zmin, zmax], at least
// 1.5 m by 3.5 m.
export function payloadAttachSite(kit, x, up, [x0, x1, z0, z1]) {
    const y = up > 0 ? 8.98 : 5.05, width = Math.max(1.5, x1 - x0 + .1), depth = Math.max(3.5, 2 * Math.max(-z0, z1) + .1);
    kit.box([x, y, 4], [width, .14, depth], palette.silver);
    kit.box([x, y + up * .1, 4], [.62, .08, .62], palette.hull);
    if (up > 0) for (const z of [2.6, 4.9]) for (const dx of [-.6, .6]) kit.box([x + dx, 8.74, z], [.14, .36, .14], palette.silver); // clear of the rails
    else for (const z of [2.3, 5.7]) for (const dx of [-.6, .6]) kit.box([x + dx, 5.15, z], [.16, .12, .22], palette.silver);
}
