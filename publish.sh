#!/bin/bash
# Đưa bản mới lên GitHub Pages: ./publish.sh "mô tả thay đổi"
# Repo này là bản gốc để sửa (index.html, css/, js/, data/, assets/).
# 1) đóng dấu lại ?v=<băm nội dung> cho mọi tệp được tham chiếu · 2) commit + push.
set -e
cd "$(dirname "$0")"
python3 stamp.py
git add -A
if git diff --cached --quiet; then echo "Không có thay đổi."; exit 0; fi
git commit -q -m "${1:-Cập nhật trang}"
git push -q
echo "Đã đẩy lên. Trang cập nhật sau ~1 phút: https://michaeltran75.github.io/iss-station/"
