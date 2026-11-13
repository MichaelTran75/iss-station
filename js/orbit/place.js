// What lies under a point of the globe: a country, or the sea it falls in.
// - Countries: Natural Earth at 1:110 million (world-atlas, 39 kB), tested ring by ring in longitude and latitude. At
//   that scale islands under about 100 km across are missing, so a pass over one reads as the ocean round it.
// - Seas: where no country holds the point. Six enclosed seas by box, the Arctic and Southern oceans by latitude,
//   the rest by which side of two lines the point falls: one down the Americas (Pacific | Atlantic), one from
//   Tasmania through Australia, Java and the Malay Peninsula into Asia (Indian | Pacific). Atlantic | Indian is the
//   meridian of Cape Agulhas. Ocean level only: the boundaries are these lines, not the hydrographic ones.
const source = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
const americas = [[-68.5, -55], [-70, -45], [-67, -30], [-65, -15], [-70, 0], [-75, 6], [-77.5, 8], [-79.8, 9], [-81.5, 8.5], [-83.5, 9.8], [-85, 11.5],
    [-87, 13.8], [-89.5, 15], [-92, 16.3], [-94.8, 17.2], [-98, 19], [-103, 23], [-108, 29], [-113, 35], [-120, 45], [-125, 55], [-135, 62]];
const australasia = [[147, -60], [147, -44], [146.5, -41.5], [145, -37.5], [140, -30], [134, -20], [131, -12.5], [125, -9.2], [122, -8.7], [118, -8.6],
    [114.5, -8.2], [112, -7.6], [107, -7], [105.5, -5], [103.8, 1.3], [101.5, 4.5], [99, 10], [99, 20], [97, 28]];
// West of a line drawn south to north: the nearest stretch of it has the point on its left.
function westOf(line, lon, lat) {
    let best = Infinity, side = 0;
    for (let i = 0; i < line.length - 1; i++) {
        const [ax, ay] = line[i], [bx, by] = line[i + 1], dx = bx - ax, dy = by - ay;
        const along = Math.max(0, Math.min(1, ((lon - ax) * dx + (lat - ay) * dy) / (dx * dx + dy * dy)));
        const distance = Math.hypot(lon - ax - dx * along, lat - ay - dy * along);
        if (distance < best) { best = distance; side = dx * (lat - ay) - dy * (lon - ax); }
    }
    return side > 0;
}
function sea(lat, lon) {
    if (lat > 40.9 && lat < 47.3 && lon > 27.4 && lon < 42) return 'Black Sea';
    if (lat > 36.5 && lat < 47.2 && lon > 46.5 && lon < 54.8) return 'Caspian Sea';
    if (lat > 30 && lat < 46 && lon > -5.6 && lon < 36.3 && !(lat > 43 && lon < 1)) return 'Mediterranean Sea';
    if (lat > 12.5 && lat < 30 && lon > 32 && lon < 43.5) return 'Red Sea';
    if (lat > 23.5 && lat < 30.5 && lon > 47.5 && lon < 56.5) return 'Persian Gulf';
    if (lat > 53.5 && lat < 66 && lon > 9.5 && lon < 30) return 'Baltic Sea';
    if (lat > 66.5) return 'Arctic Ocean';
    if (lat < -60) return 'Southern Ocean';
    const half = lat >= 0 ? 'North ' : 'South ';
    if (lon < -30) return westOf(americas, lon, lat) ? half + 'Pacific Ocean' : half + 'Atlantic Ocean';
    if (lon < 20) return half + 'Atlantic Ocean';
    if (lon < 95) return lat > 31 ? 'Inland waters' : 'Indian Ocean';
    return westOf(australasia, lon, lat) ? 'Indian Ocean' : half + 'Pacific Ocean';
}

let countries = null, loading = null;
function decode(topology) {
    const { scale: [scaleX, scaleY], translate: [moveX, moveY] } = topology.transform;
    const arcs = topology.arcs.map(arc => { let x = 0, y = 0; return arc.map(([dx, dy]) => [(x += dx) * scaleX + moveX, (y += dy) * scaleY + moveY]); });
    const ring = indices => {
        const points = [];
        for (const index of indices) { const arc = index < 0 ? arcs[~index].slice().reverse() : arcs[index]; for (let k = points.length ? 1 : 0; k < arc.length; k++) points.push(arc[k]); }
        return points;
    };
    return topology.objects.countries.geometries.map(geometry => {
        const polygons = (geometry.type === 'Polygon' ? [geometry.arcs] : geometry.type === 'MultiPolygon' ? geometry.arcs : []).map(polygon => {
            const rings = polygon.map(ring), measure = () => {
                const box = [Infinity, Infinity, -Infinity, -Infinity];
                for (const [x, y] of rings[0]) { box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y); }
                return box;
            };
            let box = measure(), east = false;
            // A ring across the 180th meridian (Fiji): its western points are counted on east of 180°, and so is the point tested.
            if (box[2] - box[0] > 180) {
                let low = Infinity, high = -Infinity;
                for (const [x] of rings[0]) { const turned = x < 0 ? x + 360 : x; low = Math.min(low, turned); high = Math.max(high, turned); }
                if (high - low < 180) { for (const points of rings) for (const point of points) if (point[0] < 0) point[0] += 360; box = measure(); east = true; }
            }
            return { rings, box, east };
        });
        return { name: geometry.properties.name, polygons };
    });
}
function inside(points, lon, lat) {
    let within = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [ax, ay] = points[i], [bx, by] = points[j];
        if ((ay > lat) !== (by > lat) && lon < (bx - ax) * (lat - ay) / (by - ay) + ax) within = !within;
    }
    return within;
}
// Starts the download; placeAt answers with seas alone until it lands (or if it never does).
export function loadPlaces() {
    return loading ||= fetch(source).then(response => { if (!response.ok) throw new Error('countries ' + response.status); return response.json(); })
        .then(topology => { countries = decode(topology); }).catch(error => { console.warn('Country outlines unavailable:', error); });
}
// { name, land }: the country at the point, else the sea.
export function placeAt(lat, lon) {
    if (countries) for (const country of countries) for (const { rings, box, east } of country.polygons) {
        const x = east && lon < 0 ? lon + 360 : lon;
        if (x < box[0] || x > box[2] || lat < box[1] || lat > box[3] || !inside(rings[0], x, lat)) continue;
        if (!rings.slice(1).some(hole => inside(hole, x, lat))) return { name: country.name, land: true };
    }
    return { name: sea(lat, lon), land: false };
}
