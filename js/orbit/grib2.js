// A GRIB2 reader for the fields the Orbit view's map takes from NOAA GFS (js/orbit/gfs.js): one message, a regular
// latitude-longitude grid (grid template 3.0), no bitmap, packed by complex packing with spatial differencing (data
// representation template 5.3), the way NCEP packs GFS. Anything else throws.
// - Sign-magnitude integers: GRIB2 keeps the sign in the top bit (scale factors, the differencing's first values).
// - Template 5.3: the values are cut into groups, each a reference and a bit width; the unpacked integers are second
//   (or first) differences, undone from the first values with the overall minimum added back. Value = (R + X · 2^E) / 10^D.
// Returns { values: Float32Array, columns, rows } in the message's own order (GFS: rows from 90° N south, columns from 0° east).

function bitReader(bytes, start) {
    let at = start * 8;
    return {
        read(width) {
            let value = 0;
            for (let k = 0; k < width; k++, at++) value = value * 2 + ((bytes[at >> 3] >> (7 - (at & 7))) & 1);
            return value;
        },
        align() { at = Math.ceil(at / 8) * 8; },
        get offset() { return at; }
    };
}
const signed16 = (view, at) => { const raw = view.getUint16(at); return raw & 0x8000 ? -(raw & 0x7fff) : raw; };
const signedOf = (raw, width) => { const top = 2 ** (width - 1); return raw >= top ? -(raw - top) : raw; };

export function decodeGrib2(buffer) {
    const bytes = new Uint8Array(buffer), view = new DataView(buffer);
    if (view.getUint32(0) !== 0x47524942 || bytes[7] !== 2) throw new Error('not GRIB2');
    const sections = {};
    let at = 16;
    while (at < bytes.length - 4 && view.getUint32(at) !== 0x37373737) {
        const length = view.getUint32(at), number = bytes[at + 4];
        sections[number] = at; at += length;
    }
    if (sections[3] === undefined || sections[5] === undefined || sections[7] === undefined) throw new Error('GRIB2 message incomplete');
    const s3 = sections[3], s5 = sections[5], s7 = sections[7];
    if (view.getUint16(s3 + 12) !== 0) throw new Error('grid template ' + view.getUint16(s3 + 12));
    const columns = view.getUint32(s3 + 30), rows = view.getUint32(s3 + 34);
    if (sections[6] !== undefined && bytes[sections[6] + 5] !== 255) throw new Error('bitmap not handled');
    const template = view.getUint16(s5 + 9), count = view.getUint32(s5 + 5);
    if (template !== 3) throw new Error('data template ' + template);
    if (count !== columns * rows) throw new Error('points ' + count);

    const reference = view.getFloat32(s5 + 11), binary = signed16(view, s5 + 15), decimal = signed16(view, s5 + 17);
    const referenceBits = bytes[s5 + 19], missing = bytes[s5 + 22];
    if (missing !== 0) throw new Error('missing values not handled');
    const groups = view.getUint32(s5 + 31), widthReference = bytes[s5 + 35], widthBits = bytes[s5 + 36];
    const lengthReference = view.getUint32(s5 + 37), lengthStep = bytes[s5 + 41], lastLength = view.getUint32(s5 + 42), lengthBits = bytes[s5 + 46];
    const order = bytes[s5 + 47], extraBytes = bytes[s5 + 48];

    const bits = bitReader(bytes, s7 + 5);
    const first = [];
    let minimum = 0;
    if (order > 0) {
        for (let k = 0; k < order; k++) first.push(signedOf(bits.read(extraBytes * 8), extraBytes * 8));
        minimum = signedOf(bits.read(extraBytes * 8), extraBytes * 8);
    }
    const groupReference = new Uint32Array(groups), groupWidth = new Uint8Array(groups), groupLength = new Uint32Array(groups);
    for (let g = 0; g < groups; g++) groupReference[g] = bits.read(referenceBits);
    bits.align();
    for (let g = 0; g < groups; g++) groupWidth[g] = widthReference + bits.read(widthBits);
    bits.align();
    for (let g = 0; g < groups; g++) groupLength[g] = lengthReference + bits.read(lengthBits) * lengthStep;
    bits.align();
    groupLength[groups - 1] = lastLength;

    const unpacked = new Float64Array(count);
    let n = 0;
    for (let g = 0; g < groups; g++) {
        const width = groupWidth[g], base = groupReference[g], length = groupLength[g];
        if (n + length > count) throw new Error('groups overrun the grid');
        if (width === 0) for (let k = 0; k < length; k++) unpacked[n++] = base;
        else for (let k = 0; k < length; k++) unpacked[n++] = base + bits.read(width);
    }
    if (n !== count) throw new Error('groups cover ' + n + ' of ' + count);
    if (order === 1) {
        unpacked[0] = first[0];
        for (let k = 1; k < count; k++) unpacked[k] = unpacked[k] + minimum + unpacked[k - 1];
    } else if (order === 2) {
        unpacked[0] = first[0]; unpacked[1] = first[1];
        for (let k = 2; k < count; k++) unpacked[k] = unpacked[k] + minimum + 2 * unpacked[k - 1] - unpacked[k - 2];
    }
    const values = new Float32Array(count), scale = 2 ** binary, divide = 10 ** decimal;
    for (let k = 0; k < count; k++) values[k] = (reference + unpacked[k] * scale) / divide;
    return { values, columns, rows };
}
