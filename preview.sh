#!/bin/bash
# Xem trên máy (giống hệt bản trên GitHub Pages). Cần máy chủ: mở index.html bằng file:// thì trình duyệt
# chặn tải data/ và Web Worker. Thêm ?stats vào đường dẫn để xem khung hình/giây, số lần vẽ, mức chất lượng.
cd "$(dirname "$0")"
python3 stamp.py
( sleep 1; open "http://localhost:8002/?stats" ) &
exec python3 -m http.server 8002
