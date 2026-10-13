// Orbits from two-line element sets (TLE): SGP4 propagation by satellite.js (MIT), Earth's shadow and the ground track;
// and where the Sun and the Moon are, from astronomy-engine (MIT, accurate to about an arcminute). Positions are
// geocentric, in kilometres, in the inertial frame of date (TEME for SGP4; x toward the vernal equinox, z north); the
// page maps them to its scene. No DOM and no three.js, so the same code can run in the animation worker. Other
// satellites, or a supply ship on its way up, use the same calls with their own elements.
import * as satellite from 'https://cdn.jsdelivr.net/npm/satellite.js@7.1.0/+esm';
import * as Astronomy from 'https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/+esm';

export const earthRadius = 6371;   // km, mean radius (the globe; SGP4 itself uses 6378.135)
export const moonRadius = 1737.4, sunRadius = 695700;   // km
export const siderealAngle = date => satellite.gstime(date);

// An orbiting object from its TLE lines.
export function orbiter(name, line1, line2) {
    const record = satellite.twoline2satrec(line1, line2);
    if (record.error) throw new Error(name + ': TLE rejected (SGP4 error ' + record.error + ')');
    return {
        name, record,
        epoch: new Date((record.jdsatepoch - 2440587.5) * 86400000),
        period: 2 * Math.PI / record.no,                     // minutes
        inclination: record.inclo * 180 / Math.PI,           // degrees
        eccentricity: record.ecco
    };
}

// Where the object is at a date: inertial position and velocity, Greenwich sidereal angle, latitude, longitude,
// height, speed, and the fraction of the Sun hidden by Earth (0 in sunlight, 1 in umbra).
export function stateAt(object, date) {
    const result = satellite.propagate(object.record, date);
    if (!result || !result.position) return null;
    const { position, velocity } = result, gmst = satellite.gstime(date);
    const geodetic = satellite.eciToGeodetic(position, gmst);
    const sun = satellite.sunPos(satellite.jday(date)).rsun;
    return {
        date, position, velocity, gmst,
        latitude: geodetic.latitude * 180 / Math.PI, longitude: geodetic.longitude * 180 / Math.PI, height: geodetic.height,
        speed: Math.hypot(velocity.x, velocity.y, velocity.z),
        shadow: satellite.shadowFraction(sun, position)
    };
}

// Unit vector toward the Sun at a date, in the same inertial frame.
export function sunDirection(date) {
    const { x, y, z } = satellite.sunPos(satellite.jday(date)).rsun, length = Math.hypot(x, y, z);
    return { x: x / length, y: y / length, z: z / length };
}

// Inertial positions from `from` to `to` minutes around a date: the orbit as it is flown.
export function orbitPath(object, date, from, to, samples) {
    const points = [];
    for (let k = 0; k <= samples; k++) {
        const result = satellite.propagate(object.record, new Date(date.getTime() + (from + (to - from) * k / samples) * 60000));
        if (result && result.position) points.push(result.position);
    }
    return points;
}

// Earth-fixed points under the object (x toward Greenwich, z north, on a sphere of `radius`) from `from` to `to`
// minutes around a date: the ground track.
export function groundTrack(object, date, from, to, samples, radius = earthRadius) {
    const points = [];
    for (let k = 0; k <= samples; k++) {
        const when = new Date(date.getTime() + (from + (to - from) * k / samples) * 60000);
        const result = satellite.propagate(object.record, when);
        if (!result || !result.position) continue;
        const { latitude, longitude } = satellite.eciToGeodetic(result.position, satellite.gstime(when));
        points.push({ x: radius * Math.cos(latitude) * Math.cos(longitude), y: radius * Math.cos(latitude) * Math.sin(longitude), z: radius * Math.sin(latitude), minutes: from + (to - from) * k / samples });
    }
    return points;
}

// astronomy-engine works on the J2000 equator; its vectors are turned to the equator and equinox of date, which TEME
// matches to a few arcseconds (the 26 years of precession since J2000 come to about 0.36 degrees). The turn changes
// slowly, so one is kept for an hour of shown time.
let precession = null, precessionAt = NaN;
function ofDate(vector, date) {
    if (!(Math.abs(date.getTime() - precessionAt) < 3600000)) { precession = Astronomy.Rotation_EQJ_EQD(date); precessionAt = date.getTime(); }
    const turned = Astronomy.RotateVector(precession, vector);
    return { x: turned.x * Astronomy.KM_PER_AU, y: turned.y * Astronomy.KM_PER_AU, z: turned.z * Astronomy.KM_PER_AU };
}
// The Sun as seen from Earth (with aberration) and the Moon, geocentric, in kilometres.
export const sunPosition = date => ofDate(Astronomy.GeoVector(Astronomy.Body.Sun, date, true), date);
export const moonPosition = date => ofDate(Astronomy.GeoVector(Astronomy.Body.Moon, date, false), date);
// Fraction of the Moon's disc lit by the Sun, as seen from Earth (0 new, 1 full).
export const moonLit = date => Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction;
// The Moon's path over one sidereal month centred on a date.
export function moonPath(date, samples) {
    const points = [];
    for (let k = 0; k <= samples; k++) points.push(moonPosition(new Date(date.getTime() + (k / samples - .5) * 27.3217 * 86400000)));
    return points;
}
// Earth's path round the Sun over a year centred on a date, from where Earth is at that date (so it starts at the origin).
export function earthPath(date, samples) {
    const now = Astronomy.HelioVector(Astronomy.Body.Earth, date), time = Astronomy.MakeTime(date), points = [];
    for (let k = 0; k <= samples; k++) {
        const there = Astronomy.HelioVector(Astronomy.Body.Earth, new Date(date.getTime() + (k / samples - .5) * 365.256 * 86400000));
        points.push(ofDate(new Astronomy.Vector(there.x - now.x, there.y - now.y, there.z - now.z, time), date));
    }
    return points;
}
