// The station under the real Sun. From the ISS's elements (SGP4, js/sim/orbit.js) and the Sun's place (astronomy-engine)
// it finds, at the shown time, the Sun's direction in the +XVV frame (forward end along the velocity, zenith up: the
// local vertical, local horizontal frame), then in the station's own frame (x starboard, y zenith, z aft) under its
// attitude (js/orbit/attitude.js: -XVV as flown in November 2026, or ISS Live's), how much of the Sun Earth hides, the
// next sunrise or sunset, and the rotary-joint angles that face the arrays to the Sun: each SARJ turns the outboard
// truss about the truss axis (once an orbit) and each BGA turns a wing about its mast (the beta angle). It loads after
// the page has started; without elements or the libraries (offline) it stays idle and the station keeps its studio
// light and schematic pose.
import { loadElements } from './elements.js';
import { attitude, inStation } from './attitude.js';

let orbit = null, iss = null;
export const sunTrack = {
    state: 'idle',            // idle, loading, ready, failed
    source: '', date: null,
    sun: [0, 1, 0],           // unit vector toward the Sun, station frame (under the attitude)
    xvv: [0, 1, 0],           // the same in the +XVV frame
    shadow: 0,                // 0 in sunlight, 1 in Earth's umbra
    sarj: 0, bga: 0,          // radians: about +x (cell faces from +y toward the Sun), about each mast (+z)
    beta: 0,                  // radians: the Sun above the orbit plane (toward the orbit normal)
    change: null              // { date, sunrise } for the next pass into or out of Earth's shadow
};
export function startSunTrack() {
    if (sunTrack.state !== 'idle') return sunTrack.ready;
    sunTrack.state = 'loading';
    return (sunTrack.ready = Promise.all([import('../sim/orbit.js'), loadElements(25544)]).then(([module, elements]) => {
        orbit = module; iss = orbit.orbiter('ISS (ZARYA)', elements.tle[0], elements.tle[1]);
        sunTrack.source = elements.source; sunTrack.state = 'ready';
    }, error => { sunTrack.state = 'failed'; console.warn('Real Sun unavailable:', error); }));
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const length = Math.hypot(a[0], a[1], a[2]); return [a[0] / length, a[1] / length, a[2] / length]; };
// The Sun from the station at a date: [x, y, z] in the +XVV frame, and Earth's shadow there.
export function sunFromStation(date) {
    const state = orbit.stateAt(iss, date);
    if (!state) return null;
    const { position: r, velocity: v } = state, s = orbit.sunPosition(date);
    const zenith = unit([r.x, r.y, r.z]), starboard = unit(cross([v.x, v.y, v.z], zenith)), aft = cross(starboard, zenith);
    const toward = unit([s.x - r.x, s.y - r.y, s.z - r.z]);
    return { sun: [dot(toward, starboard), dot(toward, zenith), dot(toward, aft)], shadow: state.shadow, state };
}
// Joint angles that face the cells (+y at rest) to a Sun direction: the SARJ brings the Sun into the wing's y-z plane,
// then the BGA tips the cells toward the Sun's x component.
export const sarjFor = sun => Math.atan2(sun[2], sun[1]);
export const bgaFor = sun => Math.atan2(-sun[0], Math.hypot(sun[1], sun[2]));
// The next sunrise or sunset after a date: 20 s steps, then halving to a second.
function nextChange(date) {
    const lit = when => (orbit.stateAt(iss, when)?.shadow ?? 1) < .5;
    const start = date.getTime(), first = lit(date);
    for (let step = 1; step <= 330; step++) {
        const when = start + step * 20000;
        if (lit(new Date(when)) !== first) {
            let low = when - 20000, high = when;
            while (high - low > 1000) { const middle = (low + high) / 2; if (lit(new Date(middle)) === first) low = middle; else high = middle; }
            return { date: new Date(high), sunrise: !first };
        }
    }
    return null;
}
// The Sun in the station's frame under the current attitude, and the joint angles that face the arrays to it.
export function orientSun() {
    sunTrack.sun = inStation(sunTrack.xvv, attitude.turn);
    sunTrack.sarj = sarjFor(sunTrack.sun); sunTrack.bga = bgaFor(sunTrack.sun);
}
// Brings the track to a date; false while it cannot.
export function updateSunTrack(date) {
    if (sunTrack.state !== 'ready') return false;
    const found = sunFromStation(date);
    if (!found) return false;
    sunTrack.date = date; sunTrack.xvv = found.sun; sunTrack.shadow = found.shadow;
    orientSun();
    // Beta belongs to the orbit, not the attitude: in the +XVV frame starboard is minus the orbit normal.
    sunTrack.beta = Math.asin(Math.max(-1, Math.min(1, -found.sun[0])));
    const change = sunTrack.change;
    if (!change || date >= change.date || change.date - date > 100 * 60000 || date < change.from) sunTrack.change = { ...(nextChange(date) || { date: new Date(date.getTime() + 6e6), sunrise: false }), from: date };
    return true;
}
