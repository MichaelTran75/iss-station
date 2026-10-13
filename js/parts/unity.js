// Unity / Node 1.
import * as THREE from 'three';
import { Kit } from '../core/kit.js';
import { part, pma1BaseZ, pmaReferenceLength, pmaReferenceOffset, russianSegmentOffset } from '../core/station.js';
import { cbmPassiveRadius, cbmReferenceRadial, cbmUnityFront, cbmUnityScale, referenceActiveCBM, referenceCbmCone,
    referenceFreeCbm, referencePassiveCBM } from '../core/cbm.js';
import { hullBadge } from '../core/surfaces.js';
import { genericEndInterface, moduleAt, placedKit, radialPortStub } from '../core/hull.js';
import { referencePma } from '../core/pma.js';

part('unity', 'Unity / Node 1', '06 / CONNECTING NODE', 'Unity joined Zarya in December 1998, linking the US and Russian segments. Six berthing ports connect laboratories, living space, storage and the airlock.', [['Joined station', '1998'], ['Berthing ports', '6']], [0, 2.1, 12], (kit, group) => {
    // The interior is empty: a hollow barrel, and four radial port stubs that rise from the pressure shell to
    // their port faces instead of tubes crossing the module. Z1 seats on the zenith stub's berthing interface.
    moduleAt(kit, [0, 0, 12], 5.5, 2.15, 'z', { skin: 'quilted', endInterfaceSides: [1], hollow: true });
    for (const sign of [-1, 1]) radialPortStub(kit, [0, 0, 12], 2.15, 1.25, 2.3, 'x', sign);
    for (const sign of [-1, 1]) radialPortStub(kit, [0, 0, 12], 2.15, 1.25, 2.4, 'y', sign);
    placedKit(kit, [0, 0, 12], [-Math.PI / 2, 0, 0], local => genericEndInterface(local, 1, 1.25, 2.4, true));
    hullBadge(kit, 'UNITY', [0, 0, 10.05], 2.225, [1.15, .32]);
    // The nadir port has been free since Leonardo moved to Tranquility in 2015: the GLB's covered CBM stands on
    // the port face, its inspection ring toward the aft (Russian) end.
    const nadir = new THREE.Group(), nadirKit = new Kit();
    nadir.name = 'Unity / nadir free CBM'; nadir.position.z = 12; nadir.rotation.x = Math.PI;
    nadir.userData.cover = referenceFreeCbm(nadirKit, { face: 2.4 });
    nadirKit.finish(nadir); group.add(nadir);
    referenceCbmCone(kit, 9.25, cbmUnityFront, 2.15, cbmPassiveRadius);
    group.userData.cbm = { destiny: referencePassiveCBM(kit, cbmUnityFront, -1, cbmUnityScale, cbmReferenceRadial) };
    // The reference's stepped active CBMs replace generic domes on the two occupied radial ports.
    // Quest keeps its existing location, so its sleeve is extended along the mating axis only.
    for (const sign of [-1, 1]) {
        const collar = new THREE.Group(), collarKit = new Kit();
        collar.name = sign > 0 ? 'Unity / Quest active CBM' : 'Unity / Tranquility active CBM';
        collar.position.z = 12; collar.rotation.y = sign * Math.PI / 2;
        const reach = sign > 0 ? 1.1505 : .4845;
        collar.userData.cbm = referenceActiveCBM(collarKit, 2.290, a => a * reach / .472985);
        collar.userData.currentPlacementRetained = true;
        collarKit.finish(collar); group.add(collar);
    }
    // The same source PMA used at Harmony, rotated to raise the Russian mating axis.
    const adapter = referencePma('PMA-1 / GLB reference structure', [0, 0, pma1BaseZ], [0, 0, Math.PI]);
    group.add(adapter);
    group.userData.pma1 = {
        reconstruction: 'Supplied GLB mesh, verified against USDZ; same size as PMA-2',
        flangeCenter: [0, 0, pma1BaseZ],
        dockingFace: [0, pmaReferenceOffset, pma1BaseZ + pmaReferenceLength],
        rise: pmaReferenceOffset, segmentTranslation: russianSegmentOffset.toArray(),
        adapter, referenceSize: adapter.userData.referenceSize
    };
});
