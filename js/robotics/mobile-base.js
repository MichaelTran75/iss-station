// The Mobile Base System: the platform Canadarm2 and Dextre ride along the rails on the truss's forward face, on the
// Mobile Transporter. Built once in its own mirrored frame (as first drawn: the cage upright, its occupied fixture facing
// starboard), inside a carriage group that slides along x (`setCarriage`). Where its fixtures are, and how far it runs,
// is in layout.js.
import * as THREE from 'three';
import { Kit, material, palette } from '../core/kit.js';
import { armBlanket, hardware, pillow, snare } from './hardware.js';
import { CAGE, MBS_HOME } from './layout.js';

// The cage frame is mirrored across x: station = (0.7 - x, y - 3.045, z + 0.375).
const { mbsX, frameY, baseZ, fixtureX, armY, armZ, heads } = CAGE;
const poa = { mouth: [mbsX + 2.46, frameY + .39, 1.32] };
export function buildMobileBase(parent) {
    const carriage = new THREE.Group(); carriage.name = 'Mobile Base System carriage'; parent.add(carriage);
    const mbs = new THREE.Group(); mbs.name = 'Mobile Base System';
    mbs.position.set(.7, -3.045, .375); mbs.scale.x = -1; carriage.add(mbs);
    const kit = new Kit(), hw = hardware(kit);
    const tan = 0xa89772, mbsGrey = 0xb5bebf;
    // ---- Mobile transporter and supported forward working platform ----
    const charcoal = 0x596466, edgeGrey = 0x899697, frontZ = -.55, rearZ = 1.40;
    function strut(a, b, width = .10, depth = .13, color = charcoal) {
        const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), axis = bv.clone().sub(av), g = new THREE.BoxGeometry(width, depth, axis.length());
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.normalize()));
        kit.add(g, material(color, .64, .39), av.add(bv).multiplyScalar(.5).toArray(), [1, 1, 1], [0, 0, 0], false);
    }
    function cableRun(points, r = .014, color = 0xd5d8d0) { kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(24, points.length * 8), r, 7, false), material(color, .89, .04), [0, 0, 0], [1, 1, 1], [0, 0, 0], false); }
    function bolt(p, axis = [0, 0, -1], r = .027) { const f = hw.frame(p, axis); hw.cylinder(f, 0, r, .020, 0xbec6c1); hw.cylinder(f, .015, r * .40, .010, 0x4e5a58); }
    // Four bogies contact the supplied model's two forward-face rails.
    // In this mirrored cage frame, world Y = local Y - 3.045 and world Z = local Z + .375.
    for (const dx of [-1.48, 1.48]) {
        for (const y of [7.895, 8.695]) {
            kit.cylinder([mbsX + dx, y, 1.38], .15, .19, 0x50595c, [0, 0, 0]);
            kit.box([mbsX + dx, y, 1.19], [.40, .20, .18], edgeGrey, [0, 0, 0], false);
            strut([mbsX + dx, y, 1.17], [mbsX + dx, y, 1.36], .12, .10, charcoal);
        }
        strut([mbsX + dx, frameY, 1.19], [mbsX + dx, 8.795, 1.19], .19, .19, edgeGrey);
        strut([mbsX + dx, frameY, frontZ], [mbsX + dx, frameY, rearZ], .19, .21, edgeGrey);
        strut([mbsX + dx, frameY, baseZ], [mbsX + dx, 8.60, 1.19], .08, .10, charcoal);
    }
    for (const z of [frontZ, baseZ, rearZ]) strut([mbsX - 1.92, frameY, z], [mbsX + 1.92, frameY, z], .17, .17, edgeGrey);
    for (const dx of [-1.92, 1.92]) strut([mbsX + dx, frameY, frontZ], [mbsX + dx, frameY, rearZ], .15, .17, 0xc1c8c2);
    for (const z of [frontZ, rearZ]) {
        kit.box([mbsX, frameY + .095, z], [3.86, .045, .24], 0xd3d7cf, [0, 0, 0], false);
        for (const dx of [-1.65, -.83, 0, .83, 1.65]) bolt([mbsX + dx, frameY + .124, z], [0, 1, 0], .025);
    }
    strut([mbsX - 1.42, frameY - .02, frontZ], [mbsX + 1.42, frameY - .02, rearZ], .075, .085, charcoal);
    strut([mbsX + 1.42, frameY - .02, frontZ], [mbsX - 1.42, frameY - .02, rearZ], .075, .085, charcoal);
    // A tall, narrow-topped trapezoidal space frame, open on every side.
    const lowY = frameY + .16, midY = frameY + 1.40, topY = frameY + 2.78;
    const lower = (s, back) => [mbsX + s * 1.30, lowY, back ? 1.32 : -.34];
    const middle = (s, back) => [mbsX + s * .86, midY, back ? 1.16 : -.07];
    const upper = (s, back) => [mbsX + s * .34, topY, back ? 1.03 : .26];
    for (const back of [false, true]) {
        for (const s of [-1, 1]) {
            strut(lower(s, back), upper(s, back), .14, .16, charcoal);
            const a = lower(s, back), b = upper(s, back); strut([a[0] + s * .095, a[1], a[2] - .06], [b[0] + s * .07, b[1], b[2] - .06], .055, .10, tan);
            kit.box(lower(s, back), [.30, .13, .32], mbsGrey, [0, 0, 0], false); bolt([a[0], a[1] + .09, a[2]], [0, 1, 0]);
        }
        strut(lower(-1, back), lower(1, back), .14, .13, charcoal);
        strut(middle(-1, back), middle(1, back), .10, .12, edgeGrey);
        strut(upper(-1, back), upper(1, back), .14, .13, charcoal);
        strut(lower(-1, back), middle(1, back), .085, .12, charcoal); strut(lower(1, back), middle(-1, back), .085, .12, charcoal);
        strut(middle(-1, back), upper(1, back), .075, .10, tan); strut(middle(1, back), upper(-1, back), .075, .10, charcoal);
    }
    for (const s of [-1, 1]) {
        strut(lower(s, false), lower(s, true), .13, .14, charcoal); strut(middle(s, false), middle(s, true), .09, .12, edgeGrey); strut(upper(s, false), upper(s, true), .12, .14, charcoal);
        strut(lower(s, false), middle(s, true), .075, .10, tan); strut(lower(s, true), middle(s, false), .075, .10, charcoal);
        strut(middle(s, false), upper(s, true), .075, .10, tan);
    }
    // Inset equipment, mounting gussets and small blanket covers leave the trusswork legible.
    for (const [dx, y, z, w, h, d] of [[-.67, frameY + .75, .79, .34, .95, .48], [.50, frameY + .47, 1.22, .48, .43, .50], [.05, frameY + 1.64, .77, .48, .34, .45]]) {
        kit.box([mbsX + dx, y, z], [w - .05, h - .05, d - .05], 0x79878a, [0, 0, 0], false);
        kit.add(pillow(w, h, d), armBlanket, [mbsX + dx, y, z], [1, 1, 1], [0, 0, 0], false);
        for (const yy of [y - h * .37, y + h * .37]) kit.box([mbsX + dx, yy, z - d * .60], [w * .85, .035, .024], 0xbec5c0, [0, 0, 0], false);
    }
    for (const s of [-1, 1]) {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([mbsX + s * 1.14, lowY + .02, -.36, mbsX + s * .62, lowY + .02, -.36, mbsX + s * .97, lowY + .57, -.15], 3)); g.setIndex([0, 1, 2]); g.computeVertexNormals(); const cover = armBlanket.clone(); cover.side = THREE.DoubleSide; kit.add(g, cover, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
        kit.box([mbsX + s * 1.54, frameY + .20, baseZ], [.56, .24, 1.18], 0xd0d5ce, [0, 0, 0], false);
    }
    // Occupied starboard grapple after the cage mirror: transverse cradle joins the side frame and exactly shares LEE A's axis.
    strut([fixtureX + .08, armY, armZ], [mbsX - .86, midY, baseZ], .16, .20, edgeGrey);
    kit.box([fixtureX + .23, armY, armZ], [.44, .53, .58], mbsGrey, [0, 0, 0], false);
    for (const z of [armZ - .25, armZ + .25]) kit.box([fixtureX + .10, armY, z], [.50, .43, .06], charcoal, [0, 0, 0], false);
    hw.grappleFixture([fixtureX, armY, armZ], [-1, 0, 0]);
    // Three canted, front-facing carriers match the visible circular heads in the reference.
    for (const [h, from] of [[heads[0], lower(-1, false)], [heads[1], lower(1, false)], [heads[2], middle(1, false)]]) { strut(from, h.p, .13, .14, edgeGrey); hw.grappleFixture(h.p, h.n); }
    // Dark cable service loops, white harness clips and connector panels under the forward sill.
    for (const s of [-1, 1]) {
        cableRun([[mbsX + s * 1.12, frameY + .14, -.23], [mbsX + s * 1.64, frameY - .11, -.29], [mbsX + s * 1.44, frameY - .37, .27], [mbsX + s * .75, frameY - .29, .70], [mbsX + s * .63, frameY + .39, .91]], .025, 0x535e5e);
        for (let k = 0; k < 3; k++)cableRun([[mbsX + s * .25 + k * .034, frameY + 1.68, .48], [mbsX + s * .40 + k * .034, frameY + 1.11, .53], [mbsX + s * .62 + k * .034, frameY + .46, .44], [mbsX + s * .88 + k * .034, frameY + .12, .26]], .011);
    }
    kit.box([mbsX + .1, frameY + .18, -.42], [.57, .20, .12], 0xbec6c2, [0, 0, 0], false);
    for (const dx of [-.16, 0, .16]) kit.cylinder([mbsX + .1 + dx, frameY + .18, -.495], .043, .035, 0x374747);
    // Short camera mast at the narrow top, on a bolted head plate.
    kit.box([mbsX, topY + .075, .65], [.48, .11, .83], edgeGrey, [0, 0, 0], false);
    kit.rod([mbsX, topY + .10, .65], [mbsX, topY + .43, .65], .048, palette.silver); hw.cameraHead([mbsX, topY + .57, .65], [0, .04, -1]);
    // Payload/ORU accommodation: a separate right-hand cradle behind the front fixture carriers, a small end effector.
    strut([mbsX + .90, frameY + .39, 1.32], [mbsX + 1.78, frameY + .39, 1.32], .18, .20, charcoal);
    hw.endEffector(poa.mouth, [1, 0, 0], { scale: .72 });
    kit.finish(mbs); snare(mbs, poa.mouth, [1, 0, 0], .72);
    return carriage;
}
// The base's centre at `x` along the truss.
export const setCarriage = (carriage, x) => { carriage.position.x = x - MBS_HOME; };
