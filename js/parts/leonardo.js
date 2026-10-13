// Leonardo / PMM.
import * as THREE from 'three';
import { Kit, material, palette } from '../core/kit.js';
import { part, ring } from '../core/station.js';
import { hullBadge } from '../core/surfaces.js';
import { moduleAt } from '../core/hull.js';

part('leonardo', 'Leonardo / PMM', '12 / LOGISTICS', 'The Permanent Multipurpose Module provides storage for equipment, experiments and supplies. It was relocated to Tranquility in 2015.', [['Permanent since', '2011'], ['Role', 'Storage']], [-7, 0, 5.8], (kit, group) => {
    moduleAt(kit, [-7, 0, 5.8], 6.4, 2.1, 'z', { skin: 'quilted' }); hullBadge(kit, 'LEONARDO', [-7, 0, 5.8], 2.175, [3.3, .42]);
    // Close Leonardo's existing CBM against Node 3's curved forward wall.
    // The supplied GLB informs the shallow stepped cuff; the current station placement is retained.
    const joint = new THREE.Group(), jointKit = new Kit();
    joint.name = 'Leonardo / Tranquility mating collar';
    const jointX = -7, ringFace = 9.722, nodeRadius = 2.15;
    const jointSkin = material(0xc7ceca, .58, .30);
    // Root points sit inside the quilted Node 3 skin, including the low seams between panels.
    const nodeSurface = (radius, angle) => 12 - Math.sqrt(nodeRadius * nodeRadius - (radius * Math.sin(angle)) ** 2);
    const profile = [
        [1.100, 'plane', ringFace], [1.280, 'plane', ringFace],
        [1.280, 'plane', 9.758], [1.255, 'plane', 9.786],
        [1.255, 'shell', .012], [1.310, 'shell', .012],
        [1.310, 'shell', .028], [1.100, 'shell', .028],
        [1.100, 'plane', ringFace]
    ];
    const positions = [], uv = [], indices = [], steps = 96;
    for (let row = 0; row < profile.length; row++) {
        const [radius, kind, depth] = profile[row];
        for (let i = 0; i <= steps; i++) {
            const angle = i / steps * Math.PI * 2;
            positions.push(jointX + Math.cos(angle) * radius, Math.sin(angle) * radius, kind === 'shell' ? nodeSurface(radius, angle) + depth : depth);
            uv.push(i / steps, row / (profile.length - 1));
        }
    }
    for (let row = 0; row < profile.length - 1; row++) for (let i = 0; i < steps; i++) {
        const a = row * (steps + 1) + i, b = a + 1, c = a + steps + 1, d = c + 1;
        indices.push(a, b, c, b, d, c);
    }
    const saddle = new THREE.BufferGeometry();
    saddle.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    saddle.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    saddle.setIndex(indices); saddle.computeVertexNormals();
    jointKit.add(saddle, jointSkin, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    // Two shallow lips surround one narrow gasket at the existing mating plane.
    ring(jointKit, [jointX, 0, 9.735], 1.284, 'z', 0xd9deda, .015);
    ring(jointKit, [jointX, 0, 9.773], 1.267, 'z', 0x58645e, .011);
    ring(jointKit, [jointX, 0, 9.793], 1.256, 'z', 0xc7ceca, .014);
    for (let bolt = 0; bolt < 16; bolt++) {
        const angle = (bolt + .5) * Math.PI / 8;
        jointKit.cylinder([jointX + Math.cos(angle) * 1.225, Math.sin(angle) * 1.225, 9.710], .022, .027, palette.silver);
    }
    jointKit.finish(joint); group.add(joint);
    joint.userData.interface = {
        source: 'ISS_stationary.glb CBM profile; current Leonardo / Tranquility placement',
        leonardoFace: [jointX, 0, ringFace], nodeSkinRadius: nodeRadius,
        matingAxis: [0, 0, 1], sleeveRadius: 1.255, shoulderRadius: 1.310,
        nodeContactDepth: .012, illustrative: true
    };
});
