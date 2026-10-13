// Zarya / Functional Cargo Block.
import * as THREE from 'three';
import { assetData } from '../core/data.js';
import { renderer } from '../core/stage.js';
import { material, palette, shapes } from '../core/kit.js';
import { part, pma1BaseZ, ring, russianSegmentOffset } from '../core/station.js';
import { measuredGeometry, measuredPlacement } from '../core/payloads.js';

// Russian docking rings: profiles measured from the supplied GLB's Zarya and Rassvet nodes.
export function russianDockingBand(kit, profile, axis, origin, color = palette.silver) {
    const points = profile.map(([a,r]) => [r,a]);
    if (points[0][0] !== points.at(-1)[0] || points[0][1] !== points.at(-1)[1]) points.push([...points[0]]);
    let area = 0; for (let i=0;i<points.length-1;i++) area += points[i][0]*points[i+1][1]-points[i+1][0]*points[i][1];
    if (area < 0) points.reverse();
    const geometry = new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), 96);
    if (axis === 'z') geometry.rotateX(Math.PI/2);
    kit.add(geometry, material(color,.60,.38), origin, [1,1,1], [0,0,0], false);
}
part('zarya', 'Zarya / Functional Cargo Block', '13 / RUSSIAN SEGMENT', 'The first ISS element launched on 20 November 1998. Zarya supplied early power, propulsion and control, and later became a storage and fuel-support module. Its narrow central barrel expands into a broad aft shoulder; sixteen external canisters sit behind eight quadrant shields. Its two solar wings are drawn folded.', [['First launch', '20 NOV 1998'], ['Length', '12.6 m']], [0, 2, 23], (kit, group) => {
    // Pressure hull and equipment layout measured from ISS_stationary.glb, node 24.
    // Existing docking seats and the screenshot-led folded solar wings are retained.
    group.userData.referenceViews = 3;
    group.userData.solarWingPose = 'Folded like an accordion';
    group.userData.solarWings = 2;
    group.userData.curvedEquipmentShields = 8;
    group.userData.longitudinalTanks = 16;
    group.userData.exposedDarkDomes = 16;
    group.userData.interfaceCenters = { forward: [0, 0, 17.8], nadir: [0, -.855, 17.8], aft: [0, 0, 28.93] };
    const copper = 0x87583b, blanket = material(0xe0e1d9, .9, .07);
    // q is distance along the source module's -Z axis. Only the body between established joints is rescaled.
    const sourceRadiusScale = 2.17 / 2.1137633;
    const sourceAxialScale = (28.06 - 18.65) / (11.20546 - 2.12022);
    const bodyZ = q => 18.65 + (q - 2.12022) * sourceAxialScale;
    const bodyR = r => r * sourceRadiusScale;
    const hullProfile = [[17.8, .80], [18.65, .80], [bodyZ(3.20993), bodyR(1.49670)],
        [bodyZ(9.65624), bodyR(1.49670)], [bodyZ(10.90350), 2.17], [28.06, 2.17], [29.2422400387, 0.7278270230]];
    group.userData.bodyReference = { source: 'ISS_stationary.glb / node 24 / mesh 24',
        sourceBarrelRadius: 1.49670, sourceShoulderRadius: 2.1137633,
        barrelRadius: bodyR(1.49670), barrelStart: bodyZ(3.20993), barrelEnd: bodyZ(9.65624),
        shoulderEnd: bodyZ(10.90350), establishedAdapterStart: 28.06,
        protectedJoints: ['PMA-1', 'Rassvet', 'Zvezda'], sourceRadiusScale, sourceAxialScale };
    function hullRadius(z) {
        const index = Math.max(1, hullProfile.findIndex(p => p[0] >= Math.min(29.2422400387, Math.max(17.8, z))));
        const a = hullProfile[index - 1], b = hullProfile[index];
        return THREE.MathUtils.lerp(a[1], b[1], THREE.MathUtils.clamp((z - a[0]) / (b[0] - a[0]), 0, 1));
    }
    const onHull = (angle, z, lift = 0) => [Math.cos(angle) * (hullRadius(z) + lift), Math.sin(angle) * (hullRadius(z) + lift), z];
    // A continuous insulated shell replaces the generic cylinder and flat tile covers.
    // The neck starts inside the docking sphere at z 18.4, clear of the open zenith port's receiving cone (which
    // reaches z 18.33); the hidden length forward of it is not drawn.
    const profilePoints = [new THREE.Vector2(0, 18.4)];
    for (let i = 6; i <= 114; i++) { const z = 17.8 + i * .1; profilePoints.push(new THREE.Vector2(hullRadius(z), z)); if(i===102)profilePoints.push(new THREE.Vector2(2.17,28.06)); }
    profilePoints.push(new THREE.Vector2(0.7278270230, 29.2422400387), new THREE.Vector2(0, 29.2422400387));
    const hull = new THREE.LatheGeometry(profilePoints, 96).rotateX(Math.PI / 2), attr = hull.attributes.position;
    for (let i = 0; i < attr.count; i++) {
        const x = attr.getX(i), y = attr.getY(i), z = attr.getZ(i), r = Math.hypot(x, y);
        if (r > .85) { const a = Math.atan2(y, x), ripple = .005 * Math.sin(a * 29 + z * 21) + .004 * Math.cos(a * 13 - z * 33); attr.setXY(i, x * (1 + ripple / r), y * (1 + ripple / r)); }
    }
    hull.computeVertexNormals(); kit.add(hull, blanket, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    for (const z of [18.65, bodyZ(3.20993), bodyZ(9.65624), bodyZ(10.90350), 28.35]) ring(kit, [0, 0, z], hullRadius(z) + .012, 'z', palette.hull, .017);
    // The GLB has a long FGB terminal cone, a short straight neck, then a stepped docking flange.
    // The completed adapter and its mating plane are retained exactly during the body refinement.
    russianDockingBand(kit,[[29.24224003867576, 0.7278270230162477], [29.587609781591322, 0.7278270230162477], [29.614179019760247, 0.8086978329125118], [29.800153569182566, 0.8086978329125118], [29.84, 0.7682588348468345], [29.84, 0.4582559456870123], [29.24224003867576, 0.4582559456870123]],'z',[0,0,0]);
    ring(kit,[0,0,29.795742225754672],0.8106978329125119,'z',palette.white,.013);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;kit.cylinder([Math.cos(a)*0.8206978329125119,Math.sin(a)*0.8206978329125119,29.72896500872691],.019,.030,palette.rail);}
    group.userData.serviceModuleFace={axis:'z',coordinate:29.84,radius:0.7682588348468345};
    group.userData.interfaceCenters.aft=[0,0,29.84];
    group.userData.aftDockingReference={source:'ISS_stationary.glb / Zarya terminal cone and Zvezda forward collar',
        barrelEnd:28.06,coneEnd:29.24224003867576,neckRadius:0.7278270230162477,matingPlane:29.84};
    // Rounded seam/conduit runs are fitted directly to the curved blanket surface.
    function surfaceLoop(angle, z, width, length, lift = .028, radius = .011, color = 0xb8beb7) {
        const path = new THREE.Shape(), w = width / 2, h = length / 2, c = Math.min(.19, w * .48, h * .48);
        path.moveTo(-w + c, -h); path.lineTo(w - c, -h); path.quadraticCurveTo(w, -h, w, -h + c); path.lineTo(w, h - c); path.quadraticCurveTo(w, h, w - c, h); path.lineTo(-w + c, h); path.quadraticCurveTo(-w, h, -w, h - c); path.lineTo(-w, -h + c); path.quadraticCurveTo(-w, -h, -w + c, -h);
        const points = path.getPoints(10).map(p => new THREE.Vector3(...onHull(angle + p.x / hullRadius(z + p.y), z + p.y, lift)));
        kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true, 'centripetal'), 96, radius, 6, true), material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    }
    for (const a of [Math.PI / 2, 0, Math.PI, Math.PI * 1.5]) {
        for (const [z, l] of [[20.65, 1.74], [23.03, 2.12], [25.28, 1.95]]) {
            surfaceLoop(a, z, 1.25, l, .021, .012, 0xc1c6bd);
            surfaceLoop(a, z, 1.38, l + .13, .024, .011, 0xc8ccc4);
        }
    }
    // Oval access detail and its doubled lip remain visible in the center strip.
    surfaceLoop(Math.PI / 2, 24.47, .69, .38, .052, .023, palette.silver);
    surfaceLoop(Math.PI / 2, 24.47, .85, .54, .030, .016, palette.hull);
    // Spherical docking compartment after reference imagery, on Rassvet's axis at z 17.8. Its forward port
    // takes PMA-1, the nadir port Rassvet, and the zenith port stands open as a receiving-cone docking port.
    // Port collars of .76 m (nadir) and .82 m (forward) subtend 42.7° + 47.1° of the 1.12 m sphere, so the
    // two adjacent ports stay just clear of each other.
    // Three cut seats expose the actual mating collars instead of a whole sphere penetrating them.
    const nodeCenter = new THREE.Vector3(0, 0, 17.8), nodeRadius = 1.12;
    const pmaFace = pma1BaseZ + 2.456446886062622 - russianSegmentOffset.z;
    const forwardPortR = .79491, forwardSeat = Math.sqrt(nodeRadius**2-forwardPortR**2);
    const nadirSeat = Math.sqrt(nodeRadius**2-.76**2), zenithSeat = Math.sqrt(nodeRadius**2-.78**2);
    const nodeCuts = [{axis:2,sign:-1,limit:forwardSeat},{axis:1,sign:-1,limit:nadirSeat},{axis:1,sign:1,limit:zenithSeat}];
    const sphere = new THREE.SphereGeometry(nodeRadius,96,64), src = sphere.attributes.position;
    const pos=[],norm=[],uv=[];
    const clip = (polygon,cut) => {
        const next=[];
        for(let i=0;i<polygon.length;i++) {
            const a=polygon[i],b=polygon[(i+1)%polygon.length],da=a[cut.axis]*cut.sign-cut.limit,db=b[cut.axis]*cut.sign-cut.limit;
            if(da<=0) next.push(a);
            if((da<=0)!==(db<=0)) {
                const t=da/(da-db),p=a.map((v,k)=>v+(b[k]-v)*t); p[cut.axis]=cut.limit*cut.sign;
                const axes=[0,1,2].filter(k=>k!==cut.axis),scale=Math.sqrt(nodeRadius**2-cut.limit**2)/Math.hypot(...axes.map(k=>p[k]));
                for(const k of axes)p[k]*=scale; next.push(p);
            }
        } return next;
    };
    for(let i=0;i<sphere.index.count;i+=3) {
        let polygon=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(src,sphere.index.getX(i+k)).toArray());
        for(const cut of nodeCuts){if(polygon.length<3)break;polygon=clip(polygon,cut);}
        for(let k=1;k+1<polygon.length;k++)for(const p of [polygon[0],polygon[k],polygon[k+1]]) {
            pos.push(...p);norm.push(...new THREE.Vector3(...p).normalize().toArray());uv.push((Math.atan2(p[2],p[0])/Math.PI/2+1)%1,Math.acos(p[1]/nodeRadius)/Math.PI);
        }
    }
    const nodeGeometry=new THREE.BufferGeometry();nodeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    nodeGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));nodeGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));sphere.dispose();
    kit.add(nodeGeometry,material(palette.hull,.55,.3),nodeCenter.toArray(),[1,1,1],[0,0,0],false);
    // Seams stop at the cut seats rather than crossing the docking openings.
    const seamAt = points => { let segment=[];const flush=()=>{if(segment.length>1)kit.line(segment);segment=[];};
        for(const p of points){const q=new THREE.Vector3(...p).sub(nodeCenter).multiplyScalar(nodeRadius/(nodeRadius+.006));
            if(nodeCuts.every(c=>q.getComponent(c.axis)*c.sign<=c.limit+.0001))segment.push(p);else flush();}flush();};
    seamAt(Array.from({length:129},(_,i)=>{const a=i*Math.PI/64;return [Math.cos(a)*(nodeRadius+.006),0,17.8+Math.sin(a)*(nodeRadius+.006)];}));
    for(const angle of [Math.PI/4,Math.PI*3/4]) seamAt(Array.from({length:129},(_,i)=>{const a=i*Math.PI/64;return [Math.cos(angle)*Math.sin(a)*(nodeRadius+.006),Math.cos(a)*(nodeRadius+.006),17.8+Math.sin(angle)*Math.sin(a)*(nodeRadius+.006)];}));
    // The imported PMA's mating face is at z=2.456446886, not its farthest projecting detail.
    const seatZ=17.8-forwardSeat, depth=seatZ-pmaFace, frontScale=depth/.2266687155;
    russianDockingBand(kit,[[pmaFace,.73607],[pmaFace+.04079*frontScale,.803719],[seatZ,.79491],
        [seatZ,.64813],[pmaFace,.59934]],'z',[0,0,0]);
    ring(kit,[0,0,pmaFace+.005],.7365,'z',0x56605e,.009);
    group.userData.referenceDockingJoints = {source:'ISS_stationary.glb / nodes 24, 23, 81',
        pma1:{axis:'z',face:pmaFace,seat:seatZ,faceRadius:.73607,outerRadius:.803719},
        rassvet:{axis:'y',face:-.93,seat:-nadirSeat,faceRadius:.62374*.76/.66023,outerRadius:.684758*.76/.66023}};
    group.userData.interfaceCenters.forward=[0,0,pmaFace];group.userData.interfaceCenters.nadir=[0,-.93,17.8];
    // Open zenith port after the reference photo: a pale docking ring with dark latch slots round its face, a thin
    // dark gap and a grey rim around the receiving cone; cone, socket and cap share one orange.
    const zenithFace = 1.0, zenithMid = (zenithSeat + zenithFace) / 2;
    russianDockingBand(kit, [[zenithSeat - .02, .62], [zenithSeat - .02, .78], [zenithFace - .015, .78], [zenithFace, .765],
        [zenithFace, .61], [zenithFace - .05, .61], [zenithFace - .05, .62]], 'y', [0, 0, 17.8], 0xd9dcd6);
    ring(kit, [0, zenithFace - .015, 17.8], .772, 'y', 0xeceee9, .018);
    ring(kit, [0, zenithFace - .006, 17.8], .603, 'y', 0x2b3035, .012);
    for (let i = 0; i < 20; i++) {
        const a = (i + .5) * Math.PI / 10;
        kit.box([Math.cos(a) * .69, zenithFace + .001, 17.8 + Math.sin(a) * .69], [.05, .008, .085], 0x2b3035, [0, -a, 0], false);
    }
    kit.add(new THREE.RingGeometry(.53, .605, 64).rotateX(-Math.PI / 2), material(0xb9bfbd, .5, .4), [0, zenithFace - .03, 17.8], [1, 1, 1], [0, 0, 0], false);
    const drogueOrange = material(0xd8862c, .55, .15), drogueSkin = drogueOrange.clone();
    drogueSkin.side = THREE.DoubleSide;
    kit.add(new THREE.LatheGeometry([[.53, zenithFace - .03], [.38, zenithFace - .11], [.2, zenithFace - .23], [.095, zenithFace - .34]].map(([r, y]) => new THREE.Vector2(r, y)), 64),
        drogueSkin, [0, 0, 17.8], [1, 1, 1], [0, 0, 0], false);
    kit.add(shapes.cylinder, drogueOrange, [0, zenithFace - .35, 17.8], [.095, .03, .095]);
    kit.add(new THREE.CylinderGeometry(.068, .078, .12, 24), drogueOrange, [0, zenithFace - .29, 17.8], [1, 1, 1], [0, 0, 0], false);
    kit.add(new THREE.TorusGeometry(.062, .01, 6, 32), drogueOrange, [0, zenithFace - .232, 17.8], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    group.userData.interfaceCenters.zenith = [0, zenithFace, 17.8];
    group.userData.zenithPort = { source: 'Reference photo of the open zenith port', faceRadius: .78, coneMouth: .53, coneDepth: .31, latchSlots: 20, collarMid: zenithMid };
    // Zarya's measured stepped receiver meets Rassvet at their common nadir plane.
    const receiverScale=.76/.66023, receiverFace=-.93, receiverDepth=.93-nadirSeat;
    const receiverProfile=[[.911185,.66023],[.93436,.66023],[.99482,.684758],[1.04855,.684758],[1.12669,.66757],[1.195066,.62374],
        [1.195066,.45189],[.911185,.5200]].map(([q,r])=>[-nadirSeat-(q-.911185)/(.283881)*receiverDepth,r*receiverScale]);
    russianDockingBand(kit,receiverProfile,'y',[0,0,17.8]);
    ring(kit,[0,receiverFace+.002,17.8],.62374*receiverScale,'y',0x56605e,.009);
    // External equipment measured on GLB node 24 and redrawn part by part: tanks and their caps, quadrant shields,
    // spherical tanks, side flaps, shoulder hoods, the handrail loops and frames (untextured in the GLB) with the
    // hoop round the forward cone, antennas, and the aft thruster and target cluster. Along the body the GLB axis
    // maps as above; around the docking compartment the parts follow the sphere (centre at z 17.8, scale
    // 1.12 / 1.1424). Hull, compartment shell, docking seats and the folded wings stay as drawn.
    const zaryaReference = assetData.zaryaReference;
    const zaryaSkins = {
        rail: material(copper, .5, .45), silver: material(palette.silver),
        light: material(0xbcc2bf, .55, .35), mid: material(0x969d9c, .6, .3), dark: material(0x5f6668, .62, .3),
        black: material(0x1d2328, .3, .6), bronze: material(0x9b6942, .45, .55), shield: material(0xaeb5b2, .44, .58),
        tank: material(0xb4bab6, .5, .42), tankCap: material(0xe6e8e3, .7, .1), sphere: material(0xe6e8e3, .7, .1),
        hood: material(0x9b6942, .62, .46)
    };
    for (const part of zaryaReference.parts) kit.add(measuredGeometry(part), zaryaSkins[part[1]], ...measuredPlacement(part));
    group.userData.bodyReference.equipment = { source: zaryaReference.source, parts: zaryaReference.parts.length };
    // The solar wings are shown folded like an accordion, as in the supplied references: rigid panels hinge on vertical
    // lines and zigzag outward from each root drum (a half-length root panel, then five full panels), with cells on
    // the outboard faces and pale backs.
    const cellCanvas = document.createElement('canvas'); cellCanvas.width = 256; cellCanvas.height = 128;
    const cell = cellCanvas.getContext('2d'); cell.fillStyle = '#071017'; cell.fillRect(0, 0, 256, 128);
    for (let col = 0; col < 12; col++)for (let row = 0; row < 6; row++) {
        const x = col * 256 / 12, y = row * 128 / 6;
        cell.fillStyle = (col + row) % 3 === 0 ? '#0b1820' : '#09151d'; cell.fillRect(x + 1, y + 1, 256 / 12 - 2, 128 / 6 - 2);
    }
    cell.strokeStyle = '#68828c'; cell.lineWidth = .65; cell.beginPath();
    for (let col = 0; col <= 12; col++) { const x = col * 256 / 12; cell.moveTo(x, 0); cell.lineTo(x, 128); }
    for (let row = 0; row <= 6; row++) { const y = row * 128 / 6; cell.moveTo(0, y); cell.lineTo(256, y); } cell.stroke();
    cell.fillStyle = '#adc4c5'; for (let col = 0; col <= 12; col++)for (let row = 0; row <= 6; row++)cell.fillRect(col * 256 / 12 - .8, row * 128 / 6 - .8, 1.6, 1.6);
    const cellTexture = new THREE.CanvasTexture(cellCanvas); cellTexture.colorSpace = THREE.SRGBColorSpace; cellTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const cellSurface = material(0xffffff, .77, .14, cellTexture); cellSurface.side = THREE.DoubleSide;
    const wingZ = 21.45, rootX = 2.54, panelLength = 4.2, panelHeight = 2.0, fold = 82 * Math.PI / 180;
    const amplitude = panelLength * Math.sin(fold), step = panelLength * Math.cos(fold), backSurface = material(0xb4b8b6, .72, .18);
    const facing = normal => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    group.userData.solarWingFold = { panels: 6, panelLength, panelHeight, foldDegrees: 82 };
    for (const side of [-1, 1]) {
        // Extend only the inner stem to meet the narrower source barrel; all wing/drum transforms stay fixed.
        kit.cylinder([side * 1.9025, 0, wingZ], .33, .845, palette.silver, [0, 0, Math.PI / 2]);
        kit.cylinder([side * 2.27, 0, wingZ], .43, .13, palette.dark, [0, 0, Math.PI / 2]);
        ring(kit, [side * 2.345, 0, wingZ], .40, 'x', palette.silver, .038);
        kit.cylinder([side * (rootX - .09), 0, wingZ], .09, .3, palette.dark, [0, 0, Math.PI / 2]);
        // Hinge lines: the root at the drum, then alternating extremes of the fold.
        const hinges = [new THREE.Vector3(side * rootX, 0, wingZ)];
        for (let i = 0; i < 6; i++) hinges.push(new THREE.Vector3(side * (rootX + step * (i + .5)), 0, wingZ + (i % 2 === 0 ? 1 : -1) * amplitude / 2));
        for (const h of hinges) kit.rod([h.x, -panelHeight / 2 - .06, h.z], [h.x, panelHeight / 2 + .06, h.z], .035, palette.silver);
        for (let i = 0; i < 6; i++) {
            const a = hinges[i], b = hinges[i + 1], mid = a.clone().add(b).multiplyScalar(.5), along = b.clone().sub(a), length = along.length();
            along.normalize();
            const outward = new THREE.Vector3(along.z, 0, -along.x);
            if (outward.x * side < 0) outward.negate();
            kit.box(mid.toArray(), [.035, panelHeight, length - .05], palette.black, [0, Math.atan2(along.x, along.z), 0], false);
            kit.add(new THREE.PlaneGeometry(length - .1, panelHeight - .08).applyQuaternion(facing(outward)), cellSurface, mid.clone().addScaledVector(outward, .022).toArray(), [1, 1, 1], [0, 0, 0], false);
            kit.add(new THREE.PlaneGeometry(length - .1, panelHeight - .08).applyQuaternion(facing(outward.clone().negate())), backSurface, mid.clone().addScaledVector(outward, -.022).toArray(), [1, 1, 1], [0, 0, 0], false);
            for (const y of [-panelHeight / 2, panelHeight / 2]) kit.rod([a.x, y, a.z], [b.x, y, b.z], .018, palette.silver);
        }
    }
});
