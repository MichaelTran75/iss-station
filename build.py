#!/usr/bin/env python3
"""Tách "../02 ISS Space Station 3D.html" (bản gốc 1 tệp, nơi sửa mã) thành trang nhiều tệp cho GitHub Pages.

  index.html            khung trang + giao diện (importmap three.js, icon lucide)
  css/app.css           kiểu giao diện
  js/app.js             dựng trạm three.js + mọi hoạt cảnh (module); tải data/ ngay khi mở trang
  data/*.json           lưới, khung xương, chuyển động lấy từ các mô hình gốc (mảng số mã base64)
  assets/<mô hình>/*    ảnh texture tách khỏi base64, giữ nguyên từng byte (PNG/JPG)

Mỗi tệp được đóng dấu ?v=<băm nội dung>: tệp nào không đổi thì trình duyệt giữ bản đã lưu.
"""
import base64, hashlib, json, pathlib, re, shutil, sys

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE.parent / '02 ISS Space Station 3D.html'

# Hằng dữ liệu trong module → data/<tên>.json; ảnh data: URL bên trong → assets/<tên>/.
DATA = {
    'pmaReferenceData': 'pma-2',
    'payloadReference': 'payloads',
    'columbusCrewHuman': 'columbus-crew',
    'columbusCrewMotion': 'columbus-crew-motion',
    'zaryaReference': 'zarya',
    'dragonReference': 'crew-dragon',
    'dragonCrewSuit': 'crew-dragon-suit',
    'evaAsset': 'eva-astronaut',
}
EXT = {'image/png': '.png', 'image/jpeg': '.jpg'}


def die(msg):
    sys.exit('build.py: ' + msg)


def version(data):
    return hashlib.sha1(data).hexdigest()[:10]


src = SRC.read_text(encoding='utf-8')

page = re.match(r'(.*?)\n    <style>\n(.*?)\n    </style>\n(.*?)\n</head>\n\n<body>\n(.*?)\n    <script type="module">\n(.*)\n    </script>\n</body>\n\n</html>\n?$', src, re.S)
if not page: die('không nhận ra bố cục trang (head / style / body / module)')
head_top, css, head_scripts, markup, module = page.groups()
css += '\n'

for folder in ('css', 'js', 'data', 'assets'):
    shutil.rmtree(HERE / folder, ignore_errors=True)
written = {}


def write(rel, data):
    path = HERE / rel; path.parent.mkdir(parents=True, exist_ok=True)
    data = data.encode('utf-8') if isinstance(data, str) else data
    path.write_bytes(data); written[rel] = data
    return rel + '?v=' + version(data)


def extract_images(node, folder, key='', parent=None):
    """Thay mọi data: URL ảnh bằng đường dẫn tệp ảnh (ghi nguyên byte) — trả về nút đã thay."""
    if isinstance(node, dict):
        return {k: extract_images(v, folder, k, node) for k, v in node.items()}
    if isinstance(node, list):
        return [extract_images(v, folder, key, parent) for v in node]
    m = re.match(r'data:(image/[a-z]+);base64,(.*)$', node, re.S) if isinstance(node, str) else None
    if not m: return node
    ext = EXT.get(m.group(1)) or die('kiểu ảnh lạ ' + m.group(1))
    name = key if re.search(r'\.(png|jpe?g)$', key) else (parent or {}).get('name', key) + ext
    return write('assets/%s/%s' % (folder, name), base64.b64decode(m.group(2)))


files = {}
lines = module.split('\n')
for i, line in enumerate(lines):
    m = re.match(r'(\s*)const (\w+) = (\{.*\});\s*$', line)
    if not m or m.group(2) not in DATA: continue
    indent, name, body = m.groups()
    data = extract_images(json.loads(body), DATA[name])
    files[name] = write('data/%s.json' % DATA[name], json.dumps(data, separators=(',', ':'), ensure_ascii=False))
    lines[i] = '%sconst %s = assetData.%s;' % (indent, name, name)
missing = set(DATA) - set(files)
if missing: die('không thấy hằng dữ liệu: ' + ', '.join(sorted(missing)))

# Tải dữ liệu song song với three.js, chờ ngay sau khi các module three.js đã nạp.
start = next((i for i, l in enumerate(lines) if l.strip() == 'try {'), None)
imports = next((i for i, l in enumerate(lines) if "await import('three/addons/utils/BufferGeometryUtils.js')" in l), None)
if start is None or imports is None: die('không tìm thấy khối try / dòng nạp three.js')
pad = ' ' * 12
loader = [
    pad + '// Model data lives in data/*.json and its textures in assets/; fetch it while three.js loads.',
    pad + 'const assetFiles = ' + json.dumps(files, separators=(', ', ': ')) + ';',
    pad + 'const assetDataReady = Promise.all(Object.entries(assetFiles).map(async ([name, path]) => {',
    pad + '    const response = await fetch(path);',
    pad + "    if (!response.ok) throw new Error('Could not load ' + path + ' (HTTP ' + response.status + ').');",
    pad + '    return [name, await response.json()];',
    pad + '})).then(Object.fromEntries);',
    pad + 'assetDataReady.catch(() => {});',
]
lines[imports + 1:imports + 1] = [pad + 'const assetData = await assetDataReady;']
lines[start + 1:start + 1] = loader
app = '\n'.join(lines).strip('\n') + '\n'

css_url = write('css/app.css', css)
app_url = write('js/app.js', app)
index = (head_top + '\n'
         + '    <link rel="stylesheet" href="' + css_url + '">\n'
         + head_scripts + '\n</head>\n\n<body>\n' + markup + '\n'
         + '    <!-- dựng trạm + hoạt cảnh; dữ liệu mô hình nạp từ data/ và assets/ -->\n'
         + '    <script type="module" src="' + app_url + '"></script>\n'
         + '</body>\n\n</html>\n')
(HERE / 'index.html').write_text(index, encoding='utf-8')

total = sum(len(d) for d in written.values()) + len(index.encode('utf-8'))
print('Đã tách %s (%.2f MB) → %d tệp, tổng %.2f MB' % (SRC.name, SRC.stat().st_size / 1e6, len(written) + 1, total / 1e6))
for rel in ['index.html'] + sorted(written):
    print('  %-44s %9.1f KB' % (rel, (HERE / rel).stat().st_size / 1024))
