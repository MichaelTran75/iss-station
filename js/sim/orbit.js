// Orbits from two-line element sets (TLE): SGP4 propagation by satellite.js (MIT), the Sun's direction, Earth's shadow
// and the ground track. Positions are in the TEME inertial frame in kilometres (x toward the vernal equinox, z north);
// the page maps them to its scene. No DOM and no three.js, so the same code can run in the animation worker. Other
// satellites, or a supply ship on its way up, use the same calls with their own elements.
import * as satellite from 'https://cdn.jsdelivr.net/npm/satellite.js@7.1.0/+esm';

export const earthRadius = 6371;   // km, mean radius (the globe; SGP4 itself uses 6378.135)

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
