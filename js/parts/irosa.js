// Roll-out solar arrays.
import * as THREE from 'three';
import { Kit, palette } from '../core/kit.js';
import { augmentedChannels, part, wings } from '../core/station.js';
import { panel } from '../core/surfaces.js';

part('irosa', 'Roll-out solar arrays', '03 / POWER AUGMENTATION', 'Six iROSA blankets augment channels 2B, 4B, 4A, 1A, 3A and 1B in this June 2023 configuration. Each flexible cell blanket stretches between two composite booms, mounted above an original wing on a triangular support kit.', [['Installed by June 2023', '6 arrays'], ['Blanket dimensions', '18.2 × 6 m']], [32, 10, -10], (kit, group) => {
    for (const wing of wings.filter(item => augmentedChannels.has(item.channel))) {
        const { direction } = wing;
        const local = new THREE.Group(), mount = new THREE.Group(), innerKit = new Kit(), mountKit = new Kit();
        local.name = 'iROSA ' + wing.channel + ' / blanket and booms';
        mount.name = 'iROSA ' + wing.channel + ' / connected modification kit';
        local.position.set(0, 1.1, direction * 2.4);
        local.rotation.x = -direction * Math.PI / 18;
        local.updateMatrix();
        // Derive every support head from the actual tilted deployment beam.
        // NASA describes angled mod-kit beams bolted to the mast canister:
        // https://www.nasa.gov/podcasts/houston-we-have-a-podcast/station-solar-arrays/
        // Bracket and fastener dimensions here are illustrative.
        const mountPoint = point => new THREE.Vector3(...point).applyMatrix4(local.matrix).toArray();
        panel(innerKit, [0, 0, direction * 10.3], 6, 18.2, true);
        // Thin rolled composite booms, transverse tip beam and deployment hub.
        for (const side of [-1, 1]) {
            innerKit.rod([side * 3.12, -.06, direction * 1.15], [side * 3.12, -.06, direction * 19.5], .065, palette.foil);
            innerKit.cylinder([side * 3.12, -.05, direction * .95], .27, .38, palette.white, [0, 0, Math.PI / 2]);
            innerKit.rod([side * 2.6, -.15, direction * .95], [side * 3.12, -.06, direction * 1.5], .065, palette.silver);
            const head = mountPoint([side * 2.4, -.15, direction * .95]);
            // A single strut per beam end: the kit reads as one V from the root saddle to both beam heads.
            const feet = [[side * .48, .12, direction * .35]];
            for (const foot of feet) {
                mountKit.rod(foot, head, .08, palette.white);
                mountKit.box(foot, [.24, .18, .24], palette.silver);
                mountKit.cylinder(foot, .065, .30, palette.rail, [0, 0, Math.PI / 2]);
            }
            innerKit.box([side * 2.4, -.15, direction * .95], [.40, .39, .54], palette.silver);
            for (const cheek of [-1, 1]) {
                innerKit.box([side * 2.4 + cheek * .15, -.27, direction * .95], [.055, .32, .38], palette.white);
            }
            mountKit.cylinder(head, .09, .43, palette.rail, [0, 0, Math.PI / 2]);
            // Cable jumper follows a support into the root connector housing.
            if (side === 1) {
                const route = [feet[0], [1.25, .35, direction * 1.65], [head[0], head[1] - .15, head[2]]];
                for (let i = 1; i < route.length; i++) mountKit.rod(route[i - 1], route[i], .026, palette.dark);
                innerKit.box([2.4, -.42, direction * .95], [.26, .18, .30], palette.dark);
            }
        }
        // Root saddle joins the existing mast rails, with no free strut ends.
        mountKit.box([0, 0, direction * .35], [1.16, .55, .30], palette.silver);
        innerKit.box([0, -.06, direction * 19.48], [6.4, .15, .22], palette.white);
        innerKit.box([0, -.15, direction * .95], [6.45, .36, .5], palette.white);
        innerKit.box([.65, -.4, direction * .95], [.9, .35, .48], palette.dark);
        innerKit.rod([.65, -.5, direction * .9], [.65, -.5, direction * 3], .035, palette.gold);
        innerKit.finish(local);
        mount.add(local); mountKit.finish(mount);
        mount.position.copy(wing.group.position); mount.userData.channel = wing.channel;
        wing.overlay = mount; group.add(mount);
    }
});
