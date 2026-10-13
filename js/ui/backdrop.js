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
// The station's orbit: a ring of dots round the backdrop Earth through the station, drawn like the orbit in the orbit
// view: bright ahead of the station, dim behind it, and faded out where it would cross the station itself. The ring is
// built once round a unit circle; placeOrbitDots() fits it each frame.
const orbitDotCount = 1440, dotPositions = new Float32Array(orbitDotCount * 3), dotColours = new Float32Array(orbitDotCount * 4);
const dotColour = new THREE.Color(0x91d8c3);
for (let k = 0; k < orbitDotCount; k++) {
    const angle = k / orbitDotCount * Math.PI * 2, fromStation = angle > Math.PI ? angle - Math.PI * 2 : angle;
    const level = fromStation >= 0 ? 1 - .45 * fromStation / Math.PI : .45 - .3 * -fromStation / Math.PI;
    dotPositions.set([Math.cos(angle), Math.sin(angle), 0], k * 3);
    dotColours.set([dotColour.r, dotColour.g, dotColour.b, level * THREE.MathUtils.smoothstep(Math.abs(fromStation), .12, .26)], k * 4);
}
const dotCanvas = document.createElement('canvas'); dotCanvas.width = dotCanvas.height = 32;
const dotContext = dotCanvas.getContext('2d'), dotGlow = dotContext.createRadialGradient(16, 16, 0, 16, 16, 16);
dotGlow.addColorStop(0, 'rgba(255,255,255,1)'); dotGlow.addColorStop(.55, 'rgba(255,255,255,1)'); dotGlow.addColorStop(1, 'rgba(255,255,255,0)');
dotContext.fillStyle = dotGlow; dotContext.fillRect(0, 0, 32, 32);
export const orbitDots = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(dotPositions, 3)).setAttribute('color', new THREE.BufferAttribute(dotColours, 4)),
    new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, vertexColors: true, map: new THREE.CanvasTexture(dotCanvas), transparent: true, depthWrite: false }));
orbitDots.matrixAutoUpdate = false; orbitalGroup.add(orbitDots);
const toStation = new THREE.Vector3(), across = new THREE.Vector3();
// The backdrop Earth hangs below the station on screen wherever the camera turns, so the ring is laid out on screen too:
// an ellipse round Earth in the plane facing the camera through its centre (the camera is orthographic, so depth moves
// nothing on screen), with the station (`station`, its centre) at the top and the bright side toward the way the station
// flies across the screen (the station frame's -z). Wider than tall and clear of Earth's disc all round. `forward` is
// the camera's direction.
export function placeOrbitDots(station, forward) {
    toStation.copy(station).sub(earth.position); toStation.addScaledVector(forward, -toStation.dot(forward));
    across.crossVectors(forward, toStation);
    if (across.z > 0) across.negate();
    across.setLength(Math.max(toStation.length() * 1.3, 190));
    orbitDots.matrix.makeBasis(toStation, across, forward).setPosition(earth.position);
    orbitDots.matrixWorldNeedsUpdate = true;
}
export let earthTextureState = 'unrequested';
// Earth imagery loads the first time the orbital backdrop shows; onLoad redraws, onError reports a message.
export function loadEarth(onLoad, onError) {
    if (earthTextureState !== 'unrequested') return;
    earthTextureState = 'loading';
    new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg', texture => { texture.colorSpace = THREE.SRGBColorSpace; earthMaterial.map = texture; earthMaterial.color.set(0xffffff); earthMaterial.needsUpdate = true; earthTextureState = 'ready'; onLoad(); }, undefined, () => { earthTextureState = 'failed'; onError('Earth imagery is unavailable. The station remains available.'); });
}
