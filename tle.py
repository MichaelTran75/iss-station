#!/usr/bin/env python3
"""Làm mới data/orbits.json: bộ phần tử quỹ đạo (TLE) mới nhất của ISS từ CelesTrak.

Trang tự tải TLE từ CelesTrak khi mở góc nhìn quỹ đạo; tệp này là bản dự phòng khi CelesTrak không trả lời.
publish.sh gọi tệp này trước khi đóng dấu; lỗi mạng chỉ in cảnh báo và giữ bản cũ.
Thêm vệ tinh: thêm một dòng vào OBJECTS (mã NORAD lấy trên celestrak.org).
"""
import datetime, json, pathlib, sys, urllib.request

HERE = pathlib.Path(__file__).resolve().parent
TARGET = HERE / 'data' / 'orbits.json'
OBJECTS = [('iss', 'ISS (ZARYA)', 25544)]
URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=%d&FORMAT=TLE'

objects = []
for key, name, norad in OBJECTS:
    try:
        with urllib.request.urlopen(URL % norad, timeout=15) as response:
            lines = [line.strip() for line in response.read().decode('ascii', 'replace').splitlines() if line.strip()]
        tle = [line for line in lines if line[:2] in ('1 ', '2 ')]
        if len(tle) != 2 or not tle[0].startswith('1 %05d' % norad): raise ValueError('không đọc được TLE: %r' % lines[:3])
        objects.append({'id': key, 'name': name, 'norad': norad, 'tle': tle})
    except Exception as error:
        sys.exit('tle.py: không làm mới được %s (%s); giữ data/orbits.json cũ.' % (name, error))
try:
    if json.loads(TARGET.read_text(encoding='utf-8'))['objects'] == objects: sys.exit(print('tle.py: TLE không đổi.'))
except (OSError, ValueError, KeyError):
    pass
data = {'source': 'CelesTrak GP (celestrak.org)', 'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'objects': objects}
TARGET.write_text(json.dumps(data, indent=1) + '\n', encoding='utf-8')
print('tle.py: data/orbits.json, %s' % ', '.join('%s epoch %s' % (o['name'], o['tle'][0][18:32]) for o in objects))
