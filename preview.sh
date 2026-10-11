#!/bin/bash
# Xem trên máy bản đã tách (giống hệt bản trên GitHub Pages): tách lại rồi chạy máy chủ cục bộ.
# Cần máy chủ: mở index.html bằng file:// thì trình duyệt chặn tải data/*.json.
cd "$(dirname "$0")"
python3 build.py
( sleep 1; open "http://localhost:8002/" ) &
exec python3 -m http.server 8002
