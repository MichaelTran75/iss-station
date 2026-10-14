#!/usr/bin/env python3
"""Chuyển model Falcon 9 (GLB) thành data/falcon-9.json và assets/falcon-9/first-stage.png cho góc nhìn Launch.

    python3 falcon9.py ~/Downloads/falcon_9_-_spacex.glb

Model: "Falcon 9 - SpaceX" của Stanley Creative (Sketchfab, CC BY 4.0). Đơn vị gốc là cm, tên lửa đứng theo +y.
- Bỏ fairing (chuyến chở người dùng Dragon, không có fairing) và cụm khớp chân đáp ở đáy (51 nghìn tam giác cho
  vài bản lề nhỏ).
- Chia ba phần: tầng 1 (cả đoạn nối, cánh lưới, chân, 9 động cơ), tầng 2 (cả động cơ MVac), và bốn cánh lưới tách
  riêng theo góc phần tư để mở ra lúc tầng 1 quay về.
- Mỗi phần gộp theo vật liệu. Toạ độ tính bằng mét, lượng tử 1/1024 m quanh tâm từng phần (Int16), pháp tuyến Int8,
  chỉ số Uint16 hoặc Uint32, UV chỉ giữ cho vật liệu có ảnh (Float32). Mảng mã hoá base64 như các tệp data/ khác.
- Ảnh tấm chăn nhiệt động cơ (1 MB nhiễu) bỏ, thay bằng màu phẳng; ảnh thân tầng 1 (logo, cờ) giữ nguyên.
"""
import base64, json, math, pathlib, struct, sys

import numpy as np

np.seterr(all='ignore')   # numpy 2.0 with Accelerate warns on clean float64 matmuls

HERE = pathlib.Path(__file__).resolve().parent
SOURCE = {'title': 'Falcon 9 - SpaceX', 'author': 'Stanley Creative', 'license': 'CC BY 4.0',
          'url': 'https://sketchfab.com/3d-models/falcon-9-spacex-394f7cf52d124bbd9db69f24d1ff2f08'}
QUANTUM = 1 / 1024


def load(path):
    data = path.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20 + length])
    binary = data[20 + length + 8:]
    return gltf, binary


def accessor(gltf, binary, index):
    a = gltf['accessors'][index]; view = gltf['bufferViews'][a['bufferView']]
    dtype = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}[a['componentType']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = view.get('byteStride', 0)
    if stride and stride != width * np.dtype(dtype).itemsize:
        raw = np.frombuffer(binary, np.uint8, a['count'] * stride, start).reshape(a['count'], stride)
        return raw[:, :width * np.dtype(dtype).itemsize].copy().view(dtype).reshape(a['count'], width)
    return np.frombuffer(binary, dtype, a['count'] * width, start).reshape(a['count'], width).copy()


def local_matrix(node):
    if 'matrix' in node: return np.array(node['matrix'], dtype=np.float64).reshape(4, 4).T
    t = np.array(node.get('translation', [0, 0, 0])); r = node.get('rotation', [0, 0, 0, 1]); s = np.array(node.get('scale', [1, 1, 1]))
    x, y, z, w = r
    rotation = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    m = np.eye(4); m[:3, :3] = rotation * s; m[:3, 3] = t
    return m


def b64(array):
    return base64.b64encode(np.ascontiguousarray(array).tobytes()).decode('ascii')


def main(path):
    gltf, binary = load(path)
    nodes, meshes = gltf['nodes'], gltf['meshes']
    batches = {}   # (part, material) -> lists

    def add(part, material, positions, normals, uvs, indices):
        entry = batches.setdefault((part, material), {'p': [], 'n': [], 'uv': [], 'i': [], 'count': 0})
        entry['p'].append(positions); entry['n'].append(normals); entry['uv'].append(uvs); entry['i'].append(indices + entry['count'])
        entry['count'] += len(positions)

    def walk(index, parent, path_names):
        node = nodes[index]; name = node.get('name', '')
        world = parent @ local_matrix(node)
        names = path_names + [name]
        if 'Fairing' in names or 'Landing Leg Holder Rotator' in names: return
        if 'mesh' in node:
            part = 'secondStage' if 'Second Stage' in names else 'gridFins' if 'Grid Fins' in names else 'firstStage'
            normal_matrix = np.linalg.inv(world[:3, :3]).T
            for primitive in meshes[node['mesh']]['primitives']:
                position = accessor(gltf, binary, primitive['attributes']['POSITION']).astype(np.float64)
                position = (position @ world[:3, :3].T + world[:3, 3]) * .01   # cm -> m
                normal = accessor(gltf, binary, primitive['attributes']['NORMAL']).astype(np.float64) @ normal_matrix.T
                normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-9)
                uv = accessor(gltf, binary, primitive['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in primitive['attributes'] else np.zeros((len(position), 2), np.float32)
                indices = accessor(gltf, binary, primitive['indices']).reshape(-1).astype(np.int64)
                add(part, primitive['material'], position, normal, uv, indices)
        for child in node.get('children', []): walk(child, world, names)

    for root in gltf['scenes'][0]['nodes']: walk(root, np.eye(4), [])

    # Materials: base colour (linear factor), roughness, metalness (glTF default 1), and the one kept image.
    images = gltf.get('images', []); textures = gltf.get('textures', [])
    materials = []
    for m in gltf['materials']:
        pbr = m.get('pbrMetallicRoughness', {})
        entry = {'name': m['name'], 'color': [round(c, 4) for c in pbr.get('baseColorFactor', [1, 1, 1, 1])[:3]],
                 'roughness': round(pbr.get('roughnessFactor', 1), 3), 'metalness': round(pbr.get('metallicFactor', 1), 3)}
        if m['name'] == 'Engine_Cloth_Black': entry['color'] = [.03, .03, .032]   # the noise image only darkened it
        if m['name'] == 'F9_First_Stage' and 'baseColorTexture' in pbr:
            image = images[textures[pbr['baseColorTexture']['index']]['source']]
            view = gltf['bufferViews'][image['bufferView']]
            out = HERE / 'assets' / 'falcon-9' / 'first-stage.png'; out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']])
            entry['map'] = 'assets/falcon-9/first-stage.png?v=0000000000'
        materials.append(entry)

    parts = {}
    fins = []
    for (part, material), entry in sorted(batches.items()):
        position = np.concatenate(entry['p']); normal = np.concatenate(entry['n']); uv = np.concatenate(entry['uv']).astype(np.float32)
        index = np.concatenate(entry['i'])
        if part == 'gridFins':
            # Split the four fins by the quadrant of each triangle's centre.
            centre = position[index.reshape(-1, 3)].mean(axis=1)
            quadrant = ((np.degrees(np.arctan2(centre[:, 2], centre[:, 0])) + 360) % 360 // 90).astype(int)   # fins sit at 45°, 135°…
            for q in range(4):
                tris = index.reshape(-1, 3)[quadrant == q].reshape(-1)
                used, remap = np.unique(tris, return_inverse=True)
                fins.append((q, material, position[used], normal[used], uv[used], remap.reshape(-1)))
            continue
        parts.setdefault(part, []).append((material, position, normal, uv, index))
    for q, material, position, normal, uv, index in fins:
        parts.setdefault('gridFin%d' % q, []).append((material, position, normal, uv, index))

    out_parts = {}
    for name, primitives in parts.items():
        allp = np.concatenate([p[1] for p in primitives])
        centre = (allp.min(axis=0) + allp.max(axis=0)) / 2
        encoded = []
        for material, position, normal, uv, index in primitives:
            q = np.round((position - centre) / QUANTUM)
            assert np.abs(q).max() < 32767, name
            item = {'material': material, 'position': b64(q.astype(np.int16)), 'normal': b64(np.round(normal * 127).astype(np.int8)),
                    'index': b64(index.astype(np.uint16 if len(position) < 65536 else np.uint32)), 'wide': len(position) >= 65536}
            if 'map' in materials[material]: item['uv'] = b64(uv.astype(np.float32))
            encoded.append(item)
        out_parts[name] = {'centre': [round(c, 4) for c in centre], 'primitives': encoded}
        tris = sum(len(p[4]) // 3 for p in primitives); verts = sum(len(p[1]) for p in primitives)
        print('%-12s %6d verts %7d tris  y %.2f..%.2f' % (name, verts, tris, allp[:, 1].min(), allp[:, 1].max()))

    # Hinges of the grid fins: the top inner edge of each lattice, turning about the tangent there.
    hinges = []
    for q in range(4):
        position = np.concatenate([p[1] for p in parts['gridFin%d' % q]])
        radial = position[:, [0, 2]].mean(axis=0); radial /= np.linalg.norm(radial)
        top = position[:, 1].max()
        inner = (position[:, [0, 2]] @ radial).min()
        hinges.append({'at': [round(radial[0] * inner, 4), round(top, 4), round(radial[1] * inner, 4)], 'radial': [round(radial[0], 4), 0, round(radial[1], 4)]})

    data = {'source': SOURCE, 'quantum': QUANTUM, 'materials': materials, 'parts': out_parts, 'gridFins': hinges,
            # Measured on the model: nine Merlin 1D exits (eight on a 1.36 m circle, one in the centre), the MVac
            # exit, the top of the second stage's cylinder (where Dragon's trunk sits) and the stage joint.
            'engines': {'merlinRadius': 1.364, 'merlinExitY': .1, 'merlinExit': .46, 'mvacExitY': 43.571, 'mvacExit': 1.52},
            'secondStageTop': 57.94, 'separationY': 48.7}
    out = HERE / 'data' / 'falcon-9.json'
    out.write_text(json.dumps(data, separators=(',', ':')))
    print('%s: %.2f MB' % (out.relative_to(HERE), out.stat().st_size / 1e6))


if __name__ == '__main__':
    if len(sys.argv) != 2: sys.exit(__doc__)
    main(pathlib.Path(sys.argv[1]).expanduser())
