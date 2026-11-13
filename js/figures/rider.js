// The spacewalker Canadarm2 carries on its foot restraint (the 'eva' operation of js/robotics/sequences.js). A second
// figure from the model of js/figures/eva.js: the same geometry and textures, a skeleton and materials of its own.
// It is posed on this thread, every frame, from `crewView` (js/robotics/index.js): where the restraint holds the hips,
// whether the rider is on it, and the act under way with its progress. The arm stands still through the three acts;
// what the rider does in them is decided here:
//   board   head first out of the Quest hatch, the gloves onto the restraint's handle, the body pitched about the
//           handle until it lies along the restraint, the boots onto the foot plate;
//   work    the left glove takes the pistol grip tool off the left hip and drives the two bolts of the worksite panel;
//   alight  boarding played backward.
// Between them the rider rides: boots in the restraint, both gloves on the handle.
import * as THREE from 'three';

const decode = encoded => new Float32Array(Uint8Array.from(atob(encoded), ch => ch.charCodeAt(0)).buffer);
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const smooth = value => { const t = clamp(value, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const ramp = (t, start, end) => smooth((t - start) / (end - start));
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
// The body's frame is that of js/robotics/pose.js: origin at the hips, x to the left, y to the head, z ahead, metres.
// In it, with the rider aboard: the handle's bar (js/parts/robotics.js) and where each glove holds it, the ankles over
// the foot plate, and how far the arms may stretch (of their length) before the elbow's side is no longer certain.
const HANDLE = [0, .24, .33], GLOVE_X = .135, ANKLE = [.125, -.864, -.02], ARM_REACH = .9, LEG_REACH = .97;
// Out of the hatch: the hips start this far inside its face; the gloves wait this high before the handle comes to them.
// While the body comes round the gloves let the handle slip this far.
const INSIDE = .86, WAIT_Y = .60, SLIP = .09;
// Source anatomy (as js/sim/eva.js): the +X arm 5/6/7 is the left one, 39/40/41 the right; legs 77/78/79 and 83/84/85.
const LEFT_ARM = [5, 6, 7], RIGHT_ARM = [39, 40, 41], LEFT_LEG = [77, 78, 79], RIGHT_LEG = [83, 84, 85], WAIST = 1;
const LEFT_FINGERS = [[11, 12, 13], [14, 15, 16], [17, 18, 19], [20, 21, 22]], LEFT_THUMB = [8, 9, 10];
const RIGHT_FINGERS = [[45, 46, 47], [48, 49, 50], [51, 52, 53], [54, 55, 56]], RIGHT_THUMB = [42, 43, 44];
// The tool hangs before the left hip (its grip here, in the body's frame), the bit down along the thigh: clear of
// the handle and of both arms, the grip free for a hand that comes down beside it.
const RIGHT_GRIP = [14.1289751, .3173805, -.0742860], STOW = [.17, -.03, .205], TOOL_TIP = [0, .093, .32];
// The work, in seconds from its start (the act is scaled to them): the glove to the tool, the tool to the first bolt,
// each bolt seated, driven and left, the tool back on the hip, the glove back on the handle.
const WORK = { take: 2.6, taken: 3.2, first: 5.8, bolt: 4.6, move: 1.3, stowed: 19.2, released: 19.8, end: 22 };

// `figure` is the built Z1 figure (its `asset`, `surfaces`, `skins`), `hatch` Quest's EVA hatch and `worksite` the
// panel the rider works on ({ bolts, normal }), both in station coordinates. The returned group belongs under a part
// group drawn in station coordinates; update(delta, motion) follows `crewView` and says whether anything changed.
export function createRider(figure, crewView, hatch, worksite) {
    const asset = figure.asset, scale = asset.modelScale, count = asset.parents.length;
    const group = new THREE.Group(); group.name = 'Spacewalker on the Canadarm2 foot restraint'; group.visible = false; group.raycast = () => group.visible;
    // Two skeletons: one under no scene, where station coordinates are world coordinates and the pose is worked out,
    // and the drawn one, which copies it.
    const skeletonUnder = parent => {
        const bones = asset.parents.map((_, i) => { const bone = new THREE.Bone(); bone.name = 'riderJoint' + i; return bone; });
        bones.forEach((bone, i) => (asset.parents[i] < 0 ? parent : bones[asset.parents[i]]).add(bone));
        return bones;
    };
    const rigUnder = parent => { const rig = new THREE.Group(); rig.scale.setScalar(scale); rig.position.fromArray(asset.rootPivot).multiplyScalar(-scale); parent.add(rig); return rig; };
    const body = new THREE.Group(), B = skeletonUnder(rigUnder(body));
    const actor = new THREE.Group(), rig = rigUnder(actor), bones = skeletonUnder(rig); actor.name = 'Spacewalker'; actor.userData.astronaut = true; group.add(actor);
    // The posture everything starts from: the first frame of the model's own floating loop.
    const clip = asset.animation, base = { q: decode(clip.rotations.values).slice(0, count * 4), p: decode(clip.translations.values).slice(0, count * 3), s: decode(clip.scales.values).slice(0, count * 3) };
    for (const set of [B, bones]) set.forEach((bone, i) => { bone.position.fromArray(base.p, i * 3); bone.quaternion.fromArray(base.q, i * 4); bone.scale.fromArray(base.s, i * 3); });
    B[0].position.fromArray(asset.rootPivot); bones[0].position.fromArray(asset.rootPivot);
    const restRotations = (rest => B.map((_, i) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().fromArray(rest, i * 16))))(decode(asset.rest));
    const bind = decode(asset.bind), skeleton = new THREE.Skeleton(bones, bones.map((_, i) => new THREE.Matrix4().fromArray(bind, i * 16).invert()));
    const surfaces = figure.surfaces.map(surface => surface.clone());
    const skins = figure.skins.map((source, i) => {
        const mesh = new THREE.SkinnedMesh(source.geometry, surfaces[asset.meshes[i].material]); mesh.name = 'Rider / ' + asset.meshes[i].name;
        rig.add(mesh); mesh.bind(skeleton, new THREE.Matrix4()); mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = true;
        mesh.computeBoundingBox(); mesh.boundingBox.expandByScalar(30); mesh.computeBoundingSphere(); mesh.boundingSphere.radius += 30;
        return mesh;
    });
    const solid = (color, roughness, metalness) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const metal = solid(0xb9c1bc, .49, .46), dark = solid(0x36433e, .73, .18), ivory = solid(0xe2e6df, .76, .08), gold = solid(0xd0b16b, .66, .22);
    const piece = (parent, geometry, surface, p = [0, 0, 0]) => { const mesh = new THREE.Mesh(geometry, surface); mesh.position.fromArray(p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; };
    // The pistol grip tool of the Z1 figure: the handle's centre at the origin, the bit along +z.
    const tool = new THREE.Group(); tool.name = 'Rider pistol grip tool'; group.add(tool);
    piece(tool, new THREE.BoxGeometry(.09, .09, .16), ivory, [0, .093, .05]); piece(tool, new THREE.BoxGeometry(.056, .14, .065), dark);
    piece(tool, new THREE.CylinderGeometry(.026, .032, .12, 20).rotateX(Math.PI / 2), metal, [0, .093, .18]);
    const bit = piece(tool, new THREE.CylinderGeometry(.010, .010, .10, 8).rotateX(Math.PI / 2), dark, [0, .093, .27]);
    piece(bit, new THREE.BoxGeometry(.004, .022, .09), metal);   // a flat on the bit, so its turning shows
    piece(tool, new THREE.BoxGeometry(.043, .015, .08), gold, [0, .145, .025]);
    // The hatch stands open while the rider goes through: a dark opening under the lid.
    const opening = new THREE.Mesh(new THREE.CircleGeometry(hatch.radius - .03, 40), new THREE.MeshBasicMaterial({ color: 0x06090b, side: THREE.DoubleSide }));
    opening.name = 'Quest EVA hatch, open'; opening.userData.interior = true; opening.visible = false; opening.rotation.x = Math.PI / 2;
    opening.position.fromArray(hatch.center).addScaledVector(new THREE.Vector3(...hatch.normal), .086); group.add(opening);

    const mount = new THREE.Object3D(); mount.position.fromArray(STOW); body.add(mount);
    const leftGrip = new THREE.Vector3(...asset.rightGrip), rightGrip = new THREE.Vector3(...RIGHT_GRIP);   // the asset's field names the +X arm
    // Glove rotations in the body's frame. On an upright bar the hand points ahead, thumb up (as on the Z1 rails and
    // the tool's grip); on the handle, a bar across the body, the palms are down and the knuckles tipped toward it.
    const ahead = grip => new THREE.Quaternion().setFromUnitVectors(grip.clone().normalize(), Z);
    const leftUpright = new THREE.Quaternion().setFromAxisAngle(Z, -Math.PI / 2).multiply(ahead(leftGrip));
    const tune = { leftRoll: 0, rightRoll: 0, tip: .6, pole: [.70, -.55, -.18], knee: [0, .1, 1], stow: [Math.PI / 2, 0, 0], footPitch: 0, lift: .06 };
    const onBar = (grip, roll) => new THREE.Quaternion().setFromAxisAngle(X, tune.tip).multiply(new THREE.Quaternion().setFromAxisAngle(Z, roll)).multiply(ahead(grip));
    const parentRotation = new THREE.Quaternion(), bodyRotation = new THREE.Quaternion(), turned = new THREE.Quaternion(), axis = new THREE.Vector3();
    const point = (bone, local) => bone.localToWorld(local ? local.clone() : new THREE.Vector3());
    function turnBone(bone, from, to) {
        const delta = new THREE.Quaternion().setFromUnitVectors(from.normalize(), to.normalize()), current = bone.getWorldQuaternion(new THREE.Quaternion());
        bone.parent.getWorldQuaternion(parentRotation);
        bone.quaternion.copy(parentRotation.invert().multiply(delta.multiply(current))).normalize(); bone.updateWorldMatrix(false, true);
    }
    // Turns a bone about an axis of the body's frame.
    function bend(bone, around, angle) {
        if (!angle) return;
        const current = bone.getWorldQuaternion(new THREE.Quaternion()); bone.parent.getWorldQuaternion(parentRotation);
        bone.quaternion.copy(parentRotation.invert().multiply(turned.setFromAxisAngle(axis.copy(around).applyQuaternion(bodyRotation), angle).multiply(current))).normalize();
        bone.updateWorldMatrix(false, true);
    }
    // Two-bone reach, in station coordinates: the last bone takes `rotation` and its point `local` (rig units) goes
    // to `target`; the middle joint bows toward `pole`. Returns how far the limb is stretched, of its length.
    function reach(chain, local, target, rotation, pole, most = ARM_REACH) {
        const end = target.clone().sub(local.clone().multiplyScalar(scale).applyQuaternion(rotation));
        const root = point(B[chain[0]]), middle = point(B[chain[1]]), upper = root.distanceTo(middle), lower = middle.distanceTo(point(B[chain[2]]));
        const direction = end.clone().sub(root), distance = clamp(direction.length(), Math.abs(upper - lower) + .003, (upper + lower) * most);
        direction.normalize();
        const bow = pole.clone().addScaledVector(direction, -pole.dot(direction)).normalize();
        const along = (upper * upper - lower * lower + distance * distance) / (2 * distance), height = Math.sqrt(Math.max(0, upper * upper - along * along));
        turnBone(B[chain[0]], middle.sub(root), direction.clone().multiplyScalar(along).addScaledVector(bow, height));
        const joint = point(B[chain[1]]);
        turnBone(B[chain[1]], point(B[chain[2]]).sub(joint), root.addScaledVector(direction, distance).sub(joint));
        const last = B[chain[2]]; last.parent.getWorldQuaternion(parentRotation);
        last.quaternion.copy(parentRotation.invert().multiply(rotation)); last.updateWorldMatrix(false, true);
        return distance / (upper + lower);
    }
    const fingerAxis = new THREE.Vector3(0, 0, -1), curl = new THREE.Quaternion();
    function closeGlove(fingers, thumb, amount) {
        for (const chain of fingers) chain.forEach((index, joint) => B[index].quaternion.copy(restRotations[index]).multiply(curl.setFromAxisAngle(fingerAxis, [1.02, 1.14, .22][joint] * amount)));
        thumb.forEach((index, joint) => B[index].quaternion.copy(restRotations[index]).multiply(curl.setFromAxisAngle(fingerAxis, [.48, .55, .18][joint] * amount)));
    }
    // The feet take the turn of the model's standing pose, soles square to the legs (the floating loop lets them hang).
    body.updateWorldMatrix(true, true);
    const footTurn = [LEFT_LEG, RIGHT_LEG].map(chain => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().fromArray(bind, chain[2] * 16)));

    const seat = new THREE.Matrix4(), seatRotation = new THREE.Quaternion(), fromSeat = new THREE.Matrix4(), scratch = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    const inSeat = p => new THREE.Vector3(...p).applyMatrix4(seat), inBody = p => new THREE.Vector3(...p).applyMatrix4(body.matrixWorld);
    const direction = p => new THREE.Vector3(...p).applyQuaternion(bodyRotation);
    const bolts = worksite.bolts.map(p => new THREE.Vector3(...p)), outward = new THREE.Vector3(...worksite.normal).normalize();
    const toolAt = new THREE.Vector3(), toolTurn = new THREE.Quaternion(), stowAt = new THREE.Vector3(), stowTurn = new THREE.Quaternion(), workTurn = new THREE.Quaternion();
    let spin = 0, last = '';
    const state = { stretch: [0, 0], legs: [0, 0], phase: '' };
    // Poses the working skeleton: the act ('board', 'work', 'alight' or '' for the ride) at `u` of its length.
    function pose(act, u) {
        B.forEach((bone, i) => bone.quaternion.fromArray(base.q, i * 4));
        seat.decompose(scratch, seatRotation, one);
        // Where the hips are, and how the body is turned, in the seat's frame. Through the hatch (`out` 0…1) the body
        // slides head first along the hatch axis, belly toward the restraint; then it pitches about the handle
        // (`over` 0…1) until it lies along the restraint, the handle slipping SLIP down and in to its place.
        const way = act === 'board' ? u : act === 'alight' ? 1 - u : 1;
        const out = ramp(way, 0, .47), over = ramp(way, .46, .86), down = ramp(way, .84, 1), pitch = Math.PI / 2 * (1 - over);
        const above = HANDLE[1] + SLIP * (1 - over), before = HANDLE[2] + SLIP * (1 - over), cos = Math.cos(pitch), sin = Math.sin(pitch);
        const depth = scratch.fromArray(hatch.center).applyMatrix4(fromSeat.copy(seat).invert()).z - INSIDE;
        const z = HANDLE[2] - above * sin - before * cos;
        body.position.set(0, HANDLE[1] - above * cos + before * sin, z - (1 - out) * (HANDLE[2] - HANDLE[1] - SLIP - depth)).applyMatrix4(seat);
        body.quaternion.copy(seatRotation).multiply(turned.setFromAxisAngle(X, pitch));
        body.updateWorldMatrix(true, true); bodyRotation.copy(body.quaternion);
        // Legs: nearly straight through the hatch, drawn up and back a little while the body comes round, then down and
        // forward onto the plate, the toes under the bar.
        const tuck = tune.lift * ramp(way, .44, .58) * (1 - down), apart = lerp(.10, ANKLE[0], over), pole = direction(tune.knee);
        [LEFT_LEG, RIGHT_LEG].forEach((chain, k) => {
            const side = k ? -1 : 1, turn = bodyRotation.clone().multiply(footTurn[k]);
            if (tune.footPitch) turn.premultiply(turned.setFromAxisAngle(direction([1, 0, 0]), tune.footPitch));
            state.legs[k] = reach(chain, new THREE.Vector3(), inBody([side * apart, ANKLE[1] + tuck, ANKLE[2] - tuck * .8]), turn, pole, LEG_REACH);
        });
        bend(B[WAIST], X, .05 * over);
        // The tool: on the hip, in the left glove from `taken` to `stowed`, at the bolts in between.
        mount.getWorldPosition(stowAt); stowTurn.copy(bodyRotation).multiply(turned.setFromEuler(new THREE.Euler(...tune.stow)));
        const t = act === 'work' ? u * WORK.end : -1, held = t >= WORK.taken && t < WORK.stowed;
        // At the panel the bit points into it, the grip toward the rider's feet.
        workTurn.copy(turned.setFromUnitVectors(direction([0, 0, 1]), outward.clone().negate())).multiply(bodyRotation);
        const tipLocal = new THREE.Vector3(...TOOL_TIP), standoff = k => bolts[k].clone().addScaledVector(outward, .07);
        let running = false;
        if (!held) { toolAt.copy(stowAt); toolTurn.copy(stowTurn); }
        else {
            const first = WORK.first, second = first + WORK.bolt + WORK.move, away = second + WORK.bolt, tip = new THREE.Vector3();
            const drive = (k, w) => {   // seat the socket (0.9 s), drive (2.2 s), back off (1.1 s)
                tip.lerpVectors(standoff(k), bolts[k], w < 2 ? ramp(w, 0, .9) : 1 - ramp(w, 3.5, WORK.bolt));
                running = w >= 1.1 && w < 3.3;
            };
            if (t < first) {
                const s = ramp(t, WORK.taken, first);
                toolTurn.copy(stowTurn).slerp(workTurn, s);
                tip.copy(stowAt).add(tipLocal.clone().applyQuaternion(toolTurn)).lerp(standoff(0), s).add(direction([.03, -.04, .05]).multiplyScalar(Math.sin(Math.PI * s)));
            } else if (t < first + WORK.bolt) { toolTurn.copy(workTurn); drive(0, t - first); }
            else if (t < second) { toolTurn.copy(workTurn); tip.lerpVectors(standoff(0), standoff(1), ramp(t, first + WORK.bolt, second)); }
            else if (t < away) { toolTurn.copy(workTurn); drive(1, t - second); }
            else {
                const s = ramp(t, away, WORK.stowed);
                toolTurn.copy(workTurn).slerp(stowTurn, s);
                tip.copy(standoff(1)).lerp(stowAt.clone().add(tipLocal.clone().applyQuaternion(toolTurn)), s).add(direction([.03, -.04, .05]).multiplyScalar(Math.sin(Math.PI * s)));
            }
            toolAt.copy(tip).sub(tipLocal.applyQuaternion(toolTurn));
        }
        // Gloves. The right one holds the handle from the moment it comes within reach; so does the left one, but
        // for the work. Before the handle is within reach both wait above the chest, open.
        const elbow = side => direction([side * tune.pole[0], tune.pole[1], tune.pole[2]]);
        const onHandle = side => {
            const at = inSeat([side * GLOVE_X, HANDLE[1], HANDLE[2]]).applyMatrix4(fromSeat.copy(body.matrixWorld).invert());
            const near = WAIT_Y - at.y;   // how far the handle has come below the waiting height
            if (near < .04) at.y = WAIT_Y - .04 * Math.exp(near / .04 - 1);   // eased, so the glove does not start with a jerk
            return { at: at.applyMatrix4(body.matrixWorld), grip: lerp(.25, 1, ramp(near, .02, .14)) };
        };
        const right = onHandle(-1);
        closeGlove(RIGHT_FINGERS, RIGHT_THUMB, right.grip);
        state.stretch[1] = reach(RIGHT_ARM, rightGrip, right.at, bodyRotation.clone().multiply(onBar(rightGrip, tune.rightRoll)), elbow(-1));
        const left = onHandle(1), barTurn = bodyRotation.clone().multiply(onBar(leftGrip, tune.leftRoll));
        if (t >= 0) {
            // Off the handle to the stowed tool, with it to the panel and back, then to the handle again.
            const going = ramp(t, 0, WORK.take), back = ramp(t, WORK.released, WORK.end), with_ = going * (1 - back);
            const swing = direction([.05, .03, .06]).multiplyScalar(Math.sin(Math.PI * (t < WORK.taken ? going : back)));
            left.at.lerp(toolAt, with_).add(swing);
            barTurn.slerp(toolTurn.clone().multiply(leftUpright), with_);
            // Open on the way, closed on the tool and on the handle.
            left.grip = t < WORK.taken ? Math.max(1 - .85 * ramp(t, 0, .8), ramp(t, WORK.take, WORK.taken))
                : t < WORK.stowed ? 1 : Math.max(1 - .85 * ramp(t, WORK.stowed, WORK.released), ramp(t, WORK.end - .7, WORK.end));
        }
        closeGlove(LEFT_FINGERS, LEFT_THUMB, left.grip);
        state.stretch[0] = reach(LEFT_ARM, leftGrip, left.at, barTurn, elbow(1));
        if (held) { toolAt.copy(point(B[LEFT_ARM[2]], leftGrip)); toolTurn.copy(B[LEFT_ARM[2]].getWorldQuaternion(new THREE.Quaternion())).multiply(leftUpright.clone().invert()); }
        state.phase = act === 'work' ? (running ? 'drive' : held ? 'tool' : 'reach') : act ? (way < .46 ? 'hatch' : way < .86 ? 'turn' : 'settle') : 'ride';
        state.running = running;
        return state;
    }
    // Every frame. Hidden while the rider is inside; true when what is drawn changed.
    function update(delta, motion = true) {
        const act = crewView.act, shown = crewView.on === 'tip' || act === 'board';
        const key = shown ? act + '|' + crewView.u.toFixed(5) + '|' + crewView.at.map(value => value.toFixed(4)).join() : '';
        if (key === last) return false;
        last = key; group.visible = shown; opening.visible = shown && (act === 'board' || act === 'alight');
        if (!shown) return true;
        seat.fromArray(crewView.at);
        const now = pose(act, crewView.u);
        if (now.running && motion) spin += delta * 9;
        actor.position.copy(body.position); actor.quaternion.copy(body.quaternion);
        for (let i = 0; i < count; i++) bones[i].quaternion.copy(B[i].quaternion);
        tool.position.copy(toolAt); tool.quaternion.copy(toolTurn); bit.rotation.z = spin;
        return true;
    }
    return { group, actor, skins, surfaces, tool, opening, update, state, tune, probe: { B, body, pose, seat, point, mount, toolAt, toolTurn } };
}
