# ISS · Trạm Vũ trụ Quốc tế 3D

Mô hình three.js (WebGL) của Trạm Vũ trụ Quốc tế: 26 khối có thể chọn để xem chi tiết, cấu hình hiện tại và cấu hình gốc,
Crew Dragon tiếp cận rồi ghép nối, phi hành đoàn làm việc trong Columbus, phi hành gia đi bộ ngoài không gian ở Z1
(leo bằng tay, móc dây thắt lưng, súng vặn PGT, dây an toàn 85 ft nối về khóa khí Quest).
Trang: https://michaeltran75.github.io/iss-station/ (nhúng Wix bằng iframe).

| Tệp | Nội dung |
|---|---|
| `index.html` | khung trang + giao diện |
| `css/app.css` | kiểu giao diện |
| `js/app.js` | dựng trạm + hoạt cảnh, chọn mức chất lượng, điều phối hai Web Worker |
| `js/sim/eva.js` | mô hình chuyển động của phi hành gia EVA (khung xương, leo tay vịn, dây, súng PGT), không chứa lưới |
| `js/sim/worker.js` | Web Worker chạy các mô hình chuyển động, trả tư thế về mỗi khung hình |
| `js/workers/line-art.js` | Web Worker dựng nét viền cho các khối mờ |
| `data/*.json` | lưới, khung xương, chuyển động lấy từ các mô hình gốc |
| `assets/pma-2/*.jpg`, `assets/eva-astronaut/*.jpg` | ảnh texture |

Từ 12/10/2026 repo này là bản gốc để sửa (không còn bản một tệp).

- Xem trên máy: `./preview.sh` (mở sẵn `?stats`; cần máy chủ cục bộ vì Web Worker và `data/` không chạy được qua file://)
- Đưa lên mạng: `./publish.sh "mô tả"`. `stamp.py` đóng dấu `?v=<băm nội dung>` cho mọi tệp được tham chiếu, rồi commit + push.

Nhúng vào Wix: *Thêm → Nhúng mã → Nhúng trang web* rồi dán đường dẫn trên, hoặc *Nhúng HTML* với:

```html
<iframe src="https://michaeltran75.github.io/iss-station/" style="width:100%;height:100%;border:0" allow="fullscreen" loading="lazy" title="ISS · Trạm Vũ trụ Quốc tế 3D"></iframe>
```

## Hiệu năng

- `?stats`: hiện số khung hình/giây, mili giây CPU mỗi khung, số lần vẽ, mức chất lượng, nơi chạy hoạt cảnh.
- `?quality=high|medium|low`: cố định một mức. `?worker=0`: chạy mọi thứ trên luồng chính (để so sánh, gỡ lỗi).
- Mức chất lượng tự chọn theo máy:

  | Mức | Áp dụng cho | Độ phân giải | Bóng đổ |
  |---|---|---|---|
  | high | máy tính | 2× | 2048, vẽ lại 15 lần/giây |
  | medium | màn cảm ứng nhỏ, máy ≤ 4 nhân hoặc ≤ 4 GB | 1,5× | 1024, vẽ lại 8 lần/giây |
  | low | khi máy không theo kịp | 1× | tắt |

  Khi khung hình chậm hơn 40 khung/giây, trang hạ một mức. Khi dư sức, trang nâng lại, nhưng không vượt mức ban đầu.
- Phi hành gia EVA (4 MB dữ liệu) tải sau khung hình đầu tiên.

## Thêm hoạt cảnh phức tạp

1. Viết mô hình chuyển động như `js/sim/eva.js`: một hàm trả về `{ layout: { size }, step(time, out) }`, ghi tư thế vào một `Float32Array`. Không tạo lưới trong hàm này.
2. Đăng ký nó trong `js/sim/worker.js` (`factories`).
3. Trong `js/app.js`, dựng lưới như `createZ1Maintenance`. Gửi `{type: 'init', kind, payload}` một lần. Mỗi khung gửi `{type: 'step', time, buffer}`, rồi chép tư thế nhận về vào lưới.
   Mô hình chạy trong worker nên không làm chậm luồng vẽ; nếu trình duyệt không có worker, cùng mô hình đó chạy trên luồng chính.

## Mô hình

Phần lớn trạm dựng bằng code three.js theo số đo từ tệp mẫu `ISS_stationary.glb`. Riêng lưới PMA-2 và 3 ảnh texture của nó lấy nguyên từ tệp này (ảnh nén lại thành JPEG chất lượng 92).

| Mô hình | Tác giả | Giấy phép |
|---|---|---|
| [Animated Floating Astronaut in Space Suit Loop](https://sketchfab.com/3d-models/animated-floating-astronaut-in-space-suit-loop-e2c4b146e58141e4b87917456a9970b1) | LasquetiSpice | CC BY 4.0, đã đổi tư thế, vật liệu, hoạt cảnh, texture 1024 px |
| [Human](https://sketchfab.com/3d-models/human-5913acb8485d4ef09d0770d8d7d831ba) | doctortex | CC BY 4.0, đã gắn khung xương và tạo dáng |
| [SpaceX - Dragon 2](https://sketchfab.com/3d-models/spacex-dragon-2-1b125e30a2cb442288580290536fbe5d) | KUBAHA | CC BY 4.0, đã đổi vật liệu, thêm hoạt cảnh ghép nối |
| [Space X Dragon Suit](https://sketchfab.com/3d-models/space-x-dragon-suit-c600b853268249bdb9dd59bac7ead0b9) | Diuis | CC BY 4.0, đã đổi vật liệu, tư thế ngồi |
