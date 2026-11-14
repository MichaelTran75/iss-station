// EVA crew member, lead or helper: the complete motion model (skeleton, the way out of Quest along the handrails and
// back, hand-over-hand climb at Z1, waist tether, pistol grip tool, tether spans), with no meshes. The page imports it directly as a fallback; js/sim/worker.js runs it off the main
// thread. step(time, out) writes one pose into a Float32Array laid out by evaLayout(); the page only copies it.
// Everything is computed in Z1's EVA frame, which is authored in station metres.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { createEvaRoute, createEvaTimeline, evaPath } from './eva-route.js?v=e4bd1faa9e';
export { evaBars, evaPath } from './eva-route.js?v=e4bd1faa9e';

const decode = (encoded, ArrayType) => new ArrayType(Uint8Array.from(atob(encoded), ch => ch.charCodeAt(0)).buffer);

// Tube rings: segments + 1 rings of 7 vertices (6 radial segments, the seam vertex repeated), as THREE.TubeGeometry.
export const evaTubes = { tetherSpan: { count: 48, radius: .006 }, waistStrap: { count: 32, radius: .0075 }, toolTether: { count: 24, radius: .0028 } };
export const evaPhases = ['climb', 'tether', 'tool', 'drive', 'stow', 'untether', 'descend', 'egress', 'ingress', 'inside', 'assist'];

export function evaLayout(boneCount) {
    // Header: time, phase, drilling, bit angle, tool tether shown, this crew holds the tool, crew outside the airlock,
    // share of the safety tether laid on the rails, then the position and rotation of the crew's own frame.
    const layout = { header: 0, frame: 8, actor: 16, tool: 23, hook: 30, bones: 37 };
    let offset = layout.bones + boneCount * 10;
    layout.tubes = {};
    for (const [name, { count }] of Object.entries(evaTubes)) {
        const floats = (count + 1) * 7 * 3;
        layout.tubes[name] = { positions: offset, normals: offset + floats, floats };
        offset += floats * 2;
    }
    layout.size = offset;
    return layout;
}

// Scene constants shared by the page (which draws them) and the simulation (which moves around them).
export const evaScene = {
    railX: -1.43, railZ: 10.60, holds: [[3.88, 4.24], [4.42, 4.80], [5.00, 5.40]],
    bolts: [[.095, .12], [-.095, -.12], [-.095, .12], [.095, -.12]].map(([x, y]) => [-1.16 + x, 5.42 + y, 10.630]),
    toolTipLocal: [0, .093, .32],
    fairlead: [-1.43, 3.97, 10.645],
    // Bone-local suit hardware (model units): D-rings on the waist bone, reel on the left extender, tool mount on the chest.
    leftRing: [26.5, -5.4, 8.0], rightRing: [-26.5, -5.4, 8.0], reel: [37.5, -15.3, 5.6], reelExit: [.004, -.066, .028],
    toolMount: [15.0, -18.2, 29.1], hookStow: [0, -.075, .02],
    timings: { climb: 9.8, tether: 13.6, tool: 16.4, bolt: 6.5, workCycle: 28, turnaround: 45.7, period: 62.1 },
    // Where the helper holds the tool out for the lead: handle centre, between the two crew at chest height.
    handoff: [-.90, 5.12, 10.24], climbStart: 3.80,
    hatch: { center: [7.37, -1.12, 12], radius: .73, normal: [0, -1, 0] }   // Quest's EVA hatch (js/parts/quest.js)
};

// Both crew's paths from the airlock to the worksite and the clock they share (js/sim/eva-route.js).
export function createEvaRoutes() {
    const S = evaScene, task = offset => ({ anchor: [S.railX, S.climbStart, S.railZ], offset, grips: [[S.railX, 4.02, S.railZ], [S.railX, 4.50, S.railZ]], fairlead: S.fairlead });
    const lead = createEvaRoute('lead', task([0, 0, 0])), helper = createEvaRoute('helper', task(evaPath.helperOffset));
    return { lead, helper, timeline: createEvaTimeline({ lead: lead.length, helper: helper.length }, S.timings.period) };
}

// role 'lead' drives the bolts; role 'helper' goes out first, carries the tool and holds it out for the lead.
export function createEvaSimulation(asset, role = 'lead', routes = createEvaRoutes()) {
    const S = evaScene, helper = role === 'helper', route = routes[role], timeline = routes.timeline;
    const offset = helper ? evaPath.helperOffset : [0, 0, 0];
    const frame = new THREE.Group();
    const actor = new THREE.Group(); frame.add(actor);
    const rig = new THREE.Group(); rig.scale.setScalar(asset.modelScale);
    rig.position.fromArray(asset.rootPivot).multiplyScalar(-asset.modelScale); actor.add(rig);
    const rest = decode(asset.rest, Float32Array);
    const bones = asset.parents.map((parent, i) => {
        const bone = new THREE.Bone(); bone.name = 'evaJoint' + i;
        new THREE.Matrix4().fromArray(rest, i * 16).decompose(bone.position, bone.quaternion, bone.scale); return bone;
    });
    bones.forEach((bone, i) => (asset.parents[i] < 0 ? rig : bones[asset.parents[i]]).add(bone));
    const tracks = [];
    for (const [channel, definition] of Object.entries(asset.animation)) {
        const times = decode(definition.times, Float32Array), packed = decode(definition.values, Float32Array);
        for (let joint = 0; joint < bones.length; joint++) {
            const values = [];
            for (let sample = 0; sample < times.length; sample++) for (let axis = 0; axis < definition.size; axis++) values.push(packed[(sample * bones.length + joint) * definition.size + axis]);
            const name = bones[joint].name + '.' + ({rotations: 'quaternion', translations: 'position', scales: 'scale'}[channel]);
            tracks.push(channel === 'rotations' ? new THREE.QuaternionKeyframeTrack(name, times, values) : new THREE.VectorKeyframeTrack(name, times, values));
        }
    }
    const clip = new THREE.AnimationClip('Supplied floating loop', asset.duration, tracks);
    const mixer = new THREE.AnimationMixer(rig); mixer.clipAction(clip).play(); mixer.setTime(0);
    const calmJoints = [0, 1, 2, 3, 4, 36, 38];
    const calmPose = calmJoints.map(i => bones[i].quaternion.clone());
    const restRotations = bones.map((_, i) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().fromArray(rest, i * 16)));
    const layout = evaLayout(bones.length);

    const smooth = value => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
    const ramp = (t, start, end) => smooth((t - start) / (end - start));
    // Monotone cubic through keys, so no segment overshoots its neighbours.
    function monotone(times, values, t) {
        if (t <= times[0]) return values[0];
        const last = times.length - 1; if (t >= times[last]) return values[last];
        let i = 0; while (t > times[i + 1]) i++;
        const slope = k => (values[k + 1] - values[k]) / (times[k + 1] - times[k]);
        const tangent = k => {
            if (k === 0 || k === last) return 0;
            const a = slope(k - 1), b = slope(k); return a * b <= 0 ? 0 : 2 * a * b / (a + b);
        };
        const h = times[i + 1] - times[i], s = (t - times[i]) / h, s2 = s * s, s3 = s2 * s;
        return (2 * s3 - 3 * s2 + 1) * values[i] + (s3 - 2 * s2 + s) * h * tangent(i) + (-2 * s3 + 3 * s2) * values[i + 1] + (s3 - s2) * h * tangent(i + 1);
    }
    const bolts = S.bolts.map(p => new THREE.Vector3(...p));
    const toolTipLocal = new THREE.Vector3(...S.toolTipLocal);
    const tool = new THREE.Object3D(); frame.add(tool);
    const railPoint = y => new THREE.Vector3(S.railX, y, S.railZ);
    const handoff = new THREE.Vector3(...S.handoff).sub(new THREE.Vector3(...offset));
    function onBone(bone, local) {
        const group = new THREE.Object3D(); group.position.fromArray(local); group.scale.setScalar(1 / asset.modelScale);
        bone.add(group); return group;
    }
    const rightRing = onBone(bones[2], S.rightRing);
    const reel = onBone(bones[2], S.reel);
    const reelExit = new THREE.Object3D(); reelExit.position.fromArray(S.reelExit); reel.add(reelExit);
    const toolMount = onBone(bones[3], S.toolMount);
    // Stowed, the tool hangs bit-down on the mini-workstation, grip toward the crew member.
    const stowRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.2, .3, 0));
    const waistHook = new THREE.Object3D(); frame.add(waistHook);
    const hookStow = new THREE.Object3D(); hookStow.position.fromArray(S.hookStow); rightRing.add(hookStow);
    // Clipped, the handhold bar runs through the hook loop.
    const hookClip = new THREE.Vector3(S.railX, 5.06, S.railZ - .012), hookClipRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    const tubes = Object.fromEntries(Object.entries(evaTubes).map(([name, { count, radius }]) => [name, { curve: new THREE.CubicBezierCurve3(...Array.from({length: 4}, (_, i) => new THREE.Vector3(0, i * .1, 0))), count, radius, slot: layout.tubes[name] }]));
    // Write a tube's rings into the pose buffer (the same parallel-transport frames TubeGeometry uses).
    function writeTube(tube, out) {
        const { curve, count, radius, slot } = tube; curve.updateArcLengths();
        const frames = curve.computeFrenetFrames(count, false), center = new THREE.Vector3(), normal = new THREE.Vector3();
        for (let segment = 0; segment <= count; segment++) {
            curve.getPointAt(segment / count, center);
            for (let side = 0; side <= 6; side++) {
                const a = side / 6 * Math.PI * 2;
                normal.copy(frames.normals[segment]).multiplyScalar(-Math.cos(a)).addScaledVector(frames.binormals[segment], Math.sin(a));
                const index = (segment * 7 + side) * 3;
                out[slot.positions + index] = center.x + normal.x * radius; out[slot.positions + index + 1] = center.y + normal.y * radius; out[slot.positions + index + 2] = center.z + normal.z * radius;
                out[slot.normals + index] = normal.x; out[slot.normals + index + 1] = normal.y; out[slot.normals + index + 2] = normal.z;
            }
        }
    }
    // Source anatomy: +X arm 5/6/7 is LEFT; -X arm 39/40/41 is RIGHT.
    // The legacy asset field rightGrip names the +X arm; keep asset bytes intact.
    const leftGripLocal = new THREE.Vector3(...asset.rightGrip);
    const rightGripLocal = new THREE.Vector3(14.1289751, .3173805, -.0742860);
    const rightHand = bones[41], leftHand = bones[7];
    const axisX = new THREE.Vector3(1, 0, 0), axisY = new THREE.Vector3(0, 1, 0), axisZ = new THREE.Vector3(0, 0, 1), parentRotation = new THREE.Quaternion();
    const worldPoint = (bone, point = new THREE.Vector3()) => bone.localToWorld(point.clone());
    // Rail and pistol grips are both upright bars: the hand points at the face, thumb up.
    const rightOrientation = new THREE.Quaternion().setFromAxisAngle(axisZ, Math.PI / 2)
        .multiply(new THREE.Quaternion().setFromUnitVectors(rightGripLocal.clone().normalize(), axisZ));
    const leftOrientation = new THREE.Quaternion().setFromAxisAngle(axisZ, -Math.PI / 2)
        .multiply(new THREE.Quaternion().setFromUnitVectors(leftGripLocal.clone().normalize(), axisZ));
    const rightDown = new THREE.Quaternion().setFromAxisAngle(axisX, Math.PI / 2).multiply(rightOrientation);
    // In the glove the hook sits just ahead of the fist, so pushing the fist to the bar seats the hook on it.
    const clipGrip = hookClip.clone().add(new THREE.Vector3(0, 0, -.055));
    const hookInGlove = hookClip.clone().sub(clipGrip).applyQuaternion(rightOrientation.clone().invert());
    const hookInGloveRotation = rightOrientation.clone().invert().multiply(hookClipRotation);
    function turnBone(bone, from, to) {
        const delta = new THREE.Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
        const current = bone.getWorldQuaternion(new THREE.Quaternion());
        bone.parent.getWorldQuaternion(parentRotation);
        bone.quaternion.copy(parentRotation.invert().multiply(delta.multiply(current))).normalize();
        bone.updateWorldMatrix(false, true);
    }
    const actorRotation = new THREE.Quaternion(), worldAxis = new THREE.Vector3(), turn = new THREE.Quaternion();
    // Rotate a bone about an axis given in the crew member's own frame (x left, y up, z forward).
    function bend(bone, axis, angle) {
        if (!angle) return;
        worldAxis.copy(axis).applyQuaternion(actorRotation);
        const current = bone.getWorldQuaternion(new THREE.Quaternion());
        bone.parent.getWorldQuaternion(parentRotation);
        bone.quaternion.copy(parentRotation.invert().multiply(turn.setFromAxisAngle(worldAxis, angle).multiply(current))).normalize();
        bone.updateWorldMatrix(false, true);
    }
    function reachHand(chain, gripLocal, target, orientation, poleLocal) {
        const desired = frame.getWorldQuaternion(new THREE.Quaternion()).multiply(orientation);
        const wristTarget = target.clone().sub(gripLocal.clone().multiplyScalar(asset.modelScale).applyQuaternion(desired));
        const shoulder = worldPoint(bones[chain[0]]), elbow = worldPoint(bones[chain[1]]), wrist = worldPoint(bones[chain[2]]);
        const upper = shoulder.distanceTo(elbow), lower = elbow.distanceTo(wrist);
        const direction = wristTarget.clone().sub(shoulder);
        const distance = Math.min(upper + lower - .003, Math.max(Math.abs(upper - lower) + .003, direction.length()));
        direction.normalize();
        const pole = new THREE.Vector3(...poleLocal).transformDirection(frame.matrixWorld);
        pole.addScaledVector(direction, -pole.dot(direction)).normalize();
        const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
        const height = Math.sqrt(Math.max(0, upper * upper - along * along));
        const elbowTarget = shoulder.clone().addScaledVector(direction, along).addScaledVector(pole, height);
        turnBone(bones[chain[0]], elbow.clone().sub(shoulder), elbowTarget.sub(shoulder));
        const elbowNow = worldPoint(bones[chain[1]]), wristNow = worldPoint(bones[chain[2]]);
        turnBone(bones[chain[1]], wristNow.sub(elbowNow), wristTarget.sub(elbowNow));
        const hand = bones[chain[2]]; hand.parent.getWorldQuaternion(parentRotation);
        hand.quaternion.copy(parentRotation.invert().multiply(desired)); hand.updateWorldMatrix(false, true);
    }
    const fingerAxis = new THREE.Vector3(0, 0, -1);
    function closeGlove(chains, thumb, amount) {
        for (const chain of chains) chain.forEach((index, joint) => {
            const rotation = restRotations[index].clone().multiply(new THREE.Quaternion().setFromAxisAngle(fingerAxis, [1.02, 1.14, .22][joint]));
            bones[index].quaternion.slerp(rotation, amount);
        });
        // The thumb opposes the fingers without crushing the palm.
        thumb.forEach((index, joint) => {
            const rotation = restRotations[index].clone().multiply(new THREE.Quaternion().setFromAxisAngle(fingerAxis, [.48, .55, .18][joint]));
            bones[index].quaternion.slerp(rotation, amount);
        });
    }
    // Timeline after NASA EVA practice: translate hand over hand (one hand always on a rail), stop and clip the
    // waist tether to the worksite handhold, take the pistol grip tool from the mini-workstation, then drive the
    // panel bolts in a cross pattern and read back the torque. Motions stay slow: no quick grabs, kicks or swings
    // against the tethers. Then the way back, each step the reverse of the way in: the tool returned to the
    // mini-workstation, the waist tether unclipped and stowed on its D-ring, and hand over hand down the rail to
    // where the crew member started, so the task loops without a jump (62 s).
    const timings = S.timings;
    // The left glove closes on the tool at 14.5 s; the tool then comes off the mini-workstation to the first bolt in
    // 1.9 s, which keeps the glove under 0.65 m/s.
    const toolTaken = 14.5;
    // Task time for a moment of the loop: forward to the turnaround (one cycle of four bolts and the reading, then
    // the tool back at the first bolt's standoff, where it was when it arrived), then back down the same timeline.
    // The lead's clock runs only at the worksite; on the way out and back it rests at 0, the start of the climb.
    function leadClock(time) {
        const where = timeline.at('lead', time), t = where.mode === 'task' ? where.local : 0;
        return t <= timings.turnaround ? t : Math.max(0, timings.tool - (t - timings.turnaround));
    }
    // The helper climbs the same way, takes the tool off the mini-workstation and holds it out, waits there
    // (plateau) while the lead works, and comes down the same timeline after the lead has left.
    const plateau = 19;
    function taskTime(time) {
        if (!helper) return leadClock(time);
        const where = timeline.at('helper', time);
        return where.mode === 'task' ? Math.min(where.local, timeline.stay.helper - where.local, plateau) : 0;
    }
    // The climb keeps the handhold line near the body's midline; at the worksite the body settles left of it,
    // so the right hand holds on its own side and the left hand works the panel without crossing the chest.
    const hipKeys = {
        t: [0, 2.3, 4.7, 7.2, 9.8, 11.4, 12.8, 14.6, 16.4],
        x: [-1.43, -1.42, -1.44, -1.41, -1.42, -1.40, -1.33, -1.31, -1.30],
        y: [3.80, 3.83, 4.15, 4.46, 4.76, 4.76, 4.76, 4.68, 4.58],
        z: [10.14, 10.15, 10.15, 10.14, 10.10, 10.08, 10.07, 10.03, 9.98]
    };
    const hipsAt = (t, out) => out.set(monotone(hipKeys.t, hipKeys.x, t), monotone(hipKeys.t, hipKeys.y, t), monotone(hipKeys.t, hipKeys.z, t));
    const frameRotation = () => frame.getWorldQuaternion(new THREE.Quaternion());
    const stowPose = (position, rotation) => {
        position.copy(frame.worldToLocal(toolMount.getWorldPosition(new THREE.Vector3())));
        return rotation.copy(frameRotation()).invert().multiply(actor.getWorldQuaternion(new THREE.Quaternion())).multiply(stowRotation);
    };
    const standoff = bolt => bolt.clone().add(new THREE.Vector3(0, 0, -.07));
    const identity = new THREE.Quaternion();
    // Tool pose in frame space. Returns the handle centre and rotation, the bit angle and the work phase.
    function toolPose(t, position, rotation) {
        const state = {spin: 0, running: false, reading: 0, torque: 0, phase: 'stowed', bolt: -1};
        if (helper) {   // off the mini-workstation and out to the hand-off point
            const s = ramp(t, 15.5, 18.2); stowPose(position, rotation);
            position.lerp(handoff, s).add(new THREE.Vector3(-.03, .04, -.06).multiplyScalar(Math.sin(Math.PI * s))); rotation.slerp(identity, s);
            return state;
        }
        if (t < toolTaken) { position.copy(handoff); rotation.identity(); return state; }
        const tip = new THREE.Vector3();
        if (t < timings.tool) {
            const s = ramp(t, toolTaken, timings.tool), from = handoff, fromRotation = identity;
            tip.copy(standoff(bolts[0])).sub(toolTipLocal);
            position.lerpVectors(from, tip, s).add(new THREE.Vector3(.02, .06, -.06).multiplyScalar(Math.sin(Math.PI * s)));
            rotation.copy(fromRotation).slerp(identity, s);
            state.phase = 'tool'; return state;
        }
        const work = t - timings.tool, cycle = Math.floor(work / timings.workCycle), w = work - cycle * timings.workCycle;
        const k = Math.min(3, Math.floor(w / timings.bolt)), u = w - k * timings.bolt;
        const previous = cycle === 0 && k === 0 ? bolts[0] : bolts[(k + 3) % 4];
        const target = bolts[k];
        let tilt = 0, roll = 0, reading = 0;
        if (w >= 4 * timings.bolt) {
            // Report torque and turns: the tool is tipped up toward the visor, then back.
            reading = ramp(w, 26.0, 26.5) * (1 - ramp(w, 27.3, 27.9));
            tip.copy(standoff(bolts[3])).add(new THREE.Vector3(0, -.03, -.05).multiplyScalar(reading)); tilt = .32 * reading;
        } else if (u < 1.3) {
            const s = smooth(u / 1.3);
            tip.lerpVectors(standoff(previous), standoff(target), s).add(new THREE.Vector3(0, .015, -.035).multiplyScalar(Math.sin(Math.PI * s)));
            tilt = .04 * Math.sin(Math.PI * s);
        } else if (u < 2.2) {
            tip.lerpVectors(standoff(target), target, smooth((u - 1.3) / .9));
        } else if (u < 5.2) {
            tip.copy(target);
            // Seat the socket with two small turns, then hold against the drive reaction.
            roll = u < 2.5 ? .05 * Math.sin((u - 2.2) / .3 * Math.PI * 4) * (1 - smooth((u - 2.2) / .3)) : -.025 * ramp(u, 2.5, 2.8) * (1 - ramp(u, 4.3, 4.7));
            state.running = u >= 2.5 && u < 4.5; state.torque = ramp(u, 2.5, 2.8) * (1 - ramp(u, 4.3, 4.7));
            if (u >= 4.5) reading = .35 * ramp(u, 4.5, 4.8) * (1 - ramp(u, 4.9, 5.2));
        } else tip.lerpVectors(target, standoff(target), smooth((u - 5.2) / 1.3));
        rotation.setFromEuler(new THREE.Euler(tilt, 0, roll));
        position.copy(tip).sub(toolTipLocal.clone().applyQuaternion(rotation));
        // Bit time: two seconds per bolt, accumulated only while the tool runs.
        const done = cycle * 4 + (w >= 4 * timings.bolt ? 4 : k + (u >= 4.5 ? 1 : 0));
        state.spin = done * 2 + (k < 4 && w < 4 * timings.bolt ? THREE.MathUtils.clamp(u - 2.5, 0, 2) * (u < 4.5 ? 1 : 0) : 0);
        state.reading = reading; state.phase = 'drive'; state.bolt = k;
        return state;
    }
    // Hand keys: [time, target, orientation, grip, swing, hold]. A target may follow the body; the swing bows
    // the path clear of the rail and the other hand; hold keeps the glove closed on what it carries.
    const leftKeys = [
        [0, railPoint(4.02), leftOrientation, 1], [.8, railPoint(4.02), leftOrientation, 1],
        [2.8, railPoint(4.66), leftOrientation, 1, [.06, 0, -.09]], [5.9, railPoint(4.66), leftOrientation, 1],
        [7.9, railPoint(5.32), leftOrientation, 1, [.06, 0, -.09]], [12.0, railPoint(5.32), leftOrientation, 1],
        [14.2, 'tool', 'tool', .15, [.05, -.04, -.12]], [toolTaken, 'tool', 'tool', 1]
    ];
    if (helper) leftKeys.length = 6;   // the helper's left hand stays on the top handhold
    const rightKeys = [
        [0, railPoint(4.50), rightOrientation, 1], [3.4, railPoint(4.50), rightOrientation, 1],
        [5.4, railPoint(5.08), rightOrientation, 1, [-.06, 0, -.09]], [8.4, railPoint(5.08), rightOrientation, 1],
        [10.5, 'hook', rightDown, .2, [-.08, .02, -.14]], [10.8, 'hook', rightDown, .85],
        [12.4, 'clip', rightOrientation, .85, [-.05, .04, -.12], true], [12.7, 'clip', rightOrientation, .85],
        [13.6, railPoint(5.18), rightOrientation, 1, [-.04, .02, -.07]]
    ];
    // The helper's right hand takes the tool by its body, from above, so the handle stays free for the lead.
    if (helper) rightKeys.push([14.0, railPoint(5.18), rightOrientation, 1], [15.2, 'body', 'body', .15, [-.05, -.04, -.12]], [15.5, 'body', 'body', .85]);
    const toolBody = new THREE.Vector3(0, .093, .15);
    const hookPoint = () => frame.worldToLocal(hookStow.getWorldPosition(new THREE.Vector3())).sub(hookInGlove.clone().applyQuaternion(rightDown));
    const resolve = (target, t, toolPosition) => target === 'tool' ? toolPosition.clone() : target === 'body' ? toolBody.clone().applyQuaternion(toolRotation).add(toolPosition) : target === 'hook' ? hookPoint() : target === 'clip' ? clipGrip.clone() : target.clone();
    function handAt(keys, t, toolPosition, toolOrientation) {
        let i = 0; while (i < keys.length - 1 && t >= keys[i + 1][0]) i++;
        const key = keys[i], next = keys[Math.min(i + 1, keys.length - 1)];
        const orient = value => value === 'tool' ? toolOrientation : value === 'body' ? toolRotation.clone().multiply(rightDown) : value;
        if (i === keys.length - 1 || next === key) return {point: resolve(key[1], t, toolPosition), orientation: orient(key[2]).clone(), grip: key[3]};
        const s = (t - key[0]) / (next[0] - key[0]), e = smooth(s);
        const point = resolve(key[1], t, toolPosition).lerp(resolve(next[1], t, toolPosition), e);
        if (next[4]) point.add(new THREE.Vector3(...next[4]).multiplyScalar(Math.sin(Math.PI * e)));
        const orientation = orient(key[2]).clone().slerp(orient(next[2]), e);
        const moving = key[1] !== next[1] || next[4];
        // Release fast, travel half open, close as the glove arrives.
        let grip = THREE.MathUtils.lerp(key[3], next[3], smooth((s - .7) / .3));
        if (moving && next[4] && !next[5]) grip = Math.min(grip, 1 - .78 * smooth(s / .16) * (1 - smooth((s - .74) / .26)));
        return {point, orientation, grip};
    }
    // Left elbow pole in frame space. On the rails it points out and back; at the panel the hand reaches up across
    // the chest, nearly opposite that hint (179.9° at 29.97 s), and the IK elbow flipped. So it turns, while the
    // hand goes to the tool (12.6–14.5 s), to out and below the forearm line, which stays 37° or more off the arm at the panel.
    const leftPoleRail = new THREE.Vector3(.70, -.55, -.18).normalize(), leftPoleWork = new THREE.Vector3(.54, -.59, .59).normalize();
    const leftPole = t => leftPoleRail.clone().lerp(leftPoleWork, helper ? 0 : ramp(t, 12.6, toolTaken)).normalize().toArray();
    const hips = new THREE.Vector3(), hipsBefore = new THREE.Vector3(), hipsAfter = new THREE.Vector3();
    const trailPoint = new THREE.Vector3(), jointPoint = new THREE.Vector3(), hipsLocal = new THREE.Vector3(), trailPosition = new THREE.Vector3(), trailRotation = new THREE.Quaternion();
    const legs = { thigh: .45, shin: .42, folded: 1.1 };   // metres, hip to knee and knee to ankle; knee angle with no path to follow
    const toolPosition = new THREE.Vector3(), toolRotation = new THREE.Quaternion();
    // Of the hips over the loop's own time (through the turnaround and the way back).
    const acceleration = (time, out) => {
        hipsAt(taskTime(time - .12), hipsBefore); hipsAt(taskTime(time + .12), hipsAfter); hipsAt(taskTime(time), out);
        return out.multiplyScalar(-2).add(hipsBefore).add(hipsAfter).divideScalar(.0144);
    };
    // Gaze leads the hands: the next handhold, the clip point, then the bolt; each change eases over 0.6 s.
    const gazeKeys = [[0, railPoint(4.66)], [3.2, railPoint(5.08)], [5.9, railPoint(5.32)], [8.6, hookClip], [13.4, bolts[0]]];
    function gazeAt(t, toolPosition) {
        const tip = toolPosition.clone().add(toolTipLocal);
        if (t >= timings.tool) return tip;
        let i = 0; while (i < gazeKeys.length - 1 && t >= gazeKeys[i + 1][0] - .6) i++;
        const [time, point] = gazeKeys[i];
        const previous = gazeKeys[Math.max(0, i - 1)][1];
        return previous.clone().lerp(point, i === 0 ? 1 : ramp(t, time - .6, time)).lerp(tip, ramp(t, toolTaken, timings.tool));
    }
    const writeTransform = (object, out, offset) => {
        object.position.toArray(out, offset); object.quaternion.toArray(out, offset + 3);
    };
    // A hand on the handrails at body arc s, in the frame's own space: on a grip, or lifted clear on the way to the next.
    const lift = { left: new THREE.Vector3(.06, 0, -.09), right: new THREE.Vector3(-.06, 0, -.09) };
    function routeHand(side, s) {
        const hand = route.hand(side, s, plan.rows && plan.follow ? handLead(s) : undefined), inverse = frame.quaternion.clone().invert();
        return { point: frame.worldToLocal(hand.point).addScaledVector(lift[side], hand.swing),
            orientation: inverse.multiply(hand.quaternion).multiply(side === 'left' ? leftOrientation : rightOrientation), grip: 1 - .78 * hand.swing };
    }
    // Leg angles along the route (per leg: sideways swing, thigh, shin), solved once every plan.step of rail and then
    // averaged over ±plan.reach. At a corner the place the legs trail to slides several times faster than the hips;
    // the average turns that flick into a swing of a few seconds. Angles here stay well inside ±π, so they average plainly.
    // A seventh column is the rail arc nearest the shoulders: the hands work around that place, so that on a tight
    // turn, where the body swings wide of the rail, the next handhold is still within reach.
    const plan = { step: .05, reach: .25, rows: null, row: null, lead: .56, shift: 0 };
    const mixed = bones.map(bone => bone.quaternion.clone());   // each joint as the mixer last left it
    const planned = (s, column) => {
        const x = THREE.MathUtils.clamp(s / plan.step, 0, plan.rows.length - 1.001), i = Math.floor(x);
        return THREE.MathUtils.lerp(plan.rows[i][column], plan.rows[i + 1][column], x - i);
    };
    // How far ahead of the hips the hands work at arc s; the plain lead again over the last metre, into the worksite.
    const handLead = s => THREE.MathUtils.lerp(planned(s, 6) - s + plan.shift, plan.lead,
        THREE.MathUtils.smoothstep(s, route.length - evaPath.settle, route.length));
    function step(time, out) {
        const where = timeline.at(role, time), task = where.mode === 'task';
        const t = taskTime(time), back = task && where.local > (helper ? timeline.stay.helper / 2 : timings.turnaround);
        const leadT = helper ? leadClock(time) : t;
        // Own frame: at the worksite it stands still; on the way it rides the handrails, and the body keeps the pose
        // the climb starts in, legs tucked (settled 0 → 1 over the last metre).
        if (task) { frame.position.fromArray(offset); frame.quaternion.identity(); } else route.frameAt(where.s, frame.position, frame.quaternion);
        frame.updateWorldMatrix(true, true);
        const settled = task ? 1 : smooth((where.s - (route.length - evaPath.settle)) / evaPath.settle), tuck = 1 - settled;
        // Base posture: the supplied loop slowed right down for the limbs, the torso held calm (on the clock, so it
        // never runs backward).
        // The mixer writes a joint only when its value changed since the last pose, so the joints first go back to
        // what it left there: a pose is then the same whatever was posed before it (a seek, the same time twice).
        bones.forEach((bone, i) => bone.quaternion.copy(mixed[i]));
        mixer.setTime(time * .22);
        bones.forEach((bone, i) => mixed[i].copy(bone.quaternion));
        calmJoints.forEach((index, i) => bones[index].quaternion.copy(calmPose[i].clone().slerp(bones[index].quaternion, .24)));
        bones[0].position.fromArray(asset.rootPivot);
        // Body: pulled up between grips, then settled at the worksite. Lean, roll and drift stay small,
        // and the body eases toward whichever bolt the tool is on.
        hipsAt(t, hips);
        const climbing = 1 - ramp(t, 9.4, 11.4), working = helper ? 0 : back ? ramp(t, 13.7, timings.tool) : ramp(t, toolTaken, timings.tool + 1.2);
        // Helper only: turned toward the lead while holding the tool out (offer), legs swung clear of the truss base
        // while low on the rail (low).
        const offer = helper ? ramp(t, 14.0, 18.2) : 0, low = helper ? settled * (1 - smooth((hips.y - 3.85) / .7)) : 0;
        const toolState = toolPose(t, toolPosition, toolRotation);
        const lagged = new THREE.Vector3(), lagRotation = new THREE.Quaternion();
        toolPose(taskTime(time - .45), lagged, lagRotation);
        const reach = lagged.sub(new THREE.Vector3(-1.16, 5.32, 10.31)).multiplyScalar(working);
        const sway = new THREE.Vector3(Math.sin(time * .29) * .012, Math.sin(time * .41 + 1) * .010, Math.sin(time * .23 + 2) * .008);
        actor.position.copy(hips).add(sway).add(new THREE.Vector3(reach.x * .2 - .10 * offer, reach.y * .25, 0));
        const pull = new THREE.Vector3(); acceleration(time, pull);
        // Roll eases toward the reaching hand; the drive reaction yaws the body slightly while the tool runs.
        const bump = (start, end) => { const s = THREE.MathUtils.clamp((t - start) / (end - start), 0, 1); return Math.sin(Math.PI * s) ** 2; };
        const side = bump(.8, 2.8) - bump(3.4, 5.4) + bump(5.9, 7.9);
        const reaction = .010 * toolState.torque;
        actor.rotation.set(-.03 - .03 * climbing - THREE.MathUtils.clamp(pull.y * .15, -.03, .03) + Math.sin(time * .32) * .008 + .2 * low,
            .07 + .025 * Math.sin(time * .27) + reaction - .03 * reach.x - .25 * offer,
            .06 + .025 * side * climbing + Math.sin(time * .35) * .008);
        actor.updateWorldMatrix(true, true); actor.getWorldQuaternion(actorRotation);
        // Waist bearing: a slight bend toward the face while pulling and while reaching for the bolts.
        bend(bones[1], axisX, .03 * climbing + .05 * working * ramp(reach.y, -.2, .2));
        // Pressurised legs stay nearly straight; they hang soft and lag the pulls, flexing a little more as the body is drawn up.
        const lagPull = new THREE.Vector3(); acceleration(time - .35, lagPull);
        const swing = THREE.MathUtils.clamp(lagPull.y * .35, -.08, .08);
        // En route each leg lies along the path the hips have just taken (knee, then ankle, on it), so the legs fold
        // round a corner the way the body did instead of sweeping through the structure behind it.
        const building = !plan.rows, follow = building ? 1 : tuck;
        if (follow > 0) frame.worldToLocal(bones[0].getWorldPosition(hipsLocal));
        // Sagittal angles in the body's own frame: 0 = straight down the body, positive = toward the back.
        let planar = 0;   // length of the last measured limb in the body's fore-and-aft plane
        const sagittal = (from, to) => {
            actor.worldToLocal(from.getWorldPosition(jointPoint)); actor.worldToLocal(to);
            planar = Math.hypot(jointPoint.z - to.z, jointPoint.y - to.y);
            return Math.atan2(jointPoint.z - to.z, jointPoint.y - to.y);
        };
        // A path that left sideways has no fore-and-aft angle to follow: the limb keeps its own pose there.
        const inPlane = limb => THREE.MathUtils.smoothstep(planar / limb, .3, .7);
        // The hips' place on the path behind them that lies one limb length from the joint. Stepping back by the
        // shortfall never passes the first such place (the hips cover at most a metre per metre of rail), so the
        // answer moves smoothly from frame to frame.
        let trailed = 0;
        const turnTo = angle => angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI));   // the short way round
        const trailing = (joint, back, limb) => {
            joint.getWorldPosition(jointPoint);
            for (let pass = 0; pass < 10; pass++) {
                route.frameAt(Math.max(0, where.s - back), trailPosition, trailRotation);
                const short = limb - trailPoint.copy(hipsLocal).applyQuaternion(trailRotation).add(trailPosition).distanceTo(jointPoint);
                if (short < .004 || back >= where.s) break;
                back = Math.min(where.s, back + short);
            }
            trailed = back;
            return sagittal(joint, trailPoint);
        };
        for (const [thigh, shin, foot, phaseOffset, flex, column] of [[77, 78, 79, 0, .07, 0], [83, 84, 85, 1.7, .12, 3]]) {
            bend(bones[thigh], axisX, -(flex + swing * .6 + .035 * Math.sin(time * .37 + phaseOffset)) + .25 * low);
            bend(bones[shin], axisX, .14 + flex * .5 + swing + .035 * Math.sin(time * .31 + phaseOffset * 1.3));
            bend(bones[foot], axisX, .12 + .03 * Math.sin(time * .43 + phaseOffset));
            if (follow > 0 && building) {
                let hip = trailing(bones[thigh], legs.thigh * .7, legs.thigh);
                const hipWeight = inPlane(legs.thigh);
                // Where the path came in from the side, both legs swing that way from the hip ring.
                const lateral = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp((trailPoint.x - jointPoint.x) / legs.thigh, -1, 1)), -.5, .5);
                bend(bones[thigh], axisZ, lateral);
                hip = THREE.MathUtils.clamp(hip, -1.2, .7);
                bend(bones[thigh], axisX, hipWeight * turnTo(hip - sagittal(bones[thigh], bones[shin].getWorldPosition(trailPoint))));
                hip = sagittal(bones[thigh], bones[shin].getWorldPosition(trailPoint));
                // The knee only folds backward; the cut of the angle sits opposite the middle of its range.
                // Where the path left sideways the shin folds back instead, feet lifted clear of what the body is passing.
                const fold = THREE.MathUtils.clamp(turnTo(trailing(bones[shin], trailed, legs.shin) - hip - .9) + .9, .08, 1.7);
                const knee = hip + THREE.MathUtils.lerp(legs.folded, fold, inPlane(legs.shin));
                bend(bones[shin], axisX, turnTo(knee - sagittal(bones[shin], bones[foot].getWorldPosition(trailPoint))));
                plan.row.push(lateral, hip, sagittal(bones[shin], bones[foot].getWorldPosition(trailPoint)));
            } else if (follow > 0) {
                const idle = .03 * Math.sin(time * .37 + phaseOffset);
                bend(bones[thigh], axisZ, follow * planned(where.s, column));
                bend(bones[thigh], axisX, follow * turnTo(planned(where.s, column + 1) - idle - sagittal(bones[thigh], bones[shin].getWorldPosition(trailPoint))));
                bend(bones[shin], axisX, follow * turnTo(planned(where.s, column + 2) + idle - sagittal(bones[shin], bones[foot].getWorldPosition(trailPoint))));
            }
        }
        // At the worksite the helper's port leg (the one beside the lead's way up the ramp) is drawn in toward the
        // other, so the lead's elbow passes clear of the boot on the way in and out.
        if (helper && !building) bend(bones[83], axisZ, .22 * settled);
        if (building) {
            bones[5].getWorldPosition(jointPoint).add(bones[39].getWorldPosition(trailPoint)).multiplyScalar(.5);
            plan.row.push(route.near(jointPoint, where.s)); return;
        }
        // The helmet is fixed to the hard upper torso, so gaze shows mostly through the body; the head turns a few
        // degrees toward the next handhold or the bolt.
        const gaze = gazeAt(t, toolPosition);
        const look = frame.localToWorld(gaze).sub(bones[37].getWorldPosition(new THREE.Vector3())).applyQuaternion(actorRotation.clone().invert());
        bend(bones[37], axisY, THREE.MathUtils.clamp(Math.atan2(look.x, look.z), -.5, .5) * .18);
        bend(bones[37], axisX, -THREE.MathUtils.clamp(Math.atan2(look.y, Math.hypot(look.x, look.z)), -.6, .6) * .16 - toolState.reading * .12);
        frame.updateWorldMatrix(true, true);
        if (helper || t < timings.tool) toolPose(t, toolPosition, toolRotation);
        const toolOrientation = toolRotation.clone().multiply(leftOrientation);
        const right = task ? handAt(rightKeys, t, toolPosition, toolOrientation) : routeHand('right', where.s);
        const left = task ? handAt(leftKeys, t, toolPosition, toolOrientation) : routeHand('left', where.s);
        if (helper && t >= 15.5) {   // once the lead has the tool, the right hand goes back to the rail
            const g = ramp(leadT, 14.6, 16.4), arc = Math.sin(Math.PI * g);
            right.point.lerp(railPoint(5.18), g).add(new THREE.Vector3(-.04, .02, -.07).multiplyScalar(arc));
            right.orientation.slerp(rightOrientation, g); right.grip = THREE.MathUtils.lerp(.85, 1, g) - .6 * arc;
        }
        closeGlove([[45,46,47],[48,49,50],[51,52,53],[54,55,56]], [42,43,44], right.grip);
        closeGlove([[11,12,13],[14,15,16],[17,18,19],[20,21,22]], [8,9,10], left.grip);
        reachHand([39,40,41], rightGripLocal, frame.localToWorld(right.point), right.orientation, [-.70, -.55, -.18]);
        reachHand([5,6,7], leftGripLocal, frame.localToWorld(left.point), left.orientation, leftPole(t));
        // The tool follows the glove once taken; before that it rides on the mini-workstation.
        if (!helper && t >= toolTaken) {
            tool.position.copy(frame.worldToLocal(worldPoint(leftHand, leftGripLocal)));
            tool.quaternion.copy(frameRotation().invert().multiply(leftHand.getWorldQuaternion(new THREE.Quaternion()))).multiply(leftOrientation.clone().invert());
        } else { tool.position.copy(toolPosition); tool.quaternion.copy(toolRotation); }
        tool.updateWorldMatrix(true, false);
        // Waist tether hook: stowed on the right D-ring, carried in the right glove, then clipped to the handhold.
        const stowed = frame.worldToLocal(hookStow.getWorldPosition(new THREE.Vector3()));
        const stowedRotation = frameRotation().invert().multiply(hookStow.getWorldQuaternion(new THREE.Quaternion()));
        const gloveRotation = frameRotation().invert().multiply(rightHand.getWorldQuaternion(new THREE.Quaternion()));
        const inGlove = frame.worldToLocal(worldPoint(rightHand, rightGripLocal)).add(hookInGlove.clone().applyQuaternion(gloveRotation));
        const taken = ramp(t, 10.5, 10.8), clipped = ramp(t, 12.4, 12.7);
        waistHook.position.copy(stowed).lerp(inGlove, taken).lerp(hookClip, clipped);
        waistHook.quaternion.copy(stowedRotation).slerp(gloveRotation.clone().multiply(hookInGloveRotation), taken).slerp(hookClipRotation, clipped);
        // Webbing: slack bows out to the right side, clear of the suit; stowed, it is a short loop beside the ring.
        const ringPoint = frame.worldToLocal(rightRing.getWorldPosition(new THREE.Vector3()));
        const hookEnd = waistHook.position.clone().add(new THREE.Vector3(-.042, 0, 0).applyQuaternion(waistHook.quaternion));
        const strapLength = THREE.MathUtils.lerp(.13, .75, taken), gap = ringPoint.distanceTo(hookEnd);
        const bow = Math.sqrt(Math.max(0, strapLength * strapLength - gap * gap)) * .55;
        const away = new THREE.Vector3(-.75, -.35, .45).applyQuaternion(actor.quaternion).normalize().multiplyScalar(bow);
        const strap = tubes.waistStrap.curve;
        strap.v0.copy(ringPoint); strap.v3.copy(hookEnd);
        strap.v1.lerpVectors(ringPoint, hookEnd, .3).add(away); strap.v2.lerpVectors(ringPoint, hookEnd, .7).add(away);
        writeTube(tubes.waistStrap, out);
        // Safety tether span: leaves the reel downward, enters the fairlead along the routed line, and bows a
        // little against the motion because the reel takes up slack with a delay.
        const exit = frame.worldToLocal(reelExit.getWorldPosition(new THREE.Vector3()));
        const exitDirection = new THREE.Vector3(0, -1, .25).applyQuaternion(frameRotation().invert().multiply(reel.getWorldQuaternion(new THREE.Quaternion()))).normalize();
        // The laid part ends a little behind the reel on the way, and at the fairlead once the crew is at the worksite.
        const share = route.tether.paid(where.s);
        const fairlead = frame.worldToLocal(route.tether.line.getPoint(share));
        const fairleadTangent = route.tether.line.getTangent(share).applyQuaternion(frame.quaternion.clone().invert());
        const span = exit.distanceTo(fairlead);
        const velocity = new THREE.Vector3(); hipsAt(taskTime(time + .2), velocity); velocity.sub(hipsAt(taskTime(time - .2), new THREE.Vector3())).divideScalar(.4);
        velocity.y += (timeline.at(role, time + .2).s - timeline.at(role, time - .2).s) / .4;
        const lag = velocity.multiplyScalar(-.22).clampLength(0, .06).add(new THREE.Vector3(.012 * Math.sin(time * .5), 0, -.015));
        const line = tubes.tetherSpan.curve;
        line.v0.copy(fairlead); line.v3.copy(exit);
        line.v1.copy(fairlead).addScaledVector(fairleadTangent, Math.min(.12, span * .1)).add(lag.clone().multiplyScalar(.6));
        line.v2.copy(exit).addScaledVector(exitDirection, Math.min(.18, span * .14)).add(lag);
        writeTube(tubes.tetherSpan, out);
        // Tool tether: retracts into the mini-workstation while the tool is stowed.
        const toolTetherVisible = helper ? t > 15.5 && leadT < toolTaken : task && t >= toolTaken;
        if (toolTetherVisible) {
            const mount = frame.worldToLocal(toolMount.getWorldPosition(new THREE.Vector3()));
            const butt = frame.worldToLocal(tool.localToWorld(new THREE.Vector3(0, -.075, -.02)));
            const cord = tubes.toolTether.curve;
            cord.v0.copy(mount); cord.v3.copy(butt);
            cord.v1.lerpVectors(mount, butt, .33).add(new THREE.Vector3(0, -.03, -.01));
            cord.v2.lerpVectors(mount, butt, .66).add(new THREE.Vector3(0, -.03, -.01));
            writeTube(tubes.toolTether, out);
        }
        out[0] = time;
        out[1] = evaPhases.indexOf(!task ? (where.mode === 'inside' ? 'inside' : where.t < timeline.arrive[role] ? 'egress' : 'ingress')
            : helper && (back ? t > timings.tether : t >= timings.tether) ? 'assist'
            : back ? (t > timings.tether ? 'stow' : t > timings.climb ? 'untether' : 'descend')
            : t < timings.climb ? 'climb' : t < timings.tether ? 'tether' : t < timings.tool ? 'tool' : 'drive');
        out[2] = toolState.running ? 1 : 0; out[3] = toolState.spin * 18; out[4] = toolTetherVisible ? 1 : 0;
        out[5] = !helper && task && t >= toolTaken ? 1 : 0; out[6] = where.mode === 'inside' ? 0 : 1; out[7] = share;
        writeTransform(frame, out, layout.frame);
        writeTransform(actor, out, layout.actor); writeTransform(tool, out, layout.tool); writeTransform(waistHook, out, layout.hook);
        for (let i = 0; i < bones.length; i++) {
            const offset = layout.bones + i * 10, bone = bones[i];
            bone.position.toArray(out, offset); bone.quaternion.toArray(out, offset + 3); bone.scale.toArray(out, offset + 7);
        }
        return out;
    }
    {
        const rows = [], count = Math.ceil(route.length / plan.step), reach = Math.round(plan.reach / plan.step);
        for (let i = 0; i <= count; i++) {
            let early = timeline.depart[role], late = timeline.arrive[role] - 1e-4;
            for (let pass = 0; pass < 24; pass++) { const middle = (early + late) / 2; if (timeline.at(role, middle).s < i * plan.step) early = middle; else late = middle; }
            plan.row = []; step(late, null); rows.push(plan.row);
        }
        // The hands never work backward along the rail; on straight rail they lead the hips by plan.lead.
        rows.forEach((row, i) => { if (i) row[6] = Math.max(row[6], rows[i - 1][6]); });
        const leads = rows.map((row, i) => row[6] - i * plan.step).sort((a, b) => a - b);
        plan.shift = plan.lead - leads[leads.length >> 1];
        plan.rows = rows.map((row, i) => row.map((_, column) => {
            let sum = 0, total = 0;
            for (let k = -reach; k <= reach; k++) { const weight = reach + 1 - Math.abs(k); sum += weight * rows[THREE.MathUtils.clamp(i + k, 0, count)][column]; total += weight; }
            return sum / total;
        }));
        plan.row = null;
    }
    return { layout, boneCount: bones.length, step };
}

// Both crew in one buffer: the lead's block, then the helper's.
export function createEvaPair(asset) {
    const routes = createEvaRoutes(), lead = createEvaSimulation(asset, 'lead', routes), helper = createEvaSimulation(asset, 'helper', routes);
    const block = lead.layout.size;
    return { layout: lead.layout, block, size: block * 2, boneCount: lead.boneCount,
        step(time, out) { lead.step(time, out.subarray(0, block)); helper.step(time, out.subarray(block, block * 2)); return out; } };
}
