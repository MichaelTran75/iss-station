// NOAA GFS fields straight from NOAA's own copy on AWS (NOAA Open Data Dissemination, bucket noaa-gfs-bdp-pds): each
// forecast file (pgrb2, 1° or 0.5°) has an index (.idx) giving every field's byte offset, so only the fields wanted are
// fetched, by byte range, and decoded here (js/orbit/grib2.js). The bucket answers any origin (CORS *).
// - Runs: 00, 06, 12, 18 UTC, on the bucket about 3.5 h later. The newest run whose index is there is used; for a time
//   less than 3 h after it (no rain average yet) the run before. Hours: 1-hourly to 120, 3-hourly to 384.
// - Fields: `ugrd10m` / `vgrd10m` (10 m wind, m/s) and `pratesfc` (precipitation rate, kg m-2 s-1, the mean since the
//   last 6-hourly reset: over 0-3 or 0-6 h), the names the PacIOOS ERDDAP server uses for the same fields.
// loadGfs(step, names, resolution) → { fields: [Float32Array], time, run }: rows from 90° N south, columns from 0° east.
import { decodeGrib2 } from './grib2.js?v=8f08c937bc';

const bucket = 'https://noaa-gfs-bdp-pds.s3.amazonaws.com/', hour = 3600000, sixHours = 6 * hour;
const wanted = {
    ugrd10m: ([, , , name, level]) => name === 'UGRD' && level === '10 m above ground',
    vgrd10m: ([, , , name, level]) => name === 'VGRD' && level === '10 m above ground',
    pratesfc: ([, , , name, level, span]) => name === 'PRATE' && level === 'surface' && / ave fcst$/.test(span)
};
const pad = (value, size = 2) => String(value).padStart(size, '0');
function fileOf(run, resolution, forecastHour) {
    const date = new Date(run), day = date.getUTCFullYear() + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()), cycle = pad(date.getUTCHours());
    return bucket + 'gfs.' + day + '/' + cycle + '/atmos/gfs.t' + cycle + 'z.pgrb2.' + resolution + '.f' + pad(forecastHour, 3);
}
// Indexes by file, kept (a run's files never change); the newest run found, looked for again after 20 minutes.
const indexes = new Map();
function indexOf(url) {
    if (!indexes.has(url)) indexes.set(url, fetch(url + '.idx').then(response => {
        if (!response.ok) throw new Error('GFS index ' + response.status);
        return response.text();
    }).then(text => text.trim().split('\n').map(line => line.split(':'))).catch(error => { indexes.delete(url); throw error; }));
    return indexes.get(url);
}
// One search at a time, shared by every field (the 1° file's index at +3 h stands for the run).
let newest = null, newestAt = -Infinity;
function newestRun() {
    if (newest && performance.now() - newestAt < 20 * 60000) return newest;
    newestAt = performance.now();
    return newest = (async () => {
        let run = Math.floor((Date.now() - 3.5 * hour) / sixHours) * sixHours;
        for (let tries = 0; tries < 4; tries++, run -= sixHours) {
            try { await indexOf(fileOf(run, '1p00', 3)); return run; } catch (error) { /* not there yet: the run before */ }
        }
        throw new Error('no GFS run found on AWS');
    })().catch(error => { newest = null; throw error; });
}

export async function loadGfs(step, names, resolution) {
    let run = await newestRun();
    if (step < run + 3 * hour) run = Math.floor((step - 3 * hour) / sixHours) * sixHours;
    const forecastHour = Math.round((step - run) / hour);
    if (forecastHour > 384 || (forecastHour > 120 && forecastHour % 3)) throw new Error('no GFS hour for ' + new Date(step).toISOString());
    const url = fileOf(run, resolution, forecastHour), index = await indexOf(url);
    // Each field's byte range (to the next field's start), neighbours fetched together.
    const pieces = names.map(name => {
        const at = index.findIndex(wanted[name]);
        if (at < 0 || at === index.length - 1) throw new Error('GFS field ' + name + ' not in ' + url);
        return { name, start: +index[at][1], end: +index[at + 1][1] - 1 };
    });
    const ranges = [];
    for (const piece of [...pieces].sort((a, b) => a.start - b.start)) {
        const last = ranges[ranges.length - 1];
        if (last && piece.start === last.end + 1) { last.end = piece.end; last.pieces.push(piece); } else ranges.push({ start: piece.start, end: piece.end, pieces: [piece] });
    }
    const decoded = new Map();
    await Promise.all(ranges.map(async range => {
        const response = await fetch(url, { headers: { Range: 'bytes=' + range.start + '-' + range.end } });
        if (response.status !== 206) throw new Error('GFS range ' + response.status);
        const buffer = await response.arrayBuffer();
        for (const piece of range.pieces) decoded.set(piece.name, decodeGrib2(buffer.slice(piece.start - range.start, piece.end - range.start + 1)));
    }));
    return { fields: names.map(name => decoded.get(name).values), time: new Date(step), run: new Date(run), columns: decoded.get(names[0]).columns };
}
