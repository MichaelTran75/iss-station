// The Cupola view: an eye inside the Cupola (js/parts/tranquility.js), looking down through its windows at the ground
// passing under the station, where the station is now.
// - The eye is a perspective camera in the station's own scene, at the Cupola's centre: the window frames, the
//   shutters and whatever of the station stands in the windows are the model's. Earth is drawn first by the sky
//   (js/orbit/sky.js, renderFrom) through the same eye, with a recent day's picture of the ground in tiles
//   (js/orbit/earth-tiles.js), then the station over it.
// - Looking: `heading` turns the eye about the nadir line (0 = the station's forward end at the top of the screen),
//   `tilt` lifts it off straight down, to `reachTilt` (the horizon lies 70° off nadir from 420 km). The six side
//   windows are centred 30° off the station's axes, the ribs on them: the Horizon button turns to the nearest window,
//   lifted to show the sill and the nadir window under it; on a narrow screen, where little height is left, to the
//   window's middle.
//   Dragging moves the scene with the finger; the wheel, a pinch and the zoom buttons narrow the field of view.
// - The clock is the sky's and runs live here: a time rate left on in the Orbit view is put back to 1.
// - The crew member at the windows and their camera stand aside while the view shows: the eye is where they float.
//   So does the cabin lining (a closed shell drawn for the look in from outside: from within it would wall the eye in).
import * as THREE from 'three';
import { renderer, scene, viewport } from '../core/stage.js';
import { parts } from '../core/station.js';
import { cabinCrew } from '../figures/cabin-crew.js';
import { loadPlaces, placeAt } from './place.js?v=dca0b0d671';

const rad = Math.PI / 180, widest = 80, narrowest = 16, reachTilt = 80, eyeHeight = -3.12, sideWindow = 69;   // sideWindow: a side window's middle, degrees off nadir
const winds = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function createCupolaView(sky) {
    const camera = new THREE.PerspectiveCamera(62, 1, .03, 600); camera.rotation.order = 'YXZ';
    const tranquility = parts.get('tranquility').group, cupola = tranquility.userData.cupola;
    const panel = document.getElementById('cupola-panel'), field = id => document.getElementById(id);
    const standAside = [cabinCrew.watcher.person, cabinCrew.camera, cupola.home], wasShown = [];
    const look = { heading: 0, tilt: 0, fov: 62 }, shown = { heading: 0, tilt: 0, fov: 62 };
    let active = false, lastDelta = 0, readoutAt = 1, width = 1, height = 1;

    function place() {
        tranquility.updateWorldMatrix(true, false);
        tranquility.localToWorld(camera.position.set(cupola.center[0], eyeHeight, cupola.center[1]));
        camera.rotation.set(-Math.PI / 2 + shown.tilt * rad, shown.heading * rad, 0);
        if (camera.fov !== shown.fov) { camera.fov = shown.fov; camera.updateProjectionMatrix(); }
        camera.updateMatrixWorld();
    }
    function setLook(heading, tilt) { look.heading = heading; look.tilt = THREE.MathUtils.clamp(tilt, 0, reachTilt); }
    function setFov(fov) { look.fov = THREE.MathUtils.clamp(fov, narrowest, widest); }

    // Pointers: one drags the look, two pinch the field of view.
    const canvas = renderer.domElement, pointers = new Map();
    let pinch = 0;
    const spread = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    function down(event) {
        if (!active) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); canvas.setPointerCapture?.(event.pointerId);
        if (pointers.size === 2) pinch = spread();
    }
    function move(event) {
        const pointer = pointers.get(event.pointerId);
        if (!active || !pointer) return;
        const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y; pointer.x = event.clientX; pointer.y = event.clientY;
        if (pointers.size === 2) { const now = spread(); if (pinch > 0 && now > 0) setFov(look.fov * pinch / now); pinch = now; return; }
        const perPixel = look.fov / height;
        setLook(look.heading + dx * perPixel / Math.max(.35, Math.sin(Math.max(look.tilt, 20) * rad)), look.tilt + dy * perPixel);
    }
    function up(event) { pointers.delete(event.pointerId); pinch = 0; }
    function wheel(event) { if (!active) return; event.preventDefault(); setFov(look.fov * Math.exp(THREE.MathUtils.clamp(event.deltaY, -120, 120) * .0016)); }
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    for (const button of panel.querySelectorAll('[data-cupola-look]')) button.addEventListener('click', () => {
        if (button.dataset.cupolaLook === 'down') setLook(look.heading, 0); else setLook(Math.round((look.heading - 30) / 60) * 60 + 30, camera.view?.enabled ? sideWindow : 58);
        setFov(62);
    });

    const pad = value => String(value).padStart(2, '0');
    const utc = date => date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()) + ' ' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds()) + ' UTC';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function readout() {
        const state = sky.iss.state, date = sky.time.date;
        field('cupola-clock').textContent = utc(date);
        if (!state) return;
        const place = placeAt(state.latitude, state.longitude);
        field('cupola-over').textContent = place.name;
        field('cupola-position').textContent = Math.abs(state.latitude).toFixed(1) + '° ' + (state.latitude >= 0 ? 'N' : 'S') + ' · ' + Math.abs(state.longitude).toFixed(1) + '° ' + (state.longitude >= 0 ? 'E' : 'W');
        // Local solar time: the Sun's time at this longitude, not the clock of the country below.
        const solar = ((date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 + state.longitude / 15) % 24 + 24) % 24;
        field('cupola-local').textContent = pad(Math.floor(solar)) + ':' + pad(Math.floor(solar % 1 * 60));
        // The Sun's height over the ground below (sky axes: x, z, -y of the orbit's).
        const p = state.position, s = sky.sun.position, sine = (p.x * s.x + p.z * s.y - p.y * s.z) / Math.hypot(p.x, p.y, p.z) / s.length();
        const elevation = Math.asin(THREE.MathUtils.clamp(sine, -1, 1)) / rad;
        field('cupola-ground').textContent = elevation > 0 ? 'Day · Sun ' + elevation.toFixed(0) + '° up' : elevation > -6 ? 'Twilight' : elevation > -18 ? 'Dusk · Sun ' + (-elevation).toFixed(0) + '° down' : 'Night';
        field('cupola-altitude').textContent = state.height.toFixed(1) + ' km';
        field('cupola-speed').textContent = state.speed.toFixed(2) + ' km/s';
        const { off, bearing } = sky.inside;
        field('cupola-look').textContent = off < 3 ? 'Straight down' : off.toFixed(0) + '° off nadir · toward ' + winds[Math.round(bearing / 45) % 8];
        const tiles = sky.tiles.status(), [year, month, day] = tiles.day.split('-');
        field('cupola-source').textContent = 'Ground: NASA GIBS · VIIRS on NOAA-20 · ' + +day + ' ' + months[month - 1] + ' ' + year
            + (tiles.ready ? ' · ' + tiles.ready + ' tiles' + (tiles.texel ? ', ' + (tiles.texel < 1 ? Math.round(tiles.texel * 1000) + ' m' : tiles.texel.toFixed(1) + ' km') + ' a texel' : '') : elevation < -6 ? ' · night below: city lights from the globe’s own map' : tiles.loading ? ' · loading' : '')
            + ' · ' + (tiles.bytes / 1048576).toFixed(1) + ' MB fetched';
    }

    return {
        camera, controls: { enabled: false }, look,
        enter() {
            active = true; panel.hidden = false; readoutAt = 1; loadPlaces();
            sky.time.warp = 1; sky.time.offset = 0;
            standAside.forEach((object, i) => { wasShown[i] = object.visible; object.visible = false; });
            Object.assign(shown, look); this.resize(viewport.clientWidth, viewport.clientHeight);
        },
        leave() {
            active = false; panel.hidden = true; pointers.clear(); sky.hideLabels(); sky.tiles.clear();
            standAside.forEach((object, i) => { object.visible = wasShown[i] ?? true; });
        },
        update(delta) {
            lastDelta = delta; sky.update(delta);
            const ease = 1 - Math.exp(-delta * 9);
            shown.heading += (look.heading - shown.heading) * ease; shown.tilt += (look.tilt - shown.tilt) * ease; shown.fov += (look.fov - shown.fov) * ease;
            if (Math.abs(look.fov - shown.fov) < .01) shown.fov = look.fov;
            if ((readoutAt += delta) > .25) { readoutAt = 0; readout(); }
        },
        render() {
            place();
            if (sky.renderFrom(camera, width, height, lastDelta)) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(scene, camera); renderer.autoClear = true; }
            else renderer.render(scene, camera);
            lastDelta = 0;
        },
        // Where the readout lies across the view (a narrow screen), the eye's centre moves up into the space left open
        // between the caption lines and the readout.
        resize(w, h) {
            width = w; height = h; camera.aspect = w / h;
            const top = viewport.getBoundingClientRect().top, box = panel.getBoundingClientRect();
            if (!panel.hidden && box.width > w * .6) {
                const upper = document.querySelector('.viewport-chrome').offsetTop + 34, lower = box.top - top - 6;
                camera.setViewOffset(w, h, 0, h / 2 - (upper + lower) / 2, w, h);
            } else camera.clearViewOffset();
            camera.updateProjectionMatrix();
        },
        zoomBy(multiplier) { setFov(look.fov / multiplier); }
    };
}
