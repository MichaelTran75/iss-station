// ECMWF ensemble forecast tracks of tropical cyclones, for the wind map (js/orbit/earth-map.js): 51 runs of the IFS
// ensemble (the control and 50 perturbed members) for each storm now active, from ECMWF's open data on AWS
// (`ecmwf-forecasts`, CC BY 4.0, served with CORS). Each run of the model (00 and 12 UTC) leaves one BUFR file of about
// 1.2 MB, `…-enfo-tf.bufr`, some 7 hours after its start. It holds one message per storm in WMO template 3 16 082
// (tropical cyclone track), the 51 members as compressed subsets: per member the storm's place, central pressure and
// strongest wind every 6 hours for as long as the model keeps the storm (up to 15 days).
//
// Only what that template needs is decoded here: BUFR edition 4, compressed data, Table B and D entries copied from
// ECMWF's ecCodes definitions (WMO master table 35), delayed and plain replication, and the change of data width
// operator (2 01 YYY).

const bucket = 'https://ecmwf-forecasts.s3.eu-central-1.amazonaws.com/';
// Table B: [scale, reference, width, string]. Code and flag tables keep their width (2 01 YYY does not widen them).
const elements = {
    1033: [0, 0, 8, 0, 1], 1034: [0, 0, 8, 0, 1], 1032: [0, 0, 8, 0, 1], 1025: [0, 0, 24, 1], 1027: [0, 0, 80, 1],
    1090: [0, 0, 8, 0, 1], 1091: [0, 0, 10], 1092: [0, 0, 8, 0, 1], 4001: [0, 0, 12], 4002: [0, 0, 4], 4003: [0, 0, 6],
    4004: [0, 0, 5], 4005: [0, 0, 6], 8005: [0, 0, 4, 0, 1], 5002: [2, -9000, 15], 6002: [2, -18000, 16], 10051: [-1, 0, 14],
    11012: [1, 0, 12], 19003: [0, 0, 8], 19004: [-2, 0, 12], 5021: [2, 0, 16], 31001: [0, 0, 8], 8021: [0, 0, 5, 0, 1],
    4024: [0, -2048, 12]
};
// Table D, as written there (FXXYYY numbers).
const sequences = {
    316082: [1033, 1034, 1032, 1025, 1027, 1090, 1091, 1092, 301011, 301012, 8005, 301023, 8005, 301023, 10051, 8005, 301023,
        11012, 107003, 19003, 105004, 5021, 5021, 201131, 19004, 201000, 116000, 31001, 8021, 4024, 8005, 301023, 10051,
        8005, 301023, 11012, 107003, 19003, 105004, 5021, 5021, 201131, 19004, 201000],
    301011: [4001, 4002, 4003], 301012: [4004, 4005], 301023: [5002, 6002]
};

const skipped = new Error('storm not wanted');

// Reads bits from a byte array, most significant first.
function bitReader(bytes, start) {
    let at = start * 8;
    return {
        read(width) {
            let value = 0;
            while (width > 0) {
                const used = at & 7, take = Math.min(8 - used, width);
                value = value * (1 << take) + ((bytes[at >> 3] >> (8 - used - take)) & ((1 << take) - 1));
                at += take; width -= take;
            }
            return value;
        },
        skip(bits) { at += bits; }
    };
}

// One message: for each subset, the list of [descriptor, value] in order. Numbers come back scaled, missing values as
// null, strings trimmed. Compressed messages hold every subset side by side (the same layout for all of them);
// uncompressed ones one after the other.
function decodeMessage(bytes, start, keep) {
    const u24 = at => bytes[at] << 16 | bytes[at + 1] << 8 | bytes[at + 2];
    const length = u24(start + 4);
    if (bytes[start + 7] !== 4) throw new Error('BUFR edition ' + bytes[start + 7]);
    let at = start + 8;
    const section1 = u24(at), optional = bytes[at + 9] & 0x80;
    at += section1;
    if (optional) at += u24(at);
    const section3 = u24(at), subsets = bytes[at + 4] << 8 | bytes[at + 5], compressed = !!(bytes[at + 6] & 0x40);
    const root = [];
    for (let k = at + 7; k + 1 < at + section3; k += 2) {
        const v = bytes[k] << 8 | bytes[k + 1], f = v >> 14, x = (v >> 8) & 63, y = v & 255;
        if (f || x || y) root.push(f * 100000 + x * 1000 + y);
    }
    at += section3;
    const bits = bitReader(bytes, at + 4), lists = Array.from({ length: subsets }, () => []);
    const missing = width => 2 ** width - 1, text = count => { let out = ''; for (let i = 0; i < count; i++) out += String.fromCharCode(bits.read(8)); return out.trim(); };
    let widen = 0, only = 0;

    // The value(s) of one element: for every subset when compressed, else for subset `only`. Returns the first.
    function element(code) {
        const entry = elements[code];
        if (!entry) throw new Error('BUFR element ' + code);
        const [scale, reference, plain, string, table] = entry, factor = 10 ** -scale;
        if (string) {
            let value;
            if (!compressed) { value = text(plain / 8); lists[only].push([code, value]); }
            else {
                const base = text(plain / 8), increment = bits.read(6);
                for (let s = 0; s < subsets; s++) lists[s].push([code, increment ? text(increment) : base]);
                value = lists[0].at(-1)[1];
            }
            if (code === 1025 && !keep(value)) throw skipped;
            return value;
        }
        const width = plain + (table ? 0 : widen);
        if (!compressed) {
            const raw = bits.read(width), value = raw === missing(width) ? null : (raw + reference) * factor;
            lists[only].push([code, value]); return value;
        }
        const base = bits.read(width), increment = bits.read(6);
        for (let s = 0; s < subsets; s++) {
            let value;
            if (!increment) value = base === missing(width) ? null : (base + reference) * factor;
            else { const step = bits.read(increment); value = step === missing(increment) ? null : (base + step + reference) * factor; }
            lists[s].push([code, value]);
        }
        return lists[0].at(-1)[1];
    }
    function walk(list) {
        for (let i = 0; i < list.length; i++) {
            const code = list[i], f = Math.floor(code / 100000), x = Math.floor(code / 1000) % 100, y = code % 1000;
            if (f === 0) element(code);
            else if (f === 3) { if (!sequences[code]) throw new Error('BUFR sequence ' + code); walk(sequences[code]); }
            else if (f === 2) { if (x === 1) widen = y ? y - 128 : 0; else throw new Error('BUFR operator ' + code); }
            else {
                // Replication: x descriptors, y times (0: the next element gives the count; in a compressed message the
                // same count for every subset).
                let times = y, body;
                if (!y) { times = element(list[i + 1]) || 0; body = list.slice(i + 2, i + 2 + x); i += 1 + x; }
                else { body = list.slice(i + 1, i + 1 + x); i += x; }
                for (let r = 0; r < times; r++) walk(body);
            }
        }
    }
    try {
        if (compressed) walk(root);
        else for (only = 0; only < subsets; only++) { widen = 0; walk(root); }
    } catch (error) { if (error === skipped) return { length, lists: [] }; throw error; }
    return { length, lists };
}

// Each storm: its id ("38W"), the start of the run, and per member a list of [hours, lat, lon, pressure hPa, wind m/s]:
// first the member's own analysis of the storm (008005 = 4, the place in the perturbed analysis), then every 6 hours
// the centre (008005 = 1) with its central pressure and the strongest wind near it, for as long as the member keeps it.
// `keep(id)` picks the storms to decode (the others are skipped after their id).
export function decodeTracks(buffer, keep = () => true) {
    const bytes = new Uint8Array(buffer), storms = new Map();
    for (let at = 0; at + 8 < bytes.length;) {
        if (bytes[at] !== 66 || bytes[at + 1] !== 85 || bytes[at + 2] !== 70 || bytes[at + 3] !== 82) { at++; continue; }
        const { length, lists } = decodeMessage(bytes, at, keep);
        at += length;
        for (const list of lists) {
            const find = (code, from, value) => { for (let k = from; k < list.length; k++) if (list[k][0] === code && (value === undefined || list[k][1] === value)) return k; return -1; };
            const get = code => list[find(code, 0)]?.[1];
            const id = get(1025), start = Date.UTC(get(4001), get(4002) - 1, get(4003), get(4004)), points = [];
            const add = (hours, centre) => {
                if (centre < 0) return;
                const lat = list[centre + 1][1], lon = list[centre + 2][1], pressure = list[find(10051, centre)]?.[1], wind = list[find(11012, centre)]?.[1];
                if (lat != null && lon != null && hours != null) points.push([hours, lat, lon, pressure == null ? null : pressure / 100, wind ?? null]);
            };
            const first = find(4024, 0);
            add(0, find(8005, 0, 4));
            for (let k = first; k >= 0; k = find(4024, k + 1)) add(list[k][1], find(8005, k, 1));
            if (points.length < 2) continue;
            if (!storms.has(id)) storms.set(id, { id, start, members: [] });
            storms.get(id).members.push({ member: get(1091), points });
        }
    }
    return [...storms.values()];
}

// The newest run whose track file is there: tries the last runs, newest first. Storms the model only expects to form
// (ids 70 to 79 of each basin, ECMWF's genesis tracker; it also follows each observed storm again under such an id)
// are left out.
export const observed = id => !/^7\d/.test(id);
export async function loadEnsemble(now = Date.now(), keep = observed) {
    const twelve = 12 * 3600e3;
    for (let run = Math.floor((now - 7 * 3600e3) / twelve) * twelve, tries = 0; tries < 4; tries++, run -= twelve) {
        const date = new Date(run), day = date.toISOString().slice(0, 10).replaceAll('-', ''), hour = date.toISOString().slice(11, 13);
        const response = await fetch(`${bucket}${day}/${hour}z/ifs/0p25/enfo/${day}${hour}0000-360h-enfo-tf.bufr`).catch(() => null);
        if (!response || !response.ok) continue;
        return { run, storms: decodeTracks(await response.arrayBuffer(), keep) };
    }
    throw new Error('no ECMWF track file');
}
