// Two animated EVA crew from the supplied USDZ (LasquetiSpice, CC BY 4.0): out of Quest's hatch, along the handrails
// to Z1 with their safety tethers laid behind them, the bolt task there (the helper hands the tool over and holds
// the rail), and back in. The motion model is js/sim/eva.js on the route of js/sim/eva-route.js, run by the
// animation worker (js/sim/worker.js) and, where workers are unavailable, on this thread. This side only draws:
// each frame it copies the latest poses (per crew: 89 joints, tool, hook, three tether tubes) into the meshes, and
// shows the rails, the laid tethers and the open hatch. The figure and
// its 4 MB of mesh data load after the station's first frame, so they never delay the page.
import * as THREE from 'three';
import { renderer } from '../core/stage.js';
import { quality, query } from '../core/quality.js';
import { halveLargeMaps } from '../core/release.js';
import { pmaArray } from '../core/pma.js';
import { z1Group, z1Scale } from '../parts/assembly.js';

export let evaWorkerState = 'loading';
async function createZ1Maintenance(evaAsset, simulation) {
    const { evaScene: S, evaTubes, evaLayout, evaPhases, evaBars, evaPath } = simulation;
    const routes = simulation.createEvaRoutes(), timeline = routes.timeline;
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
    // One set of suit geometry, skinned by both crew.
    const geometries = evaAsset.meshes.map(definition => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(pmaArray(definition.position, Float32Array), 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(pmaArray(definition.normal, Float32Array), 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(pmaArray(definition.uv, Float32Array), 2));
        geometry.setAttribute('skinIndex', new THREE.BufferAttribute(pmaArray(definition.skinIndex, Uint16Array), 4));
        geometry.setAttribute('skinWeight', new THREE.BufferAttribute(pmaArray(definition.skinWeight, Float32Array), 4));
        geometry.setIndex(new THREE.BufferAttribute(pmaArray(definition.index, Uint32Array), 1));
        return geometry;
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
    for (const side of [0, evaPath.helperOffset[0]]) for (const [low, high] of S.holds) {   // the lead's line, then the helper's
        for (const y of [low, high]) {
            mesh(handrail, new THREE.BoxGeometry(.105, .105, .035), metal, [S.railX + side, y, 10.715]);
            mesh(handrail, new THREE.CylinderGeometry(.018, .018, .115, 12).rotateX(Math.PI / 2), gold, [S.railX + side, y, 10.66]);
        }
        mesh(handrail, new THREE.CylinderGeometry(.020, .020, high - low, 16), gold, [S.railX + side, (low + high) / 2, S.railZ]);
    }
    // Handrails from the Quest hatch to the foot of Z1 (js/sim/eva-route.js): a gold bar on two posts each, drawn as
    // two instanced meshes.
    const bars = [...evaBars.trunk, ...evaBars.lead, ...evaBars.helper];
    const stick = new THREE.CylinderGeometry(1, 1, 1, 10), up = new THREE.Vector3(0, 1, 0), placed = new THREE.Matrix4();
    const between = (a, b, radius) => { const d = b.clone().sub(a), length = d.length(); return placed.compose(a.clone().add(b).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(up, d.divideScalar(length)), new THREE.Vector3(radius, length, radius)); };
    const railBars = new THREE.InstancedMesh(stick, gold, bars.length), railPosts = new THREE.InstancedMesh(stick, metal, bars.length * 2);
    railBars.name = 'EVA handrails, Quest to Z1'; railPosts.name = 'EVA handrail posts';
    bars.forEach((bar, i) => {
        const a = new THREE.Vector3(...bar.slice(0, 3)), b = new THREE.Vector3(...bar.slice(3, 6));
        railBars.setMatrixAt(i, between(a, b, .020));
        railPosts.setMatrixAt(i * 2, between(a, a.clone().addScaledVector(new THREE.Vector3(...bar.slice(6, 9)), -bar[12]), .012));
        railPosts.setMatrixAt(i * 2 + 1, between(b, b.clone().addScaledVector(new THREE.Vector3(...bar.slice(9, 12)), -bar[13]), .012));
    });
    for (const rails of [railBars, railPosts]) { rails.castShadow = rails.receiveShadow = true; rails.computeBoundingBox(); rails.computeBoundingSphere(); handrail.add(rails); }
    const railPoint = y => new THREE.Vector3(S.railX, y, S.railZ);
    // 85-ft safety tethers. Each reel rides on the left D-ring extender; its steel line is hooked beside the first
    // handrail outside the Quest hatch and lies along the handrails to the crew member's fairlead at the worksite.
    // Only the part already paid out is drawn (pose[7]); the span from there to the reel moves with the crew.
    const fairlead = new THREE.Vector3(...S.fairlead);
    const laid = ['lead', 'helper'].map((role, k) => {
        const tether = routes[role].tether;
        const line = mesh(frame, new THREE.TubeGeometry(tether.line, tether.segments, evaTubes.tetherSpan.radius, 6, false), steel);
        line.name = 'Safety tether / laid line, ' + role; line.castShadow = false; line.geometry.setDrawRange(0, 0);
        // The hook gate closes round the handrail post.
        const anchor = new THREE.Group(); anchor.name = 'Safety tether hook, ' + role; anchor.position.copy(tether.line.getPoint(0)); anchor.position.x += k ? .03 : -.03; frame.add(anchor);
        mesh(anchor, new THREE.TorusGeometry(.036, .0065, 8, 24).rotateY(Math.PI / 2), metal);
        mesh(anchor, new THREE.CylinderGeometry(.007, .007, .05, 8).rotateX(-.55), metal, [0, .046, -.016]);
        return { line, anchor, segments: tether.segments };
    });
    // The Quest hatch stands open while anyone is outside: a dark opening under the lid.
    const hatch = S.hatch, opening = new THREE.Mesh(new THREE.CircleGeometry(hatch.radius - .03, 40), new THREE.MeshBasicMaterial({ color: 0x06090b, side: THREE.DoubleSide }));
    opening.name = 'Quest EVA hatch, open'; opening.userData.interior = true; opening.visible = false; opening.rotation.x = Math.PI / 2;
    opening.position.fromArray(hatch.center).addScaledVector(new THREE.Vector3(...hatch.normal), .088); frame.add(opening);
    // The hatch's thermal cover swings out on its hinge, on the side away from the route, before the first crew
    // member leaves and shuts after the last one is in. Shut, it lies over the hull's own lid and both are hidden.
    const cover = new THREE.Group(), coverSwing = 5, coverOpen = 1.83;
    {
        const white = new THREE.MeshStandardMaterial({ color: 0xeceeec, roughness: .9 }), metal = new THREE.MeshStandardMaterial({ color: 0x8d9aa0, roughness: .6, metalness: .4 });
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(hatch.radius - .01, hatch.radius - .01, .05, 40), white);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(hatch.radius - .03, .016, 8, 40), metal); rim.rotation.x = Math.PI / 2; rim.position.y = .026;
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(hatch.radius - .12, hatch.radius - .12, .02, 40), new THREE.MeshStandardMaterial({ color: 0xcfd3cf, roughness: 1 })); pad.position.y = .034;
        const leaf = new THREE.Group(); leaf.add(lid, rim, pad); leaf.position.z = -hatch.radius - .02;
        const hinge = new THREE.Mesh(new THREE.BoxGeometry(.3, .05, .1), metal); hinge.position.z = -.03;
        const handle = new THREE.Mesh(new THREE.TorusGeometry(.07, .012, 6, 16, Math.PI), metal); handle.position.set(0, -.03, -2 * hatch.radius + .2); handle.rotation.set(Math.PI, Math.PI / 2, 0);
        cover.add(leaf, hinge, handle); cover.name = 'Quest EVA hatch thermal cover';
    }
    cover.position.fromArray(hatch.center).addScaledVector(new THREE.Vector3(...hatch.normal), .118).add(new THREE.Vector3(0, 0, hatch.radius + .02));
    cover.visible = false; frame.add(cover);
    // One spacewalker: suit, suit hardware, waist tether and the three moving lines, in a group the motion model places
    // (at the worksite, or carried along the handrails).
    function crew(label) {
        const group = new THREE.Group(); group.name = 'EVA crew / ' + label; frame.add(group);
        const actor = new THREE.Group(); actor.name = 'Floating astronaut'; actor.userData.astronaut = true; group.add(actor);
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
        const skins = evaAsset.meshes.map((definition, i) => {
            const mesh = new THREE.SkinnedMesh(geometries[i], surfaces[definition.material]); mesh.name = 'EVA / ' + definition.name;
            rig.add(mesh); mesh.bind(skeleton, new THREE.Matrix4()); mesh.frustumCulled = false;
            mesh.castShadow = mesh.receiveShadow = true; return mesh;
        });
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
        const waistHook = new THREE.Group(); waistHook.name = 'Waist tether hook'; group.add(waistHook);
        mesh(waistHook, new THREE.TorusGeometry(.042, .0065, 8, 28, Math.PI * 1.7), metal);
        mesh(waistHook, new THREE.CylinderGeometry(.0045, .0045, .038, 6).rotateZ(-.47), metal, [.0334, -.017, 0]);
        const surfacesByTube = { tetherSpan: [steel, 'Safety tether / free span'], waistStrap: [webbing, 'Waist tether webbing'], toolTether: [steel, 'Tool tether to mini-workstation'] };
        const tubes = Object.fromEntries(Object.entries(evaTubes).map(([name, { count, radius }]) => {
            const curve = new THREE.CubicBezierCurve3(...Array.from({length: 4}, (_, i) => new THREE.Vector3(0, i * .1, 0)));
            const line = mesh(group, new THREE.TubeGeometry(curve, count, radius, 6, false), surfacesByTube[name][0]);
            line.name = surfacesByTube[name][1]; line.frustumCulled = false; line.castShadow = false;
            for (const attribute of [line.geometry.attributes.position, line.geometry.attributes.normal]) attribute.setUsage(THREE.DynamicDrawUsage);   // rewritten each frame
            return [name, line];
        }));
        return { label, group, actor, rig, bones, skeleton, skins, waistHook, tubes, reel, reelExit, toolMount };
    }
    const crews = [crew('lead'), crew('helper')];
    const { actor, rig, bones, skeleton, skins, waistHook, tubes, reel, reelExit } = crews[0];
    const rightGripLocal = new THREE.Vector3(14.1289751, .3173805, -.0742860), leftGripLocal = new THREE.Vector3(...evaAsset.rightGrip);
    const rightHand = bones[41], leftHand = bones[7];
    const worldPoint = (bone, point = new THREE.Vector3()) => bone.localToWorld(point.clone());
    // Pose buffer → meshes.
    const layout = evaLayout(bones.length);
    let shown = { time: 0, phase: 'climb', drilling: false };
    const block = layout.size;   // floats per crew; the lead's block comes first
    function apply(pose) {
        let owner = 1, outside = false;
        crews.forEach((crew, k) => {
            const base = k * block, read = (object, offset) => { object.position.fromArray(pose, base + offset); object.quaternion.fromArray(pose, base + offset + 3); };
            read(crew.group, layout.frame); read(crew.actor, layout.actor); read(crew.waistHook, layout.hook);
            for (let i = 0; i < crew.bones.length; i++) {
                const offset = base + layout.bones + i * 10, bone = crew.bones[i];
                bone.position.fromArray(pose, offset); bone.quaternion.fromArray(pose, offset + 3); bone.scale.fromArray(pose, offset + 7);
            }
            const out = pose[base + 6] > .5; crew.group.visible = out; outside ||= out;
            if (pose[base + 5] > .5) owner = k;
            crew.tubes.toolTether.visible = pose[base + 4] > .5;
            for (const [name, line] of Object.entries(crew.tubes)) {
                if (!line.visible || !out) continue;
                const slot = layout.tubes[name], attributes = line.geometry.attributes;
                attributes.position.array.set(pose.subarray(base + slot.positions, base + slot.positions + slot.floats));
                attributes.normal.array.set(pose.subarray(base + slot.normals, base + slot.normals + slot.floats));
                attributes.position.needsUpdate = attributes.normal.needsUpdate = true;
            }
            // Laid line: drawn as far as it has been paid out, one ring of six quads per segment.
            laid[k].line.geometry.setDrawRange(0, out ? Math.ceil(pose[base + 7] * laid[k].segments) * 36 : 0); laid[k].anchor.visible = out;
        });
        // The tool is posed in the frame of whoever holds it: the lead once it has been handed over, else the helper.
        const holder = crews[owner].group, base = owner * block + layout.tool;
        tool.position.fromArray(pose, base).applyQuaternion(holder.quaternion).add(holder.position);
        tool.quaternion.fromArray(pose, base + 3).premultiply(holder.quaternion); tool.visible = holder.visible;
        bit.rotation.z = pose[3];
        const shut = THREE.MathUtils.smoothstep(pose[0], timeline.home.helper, timeline.home.helper + coverSwing);
        const swung = Math.max(1 - shut, THREE.MathUtils.smoothstep(pose[0], timeline.period - coverSwing, timeline.period));
        cover.rotation.x = -coverOpen * swung; cover.visible = opening.visible = outside || swung > 0;
        shown = { time: pose[0], phase: evaPhases[pose[1]], helper: evaPhases[pose[block + 1]], drilling: pose[2] > .5 };
        frame.visible = true; frame.updateWorldMatrix(true, true);
    }
    // Z1's bounds (camera framing, selection) stay those of the truss segment and the worksite: everything that moves
    // or reaches toward Quest keeps an empty box and is never culled, and one unseen box stands for the worksite.
    for (const object of [...crews.map(crew => crew.group), tool, railBars, railPosts, opening, cover, ...laid.flatMap(({ line, anchor }) => [line, anchor])]) object.traverse(child => {
        if (!child.isMesh) return;
        child.frustumCulled = false;
        if (child.isSkinnedMesh || child.isInstancedMesh) child.boundingBox = new THREE.Box3(); else child.geometry.boundingBox = new THREE.Box3();
    });
    const worksite = new THREE.Mesh(new THREE.BoxGeometry(2, 3.1, 1.17), metal); worksite.name = 'EVA worksite bounds';
    worksite.position.set(-.95, 4.4, 10.135); worksite.visible = false; worksite.raycast = () => {}; frame.add(worksite);
    if (quality.ceiling !== 'high') halveLargeMaps(frame);   // as the station's (js/core/release.js), before it is drawn
    z1Group.add(frame);
    // Motion source: the animation worker when it starts, otherwise the same model on this thread.
    const assetForWorker = { parents: evaAsset.parents, rest: evaAsset.rest, animation: evaAsset.animation, duration: evaAsset.duration, modelScale: evaAsset.modelScale, rootPivot: evaAsset.rootPivot, rightGrip: evaAsset.rightGrip };
    const driver = { mode: 'local', worker: null, buffers: [], busy: false, local: null, pose: new Float32Array(block * 2) };
    // The clock starts with the lead at the foot of the climb; the walk out from Quest comes round in the loop.
    const start = timeline.arrive.lead;
    let time = start;
    function useMainThread(reason) {
        if (driver.worker) { driver.worker.terminate(); driver.worker = null; }
        if (reason) console.warn('EVA animation runs on the main thread:', reason);
        driver.mode = 'local'; driver.local ||= simulation.createEvaPair(assetForWorker);
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
            const worker = new Worker(new URL('../sim/worker.js?v=ff961a1fae', import.meta.url), { type: 'module' });
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
            worker.postMessage({ type: 'init', id: 'eva', kind: 'eva', payload: { asset: assetForWorker } });
        } catch (error) { useMainThread(error.message); }
    } else useMainThread();
    frame.userData = {role: 'Two crew leave Quest by the EVA hatch and go hand over hand along the handrails to Z1, safety tethers laid behind them; the helper hands over the pistol grip tool and holds the rail while the lead drives four panel bolts; both return the same way', asset: evaAsset.source, author: evaAsset.author, animationDuration: evaAsset.duration, safetyTether: 'Quest EVA hatch handrail ring', timings: S.timings};
    // `asset` and `surfaces` are for the second figure made from the same model (js/figures/rider.js).
    return {frame, actor, rig, skeleton, skins, asset: evaAsset, surfaces, tool, bit, drillTip, handrail, panel, bones, bolts, workPoint, rightHand, leftHand, timings: S.timings,
        crews, routes, timeline, laid, opening, tetherSpan: tubes.tetherSpan, waistStrap: tubes.waistStrap, waistHook, toolTether: tubes.toolTether, reel, fairlead,
        update: delta => { time += Math.max(0, delta); stepNow(); },
        restart: () => { time = start; stepNow(); },
        // Jump the clock (tests, captures): seconds into the loop, 0 = both crew still inside the airlock.
        seek: seconds => { time = seconds; stepNow(); },
        // Tests and captures: compute on this thread so a pose is in place as soon as update() returns.
        useMainThread: () => useMainThread(),
        rightGripWorld: () => worldPoint(rightHand, rightGripLocal), leftGripWorld: () => worldPoint(leftHand, leftGripLocal),
        railPointWorld: y => frame.localToWorld(railPoint(y)), drillTipWorld: () => drillTip.getWorldPosition(new THREE.Vector3()),
        boltWorld: k => frame.localToWorld(bolts[k].clone()), reelExitWorld: () => reelExit.getWorldPosition(new THREE.Vector3()),
        get mode() {return driver.mode;}, get time() {return time;}, get phase() {return shown.phase;}, get helperPhase() {return shown.helper;}, get drilling() {return shown.drilling;}};
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
