# ISS · Trạm Vũ trụ Quốc tế 3D

Mô hình three.js của Trạm Vũ trụ Quốc tế, cấu hình ngày 5/11/2026. Trang có:
- Chọn bộ phận để xem chi tiết.
- Mặt Trời thật và ISS Live.
- Canadarm2 né va chạm, đón và thả tàu hàng Cygnus, chở phi hành gia từ Quest ra ESP-2.
- Crew Dragon tiếp cận.
- Phi hành đoàn trong Columbus và Tranquility (máy tập, bay qua khoang, chụp ảnh ở Cupola).
- Hai phi hành gia EVA ra khỏi Quest, lần tay vịn tới Z1, vặn bu lông rồi quay về.
- Góc nhìn quỹ đạo kèm bản đồ gió và mưa (hai lớp bật tắt riêng).
- Góc nhìn Launch: Falcon 9 phóng Demo-2 tới lúc ghép vào ISS.
- Góc nhìn Cupola: nhìn từ trong vòm kính xuống mặt đất đang trôi dưới trạm, ảnh vệ tinh theo ngày.

Trang: https://michaeltran75.github.io/iss-station/ (nhúng Wix bằng iframe).

## Chạy và đưa lên mạng

- Xem trên máy: chạy `./preview.sh`. Module, worker và `data/` cần máy chủ cục bộ, không mở được qua `file://`.
- Sau khi sửa JS hoặc CSS, chạy `python3 stamp.py`. Lệnh này đóng dấu `?v=<băm>` cho mọi tệp và viết lại import map cùng modulepreload trong `index.html`.
- Đưa lên mạng: `./publish.sh "mô tả"`. Lệnh này chạy `tle.py` để làm mới TLE, chạy `stamp.py`, rồi commit và push.
- Nhúng Wix: *Nhúng trang web* với đường dẫn trên, hoặc *Nhúng HTML* với:

```html
<iframe src="https://michaeltran75.github.io/iss-station/" style="width:100%;height:100%;border:0" allow="fullscreen" loading="lazy" title="ISS · Trạm Vũ trụ Quốc tế 3D"></iframe>
```

## Tệp

| Tệp | Nội dung |
|---|---|
| `index.html`, `css/app.css` | khung trang và giao diện; khối `<!-- modules -->` do `stamp.py` viết |
| `js/boot.js`, `js/main.js` | nạp dữ liệu, rồi import mọi module theo thứ tự dựng cảnh |
| `js/core/` | renderer, camera, mức chất lượng, vật liệu, sổ bộ phận `part()`, SARJ, giải phóng bộ nhớ, chi tiết dùng chung |
| `js/parts/` | mỗi tệp một bộ phận; `assembly.js` chạy sau cùng |
| `js/robotics/` | Canadarm2, MBS, Dextre: động học, tư thế, ISS Live, động tác, bản đồ khoảng hở, lập đường |
| `js/ui/` | khối mờ, đường tiếp cận, menu và bảng của Canadarm2, `controller.js` (chọn, góc nhìn, nút, vòng lặp khung hình) |
| `js/orbit/` | bầu trời thật (`sky.js`), góc nhìn quỹ đạo, TLE, Mặt Trời thật, tư thế trạm, ISS Live, bản đồ gió + mưa, bão, góc nhìn Cupola (ô ảnh GIBS, tên nơi chốn) |
| `js/launch/` | góc nhìn Launch: tên lửa, mặt đất, khu phóng 39, khói, cắt dọc, nhãn, âm thanh, sà lan |
| `js/sim/` | phần chỉ có toán: bay lên quỹ đạo, luồng xả, gió, tiếp cận Clohessy–Wiltshire, SGP4, phi hành gia EVA (`eva.js`) và đường tay vịn Quest → Z1 (`eva-route.js`) |
| `js/workers/` | nét viền khối mờ; bản đồ khoảng hở và lập đường cho Canadarm2 |
| `data/`, `assets/` | lưới, chuyển động, TLE dự phòng, ảnh texture |
| `tle.py`, `falcon9.py`, `droneship.py`, `launchsite.py` | làm mới TLE; chuyển mô hình Falcon 9 và sà lan; dựng `data/launch-site.json` |
| `tools/robotics/` | công cụ phát triển (trang không tải): kiểm khoảng hở, tìm lại đường cho động tác |

## Quy tắc module

1. Thứ tự import trong `js/main.js` là thứ tự dựng cảnh, và nó quyết định thứ tự vẽ các mặt trùng độ sâu. Đừng đảo các dòng.
2. Mỗi module chỉ import từ module đứng trước nó (core → parts → figures → ui → main). Không import vòng.
3. Chỉ `core/data.js` và `main.js` được dùng `await` ở cấp module. Cần dữ liệu thêm thì thêm vào `core/data.js`.
4. Biến `let` chỉ gán trong module khai báo nó; module khác muốn đổi thì gọi hàm (ví dụ `markShadowsDirty()`).
5. Viết import không có `?v=`; `stamp.py` lo phần đó. Riêng các module mà worker nạp (`js/robotics/`) thì import nhau có dấu, vì worker không có import map.

## Thêm bộ phận

1. Tạo `js/parts/ten.js`, rồi gọi `part('id', 'Tên', 'NN / NHÓM', 'mô tả', [['Thông số', 'giá trị']], [x, y, z], (kit, group) => { … })`.
   - `kit` gộp các chi tiết chỉ khác màu hay độ nhám vào chung một lưới.
   - Bộ phận chỉ có trong một cấu hình thì thêm id vào `modernParts` hoặc `referenceParts` (`core/station.js`).
2. Thêm import vào `main.js`, trước `parts/assembly.js`. Bộ phận gắn vào giàn hay cụm Nga thì thêm id vào danh sách trong `assembly.js`.

## Cấu hình 5/11/2026

Nút cấu hình đổi giữa 5/11/2026 (mặc định) và cấu hình gốc giản lược. Cấu hình 5/11/2026 theo ảnh tàu ghé thăm của NASA:
- Crew Dragon ở cổng trước Harmony. Cargo Dragon CRS-35 ở đỉnh Harmony, qua PMA-3.
- Progress MS-34 ở đuôi Zvezda, Progress MS-35 ở Poisk, Soyuz MS-29 ở Prichal.
- Tám tấm iROSA.
- Rassvet bỏ khoang khí. Kibo bỏ chảo ICS. Columbus bỏ SOLAR, thêm ACES.
- Dextre trên MBS.

Các khối chỉ chạm nhau ở mặt ghép (cách 4–14 mm).

Bố trí giàn theo mô hình NASA (`js/core/station.js`):
- S1/P1 từ 7 đến 21 m, SARJ ở ±26,6 m.
- S4/S5/S6 dựng như mô hình NASA.
- Sải trạm 111,45 m.

## Mặt Trời thật và ISS Live

**Real Sun** (bật sẵn) tính hướng Mặt Trời từ TLE (SGP4) và astronomy-engine, theo tư thế trạm (mặc định −XVV, `js/orbit/attitude.js`):
- SARJ: θ = atan2(s_z, s_y).
- BGA: φ = atan2(−s_x, √(s_y² + s_z²)).
- Đèn tắt dần khi trạm vào bóng Trái Đất.
- TRRJ giữ góc đặt sẵn: trái 14,94°, phải −29,74°. Phải quay được ±105°; trái chỉ tới 19,5° vì chạm Bishop.

**ISS Live** (tắt sẵn) đọc telemetry NASA qua Lightstreamer (`js/orbit/live.js`):

| Thành phần | Mục telemetry / cách đọc |
|---|---|
| SARJ | S0000004 (trái), S0000003 (phải) |
| 8 BGA | mỗi cánh một mục |
| TRRJ | S0000002 (trái), S0000001 (phải) |
| Tư thế | quaternion USLAB000018–21 |
| Canadarm2, MBS, Dextre | mục bên dưới |

- Mất liên lạc thì giữ dữ liệu cuối; khớp đang bám Mặt Trời thì tiếp tục bám.
- Bật hoặc tắt Live thì các khớp và tư thế lướt tới trong khoảng 5 giây (lò xo tắt dần tới hạn, `glide` trong `controller.js`).
- `window.issAtlas.showSunAt(date)` đặt trạm ở một thời điểm, `setLive(true)` bật Live.

## Canadarm2 và Dextre

Bấm Canadarm2, Dextre hoặc Cygnus: thẻ động tác hiện cố định bên trái thẻ thông tin (inspector), ngang đầu thẻ, không đường dẫn, không chạy theo tay (`js/ui/robotics-menu.js`).
- Thẻ hiện bước đang chạy, thanh tiến độ và nút **Stop**.
- Trên điện thoại, bảng chi tiết che cánh tay nên danh sách nằm ở đầu bảng chi tiết.
- Bảng chi tiết hiện trạng thái và góc 7 khớp.

Sáu động tác (`sequences.js`, tốc độ thật chiếu nhanh: khớp 4°/s ×12, MT 2,5 cm/s ×80):
- **Walk to Destiny** (khoảng 67 s): đi bằng hai đầu sang chốt Destiny rồi về.
- **Carry Dextre** (khoảng 51 s): nhấc Dextre khỏi PDGF 2, mang ra, xoay thân 60° rồi về 0, đặt lại.
- **Ride to worksite 1** (khoảng 56 s): MBS chạy tới WS1 (21,69 m), tay mở ra tư thế ngày 7/11, rồi về.
- **Capture Cygnus** (khoảng 135 s): đi sang chốt Destiny, Cygnus bay lên điểm đón dưới trạm, tay bắt chốt trên khoang dịch vụ, đưa tàu lên cổng nadir của Unity, rồi về.
- **Release Cygnus** (khoảng 126 s): ngược lại; tàu rời đi rồi ẩn.
- **Carry a spacewalker** (khoảng 133 s): gắn bệ chân vào đầu tự do, MBS ra 11,5 m, đầu tay tới dưới cửa Quest, người ra cửa đứng lên bệ, tay đưa người tới dưới ESP-2, người tháo hai bu lông, về lại cửa, người vào, tay về đỗ, tháo bệ.

Cygnus (`js/parts/cygnus.js`, trạng thái `cargo` trong `pose.js`):
- `cargo.on`: `away` (ẩn), `free` (bay dưới trạm, `cargo.range` là quãng còn lại), `tip` (tay đang cầm), `berth` (trên cổng).
- Không thuộc cấu hình: lúc mở trang tàu vắng mặt, không bấm được, không có nhãn, dòng của nó trong danh sách bị khoá.
- Thẻ chỉ hiện Capture khi tàu vắng và Release khi tàu trên cổng; bốn động tác kia chạy được ở cả hai trường hợp.
- Bước riêng trong `motion.js`: `arrive`, `berth`, `unberth`, `depart` (dựng sẵn, không lập đường).
- Né va chạm tính tàu khi nó trên cổng hoặc cách điểm đón dưới 30 m; lúc tay đang cầm thì không, và phần nhìn trước không tính tàu.
- Chưa nối với phần Launch.

Phi hành gia trên đầu tay (trạng thái `crew` trong `pose.js`, hình ở `js/figures/rider.js`):
- `crew.seat` 0…1: bệ chân (tấm đỡ, thanh giữ mũi giày, kẹp gót, cột và tay nắm; `js/parts/robotics.js`) hiện dần trên đầu tự do. `crew.on`: `inside` (trong Quest, không vẽ) hoặc `tip` (đứng trên bệ).
- Khung thân `crewFrame`: gốc ở hông, x sang trái, y lên đầu, z ra trước; hông cách miệng đầu tay `CREW_HIP` 1,31 m, đế giày `CREW_SOLE` 0,30 m.
- Bước riêng trong `motion.js`: `seat` (2 s), `board` (26 s), `work` (22 s), `alight` (26 s). Tay đứng yên suốt ba bước sau; `crew.act` và `crew.u` cho biết bước nào, tới đâu.
- Có người trên bệ thì tay chạy theo quãng đường của người: 10 cm/s thật (×12), cộng phần cho góc xoay khớp.
- Hai tư thế `BOARD`, `WORK` (`sequences.js`) đánh dấu `exact`: tay dừng đúng tư thế đó vì hình người khớp với cửa và bu lông ở đó.
  - `BOARD`: bệ lệch 0,56 m khỏi trục cửa, hông dưới mặt cửa 1,3 m.
  - `WORK`: mặt dưới hộp thiết bị ESP-2 trước ngực 0,74 m; tấm che và hai bu lông (`js/parts/quest.js`, `evaWorksite`) trước vai trái.
- `index.js` xuất `crewView` (`seat`, `on`, `act`, `u`, `at` = ma trận khung thân); `rider.js` đặt xương mỗi khung trên luồng chính, không qua worker.
  - `board`: đầu ra trước, hai găng bắt tay nắm, thân xoay quanh tay nắm, giày vào bệ. Lọt cửa trong bán kính 0,47 m (cửa 0,70 m).
  - `work` (bảng giờ `WORK` trong `rider.js`): găng trái lấy súng vặn ở hông trái, vặn bu lông 1 rồi 2 (mỗi cái 4,6 s), cất, về tay nắm; găng phải giữ tay nắm.
  - `alight`: `board` chạy ngược.
- Số đo trong trang: cổ tay ≤ 0,34 m/s, khuỷu ≤ 0,24 m/s, gia tốc ≤ 0,83 m/s²; tay trái duỗi thấp nhất 35 % lúc đưa súng qua ngực, khuỷu không lật.
- Stop lúc người đang trên bệ: chạy tiếp tới khi người vào lại Quest.
- Mới đo lúc Cygnus vắng mặt.
- Bẫy:
  - Hình người nằm dưới bộ phận `robotics`: lưới trạm của `clearance.js` bỏ qua bộ phận này, nên người được đo bằng hình cầu.
  - `bodyFrames` trả khung theo thân vật lý; đầu gốc là B thì chuỗi đảo (khâu k = thân 7 − k).
  - Đọc đỉnh lưới có xương phải gọi `group.updateMatrixWorld(true)` trước.
  - Camera trực giao: phóng gần bằng `camera.zoom`, không bằng khoảng cách.

Né va chạm (`field.js`, `collision.js`, `map.js`, `planner.js`, worker `js/workers/robotics.js`):
- **Bản đồ khoảng hở.**
  - Khoảng 3 s sau khi mở trang, worker dựng trường khoảng cách dải hẹp (lưới 0,25 m, dải 1 m) từ 1,7 triệu tam giác, mất khoảng 1,4 s.
  - Mỗi khối cứng một trường: trạm, mỗi cánh pin, tản nhiệt, ăng-ten, Dragon, MBS, Dextre.
  - Cánh tay và Dextre là chuỗi hình cầu; khoảng hở trừ biên 0,08 m.
  - Bệ chân và người: 15 hình cầu `CREW_SPHERES` (bệ, chân, hông, thân kèm ba lô, mũ, khuỷu, cột và tay nắm, súng vặn), tính từ lúc bệ gắn lên; so với trạm, MBS, Dextre, tàu và nửa xa của cánh tay (`CREW_LINKS`).
- **Lập đường.**
  - Thứ tự thử: đi thẳng, rồi qua một tư thế đã biết, rồi tìm bằng RRT-Connect; sau đó rút ngắn, bo góc và chia đều.
  - Mọi đoạn được kiểm liên tục (conservative advancement).
  - Đường cách mọi thứ ≥ 0,05 m, và thêm 0,25 m với khối tự chuyển động.
  - Không tìm được thì lấy đường chỉ cần không chạm.
  - Tư thế đích bị tấm pin chắn thì dời sang tư thế thông gần nhất.
  - Đường chạy theo độ dài nên tốc độ đều: khớp tối đa 48°/s, MT 2 m/s.
- **Đi trên ray.**
  - Tay gập vào một tư thế thông suốt cả ray: tư thế đang đứng, tư thế đỗ, hoặc một trong 4 `RIDE_POSES` đã kiểm với 108 tổ hợp góc SARJ/BGA/TRRJ.
  - Rồi MBS chạy êm và tay duỗi ra ở đầu kia.
  - Các phép thử rẻ chạy trước cho mọi tư thế; một lần RRT tìm về tất cả cùng lúc.
- **Học.** Tư thế các đường đã đi qua được nhớ trong `localStorage` `iss.robotics.routes` (tối đa 30) và thử trước ở lần sau; lần nào cũng kiểm lại.
- **Nhìn trước 2 s.**
  - Mỗi 0,1 s, trang kiểm 2 s sắp tới với vị trí hiện tại của tấm pin và tản nhiệt.
  - Thấy sắp chạm thì giảm tốc về 0 trong 0,5 s.
  - Bước tự do thì lập lại đường; bước tiếp cận dựng sẵn thì chờ.
- **Không cắt cảnh.**
  - Bật/tắt Live, xong động tác hay bấm Stop: tay đi theo đường đã lập.
  - Chỉ đặt ngay khi đổi chốt gốc, đầu gốc, chỗ Dextre đứng, hoặc khi tắt Scene animation.
- **Stop.**
  - Đang đứng trên Destiny hay đang cầm Dextre thì chạy tiếp tới khi an toàn rồi mới dừng.
  - Sau đó tay về tư thế đỗ (hoặc tư thế Live).

ISS Live cho Canadarm2 (mã theo ISS Mimic):

| Mục | Ý nghĩa |
|---|---|
| CSASSRMS002 | chốt gốc |
| CSASSRMS003 | đầu gốc |
| CSASSRMS011 | đầu tự do |
| CSASSRMS004–010 | góc SR..WR |
| CSASPDM0002 | chỗ Dextre đứng |
| CSASPDM0020 | góc thân Dextre |
| CSAMT000001/2 | vị trí và worksite của MT |

- **Quy ước góc** (suy luận theo Xu 2013 và Qin 2023, không chính thức): góc = số đọc + lệch (0, 90, 90, 0, 90, −90, 0°).
- Góc vượt ±270° được lùi một vòng.
- **Thay đổi nhỏ:** lướt tới. Khớp roll và yaw quay đường ngắn; khớp pitch theo chiều số đọc để hai cần không gập qua nhau.
- **Thay đổi lớn:** đi theo đường đã lập.

Kiểm tra: chạy `python3 -m http.server 8769 --bind 127.0.0.1` trong repo, rồi:
- `node tools/robotics/run.mjs check`: dưới 1 phút. Ba động tác cũ được đo hai lần (không tàu, tàu trên cổng); lúc tay cầm tàu thì đo cả thân tàu với trạm (`cargoOut`).
  - Capture / Release: bốn lần vung dài tới điểm chờ (trước khi bắt chốt Cygnus, trước khi về chốt MBS) nối thẳng theo khớp thì quẹt trạm 0,42 m, nên công cụ báo âm ở đó. Trang lập đường vòng cho bốn lần này (đo trong trang: hở 0,13–0,18 m); chưa có tư thế trung gian dựng sẵn.
  - Công cụ dựng lưới cánh pin / tản nhiệt một lần lúc nạp: đo lại trạng thái ghi từ trang đang chạy thì số với `station` chỉ đúng khi cánh pin chưa quay.
  - Số `crew`: hình cầu của bệ chân và người với tam giác thật. Đo trong trang cho Carry a spacewalker: người ≥ 0,27 m (trên đường tới / rời ESP-2, gần Quest nhất), 0,31 m lúc làm việc, 0,74 m ở cửa; cánh tay ≥ 0,37 m.
- `node tools/robotics/run.mjs search`: khoảng 10 phút, in các bước cho `sequences.js`.
- Cả hai cần playwright-core.

Giới hạn:
- Bản đồ là của mô hình này, không phải trạm thật.
- Bước tiếp cận dựng sẵn chỉ chờ, không lập lại.
- Dextre đỗ trên MBS chạm Kibo/PMA-3 khi MT ở x từ −15 đến 0 m.
- Tư thế ngày 7/11 ở WS1 rất sát cánh pin trong mạn phải.

## Crew Dragon tiếp cận

Theo lịch ghép nối Crew-2: 58 phút thật thành 144 s hoạt cảnh.

| Pha | Diễn biến | Tua |
|---|---|---|
| Waypoint 0 → 1 | 400 m dưới trạm → 220 m trên trục ghép, Clohessy–Wiltshire | ×60 |
| Waypoint 1 → 2 | tới điểm dừng 20 m | ×30 |
| Dừng ở Waypoint 2 | go/no-go | ×30 |
| Tiếp cận cuối | 7 cm/s | ×4 |
| Bắt mềm → bắt cứng | | ×60 |

- Hệ số tua chuyển dần theo thang log, không nhảy bậc.
- Nắp mũi mở suốt chặng.
- 16 Draco (`js/parts/draco.js`): động cơ nào đẩy gần hướng cần nhất thì phun, theo xung.
- Bấm CREW DRAGON để camera bám theo Dragon, kèm đường dự kiến, các điểm chờ và vùng cấm 200 m.

## Góc nhìn

- **Chọn bộ phận (xem xuyên):** bộ phận khác còn 10 % đục + nét viền (`js/ui/ghost.js`, nét 0,103). Người (EVA, người trên Canadarm2, phi hành đoàn Columbus / Tranquility, 4 người trong Dragon) giữ 90 %: đánh dấu `userData.astronaut` ở nhóm hoặc ở vật liệu (Dragon: bản sao riêng của vật liệu bộ đồ, vì `material()` dùng chung bộ đệm).
- Đổi khung (chọn bộ phận, nút góc nhìn, Reset) thì camera bay tới khung mới trong 0,6–1,6 s (`fitBox`, `startFlight`). Chạm vào điều khiển thì dừng chuyến bay.
- **Orbit:**
  - Trái Đất đúng tỉ lệ; ISS theo SGP4 từ TLE CelesTrak (lưu tạm 2 giờ, dự phòng `data/orbits.json`).
  - Mặt Trời và Mặt Trăng theo astronomy-engine.
  - Thời gian Live, ×60, ×600.
  - Ba khung ISS / Earth & Moon / Sun; zoom ra tới 600 triệu km.
  - Công tắc nền **Light | Dark** (`js/orbit/theme.js`, `?theme=`).
- **Bản đồ gió** (`js/orbit/earth-map.js`), luôn bật trong Orbit:
  - Bờ biển và biên giới: Natural Earth.
  - Gió 10 m: GFS, bước 3 giờ; lớp màu 0–30 m/s và vệt gió.
  - Nguồn GFS (`js/orbit/gfs.js`): bản NOAA trên AWS (bucket `noaa-gfs-bdp-pds`, CORS mở). Đọc `.idx` (≈ 40 kB) rồi tải đúng đoạn byte của trường cần, giải GRIB2 tại trang (`js/orbit/grib2.js`, mẫu 5.3 complex packing + spatial differencing). Lượt chạy mới nhất có trên bucket (lên sau ≈ 3,5 giờ). AWS lỗi thì dùng ERDDAP PacIOOS; dòng nguồn ghi lượt chạy và nguồn.
  - Dung lượng một bước: gió 1° ≈ 152 kB, mưa 0,5° ≈ 210 kB, cộng các `.idx`. PacIOOS: 290 kB và 257 kB.
  - Bẫy: ERDDAP của NOAA (coastwatch, upwell) lấy dữ liệu từ chính PacIOOS, không phải nguồn độc lập. Hai nguồn không khớp tuyệt đối (gió lệch ≈ 1 m/s rms cùng giờ). Bộ giải mã đã kiểm: bản 1° và 0,5° nén khác nhau của cùng trường khớp ≤ 0,01 m/s.
  - Ở mức zoom gần nhất, số vệt gió còn một nửa.
  - Hai lớp bật / tắt riêng: **Wind** (màu tốc độ + vệt gió) và **Rain** (mặc định tắt). Lựa chọn lưu trong trình duyệt (`iss.orbit.layers`); lớp tắt thì không tải.
  - Mưa: GFS `pratesfc` (PRATE trung bình), cùng nguồn, cùng bước 3 giờ với gió, lưới 0,5°. Là mưa mô hình, trung bình trong khoảng dự báo 3–6 giờ, không phải mưa đo. Thang log 0,1–20 mm/giờ; dưới 0,1 trong suốt. Vẽ trên lớp gió, dưới vệt gió.
  - Bẫy mưa: `pratesfc` đơn vị kg m⁻² s⁻¹ (×3600 = mm/giờ); lưới bắt đầu ở 0° E còn u của quả cầu bắt đầu ở 180° W (lệch nửa vòng trong shader). Đã đo vị trí: 33/33 ô mưa lớn có màu, 2 185/2 214 ô khô không có.
  - Bão: GDACS (đường đã đi, dự báo 5 ngày, nón sai số).
  - 51 đường dự báo tổ hợp ECMWF cho mỗi cơn: `storm-ensemble.js` tự giải mã BUFR.
- **Earth backdrop:** ảnh Trái Đất đúng tỉ lệ sau trạm. Camera phối cảnh tương đương khớp với camera trực giao ở tâm nhìn; zoom ra được tới 10⁻⁷.
- Thêm vệ tinh: thêm mã NORAD vào `tle.py` và gọi `addOrbiter()` trong `js/orbit/view.js`.

## Góc nhìn Cupola

Mắt đặt ở tâm Cupola, nhìn qua cửa sổ xuống mặt đất dưới vị trí thật của trạm (`js/orbit/cupola-view.js`).

- **Lối vào:** không có nút ở thanh góc nhìn. Nhãn "EARTH VIEW / Cupola" (`cupolaLabel` trong `js/ui/controller.js`) thẳng dưới cửa sổ đáy Cupola, cách vòm 40 % quãng tới đáy hộp bao trạm trên màn hình (`stationOnly`, không tính đường bay Dragon), nền giấy 92 % vì thường nằm đè lên trạm, đường dẫn thẳng đứng từ cửa sổ xuống nhãn. Hiện cả khi tắt nhãn bộ phận; ẩn khi chọn bộ phận, ở khoang trong, ở góc nhìn địa cầu. Không đủ chỗ phía trên thanh công cụ (dock) thì nâng lên đè lên trạm, nền chip giữ chữ dễ đọc.

- **Dựng hình:** camera phối cảnh trong chính cảnh trạm (khung cửa, cánh chắn, giàn là mô hình). Trái Đất vẽ trước qua cùng con mắt (`sky.renderFrom`), trạm vẽ đè sau khi xoá độ sâu.
- **Ảnh mặt đất** (`js/orbit/earth-tiles.js`): NASA GIBS, VIIRS NOAA-20 màu thật, ô 512 px.
  - Ngày ảnh = ngày gần nhất đã ghép đủ (lùi khoảng 30 giờ): mây thật của ngày đó, không phải lúc này.
  - Mức 3 (7,8 km / điểm ảnh) tới mức 8 (244 m); máy yếu dừng ở mức 7 (489 m).
  - Tối đa `keep` ô trên GPU (56, máy yếu 32); quá thì chọn thô dần. Rời góc nhìn thì xoá hết.
  - Ô chỉ tải khi Mặt Trời cao hơn khoảng −25° ở điểm dưới trạm. Phía đêm hiện đèn thành phố của bản đồ nền.
  - Lưu lượng đo được: vào góc nhìn 1,1–1,5 MB; trôi trên biển mây khoảng 0,7 MB mỗi phút; zoom thì hơn.
- **Điều khiển:** kéo để xoay / ngẩng (0–80° khỏi phương thẳng xuống; chân trời ở 70°), lăn chuột / chụm tay / nút zoom đổi trường nhìn 16–80°. Nút **Straight down** và **Horizon** (quay tới cửa sổ bên gần nhất, ngẩng 58°; màn hẹp ngẩng 69°).
- **Bảng đọc:** đang ở trên nước / biển nào (`js/orbit/place.js`), toạ độ, giờ Mặt Trời tại chỗ, ngày / chạng vạng / đêm, độ cao, tốc độ, hướng nhìn.
- **Đồng hồ:** luôn chạy thật. Vào góc nhìn thì tốc độ thời gian của Orbit về ×1, độ lệch về 0.

Bẫy:
- Người chụp ảnh ở Cupola, máy ảnh và lớp ốp trong khoang ẩn đi khi vào góc nhìn (`standAside`): mắt nằm đúng chỗ người đó, lớp ốp là vỏ kín sẽ che hết.
- Màn hẹp (bảng đọc rộng hơn 60 % khung): tâm nhìn dời lên khoảng trống phía trên bảng bằng `setViewOffset`; `sky.renderFrom` chép đúng độ dời đó sang camera vẽ Trái Đất, thiếu thì mặt đất lệch khỏi khung cửa.
- Tư thế −XVV: hướng 0 = đầu trước của trạm = ngược chiều bay.
- GIBS trả `no-store`: ô đã bỏ phải tải lại.
- Tên nơi chốn: đường biên Natural Earth 1:110 triệu, đảo nhỏ hơn khoảng 100 km không có; biển chỉ tới cấp đại dương (biển Banda đọc là South Pacific Ocean). Vòng biên cắt kinh tuyến 180° (Fiji) phải dời sang phía đông 180° trước khi thử điểm, không thì cả vĩ tuyến mang tên nước đó.
- Crew Dragon đang tiếp cận hiện trong cửa sổ đáy, lệch khoảng 10° về phía trước, ngay sau khi mở trang.
- Màn dưới 450 px: biểu tượng ở thanh chọn góc nhìn ẩn đi; bảng đọc còn ba hàng, bỏ ô Speed.

## Góc nhìn Launch

Falcon 9 phóng Crew Dragon từ LC-39A theo Demo-2, từ T−4:30 tới lúc ghép vào ISS ở T+19:06:15.
- Hai nút **Rocket & Dragon** / **Booster** chọn bám theo vật nào.
- Màn hình phụ hiện vật còn lại.

**Mô phỏng** (`js/sim/ascent.js`):
- Tích phân RK4 với lực đẩy Merlin/MVac theo áp suất không khí, lực cản theo Mach, khí quyển US-1976 và Trái Đất quay.
- Lực đẩy lúc khởi động và tắt máy đi qua hai độ trễ.
- Dẫn đường: gravity turn, giảm ga qua Max-Q, tầng 2 lái theo luật tiếp tuyến tuyến tính.
- Khớp với thực tế: MECO ở 84,5 km, 1.899 m/s; tầng 2 tắt ở T+8:51 (NASA 8:47), quỹ đạo 202 × 216 km.
- Tầng 1 quay về: đốt vào khí quyển, đốt hạ cánh, chạm sà lan ở T+611,3 s, 1,94 m/s, còn 7,2 t nhiên liệu.
- Tư thế quay bằng mô-men (`createAttitude`, hằng số `steering`): dẫn đường chỉ đưa hướng muốn; thân quay tới đó nhờ động cơ lắc (tối đa 5°), cánh lưới (từ 100 Pa áp suất động) và vòi nitơ; lực đẩy theo hướng vòi phun đang chỉ. Bỏ qua xoay quanh trục dọc và mô-men khí động lên thân.
  - Hằng số là ước lượng từ kích thước, khối lượng công bố, không phải số của hãng: bán kính quán tính, tay đòn, mô-men vòi nitơ, mô-men cánh lưới mỗi Pa, trần tốc độ quay (`spin`: tầng 2 là 4°/s, tầng 1 là 6,9°/s).
  - Tầng 1 lật: giữ 4 s sau tách tầng, vòi nitơ đẩy ≈ 6 s, trôi, hãm ≈ 5 s, đuôi đi trước từ ≈ T+195 s. Tầng 2 chúc mũi từ 53° xuống 4° trong ≈ 13 s sau khi nổ máy.
  - Lúc đốt hạ cánh, hướng muốn là `up · upright − vAir`: tốc độ về 0 thì thân dựng thẳng, không đuổi theo hướng bay ngược.
  - Không có gió hay nhiễu trong mô hình nên cánh lưới chỉ xoay dưới 0,4°.
  - Đổi hằng số `steering` hay thân tên lửa thì phải khớp lại bốn số dẫn đường (`kick`, `azimuth`, `pitch0`, `pitchRate`) bằng `simulate({ … })`: mục tiêu là độ cao MECO, độ nghiêng quỹ đạo, độ cao và vận tốc hướng tâm lúc SECO. Bẫy: khớp cận điểm + viễn điểm thì ma trận suy biến (bán trục lớn đã bị lệnh tắt máy cố định).
- Bảng số (`index.html` `#launch-…`, `thrustOf(state)`): lực đẩy kN, ga % × số động cơ, khối lượng, lực đẩy / trọng lượng. Trang hẹp ẩn ô khối lượng. Cửa sổ thấp hơn ≈ 890 px thì danh sách mốc chỉ hiện 3 dòng.
- Chạm sà lan (`js/sim/touchdown.js`, hàm của thời gian từ lúc chân chạm, tua được): chân nén như lò xo có giảm chấn (1,2 Hz, 0,4), thân lắc rồi tắt (0,56 Hz, 0,25), sà lan lắc ngang 1,1°, dọc 0,5°, nhấp nhô 0,22 m. Các số này tự chọn, không phải số đo.
  - Lúc chân chạm là `flightData.landing.at`; `eventAt('landing')` là giây tròn, đừng dùng cho việc này.
  - Chân duỗi tới mặt boong: `setLegs(open, deck)` trong `vehicle.js`.
- Hình: lửa nghiêng theo góc lắc (vòi phun là một lưới với thân, không nghiêng), cánh lưới xoay quanh trục, tia khí nitơ ở đỉnh interstage (`setSteer` trong `vehicle.js`, gọi sau `setFins`).
- Chặng bám đuổi: các lần đốt Hohmann lên 410 km, xuống 400 km, rồi TPI.
- Chặng tiếp cận dùng chung mô hình với trang trạm. Chạm cổng đúng nơi NASA công bố, trên biên giới Trung Quốc – Mông Cổ.
- Ở các chặng ×1.500, camera lùi ra xa nhìn cả địa cầu, rồi bay về cạnh Dragon (`farShot()`).

**Lửa, khói, gió, âm thanh:**
- `plume.js`: giãn nở đẳng entropy, chuỗi sóng sốc, cháy tiếp; lửa đốt ngược dòng khi tầng 1 quay về.
- `wind.js`: gió thật lúc phóng (bóng thám không KXMR).
- `exhaust.js`: khói ở bệ (1.500 cụm, mô phỏng lại từ T−3 khi nhảy thời gian), trên sà lan và vệt khói trôi theo gió.
  - Lô `wisps` không trạng thái, tính thẳng từ giờ nhiệm vụ: hơi LOX xả ở đỉnh bồn hai tầng và ở chân giá phóng (từ T−4:30, dày lên trước T−45 s, tắt ở T−3); tia nước dập lửa bắn ngang giá phóng (T−7 … T+13); băng rơi khỏi hai bồn LOX (T−2,6 … T+17).
  - Đồng hồ hơi xả cộng tối đa 0,05 s mỗi khung: chặng ×30 không nhấp nháy, tạm dừng thì đứng yên.
  - Ánh lửa lên khói giảm 80 % giữa ban ngày.
- `vehicle.js`: lửa có vệt dọc và xoáy (nhiễu khép vòng quanh ống lửa), vệt tối ngả màu nguội; đèn lửa `fireLight` giảm 97 % giữa ban ngày (`firstState.daylight`), không thì tháp cháy trắng.
- `engine-audio.js`: âm thanh tổng hợp bằng Web Audio, không tệp ghi âm. Trong không khí: tiếng gầm (nhiễu 1/f², dải octave giảm ≈ 3 dB), tiếng nổ lách tách (nhiễu dốc dần thành sóng xung kích, độ lệch đạo hàm dương), sóng N, tiếng nổ siêu thanh, chạm sà lan; trước khi nổ máy: gió, hơi oxy xả, nước dập âm từ T−7 s. Qua kết cấu (camera cách tầng đang đốt < 400 m, không khí loãng): rung thân `structure`, tia nitơ `gas`, tách tầng, Draco, ghép nối.
  - `update(state)`: `view.js` truyền thêm `wind`, `vent`, `water`, `structure`, `gas` (0–1, thiếu = 0).
  - Vòng lặp nhiễu dài không bằng nhau (2,3–6,1 s) + nhịp phồng chậm 16 s ⇒ không lặp nghe được. Hai nguồn tốc độ 1 và 0,871 cho hai tai; xa dần thì gộp về giữa.
  - Sau bộ nén có tầng chặn đỉnh (`ceiling`): bộ nén của Chrome tự bù mức, bỏ tầng này đỉnh vượt 0 dBFS.
  - Đo: `OfflineAudioContext` trong trang (import module, gọi `update` mỗi 0,05 s). Mốc ở 300 m, lực đẩy đủ: RMS −17,6 dBFS, đỉnh −2,2, độ lệch đạo hàm +3,2, tương quan trái / phải 0,61; 3 km: −35,1, 0,82. Bẫy: đo ở xa phải chờ hết trễ truyền âm r / 343 s.

**Đếm ngược** (`countdownOverlay()` trong `view.js`, CSS `.launch-tminus`, `.launch-count`):
- Vào trang là thấy đồng hồ T−4:30 ở góc phải trên cảnh, kèm bước đang diễn ra và tốc độ (`×30`) hoặc `PAUSED`; mờ dần ở T−10.
- T−10 … 1 rồi LIFTOFF bằng chữ lớn ở phần cảnh trống cạnh bảng; trang hẹp (bảng chiếm hết bề ngang) thì nằm sát mép phải, ngay trên bảng.
- Chạy theo giờ nhiệm vụ: tạm dừng, tua hay nhảy tới đâu hiện đúng lúc đó. `seek(giây)` của view nhảy thẳng tới một thời điểm (dùng khi thử).

**Cảnh:**
- Mặt đất: ảnh USGS gần bệ, NASA GIBS ở xa. Gần mặt đất ảnh được phủ thêm hạt mịn; sân bê tông 39A có khe tấm mỗi 7,5 m (`grainOn` trong `ground.js`).
- Sàn rãnh lửa và tấm chắn lửa có vân vẽ bằng canvas: lưới gạch chịu lửa, muội, đầu nam cháy sém (`trenchFloor`, `deflectorPlates` trong `complex.js`).
- Bệ 39A dựng theo số liệu NASA, OpenStreetMap và ảnh USGS: FSS, tay đón phi hành đoàn, giàn dựng TE, giá phóng, rãnh lửa, tháp nước.
- Khu phóng 39 (`complex.js`): HIF, 39B, VAB, LCC.
- 583 công trình khác trong vùng 17 km (`site.js`): khung nhà từ OSM / USA Structures, chiều cao từ lidar USGS 2019.
- Sà lan đáp: mô hình TAIGA-ZOE.
- **Cutaway** cắt dọc hai tầng; **See-through** (hoặc bấm vào tên lửa) nhìn xuyên vỏ. Bên trong có bồn, COPV, octaweb, bơm tua-bin, mực nhiên liệu theo mô phỏng, kèm nhãn tên bộ phận.

## Hiệu năng

- `?stats` hiện fps, ms mỗi khung, số lần vẽ. `?quality=high|medium|low` cố định mức. `?worker=0` chạy mọi thứ trên luồng chính.
- Mức chất lượng tự chọn: high cho máy tính; medium cho màn cảm ứng nhỏ hoặc máy yếu. Chậm hơn 40 fps thì hạ một mức.
- Tiết kiệm bộ nhớ:
  - Trên điện thoại, ảnh Trái Đất 2K và ảnh texture lớn thu một nửa.
  - Dữ liệu đỉnh mà GPU đã giữ thì bỏ bản CPU (`js/core/release.js`).
  - Rời Launch thì dọn cảnh đó.
- Gộp lượt vẽ theo loại bề mặt (`Kit.finish`): toàn trạm khoảng 490 lượt vẽ, 1,7 ms mỗi khung trên Mac M4.
- Ngân sách: tải đầu ≤ 3 MB, ≤ 16 ms mỗi khung.
- Launch, T−12 … T+17 (hơi xả, tia nước, băng, 1.500 cụm khói): trung bình 2,5–3,0 ms mỗi khung, lâu nhất 7,8 ms, đo `advance` + `gl.finish()` ở 2048 × 1536. Mã Launch chỉ tải khi vào Launch; các vân mới vẽ bằng canvas, không thêm tệp ảnh.

## Thêm hoạt cảnh

1. Viết mô hình chuyển động như `js/sim/eva.js`: trả về `{ layout, step(time, out) }`, ghi tư thế vào một `Float32Array`, không tạo lưới.
2. Đăng ký nó trong `js/sim/worker.js`.
3. Dựng lưới trong `js/figures/`. Mỗi khung chép tư thế worker trả về vào lưới; gọi `update(delta)` trong `advance()` (`controller.js`).

Có sẵn hai hoạt cảnh qua worker:
- Crew 2 làm việc ở hộp găng Columbus, vòng 26 s.
- Hai phi hành gia EVA (lead, helper), vòng 326,9 s: ra cửa Quest, lần tay vịn tới Z1, làm việc, quay về. Xem mục dưới.

Phi hành gia trên bệ chân Canadarm2 (`js/figures/rider.js`) dùng chung lưới và texture với hình ở Z1, bộ xương riêng; tư thế tính theo `crewView`, xem mục Canadarm2.

### EVA từ Quest tới Z1

- `js/sim/eva-route.js`: các điểm tay vịn (`onQuest(x, góc, r, nx, out, along)`, `onUnity(góc, z, r)`, `at(điểm, pháp tuyến, lệch hông)`), `createEvaRoute(role, task)` và bảng giờ `createEvaTimeline`.
  - `evaPath`: hông cách tay vịn `reach` 0,46 m theo pháp tuyến, ngực 0,36, cổ 0,33, chừa đầu `headRoom` 0,3 m, đứng thẳng lên nhiều nhất `standMost` 0,15 m, thân ngả theo hướng đi `lean` 0,17 rad, chân kéo theo sau `trail` 0,85 m.
  - Thân đi 0,14 m/s, vào và ra mỗi chặng 2,5 s; helper ra trước 12 s và về sau. Vòng 326,94 s.
- `js/sim/eva.js`: `createEvaPair` cho hai người; mỗi khung `timeline.at(role, t)` trả `inside`, `route` hoặc `task`.
  - Tại Z1: helper đưa súng vặn rồi giữ tay vịn, lead vặn bốn bu lông. Chỗ làm việc: cổ tay ≤ 0,65 m/s, khuỷu ≤ 1 m/s; tay trái duỗi 37–74 % để IK không lật khuỷu.
  - Trên đường: tay đổi chỗ nắm trong 46 % khoảng cách hai chỗ nắm. Đỉnh tốc độ đo cả vòng: cổ tay 0,56–0,59 m/s, đầu 0,55–0,57, hông 0,34–0,35, bàn chân 0,41–0,45.
  - Helper sau khi móc dây ở Z1 có pha riêng `assist` (giữ tay vịn, đưa dụng cụ) thay cho pha của lead.
  - Chân: góc chân dọc đường giải một lần lúc tạo, mỗi 5 cm tay vịn, rồi lấy trung bình ±25 cm (`plan`). Giải theo từng khung thì ở chỗ rẽ bàn chân quất 3 m/s.
  - Đường đi rời sang ngang thì ống chân gập về sau (`legs.folded`), bàn chân không quẹt vỏ Unity.
- `js/figures/eva.js`: lưới hai người, tay vịn, dây an toàn rải theo đường đã đi, nắp che nhiệt cửa Quest có bản lề (mở 1,83 rad; khép trong 5 s sau khi helper vào, mở lại trong 5 s cuối vòng), lòng cửa tối. `seek(giây)` đặt thẳng thời điểm.
- Khoảng hở tâm xương tới trạm: đầu và hông ≥ 0,2 m, gối và bàn chân ≥ 0,12 m.

Còn hở:
- Đầu cách tay vịn đang nắm 0,14–0,18 m trong khoảng 2 s ở gờ khoang thiết bị Quest.
- Găng nằm đúng trên chỗ nắm 49–50 % thời gian đi đường; lúc đang nắm, găng lệch chỗ nắm nhiều nhất 0,17–0,31 m (do khoảng cách các điểm tay vịn và khoá đường đi).

Bẫy:
- Mixer của three.js chỉ ghi khớp khi giá trị đổi so với lần trước. Tư thế cộng thêm góc lên khớp phải trả khớp về giá trị mixer để lại (`mixed`) trước `mixer.setTime`; không thì cùng một thời điểm ra hai tư thế.
- Đoạn tay đổi chỗ nắm không dài quá 50 % khoảng cách, quá thì cả hai tay rời tay vịn.
- Sửa điểm tay vịn xong phải đo lại khoảng hở và tốc độ cả lượt đi lẫn lượt về, cho cả hai người.

### Phi hành đoàn trong Tranquility

`js/figures/cabin-crew.js`, chạy trên luồng chính, dùng mô hình người của Columbus (`lab.addCrew`), không có clip dựng sẵn: đặt thân rồi giải từng tay chân tới đích trong hệ toạ độ thế giới.
- `lifter`: squat trên máy tập, tám lần mỗi 4,4 s rồi nghỉ, vòng 50 s; thanh đòn đi theo cung của cần máy.
- `traveller`: bay giữa hai cửa khoang 0,28 m/s, lượt đi vẫy tay, lượt về ôm túi hàng.
- `watcher`: ở Cupola, cầm máy ảnh nhìn xuống Trái Đất.
- Số chỉnh ở `tune`; mốc trong khoang (`cabin`, `cupola`) do `js/parts/tranquility.js` xuất.

## Mô hình và nguồn

Phần lớn trạm dựng bằng code theo số đo từ `ISS_stationary.glb`; riêng lưới PMA-2 và texture của nó lấy nguyên từ tệp đó.

| Mô hình | Tác giả | Giấy phép |
|---|---|---|
| [Animated Floating Astronaut in Space Suit Loop](https://sketchfab.com/3d-models/animated-floating-astronaut-in-space-suit-loop-e2c4b146e58141e4b87917456a9970b1) | LasquetiSpice | CC BY 4.0, đã sửa |
| [Human](https://sketchfab.com/3d-models/human-5913acb8485d4ef09d0770d8d7d831ba) | doctortex | CC BY 4.0, đã gắn khung xương |
| [SpaceX - Dragon 2](https://sketchfab.com/3d-models/spacex-dragon-2-1b125e30a2cb442288580290536fbe5d) | KUBAHA | CC BY 4.0, đã sửa |
| [Space X Dragon Suit](https://sketchfab.com/3d-models/space-x-dragon-suit-c600b853268249bdb9dd59bac7ead0b9) | Diuis | CC BY 4.0, đã sửa |
| [Falcon 9 - SpaceX](https://sketchfab.com/3d-models/falcon-9-spacex-394f7cf52d124bbd9db69f24d1ff2f08) | Stanley Creative | CC BY 4.0, đã sửa (`falcon9.py`) |
| [Space X Drone Barge](https://sketchfab.com/3d-models/space-x-drone-barge-14d946634c094ac6bce82b3ead6a800d) | TAIGA-ZOE | CC BY 4.0, đổi tỉ lệ (`droneship.py`) |

Dữ liệu và ảnh:
- **Ảnh Trái Đất:** [Solar System Scope](https://www.solarsystemscope.com/textures/), CC BY 4.0.
- **Ảnh mặt đất:** [USGS National Map](https://www.usgs.gov/programs/national-geospatial-program/national-map) và [NASA GIBS](https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api), public domain.
- **Công trình quanh bệ:** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL; nên `data/launch-site.json` theo [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)). Thêm [USA Structures](https://gis-fema.hub.arcgis.com/pages/usa-structures) và lidar [USGS 3DEP](https://www.usgs.gov/3d-elevation-program), public domain.
- **Gió lúc phóng:** [Iowa Environmental Mesonet](https://mesonet.agron.iastate.edu/).
- **Gió:** NOAA GFS.
- **Bão:** GDACS và ECMWF open data (CC BY 4.0).
- **Telemetry:** NASA ISS Live.
