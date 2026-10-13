# ISS · Trạm Vũ trụ Quốc tế 3D

Mô hình three.js (WebGL) của Trạm Vũ trụ Quốc tế: 26 khối có thể chọn để xem chi tiết, cấu hình hiện tại và cấu hình gốc,
Crew Dragon tiếp cận và ghép nối theo phương trình Clohessy–Wiltshire với các điểm chờ của Crew-2, phi hành đoàn làm việc
trong Columbus, phi hành gia đi bộ ngoài không gian ở Z1 (leo bằng tay, móc dây thắt lưng, súng vặn PGT, dây an toàn
85 ft nối về khóa khí Quest), và góc nhìn quỹ đạo: ISS ở đúng vị trí hiện tại trên quả địa cầu thật tỉ lệ.
Trang: https://michaeltran75.github.io/iss-station/ (nhúng Wix bằng iframe).

| Tệp | Nội dung |
|---|---|
| `index.html` | khung trang + giao diện. Khối `<!-- modules -->` (import map, modulepreload) do `stamp.py` viết |
| `css/app.css` | kiểu giao diện |
| `js/boot.js` | khởi động: nạp dữ liệu, rồi `main.js`; hiện bảng lỗi nếu trang không chạy được |
| `js/main.js` | import mọi module theo thứ tự dựng cảnh, rồi khởi chạy trang |
| `js/core/` | nền: `data` (dữ liệu mô hình), `stage` (renderer, camera, đèn), `quality` (mức chất lượng, lịch vẽ bóng đổ), `kit` (vật liệu, gộp lưới), `station` (sổ bộ phận `part()`, hằng số bố trí), cùng các chi tiết dùng chung: `cbm`, `surfaces`, `hull`, `pma`, `payloads` |
| `js/parts/` | mỗi tệp một bộ phận (truss, power, … z1). `assembly.js` chạy sau cùng: dời cụm Nga, hạ giàn, thu nhỏ Z1 |
| `js/figures/eva.js` | lưới phi hành gia EVA; mỗi khung chép tư thế nhận từ worker |
| `js/ui/` | `backdrop` (Trái Đất, sao), `ghost` (khối mờ, nét viền), `rendezvous-guide` (đường tiếp cận, điểm chờ, vùng cấm 200 m), `controller` (chọn bộ phận, góc nhìn, nhãn, nút bấm, vòng lặp khung hình) |
| `js/orbit/view.js` | góc nhìn quỹ đạo: quả địa cầu, ISS, vòng quỹ đạo, vết trên mặt đất, tua nhanh thời gian; tải khi mở lần đầu |
| `js/sim/rendezvous.js` | mô hình tiếp cận của Crew Dragon (Clohessy–Wiltshire, lịch Crew-2), chỉ có toán |
| `js/sim/orbit.js` | quỹ đạo từ TLE: SGP4 (satellite.js), hướng Mặt Trời, bóng Trái Đất, vết trên mặt đất |
| `js/sim/eva.js` | mô hình chuyển động của phi hành gia EVA (khung xương, leo tay vịn, dây, súng PGT), không chứa lưới |
| `js/sim/worker.js` | Web Worker chạy các mô hình chuyển động, trả tư thế về mỗi khung hình |
| `js/workers/line-art.js` | Web Worker dựng nét viền cho các khối mờ |
| `data/*.json` | lưới, khung xương, chuyển động lấy từ các mô hình gốc; `orbits.json` là TLE dự phòng của ISS |
| `tle.py` | làm mới `data/orbits.json` từ CelesTrak (publish.sh tự gọi) |
| `assets/pma-2/*.jpg`, `assets/eva-astronaut/*.jpg` | ảnh texture |

Từ 12/10/2026 repo này là bản gốc để sửa (không còn bản một tệp). Từ 13/10/2026 mã chia thành các module ES như trên.

- Xem trên máy: `./preview.sh` (mở sẵn `?stats`; cần máy chủ cục bộ vì module, Web Worker và `data/` không chạy được qua file://)
- Đưa lên mạng: `./publish.sh "mô tả"`. `tle.py` làm mới TLE, `stamp.py` đóng dấu `?v=<băm nội dung>` cho mọi tệp được tham chiếu và viết lại import map, rồi commit + push.

Nhúng vào Wix: *Thêm → Nhúng mã → Nhúng trang web* rồi dán đường dẫn trên, hoặc *Nhúng HTML* với:

```html
<iframe src="https://michaeltran75.github.io/iss-station/" style="width:100%;height:100%;border:0" allow="fullscreen" loading="lazy" title="ISS · Trạm Vũ trụ Quốc tế 3D"></iframe>
```

## Quy tắc module

1. Thứ tự import trong `js/main.js` là thứ tự dựng cảnh. Thứ tự này quyết định thứ tự tạo vật liệu và đối tượng, nên quyết định cả thứ tự vẽ các mặt trùng độ sâu. Không đảo các dòng import.
2. Mỗi module chỉ import từ module đứng trước nó trong `main.js` (core → parts → figures → ui → main). Không import vòng.
3. Không dùng `await` ở cấp module, trừ `core/data.js` và `main.js`. `boot.js` chờ `core/data.js` xong rồi mới chạy phần còn lại, nên mọi module dựng đồng bộ, đúng thứ tự. Cần tải thêm dữ liệu thì thêm vào `core/data.js`.
4. Biến `let` chỉ được gán trong module khai báo nó. Module khác muốn đổi trạng thái thì gọi hàm, ví dụ `markShadowsDirty()` khi đổi vật liệu hoặc hiện/ẩn khối.
5. Import viết đường dẫn thường (`'../core/kit.js'`), không có `?v=`. `stamp.py` thêm module mới vào import map và modulepreload; không cần sửa `index.html` bằng tay.

## Thêm bộ phận

1. Tạo `js/parts/ten.js`. Import `THREE` từ `'three'`, `part` từ `../core/station.js`, và các hàm dựng cần dùng (`moduleAt` trong `core/hull.js`, `hullBadge` trong `core/surfaces.js`, …).
2. Gọi `part('id', 'Tên', 'NN / NHÓM', 'mô tả', [['Thông số', 'giá trị']], [x, y, z], (kit, group) => { … })`. `kit` gom chi tiết thành một lưới cho mỗi vật liệu, `group` là nhóm có thể chọn.
3. Thêm `import './parts/ten.js';` vào `main.js`, trước `parts/assembly.js`. Nếu bộ phận gắn vào giàn hoặc cụm Nga, thêm `id` vào danh sách tương ứng trong `parts/assembly.js`.
4. Chạy `./preview.sh` để xem.

## Crew Dragon tiếp cận

Theo lịch ghép nối Crew-2 (24/4/2021) và tốc độ của Demo-2. Thời gian thực 58 phút, hoạt cảnh 144 giây; ô trạng thái ghi hệ số tua nhanh.

| Pha | Thời gian thực | Mô hình | Tua |
|---|---|---|---|
| Điểm 0, 400 m dưới trạm → điểm 1, 220 m trên trục ghép | 24 phút | trôi theo Clohessy–Wiltshire sau một lần đốt 0,81 m/s | ×60 |
| Điểm 1 → điểm 2 (20 m) | 11 phút | tiến dọc trục ở 0,35 m/s; Draco đẩy hướng tâm để giữ đường thẳng | ×30 |
| Dừng ở điểm 2 (go/no-go) | 5 phút | đứng yên trên trục V-bar: điểm cân bằng, không cần đẩy | ×30 |
| Tiếp cận cuối | 5 phút | 7 cm/s, chạm cổng ở 5 cm/s | ×4 |
| Bắt mềm → móc khóa xong | 13 phút | | ×60 |

Nắp mũi mở một phút sau khi tách tầng hai, nên mở suốt quá trình. Xem Dragon (bấm ô CREW DRAGON) thì khung hình bám theo Dragon và phần đường còn lại, kèm đường đi dự kiến, các điểm chờ, vùng cấm 200 m. Ở góc nhìn toàn trạm, khi Dragon ở ngoài khung, một đường chỉ hướng và khoảng cách nằm ở mép màn hình.

## Góc nhìn quỹ đạo

Nút **Orbit**: Trái Đất đúng tỉ lệ, ISS ở vị trí tính bằng SGP4 từ TLE mới nhất của CelesTrak (lưu tạm 2 giờ trên máy người xem; không tải được thì dùng `data/orbits.json`). Mặt Trời đúng hướng theo giờ UTC nên ranh giới ngày đêm đúng; vòng quỹ đạo vẽ trong hệ quán tính, vết trên mặt đất quay theo Trái Đất. Thời gian: Live, ×60, ×600. Bấm vào ISS để về trạm.

Đã đối chiếu 13/10/2026 08:09:42 UTC với api.wheretheiss.at: 9,69° S, 118,79° E, cao 420,6 km, 7,661 km/s, cả hai nguồn trùng nhau.
Đây là dự báo từ TLE, không phải đo đạc trực tiếp; sai số tăng vài km mỗi ngày tính từ thời điểm TLE.

Thêm vệ tinh: thêm mã NORAD vào `OBJECTS` trong `tle.py` và gọi `addOrbiter({ id, name, norad })` trong `js/orbit/view.js`. Chuyến tiếp tế (phóng → bám quỹ đạo → tiếp cận) có thể ghép `js/sim/orbit.js` cho chặng xa với `js/sim/rendezvous.js` cho chặng gần.

Ảnh Trái Đất (ngày, đèn đêm) đang lấy trực tiếp từ threejs.org; nên thay bằng ảnh NASA Blue Marble / Black Marble (miền công cộng) đặt trong `assets/`.

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
- Trình duyệt chỉ tải lại module nào đổi nội dung: import map trỏ mỗi module tới bản có dấu băm của chính nó.

## Thêm hoạt cảnh phức tạp

1. Viết mô hình chuyển động như `js/sim/eva.js`: một hàm trả về `{ layout: { size }, step(time, out) }`, ghi tư thế vào một `Float32Array`. Không tạo lưới trong hàm này.
2. Đăng ký nó trong `js/sim/worker.js` (`factories`).
3. Trong `js/figures/`, dựng lưới như `figures/eva.js` (`createZ1Maintenance`). Gửi `{type: 'init', kind, payload}` một lần. Mỗi khung gửi `{type: 'step', time, buffer}`, rồi chép tư thế nhận về vào lưới. Gọi `update(delta)` của hình mới trong `advance()` (`ui/controller.js`).
   Mô hình chạy trong worker nên không làm chậm luồng vẽ; nếu trình duyệt không có worker, cùng mô hình đó chạy trên luồng chính.

## Mô hình

Phần lớn trạm dựng bằng code three.js theo số đo từ tệp mẫu `ISS_stationary.glb`. Riêng lưới PMA-2 và 3 ảnh texture của nó lấy nguyên từ tệp này (ảnh nén lại thành JPEG chất lượng 92).

| Mô hình | Tác giả | Giấy phép |
|---|---|---|
| [Animated Floating Astronaut in Space Suit Loop](https://sketchfab.com/3d-models/animated-floating-astronaut-in-space-suit-loop-e2c4b146e58141e4b87917456a9970b1) | LasquetiSpice | CC BY 4.0, đã đổi tư thế, vật liệu, hoạt cảnh, texture 1024 px |
| [Human](https://sketchfab.com/3d-models/human-5913acb8485d4ef09d0770d8d7d831ba) | doctortex | CC BY 4.0, đã gắn khung xương và tạo dáng |
| [SpaceX - Dragon 2](https://sketchfab.com/3d-models/spacex-dragon-2-1b125e30a2cb442288580290536fbe5d) | KUBAHA | CC BY 4.0, đã đổi vật liệu, thêm hoạt cảnh ghép nối |
| [Space X Dragon Suit](https://sketchfab.com/3d-models/space-x-dragon-suit-c600b853268249bdb9dd59bac7ead0b9) | Diuis | CC BY 4.0, đã đổi vật liệu, tư thế ngồi |
