# ISS · Trạm Vũ trụ Quốc tế 3D

Mô hình three.js (WebGL) của Trạm Vũ trụ Quốc tế: 26 khối có thể chọn để xem chi tiết, cấu hình hiện tại và cấu hình gốc,
Crew Dragon tiếp cận rồi ghép nối, phi hành đoàn làm việc trong Columbus, phi hành gia đi bộ ngoài không gian ở Z1
(leo bằng tay, móc dây thắt lưng, súng vặn PGT, dây an toàn 85 ft nối về khóa khí Quest).
Trang: https://michaeltran75.github.io/iss-station/ (nhúng Wix bằng iframe).

| Tệp | Nội dung |
|---|---|
| `index.html` | khung trang + giao diện |
| `css/app.css` | kiểu giao diện |
| `js/app.js` | dựng trạm + mọi hoạt cảnh (module three.js), tải `data/` khi mở trang |
| `data/eva-astronaut.json` | lưới, khung xương, vòng chuyển động của phi hành gia EVA |
| `data/pma-2.json` | lưới PMA-2 |
| `data/crew-dragon.json`, `data/crew-dragon-suit.json` | Crew Dragon và bộ đồ phi hành đoàn |
| `data/columbus-crew.json`, `data/columbus-crew-motion.json` | phi hành đoàn Columbus và chuyển động |
| `data/payloads.json`, `data/zarya.json` | số đo tải trọng trên giàn và chi tiết Zarya |
| `assets/pma-2/*.png`, `assets/eva-astronaut/*.jpg` | ảnh texture, giữ nguyên từng byte |

Bản gốc để sửa là tệp một-file `../02 ISS Space Station 3D.html`.
Các tệp trong thư mục này do `build.py` tách ra, đừng sửa tay. Mỗi tệp đóng dấu `?v=<băm nội dung>`, nên trình duyệt chỉ tải lại tệp thật sự đổi.

- Xem trên máy: `./preview.sh` (cần máy chủ cục bộ; mở `index.html` bằng file:// sẽ không tải được `data/`)
- Đưa lên mạng: `./publish.sh "mô tả"` (tách lại + commit + push)

Nhúng vào Wix: *Thêm → Nhúng mã → Nhúng trang web* rồi dán đường dẫn trên, hoặc *Nhúng HTML* với:

```html
<iframe src="https://michaeltran75.github.io/iss-station/" style="width:100%;height:100%;border:0" allow="fullscreen" loading="lazy" title="ISS · Trạm Vũ trụ Quốc tế 3D"></iframe>
```

## Mô hình

Phần lớn trạm dựng bằng code three.js theo số đo từ tệp mẫu `ISS_stationary.glb`. Riêng lưới PMA-2 và 3 ảnh texture của nó lấy nguyên từ tệp này.

| Mô hình | Tác giả | Giấy phép |
|---|---|---|
| [Animated Floating Astronaut in Space Suit Loop](https://sketchfab.com/3d-models/animated-floating-astronaut-in-space-suit-loop-e2c4b146e58141e4b87917456a9970b1) | LasquetiSpice | CC BY 4.0, đã đổi tư thế, vật liệu, hoạt cảnh |
| [Human](https://sketchfab.com/3d-models/human-5913acb8485d4ef09d0770d8d7d831ba) | doctortex | CC BY 4.0, đã gắn khung xương và tạo dáng |
| [SpaceX - Dragon 2](https://sketchfab.com/3d-models/spacex-dragon-2-1b125e30a2cb442288580290536fbe5d) | KUBAHA | CC BY 4.0, đã đổi vật liệu, thêm hoạt cảnh ghép nối |
| [Space X Dragon Suit](https://sketchfab.com/3d-models/space-x-dragon-suit-c600b853268249bdb9dd59bac7ead0b9) | Diuis | CC BY 4.0, đã đổi vật liệu, tư thế ngồi |
