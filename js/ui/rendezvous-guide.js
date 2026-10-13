// Rendezvous guide, shown with Crew Dragon's docking approach: the planned path (dashed) from Waypoint 0 through the
// coasting transfer and along the docking axis, the three waypoints, and the 200 m keep-out sphere about the station's
// centre of mass, drawn as its circle in the orbital plane, where the whole path lies. Labels are page elements, kept
// beside their points as the camera moves.
import * as THREE from 'three';
import { camera, scene, viewport } from '../core/stage.js';
import { parts } from '../core/station.js';
import { approach, lvlhToStation, rendezvous } from '../parts/dragon.js';
import { keepOutSphereRadius, rendezvousWaypoints } from '../sim/rendezvous.js';

export const rendezvousGuide = new THREE.Group();
rendezvousGuide.name = 'Rendezvous guide'; rendezvousGuide.visible = false; scene.add(rendezvousGuide);
const guideColour = 0x246c60;
const path = new THREE.Line(new THREE.BufferGeometry().setFromPoints(rendezvous.path().map(point => lvlhToStation(point).add(approach.port))),
    new THREE.LineDashedMaterial({ color: guideColour, dashSize: 5, gapSize: 4, transparent: true, opacity: .8, depthWrite: false }));
path.computeLineDistances(); rendezvousGuide.add(path);
const dot = document.createElement('canvas'); dot.width = dot.height = 32;
const context = dot.getContext('2d'); context.strokeStyle = '#fff'; context.lineWidth = 5; context.beginPath(); context.arc(16, 16, 11, 0, Math.PI * 2); context.stroke();
const waypointPoints = rendezvousWaypoints.map(waypoint => lvlhToStation(waypoint.position).add(approach.port));
const markers = new THREE.Points(new THREE.BufferGeometry().setFromPoints(waypointPoints),
    new THREE.PointsMaterial({ color: guideColour, size: 11, sizeAttenuation: false, map: new THREE.CanvasTexture(dot), transparent: true, depthWrite: false, depthTest: false }));
rendezvousGuide.add(markers);
// The keep-out sphere is centred on the truss's middle, near the station's centre of mass, in the radial / along-track
// plane (the station frame's y-z plane).
const centre = new THREE.Box3().setFromObject(parts.get('truss').group).getCenter(new THREE.Vector3());
const circle = [];
for (let k = 0; k <= 192; k++) { const a = k / 192 * Math.PI * 2; circle.push(new THREE.Vector3(centre.x, centre.y + Math.sin(a) * keepOutSphereRadius, centre.z + Math.cos(a) * keepOutSphereRadius)); }
const keepOut = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circle),
    new THREE.LineDashedMaterial({ color: 0x81643e, dashSize: 8, gapSize: 6, transparent: true, opacity: .55, depthWrite: false }));
keepOut.computeLineDistances(); rendezvousGuide.add(keepOut);

const labelSpecs = [
    ...rendezvousWaypoints.map((waypoint, k) => ({ text: waypoint.name + ' · ' + waypoint.note.toUpperCase(), at: waypointPoints[k] })),
    { text: 'KEEP-OUT SPHERE · 200 M', at: new THREE.Vector3(centre.x, centre.y - keepOutSphereRadius, centre.z), muted: true }
];
const labels = labelSpecs.map(spec => {
    const element = document.createElement('div'); element.className = 'guide-label' + (spec.muted ? ' muted' : ''); element.textContent = spec.text; element.hidden = true;
    viewport.appendChild(element);
    return { ...spec, element };
});
const projected = new THREE.Vector3();
// Show or hide the guide; while shown, keep each label beside its point (hidden when the point is off screen).
export function updateRendezvousGuide(visible) {
    rendezvousGuide.visible = visible;
    const width = viewport.clientWidth, height = viewport.clientHeight;
    for (const label of labels) {
        projected.copy(label.at).project(camera);
        const show = visible && Math.abs(projected.x) < .96 && Math.abs(projected.y) < .94;
        label.element.hidden = !show;
        if (show) label.element.style.transform = 'translate(' + ((projected.x * .5 + .5) * width + 9).toFixed(1) + 'px,' + ((-projected.y * .5 + .5) * height - 7).toFixed(1) + 'px)';
    }
}
