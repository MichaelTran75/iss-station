// Common berthing mechanism (CBM) collars measured from the reference model, and the curved saddle that seats
// a collar on a hull.
import * as THREE from 'three';
import { material, palette } from './kit.js';
import { ring } from './station.js';

// Procedural CBM collars measured from ISS_stationary.glb nodes 95/97.
// Positions use this scene's Z axis. mapAxial(a) returns a signed offset from
// baseZ for the source axial distance a; it may be piecewise linear.
const referenceCbmBracketAngles = [0,35,55,90,125,145,180,215,235,270,305,325];
const referenceCbmActiveOuter = [[0,1.28884],[.062935,1.28884],
    [.139813,1.111597],[.203881,1.111597],[.357652,1.206156],[.472985,1.206156]];
const referenceCbmActiveInner = [[.472985,1.19115],[.357652,1.19115],
    [.203881,1.08394],[.019766,1.08394],[0,1.08394]];

// Closed profile in [Z,radius]. Reverse a negative winding so either axial
// direction retains exterior normals. The bore remains a real open tunnel.
function referenceCbmLathe(kit, profile, color = palette.silver) {
    const points = profile.map(([z,r]) => [r,z]);
    const first = points[0], last = points[points.length-1];
    if (first[0] !== last[0] || first[1] !== last[1]) points.push([...first]);
    let area = 0;
    for (let i=0; i<points.length-1; i++)
        area += points[i][0]*points[i+1][1]-points[i+1][0]*points[i][1];
    if (area < 0) points.reverse();
    kit.add(new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), 64),
        material(color,.58,.28), [0,0,0], [1,1,1], [Math.PI/2,0,0], false);
}

// Closed, flat-sided inclined strap; the supplied outline is [axial,radius].
function referenceCbmBracket(kit, angle, outline, halfWidth, baseZ, mapAxial, radialScale) {
    const c=Math.cos(angle), s=Math.sin(angle), vertices=[];
    for (const tangent of [-halfWidth,halfWidth]) for (const [a,r] of outline)
        vertices.push(new THREE.Vector3((r*c-tangent*s)*radialScale,
            (r*s+tangent*c)*radialScale,baseZ+mapAxial(a)));
    const center=vertices.reduce((sum,v) => sum.add(v),new THREE.Vector3()).multiplyScalar(1/8);
    const quads=[[0,1,2,3],[4,5,6,7],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]], out=[];
    for (const q of quads) for (const ids of [[q[0],q[1],q[2]],[q[0],q[2],q[3]]]) {
        let [a,b,c]=ids.map(i=>vertices[i]);
        const normal=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a));
        const faceCenter=new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1/3);
        if (normal.dot(faceCenter.sub(center))<0) [b,c]=[c,b];
        out.push(...a.toArray(),...b.toArray(),...c.toArray());
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(out,3));
    geometry.computeVertexNormals();
    kit.add(geometry,material(palette.rail,.55,.32));
}

export function referenceActiveCBM(kit, baseZ, mapAxial, radialScale = 1) {
    const mapped = profile => profile.map(([a,r]) => [baseZ+mapAxial(a),r*radialScale]);
    referenceCbmLathe(kit,mapped([...referenceCbmActiveOuter,...referenceCbmActiveInner]));

    // Recessed pressure sleeve and backing lips close radial cracks behind the
    // stepped shell. Its outer radius fits just inside the passive sleeve,
    // avoiding coincident surfaces when the two sides overlap.
    const sleeveOuter=1.020, sleeveInner=.932;
    referenceCbmLathe(kit,mapped([[0,sleeveOuter],[.472985,sleeveOuter],
        [.472985,sleeveInner],[0,sleeveInner]]),palette.hull);
    for (const [a,insideRadius] of [[.020,1.08394],[.463,1.19115]]) {
        referenceCbmLathe(kit,mapped([[a,insideRadius+.001],[a+.006,insideRadius+.001],
            [a+.006,sleeveOuter],[a,sleeveOuter]]),palette.silver);
    }

    for (const degrees of referenceCbmBracketAngles) {
        const farOuter=degrees%90===0 ? .342824 : .351512;
        referenceCbmBracket(kit,degrees*Math.PI/180,
            [[.057789,1.261005],[.062812,1.278523],[farOuter,1.195739],[.322431,1.178222]],
            .041956,baseZ,mapAxial,radialScale);
    }
    // Small latch blocks on the receiving lip, seated against the collar.
    const latchZ0=baseZ+mapAxial(.406), latchZ1=baseZ+mapAxial(.453);
    for (const degrees of [0,90,180,270]) {
        const a=degrees*Math.PI/180, r=1.215*radialScale;
        kit.box([r*Math.cos(a),r*Math.sin(a),(latchZ0+latchZ1)/2],
            [.025*radialScale,.083912*radialScale,Math.abs(latchZ1-latchZ0)],
            palette.rail,[0,0,a]);
    }
    return {baseZ,endZ:baseZ+mapAxial(.472985),radialScale,
        outerProfile:mapped(referenceCbmActiveOuter),bracketAngles:[...referenceCbmBracketAngles]};
}

// neckZ is the passive cone's narrow end. outwardSign points away from its
// barrel. Negative source distances intentionally embed the receiving flange
// in the cone shoulder, as in node 95, rather than extending another long neck.
export function referencePassiveCBM(kit, neckZ, outwardSign, axialScale = 1, radialScale = 1) {
    const sourceNeck=.220711350;
    const mapped = profile => profile.map(([t,r]) =>
        [neckZ+outwardSign*t*axialScale,r*radialScale]);
    const sleeve=[[-.18411865,1.055358],[-.04425865,1.055358],[-.04425865,1.02668],
        [sourceNeck,1.02668],[sourceNeck,.94052],[.17463135,.94052],
        [.17463135,.98492],[-.18411865,.98492]];
    referenceCbmLathe(kit,mapped(sleeve));
    referenceCbmLathe(kit,mapped([[0,1.179501],[-.18411865,1.179501],
        [-.18411865,1.052],[0,1.052]]));
    // Twelve thin radial stiffeners measured on node 95 primitive 2.
    // Columns: polar angle (deg), radial limits, source Z limits. The source
    // angles are paired near 40/50 degrees and +/-16 degrees from +/-Y.
    // Fin roots remain recessed behind the cone throat, as in the GLB.
    const fins=[
        [39.895912,0.905905,1.175028,0.307553,0.387116],
        [49.854694,0.907499,1.175042,0.307644,0.387117],
        [74.139153,0.802055,1.180313,0.307645,0.387117],
        [105.860840,0.802055,1.180313,0.307645,0.387117],
        [130.145142,0.907499,1.175049,0.307644,0.387117],
        [140.104080,0.905905,1.175028,0.307553,0.387117],
        [219.895920,0.901408,1.175028,0.307553,0.387117],
        [229.854858,0.900497,1.175049,0.307644,0.387117],
        [254.139160,0.793985,1.180313,0.307645,0.387117],
        [285.860840,0.793966,1.180313,0.307645,0.387117],
        [310.145142,0.900489,1.175049,0.307644,0.387117],
        [320.104095,0.900526,1.175028,0.307553,0.387117]
    ];
    for (const [degrees,r0,r1,z0,z1] of fins) {
        const a=degrees*Math.PI/180, r=(r0+r1)*.5*radialScale;
        const z=neckZ+outwardSign*(sourceNeck-(z0+z1)*.5)*axialScale;
        kit.box([r*Math.cos(a),r*Math.sin(a),z],
            [(r1-r0)*radialScale,.022803*radialScale,(z1-z0)*axialScale],
            palette.rail,[0,0,a]);
    }
    return {neckZ,outwardSign,tipZ:neckZ+outwardSign*sourceNeck*axialScale,
        flangeBackZ:neckZ-outwardSign*.18411865*axialScale,
        outerRadius:1.179501*radialScale};
}

export function referenceCbmCone(kit, barrelZ, neckZ, barrelR, neckR) {
    const thickness=.035;
    referenceCbmLathe(kit,[[barrelZ,barrelR],[neckZ,neckR],
        [neckZ,neckR-thickness],[barrelZ,barrelR-thickness]],palette.hull);
    return {barrelZ,neckZ,barrelR,neckR};
}

// A free radial CBM after the covered ports on the GLB's Harmony and Tranquility: a lip that follows the hull, or
// stands on a flat port face, around the shallow cover dish inset below its top; a cross-shaped centre panel and
// four quadrant covers, latches and alignment bars, the central vent, and on the module axis the inspection ring
// outboard and the small label plate inboard. Local +y points out of the hull and local +z runs inboard along the
// module. Heights were measured on Harmony (hull radius 2.156); `seat` sinks the lip's root into the skin.
export function referenceFreeCbm(kit, { hullRadius = 2.156, face = null, seat = .006 } = {}) {
    const collarR = 1.17, apex = face === null ? hullRadius : face + .1073, lift = y => y - 2.156 + apex;
    const top = x => face === null ? Math.sqrt(hullRadius * hullRadius - x * x) : apex;
    const collarSkin = material(0xc7ceca, .52, .34), coverSkin = material(0xdde1d8, .82, .07), coverEdge = material(0xbfc6bc, .77, .10);
    // The repeated top row keeps a crisp edge between the collar wall and its lip instead of a smoothed bulge.
    const rimProfiles = [[collarR, 'root'], [collarR, 'top', .012], [collarR, 'top', .012], [1.093, 'top', .017], [1.067, 'blend'], [1.045, 'flat', 2.077], [1.00781, 'flat', 2.04873]];
    const rimPositions = [], rimUV = [], rimIndices = [];
    for (let row = 0; row < rimProfiles.length; row++) for (let i = 0; i <= 96; i++) {
        const [r, type, value] = rimProfiles[row], a = i / 96 * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
        const y = type === 'root' ? (face === null ? top(x) - seat : face) : type === 'top' ? top(x) + value
            : type === 'blend' ? THREE.MathUtils.lerp(top(x), lift(2.077), .65) : lift(value);
        rimPositions.push(x, y, z); rimUV.push(i / 96, row / (rimProfiles.length - 1));
    }
    for (let row = 0; row < rimProfiles.length - 1; row++) for (let i = 0; i < 96; i++) { const a = row * 97 + i, b = a + 97; rimIndices.push(a, b, a + 1, b, b + 1, a + 1); }
    const rim = new THREE.BufferGeometry(); rim.setAttribute('position', new THREE.Float32BufferAttribute(rimPositions, 3));
    rim.setAttribute('uv', new THREE.Float32BufferAttribute(rimUV, 2)); rim.setIndex(rimIndices); rim.computeVertexNormals();
    kit.add(rim, collarSkin, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    // The measured GLB cover is a shallow dish, with its face inset below the lip.
    const coverProfile = [[1.00781, 2.04873], [.96387, 2.08508], [.87786, 2.10789], [.73015, 2.13109], [0, 2.13109]].map(([r, y]) => [r, lift(y)]);
    kit.add(new THREE.LatheGeometry(coverProfile.map(([r, y]) => new THREE.Vector2(r, y)), 96), coverEdge, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    const coverY = r => {
        for (let i = 0; i < coverProfile.length - 1; i++) { const [ra, ya] = coverProfile[i], [rb, yb] = coverProfile[i + 1]; if (r <= ra && r >= rb) return THREE.MathUtils.lerp(yb, ya, (r - rb) / (ra - rb)); }
        return r > 1.00781 ? coverProfile[0][1] : coverProfile.at(-1)[1];
    };
    const coverPlate = (shape, surface, angle = 0, rise = .006) => {
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: .007, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .009, bevelThickness: .003, curveSegments: 8 });
        geometry.rotateZ(angle); const points = geometry.attributes.position;
        for (let i = 0; i < points.count; i++) { const x = points.getX(i), z = -points.getY(i), depth = points.getZ(i); points.setXYZ(i, x, coverY(Math.hypot(x, z)) + depth + rise, z); }
        geometry.computeVertexNormals(); kit.add(geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    };
    // Broad cross-shaped centre panel, plus four rounded quadrant covers.
    const cross = new THREE.Shape(); cross.moveTo(-.16, .77); cross.lineTo(.16, .77); cross.lineTo(.17, .49);
    cross.quadraticCurveTo(.24, .24, .49, .17); cross.lineTo(.77, .16); cross.lineTo(.77, -.16); cross.lineTo(.49, -.17);
    cross.quadraticCurveTo(.24, -.24, .17, -.49); cross.lineTo(.16, -.77); cross.lineTo(-.16, -.77); cross.lineTo(-.17, -.49);
    cross.quadraticCurveTo(-.24, -.24, -.49, -.17); cross.lineTo(-.77, -.16); cross.lineTo(-.77, .16); cross.lineTo(-.49, .17);
    cross.quadraticCurveTo(-.24, .24, -.17, .49); cross.closePath(); coverPlate(cross, coverSkin);
    for (let petal = 0; petal < 4; petal++) {
        const shape = new THREE.Shape(); shape.moveTo(.24, .44); shape.quadraticCurveTo(.29, .29, .44, .24);
        shape.lineTo(.68, .23); shape.quadraticCurveTo(.84, .25, .86, .42); shape.quadraticCurveTo(.74, .76, .42, .86);
        shape.quadraticCurveTo(.25, .84, .23, .68); shape.lineTo(.24, .44);
        coverPlate(shape, material(petal % 2 ? 0xc9d0c4 : 0xd2d8ce, .87, .06), petal * Math.PI / 2, .004);
        const a = petal * Math.PI / 2, diag = a + Math.PI / 4;
        kit.box([Math.sin(diag) * .935, coverY(.935) + .023, Math.cos(diag) * .935], [.105, .040, .080], 0x59675e, [0, diag, 0], false);
        kit.box([Math.sin(a) * .947, coverY(.947) + .025, Math.cos(a) * .947], [.24, .026, .055], palette.silver, [0, a, 0], false);
    }
    ring(kit, [0, lift(2.050), 0], 1.012, 'y', 0x616e64, .013);
    kit.cylinder([0, lift(2.148), 0], .158, .018, 0x59665e, [0, 0, 0]);
    ring(kit, [0, lift(2.161), 0], .174, 'y', 0xb8bca4, .013);
    // On the GLB covers the inspection ring sits 0.45 m outboard along the module axis, the label plate inboard.
    const inspection = [0, -.45], label = [.12, .52];
    kit.cylinder([inspection[0], lift(2.148), inspection[1]], .17, .014, 0xd4d9cf, [0, 0, 0]);
    ring(kit, [inspection[0], lift(2.158), inspection[1]], .19, 'y', 0xa5ad9c, .010);
    kit.box([label[0], coverY(Math.hypot(...label)) + .012, label[1]], [.13, .012, .08], palette.gold, [0, 0, 0], false);
    for (let bolt = 0; bolt < 16; bolt++) { const a = bolt * Math.PI / 8, x = Math.cos(a) * 1.108; kit.cylinder([x, top(x) + .027, Math.sin(a) * 1.108], .013, .015, 0x69766e, [0, 0, 0]); }
    return { outerRadius: collarR, coverRadius: 1.0079, coverTop: lift(2.13109), inspectionRing: inspection, labelPlate: label };
}

// GLB barrel-rim spacing normalized to the existing station's fixed axial gaps.
const cbmSourceSpan = 9.73629093170166 - 8.622624397277832;
export const cbmReferenceRadial = 2.15 / 2.2997395992279053;
export const cbmHarmonyScale = .8 / cbmSourceSpan, cbmUnityScale = 1 / cbmSourceSpan;
export const cbmDestinyFront = -.25 - (8.911153793334961 - 8.622624397277832) * cbmHarmonyScale;
export const cbmHarmonyRear = -.25 - (9.384664177894592 - 8.622624397277832) * cbmHarmonyScale;
export const cbmDestinyRear = 8.25 + (8.911153793334961 - 8.622624397277832) * cbmUnityScale;
export const cbmUnityFront = 8.25 + (9.384664177894592 - 8.622624397277832) * cbmUnityScale;
export const cbmPassiveRadius = 1.180267 * cbmReferenceRadial;
// A closed CBM saddle joins a flat collar to the curved pressure hull.
// Local Z is the mating axis; local Y crosses the parent cylinder.
export function curvedCbmSaddle(kit, hullRadius, profile, color = 0xc7ceca) {
    const positions = [], uv = [], indices = [], steps = 96;
    for (let row = 0; row < profile.length; row++) {
        const [radius, type, value] = profile[row];
        for (let i = 0; i <= steps; i++) {
            const a = i / steps * Math.PI * 2, y = Math.sin(a) * radius;
            const z = type === 'shell' ? Math.sqrt(hullRadius ** 2 - y ** 2) - value : value;
            positions.push(Math.cos(a) * radius, y, z);
            uv.push(i / steps, row / (profile.length - 1));
        }
    }
    for (let row = 0; row < profile.length - 1; row++) for (let i = 0; i < steps; i++) {
        const a = row * (steps + 1) + i, b = a + 1, c = a + steps + 1, d = c + 1;
        indices.push(a, b, c, b, d, c);
    }
    let volume = 0;
    const p = i => new THREE.Vector3().fromArray(positions, i * 3);
    for (let i = 0; i < indices.length; i += 3)
        volume += p(indices[i]).dot(p(indices[i + 1]).cross(p(indices[i + 2]))) / 6;
    if (volume < 0) for (let i = 0; i < indices.length; i += 3)
        [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    kit.add(geometry, material(color, .58, .30), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
}
