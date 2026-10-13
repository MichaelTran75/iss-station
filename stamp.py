#!/usr/bin/env python3
"""Đóng dấu ?v=<sha1 10 ký tự> cho mọi tệp được tham chiếu trong trang, rồi viết khối module của index.html.

Tham chiếu có dạng 'css/app.css?v=…', 'data/pma-2.json?v=…', '../workers/line-art.js?v=…'.
Đường dẫn bắt đầu bằng ./ hoặc ../ tính theo thư mục của tệp chứa nó; còn lại tính theo gốc trang
(fetch() và TextureLoader đều đọc đường dẫn theo trang). Chạy lặp đến khi ổn định vì dữ liệu chứa đường dẫn ảnh,
module chứa đường dẫn dữ liệu và worker.

Các module import nhau bằng đường dẫn thường ('../core/kit.js'), không có dấu. Khối <!-- modules … /modules -->
trong index.html do tệp này viết: import map trỏ mỗi module tới bản có dấu, modulepreload tải trước mọi module theo
thứ tự dựng (thứ tự import trong js/main.js). Sửa một module thì chỉ tệp đó và index.html đổi dấu.
Worker (js/workers/*.js, js/sim/worker.js) không qua import map: trang gọi chúng bằng new URL('…?v=…').
"""
import hashlib, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
INDEX = HERE / 'index.html'
MAIN = HERE / 'js' / 'main.js'
# Chỉ khớp chuỗi trong dấu nháy: quét tuyến tính cả trên dòng base64 dài hàng MB.
REF = re.compile(r'''(?P<quote>["'])(?P<path>(?:\.{1,2}/)?[\w\-./]{1,160}?\.(?:js|mjs|css|json|png|jpe?g|webp|bin))\?v=(?P<hash>[0-9a-f]{10})''')
IMPORT = re.compile(r'''^import\s+(?:[^'";]*?\s+from\s+)?['"](?P<spec>\.{1,2}/[^'"]+\.js)['"];''', re.M)
BLOCK = re.compile(r'(?P<indent>[ \t]*)<!-- modules\b.*?<!-- /modules -->', re.S)
SOURCES = ['index.html', *sorted(str(p.relative_to(HERE)) for p in HERE.glob('css/*.css')),
           *sorted(str(p.relative_to(HERE)) for p in HERE.glob('js/**/*.js')),
           *sorted(str(p.relative_to(HERE)) for p in HERE.glob('data/*.json'))]


def digest(path):
    return hashlib.sha1(path.read_bytes()).hexdigest()[:10]


def stamp(rel):
    path = HERE / rel; text = path.read_text(encoding='utf-8')
    base = path.parent

    def replace(match):
        ref = match.group('path')
        target = (base / ref) if ref.startswith(('./', '../')) else (HERE / ref)
        target = target.resolve()
        if not target.is_file(): sys.exit('stamp.py: %s trỏ tới tệp không có: %s' % (rel, ref))
        return match.group('quote') + ref + '?v=' + digest(target)

    new = REF.sub(replace, text)
    if new != text: path.write_text(new, encoding='utf-8')
    return new != text


def stamp_all():
    for rounds in range(1, 8):
        changed = [rel for rel in SOURCES if stamp(rel)]
        if not changed: return
        print('lượt %d: đóng dấu lại %s' % (rounds, ', '.join(changed)))
    sys.exit('stamp.py: dấu phiên bản không ổn định')


def build_order():
    """Thứ tự trình duyệt chạy các module: core/data.js (boot.js chờ nó trước), rồi cây import tĩnh của main.js,
    duyệt theo chiều sâu, module phụ thuộc đứng trước (đúng thứ tự đánh giá module ES)."""
    order, seen = [], set()

    def visit(path):
        if path in seen: return
        seen.add(path)
        for match in IMPORT.finditer(path.read_text(encoding='utf-8')):
            target = (path.parent / match.group('spec')).resolve()
            if not target.is_file(): sys.exit('stamp.py: %s import tệp không có: %s' % (path.relative_to(HERE), match.group('spec')))
            visit(target)
        order.append(path)

    visit(HERE / 'js' / 'core' / 'data.js')
    visit(MAIN)
    return order


def write_modules():
    """Import map cho mọi module, modulepreload cho các module chạy lúc mở trang."""
    text = INDEX.read_text(encoding='utf-8')
    block = BLOCK.search(text)
    if not block: sys.exit('stamp.py: index.html thiếu khối <!-- modules … /modules -->')
    current = re.search(r'<script type="importmap">(.*?)</script>', block.group(0), re.S)
    keep = {k: v for k, v in json.loads(current.group(1))['imports'].items() if not k.startswith('./js/')} if current else {}
    order = build_order()
    workers = lambda p: 'workers' in p.relative_to(HERE).parts or p.name in ('worker.js', 'boot.js')
    lazy = [p for p in sorted((HERE / 'js').rglob('*.js')) if p not in order and not workers(p)]
    imports = dict(keep)
    for p in order + lazy:
        rel = p.relative_to(HERE).as_posix()
        imports['./' + rel] = './' + rel + '?v=' + digest(p)
    indent = block.group('indent')
    lines = ['<!-- modules: viết bởi stamp.py. Import map trỏ mỗi module tới bản có dấu nội dung; modulepreload tải',
             '     trước mọi module theo thứ tự dựng. -->',
             '<script type="importmap">']
    lines += json.dumps({'imports': imports}, indent=2, ensure_ascii=False).split('\n')
    lines += ['</script>']
    lines += ['<link rel="modulepreload" href="%s?v=%s">' % (p.relative_to(HERE).as_posix(), digest(p)) for p in order]
    lines += ['<!-- /modules -->']
    new = text[:block.start()] + '\n'.join(indent + line for line in lines) + text[block.end():]
    if new != text:
        INDEX.write_text(new, encoding='utf-8')
        print('index.html: %d module, %d tải trước' % (len(order) + len(lazy), len(order)))


stamp_all()
write_modules()
stamp_all()
total = sum(p.stat().st_size for p in HERE.rglob('*') if p.is_file() and '.git' not in p.parts)
print('Dấu phiên bản đã khớp nội dung. Trang gồm %.2f MB.' % (total / 1e6))
