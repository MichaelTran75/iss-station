// Animated EVA figure from the supplied USDZ (LasquetiSpice, CC BY 4.0). Its motion model is js/sim/eva.js, run by
// the animation worker (js/sim/worker.js) and, where workers are unavailable, on this thread. This side only draws:
// each frame it copies the latest pose (89 joints, tool, hook, three tether tubes) into the meshes. The figure and
// its 4 MB of mesh data load after the station's first frame, so they never delay the page.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { quality, query } from '../core/quality.js';
import { halveLargeMaps } from '../core/release.js';
import { pmaArray } from '../core/pma.js';
import { z1Group, z1Scale } from '../parts/assembly.js';

export let evaWorkerState = 'loading';
async function createZ1Maintenance(evaAsset, simulation) {
    const { evaScene: S, evaTubes, evaLayout, evaPhases } = simulation;
    const frame = new THREE.Group(); frame.name = 'Z1 / EVA maintenance'; frame.visible = false;
    // Author the EVA in station metres while inheriting Z1 selection and visibility.
    frame.scale.setScalar(1 / z1Scale);
    frame.position.copy(z1Group.position).multiplyScalar(-1 / z1Scale);
    const textures = {};
    await Promise.all(Object.entries(evaAsset.images).map(async ([name, url]) => {
        const map = await new THREE.TextureLoader().loadAsync(url);
        map.colorSpace = name.includes('normal') ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        map.flipY = true; map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); textures[name] = map;
    }));
    const surfaces = [
        new THREE.MeshStandardMaterial({map: textures['material_0_diffuse.jpg'], roughness: .44, metalness: .18, side: THREE.DoubleSide}),
        new THREE.MeshStandardMaterial({color: new THREE.Color(.133209, .133209, .133209), roughness: .92, side: THREE.DoubleSide}),
        new THREE.MeshStandardMaterial({map: textures['material_2_diffuse.jpg'], normalMap: textures['material_2_normal.jpg'], roughness: .76, metalness: .08, side: THREE.DoubleSide})
    ];
    const actor = new THREE.Group(); actor.name = 'Floating astronaut'; frame.add(actor);
    const rig = new THREE.Group(); rig.name = 'USDZ skeleton and suit';
    rig.scale.setScalar(evaAsset.modelScale);
    rig.position.fromArray(evaAsset.rootPivot).multiplyScalar(-evaAsset.modelScale); actor.add(rig);
    const rest = pmaArray(evaAsset.rest, Float32Array), bind = pmaArray(evaAsset.bind, Float32Array);
    const bones = evaAsset.parents.map((parent, i) => {
        const bone = new THREE.Bone(); bone.name = 'evaJoint' + i;
        new THREE.Matrix4().fromArray(rest, i * 16).decompose(bone.position, bone.quaternion, bone.scale); return bone;
    });
    bones.forEach((bone, i) => (evaAsset.parents[i] < 0 ? rig : bones[evaAsset.parents[i]]).add(bone));
    const skeleton = new THREE.Skeleton(bones, bones.map((_, i) => new THREE.Matrix4().fromArray(bind, i * 16).invert()));
    const skins = evaAsset.meshes.map(definition => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(pmaArray(definition.position, Float32Array), 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(pmaArray(definition.normal, Float32Array), 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(pmaArray(definition.uv, Float32Array), 2));
        geometry.setAttribute('skinIndex', new THREE.BufferAttribute(pmaArray(definition.skinIndex, Uint16Array), 4));
        geometry.setAttribute('skinWeight', new THREE.BufferAttribute(pmaArray(definition.skinWeight, Float32Array), 4));
        geometry.setIndex(new THREE.BufferAttribute(pmaArray(definition.index, Uint32Array), 1));
        const mesh = new THREE.SkinnedMesh(geometry, surfaces[definition.material]); mesh.name = 'EVA / ' + definition.name;
        rig.add(mesh); mesh.bind(skeleton, new THREE.Matrix4()); mesh.frustumCulled = false;
        mesh.castShadow = mesh.receiveShadow = true; return mesh;
    });
    const metal = new THREE.MeshStandardMaterial({color: 0xb9c1bc, roughness: .49, metalness: .46});
    const dark = new THREE.MeshStandardMaterial({color: 0x36433e, roughness: .73, metalness: .18});
    const ivory = new THREE.MeshStandardMaterial({color: 0xe2e6df, roughness: .76, metalness: .08});
    const gold = new THREE.MeshStandardMaterial({color: 0xd0b16b, roughness: .66, metalness: .22});
    // Braided steel line of the safety tether, white webbing of the waist tether.
    const steel = new THREE.MeshStandardMaterial({color: 0x8a959a, roughness: .36, metalness: .62});
    const webbing = new THREE.MeshStandardMaterial({color: 0xd6d8d0, roughness: .9, metalness: 0});
    function mesh(parent, geometry, surface, p = [0, 0, 0]) {
        const object = new THREE.Mesh(geometry, surface); object.position.fromArray(p);
        object.castShadow = object.receiveShadow = true; parent.add(object); return object;
    }
    const workPoint = new THREE.Vector3(-1.16, 5.42, 10.631);
    const panel = new THREE.Group(); panel.name = 'Z1 EVA service panel'; panel.position.set(-1.16, 5.42, 10.682); frame.add(panel);
    mesh(panel, new THREE.BoxGeometry(.28, .34, .048), metal);
    mesh(panel, new THREE.BoxGeometry(.24, .30, .013), ivory, [0, 0, -.030]);
    for (const x of [-.095, .095]) for (const y of [-.12, .12]) mesh(panel, new THREE.CylinderGeometry(.013, .013, .016, 8).rotateX(Math.PI / 2), dark, [x, y, -.044]);
    mesh(panel, new THREE.CylinderGeometry(.025, .025, .012, 12).rotateX(Math.PI / 2), metal, [0, 0, -.045]);
    // The four corner bolts are driven in a cross pattern; each target is a bolt head face.
    const bolts = S.bolts.map(p => new THREE.Vector3(...p));
    const tool = new THREE.Group(); tool.name = 'EVA pistol grip tool'; frame.add(tool);
    mesh(tool, new THREE.BoxGeometry(.09, .09, .16), ivory, [0, .028, .05]);
    mesh(tool, new THREE.BoxGeometry(.056, .14, .065), dark, [0, -.065, 0]);
    mesh(tool, new THREE.CylinderGeometry(.026, .032, .12, 20).rotateX(Math.PI / 2), metal, [0, .028, .18]);
    const bit = mesh(tool, new THREE.CylinderGeometry(.010, .010, .10, 8).rotateX(Math.PI / 2), dark, [0, .028, .27]);
    mesh(tool, new THREE.BoxGeometry(.043, .015, .08), gold, [0, .080, .025]);
    // Put the handle centre at the palm attachment, with the bit above it.
    tool.children.forEach(child => { child.position.y += .065; });
    const drillTip = new THREE.Object3D(); drillTip.name = 'Pistol grip tool socket'; drillTip.position.fromArray(S.toolTipLocal); tool.add(drillTip);
    // A helical flute makes rotation visible without spinning the glove.
    const flutePoints = Array.from({length: 49}, (_, i) => {
        const angle = i / 48 * Math.PI * 6;
        return new THREE.Vector3(.011 * Math.cos(angle), .011 * Math.sin(angle), -.05 + i / 48 * .10);
    });
    mesh(bit, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(flutePoints), 48, .0025, 5, false), metal);
    // Three gold handholds in a line up the port edge of the forward face. The crew member climbs hand over
    // hand on the lower two and works from the top one, which also takes the waist tether.
    const handrail = new THREE.Group(); handrail.name = 'Z1 forward-face EVA handholds'; frame.add(handrail);
    for (const [low, high] of S.holds) {
        for (const y of [low, high]) {
            mesh(handrail, new THREE.BoxGeometry(.105, .105, .035), metal, [S.railX, y, 10.715]);
            mesh(handrail, new THREE.CylinderGeometry(.018, .018, .115, 12).rotateX(Math.PI / 2), gold, [S.railX, y, 10.66]);
        }
        mesh(handrail, new THREE.CylinderGeometry(.020, .020, high - low, 16), gold, [S.railX, (low + high) / 2, S.railZ]);
    }
    const railPoint = y => new THREE.Vector3(S.railX, y, S.railZ);
    // 85-ft safety tether. The reel rides on the left D-ring extender; its steel line is hooked to the handrail
    // ring around Quest's EVA hatch and fairleaded under both forward Unity handrails and under the lowest
    // handhold. Reel tension keeps every span taut, so only the span to the crew member moves.
    const tetherRoute = [[7.37, -1.265, 11.00], [7.30, -.62, 10.90], [7.05, .20, 10.86], [6.45, .95, 10.92], [6.05, 1.70, 11.00], [5.80, 2.13, 11.22], [3.55, 2.13, 11.22], [3.25, 2.02, 11.00]].map(p => new THREE.Vector3(...p));
    const onUnity = (radius, degrees, z) => { const a = THREE.MathUtils.degToRad(degrees); return new THREE.Vector3(radius * Math.cos(a), radius * Math.sin(a), z); };
    for (let degrees = 45; degrees <= 135; degrees += 10) tetherRoute.push(onUnity(2.26, degrees, 10.17));
    // Up the port edge of the face, then sideways behind the lowest handhold bar, which turns it toward the reel.
    const fairlead = new THREE.Vector3(...S.fairlead);
    tetherRoute.push(onUnity(2.27, 139.5, 10.18), onUnity(2.43, 140, 10.24), new THREE.Vector3(-1.74, 2.30, 10.50), new THREE.Vector3(-1.54, 3.30, 10.62),
        new THREE.Vector3(-1.505, 3.86, 10.642), new THREE.Vector3(-1.475, 3.95, 10.645), fairlead);
    const routeCurve = new THREE.CatmullRomCurve3(tetherRoute, false, 'centripetal');
    const routedLine = mesh(frame, new THREE.TubeGeometry(routeCurve, 640, evaTubes.tetherSpan.radius, 6, false), steel);
    routedLine.name = 'Safety tether / routed line'; routedLine.castShadow = false;
    const fairleadTangent = routeCurve.getTangentAt(1);
    // The hook gate closes round the hatch ring tube, which runs along x at its forward point.
    const anchor = new THREE.Group(); anchor.name = 'Safety tether hook on the Quest hatch ring'; anchor.position.set(7.37, -1.30, 11.02); frame.add(anchor);
    mesh(anchor, new THREE.TorusGeometry(.036, .0065, 8, 24).rotateY(Math.PI / 2), metal);
    mesh(anchor, new THREE.CylinderGeometry(.007, .007, .05, 8).rotateX(-.55), metal, [0, .046, -.016]);
    // Suit hardware rides on the skeleton: D-rings on the waist bones, the tool mount on the chest.
    function onBone(bone, local) {
        const group = new THREE.Group(); group.position.fromArray(local); group.scale.setScalar(1 / evaAsset.modelScale);
        bone.add(group); return group;
    }
    const leftRing = onBone(bones[2], S.leftRing), rightRing = onBone(bones[2], S.rightRing);
    for (const ring of [leftRing, rightRing]) mesh(ring, new THREE.TorusGeometry(.019, .0045, 6, 18).rotateY(Math.PI / 2), metal);
    const reel = onBone(bones[2], S.reel); reel.name = '85-ft safety tether reel';
    mesh(reel, new THREE.BoxGeometry(.066, .125, .105), new THREE.MeshStandardMaterial({color: 0xd2d6cf, roughness: .7, metalness: .1}));
    mesh(reel, new THREE.BoxGeometry(.068, .022, .107), dark, [0, -.035, 0]);
    mesh(reel, new THREE.BoxGeometry(.04, .045, .02), metal, [0, .072, .02]);
    const reelExit = new THREE.Object3D(); reelExit.position.fromArray(S.reelExit); reel.add(reelExit);
    const toolMount = onBone(bones[3], S.toolMount); toolMount.name = 'Mini-workstation tool mount';
    mesh(toolMount, new THREE.BoxGeometry(.05, .03, .04), dark, [0, -.02, -.035]);
    // Waist tether: webbing from the right D-ring to a large hook, stowed on the ring for the climb.
    const waistHook = new THREE.Group(); waistHook.name = 'Waist tether hook'; frame.add(waistHook);
    mesh(waistHook, new THREE.TorusGeometry(.042, .0065, 8, 28, Math.PI * 1.7), metal);
    mesh(waistHook, new THREE.CylinderGeometry(.0045, .0045, .038, 6).rotateZ(-.47), metal, [.0334, -.017, 0]);
    const surfacesByTube = { tetherSpan: [steel, 'Safety tether / free span'], waistStrap: [webbing, 'Waist tether webbing'], toolTether: [steel, 'Tool tether to mini-workstation'] };
    const tubes = Object.fromEntries(Object.entries(evaTubes).map(([name, { count, radius }]) => {
        const curve = new THREE.CubicBezierCurve3(...Array.from({length: 4}, (_, i) => new THREE.Vector3(0, i * .1, 0)));
        const line = mesh(frame, new THREE.TubeGeometry(curve, count, radius, 6, false), surfacesByTube[name][0]);
        line.name = surfacesByTube[name][1]; line.frustumCulled = false; line.castShadow = false;
        for (const attribute of [line.geometry.attributes.position, line.geometry.attributes.normal]) attribute.setUsage(THREE.DynamicDrawUsage);   // rewritten each frame
        return [name, line];
    }));
    const rightGripLocal = new THREE.Vector3(14.1289751, .3173805, -.0742860), leftGripLocal = new THREE.Vector3(...evaAsset.rightGrip);
    const rightHand = bones[41], leftHand = bones[7];
    const worldPoint = (bone, point = new THREE.Vector3()) => bone.localToWorld(point.clone());
    // Pose buffer → meshes.
    const layout = evaLayout(bones.length);
    let shown = { time: 0, phase: 'climb', drilling: false };
    function apply(pose) {
        const read = (object, offset) => { object.position.fromArray(pose, offset); object.quaternion.fromArray(pose, offset + 3); };
        read(actor, layout.actor); read(tool, layout.tool); read(waistHook, layout.hook);
        for (let i = 0; i < bones.length; i++) {
            const offset = layout.bones + i * 10;
            bones[i].position.fromArray(pose, offset); bones[i].quaternion.fromArray(pose, offset + 3); bones[i].scale.fromArray(pose, offset + 7);
        }
        bit.rotation.z = pose[3]; tubes.toolTether.visible = pose[4] > .5;
        for (const [name, line] of Object.entries(tubes)) {
            // A hidden tube keeps an empty box, so it never stretches Z1's bounds (and the camera framing) to its rest place.
            if (!line.visible) { line.geometry.boundingBox = new THREE.Box3(); continue; }
            const slot = layout.tubes[name], attributes = line.geometry.attributes;
            attributes.position.array.set(pose.subarray(slot.positions, slot.positions + slot.floats));
            attributes.normal.array.set(pose.subarray(slot.normals, slot.normals + slot.floats));
            attributes.position.needsUpdate = attributes.normal.needsUpdate = true;
            line.geometry.computeBoundingBox(); line.geometry.computeBoundingSphere();
        }
        shown = { time: pose[0], phase: evaPhases[pose[1]], drilling: pose[2] > .5 };
        frame.visible = true; frame.updateWorldMatrix(true, true);
    }
    if (quality.ceiling !== 'high') halveLargeMaps(frame);   // as the station's (js/core/release.js), before it is drawn
    z1Group.add(frame);
    // Motion source: the animation worker when it starts, otherwise the same model on this thread.
    const assetForWorker = { parents: evaAsset.parents, rest: evaAsset.rest, animation: evaAsset.animation, duration: evaAsset.duration, modelScale: evaAsset.modelScale, rootPivot: evaAsset.rootPivot, rightGrip: evaAsset.rightGrip };
    const driver = { mode: 'local', worker: null, buffers: [], busy: false, local: null, pose: new Float32Array(layout.size) };
    let time = 0;
    function useMainThread(reason) {
        if (driver.worker) { driver.worker.terminate(); driver.worker = null; }
        if (reason) console.warn('EVA animation runs on the main thread:', reason);
        driver.mode = 'local'; driver.local ||= simulation.createEvaSimulation(assetForWorker, fairleadTangent.toArray());
        evaWorkerState = 'main thread'; stepNow();
    }
    function stepNow() {
        if (driver.mode === 'local') { apply(driver.local.step(time, driver.pose)); return; }
        if (driver.busy || !driver.buffers.length) return;
        const buffer = driver.buffers.pop(); driver.busy = true;
        driver.worker.postMessage({ type: 'step', id: 'eva', time, buffer }, [buffer]);
    }
    if (query.get('worker') !== '0' && typeof Worker === 'function') {
        try {
            const worker = new Worker(new URL('../sim/worker.js?v=dca14f3e35', import.meta.url), { type: 'module' });
            driver.mode = 'starting'; driver.worker = worker; evaWorkerState = 'starting worker';
            worker.onmessage = ({ data }) => {
                if (data.type === 'ready') {
                    driver.mode = 'worker'; evaWorkerState = 'worker';
                    driver.buffers = [new ArrayBuffer(data.size * 4), new ArrayBuffer(data.size * 4)]; stepNow();
                } else if (data.type === 'pose') {
                    apply(new Float32Array(data.buffer)); driver.buffers.push(data.buffer); driver.busy = false;
                    if (data.time !== time) stepNow();
                } else if (data.type === 'error') useMainThread(data.message);
            };
            worker.onerror = event => { event.preventDefault(); useMainThread(event.message || 'worker failed to load'); };
            worker.postMessage({ type: 'init', id: 'eva', kind: 'eva', payload: { asset: assetForWorker, fairleadTangent: fairleadTangent.toArray() } });
        } catch (error) { useMainThread(error.message); }
    } else useMainThread();
    for (const skin of skins) { skin.computeBoundingBox(); skin.boundingBox.expandByScalar(30); skin.computeBoundingSphere(); skin.boundingSphere.radius += 30; }
    frame.userData = {role: 'Z1 hand-over-hand climb, waist tether clipped at the worksite, pistol grip tool on four panel bolts, then the tool stowed, the tether unclipped and the climb back down', asset: evaAsset.source, author: evaAsset.author, animationDuration: evaAsset.duration, safetyTether: 'Quest EVA hatch handrail ring', timings: S.timings};
    return {frame, actor, rig, skeleton, skins, tool, bit, drillTip, handrail, panel, bones, bolts, workPoint, rightHand, leftHand, timings: S.timings,
        routedLine, tetherSpan: tubes.tetherSpan, waistStrap: tubes.waistStrap, waistHook, toolTether: tubes.toolTether, reel, anchor, routeCurve, fairlead,
        update: delta => { time += Math.max(0, delta); stepNow(); },
        restart: () => { time = 0; stepNow(); },
        // Tests and captures: compute on this thread so a pose is in place as soon as update() returns.
        useMainThread: () => useMainThread(),
        rightGripWorld: () => worldPoint(rightHand, rightGripLocal), leftGripWorld: () => worldPoint(leftHand, leftGripLocal),
        railPointWorld: y => frame.localToWorld(railPoint(y)), drillTipWorld: () => drillTip.getWorldPosition(new THREE.Vector3()),
        boltWorld: k => frame.localToWorld(bolts[k].clone()), reelExitWorld: () => reelExit.getWorldPosition(new THREE.Vector3()),
        get mode() {return driver.mode;}, get time() {return time;}, get phase() {return shown.phase;}, get drilling() {return shown.drilling;}};
}
// Until the figure has loaded, the Z1 EVA calls are no-ops.
let evaFigure = null;
const evaIdle = { update() {}, restart() {}, useMainThread() {}, mode: 'loading', time: 0, phase: 'loading', drilling: false };
export const z1EVA = new Proxy({}, { get: (_, key) => (evaFigure || evaIdle)[key] });
// The figure and its motion model load after the station's first frame; onLoad receives the built figure.
export async function loadZ1Maintenance(onLoad) {
    try {
        const [response, simulation] = await Promise.all([fetch('data/eva-astronaut.json?v=64b1165037'), import('../sim/eva.js')]);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        evaFigure = await createZ1Maintenance(await response.json(), simulation);
        onLoad(evaFigure);
    } catch (error) { evaWorkerState = 'unavailable'; console.warn('The EVA figure could not load:', error); }
}
