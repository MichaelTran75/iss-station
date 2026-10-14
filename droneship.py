#!/usr/bin/env python3
"""Chuyển model sà lan đáp (GLB) thành data/droneship.json và assets/droneship/*.jpg cho góc nhìn Launch.

    python3 droneship.py ~/Downloads/space_x_drone_barge.glb

Model: "Space X Drone Barge" của TAIGA-ZOE (Sketchfab, CC BY 4.0). Gốc dựng theo +z, quay về +y như glTF.
- Tỉ lệ: dài 6,47 đơn vị = 300 ft (91,44 m), như sà lan Marmac 300 của "Of Course I Still Love You"; khi đó bề rộng cả
  hai cánh ra 52,2 m, đúng 170 ft của sà lan thật.
- Gốc toạ độ: tâm vòng đáp (giữa mặt sàn có ảnh), mặt sàn ở y 0; trục dài theo x.
- Giữ nguyên lưới (30 nghìn tam giác), gộp theo vật liệu. Toạ độ lượng tử 1/512 m quanh gốc (Int16), pháp tuyến Int8,
  chỉ số Uint16 hoặc Uint32, UV Float32 cho vật liệu có ảnh. Mảng mã hoá base64 như các tệp data/ khác.
- Ảnh: màu nền 1024² JPEG; ảnh ORM (đỏ: che khuất, xanh lá: độ nhám, xanh dương: kim loại) 512² JPEG; hai ảnh pháp
  tuyến phẳng tuyệt đối (127, 127, 255) nên bỏ.
"""
import base64, io, json, pathlib, struct, sys

import numpy as np
from PIL import Image

np.seterr(all='ignore')

HERE = pathlib.Path(__file__).resolve().parent
SOURCE = {'title': 'Space X Drone Barge', 'author': 'TAIGA-ZOE', 'license': 'CC BY 4.0',
          'url': 'https://sketchfab.com/3d-models/space-x-drone-barge-14d946634c094ac6bce82b3ead6a800d'}
QUANTUM = 1 / 512
LENGTH = 300 * .3048   # m
NAMES = {0: 'deck', 3: 'hull', 6: 'gear'}   # base-colour image -> file name


def load(path):
    data = path.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + length]), data[20 + length + 8:]


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


def matrix(node):
    if 'matrix' in node: return np.array(node['matrix'], dtype=np.float64).reshape(4, 4).T
    m = np.eye(4); m[:3, 3] = node.get('translation', [0, 0, 0])
    if 'rotation' in node or 'scale' in node: raise SystemExit('unexpected node transform')
    return m


def b64(array):
    return base64.b64encode(np.ascontiguousarray(array).tobytes()).decode('ascii')


def image(gltf, binary, index):
    view = gltf['bufferViews'][gltf['images'][index]['bufferView']]
    start = view.get('byteOffset', 0)
    return Image.open(io.BytesIO(binary[start:start + view['byteLength']])).convert('RGB')


def main(path):
    gltf, binary = load(path)
    nodes, meshes = gltf['nodes'], gltf['meshes']
    pieces = []   # (material, position, normal, uv, index), in the model's units turned to +y

    def walk(index, parent):
        node = nodes[index]; world = parent @ matrix(node)
        if 'mesh' in node:
            normal_matrix = np.linalg.inv(world[:3, :3]).T
            for primitive in meshes[node['mesh']]['primitives']:
                position = accessor(gltf, binary, primitive['attributes']['POSITION']).astype(np.float64) @ world[:3, :3].T + world[:3, 3]
                normal = accessor(gltf, binary, primitive['attributes']['NORMAL']).astype(np.float64) @ normal_matrix.T
                normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-9)
                uv = accessor(gltf, binary, primitive['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in primitive['attributes'] else None
                pieces.append((primitive['material'], position, normal, uv, accessor(gltf, binary, primitive['indices']).reshape(-1).astype(np.int64)))
        for child in node.get('children', []): walk(child, world)
    for root in gltf['scenes'][0]['nodes']: walk(root, np.eye(4))

    # Scale to 300 ft, the landing target's centre (middle of the textured deck) at the origin, its surface at y 0.
    everything = np.concatenate([p[1] for p in pieces])
    scale = LENGTH / (everything[:, 0].max() - everything[:, 0].min())
    deck = next(p[1] for p in pieces if p[0] == 0)
    origin = np.array([(deck[:, 0].min() + deck[:, 0].max()) / 2, deck[:, 1].max(), (deck[:, 2].min() + deck[:, 2].max()) / 2])

    out_dir = HERE / 'assets' / 'droneship'; out_dir.mkdir(parents=True, exist_ok=True)
    materials = []
    for k, m in enumerate(gltf['materials']):
        pbr = m.get('pbrMetallicRoughness', {})
        entry = {'name': m['name'], 'color': [round(c, 4) for c in pbr.get('baseColorFactor', [1, 1, 1, 1])[:3]],
                 'roughness': round(pbr.get('roughnessFactor', 1), 3), 'metalness': round(pbr.get('metallicFactor', 1), 3)}
        if 'baseColorTexture' in pbr:
            source = gltf['textures'][pbr['baseColorTexture']['index']]['source']; name = NAMES[source]
            image(gltf, binary, source).save(out_dir / (name + '.jpg'), quality=86, optimize=True, progressive=True)
            entry['map'] = 'assets/droneship/%s.jpg?v=0000000000' % name
            orm = gltf['textures'][pbr['metallicRoughnessTexture']['index']]['source']
            image(gltf, binary, orm).resize((512, 512), Image.LANCZOS).save(out_dir / (name + '-orm.jpg'), quality=88, optimize=True)
            entry['orm'] = 'assets/droneship/%s-orm.jpg?v=0000000000' % name
        materials.append(entry)

    batches = {}
    for material, position, normal, uv, index in pieces:
        batch = batches.setdefault(material, {'p': [], 'n': [], 'uv': [], 'i': [], 'count': 0})
        batch['p'].append((position - origin) * scale); batch['n'].append(normal)
        batch['uv'].append(uv if uv is not None else np.zeros((len(position), 2), np.float32))
        batch['i'].append(index + batch['count']); batch['count'] += len(position)
    primitives = []
    for material, batch in sorted(batches.items()):
        position = np.concatenate(batch['p']); normal = np.concatenate(batch['n']); uv = np.concatenate(batch['uv']).astype(np.float32); index = np.concatenate(batch['i'])
        q = np.round(position / QUANTUM)
        assert np.abs(q).max() < 32767
        item = {'material': material, 'position': b64(q.astype(np.int16)), 'normal': b64(np.round(normal * 127).astype(np.int8)),
                'index': b64(index.astype(np.uint16 if len(position) < 65536 else np.uint32)), 'wide': len(position) >= 65536}
        if 'map' in materials[material]: item['uv'] = b64(uv)
        primitives.append(item)
        print('%-14s %6d verts %6d tris' % (materials[material]['name'], len(position), len(index) // 3))
    all_scaled = (everything - origin) * scale
    print('size %.1f x %.1f x %.1f m; y %.2f..%.2f' % tuple([*(all_scaled.max(axis=0) - all_scaled.min(axis=0)), all_scaled[:, 1].min(), all_scaled[:, 1].max()]))
    data = {'source': SOURCE, 'quantum': QUANTUM, 'materials': materials, 'primitives': primitives}
    out = HERE / 'data' / 'droneship.json'
    out.write_text(json.dumps(data, separators=(',', ':')))
    print('%s: %.2f MB; images %.2f MB' % (out.relative_to(HERE), out.stat().st_size / 1e6, sum(f.stat().st_size for f in out_dir.iterdir()) / 1e6))


if __name__ == '__main__':
    if len(sys.argv) != 2: sys.exit(__doc__)
    main(pathlib.Path(sys.argv[1]).expanduser())
