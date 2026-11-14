# ISS · Trạm Vũ trụ Quốc tế 3D

Mô hình three.js của ISS (cấu hình tháng 11/2026): chọn bộ phận, Mặt Trời thật + ISS Live, Canadarm2 (né va chạm, bắt / thả Cygnus XL, chở phi hành gia), Crew Dragon tiếp cận và sang trạm, phi hành đoàn theo lịch GMT, EVA, góc nhìn Orbit (gió, mưa, bão), Launch (Falcon 9 tới lúc ghép) và Cupola.

Trang: https://michaeltran75.github.io/iss-station/

## Chạy

- `./preview.sh`: máy chủ cục bộ (module, worker, `data/` không chạy qua `file://`). `?stats`, `?quality=high|medium|low`, `?worker=0`.
- Sửa JS / CSS xong: `python3 stamp.py` (đóng dấu `?v=<băm>`, viết import map trong `index.html`).
- Đưa lên: `./publish.sh "mô tả"` (TLE, stamp, commit, push).
- Kiểm tay máy: `python3 -m http.server 8769 --bind 127.0.0.1`, rồi `node tools/robotics/run.mjs check`.

## Tệp

| Tệp | Nội dung |
|---|---|
| `index.html`, `css/` | khung trang, giao diện |
| `js/main.js` | import mọi module theo thứ tự dựng cảnh |
| `js/core/` | renderer, vật liệu, `Kit`, sổ bộ phận `part()` |
| `js/parts/` | mỗi tệp một bộ phận; `assembly.js` chạy cuối |
| `js/figures/` | phi hành đoàn, EVA, lịch ngày |
| `js/robotics/` | Canadarm2, MBS, Dextre: động học, động tác, khoảng hở, lập đường |
| `js/orbit/`, `js/launch/`, `js/sim/` | góc nhìn Orbit / Cupola, Launch, phần toán (quỹ đạo, tiếp cận, SGP4) |
| `js/ui/`, `js/workers/` | điều khiển, menu, khối mờ; worker |
| `data/`, `assets/` | lưới, chuyển động, TLE dự phòng, ảnh |
| `*.py`, `tools/` | làm mới dữ liệu; công cụ kiểm (trang không tải) |

## Quy tắc

- Thứ tự import trong `main.js` quyết định thứ tự vẽ: không đảo.
- Import một chiều core → parts → figures → ui → main; `await` cấp module chỉ ở `core/data.js`, `main.js`.
- Import không viết `?v=`; riêng `js/robotics/` (worker nạp) import nhau có dấu.
- Bộ phận mới: `part('id', 'Tên', 'NN / NHÓM', 'mô tả', [[…]], [x, y, z], (kit, group) => …)`, import trước `assembly.js`.

## Bẫy

- `release.js` bỏ bản CPU của đỉnh: gắn trước lần render đầu.
- Camera trạm có view offset: chụp kiểm bằng camera riêng.
- Đổi hình Cygnus: sửa `CARGO_OUTLINE` (`robotics/index.js`), chạy lại `run.mjs check`. Tay bắt chốt minh hoạ bên hông; chốt thật ở mặt đáy.
- Đổi `steering` / thân Falcon 9: khớp lại bốn số dẫn đường bằng `simulate()`.
- Mưa GFS `pratesfc`: kg m⁻² s⁻¹ (×3600 = mm/giờ), lưới bắt đầu ở 0° E.

## Nguồn

Trạm dựng bằng code theo số đo `ISS_stationary.glb`; lưới PMA-2 lấy từ tệp đó.

| Mô hình | Tác giả | Giấy phép |
|---|---|---|
| [Animated Floating Astronaut in Space Suit Loop](https://sketchfab.com/3d-models/animated-floating-astronaut-in-space-suit-loop-e2c4b146e58141e4b87917456a9970b1) | LasquetiSpice | CC BY 4.0, đã sửa |
| [Human](https://sketchfab.com/3d-models/human-5913acb8485d4ef09d0770d8d7d831ba) | doctortex | CC BY 4.0, đã gắn khung xương |
| [SpaceX - Dragon 2](https://sketchfab.com/3d-models/spacex-dragon-2-1b125e30a2cb442288580290536fbe5d) | KUBAHA | CC BY 4.0, đã sửa |
| [Space X Dragon Suit](https://sketchfab.com/3d-models/space-x-dragon-suit-c600b853268249bdb9dd59bac7ead0b9) | Diuis | CC BY 4.0, đã sửa |
| [Falcon 9 - SpaceX](https://sketchfab.com/3d-models/falcon-9-spacex-394f7cf52d124bbd9db69f24d1ff2f08) | Stanley Creative | CC BY 4.0, đã sửa |
| [Space X Drone Barge](https://sketchfab.com/3d-models/space-x-drone-barge-14d946634c094ac6bce82b3ead6a800d) | TAIGA-ZOE | CC BY 4.0, đổi tỉ lệ |

Dữ liệu: ảnh Trái Đất [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0); USGS National Map, NASA GIBS (public domain); công trình quanh bệ © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (`data/launch-site.json` theo ODbL 1.0), USA Structures, USGS 3DEP; gió Iowa Environmental Mesonet, NOAA GFS; bão GDACS, ECMWF open data (CC BY 4.0); telemetry NASA ISS Live; Cygnus XL theo ảnh NASA.
