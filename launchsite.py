#!/usr/bin/env python3
"""Dựng data/launch-site.json: các công trình quanh LC-39A trong vùng ảnh 17 km của góc nhìn Launch.

    python3 launchsite.py <thư mục tải>

Cần numpy, Pillow, shapely, laspy với lazrs (pip install numpy pillow shapely "laspy[lazrs]"). Lần đầu tải khoảng
130 MB vào <thư mục tải> (lidar, OSM, USA Structures, ảnh USGS); lần sau đọc lại từ đó.

Nguồn và cách làm:
- Khung nhà: OpenStreetMap (© OpenStreetMap contributors, ODbL) qua Overpass. Chỗ OSM không có thì lấy khung của USA
  Structures (FEMA/ORNL, public domain).
- Công trình có đứng đó không, và cao bao nhiêu: lidar USGS 3DEP FL_Peninsular_FDEM_Brevard_2018 (public domain), bay
  tháng 1–2/2019, 16 tháng trước Demo-2. Lidar không thấy thì bỏ: tháp Starship và khu bồn nằm ngang ở 39A, quả cầu
  hydro mới ở 39B, Hangar X, Gigabay đều xây sau. Nhà lớn phải có điểm lidar xếp lớp "nhà" (lớp 6), vì bãi đất trống
  mọc bụi cũng cao 2–5 m; chòi, kiốt nhỏ thì lidar không xếp lớp, chỉ cần phần lớn điểm cao hơn đất.
- Mái: phân vị 60 của độ cao cao nhất trong từng ô 2 m trong khung, so với mặt đất quanh nó (trung vị điểm đất trong vành
  2–15 m quanh khung). Mái có hai tầng tách bạch (khoang cao trên dãy thấp, hở trên 3,5 m) thì tách thành hai khối.
  Trên gò bệ phóng, mái tính từ mặt đất tự nhiên quanh bệ.
- Màu mái: trung vị điểm ảnh USGS z16 (2 m/px) trong khung.
- Tháp thu sét, cột viễn thông, tháp khí tượng, cột đèn, đuốc đốt: nút OSM; vị trí (tâm các điểm cao) và đỉnh từ lidar.
- Cầu nhiên liệu và bồn tháp nước: khớp mặt cầu vào điểm lidar (tâm, bán kính, sai số dưới 0,3 m).
Những gì js/launch/complex.js và ground.js dựng tay (VAB, LCC, nhà lắp ráp của SpaceX ở 39A, tháp và bệ 39A, tháp thu
sét 39B, rãnh lửa) không lấy từ đây.

Toạ độ: hệ của bệ (x đông, z nam, mét), như js/launch/ground.js: cầu bán kính 6371 km, gốc ở LC-39A.
"""
import concurrent.futures, io, json, math, pathlib, subprocess, sys, urllib.error, urllib.parse, urllib.request

import laspy
import numpy as np
import shapely
from PIL import Image
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

HERE = pathlib.Path(__file__).resolve().parent
TARGET = HERE / 'data' / 'launch-site.json'
LAT, LON, R = 28.60822, -80.60411, 6371000.0   # launchSite in js/sim/ascent.js; the sphere of js/launch/ground.js
rad = math.pi / 180
AGENT = 'iss-station launchsite.py (https://github.com/MichaelTran75/iss-station)'
EPT = 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/FL_Peninsular_FDEM_Brevard_2018/'
USA = 'https://services2.arcgis.com/FiaPA4ga0iQKduv3/ArcGIS/rest/services/USA_Structures_View/FeatureServer/0/query'
USGS = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/%d/%d/%d'
# Built by hand in js/launch/complex.js and ground.js, or not wanted from OSM: the VAB, its bays and the bridge to the
# LCC; the LCC; SpaceX's hangar at 39A; 39A's tower and pad; the pads' spheres (fitted below); the tank beside 39A's
# LOX sphere; SLC-41's flame trench (a hole); a stair tower drawn into the VAB's west face.
MODELLED = {'w26929904', 'w152354450', 'w152357389', 'w152357392', 'w152357395', 'w37428244', 'w152357396',
            'w37428230', 'w475501780', 'w569088673', 'w568771622', 'w153125071', 'w153125073', 'w153128950',
            'w153128951', 'w1242558079', 'w569046761'}
# 39B's lightning towers, their footings and its water tower, drawn in OSM as stacked pieces.
MODELLED_RANGES = [(1241987429, 1241987447), (1241990983, 1241991014)]
# The pads' raised hardstands, as js/launch/complex.js has them (x, z, deck, west, east, north, south, ramp).
PADS = [{'name': '39A', 'x': 0, 'z': 0, 'deck': 12, 'west': 62, 'east': 58, 'north': 58, 'south': 42, 'rampHalf': 30, 'rampLength': 240},
        {'name': '39B', 'x': -1635, 'z': -2114, 'deck': 12, 'west': 60, 'east': 60, 'north': 55, 'south': 45, 'rampHalf': 30, 'rampLength': 240}]

if len(sys.argv) != 2: sys.exit(__doc__)
CACHE = pathlib.Path(sys.argv[1]).expanduser().resolve(); CACHE.mkdir(parents=True, exist_ok=True)


def fetch(url, path, data=None):
    if path.exists() and path.stat().st_size: return path.read_bytes()
    try:
        request = urllib.request.Request(url, data=data, headers={'User-Agent': AGENT})
        with urllib.request.urlopen(request, timeout=240) as response: body = response.read()
    except urllib.error.URLError as error:
        if 'SSL' not in str(error): raise
        # macOS's own Python (LibreSSL) cannot shake hands with some of these servers; curl can.
        body = subprocess.run(['curl', '-sfL', '-A', AGENT, *(['--data-binary', '@-'] if data else []), url], input=data, capture_output=True, check=True, timeout=300).stdout
    path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(body)
    return body


# The pad's frame (js/sim/ascent.js padFrame()).
phi0, lam0 = LAT * rad, LON * rad
EAST = np.array([-math.sin(lam0), math.cos(lam0), 0.0])
NORTH = np.array([-math.sin(phi0) * math.cos(lam0), -math.sin(phi0) * math.sin(lam0), math.cos(phi0)])
UP = np.array([math.cos(phi0) * math.cos(lam0), math.cos(phi0) * math.sin(lam0), math.sin(phi0)])
PAD = UP * R


def local(lat, lon):
    lat, lon = np.radians(np.asarray(lat, float)), np.radians(np.asarray(lon, float))
    p = np.stack([R * np.cos(lat) * np.cos(lon), R * np.cos(lat) * np.sin(lon), R * np.sin(lat)], -1) - PAD
    return (p * EAST).sum(-1), -(p * NORTH).sum(-1)   # (not @: Accelerate's matmul raises spurious FP warnings)


def merc(lon, lat):
    return lon * rad * 6378137, math.log(math.tan(math.pi / 4 + lat * rad / 2)) * 6378137


# The imagery's middle ring (zoom 13, 4 × 4 tiles round the pad, as ground.js picks them): south, west, north, east.
def ring():
    n = 2 ** 13
    tx = (LON + 180) / 360 * n; ty = (1 - math.log(math.tan(phi0) + 1 / math.cos(phi0)) / math.pi) / 2 * n
    x0, y0 = math.floor(tx + .5) - 2, math.floor(ty + .5) - 2
    lat = lambda y: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lat(y0 + 4), x0 / n * 360 - 180, lat(y0), (x0 + 4) / n * 360 - 180


SOUTH, WEST, NORTHMOST, EASTMOST = ring()
BBOX = '%.5f,%.5f,%.5f,%.5f' % (SOUTH, WEST, NORTHMOST, EASTMOST)

# --- OpenStreetMap -------------------------------------------------------------------------------------------------
query = '[out:json][timeout:180];(way["building"](%s);relation["building"](%s);way["building:part"](%s);' \
        'node["man_made"~"^(tower|mast|water_tower|flare)$"](%s);node["tower:type"](%s););out geom tags;' % ((BBOX,) * 5)
for server in ('https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'):
    try: osm = json.loads(fetch(server, CACHE / 'osm.json', urllib.parse.urlencode({'data': query}).encode())); break
    except (subprocess.CalledProcessError, urllib.error.URLError, ValueError) as error: print('Overpass %s: %s' % (server, error))
else: sys.exit('launchsite.py: không máy chủ Overpass nào trả lời')


def join(ways):
    # Open member ways joined end to end into closed rings.
    key = lambda p: (round(p['lat'], 7), round(p['lon'], 7))
    rings, pool = [], [w[:] for w in ways if w]
    while pool:
        r = pool.pop(0)
        while key(r[0]) != key(r[-1]):
            for i, w in enumerate(pool):
                if key(w[0]) == key(r[-1]): r += w[1:]; pool.pop(i); break
                if key(w[-1]) == key(r[-1]): r += w[::-1][1:]; pool.pop(i); break
            else: break
        rings.append(r)
    return rings


def ring_poly(points):
    x, z = local([p['lat'] for p in points], [p['lon'] for p in points])
    return Polygon(np.c_[x, z]).buffer(0) if len(points) >= 4 else None


footprints, nodes = [], []
for e in osm['elements']:
    tags = e.get('tags', {})
    if e['type'] == 'node':
        x, z = local(e['lat'], e['lon']); nodes.append({'id': 'n%d' % e['id'], 'tags': tags, 'x': float(x), 'z': float(z)})
        continue
    if e['type'] == 'way':
        g = e.get('geometry') or []
        if len(g) < 4 or (g[0]['lat'], g[0]['lon']) != (g[-1]['lat'], g[-1]['lon']): continue
        shape = ring_poly(g)
    else:
        outer = [ring_poly(r) for r in join([m['geometry'] for m in e.get('members', []) if m.get('role') == 'outer' and m.get('geometry')])]
        inner = [ring_poly(r) for r in join([m['geometry'] for m in e.get('members', []) if m.get('role') == 'inner' and m.get('geometry')])]
        outer = [p for p in outer if p is not None and not p.is_empty]
        if not outer: continue
        shape = unary_union(outer)
        for p in inner:
            if p is not None: shape = shape.difference(p)
    if shape is None or shape.is_empty: continue
    footprints.append({'id': e['type'][0] + str(e['id']), 'tags': tags, 'shape': shape})

# --- USA Structures, for what OSM lacks ----------------------------------------------------------------------------
usa = []
for offset in range(0, 20000, 2000):
    params = {'geometry': '%.5f,%.5f,%.5f,%.5f' % (WEST, SOUTH, EASTMOST, NORTHMOST), 'geometryType': 'esriGeometryEnvelope', 'inSR': 4326,
              'spatialRel': 'esriSpatialRelIntersects', 'where': '1=1', 'outFields': 'BUILD_ID,HEIGHT', 'outSR': 4326,
              'resultOffset': offset, 'resultRecordCount': 2000, 'orderByFields': 'OBJECTID', 'f': 'geojson'}
    page = json.loads(fetch(USA + '?' + urllib.parse.urlencode(params), CACHE / ('usa-%d.geojson' % offset)))
    for f in page.get('features', []):
        g = f['geometry']
        for poly in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]):
            rings = [np.c_[local([p[1] for p in r], [p[0] for p in r])] for r in poly]
            shape = Polygon(rings[0], rings[1:]).buffer(0)
            if not shape.is_empty: usa.append({'id': 'usa%d' % f['properties']['BUILD_ID'], 'tags': {}, 'shape': shape})
    if len(page.get('features', [])) < 2000: break
print('OSM: %d khung, %d nút; USA Structures: %d khung' % (len(footprints), len(nodes), len(usa)))

# --- Lidar ---------------------------------------------------------------------------------------------------------
info = json.loads(fetch(EPT + 'ept.json', CACHE / 'lidar' / 'ept.json'))
cube = info['bounds']; width = cube[3] - cube[0]
hierarchy = dict(json.loads(fetch(EPT + 'ept-hierarchy/0-0-0-0.json', CACHE / 'lidar' / 'hierarchy' / '0-0-0-0.json')))
# Areas the points are wanted in: every footprint and node, 25 m round (for the ground about it), in Web Mercator.
inverse = lambda x, z: (LAT - z / R / rad, LON + x / (R * math.cos(phi0)) / rad)
boxes = []
for item in footprints + usa:
    x0, z0, x1, z1 = item['shape'].bounds
    (la0, lo0), (la1, lo1) = inverse(x0 - 45, z1 + 45), inverse(x1 + 45, z0 - 45)
    boxes.append((*merc(lo0, la0), *merc(lo1, la1)))
for n in nodes:
    (la0, lo0), (la1, lo1) = inverse(n['x'] - 45, n['z'] + 45), inverse(n['x'] + 45, n['z'] - 45)
    boxes.append((*merc(lo0, la0), *merc(lo1, la1)))
boxes = np.array(boxes)


def node_box(key):
    d, i, j, _ = map(int, key.split('-')); w = width / 2 ** d
    return cube[0] + i * w, cube[1] + j * w, cube[0] + (i + 1) * w, cube[1] + (j + 1) * w


def touches(key):
    x0, y0, x1, y1 = node_box(key)
    return bool(((boxes[:, 2] > x0) & (boxes[:, 0] < x1) & (boxes[:, 3] > y0) & (boxes[:, 1] < y1)).any())


for key in [k for k, v in hierarchy.items() if v == -1 and touches(k)]:
    hierarchy.update(json.loads(fetch(EPT + 'ept-hierarchy/%s.json' % key, CACHE / 'lidar' / 'hierarchy' / ('%s.json' % key))))
wanted = sorted(k for k, v in hierarchy.items() if v > 0 and 5 <= int(k.split('-')[0]) <= 9 and touches(k))
print('lidar: %d ô (độ sâu 5–9)' % len(wanted))
with concurrent.futures.ThreadPoolExecutor(8) as pool:
    paths = list(pool.map(lambda k: (fetch(EPT + 'ept-data/%s.laz' % k, CACHE / 'lidar' / 'laz' / ('%s.laz' % k)), CACHE / 'lidar' / 'laz' / ('%s.laz' % k))[1], wanted))
parts, flown = [], []
for path in paths:
    f = laspy.read(path)
    mx, my = np.asarray(f.x), np.asarray(f.y)
    keep = np.zeros(len(mx), bool)
    for x0, y0, x1, y1 in boxes[(boxes[:, 2] > mx.min()) & (boxes[:, 0] < mx.max()) & (boxes[:, 3] > my.min()) & (boxes[:, 1] < my.max())]:
        keep |= (mx > x0) & (mx < x1) & (my > y0) & (my < y1)
    if not keep.any(): continue
    lon = np.degrees(mx[keep] / 6378137); lat = np.degrees(2 * np.arctan(np.exp(my[keep] / 6378137)) - math.pi / 2)
    x, z = local(lat, lon)
    parts.append((x, z, np.asarray(f.z)[keep], np.asarray(f.classification)[keep]))
    flown.append(np.asarray(f.gps_time)[keep])
X, Z, Y, C = (np.concatenate([p[k] for p in parts]) for k in range(4))
order = np.argsort(X); X, Z, Y, C = X[order], Z[order], Y[order], C[order]
gps = np.concatenate(flown); seconds = lambda t: np.datetime64('1980-01-06T00:00:00') + np.timedelta64(int(t + 1e9 - 18), 's')
FLOWN = '%s – %s' % (str(seconds(np.percentile(gps, 1)))[:10], str(seconds(np.percentile(gps, 99)))[:10])   # adjusted standard GPS time
print('lidar: %d điểm, bay %s' % (len(X), FLOWN))
SOLID = (C != 7) & (C != 18) & (C != 9)   # not noise, not water


def window(x0, z0, x1, z1):
    a, b = np.searchsorted(X, x0), np.searchsorted(X, x1)
    s = np.arange(a, b); s = s[(Z[s] > z0) & (Z[s] < z1)]
    return s


def ground_round(shape):
    x0, z0, x1, z1 = shape.bounds
    s = window(x0 - 95, z0 - 95, x1 + 95, z1 + 95); s = s[C[s] == 2]
    for reach in (15, 40, 90):
        inside = shapely.contains_xy(shape.buffer(reach).difference(shape.buffer(2)), X[s], Z[s])
        if inside.sum() >= 5: return float(np.median(Y[s][inside]))
    return None


def mound(x, z):
    # Height of a pad's hardstand above the ground round it (js/launch/complex.js terrainHeight()).
    h = 0
    for p in PADS:
        dx, dz = x - p['x'], z - p['z']
        if abs(dx) > 200 or dz < -200 or dz > 400: continue
        ox, oz = max(0, dx - p['east'], -p['west'] - dx), max(0, dz - p['south'], -p['north'] - dz)
        m = p['deck'] * max(0, 1 - max(ox, oz, (ox + oz) * .72) / 30)
        if dz > p['south']: m = max(m, p['deck'] * max(0, 1 - (dz - p['south']) / p['rampLength']) - p['deck'] * max(0, abs(dx) - p['rampHalf']) / 30)
        h = max(h, m)
    return h


# The natural ground round each pad (its hardstand stands 12 m above this), from the lidar's ground points 200–600 m out.
for p in PADS:
    s = window(p['x'] - 600, p['z'] - 600, p['x'] + 600, p['z'] + 600); s = s[C[s] == 2]
    d = np.hypot(X[s] - p['x'], Z[s] - p['z']); p['ground'] = float(np.median(Y[s][(d > 200) & (d < 600)]))


def lift(x, z, ground):
    # A structure's base in the scene: on a hardstand, from the pad's natural ground; elsewhere, its own ground.
    if mound(x, z) <= .5 or ground is None: return 0.0
    pad = min(PADS, key=lambda p: math.hypot(x - p['x'], z - p['z']))
    return ground - pad['ground']


# --- Spheres: the pads' propellant tanks and the water towers' tanks -------------------------------------------------
def fit_sphere(x, z, reach, above=None):
    # The points of a sphere standing within `reach` of (x, z): those over `above` (or, for a tank up on a tower, its
    # top 15 m).
    s = window(x - reach - 45, z - reach - 45, x + reach + 45, z + reach + 45)
    d = np.hypot(X[s] - x, Z[s] - z)
    g = s[(d > reach + 5) & (d < reach + 40) & (C[s] == 2)]
    if len(g) < 5: return None
    ground = float(np.median(Y[g]))
    near = s[(d < reach) & SOLID[s] & (C[s] != 2)]
    if not len(near): return None
    if above is None: above = Y[near].max() - ground - 15
    pick = near[Y[near] - ground > above]
    if len(pick) < 40: return None
    P = np.c_[X[pick], Y[pick] - ground, Z[pick]]
    A, b = np.c_[2 * P, np.ones(len(P))], (P ** 2).sum(1)
    for _ in range(3):
        sol = np.linalg.lstsq(A, b, rcond=None)[0]; c = sol[:3]; r = math.sqrt(sol[3] + c @ c)
        miss = np.abs(np.linalg.norm(P - c, axis=1) - r); keep = miss < max(.6, 2.5 * np.median(miss))
        A, b, P = A[keep], b[keep], P[keep]
    rms = float(np.sqrt(np.mean((np.linalg.norm(P - c, axis=1) - r) ** 2)))
    return {'x': round(float(c[0]), 1), 'z': round(float(c[2]), 1), 'y': round(float(c[1]), 1), 'r': round(r, 2), 'rms': round(rms, 2), 'ground': ground}


spheres, water_towers = [], []
for f in footprints:
    name = (f['tags'].get('name') or '').lower()
    a = f['shape'].area; compact = 4 * math.pi * a / f['shape'].length ** 2
    if any(w in name for w in ('oxygen', 'hydrogen', 'methane', 'lox')) and 150 < a < 600 and compact > .8:
        c = f['shape'].centroid; fit = fit_sphere(c.x, c.y, math.sqrt(a / math.pi) + 5, 6)
        if fit and fit['rms'] < .5 and 6 < fit['r'] < 14: spheres.append({**fit, 'name': f['tags'].get('name'), 'from': f['id']})
for n in nodes:
    if n['tags'].get('man_made') == 'water_tower':
        fit = fit_sphere(n['x'], n['z'], 11)
        if fit and fit['rms'] < .5 and 4 < fit['r'] < 10: water_towers.append({**fit, 'from': n['id']})
print('cầu: %d, tháp nước: %d' % (len(spheres), len(water_towers)))
round_things = [Polygon(shapely.Point(t['x'], t['z']).buffer(t['r'] + 3).exterior) for t in spheres + water_towers]

# --- Footprints: standing in 2019?, how tall ------------------------------------------------------------------------
def measure(shape):
    x0, z0, x1, z1 = shape.bounds
    s = window(x0, z0, x1, z1); s = s[shapely.contains_xy(shape, X[s], Z[s]) & SOLID[s]]
    ground = ground_round(shape)
    above = s[C[s] != 2]
    stats = {'n': len(s), 'above': len(above), 'c6': int((C[above] == 6).sum()), 'ground': ground}
    if ground is None or len(above) < 3: return stats, None
    return stats, (X[above], Z[above], Y[above] - ground)


def standing(shape, stats, h):
    if h is None or stats['n'] < 3 or np.percentile(h[2], 90) < 2.2: return False
    if stats['c6'] / stats['above'] >= .25: return True
    return shape.area < 500 and stats['above'] / stats['n'] >= .6


def roof_levels(shape, x, z, h):
    # Highest return in each 2 m cell; one level unless the heights split cleanly in two.
    cell = 2.0; x0, z0, x1, z1 = shape.bounds
    nx, nz = int((x1 - x0) / cell) + 1, int((z1 - z0) / cell) + 1
    top = np.full((nz, nx), np.nan)
    np.fmax.at(top, (((z - z0) / cell).astype(int), ((x - x0) / cell).astype(int)), h)
    cx, cz = np.meshgrid(x0 + (np.arange(nx) + .5) * cell, z0 + (np.arange(nz) + .5) * cell)
    inside = shapely.contains_xy(shape, cx, cz) & ~np.isnan(top)
    v = np.sort(top[inside])
    if len(v) < 30: return [(shape, float(np.percentile(h, 70)))]
    lo, hi = int(len(v) * .12), int(len(v) * .88)
    gaps = v[lo + 1:hi] - v[lo:hi - 1]
    if shape.area < 600 or not len(gaps) or gaps.max() < 3.5: return [(shape, float(np.percentile(v, 60)))]
    k = lo + int(np.argmax(gaps)); split = (v[k] + v[k + 1]) / 2
    cells = [box(cx[j, i] - cell / 2, cz[j, i] - cell / 2, cx[j, i] + cell / 2, cz[j, i] + cell / 2) for j, i in zip(*np.nonzero(inside & (top >= split)))]
    upper = unary_union(cells).buffer(1.2).buffer(-1.2).simplify(1.0).intersection(shape)
    pieces = [g for g in getattr(upper, 'geoms', [upper]) if g.geom_type == 'Polygon' and g.area >= 40]
    if not pieces: return [(shape, float(np.percentile(v, 60)))]
    out = [(shape, float(np.percentile(v[v < split], 60)))]
    for g in pieces:
        mine = shapely.contains_xy(g, x, z)
        out.append((g, float(np.percentile(h[mine], 60)) if mine.sum() >= 5 else float(np.percentile(v[v >= split], 60))))
    return out


def modelled(item):
    if item['id'] in MODELLED: return True
    if item['id'].startswith('w') and any(a <= int(item['id'][1:]) <= b for a, b in MODELLED_RANGES): return True
    return any(item['shape'].intersection(t).area > .3 * item['shape'].area for t in round_things)


kept, dropped = [], []
def take(item):
    if modelled(item): return
    stats, h = measure(item['shape'])
    if not standing(item['shape'], stats, h): dropped.append(item['id']); return
    c = item['shape'].centroid
    base = lift(c.x, c.y, stats['ground'])
    for piece, top in roof_levels(item['shape'], *h):
        if piece.geom_type != 'Polygon' or piece.area < 2: continue
        kept.append({'from': item['id'], 'tags': item['tags'], 'shape': piece, 'top': round(base + top, 1)})


for f in footprints:
    if 'building' in f['tags'] or 'building:part' in f['tags']: take(f)
osm_union = unary_union([k['shape'] for k in kept] + [f['shape'] for f in footprints if f['id'] in MODELLED])
for u in usa:
    if u['shape'].area > 20000 or u['shape'].intersection(osm_union).area > .2 * u['shape'].area: continue   # pads, a solar farm, OSM's own
    take(u)
print('khung: giữ %d khối (%d từ USA Structures), bỏ %d mà lidar 2019 không thấy' % (len(kept), sum(k['from'].startswith('usa') for k in kept), len(dropped)))

# --- Roof colours from the USGS imagery (z16, about 2 m a pixel) ----------------------------------------------------
tiles = {}
def pixel(lat, lon, zoom=16):
    n = 2 ** zoom
    return (lon + 180) / 360 * n * 256, (1 - math.log(math.tan(lat * rad) + 1 / math.cos(lat * rad)) / math.pi) / 2 * n * 256


def tile(tx, ty):
    if (tx, ty) not in tiles:
        try: tiles[tx, ty] = np.asarray(Image.open(io.BytesIO(fetch(USGS % (16, ty, tx), CACHE / 'imagery' / ('16-%d-%d.jpg' % (tx, ty))))).convert('RGB'))
        except Exception: tiles[tx, ty] = None
    return tiles[tx, ty]


def colour(shape):
    core = shape.buffer(-1.0)
    if core.is_empty or core.area < 8: core = shape.centroid.buffer(2)
    x0, z0, x1, z1 = core.bounds
    xs, zs = np.meshgrid(np.arange(x0, x1, 1.0), np.arange(z0, z1, 1.0))
    inside = shapely.contains_xy(core, xs, zs)
    if not inside.any(): return None
    samples = []
    for x, z in zip(xs[inside], zs[inside]):
        la, lo = inverse(x, z); px, py = pixel(la, lo)
        img = tile(int(px // 256), int(py // 256))
        if img is not None: samples.append(img[int(py % 256), int(px % 256)])
    return np.median(np.array(samples), 0) if samples else None


def hex_of(rgb): return '%02x%02x%02x' % tuple(int(max(0, min(255, round(v)))) for v in rgb)


def named(value):
    names = {'white': (236, 236, 232), 'grey': (160, 160, 160), 'gray': (160, 160, 160), 'silver': (192, 192, 192), 'black': (40, 40, 40)}
    if not value: return None
    if value.startswith('#') and len(value) in (4, 7):
        v = value[1:] if len(value) == 7 else ''.join(ch * 2 for ch in value[1:])
        return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))
    return names.get(value.lower())


buildings = []
for k in kept:
    shape = k['shape'].simplify(.3)
    if shape.is_empty or shape.geom_type != 'Polygon': continue
    roof = named(k['tags'].get('roof:colour')) or colour(shape)
    roof = np.array(roof if roof is not None else (200, 200, 196), float)
    wall = named(k['tags'].get('building:colour'))
    # Walls: mostly pale cladding at the Cape, a hint of the roof's hue.
    wall = np.array(wall, float) if wall else .3 * roof + .7 * np.array([214, 210, 201])
    ring_ = lambda r: [v for x, z in list(r.coords)[:-1] for v in (round(x * 10), round(z * 10))]
    entry = {'p': ring_(shape.exterior), 'h': k['top'], 'r': hex_of(roof), 'w': hex_of(wall)}
    if shape.interiors: entry['q'] = [ring_(r) for r in shape.interiors]
    if k['tags'].get('building') == 'roof': entry['c'] = 1   # a canopy: roof, no walls
    buildings.append(entry)

# --- Towers, masts, light poles, flare stacks (OSM nodes measured in the lidar) -------------------------------------
towers = []
for n in nodes:
    t = n['tags']; kind = t.get('tower:type'); made = t.get('man_made')
    if made == 'water_tower' or kind in ('portal', 'launch_tower') or made not in ('tower', 'mast', 'flare'): continue   # mount posts, pad towers
    if kind == 'lightning_protection' and math.hypot(n['x'] + 1635, n['z'] + 2114) < 400: continue   # 39B's, built by hand
    s = window(n['x'] - 45, n['z'] - 45, n['x'] + 45, n['z'] + 45)
    d = np.hypot(X[s] - n['x'], Z[s] - n['z'])
    g = s[(d > 10) & (d < 40) & (C[s] == 2)]
    if len(g) < 5: continue
    ground = float(np.median(Y[g]))
    near = s[(d < 7) & SOLID[s] & (C[s] != 2)]
    h = Y[near] - ground
    if (h > 3).sum() < 5 or h.max() < 6: continue   # not there in 2019 (or too thin for the lidar)
    tall = near[h > .5 * h.max()]
    top = float(np.percentile(h, 99.5))
    try: listed = float(t.get('height', '0').split()[0])
    except ValueError: listed = 0
    if top < .5 * listed: continue   # OSM's mast is not what the lidar saw: put up since
    kind = 'lightning' if kind == 'lightning_protection' and top > 50 else 'flare' if made == 'flare' else 'light' if kind == 'lighting' or top < 30 else 'mast'
    x, z = float(X[tall].mean()), float(Z[tall].mean())
    towers.append({'k': kind, 'x': round(x, 1), 'z': round(z, 1), 'h': round(lift(x, z, ground) + top, 1), 'from': n['id']})
# Lightning towers round a pad, in order round it, for the catenary wires between their tops.
catenaries, left = [], [i for i, t in enumerate(towers) if t['k'] == 'lightning']
while left:
    group = [left.pop(0)]
    for i in left[:]:
        if any(math.hypot(towers[i]['x'] - towers[j]['x'], towers[i]['z'] - towers[j]['z']) < 220 for j in group): group.append(i); left.remove(i)
    if len(group) >= 3:
        cx, cz = np.mean([towers[i]['x'] for i in group]), np.mean([towers[i]['z'] for i in group])
        catenaries.append(sorted(group, key=lambda i: math.atan2(towers[i]['z'] - cz, towers[i]['x'] - cx)))
print('tháp: %d (%s); dây thu sét quanh %d bệ' % (len(towers), ', '.join('%d %s' % (sum(t['k'] == k for t in towers), k) for k in ('lightning', 'mast', 'light', 'flare')), len(catenaries)))

about = {'licence': 'ODbL 1.0: a database derived from OpenStreetMap (© OpenStreetMap contributors)',
         'footprints': 'OpenStreetMap contributors (ODbL), where OSM has none USA Structures (FEMA/ORNL)',
         'heights': 'USGS 3DEP lidar FL_Peninsular_FDEM_Brevard_2018, flown ' + FLOWN, 'colours': 'USGS National Map imagery',
         'frame': 'metres from LC-39A, x east, z south; p in decimetres; h the roof above the ground (on a hardstand, above the ground round the pad)'}
out = {'about': about, 'buildings': buildings,
       'towers': [{k: v for k, v in t.items() if k != 'from'} for t in towers], 'catenaries': catenaries,
       'spheres': [{k: t[k] for k in ('x', 'z', 'y', 'r')} for t in spheres], 'waterTowers': [{k: t[k] for k in ('x', 'z', 'y', 'r')} for t in water_towers]}
text = json.dumps(out, separators=(',', ':'))
TARGET.write_text(text + '\n', encoding='utf-8')
print('đã viết %s: %d khối nhà, %d tháp, %d cầu, %d tháp nước, %.0f KB' % (TARGET.relative_to(HERE), len(buildings), len(towers), len(spheres), len(water_towers), len(text) / 1024))
for t in spheres + water_towers: print('  %-28s (%7.1f, %7.1f) tâm cao %5.1f m, bán kính %5.2f m, sai số %.2f m' % (t.get('name') or t['from'], t['x'], t['z'], t['y'], t['r'], t['rms']))
