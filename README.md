# ISS · Trạm Vũ trụ Quốc tế 3D

Mô hình three.js (WebGL) của Trạm Vũ trụ Quốc tế: 26 khối có thể chọn để xem chi tiết, cấu hình hiện tại và cấu hình gốc,
Crew Dragon tiếp cận và ghép nối theo phương trình Clohessy–Wiltshire với các điểm chờ của Crew-2, phi hành đoàn làm việc
trong Columbus, phi hành gia đi bộ ngoài không gian ở Z1 (leo bằng tay, móc dây thắt lưng, súng vặn PGT, dây an toàn
85 ft nối về khóa khí Quest), góc nhìn quỹ đạo (ISS ở đúng vị trí hiện tại trên quả địa cầu thật tỉ lệ) và góc nhìn
Launch: Falcon 9 đưa Crew Dragon rời bệ LC-39A lên quỹ đạo theo lịch chuyến Demo-2.
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
| `js/ui/` | `ghost` (khối mờ, nét viền), `rendezvous-guide` (đường tiếp cận, điểm chờ, vùng cấm 200 m), `controller` (chọn bộ phận, góc nhìn, nhãn, nút bấm, vòng lặp khung hình) |
| `js/orbit/sky.js` | bầu trời thật dùng chung: Trái Đất (ngày, đêm, mây), ISS, Mặt Trăng, Mặt Trời, sao, theo giờ hiện tại; vẽ cả nền Trái Đất sau trạm. Tải khi mở lần đầu |
| `js/orbit/view.js` | góc nhìn quỹ đạo: khung ISS / Earth & Moon / Sun, zoom ra tới 600 triệu km, tua nhanh thời gian |
| `js/launch/` | góc nhìn Launch: `vehicle` (Falcon 9 + Crew Dragon, cánh lưới, chân đáp, lửa động cơ), `ground` (ảnh mặt đất quanh bệ, tháp, khói, bầu trời trong khí quyển), `view` (camera, hai lượt vẽ, bảng điều khiển). Tải khi mở lần đầu |
| `js/sim/ascent.js` | mô phỏng bay Falcon 9 (lực đẩy, lực cản, khí quyển, Trái Đất quay) và tầng 1 quay về sà lan, tua thời gian; chỉ có toán |
| `js/sim/rendezvous.js` | mô hình tiếp cận của Crew Dragon (Clohessy–Wiltshire, lịch Crew-2), chỉ có toán |
| `js/sim/orbit.js` | quỹ đạo từ TLE: SGP4 (satellite.js), bóng Trái Đất, vết trên mặt đất; vị trí Mặt Trời, Mặt Trăng, quỹ đạo Trái Đất (astronomy-engine) |
| `js/sim/eva.js` | mô hình chuyển động của phi hành gia EVA (khung xương, leo tay vịn, dây, súng PGT), không chứa lưới |
| `js/sim/worker.js` | Web Worker chạy các mô hình chuyển động, trả tư thế về mỗi khung hình |
| `js/workers/line-art.js` | Web Worker dựng nét viền cho các khối mờ |
| `data/*.json` | lưới, khung xương, chuyển động lấy từ các mô hình gốc; `orbits.json` là TLE dự phòng của ISS |
| `tle.py` | làm mới `data/orbits.json` từ CelesTrak (publish.sh tự gọi) |
| `falcon9.py` | chuyển model Falcon 9 (GLB) thành `data/falcon-9.json` và `assets/falcon-9/first-stage.png`: `python3 falcon9.py ~/Downloads/falcon_9_-_spacex.glb` |
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
| Dừng ở điểm 2 (go/no-go) | 5 phút | đứng yên trên trục V-bar: điểm cân bằng, không cần đẩy; mở nắp mũi | ×30 |
| Tiếp cận cuối | 5 phút | 7 cm/s, chạm cổng ở 5 cm/s | ×4 |
| Bắt mềm → móc khóa xong | 13 phút | | ×60 |

Nắp mũi đóng suốt chặng xa và chỉ mở khi Dragon dừng ở điểm 2, cách 20 m (chủ ý trình bày: ngoài thực tế nắp mở khoảng một phút sau khi tách tầng hai). Hai động cơ Draco phía trước nằm dưới nắp nên chỉ phun khi nắp đã mở; trước đó việc hãm tốc dùng các vòi chếch về trước ở bốn cụm bên sườn. Xem Dragon (bấm ô CREW DRAGON) thì khung hình bám theo Dragon và phần đường còn lại, kèm đường đi dự kiến, các điểm chờ, vùng cấm 200 m. Ở góc nhìn toàn trạm, khi Dragon ở ngoài khung, một đường chỉ hướng và khoảng cách nằm ở mép màn hình.

## Góc nhìn quỹ đạo

Nút **Orbit**: Trái Đất đúng tỉ lệ, ISS ở vị trí tính bằng SGP4 từ TLE mới nhất của CelesTrak (lưu tạm 2 giờ trên máy người xem; không tải được thì dùng `data/orbits.json`). Mặt Trời đúng hướng theo giờ UTC nên ranh giới ngày đêm đúng; vòng quỹ đạo vẽ trong hệ quán tính, vết trên mặt đất quay theo Trái Đất. Thời gian: Live, ×60, ×600. Bấm vào ISS để về trạm.

Mặt Trăng và Mặt Trời ở vị trí và kích thước thật, tính bằng astronomy-engine (MIT, sai số khoảng 1 phút cung) rồi xoay về xích đạo thời điểm hiện tại cho khớp hệ của SGP4. Mặt Trăng được Mặt Trời chiếu sáng nên pha trăng là pha thật. Ba khung: **ISS**, **Earth & Moon** (cùng quỹ đạo Mặt Trăng trong một tháng), **Sun** (cùng quỹ đạo Trái Đất trong một năm); camera nhìn từ 40° phía trên mặt phẳng hoàng đạo. Lăn chuột cũng ra được tới 600 triệu km: tốc độ zoom tăng theo khoảng cách. Ở xa, Trái Đất và Mặt Trăng nhỏ hơn một điểm ảnh nên có chấm đánh dấu và nhãn.
Đã kiểm tra ngày 13/10/2026: Mặt Trời cách 149,3 triệu km, xích vĩ −7,9°; Mặt Trăng cách khoảng 398.000 km, sáng 8% (trăng non 3 ngày).

Đã đối chiếu 13/10/2026 08:09:42 UTC với api.wheretheiss.at: 9,69° S, 118,79° E, cao 420,6 km, 7,661 km/s, cả hai nguồn trùng nhau.
Đây là dự báo từ TLE, không phải đo đạc trực tiếp; sai số tăng vài km mỗi ngày tính từ thời điểm TLE.

Thêm vệ tinh: thêm mã NORAD vào `OBJECTS` trong `tle.py` và gọi `addOrbiter({ id, name, norad })` trong `js/orbit/view.js`. Chuyến tiếp tế (phóng → bám quỹ đạo → tiếp cận) có thể ghép `js/sim/orbit.js` cho chặng xa với `js/sim/rendezvous.js` cho chặng gần.

Nút **Earth backdrop** (nền sau trạm) vẽ cùng bầu trời thật đó sau trạm, **đúng tỉ lệ**: trạm 109 m, Trái Đất 12.742 km, ISS ở độ cao thật (~420 km).
- Trạm vẫn vẽ bằng camera trực giao. Nền vẽ bằng camera phối cảnh tương đương: mắt lùi lại theo hướng nhìn một khoảng sao cho góc nhìn 45° phủ đúng khung hình của trạm tại tâm nhìn (khung cao 200 m thì mắt cách khoảng 240 m). Hai camera khớp nhau đúng ở mặt phẳng tâm nhìn, nên kích thước trạm so với Trái Đất là kích thước thật.
- Hệ trục của trạm là hệ quỹ đạo của ISS (đỉnh +y, hướng bay −z, mạn phải +x). ISS bay gần như theo hệ này, nên Trái Đất luôn ở dưới, mặt đất phía dưới là nơi ISS đang bay qua, ngày đêm đúng giờ.
- Ở gần, cảnh giống ảnh chụp từ tàu bay quanh trạm: đường chân trời cong thấp hơn phương ngang 20°, mặt đất trôi qua với tốc độ 7,7 km/s.
- Zoom ra (bật nền thì xuống được tới 10⁻⁷, bình thường 45%): mắt lùi xa dần, trạm nhỏ lại đúng tỉ lệ. Khung cao khoảng 6 km (cửa sổ cao 800 điểm ảnh) thì trạm còn chưa tới 14 điểm ảnh, chấm **ISS** cùng nhãn độ cao hiện thay. Khung cao khoảng 15.000–20.000 km thì thấy trọn quả địa cầu cùng vòng quỹ đạo. Khung cao một đến hai triệu km thì thấy cả Mặt Trăng; Trái Đất, Mặt Trăng, Mặt Trời có nhãn như trong góc nhìn Orbit. Dưới mức 45%, mỗi nấc lăn chuột zoom nhanh dần, nút +/− mỗi lần nhảy bốn nấc. Thước tỉ lệ đổi sang km.
- Kéo chuột phải dịch tâm nhìn, mắt dịch theo. Ở gần, trạm trượt trên nền Trái Đất ở xa, nền gần như đứng yên vì cách hàng trăm km. Ở xa, Trái Đất dịch theo.
- Vòng chấm là một phần ba quỹ đạo thật quanh trạm (sáng phía trước, mờ phía sau). Khi mắt đã lùi xa hơn 8.000 km thì hiện cả vòng.
- Khi Dragon nhỏ hơn 26 điểm ảnh, có vòng tròn đánh dấu nó.
- Mây là ảnh tĩnh, không phải mây thời gian thực.
- Ánh sáng trên trạm vẫn cố định để mô hình luôn rõ. Khi ISS bay vào vùng đêm, nền tối nhưng trạm vẫn sáng.
- Ảnh Trái Đất 4096 px chỉ có khoảng 10 km mỗi điểm ảnh. Nhìn thẳng xuống từ 420 km, một khung 45° phủ khoảng 350 km mặt đất, tức chỉ khoảng 35 điểm ảnh của bản đồ, nên mặt đất ngay dưới trạm bị mờ; về phía chân trời thì đỡ hơn. Muốn sắc nét thì phải tải ảnh theo ô (ví dụ NASA GIBS) như các bản đồ trực tuyến.

Ảnh Trái Đất (ngày, đêm, mây, độ nhám) của [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0), bản thu nhỏ trong ví dụ của three.js, lấy trực tiếp từ threejs.org. Ảnh Mặt Trăng là của ví dụ three.js, chưa rõ giấy phép; nên thay bằng ảnh Mặt Trăng 2K của Solar System Scope (CC BY 4.0) đặt trong `assets/`.

## Góc nhìn Launch

Nút **Launch** (thanh góc nhìn, hoặc tab *Launch* của Crew Dragon) mở cảnh Falcon 9 phóng Crew Dragon từ LC-39A, bắt đầu từ T−10 s. Hai nút **Rocket & Dragon** / **Booster** chọn bám theo tên lửa lên quỹ đạo hay tầng 1 bay về sà lan; mỗi bên có nhịp tua riêng (chậm lại quanh các lần đốt và lúc đáp).

### Mô phỏng bay (`js/sim/ascent.js`)

Không còn nội suy telemetry: đường bay được tích phân (Runge–Kutta bậc 4, bước 0,05 s) mỗi lần mở góc nhìn, mất khoảng 70 ms.

- **Lực:** 9 Merlin 1D (914 kN, Isp 311 s trong chân không mỗi động cơ, trừ 0,68 m² miệng phun × áp suất không khí, nên ở mặt đất còn 845 kN), MVac (981 kN, Isp 348 s), lực cản theo số Mach trên thân 3,66 m, trọng lực, khí quyển chuẩn US-1976. Hệ quán tính, Trái Đất quay bên dưới; khối lượng giảm theo lượng nhiên liệu đốt.
- **Khối lượng:** tầng 1 khô 25,6 t + 405 t nhiên liệu, tầng 2 khô 4 t + 107,5 t, Crew Dragon 12,5 t (549 t lúc cất cánh, đúng số công bố).
- **Dẫn đường:** bay thẳng 10 s, nghiêng 1,9° về hướng 31,6° (so với mặt đất), rồi gravity turn (lực đẩy theo vận tốc so với không khí). Giảm còn 72% qua Max-Q, giữ ≤ 3,1 g cho phi hành đoàn. Tầng 2 lái theo luật tiếp tuyến tuyến tính, tắt khi đạt quỹ đạo.
- **Khớp với thực tế:** tắt máy tầng 1 ở 84,5 km, 1.899 m/s (telemetry DM-1: 88 km, 1.871 m/s). Tầng 2 tắt ở T+8:51 (NASA: 8:47), quỹ đạo 202 × 216 km, nghiêng 51,64°. Bảng điều khiển hiện độ cao, vận tốc so với mặt đất và quán tính, quãng đường, gia tốc (g), áp suất động.
- **Tầng 1 quay về:** piston đẩy rời 1 m/s, bay quán tính lên tới khoảng 210 km, lật đuôi, mở cánh lưới. Rơi qua 70 km thì đốt 3 động cơ 20 s, rơi đuôi trước qua lớp khí dày. Đốt 1 động cơ để đáp, châm đúng lúc lực đẩy 85% vừa đủ dừng ở mặt sà lan (một Merlin không giảm được dưới mức lơ lửng). Bung chân 4–9 s trước khi chạm, chạm ở 1,7 m/s, còn khoảng 6,5 t nhiên liệu. Sà lan (91 × 52 m) đặt đúng chỗ tầng 1 rơi xuống, cách bệ 460 km.

| T+ | Sự kiện | Nguồn |
|---|---|---|
| −0:03 | đánh lửa | lệnh |
| 0:45 | Max-Q, 19 kPa | mô phỏng |
| 2:33 | tắt máy tầng 1 | lệnh (NASA) |
| 2:36 | tách tầng | lệnh (NASA) |
| 2:44 | tầng 2 khởi động | lệnh (NASA) |
| 8:17 | tầng 1 đốt giảm tốc (NASA: 7:15) | mô phỏng |
| 8:51 | tầng 2 tắt máy (NASA: 8:47) | mô phỏng |
| 9:22 | tầng 1 đốt hạ cánh | mô phỏng |
| 10:14 | tầng 1 đáp sà lan (NASA: 9:22) | mô phỏng |
| 12:00 | Dragon tách, lò xo đẩy khoảng 0,4 m/s | lệnh (NASA) |
| 12:46 | mở nắp mũi, rồi nút *On to the station* | lệnh (NASA) |

Tầng 1 về muộn hơn thực tế khoảng 1 phút: theo đúng vận tốc và góc bay lúc tắt máy của telemetry, nó lên tới khoảng 210 km nên rơi về lâu hơn; hướng đi, khối lượng và lực cản thật của tầng 1 không được công bố đủ để khớp hơn.

### Cảnh

- Thời gian chạy nhanh dần: ×1 quanh lúc cất cánh và các lần tách, tới ×17 ở giữa. Bấm một mốc trong danh sách để nhảy tới trước mốc đó 4 giây (mốc của tầng 1 tự chuyển sang bám Booster).
- Camera tự bám: bên bệ lúc cất cánh, rồi bên hông tên lửa, sát chỗ tách tầng, trên Dragon; hoặc theo tầng 1 rơi xuống và hạ thấp cạnh sà lan. Kéo chuột để xoay, lăn chuột để ra xa tới 3.000 km. Nút *Follow* trả lại camera tự động.
- Hai lượt vẽ: bầu trời thật (`sky.js`, đúng ngày giờ Demo-2, đơn vị km) nhìn từ vị trí thật của camera trên quả địa cầu, rồi bệ phóng, mặt đất, tên lửa trong hệ toạ độ của bệ (đơn vị m: x đông, y lên, z nam).
- Mặt đất: bốn vòng ô ảnh quanh bệ, mỗi vòng 4 × 4 ô, tải từ máy chủ khi mở lần đầu (64 ô, vài MB). Gần nhất là ảnh USGS National Map (public domain) khoảng 2 m, 17 m, 130 m mỗi điểm ảnh. Ngoài cùng là NASA Blue Marble (GIBS, public domain) khoảng 1 km mỗi điểm ảnh ra tới 1.100 km, mép mờ dần vào bản đồ Trái Đất. Ngoài lãnh thổ Mỹ, ô USGS trong suốt nên vòng thô hơn hiện ra.
- Bầu trời: lớp khí quyển xanh mỏng dần khi lên cao và mất hẳn ở khoảng 60 km. Lớp sáng ở mép Trái Đất (vỏ khí quyển của `sky.js`) hạ dần từ 178 km xuống khoảng 50 km khi camera xuống thấp, để khỏi thành một dải dày trên đường chân trời.
- Tháp phóng, giàn dựng, giá phóng và sà lan là mô hình giản lược. Tay đón phi hành đoàn vẫn để ở vị trí nối với Dragon; thực tế tay này rút ra từ trước khi phóng. Xi lanh của chân đáp ẩn khi chân bung (chúng không co giãn).

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
| [Falcon 9 - SpaceX](https://sketchfab.com/3d-models/falcon-9-spacex-394f7cf52d124bbd9db69f24d1ff2f08) | Stanley Creative | CC BY 4.0, đã bỏ fairing và cụm bản lề chân đáp, tách 4 cánh lưới và 4 chân đáp, lượng tử hoá lưới (`falcon9.py`) |

Ảnh mặt đất quanh bệ phóng: [USGS National Map](https://www.usgs.gov/programs/national-geospatial-program/national-map) và NASA [GIBS](https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api) (Blue Marble), đều là public domain.

Model *Falcon 9 - Crew Dragon* của KUBAHA (CC BY 4.0) không dùng: lưới gộp theo vật liệu nên không tách tầng được, và kích thước lệch thật (cao 64,6 m, rộng 4,14 m).
