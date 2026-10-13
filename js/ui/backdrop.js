// Orbital backdrop: Earth, its atmosphere glow and a star field, shown with the backdrop toggle.
import * as THREE from 'three';
import { scene } from '../core/stage.js';

export const orbitalGroup = new THREE.Group(); orbitalGroup.visible = false; scene.add(orbitalGroup);
const earthMaterial = new THREE.MeshStandardMaterial({ color: 0x92b8c3, roughness: .95, metalness: 0 });
export const earth = new THREE.Mesh(new THREE.SphereGeometry(140, 80, 48), earthMaterial); orbitalGroup.add(earth);
export const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(142, 64, 32), new THREE.ShaderMaterial({ uniforms: { glowColor: { value: new THREE.Color(0x57aac8) } }, vertexShader: 'varying vec3 surfaceNormal; varying vec3 viewDirection; void main(){ vec4 viewPosition=modelViewMatrix*vec4(position,1.0); surfaceNormal=normalize(normalMatrix*normal); viewDirection=normalize(-viewPosition.xyz); gl_Position=projectionMatrix*viewPosition; }', fragmentShader: 'uniform vec3 glowColor; varying vec3 surfaceNormal; varying vec3 viewDirection; void main(){ float intensity=pow(1.0-max(dot(normalize(surfaceNormal),normalize(viewDirection)),0.0),4.0); gl_FragColor=vec4(glowColor,intensity*0.6); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); orbitalGroup.add(atmosphere);
const starPositions = [];
let seed = 37;
function random() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
for (let star = 0; star < 850; star++) { const angle = random() * Math.PI * 2, verticalPosition = random() * 2 - 1, spread = Math.sqrt(1 - verticalPosition * verticalPosition); starPositions.push(Math.cos(angle) * spread * 750, verticalPosition * 750, Math.sin(angle) * spread * 750); }
const starsGeometry = new THREE.BufferGeometry(); starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
orbitalGroup.add(new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: 0xe1e8da, size: .85, sizeAttenuation: true, transparent: true, opacity: .65, depthWrite: false })));
export let earthTextureState = 'unrequested';
// Earth imagery loads the first time the orbital backdrop shows; onLoad redraws, onError reports a message.
export function loadEarth(onLoad, onError) {
    if (earthTextureState !== 'unrequested') return;
    earthTextureState = 'loading';
    new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg', texture => { texture.colorSpace = THREE.SRGBColorSpace; earthMaterial.map = texture; earthMaterial.color.set(0xffffff); earthMaterial.needsUpdate = true; earthTextureState = 'ready'; onLoad(); }, undefined, () => { earthTextureState = 'failed'; onError('Earth imagery is unavailable. The station remains available.'); });
}
