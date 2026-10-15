// Falcon 9 with Crew Dragon for the Launch view: the first stage (interstage, grid fins, legs, nine Merlins) and the
// second stage (MVac) from Stanley Creative's model (data/falcon-9.json, made by falcon9.py), Crew Dragon from the
// station's own model, and the engine plumes. Metres; the rocket stands on +y with the bottom of its engines at 0.
import * as THREE from 'three';
import { pmaArray } from '../core/pma.js';
import { dragonHull } from '../parts/dragon.js';
import { createDracoPlumes } from '../parts/draco.js';
import { createInternals } from './internals.js';
import { creaseSegments } from '../ui/ghost.js';
import { clusterPlume, enginePlume } from '../sim/plume.js';
import { air, merlinSpool, spoolUp } from '../sim/ascent.js';

// Plumes, shaped each frame by the exhaust model (js/sim/plume.js) for the air the rocket is in: a hot core that
// stays bright for the core's length, then the afterburning flame dimming down its length; shock cells (bright bands
// one cell apart) where the jet leaves near the air's pressure; and toward the silhouette the glow fades (by how
// squarely each point faces the camera). Engines lit with TEA-TEB flash green for a moment.
const plumeVertex = `varying vec2 vUv; varying float vFacing;
    void main() {
        vUv = uv; vec4 view = modelViewMatrix * vec4(position, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-view.xyz)));
        gl_Position = projectionMatrix * view;
    }`;
const plumeFragment = `uniform vec3 hot; uniform vec3 warm; uniform vec3 cool; uniform float time; uniform float strength; uniform float len; uniform float core; uniform float flame;
    uniform float cell; uniform float diamonds; uniform float green; uniform float rimPower; uniform float cover; varying vec2 vUv; varying float vFacing;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
        float s = (1. - vUv.y) * len;                  // metres from the nozzle
        float flicker = .86 + .14 * hash(vec2(floor(s / len * 22. - time * 38.), floor(time * 30.)));
        float body = s < core ? 1. : exp(-(s - core) / max(1., (flame - core) * .4));
        body *= 1. - smoothstep(len * .7, len, s);
        float bands = 1. + diamonds * .8 * pow(cos(3.14159 * s / cell), 2.) * exp(-s / (6. * cell));
        float heat = clamp(s / max(flame, 1.), 0., 1.);
        vec3 colour = mix(hot, warm, smoothstep(0., .3, heat));
        colour = mix(colour, cool, smoothstep(.3, 1., heat));
        colour = mix(colour, vec3(.3, 1., .42), green);
        float glow = body * bands * pow(vFacing, rimPower) * flicker * strength;
        // Premultiplied: dense flame covers the sky behind it, the thin edges and tail only add light.
        gl_FragColor = vec4(colour * glow, clamp(glow * cover, 0., .92));
    }`;
function plume(hot, warm, cool, segments = 40) {
    const geometry = new THREE.CylinderGeometry(1, 1, 1, 32, segments, true).translate(0, -.5, 0);   // nozzle at 0, tail at -1
    const material = new THREE.ShaderMaterial({
        uniforms: { hot: { value: new THREE.Color(hot) }, warm: { value: new THREE.Color(warm) }, cool: { value: new THREE.Color(cool) }, time: { value: 0 }, strength: { value: 0 },
            len: { value: 1 }, core: { value: 1 }, flame: { value: 1 }, cell: { value: 1 }, diamonds: { value: 0 }, green: { value: 0 }, rimPower: { value: 1.2 }, cover: { value: .55 } },
        vertexShader: plumeVertex, fragmentShader: plumeFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor
    });
    const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false; mesh.renderOrder = 5;
    return mesh;
}
// The plume's radius `radiusAt(metres from the nozzle)` over its length.
function shapePlume(mesh, radiusAt, length) {
    const position = mesh.geometry.attributes.position;
    if (!mesh.userData.base) mesh.userData.base = position.array.slice();
    const base = mesh.userData.base;
    for (let i = 0; i < position.count; i++) {
        const t = -base[i * 3 + 1], radius = radiusAt(t * length);
        position.setXYZ(i, base[i * 3] * radius, -t * length, base[i * 3 + 2] * radius);
    }
    position.needsUpdate = true;
}
// Radius along a plume from the model: from the nozzle's exit out (or in, overexpanded) to the expanded jet within
// about 0.6 of the first shock cell, then growing as the shear layer mixes in air (slower as the rocket outruns its
// own exhaust).
function profile(model, exitRadius) {
    const reach = Math.max(1.5, model.machDisk * .6), barrel = Math.max(exitRadius * .82, model.jetDiameter * .56);
    const spread = (.035 + .085 * (1 - model.lambda) / (1 + model.lambda)) * (.55 + .45 * model.oxygen);
    return s => s < reach ? exitRadius + (barrel - exitRadius) * Math.sin(s / reach * Math.PI / 2) : barrel + spread * (s - reach);
}
// The air's pressure brought to rest at Mach `mach` from `pressure`: isentropically below Mach 1, behind a normal shock
// above (Rayleigh's pitot formula, γ 1.4).
function stagnation(pressure, mach) {
    const m2 = mach * mach;
    return m2 < 1 ? pressure * (1 + .2 * m2) ** 3.5 : pressure * (5.76 * m2 / (5.6 * m2 - .8)) ** 3.5 * (2.8 * m2 - .4) / 2.4;
}
const smoothstep = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// The exhaust of a burn into the air stream (the booster's entry and landing burns, falling engines first): the jets
// reach ahead until the air's dynamic pressure stops them, then the gas turns back round the booster as a glowing
// shell open toward the tail, brightest where it stagnates ahead and seen edge-on (a paraboloid round the axis).
const shellVertex = `varying float vFacing; varying vec2 vUv;
    void main() {
        vUv = uv; vec4 view = modelViewMatrix * vec4(position, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-view.xyz)));
        gl_Position = projectionMatrix * view;
    }`;
const shellFragment = `uniform vec3 hot; uniform vec3 cool; uniform float strength; uniform float time; varying float vFacing; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
        float along = 1. - vUv.y;                      // 0 at the apex ahead, 1 at the open end round the body
        float edge = pow(1. - vFacing, 2.2);
        float flicker = .88 + .12 * hash(vec2(floor(along * 28. + time * 22.), floor(vUv.x * 20. + time * 7.)));
        float glow = strength * pow(1. - along, 1.6) * (.35 + .65 * edge) * flicker * smoothstep(0., .04, along);
        vec3 colour = mix(hot, cool, smoothstep(0., .6, along));
        gl_FragColor = vec4(colour * glow, glow * .2);
    }`;
// Shape the shell: its apex `apex` metres ahead of the nozzles, widening as √ of the distance back from it to `width`
// at the nozzles' plane, on `back` metres past them round the body.
function shapeShell(mesh, apex, back, width) {
    const position = mesh.geometry.attributes.position;
    if (!mesh.userData.base) mesh.userData.base = position.array.slice();
    const base = mesh.userData.base, total = apex + back;
    for (let i = 0; i < position.count; i++) {
        const s = -base[i * 3 + 1] * total, radius = width * Math.sqrt(s / apex);
        position.setXYZ(i, base[i * 3] * radius, -apex + s, base[i * 3 + 2] * radius);
    }
    position.needsUpdate = true;
}
// TEA-TEB's green flash as an engine lights, `since` seconds ago.
const greenFlash = since => since >= 0 && since < .9 ? .9 * (1 - smoothstep(since, .2, .8)) : 0;

export async function createVehicle(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not load ' + url + ' (HTTP ' + response.status + ').');
    const data = await response.json();
    const loader = new THREE.TextureLoader();
    // Two sets of the materials, the first stage's (with its legs and fins) and the second stage's, so the cutaway can
    // cut each stage on its own plane; inside, the skin is bare aluminium.
    const [materials, secondMaterials] = [0, 1].map(() => data.materials.map(definition => {
        const material = new THREE.MeshStandardMaterial({ roughness: definition.roughness, metalness: definition.metalness, side: THREE.DoubleSide });
        material.color.setRGB(...definition.color);
        material.onBeforeCompile = shader => { shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tif (!gl_FrontFacing) diffuseColor.rgb = vec3(.56, .58, .61);'); };
        return material;
    }));
    data.materials.forEach((definition, index) => {
        if (definition.map) loader.load(definition.map, texture => {
            texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false; texture.anisotropy = 8;
            for (const set of [materials, secondMaterials]) { set[index].map = texture; set[index].needsUpdate = true; }
        });
    });
    // One mesh per part and material; the parts' groups and meshes are kept for the see-through view.
    const partGroups = [], skin = [];
    function part(name, set = materials) {
        const group = new THREE.Group(), { centre, primitives } = data.parts[name];
        for (const primitive of primitives) {
            const quantised = pmaArray(primitive.position, Int16Array), position = new Float32Array(quantised.length);
            for (let i = 0; i < quantised.length; i += 3) for (let k = 0; k < 3; k++) position[i + k] = quantised[i + k] * data.quantum + centre[k];
            const normals = pmaArray(primitive.normal, Int8Array), normal = new Float32Array(normals.length);
            for (let i = 0; i < normals.length; i++) normal[i] = normals[i] / 127;
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
            geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
            if (primitive.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(pmaArray(primitive.uv, Float32Array), 2));
            geometry.setIndex(new THREE.BufferAttribute(pmaArray(primitive.index, primitive.wide ? Uint32Array : Uint16Array), 1));
            const mesh = new THREE.Mesh(geometry, set[primitive.material]); mesh.castShadow = mesh.receiveShadow = true;
            group.add(mesh); skin.push(mesh);
        }
        group.name = name; partGroups.push(group);
        return group;
    }

    // First stage, with its grid fins on hinges (stowed against the interstage until they swing out to level).
    const firstStage = part('firstStage'), fins = [];
    data.gridFins.forEach((hinge, index) => {
        const pivot = new THREE.Group(), fin = part('gridFin' + index), at = new THREE.Vector3(...hinge.at), radial = new THREE.Vector3(...hinge.radial);
        pivot.position.copy(at); fin.position.copy(at).negate(); pivot.add(fin); firstStage.add(pivot);
        fins.push({ pivot, axis: new THREE.Vector3(0, -1, 0).cross(radial).normalize() });
    });
    // Landing legs on their foot hinges (stowed up the side, they swing out and down 120° to land), and the hydraulic
    // struts, hidden once the legs open (they would have to telescope).
    const legs = data.legs.map((hinge, index) => {
        const pivot = new THREE.Group(), leg = part('leg' + index), at = new THREE.Vector3(...hinge.at), radial = new THREE.Vector3(...hinge.radial);
        pivot.position.copy(at); leg.position.copy(at).negate(); pivot.add(leg); firstStage.add(pivot);
        return { pivot, axis: new THREE.Vector3(0, 1, 0).cross(radial).normalize() };
    });
    const struts = part('pistons'); firstStage.add(struts);
    const secondStage = part('secondStage', secondMaterials);
    // Crew Dragon on top: its trunk sits on the second stage's cylinder, nose up.
    const { group: dragon, noseCone, openAngle } = dragonHull();
    dragon.rotation.x = -Math.PI / 2; dragon.updateMatrixWorld(true);
    const dragonBox = new THREE.Box3().setFromObject(dragon);
    dragon.position.y = data.secondStageTop - dragonBox.min.y;
    dragon.traverse(child => { if (child.isMesh) { child.castShadow = child.receiveShadow = true; } });
    const dragonTop = data.secondStageTop - dragonBox.min.y + dragonBox.max.y;
    // Its Draco thrusters (after the stack's measurements: their exhaust is not part of the capsule).
    const dracos = createDracoPlumes(dragon, { jetLength: 1.8, puffSpeed: 14 });

    // Plumes: each Merlin's own jet for its first few shock cells (they merge within metres), the nine as one flame
    // beyond, a wide faint plume as the air thins, the vacuum Merlin's, and a glow at the engines.
    const firstPlume = plume(0xfff7e6, 0xffb446, 0xc4532a), firstHaze = plume(0xffe2b8, 0xd88a58, 0x6f4a3c, 24), secondPlume = plume(0xfff1d8, 0xffb070, 0x7a4a6a);
    firstHaze.material.uniforms.rimPower.value = 2.2; firstHaze.material.uniforms.cover.value = 0; secondPlume.material.uniforms.cover.value = .15; firstHaze.renderOrder = 4;
    firstStage.add(firstPlume, firstHaze); secondStage.add(secondPlume);
    const retroShell = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40, 30, true).translate(0, -.5, 0), new THREE.ShaderMaterial({
        uniforms: { hot: { value: new THREE.Color(0xffe6b8) }, cool: { value: new THREE.Color(0xa8402a) }, strength: { value: 0 }, time: { value: 0 } },
        vertexShader: shellVertex, fragmentShader: shellFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
    }));
    retroShell.frustumCulled = false; retroShell.renderOrder = 4; retroShell.visible = false; firstStage.add(retroShell);
    secondPlume.position.y = data.engines.mvacExitY;
    // The octaweb: eight Merlins round the edge (45° apart) and one in the middle; the entry burn lights the middle one
    // and two opposite, the landing burn the middle one.
    const merlins = [[0, 0], ...Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 4) * data.engines.merlinRadius, Math.sin(k * Math.PI / 4) * data.engines.merlinRadius])];
    const jets = merlins.map(([x, z]) => { const jet = plume(0xfffaf0, 0xffc070, 0xff8a3a, 24); jet.position.set(x, data.engines.merlinExitY, z); firstStage.add(jet); return jet; });
    const cluster = { 9: [0, 1, 2, 3, 4, 5, 6, 7, 8], 3: [0, 1, 5], 1: [0] };
    const glowMap = (() => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; const g = canvas.getContext('2d');
        const glow = g.createRadialGradient(32, 32, 0, 32, 32, 32); glow.addColorStop(0, 'rgba(255,250,235,1)'); glow.addColorStop(.25, 'rgba(255,200,120,.65)'); glow.addColorStop(1, 'rgba(255,140,60,0)');
        g.fillStyle = glow; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(canvas);
    })();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.position.y = -1.5; glow.renderOrder = 6; glow.material.opacity = .7; firstStage.add(glow);
    // Light from the first stage's plume on the pad, the smoke and the rocket.
    const fireLight = new THREE.PointLight(0xffb070, 0, 600, 1.4); fireLight.position.y = -6; firstStage.add(fireLight);
    const firstState = { flame: 0, core: 0, strength: 0 };

    // Booster burn: `lit` engines burning (9, 3 or 1) with `engines` of thrust (in engines at full thrust: throttle, and
    // the spool as they start and stop, sim/ascent.js) at `altitude` metres and `airspeed` m/s; `retro` when the burn
    // faces into the air stream (the entry and landing burns: the air pushes the plume back round the booster); `since`
    // seconds since these engines were commanded on.
    function setFirstPlume({ engines, lit, altitude, airspeed = 0, retro = false, since = 10 }, time) {
        const count = lit ?? (engines <= 0 ? 0 : engines > 4 ? 9 : engines > 1.5 ? 3 : 1), share = count ? Math.min(1, engines / count) : 0;
        // Below 40% the engines are starting or stopping, not throttled: the flame shrinks and fades with the thrust.
        const on = count > 0 && share > .004, throttle = Math.max(.4, share), weak = Math.min(1, share / .4);
        firstPlume.visible = firstHaze.visible = glow.visible = on; retroShell.visible = false;
        for (const jet of jets) jet.visible = false;
        fireLight.intensity = on ? 6e4 * (engines / 9) * Math.exp(-altitude / 1500) : 0;
        firstState.strength = on ? engines / 9 : 0;
        if (!on) return;
        // Burning into the air stream the jets meet the air brought to rest behind its shock, not the open air: they leave
        // against that stagnation pressure (Rayleigh's pitot formula above Mach 1), and the oncoming air shortens their
        // core where air streaming the same way would stretch it.
        const atm = air(altitude), q = .5 * atm.rho * airspeed * airspeed;
        const conditions = { throttle, pressure: retro ? stagnation(atm.p, airspeed / atm.a) : atm.p, density: atm.rho, airspeed: retro ? 0 : airspeed };
        const model = clusterPlume(conditions, count), one = model.engine;
        // Each engine lights a few hundredths of a second from the others: its own green flash, and its share of the
        // cluster's thrust while they spool up.
        const after = k => since - merlinSpool.delay - merlinSpool.spread[k];
        let spooled = 0, green = 0;
        for (const k of cluster[count]) { spooled += spoolUp(after(k)) / cluster[count].length; green += greenFlash(after(k)) / cluster[count].length; }
        // Into the air stream (supersonic retropropulsion) the jets reach ahead in proportion to the square root of the
        // thrust coefficient, thrust over the air's dynamic pressure times the booster's cross-section; there they stop,
        // and the exhaust turns back round the booster. Thin air at the entry burn lets them reach a hundred metres
        // and more, so the shell swallows the whole booster; low down, braking for the landing, it is a bulb round the
        // engines, until the booster slows enough for the flame to run free onto the deck.
        const thrust = count * 9.14e5 * throttle, reach = retro && q > 1 ? .7 * 3.66 * Math.sqrt(thrust / (q * 10.52)) : Infinity;
        const turned = reach < model.flame * .9;
        const flame = (turned ? Math.max(3, Math.min(model.flame, .6 * reach)) : Math.min(model.flame, 420)) * (.25 + .75 * weak), length = Math.max(turned ? 4 : 12 * weak, flame * 1.15);
        const exitRadius = count === 9 ? data.engines.merlinRadius + data.engines.merlinExit : count === 3 ? 1.9 : data.engines.merlinExit;
        // Turned, the jets' first shock cell is all there is: a bulb (the barrel shock swelling, then closing on the Mach
        // disk where they stop), not a widening cone.
        const widest = Math.min(.3 * flame, exitRadius + model.jetDiameter * .6);
        shapePlume(firstPlume, turned ? s => exitRadius + (widest - exitRadius) * Math.sin(.8 * Math.PI * Math.min(1, s / length)) ** .7 : profile(model, exitRadius), length);
        if (turned) {
            retroShell.visible = true;
            shapeShell(retroShell, reach, .9 * reach + 6, .45 * reach + 2.2);
            const r = retroShell.material.uniforms;
            // Fainter the further out it stands: the same exhaust spread over a larger shell.
            r.time.value = time; r.strength.value = (.3 + .75 * Math.exp(-reach / 30)) * Math.min(1, .35 + throttle) * (count === 3 ? 1 : .8) * weak * (1 - .6 * green);
        }
        const u = firstPlume.material.uniforms;
        u.time.value = time; u.len.value = length; u.core.value = Math.min(model.core, flame * .6); u.flame.value = flame;
        u.cell.value = Math.max(1, one.cell * Math.sqrt(count)); u.diamonds.value = .5 * Math.exp(-Math.abs(Math.log(one.ratio)) * 1.5) * (1 - smoothstep(altitude, 8000, 20000));
        u.green.value = green; u.strength.value = (1.1 - .45 * (1 - model.oxygen)) * Math.min(1, .35 + throttle) * (count === 9 ? 1 : .85) * weak;
        Object.assign(firstState, { flame, core: model.core });
        // Each engine's own jet, until it merges into the rest: a few shock cells long, brightest near sea level.
        if (altitude < 30000) for (const k of cluster[count]) {
            const own = spooled > .01 ? Math.min(1, spoolUp(after(k)) / spooled) * weak : weak;
            if (own < .01) continue;
            const jet = jets[k], jetLength = Math.min(18, Math.max(5, one.cell * 4), turned ? Math.max(2.5, .8 * reach) : Infinity) * (.3 + .7 * own);
            jet.visible = true;
            shapePlume(jet, profile(one, data.engines.merlinExit), jetLength);
            const v = jet.material.uniforms;
            v.time.value = time + k * .37; v.len.value = jetLength; v.core.value = Math.min(one.core, jetLength * .7); v.flame.value = jetLength * 1.2;
            v.cell.value = Math.max(.6, one.cell); v.diamonds.value = 1.6 * Math.exp(-Math.abs(Math.log(one.ratio)) * 1.2); v.green.value = greenFlash(after(k));
            v.strength.value = .55 * Math.min(1, .3 + throttle) * own * (1 - smoothstep(altitude, 12000, 30000));
        }
        // The faint wide plume of an underexpanded jet in thin air (the "jellyfish" at dusk), from about 12 km.
        const thin = smoothstep(altitude, 12000, 45000);
        firstHaze.visible = thin > .01 && !retro;
        if (firstHaze.visible) {
            const hazeLength = Math.min(2500, 300 + 5 * model.machDisk), open = Math.tan(Math.min(1.1, model.turn * .8));
            shapePlume(firstHaze, s => exitRadius * 1.4 + model.jetDiameter * .4 + open * s * (1 - .35 * s / hazeLength), hazeLength);
            const h = firstHaze.material.uniforms;
            h.time.value = time; h.len.value = hazeLength; h.core.value = hazeLength * .08; h.flame.value = hazeLength * .9; h.cell.value = 1e4; h.diamonds.value = 0; h.green.value = 0;
            h.strength.value = .16 * thin * throttle * weak;
        }
        glow.scale.setScalar(6 + 10 * thin);
    }
    // The vacuum Merlin at `level` of its thrust (its spool as it starts and stops): in near vacuum its jet turns out
    // wide past the nozzle's lip; faint, with a hotter core near the bell. `since` seconds since it was commanded on.
    function setSecondPlume(level, time, since = 10) {
        const on = level > .004;
        secondPlume.visible = on;
        if (!on) return;
        const model = enginePlume('mvac', { pressure: .01, density: 0 }), open = Math.tan(model.turn * .32) * (.4 + .6 * level), length = 60 * (.3 + .7 * level);
        shapePlume(secondPlume, s => data.engines.mvacExit * .95 + open * s, length);
        const u = secondPlume.material.uniforms;
        u.time.value = time; u.len.value = length; u.core.value = 6; u.flame.value = length * .92; u.cell.value = 1e4; u.diamonds.value = 0; u.green.value = greenFlash(since - merlinSpool.delay);
        u.strength.value = .42 * level;
    }
    function setFins(open) { for (const { pivot, axis } of fins) pivot.quaternion.setFromAxisAngle(axis, open * Math.PI / 2); }
    function setNose(open) { noseCone.rotation.x = openAngle * open; }
    function setLegs(open) { for (const { pivot, axis } of legs) pivot.quaternion.setFromAxisAngle(axis, open * 2.09); struts.visible = open < .02; }
    setFirstPlume({ engines: 0, altitude: 0 }, 0); setSecondPlume(0, 0);

    // The cutaway (js/launch/internals.js): each stage's skin cut through its axis, square to the camera, showing the
    // tanks with the propellant left in them, the feed lines, the engines' insides.
    const internals = createInternals(data);
    firstStage.add(internals.first); secondStage.add(internals.second);
    let cutaway = false, xray = false;
    function setCutaway(on) {
        cutaway = on; internals.setShown(cutaway || xray);
        for (const material of materials) material.clippingPlanes = on ? [internals.cut.first] : null;
        for (const material of secondMaterials) material.clippingPlanes = on ? [internals.cut.second] : null;
    }
    // `left`: the share of each stage's propellant left, { first, second } (0-1).
    function updateCutaway(camera, left) { if (cutaway || xray) internals.update({ first: firstStage, second: secondStage }, camera, left, cutaway); }

    // See-through (a left click on the rocket): the skin of both stages half transparent, only its near faces and
    // drawn after the propellant inside, over the whole inside; and its line art at full strength, the crease and
    // boundary edges as on the station's ghosted parts, found once in the station's line-art worker. The lines are
    // dark against the sky and light against space.
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x1f2b33, transparent: true, depthWrite: false });
    const lineDark = new THREE.Color(0x1f2b33), lineLight = new THREE.Color(0xd2e4ee);
    const solid = [...materials, ...secondMaterials].map(material => ({ material, transparent: material.transparent, opacity: material.opacity, depthWrite: material.depthWrite, side: material.side }));
    let lines = null;
    function buildLines() {
        lines = [];
        const jobs = partGroups.map(group => ({ group, meshes: group.children.filter(child => child.isMesh) })).filter(job => job.meshes.length);
        const attach = (job, points) => {
            if (!points.length) return;
            const segments = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(points, 3)), lineMaterial);
            segments.renderOrder = 6; segments.visible = xray; job.group.add(segments); lines.push(segments);
        };
        let worker = null;
        try { worker = new Worker(new URL('../workers/line-art.js?v=8b3d432c47', import.meta.url), { type: 'module' }); } catch (error) { worker = null; }
        const here = () => { for (const job of jobs.splice(0)) for (const mesh of job.meshes) attach(job, creaseSegments(mesh.geometry, 40)); };
        if (!worker) { here(); return; }
        let current = null;
        const send = () => {
            current = jobs.shift();
            if (!current) { worker.terminate(); return; }
            const meshes = current.meshes.map(mesh => {
                mesh.updateMatrix();
                return { position: mesh.geometry.attributes.position.array.slice(), index: mesh.geometry.index ? mesh.geometry.index.array.slice() : null, matrix: Float64Array.from(mesh.matrix.elements) };
            });
            worker.postMessage({ meshes, degrees: 40 }, meshes.flatMap(mesh => mesh.index ? [mesh.position.buffer, mesh.index.buffer] : [mesh.position.buffer]));
        };
        worker.onmessage = ({ data }) => { attach(current, data.points); send(); };
        worker.onerror = event => { event.preventDefault(); worker.terminate(); if (current) jobs.unshift(current); here(); };
        send();
    }
    function setXray(on) {
        xray = on;
        for (const entry of solid) {
            Object.assign(entry.material, on ? { transparent: true, opacity: .5, depthWrite: false, side: THREE.FrontSide } : { transparent: entry.transparent, opacity: entry.opacity, depthWrite: entry.depthWrite, side: entry.side });
            entry.material.needsUpdate = true;
        }
        for (const mesh of skin) mesh.renderOrder = on ? 4 : 0;
        if (on && !lines) buildLines();
        if (lines) for (const segments of lines) segments.visible = on;
        internals.setShown(cutaway || xray);
    }
    // 0 against the sky, 1 against space.
    const xrayContrast = space => lineMaterial.color.lerpColors(lineDark, lineLight, space);

    return {
        firstStage, secondStage, dragon, setFirstPlume, setSecondPlume, setFins, setNose, setLegs, firstState, setDracos: dracos.update, setCutaway, updateCutaway,
        setXray, xrayContrast, pickable: skin,
        // Heights on the stack: the joint between the stages, the second stage's top, Dragon's top.
        separationY: data.separationY, secondStageTop: data.secondStageTop, dragonTop, source: data.source,
        dragonRingY: dragon.position.y   // the docking ring's face (the Dragon frame's origin) up the stack
    };
}
