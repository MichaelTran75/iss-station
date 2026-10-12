#!/usr/bin/env python3
"""Đóng dấu ?v=<sha1 10 ký tự> cho mọi tệp được tham chiếu trong trang.

Tham chiếu có dạng 'css/app.css?v=…', 'data/pma-2.json?v=…', './workers/line-art.js?v=…'.
Đường dẫn bắt đầu bằng ./ hoặc ../ tính theo thư mục của tệp chứa nó; còn lại tính theo gốc trang
(fetch() và TextureLoader đều đọc đường dẫn theo trang). Chạy lặp đến khi ổn định vì dữ liệu chứa đường dẫn ảnh,
module chứa đường dẫn dữ liệu và worker, index.html chứa module.
"""
import hashlib, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
# Chỉ khớp chuỗi trong dấu nháy: quét tuyến tính cả trên dòng base64 dài hàng MB.
REF = re.compile(r'''(?P<quote>["'])(?P<path>(?:\.{1,2}/)?[\w\-./]{1,160}?\.(?:js|mjs|css|json|png|jpe?g|webp|bin))\?v=(?P<hash>[0-9a-f]{10})''')
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


for rounds in range(1, 8):
    changed = [rel for rel in SOURCES if stamp(rel)]
    if not changed: break
    print('lượt %d: đóng dấu lại %s' % (rounds, ', '.join(changed)))
else:
    sys.exit('stamp.py: dấu phiên bản không ổn định')

total = sum(p.stat().st_size for p in HERE.rglob('*') if p.is_file() and '.git' not in p.parts)
print('Dấu phiên bản đã khớp nội dung. Trang gồm %.2f MB.' % (total / 1e6))
