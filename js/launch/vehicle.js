// Falcon 9 with Crew Dragon for the Launch view: the first stage (interstage, grid fins, legs, nine Merlins) and the
// second stage (MVac) from Stanley Creative's model (data/falcon-9.json, made by falcon9.py), Crew Dragon from the
// station's own model, and the engine plumes. Metres; the rocket stands on +y with the bottom of its engines at 0.
import * as THREE from 'three';
import { pmaArray } from '../core/pma.js';
import { dragonHull } from '../parts/dragon.js';
import { createDracoPlumes } from '../parts/draco.js';
import { clusterPlume, enginePlume } from '../sim/plume.js';
import { air } from '../sim/ascent.js';

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
const smoothstep = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// TEA-TEB's green flash as an engine lights, `since` seconds ago.
const greenFlash = since => since >= 0 && since < .9 ? .9 * (1 - smoothstep(since, .2, .8)) : 0;

export async function createVehicle(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not load ' + url + ' (HTTP ' + response.status + ').');
    const data = await response.json();
    const loader = new THREE.TextureLoader();
    const materials = data.materials.map(definition => {
        const material = new THREE.MeshStandardMaterial({ roughness: definition.roughness, metalness: definition.metalness, side: THREE.DoubleSide });
        material.color.setRGB(...definition.color);
        if (definition.map) loader.load(definition.map, texture => { texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false; texture.anisotropy = 8; material.map = texture; material.needsUpdate = true; });
        return material;
    });
    // One mesh per part and material.
    function part(name) {
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
            const mesh = new THREE.Mesh(geometry, materials[primitive.material]); mesh.castShadow = mesh.receiveShadow = true;
            group.add(mesh);
        }
        group.name = name;
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
    const secondStage = part('secondStage');
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
    secondPlume.position.y = data.engines.mvacExitY;
    // The octaweb: eight Merlins round the edge (45° apart) and one in the middle; the entry burn lights the middle one
    // and two opposite, the landing burn the middle one.
    const merlins = [[0, 0], ...Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 4) * data.engines.merlinRadius, Math.sin(k * Math.PI / 4) * data.engines.merlinRadius])];
    const jets = merlins.map(([x, z]) => { const jet = plume(0xfffaf0, 0xffc070, 0xff8a3a, 24); jet.position.set(x, data.engines.merlinExitY, z); firstStage.add(jet); return jet; });
    const lit = { 9: [0, 1, 2, 3, 4, 5, 6, 7, 8], 3: [0, 1, 5], 1: [0] };
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

    // Booster burn: `engines` firing (nine at full thrust; fractions for throttle) at `altitude` metres and `airspeed`
    // m/s; `retro` when the burn faces into the air stream (the entry and landing burns: the air pushes the plume back
    // round the booster); `since` seconds since these engines lit.
    function setFirstPlume({ engines, altitude, airspeed = 0, retro = false, since = 10 }, time) {
        const count = engines <= 0 ? 0 : engines > 4 ? 9 : engines > 1.5 ? 3 : 1, throttle = count ? Math.min(1, Math.max(.4, engines / count)) : 0;
        const on = count > 0;
        firstPlume.visible = firstHaze.visible = glow.visible = on;
        for (const jet of jets) jet.visible = false;
        fireLight.intensity = on ? 6e4 * (engines / 9) * Math.exp(-altitude / 1500) : 0;
        firstState.strength = on ? engines / 9 : 0;
        if (!on) return;
        const atm = air(altitude), conditions = { throttle, pressure: atm.p, density: atm.rho, airspeed };
        const model = clusterPlume(conditions, count), one = model.engine, green = greenFlash(since);
        // Into the air stream the plume reaches only as far as its thrust can hold off the air's dynamic pressure.
        const q = .5 * atm.rho * airspeed * airspeed, thrust = count * 9.14e5 * throttle;
        const held = retro && q > 1 ? 1.4 * Math.sqrt(thrust / q) : Infinity;
        const flame = Math.min(model.flame, 420, held), length = Math.max(12, flame * 1.15);
        const exitRadius = count === 9 ? data.engines.merlinRadius + data.engines.merlinExit : count === 3 ? 1.9 : data.engines.merlinExit;
        let radiusAt = profile(model, exitRadius);
        if (held < model.flame) { const cupped = radiusAt; radiusAt = s => cupped(s) + (s / length) ** 2 * held * .5; }   // pushed back: a wide cup
        shapePlume(firstPlume, radiusAt, length);
        const u = firstPlume.material.uniforms;
        u.time.value = time; u.len.value = length; u.core.value = Math.min(model.core, flame * .6); u.flame.value = flame;
        u.cell.value = Math.max(1, one.cell * Math.sqrt(count)); u.diamonds.value = .5 * Math.exp(-Math.abs(Math.log(one.ratio)) * 1.5) * (1 - smoothstep(altitude, 8000, 20000));
        u.green.value = green; u.strength.value = (1.1 - .45 * (1 - model.oxygen)) * Math.min(1, .35 + throttle) * (count === 9 ? 1 : .85);
        Object.assign(firstState, { flame, core: model.core });
        // Each engine's own jet, until it merges into the rest: a few shock cells long, brightest near sea level.
        if (altitude < 30000) for (const k of lit[count]) {
            const jet = jets[k], jetLength = Math.min(18, Math.max(5, one.cell * 4));
            jet.visible = true;
            shapePlume(jet, profile(one, data.engines.merlinExit), jetLength);
            const v = jet.material.uniforms;
            v.time.value = time + k * .37; v.len.value = jetLength; v.core.value = Math.min(one.core, jetLength * .7); v.flame.value = jetLength * 1.2;
            v.cell.value = Math.max(.6, one.cell); v.diamonds.value = 1.6 * Math.exp(-Math.abs(Math.log(one.ratio)) * 1.2); v.green.value = green;
            v.strength.value = .55 * Math.min(1, .3 + throttle) * (1 - smoothstep(altitude, 12000, 30000));
        }
        // The faint wide plume of an underexpanded jet in thin air (the "jellyfish" at dusk), from about 12 km.
        const thin = smoothstep(altitude, 12000, 45000);
        firstHaze.visible = thin > .01 && !retro;
        if (firstHaze.visible) {
            const hazeLength = Math.min(2500, 300 + 5 * model.machDisk), open = Math.tan(Math.min(1.1, model.turn * .8));
            shapePlume(firstHaze, s => exitRadius * 1.4 + model.jetDiameter * .4 + open * s * (1 - .35 * s / hazeLength), hazeLength);
            const h = firstHaze.material.uniforms;
            h.time.value = time; h.len.value = hazeLength; h.core.value = hazeLength * .08; h.flame.value = hazeLength * .9; h.cell.value = 1e4; h.diamonds.value = 0; h.green.value = 0;
            h.strength.value = .16 * thin * throttle;
        }
        glow.scale.setScalar(6 + 10 * thin);
    }
    // The vacuum Merlin: in near vacuum its jet turns out wide past the nozzle's lip; faint, with a hotter core near
    // the bell.
    function setSecondPlume(on, time, since = 10) {
        secondPlume.visible = on;
        if (!on) return;
        const model = enginePlume('mvac', { pressure: .01, density: 0 }), open = Math.tan(model.turn * .32);
        shapePlume(secondPlume, s => data.engines.mvacExit * .95 + open * s, 60);
        const u = secondPlume.material.uniforms;
        u.time.value = time; u.len.value = 60; u.core.value = 6; u.flame.value = 55; u.cell.value = 1e4; u.diamonds.value = 0; u.green.value = greenFlash(since);
        u.strength.value = .42;
    }
    function setFins(open) { for (const { pivot, axis } of fins) pivot.quaternion.setFromAxisAngle(axis, open * Math.PI / 2); }
    function setNose(open) { noseCone.rotation.x = openAngle * open; }
    function setLegs(open) { for (const { pivot, axis } of legs) pivot.quaternion.setFromAxisAngle(axis, open * 2.09); struts.visible = open < .02; }
    setFirstPlume({ engines: 0, altitude: 0 }, 0); setSecondPlume(false, 0);

    return {
        firstStage, secondStage, dragon, setFirstPlume, setSecondPlume, setFins, setNose, setLegs, firstState, setDracos: dracos.update,
        // Heights on the stack: the joint between the stages, the second stage's top, Dragon's top.
        separationY: data.separationY, secondStageTop: data.secondStageTop, dragonTop, source: data.source,
        dragonRingY: dragon.position.y   // the docking ring's face (the Dragon frame's origin) up the stack
    };
}
