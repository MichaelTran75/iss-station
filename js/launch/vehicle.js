// Falcon 9 with Crew Dragon for the Launch view: the first stage (interstage, grid fins, legs, nine Merlins) and the
// second stage (MVac) from Stanley Creative's model (data/falcon-9.json, made by falcon9.py), Crew Dragon from the
// station's own model, and the engine plumes. Metres; the rocket stands on +y with the bottom of its engines at 0.
import * as THREE from 'three';
import { pmaArray } from '../core/pma.js';
import { dragonHull } from '../parts/dragon.js';

// Bright core near the nozzle fading down the plume and toward its silhouette (by how squarely each point faces the
// camera), flickering.
const plumeVertex = `varying vec2 vUv; varying float vFacing;
    void main() {
        vUv = uv; vec4 view = modelViewMatrix * vec4(position, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-view.xyz)));
        gl_Position = projectionMatrix * view;
    }`;
const plumeFragment = `uniform vec3 core; uniform vec3 edge; uniform float time; uniform float strength; uniform float spread; varying vec2 vUv; varying float vFacing;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
        float along = 1.0 - vUv.y;                     // 0 at the nozzle, 1 at the tail
        float flicker = .85 + .15 * hash(vec2(floor(along * 18. - time * 40.), floor(time * 30.)));
        float body = pow(1. - along, 1.4 + spread * 2.4) * flicker;
        float rim = pow(vFacing, 1.2 + spread * 1.5);
        vec3 colour = mix(core, edge, smoothstep(0., .5, along + spread * .3));
        gl_FragColor = vec4(colour * body * rim * strength, 1.);
    }`;
function plume(core, edge) {
    const geometry = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true).translate(0, -.5, 0);   // nozzle at 0, tail at -1
    const material = new THREE.ShaderMaterial({
        uniforms: { core: { value: new THREE.Color(core) }, edge: { value: new THREE.Color(edge) }, time: { value: 0 }, strength: { value: 0 }, spread: { value: 0 } },
        vertexShader: plumeVertex, fragmentShader: plumeFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false; mesh.renderOrder = 5;
    return mesh;
}
// Narrow at the nozzle, widening into the tail.
function shapePlume(mesh, nozzle, tail, length) {
    const position = mesh.geometry.attributes.position;
    if (!mesh.userData.base) mesh.userData.base = position.array.slice();
    const base = mesh.userData.base;
    for (let i = 0; i < position.count; i++) {
        const t = -base[i * 3 + 1], radius = nozzle + (tail - nozzle) * Math.pow(t, .7);
        position.setXYZ(i, base[i * 3] * radius, -t * length, base[i * 3 + 2] * radius);
    }
    position.needsUpdate = true;
}

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
    const secondStage = part('secondStage');
    // Crew Dragon on top: its trunk sits on the second stage's cylinder, nose up.
    const { group: dragon, noseCone, openAngle } = dragonHull();
    dragon.rotation.x = -Math.PI / 2; dragon.updateMatrixWorld(true);
    const dragonBox = new THREE.Box3().setFromObject(dragon);
    dragon.position.y = data.secondStageTop - dragonBox.min.y;
    dragon.traverse(child => { if (child.isMesh) { child.castShadow = child.receiveShadow = true; } });
    const dragonTop = data.secondStageTop - dragonBox.min.y + dragonBox.max.y;

    // Plumes: the nine Merlins as one (they merge within metres), the vacuum Merlin, and a glow at each.
    const firstPlume = plume(0xfff3d6, 0xff8a3a), secondPlume = plume(0xe8f1ff, 0x6f8fd8);
    firstStage.add(firstPlume); secondStage.add(secondPlume);
    secondPlume.position.y = data.engines.mvacExitY;
    const glowMap = (() => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; const g = canvas.getContext('2d');
        const glow = g.createRadialGradient(32, 32, 0, 32, 32, 32); glow.addColorStop(0, 'rgba(255,250,235,1)'); glow.addColorStop(.25, 'rgba(255,200,120,.65)'); glow.addColorStop(1, 'rgba(255,140,60,0)');
        g.fillStyle = glow; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(canvas);
    })();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.position.y = -1.5; glow.renderOrder = 6; glow.material.opacity = .7; firstStage.add(glow);
    // Light from the first stage's plume on the pad, the smoke and the rocket.
    const fireLight = new THREE.PointLight(0xffb070, 0, 600, 1.4); fireLight.position.y = -6; firstStage.add(fireLight);

    // Booster burn: thrust 1 = nine engines; the plume swells as the air thins (`altitude` in metres).
    function setFirstPlume(thrust, altitude, time) {
        const thin = 1 - Math.exp(-altitude / 9000);
        firstPlume.visible = glow.visible = thrust > 0;
        fireLight.intensity = thrust > 0 ? 6e4 * thrust * Math.exp(-altitude / 1500) : 0;
        if (!thrust) return;
        const engines = Math.max(1, thrust * 9) / 9;
        shapePlume(firstPlume, 1.4 * Math.sqrt(engines), 2.2 + 26 * thin ** 1.6, 30 + 70 * thin);
        firstPlume.material.uniforms.time.value = time;
        firstPlume.material.uniforms.strength.value = (1.15 - .55 * thin) * Math.min(1, .35 + thrust);
        firstPlume.material.uniforms.spread.value = thin;
        glow.scale.setScalar(6 + 8 * thin);
    }
    function setSecondPlume(on, time) {
        secondPlume.visible = on;
        if (!on) return;
        shapePlume(secondPlume, data.engines.mvacExit * .95, 18, 34);
        secondPlume.material.uniforms.time.value = time;
        secondPlume.material.uniforms.strength.value = .38;
        secondPlume.material.uniforms.spread.value = .8;
    }
    function setFins(open) { for (const { pivot, axis } of fins) pivot.quaternion.setFromAxisAngle(axis, open * Math.PI / 2); }
    function setNose(open) { noseCone.rotation.x = openAngle * open; }
    setFirstPlume(0, 0, 0); setSecondPlume(false, 0);

    return {
        firstStage, secondStage, dragon, setFirstPlume, setSecondPlume, setFins, setNose,
        // Heights on the stack: the joint between the stages, the second stage's top, Dragon's top.
        separationY: data.separationY, secondStageTop: data.secondStageTop, dragonTop, source: data.source
    };
}
