# ISS · Trạm Vũ trụ Quốc tế 3D

Mô hình three.js của Trạm Vũ trụ Quốc tế, cấu hình ngày 5/11/2026. Trang có:
- Chọn bộ phận để xem chi tiết.
- Mặt Trời thật và ISS Live.
- Canadarm2 né va chạm.
- Crew Dragon tiếp cận.
- Phi hành đoàn trong Columbus và ngoài trạm.
- Góc nhìn quỹ đạo kèm bản đồ gió.
- Góc nhìn Launch: Falcon 9 phóng Demo-2 tới lúc ghép vào ISS.

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
| `js/orbit/` | bầu trời thật (`sky.js`), góc nhìn quỹ đạo, TLE, Mặt Trời thật, tư thế trạm, ISS Live, bản đồ gió, bão |
| `js/launch/` | góc nhìn Launch: tên lửa, mặt đất, khu phóng 39, khói, cắt dọc, nhãn, âm thanh, sà lan |
| `js/sim/` | phần chỉ có toán: bay lên quỹ đạo, luồng xả, gió, tiếp cận Clohessy–Wiltshire, SGP4, phi hành gia EVA |
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

Bấm Canadarm2 hoặc Dextre: cạnh khuỷu tay hiện thẻ ba động tác, nối bằng đường dẫn (`js/ui/robotics-menu.js`).
- Thẻ hiện bước đang chạy, thanh tiến độ và nút **Stop**.
- Thẻ tránh các bảng và lướt theo khuỷu tay.
- Trên điện thoại, bảng chi tiết che cánh tay nên danh sách nằm ở đầu bảng chi tiết.
- Bảng chi tiết hiện trạng thái và góc 7 khớp.

Ba động tác (`sequences.js`, tốc độ thật chiếu nhanh: khớp 4°/s ×12, MT 2,5 cm/s ×80):
- **Walk to Destiny** (khoảng 67 s): đi bằng hai đầu sang chốt Destiny rồi về.
- **Carry Dextre** (khoảng 51 s): nhấc Dextre khỏi PDGF 2, mang ra, xoay thân 60° rồi về 0, đặt lại.
- **Ride to worksite 1** (khoảng 56 s): MBS chạy tới WS1 (21,69 m), tay mở ra tư thế ngày 7/11, rồi về.

Né va chạm (`field.js`, `collision.js`, `map.js`, `planner.js`, worker `js/workers/robotics.js`):
- **Bản đồ khoảng hở.**
  - Khoảng 3 s sau khi mở trang, worker dựng trường khoảng cách dải hẹp (lưới 0,25 m, dải 1 m) từ 1,7 triệu tam giác, mất khoảng 1,4 s.
  - Mỗi khối cứng một trường: trạm, mỗi cánh pin, tản nhiệt, ăng-ten, Dragon, MBS, Dextre.
  - Cánh tay và Dextre là chuỗi hình cầu; khoảng hở trừ biên 0,08 m.
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
- `node tools/robotics/run.mjs check`: dưới 1 phút.
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

- Đổi khung (chọn bộ phận, nút góc nhìn, Reset) thì camera bay tới khung mới trong 0,6–1,6 s (`fitBox`, `startFlight`). Chạm vào điều khiển thì dừng chuyến bay.
- **Orbit:**
  - Trái Đất đúng tỉ lệ; ISS theo SGP4 từ TLE CelesTrak (lưu tạm 2 giờ, dự phòng `data/orbits.json`).
  - Mặt Trời và Mặt Trăng theo astronomy-engine.
  - Thời gian Live, ×60, ×600.
  - Ba khung ISS / Earth & Moon / Sun; zoom ra tới 600 triệu km.
  - Công tắc nền **Light | Dark** (`js/orbit/theme.js`, `?theme=`).
- **Bản đồ gió** (`js/orbit/earth-map.js`), luôn bật trong Orbit:
  - Bờ biển và biên giới: Natural Earth.
  - Gió 10 m: GFS qua ERDDAP PacIOOS, bước 3 giờ; lớp màu 0–30 m/s và vệt gió.
  - Ở mức zoom gần nhất, số vệt gió còn một nửa.
  - Bão: GDACS (đường đã đi, dự báo 5 ngày, nón sai số).
  - 51 đường dự báo tổ hợp ECMWF cho mỗi cơn: `storm-ensemble.js` tự giải mã BUFR.
- **Earth backdrop:** ảnh Trái Đất đúng tỉ lệ sau trạm. Camera phối cảnh tương đương khớp với camera trực giao ở tâm nhìn; zoom ra được tới 10⁻⁷.
- Thêm vệ tinh: thêm mã NORAD vào `tle.py` và gọi `addOrbiter()` trong `js/orbit/view.js`.

## Góc nhìn Launch

Falcon 9 phóng Crew Dragon từ LC-39A theo Demo-2, từ T−4:30 tới lúc ghép vào ISS ở T+19:06:15.
- Hai nút **Rocket & Dragon** / **Booster** chọn bám theo vật nào.
- Màn hình phụ hiện vật còn lại.

**Mô phỏng** (`js/sim/ascent.js`):
- Tích phân RK4 với lực đẩy Merlin/MVac theo áp suất không khí, lực cản theo Mach, khí quyển US-1976 và Trái Đất quay.
- Lực đẩy lúc khởi động và tắt máy đi qua hai độ trễ.
- Dẫn đường: gravity turn, giảm ga qua Max-Q, tầng 2 lái theo luật tiếp tuyến tuyến tính.
- Khớp với thực tế: MECO ở 84,5 km, 1.899 m/s; tầng 2 tắt ở T+8:51 (NASA 8:47), quỹ đạo 202 × 216 km.
- Tầng 1 quay về: đốt vào khí quyển, đốt hạ cánh, chạm sà lan ở 1,7 m/s.
- Chặng bám đuổi: các lần đốt Hohmann lên 410 km, xuống 400 km, rồi TPI.
- Chặng tiếp cận dùng chung mô hình với trang trạm. Chạm cổng đúng nơi NASA công bố, trên biên giới Trung Quốc – Mông Cổ.
- Ở các chặng ×1.500, camera lùi ra xa nhìn cả địa cầu, rồi bay về cạnh Dragon (`farShot()`).

**Lửa, khói, gió, âm thanh:**
- `plume.js`: giãn nở đẳng entropy, chuỗi sóng sốc, cháy tiếp; lửa đốt ngược dòng khi tầng 1 quay về.
- `wind.js`: gió thật lúc phóng (bóng thám không KXMR).
- `exhaust.js`: khói ở bệ, trên sà lan và vệt khói trôi theo gió.
- `engine-audio.js`: âm thanh tổng hợp bằng Web Audio, gồm tiếng gầm, sóng N, tách tầng, chạm sà lan, Draco, ghép nối, tiếng nổ siêu thanh.

**Cảnh:**
- Mặt đất: ảnh USGS gần bệ, NASA GIBS ở xa.
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

## Thêm hoạt cảnh

1. Viết mô hình chuyển động như `js/sim/eva.js`: trả về `{ layout, step(time, out) }`, ghi tư thế vào một `Float32Array`, không tạo lưới.
2. Đăng ký nó trong `js/sim/worker.js`.
3. Dựng lưới trong `js/figures/`. Mỗi khung chép tư thế worker trả về vào lưới; gọi `update(delta)` trong `advance()` (`controller.js`).

Có sẵn hai hoạt cảnh:
- Crew 2 làm việc ở hộp găng Columbus, vòng 26 s.
- Phi hành gia EVA ở Z1, vòng 62 s. Cổ tay ≤ 0,65 m/s, khuỷu ≤ 1 m/s; tay trái duỗi 37–74 % để IK không lật khuỷu.

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
