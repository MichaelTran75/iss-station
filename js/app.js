        const loading = document.getElementById('loading');
        try {
            // Model data lives in data/*.json and its textures in assets/; fetch it while three.js loads.
            const assetFiles = {"pmaReferenceData": "data/pma-2.json?v=beb18c0530", "payloadReference": "data/payloads.json?v=e3df59b776", "columbusCrewHuman": "data/columbus-crew.json?v=2dc54df3a1", "columbusCrewMotion": "data/columbus-crew-motion.json?v=de8d0eec90", "zaryaReference": "data/zarya.json?v=b2d1a5f9db", "dragonReference": "data/crew-dragon.json?v=7def71e643", "dragonCrewSuit": "data/crew-dragon-suit.json?v=d795e5d772", "evaAsset": "data/eva-astronaut.json?v=dcefd7f1a5"};
            const assetDataReady = Promise.all(Object.entries(assetFiles).map(async ([name, path]) => {
                const response = await fetch(path);
                if (!response.ok) throw new Error('Could not load ' + path + ' (HTTP ' + response.status + ').');
                return [name, await response.json()];
            })).then(Object.fromEntries);
            assetDataReady.catch(() => {});
            const THREE = await import('three');
            const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
            const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
            const assetData = await assetDataReady;
            const app = document.getElementById('app');
            const viewport = document.getElementById('viewport');
            const container = document.getElementById('scene');
            const scene = new THREE.Scene();
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
            renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
            renderer.setClearColor(0x000000, 0);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.08;
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            container.appendChild(renderer.domElement);
            renderer.domElement.setAttribute('aria-label', 'International Space Station 3D model');
            renderer.domElement.setAttribute('role', 'img');
            const camera = new THREE.OrthographicCamera(-90, 90, 70, -70, .1, 1800);
            const controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = .085;
            controls.minZoom = .45;
            controls.maxZoom = 8;
            controls.autoRotateSpeed = .55;
            controls.maxPolarAngle = Math.PI * .92;
            controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
            const hemisphere = new THREE.HemisphereLight(0xeef2f6, 0x6d727e, 1.15);
            scene.add(hemisphere);
            const sunlight = new THREE.DirectionalLight(0xfffbf2, 3.2);
            sunlight.position.set(-65, 110, -85);
            sunlight.castShadow = true;
            sunlight.shadow.mapSize.set(2048, 2048);
            Object.assign(sunlight.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 270 });
            sunlight.shadow.normalBias = .12;
            sunlight.shadow.bias = -.00015;
            scene.add(sunlight);
            const rim = new THREE.DirectionalLight(0xe0e6fa, .75);
            rim.position.set(50, 15, 65);
            scene.add(rim);
            const inspectionLight = new THREE.DirectionalLight(0xe5eee9, 1.6);
            inspectionLight.visible = false; inspectionLight.target.position.set(0, -2.4, 4.85);
            scene.add(inspectionLight, inspectionLight.target);
            const station = new THREE.Group();
            scene.add(station);
            const palette = { hull: 0xc9ceca, white: 0xe8eae5, silver: 0xa6aeac, dark: 0x292b32, rail: 0x8b918f, foil: 0xaaa087, gold: 0xa18c58, glass: 0x163442, accent: 0x247c6f, radiator: 0xbec3bf, black: 0x16171d, blue: 0x313544 };
            const materials = new Map();
            function material(color, roughness = .62, metalness = .25, map = null) {
                const key = [color, roughness, metalness, map?.uuid || ''].join('|');
                if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness, map }));
                return materials.get(key);
            }
            const shapes = { box: new THREE.BoxGeometry(1, 1, 1), cylinder: new THREE.CylinderGeometry(1, 1, 1, 24), lowCylinder: new THREE.CylinderGeometry(1, 1, 1, 10), sphere: new THREE.SphereGeometry(1, 24, 16) };
            const transform = new THREE.Object3D();
            const vertical = new THREE.Vector3(0, 1, 0);
            const temporaryVector = new THREE.Vector3();
            class Kit {
                constructor() { this.batches = new Map(); this.outlines = []; }
                add(geometry, surface, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], outlined = true) {
                    transform.position.fromArray(position); transform.scale.fromArray(scale); transform.rotation.set(...rotation); transform.updateMatrix();
                    const placed = geometry.clone().applyMatrix4(transform.matrix);
                    if (!this.batches.has(surface)) this.batches.set(surface, []);
                    this.batches.get(surface).push(placed.index ? placed.toNonIndexed() : placed);
                    if (outlined) { const edges = new THREE.EdgesGeometry(geometry, 32).applyMatrix4(transform.matrix); if (edges.attributes.position.count) this.outlines.push(edges); }
                }
                box(position, scale, color = palette.hull, rotation = [0, 0, 0], outlined = true) { this.add(shapes.box, material(color), position, scale, rotation, outlined); }
                cylinder(position, radius, length, color = palette.hull, rotation = [Math.PI / 2, 0, 0]) { this.add(shapes.cylinder, material(color), position, [radius, length, radius], rotation); }
                sphere(position, scale, color = palette.white) { this.add(shapes.sphere, material(color), position, scale, [0, 0, 0], false); }
                rod(start, end, radius = .08, color = palette.rail) {
                    const direction = new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
                    const length = direction.length();
                    if (length < .0001) return;
                    const geometry = shapes.lowCylinder.clone().scale(radius, length, radius);
                    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vertical, direction.normalize()));
                    geometry.translate((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2);
                    this.add(geometry, material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                line(points) {
                    const positions = [];
                    for (let index = 1; index < points.length; index++) positions.push(...points[index - 1], ...points[index]);
                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                    this.outlines.push(geometry);
                }
                finish(parent) {
                    for (const [surface, geometries] of this.batches) {
                        const mesh = new THREE.Mesh(mergeGeometries(geometries, false), surface.clone());
                        mesh.castShadow = !surface.userData.decal; mesh.receiveShadow = true; parent.add(mesh);
                    }
                    if (this.outlines.length) {
                        const edges = new THREE.LineSegments(mergeGeometries(this.outlines, false), new THREE.LineBasicMaterial({ color: 0x43544e, transparent: true, opacity: .38 }));
                        edges.userData.outline = true; parent.add(edges);
                    }
                    this.batches.clear(); this.outlines.length = 0;
                }
            }
            const parts = new Map();
            const wings = [];
            const trackingDishes = [];
            const destinyShutter = {
                pivot: null, openAngle: Math.PI * .84, angle: Math.PI * .84,
                target: Math.PI * .84, from: Math.PI * .84, progress: 1, duration: 2.8
            };
            let destinyDetail = 'supports', dragonDetail = 'approach';
            // Shared full-size PMA envelope from the supplied GLB, cross-checked against the USDZ mesh.
            const pmaReferenceLength = 2.6519663333892822, pmaReferenceOffset = 0.7347772121429443;
            const pma1BaseZ = 15.45, pma2BaseZ = -8.72;
            // Keep the Russian docking face seated on the rebuilt PMA-1's outward interface.
            const russianSegmentOffset = new THREE.Vector3(0, pmaReferenceOffset, pma1BaseZ + pmaReferenceLength - 17.04);
            // User-specified centerlines for the radiator banks and the solar rotary joints.
            const radiatorBankX = 14;
            // The integrated truss and everything it carries sit this much lower over Destiny than first drawn, which shortens
            // the S0 support struts by about 45%.
            const trussDrop = 1.6;
            // Truss member sections measured on the supplied GLB, in metres. They are box tubes: chords give [across, height],
            // frames and braces a square side or [along the truss, across]. Only the S5/P5 cage is tubular, its struts swelling
            // from 0.064 at the end fittings to 0.133 mid-length.
            const trussSections = {
                S0: { fore: [.152, .152], knee: [.152, .21], aft: [.152, .152], frame: .116, web: [.116, .16], brace: .132, aftBrace: .107 },
                S1: { fore: [.152, .152], aft: [.152, .21], frame: .105, brace: .105, deckBrace: .132 },
                S3: { fore: [.092, .116], aft: [.152, .116], frame: .098, brace: .106 },
                S4: { fore: [.16, .11], aft: [.16, .11], frame: .10, brace: .08 },
                S5: { strut: [.064, .133], frame: [.098, .15] },
                S6: { fore: [.16, .11], aft: [.16, .11], frame: .075, endPost: [.106, .158], brace: .075 },
                SARJ: { strut: .08, seat: .066 }
            };
            // Seat the mounting pads on the aft chord surface of the narrow S1/P1 segments.
            // The bank's .785-deep root stays .08 beyond that surface, clear of covers.
            const radiatorTrussSurfaceZ = 4 + trussSections.S1.aft[0] / 2; // S1/P1's narrow aft chords
            const radiatorBankZ = radiatorTrussSurfaceZ + .785 + .08;
            const solarRotaryJointX = 23.5; // Align with the truss post marked in the reference.
            const solarStations = [-48, -32, 32, 48];
            // Image-directed outboard offset: move each terminal wing as one
            // connected assembly, including its canister and iROSA modification kit.
            const solarRootX = across => across + (Math.abs(across) === 48 ? Math.sign(across) * 1.60 : 0);
            // The two wings of a module sit one above the other in its beta-gimbal frame, on the same station along the truss:
            // the aft wing's mast canister runs in through the upper half and the forward wing's through the lower half, so
            // the two pass without meeting. Port and starboard are mirror images.
            const solarWingStagger = .72, solarPocketHalf = 1.1;
            const solarWingY = direction => 6.8 + direction * solarWingStagger;
            const inSolarPocket = x => solarStations.some(root => Math.abs(root) === 32 && Math.abs(root - x) < solarPocketHalf);
            // Channel groupings follow NASA's ISS electrical power system overview.
            // Forward/aft is a schematic pose; beta-gimbal rotation varies in orbit.
            const powerChannels = { '-48': ['2B', '4B'], '-32': ['4A', '2A'], '32': ['1A', '3A'], '48': ['1B', '3B'] };
            const augmentedChannels = new Set(['2B', '4B', '4A', '1A', '3A', '1B']);
            const modernParts = new Set(['irosa', 'nauka', 'prichal', 'tranquility', 'leonardo', 'beam', 'bishop', 'poisk', 'rassvet', 's3payloads', 'p3payloads']);
            function part(id, name, category, description, facts, anchor, builder) {
                const group = new THREE.Group(); group.name = name; group.userData.part = id;
                const kit = new Kit(); builder(kit, group); kit.finish(group); station.add(group);
                const entry = { id, name, category, description, facts, anchor: new THREE.Vector3(...anchor), group };
                parts.set(id, entry); return entry;
            }
            function ring(kit, center, radius, axis = 'z', color = palette.silver, tube = .055) {
                const rotation = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
                kit.add(new THREE.TorusGeometry(radius, tube, 6, 32), material(color), center, [1, 1, 1], rotation, false);
            }
            function tubeModule(kit, length, radius, options = {}) {
                // The quilted skin sits 45 mm proud of the pressure shell, where fittings met the flat panels' faces.
                const half = length / 2, quilted = options.skin === 'quilted' && !options.profile, skinLift = .045;
                const profile = options.profile || [[0, 1], [1, 1]];
                function bodyRadius(depth) {
                    const fraction = THREE.MathUtils.clamp((depth + half) / length, 0, 1);
                    let end = profile.findIndex(point => point[0] >= fraction);
                    end = Math.max(1, end < 0 ? profile.length - 1 : end);
                    const start = profile[end - 1], finish = profile[end];
                    return radius * THREE.MathUtils.lerp(start[1], finish[1], (fraction - start[0]) / (finish[0] - start[0]));
                }
                function surfacePoint(angle, depth, lift = 0) {
                    const radial = bodyRadius(depth) + lift;
                    return [Math.cos(angle) * radial, Math.sin(angle) * radial, depth];
                }
                if (options.profile) kit.add(new THREE.LatheGeometry(profile.map(point => new THREE.Vector2(radius * point[1], length * (point[0] - .5))), 32),
                    material(options.color || palette.hull), [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
                // A hollow module keeps no end discs; its end hardware closes the shell, so the interior stays empty.
                else if (options.hollow) kit.add(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), material(options.color || palette.hull), [0, 0, 0], [radius, length, radius], [Math.PI / 2, 0, 0]);
                else kit.cylinder([0, 0, 0], radius, length, options.color || palette.hull);
                // Modules with measured CBMs supply their own end interfaces.
                for (const side of [-1, 1]) {
                    if (options.endInterfaceSides && !options.endInterfaceSides.includes(side)) continue;
                    genericEndInterface(kit, side, bodyRadius(side * half), half, options.hollow);
                }
                // Shield panel joins remain shallow; fasteners are schematic, not an engineering layout.
                const bays = Math.max(3, Math.round(length / 1.35));
                for (let bay = 0; bay <= bays; bay++) {
                    // The quilted skin keeps only the end frames; its seams divide the bays.
                    if (quilted && bay > 0 && bay < bays) continue;
                    const depth = -half + bay * length / bays;
                    ring(kit, [0, 0, depth], bodyRadius(depth) + (quilted ? skinLift + .012 : .014), 'z', bay % 3 === 0 ? palette.silver : palette.hull, .032);
                }
                if (!quilted) for (let seam = 0; seam < 12; seam++) {
                    const angle = seam * Math.PI / 6;
                    kit.line(profile.map(point => surfacePoint(angle, length * (point[0] - .5), .025)));
                }
                if (quilted) {
                    // Kibo-style skin: sixteen columns of quilted panels in every bay, over dark seams.
                    kit.add(new THREE.CylinderGeometry(radius + skinLift - .005, radius + skinLift - .005, length, 64, 1, true), quiltSeam, [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0], false);
                    for (let bay = 0; bay < bays; bay++) for (let column = 0; column < 16; column++) {
                        const z0 = -half + bay * length / bays, a0 = column * Math.PI / 8;
                        quiltPanel(kit, radius + skinLift, z0 + .016, z0 + length / bays - .016, a0 + .005, a0 + Math.PI / 8 - .005, quiltPanels[(bay + column) % 2]);
                    }
                } else if (!options.profile) for (let belt = 0; belt < 8; belt++) {
                    const angle = belt * Math.PI / 4;
                    for (let bay = 0; bay < bays; bay++) {
                        const depth = -half + (bay + .5) * length / bays;
                        const panelWidth = radius * .63, panelLength = length / bays - .12;
                        const center = [Math.sin(angle) * (radius + .025), Math.cos(angle) * (radius + .025), depth];
                        kit.box(center, [panelWidth, .065, panelLength], (bay + belt) % 5 === 0 ? palette.white : (bay + belt) % 7 === 0 ? 0xbec5c1 : palette.hull, [0, 0, -angle], false);
                        // Two diagonally opposed captive fasteners on each removable panel.
                        for (const corner of [-1, 1]) {
                            const offset = corner * (panelWidth * .5 - .10);
                            kit.box([center[0] + Math.cos(angle) * offset + Math.sin(angle) * .043, center[1] - Math.sin(angle) * offset + Math.cos(angle) * .043, depth + corner * (panelLength * .5 - .10)], [.085, .035, .09], palette.silver, [0, 0, -angle], false);
                        }
                    }
                }
                // EVA handholds sit on paired standoffs and follow tapered hull sections.
                const handles = Math.max(1, Math.floor(length / 1.65));
                for (const angle of [Math.PI / 4, Math.PI * 3 / 4, Math.PI * 1.5]) {
                    for (let handle = 0; handle < handles; handle++) {
                        const depth = -half + (handle + .5) * length / handles;
                        const railHalf = Math.min(options.handholdHalfLength ?? .34, length / handles * .27);
                        const a = surfacePoint(angle, depth - railHalf, .16), b = surfacePoint(angle, depth + railHalf, .16);
                        kit.rod(a, b, .033, palette.gold);
                        for (const endpoint of [depth - railHalf, depth + railHalf]) {
                            kit.rod(surfacePoint(angle, endpoint, .045), surfacePoint(angle, endpoint, .16), .033, palette.gold);
                            kit.box(surfacePoint(angle, endpoint, .052), [.14, .07, .13], palette.silver, [0, 0, angle - Math.PI / 2], false);
                        }
                    }
                }
                // Service routes clear the flat MMOD facets; tapered shells have no plates.
                function servicePoint(angle, depth, lift) {
                    if (options.profile) return surfacePoint(angle, depth, lift);
                    const normal = Math.round(angle / (Math.PI / 4)) * Math.PI / 4;
                    const skin = quilted ? radius + skinLift : (radius + .0575) / Math.cos(angle - normal);
                    return [Math.cos(angle) * (skin + lift), Math.sin(angle) * (skin + lift), depth];
                }
                // Parallel service conduits and occasional covered junction boxes.
                for (const angle of [.08 * Math.PI, 1.08 * Math.PI]) {
                    const depths = [-half + .24, ...profile.slice(1, -1).map(point => length * (point[0] - .5)), half - .24].sort((a, b) => a - b);
                    for (const delta of [-.035, .035]) {
                        for (let segment = 1; segment < depths.length; segment++) kit.rod(servicePoint(angle + delta, depths[segment - 1], .045), servicePoint(angle + delta, depths[segment], .045), .028, delta < 0 ? palette.silver : palette.rail);
                    }
                    for (let clamp = 1; clamp < bays; clamp++) {
                        const depth = -half + clamp * length / bays;
                        kit.box(servicePoint(angle, depth, .035), [.24, .085, .18], palette.hull, [0, 0, angle - Math.PI / 2], false);
                    }
                    if (length > 3) {
                        kit.box(servicePoint(angle, half * .45, .025), [.42, .06, .52], palette.silver, [0, 0, angle - Math.PI / 2]);
                        kit.box(servicePoint(angle, half * .45, .12), [.38, .20, .48], palette.white, [0, 0, angle - Math.PI / 2]);
                    }
                }
            }
            // The generic berthing interface on a tube end (local z axis): a shallow dome, a short neck, rings, bolts and
            // latches. A hollow module draws only the outward half of the dome.
            const outwardDome = new THREE.SphereGeometry(1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2);
            function genericEndInterface(kit, side, endRadius, half, hollow = false) {
                if (hollow) kit.add(outwardDome, material(palette.silver), [0, 0, side * half], [endRadius * .97, endRadius * .29, endRadius * .97], [side * Math.PI / 2, 0, 0], false);
                else kit.sphere([0, 0, side * half], [endRadius * .97, endRadius * .97, endRadius * .29], palette.silver);
                kit.cylinder([0, 0, side * (half + .30)], endRadius * .57, .65, palette.white);
                ring(kit, [0, 0, side * (half + .56)], endRadius * .59, 'z', palette.silver, .065);
                ring(kit, [0, 0, side * (half + .67)], endRadius * .56, 'z', palette.dark, .08);
                kit.cylinder([0, 0, side * (half + .68)], endRadius * .42, .045, palette.silver);
                ring(kit, [0, 0, side * (half + .712)], endRadius * .40, 'z', palette.hull, .025);
                for (let bolt = 0; bolt < 12; bolt++) {
                    const angle = bolt * Math.PI / 6;
                    kit.add(shapes.lowCylinder, material(palette.rail), [Math.cos(angle) * endRadius * .49, Math.sin(angle) * endRadius * .49, side * (half + .74)], [.055, .065, .055], [Math.PI / 2, 0, 0], false);
                }
                for (let latch = 0; latch < 4; latch++) {
                    const angle = latch * Math.PI / 2 + Math.PI / 4;
                    kit.box([Math.cos(angle) * endRadius * .61, Math.sin(angle) * endRadius * .61, side * (half + .43)], [.18, .12, .27], palette.silver, [0, 0, angle - Math.PI / 2], false);
                }
            }
            // Build into a local frame, then merge into the kit at `position` with `rotation`.
            function placedKit(kit, position, rotation, build) {
                const local = new THREE.Group(); const innerKit = new Kit(); build(innerKit); innerKit.finish(local);
                local.rotation.set(...rotation); local.position.fromArray(position); local.updateMatrixWorld(true);
                local.traverse(child => {
                    if (child.isMesh) kit.add(child.geometry.clone().applyMatrix4(child.matrixWorld), material(child.material.color.getHex(), child.material.roughness, child.material.metalness, child.material.map), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                    else if (child.isLineSegments) kit.outlines.push(child.geometry.clone().applyMatrix4(child.matrixWorld));
                });
            }
            function moduleAt(kit, position, length, radius, axis = 'z', options = {}) {
                placedKit(kit, position, axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0], innerKit => tubeModule(innerKit, length, radius, options));
            }
            // A radial port stub on a cylindrical node whose axis runs along z through `center`: the wall rises from its
            // saddle on the pressure shell to a flat port face `face` from the node axis and is closed there, so none of it
            // lies inside the node. `axis` is 'x' or 'y'; `sign` picks the side.
            function radialPortStub(kit, center, hullRadius, stubRadius, face, axis, sign, color = palette.hull) {
                const steps = 64, positions = [], uv = [], indices = [];
                const point = (across, along, out) => axis === 'x'
                    ? [center[0] + sign * out, center[1] + across, center[2] + along]
                    : [center[0] + across, center[1] + sign * out, center[2] + along];
                for (let row = 0; row < 2; row++) for (let i = 0; i <= steps; i++) {
                    const a = i / steps * Math.PI * 2, across = Math.cos(a) * stubRadius, along = Math.sin(a) * stubRadius;
                    positions.push(...point(across, along, row ? face : Math.sqrt(hullRadius * hullRadius - across * across) - .01)); uv.push(i / steps, row);
                }
                for (let i = 0; i < steps; i++) { const a = i, b = i + steps + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
                // Wind the wall outward whatever the side.
                const p = i => new THREE.Vector3().fromArray(positions, i * 3);
                const normal = p(steps + 1).sub(p(0)).cross(p(1).sub(p(0))), outward = axis === 'x' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
                if (normal.dot(outward) < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
                const wall = new THREE.BufferGeometry(); wall.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                wall.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); wall.setIndex(indices); wall.computeVertexNormals();
                kit.add(wall, material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                const faceCenter = point(0, 0, face);
                kit.add(new THREE.CircleGeometry(stubRadius, steps), material(color), faceCenter, [1, 1, 1], axis === 'x' ? [0, sign * Math.PI / 2, 0] : [-sign * Math.PI / 2, 0, 0], false);
                ring(kit, faceCenter, stubRadius + .014, axis, palette.silver, .032);
                return { face: faceCenter, radius: stubRadius };
            }
            // Procedural CBM collars measured from ISS_stationary.glb nodes 95/97.
            // Positions use this scene's Z axis. mapAxial(a) returns a signed offset from
            // baseZ for the source axial distance a; it may be piecewise linear.
            const referenceCbmBracketAngles = [0,35,55,90,125,145,180,215,235,270,305,325];
            const referenceCbmActiveOuter = [[0,1.28884],[.062935,1.28884],
                [.139813,1.111597],[.203881,1.111597],[.357652,1.206156],[.472985,1.206156]];
            const referenceCbmActiveInner = [[.472985,1.19115],[.357652,1.19115],
                [.203881,1.08394],[.019766,1.08394],[0,1.08394]];

            // Closed profile in [Z,radius]. Reverse a negative winding so either axial
            // direction retains exterior normals. The bore remains a real open tunnel.
            function referenceCbmLathe(kit, profile, color = palette.silver) {
                const points = profile.map(([z,r]) => [r,z]);
                const first = points[0], last = points[points.length-1];
                if (first[0] !== last[0] || first[1] !== last[1]) points.push([...first]);
                let area = 0;
                for (let i=0; i<points.length-1; i++)
                    area += points[i][0]*points[i+1][1]-points[i+1][0]*points[i][1];
                if (area < 0) points.reverse();
                kit.add(new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), 64),
                    material(color,.58,.28), [0,0,0], [1,1,1], [Math.PI/2,0,0], false);
            }

            // Closed, flat-sided inclined strap; the supplied outline is [axial,radius].
            function referenceCbmBracket(kit, angle, outline, halfWidth, baseZ, mapAxial, radialScale) {
                const c=Math.cos(angle), s=Math.sin(angle), vertices=[];
                for (const tangent of [-halfWidth,halfWidth]) for (const [a,r] of outline)
                    vertices.push(new THREE.Vector3((r*c-tangent*s)*radialScale,
                        (r*s+tangent*c)*radialScale,baseZ+mapAxial(a)));
                const center=vertices.reduce((sum,v) => sum.add(v),new THREE.Vector3()).multiplyScalar(1/8);
                const quads=[[0,1,2,3],[4,5,6,7],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]], out=[];
                for (const q of quads) for (const ids of [[q[0],q[1],q[2]],[q[0],q[2],q[3]]]) {
                    let [a,b,c]=ids.map(i=>vertices[i]);
                    const normal=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a));
                    const faceCenter=new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1/3);
                    if (normal.dot(faceCenter.sub(center))<0) [b,c]=[c,b];
                    out.push(...a.toArray(),...b.toArray(),...c.toArray());
                }
                const geometry=new THREE.BufferGeometry();
                geometry.setAttribute('position',new THREE.Float32BufferAttribute(out,3));
                geometry.computeVertexNormals();
                kit.add(geometry,material(palette.rail,.55,.32));
            }

            function referenceActiveCBM(kit, baseZ, mapAxial, radialScale = 1) {
                const mapped = profile => profile.map(([a,r]) => [baseZ+mapAxial(a),r*radialScale]);
                referenceCbmLathe(kit,mapped([...referenceCbmActiveOuter,...referenceCbmActiveInner]));

                // Recessed pressure sleeve and backing lips close radial cracks behind the
                // stepped shell. Its outer radius fits just inside the passive sleeve,
                // avoiding coincident surfaces when the two sides overlap.
                const sleeveOuter=1.020, sleeveInner=.932;
                referenceCbmLathe(kit,mapped([[0,sleeveOuter],[.472985,sleeveOuter],
                    [.472985,sleeveInner],[0,sleeveInner]]),palette.hull);
                for (const [a,insideRadius] of [[.020,1.08394],[.463,1.19115]]) {
                    referenceCbmLathe(kit,mapped([[a,insideRadius+.001],[a+.006,insideRadius+.001],
                        [a+.006,sleeveOuter],[a,sleeveOuter]]),palette.silver);
                }

                for (const degrees of referenceCbmBracketAngles) {
                    const farOuter=degrees%90===0 ? .342824 : .351512;
                    referenceCbmBracket(kit,degrees*Math.PI/180,
                        [[.057789,1.261005],[.062812,1.278523],[farOuter,1.195739],[.322431,1.178222]],
                        .041956,baseZ,mapAxial,radialScale);
                }
                // Small latch blocks on the receiving lip, seated against the collar.
                const latchZ0=baseZ+mapAxial(.406), latchZ1=baseZ+mapAxial(.453);
                for (const degrees of [0,90,180,270]) {
                    const a=degrees*Math.PI/180, r=1.215*radialScale;
                    kit.box([r*Math.cos(a),r*Math.sin(a),(latchZ0+latchZ1)/2],
                        [.025*radialScale,.083912*radialScale,Math.abs(latchZ1-latchZ0)],
                        palette.rail,[0,0,a]);
                }
                return {baseZ,endZ:baseZ+mapAxial(.472985),radialScale,
                    outerProfile:mapped(referenceCbmActiveOuter),bracketAngles:[...referenceCbmBracketAngles]};
            }

            // neckZ is the passive cone's narrow end. outwardSign points away from its
            // barrel. Negative source distances intentionally embed the receiving flange
            // in the cone shoulder, as in node 95, rather than extending another long neck.
            function referencePassiveCBM(kit, neckZ, outwardSign, axialScale = 1, radialScale = 1) {
                const sourceNeck=.220711350;
                const mapped = profile => profile.map(([t,r]) =>
                    [neckZ+outwardSign*t*axialScale,r*radialScale]);
                const sleeve=[[-.18411865,1.055358],[-.04425865,1.055358],[-.04425865,1.02668],
                    [sourceNeck,1.02668],[sourceNeck,.94052],[.17463135,.94052],
                    [.17463135,.98492],[-.18411865,.98492]];
                referenceCbmLathe(kit,mapped(sleeve));
                referenceCbmLathe(kit,mapped([[0,1.179501],[-.18411865,1.179501],
                    [-.18411865,1.052],[0,1.052]]));
                // Twelve thin radial stiffeners measured on node 95 primitive 2.
                // Columns: polar angle (deg), radial limits, source Z limits. The source
                // angles are paired near 40/50 degrees and +/-16 degrees from +/-Y.
                // Fin roots remain recessed behind the cone throat, as in the GLB.
                const fins=[
                    [39.895912,0.905905,1.175028,0.307553,0.387116],
                    [49.854694,0.907499,1.175042,0.307644,0.387117],
                    [74.139153,0.802055,1.180313,0.307645,0.387117],
                    [105.860840,0.802055,1.180313,0.307645,0.387117],
                    [130.145142,0.907499,1.175049,0.307644,0.387117],
                    [140.104080,0.905905,1.175028,0.307553,0.387117],
                    [219.895920,0.901408,1.175028,0.307553,0.387117],
                    [229.854858,0.900497,1.175049,0.307644,0.387117],
                    [254.139160,0.793985,1.180313,0.307645,0.387117],
                    [285.860840,0.793966,1.180313,0.307645,0.387117],
                    [310.145142,0.900489,1.175049,0.307644,0.387117],
                    [320.104095,0.900526,1.175028,0.307553,0.387117]
                ];
                for (const [degrees,r0,r1,z0,z1] of fins) {
                    const a=degrees*Math.PI/180, r=(r0+r1)*.5*radialScale;
                    const z=neckZ+outwardSign*(sourceNeck-(z0+z1)*.5)*axialScale;
                    kit.box([r*Math.cos(a),r*Math.sin(a),z],
                        [(r1-r0)*radialScale,.022803*radialScale,(z1-z0)*axialScale],
                        palette.rail,[0,0,a]);
                }
                return {neckZ,outwardSign,tipZ:neckZ+outwardSign*sourceNeck*axialScale,
                    flangeBackZ:neckZ-outwardSign*.18411865*axialScale,
                    outerRadius:1.179501*radialScale};
            }

            function referenceCbmCone(kit, barrelZ, neckZ, barrelR, neckR) {
                const thickness=.035;
                referenceCbmLathe(kit,[[barrelZ,barrelR],[neckZ,neckR],
                    [neckZ,neckR-thickness],[barrelZ,barrelR-thickness]],palette.hull);
                return {barrelZ,neckZ,barrelR,neckR};
            }

            // A free radial CBM after the covered ports on the GLB's Harmony and Tranquility: a lip that follows the hull, or
            // stands on a flat port face, around the shallow cover dish inset below its top; a cross-shaped centre panel and
            // four quadrant covers, latches and alignment bars, the central vent, and on the module axis the inspection ring
            // outboard and the small label plate inboard. Local +y points out of the hull and local +z runs inboard along the
            // module. Heights were measured on Harmony (hull radius 2.156); `seat` sinks the lip's root into the skin.
            function referenceFreeCbm(kit, { hullRadius = 2.156, face = null, seat = .006 } = {}) {
                const collarR = 1.17, apex = face === null ? hullRadius : face + .1073, lift = y => y - 2.156 + apex;
                const top = x => face === null ? Math.sqrt(hullRadius * hullRadius - x * x) : apex;
                const collarSkin = material(0xc7ceca, .52, .34), coverSkin = material(0xdde1d8, .82, .07), coverEdge = material(0xbfc6bc, .77, .10);
                // The repeated top row keeps a crisp edge between the collar wall and its lip instead of a smoothed bulge.
                const rimProfiles = [[collarR, 'root'], [collarR, 'top', .012], [collarR, 'top', .012], [1.093, 'top', .017], [1.067, 'blend'], [1.045, 'flat', 2.077], [1.00781, 'flat', 2.04873]];
                const rimPositions = [], rimUV = [], rimIndices = [];
                for (let row = 0; row < rimProfiles.length; row++) for (let i = 0; i <= 96; i++) {
                    const [r, type, value] = rimProfiles[row], a = i / 96 * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
                    const y = type === 'root' ? (face === null ? top(x) - seat : face) : type === 'top' ? top(x) + value
                        : type === 'blend' ? THREE.MathUtils.lerp(top(x), lift(2.077), .65) : lift(value);
                    rimPositions.push(x, y, z); rimUV.push(i / 96, row / (rimProfiles.length - 1));
                }
                for (let row = 0; row < rimProfiles.length - 1; row++) for (let i = 0; i < 96; i++) { const a = row * 97 + i, b = a + 97; rimIndices.push(a, b, a + 1, b, b + 1, a + 1); }
                const rim = new THREE.BufferGeometry(); rim.setAttribute('position', new THREE.Float32BufferAttribute(rimPositions, 3));
                rim.setAttribute('uv', new THREE.Float32BufferAttribute(rimUV, 2)); rim.setIndex(rimIndices); rim.computeVertexNormals();
                kit.add(rim, collarSkin, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                // The measured GLB cover is a shallow dish, with its face inset below the lip.
                const coverProfile = [[1.00781, 2.04873], [.96387, 2.08508], [.87786, 2.10789], [.73015, 2.13109], [0, 2.13109]].map(([r, y]) => [r, lift(y)]);
                kit.add(new THREE.LatheGeometry(coverProfile.map(([r, y]) => new THREE.Vector2(r, y)), 96), coverEdge, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                const coverY = r => {
                    for (let i = 0; i < coverProfile.length - 1; i++) { const [ra, ya] = coverProfile[i], [rb, yb] = coverProfile[i + 1]; if (r <= ra && r >= rb) return THREE.MathUtils.lerp(yb, ya, (r - rb) / (ra - rb)); }
                    return r > 1.00781 ? coverProfile[0][1] : coverProfile.at(-1)[1];
                };
                const coverPlate = (shape, surface, angle = 0, rise = .006) => {
                    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .007, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .009, bevelThickness: .003, curveSegments: 8 });
                    geometry.rotateZ(angle); const points = geometry.attributes.position;
                    for (let i = 0; i < points.count; i++) { const x = points.getX(i), z = -points.getY(i), depth = points.getZ(i); points.setXYZ(i, x, coverY(Math.hypot(x, z)) + depth + rise, z); }
                    geometry.computeVertexNormals(); kit.add(geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                };
                // Broad cross-shaped centre panel, plus four rounded quadrant covers.
                const cross = new THREE.Shape(); cross.moveTo(-.16, .77); cross.lineTo(.16, .77); cross.lineTo(.17, .49);
                cross.quadraticCurveTo(.24, .24, .49, .17); cross.lineTo(.77, .16); cross.lineTo(.77, -.16); cross.lineTo(.49, -.17);
                cross.quadraticCurveTo(.24, -.24, .17, -.49); cross.lineTo(.16, -.77); cross.lineTo(-.16, -.77); cross.lineTo(-.17, -.49);
                cross.quadraticCurveTo(-.24, -.24, -.49, -.17); cross.lineTo(-.77, -.16); cross.lineTo(-.77, .16); cross.lineTo(-.49, .17);
                cross.quadraticCurveTo(-.24, .24, -.17, .49); cross.closePath(); coverPlate(cross, coverSkin);
                for (let petal = 0; petal < 4; petal++) {
                    const shape = new THREE.Shape(); shape.moveTo(.24, .44); shape.quadraticCurveTo(.29, .29, .44, .24);
                    shape.lineTo(.68, .23); shape.quadraticCurveTo(.84, .25, .86, .42); shape.quadraticCurveTo(.74, .76, .42, .86);
                    shape.quadraticCurveTo(.25, .84, .23, .68); shape.lineTo(.24, .44);
                    coverPlate(shape, material(petal % 2 ? 0xc9d0c4 : 0xd2d8ce, .87, .06), petal * Math.PI / 2, .004);
                    const a = petal * Math.PI / 2, diag = a + Math.PI / 4;
                    kit.box([Math.sin(diag) * .935, coverY(.935) + .023, Math.cos(diag) * .935], [.105, .040, .080], 0x59675e, [0, diag, 0], false);
                    kit.box([Math.sin(a) * .947, coverY(.947) + .025, Math.cos(a) * .947], [.24, .026, .055], palette.silver, [0, a, 0], false);
                }
                ring(kit, [0, lift(2.050), 0], 1.012, 'y', 0x616e64, .013);
                kit.cylinder([0, lift(2.148), 0], .158, .018, 0x59665e, [0, 0, 0]);
                ring(kit, [0, lift(2.161), 0], .174, 'y', 0xb8bca4, .013);
                // On the GLB covers the inspection ring sits 0.45 m outboard along the module axis, the label plate inboard.
                const inspection = [0, -.45], label = [.12, .52];
                kit.cylinder([inspection[0], lift(2.148), inspection[1]], .17, .014, 0xd4d9cf, [0, 0, 0]);
                ring(kit, [inspection[0], lift(2.158), inspection[1]], .19, 'y', 0xa5ad9c, .010);
                kit.box([label[0], coverY(Math.hypot(...label)) + .012, label[1]], [.13, .012, .08], palette.gold, [0, 0, 0], false);
                for (let bolt = 0; bolt < 16; bolt++) { const a = bolt * Math.PI / 8, x = Math.cos(a) * 1.108; kit.cylinder([x, top(x) + .027, Math.sin(a) * 1.108], .013, .015, 0x69766e, [0, 0, 0]); }
                return { outerRadius: collarR, coverRadius: 1.0079, coverTop: lift(2.13109), inspectionRing: inspection, labelPlate: label };
            }

            // GLB barrel-rim spacing normalized to the existing station's fixed axial gaps.
            const cbmSourceSpan = 9.73629093170166 - 8.622624397277832;
            const cbmReferenceRadial = 2.15 / 2.2997395992279053;
            const cbmHarmonyScale = .8 / cbmSourceSpan, cbmUnityScale = 1 / cbmSourceSpan;
            const cbmDestinyFront = -.25 - (8.911153793334961 - 8.622624397277832) * cbmHarmonyScale;
            const cbmHarmonyRear = -.25 - (9.384664177894592 - 8.622624397277832) * cbmHarmonyScale;
            const cbmDestinyRear = 8.25 + (8.911153793334961 - 8.622624397277832) * cbmUnityScale;
            const cbmUnityFront = 8.25 + (9.384664177894592 - 8.622624397277832) * cbmUnityScale;
            const cbmPassiveRadius = 1.180267 * cbmReferenceRadial;
            function labelTexture(text, color = '#344b42') {
                const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
                const context = canvas.getContext('2d');
                // Transparent ink: the hull itself remains visible between letters.
                context.fillStyle = color; context.font = '600 62px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 256, 66, 470);
                const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); return texture;
            }
            function decalMaterial(text) {
                const ink = material(0xffffff, .85, 0, labelTexture(text));
                ink.alphaTest = .25; ink.polygonOffset = true; ink.polygonOffsetFactor = -1;
                ink.polygonOffsetUnits = -1; ink.userData.decal = true;
                return ink;
            }
            function badge(kit, text, position, size, rotation = [-Math.PI / 2, 0, 0]) {
                kit.add(new THREE.PlaneGeometry(size[0], size[1]), decalMaterial(text), position, [1, 1, 1], rotation, false);
            }
            function hullBadge(kit, text, center, radius, size, axis = 'z', angle = Math.PI / 2) {
                // The long edge follows the module axis; the short edge wraps its skin.
                const geometry = new THREE.PlaneGeometry(size[0], size[1], 1, 12);
                const positions = geometry.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    const along = -positions.getX(i), a = angle + positions.getY(i) / radius;
                    const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
                    positions.setXYZ(i, axis === 'x' ? along : x, y, axis === 'x' ? -x : along);
                }
                geometry.computeVertexNormals();
                kit.add(geometry, decalMaterial(text), center, [1, 1, 1], [0, 0, 0], false);
            }
            // Cell detail is procedural: no image assets are needed for the station.
            function solarTexture(modern = false, back = false) {
                const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 1536;
                const context = canvas.getContext('2d');
                context.fillStyle = back ? '#735030' : modern ? '#101c2a' : '#62472e'; context.fillRect(0, 0, 768, 1536);
                const columns = modern ? 18 : 24, rows = modern ? 80 : 128;
                const cellWidth = 768 / columns, cellHeight = 1536 / rows;
                for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
                    const shade = (row * 17 + column * 7) % 5;
                    context.fillStyle = back ? ['#876039', '#795632', '#825b36', '#916840', '#795a3b'][shade] : modern ? ['#1b3047', '#20394f', '#1b354c', '#253f57', '#1d344c'][shade] : ['#33303e', '#3b3440', '#413743', '#342f3b', '#3f3540'][shade];
                    context.fillRect(column * cellWidth + .8, row * cellHeight + .8, cellWidth - 1.6, cellHeight - 1.6);
                    context.fillStyle = back ? '#c19c6655' : '#b1b2bd66';
                    for (const bus of [.25, .75]) context.fillRect(column * cellWidth + cellWidth * bus, row * cellHeight + 1, .55, cellHeight - 2);
                }
                // Fold lines and transverse conductors remain legible at close range.
                for (let band = 0; band <= 32; band++) {
                    context.fillStyle = back ? '#493721' : '#a48d70'; context.fillRect(0, band * 48, 768, 1.4);
                    context.fillStyle = '#ffffff18'; context.fillRect(0, band * 48 + 2, 768, 2);
                }
                context.fillStyle = '#b7a082'; context.fillRect(0, 0, 3, 1536); context.fillRect(765, 0, 3, 1536);
                const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
                texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return texture;
            }
            const legacySolar = solarTexture(), legacyBack = solarTexture(false, true), modernSolar = solarTexture(true);
            // White thermal coating with fine parallel flow-channel seams, following
            // the supplied close-up. Raised channels and hinges are modeled below.
            function radiatorTexture() {
                const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 648;
                const context = canvas.getContext('2d');
                context.fillStyle = '#fafbf8'; context.fillRect(0, 0, 512, 648);
                // Fine, restrained coating grain; no photovoltaic cell grid.
                for (let row = 0; row < 648; row += 4) {
                    context.fillStyle = row % 12 ? '#f4f6f3' : '#ffffff';
                    context.fillRect(0, row, 512, 1);
                }
                for (let channel = 0; channel < 9; channel++) {
                    const y = 648 * (.5 + (-1.44 + channel * .36) / 3.32);
                    context.fillStyle = '#d9dfdc'; context.fillRect(18, y - 1, 476, 2);
                    context.fillStyle = '#ffffff'; context.fillRect(18, y + 1, 476, 2);
                }
                context.strokeStyle = '#d0d8d4'; context.lineWidth = 2;
                context.strokeRect(7, 7, 498, 634);
                const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
                texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return texture;
            }
            const radiatorFace = radiatorTexture();
            // Kibo-style quilted MMOD skin, shared by the pressurized modules: pressed pockets inside a plain border on each
            // curved panel, laid over dark seams.
            function quiltTexture() {
                const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 160;
                const context = canvas.getContext('2d'); context.fillStyle = '#d6dad6'; context.fillRect(0, 0, 128, 160);
                for (let column = 0; column < 3; column++) for (let row = 0; row < 5; row++) {
                    const x = 10 + column * 37, y = 10 + row * 29;
                    context.fillStyle = (column + row) % 2 ? '#c8cdc9' : '#ced2ce'; context.fillRect(x, y, 33, 25);
                    context.strokeStyle = 'rgba(95,105,101,.45)'; context.lineWidth = 1.2; context.strokeRect(x + .5, y + .5, 32, 24);
                }
                const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
                texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return texture;
            }
            const quiltMap = quiltTexture(), quiltSeam = material(0x5f6866, .8, .2);
            const quiltPanels = [material(0xffffff, .5, .38, quiltMap), material(0xe9ece9, .5, .38, quiltMap)];
            // One curved quilted panel on a cylinder about the z axis (angle 0 = +x, a quarter turn = +y), wound outward.
            function quiltPanel(kit, radius, z0, z1, a0, a1, surface) {
                if (z0 > z1) [z0, z1] = [z1, z0];
                if (a0 > a1) [a0, a1] = [a1, a0];
                const steps = Math.max(2, Math.ceil((a1 - a0) / (Math.PI / 32))), positions = [], uvs = [], indices = [];
                for (let row = 0; row < 2; row++) for (let i = 0; i <= steps; i++) {
                    const a = a0 + (a1 - a0) * i / steps;
                    positions.push(Math.cos(a) * radius, Math.sin(a) * radius, row ? z1 : z0); uvs.push(i / steps, row);
                }
                for (let i = 0; i < steps; i++) { const j = i + steps + 1; indices.push(i, i + 1, j, j, i + 1, j + 1); }
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                geometry.setIndex(indices); geometry.computeVertexNormals();
                kit.add(geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
            }
            function panel(kit, center, width, length, modern = false) {
                kit.box(center, [width, .055, length], palette.black, [0, 0, 0], false);
                kit.add(new THREE.PlaneGeometry(width - .08, length - .08), material(0xffffff, .78, .12, modern ? modernSolar : legacySolar), [center[0], center[1] + .032, center[2]], [1, 1, 1], [-Math.PI / 2, 0, 0], false);
                kit.add(new THREE.PlaneGeometry(width - .08, length - .08), material(0xffffff, .88, .06, modern ? modernSolar : legacyBack), [center[0], center[1] - .032, center[2]], [1, 1, 1], [Math.PI / 2, 0, 0], false);
                for (const side of [-1, 1]) kit.rod([center[0] + side * width / 2, center[1], center[2] - length / 2], [center[0] + side * width / 2, center[1], center[2] + length / 2], modern ? .045 : .028, palette.silver);
                for (const end of [-1, 1]) kit.box([center[0], center[1], center[2] + end * length / 2], [width + .22, .16, .18], palette.silver);
            }
            // Shared payload surfaces: a canvas-texture helper, crumpled white blankets and pillow-shaped covers.
            function payloadCanvas(width, height, draw) {
                const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; draw(canvas.getContext('2d'));
                const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return texture;
            }
            // White multilayer insulation (MLI) used by every blanket: dense irregular creases and low-relief folds.
            const mliCanvas = (() => {
                const blanketCanvas = document.createElement('canvas'); blanketCanvas.width = blanketCanvas.height = 512;
                const c = blanketCanvas.getContext('2d'), pix = c.createImageData(512, 512);
                const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7 + 45.3) * 43758.5453; return n - Math.floor(n); };
                function noise(x, y, s) { const xx = x / s, yy = y / s, ix = Math.floor(xx), iy = Math.floor(yy), fx = xx - ix, fy = yy - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v); }
                for (let y = 0; y < 512; y++)for (let x = 0; x < 512; x++) {
                    const n = noise(x + noise(x, y, 39) * 23, y - noise(x, y, 47) * 17, 9), ridge = Math.pow(1 - Math.abs(n * 2 - 1), 13), v = 229 + (noise(x, y, 44) - .5) * 15 + (noise(x, y, 3) - .5) * 8 - ridge * 29, i = (y * 512 + x) * 4;
                    pix.data[i] = v; pix.data[i + 1] = v + 2; pix.data[i + 2] = v + 1; pix.data[i + 3] = 255;
                }
                c.putImageData(pix, 0, 0);
                for (let i = 0; i < 2100; i++) {
                    const x = hash(i, 5) * 512, y = hash(i, 19) * 512, a = hash(i, 27) * Math.PI * 2, l = 4 + hash(i, 33) * 19;
                    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a + .45) * l * .44, y + Math.sin(a + .45) * l * .44); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
                    c.lineWidth = .65; c.strokeStyle = 'rgba(98,107,101,.22)'; c.stroke(); c.translate(.7, .7); c.strokeStyle = 'rgba(255,255,250,.55)'; c.stroke(); c.translate(-.7, -.7);
                }
                return blanketCanvas;
            })();
            const mliTexture = new THREE.CanvasTexture(mliCanvas); mliTexture.colorSpace = THREE.SRGBColorSpace; mliTexture.wrapS = mliTexture.wrapT = THREE.RepeatWrapping; mliTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
            const mliBump = mliTexture.clone(); mliBump.colorSpace = THREE.NoColorSpace; mliBump.needsUpdate = true;
            const payloadBlanket = new THREE.MeshStandardMaterial({ color: 0xf2f3ec, map: mliTexture, bumpMap: mliBump, bumpScale: .037, roughness: .94, metalness: .10 });
            // The carriers' recessed 9-by-6 deck grid, after the GLB deck image; ESP-2 and the truss payload carriers share it.
            const carrierGrid = payloadCanvas(720, 480, g => {
                g.fillStyle = '#929688'; g.fillRect(0, 0, 720, 480);
                for (let row = 0; row < 6; row++) for (let col = 0; col < 9; col++) {
                    const x = col * 80, y = row * 80;
                    g.fillStyle = (row + col) % 3 ? '#4f574c' : '#555d52'; g.fillRect(x + 9, y + 9, 62, 62);
                    g.strokeStyle = '#717a6b'; g.lineWidth = 3; g.strokeRect(x + 11, y + 11, 58, 58);
                    g.fillStyle = '#626d5e'; g.fillRect(x + 22, y + 33, 35, 15);
                    for (const dx of [3, 77]) for (const dy of [3, 77]) {
                        g.fillStyle = '#adb1a2'; g.beginPath(); g.arc(x + dx, y + dy, 3, 0, Math.PI * 2); g.fill();
                        g.fillStyle = '#545c50'; g.beginPath(); g.arc(x + dx, y + dy, 1.4, 0, Math.PI * 2); g.fill();
                    }
                }
            });
            // A blanketed payload bulges gently on every face; its edges stay square.
            const payloadPillow = new THREE.BoxGeometry(1, 1, 1, 6, 6, 6);
            {
                const puff = payloadPillow.attributes.position;
                for (let i = 0; i < puff.count; i++) {
                    const v = [puff.getX(i), puff.getY(i), puff.getZ(i)], k = v.findIndex(c => Math.abs(Math.abs(c) - .5) < 1e-6);
                    const [a, b] = [0, 1, 2].filter(axis => axis !== k).map(axis => 1 - (2 * v[axis]) ** 2);
                    v[k] += Math.sign(v[k]) * .07 * a * b; puff.setXYZ(i, ...v);
                }
                payloadPillow.computeVertexNormals();
            }
            // Attach sites for the truss payloads: a bridge above the rails (zenith, up = 1) or under the lower chords (nadir,
            // up = -1), with a latch. The bridge covers the seated payload's footprint [xmin, xmax, zmin, zmax], at least
            // 1.5 m by 3.5 m.
            function payloadAttachSite(kit, x, up, [x0, x1, z0, z1]) {
                const y = up > 0 ? 8.98 : 5.05, width = Math.max(1.5, x1 - x0 + .1), depth = Math.max(3.5, 2 * Math.max(-z0, z1) + .1);
                kit.box([x, y, 4], [width, .14, depth], palette.silver);
                kit.box([x, y + up * .1, 4], [.62, .08, .62], palette.hull);
                if (up > 0) for (const z of [2.6, 4.9]) for (const dx of [-.6, .6]) kit.box([x + dx, 8.74, z], [.14, .36, .14], palette.silver); // clear of the rails
                else for (const z of [2.3, 5.7]) for (const dx of [-.6, .6]) kit.box([x + dx, 5.15, z], [.16, .12, .22], palette.silver);
            }
            // BEGIN PMA REFERENCE ASSET: exact mesh, UVs and materials from the supplied models.
            const pmaReferenceData = assetData.pmaReferenceData;
            const pmaArray = (encoded, ArrayType) => {
                const bytes = Uint8Array.from(atob(encoded), ch => ch.charCodeAt(0));
                return new ArrayType(bytes.buffer);
            };
            const pmaReferenceGeometry = pmaReferenceData.primitives.map(primitive => {
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.BufferAttribute(pmaArray(primitive.position, Float32Array), 3));
                geometry.setAttribute('normal', new THREE.BufferAttribute(pmaArray(primitive.normal, Float32Array), 3));
                geometry.setAttribute('uv', new THREE.BufferAttribute(pmaArray(primitive.uv, Float32Array), 2));
                geometry.setIndex(new THREE.BufferAttribute(pmaArray(primitive.indices, primitive.indexType === 5123 ? Uint16Array : Uint32Array), 1));
                geometry.computeBoundingBox(); geometry.computeBoundingSphere();
                return geometry;
            });
            // Repaint only the PMA blanket islands in the source atlas to Harmony's #d6dad6 tone.
            // Other atlas regions, coloured fittings, docking rings and all geometry stay unchanged.
            function pmaHarmonyBlanketMap(original) {
                const canvas = document.createElement('canvas');
                canvas.width = original.image.width; canvas.height = original.image.height;
                const context = canvas.getContext('2d'); context.drawImage(original.image, 0, 0);
                const pixels = context.getImageData(0, 0, canvas.width, canvas.height), rgba = pixels.data;
                for (let y = Math.floor(canvas.height * .135); y < Math.ceil(canvas.height * .447); y++) {
                    for (let x = Math.floor(canvas.width * .185); x < Math.ceil(canvas.width * .495); x++) {
                        const i = (y * canvas.width + x) * 4, r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
                        if (Math.max(r, g, b) - Math.min(r, g, b) > 45) continue;
                        const luminance = .2126 * r + .7152 * g + .0722 * b;
                        const shade = 214 - luminance * .10;
                        rgba[i] = shade; rgba[i + 1] = shade + 4; rgba[i + 2] = shade;
                    }
                }
                context.putImageData(pixels, 0, 0);
                const map = new THREE.CanvasTexture(canvas); map.userData.harmonyBlanket = true; return map;
            }
            const pmaTextureLoader = new THREE.TextureLoader();
            const pmaReferenceMaterials = await Promise.all(pmaReferenceData.materials.map(async definition => {
                const originalMap = await pmaTextureLoader.loadAsync(definition.image);
                const blanket = definition.name === 'ISS_01_dull';
                const map = blanket ? pmaHarmonyBlanketMap(originalMap) : originalMap;
                map.flipY = false; map.colorSpace = THREE.SRGBColorSpace;
                map.wrapS = map.wrapT = THREE.RepeatWrapping;
                map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
                const surface = new THREE.MeshStandardMaterial({ map, roughness: blanket ? .5 : definition.roughness, metalness: blanket ? .38 : definition.metalness });
                surface.name = definition.name; return surface;
            }));
            function referencePma(name, mount, rotation) {
                const assembly = new THREE.Group(); assembly.name = name;
                assembly.position.set(...mount); assembly.rotation.set(...rotation);
                assembly.userData.referenceSource = pmaReferenceData.source;
                assembly.userData.referenceSize = [2.5771868228912354, 3.196579337120056, 2.6519665306248754];
                assembly.userData.scale = 1;
                pmaReferenceGeometry.forEach((geometry, index) => {
                    const mesh = new THREE.Mesh(geometry, pmaReferenceMaterials[pmaReferenceData.primitives[index].material]);
                    mesh.castShadow = true; mesh.receiveShadow = true; assembly.add(mesh);
                });
                return assembly;
            }
            // END PMA REFERENCE ASSET

            // BEGIN PAYLOAD REFERENCE: AMS-02, ELC-1 to ELC-4 and ESP-3, measured on the supplied GLB (nodes 64, 62, 63, 61, 76
            // and 77) and redrawn in this scene's materials. Each GLB component is a box, an extruded outline, a lathe or a
            // hexahedron; the small irregular fittings (grapple-fixture cams, trunnion caps, soft bags) keep their welded
            // shape. Values are station-axis metres from the payload's truss contact; surface classes come from the GLB atlas
            // region or shade of each component.
            const payloadReference = assetData.payloadReference;
            // Scaled with the pressurized modules: Harmony's radius here over the GLB's.
            const payloadReferenceScale = 2.15 / 2.299739;
            const payloadBlanketWrap = payloadBlanket.map.clone();
            payloadBlanketWrap.wrapS = payloadBlanketWrap.wrapT = THREE.RepeatWrapping; payloadBlanketWrap.repeat.set(.8, .8); payloadBlanketWrap.needsUpdate = true;
            const payloadDecal = (width, height, draw) => {
                const surface = material(0xffffff, .8, .05, payloadCanvas(width, height, draw)).clone();
                surface.polygonOffset = true; surface.polygonOffsetFactor = -1; surface.polygonOffsetUnits = -1; surface.userData.decal = true;
                return surface;
            };
            const payloadSkins = {
                dark: material(0x6f767a, .7, .2), mid: material(0x969da0, .62, .25), light: material(0xbcc2c3, .58, .2),
                panel: material(0xd4d8d5, .64, .1), bronze: material(0x9a7448, .42, .6), blanket: payloadBlanket,
                blanketWrap: Object.assign(payloadBlanket.clone(), { map: payloadBlanketWrap }), deck: material(0x8c9183, .72, .25),
                deckGrid: material(0xffffff, .86, .12, carrierGrid), amsCase: material(0xb8bdbf, .45, .45), amsTop: material(0xa7acae, .8, .05),
                emblem: material(0xe2e4e0, .7, .05), radiator: material(0xe7e9e5, .72, .04), strap: 0xc0c6be, handle: 0x69706a,
                // Serpentine heat pipes in two loops over a riveted panel, after the GLB radiator image.
                amsRadiator: material(0xffffff, .5, .3, payloadCanvas(256, 256, g => {
                    g.fillStyle = '#cdd1d2'; g.fillRect(0, 0, 256, 256);
                    g.strokeStyle = '#9ba1a4'; g.lineWidth = 7; g.lineJoin = 'round';
                    for (const x0 of [26, 138]) {
                        g.beginPath(); g.moveTo(x0, 30);
                        for (let pass = 0; pass < 4; pass++) { const x = x0 + pass * 28, y = pass % 2 ? 30 : 226; g.lineTo(x, y); if (pass < 3) g.lineTo(x + 28, y); }
                        g.stroke();
                    }
                    g.fillStyle = '#a7adaf'; for (let x = 12; x < 256; x += 22) for (const y of [10, 246]) { g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill(); }
                    g.strokeStyle = '#8f9598'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 250);
                })),
                // The octagonal top cover, lettered twice as on the GLB, around the central disc.
                amsLettering: payloadDecal(512, 512, g => {
                    g.fillStyle = '#a3a9ab'; g.fillRect(0, 0, 512, 512);
                    g.fillStyle = '#5d6f86'; g.beginPath(); g.arc(256, 256, 54, 0, Math.PI * 2); g.fill();
                    g.fillStyle = '#2b2f36'; g.font = '800 104px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AMS', 256, 132);
                    g.save(); g.translate(256, 380); g.rotate(Math.PI); g.fillText('AMS', 0, 0); g.restore();
                }),
                // AMS-02 mission patch: a shield with the blue field, red arc and white lettering.
                amsPatch: payloadDecal(128, 160, g => {
                    const shield = () => { g.beginPath(); g.moveTo(10, 10); g.lineTo(118, 10); g.lineTo(118, 96); g.quadraticCurveTo(118, 130, 64, 152); g.quadraticCurveTo(10, 130, 10, 96); g.closePath(); };
                    g.fillStyle = '#f1f2ee'; g.fillRect(0, 0, 128, 160);
                    shield(); g.fillStyle = '#23407a'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#d9dcd9'; g.stroke();
                    g.strokeStyle = '#c8323a'; g.lineWidth = 7; g.beginPath(); g.arc(64, 112, 42, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
                    g.fillStyle = '#ffffff'; g.font = '700 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AMS-02', 64, 52);
                })
            };
            const payloadAxis = (geometry, index) => [geometry.attributes.position.getX, geometry.attributes.position.getY, geometry.attributes.position.getZ][index];
            // Planar UVs over a geometry's own extent on two local axes, so a canvas covers it once.
            function payloadFitUv(geometry, a = 0, b = 1) {
                geometry.computeBoundingBox();
                const position = geometry.attributes.position, uv = geometry.attributes.uv, box = geometry.boundingBox;
                const lo = box.min.toArray(), span = box.max.toArray().map((value, index) => Math.max(value - lo[index], 1e-6));
                const getA = payloadAxis(geometry, a), getB = payloadAxis(geometry, b);
                for (let i = 0; i < position.count; i++) uv.setXY(i, (getA.call(position, i) - lo[a]) / span[a], (getB.call(position, i) - lo[b]) / span[b]);
                return geometry;
            }
            function payloadShape(outline, holes = []) {
                const trace = (points, path) => {
                    for (let i = 0; i < points.length; i += 2) i ? path.lineTo(points[i], points[i + 1]) : path.moveTo(points[i], points[i + 1]);
                    path.closePath(); return path;
                };
                const shape = trace(outline, new THREE.Shape());
                for (const hole of holes) shape.holes.push(trace(hole, new THREE.Path()));
                return shape;
            }
            const payloadPrism = (outline, holes, depth) => new THREE.ExtrudeGeometry(payloadShape(outline, holes), { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
            function payloadLathe(profile, segments, phiStart, phiLength) {
                const points = [];
                for (let i = 0; i < profile.length; i += 2) points.push(new THREE.Vector2(profile[i], profile[i + 1]));
                return new THREE.LatheGeometry(points, segments, phiStart, phiLength);
            }
            // A hexahedron from its eight corners, indexed by the signs of a box corner: x + 2y + 4z.
            function payloadHexahedron(corners) {
                const geometry = new THREE.BoxGeometry(1, 1, 1), position = geometry.attributes.position;
                for (let i = 0; i < position.count; i++) {
                    const k = (position.getX(i) > 0 ? 1 : 0) + (position.getY(i) > 0 ? 2 : 0) + (position.getZ(i) > 0 ? 4 : 0);
                    position.setXYZ(i, corners[k * 3], corners[k * 3 + 1], corners[k * 3 + 2]);
                }
                geometry.computeVertexNormals(); return geometry;
            }
            // A welded GLB fitting, smooth-shaded for the soft bags, with box-projected UVs in metres.
            function payloadMesh(points, faces, smooth) {
                let geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); geometry.setIndex(faces);
                if (!smooth) geometry = geometry.toNonIndexed();
                geometry.computeVertexNormals();
                const position = geometry.attributes.position, normal = geometry.attributes.normal, uv = new Float32Array(position.count * 2);
                for (let i = 0; i < position.count; i++) {
                    const ax = Math.abs(normal.getX(i)), ay = Math.abs(normal.getY(i)), az = Math.abs(normal.getZ(i));
                    uv[i * 2] = ax >= ay && ax >= az ? position.getZ(i) : position.getX(i);
                    uv[i * 2 + 1] = ay > ax && ay >= az ? position.getZ(i) : position.getY(i);
                }
                geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geometry;
            }
            // Piping round the outer face of a blanketed box and two raised handling straps, as on the GLB blankets. The outer
            // face is the one across `axis` on `side`.
            function payloadBlanketDetail(kit, centre, size, axis, side) {
                const [i, j] = [0, 1, 2].filter(k => k !== axis);
                const at = (offset, u, v) => { const p = [...centre]; p[axis] += side * (size[axis] / 2 + offset); p[i] += u; p[j] += v; return p; };
                const wi = size[i], wj = size[j];
                for (const u of [-wi * .455, wi * .455]) kit.rod(at(.007, u, -wj * .44), at(.007, u, wj * .44), .006, payloadSkins.strap);
                for (const v of [-wj * .455, wj * .455]) kit.rod(at(.007, -wi * .44, v), at(.007, wi * .44, v), .006, payloadSkins.strap);
                const long = wi >= wj, reach = Math.min(.16, (long ? wi : wj) * .2);
                for (const offset of [-.25, .25]) {
                    const across = (long ? wj : wi) * offset, point = (lift, along) => long ? at(lift, along, across) : at(lift, across, along);
                    const path = [point(0, -reach), point(.031, -reach * .73), point(.031, reach * .73), point(0, reach)];
                    for (let k = 1; k < path.length; k++) kit.rod(path[k - 1], path[k], .010, payloadSkins.handle);
                }
            }
            // The stowed radiator's stacked panels show on its narrow faces; a frame borders the broad outer face.
            function payloadRadiatorDetail(kit, centre, size, side) {
                const [x, y, z] = centre, [sx, sy, sz] = size;
                for (const end of [-1, 1]) for (let k = 1; k < 10; k++)
                    kit.box([x - sx / 2 + sx * k / 10, y, z + end * (sz / 2 + .008)], [.014, sy * .96, .016], 0xb3b8ba, [0, 0, 0], false);
                const face = x + side * (sx / 2 + .012);
                for (const end of [-1, 1]) {
                    kit.box([face, y + end * (sy / 2 - .05), z], [.024, .06, sz - .04], 0xc5c9c8, [0, 0, 0], false);
                    kit.box([face, y, z + end * (sz / 2 - .05)], [.024, sy - .04, .06], 0xc5c9c8, [0, 0, 0], false);
                }
            }
            // A measured part's geometry and its placement [position, scale, rotation]; hexahedra and welded meshes carry
            // their own coordinates.
            function measuredGeometry(part, smooth = false) {
                switch (part[0]) {
                    case 'b': return shapes.box;
                    case 'p': return payloadPrism(part[9], part[10], part[8]);
                    case 'l': return payloadLathe(part[11], part[8], part[9], part[10]);
                    case 'h': return payloadHexahedron(part[2]);
                    default: return payloadMesh(part[2], part[3], smooth);
                }
            }
            function measuredPlacement(part) {
                if (part[0] === 'b') return [part.slice(2, 5), part.slice(5, 8), part.slice(8, 11)];
                if (part[0] === 'p' || part[0] === 'l') return [part.slice(2, 5), [1, 1, 1], part.slice(5, 8)];
                return [[0, 0, 0], [1, 1, 1], [0, 0, 0]];
            }
            // One payload as an assembly whose truss contact sits on `mount`.
            function referencePayload(name, mount) {
                const payload = payloadReference.payloads[name], assembly = new THREE.Group(), kit = new Kit();
                assembly.name = name; assembly.position.fromArray(mount); assembly.scale.setScalar(payloadReferenceScale);
                assembly.userData.reference = { source: payloadReference.source + ' / ' + payload.nodeName, contact: payload.contact, size: payload.size, parts: payload.parts.length, scale: payloadReferenceScale };
                const deck = payload.parts.find(part => part[1] === 'deck'), core = payload.parts.find(part => part[1] === 'amsCase');
                const local = new THREE.Euler(), axis = new THREE.Vector3();
                // Which way a part's local z axis faces, relative to a reference point (the deck or the AMS core).
                const facing = (part, origin) => {
                    local.set(part[5], part[6], part[7]); axis.set(0, 0, 1).applyEuler(local);
                    return Math.sign(axis.dot(new THREE.Vector3(part[2] - origin[2], part[3] - origin[3], part[4] - origin[4]))) || 1;
                };
                for (const part of payload.parts) {
                    const [kind, skin] = part, geometry = measuredGeometry(part, skin === 'blanket'), [centre, scale, turn] = measuredPlacement(part);
                    if (skin === 'amsRadiator') payloadFitUv(geometry);
                    kit.add(geometry, payloadSkins[skin === 'blanket' && kind !== 'b' ? 'blanketWrap' : skin], centre, scale, turn);
                    if (kind === 'b' && deck) {
                        const outward = Math.sign(centre[0] - deck[2]) || 1;
                        if (skin === 'blanket') payloadBlanketDetail(kit, centre, scale, 0, outward);
                        if (skin === 'radiator') payloadRadiatorDetail(kit, centre, scale, outward);
                    }
                    if (kind !== 'p') continue;
                    const depth = part[8], outline = part[9];
                    if (skin === 'deck') {
                        // The shared 9-by-6 grid on both faces, nine cells along the deck's long side.
                        geometry.computeBoundingBox();
                        const box = geometry.boundingBox, width = box.max.x - box.min.x - .32, height = box.max.y - box.min.y - .32;
                        for (const side of [-1, 1]) {
                            const grid = new THREE.PlaneGeometry(Math.max(width, height), Math.min(width, height));
                            if (height > width) grid.rotateZ(Math.PI / 2);
                            if (side < 0) grid.rotateY(Math.PI);
                            grid.translate((box.max.x + box.min.x) / 2, (box.max.y + box.min.y) / 2, side * (depth / 2 + .004));
                            kit.add(grid, payloadSkins.deckGrid, centre, [1, 1, 1], turn, false);
                        }
                    }
                    if (skin === 'amsCase') {
                        // Circumferential ribs on the magnet's vacuum case.
                        let radius = 0;
                        for (let i = 0; i < outline.length; i += 2) radius = Math.max(radius, Math.hypot(outline[i], outline[i + 1]));
                        for (let k = 0; k < 14; k++) kit.add(new THREE.TorusGeometry(radius + .004, .013, 6, 48).translate(0, 0, -depth / 2 + depth * (k + .5) / 14), payloadSkins.light, centre, [1, 1, 1], turn, false);
                    }
                    if ((skin === 'amsTop' && depth < .1 || skin === 'emblem') && core) {
                        // Lettering on the cover's outer face; the mission patch upright on each emblem panel.
                        const side = facing(part, core);
                        const decal = skin === 'emblem' ? new THREE.PlaneGeometry(.42, .52) : payloadFitUv(new THREE.ShapeGeometry(payloadShape(outline)));
                        if (side < 0) decal.rotateY(Math.PI);
                        if (skin === 'emblem') {
                            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion().setFromEuler(local.set(...turn)).invert());
                            decal.rotateZ(Math.atan2(-up.x, up.y));
                        }
                        decal.translate(0, 0, side * (depth / 2 + .003));
                        kit.add(decal, payloadSkins[skin === 'emblem' ? 'amsPatch' : 'amsLettering'], centre, [1, 1, 1], turn, false);
                    }
                }
                kit.finish(assembly);
                return assembly;
            }
            // GLB contact stations keep their place between the segment's end frames: 21.081 and 26.249 m from the centreline
            // in the GLB, 16 and 22.7 m here. P3 mirrors S3, as its sites do in the GLB.
            const payloadStation = glbX => Math.sign(glbX) * (16 + 6.7 * (Math.abs(glbX) - 21.08088) / 5.16853);
            // AMS-02 sits 0.25 m outboard of its mapped station: its inboard radiators would otherwise cut the edge of the S1
            // radiator bank, which stays on its fixed centreline.
            const payloadStationShift = { 'AMS-02': .25 };
            // A reference payload on its own attach-site bridge, the bridge sized to the payload's footprint.
            function seatedPayload(kit, name) {
                const payload = payloadReference.payloads[name], up = payload.face, x = payloadStation(payload.contact[0]) + (payloadStationShift[name] || 0);
                payloadAttachSite(kit, x, up, payload.footprint.map(v => v * payloadReferenceScale));
                return referencePayload(name, [x, up > 0 ? 9.05 : 4.98, 4]);
            }
            // END PAYLOAD REFERENCE

            // A closed CBM saddle joins a flat collar to the curved pressure hull.
            // Local Z is the mating axis; local Y crosses the parent cylinder.
            function curvedCbmSaddle(kit, hullRadius, profile, color = 0xc7ceca) {
                const positions = [], uv = [], indices = [], steps = 96;
                for (let row = 0; row < profile.length; row++) {
                    const [radius, type, value] = profile[row];
                    for (let i = 0; i <= steps; i++) {
                        const a = i / steps * Math.PI * 2, y = Math.sin(a) * radius;
                        const z = type === 'shell' ? Math.sqrt(hullRadius ** 2 - y ** 2) - value : value;
                        positions.push(Math.cos(a) * radius, y, z);
                        uv.push(i / steps, row / (profile.length - 1));
                    }
                }
                for (let row = 0; row < profile.length - 1; row++) for (let i = 0; i < steps; i++) {
                    const a = row * (steps + 1) + i, b = a + 1, c = a + steps + 1, d = c + 1;
                    indices.push(a, b, c, b, d, c);
                }
                let volume = 0;
                const p = i => new THREE.Vector3().fromArray(positions, i * 3);
                for (let i = 0; i < indices.length; i += 3)
                    volume += p(indices[i]).dot(p(indices[i + 1]).cross(p(indices[i + 2]))) / 6;
                if (volume < 0) for (let i = 0; i < indices.length; i += 3)
                    [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
                geometry.setIndex(indices); geometry.computeVertexNormals();
                kit.add(geometry, material(color, .58, .30), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
            }

            part('truss', 'Integrated truss structure', '01 / STRUCTURE', 'The segmented backbone carries shielded equipment bays, power-conversion hardware, cooling loops and the rails for the mobile servicing system.', [['Truss length', '~94 m'], ['Completed', '2009']], [8, 8, 4], (kit, group) => {
                group.userData.equipmentBays = 16;
                group.userData.sarjReference = [];
                group.userData.referenceStructure = 'GLB-derived five-bay S0 hexagonal core, open SARJ bearings, uneven S1/P1 bays and short S5/P5 with S6/P6 extensions; existing payload and array anchors retained';
                group.userData.referenceSegmentSpans = { S0:[-7,7], S1:[7,16], S3:[16,22.7], SARJ:[22.7,24.3], S4:[24.3,33.7], S5:[33.7,37.25], S6Extension:[37.25,41.8], S6Equipment:[41.8,47.3] };
                group.userData.bracing = { source: 'ISS_stationary.glb nodes 67, 65, 60, 59, 58; one diagonal per bay and face, none crossing',
                    S1: 'aft-face diamonds, zigzag deck and underside', S3: 'Λ faces, parallel deck and underside', S4: 'Warren zigzag, V through the beta-gimbal crossmember',
                    S5: 'single brace, then a K into the middle frame', S6: 'Warren zigzag, a Λ per face on the long spacer, continuing through the IEA' };
                group.userData.memberSections = trussSections;
                group.userData.photovoltaicRadiators = 4;
                group.userData.solarAlphaRotaryJoints = 2;
                group.userData.solarAlphaRotaryJointCenters = [-solarRotaryJointX, solarRotaryJointX];
                group.userData.betaGimbalSupports = 8;
                group.userData.outerMountPlacement = 'Outboard of the terminal equipment face';
                group.userData.outerTrussEnd = 47.30;
                group.userData.outerSolarRoot = 49.60;
                group.userData.innerEquipmentCenter = 27.55;
                // Reference-led lattice and equipment covers. Small fittings are illustrative.
                // The outer rectangular lattice ends at the IEA face; paired SAWs
                // sit beyond it on spreading diagonal supports.
                // Separate pieces terminate on each side of the SARJs. The outer
                // spacer is short; the following open span belongs to S6/P6.
                const trussEnds = [-47.30,-41.8,-37.25,-33.7,-24.3,-22.7,-16,-7,7,16,22.7,24.3,33.7,37.25,41.8,47.30];
                const sourceS1Frames = [-7.137784,-4.550570,-2.758906,-.966953,1.675464,4.331906,6.917079];
                const referenceBayFrames = (start,end) => {
                    const middle=(start+end)/2, a=Math.abs(middle), sign=Math.sign(middle);
                    if(a>7 && a<16) return sourceS1Frames.map(x=>sign*(7+9*(6.917079-x)/(6.917079+7.137784))).sort((x,y)=>x-y);
                    if(a>16 && a<22.7) return [start,sign*(16+6.7*(2.7753536701-.0847024694)/(2.7753536701+2.3931732178)),end];
                    if(a>33.7 && a<37.25) return [start,sign*(33.7+(37.25-33.7)*.475),end];
                    // Two bays: the zigzag then draws the GLB long spacer's single A-frame as a Λ on each face.
                    if(a>37.25 && a<41.8) return [start,(start+end)/2,end];
                    const count=Math.ceil((end-start)/2.7);
                    return Array.from({length:count+1},(_,i)=>start+(end-start)*i/count);
                };
                // S1/P1 retain their trapezoidal section: a short forward band
                // and a full-height aft plane. S0 shares that forward band, rises
                // to the same knee plane, then slopes to a short projecting aft
                // band. Its aft projection tapers back into S1/P1 at both ends.
                // The five source-spaced S0 frames and sloping covers are built
                // separately below; all outboard section profiles stay fixed.
                const forwardZ = 2.3, fullAftZ = 5.7, narrowAftZ = 4.0, narrowTop = 7.47, narrowBottom = 6.23, s0AftBottom = 5.95, s0AftTop = 7.75;
                const chamferStart = 4.25, narrowFrom = 7, narrowTo = 16;
                // The section at x: forward chords at forwardZ (top, bottom), aft chords at aftZ (aftTop, aftBottom) and, across S0,
                // knee chords on S1/P1's aft plane where the top starts to fall and the underside to rise.
                const profile = x => {
                    const a = Math.abs(x), lerp = THREE.MathUtils.lerp;
                    if (a >= narrowTo - 1e-6) return { top: 8.4, bottom: 5.3, aftZ: fullAftZ, aftTop: 8.4, aftBottom: 5.3, knee: false };
                    const t = a <= chamferStart ? 0 : Math.min(1, (a - chamferStart) / (narrowFrom - chamferStart));
                    return { top: narrowTop, bottom: narrowBottom, aftZ: lerp(fullAftZ, narrowAftZ, t), aftTop: lerp(s0AftTop, 8.4, t), aftBottom: lerp(s0AftBottom, 5.3, t), knee: t < 1 - 1e-6 };
                };
                // Height of the top surface at (x, z): from the forward top chord to the knee line on S1/P1's aft plane, then down
                // to S0's aft top chord.
                const topAt = (x, z) => {
                    const p = profile(x), clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
                    if (z <= narrowAftZ || p.aftZ - narrowAftZ < 1e-6) return lerp(p.top, 8.4, clamp((z - forwardZ) / (narrowAftZ - forwardZ), 0, 1));
                    return lerp(8.4, p.aftTop, clamp((z - narrowAftZ) / (p.aftZ - narrowAftZ), 0, 1));
                };
                group.userData.crossSection = { forwardZ, fullAftZ, narrowAftZ, narrowForwardFace: [narrowBottom, narrowTop], s0AftFace: [s0AftBottom, s0AftTop], chamfer: [chamferStart, narrowFrom], narrowTo };
                const gussetShape = new THREE.Shape();
                gussetShape.moveTo(0, 0); gussetShape.lineTo(.40, 0);
                gussetShape.lineTo(0, .40); gussetShape.closePath();
                const gusset = new THREE.ExtrudeGeometry(gussetShape, { depth: .045, bevelEnabled: false, steps: 1 });
                const trussFastener = (point, radius, length, rotation = [Math.PI / 2, 0, 0], color = palette.rail) =>
                    kit.add(shapes.lowCylinder, material(color), point, [radius, length, radius], rotation, false);
                // Members take the GLB sections in trussSections. A box tube's depth faces the plane it shares with the chords,
                // a truss face for a brace or the frame plane for a post, so flat faces line up across each joint.
                const alongTruss = new THREE.Vector3(1, 0, 0);
                const bar = (start, end, size, color = palette.rail) => {
                    const axis = new THREE.Vector3(...end).sub(new THREE.Vector3(...start)), length = axis.length();
                    if (length < 1e-4) return;
                    axis.normalize();
                    const normal = new THREE.Vector3().crossVectors(axis, alongTruss);
                    if (normal.lengthSq() < 1e-6) normal.set(0, 1, 0); else normal.normalize();
                    const [width, depth] = Array.isArray(size) ? size : [size, size];
                    const geometry = shapes.box.clone().scale(width, length, depth)
                        .applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(axis, normal), axis, normal))
                        .translate((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2);
                    kit.add(geometry, material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                };
                // S5/P5's round struts swell from their end fittings to the full tube over the middle half, as on the GLB cage.
                const strut = (start, end, color = palette.rail) => {
                    const [tip, body] = trussSections.S5.strut;
                    const axis = new THREE.Vector3(...end).sub(new THREE.Vector3(...start)), length = axis.length(), half = length / 2, taper = length / 4;
                    if (length < 1e-4) return;
                    const outline = [[0, -half], [tip / 2, -half], [body / 2, taper - half], [body / 2, half - taper], [tip / 2, half], [0, half]];
                    const geometry = new THREE.LatheGeometry(outline.map(([radius, y]) => new THREE.Vector2(radius, y)), 10);
                    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vertical, axis.normalize()));
                    geometry.translate((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2);
                    kit.add(geometry, material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                };
                const segmentOf = x => { const a = Math.abs(x); return a < 16 ? 'S1' : a < 22.7 ? 'S3' : a < 33.7 ? 'S4' : a < 37.25 ? 'S5' : 'S6'; };
                const chordSection = (segment, key) => trussSections[segment][key[0] === 'f' ? 'fore' : 'aft'];
                // Half-depth across the truss of a chord; S5/P5's struts at their swell.
                const chordHalf = (segment, key) => (segment === 'S5' ? trussSections.S5.strut[1] : chordSection(segment, key)[0]) / 2;
                // A frame at a segment interface takes the heavier of the two sections meeting there; the S6/P6 IEA ends carry
                // the GLB's deep end posts.
                const sectionArea = size => Array.isArray(size) ? size[0] * size[1] : size * size;
                const frameSection = x => {
                    const a = Math.abs(x);
                    if (Math.abs(a - 41.8) < 1e-3 || Math.abs(a - 47.3) < 1e-3) return trussSections.S6.endPost;
                    return [x - 1e-3, x + 1e-3].map(v => trussSections[segmentOf(v)].frame).reduce((p, q) => sectionArea(q) > sectionArea(p) ? q : p);
                };
                // Triangular gussets, a cover plate and two fasteners at a corner of a face, seated on the outer face of the
                // chord and post meeting there (seat is their half-depth across the truss).
                const cornerFittings = (x, height, depth, face, upper, seat) => {
                    for (const inward of [-1, 1]) {
                        const turn = upper ? (inward > 0 ? -Math.PI / 2 : Math.PI) : (inward > 0 ? 0 : Math.PI / 2);
                        kit.add(gusset, material(palette.silver), [x, height, depth + face * seat - (face < 0 ? .045 : 0)], [1, 1, 1], [0, 0, turn], false);
                    }
                    kit.box([x, height, depth + face * (seat + .08)], [.27, .27, .07], palette.hull, [0, 0, 0], false);
                    for (const dx of [-.075, .075]) trussFastener([x + dx, height, depth + face * (seat + .135)], .026, .04);
                };
                const latticeFrames = [];
                // Bracing after the GLB truss segments: one diagonal per bay and face, meeting other members only at chords, posts
                // and mid-height nodes, so no two braces cross. Opposite faces run in phase, so in elevation and plan the far brace
                // sits behind the near one instead of crossing it. Bays count from the inboard end, so port mirrors starboard.
                //   S1/P1 (GLB node 67): diamonds on the full-height aft face, a zigzag deck and underside; the covered forward band has none.
                //   S3/P3 (node 65): a Λ on each vertical face, peaking at the middle frame; parallel braces on the deck and underside.
                //   S5/P5 (node 59): a single brace into the middle frame's mid-height node, then a K from the outer frame; a V on the
                //   deck and underside, and one diagonal across the middle frame.
                //   S4/P4 and S6/P6 (nodes 60, 58): a continuous Warren zigzag whose faces share their corner nodes. Underside braces
                //   cross the IEA bays forward of the radiator roots.
                for (let section = 0; section < trussEnds.length - 1; section++) {
                    const start=trussEnds[section],end=trussEnds[section+1],middle=Math.abs((start+end)/2);
                    if (middle>22.7 && middle<24.3) continue; // moving bearing gap
                    if(start<0&&end>0) continue; // S0 has its own source-measured five-bay frame below.
                    const bayFrames=referenceBayFrames(start,end),bayCount=bayFrames.length-1;
                    const segment = segmentOf(middle), sections = trussSections[segment];
                    // Chords follow the section's own profile, sampled just inside its ends.
                    const corners = x => {
                        const p = profile(THREE.MathUtils.clamp(x, start + 1e-4, end - 1e-4));
                        return { ft: [x, p.top, forwardZ], fb: [x, p.bottom, forwardZ], at: [x, p.aftTop, p.aftZ], ab: [x, p.aftBottom, p.aftZ],
                            fm: [x, (p.top + p.bottom) / 2, forwardZ], am: [x, (p.aftTop + p.aftBottom) / 2, p.aftZ] };
                    };
                    // S5/P5's chords are struts bay by bay; elsewhere a box chord runs the whole section.
                    for (const key of ['ft', 'fb', 'at', 'ab']) {
                        if (segment === 'S5') for (let bay = 0; bay < bayCount; bay++) strut(corners(bayFrames[bay])[key], corners(bayFrames[bay + 1])[key], palette.silver);
                        else bar(corners(start)[key], corners(end)[key], chordSection(segment, key), palette.silver);
                    }
                    for (let bay = 0; bay <= bayCount; bay++) {
                        const across = bayFrames[bay];
                        if ((section === 0 || bay > 0 || Math.abs(Math.abs(start)-24.3)<1e-5 || Math.abs(Math.abs(start)-22.7)<1e-5) && Math.abs(Math.abs(across)-7)>1e-5) {
                            latticeFrames.push(across);
                            // A frame takes the fuller of the sections meeting at it; a narrow neighbour adds a short frame
                            // for its sloped chords.
                            const sideA = profile(across - 1e-4), sideB = profile(across + 1e-4);
                            const [full, narrow] = sideA.aftZ >= sideB.aftZ ? [sideA, sideB] : [sideB, sideA];
                            const ft = p => [across, p.top, forwardZ], fb = p => [across, p.bottom, forwardZ], at = p => [across, p.aftTop, p.aftZ], ab = p => [across, p.aftBottom, p.aftZ];
                            const frame = frameSection(across), narrowFrame = trussSections.S1.frame;
                            // Only the inner SAWs need openings through the lattice; the outer canisters meet a frame beyond the closed terminal face.
                            if (!inSolarPocket(across)) { bar(fb(full), ft(full), frame); bar(ab(full), at(full), frame); }
                            bar(ft(full), at(full), frame); bar(fb(full), ab(full), frame);
                            if (full.aftZ - narrow.aftZ > 1e-3) { bar(ab(narrow), at(narrow), narrowFrame); bar(ft(narrow), at(narrow), narrowFrame); bar(fb(narrow), ab(narrow), narrowFrame); }
                            // Fittings seat on the deepest chord or post at the corner, from either side of a full interface.
                            const fullSides = [across - 1e-3, across + 1e-3].filter(x => profile(x).aftZ >= full.aftZ - 1e-6).map(segmentOf);
                            const seat = key => Math.max((Array.isArray(frame) ? frame[1] : frame) / 2, ...fullSides.map(side => chordHalf(side, key)));
                            for (const upper of [false, true]) {
                                if (full.top > 8.39) cornerFittings(across, upper ? 8.4 : 5.3, forwardZ, -1, upper, seat('f'));
                                cornerFittings(across, upper ? full.aftTop : full.aftBottom, full.aftZ, 1, upper, seat('a'));
                            }
                        }
                    }
                    const stations = [...bayFrames].sort((a, b) => Math.abs(a) - Math.abs(b)), sign = Math.sign(start + end);
                    const brace = (from, to, size = sections.brace) => segment === 'S5' ? strut(from, to) : bar(from, to, size);
                    for (let bay = 0; bay < bayCount; bay++) {
                        const inner = stations[bay], outer = stations[bay + 1], a = corners(inner), b = corners(outer), even = bay % 2 === 0;
                        if (segment === 'S1') {
                            // Aft-face diamonds in 0.105 tubes; the deck and underside zigzag in the GLB's heavier 0.132 tubes.
                            const deck = sections.deckBrace;
                            if (even) { brace(a.am, b.at); brace(a.am, b.ab); brace(a.ft, b.at, deck); brace(a.fb, b.ab, deck); }
                            else { brace(a.at, b.am); brace(a.ab, b.am); brace(a.at, b.ft, deck); brace(a.ab, b.fb, deck); }
                        } else if (segment === 'S3') {
                            for (const [low, high] of [['fb', 'ft'], ['ab', 'at']]) even ? brace(a[low], b[high]) : brace(a[high], b[low]);
                            brace(b.ft, a.at); brace(b.fb, a.ab);
                        } else if (segment === 'S5') {
                            if (even) { brace(a.fb, b.fm); brace(a.at, b.am); brace(a.at, b.ft); brace(a.ab, b.fb); }
                            else {
                                for (const key of ['ft', 'fb']) brace(b[key], a.fm);
                                for (const key of ['at', 'ab']) brace(b[key], a.am);
                                brace(b.at, a.ft); brace(b.ab, a.fb); brace(a.ft, a.ab);
                            }
                        } else {
                            // The faces skip the bays the inner mast canisters pass through; the bay holding a beta-gimbal
                            // crossmember breaks its deck and underside braces at that crossmember.
                            const pocket = solarStations.some(root=>Math.abs(root)===32 && Math.max(inner,outer)>root-solarPocketHalf && Math.min(inner,outer)<root+solarPocketHalf);
                            if (!pocket) for (const [low, high] of [['fb', 'ft'], ['ab', 'at']]) even ? brace(a[low], b[high]) : brace(a[high], b[low]);
                            if (Math.abs(inner) < 32 && Math.abs(outer) > 32) {
                                const g = corners(sign * 32);
                                brace(a.at, g.ft); brace(g.ft, b.at); brace(a.ab, g.fb); brace(g.fb, b.ab);
                            } else for (const [fore, aft] of [['ft', 'at'], ['fb', 'ab']]) even ? brace(a[fore], b[aft]) : brace(a[aft], b[fore]);
                        }
                    }
                    // Bolted splice sleeves make each segment interface legible, at the section's inboard end on both sides,
                    // 50 mm proud of the chord all round.
                    const joint = stations[0], c = corners(joint);
                    for (const key of ['ft', 'fb', 'at', 'ab']) {
                        const [across, height] = segment === 'S5' ? [trussSections.S5.strut[1], trussSections.S5.strut[1]] : chordSection(segment, key);
                        kit.box(c[key], [.42, height + .1, across + .1], palette.silver, [0, 0, 0], false);
                        for (const dx of [-.12, .12]) trussFastener([joint + dx, c[key][1], c[key][2] + (key[0] === 'f' ? -1 : 1) * (across / 2 + .075)], .036, .05, [Math.PI / 2, 0, 0], palette.dark);
                    }
                }
                // At the S1/P1--S3/P3 section change, the narrow forward
                // chords seat on the full front posts, and its aft chords on the
                // full-depth top/bottom crossmembers. Four explicit splice seats
                // mark these load paths without changing either attachment plane.
                for(const side of [-1,1]) for(const [y,z] of [[narrowTop,forwardZ],[narrowBottom,forwardZ],[8.4,narrowAftZ],[5.3,narrowAftZ]]) {
                    const x=side*16;
                    kit.box([x,y,z],[.25,.20,.20],palette.silver,[0,0,0],false);
                    for(const dz of [-.057,.057]) trussFastener([x+side*.136,y,z+dz],.027,.035,[0,0,Math.PI/2],palette.dark);
                }
                for (const side of [-1, 1]) {
                    // Omit the final covered bay around each solar rotary joint: side plates, deck,
                    // cable-tray cover, fasteners and gold handholds in the marked region.
                    for (let bay = 0; bay < 8; bay++) {
                        if(bay<2)continue; // S0 covers follow its measured sloping faces below.
                        const across = side * (2.1 + bay * 2.7);
                        // Bays 0-1 lie on S0 (its chamfers, aft face and deck are built with S0 below), 2-5 on the narrow S1/P1 and
                        // 6-7 on S3/P3.
                        const narrow = bay >= 2 && bay <= 5, fullAft = bay >= 6;
                        const cover = (x, y, depth, face, width, height, tone) => {
                            kit.box([x, y, depth], [width, height, .12], tone);
                            kit.box([x, y, depth + face * .07], [width - .3, height - .29, .035], palette.hull, [0, 0, 0], false);
                            for (const dx of [-(width / 2 - .18), width / 2 - .18]) for (const dy of [-(height / 2 - .17), height / 2 - .17]) trussFastener([x + dx, y + dy, depth + face * .10], .031, .05);
                        };
                        const tone = bay % 3 === 1 ? palette.hull : palette.white;
                        // Full-height faces carry the upper-band covers, jumper boxes and gold handholds; S0's stop at its chamfer.
                        for (const face of narrow ? [] : fullAft ? [-1, 1] : [-1]) {
                            const depth = face < 0 ? forwardZ - .07 : fullAftZ + .07;
                            const from = Math.abs(across) - 1.24, to = bay === 1 ? chamferStart - .05 : Math.abs(across) + 1.24;
                            const x = side * (from + to) / 2, width = to - from, reach = Math.min(1.03, width / 2 - .2);
                            // Upper equipment covers leave the lower triangular bays exposed.
                            cover(x, 7.73, depth, face, width, 1.12, tone);
                            // Covered jumper boxes interrupt the panel rhythm at selected upper bays, hung under the cover
                            // in the outboard corner clear of S3/P3's descending Λ brace.
                            if (bay % 3 === 1) {
                                const jumperX = across + side * .96;
                                kit.box([jumperX, 6.945, depth - face * .25], [1.10, .45, .53], palette.silver);
                                kit.rod([jumperX, 7.15, depth - face * .20], [jumperX, 7.47, depth - face * .20], .04, palette.dark);
                            }
                            const railDepth = depth + face * .20;
                            kit.rod([x - reach, 8.66, railDepth], [x + reach, 8.66, railDepth], .033, palette.gold);
                            for (const dx of [-reach, reach]) {
                                kit.rod([x + dx, 8.38, depth], [x + dx, 8.66, railDepth], .033, palette.gold);
                                kit.box([x + dx, 8.36, depth], [.18, .12, .20], palette.silver, [0, 0, 0], false);
                            }
                        }
                        if (narrow) {
                            // S1/P1: the narrow forward face toward Harmony, the full-height aft face toward the radiators and the
                            // deck rising between them, trimmed at the S0 chamfer and at S3/P3.
                            const from = bay === 2 ? narrowFrom + .03 : Math.abs(across) - 1.24, to = bay === 5 ? narrowTo - .03 : Math.abs(across) + 1.24;
                            const x = side * (from + to) / 2, width = to - from, rise = Math.atan2(8.4 - narrowTop, narrowAftZ - forwardZ);
                            cover(x, (narrowTop + narrowBottom) / 2, forwardZ - .07, -1, width, 1.1, tone);
                            cover(x, 7.73, narrowAftZ + .07, 1, width, 1.12, tone);
                            kit.box([x, (8.4 + narrowTop) / 2 + .05 * Math.cos(rise), (forwardZ + narrowAftZ) / 2 - .05 * Math.sin(rise)], [width - .04, .08, Math.hypot(8.4 - narrowTop, narrowAftZ - forwardZ) - .04], bay % 2 ? palette.white : palette.hull, [-rise, 0, 0]);
                        }
                        if (fullAft) {
                            // Separate removable deck covers, folded edges and captive fasteners.
                            for (const depth of [3.14, 4.86]) {
                                kit.box([across, 8.51, depth], [2.46, .11, 1.50], bay % 4 === 0 ? palette.hull : palette.white);
                                for (const dx of [-1.13, 1.13]) {
                                    kit.box([across + dx, 8.47, depth], [.055, .16, 1.48], palette.silver, [0, 0, 0], false);
                                    for (const dz of [-.61, .61]) trussFastener([across + dx, 8.585, depth + dz], .027, .035, [0, 0, 0]);
                                }
                            }
                            // A narrow covered cable tray occupies the center seam.
                            kit.box([across, 8.50, 4], [2.46, .13, .16], palette.silver, [0, 0, 0], false);
                        }
                    }
                    // Equipment boxes inside the truss; those in the narrow S1/P1 sit in its deeper aft half, just ahead of the aft-face braces.
                    for (const across of [9, 13, 18]) {
                        if (across < narrowTo) { kit.box([across * side, 6.85, 3.44], [2.1, 1.8, .9], palette.hull); continue; }
                        kit.box([across * side, 7.6, 4], [2.1, 1.9, 2.6], palette.hull);
                        for (const seam of [-.7, 0, .7]) kit.line([[across * side + seam, 8.58, 2.75], [across * side + seam, 8.58, 5.25]]);
                    }
                    // Reference SARJ: separate stationary/rotating annuli, open sectors,
                    // a small central axle and narrow spokes. No chord crosses the seam.
                    const jointX=solarRotaryJointX*side, jointY=6.85, jointZ=4;
                    const sourceRing={outer:1.701382,bore:1.629172,depth:.290483,centers:.422183};
                    const jointRadius=1.52, radialScale=jointRadius/sourceRing.outer;
                    const boreRadius=sourceRing.bore*radialScale, halfSpacing=sourceRing.centers/2;
                    const annulus=(x,outer,inner,length,color)=>{
                        const path=[[outer,-length/2],[outer,length/2],[inner,length/2],[inner,-length/2],[outer,-length/2]];
                        kit.add(new THREE.LatheGeometry(path.map(p=>new THREE.Vector2(...p)),48),
                            material(color,.48,.4),[x,jointY,jointZ],[1,1,1],[0,0,-Math.PI/2],false);
                    };
                    const sourceSpokes=[0,64,116,180,212,244,296,328];
                    for (const direction of [-1,1]) {
                        const ringX=jointX+side*direction*halfSpacing;
                        annulus(ringX,jointRadius,boreRadius,sourceRing.depth,palette.silver);
                        annulus(ringX,.318733*radialScale,.235619*radialScale,.354478,palette.rail);
                        for(const degrees of sourceSpokes){
                            const a=degrees*Math.PI/180, p=r=>[ringX,jointY+Math.cos(a)*r,jointZ-Math.sin(a)*r];
                            kit.rod(p(.285),p(boreRadius+.013),.030,palette.silver);
                        }
                        // Six-point source end frames sit outside the moving races.
                        const frameX=jointX+side*direction*.42, boxX=jointX+side*direction*.80;
                        const hex=[[1.55,0],[.52,1.70],[-.52,1.70],[-1.55,0],[-.52,-1.70],[.52,-1.70]];
                        const at=([y,z],x=frameX)=>[x,jointY+y,jointZ+z];
                        for(let h=0;h<hex.length;h++){
                            const yz=hex[h],next=hex[(h+1)%hex.length],radius=Math.hypot(...yz);
                            bar(at(yz),at(next),trussSections.SARJ.strut,palette.silver);
                            // Radial seats join each hexagonal corner to its bearing lip.
                            const lipX=ringX+side*direction*sourceRing.depth/2;
                            bar(at(yz),[lipX,jointY+yz[0]*jointRadius/radius,jointZ+yz[1]*jointRadius/radius],trussSections.SARJ.seat,palette.silver);
                            kit.box(at(yz),[.17,.14,.14],palette.silver,[0,0,0],false);
                        }
                        // Fan from the unchanged rectangular chord seats into the six-point frame, in the GLB adapter's 0.08 box tubes.
                        for(const sy of [-1,1])for(const sz of [-1,1]){
                            const corner=[boxX,jointY+sy*1.55,jointZ+sz*1.70];
                            bar(corner,at([sy*.52,sz*1.70]),trussSections.SARJ.strut,palette.silver);
                            bar(corner,at([sy*1.55,0]),trussSections.SARJ.strut,palette.silver);
                        }
                    }
                    // The narrow central axle is intentional source hardware; the sectors
                    // around it remain open. A recessed dark race joins the two bearing rims.
                    kit.cylinder([jointX,jointY,jointZ],.205,.94,palette.silver,[0,0,Math.PI/2]);
                    annulus(jointX,jointRadius-.027,boreRadius-.006,.132,palette.dark);
                    group.userData.sarjReference.push({center:[jointX,jointY,jointZ],outerRadius:jointRadius,
                        boreRadius,ringDepth:sourceRing.depth,ringCenters:sourceRing.centers,
                        openSpan:[Math.abs(jointX)-.80,Math.abs(jointX)+.80],source:sourceRing,
                        spokes:sourceSpokes.length*2,sourceSpokeAngles:sourceSpokes});
                    for (const across of [32, 48]) {
                        const rootX = solarRootX(side * across);
                        const equipmentX = side * (across === 32 ? 27.55 : across - 3.3);
                        const terminal = across === 48, terminalX = side * 47.30;
                        // The module's two wings sit one above the other (solarWingY): each mast canister runs into one shared
                        // beta-gimbal frame through its own face, in its own half, and turns on a BGA near mid-depth. Inboard the
                        // frame is a pocket in the continuous truss; at the tip it is an open box beyond the IEA end face.
                        const frameOuter = rootX + side * 1.4;
                        if (terminal) {
                            // A central end-face spine closes the IEA; the open BGA frame continues outboard of it.
                            kit.box([terminalX, 6.85, 4], [.14, 3.10, .52], palette.silver);
                            const { fore, endPost, brace } = trussSections.S6;
                            for (const height of [5.3, 8.4]) for (const depth of [2.3, 5.7]) bar([terminalX, height, depth], [frameOuter, height, depth], fore, palette.silver);
                            for (const height of [5.3, 8.4]) bar([frameOuter, height, 2.3], [frameOuter, height, 5.7], endPost, palette.silver);
                            for (const depth of [2.3, 5.7]) bar([frameOuter, 5.3, depth], [frameOuter, 8.4, depth], endPost, palette.silver);
                            // Top and bottom braces continue the IEA's zigzag and break at the beta-gimbal crossmembers;
                            // the end frame takes a single diagonal.
                            for (const height of [5.3, 8.4]) {
                                bar([terminalX, height, 5.7], [rootX, height, 2.3], brace, palette.silver);
                                bar([rootX, height, 2.3], [frameOuter, height, 5.7], brace, palette.silver);
                            }
                            bar([frameOuter, 5.3, 2.3], [frameOuter, 8.4, 5.7], brace, palette.silver);
                            // Corner node blocks where the box chords meet the end frame.
                            for (const height of [5.3, 8.4]) for (const depth of [2.3, 5.7]) kit.box([frameOuter, height, depth], [.2, endPost[1] + .04, fore[0] + .04], palette.silver, [0, 0, 0], false);
                        }
                        for (const direction of [-1, 1]) {
                            const axisY = solarWingY(direction), upper = direction > 0, outward = side * direction, face = 4 + direction * 1.7;
                            const chordY = upper ? 8.4 : 5.3, edgeY = upper ? 8.33 : 5.37, toward = upper ? 1 : -1;
                            const jointDepth = 4 + direction * .01, plateDepth = 4 - direction * .16;
                            // Posts and a mid-height bar frame the canister where it passes through its face, in its own half,
                            // in the frame and brace tubes of the segment around it.
                            const { frame: canisterPost, brace: canisterBar } = trussSections[segmentOf(rootX)];
                            for (const dx of [-.98, .98]) {
                                const x = rootX + dx;
                                const standing = latticeFrames.some(frame => Math.abs(frame - x) < .15 && !inSolarPocket(frame)) || (terminal && Math.abs(x - frameOuter) < .15);
                                if (!standing) bar([x, 5.3, face], [x, 8.4, face], canisterPost, palette.silver);
                            }
                            bar([rootX - .98, 6.8, face], [rootX + .98, 6.8, face], canisterBar, palette.silver);
                            // The BGA plate hangs on a short post from a crossmember on its own face; a lattice frame within reach lends its own.
                            const frame = latticeFrames.find(x => Math.abs(x - rootX) < .3), postX = frame ?? rootX;
                            if (frame === undefined) bar([postX, chordY, 2.3], [postX, chordY, 5.7], canisterPost, palette.silver);
                            bar([postX, chordY, plateDepth], [postX, axisY, plateDepth], canisterPost, palette.silver);
                            kit.box([rootX, axisY, plateDepth], [.95, .95, .10], palette.hull);
                            kit.cylinder([rootX, axisY, jointDepth], .40, .24, palette.silver);
                            ring(kit, [rootX, axisY, jointDepth + direction * .10], .405, 'z', palette.dark, .032);
                            kit.box([rootX + outward * .59, axisY, jointDepth - direction * .05], [.39, .47, .43], palette.white);
                            // An attached cable runs from the drive electronics to the same crossmember, clear of the barrel.
                            const cable = [[rootX + outward * .62, axisY + toward * .235, jointDepth - direction * .05], [rootX + outward * .62, edgeY, jointDepth - direction * .05], [postX, edgeY, jointDepth + direction * .3]];
                            for (let i = 1; i < cable.length; i++) kit.rod(cable[i - 1], cable[i], .033, palette.dark);
                        }
                        // IEA plates after the reference: an upper band with paired triangular openings and small square ports
                        // over the frame, and a lower band of battery ORUs. The same cut plate forms the roof.
                        const web = new THREE.Shape();
                        web.moveTo(-2.55, -1.42); web.lineTo(2.55, -1.42);
                        web.lineTo(2.55, 1.42); web.lineTo(-2.55, 1.42); web.closePath();
                        const cutout = points => {
                            const hole = new THREE.Path(); hole.moveTo(...points[0]);
                            for (const point of points.slice(1)) hole.lineTo(...point);
                            hole.closePath(); web.holes.push(hole);
                        };
                        for (const edge of [-1, 1]) {
                            cutout([[edge * 2.32, .82], [edge * 1.36, 1.20], [edge * 2.32, 1.20]]);
                            cutout([[edge * 1.95, .02], [edge * 1.02, .02], [edge * 1.95, .52]]);
                            cutout([[edge * .94, .86], [edge * .49, .86], [edge * .49, 1.20], [edge * .94, 1.20]]);
                        }
                        const webGeometry = new THREE.ExtrudeGeometry(web, { depth: .07, bevelEnabled: false, steps: 1 });
                        const bronze = material(0x9a7448, .42, .6), cap = new THREE.SphereGeometry(.17, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
                        for (const face of [-1, 1]) {
                            const depth = 4 + face * 1.76;
                            kit.add(webGeometry, material(palette.hull), [equipmentX, 6.85, depth - .035], [1, 1, 1], [0, 0, 0], false);
                            // Perimeter channels, and a rail between the plate band and the battery band.
                            for (const dx of [-2.56, 2.56]) kit.box([equipmentX + dx, 6.85, depth], [.10, 2.93, .18], palette.silver);
                            for (const dy of [-1.45, 1.45]) kit.box([equipmentX, 6.85 + dy, depth], [5.20, .10, .18], palette.silver);
                            kit.box([equipmentX, 6.76, depth + face * .02], [5.1, .07, .16], palette.silver, [0, 0, 0], false);
                            for (const dx of [-2.32, -1.15, 1.15, 2.32]) trussFastener([equipmentX + dx, 7.41, depth + face * .082], .028, .035);
                            // Battery ORUs: four columns in two rows, each with a dark handle.
                            for (const column of [-1.8, -.6, .6, 1.8]) for (const y of [6.42, 5.8]) {
                                kit.box([equipmentX + column, y, depth + face * .1], [1.12, .56, .14], 0x959ca0);
                                kit.box([equipmentX + column, y + .13, depth + face * .175], [.5, .06, .03], palette.dark, [0, 0, 0], false);
                            }
                            // An EVA tether fitting: a stand-off bar with two loops on the plate band.
                            const fitX = equipmentX - side * .3;
                            kit.rod([fitX, 7.2, depth + face * .14], [fitX, 8.15, depth + face * .14], .03, palette.silver);
                            for (const y of [7.2, 8.15]) kit.rod([fitX, y, depth + face * .035], [fitX, y, depth + face * .14], .025, palette.silver);
                            for (const y of [7.5, 7.85]) ring(kit, [fitX, y, depth + face * .14], .09, 'z', palette.silver, .02);
                            // A bronze grapple fixture on a grey housing at the outboard upper corner.
                            const cornerX = equipmentX + side * 2.2;
                            kit.box([cornerX, 7.95, depth + face * .16], [.4, .6, .22], palette.silver);
                            kit.add(cap, bronze, [cornerX, 8.25, depth + face * .16], [1, 1, 1], [0, 0, 0], false);
                            kit.cylinder([cornerX, 8.46, depth + face * .16], .015, .12, palette.silver, [0, 0, 0]);
                        }
                        // The roof rests on the top lattice. Its underside (8.485) clears every chord, frame and brace beneath it, the
                        // tallest being the S6/P6 end posts at 8.479, so no member shares or pierces one of its faces.
                        const roofTop = 8.555;
                        kit.add(webGeometry, material(palette.white), [equipmentX, roofTop, 4], [1, 1.10, 1], [Math.PI / 2, 0, 0], false);
                        if (!terminal) {
                            // The canister cage after the reference: two bronze grapple fixtures on top and a keel plate carrying
                            // two more below. Its top and bottom bracing is the lattice's own V through the beta-gimbal crossmember.
                            // Fixture bases and the keel plate sit on the forward box chords' outer faces.
                            const chordRise = trussSections.S4.fore[1] / 2;
                            for (const x of [side * 32.35, side * 33.45]) {
                                kit.box([x, 8.45 + chordRise, 2.3], [.34, .1, .42], palette.silver);
                                kit.add(cap, bronze, [x, 8.5 + chordRise, 2.3], [1, 1, 1], [0, 0, 0], false);
                                kit.cylinder([x, 8.7 + chordRise, 2.3], .015, .12, palette.silver, [0, 0, 0]);
                                kit.box([x, 5.25 - chordRise, 2.3], [.34, .1, .42], palette.silver);
                                kit.add(cap, bronze, [x, 5.2 - chordRise, 2.3], [1, 1, 1], [Math.PI, 0, 0], false);
                                kit.cylinder([x, 5.0 - chordRise, 2.3], .015, .12, palette.silver, [0, 0, 0]);
                            }
                            kit.box([side * 32.9, 5.275 - chordRise, 2.3], [1.35, .05, .3], palette.silver, [0, 0, 0], false);
                            // S5/P5 spacer after the reference: a darker plate on the lower half of the forward face, a pale
                            // plate across the aft face, a bronze grapple fixture on a braced post and two blanketed boxes
                            // at its outboard end.
                            const spacerMid = side * 35.475, postX = side * 35.75;
                            kit.box([spacerMid, 6.05, 2.06], [3.28, 1.45, .05], 0x9aa1a4);
                            kit.box([spacerMid, 6.85, 5.94], [3.28, 2.95, .05], 0xc3c7c5);
                            kit.rod([postX, 6.8, 2.0], [postX, 7.72, 2.0], .05, palette.silver);
                            kit.box([postX, 7.72, 2.0], [.3, .08, .3], palette.silver, [0, 0, 0], false);
                            kit.add(cap, bronze, [postX, 7.76, 2.0], [1, 1, 1], [0, 0, 0], false);
                            kit.cylinder([postX, 7.97, 2.0], .015, .12, palette.silver, [0, 0, 0]);
                            kit.rod([side * 34.05, 8.3, 2.0], [postX, 6.95, 2.0], .045, palette.silver);
                            for (const x of [side * 36.15, side * 36.95]) {
                                kit.box([x, 5.42, 1.72], [.75, .85, .65], palette.white);
                                kit.box([x, 5.86, 1.72], [.66, .03, .56], palette.hull, [0, 0, 0], false);
                            }
                            // Two utility runs cross the forward face from the rotary joint to the spacer, stepping around
                            // the canister barrel, on stand-off brackets.
                            for (const [y, runs] of [[6.72, [[23.9, 31.25], [32.9, 40.0]]], [5.42, [[23.9, 39.9]]]]) {
                                for (const [a, b] of runs) {
                                    kit.rod([side * a, y, 2.0], [side * b, y, 2.0], .045, palette.silver);
                                    for (let x = a + .4; x < b; x += 2.5) kit.box([side * x, y, 2.1], [.1, .1, .2], palette.silver, [0, 0, 0], false);
                                }
                            }
                        }
                        // Three twin-faced ORU trays occupy the lower equipment deck.
                        // Dark faceplates are equipment, not extra photovoltaic wings.
                        for (let tray = 0; tray < 3; tray++) {
                            const trayX = equipmentX + (tray - 1) * 1.65;
                            kit.box([trayX, 5.11, 4], [1.54, .57, 3.25], palette.silver);
                            for (const half of [-1, 1]) {
                                const z = 4 + half * .82;
                                kit.box([trayX, 4.80, z], [1.38, .055, 1.43], 0x515963, [0, 0, 0], false);
                                for (const dx of [-.64, .64]) {
                                    kit.box([trayX + dx, 4.76, z], [.045, .065, 1.38], palette.rail, [0, 0, 0], false);
                                    for (const dz of [-.59, .59]) trussFastener([trayX + dx, 4.728, z + dz], .028, .025, [0, 0, 0]);
                                }
                                for (const rib of [-.45, -.15, .15, .45]) kit.box([trayX + rib, 4.765, z], [.014, .012, 1.32], 0x78818a, [0, 0, 0], false);
                            }
                            kit.box([trayX, 4.76, 4], [.30, .16, .19], palette.dark);
                            for (const depth of [2.34, 5.66]) kit.box([trayX, 5.09, depth], [1.38, .43, .035], 0x515963, [0, 0, 0], false);
                        }
                        // Small service fixture on the deck: low base, folded arms,
                        // cabling and handholds, all seated on the IEA roof.
                        const serviceX = equipmentX - side * .15, baseTop = roofTop + .16;
                        kit.box([serviceX, roofTop + .08, 4], [.54, .16, .80], palette.silver);
                        for (const dx of [-.20, .20]) {
                            kit.rod([serviceX + dx, baseTop, 3.67], [serviceX + dx, baseTop + .40, 4.04], .045, palette.rail);
                            kit.rod([serviceX + dx, baseTop + .40, 4.04], [serviceX + dx, baseTop + .06, 4.29], .035, palette.silver);
                        }
                        kit.rod([serviceX - .20, baseTop + .40, 4.04], [serviceX + .20, baseTop + .40, 4.04], .05, palette.silver);
                        for (const edge of [-1, 1]) {
                            const x = equipmentX + edge * 2.23;
                            kit.rod([x - .25, roofTop + .10, 3.0], [x + .25, roofTop + .10, 3.0], .028, palette.gold);
                            for (const dx of [-.25, .25]) kit.rod([x + dx, roofTop - .05, 3.0], [x + dx, roofTop + .10, 3.0], .028, palette.gold);
                        }
                        const foldX = equipmentX + side * .5, foldZ = 5.8;
                        kit.rod([foldX, 5.4, 4], [foldX, 5.4, foldZ], .12, palette.silver);
                        let upperHeight = 5.5, upperDepth = foldZ;
                        for (let fold = 0; fold < 7; fold++) {
                            const verticalStep = 1.77, depthStep = .267;
                            const lowerHeight = upperHeight - verticalStep, lowerDepth = upperDepth + (fold % 2 === 0 ? depthStep : -depthStep);
                            const pitch = Math.atan2(lowerDepth - upperDepth, verticalStep);
                            kit.box([foldX, (upperHeight + lowerHeight) / 2, (upperDepth + lowerDepth) / 2], [3.12, 1.79, .085], palette.white, [-pitch, 0, 0]);
                            kit.rod([foldX - 1.56, upperHeight, upperDepth], [foldX + 1.56, upperHeight, upperDepth], .045, palette.silver);
                            for (const rib of [-1.2, -.8, -.4, 0, .4, .8, 1.2]) kit.line([[foldX + rib, upperHeight - .05, upperDepth + .055], [foldX + rib, lowerHeight + .05, lowerDepth + .055]]);
                            for (const edge of [-1, 1]) kit.rod([foldX + edge * 1.6, upperHeight, upperDepth + .10], [foldX + edge * 1.6, lowerHeight, lowerDepth + .10], .033, palette.silver);
                            upperHeight = lowerHeight; upperDepth = lowerDepth;
                        }
                        kit.rod([foldX - 1.56, upperHeight, upperDepth], [foldX + 1.56, upperHeight, upperDepth], .045, palette.silver);
                    }
                }
                // The mobile-transporter rails run along the forward face, inside S1/P1's narrow band, from P3 to S3 inboard of
                // the rotary joints; short standoffs tie them to the face, in front of its covers and fasteners.
                const railZ = forwardZ - .32;
                for (const height of [6.45, 7.25]) {
                    kit.box([0, height, railZ], [42, .15, .15], palette.silver, [0, 0, 0], false);
                    for (let across = -20.25; across <= 20.25; across += 2.7) kit.box([across, height, (railZ + forwardZ) / 2], [.21, .21, forwardZ - railZ], palette.hull, [0, 0, 0], false);
                }
                // S0: source node 80 has five unequal bays and a six-sided core.
                // Source Z is reversed into station Z: its long narrow face faces
                // Harmony, and its shorter aft band projects from the knee plane.
                // The existing Destiny bipods/tripods own the descending legs.
                const s0Frames = [-7, -4.25, -1.72, 1.72, 4.25, 7];
                const s0At = x => {
                    const p = profile(x);
                    return {ft:[x,narrowTop,forwardZ],fb:[x,narrowBottom,forwardZ],
                        kt:[x,8.4,narrowAftZ],kb:[x,5.3,narrowAftZ],
                        at:[x,p.aftTop,p.aftZ],ab:[x,p.aftBottom,p.aftZ]};
                };
                // Source node 80's members are closed box tubes (trussSections.S0): 0.152 chords, deeper 0.152 x 0.210 on the
                // knee plane, 0.116 frames and 0.132 braces, 0.107 across the aft face.
                const s0 = trussSections.S0, s0Member = (a, b, size) => bar(a, b, size, palette.silver);
                const s0Facet = (corners,tone,outward,inset=.085) => {
                    const normal=new THREE.Vector3(...outward).normalize();
                    const pts=corners.map(p=>new THREE.Vector3(...p).addScaledVector(normal,-inset));
                    const n=new THREE.Vector3().crossVectors(pts[1].clone().sub(pts[0]),pts[2].clone().sub(pts[0]));
                    if(n.dot(normal)<0)pts.reverse();
                    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts.flatMap(p=>p.toArray()),3));
                    g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();
                    kit.add(g,tone,[0,0,0],[1,1,1],[0,0,0],false);
                };
                // The actual reference stations are approximately ±6.75, ±4.225,
                // ±1.710 m. Their adapted positions keep all existing end seats.
                for(const x of s0Frames){
                    const c=s0At(x),central=Math.abs(x)<6.99;latticeFrames.push(x);
                    // End frames stay open on the knee plane, where the broad web below closes them without a doubled flange.
                    const outline=central?['fb','ft','kt','at','ab','kb']:['kt','ft','fb','kb'];
                    for(let i=0;i<(central?outline.length:outline.length-1);i++)s0Member(c[outline[i]],c[outline[(i+1)%outline.length]],s0.frame);
                    // The source's folded middle web is broader than its flanges.
                    s0Member(c.kb,c.kt,s0.web);
                    if(central){
                        for(const y of [5.3,8.4]){
                            kit.box([x,y,4],[.20,.31,.40],palette.silver,[0,0,0],false);
                            for(const dz of [-.13,.13])trussFastener([x,y+(y>6.85?.17:-.17),4+dz],.025,.035,[0,0,0],palette.dark);
                        }
                        for(const key of ['ft','fb','at','ab']){
                            const p=c[key];kit.box(p,[.21,.21,.18],palette.silver,[0,0,0],false);
                            trussFastener([p[0],p[1],p[2]+(key[0]==='f'?-.105:.105)],.025,.035,[Math.PI/2,0,0],palette.dark);
                        }
                    }
                }
                for(let bay=0;bay<s0Frames.length-1;bay++){
                    const x0=s0Frames[bay],x1=s0Frames[bay+1],a=s0At(x0),b=s0At(x1),endBay=bay===0||bay===4;
                    // Six bent longerons follow the reference perimeter. At the
                    // ends the aft pair converges on the full-height S1 knee.
                    for(const key of ['ft','fb','kt','kb','at','ab'])s0Member(a[key],b[key],key[0]==='k'?s0.knee:key[0]==='f'?s0.fore:s0.aft);
                    // Both sloping forward faces have opposed diagonals in the
                    // broad central bay; successive smaller bays alternate.
                    const inward=bay===0||bay===3;
                    for(const [f,k]of [['ft','kt'],['fb','kb']]){
                        s0Member(inward?a[f]:a[k],inward?b[k]:b[f],s0.brace);
                        if(bay===2)s0Member(a[f],b[k],s0.brace);
                    }
                    if(endBay){
                        // A fork, not a vertical box wall, fills each aft chamfer.
                        const inner=bay===0?b:a,outer=bay===0?a:b,mid=[outer.kt[0],6.85,4];
                        s0Member(inner.at,mid,s0.brace);s0Member(inner.ab,mid,s0.brace);
                        s0Facet([a.kt,b.kt,b.at,a.at],payloadBlanket,[0,1,1]);
                        s0Facet([a.kb,a.ab,b.ab,b.kb],payloadBlanket,[0,-1,1]);
                        s0Facet([a.at,b.at,b.ab,a.ab],payloadBlanket,[Math.sign((x0+x1)/2),0,1]);
                    }else{
                        // The aft slopes carry one brace per bay; in the central bay the source runs it down the upper
                        // slope and up the lower one (only the forward slopes are crossed there).
                        for(const [k,r]of [['kt','at'],['kb','ab']]){
                            if(bay===2)k==='kt'?s0Member(a.kt,b.at,s0.brace):s0Member(a.ab,b.kb,s0.brace);
                            else s0Member(inward?a[r]:a[k],inward?b[k]:b[r],s0.brace);
                        }
                        s0Member(bay===2?a.at:a.ab,bay===2?b.ab:b.at,s0.aftBrace);
                        s0Facet([a.kt,b.kt,b.at,a.at],payloadBlanket,[0,1,.4]);
                        s0Facet([a.kb,a.ab,b.ab,b.kb],payloadBlanket,[0,-1,.4]);
                        s0Facet([a.at,b.at,b.ab,a.ab],payloadBlanket,[0,0,1]);
                    }
                    s0Facet([a.ft,b.ft,b.kt,a.kt],payloadBlanket,[0,1,-.547]);
                    s0Facet([a.fb,a.kb,b.kb,b.fb],payloadBlanket,[0,-1,-.547]);
                    s0Facet([a.fb,b.fb,b.ft,a.ft],payloadBlanket,[0,0,-1]);
                    if(bay===2)s0Member(a.fb,b.ft,s0.brace);
                    // Narrow seams are recessed into the blankets, leaving the
                    // tube silhouette and unequal station spacing legible.
                    for(const key of ['ft','fb','at','ab']){
                        const p=new THREE.Vector3(...a[key]).lerp(new THREE.Vector3(...b[key]),.5);
                        trussFastener([p.x,p.y,p.z+(key[0]==='f'?-.078:.078)],.024,.03,[Math.PI/2,0,0]);
                    }
                }
                // Retained Destiny forward strut seats sit below the narrowed
                // S0 face. Short root cheeks tie each shoe into both the face
                // band and the full-height central web, without moving a leg.
                // No cheek runs up the underside itself: at ±4.25 the frame
                // already has that member, and at ±2.55 it would cross the brace.
                const s0Seats=[];
                for(const side of [-1,1])for(const absX of [2.55,4.25]){
                    const x=side*absX,seat=[x,5.3,2.3],face=[x,narrowBottom,2.3],knee=[x,5.3,4.0];
                    s0Member(seat,face,.12);if(absX<4)s0Member(seat,knee,.105);
                    kit.box([x,5.44,2.3],[.26,.28,.25],palette.silver,[0,0,0],false);
                    for(const dx of [-.09,.09])trussFastener([x+dx,5.48,2.45],.027,.04,[Math.PI/2,0,0],palette.dark);
                    // Aft shoes already meet the retained short aft chord.
                    s0Seats.push(seat,[x,5.95,5.7]);
                }
                const frontPitch=Math.atan2(8.4-narrowTop,narrowAftZ-forwardZ),aftPitch=Math.atan2(8.4-s0AftTop,fullAftZ-narrowAftZ);
                const upperAt=z=>z<=4?narrowTop+(z-forwardZ)*Math.tan(frontPitch):8.4-(z-4)*Math.tan(aftPitch);
                const lowerAt=z=>z<=4?narrowBottom-(z-forwardZ)*Math.tan(frontPitch):5.3+(z-4)*(s0AftBottom-5.3)/(fullAftZ-4);
                // Four sloped ORUs are present in primitive 0: the upper pair
                // at source X±1.273 and the lower pair at X±2.132.
                for(const side of [-1,1])for(const upper of [true,false]){
                    const x=side*(upper?1.29:2.145),z=2.96,sign=upper?1:-1,pitch=upper?-frontPitch:frontPitch;
                    const normal=new THREE.Vector3(0,sign*Math.cos(frontPitch),-Math.sin(frontPitch));
                    const center=new THREE.Vector3(x,upper?upperAt(z):lowerAt(z),z).addScaledVector(normal,.20);
                    kit.box(center.toArray(),[.80,.30,.92],palette.white,[pitch,0,0]);
                    const lid=center.clone().addScaledVector(normal,.16);kit.box(lid.toArray(),[.75,.025,.84],palette.hull,[pitch,0,0],false);
                    for(const dx of [-.29,.29])for(const dz of [-.30,.30]){
                        const local=new THREE.Vector3(dx,0,dz).applyAxisAngle(new THREE.Vector3(1,0,0),pitch).add(lid).addScaledVector(normal,.025);
                        trussFastener(local.toArray(),.024,.025,[pitch,0,0],palette.dark);
                    }
                    const handle=lid.clone().addScaledVector(normal,.065);kit.rod(handle.clone().add(new THREE.Vector3(-.15,0,0)).toArray(),handle.clone().add(new THREE.Vector3(.15,0,0)).toArray(),.020,palette.gold);
                }
                // Four forward utility housings sit between the preserved
                // mobile-transporter rails, rather than hiding the whole face.
                for(const side of [-1,1])for(const x0 of [1.39,2.10]){
                    const x=side*x0;kit.box([x,6.85,2.15],[.56,.43,.28],palette.hull);
                    kit.box([x,6.85,1.997],[.48,.35,.025],palette.white,[0,0,0],false);
                    kit.box([x,6.85,1.979],[.18,.11,.018],palette.dark,[0,0,0],false);
                }
                // Source cable-tray runs follow both pitched deck faces. Their
                // saddles are seated on the new deck rather than the old level.
                for(const [x0,x1,z]of [[-6.35,-1.70,3.12],[-6.35,-1.70,3.70],[-.15,6.25,4.78]]){
                    const pitch=z<4?-frontPitch:aftPitch,normal=new THREE.Vector3(0,Math.cos(pitch),Math.sin(pitch));
                    const center=new THREE.Vector3((x0+x1)/2,upperAt(z),z).addScaledVector(normal,.18);
                    kit.box(center.toArray(),[x1-x0,.17,.24],palette.white,[pitch,0,0]);
                    for(let x=x0+.22;x<x1-.1;x+=1.45){const p=new THREE.Vector3(x,upperAt(z),z).addScaledVector(normal,.08);kit.box(p.toArray(),[.10,.18,.32],palette.silver,[pitch,0,0],false);}
                }
                // Two dorsal and two ventral handling fixtures coincide with
                // the full-height crossframes, as in source primitive 2.
                const s0Cap=new THREE.SphereGeometry(.15,16,8,0,Math.PI*2,0,Math.PI/2),s0Bronze=material(0x9a7448,.42,.6);
                for(const x of [-4.25,4.25])for(const sign of [-1,1]){
                    const y=sign>0?8.4:5.3;
                    kit.box([x,y+sign*.10,4],[.46,.16,.37],palette.silver,[0,0,0],false);
                    kit.add(s0Cap,s0Bronze,[x,y+sign*.18,4],[1,1,1],[sign>0?0:Math.PI,0,0],false);
                    kit.cylinder([x,y+sign*.40,4],.025,.20,palette.silver,[0,0,0]);
                }
                // Retain an S0 marking, now aligned with the front pitched deck.
                const s0Label=new THREE.Group(),labelKit=new Kit();badge(labelKit,'S0',[0,0,0],[1.05,.34]);labelKit.finish(s0Label);
                s0Label.position.set(.15,upperAt(3.30)+.065,3.30);s0Label.rotation.x=-frontPitch;group.add(s0Label);
                group.userData.s0Reference={sourceNode:80,sourceName:'14 S0 Truss',sourceFrameX:[-6.750168,-4.224925,-1.690249,1.709626,4.224925,6.746863],adaptedFrameX:s0Frames,
                    forwardFace:[narrowBottom,narrowTop],kneeFace:[5.3,8.4],aftFace:[s0AftBottom,s0AftTop],existingDestinySeats:s0Seats,
                    descendingLegsOwnedBy:'destiny',sourceAxes:'native X and Z reversed; bounded adaptation retains S1 and Destiny anchors',upperORUs:2,lowerORUs:2};
            });
            part('power', 'Photovoltaic wings', '02 / ELECTRICAL POWER', 'Eight original solar-array wings unfold into sixteen dark photovoltaic blankets around deployable lattice masts. Rotary joints orient the cell faces toward sunlight. The two wings of each module sit one above the other; their mast canisters enter one beta-gimbal frame from opposite faces.', [['Original wings', '8 / 16 blankets'], ['Array span', '~73 m']], [48, 7, -17], (kit, group) => {
                group.userData.mastCanisters = 8;
                group.userData.photovoltaicModules = 4;
                group.userData.wingStagger = { axis: 'vertical', offset: solarWingStagger, upper: 'aft wing' };
                for (const across of solarStations) for (const direction of [-1, 1]) {
                    const wing = new THREE.Group(), wingKit = new Kit(); wing.position.set(solarRootX(across), solarWingY(direction), 4 + direction * 2.35);
                    const channel = powerChannels[across][direction < 0 ? 0 : 1];
                    wing.name = (across < 0 ? 'Port' : 'Starboard') + ' photovoltaic wing / ' + channel;
                    wing.userData.channel = channel;
                    // Blankets drawn 5% longer than the measured 32.6 m; the mast and the tip fittings are placed from the blanket
                    // end, so they ride out with it.
                    const blanketStart = 1.35, blanketLength = 32.6 * 1.05, blanketEnd = blanketStart + blanketLength, blanketMiddle = blanketStart + blanketLength / 2;
                    const blanketWidth = 5.8, previousGap = .92, blanketGap = previousGap * 2;
                    const blanketOffset = (blanketWidth + blanketGap) / 2;
                    const spreaderWidth = 2 * blanketWidth + blanketGap + .22;
                    wing.userData.blanketGap = blanketGap;
                    wing.userData.centralCableCount = 4;
                    for (const side of [-1, 1]) {
                        const blanketX = side * blanketOffset;
                        panel(wingKit, [blanketX, 0, direction * blanketMiddle], blanketWidth, blanketLength);
                        // Thin fold battens sit on the flexible blanket, following the
                        // existing texture divisions instead of forming a rigid grid.
                        for (let fold = 1; fold < 32; fold++) {
                            const depth = direction * (blanketStart + blanketLength * fold / 32);
                            for (const face of [-1, 1]) wingKit.box([blanketX, face * .038, depth], [5.72, .012, .029], 0x9b8768, [0, 0, 0], false);
                        }
                        // Reinforced edge hems remain thin and clear of the mast bay.
                        for (const edge of [-1, 1]) {
                            const x = blanketX + edge * 2.885;
                            wingKit.box([x, .034, direction * blanketMiddle], [.035, .009, blanketLength - .08], palette.foil, [0, 0, 0], false);
                        }
                    }
                    // Four continuous longitudinal members are the four lines in the
                    // reference gap. Remove duplicate inner wires and simplify the
                    // distant bracing to the four lines requested in the reference.
                    // The short root cage retains the visible square-truss structure.
                    // NASA: https://ntrs.nasa.gov/citations/20120008397
                    const mastCorners = [[-.36, -.32], [.36, -.32], [.36, .08], [-.36, .08]];
                    for (const [x, y] of mastCorners) {
                        wingKit.rod([x, y, direction * .85], [x, y, direction * (blanketEnd - .01)], .018, palette.silver);
                    }
                    for (const side of [-1, 1]) {
                        const blanketX = side * blanketOffset;
                        // The blanket storage box has a shallow lid, separate end caps
                        // and transverse hinge barrels, rather than a plain white block.
                        wingKit.box([blanketX, -.22, direction * 1.2], [5.95, .58, .68], palette.white);
                        wingKit.box([blanketX, .09, direction * 1.2], [5.66, .05, .5], palette.foil);
                        for (const end of [-1, 1]) {
                            wingKit.box([blanketX + end * 2.98, -.22, direction * 1.2], [.075, .59, .72], palette.silver, [0, 0, 0], false);
                            wingKit.box([blanketX + end * 2.77, -.12, direction * 1.54], [.24, .27, .13], palette.white);
                        }
                        for (const offset of [-2.4, -1.2, 0, 1.2, 2.4]) {
                            wingKit.box([blanketX + offset, -.23, direction * .84], [.12, .32, .08], palette.dark, [0, 0, 0], false);
                            wingKit.cylinder([blanketX + offset, .082, direction * 1.48], .071, .29, palette.silver, [0, 0, Math.PI / 2]);
                            wingKit.box([blanketX + offset, -.23, direction * 1.551], [.16, .16, .030], palette.hull, [0, 0, 0], false);
                        }
                        // Outer tension lines follow the widened blanket perimeter.
                        const x = side * (blanketOffset + blanketWidth / 2 + .12), y = -.095;
                        wingKit.rod([x, y, direction * 1.47], [x, y, direction * (blanketEnd - .15)], .011, palette.foil);
                        for (const depth of [1.47, blanketEnd - .15]) {
                            wingKit.box([x, -.031, direction * depth], [.12, .15, .16], palette.silver, [0, 0, 0], false);
                            wingKit.cylinder([x, y, direction * (depth < 2 ? 1.66 : blanketEnd - .34)], .027, .23, palette.silver);
                        }
                        wingKit.rod([x, -.031, direction * (blanketEnd - .15)], [x, -.031, direction * (blanketEnd + .085)], .038, palette.silver);
                    }
                    // A full-width tip channel terminates in the reference's faceted
                    // central housing and swept clevis cheeks, with four cable sockets.
                    wingKit.box([0, 0, direction * (blanketEnd + .18)], [spreaderWidth, .27, .041], palette.silver, [0, 0, 0], false);
                    for (const height of [-.14, .14]) wingKit.box([0, height, direction * (blanketEnd + .085)], [spreaderWidth, .035, .28], palette.white, [0, 0, 0], false);
                    const tipShape = new THREE.Shape();
                    tipShape.moveTo(-.53, -.23); tipShape.lineTo(-.35, -.43);
                    tipShape.lineTo(.35, -.43); tipShape.lineTo(.53, -.23);
                    tipShape.lineTo(.53, .23); tipShape.lineTo(.35, .43);
                    tipShape.lineTo(-.35, .43); tipShape.lineTo(-.53, .23); tipShape.closePath();
                    const tipCase = new THREE.ExtrudeGeometry(tipShape, { depth: .43, bevelEnabled: true, bevelSize: .055, bevelThickness: .055, bevelSegments: 1, steps: 1 });
                    wingKit.add(tipCase, material(palette.white), [0, -.01, direction * (blanketEnd + .03)], [1, 1, 1], [0, direction < 0 ? Math.PI : 0, 0]);
                    const tipFace = new THREE.ShapeGeometry(tipShape);
                    wingKit.add(tipFace, material(palette.silver), [0, -.01, direction * (blanketEnd + .526)], [.83, .83, 1], [0, direction < 0 ? Math.PI : 0, 0], false);
                    for (const side of [-1, 1]) {
                        wingKit.box([side * spreaderWidth / 2, 0, direction * (blanketEnd + .085)], [.040, .29, .28], palette.silver, [0, 0, 0], false);
                    }
                    for (const [x, y] of mastCorners) {
                        wingKit.box([x, y, direction * (blanketEnd - .04)], [.10, .10, .21], palette.silver);
                        wingKit.cylinder([x, y, direction * (blanketEnd - .09)], .046, .30, palette.silver);
                    }
                    wingKit.cylinder([0, .09, direction * (blanketEnd + .105)], .084, 1.35, palette.silver, [0, 0, Math.PI / 2]);
                    // One axial mast canister per wing runs from the blanket boxes into the module's beta-gimbal frame, where its
                    // BGA sits near mid-depth above or below the partner canister (reference image).
                    // The opposed pairs and support relationships follow NASA's
                    // STS-115 description; cover seams / dimensions follow the image.
                    wing.userData.mastCanister = { axis: 'z', length: 3.12, diameter: 1.18 };
                    wingKit.cylinder([0, 0, direction * -.59], .59, 3.12, palette.hull);
                    wingKit.cylinder([0, 0, direction * -2.075], .62, .15, palette.silver);
                    wingKit.cylinder([0, 0, direction * -2.18], .405, .08, palette.silver);
                    ring(wingKit, [0, 0, direction * -2.14], .57, 'z', palette.dark, .030);
                    wingKit.cylinder([0, 0, direction * .96], .59, .14, palette.white);
                    for (const depth of [-1.90, -.60, .70, .965]) ring(wingKit, [0, 0, direction * depth], .597, 'z', depth === .965 ? palette.dark : palette.silver, .026);
                    // Subtle longitudinal seams remain on the barrel surface.
                    for (const angle of [Math.PI * .22, Math.PI * .78, Math.PI * 1.22, Math.PI * 1.78]) {
                        const x = Math.cos(angle) * .594, y = Math.sin(angle) * .594;
                        wingKit.rod([x, y, direction * -1.89], [x, y, direction * .69], .012, palette.silver);
                    }
                    for (let bolt = 0; bolt < 8; bolt++) {
                        const angle = bolt * Math.PI / 4;
                        wingKit.cylinder([Math.cos(angle) * .51, Math.sin(angle) * .51, direction * 1.039], .024, .026, palette.rail);
                    }
                    for (const side of [-1, 1]) {
                        wingKit.box([side * .29, 0, direction * 1.135], [.12, .56, .27], palette.white);
                        wingKit.rod([side * .31, -.24, direction * 1.06], [side * .47, -.22, direction * 1.40], .06, palette.silver);
                        // Swept shoulders seat the blanket storage beam on the cap.
                        wingKit.rod([side * .48, -.10, direction * .94], [side * .70, -.15, direction * 1.16], .075, palette.silver);
                        wingKit.rod([side * .70, -.15, direction * 1.16], [side * 1.0, -.15, direction * 1.20], .075, palette.silver);
                        wingKit.box([side * .95, -.15, direction * 1.20], [.20, .30, .39], palette.white);
                    }
                    // Low drive/electrical enclosure stays attached to the inboard end.
                    wingKit.box([.67, -.27, direction * -1.72], [.29, .41, .57], palette.white);
                    wingKit.box([.827, -.27, direction * -1.72], [.026, .29, .43], palette.silver, [0, 0, 0], false);
                    wingKit.rod([.53, -.21, direction * -1.71], [.68, -.21, direction * -1.71], .065, palette.silver);
                    wingKit.box([0, -.025, direction * 1.2], [spreaderWidth - .08, .21, .32], palette.white);
                    wingKit.finish(wing); group.add(wing); wings.push({ group: wing, direction, across, channel, base: 0 });
                }
            });
            part('irosa', 'Roll-out solar arrays', '03 / POWER AUGMENTATION', 'Six iROSA blankets augment channels 2B, 4B, 4A, 1A, 3A and 1B in this June 2023 configuration. Each flexible cell blanket stretches between two composite booms, mounted above an original wing on a triangular support kit.', [['Installed by June 2023', '6 arrays'], ['Blanket dimensions', '18.2 × 6 m']], [32, 10, -10], (kit, group) => {
                for (const wing of wings.filter(item => augmentedChannels.has(item.channel))) {
                    const { direction } = wing;
                    const local = new THREE.Group(), mount = new THREE.Group(), innerKit = new Kit(), mountKit = new Kit();
                    local.name = 'iROSA ' + wing.channel + ' / blanket and booms';
                    mount.name = 'iROSA ' + wing.channel + ' / connected modification kit';
                    local.position.set(0, 1.1, direction * 2.4);
                    local.rotation.x = -direction * Math.PI / 18;
                    local.updateMatrix();
                    // Derive every support head from the actual tilted deployment beam.
                    // NASA describes angled mod-kit beams bolted to the mast canister:
                    // https://www.nasa.gov/podcasts/houston-we-have-a-podcast/station-solar-arrays/
                    // Bracket and fastener dimensions here are illustrative.
                    const mountPoint = point => new THREE.Vector3(...point).applyMatrix4(local.matrix).toArray();
                    panel(innerKit, [0, 0, direction * 10.3], 6, 18.2, true);
                    // Thin rolled composite booms, transverse tip beam and deployment hub.
                    for (const side of [-1, 1]) {
                        innerKit.rod([side * 3.12, -.06, direction * 1.15], [side * 3.12, -.06, direction * 19.5], .065, palette.foil);
                        innerKit.cylinder([side * 3.12, -.05, direction * .95], .27, .38, palette.white, [0, 0, Math.PI / 2]);
                        innerKit.rod([side * 2.6, -.15, direction * .95], [side * 3.12, -.06, direction * 1.5], .065, palette.silver);
                        const head = mountPoint([side * 2.4, -.15, direction * .95]);
                        // A single strut per beam end: the kit reads as one V from the root saddle to both beam heads.
                        const feet = [[side * .48, .12, direction * .35]];
                        for (const foot of feet) {
                            mountKit.rod(foot, head, .08, palette.white);
                            mountKit.box(foot, [.24, .18, .24], palette.silver);
                            mountKit.cylinder(foot, .065, .30, palette.rail, [0, 0, Math.PI / 2]);
                        }
                        innerKit.box([side * 2.4, -.15, direction * .95], [.40, .39, .54], palette.silver);
                        for (const cheek of [-1, 1]) {
                            innerKit.box([side * 2.4 + cheek * .15, -.27, direction * .95], [.055, .32, .38], palette.white);
                        }
                        mountKit.cylinder(head, .09, .43, palette.rail, [0, 0, Math.PI / 2]);
                        // Cable jumper follows a support into the root connector housing.
                        if (side === 1) {
                            const route = [feet[0], [1.25, .35, direction * 1.65], [head[0], head[1] - .15, head[2]]];
                            for (let i = 1; i < route.length; i++) mountKit.rod(route[i - 1], route[i], .026, palette.dark);
                            innerKit.box([2.4, -.42, direction * .95], [.26, .18, .30], palette.dark);
                        }
                    }
                    // Root saddle joins the existing mast rails, with no free strut ends.
                    mountKit.box([0, 0, direction * .35], [1.16, .55, .30], palette.silver);
                    innerKit.box([0, -.06, direction * 19.48], [6.4, .15, .22], palette.white);
                    innerKit.box([0, -.15, direction * .95], [6.45, .36, .5], palette.white);
                    innerKit.box([.65, -.4, direction * .95], [.9, .35, .48], palette.dark);
                    innerKit.rod([.65, -.5, direction * .9], [.65, -.5, direction * 3], .035, palette.gold);
                    innerKit.finish(local);
                    mount.add(local); mountKit.finish(mount);
                    mount.position.copy(wing.group.position); mount.userData.channel = wing.channel;
                    wing.overlay = mount; group.add(mount);
                }
            });
            part('thermal', 'Thermal control radiators', '04 / HEAT REJECTION', 'Two external ammonia loops reject heat through six articulated radiator wings. Each wing has eight white-coated 3.4 × 2.7 m panels, with parallel flow channels, edge manifolds, articulated hinges and flexible connections. The channel detail and shallow folded pose follow the supplied visual reference.', [['Radiator wings / panels', '6 / 48'], ['Panel dimensions', '3.4 × 2.7 m']], [radiatorBankX, 8.3, radiatorBankZ + 12.9], (kit, group) => {
                group.userData.radiators = [];
                group.userData.radiatorBanks = [];
                // NASA ATCS overview, pp. 14–19: three eight-panel ORUs share one
                // radiator beam and TRRJ per loop. This is a vertical illustrative pose.
                // https://www.nasa.gov/wp-content/uploads/2021/02/473486main_iss_atcs_overview.pdf
                for (const side of [-1, 1]) {
                    const bank = new THREE.Group(), beamKit = new Kit();
                    bank.name = (side < 0 ? 'Port' : 'Starboard') + ' common radiator beam';
                    bank.position.set(side * radiatorBankX, 6.8, radiatorBankZ);
                    bank.userData.panelCount = 24;
                    bank.userData.rootBackshield = 'Three separate trays, folded side channels and paired tapered root webs';
                    bank.userData.rootReference = {file: 'ISS_stationary.glb', nodes: [53, 68], sourceWidth: 4.17826, sourceTrayWidth: 2.73082};
                    // Reconstruct node 53/68 profiles with the existing scene materials.
                    // GLB root: three closed trays, two folded side channels, six webs
                    // and a transverse saddle. The central tray has no circular cutout.
                    // Adapt only root depth/span to the unchanged first-panel seats.
                    const leafPitch = 3.72, rootYScale = .962, rootZScale = .77;
                    const rootY = y => (y - .00947) * rootYScale;
                    const rootZ = z => -.70 - z * rootZScale;
                    bank.userData.stripGap = +(leafPitch - 3.455).toFixed(3);
                    bank.userData.rootAdaptation = {spanScale: rootYScale, depthScale: rootZScale, rearSeatZ: -.70};
                    // Extrude a measured X/Z section along Y. All profiles remain
                    // editable code; no source textures or station mesh are embedded.
                    const rootSection = (profile, y0, y1, color) => {
                        const shape = new THREE.Shape();
                        profile.forEach(([x, z], index) => index ? shape.lineTo(x, rootZ(z)) : shape.moveTo(x, rootZ(z)));
                        shape.closePath();
                        const geometry = new THREE.ExtrudeGeometry(shape, {depth: rootY(y1) - rootY(y0), bevelEnabled: false});
                        geometry.rotateX(Math.PI / 2); geometry.translate(0, rootY(y1), 0);
                        beamKit.add(geometry, material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                    };
                    const rootTrays = [
                        {y0: -5.6525, y1: -1.9479, z0: -.46792, z1: -.53254},
                        {y0: -1.8572, y1: 1.8453, z0: -.52580, z1: -.52706},
                        {y0: 1.9710, y1: 5.6755, z0: -.53254, z1: -.46792}
                    ];
                    for (const tray of rootTrays) {
                        const y0 = rootY(tray.y0), y1 = rootY(tray.y1);
                        const z0 = rootZ(tray.z0), z1 = rootZ(tray.z1);
                        const tilt = Math.atan2(z1 - z0, y1 - y0), center = [0, (y0 + y1) / 2, (z0 + z1) / 2];
                        const height = Math.hypot(y1 - y0, z1 - z0), depth = .1576 * rootZScale;
                        beamKit.box(center, [2.73082, height, depth], palette.hull, [tilt, 0, 0], false);
                        const onTray = (x, y, z) => [x, center[1] + y * Math.cos(tilt) - z * Math.sin(tilt), center[2] + y * Math.sin(tilt) + z * Math.cos(tilt)];
                        // Fine ribs, centre tape and two shallow retaining clips follow
                        // the GLB facing detail, redrawn in this scene's pale finish.
                        for (const face of [-1, 1]) {
                            for (let rib = 0; rib < 24; rib++) {
                                beamKit.box(onTray(0, -height / 2 + .09 + rib * (height - .18) / 23, face * (depth / 2 + .002)), [2.68, .013, .006], 0xb6beb9, [tilt, 0, 0], false);
                            }
                            beamKit.box(onTray(0, 0, face * (depth / 2 + .004)), [.12, height - .04, .009], 0xc2c9c4, [tilt, 0, 0], false);
                            for (const y of [-.95, .95]) beamKit.box(onTray(0, y, face * (depth / 2 + .016)), [.22, .105, .034], palette.silver, [tilt, 0, 0], false);
                        }
                        for (const y of [-height / 2, height / 2]) beamKit.box(onTray(0, y, 0), [2.77, .044, depth + .025], palette.silver, [tilt, 0, 0], false);
                        // Narrow seat strips close the source's small web/tray gap after
                        // adapting the root to the existing panel seats.
                        for (const edge of [-1, 1]) beamKit.box(onTray(edge * .377, 0, depth / 2 + .018), [.105, height - .18, .070], palette.silver, [tilt, 0, 0], false);
                    }
                    // GLB rail section: broad outer lip, two inclined webs and a
                    // narrow bottom. Its folded depth replaces the old flat strips.
                    const channel = [[1.36538, -.45369], [1.92511, -.45369], [1.92511, -.51510], [1.68884, -.77633], [1.59160, -.77633], [1.36538, -.53489]];
                    for (const edge of [-1, 1]) {
                        rootSection(channel.map(([x, z]) => [edge * x, z]), -5.40619, 5.40945, palette.silver);
                        // Rectangular channel bays correspond to the repeated recesses
                        // visible on the source rails; the rims remain light aluminium.
                        for (let bay = 0; bay < 18; bay++) {
                            const y = rootY(-5.40619 + (bay + .5) * 10.81564 / 18);
                            beamKit.box([edge * 1.65, y, rootZ(-.45369) - .004], [.25, .445, .008], 0x8f9993, [0, 0, 0], false);
                            beamKit.box([edge * 1.65, y, rootZ(-.77633) + .005], [.088, .445, .010], palette.rail, [0, 0, 0], false);
                        }
                    }
                    // The supplied mesh uses a broad shallow saddle, not the former
                    // oversized round barrel. Its rear face seats on the four legs.
                    rootSection([[-2.08916, -.35035], [2.08910, -.35035], [2.08910, -.15120], [.42015, 0], [-.42021, 0], [-2.08916, -.15120]], -.420127, .420127, palette.silver);
                    // Two bearing pads join the saddle to the folded rails across the
                    // reference mesh's nominal gap; no floating cross-member remains.
                    for (const edge of [-1, 1]) beamKit.box([edge * 1.65, rootY(0), -.39], [.30, .70, .11], palette.silver, [0, 0, 0], false);
                    for (const upper of [false, true]) for (const dx of [-.49, .49]) {
                        const x = side * radiatorBankX + dx, y = upper ? 8.4 : 5.3;
                        kit.box([x, y, radiatorTrussSurfaceZ + .065], [.26, .24, .13], palette.silver);
                        kit.rod([x, y, radiatorTrussSurfaceZ + .14], [x, 6.8 + (upper ? .34 : -.34), radiatorBankZ - .67], .075, palette.silver);
                    }
                    // Small source-side fitting at X=1.99, Y=-1.91. This belongs to
                    // the common beam; it does not require six oversized valve boxes.
                    beamKit.box([1.95, rootY(-1.9086), -.305], [.26, .20, .10], palette.silver, [0, 0, 0], false);
                    beamKit.box([2.015, rootY(-1.9086), rootZ(-.6764)], [.11, .5476 * rootYScale, .4241 * rootZScale], palette.silver, [0, 0, 0], false);
                    beamKit.box([1.9861, rootY(-1.9086), rootZ(-.9105)], [.5865, .5948 * rootYScale, .1124 * rootZScale], palette.hull, [0, 0, 0], false);
                    const wheelCenter = [2.0035, rootY(-1.9086), rootZ(-1.04)];
                    beamKit.cylinder([2.0035, wheelCenter[1], rootZ(-1.00)], .031, .195, palette.silver);
                    ring(beamKit, wheelCenter, .18, 'z', palette.foil, .020);
                    for (let spoke = 0; spoke < 3; spoke++) {
                        const angle = spoke * Math.PI * 2 / 3;
                        beamKit.rod(wheelCenter, [wheelCenter[0] + .17 * Math.cos(angle), wheelCenter[1] + .17 * Math.sin(angle), wheelCenter[2]], .017, palette.silver);
                    }
                    // Each web is a thin sloping plate with a relieved forward lip.
                    // Outline coordinates come from the GLB; the paired plates converge
                    // toward the first radiator panel instead of filling that space.
                    const rootWebs = [
                        [[-5.6063,-.59561],[-2.0489,-.65770],[-2.0681,-1.75986],[-2.2585,-1.75654],[-2.2562,-1.62840],[-5.4329,-1.57292],[-5.4352,-1.70112],[-5.6255,-1.69780]],
                        [[-1.7598,-.65272],[1.7982,-.65394],[1.7978,-1.75624],[1.6074,-1.75618],[1.6075,-1.62804],[-1.5698,-1.62695],[-1.5698,-1.75509],[-1.7602,-1.75503]],
                        [[2.0719,-.65770],[5.6293,-.59561],[5.6486,-1.69780],[5.4582,-1.70112],[5.4559,-1.57292],[2.2793,-1.62840],[2.2816,-1.75654],[2.0912,-1.75986]]
                    ];
                    rootWebs.forEach(profile => {
                        const shape = new THREE.Shape();
                        profile.forEach(([y, z], index) => index ? shape.lineTo(y, z) : shape.moveTo(y, z)); shape.closePath();
                        const geometry = new THREE.ExtrudeGeometry(shape, {depth: .0745, bevelEnabled: false});
                        const positions = geometry.attributes.position;
                        const slope = (profile[1][1] - profile[0][1]) / (profile[1][0] - profile[0][0]);
                        for (let i = 0; i < positions.count; i++) {
                            const y = positions.getX(i), z = positions.getY(i), inset = positions.getZ(i);
                            const baseZ = profile[0][1] + (y - profile[0][0]) * slope;
                            const x = .404825 + (z - baseZ) * (.24438 / 1.10352) - inset;
                            positions.setXYZ(i, x, rootY(y), rootZ(z));
                        }
                        geometry.computeVertexNormals();
                        for (const edge of [-1, 1]) {
                            const web = geometry.clone();
                            if (edge < 0) {
                                web.scale(-1, 1, 1);
                                const indices = []; for (let i = 0; i < positions.count; i += 3) indices.push(i, i + 2, i + 1);
                                web.setIndex(indices); web.computeVertexNormals();
                            }
                            beamKit.add(web, material(palette.white), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                        }
                    });
                    for (let leaf = 0; leaf < 3; leaf++) {
                        const offset = (leaf - 1) * leafPitch;
                        const radiator = new THREE.Group(), radiatorKit = new Kit();
                        radiator.name = (side < 0 ? 'Port' : 'Starboard') + ' HRS radiator ' + (leaf + 1);
                        radiator.position.set(0, offset, 0);
                        radiator.userData.panelCount = 8;
                        radiator.userData.surface = 'White thermal coating';
                        radiator.userData.flowChannelsPerPanel = 9;
                        radiator.userData.hingeSeams = 7;
                        const coating = material(0xffffff, .88, .04, radiatorFace);
                        const panelCore = material(0xf3f5f1, .86, .05);
                        for (let section = 0; section < 8; section++) {
                            const depth = 2.0 + section * 2.82;
                            const tilt = (section % 2 ? -1 : 1) * .045;
                            const c = Math.cos(tilt), sn = Math.sin(tilt);
                            const at = (x, y, z) => [x * c + z * sn, y, depth - x * sn + z * c];
                            // A shallow alternating fold makes all eight rigid panels legible.
                            radiatorKit.add(shapes.box, panelCore, [0, 0, depth], [.09, 3.4, 2.7], [0, tilt, 0], false);
                            for (const face of [-1, 1]) {
                                radiatorKit.add(new THREE.PlaneGeometry(2.62, 3.32), coating, at(face * .047, 0, 0), [1, 1, 1], [0, tilt + face * Math.PI / 2, 0], false);
                                // Low-profile flow channels are bonded to each radiating skin.
                                for (let channel = 0; channel < 9; channel++) {
                                    const y = -1.44 + channel * .36;
                                    radiatorKit.rod(at(face * .057, y, -1.19), at(face * .057, y, 1.19), .015, 0xdce3df);
                                }
                                for (const end of [-1, 1]) {
                                    radiatorKit.rod(at(face * .074, -1.51, end * 1.19), at(face * .074, 1.51, end * 1.19), .028, 0xe4e9e5);
                                }
                            }
                            // Pale aluminum perimeter channels and rear stiffening stringers.
                            for (const height of [-1.7, 1.7]) radiatorKit.box(at(0, height, 0), [.15, .055, 2.72], 0xd6ded9, [0, tilt, 0], false);
                            for (const end of [-1, 1]) radiatorKit.box(at(0, 0, end * 1.35), [.15, 3.4, .055], 0xd6ded9, [0, tilt, 0], false);
                            for (const y of [-.91, .91]) radiatorKit.box(at(-.089, y, 0), [.075, .052, 2.60], 0xe5eae6, [0, tilt, 0], false);
                            for (const y of [-1.61, 1.61]) for (const end of [-1, 1]) {
                                radiatorKit.add(shapes.lowCylinder, material(0x9baaa3), at(.083, y, end * 1.28), [.024, .025, .024], [0, tilt, Math.PI / 2], false);
                            }
                            if (section < 7) {
                                const jointX = sn * 1.35, jointZ = depth + 1.41;
                                // Three clevises share the hinge axis across each panel seam.
                                for (const y of [-1.38, 0, 1.38]) {
                                    radiatorKit.cylinder([jointX, y, jointZ], .068, .25, 0xdbe2de, [0, 0, 0]);
                                    radiatorKit.cylinder([jointX, y, jointZ], .032, .31, 0x899891, [0, 0, 0]);
                                    for (const end of [-1, 1]) radiatorKit.box([jointX, y, jointZ + end * .09], [.075, .17, .16], 0xe5eae6, [0, 0, 0], false);
                                }
                                // Short insulated hose loops bridge the articulated panel gaps.
                                for (const y of [-1.51, 1.51]) {
                                    const path = new THREE.CatmullRomCurve3([
                                        new THREE.Vector3(...at(.075, y, 1.19)),
                                        new THREE.Vector3(jointX + .16, y, jointZ - .11),
                                        new THREE.Vector3(jointX + .16, y, jointZ + .11),
                                        new THREE.Vector3(.075 * c + 1.19 * sn, y, depth + 2.82 + .075 * sn - 1.19 * c)
                                    ]);
                                    radiatorKit.add(new THREE.TubeGeometry(path, 10, .022, 6, false), material(0xc6d1cb), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                                }
                            }
                        }
                        // Small hinge pins seat the tapered root cheeks on the unchanged
                        // first-panel edge. Leave the eight-panel generation above intact.
                        for (const y of [-1.60, 1.60]) {
                            radiatorKit.cylinder([0, y, .645], .041, .34, palette.silver, [0, 0, Math.PI / 2]);
                        }
                        radiatorKit.finish(radiator); bank.add(radiator); group.userData.radiators.push(radiator);
                    }
                    beamKit.finish(bank); group.add(bank); group.userData.radiatorBanks.push(bank);
                }
            });
            part('destiny', 'Destiny laboratory', '05 / US LABORATORY', 'Destiny supports US research and Earth observation. Four permanent S0 strut groups connect above its hull; an observation window and protective shutter face Earth below. Mount fittings and the open shutter pose are illustrative.', [['Support groups', '2 bipods + 2 tripods'], ['Strut legs', '10']], [0, 2.2, 4], (kit, group) => {
                moduleAt(kit, [0, 0, 4], 8.5, 2.15, 'z', { handholdHalfLength: .24, skin: 'quilted', endInterfaceSides: [] }); hullBadge(kit, 'DESTINY', [0, 0, 3.9], 2.225, [3.1, .42]);
                // Replace intersecting generic domes with source-shaped conical CBM interfaces.
                referenceCbmCone(kit, -.25, cbmDestinyFront, 2.15, 1.28884 * cbmReferenceRadial);
                referenceCbmCone(kit, 8.25, cbmDestinyRear, 2.15, 1.28884 * cbmReferenceRadial);
                group.userData.cbm = {
                    harmony: referenceActiveCBM(kit, cbmDestinyFront, a => -a * cbmHarmonyScale, cbmReferenceRadial),
                    unity: referenceActiveCBM(kit, cbmDestinyRear, a => a * cbmUnityScale, cbmReferenceRadial)
                };
                for (const depth of [1, 6.5]) kit.box([0, 2.4, depth], [1.2, .4, .8], palette.white);
                // Four permanent S0 groups: two forward bipods and two aft tripods.
                // Group count follows JAXA / STS-110; local fittings and pose are schematic.
                for (const side of [-1, 1]) {
                    const n = [side * Math.SQRT1_2, Math.SQRT1_2];
                    const tangent = [Math.SQRT1_2, -side * Math.SQRT1_2];
                    const face = [0, 0, -side * Math.PI / 4];
                    // The aft third leg lands on a cross-member tied to both lower rails.
                    kit.rod([side * 4.25, 5.3 - trussDrop, 2.3], [side * 4.25, 5.3 - trussDrop, 4.0], .11, palette.silver);
                    kit.rod([side * 4.25, 5.3 - trussDrop, 4.0], [side * 4.25, 5.95 - trussDrop, 5.7], .11, palette.silver);
                    for (const depth of [1.4, 6.55]) {
                        const aft = depth > 4;
                        const at = (radial, offset = 0, dz = 0) => [n[0] * radial + tangent[0] * offset, n[1] * radial + tangent[1] * offset, depth + dz];
                        // Each shoe sits into a shield facet, clear of the adjacent EVA handles.
                        kit.box(at(2.245), [.76, .16, .86], palette.silver, face);
                        kit.box(at(2.337), [.61, .035, .70], palette.white, face);
                        for (const offset of [-.28, .28]) for (const dz of (aft ? [-.30, 0, .30] : [-.30, .30])) {
                            kit.add(shapes.lowCylinder, material(palette.rail), at(2.367, offset, dz), [.047, .065, .047], face, false);
                        }
                        const lower = at(2.43);
                        for (const dz of [-.20, .20]) kit.box(at(2.43, 0, dz), [.34, .34, .10], palette.silver, face);
                        kit.cylinder(lower, .115, .56, palette.dark);
                        for (const dz of [-.30, .30]) kit.cylinder(at(2.43, 0, dz), .14, .055, palette.silver);
                        kit.sphere(lower, [.155, .155, .155], palette.silver);
                        const uppers = aft
                            ? [[side * 2.55, 5.95 - trussDrop, 5.7], [side * 4.25, 5.95 - trussDrop, 5.7], [side * 4.25, 5.3 - trussDrop, 4.0]]
                            : [[side * 2.55, 5.3 - trussDrop, 2.3], [side * 4.25, 5.3 - trussDrop, 2.3]];
                        for (const upper of uppers) {
                            const a = new THREE.Vector3(...lower), b = new THREE.Vector3(...upper);
                            const lerp = t => a.clone().lerp(b, t).toArray();
                            // Nested tubes and two restrained clamshell collars describe each strut.
                            kit.rod(lower, upper, .105, palette.silver);
                            kit.rod(lerp(.16), lerp(.79), .126, palette.hull);
                            for (const t of [.18, .78]) kit.rod(lerp(t - .025), lerp(t + .025), .153, palette.white);
                            kit.box([upper[0], upper[1] - .01, upper[2]], [.46, .28, .46], palette.white);
                            kit.sphere(upper, [.15, .15, .15], palette.silver);
                            kit.cylinder(upper, .13, .54, palette.silver);
                        }
                        if (aft) {
                            // A seated hull terminal feeds a harness clipped to the outer aft leg.
                            kit.box(at(2.245, side * .40, .20), [.29, .12, .29], palette.silver, face);
                            const terminal = at(2.355, side * .40, .20);
                            kit.box(terminal, [.25, .20, .25], palette.silver, face);
                            const start = at(2.46, side * .40, .20);
                            const a = new THREE.Vector3(...lower), b = new THREE.Vector3(...uppers[1]);
                            const direction = b.clone().sub(a).normalize();
                            const offset = new THREE.Vector3(side, 0, 0);
                            offset.addScaledVector(direction, -offset.dot(direction)).normalize().multiplyScalar(.172);
                            const cableAt = t => a.clone().lerp(b, t).add(offset).toArray();
                            const end = [side * 4.43, 5.83 - trussDrop, 5.7];
                            kit.box(end, [.22, .20, .26], palette.silver);
                            const cable = [start, cableAt(.12), cableAt(.96), end];
                            for (let segment = 1; segment < cable.length; segment++) kit.rod(cable[segment - 1], cable[segment], .028, palette.foil);
                            for (const t of [.24, .50, .76, .93]) {
                                const point = a.clone().lerp(b, t);
                                kit.rod(point.clone().addScaledVector(direction, -.035).toArray(), point.clone().addScaledVector(direction, .035).toArray(), .145, palette.silver);
                                kit.rod(point.toArray(), cableAt(t), .035, palette.silver);
                            }
                        }
                    }
                }
                // NASA: 0.508 m nadir aperture, four panes, protective shutter + gearbox.
                // Cover outline, hinge axis and cycle timing are an illustrative mechanism study.
                const windowZ = 4.85, windowKit = new Kit(), windowAssembly = new THREE.Group();
                windowAssembly.name = 'Destiny observation window and shutter';
                windowKit.box([0, -2.235, windowZ], [.92, .09, 1.00], palette.white);
                windowKit.cylinder([0, -2.31, windowZ], .40, .12, palette.silver, [0, 0, 0]);
                windowKit.cylinder([0, -2.38, windowZ], .254, .026, palette.glass, [0, 0, 0]);
                ring(windowKit, [0, -2.397, windowZ], .278, 'y', palette.dark, .024);
                ring(windowKit, [0, -2.405, windowZ], .39, 'y', palette.white, .035);
                ring(windowKit, [0, -2.414, windowZ], .328, 'y', palette.silver, .018);
                for (let bolt = 0; bolt < 8; bolt++) {
                    const a = bolt * Math.PI / 4, x = Math.sin(a) * .365, z = windowZ + Math.cos(a) * .365;
                    windowKit.add(shapes.lowCylinder, material(palette.rail), [x, -2.44, z], [.023, .035, .023], [0, 0, 0], false);
                    windowKit.box([x, -2.459, z], [.023, .002, .005], palette.dark, [0, a, 0], false);
                }
                for (const dz of [-.27, .27]) {
                    windowKit.box([.47, -2.355, windowZ + dz], [.18, .27, .12], palette.silver);
                    windowKit.cylinder([.47, -2.48, windowZ + dz], .068, .18, palette.dark);
                    for (const offset of [-.1, .1]) windowKit.cylinder([.47, -2.48, windowZ + dz + offset], .074, .025, palette.silver);
                }
                windowKit.rod([.47, -2.48, windowZ - .38], [.47, -2.48, windowZ + .48], .037, palette.silver);
                windowKit.box([.51, -2.37, windowZ + .49], [.25, .27, .22], palette.white);
                windowKit.cylinder([.51, -2.52, windowZ + .49], .068, .065, palette.silver, [0, 0, 0]);
                windowKit.box([-.44, -2.32, windowZ], [.16, .15, .15], palette.silver);
                windowKit.box([-.44, -2.42, windowZ], [.10, .08, .08], palette.dark);
                windowKit.finish(windowAssembly); group.add(windowAssembly);
                const pivot = new THREE.Group(), coverKit = new Kit();
                pivot.name = 'Hinged protective window shutter'; pivot.position.set(.47, -2.48, windowZ);
                coverKit.cylinder([-.47, -.03, 0], .42, .07, palette.white, [0, 0, 0]);
                coverKit.cylinder([-.47, -.070, 0], .36, .012, palette.hull, [0, 0, 0]);
                ring(coverKit, [-.47, .016, 0], .375, 'y', palette.dark, .020);
                // Shallow stiffeners, captive fasteners and hinge leaves move as one rigid cover.
                for (const z of [-.17, .17]) coverKit.box([-.47, -.086, z], [.63, .025, .035], palette.silver);
                for (const z of [-.27, .27]) {
                    coverKit.box([-.12, -.025, z], [.24, .06, .09], palette.silver);
                    coverKit.cylinder([0, 0, z], .060, .10, palette.silver);
                }
                for (let bolt = 0; bolt < 8; bolt++) {
                    const a = bolt * Math.PI / 4;
                    coverKit.add(shapes.lowCylinder, material(palette.rail), [-.47 + Math.sin(a) * .38, -.077, Math.cos(a) * .38], [.016, .026, .016], [0, 0, 0], false);
                }
                coverKit.box([-.86, -.01, 0], [.10, .08, .09], palette.silver);
                coverKit.finish(pivot); windowAssembly.add(pivot);
                pivot.rotation.z = destinyShutter.angle; destinyShutter.pivot = pivot;
                group.userData.windowAssembly = windowAssembly;
                group.userData.windowDiameter = .508; group.userData.s0Legs = 10;
            });
            part('unity', 'Unity / Node 1', '06 / CONNECTING NODE', 'Unity joined Zarya in December 1998, linking the US and Russian segments. Six berthing ports connect laboratories, living space, storage and the airlock.', [['Joined station', '1998'], ['Berthing ports', '6']], [0, 2.1, 12], (kit, group) => {
                // The interior is empty: a hollow barrel, and four radial port stubs that rise from the pressure shell to
                // their port faces instead of tubes crossing the module. Z1 seats on the zenith stub's berthing interface.
                moduleAt(kit, [0, 0, 12], 5.5, 2.15, 'z', { skin: 'quilted', endInterfaceSides: [1], hollow: true });
                for (const sign of [-1, 1]) radialPortStub(kit, [0, 0, 12], 2.15, 1.25, 2.3, 'x', sign);
                for (const sign of [-1, 1]) radialPortStub(kit, [0, 0, 12], 2.15, 1.25, 2.4, 'y', sign);
                placedKit(kit, [0, 0, 12], [-Math.PI / 2, 0, 0], local => genericEndInterface(local, 1, 1.25, 2.4, true));
                hullBadge(kit, 'UNITY', [0, 0, 10.05], 2.225, [1.15, .32]);
                // The nadir port has been free since Leonardo moved to Tranquility in 2015: the GLB's covered CBM stands on
                // the port face, its inspection ring toward the aft (Russian) end.
                const nadir = new THREE.Group(), nadirKit = new Kit();
                nadir.name = 'Unity / nadir free CBM'; nadir.position.z = 12; nadir.rotation.x = Math.PI;
                nadir.userData.cover = referenceFreeCbm(nadirKit, { face: 2.4 });
                nadirKit.finish(nadir); group.add(nadir);
                referenceCbmCone(kit, 9.25, cbmUnityFront, 2.15, cbmPassiveRadius);
                group.userData.cbm = { destiny: referencePassiveCBM(kit, cbmUnityFront, -1, cbmUnityScale, cbmReferenceRadial) };
                // The reference's stepped active CBMs replace generic domes on the two occupied radial ports.
                // Quest keeps its existing location, so its sleeve is extended along the mating axis only.
                for (const sign of [-1, 1]) {
                    const collar = new THREE.Group(), collarKit = new Kit();
                    collar.name = sign > 0 ? 'Unity / Quest active CBM' : 'Unity / Tranquility active CBM';
                    collar.position.z = 12; collar.rotation.y = sign * Math.PI / 2;
                    const reach = sign > 0 ? 1.1505 : .4845;
                    collar.userData.cbm = referenceActiveCBM(collarKit, 2.290, a => a * reach / .472985);
                    collar.userData.currentPlacementRetained = true;
                    collarKit.finish(collar); group.add(collar);
                }
                // The same source PMA used at Harmony, rotated to raise the Russian mating axis.
                const adapter = referencePma('PMA-1 / GLB reference structure', [0, 0, pma1BaseZ], [0, 0, Math.PI]);
                group.add(adapter);
                group.userData.pma1 = {
                    reconstruction: 'Supplied GLB mesh, verified against USDZ; same size as PMA-2',
                    flangeCenter: [0, 0, pma1BaseZ],
                    dockingFace: [0, pmaReferenceOffset, pma1BaseZ + pmaReferenceLength],
                    rise: pmaReferenceOffset, segmentTranslation: russianSegmentOffset.toArray(),
                    adapter, referenceSize: adapter.userData.referenceSize
                };
            });
            part('harmony', 'Harmony / Node 2', '07 / RESEARCH JUNCTION', 'Harmony connects Destiny with the European Columbus and Japanese Kibo laboratories. The forward adapter receives commercial crew vehicles. Compact stepped CBM joints seat both laboratories against the radial ports; inclined collar brackets reinforce the axial connections.', [['Joined station', '2007'], ['Length', '7.2 m']], [0, 2.2, -4.65], (kit, group) => {
                // Node 2 after reference imagery: a 4.3 m cylinder closed by shallow conical end bulkheads rather than the
                // generic domed ends, each with twelve sector seams, rim handrails and a raised berthing collar. The
                // four radial collars follow the reference node and meet the laboratory interfaces.
                const rimZ = end => end < 0 ? -8.25 : -1.05;
                const neckR = end => end < 0 ? 1.28 : cbmPassiveRadius;
                const bulkheadRise = end => end < 0 ? .25 / .87 : (cbmHarmonyRear + 1.05) / (2.15 - cbmPassiveRadius);
                const endZ = (end, r) => rimZ(end) + end * (2.15 - r) * bulkheadRise(end);
                const onEnd = (end, angle, r, lift = 0) => {
                    const slope = bulkheadRise(end), normalZ = 1 / Math.hypot(1, slope), normalR = slope * normalZ;
                    return [Math.cos(angle) * (r + lift * normalR), Math.sin(angle) * (r + lift * normalR), endZ(end, r) + end * lift * normalZ];
                };
                for (const profile of [[[1.28, -8.5], [2.15, -8.25], [2.15, -5.95]], [[2.15, -3.35], [2.15, -1.05], [cbmPassiveRadius, cbmHarmonyRear]]]) kit.add(new THREE.LatheGeometry(profile.map(([r,z])=>new THREE.Vector2(r,z)),64),material(palette.hull),[0,0,0],[1,1,1],[Math.PI/2,0,0]);
                // Radial CBM belt rebuilt from the Harmony node in ISS_stationary.glb.
                // The GLB has four saddle-mounted collars and shallow inset covers. Dimensions are
                // normalized to the existing 2.15 m hull radius; occupied ports meet the current laboratories.
                const portZ = -4.7, beltR = 2.156, collarR = 1.17, boreR = 1.045, freeFace = 2.168;
                const collarSkin = material(0xc7ceca, .52, .34);
                // Four curved shell quadrants, each with a circular opening cut through the shell.
                for (let face = 0; face < 4; face++) {
                    const base = face * Math.PI / 2, positions = [], normals = [], uv = [], indices = [], steps = 128, rows = 4;
                    for (let row = 0; row <= rows; row++) for (let i = 0; i <= steps; i++) {
                        const phi = i / steps * Math.PI * 2, cx = Math.cos(phi), sz = Math.sin(phi);
                        const limit = Math.min((beltR / Math.SQRT2) / Math.max(1e-8, Math.abs(cx)), (sz > 0 ? 1.35 : 1.25) / Math.max(1e-8, Math.abs(sz)));
                        const d = THREE.MathUtils.lerp(collarR, limit, row / rows), tangent = cx * d, along = sz * d;
                        const angle = base + Math.asin(tangent / beltR);
                        positions.push(Math.cos(angle) * beltR, Math.sin(angle) * beltR, portZ + along);
                        normals.push(Math.cos(angle), Math.sin(angle), 0); uv.push(face + i / steps, row / rows);
                    }
                    for (let row = 0; row < rows; row++) for (let i = 0; i < steps; i++) {
                        const a = row * (steps + 1) + i, b = a + steps + 1;
                        indices.push(a, b, a + 1, b, b + 1, a + 1);
                    }
                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
                    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
                    // Ensure the shell winding faces outward independently of the quadrant.
                    const p = i => new THREE.Vector3().fromArray(positions, i * 3);
                    if (p(indices[1]).sub(p(indices[0])).cross(p(indices[2]).sub(p(indices[0]))).dot(new THREE.Vector3().fromArray(normals, indices[0] * 3)) < 0) {
                        for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]; geometry.setIndex(indices);
                    }
                    kit.add(geometry, material(0xa3aaa8, .7, .2), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                function radialPort(axis, sign, occupied = false) {
                    const local = new THREE.Group(), portKit = new Kit(); local.name = 'Harmony ' + (axis === 'x' ? (sign < 0 ? 'Kibo collar' : 'Columbus collar') : (sign > 0 ? 'zenith hatch' : 'nadir hatch'));
                    const turn = axis === 'x' ? -sign * Math.PI / 2 : sign < 0 ? Math.PI : 0;
                    local.rotation.z = turn; local.position.z = portZ; group.add(local);
                    // The rim root follows the curved hull; its outer face is a planar berthing ring.
                    const positions = [], uv = [], indices = [], steps = 96;
                    for (let row = 0; row < 2; row++) for (let i = 0; i <= steps; i++) {
                        const a = i / steps * Math.PI * 2, x = Math.cos(a) * collarR, z = Math.sin(a) * collarR;
                        positions.push(x, row ? freeFace : Math.sqrt(beltR * beltR - x * x) - .006, z); uv.push(i / steps, row);
                    }
                    for (let i = 0; i < steps; i++) {const a=i,b=i+steps+1;indices.push(a,b,a+1,b,b+1,a+1);}
                    const saddle = new THREE.BufferGeometry(); saddle.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); saddle.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); saddle.setIndex(indices); saddle.computeVertexNormals();
                    if(occupied) portKit.add(saddle, collarSkin, [0,0,0], [1,1,1], [0,0,0], false);
                    const lathe = (profile,surface) => portKit.add(new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)),96),surface,[0,0,0],[1,1,1],[0,0,0],false);
                    if(occupied) {lathe([[collarR,freeFace],[1.135,freeFace+.015],[1.09,freeFace+.015],[boreR,freeFace-.035],[boreR,1.85]],collarSkin);ring(portKit,[0,freeFace+.006,0],1.137,'y',palette.silver,.015);}
                    if (occupied) {
                        // Reference lab cuffs interlock with the node saddle instead of a long exposed tube.
                        const neck = sign < 0 ? 2.189909 : 2.186644, radialScale = .9348886982;
                        const sleeve = new THREE.Group(), sleeveKit = new Kit();
                        sleeve.name = sign < 0 ? 'Kibo passive CBM' : 'Columbus passive CBM';
                        sleeve.rotation.x = -Math.PI / 2;
                        sleeve.userData.cbm = referencePassiveCBM(sleeveKit, neck, -1, radialScale, radialScale);
                        sleeveKit.finish(sleeve); local.add(sleeve);
                        // The seating lip closes onto the lab's annular face; a thin gasket marks the seam.
                        lathe([[1.135, freeFace + .015], [1.105, neck + .010], [1.090, neck + .010], [1.090, freeFace + .015]], collarSkin);
                        ring(portKit, [0, neck - .003, 0], 1.109, 'y', 0x69736d, .008);
                        local.userData.matingFace = { axis: 'x', coordinate: sign * neck, z: -4.7, radius: 1.103418 };
                    } else {
                        // Free port: the GLB's covered CBM, its inspection ring toward the forward end as on the source node.
                        local.userData.cover = { ...referenceFreeCbm(portKit, { hullRadius: beltR }), face: freeFace, source: 'ISS_stationary.glb / 26 Harmony Node 2' };
                    }
                    portKit.finish(local); return local;
                }
                const harmonyPorts = {kibo:radialPort('x',-1,true),columbus:radialPort('x',1,true),zenith:radialPort('y',1),nadir:radialPort('y',-1)};
                group.userData.radialPorts = harmonyPorts;
                for (const end of [-1, 1]) {
                    ring(kit, [0, 0, rimZ(end)], 2.162, 'z', palette.silver, .03);
                    for (let seam = 0; seam < 12; seam++) { const a = (seam + .5) * Math.PI / 6; kit.line([onEnd(end, a, neckR(end) + .05, .008), onEnd(end, a, 2.14, .008)]); }
                    // Rim handrails alternate between tangential bars and radial bars across the sector panels.
                    for (let sector = 0; sector < 12; sector++) {
                        const a = sector * Math.PI / 6, [p, q] = sector % 2 ? [[a, 1.55], [a, 1.97]] : [[a - .12, 1.95], [a + .12, 1.95]];
                        kit.rod(onEnd(end, p[0], p[1], .09), onEnd(end, q[0], q[1], .09), .03, palette.gold);
                        for (const [angle, r] of [p, q]) kit.rod(onEnd(end, angle, r), onEnd(end, angle, r, .09), .024, palette.gold);
                    }
                    // The rear passive collar nests into Destiny's active collar.
                    // The forward active collar follows the original PMA-2 flange without moving its mesh.
                    group.userData.cbm ||= {};
                    if (end > 0) group.userData.cbm.destiny = referencePassiveCBM(kit, cbmHarmonyRear, 1, cbmHarmonyScale, cbmReferenceRadial);
                    else {
                        const seat = .17316627502441406;
                        group.userData.cbm.pma2 = referenceActiveCBM(kit, -8.5, a => -(a <= seat ? a * (.22 / seat) : .22 + a - seat), 1);
                    }
                }
                // Kibo-style quilted MMOD panels over dark seams: twelve columns in two rows around the forward and aft bays,
                // and only the four diagonal panels in the middle bay, leaving recesses around the radial ports.
                for (const [z0, z1] of [[-8.25, -5.95], [-3.35, -1.05]]) kit.add(new THREE.CylinderGeometry(2.166, 2.166, z1 - z0, 64, 1, true), quiltSeam, [0, 0, (z0 + z1) / 2], [1, 1, 1], [Math.PI / 2, 0, 0], false);
                [[-8.25, -5.95], [-5.95, -3.35], [-3.35, -1.05]].forEach(([z0, z1], bay) => {
                    const middle = (z0 + z1) / 2;
                    [[z0 + .04, middle - .016], [middle + .016, z1 - .04]].forEach(([za, zb], row) => {
                        if (bay === 1) for (let k = 0; k < 4; k++) { const c = Math.PI / 4 + k * Math.PI / 2; quiltPanel(kit, 2.172, za, zb, c - .14, c + .14, quiltPanels[(k + row) % 2]); }
                        else for (let k = 0; k < 12; k++) quiltPanel(kit, 2.172, za, zb, k * Math.PI / 6 + .006, (k + 1) * Math.PI / 6 - .006, quiltPanels[(k + row + bay) % 2]);
                    });
                });
                for (const z of [-5.95, -3.35]) ring(kit, [0, 0, z], 2.175, 'z', palette.silver, .02);
                // Gold handrails run along longitudinal seams, clear of the top badge, and along the diagonal panels.
                const seamRail = (a, zc, half) => {
                    const at = (z, r) => [Math.cos(a) * r, Math.sin(a) * r, z];
                    kit.rod(at(zc - half, 2.27), at(zc + half, 2.27), .033, palette.gold);
                    for (const z of [zc - half, zc + half]) kit.rod(at(z, 2.172), at(z, 2.27), .026, palette.gold);
                };
                for (const [zc, angles] of [[-7.1, [30, 150, 210, 270, 330]], [-2.2, [30, 90, 150, 210, 270, 330]]]) for (const degrees of angles) seamRail(degrees * Math.PI / 180, zc, .45);
                for (let k = 0; k < 4; k++) seamRail(Math.PI / 4 + k * Math.PI / 2, -4.65, .4);
                // ESA and NASA stickers on the forward bulkhead's upper-starboard sectors, facing the starboard view.
                const sticker = (text, angle) => {
                    const normal = new THREE.Vector3(Math.cos(angle) * .276, Math.sin(angle) * .276, -.961).normalize();
                    const up = new THREE.Vector3(0, 1, 0).addScaledVector(normal, -normal.y).normalize(), right = new THREE.Vector3().crossVectors(up, normal);
                    const turn = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
                    const ink = material(0xffffff, .85, 0, labelTexture(text, '#1f4e96'));
                    ink.alphaTest = .25; ink.polygonOffset = true; ink.polygonOffsetFactor = -1; ink.polygonOffsetUnits = -1; ink.userData.decal = true;
                    kit.box(onEnd(-1, angle, 1.62, .012), [.46, .3, .016], palette.white, [turn.x, turn.y, turn.z], false);
                    kit.add(new THREE.PlaneGeometry(text.length < 4 ? 1.5 : 1.25, text.length < 4 ? .375 : .31), ink, onEnd(-1, angle, 1.62, .024), [1, 1, 1], [turn.x, turn.y, turn.z], false);
                };
                sticker('esa', Math.PI / 3); sticker('NASA', 0);
                // PMA-2 uses the identical reference mesh and scale as PMA-1, facing forward.
                const pma2 = referencePma('PMA-2 / GLB reference structure', [0, 0, pma2BaseZ], [0, Math.PI, 0]);
                group.add(pma2);
                group.userData.pma2 = {
                    reconstruction: 'Supplied GLB mesh, verified against USDZ; same size as PMA-1',
                    flangeCenter: [0, 0, pma2BaseZ],
                    dockingFace: [0, -pmaReferenceOffset, pma2BaseZ - pmaReferenceLength],
                    adapter: pma2, referenceSize: pma2.userData.referenceSize
                };
                hullBadge(kit, 'HARMONY', [0, 0, -6.75], 2.225, [1.8, .38]);
            });
            part('kibo', 'Kibo laboratory', '08 / JAPAN - JAXA', 'Japan\'s laboratory: the pressurized module, with its logistics module on top and the Japanese flag on its forward side, leads to a 12-interface exposed facility carrying payloads on its deck and edges, including the ICS dish. The six-joint main arm has two long booms and a short wrist boom. The exposed deck, seven edge payloads and parked arm follow the supplied 3D reference; surface details are procedural.', [['Main lab length', '11.2 m'], ['External interfaces', '12']], [-8.689909, 2, -4.7], (kit, group) => {
                // Move the complete lab and its EF/arm together to the compact reference interface.
                group.position.x = 1.310091;
                group.userData.connectionTranslation = [1.310091, 0, 0];
                // Pressurized Module after reference photography: a 4.4 m barrel of quilted silver MMOD panels in sixteen columns
                // and nine bays, gold handrails along the seams, the Japanese flag on the forward side, short end cones, the
                // Harmony berthing collar and the collar that meets the exposed-facility berthing mechanism. Angles run from
                // forward (0) over the top (90 degrees).
                const pmZ = -4.7, pmR = 2.2, pmA = -3.5, pmB = -14.05, pmBays = 9, pmColumns = 16;
                const onPM = (a, r, x) => [x, Math.sin(a) * r, pmZ - Math.cos(a) * r];
                const twoSided = (color, roughness = .62, metalness = .3, map = null) => { const m = material(color, roughness, metalness, map).clone(); m.side = THREE.DoubleSide; return m; };
                function sweepX(r0, x0, r1, x1, a0, a1, surface) {
                    const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 32))), positions = [], uvs = [], indices = [];
                    for (let row = 0; row < 2; row++) for (let i = 0; i <= steps; i++) { positions.push(...onPM(a0 + (a1 - a0) * i / steps, row ? r1 : r0, row ? x1 : x0)); uvs.push(i / steps, row); }
                    // Wind every strip outward (away from the axis, and away from the module middle on the end faces) so
                    // lighting and the shadow normal bias act on the outer skin.
                    const corner = k => new THREE.Vector3().fromArray(positions, k * 3), faceNormal = corner(1).sub(corner(0)).cross(corner(steps + 1).sub(corner(0)));
                    const outward = faceNormal.dot(new THREE.Vector3(Math.sign((x0 + x1) / 2 - (pmA + pmB) / 2) * .5, Math.sin(a0), -Math.cos(a0))) > 0;
                    for (let i = 0; i < steps; i++) { const j = i + steps + 1; indices.push(...(outward ? [i, i + 1, j, j, i + 1, j + 1] : [i, j, i + 1, j, j + 1, i + 1])); }
                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                    geometry.setIndex(indices); geometry.computeVertexNormals();
                    kit.add(geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                const pmSeam = twoSided(0x5f6866, .8, .2), pmPanels = [twoSided(0xffffff, .5, .38, quiltMap), twoSided(0xe9ece9, .5, .38, quiltMap)];
                sweepX(pmR - .006, pmA, pmR - .006, pmB, 0, Math.PI * 2, pmSeam);
                const bayEdge = n => pmA + (pmB - pmA) * n / pmBays;
                for (let bay = 0; bay < pmBays; bay++) for (let k = 0; k < pmColumns; k++) {
                    const a0 = k * Math.PI * 2 / pmColumns + .005, a1 = a0 + Math.PI * 2 / pmColumns - .01;
                    sweepX(pmR + .004, bayEdge(bay) - .016, pmR + .004, bayEdge(bay + 1) + .016, a0, a1, pmPanels[(bay + k) % 2]);
                }
                // The GLB Kibo inboard bulkhead is a flat annulus, unlike Columbus's cone.
                const lerp = (u, v, t) => u + (v - u) * t, inboardBore = 1.103418;
                sweepX(pmR - .006, pmA, inboardBore, pmA, 0, Math.PI * 2, pmSeam);
                for (let k = 0; k < pmColumns; k++) {
                    const a0 = k * Math.PI * 2 / pmColumns + .008, a1 = a0 + Math.PI * 2 / pmColumns - .016;
                    sweepX(pmR - .018, pmA + .001, inboardBore + .01, pmA + .001, a0, a1, pmPanels[k % 2]);
                }
                ring(kit, [pmA + .004, 0, pmZ], pmR + .012, 'x', palette.silver, .022);
                ring(kit, [pmA + .006, 0, pmZ], inboardBore + .006, 'x', palette.silver, .018);
                group.userData.inboardJoint = { plane: -2.189909, radius: inboardBore, profile: 'Flat annular bulkhead with nested CBM cuff' };
                // Closed outboard bulkhead and low projecting airlock from GLB node94.
                // The barrel and Harmony-side collar keep their existing dimensions.
                kit.cylinder([pmB - .018, 0, pmZ], pmR, .036, palette.hull, [0, 0, Math.PI / 2]);
                ring(kit, [pmB - .041, 0, pmZ], pmR - .018, 'x', palette.silver, .03);
                for (let k = 0; k < pmColumns; k++) {
                    const a0 = k * Math.PI * 2 / pmColumns + .009, a1 = a0 + Math.PI * 2 / pmColumns - .018;
                    sweepX(pmR - .065, pmB - .038, 1.11, pmB - .041, a0, a1, pmPanels[k % 2]);
                }
                const airlockY = -.214441, airlockZ = -4.612287, airlockR = .943679;
                const bottomAngle = Math.asin((-1.086284 - airlockY) / airlockR);
                const airlockShape = new THREE.Shape();
                airlockShape.absarc(0, 0, airlockR, bottomAngle, Math.PI - bottomAngle, false); airlockShape.closePath();
                const housing = new THREE.ExtrudeGeometry(airlockShape, { depth: .488235, bevelEnabled: false, curveSegments: 32 });
                kit.add(housing, material(palette.white), [pmB, airlockY, airlockZ], [1, 1, 1], [0, -Math.PI / 2, 0]);
                const doorShape = new THREE.Shape(), dw = .809943, dh = .976726, cr = .135;
                doorShape.moveTo(-dw / 2 + cr, -dh / 2);
                doorShape.lineTo(dw / 2 - cr, -dh / 2); doorShape.quadraticCurveTo(dw / 2, -dh / 2, dw / 2, -dh / 2 + cr);
                doorShape.lineTo(dw / 2, dh / 2 - cr); doorShape.quadraticCurveTo(dw / 2, dh / 2, dw / 2 - cr, dh / 2);
                doorShape.lineTo(-dw / 2 + cr, dh / 2); doorShape.quadraticCurveTo(-dw / 2, dh / 2, -dw / 2, dh / 2 - cr);
                doorShape.lineTo(-dw / 2, -dh / 2 + cr); doorShape.quadraticCurveTo(-dw / 2, -dh / 2, -dw / 2 + cr, -dh / 2);
                const door = new THREE.ExtrudeGeometry(doorShape, { depth: .02737, bevelEnabled: false, curveSegments: 8 });
                kit.add(door, material(palette.silver), [-14.522, -.166451, -4.663179], [1, 1.04, 1.04], [0, -Math.PI / 2, 0]);
                kit.add(new THREE.ShapeGeometry(doorShape, 16), material(palette.hull), [-14.552, -.166451, -4.663179], [.94, .94, 1], [0, -Math.PI / 2, 0]);
                kit.rod([-14.576, -.08, -4.93], [-14.576, -.30, -4.93], .023, palette.gold);
                for (const y of [-.08, -.30]) kit.rod([-14.548, y, -4.93], [-14.576, y, -4.93], .017, palette.gold);
                for (const [y, z] of [[.654461, -5.602682], [.608299, -3.741911]]) {
                    kit.cylinder([pmB - .048, y, z], .4193, .028, palette.hull, [0, 0, Math.PI / 2]);
                    ring(kit, [pmB - .064, y, z], .409, 'x', palette.silver, .017);
                }
                group.userData.outboardBulkhead = { x: pmB, bridgeCenter: [-14.299, -1.56130433, -4.61228676] };
                // Gold handrails in rows along the seams, one per bay; the rows beside the top clear the logistics module.
                for (let row = 0; row < 8; row++) {
                    const a = Math.PI / 8 + row * Math.PI / 4;
                    for (let bay = 0; bay < pmBays; bay++) {
                        if ((row === 1 || row === 2) && (bay === 6 || bay === 7)) continue;
                        const xa = lerp(bayEdge(bay), bayEdge(bay + 1), .18), xb = lerp(bayEdge(bay), bayEdge(bay + 1), .82);
                        kit.rod(onPM(a, pmR + .1, xa), onPM(a, pmR + .1, xb), .022, 0xc39a45);
                        for (const x of [xa, xb]) kit.rod(onPM(a, pmR + .008, x), onPM(a, pmR + .1, x), .016, 0xc39a45);
                    }
                }
                // The Japanese flag above "JAPAN" on the forward side, as photographed.
                const flagCanvas = document.createElement('canvas'); flagCanvas.width = 512; flagCanvas.height = 448;
                const fl = flagCanvas.getContext('2d');
                fl.fillStyle = '#f4f4ef'; fl.fillRect(0, 0, 512, 448);
                fl.strokeStyle = '#9aa29e'; fl.lineWidth = 4; fl.strokeRect(40, 30, 432, 288);
                fl.fillStyle = '#c8202c'; fl.beginPath(); fl.arc(256, 174, 86, 0, Math.PI * 2); fl.fill();
                fl.fillStyle = '#9b1c26'; fl.font = '700 92px sans-serif'; fl.textAlign = 'center'; fl.textBaseline = 'middle'; fl.fillText('JAPAN', 256, 392, 470);
                const flagMap = new THREE.CanvasTexture(flagCanvas); flagMap.colorSpace = THREE.SRGBColorSpace; flagMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
                const flagSkin = material(0xffffff, .8, .02, flagMap).clone(); flagSkin.side = THREE.DoubleSide;
                flagSkin.polygonOffset = true; flagSkin.polygonOffsetFactor = -2; flagSkin.polygonOffsetUnits = -2; flagSkin.userData.decal = true;
                const flag = new THREE.PlaneGeometry(1.2, 1.05, 1, 12), flagPoints = flag.attributes.position;
                for (let i = 0; i < flagPoints.count; i++) {
                    const along = flagPoints.getX(i), a = -.1 + flagPoints.getY(i) / (pmR + .012);
                    flagPoints.setXYZ(i, -10.4 - along, Math.sin(a) * (pmR + .012), pmZ - Math.cos(a) * (pmR + .012));
                }
                flag.computeVertexNormals(); kit.add(flag, flagSkin, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                // A bronze grapple fixture and a flat service plate on the forward side.
                const pdgfNormal = new THREE.Vector3(0, Math.sin(.09), -Math.cos(.09)), pdgfTurn = new THREE.Quaternion().setFromUnitVectors(vertical, pdgfNormal);
                const pdgfAt = lift => new THREE.Vector3(...onPM(.09, pmR, -7.0)).addScaledVector(pdgfNormal, lift).toArray();
                kit.add(new THREE.CylinderGeometry(.34, .34, .06, 24).applyQuaternion(pdgfTurn), material(0x8c6a3a, .55, .45), pdgfAt(.03));
                kit.add(new THREE.CylinderGeometry(.22, .22, .08, 24).applyQuaternion(pdgfTurn), material(0x6d5230, .5, .5), pdgfAt(.07));
                kit.add(new THREE.CylinderGeometry(.05, .05, .22, 12).applyQuaternion(pdgfTurn), material(palette.silver), pdgfAt(.16));
                sweepX(pmR + .02, -4.9, pmR + .02, -5.9, .04, .3, twoSided(0xc3c8c4, .6, .25));
                kit.line([onPM(.04, pmR + .026, -4.9), onPM(.04, pmR + .026, -5.9)]); kit.line([onPM(.3, pmR + .026, -4.9), onPM(.3, pmR + .026, -5.9)]);
                group.userData.exposedFacilityInterfaces = 12;
                group.userData.roboticArmJoints = 6;
                group.userData.roboticArmBooms = 3;
                group.userData.logisticsModuleDiameter = 4.4;
                // JAXA ELM-PS: 4.4 m diameter; one lower CBM and external upper
                // mounting hardware. The dark top recess is capped, not an open hull.
                // Berthed at the outboard end of the Pressurized Module, beside the arm base, as photographed.
                // https://iss.jaxa.jp/en/kibo/about/kibo/jlp/
                const elmX = -11.7, elmZ = -4.7;
                // The source Kibo port has a curved saddle below the ELM's flat receiving cuff.
                // Seat the retained collar around its entire circumference, not just at the crown.
                const elmSaddle = new THREE.Group(), elmSaddleKit = new Kit();
                elmSaddle.name = 'Kibo / ELM curved CBM saddle';
                elmSaddle.position.set(elmX, 0, elmZ); elmSaddle.rotation.x = -Math.PI / 2;
                curvedCbmSaddle(elmSaddleKit, pmR, [
                    [1.005, 'plane', 2.235], [1.218, 'plane', 2.235],
                    [1.238, 'plane', 2.217], [1.238, 'shell', .012],
                    [1.290, 'shell', .012], [1.290, 'shell', .030],
                    [1.005, 'shell', .030], [1.005, 'plane', 2.235]
                ]);
                elmSaddle.userData.interface = { source: 'ISS_stationary.glb nodes 85 / 94',
                    hullRadius: pmR, flatFace: 2.235, rootDepths: [.012, .030], axis: 'Y' };
                elmSaddleKit.finish(elmSaddle); group.add(elmSaddle);

                kit.cylinder([elmX, 2.35, elmZ], 1.04, .40, palette.silver, [0, 0, 0]);
                for (const y of [2.19, 2.51]) {
                    kit.cylinder([elmX, y, elmZ], 1.22, .10, palette.hull, [0, 0, 0]);
                    ring(kit, [elmX, y, elmZ], 1.22, 'y', palette.silver, .045);
                }
                kit.add(new THREE.CylinderGeometry(2.2, 1.22, .40, 48), material(palette.silver), [elmX, 2.72, elmZ]);
                kit.cylinder([elmX, 4.50, elmZ], 2.2, 3.16, palette.hull, [0, 0, 0]);
                kit.add(new THREE.CylinderGeometry(1.40, 2.20, .32, 48), material(palette.silver), [elmX, 6.24, elmZ]);
                for (const y of [2.94, 3.98, 5.02, 6.07]) ring(kit, [elmX, y, elmZ], 2.22, 'y', palette.silver, .033);
                for (let sector = 0; sector < 12; sector++) {
                    const angle = sector * Math.PI / 6;
                    for (let row = 0; row < 3; row++) {
                        const y = 3.46 + row * 1.04;
                        const patch = new THREE.CylinderGeometry(2.219, 2.219, .96, 6, 1, true, angle + .022, Math.PI / 6 - .044);
                        kit.add(patch, material((sector + row) % 5 === 0 ? 0xb9c0be : palette.hull), [elmX, y, elmZ], [1, 1, 1], [0, 0, 0], false);
                        for (const a of [angle + .07, angle + Math.PI / 6 - .07]) {
                            for (const dy of [-.40, .40]) kit.sphere([elmX + Math.sin(a) * 2.235, y + dy, elmZ + Math.cos(a) * 2.235], [.028, .028, .028], palette.silver);
                        }
                    }
                    // Long narrow skin seams follow the actual cylindrical wall.
                    kit.rod([elmX + Math.sin(angle) * 2.227, 3.00, elmZ + Math.cos(angle) * 2.227], [elmX + Math.sin(angle) * 2.227, 6.03, elmZ + Math.cos(angle) * 2.227], .014, palette.silver);
                }
                kit.cylinder([elmX, 6.40, elmZ], 1.30, .10, palette.silver, [0, 0, 0]);
                kit.cylinder([elmX, 6.454, elmZ], 1.13, .018, 0xc5cac6, [0, 0, 0]);
                // Low boxes, a small dome and a fitting on the closed top, as photographed.
                for (const [dx, dz, w, h, d] of [[-.55, .35, .42, .22, .32], [.45, -.5, .36, .2, .5], [.1, .62, .3, .16, .3]]) kit.box([elmX + dx, 6.465 + h / 2, elmZ + dz], [w, h, d], palette.white);
                kit.add(new THREE.SphereGeometry(.26, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), material(palette.white), [elmX + .55, 6.47, elmZ + .45]);
                kit.cylinder([elmX - .4, 6.5, elmZ - .5], .16, .06, palette.silver, [0, 0, 0]);
                ring(kit, [elmX, 6.465, elmZ], 1.17, 'y', palette.white, .057);
                for (let bolt = 0; bolt < 16; bolt++) {
                    const a = bolt * Math.PI / 8;
                    kit.cylinder([elmX + Math.sin(a) * 1.15, 2.572, elmZ + Math.cos(a) * 1.15], .035, .03, palette.rail, [0, 0, 0]);
                }
                // External cable and grapple fittings stay on the ELM shell.
                const elmRoute = [[elmX + .62, 2.33, elmZ - .88], [elmX + .69, 2.73, elmZ - 1.78], [elmX + .73, 3.06, elmZ - 2.12], [elmX + .73, 5.91, elmZ - 2.12]];
                for (let i = 1; i < elmRoute.length; i++) kit.rod(elmRoute[i - 1], elmRoute[i], .042, palette.white);
                for (const y of [3.08, 4.15, 5.31, 5.91]) kit.box([elmX + .73, y, elmZ - 2.12], [.17, .16, .12], palette.silver);
                // Fine vertical ribs, gold handrails and orange trunnion fittings, as photographed and illustrated.
                for (let rib = 0; rib < 36; rib++) {
                    const a = rib * Math.PI / 18 + Math.PI / 36;
                    kit.line([[elmX + Math.sin(a) * 2.232, 2.98, elmZ + Math.cos(a) * 2.232], [elmX + Math.sin(a) * 2.232, 6.02, elmZ + Math.cos(a) * 2.232]]);
                }
                for (let rail = 0; rail < 8; rail++) {
                    const a = rail * Math.PI / 4 + Math.PI / 12, at = (r, y) => [elmX + Math.sin(a) * r, y, elmZ + Math.cos(a) * r];
                    for (const [y0, y1] of [[3.25, 4.15], [4.85, 5.75]]) {
                        kit.rod(at(2.33, y0), at(2.33, y1), .017, palette.gold);
                        for (const y of [y0, y1]) kit.rod(at(2.225, y), at(2.33, y), .013, palette.gold);
                    }
                }
                for (let t = 0; t < 4; t++) {
                    const a = t * Math.PI / 2 + Math.PI / 4;
                    for (const y of [3.0, 6.02]) kit.box([elmX + Math.sin(a) * 2.28, y, elmZ + Math.cos(a) * 2.28], [.22, .2, .22], 0xd0772b, [0, a, 0]);
                }

                // EF coordinates measured from ISS_stationary.glb node92. The 180-degree
                // frame preserves its asymmetric offset while keeping the PM barrel fixed.
                const ef = new THREE.Group(), efKit = new Kit();
                ef.name = 'Kibo exposed facility';
                ef.position.set(-14.96561222, -1.56130433, -4.61228676);
                ef.rotation.y = Math.PI;
                const deckCenter = [2.63489580, -.09498987, 1.02988231];
                const deckSize = [4.88252544, 1.24332023, 3.15405440];
                const deckTop = .52667028, nearEdge = -.54714489, farEdge = 2.60690951;
                ef.userData.reference = 'ISS_stationary.glb / node92';
                ef.userData.deckCenter = deckCenter;
                ef.userData.deckSize = deckSize;
                efKit.box(deckCenter, deckSize, palette.silver);
                efKit.box([deckCenter[0], deckTop + .012, deckCenter[2]], [deckSize[0] - .045, .024, deckSize[2] - .045], 0xdad6c8);
                // Thin perimeter seams and thermal blanket fasteners follow the actual edges.
                for (const z of [nearEdge + .05, farEdge - .05]) {
                    efKit.box([deckCenter[0], deckTop + .038, z], [deckSize[0] - .10, .035, .045], palette.hull);
                    for (let x = .35; x < 5.0; x += .30) efKit.cylinder([x, deckTop + .060, z], .016, .014, palette.rail, [0, 0, 0]);
                    for (const y of [-.50, .24]) efKit.rod([.28, y, z], [4.99, y, z], .018, palette.hull);
                }
                for (const x of [.25, 5.02]) efKit.box([x, deckTop + .035, deckCenter[2]], [.045, .035, deckSize[2] - .08], palette.hull);
                for (let x = 1.15; x < 4.9; x += 1.15) {
                    efKit.rod([x, deckTop + .029, nearEdge + .09], [x, deckTop + .029, farEdge - .09], .006, 0xbfc2b9);
                    for (const z of [nearEdge - .005, farEdge + .005]) efKit.rod([x, -.64, z], [x, .43, z], .012, palette.hull);
                }
                // Low bridge beneath the PM airlock; its root touches the existing barrel end.
                const bridgeStart = -.91561222, bridgeEnd = .19363292;
                efKit.box([bridgeStart + .249, 0, 0], [.498, .95004, 1.059], palette.white);
                efKit.cylinder([(-.41761222 + bridgeEnd) / 2, 0, 0], .443684, bridgeEnd + .41761222, palette.white, [0, 0, Math.PI / 2]);
                for (const x of [bridgeStart + .02, -.10, .16]) {
                    efKit.cylinder([x, 0, 0], .448, .065, palette.silver, [0, 0, Math.PI / 2]);
                    ring(efKit, [x, 0, 0], .446, 'x', palette.hull, .022);
                }
                for (const z of [-.32, .32]) efKit.rod([bridgeStart + .1, -.31, z], [.22, -.47, z], .035, palette.silver);
                ef.userData.bridgeEndpoints = [[bridgeStart, 0, 0], [bridgeEnd, 0, 0]];

                // Ten perimeter sockets, measured from the reference, support the long payloads.
                const edgeStations = [.973, 2.128, 3.2837, 4.439];
                const edgeMounts = [];
                for (const x of edgeStations) for (const side of [-1, 1]) {
                    const edge = side < 0 ? nearEdge : farEdge;
                    efKit.box([x, -.3807, edge + side * .14944], [.68463, .59339, .29889], palette.hull);
                    efKit.box([x, -.38442, edge + side * .37039], [.59685, .51689, .143], palette.silver);
                    edgeMounts.push([x, -.38442, edge + side * .44189]);
                    ring(efKit, [x, -.38442, edge + side * .445], .20, 'z', palette.rail, .023);
                }
                for (const [x, y, z] of [[5.22945, -.38070, -.01997], [5.23873, -.40997, 2.06760]]) {
                    efKit.box([x, y, z], [.29889, .59339, .68463], palette.hull);
                    efKit.box([x + .22, y, z], [.143, .51689, .59685], palette.silver);
                    edgeMounts.push([x + .2915, y, z]);
                }
                ef.userData.perimeterSockets = edgeMounts;
                // The three low octagonal deck fittings are visible in the supplied top view.
                for (const [x, z, turn] of [[3.2994, .04147, 0], [3.29937, 1.98494, 0], [4.56943, 1.02644, Math.PI / 2]]) {
                    efKit.add(new THREE.CylinderGeometry(.342, .342, .29812, 8), material(palette.hull), [x, deckTop + .14906, z], [1, 1, .867], [0, turn + Math.PI / 8, 0]);
                    ring(efKit, [x, deckTop + .307, z], .238, 'y', palette.rail, .024);
                    efKit.cylinder([x, deckTop + .302, z], .184, .025, palette.white, [0, 0, 0]);
                    efKit.cylinder([x, deckTop + .323, z], .064, .025, palette.rail, [0, 0, 0]);
                    for (let n = 0; n < 3; n++) {
                        const a = n * Math.PI * 2 / 3;
                        efKit.cylinder([x + .139 * Math.cos(a), deckTop + .327, z + .139 * Math.sin(a)], .035, .025, palette.dark, [0, 0, 0]);
                    }
                }
                // Compact deck ORUs and gold handles retain the procedural render.
                const deckPanel = (x, z, w, d) => {
                    const h = .413904;
                    efKit.box([x, deckTop + h / 2, z], [w, h, d], palette.white);
                    for (const dx of [-w * .32, w * .32]) for (const dz of [-d * .30, d * .30]) {
                        efKit.box([x + dx, deckTop + h + .014, z + dz], [.065, .025, .085], 0x929c99, [0, 0, 0], false);
                        efKit.cylinder([x + dx, deckTop + h + .034, z + dz], .015, .02, palette.rail, [0, 0, 0]);
                    }
                    efKit.rod([x - w * .17, deckTop + h + .041, z], [x + w * .17, deckTop + h + .041, z], .016, palette.gold);
                };
                for (let n = 0; n < 4; n++) deckPanel(.66 + n * .51, 1.13, .44, .63);
                for (let n = 0; n < 2; n++) deckPanel(4.08 + n * .49, .12, .40, .57);
                for (let n = 0; n < 2; n++) deckPanel(3.94 + n * .45, 2.10, .37, .50);
                for (const [x, z] of [[.68, .08], [1.20, .08], [2.57, .47], [2.69, 1.26]]) {
                    efKit.box([x, deckTop + .1, z], [.27, .15, .29], palette.silver);
                    efKit.box([x, deckTop + .19, z], [.19, .03, .19], palette.hull);
                }
                const grapple = (k, x, y, z) => {
                    k.cylinder([x, y + .019, z], .29, .038, 0xb5a887, [0, 0, 0]);
                    ring(k, [x, y + .041, z], .267, 'y', palette.silver, .016);
                    k.cylinder([x, y + .057, z], .061, .064, palette.silver, [0, 0, 0]);
                    for (let n = 0; n < 3; n++) {
                        const a = n * Math.PI * 2 / 3 + .2;
                        k.rod([x + Math.cos(a) * .061, y + .070, z + Math.sin(a) * .061], [x + Math.cos(a) * .19, y + .10, z + Math.sin(a) * .19], .016, palette.silver);
                    }
                };
                for (const [x, z] of [[2.03545, 2.01681], [2.03612, .04295]]) grapple(efKit, x, deckTop + .025, z);
                // Four corner outriggers lie beside, rather than outside a widened deck.
                for (const x of [.23965, 5.03015]) for (const [edge, z] of [[nearEdge, -1.26174], [farEdge, 3.32151]]) {
                    efKit.rod([x, .3695, edge], [x, .3695, z], .035, palette.silver);
                    efKit.box([x, .3695, z], [.63459, .40898, .028], 0xbaae8d);
                    efKit.box([x, .3695, z], [.055, .48, .14], palette.silver);
                }
                // The two lower support triangles remain attached to the distal deck structure.
                for (const z of [.181, 1.879]) {
                    efKit.rod([4.46, -.71665, z], [5.04, -2.22, z], .036, palette.silver);
                    efKit.rod([5.02, -.71665, z], [5.04, -2.22, z], .036, palette.silver);
                    efKit.rod([4.46, -.71665, z], [5.02, -.71665, z], .035, palette.silver);
                }
                efKit.finish(ef);
                // Seven instruments, including OCO-3 and ECOSTRESS, which are separate
                // scene roots in the source file rather than children of node92.
                const payloads = [
                    { name: 'Forward instrument', center: [.97290647, -.38442150, 4.00344181], size: [.82702392, 1.03377688, 1.90928817], grapple: [.97432876, .171, 3.6762414] },
                    { name: 'OCO-3', center: [2.11076593, -.48857705, 3.82613015], size: [.73736095, 1.01999962, 1.84064102], grapple: [2.12838, .0795, 3.66207] },
                    { name: 'ICS dish payload', center: [4.43893480, -.38442168, 4.00616074], size: [.82702351, 1.03377688, 1.91472626], grapple: [4.44037437, .171, 3.67623997], dish: true },
                    { name: 'Opposite-side instrument', center: [3.28366208, -.38442147, -1.84965289], size: [.82702398, 1.033777, 1.72123647], grapple: [3.28435612, .171, -1.61647487] },
                    { name: 'CATS', center: [4.43893181, -.38442209, -1.77815232], size: [.82702425, 1.03377694, 1.86423737], grapple: [4.43708, .168, -1.59513] },
                    { name: 'Distal instrument', center: [6.48581505, -.41369241, 2.06650233], size: [1.90928888, 1.033777, .82702386], grapple: [6.162961, .14517, 2.06468153] },
                    { name: 'ECOSTRESS', center: [6.37842846, -.37841497, -.01551128], size: [1.99905968, .77874541, .80000114], grapple: [6.21752, .14017, -.01508] }
                ];
                ef.userData.payloads = payloads;
                for (const payload of payloads) {
                    const assembly = new THREE.Group(), pk = new Kit(); assembly.name = 'Kibo EF / ' + payload.name;
                    const [x, y, z] = payload.center, [w, h, d] = payload.size;
                    assembly.userData.referenceCenter = payload.center; assembly.userData.referenceSize = payload.size;
                    // Fold lines on white thermal covers, with a recessed well for the ICS reflector.
                    if (payload.dish) {
                        pk.box([x, y, 3.526], [w, h, .954], palette.white);
                        pk.box([x, y - h / 2 + .06, 4.484], [w, .12, .96], palette.silver);
                        for (const side of [-1, 1]) pk.box([x + side * (w / 2 - .025), y, 4.484], [.05, h, .96], palette.white);
                        pk.box([x, y, 4.939], [w, h, .05], palette.white);
                        pk.add(new THREE.SphereGeometry(.3552, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), material(palette.silver, .32, .7), [4.445709, -.472, 4.427698], [1, .595, 1]);
                        ring(pk, [4.445709, -.467, 4.427698], .3552, 'y', palette.hull, .017);
                    } else {
                        pk.box(payload.center, payload.size, palette.white);
                        for (let n = 0; n < 5; n++) {
                            const zz = z - d * .43 + n * d * .21;
                            pk.rod([x - w * .43, y + h / 2 + .009, zz], [x + w * .43, y + h / 2 + .012, zz + d * .025], .006, 0xc5cac5);
                        }
                    }
                    for (const side of [-1, 1]) {
                        const xx = x + side * w * .501;
                        for (let n = 0; n < 4; n++) {
                            const zz = z - d * .40 + n * d * .26;
                            pk.rod([xx, y - h * .42, zz], [xx, y + h * .41, zz + d * .05], .008, 0xc5cac5);
                        }
                    }
                    const coverTop = y + h / 2, fixtureBase = payload.grapple[1];
                    if (fixtureBase > coverTop) pk.cylinder([payload.grapple[0], (coverTop + fixtureBase) / 2, payload.grapple[2]], .17, fixtureBase - coverTop + .005, palette.hull, [0, 0, 0]);
                    grapple(pk, ...payload.grapple);
                    if (payload.name === 'OCO-3') {
                        pk.box([x, y, z + d / 2 + .012], [.52, .48, .025], 0x5e6b70);
                        pk.cylinder([x, y + h / 2 + .029, z + .60], .098, .035, palette.silver, [0, 0, 0]);
                    } else if (!payload.dish) {
                        const alongX = w > d, outward = Math.sign(z - deckCenter[2]);
                        pk.box([x + (alongX ? w / 2 + .006 : 0), y, z + (alongX ? 0 : outward * (d / 2 + .006))], alongX ? [.015, h * .64, d * .66] : [w * .66, h * .64, .015], 0x82908f, [0, 0, 0], false);
                    }
                    pk.finish(assembly); ef.add(assembly);
                }
                group.add(ef);
                group.userData.exposedPayloads = 7;
                group.userData.referenceDeckFittings = 3;

                // Reference pose: the two long JEMRMS booms run along the deck,
                // with six joint centers measured from GLB nodes91 through86.
                const jemJoints = [[-14.04973583, .87617767, -6.38100929], [-14.80628853, 1.17227912, -6.05433578], [-14.80625992, 1.58075106, -6.58349724], [-18.87270527, 1.58075106, -6.04686089], [-22.94708042, 1.58075106, -5.52672882], [-23.39033108, 2.09615254, -5.53832550]];
                group.userData.jemJointCenters = jemJoints;
                // Shaft axes differ from joint origins: the elbow/wrist housings step sideways.
                const jemBooms = [
                    { start: [-14.71328, 1.58075106, -6.57210], end: [-19.01376, 1.58075106, -6.57210], radius: .1461 },
                    { start: [-18.86140, 1.58075106, -6.05519], end: [-23.08941, 1.58075106, -6.05519], radius: .1586 }
                ];
                group.userData.jemBoomCenterlines = jemBooms;
                group.userData.jemLongBoomLengths = jemBooms.map(b => new THREE.Vector3(...b.start).distanceTo(new THREE.Vector3(...b.end)));
                const arm = new THREE.Group(), armKit = new Kit(); arm.name = 'Kibo JEMRMS reference pose';
                armKit.box([-14.085, .876, -6.381], [.14, .61, .64], palette.silver);
                for (const dz of [-.23, .23]) armKit.rod([-14.075, .56, -6.381 + dz], jemJoints[1], .045, palette.silver);
                jemJoints.forEach((joint, index) => {
                    const rotation = index === 0 || index === 4 ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
                    armKit.cylinder(joint, .20, .39, palette.white, rotation);
                    armKit.cylinder(joint, .207, .064, palette.silver, rotation);
                    if (index < jemJoints.length - 1 && index !== 2 && index !== 3) armKit.rod(joint, jemJoints[index + 1], .16, palette.white);
                });
                jemBooms.forEach((boom, i) => {
                    const a = new THREE.Vector3(...boom.start), b = new THREE.Vector3(...boom.end);
                    armKit.rod(boom.start, boom.end, boom.radius, palette.white);
                    const cable = point => point.clone().add(new THREE.Vector3(0, 0, -boom.radius - .011)).toArray();
                    armKit.rod(cable(a.clone().lerp(b, .055)), cable(a.clone().lerp(b, .945)), .012, palette.silver);
                    for (const t of [.10, .29, .49, .69, .89]) armKit.rod(a.clone().lerp(b, t).toArray(), a.clone().lerp(b, t + .014).toArray(), boom.radius + .009, palette.hull);
                    const nextJoint = jemJoints[i + 3];
                    armKit.rod([nextJoint[0], nextJoint[1], boom.end[2]], nextJoint, .16, palette.white);
                    armKit.cylinder([nextJoint[0], nextJoint[1], boom.end[2]], .205, .09, palette.silver);
                });
                // Joint-mounted cameras and short wrist section follow the same arm pose.
                for (const index of [3, 5]) {
                    const [x, y, z] = jemJoints[index];
                    armKit.box([x, y + .03, z - .30], [.27, .20, .22], palette.white);
                    armKit.cylinder([x, y + .03, z - .44], .069, .09, palette.dark);
                    armKit.rod([x, y, z - .16], [x, y, z - .25], .028, palette.silver);
                }
                const [wristX, wristY, wristZ] = jemJoints[5];
                armKit.rod(jemJoints[5], [wristX - 1.20, wristY, wristZ], .125, palette.white);
                armKit.add(new THREE.CylinderGeometry(.19, .19, .43, 28, 1, true), material(palette.white), [wristX - 1.20, wristY, wristZ], [1, 1, 1], [0, 0, Math.PI / 2]);
                ring(armKit, [wristX - 1.415, wristY, wristZ], .19, 'x', palette.silver, .024);
                armKit.cylinder([wristX - 1.31, wristY, wristZ], .165, .02, palette.dark, [0, 0, Math.PI / 2]);
                for (let n = 0; n < 3; n++) {
                    const a = n * Math.PI * 2 / 3, b = a + Math.PI * 2 / 3;
                    armKit.rod([wristX - 1.37, wristY + Math.cos(a) * .15, wristZ + Math.sin(a) * .15], [wristX - 1.37, wristY + Math.cos(b) * .15, wristZ + Math.sin(b) * .15], .01, palette.silver);
                }
                armKit.finish(arm); group.add(arm);
                hullBadge(kit, 'KIBO', [-7.3, 0, -4.7], 2.23, [1.3, .34], 'x');
            });
            // BEGIN COLUMBUS CREW REFERENCE: 'Human' by doctortex (CC BY 4.0), the clothed body only (no shoes' insides, no sunglasses,
            // no eyelashes). Metres, quantised to 1/4096 m, in the model's own frame: x to the figure's left, y up, z forward, soles at
            // y = 0. Meshes were decimated by quadric edge collapse and the skin hidden under the shirt and shorts was cut away (a
            // 3 cm band stays under each hem, sunk 1 cm). `colors` are linear RGB bytes baked from the model's textures: skin and
            // eyes in colour, fabric as shading only. `skin` holds, per vertex, its three strongest bones and the weights of the
            // second and third. `bones` is the 52-bone Mixamo rig as [name, parent, translation, rotation] in the bind pose; `poses`
            // are local rotations per bone and `roots` the hip position for each crew member, solved from hand, foot, pelvis, chest
            // and gaze targets. `axes` are bone-local axes for finger curl, elbow and wrist bend and head turns.
            const columbusCrewHuman = assetData.columbusCrewHuman;
            // END COLUMBUS CREW REFERENCE
            // BEGIN COLUMBUS CREW MOTION: work loops for Crew 1 (30 s) and Crew 3 (36 s), keyed from the same solver. Each key is a
            // full pose (int16 quaternions per bone, key by key), the hip position and a root transform: for Crew 1 an offset and
            // turn from its place at the laptop, for Crew 3 the transform of the group it floats in. `type` and `pad` say when
            // Crew 1 types or works the touchpad. `axes` are bone-local axes for breathing and for the floating legs.
            const columbusCrewMotion = assetData.columbusCrewMotion;
            // END COLUMBUS CREW MOTION
            part('columbus', 'Columbus laboratory', '09 / EUROPE - ESA', 'Europe\'s laboratory, drawn after ESA\'s cutaway illustration. A 75%-transparent section of the hull shows racks along the far wall and deck of a square aisle, three crew at work (one at a laptop who types, stops to read, uses the touchpad, reaches up to a rack switch and now and then turns, one hand still on the laptop, to watch the crew member beside him with his chin on his fist; one with both hands in the glovebox; one who holds a rack rail while working a panel, then pushes off and glides to the next rail) and the Harmony hatch at the far end; the near-wall and overhead racks are left out so the cabin stays in view. The outboard end cone carries a platform with SOLAR and a gold instrument box above, and a white frame of finned instrument boxes below. Rack contents, crew poses and payload shapes are illustrative.', [['Joined station', 'FEB 2008'], ['Hull window', '75% transparent']], [4.965376, 1.0, -4.7], (kit, group) => {
                group.position.x = -1.134624;
                group.userData.connectionTranslation = [-1.134624, 0, 0];
                // Rebuilt after ESA's Columbus cutaway illustration. Local frame: the module axis is z (+z outboard, toward the
                // payloads; -z toward Harmony), +x faces forward (world -z) and +y is zenith. Over the forward-upper half, from the
                // deck edge over the top and from the outboard cone to the last ring frame, the opaque shell gives way to a
                // 75%-transparent skin; the near-wall and overhead rack rows are left out so the cabin stays in view.
                const tube = new THREE.Group(), shell = new THREE.Group(), framework = new THREE.Group(), interior = new THREE.Group(), external = new THREE.Group();
                tube.name = 'Columbus module'; shell.name = 'Columbus shell and end cones'; framework.name = 'Columbus exposed frames';
                interior.name = 'Columbus cabin'; external.name = 'Columbus external payloads';
                tube.position.set(6.1, 0, -4.7); tube.rotation.y = Math.PI / 2; group.add(tube); tube.add(shell, framework, interior, external);
                const R = 2.15, Rp = 1.98, barrel = 2.45, coneEnd = 3.4, coneR = 1.3, aisle = .95, rackDepth = .72;
                const open = { a0: -58 * Math.PI / 180, a1: 122 * Math.PI / 180, z0: -2.15, z1: barrel };
                const at = (r, a, z) => [Math.cos(a) * r, Math.sin(a) * r, z];
                const twoSided = (color, roughness = .7, metalness = .22) => { const m = material(color, roughness, metalness).clone(); m.side = THREE.DoubleSide; return m; };
                const shellKit = new Kit(), frameKit = new Kit(), cabinKit = new Kit(), payloadKit = new Kit(), racks = [], crew = [];
                // A band of a surface of revolution from (r0, z0) to (r1, z1) over angles a0..a1. Double-sided, so winding is free.
                function sweep(target, r0, z0, r1, z1, a0, a1, surface) {
                    const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 32))), positions = [], uvs = [], indices = [];
                    for (let row = 0; row < 2; row++) for (let i = 0; i <= steps; i++) {
                        positions.push(...at(row ? r1 : r0, a0 + (a1 - a0) * i / steps, row ? z1 : z0)); uvs.push(i / steps, row);
                    }
                    for (let i = 0; i < steps; i++) { const j = i + steps + 1; indices.push(i, i + 1, j, j, i + 1, j + 1); }
                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                    geometry.setIndex(indices); geometry.computeVertexNormals();
                    target.add(geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                function quad(target, corners, surface) {
                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
                    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
                    geometry.setIndex([0, 1, 2, 0, 2, 3]); geometry.computeVertexNormals();
                    target.add(geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                function arc(target, r, z, a0, a1, radius, color) {
                    const points = [], steps = Math.max(8, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 40)));
                    for (let i = 0; i <= steps; i++) points.push(new THREE.Vector3(...at(r, a0 + (a1 - a0) * i / steps, z)));
                    target.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps * 2, radius, 6, false), material(color, .6, .3), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                const fastenerShape = new THREE.CylinderGeometry(.018, .018, .014, 8), fastenerMetal = material(0x5d6664, .5, .45);
                const fastener = (target, r, a, z) => target.add(fastenerShape.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vertical, new THREE.Vector3(Math.cos(a), Math.sin(a), 0))), fastenerMetal, at(r, a, z), [1, 1, 1], [0, 0, 0], false);
                const railAlong = (target, a, za, zb) => {
                    target.rod(at(R + .1, a, za), at(R + .1, a, zb), .016, palette.gold);
                    for (const z of [za, zb]) target.rod(at(R + .006, a, z), at(R + .1, a, z), .013, palette.gold);
                };

                // Shell: MMOD bumper panels in twelve columns and four bays over a dark base skin that reads as the seams.
                const seamSkin = twoSided(0x5f6866, .8, .2), panelSkins = [0xcdd1cb, 0xc3c9c5, 0xd6d9d2, 0xbfc6c2].map(c => twoSided(c, .64, .3));
                sweep(shellKit, R - .005, -barrel, R - .005, open.z0, 0, Math.PI * 2, seamSkin);
                sweep(shellKit, R - .005, open.z0, R - .005, barrel, open.a1, open.a0 + Math.PI * 2, seamSkin);
                const bays = [-barrel, open.z0, -1.05, .1, 1.28, barrel];
                for (let bay = 0; bay < 5; bay++) for (let k = 0; k < 12; k++) {
                    if (bay > 0 && k >= 6) continue; // these six columns form the opening
                    const a0 = open.a1 + k * Math.PI / 6 + .006, a1 = a0 + Math.PI / 6 - .012, z0 = bays[bay] + .018, z1 = bays[bay + 1] - .018;
                    sweep(shellKit, R + .004, z0, R + .004, z1, a0, a1, panelSkins[(bay * 5 + k * 3) % 4]);
                    for (const a of [a0 + .03, (a0 + a1) / 2, a1 - .03]) for (const z of [z0 + .06, z1 - .06]) fastener(shellKit, R + .012, a, z);
                    if ((bay + k) % 3 === 0) railAlong(shellKit, a0 + .09, z0 + .28, z1 - .28);
                }
                // Truncated end cones in twelve sector panels, rimmed at both edges.
                const lerp = (u, v, t) => u + (v - u) * t;
                for (const end of [-1, 1]) {
                    const reach = end < 0 ? 2.778732 : coneEnd, neckR = end < 0 ? 1.103418 : coneR;
                    sweep(shellKit, R - .005, end * barrel, neckR - .005, end * reach, 0, Math.PI * 2, seamSkin);
                    for (let k = 0; k < 12; k++) {
                        const a0 = open.a1 + k * Math.PI / 6 + .008, a1 = a0 + Math.PI / 6 - .016;
                        sweep(shellKit, lerp(R, neckR, .03) + .004, end * lerp(barrel, reach, .03), lerp(R, neckR, .97) + .004, end * lerp(barrel, reach, .97), a0, a1, panelSkins[(k * 3 + (end > 0 ? 1 : 2)) % 4]);
                        if (k % 3 === 1) { const a = (a0 + a1) / 2; shellKit.rod(at(lerp(R, neckR, .3) + .09, a, end * lerp(barrel, reach, .3)), at(lerp(R, neckR, .72) + .09, a, end * lerp(barrel, reach, .72)), .016, palette.gold); }
                    }
                    ring(shellKit, [0, 0, end * barrel], R + .012, 'z', palette.silver, .035);
                    ring(shellKit, [0, 0, end * reach], neckR + .01, 'z', palette.silver, .03);
                }
                // Outboard end: a stepped rim and a dished central cover with radial ribs.
                sweep(shellKit, coneR, coneEnd, 1.18, coneEnd, 0, Math.PI * 2, twoSided(0xb7beba));
                sweep(shellKit, 1.18, coneEnd, 1.18, coneEnd + .09, 0, Math.PI * 2, twoSided(0xc9cdc7));
                ring(shellKit, [0, 0, coneEnd + .09], 1.185, 'z', palette.silver, .03);
                const dishDepth = .17, dishZ = r => coneEnd + .09 - dishDepth * (1 - (r / 1.16) ** 2);
                const dishProfile = []; for (let i = 0; i <= 14; i++) { const r = 1.16 * (1 - i / 14); dishProfile.push(new THREE.Vector2(r, dishZ(r))); }
                shellKit.add(new THREE.LatheGeometry(dishProfile, 56).rotateX(Math.PI / 2), twoSided(0x8f9895, .5, .38), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                for (let rib = 0; rib < 8; rib++) {
                    const a = rib * Math.PI / 4;
                    shellKit.rod(at(.2, a, dishZ(.2) + .02), at(1.1, a, dishZ(1.1) + .02), .02, palette.silver);
                }
                shellKit.cylinder([0, 0, dishZ(0) + .03], .2, .06, palette.silver);
                // Compact inboard cone terminates at the shared Harmony passive CBM.
                group.userData.inboardJoint = { barrelPlane: 2.515376, throatPlane: 2.186644, radius: 1.103418 };
                // A small gold box on the near side of the barrel by the Harmony end, as in the illustration.
                shellKit.add(shapes.box, material(0xc49a2c, .6, .45), at(R + .17, .1, -2.15), [.3, .36, .34], [0, 0, .1]);
                // ESA mark and the module name on the lower forward hull, as a patch that follows the barrel.
                {
                    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256; const g = canvas.getContext('2d');
                    g.fillStyle = '#0d3b8c'; g.beginPath(); g.arc(118, 128, 92, 0, Math.PI * 2); g.fill();
                    g.fillStyle = '#f3f5f8'; g.font = 'bold 150px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('e', 120, 120);
                    g.fillStyle = '#0d3b8c'; g.textAlign = 'left'; g.font = 'bold 150px Arial, sans-serif'; g.fillText('esa', 232, 122);
                    g.fillStyle = '#16306f'; g.font = 'italic bold 108px Arial, sans-serif'; g.fillText('Columbus', 520, 130);
                    const ink = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2 });
                    ink.map.colorSpace = THREE.SRGBColorSpace; ink.userData.decal = true;
                    const za = -.25, zb = -2.05, aMid = -72 * Math.PI / 180, half = .225 / R, nu = 20, nv = 6, positions = [], uvs = [], index = [];
                    for (let q = 0; q <= nv; q++) for (let p = 0; p <= nu; p++) { positions.push(...at(R + .018, aMid - half + 2 * half * q / nv, za + (zb - za) * p / nu)); uvs.push(p / nu, q / nv); }
                    for (let q = 0; q < nv; q++) for (let p = 0; p < nu; p++) { const A = q * (nu + 1) + p, B = A + 1, C = A + nu + 1, D = C + 1; index.push(A, B, C, B, D, C); }
                    const patch = new THREE.BufferGeometry(); patch.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); patch.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); patch.setIndex(index); patch.computeVertexNormals();
                    shellKit.add(patch, ink, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                // Cut faces show the wall section around the opening, with a beam along each long edge.
                const cutFace = twoSided(0xe4e6df, .82, .08);
                for (const a of [open.a0, open.a1]) quad(shellKit, [at(Rp, a, open.z0), at(R + .012, a, open.z0), at(R + .012, a, open.z1), at(Rp, a, open.z1)], cutFace);
                for (const z of [open.z0, open.z1]) sweep(shellKit, Rp, z, R + .012, z, open.a0, open.a1, cutFace);
                for (const a of [open.a0, open.a1]) {
                    frameKit.rod(at(2.066, a, open.z0), at(2.066, a, open.z1), .045, 0xd6d9d2);
                    for (let n = 1; n < 12; n++) frameKit.box(at(2.066, a, open.z0 + (open.z1 - open.z0) * n / 12), [.13, .13, .05], 0xbfc4be, [0, 0, a], false);
                }
                // Ring frames exposed at both ends of the opening: two arcs joined by an X lattice.
                for (const z of [open.z0 + .02, open.z1 - .06]) {
                    const lo = open.a0 - .04, hi = open.a1 + .04, n = 16;
                    for (const r of [1.72, 1.96]) arc(frameKit, r, z, lo, hi, .032, 0xdfe2db);
                    for (let i = 0; i < n; i++) {
                        const a = lo + (hi - lo) * i / n, b = lo + (hi - lo) * (i + 1) / n;
                        frameKit.rod(at(1.72, a, z), at(1.96, b, z), .016, 0xc5c9c3);
                        frameKit.rod(at(1.96, a, z), at(1.72, b, z), .016, 0xc5c9c3);
                    }
                }
                shellKit.finish(shell); frameKit.finish(framework);
                // The see-through section: a 75%-transparent outer skin, drawn from outside only, so the module reads closed.
                const clearSkin = new THREE.MeshStandardMaterial({ color: 0xd3d8d4, roughness: .35, metalness: .08, transparent: true, opacity: .25, depthWrite: false });
                const glazing = new THREE.Group(), glazingKit = new Kit(); glazing.name = 'Columbus see-through hull section';
                sweep(glazingKit, R + .002, open.z0, R + .002, open.z1, open.a0, open.a1, clearSkin);
                // Panel seams continue faintly across it; kept out of the selection tint with the skin itself.
                for (let k = 1; k < 6; k++) { const a = open.a0 + k * Math.PI / 6; glazingKit.line([at(R + .006, a, open.z0), at(R + .006, a, open.z1)]); }
                for (const z of bays.slice(2, -1)) glazingKit.line(Array.from({ length: 25 }, (_, i) => at(R + .006, open.a0 + (open.a1 - open.a0) * i / 24, z)));
                glazingKit.finish(glazing); shell.add(glazing);
                glazing.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; object.renderOrder = 2; } });

                // Cabin: the pressure-shell liner and closed end bulkheads.
                const linerSkin = twoSided(0xd8dbd3, .85, .06);
                sweep(cabinKit, Rp, -barrel, Rp, open.z0, 0, Math.PI * 2, linerSkin);
                sweep(cabinKit, Rp, open.z0, Rp, barrel, open.a1, open.a0 + Math.PI * 2, linerSkin);
                function panelTexture(kind, seed) {
                    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 416;
                    const g = canvas.getContext('2d');
                    let state = seed * 7919 + 13; const rand = () => { state = (state * 16807) % 2147483647; return (state - 1) / 2147483646; };
                    const tones = { lab: ['#e5e7df', '#d5d9d1', '#eef0e8'], floor: ['#b3b8b2', '#a6aca7', '#bdc2bc'], ceiling: ['#8c9490', '#7e8783', '#98a09b'], stow: ['#dde0d7', '#d0d4cc', '#e5e7df'] }[kind];
                    g.fillStyle = tones[0]; g.fillRect(0, 0, 256, 416);
                    for (let y = 6; y < 404;) {
                        const h = Math.min(410 - y, 42 + Math.floor(rand() * 70));
                        g.fillStyle = tones[Math.floor(rand() * 3)]; g.fillRect(6, y, 244, h - 4);
                        g.strokeStyle = 'rgba(70,80,76,.55)'; g.lineWidth = 1.5; g.strokeRect(6.5, y + .5, 243, h - 5);
                        if (kind === 'lab') {
                            const style = Math.floor(rand() * 4);
                            if (style === 0) for (let k = 0; k < 8; k++) { g.fillStyle = k % 3 ? '#4f5a57' : '#2f6f63'; g.fillRect(16 + k * 27, y + 10, 14, 9); }
                            if (style === 1) { g.fillStyle = '#2d4e57'; g.fillRect(140, y + 8, 96, Math.min(h - 18, 44)); g.fillStyle = '#7fc4b7'; g.fillRect(147, y + 14, 60, 3); g.fillRect(147, y + 21, 80, 3); }
                            if (style === 2) for (let k = 0; k < 5; k++) { g.fillStyle = '#6f7a76'; g.beginPath(); g.arc(26 + k * 30, y + h / 2 - 2, 8, 0, Math.PI * 2); g.fill(); g.fillStyle = '#c9cec7'; g.beginPath(); g.arc(26 + k * 30, y + h / 2 - 2, 3.5, 0, Math.PI * 2); g.fill(); }
                            if (style === 3) { g.fillStyle = '#9aa39e'; g.fillRect(16, y + h / 2 - 4, 120, 6); g.fillStyle = '#b4382f'; g.fillRect(222, y + 9, 14, 8); }
                            g.fillStyle = '#6b7470'; g.fillRect(16, y + h - 15, 52, 3);
                        } else if (kind === 'floor') {
                            if (rand() < .5) { g.fillStyle = '#cfb349'; g.fillRect(20 + rand() * 150, y + 8, 30, 8); }
                            g.strokeStyle = 'rgba(60,66,64,.5)';
                            for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(20, y + 16 + k * 8); g.lineTo(92, y + 16 + k * 8); g.stroke(); }
                        } else if (kind === 'ceiling') {
                            if (rand() < .5) for (let k = 0; k < 9; k++) { g.fillStyle = '#5c6562'; g.fillRect(20 + k * 24, y + 10, 12, h - 26); }
                            else { g.fillStyle = '#6a736f'; g.fillRect(20, y + 10, 100, h - 26); g.fillRect(136, y + 10, 100, h - 26); }
                        } else {
                            for (let k = 0; k < 4; k++) { g.strokeStyle = 'rgba(80,90,86,.6)'; g.strokeRect(12 + k * 60, y + 6, 54, h - 16); g.fillStyle = '#8e9893'; g.fillRect(30 + k * 60, y + h / 2 - 4, 18, 4); }
                        }
                        g.fillStyle = '#6a726e';
                        for (const xx of [12, 244]) for (const yy of [y + 7, y + h - 11]) { g.beginPath(); g.arc(xx, yy, 2.2, 0, Math.PI * 2); g.fill(); }
                        y += h;
                    }
                    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
                    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return texture;
                }
                // One rack: its front faces +x at x = 0 and its body runs back to -x; height along y, width along z.
                const rackBody = material(0x9ea8a3, .78, .18), rackPost = 0xd1d5ce;
                function rackUnit(name, texture, extras) {
                    const rack = new THREE.Group(), rk = new Kit(); rack.name = name;
                    rk.add(shapes.box, rackBody, [-rackDepth / 2, 0, 0], [rackDepth - .02, 1.68, 1.0], [0, 0, 0], false);
                    rk.add(new THREE.PlaneGeometry(.99, 1.64), material(0xffffff, .82, .05, texture), [.004, 0, 0], [1, 1, 1], [0, Math.PI / 2, 0], false);
                    for (const z of [-.5, .5]) rk.box([-.02, 0, z], [.07, 1.72, .045], rackPost, [0, 0, 0], false);
                    for (const y of [-.845, .845]) rk.box([-.02, y, 0], [.07, .045, 1.04], rackPost, [0, 0, 0], false);
                    if (extras) extras(rk);
                    rk.finish(rack); racks.push(rack); return rack;
                }
                const laptopCanvas = document.createElement('canvas'); laptopCanvas.width = 160; laptopCanvas.height = 104;
                const lg = laptopCanvas.getContext('2d'), sky = lg.createLinearGradient(0, 0, 0, 104);
                sky.addColorStop(0, '#2a5fae'); sky.addColorStop(1, '#173a78'); lg.fillStyle = sky; lg.fillRect(0, 0, 160, 104);
                lg.fillStyle = '#e8eef5'; lg.beginPath(); lg.arc(60, 50, 24, 0, Math.PI * 2); lg.fill();
                lg.fillStyle = '#d6573f'; lg.fillRect(92, 26, 42, 28); lg.fillStyle = '#6fc1a1'; lg.fillRect(92, 60, 42, 14);
                const laptopScreen = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(laptopCanvas) }); laptopScreen.map.colorSpace = THREE.SRGBColorSpace;
                // Far-wall and deck rows; the overhead and near-wall rows lie inside the cut.
                const rows = [
                    { name: 'Wall rack', position: z => [-aisle, 0, z], roll: 0, kind: 'lab' },
                    { name: 'Deck rack', position: z => [0, -aisle, z], roll: Math.PI / 2, kind: 'floor' }
                ];
                rows.forEach((row, rowIndex) => [-1.65, -.55, .55, 1.65].forEach((z, bay) => {
                    const unit = rackUnit(row.name + ' ' + (bay + 1), panelTexture(row.kind, rowIndex * 10 + bay + 1), rk => {
                        if (rowIndex === 0 && bay === 3) {
                            // A fold-out shelf with the laptop that the first crew member is using.
                            rk.box([.19, .02, -.26], [.36, .03, .48], 0xc3c8c2, [0, 0, 0], false);
                            rk.box([.22, .045, -.26], [.24, .018, .34], 0x2d3134, [0, 0, 0], false);
                            rk.box([.1, .16, -.26], [.018, .22, .34], 0x2d3134, [0, 0, .32], false);
                            rk.add(new THREE.PlaneGeometry(.3, .19).rotateY(Math.PI / 2).rotateZ(.32), laptopScreen, [.112, .163, -.26], [1, 1, 1], [0, 0, 0], false);
                        }
                        if (rowIndex === 0 && bay === 2) {
                    // A glovebox: a light frame with a clear top and two round glove ports, where the second crew member works.
                    rk.box([.15, .3, -.1], [.3, .36, .62], 0xc7ccc9, [0, 0, 0], false);
                    rk.box([.17, .495, -.1], [.25, .03, .56], 0x9db7bf, [0, 0, 0], false);
                    for (const z of [-.23, .03]) { rk.add(new THREE.TorusGeometry(.07, .016, 8, 24), material(0x5c6461, .5, .3), [.305, .3, z], [1, 1, 1], [0, Math.PI / 2, 0], false); rk.add(new THREE.CircleGeometry(.066, 20), material(0x23292b, .8, .1), [.302, .3, z], [1, 1, 1], [0, Math.PI / 2, 0], false); }
                    rk.box([.31, .43, -.1], [.02, .05, .5], 0x8b9491, [0, 0, 0], false);
                }
                        if (rowIndex === 1) for (const y of [-.25, .35]) {
                            // Deck foot-restraint loops.
                            rk.rod([.05, y, -.22], [.05, y, .22], .012, palette.dark);
                            for (const zz of [-.22, .22]) rk.rod([.005, y, zz], [.05, y, zz], .01, palette.dark);
                        }
                        if (rowIndex === 0) for (const y of [-.55, .1, .6]) rk.rod([.03, y, -.3], [.03, y, .1], .01, 0x7c8581);
                    });
                    unit.position.fromArray(row.position(z)); unit.rotation.z = row.roll; interior.add(unit);
                }));
                // Corner strips: a light bar along the far overhead edge, utility rails along both deck edges.
                const lamp = new THREE.MeshBasicMaterial({ color: 0xf8f5e6 });
                cabinKit.box([-.905, .905, 0], [.1, .1, 4.36], 0xd9dcd4, [0, 0, 0], false);
                cabinKit.add(shapes.box, lamp, [-.86, .86, 0], [.03, .03, 4.2], [0, 0, Math.PI / 4], false);
                for (const sx of [-1, 1]) {
                    cabinKit.box([sx * .905, -.905, 0], [.1, .1, 4.36], 0x88918d, [0, 0, 0], false);
                    cabinKit.rod([sx * .83, -.83, -2.1], [sx * .83, -.83, 2.1], .018, palette.gold);
                }
                // A dark service duct and equipment boxes run above the far wall, under the remaining roof.
                cabinKit.box([-1.13, 1.2, 0], [.38, .34, 4.3], 0x4b5351, [0, 0, 0], false);
                for (let i = 0; i < 6; i++) cabinKit.box([-1.02, 1.0, -1.9 + i * .76], [.16, .12, .5], i % 2 ? 0x6b7571 : 0x3d4543, [0, 0, 0], false);
                // The cut edge of the deck row shows its lattice side frame, as in the illustration.
                for (const [yTop, yBottom] of [[-.98, -1.44]]) {
                    const x = .93, zA = open.z0 + .04, zB = open.z1 - .06, n = 9;
                    for (const y of [yTop, yBottom]) cabinKit.rod([x, y, zA], [x, y, zB], .02, 0xd4d7d0);
                    for (let i = 0; i < n; i++) {
                        const za = zA + (zB - zA) * i / n, zb = zA + (zB - zA) * (i + 1) / n;
                        cabinKit.rod([x, yTop, za], [x, yBottom, zb], .012, 0xbfc3bd); cabinKit.rod([x, yBottom, za], [x, yTop, zb], .012, 0xbfc3bd);
                    }
                }
                // Harmony-end bulkhead: a closed hatch in a rounded frame, stowage above it and a hand-hold either side.
                const bulkhead = twoSided(0xe1e3dc, .85, .06);
                sweep(cabinKit, 0, -barrel + .02, Rp, -barrel + .02, 0, Math.PI * 2, bulkhead);
                sweep(cabinKit, 0, barrel - .02, Rp, barrel - .02, 0, Math.PI * 2, bulkhead);
                const roundedSquare = (half, radius) => {
                    const s = new THREE.Shape(); s.moveTo(-half + radius, -half); s.lineTo(half - radius, -half); s.quadraticCurveTo(half, -half, half, -half + radius);
                    s.lineTo(half, half - radius); s.quadraticCurveTo(half, half, half - radius, half); s.lineTo(-half + radius, half);
                    s.quadraticCurveTo(-half, half, -half, half - radius); s.lineTo(-half, -half + radius); s.quadraticCurveTo(-half, -half, -half + radius, -half); return s;
                };
                const hatchFrame = roundedSquare(.68, .3); hatchFrame.holes.push(roundedSquare(.56, .24));
                cabinKit.add(new THREE.ExtrudeGeometry(hatchFrame, { depth: .07, bevelEnabled: false, curveSegments: 8 }), material(0xb4bab6, .6, .3), [0, -.05, -barrel + .02], [1, 1, 1], [0, 0, 0], false);
                cabinKit.add(new THREE.ExtrudeGeometry(roundedSquare(.555, .235), { depth: .04, bevelEnabled: false, curveSegments: 8 }), material(0xf1f2ec, .8, .06), [0, -.05, -barrel + .025], [1, 1, 1], [0, 0, 0], false);
                cabinKit.cylinder([0, .2, -barrel + .07], .09, .012, palette.glass);
                ring(cabinKit, [0, .2, -barrel + .075], .1, 'z', palette.silver, .012);
                cabinKit.rod([-.28, -.3, -barrel + .09], [.28, -.3, -barrel + .09], .018, palette.dark);
                for (const x of [-.28, .28]) cabinKit.rod([x, -.3, -barrel + .065], [x, -.3, -barrel + .09], .014, palette.dark);
                for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) cabinKit.box([-.62 + col * .31, .72 + row * .12, -barrel + .09], [.28, .1, .12], row ? 0x4b5452 : 0x5d6764, [0, 0, 0], false);
                for (const x of [-.85, .85]) cabinKit.rod([x, -.5, -barrel + .1], [x, .45, -barrel + .1], .016, palette.gold);
                for (const [x, y, w, h] of [[-.5, 1.35, .9, .5], [.5, 1.35, .9, .5], [0, -1.35, 1.2, .45]]) cabinKit.box([x, y, -barrel + .1], [w, h, .16], 0x505a57, [0, 0, 0], false);
                // Two cabin lamps light the aisle.
                for (const z of [1.1, -1.0]) { const light = new THREE.PointLight(0xf3f6ec, 1.3, 4.5, 1.1); light.position.set(0, .55, z); interior.add(light); }
                const utilities = new THREE.Group(); utilities.name = 'Cabin liner, bulkheads and services'; cabinKit.finish(utilities); interior.add(utilities);

                // Crew: three copies of the supplied human model, each with its own copy of the model's skeleton. A solver placed the
                // hips, chest and head and reached each hand and foot with a two-bone chain that bends like an elbow or a knee: Crew 1's
                // fingertips rest on the laptop keys, Crew 2's hands are through the glovebox ports, Crew 3 floats in the neutral
                // posture of weightlessness. Clothing colours differ per crew member; the shading comes from the model's textures.
                const human = columbusCrewHuman, humanPoints = pmaArray(human.positions, Int16Array), humanPosition = new Float32Array(humanPoints.length);
                for (let i = 0; i < humanPoints.length; i++) humanPosition[i] = humanPoints[i] * human.quantum;
                const humanBones = pmaArray(human.skin, Uint8Array), humanCount = humanPosition.length / 3;
                const humanSkinIndex = new Uint16Array(humanCount * 4), humanSkinWeight = new Float32Array(humanCount * 4);
                for (let i = 0; i < humanCount; i++) {
                    const second = humanBones[i * 5 + 3] / 255, third = humanBones[i * 5 + 4] / 255;
                    for (let k = 0; k < 3; k++) humanSkinIndex[i * 4 + k] = humanBones[i * 5 + k];
                    humanSkinWeight[i * 4] = Math.max(0, 1 - second - third); humanSkinWeight[i * 4 + 1] = second; humanSkinWeight[i * 4 + 2] = third;
                }
                const humanParts = ['skin', 'shirt', 'shorts', 'shoes', 'hair', 'eyes'], humanGroups = humanParts.map(name => pmaArray(human.groups[name], Uint16Array));
                const humanBody = new THREE.BufferGeometry(), humanIndex = new Uint16Array(humanGroups.reduce((count, group) => count + group.length, 0));
                humanBody.setAttribute('position', new THREE.BufferAttribute(humanPosition, 3));
                humanBody.setAttribute('skinIndex', new THREE.BufferAttribute(humanSkinIndex, 4)); humanBody.setAttribute('skinWeight', new THREE.BufferAttribute(humanSkinWeight, 4));
                let humanStart = 0; humanGroups.forEach((group, k) => { humanIndex.set(group, humanStart); humanBody.addGroup(humanStart, group.length, k); humanStart += group.length; });
                humanBody.setIndex(new THREE.BufferAttribute(humanIndex, 1)); humanBody.computeVertexNormals();
                const humanColors = Float32Array.from(pmaArray(human.colors, Uint8Array), value => value / 255);
                humanBody.setAttribute('color', new THREE.BufferAttribute(humanColors, 3));
                const skinBase = human.tones.skin;
                // Stripes run across a shirt by height in the bind pose (6 cm bands), so they stay crisp and follow the body as it bends.
                const humanHeightUv = new THREE.BufferAttribute(new Float32Array(humanCount * 2), 2);
                for (let i = 0; i < humanCount; i++) humanHeightUv.setXY(i, 0, humanPosition[i * 3 + 1] / .12);
                function stripeMap([dark, light]) {
                    const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 64; const g = canvas.getContext('2d');
                    g.fillStyle = light; g.fillRect(0, 0, 2, 32); g.fillStyle = dark; g.fillRect(0, 32, 2, 32);
                    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; return texture;
                }
                const humanAxis = list => new THREE.Vector3(...list);
                function crewMember(name, pose, look, place) {
                    const geometry = new THREE.BufferGeometry();
                    for (const key of ['position', 'normal', 'skinIndex', 'skinWeight']) geometry.setAttribute(key, humanBody.attributes[key]);
                    geometry.setAttribute('color', humanBody.attributes.color); if (look.stripes) geometry.setAttribute('uv', humanHeightUv);
                    geometry.setIndex(humanBody.index); for (const group of humanBody.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
                    // Skin keeps the baked texture, tinted from the model's own tone to this crew member's; fabric takes its colour here.
                    const tone = new THREE.Color(look.skin), fabric = hex => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(1 / human.tones.cloth), vertexColors: true, roughness: .88, metalness: .02, side: THREE.DoubleSide });
                    const materials = [
                        new THREE.MeshStandardMaterial({ color: new THREE.Color(tone.r / skinBase[0], tone.g / skinBase[1], tone.b / skinBase[2]), vertexColors: true, roughness: .6, metalness: .02 }),
                        look.stripes ? Object.assign(fabric(0xffffff), { map: stripeMap(look.stripes) }) : fabric(look.shirt), fabric(look.shorts), fabric(look.shoes), fabric(look.hair),
                        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .04 })
                    ];
                    const bones = human.bones.map(([boneName]) => Object.assign(new THREE.Bone(), { name: boneName }));
                    human.bones.forEach(([, parent, x, y, z, qx, qy, qz, qw], i) => { bones[i].position.set(x, y, z); bones[i].quaternion.set(qx, qy, qz, qw); if (parent >= 0) bones[parent].add(bones[i]); });
                    const body = new THREE.SkinnedMesh(geometry, materials); body.name = name + ' / body'; body.frustumCulled = false; body.add(bones[0]);
                    body.updateMatrixWorld(true); body.bind(new THREE.Skeleton(bones));
                    bones.forEach((bone, i) => bone.quaternion.fromArray(human.poses[pose], i * 4)); bones[0].position.fromArray(human.roots[pose]);
                    const person = new THREE.Group(); person.name = name; person.add(body);
                    person.position.fromArray(place.position); person.rotation.set(0, place.yaw, 0, 'YXZ');
                    person.userData.bones = Object.fromEntries(bones.map(bone => [bone.name, bone])); person.userData.boneList = bones; person.userData.yaw = place.yaw;
                    person.userData.rest = { position: person.position.clone(), quaternion: person.quaternion.clone(), root: bones[0].position.clone(), bones: Object.fromEntries(bones.map(bone => [bone.name, bone.quaternion.clone()])) };
                    interior.add(person); crew.push(person); return person;
                }
                // At the laptop on the outboard rack, leaning in with the fingertips on the keys: green shirt, blue shorts.
                crewMember('Crew 1', 'typist', { skin: 0xc29270, shirt: 0x235f43, shorts: 0x2f5c8c, shoes: 0xe2e2dc, hair: 0x2b2420 }, { position: [-.2, -aisle, 1.39], yaw: -Math.PI / 2 });
                // Floating at the glovebox with one knee raised and both hands through its ports: white shirt, blue shorts.
                crewMember('Crew 2', 'gloves', { skin: 0xd0a07f, shirt: 0xeeede8, shorts: 0x2f6f9a, shoes: 0x2c7d86, hair: 0x2c2622 }, { position: [-.4, -aisle + .1, .45], yaw: -Math.PI / 2 });
                // Floating free in the neutral posture of weightlessness (arms forward, hips and knees bent): striped shirt.
                const crew3 = crewMember('Crew 3', 'floater', { skin: 0xe1b597, stripes: ['#26357e', '#f1f1ec'], shorts: 0x24386f, shoes: 0xf0f0ec, hair: 0x4a3324 }, { position: [0, -.9, 0], yaw: 0 });
                // Crew 3 floats in a group that carries it along the aft wall racks: it holds a rail with one hand and works a panel
                // with the other, pushes off, glides about 0.8 m to the next rail, catches it and works there, then comes back.
                const hover = new THREE.Group(); hover.name = 'Crew 3 float'; hover.add(crew3); interior.add(hover);
                const motion = crewTracksFrom(columbusCrewMotion);
                crewPlay(crew[0], motion.typist, 0); crewPlay(crew3, motion.floater, 0, hover);
                interior.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; } });

                // External payloads on the outboard cone: SOLAR on a tower above, a gold instrument box hanging outboard
                // of the upper deck, and an EuTEF-style instrument pallet below. Shapes follow the illustration only.
                const foilCanvas = document.createElement('canvas'); foilCanvas.width = 256; foilCanvas.height = 256;
                const fg = foilCanvas.getContext('2d'); fg.fillStyle = '#b8962f'; fg.fillRect(0, 0, 256, 256);
                let noiseState = 97; const noise = () => { noiseState = (noiseState * 16807) % 2147483647; return (noiseState - 1) / 2147483646; };
                for (let i = 0; i < 900; i++) {
                    const x = noise() * 256, y = noise() * 256;
                    fg.fillStyle = ['#e0c562aa', '#6b5423aa', '#f4dc7aaa', '#8e7029aa'][i % 4];
                    fg.beginPath(); fg.moveTo(x, y); fg.lineTo(x + 4 + noise() * 16, y - 7); fg.lineTo(x + 12, y + 5); fg.closePath(); fg.fill();
                }
                const foilMap = new THREE.CanvasTexture(foilCanvas); foilMap.colorSpace = THREE.SRGBColorSpace;
                const foil = material(0xffffff, .72, .38, foilMap), khaki = 0xb9a86a, bracketTone = 0xd8dbd4;
                const coneRadius = z => R + (coneR - R) * (z - barrel) / (coneEnd - barrel);
                // Plates of the upper platform and the lower frame: a perforated grid and a waffle grid of square recesses.
                const plateCanvas = draw => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256; draw(canvas.getContext('2d')); const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; };
                const perforated = plateCanvas(g => { g.fillStyle = '#dfe2dd'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) { g.fillStyle = '#7d8582'; g.beginPath(); g.arc(13 + i * 25.6, 13 + j * 25.6, 7.5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#4a5250'; g.beginPath(); g.arc(14, 14, 0, 0, 1); g.fill(); } });
                const waffle = plateCanvas(g => { g.fillStyle = '#e6e8e3'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) { const x = 3 + i * 25.6, y = 3 + j * 25.6, s = g.createLinearGradient(x, y, x + 20, y + 20); s.addColorStop(0, '#9da3a0'); s.addColorStop(1, '#f4f5f1'); g.fillStyle = s; g.fillRect(x, y, 20, 20); g.fillStyle = '#c3c8c4'; g.fillRect(x + 6, y + 6, 8, 8); } });
                const onCone = (x, side, z) => { const r = coneRadius(z); return [x, side * Math.sqrt(Math.max(0, r * r - x * x)), z]; };
                {
                    const side = 1, deckY = side * 1.86;
                    for (const x of [-.62, .62]) {
                        const a = onCone(x, side, 2.78), b = onCone(x, side, 3.3), c = [x, deckY - side * .05, 4.52];
                        for (const [p, q] of [[a, b], [a, c], [b, c]]) payloadKit.rod(p, q, .04, bracketTone);
                        payloadKit.box(a, [.18, .16, .2], palette.white, [0, 0, 0], false); payloadKit.box(b, [.18, .16, .2], palette.white, [0, 0, 0], false);
                    }
                    for (const z of [2.78, 3.3]) payloadKit.rod(onCone(-.62, side, z), onCone(.62, side, z), .03, bracketTone);
                    payloadKit.rod(onCone(-.62, side, 2.78), onCone(.62, side, 3.3), .025, bracketTone); payloadKit.rod(onCone(.62, side, 2.78), onCone(-.62, side, 3.3), .025, bracketTone);
                    payloadKit.add(shapes.box, material(0xffffff, .72, .14, perforated), [0, deckY, 3.78], [1.44, .06, 1.6], [0, 0, 0], false);
                    for (const x of [-.72, .72]) payloadKit.rod([x, deckY, 2.98], [x, deckY, 4.58], .028, bracketTone);
                    for (let n = 1; n < 6; n++) payloadKit.line([[-.7, deckY + side * .032, 2.98 + n * .267], [.7, deckY + side * .032, 2.98 + n * .267]]);
                }
                // SOLAR: a tapering tower, a gimbal and a tilted gold instrument box with its sensor window.
                const towerBase = [[-.3, 3.5], [.3, 3.5], [.3, 4.1], [-.3, 4.1]], towerTop = [[-.1, 3.7], [.1, 3.7], [.1, 3.9], [-.1, 3.9]], yBase = 1.89, yTop = 2.78;
                towerBase.forEach(([x, z], i) => {
                    payloadKit.rod([x, yBase, z], [towerTop[i][0], yTop, towerTop[i][1]], .03, khaki);
                    const [nx, nz] = towerBase[(i + 1) % 4];
                    payloadKit.rod([x, yBase + .02, z], [nx, yBase + .02, nz], .025, khaki);
                    payloadKit.rod([x, yBase, z], [towerTop[(i + 1) % 4][0], yTop, towerTop[(i + 1) % 4][1]], .016, khaki);
                });
                payloadKit.cylinder([0, yTop + .05, 3.8], .09, .5, palette.dark, [0, 0, Math.PI / 2]);
                const solar = new THREE.Group(), sk = new Kit(); solar.position.set(0, yTop + .26, 3.8); solar.rotation.set(-.55, .3, 0);
                sk.add(shapes.box, foil, [0, 0, 0], [.95, .42, .6]);
                sk.box([.12, .214, .05], [.34, .01, .26], 0xeef0ec, [0, 0, 0], false);
                for (let i = 0; i < 4; i++) sk.cylinder([-.3 + i * .07, .215, -.16], .022, .012, palette.dark, [0, 0, 0]);
                sk.cylinder([-.3, .1, .31], .06, .06, palette.white);
                sk.finish(solar); external.add(solar);
                payloadKit.box([.4, 2.02, 3.3], [.36, .26, .34], palette.white); payloadKit.box([-.42, 2.03, 3.35], [.34, .28, .36], 0x2b3033);
                payloadKit.cylinder([.4, 2.06, 4.35], .09, .18, palette.white, [0, 0, 0]);
                // The gold instrument box hangs outboard of the upper deck, its open face holding three white instruments.
                payloadKit.add(shapes.box, foil, [0, 1.3, 4.62], [1.05, .95, 1.2]);
                payloadKit.box([0, 1.3, 5.225], [.86, .74, .02], 0xa9c6d6, [0, 0, 0], false);
                for (const [x, y] of [[-.22, 1.46], [.2, 1.46], [0, 1.12]]) { payloadKit.cylinder([x, y, 5.3], .1, .16, 0xe9ebe6); ring(payloadKit, [x, y, 5.38], .1, 'z', palette.silver, .012); }
                for (const x of [-.5, .5]) payloadKit.rod([x, 1.8, 4.1], [x, 1.83, 4.5], .025, bracketTone);
                // Lower payload frame, after the close-up: an L of white plates below the outboard cone (a waffle-grid wall facing forward and a
                // floor running back under the cone) on triangulated struts. Clusters of finned grey boxes stand off the wall, handhold plates line
                // its top and a long gold-foil box runs outboard beneath them.
                const wallX = .3, wallY = [-1.22, -2.48], wallZ = [3.48, 4.56], floorY = -2.5;
                payloadKit.add(shapes.box, material(0xffffff, .7, .12, waffle), [wallX - .035, (wallY[0] + wallY[1]) / 2, (wallZ[0] + wallZ[1]) / 2], [.07, wallY[0] - wallY[1], wallZ[1] - wallZ[0]], [0, 0, 0], false);
                payloadKit.box([wallX, wallY[0] - .05, (wallZ[0] + wallZ[1]) / 2], [.16, .1, wallZ[1] - wallZ[0] + .1], 0xe9ebe6);
                for (const z of wallZ) payloadKit.box([wallX, (wallY[0] + floorY) / 2, z], [.16, wallY[0] - floorY + .1, .1], 0xe9ebe6);
                payloadKit.add(shapes.box, material(0xffffff, .7, .12, waffle), [-.09, floorY, 3.6], [1.0, .06, 1.92], [0, 0, 0], false);
                payloadKit.box([.41, floorY, 3.6], [.06, .1, 1.94], 0xe9ebe6); payloadKit.box([-.6, floorY, 3.6], [.06, .1, 1.94], 0xe9ebe6);
                const strutTone = 0xe3e5e0, nodes = { c1: onCone(.45, -1, 2.72), c2: onCone(-.45, -1, 2.72), c3: onCone(.25, -1, 3.28), wallTop: [wallX, wallY[0], wallZ[0]], floorFwd: [.41, floorY, 2.68], floorAft: [-.6, floorY, 2.68], floorOut: [-.6, floorY, 4.5] };
                for (const [p, q] of [['c3', 'wallTop'], ['c1', 'wallTop'], ['c1', 'floorFwd'], ['c2', 'floorAft'], ['c2', 'floorOut'], ['c1', 'floorAft']]) payloadKit.rod(nodes[p], nodes[q], .028, strutTone);
                for (const key of ['c1', 'c2', 'c3']) payloadKit.sphere(nodes[key], [.055, .055, .055], strutTone);
                // Finned instrument boxes: a light body, a dark ribbed face toward the viewer and ribs along the top.
                function finnedBox(z, y, w, h, depth) {
                    const x = wallX + depth / 2;
                    payloadKit.box([x, y, z], [depth, h, w], 0xb7bcb9);
                    payloadKit.box([wallX + depth + .006, y, z], [.012, h * .86, w * .86], 0x4d5355, [0, 0, 0], false);
                    for (let rib = 0; rib < 6; rib++) payloadKit.box([wallX + depth + .015, y - h * .36 + rib * h * .144, z], [.01, .012, w * .82], 0x8e9593, [0, 0, 0], false);
                    for (let rib = 0; rib < 5; rib++) payloadKit.box([x, y + h / 2 + .008, z - w * .36 + rib * w * .18], [depth * .9, .014, .012], 0x7f8684, [0, 0, 0], false);
                    for (const s of [-1, 1]) payloadKit.box([x, y, z + s * (w / 2 + .004)], [depth * .92, h * .8, .006], 0x9aa09d, [0, 0, 0], false);
                }
                for (const z of [4.08, 4.38]) for (const y of [-1.58, -1.88]) finnedBox(z, y, .28, .28, .55);
                for (const y of [-1.58, -1.88]) finnedBox(3.68, y, .3, .28, .45);
                for (const z of [3.72, 4.05]) finnedBox(z, -2.24, .3, .3, .5);
                // Handhold plates with four bolt holes and a yellow handrail each, along the top of the wall.
                for (const z of [3.66, 4.02, 4.38]) {
                    payloadKit.box([wallX + .01, -1.34, z], [.02, .1, .27], 0xdfe2dd, [0, 0, 0], false);
                    for (let k = 0; k < 4; k++) payloadKit.cylinder([wallX + .022, -1.34, z - .09 + k * .06], .016, .006, 0x3c4442, [0, 0, Math.PI / 2]);
                    for (const dz of [-.1, .1]) payloadKit.rod([wallX + .02, -1.3, z + dz], [wallX + .08, -1.27, z + dz], .012, 0xe2b81f);
                    payloadKit.rod([wallX + .08, -1.27, z - .1], [wallX + .08, -1.27, z + .1], .013, 0xe2b81f);
                }
                payloadKit.add(shapes.box, foil, [.53, -2.26, 4.86], [.46, .28, 1.1]);
                payloadKit.add(shapes.box, foil, [.18, floorY - .1, 3.0], [.34, .14, .32]); payloadKit.cylinder([.18, floorY - .22, 3.0], .07, .12, 0x2f3436, [0, 0, 0]);
                for (const z of [2.9, 3.55]) payloadKit.rod([.41, floorY + .03, z], [.47, floorY + .06, z], .012, 0xe2b81f);
                payloadKit.rod([.47, floorY + .06, 2.9], [.47, floorY + .06, 3.55], .013, 0xe2b81f);
                payloadKit.finish(external);

                group.userData.reconstruction = 'After the ESA cutaway illustration: MMOD shell with a see-through section, square rack aisle, crew and external payloads';
                group.userData.seeThrough = { angleStart: open.a0, angleEnd: open.a1, axialStart: open.z0, axialEnd: open.z1, opacity: .25 };
                group.userData.equipmentRacks = racks.length; group.userData.crewFigures = crew.length; group.userData.externalBrackets = 2;
                group.userData.lab = { tube, shell, interior, framework, racks, crew, external, hover, motion, open };
            });
            // Columbus crew at work. Crew 1 and Crew 3 play keyed work loops: between keys every bone follows a Catmull-Rom curve
            // in time, so the motion flows through the keys rather than stopping at each. On top come breathing, small irregular
            // head movements, typing and, for the floating crew member, drifting legs. Crew 2 bobs at the glovebox and works the gloves.
            function crewTracksFrom(data) {
                const tracks = {};
                for (const [name, track] of Object.entries(data.tracks)) {
                    const raw = pmaArray(track.poses, Int16Array), count = track.times.length;
                    tracks[name] = { ...track, count, bones: raw.length / count / 4, quats: Float32Array.from(raw, value => value / 32767) };
                }
                return tracks;
            }
            // The key segment around `time` (the last key repeats the first) and a Hermite curve through it. Tangents are the
            // harmonic mean of the slopes on either side, and zero where a value turns back, so nothing overshoots its keys: a hand
            // lands on the keys and stops, while a glide between evenly spaced keys keeps its speed.
            function crewCurve(track, time) {
                const cycle = track.cycle, t = ((time % cycle) + cycle) % cycle, times = track.times, n = track.count;
                let i = 0; while (i < n - 2 && t >= times[i + 1]) i++;
                const t0 = times[i], t1 = times[i + 1], dt = t1 - t0, s = (t - t0) / dt, s2 = s * s, s3 = s2 * s;
                const prev = i > 0 ? i - 1 : n - 2, next = i + 2 < n ? i + 2 : 1, tp = i > 0 ? times[i - 1] : times[n - 2] - cycle, tn = i + 2 < n ? times[i + 2] : cycle + times[1];
                const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = 3 * s2 - 2 * s3, h11 = s3 - s2;
                const tangent = (before, after) => before * after <= 0 ? 0 : 2 / (1 / before + 1 / after);
                return (values, stride, k) => {
                    const p0 = values[i * stride + k], p1 = values[(i + 1) * stride + k], slope = (p1 - p0) / dt;
                    const m0 = tangent((p0 - values[prev * stride + k]) / (t0 - tp), slope), m1 = tangent(slope, (values[next * stride + k] - p1) / (tn - t1));
                    return h00 * p0 + h10 * dt * m0 + h01 * p1 + h11 * dt * m1;
                };
            }
            // Poses the bones and places the figure: `root` is the group Crew 3 floats in; Crew 1 is offset from its own place.
            function crewPlay(person, track, time, root) {
                const curve = crewCurve(track, time), stride = track.bones * 4, r = k => curve(track.root, 6, k);
                person.userData.boneList.forEach((bone, b) => bone.quaternion.set(curve(track.quats, stride, b * 4), curve(track.quats, stride, b * 4 + 1), curve(track.quats, stride, b * 4 + 2), curve(track.quats, stride, b * 4 + 3)).normalize());
                person.userData.boneList[0].position.set(curve(track.hips, 3, 0), curve(track.hips, 3, 1), curve(track.hips, 3, 2));
                if (root) { root.position.set(r(0), r(1), r(2)); root.rotation.set(r(3), r(4), r(5), 'YXZ'); }
                else { const rest = person.userData.rest.position; person.position.set(rest.x + r(0), rest.y + r(1), rest.z + r(2)); person.rotation.set(r(3), person.userData.yaw + r(4), r(5), 'YXZ'); }
                const level = values => values ? THREE.MathUtils.clamp(curve(values, 1, 0), 0, 1) : 0;
                return { type: level(track.type), pad: level(track.pad) };
            }
            const crewTurn = new THREE.Quaternion(), crewForward = new THREE.Vector3(0, 0, 1);
            // How much Crew 1's thought shows (0-1): while he rests his chin on his fist and watches the glovebox.
            const crewThought = { element: document.getElementById('crew-thought'), level: 0 };
            const crewAxes = (() => { const a = columbusCrewHuman.axes, v = list => new THREE.Vector3(...list), out = { headYaw: v(a.headYaw), headPitch: v(a.headPitch) };
                for (const group of ['flex', 'elbow', 'wrist']) for (const [bone, axis] of Object.entries(a[group])) out[bone] = v(axis);
                for (const [bone, axis] of Object.entries(columbusCrewMotion.axes)) out[bone] = v(axis); return out; })();
            function updateColumbusCrew(time) {
                const { crew: [typist, gloves, floater], hover, motion } = parts.get('columbus').group.userData.lab;
                // Each turn is applied on top of the solved pose, about a bone-local axis.
                const turn = (person, bone, ...steps) => {
                    const target = person.userData.bones[bone]; target.quaternion.copy(person.userData.rest.bones[bone]);
                    for (const [axis, angle] of steps) target.quaternion.multiply(crewTurn.setFromAxisAngle(axis, angle));
                };
                const add = (person, bone, axis, angle) => person.userData.bones[bone].quaternion.multiply(crewTurn.setFromAxisAngle(axis, angle));
                const look = (person, yaw, pitch) => turn(person, 'Head', [crewAxes.headYaw, yaw], [crewAxes.headPitch, pitch]);
                const work = crewPlay(typist, motion.typist, time); crewPlay(floater, motion.floater, time, hover);
                const turnTime = time % motion.typist.cycle;
                crewThought.level = THREE.MathUtils.smoothstep(turnTime, 17.9, 18.3) - THREE.MathUtils.smoothstep(turnTime, 21, 21.4);
                // Breathing (about 4 s a breath) and small head movements that never quite repeat.
                for (const [person, rate, phase] of [[typist, 1.5, 0], [floater, 1.37, 1.1]]) {
                    const breath = Math.sin(time * rate + phase);
                    add(person, 'Spine1', crewAxes.Spine1, .006 * breath); add(person, 'Spine2', crewAxes.Spine2, .01 * breath);
                    add(person, 'Head', crewAxes.headYaw, .018 * Math.sin(time * .53 + phase) + .01 * Math.sin(time * 1.31 + 2 * phase));
                    add(person, 'Head', crewAxes.headPitch, .012 * Math.sin(time * .71 + phase) + .007 * Math.sin(time * 1.7 + phase));
                }
                // Crew 1 types in bursts while `type` is up: each finger lifts off its key and comes back down onto it, finger by
                // finger (the solved keys rest the fingertips on the key tops). It taps the touchpad while `pad` is up.
                const burst = THREE.MathUtils.smoothstep(Math.sin(time * .55), -.2, .5), tap = phase => burst * Math.max(0, Math.sin(time * 9 + phase)) ** 2;
                for (const [side, offset] of [['Left', 0], ['Right', 2.1]]) {
                    [['Index', 0], ['Middle', 1.3], ['Ring', 2.6]].forEach(([finger, delay]) => {
                        const k = tap(offset + delay) * work.type, base = side + 'Hand' + finger;
                        add(typist, base + '1', crewAxes[base + '1'], -.26 * k); add(typist, base + '2', crewAxes[base + '2'], -.1 * k);
                    });
                    add(typist, side + 'Hand', crewAxes[side + 'Hand'], -.03 * tap(offset + .6) * work.type);
                }
                add(typist, 'RightHandIndex1', crewAxes.RightHandIndex1, .16 * work.pad * Math.max(0, Math.sin(time * 4.5)) ** 3);
                // Crew 3's legs drift a little on their own: knees and hips out of step.
                add(floater, 'LeftLeg', crewAxes.LeftLeg, .07 * Math.sin(time * .47)); add(floater, 'RightLeg', crewAxes.RightLeg, .06 * Math.sin(time * .39 + 1.9));
                add(floater, 'LeftUpLeg', crewAxes.LeftUpLeg, .035 * Math.sin(time * .31 + .7)); add(floater, 'RightUpLeg', crewAxes.RightUpLeg, .03 * Math.sin(time * .43 + 2.4));
                gloves.position.copy(gloves.userData.rest.position); gloves.position.y += .012 * Math.sin(time * .7);
                gloves.quaternion.copy(gloves.userData.rest.quaternion).multiply(crewTurn.setFromAxisAngle(crewForward, .015 * Math.sin(time * .5)));
                turn(gloves, 'LeftForeArm', [crewAxes.LeftForeArm, .06 * Math.sin(time * 1.1)]); turn(gloves, 'RightForeArm', [crewAxes.RightForeArm, .06 * Math.sin(time * 1.1 + 1.7)]);
                look(gloves, .05 * Math.sin(time * .45), .02 * Math.sin(time * .6));
            }
            part('tranquility', 'Tranquility & Cupola', '10 / HABITATION & OBSERVATION', 'Tranquility houses life-support equipment. Cupola has six trapezoidal side windows, an 80 cm circular Earth-facing window and protective external shutters; it supports Earth observation and robotic operations. The shutters are shown folded open and the glazing is drawn 75% transparent, showing the cabin and its robotic workstation.', [['Joined station', '2010'], ['Cupola windows', '6 side + 1 nadir']], [-7, -2, 12], (kit, group) => {
                moduleAt(kit, [-6.3, 0, 12], 6.7, 2.15, 'x', { skin: 'quilted', endInterfaceSides: [-1] });
                // The short inboard cone and passive CBM meet Unity's radial active collar.
                // Node 3's barrel, Cupola and all other ports keep their existing placement.
                const unityCollar = new THREE.Group(), unityCollarKit = new Kit();
                unityCollar.name = 'Tranquility / Unity passive CBM';
                unityCollar.position.z = 12; unityCollar.rotation.y = -Math.PI / 2;
                referenceCbmCone(unityCollarKit, 2.950, 2.775, 2.15, 1.179501);
                unityCollar.userData.cbm = referencePassiveCBM(unityCollarKit, 2.775, -1, .62);
                unityCollarKit.finish(unityCollar); group.add(unityCollar);
                // The zenith port is free, as on the GLB node: its covered CBM shares the radial-port station with Cupola,
                // Leonardo and BEAM. The collar stands clear of the quilted skin with its root sunk through it, and the
                // inspection ring points to the outboard (Bishop) end.
                const zenithPort = new THREE.Group(), zenithKit = new Kit();
                zenithPort.name = 'Tranquility / zenith free CBM';
                zenithPort.position.set(-7, 0, 12); zenithPort.rotation.y = Math.PI / 2;
                zenithPort.userData.cover = referenceFreeCbm(zenithKit, { hullRadius: 2.31, seat: .15 });
                zenithKit.finish(zenithPort); group.add(zenithPort);

                group.userData.cupolaWindows = 7;
                group.userData.cupolaNadirWindowDiameter = .8;
                group.userData.cupolaWindowOpacity = .25;
                group.userData.cupolaShutters = { side: 6, top: 1, pose: 'Folded open' };
                // Cupola after the supplied photograph: a round base skirt, a hexagonal dome of thick white frames around six
                // trapezoidal side windows and the circular Earth-facing window, gold handrails on the ribs, a bronze grapple
                // fixture, and seven open shutters whose dark, stud-dotted inner faces are rimmed in bronze. The glazing is 75%
                // transparent, so the cabin behind it (hatch to Node 3, robotic workstation displays) shows through.
                const cx = -7, cz = 12, yBase = -2.72, yTop = -3.57, baseRadius = 1.34, topRadius = .66;
                const apothem = r => r * Math.cos(Math.PI / 6), drop = apothem(baseRadius) - apothem(topRadius), rise = yBase - yTop, slant = Math.hypot(drop, rise);
                const halfAt = y => baseRadius / 2 - (baseRadius - topRadius) / 2 * y / slant; // half-length of a facet at height y
                const frameWhite = material(0xeceee9, .58, .1), bronzeRim = material(0xa8854f, .45, .5), handrailGold = 0xc9a64a, ribWhite = 0xf0f1ec;
                const studs = (() => {
                    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256; const g = canvas.getContext('2d');
                    g.fillStyle = '#2b2f35'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#e4e4dc';
                    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.beginPath(); g.arc(16 + i * 32, 16 + j * 32, 3.4, 0, Math.PI * 2); g.fill(); }
                    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.set(2.5, 2.5); texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return texture;
                })();
                const dotted = material(0xffffff, .7, .15, studs);
                const glass = new THREE.MeshStandardMaterial({ color: 0x86a9bd, roughness: .06, metalness: .1, transparent: true, opacity: .25, depthWrite: false });
                const glazingKit = new Kit(), cabinKit = new Kit();
                const place = (geometry, surface, matrix, target = kit) => target.add(geometry.applyMatrix4(matrix), surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                function roundedPolygon(target, points, radius) {
                    for (let i = 0; i < points.length; i++) {
                        const p = points[i], prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
                        const toPrev = new THREE.Vector2(prev[0] - p[0], prev[1] - p[1]).normalize(), toNext = new THREE.Vector2(next[0] - p[0], next[1] - p[1]).normalize();
                        const a = [p[0] + toPrev.x * radius, p[1] + toPrev.y * radius], b = [p[0] + toNext.x * radius, p[1] + toNext.y * radius];
                        if (i === 0) target.moveTo(...a); else target.lineTo(...a);
                        target.quadraticCurveTo(p[0], p[1], ...b);
                    }
                    target.closePath(); return target;
                }
                const loop = (path, matrix, z) => { const points = path.getSpacedPoints(64).slice(0, -1); return new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p.x, p.y, z).applyMatrix4(matrix)), true); };
                // Facet k: x along the base edge, y up the slant toward the top window, z along the outward normal.
                const facetFrame = k => {
                    const theta = k * Math.PI / 3 + Math.PI / 6, n = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));
                    const U = new THREE.Vector3(-Math.cos(theta), 0, Math.sin(theta));
                    const V = n.clone().multiplyScalar(-drop / slant).add(new THREE.Vector3(0, -rise / slant, 0));
                    const N = n.clone().multiplyScalar(rise / slant).add(new THREE.Vector3(0, -drop / slant, 0));
                    return { theta, n, matrix: new THREE.Matrix4().makeBasis(U, V, N).setPosition(new THREE.Vector3(cx, yBase, cz).addScaledVector(n, apothem(baseRadius))) };
                };
                // Round base skirt on a short adapter that runs up into Node 3's hull.
                const skirt = [[1.12, -2.72], [1.34, -2.72], [1.41, -2.66], [1.44, -2.58], [1.41, -2.50], [1.30, -2.44], [1.02, -2.40], [1.02, -1.85]];
                kit.add(new THREE.LatheGeometry(skirt.map(([r, y]) => new THREE.Vector2(r, y)), 72), frameWhite, [cx, 0, cz], [1, 1, 1], [0, 0, 0], false);
                ring(kit, [cx, -2.40, cz], 1.03, 'y', palette.silver, .03);
                for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; kit.add(shapes.sphere, bronzeRim, [cx + 1.44 * Math.sin(a), -2.58, cz + 1.44 * Math.cos(a)], [.035, .035, .035], [0, 0, 0], false); }
                // Six framed trapezoidal windows, each with a bronze-hinged shutter folded open toward the skirt.
                const shutterShape = roundedPolygon(new THREE.Shape(), [[-.55, .03], [.55, .03], [.29, .90], [-.29, .90]], .07);
                const shutterTray = new THREE.ExtrudeGeometry(shutterShape, { depth: .06, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 1 }).translate(0, 0, .012);
                const shutterFace = new THREE.ShapeGeometry(shutterShape, 6).rotateY(Math.PI).translate(0, 0, -.004);
                const hingeY = .10, shutterOpen = 110 * Math.PI / 180;
                for (let k = 0; k < 6; k++) {
                    const { matrix } = facetFrame(k);
                    const outline = new THREE.Shape([[-halfAt(0), 0], [halfAt(0), 0], [halfAt(slant), slant], [-halfAt(slant), slant]].map(p => new THREE.Vector2(...p)));
                    const pane = [[-(halfAt(.13) - .11), .13], [halfAt(.13) - .11, .13], [halfAt(slant - .12) - .11, slant - .12], [-(halfAt(slant - .12) - .11), slant - .12]];
                    outline.holes.push(roundedPolygon(new THREE.Path(), pane, .06));
                    place(new THREE.ExtrudeGeometry(outline, { depth: .10, bevelEnabled: false }).translate(0, 0, -.10), frameWhite, matrix);
                    place(new THREE.ShapeGeometry(roundedPolygon(new THREE.Shape(), pane, .06), 6).translate(0, 0, -.045), glass, matrix, glazingKit);
                    kit.add(new THREE.TubeGeometry(loop(roundedPolygon(new THREE.Path(), pane, .06), matrix, -.006), 72, .016, 6, true), material(0x7b8388), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                    const hinge = new THREE.Matrix4().makeRotationX(shutterOpen).premultiply(new THREE.Matrix4().makeTranslation(0, hingeY, 0)).premultiply(matrix);
                    place(shutterTray.clone(), bronzeRim, hinge); place(shutterFace.clone(), dotted, hinge);
                    kit.rod(new THREE.Vector3(-.42, hingeY, .02).applyMatrix4(matrix).toArray(), new THREE.Vector3(.42, hingeY, .02).applyMatrix4(matrix).toArray(), .03, 0x8f7248);
                }
                // Rounded white edges: base and top hexagons and the six ribs between windows.
                const vertex = (radius, y, i) => [cx + radius * Math.sin(i * Math.PI / 3), y, cz + radius * Math.cos(i * Math.PI / 3)];
                for (let i = 0; i < 6; i++) {
                    kit.rod(vertex(baseRadius, yBase, i), vertex(baseRadius, yBase, i + 1), .045, ribWhite);
                    kit.rod(vertex(topRadius, yTop, i), vertex(topRadius, yTop, i + 1), .04, ribWhite);
                    kit.rod(vertex(baseRadius, yBase, i), vertex(topRadius, yTop, i), .05, ribWhite);
                    kit.sphere(vertex(topRadius, yTop, i), [.05, .05, .05], ribWhite);
                    // A gold handrail stands off each rib near the top window.
                    const along = t => new THREE.Vector3(...vertex(baseRadius, yBase, i)).lerp(new THREE.Vector3(...vertex(topRadius, yTop, i)), t);
                    const out = new THREE.Vector3(Math.sin(i * Math.PI / 3) * .712, -.570, Math.cos(i * Math.PI / 3) * .712).normalize();
                    const rail = [.55, .90].map(t => along(t).addScaledVector(out, .10));
                    kit.rod(rail[0].toArray(), rail[1].toArray(), .026, handrailGold);
                    for (const t of [.55, .90]) kit.rod(along(t).addScaledVector(out, .04).toArray(), along(t).addScaledVector(out, .10).toArray(), .02, handrailGold);
                    if (i === 2) {
                        // Bronze grapple fixture with a tri-spoke hub and a dark handle, on a short standoff.
                        const q = new THREE.Quaternion().setFromUnitVectors(vertical, out), p = along(.33);
                        kit.add(new THREE.CylinderGeometry(.06, .06, .12, 12).applyQuaternion(q), material(palette.silver), p.clone().addScaledVector(out, .07).toArray(), [1, 1, 1], [0, 0, 0], false);
                        kit.add(new THREE.CylinderGeometry(.17, .17, .03, 28).applyQuaternion(q), bronzeRim, p.clone().addScaledVector(out, .14).toArray(), [1, 1, 1], [0, 0, 0], false);
                        for (let s = 0; s < 3; s++) {
                            const spoke = new THREE.BoxGeometry(.03, .02, .14).translate(0, 0, .07).rotateY(s * Math.PI * 2 / 3).applyQuaternion(q);
                            kit.add(spoke, bronzeRim, p.clone().addScaledVector(out, .165).toArray(), [1, 1, 1], [0, 0, 0], false);
                        }
                        kit.add(new THREE.BoxGeometry(.44, .03, .05).applyQuaternion(q), material(palette.dark), p.clone().addScaledVector(out, .19).toArray(), [1, 1, 1], [0, 0, 0], false);
                    }
                }
                // Top plate around the 80 cm Earth-facing window (outer face at yTop, facing nadir).
                const topFrame = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0)).setPosition(new THREE.Vector3(cx, yTop, cz));
                const topPlate = new THREE.Shape(Array.from({ length: 6 }, (_, i) => new THREE.Vector2(topRadius * Math.sin(i * Math.PI / 3), topRadius * Math.cos(i * Math.PI / 3))));
                const topHole = new THREE.Path(); topHole.absarc(0, 0, .42, 0, Math.PI * 2, true); topPlate.holes.push(topHole);
                place(new THREE.ExtrudeGeometry(topPlate, { depth: .10, bevelEnabled: false, curveSegments: 36 }).translate(0, 0, -.10), frameWhite, topFrame);
                const topPane = new THREE.Shape(); topPane.absarc(0, 0, .43, 0, Math.PI * 2, false);
                place(new THREE.ShapeGeometry(topPane, 36).translate(0, 0, -.04), glass, topFrame, glazingKit);
                ring(kit, [cx, yTop - .015, cz], .47, 'y', 0xe3e5e0, .05);
                ring(kit, [cx, yTop - .004, cz], .425, 'y', 0x7b8388, .016);
                for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; kit.add(shapes.lowCylinder, material(palette.dark), [cx + .545 * Math.sin(a), yTop - .01, cz + .545 * Math.cos(a)], [.016, .02, .016], [0, 0, 0], false); }
                // The round top shutter swings out on a short arm and lies beside the dome, its dotted inner face toward Earth.
                {
                    const theta = 4 * Math.PI / 3 + Math.PI / 6, n = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta)), reach = apothem(topRadius) + .08;
                    const hingePoint = new THREE.Vector3(cx, yTop - .05, cz).addScaledVector(n, reach);
                    const frame = new THREE.Matrix4().makeBasis(new THREE.Vector3(-Math.cos(theta), 0, Math.sin(theta)), n.clone().negate(), new THREE.Vector3(0, -1, 0)).setPosition(hingePoint);
                    const swing = new THREE.Matrix4().makeRotationX(188 * Math.PI / 180).premultiply(frame);
                    const disc = new THREE.Shape(); disc.absarc(0, reach, .50, 0, Math.PI * 2, false);
                    place(new THREE.ExtrudeGeometry(disc, { depth: .06, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 1, curveSegments: 36 }).translate(0, 0, .012), bronzeRim, swing);
                    place(new THREE.ShapeGeometry(disc, 36).rotateY(Math.PI).translate(0, 0, -.004), dotted, swing);
                    kit.rod(hingePoint.toArray(), new THREE.Vector3(0, reach - .5, .03).applyMatrix4(swing).toArray(), .035, 0x8f7248);
                    kit.add(shapes.box, bronzeRim, hingePoint.toArray(), [.22, .08, .12], [0, theta, 0], false);
                }
                // Cabin behind the glazing: dim walls (seen from outside only), the hatch into Node 3 and two workstation displays.
                const cabinWall = new THREE.MeshStandardMaterial({ color: 0xb3b8b6, roughness: .8, metalness: .05, side: THREE.BackSide });
                cabinKit.add(new THREE.CylinderGeometry(1.10, .50, .70, 6, 1, false), cabinWall, [cx, -3.145, cz], [1, 1, 1], [0, 0, 0], false);
                cabinKit.add(new THREE.CylinderGeometry(.44, .44, .012, 36), material(0x1d2226, .8, .1), [cx, -2.80, cz], [1, 1, 1], [0, 0, 0], false);
                cabinKit.add(new THREE.TorusGeometry(.46, .03, 8, 36), material(0x9aa1a3), [cx, -2.805, cz], [1, 1, 1], [Math.PI / 2, 0, 0], false);
                const screen = new THREE.MeshStandardMaterial({ color: 0x1d4c66, emissive: 0x2f7aa0, emissiveIntensity: .55, roughness: .35, metalness: .1 });
                for (const dz of [-.21, .21]) {
                    cabinKit.add(shapes.box, material(0x2b2f35, .6, .2), [cx - .30, -3.02, cz + dz], [.03, .26, .36], [0, 0, 0], false);
                    cabinKit.add(shapes.box, screen, [cx - .283, -3.02, cz + dz], [.006, .22, .32], [0, 0, 0], false);
                    cabinKit.add(shapes.box, material(0x9aa1a3), [cx - .30, -2.845, cz + dz], [.03, .10, .03], [0, 0, 0], false);
                }
                const cabin = new THREE.Group(); cabin.name = 'Cupola cabin'; cabinKit.finish(cabin); group.add(cabin);
                cabin.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = true; } });
                const glazing = new THREE.Group(); glazing.name = 'Cupola glazing (75% transparent)'; glazingKit.finish(glazing); group.add(glazing);
                glazing.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; object.renderOrder = 2; } });

                // Inboard of the zenith port, so the lettering stays clear of its collar.
                hullBadge(kit, 'NODE 3', [-4.35, 0, 12], 2.225, [2.4, .40], 'x');
            });
            part('quest', 'Quest airlock', '11 / EXTRAVEHICULAR ACTIVITY', 'A wide equipment lock connects Unity to the narrower crew lock. The EVA hatch faces below the crew lock inside a circular handrail, two blanketed tool containers ride on the opposite side, and five pentagonal gas-tank covers with bronze tri-lobe fittings surround the equipment lock. ESP-2 sits beside the airlock with a gridded pallet, six blanketed equipment boxes, corner trunnions and a grapple fixture. Exterior details follow the supplied references.', [['Joined station', '2001'], ['Chambers', 'Equipment + crew lock']], [5.15, 2.12, 12], (kit, group) => {
                // Reference-only reconstruction: keep the Unity interface fixed.
                group.userData.referenceViews = 7;
                group.userData.highPressureGasTanks = 5;
                group.userData.facetedTankCovers = 5;
                group.userData.tankCoverSection = 'Pentagon: flat face on the equipment lock, ridge outward';
                group.userData.toolContainers = 2;
                group.userData.evaHatch = { center: [7.37, -1.12, 12], radius: .73, normal: [0, -1, 0], window: false, handrail: 'Full ring on eight posts' };
                group.userData.unityInterface = [3.04, 0, 12];
                // The passive cuff follows the supplied Quest CBM profile. Its root enters
                // the existing equipment-lock shoulder without changing either airlock chamber.
                const unityCollar = new THREE.Group(), unityCollarKit = new Kit();
                unityCollar.name = 'Quest / Unity passive CBM';
                unityCollar.position.z = 12; unityCollar.rotation.y = Math.PI / 2;
                unityCollar.userData.cbm = referencePassiveCBM(unityCollarKit, 3.441, -1);
                unityCollarKit.finish(unityCollar); group.add(unityCollar);

                group.userData.equipmentLock = { start: 3.63, end: 5.69, radius: 2.10 };
                group.userData.crewLock = { start: 6.04, end: 8.76, radius: .96, collarRadius: 1.12 };
                group.userData.outboardFace = 'Closed cap: four quadrant panels under gold X straps and eight latches; no axial docking port';
                const tan = 0xb39a74, gold = material(0xc2a25a, .38, .55), bronze = material(0xa2865e, .45, .45), trim = 0xc3cacb, inset = 0xaab4b7, recess = 0x4a545b;
                const fastenerShape = new THREE.SphereGeometry(1, 8, 6);
                // Light, matte white-silver skin with soft handling marks and fine scuffs, after the reference views.
                const texCanvas = document.createElement('canvas'); texCanvas.width = 512; texCanvas.height = 512;
                const ctx = texCanvas.getContext('2d'); ctx.fillStyle = '#e2e5e4'; ctx.fillRect(0, 0, 512, 512);
                let seed = 11; const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;
                for (let i = 0; i < 90; i++) {
                    const x = rand() * 512, y = rand() * 512, r = 12 + rand() * 60, dark = rand() > .35, spot = ctx.createRadialGradient(x, y, 0, x, y, r);
                    spot.addColorStop(0, dark ? `rgba(118,126,131,${.03 + rand() * .045})` : `rgba(255,255,255,${.06 + rand() * .08})`); spot.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = spot; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
                }
                for (let i = 0; i < 160; i++) {
                    const x = rand() * 512, y = rand() * 512, l = 3 + rand() * 14, a = rand() * Math.PI;
                    ctx.strokeStyle = `rgba(90,98,104,${.04 + rand() * .08})`; ctx.lineWidth = .6 + rand(); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
                }
                const skin = new THREE.CanvasTexture(texCanvas); skin.colorSpace = THREE.SRGBColorSpace; skin.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
                const shell = material(0xf1f3f2, .66, .14, skin), shield = material(0xffffff, .62, .12, skin), shadowShield = material(0xe0e4e4, .64, .14, skin), white = material(0xf4f4f0, .7, .08, skin);
                const on = (x, radius, angle) => [x, radius * Math.cos(angle), 12 + radius * Math.sin(angle)];
                const facing = normal => new THREE.Quaternion().setFromUnitVectors(vertical, new THREE.Vector3(...normal).normalize());
                function patch(x0, x1, r0, r1, a0, a1, surface) {
                    const pos = [], uv = [], steps = 8;
                    for (let i = 0; i < steps; i++) {
                        const a = a0 + (a1 - a0) * i / steps, b = a0 + (a1 - a0) * (i + 1) / steps;
                        const points = [on(x0, r0, a), on(x0, r0, b), on(x1, r1, a), on(x1, r1, b)];
                        const order = x0 === x1 && r1 > r0 ? [0, 2, 1, 2, 3, 1] : [0, 1, 2, 2, 1, 3];
                        for (const j of order) { pos.push(...points[j]); uv.push(j > 1 ? 1 : 0, j % 2 ? (i + 1) / steps : i / steps); }
                    }
                    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); kit.add(g, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                function curve(x, radius, a0, a1, tube = .014, color = trim) {
                    const points = []; for (let i = 0; i <= 10; i++)points.push(new THREE.Vector3(...on(x, radius, a0 + (a1 - a0) * i / 10)));
                    kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 10, tube, 5, false), material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                function framedTile(x0, x1, r, a0, a1, surface, braces = false) {
                    patch(x0, x1, r, r, a0, a1, surface);
                    for (const a of [a0, a1]) kit.rod(on(x0, r + .025, a), on(x1, r + .025, a), .019, trim);
                    for (const x of [x0, x1]) curve(x, r + .025, a0, a1, .018);
                    // An inset pressed-metal frame and shallow diagonals match the large lock's panels.
                    const da = (a1 - a0) * .105, dx = (x1 - x0) * .09;
                    for (const a of [a0 + da, a1 - da]) kit.rod(on(x0 + dx, r + .033, a), on(x1 - dx, r + .033, a), .011, inset);
                    for (const x of [x0 + dx, x1 - dx]) curve(x, r + .033, a0 + da, a1 - da, .011, inset);
                    if (braces) for (const reverse of [false, true]) for (let i = 0; i < 6; i++) {
                        const point = t => on(x0 + dx + (x1 - x0 - 2 * dx) * t, r + .047, reverse ? a1 - da - (a1 - a0 - 2 * da) * t : a0 + da + (a1 - a0 - 2 * da) * t);
                        kit.rod(point(i / 6), point((i + 1) / 6), .013, inset);
                    }
                    for (const x of [x0 + .07, x1 - .07]) for (const a of [a0 + .035, a1 - .035]) kit.add(fastenerShape, material(0xdee5e4), on(x, r + .035, a), [.022, .022, .022], [0, 0, 0], false);
                }
                // A round port: pale ring around a dark centre, flush on a surface with the given outward normal.
                function port(at, normal, radius = .11) {
                    const q = facing(normal), n = new THREE.Vector3(...normal).normalize(), p = new THREE.Vector3(...at);
                    kit.add(new THREE.CylinderGeometry(radius, radius, .02, 20).applyQuaternion(q), material(0xf3f3ef, .6, .08), p.clone().addScaledVector(n, .01).toArray(), [1, 1, 1], [0, 0, 0], false);
                    kit.add(new THREE.CylinderGeometry(radius * .5, radius * .5, .024, 16).applyQuaternion(q), material(0x3a4147, .5, .3), p.clone().addScaledVector(n, .014).toArray(), [1, 1, 1], [0, 0, 0], false);
                }
                // A tan edge clip; its local y follows the radial direction at `angle` (size: axial, radial, tangential).
                const clip = (x, radius, angle, size) => kit.box(on(x, radius, angle), size, tan, [angle, 0, 0], false);
                // Short, concentric neck seats on Unity's existing starboard flange.
                kit.cylinder([3.22, 0, 12], .84, .36, 0xd4d9da, [0, 0, Math.PI / 2]);
                for (const x of [3.055, 3.38]) ring(kit, [x, 0, 12], .84, 'x', x < 3.1 ? recess : trim, .045);
                const profile = [[0, 3.39], [.87, 3.39], [1.98, 3.57], [2.10, 3.63], [2.10, 5.69], [2.05, 5.78], [1.10, 6.015], [.96, 6.04], [.96, 8.76], [0, 8.76]];
                kit.add(new THREE.LatheGeometry(profile.map(([radius, x]) => new THREE.Vector2(radius, x)), 64), shell, [0, 0, 12], [1, 1, 1], [0, 0, -Math.PI / 2], false);
                // Two axial rows of curved, cross-braced panels around the equipment lock; panels clear of the tank covers carry round ports.
                for (let belt = 0; belt < 12; belt++)for (let row = 0; row < 2; row++) {
                    const a = belt * Math.PI / 6 + .035, b = a + Math.PI / 6 - .070, x = 3.68 + row * 1.005, mid = (a + b) / 2;
                    framedTile(x, x + .92, 2.117, a, b, belt % 3 === 0 ? shadowShield : shield, true);
                    if ((row === 0 ? [0, 2, 9, 11] : [2, 9]).includes(belt)) port(on(x + .24, 2.168, mid), [0, Math.cos(mid), Math.sin(mid)]);
                }
                for (const x of [3.63, 4.66, 5.70]) {
                    ring(kit, [x, 0, 12], 2.12, 'x', trim, .043);
                    ring(kit, [x + .063, 0, 12], 2.119, 'x', inset, .015);
                }
                // Tan clips straddle the front rim where the drum meets its annular bulkhead.
                for (let k = 0; k < 24; k++)clip(5.70, 2.15, k * Math.PI / 12 + Math.PI / 24, [.16, .06, .13]);
                // Wide shallow annular bulkhead, divided into radial trapezoid shields with round ports and small vents.
                const coneX = r => 5.794 + (2.04 - r) * .25;
                const coneFrame = angle => { const c = Math.cos(angle), s = Math.sin(angle); return new THREE.Matrix4().makeBasis(new THREE.Vector3(.970, .243 * c, .243 * s), new THREE.Vector3(-.243, .970 * c, .970 * s), new THREE.Vector3(0, -s, c)); };
                const onCone = (geometry, r, angle, lift, color) => { const n = new THREE.Vector3(.970, .243 * Math.cos(angle), .243 * Math.sin(angle)); kit.add(geometry.applyMatrix4(coneFrame(angle)), material(color), new THREE.Vector3(...on(coneX(r), r, angle)).addScaledVector(n, lift).toArray(), [1, 1, 1], [0, 0, 0], false); };
                for (let sector = 0; sector < 16; sector++) {
                    const a = sector * Math.PI / 8 + .02, b = a + Math.PI / 8 - .04, mid = (a + b) / 2;
                    patch(5.794, 6.024, 2.04, 1.12, a, b, sector % 4 === 0 ? shadowShield : shield);
                    for (const angle of [a, b]) kit.rod(on(5.809, 2.03, angle), on(6.039, 1.13, angle), .019, trim);
                    curve(5.815, 1.99, a, b, .014, trim); curve(6.028, 1.16, a, b, .016, trim);
                    if (sector % 2 === 0) { const r = 1.62; port(new THREE.Vector3(...on(coneX(r), r, mid)).toArray(), [.970, .243 * Math.cos(mid), .243 * Math.sin(mid)], .1); }
                    else for (const r of [1.46, 1.80]) onCone(new THREE.BoxGeometry(.03, .15, .06), r, mid, .012, recess);
                }
                ring(kit, [5.787, 0, 12], 2.06, 'x', trim, .035);
                for (let k = 0; k < 12; k++)onCone(new THREE.BoxGeometry(.04, .10, .12), 1.26, k * Math.PI / 6 + Math.PI / 12, .02, tan);
                // A broad collar seats the crew lock on the bulkhead.
                kit.add(new THREE.CylinderGeometry(1.12, 1.12, .22, 48, 1), shell, [6.15, 0, 12], [1, 1, 1], [0, 0, Math.PI / 2], false);
                for (const x of [6.045, 6.255]) ring(kit, [x, 0, 12], 1.12, 'x', trim, .03);
                ring(kit, [6.27, 0, 12], 1.0, 'x', recess, .022);
                for (let k = 0; k < 8; k++)clip(6.15, 1.14, k * Math.PI / 4 + Math.PI / 8, [.12, .05, .12]);
                // Long slim crew lock: four axial bays and eight shield strips.
                for (let belt = 0; belt < 8; belt++)for (let row = 0; row < 4; row++) {
                    const a = belt * Math.PI / 4 + .04, x = 6.31 + row * .60;
                    framedTile(x, x + .55, .977, a, a + Math.PI / 4 - .08, belt % 3 === 0 ? shadowShield : shield);
                }
                for (const x of [6.285, 6.885, 7.485, 8.085]) ring(kit, [x, 0, 12], .995, 'x', trim, .027);
                ring(kit, [8.74, 0, 12], 1.0, 'x', trim, .04);
                for (let k = 0; k < 8; k++)clip(8.72, 1.035, k * Math.PI / 4 + Math.PI / 8, [.12, .05, .12]);
                // Outboard cap: four quadrant panels under gold X straps, a central hub and eight black latches.
                kit.cylinder([8.786, 0, 12], .968, .060, recess, [0, 0, Math.PI / 2]);
                for (let quadrant = 0; quadrant < 4; quadrant++) {
                    const a = quadrant * Math.PI / 2 + Math.PI / 4 + .05, b = a + Math.PI / 2 - .10;
                    patch(8.823, 8.823, .13, .90, a, b, shield);
                    curve(8.83, .88, a, b, .016, trim); curve(8.83, .15, a, b, .014, trim);
                }
                for (let k = 0; k < 4; k++) { const angle = Math.PI / 4 + k * Math.PI / 2; kit.add(shapes.box, gold, on(8.842, .52, angle), [.03, .78, .075], [angle, 0, 0], false); }
                for (let k = 0; k < 8; k++) { const angle = Math.PI / 8 + k * Math.PI / 4; kit.box(on(8.838, .80, angle), [.03, .10, .05], 0x1e2328, [angle, 0, 0], false); }
                kit.cylinder([8.855, 0, 12], .12, .05, trim, [0, 0, Math.PI / 2]);
                kit.cylinder([8.885, 0, 12], .06, .03, recess, [0, 0, Math.PI / 2]);
                ring(kit, [8.822, 0, 12], .954, 'x', trim, .032);
                // Five pentagonal gas-tank covers: a flat face rests on the equipment lock and the ridge points outward.
                const tankShape = new THREE.Shape();
                tankShape.moveTo(-.62, 0); tankShape.lineTo(.62, 0); tankShape.lineTo(.62, .60); tankShape.lineTo(0, 1.04); tankShape.lineTo(-.62, .60); tankShape.closePath();
                const tankGeometry = new THREE.ExtrudeGeometry(tankShape, { depth: 1.57, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 2, steps: 1 });
                const tankAngles = [Math.atan2(-1.63, 1.50), Math.atan2(1.63, 1.50), Math.atan2(-1.62, -1.55), Math.PI, Math.atan2(1.62, -1.55)];
                const tankInner = 2.23, tankFace = 5.465;
                for (const angle of tankAngles) {
                    const radial = new THREE.Vector3(0, Math.cos(angle), Math.sin(angle)), across = new THREE.Vector3(0, Math.sin(angle), -Math.cos(angle));
                    kit.add(tankGeometry.clone().applyMatrix4(new THREE.Matrix4().makeBasis(across, radial, new THREE.Vector3(1, 0, 0))), white, [3.855, radial.y * tankInner, 12 + radial.z * tankInner], [1, 1, 1], [0, 0, 0], false);
                    // Saddles carry each cover clear of the braced panels.
                    for (const x of [3.99, 5.26]) kit.box(on(x, 2.20, angle), [.23, .07, .66], 0xc5ccce, [angle, 0, 0], false);
                    // Bronze tri-lobe fitting in a pale disc on the outboard end, with a dark handling slot toward the ridge.
                    const fitting = on(tankFace, tankInner + .50, angle);
                    ring(kit, fitting, .17, 'x', tan, .026);
                    kit.cylinder([tankFace + .004, fitting[1], fitting[2]], .15, .02, 0xefe8d6, [0, 0, Math.PI / 2]);
                    for (let k = 0; k < 3; k++) { const phi = angle + k * 2 * Math.PI / 3; kit.add(shapes.box, bronze, [tankFace + .02, fitting[1] + .065 * Math.cos(phi), fitting[2] + .065 * Math.sin(phi)], [.025, .12, .045], [phi, 0, 0], false); }
                    kit.add(shapes.cylinder, bronze, [tankFace + .03, fitting[1], fitting[2]], [.03, .04, .03], [0, 0, Math.PI / 2], false);
                    kit.box(on(tankFace + .004, tankInner + .82, angle), [.02, .16, .045], recess, [angle, 0, 0], false);
                }
                // Tan handholds run along the exposed side of both locks.
                for (const angle of [-Math.PI / 2, Math.PI / 2]) {
                    for (const [x0, x1, radius] of [[3.80, 4.48, 2.22], [4.85, 5.53, 2.22], [6.37, 6.71, 1.08], [7.53, 7.89, 1.08], [8.21, 8.55, 1.08]]) {
                        kit.rod(on(x0, radius, angle), on(x1, radius, angle), .024, tan);
                        for (const x of [x0, x1]) kit.rod(on(x, radius - .12, angle), on(x, radius, angle), .021, tan);
                    }
                }
                // Bronze half-dome fittings with short stems sit low on both sides of the drum.
                for (const a of [Math.PI / 2 + .30, -Math.PI / 2 - .30]) for (const x of [3.95, 5.05]) {
                    const q = facing([0, Math.cos(a), Math.sin(a)]);
                    kit.add(new THREE.BoxGeometry(.30, .05, .30).applyQuaternion(q), material(0xb6bdbf), on(x, 2.19, a), [1, 1, 1], [0, 0, 0], false);
                    kit.add(new THREE.SphereGeometry(.15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).applyQuaternion(q), bronze, on(x, 2.21, a), [1, 1, 1], [0, 0, 0], false);
                    kit.add(new THREE.CylinderGeometry(.02, .02, .16, 8).applyQuaternion(q), material(0xe8ebea), on(x, 2.43, a), [1, 1, 1], [0, 0, 0], false);
                    kit.add(new THREE.BoxGeometry(.14, .025, .03).applyQuaternion(q), material(0xe8ebea), on(x, 2.51, a), [1, 1, 1], [0, 0, 0], false);
                }
                // Two blanketed tool containers stand on short posts opposite the EVA hatch.
                for (const x of [6.78, 7.91]) {
                    kit.add(payloadPillow, payloadBlanket, [x, 1.21, 12], [.9, .36, 1.2]);
                    for (const dz of [-.3, .3]) kit.box([x, 1.402, 12 + dz], [.92, .02, .035], 0x6d7478, [0, 0, 0], false);
                    for (const dz of [-.45, .45]) for (const dx of [-.3, .3]) kit.box([x + dx, .945, 12 + dz], [.12, .16, .10], trim, [0, 0, 0], false);
                }
                // A square mounting pad and broad circular EVA hatch face nadir inside a full handrail ring on eight posts.
                kit.box([7.37, -.922, 12], [1.72, .15, 1.72], 0xe3e6e4, [0, 0, 0], false);
                kit.cylinder([7.37, -1.045, 12], .79, .12, trim, [0, 0, 0]);
                ring(kit, [7.37, -1.11, 12], .754, 'y', recess, .026);
                kit.cylinder([7.37, -1.13, 12], .722, .060, 0xeceeec, [0, 0, 0]);
                kit.sphere([7.37, -1.163, 12], [.709, .033, .709], 0xe6e9e6);
                ring(kit, [7.37, -1.176, 12], .715, 'y', trim, .019);
                for (let bolt = 0; bolt < 16; bolt++) {
                    const a = bolt * Math.PI / 8;
                    kit.add(shapes.lowCylinder, material(0x8d9aa0), [7.37 + .77 * Math.cos(a), -1.141, 12 + .77 * Math.sin(a)], [.020, .026, .020], [0, 0, 0], false);
                }
                for (const dx of [-.78, .78]) {
                    kit.box([7.37 + dx, -1.12, 12], [.19, .13, .19], trim, [0, 0, 0], false);
                    kit.cylinder([7.37 + dx, -1.16, 12], .052, .21, 0x8f9ea3);
                }
                const railPoints = []; for (let i = 0; i < 48; i++) { const a = i * Math.PI * 2 / 48; railPoints.push(new THREE.Vector3(7.37 + .98 * Math.cos(a), -1.30, 12 + .98 * Math.sin(a))); }
                kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPoints, true), 72, .026, 8, true), material(0xd6dbdc, .5, .35), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4; kit.rod([7.37 + .98 * Math.cos(a), -1.30, 12 + .98 * Math.sin(a)], [7.37 + .84 * Math.cos(a), -.998, 12 + .84 * Math.sin(a)], .022, trim); }
                // ESP-2, measured from ISS_stationary.glb node98. Keep the existing Quest
                // shell untouched; the short standoffs clear its reconstructed external fittings.
                const espReference = {"frame":{"center":[-2.433600425720215,-0.4962615966796875,1.7574214935302734],"size":[4.408411026000977,0.24416431784629822,2.745187759399414]},"boxes":[{"center":[-3.5902554988861084,-0.10363024473190308,1.2221364974975586],"size":[0.9028515815734863,0.4220227003097534,1.6528005599975586],"face":"+Y"},{"center":[-2.021188259124756,-0.0003467947244644165,1.7136070728302002],"size":[1.6819241046905518,0.710566520690918,1.3688387870788574],"face":"+Y"},{"center":[-3.784752368927002,-1.0977609157562256,1.735267162322998],"size":[0.6535656452178955,0.8625581860542297,0.6535673141479492],"face":"-Y"},{"center":[-2.432023048400879,-0.940069317817688,2.3394360542297363],"size":[1.109541416168213,0.5471722483634949,1.1171400547027588],"face":"-Y"},{"center":[-2.432023525238037,-0.8260753154754639,1.1709983348846436],"size":[0.7371609210968018,0.3191828727722168,0.9385504722595215],"face":"-Y"},{"center":[-0.9995006322860718,-1.0331650972366333,1.951857566833496],"size":[1.1475398540496826,0.7105661034584045,1.101944923400879],"face":"-Y"}],"feet":[{"center":[-3.6631579399108887,-0.3444088101387024,1.3100090026855469],"size":[0.9423494338989258,0.05954298377037048,1.3216943740844727]},{"center":[-2.0216450691223145,-0.3444088101387024,1.7162699699401855],"size":[1.7935054302215576,0.05954298377037048,1.497121810913086]},{"center":[-3.7885518074035645,-0.6424136757850647,1.761866569519043],"size":[0.7523620128631592,0.048140525817871094,0.8739538192749023]},{"center":[-2.435823440551758,-0.6424142718315125,2.3517727851867676],"size":[1.2539336681365967,0.0481414794921875,1.2178096771240234]},{"center":[-2.4282236099243164,-0.6424145698547363,1.1275675296783447],"size":[0.843555212020874,0.04814213514328003,1.1546063423156738]},{"center":[-0.9995009899139404,-0.6481137275695801,1.9480582475662231],"size":[1.2691335678100586,0.05954068899154663,1.231135606765747]}],"cleats":[{"center":[-4.664804935455322,-0.4964250326156616,0.5673933029174805],"size":[0.05399799346923828,0.2622762620449066,0.3614788055419922]},{"center":[-4.664804935455322,-0.4964250326156616,2.9474501609802246],"size":[0.05399799346923828,0.2622762620449066,0.3614790439605713]},{"center":[-0.20239615440368652,-0.4964250326156616,0.5673935413360596],"size":[0.05399799346923828,0.2622762620449066,0.3614792823791504]},{"center":[-0.20239615440368652,-0.4964250326156616,2.9474499225616455],"size":[0.05399799346923828,0.2622762620449066,0.3614788055419922]}],"brackets":[{"center":[-4.758139610290527,-0.6091766953468323,0.5177109241485596],"size":[0.1326732635498047,0.4085850417613983,0.6345868110656738]},{"center":[-4.758139610290527,-0.6091766953468323,2.9971330165863037],"size":[0.1326732635498047,0.4085850417613983,0.6345868110656738]},{"center":[-0.10906112194061279,-0.6091766953468323,0.5177114009857178],"size":[0.13267254829406738,0.4085850417613983,0.6345868110656738]},{"center":[-0.10906112194061279,-0.6091766953468323,2.9971327781677246],"size":[0.13267254829406738,0.4085850417613983,0.6345870494842529]}],"pins":[{"center":[-4.925086498260498,-0.496174693107605,0.517711877822876],"size":[0.20816898345947266,0.0690336525440216,0.06903505325317383]},{"center":[-4.925086498260498,-0.496174693107605,2.997133731842041],"size":[0.20816898345947266,0.0690336525440216,0.06903505325317383]},{"center":[0.05788600444793701,-0.496174693107605,0.5177106857299805],"size":[0.20816874504089355,0.0690336525440216,0.06903457641601562]},{"center":[0.05788600444793701,-0.496174693107605,2.9971323013305664],"size":[0.20816874504089355,0.0690336525440216,0.06903457641601562]}],"grapple":{"center":[-2.232088565826416,-0.49725794792175293,3.2567856311798096],"size":[0.5948470830917358,0.5948482751846313,0.006696224212646484]},"grappleBracket":{"center":[-2.2320871353149414,-0.4962625503540039,3.1169278621673584],"size":[0.15496325492858887,0.24416318535804749,0.2730722427368164]},"attachments":[{"outline":[[-1.9931000471115112,-0.10599999874830246],[-1.9393999576568604,-0.15970000624656677],[-1.6650999784469604,-0.15770000219345093],[-1.5784000158309937,-0.25360000133514404],[-1.5780999660491943,-0.5077000260353088],[-1.363700032234192,-0.767300009727478],[-1.363700032234192,-1.197700023651123],[-1.1562999486923218,-1.197700023651123],[-1.1562999486923218,-0.767300009727478],[-0.9336000084877014,-0.5077000260353088],[-0.9344000220298767,-0.25360000133514404],[-0.8471999764442444,-0.15770000219345093],[0.04899999871850014,-0.15440000593662262],[0.13009999692440033,-0.09399999678134918],[0.16179999709129333,0.0034000000450760126],[0.13009999692440033,0.10090000182390213],[0.04580000042915344,0.16120000183582306],[-1.9393999576568604,0.1573999971151352],[-1.9937000274658203,0.10170000046491623]],"z":0.06809234619140625,"depth":0.10898256301879883},{"outline":[[-1.3772000074386597,-1.1155999898910522],[-1.114799976348877,-1.1155999898910522],[-0.642300009727478,-0.8173999786376953],[-0.64410001039505,-0.009200000204145908],[-1.2101999521255493,0.21629999577999115],[-1.2888000011444092,0.21629999577999115],[-1.8543000221252441,-0.00839999970048666],[-1.8526999950408936,-0.8198000192642212]],"z":0.3444395065307617,"depth":0.1089468002319336}],"posts":[{"center":[0.0,-8.940696716308594e-08,0.11682701110839844],"size":[0.2899947166442871,0.2899962067604065,0.23365402221679688]},{"center":[-1.257485270500183,1.043081283569336e-07,0.17221975326538086],"size":[0.2899954319000244,0.2899964153766632,0.3444404602050781]}]};
                const esp2 = new THREE.Group(), espKit = new Kit();
                esp2.name = 'Quest / ESP-2 external stowage platform';
                esp2.position.set(3.9005081398, -.3388640347, 9.5834058433);
                esp2.rotation.y = Math.PI;
                esp2.scale.set(.9914940659, .9131470520, .9131470520);
                esp2.userData.source = 'ISS_stationary.glb / node98';
                esp2.userData.reference = espReference;
                esp2.userData.shellClearanceOffset = .20;
                esp2.userData.grid = [9, 6];
                const frameColor = 0x8c9183, frameEdge = 0xb4b9ab;
                // The scalloped long edges end in four projecting corner shoulders.
                const frameOutline = [[-4.637806,.384828],[-4.48986,.384828],[-4.26299,.53445],[-.60422,.53445],[-.37734,.384828],[-.229395,.384828],[-.229395,3.130015],[-.37734,3.130015],[-.60422,2.98039],[-4.26299,2.98039],[-4.48986,3.130015],[-4.637806,3.130015]];
                const frameShape = new THREE.Shape(frameOutline.map(([x, z]) => new THREE.Vector2(x, z)));
                frameShape.closePath();
                espKit.add(new THREE.ExtrudeGeometry(frameShape, { depth: .24416432, bevelEnabled: false }), material(frameColor, .72, .25), [0, -.37417945, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
                // The shared recessed 9-by-6 grid, on both faces.
                const gridSkin = material(0xffffff, .86, .12, carrierGrid);
                // Each grid stands 4 mm off its frame face; at 0.4 mm the two surfaces fought for the same depth.
                const frameTop = -.37417945, frameBottom = frameTop - .24416432;
                for (const side of [-1, 1]) {
                    const y = side > 0 ? frameTop + .004 : frameBottom - .004;
                    espKit.add(new THREE.PlaneGeometry(4.17, 2.36), gridSkin, [-2.43360043, y, 1.75742149], [1, 1, 1], [side > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0], false);
                    for (let i = 0; i < frameOutline.length; i++) {
                        const a = frameOutline[i], b = frameOutline[(i + 1) % frameOutline.length];
                        espKit.rod([a[0], y + side * .006, a[1]], [b[0], y + side * .006, b[1]], .013, frameEdge);
                    }
                }
                // Thin equipment adapter plates contact each outer face of the pallet.
                for (const foot of espReference.feet) espKit.box(foot.center, foot.size, 0xb7bdaf);
                // Six thermal-covered ORUs: four face the reference camera and two sit behind.
                const oruAssemblies = [];
                espReference.boxes.forEach((box, index) => {
                    const unit = new THREE.Group(), unitKit = new Kit();
                    unit.name = 'ESP-2 blanketed equipment ' + (index + 1);
                    unit.userData.referenceBox = box;
                    const [x, y, z] = box.center, [w, h, d] = box.size, side = box.face === '+Y' ? 1 : -1;
                    unitKit.add(shapes.box, payloadBlanket, box.center, box.size);
                    const faceY = y + side * h / 2;
                    for (const dx of [-w * .455, w * .455]) unitKit.rod([x + dx, faceY + side * .007, z - d * .44], [x + dx, faceY + side * .007, z + d * .44], .006, 0xc0c6be);
                    for (const dz of [-d * .455, d * .455]) unitKit.rod([x - w * .44, faceY + side * .007, z + dz], [x + w * .44, faceY + side * .007, z + dz], .006, 0xc0c6be);
                    // Low U-shaped handling straps stand off the blankets, with visible sewn feet.
                    for (const dx of [-w * .25, w * .25]) {
                        const zz = Math.min(.16, d * .20), lift = side * .031;
                        const points = [[x + dx, faceY, z - zz], [x + dx, faceY + lift, z - zz * .73], [x + dx, faceY + lift, z + zz * .73], [x + dx, faceY, z + zz]];
                        for (let i = 1; i < points.length; i++) unitKit.rod(points[i - 1], points[i], .010, 0x69706a);
                        for (const dz of [-zz, zz]) unitKit.box([x + dx, faceY + side * .006, z + dz], [.051, .013, .065], 0xb1b7ae, [0, 0, 0], false);
                    }
                    // A pair of handles on the tall sidewall remains visible in oblique views.
                    if (h > .5) for (const dz of [-d * .22, d * .22]) {
                        const xx = x + w / 2 + .024;
                        unitKit.rod([xx, y - h * .14, z + dz], [xx, y + h * .14, z + dz], .01, 0x69706a);
                        for (const yy of [y - h * .14, y + h * .14]) unitKit.rod([x + w / 2, yy, z + dz], [xx, yy, z + dz], .009, 0x69706a);
                    }
                    unitKit.finish(unit); esp2.add(unit); oruAssemblies.push(unit.name);
                });
                // Four corner cleats, flared trunnion plates and short outboard pins.
                for (const cleat of espReference.cleats) espKit.box(cleat.center, cleat.size, frameColor);
                for (const bracket of espReference.brackets) {
                    const [x, y, z] = bracket.center, [w, h, d] = bracket.size;
                    const profile = [[-.30,-.5],[.30,-.5],[.5,-.35],[.5,.35],[.30,.5],[-.30,.5],[-.5,.35],[-.5,-.35]];
                    const outline = new THREE.Shape(profile.map(([u, v]) => new THREE.Vector2(u * d, v * h)));
                    espKit.add(new THREE.ExtrudeGeometry(outline, { depth: w, bevelEnabled: false }), material(palette.silver), [x + w / 2, y, z], [1, 1, 1], [0, -Math.PI / 2, 0]);
                    espKit.box([x, y + h * .29, z], [w + .012, .032, d * .85], frameEdge);
                }
                for (const pin of espReference.pins) {
                    espKit.cylinder(pin.center, pin.size[1] / 2, pin.size[0], palette.silver, [0, 0, Math.PI / 2]);
                    const outside = pin.center[0] < -2 ? -1 : 1;
                    ring(espKit, [pin.center[0] + outside * pin.size[0] * .39, pin.center[1], pin.center[2]], .037, 'x', frameEdge, .008);
                }
                // Round grapple fixture at the outer edge, with central pin and three support arms.
                const [gx, gy, gz] = espReference.grapple.center;
                espKit.box(espReference.grappleBracket.center, espReference.grappleBracket.size, palette.silver);
                espKit.cylinder([gx, gy, gz], .29742, .009, palette.hull);
                ring(espKit, [gx, gy, gz + .007], .281, 'z', palette.silver, .020);
                ring(espKit, [gx, gy, gz + .011], .202, 'z', frameColor, .012);
                espKit.cylinder([gx, gy, gz + .131], .0223, .253, palette.silver);
                for (let i = 0; i < 3; i++) {
                    const a = Math.PI / 2 + i * Math.PI * 2 / 3;
                    espKit.rod([gx + Math.cos(a) * .18, gy + Math.sin(a) * .18, gz + .009], [gx + Math.cos(a) * .039, gy + Math.sin(a) * .039, gz + .085], .018, palette.silver);
                }
                espKit.box([gx, gy + .284, gz + .009], [.31, .029, .014], frameEdge);
                espKit.rod([gx, gy + .284, gz + .016], [gx, gy + .284, gz + .109], .006, palette.silver);
                // Two shaped attachment plates, copied as outlines rather than importing mesh data.
                for (const plate of espReference.attachments) {
                    const shape = new THREE.Shape(plate.outline.map(p => new THREE.Vector2(...p))); shape.closePath();
                    espKit.add(new THREE.ExtrudeGeometry(shape, { depth: plate.depth, bevelEnabled: false }), material(palette.silver), [0, 0, plate.z]);
                }
                for (const post of espReference.posts) espKit.cylinder(post.center, .145, post.size[2], palette.silver);
                // Connect the plate to the central inset edge of the pallet without a gap.
                espKit.box([-1.24832, -.49626, .506], [.83, .18, .142], palette.silver);
                // Adapt the two roots to the current Quest shell; their ends penetrate the shield slightly.
                const rootPosts = [0, -1.257481];
                for (const x of rootPosts) {
                    espKit.cylinder([x, 0, -.194], .145, .388, palette.silver);
                    espKit.cylinder([x, 0, -.365], .165, .036, frameEdge);
                    ring(espKit, [x, 0, -.343], .161, 'z', palette.rail, .009);
                }
                esp2.userData.attachmentRoots = rootPosts.map(x => [x, 0, -.365]);
                esp2.userData.equipmentCount = 6;
                esp2.userData.cornerTrunnions = 4;
                espKit.finish(esp2); group.add(esp2);
                group.userData.externalStowagePlatform = { name: 'ESP-2', equipmentBoxes: 6, grid: [9, 6], cornerTrunnions: 4, outerGrapple: true };
            });
            part('leonardo', 'Leonardo / PMM', '12 / LOGISTICS', 'The Permanent Multipurpose Module provides storage for equipment, experiments and supplies. It was relocated to Tranquility in 2015.', [['Permanent since', '2011'], ['Role', 'Storage']], [-7, 0, 5.8], (kit, group) => {
                moduleAt(kit, [-7, 0, 5.8], 6.4, 2.1, 'z', { skin: 'quilted' }); hullBadge(kit, 'LEONARDO', [-7, 0, 5.8], 2.175, [3.3, .42]);
                // Close Leonardo's existing CBM against Node 3's curved forward wall.
                // The supplied GLB informs the shallow stepped cuff; the current station placement is retained.
                const joint = new THREE.Group(), jointKit = new Kit();
                joint.name = 'Leonardo / Tranquility mating collar';
                const jointX = -7, ringFace = 9.722, nodeRadius = 2.15;
                const jointSkin = material(0xc7ceca, .58, .30);
                // Root points sit inside the quilted Node 3 skin, including the low seams between panels.
                const nodeSurface = (radius, angle) => 12 - Math.sqrt(nodeRadius * nodeRadius - (radius * Math.sin(angle)) ** 2);
                const profile = [
                    [1.100, 'plane', ringFace], [1.280, 'plane', ringFace],
                    [1.280, 'plane', 9.758], [1.255, 'plane', 9.786],
                    [1.255, 'shell', .012], [1.310, 'shell', .012],
                    [1.310, 'shell', .028], [1.100, 'shell', .028],
                    [1.100, 'plane', ringFace]
                ];
                const positions = [], uv = [], indices = [], steps = 96;
                for (let row = 0; row < profile.length; row++) {
                    const [radius, kind, depth] = profile[row];
                    for (let i = 0; i <= steps; i++) {
                        const angle = i / steps * Math.PI * 2;
                        positions.push(jointX + Math.cos(angle) * radius, Math.sin(angle) * radius, kind === 'shell' ? nodeSurface(radius, angle) + depth : depth);
                        uv.push(i / steps, row / (profile.length - 1));
                    }
                }
                for (let row = 0; row < profile.length - 1; row++) for (let i = 0; i < steps; i++) {
                    const a = row * (steps + 1) + i, b = a + 1, c = a + steps + 1, d = c + 1;
                    indices.push(a, b, c, b, d, c);
                }
                const saddle = new THREE.BufferGeometry();
                saddle.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                saddle.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
                saddle.setIndex(indices); saddle.computeVertexNormals();
                jointKit.add(saddle, jointSkin, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                // Two shallow lips surround one narrow gasket at the existing mating plane.
                ring(jointKit, [jointX, 0, 9.735], 1.284, 'z', 0xd9deda, .015);
                ring(jointKit, [jointX, 0, 9.773], 1.267, 'z', 0x58645e, .011);
                ring(jointKit, [jointX, 0, 9.793], 1.256, 'z', 0xc7ceca, .014);
                for (let bolt = 0; bolt < 16; bolt++) {
                    const angle = (bolt + .5) * Math.PI / 8;
                    jointKit.cylinder([jointX + Math.cos(angle) * 1.225, Math.sin(angle) * 1.225, 9.710], .022, .027, palette.silver);
                }
                jointKit.finish(joint); group.add(joint);
                joint.userData.interface = {
                    source: 'ISS_stationary.glb CBM profile; current Leonardo / Tranquility placement',
                    leonardoFace: [jointX, 0, ringFace], nodeSkinRadius: nodeRadius,
                    matingAxis: [0, 0, 1], sleeveRadius: 1.255, shoulderRadius: 1.310,
                    nodeContactDepth: .012, illustrative: true
                };
            });
            // Russian docking rings: profiles measured from the supplied GLB's Zarya and Rassvet nodes.
            function russianDockingBand(kit, profile, axis, origin, color = palette.silver) {
                const points = profile.map(([a,r]) => [r,a]);
                if (points[0][0] !== points.at(-1)[0] || points[0][1] !== points.at(-1)[1]) points.push([...points[0]]);
                let area = 0; for (let i=0;i<points.length-1;i++) area += points[i][0]*points[i+1][1]-points[i+1][0]*points[i][1];
                if (area < 0) points.reverse();
                const geometry = new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), 96);
                if (axis === 'z') geometry.rotateX(Math.PI/2);
                kit.add(geometry, material(color,.60,.38), origin, [1,1,1], [0,0,0], false);
            }
            part('zarya', 'Zarya / Functional Cargo Block', '13 / RUSSIAN SEGMENT', 'The first ISS element launched on 20 November 1998. Zarya supplied early power, propulsion and control, and later became a storage and fuel-support module. Its narrow central barrel expands into a broad aft shoulder; sixteen external canisters sit behind eight quadrant shields. Its two solar wings are drawn folded.', [['First launch', '20 NOV 1998'], ['Length', '12.6 m']], [0, 2, 23], (kit, group) => {
                // Pressure hull and equipment layout measured from ISS_stationary.glb, node 24.
                // Existing docking seats and the screenshot-led folded solar wings are retained.
                group.userData.referenceViews = 3;
                group.userData.solarWingPose = 'Folded like an accordion';
                group.userData.solarWings = 2;
                group.userData.curvedEquipmentShields = 8;
                group.userData.longitudinalTanks = 16;
                group.userData.exposedDarkDomes = 16;
                group.userData.interfaceCenters = { forward: [0, 0, 17.8], nadir: [0, -.855, 17.8], aft: [0, 0, 28.93] };
                const copper = 0x87583b, blanket = material(0xe0e1d9, .9, .07);
                // q is distance along the source module's -Z axis. Only the body between established joints is rescaled.
                const sourceRadiusScale = 2.17 / 2.1137633;
                const sourceAxialScale = (28.06 - 18.65) / (11.20546 - 2.12022);
                const bodyZ = q => 18.65 + (q - 2.12022) * sourceAxialScale;
                const bodyR = r => r * sourceRadiusScale;
                const hullProfile = [[17.8, .80], [18.65, .80], [bodyZ(3.20993), bodyR(1.49670)],
                    [bodyZ(9.65624), bodyR(1.49670)], [bodyZ(10.90350), 2.17], [28.06, 2.17], [29.2422400387, 0.7278270230]];
                group.userData.bodyReference = { source: 'ISS_stationary.glb / node 24 / mesh 24',
                    sourceBarrelRadius: 1.49670, sourceShoulderRadius: 2.1137633,
                    barrelRadius: bodyR(1.49670), barrelStart: bodyZ(3.20993), barrelEnd: bodyZ(9.65624),
                    shoulderEnd: bodyZ(10.90350), establishedAdapterStart: 28.06,
                    protectedJoints: ['PMA-1', 'Rassvet', 'Zvezda'], sourceRadiusScale, sourceAxialScale };
                function hullRadius(z) {
                    const index = Math.max(1, hullProfile.findIndex(p => p[0] >= Math.min(29.2422400387, Math.max(17.8, z))));
                    const a = hullProfile[index - 1], b = hullProfile[index];
                    return THREE.MathUtils.lerp(a[1], b[1], THREE.MathUtils.clamp((z - a[0]) / (b[0] - a[0]), 0, 1));
                }
                const onHull = (angle, z, lift = 0) => [Math.cos(angle) * (hullRadius(z) + lift), Math.sin(angle) * (hullRadius(z) + lift), z];
                // A continuous insulated shell replaces the generic cylinder and flat tile covers.
                // The neck starts inside the docking sphere at z 18.4, clear of the open zenith port's receiving cone (which
                // reaches z 18.33); the hidden length forward of it is not drawn.
                const profilePoints = [new THREE.Vector2(0, 18.4)];
                for (let i = 6; i <= 114; i++) { const z = 17.8 + i * .1; profilePoints.push(new THREE.Vector2(hullRadius(z), z)); if(i===102)profilePoints.push(new THREE.Vector2(2.17,28.06)); }
                profilePoints.push(new THREE.Vector2(0.7278270230, 29.2422400387), new THREE.Vector2(0, 29.2422400387));
                const hull = new THREE.LatheGeometry(profilePoints, 96).rotateX(Math.PI / 2), attr = hull.attributes.position;
                for (let i = 0; i < attr.count; i++) {
                    const x = attr.getX(i), y = attr.getY(i), z = attr.getZ(i), r = Math.hypot(x, y);
                    if (r > .85) { const a = Math.atan2(y, x), ripple = .005 * Math.sin(a * 29 + z * 21) + .004 * Math.cos(a * 13 - z * 33); attr.setXY(i, x * (1 + ripple / r), y * (1 + ripple / r)); }
                }
                hull.computeVertexNormals(); kit.add(hull, blanket, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                for (const z of [18.65, bodyZ(3.20993), bodyZ(9.65624), bodyZ(10.90350), 28.35]) ring(kit, [0, 0, z], hullRadius(z) + .012, 'z', palette.hull, .017);
                // The GLB has a long FGB terminal cone, a short straight neck, then a stepped docking flange.
                // The completed adapter and its mating plane are retained exactly during the body refinement.
                russianDockingBand(kit,[[29.24224003867576, 0.7278270230162477], [29.587609781591322, 0.7278270230162477], [29.614179019760247, 0.8086978329125118], [29.800153569182566, 0.8086978329125118], [29.84, 0.7682588348468345], [29.84, 0.4582559456870123], [29.24224003867576, 0.4582559456870123]],'z',[0,0,0]);
                ring(kit,[0,0,29.795742225754672],0.8106978329125119,'z',palette.white,.013);
                for(let i=0;i<12;i++){const a=i*Math.PI/6;kit.cylinder([Math.cos(a)*0.8206978329125119,Math.sin(a)*0.8206978329125119,29.72896500872691],.019,.030,palette.rail);}
                group.userData.serviceModuleFace={axis:'z',coordinate:29.84,radius:0.7682588348468345};
                group.userData.interfaceCenters.aft=[0,0,29.84];
                group.userData.aftDockingReference={source:'ISS_stationary.glb / Zarya terminal cone and Zvezda forward collar',
                    barrelEnd:28.06,coneEnd:29.24224003867576,neckRadius:0.7278270230162477,matingPlane:29.84};
                // Rounded seam/conduit runs are fitted directly to the curved blanket surface.
                function surfaceLoop(angle, z, width, length, lift = .028, radius = .011, color = 0xb8beb7) {
                    const path = new THREE.Shape(), w = width / 2, h = length / 2, c = Math.min(.19, w * .48, h * .48);
                    path.moveTo(-w + c, -h); path.lineTo(w - c, -h); path.quadraticCurveTo(w, -h, w, -h + c); path.lineTo(w, h - c); path.quadraticCurveTo(w, h, w - c, h); path.lineTo(-w + c, h); path.quadraticCurveTo(-w, h, -w, h - c); path.lineTo(-w, -h + c); path.quadraticCurveTo(-w, -h, -w + c, -h);
                    const points = path.getPoints(10).map(p => new THREE.Vector3(...onHull(angle + p.x / hullRadius(z + p.y), z + p.y, lift)));
                    kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true, 'centripetal'), 96, radius, 6, true), material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                for (const a of [Math.PI / 2, 0, Math.PI, Math.PI * 1.5]) {
                    for (const [z, l] of [[20.65, 1.74], [23.03, 2.12], [25.28, 1.95]]) {
                        surfaceLoop(a, z, 1.25, l, .021, .012, 0xc1c6bd);
                        surfaceLoop(a, z, 1.38, l + .13, .024, .011, 0xc8ccc4);
                    }
                }
                // Oval access detail and its doubled lip remain visible in the center strip.
                surfaceLoop(Math.PI / 2, 24.47, .69, .38, .052, .023, palette.silver);
                surfaceLoop(Math.PI / 2, 24.47, .85, .54, .030, .016, palette.hull);
                // Spherical docking compartment after reference imagery, on Rassvet's axis at z 17.8. Its forward port
                // takes PMA-1, the nadir port Rassvet, and the zenith port stands open as a receiving-cone docking port.
                // Port collars of .76 m (nadir) and .82 m (forward) subtend 42.7° + 47.1° of the 1.12 m sphere, so the
                // two adjacent ports stay just clear of each other.
                // Three cut seats expose the actual mating collars instead of a whole sphere penetrating them.
                const nodeCenter = new THREE.Vector3(0, 0, 17.8), nodeRadius = 1.12;
                const pmaFace = pma1BaseZ + 2.456446886062622 - russianSegmentOffset.z;
                const forwardPortR = .79491, forwardSeat = Math.sqrt(nodeRadius**2-forwardPortR**2);
                const nadirSeat = Math.sqrt(nodeRadius**2-.76**2), zenithSeat = Math.sqrt(nodeRadius**2-.78**2);
                const nodeCuts = [{axis:2,sign:-1,limit:forwardSeat},{axis:1,sign:-1,limit:nadirSeat},{axis:1,sign:1,limit:zenithSeat}];
                const sphere = new THREE.SphereGeometry(nodeRadius,96,64), src = sphere.attributes.position;
                const pos=[],norm=[],uv=[];
                const clip = (polygon,cut) => {
                    const next=[];
                    for(let i=0;i<polygon.length;i++) {
                        const a=polygon[i],b=polygon[(i+1)%polygon.length],da=a[cut.axis]*cut.sign-cut.limit,db=b[cut.axis]*cut.sign-cut.limit;
                        if(da<=0) next.push(a);
                        if((da<=0)!==(db<=0)) {
                            const t=da/(da-db),p=a.map((v,k)=>v+(b[k]-v)*t); p[cut.axis]=cut.limit*cut.sign;
                            const axes=[0,1,2].filter(k=>k!==cut.axis),scale=Math.sqrt(nodeRadius**2-cut.limit**2)/Math.hypot(...axes.map(k=>p[k]));
                            for(const k of axes)p[k]*=scale; next.push(p);
                        }
                    } return next;
                };
                for(let i=0;i<sphere.index.count;i+=3) {
                    let polygon=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(src,sphere.index.getX(i+k)).toArray());
                    for(const cut of nodeCuts){if(polygon.length<3)break;polygon=clip(polygon,cut);}
                    for(let k=1;k+1<polygon.length;k++)for(const p of [polygon[0],polygon[k],polygon[k+1]]) {
                        pos.push(...p);norm.push(...new THREE.Vector3(...p).normalize().toArray());uv.push((Math.atan2(p[2],p[0])/Math.PI/2+1)%1,Math.acos(p[1]/nodeRadius)/Math.PI);
                    }
                }
                const nodeGeometry=new THREE.BufferGeometry();nodeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
                nodeGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));nodeGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));sphere.dispose();
                kit.add(nodeGeometry,material(palette.hull,.55,.3),nodeCenter.toArray(),[1,1,1],[0,0,0],false);
                // Seams stop at the cut seats rather than crossing the docking openings.
                const seamAt = points => { let segment=[];const flush=()=>{if(segment.length>1)kit.line(segment);segment=[];};
                    for(const p of points){const q=new THREE.Vector3(...p).sub(nodeCenter).multiplyScalar(nodeRadius/(nodeRadius+.006));
                        if(nodeCuts.every(c=>q.getComponent(c.axis)*c.sign<=c.limit+.0001))segment.push(p);else flush();}flush();};
                seamAt(Array.from({length:129},(_,i)=>{const a=i*Math.PI/64;return [Math.cos(a)*(nodeRadius+.006),0,17.8+Math.sin(a)*(nodeRadius+.006)];}));
                for(const angle of [Math.PI/4,Math.PI*3/4]) seamAt(Array.from({length:129},(_,i)=>{const a=i*Math.PI/64;return [Math.cos(angle)*Math.sin(a)*(nodeRadius+.006),Math.cos(a)*(nodeRadius+.006),17.8+Math.sin(angle)*Math.sin(a)*(nodeRadius+.006)];}));
                // The imported PMA's mating face is at z=2.456446886, not its farthest projecting detail.
                const seatZ=17.8-forwardSeat, depth=seatZ-pmaFace, frontScale=depth/.2266687155;
                russianDockingBand(kit,[[pmaFace,.73607],[pmaFace+.04079*frontScale,.803719],[seatZ,.79491],
                    [seatZ,.64813],[pmaFace,.59934]],'z',[0,0,0]);
                ring(kit,[0,0,pmaFace+.005],.7365,'z',0x56605e,.009);
                group.userData.referenceDockingJoints = {source:'ISS_stationary.glb / nodes 24, 23, 81',
                    pma1:{axis:'z',face:pmaFace,seat:seatZ,faceRadius:.73607,outerRadius:.803719},
                    rassvet:{axis:'y',face:-.93,seat:-nadirSeat,faceRadius:.62374*.76/.66023,outerRadius:.684758*.76/.66023}};
                group.userData.interfaceCenters.forward=[0,0,pmaFace];group.userData.interfaceCenters.nadir=[0,-.93,17.8];
                // Open zenith port after the reference photo: a pale docking ring with dark latch slots round its face, a thin
                // dark gap and a grey rim around the receiving cone; cone, socket and cap share one orange.
                const zenithFace = 1.0, zenithMid = (zenithSeat + zenithFace) / 2;
                russianDockingBand(kit, [[zenithSeat - .02, .62], [zenithSeat - .02, .78], [zenithFace - .015, .78], [zenithFace, .765],
                    [zenithFace, .61], [zenithFace - .05, .61], [zenithFace - .05, .62]], 'y', [0, 0, 17.8], 0xd9dcd6);
                ring(kit, [0, zenithFace - .015, 17.8], .772, 'y', 0xeceee9, .018);
                ring(kit, [0, zenithFace - .006, 17.8], .603, 'y', 0x2b3035, .012);
                for (let i = 0; i < 20; i++) {
                    const a = (i + .5) * Math.PI / 10;
                    kit.box([Math.cos(a) * .69, zenithFace + .001, 17.8 + Math.sin(a) * .69], [.05, .008, .085], 0x2b3035, [0, -a, 0], false);
                }
                kit.add(new THREE.RingGeometry(.53, .605, 64).rotateX(-Math.PI / 2), material(0xb9bfbd, .5, .4), [0, zenithFace - .03, 17.8], [1, 1, 1], [0, 0, 0], false);
                const drogueOrange = material(0xd8862c, .55, .15), drogueSkin = drogueOrange.clone();
                drogueSkin.side = THREE.DoubleSide;
                kit.add(new THREE.LatheGeometry([[.53, zenithFace - .03], [.38, zenithFace - .11], [.2, zenithFace - .23], [.095, zenithFace - .34]].map(([r, y]) => new THREE.Vector2(r, y)), 64),
                    drogueSkin, [0, 0, 17.8], [1, 1, 1], [0, 0, 0], false);
                kit.add(shapes.cylinder, drogueOrange, [0, zenithFace - .35, 17.8], [.095, .03, .095]);
                kit.add(new THREE.CylinderGeometry(.068, .078, .12, 24), drogueOrange, [0, zenithFace - .29, 17.8], [1, 1, 1], [0, 0, 0], false);
                kit.add(new THREE.TorusGeometry(.062, .01, 6, 32), drogueOrange, [0, zenithFace - .232, 17.8], [1, 1, 1], [Math.PI / 2, 0, 0], false);
                group.userData.interfaceCenters.zenith = [0, zenithFace, 17.8];
                group.userData.zenithPort = { source: 'Reference photo of the open zenith port', faceRadius: .78, coneMouth: .53, coneDepth: .31, latchSlots: 20, collarMid: zenithMid };
                // Zarya's measured stepped receiver meets Rassvet at their common nadir plane.
                const receiverScale=.76/.66023, receiverFace=-.93, receiverDepth=.93-nadirSeat;
                const receiverProfile=[[.911185,.66023],[.93436,.66023],[.99482,.684758],[1.04855,.684758],[1.12669,.66757],[1.195066,.62374],
                    [1.195066,.45189],[.911185,.5200]].map(([q,r])=>[-nadirSeat-(q-.911185)/(.283881)*receiverDepth,r*receiverScale]);
                russianDockingBand(kit,receiverProfile,'y',[0,0,17.8]);
                ring(kit,[0,receiverFace+.002,17.8],.62374*receiverScale,'y',0x56605e,.009);
                // External equipment measured on GLB node 24 and redrawn part by part: tanks and their caps, quadrant shields,
                // spherical tanks, side flaps, shoulder hoods, the handrail loops and frames (untextured in the GLB) with the
                // hoop round the forward cone, antennas, and the aft thruster and target cluster. Along the body the GLB axis
                // maps as above; around the docking compartment the parts follow the sphere (centre at z 17.8, scale
                // 1.12 / 1.1424). Hull, compartment shell, docking seats and the folded wings stay as drawn.
                const zaryaReference = assetData.zaryaReference;
                const zaryaSkins = {
                    rail: material(copper, .5, .45), silver: material(palette.silver),
                    light: material(0xbcc2bf, .55, .35), mid: material(0x969d9c, .6, .3), dark: material(0x5f6668, .62, .3),
                    black: material(0x1d2328, .3, .6), bronze: material(0x9b6942, .45, .55), shield: material(0xaeb5b2, .44, .58),
                    tank: material(0xb4bab6, .5, .42), tankCap: material(0xe6e8e3, .7, .1), sphere: material(0xe6e8e3, .7, .1),
                    hood: material(0x9b6942, .62, .46)
                };
                for (const part of zaryaReference.parts) kit.add(measuredGeometry(part), zaryaSkins[part[1]], ...measuredPlacement(part));
                group.userData.bodyReference.equipment = { source: zaryaReference.source, parts: zaryaReference.parts.length };
                // The solar wings are shown folded like an accordion, as in the supplied references: rigid panels hinge on vertical
                // lines and zigzag outward from each root drum (a half-length root panel, then five full panels), with cells on
                // the outboard faces and pale backs.
                const cellCanvas = document.createElement('canvas'); cellCanvas.width = 256; cellCanvas.height = 128;
                const cell = cellCanvas.getContext('2d'); cell.fillStyle = '#071017'; cell.fillRect(0, 0, 256, 128);
                for (let col = 0; col < 12; col++)for (let row = 0; row < 6; row++) {
                    const x = col * 256 / 12, y = row * 128 / 6;
                    cell.fillStyle = (col + row) % 3 === 0 ? '#0b1820' : '#09151d'; cell.fillRect(x + 1, y + 1, 256 / 12 - 2, 128 / 6 - 2);
                }
                cell.strokeStyle = '#68828c'; cell.lineWidth = .65; cell.beginPath();
                for (let col = 0; col <= 12; col++) { const x = col * 256 / 12; cell.moveTo(x, 0); cell.lineTo(x, 128); }
                for (let row = 0; row <= 6; row++) { const y = row * 128 / 6; cell.moveTo(0, y); cell.lineTo(256, y); } cell.stroke();
                cell.fillStyle = '#adc4c5'; for (let col = 0; col <= 12; col++)for (let row = 0; row <= 6; row++)cell.fillRect(col * 256 / 12 - .8, row * 128 / 6 - .8, 1.6, 1.6);
                const cellTexture = new THREE.CanvasTexture(cellCanvas); cellTexture.colorSpace = THREE.SRGBColorSpace; cellTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                const cellSurface = material(0xffffff, .77, .14, cellTexture); cellSurface.side = THREE.DoubleSide;
                const wingZ = 21.45, rootX = 2.54, panelLength = 4.2, panelHeight = 2.0, fold = 82 * Math.PI / 180;
                const amplitude = panelLength * Math.sin(fold), step = panelLength * Math.cos(fold), backSurface = material(0xb4b8b6, .72, .18);
                const facing = normal => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
                group.userData.solarWingFold = { panels: 6, panelLength, panelHeight, foldDegrees: 82 };
                for (const side of [-1, 1]) {
                    // Extend only the inner stem to meet the narrower source barrel; all wing/drum transforms stay fixed.
                    kit.cylinder([side * 1.9025, 0, wingZ], .33, .845, palette.silver, [0, 0, Math.PI / 2]);
                    kit.cylinder([side * 2.27, 0, wingZ], .43, .13, palette.dark, [0, 0, Math.PI / 2]);
                    ring(kit, [side * 2.345, 0, wingZ], .40, 'x', palette.silver, .038);
                    kit.cylinder([side * (rootX - .09), 0, wingZ], .09, .3, palette.dark, [0, 0, Math.PI / 2]);
                    // Hinge lines: the root at the drum, then alternating extremes of the fold.
                    const hinges = [new THREE.Vector3(side * rootX, 0, wingZ)];
                    for (let i = 0; i < 6; i++) hinges.push(new THREE.Vector3(side * (rootX + step * (i + .5)), 0, wingZ + (i % 2 === 0 ? 1 : -1) * amplitude / 2));
                    for (const h of hinges) kit.rod([h.x, -panelHeight / 2 - .06, h.z], [h.x, panelHeight / 2 + .06, h.z], .035, palette.silver);
                    for (let i = 0; i < 6; i++) {
                        const a = hinges[i], b = hinges[i + 1], mid = a.clone().add(b).multiplyScalar(.5), along = b.clone().sub(a), length = along.length();
                        along.normalize();
                        const outward = new THREE.Vector3(along.z, 0, -along.x);
                        if (outward.x * side < 0) outward.negate();
                        kit.box(mid.toArray(), [.035, panelHeight, length - .05], palette.black, [0, Math.atan2(along.x, along.z), 0], false);
                        kit.add(new THREE.PlaneGeometry(length - .1, panelHeight - .08).applyQuaternion(facing(outward)), cellSurface, mid.clone().addScaledVector(outward, .022).toArray(), [1, 1, 1], [0, 0, 0], false);
                        kit.add(new THREE.PlaneGeometry(length - .1, panelHeight - .08).applyQuaternion(facing(outward.clone().negate())), backSurface, mid.clone().addScaledVector(outward, -.022).toArray(), [1, 1, 1], [0, 0, 0], false);
                        for (const y of [-panelHeight / 2, panelHeight / 2]) kit.rod([a.x, y, a.z], [b.x, y, b.z], .018, palette.silver);
                    }
                }
            });
            part('zvezda', 'Zvezda service module', '14 / LIFE SUPPORT & PROPULSION', 'Zvezda brought living quarters, life support and propulsion to the station in 2000. The first long-duration crew arrived that November.', [['Joined station', '2000'], ['Length', '13.1 m']], [0, 2, 34.5], (kit, group) => {
                // Rebuilt from the three supplied Zvezda screenshots. Dimensions are visual estimates.
                // The connected module axes retain their positions; paired collars now share their mating planes.
                const copper = 0x885b3f, white = 0xd9dcd5, silver = 0xaeb5b3, dark = 0x232b32;
                const aftFace = 41.65, wingZ = 33.60;
                const hullProfile = [[29.84, 0.8296719475], [30.10, 0.8296719475], [31 + Math.sqrt(1.2 ** 2 - .80 ** 2), .80], [31.94, .82], [32.34, .82], [32.42, 1.04], [32.72, 1.52], [35.20, 1.52], [35.94, 2.11], [38.90, 2.11], [aftFace, 2.11]];
                function hullRadius(z) {
                    const i = Math.max(1, hullProfile.findIndex(p => p[0] >= THREE.MathUtils.clamp(z, 29.84, aftFace)));
                    const a = hullProfile[i - 1], b = hullProfile[i]; return THREE.MathUtils.lerp(a[1], b[1], THREE.MathUtils.clamp((z - a[0]) / (b[0] - a[0]), 0, 1));
                }
                const onHull = (a, z, lift = 0) => [Math.cos(a) * (hullRadius(z) + lift), Math.sin(a) * (hullRadius(z) + lift), z];
                const radial = a => new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
                function shell(start, end, surface, lift = 0) {
                    const points = [[start, hullRadius(start)], ...hullProfile.filter(p => p[0] > start && p[0] < end), [end, hullRadius(end)]];
                    const geometry = new THREE.LatheGeometry(points.map(([z, r]) => new THREE.Vector2(r + lift, z)), 96).rotateX(Math.PI / 2);
                    // Keep the main barrel's texture rows while inserting the short cylindrical neck ahead of its shoulder.
                    if (start > 31.8 && start < 32 && end === 35.94) {
                        const uv = geometry.attributes.uv, position = geometry.attributes.position;
                        for (let i = 0; i < uv.count; i++) {
                            const z = position.getZ(i);
                            const v = z <= 32.72 ? .4 + .2 * (z - start) / (32.72 - start)
                                : z <= 35.20 ? .6 + .2 * (z - 32.72) / (35.20 - 32.72) : .8 + .2 * (z - 35.20) / .74;
                            uv.setY(i, v);
                        }
                    }
                    kit.add(geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                // Fine procedural blanket relief keeps the self-contained HTML independent of external textures.
                const blanketCanvas = document.createElement('canvas'); blanketCanvas.width = 512; blanketCanvas.height = 512;
                const bc = blanketCanvas.getContext('2d'), pixels = bc.createImageData(512, 512);
                const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7 + 19.3) * 43758.5453; return (n - Math.floor(n)) * 2 - 1; };
                const noise = (x, y, size) => {
                    const xx = x / size, yy = y / size, ix = Math.floor(xx), iy = Math.floor(yy), fx = xx - ix, fy = yy - iy;
                    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
                    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v);
                };
                for (let y = 0; y < 512; y++)for (let x = 0; x < 512; x++) {
                    const value = THREE.MathUtils.clamp(216 + noise(x, y, 53) * 9 + noise(x, y, 19) * 6 + noise(x, y, 6) * 3 + hash(x, y) * 2, 0, 255), i = (y * 512 + x) * 4;
                    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
                }
                bc.putImageData(pixels, 0, 0);
                const blanketTexture = new THREE.CanvasTexture(blanketCanvas); blanketTexture.colorSpace = THREE.SRGBColorSpace;
                blanketTexture.wrapS = blanketTexture.wrapT = THREE.RepeatWrapping; blanketTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                const relief = blanketTexture.clone(); relief.colorSpace = THREE.NoColorSpace; relief.needsUpdate = true;
                const blanket = material(0xf0f1e9, .85, .14, blanketTexture).clone(); blanket.bumpMap = relief; blanket.bumpScale = .009;
                const aluminum = material(0xd4d8d5, .68, .38, blanketTexture).clone(); aluminum.bumpMap = relief; aluminum.bumpScale = .006;
                const aftSkin = material(0x727b81, .65, .39, blanketTexture).clone(); aftSkin.bumpMap = relief; aftSkin.bumpScale = .004;
                shell(31 + Math.sqrt(1.2 ** 2 - .80 ** 2), 35.94, blanket); shell(35.94, 38.90, aluminum); shell(38.90, aftFace, aftSkin);
                group.userData.referenceViews = 3;
                group.userData.reconstruction = 'Reference-only stepped hull, forward solar roots and detailed aft bulkhead';
                group.userData.hullProfile = hullProfile;
                group.userData.solarWingRootZ = wingZ; group.userData.solarWings = 2; group.userData.solarBaysPerWing = 5; group.userData.solarBlankets = 20;
                group.userData.aftFaceZ = aftFace; group.userData.dockingBoreRadius = .84; group.userData.interfaceCenters = { forward: [0, 0, 29.84], zenith: [0, 1.30, 31], nadir: [0, -1.50, 31], aft: [0, 0, 41.88] };
                group.userData.aftAntenna = { base: [0, 1.64, 41.65], head: [0, 1.99, 44.15] };
                // The spherical hub is opened at four circular seats. Each neck starts on its seat,
                // so no complete cylinder runs through the sphere or leaves a ledge at the shoulder.
                const node = [0, 0, 31], nodeRadius = 1.2;
                const radialSeat = Math.sqrt(nodeRadius ** 2 - .80 ** 2);
                const forwardPortRadius = 0.8296719475, forwardSeat = Math.sqrt(nodeRadius ** 2 - forwardPortRadius ** 2);
                const cuts = [{axis: 1, sign: 1, limit: radialSeat}, {axis: 1, sign: -1, limit: radialSeat},
                    {axis: 2, sign: 1, limit: radialSeat}, {axis: 2, sign: -1, limit: forwardSeat}];
                const sphere = new THREE.SphereGeometry(nodeRadius, 96, 64), source = sphere.attributes.position;
                const hubPositions = [], hubNormals = [], hubUV = [];
                function clippedFace(polygon, plane) {
                    const out = [];
                    for (let i = 0; i < polygon.length; i++) {
                        const a = polygon[i], b = polygon[(i + 1) % polygon.length];
                        const da = a[plane.axis] * plane.sign - plane.limit, db = b[plane.axis] * plane.sign - plane.limit;
                        if (da <= 0) out.push(a);
                        if ((da <= 0) !== (db <= 0)) {
                            const t = da / (da - db), p = a.map((v, axis) => v + (b[axis] - v) * t);
                            p[plane.axis] = plane.limit * plane.sign;
                            const axes = [0, 1, 2].filter(axis => axis !== plane.axis);
                            const scale = Math.sqrt(nodeRadius ** 2 - plane.limit ** 2) / Math.hypot(...axes.map(axis => p[axis]));
                            axes.forEach(axis => p[axis] *= scale); out.push(p);
                        }
                    }
                    return out;
                }
                for (let i = 0; i < sphere.index.count; i += 3) {
                    let polygon = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(source, sphere.index.getX(i + k)).toArray());
                    for (const cut of cuts) { if (polygon.length < 3) break; polygon = clippedFace(polygon, cut); }
                    for (let k = 1; k + 1 < polygon.length; k++) {
                        const triangle = [polygon[0], polygon[k], polygon[k + 1]];
                        const u = triangle.map(p => (Math.atan2(p[2], p[0]) / (Math.PI * 2) + 1) % 1);
                        if (Math.max(...u) - Math.min(...u) > .5) u.forEach((v, index) => { if (v < .5) u[index] += 1; });
                        triangle.forEach((p, index) => {
                            hubPositions.push(...p); hubNormals.push(...new THREE.Vector3(...p).normalize().toArray());
                            hubUV.push(u[index], Math.acos(THREE.MathUtils.clamp(p[1] / nodeRadius, -1, 1)) / Math.PI);
                        });
                    }
                }
                const hub = new THREE.BufferGeometry();
                hub.setAttribute('position', new THREE.Float32BufferAttribute(hubPositions, 3));
                hub.setAttribute('normal', new THREE.Float32BufferAttribute(hubNormals, 3));
                hub.setAttribute('uv', new THREE.Float32BufferAttribute(hubUV, 2));
                kit.add(hub, blanket, node, [1, 1, 1], [0, 0, 0], false); sphere.dispose();
                function connectorSkin(profile, axis, surface) {
                    const points = [...profile].sort((a, b) => a[0] - b[0]).map(([distance, radius]) => new THREE.Vector2(radius, distance));
                    const geometry = new THREE.LatheGeometry(points, 96);
                    if (axis === 'z') geometry.rotateX(Math.PI / 2);
                    kit.add(geometry, surface, axis === 'y' ? node : [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                // The short GLB-style forward collar now seats on Zarya's extended terminal adapter.
                const zaryaFace=29.84,zaryaFaceRadius=0.7682588348468345,frontDepth=31-forwardSeat-zaryaFace;
                connectorSkin([[zaryaFace,zaryaFaceRadius],[zaryaFace+frontDepth*.04079/.226669,0.8388661709949639],[31-forwardSeat,forwardPortRadius]],'z',material(silver,.60,.38));
                ring(kit,[0,0,zaryaFace],zaryaFaceRadius+.001,'z',0x56605e,.010);
                ring(kit,[0,0,zaryaFace+frontDepth*.04079/.226669],0.8388661709949639+.002,'z',white,.014);
                ring(kit,[0,0,31-forwardSeat],forwardPortRadius+.006,'z',white,.014);
                for(let i=0;i<8;i++) {const a=i*Math.PI/4+Math.PI/8;
                    kit.box([Math.cos(a)*(0.8388661709949639+.014),Math.sin(a)*(0.8388661709949639+.014),zaryaFace+.086],[.09,.060,.095],silver,[0,0,a],false);}
                const neckRail=(z,lift)=>[-(forwardPortRadius+lift)*Math.cos(.18),-(forwardPortRadius+lift)*Math.sin(.18),z];
                kit.rod(neckRail(29.985,0),neckRail(29.985,.065),.012,copper);
                kit.rod(neckRail(30.080,0),neckRail(30.080,.065),.012,copper);
                kit.rod(neckRail(29.985,.065),neckRail(30.080,.065),.016,copper);
                // The Poisk and Nauka collars mate at y +1.30 and -1.50 respectively.
                // The spherical seats and the necks have the same radius at their shared boundary.
                for (const [side, face] of [[1, 1.30], [-1, 1.50]]) {
                    const profile = [[radialSeat, .80], [face - .18, .80], [face - .12, .86], [face - .085, .90], [face, .90]];
                    connectorSkin(profile.map(([y, r]) => [side * y, r]), 'y', material(silver, .60, .38));
                    ring(kit, [0, side * (radialSeat + .025), 31], .814, 'y', white, .018);
                    ring(kit, [0, side * (face - .12), 31], .869, 'y', white, .018);
                    ring(kit, [0, side * face, 31], .901, 'y', 0x56605e, .012);
                    for (let latch = 0; latch < 8; latch++) {
                        const a = latch * Math.PI / 4 + Math.PI / 8;
                        kit.box([Math.cos(a) * .92, side * (face - .035), 31 + Math.sin(a) * .92], [.11, .15, .105], silver, [0, -a, 0], false);
                        kit.cylinder([Math.cos(a) * .925, side * (face - .12), 31 + Math.sin(a) * .925], .025, .035, palette.rail, [0, 0, 0]);
                    }
                }
                // A softly domed service cover and its small T latch are visible on the near side of the reference.
                const coverRadius = .66, coverSphereRadius = nodeRadius + .016;
                const cover = new THREE.SphereGeometry(coverSphereRadius, 64, 28, 0, Math.PI * 2, 0, Math.asin(coverRadius / coverSphereRadius)).rotateZ(-Math.PI / 2);
                kit.add(cover, aluminum, node, [1, 1, 1], [0, 0, 0], false);
                const coverX = Math.sqrt(coverSphereRadius ** 2 - coverRadius ** 2);
                ring(kit, [coverX, 0, 31], coverRadius, 'x', 0xb7beb8, .009);
                kit.box([1.232, .04, 31.05], [.028, .105, .028], 0x56605e, [0, 0, 0], false);
                kit.box([1.239, .088, 31.05], [.033, .022, .095], 0x56605e, [0, 0, 0], false);
                for (const side of [-1, 1]) for (const zSign of [-1, 1]) {
                    const y = side * .54, z = 31 + zSign * .64, x = Math.sqrt(nodeRadius ** 2 - y * y - (z - 31) ** 2);
                    kit.box([x + .035, y, z], [.085, .075, .16], 0x8c9591, [side * -.2, zSign * .25, 0], false);
                }
                group.userData.connectionRebuild = 'Clipped spherical hub; GLB-shaped Zarya terminal joint; existing Poisk and Nauka collars retained';
                group.userData.nodeSeats = { radius: nodeRadius, radial: radialSeat, forward: forwardSeat, neckRadii: { forward: forwardPortRadius, radial: .80 } };
                group.userData.connectionFaces = { zarya: {axis:'z', coordinate:29.84, radius:0.7682588348468345}, poisk: {axis:'y', coordinate:1.30, radius:.90}, nauka: {axis:'y', coordinate:-1.50, radius:.90} };
                // The port face: a raised circular panel edge enclosing a finned grille, a copper pipe on a plate and a
                // copper handrail that runs down the sphere between two copper arcs.
                kit.add(new THREE.TorusGeometry(.78, .014, 6, 64).rotateY(Math.PI / 2), material(palette.silver), [-Math.sqrt(nodeRadius ** 2 - .78 ** 2), 0, 31], [1, 1, 1], [0, 0, 0], false);
                kit.box([-1.13, -.47, 31], [.03, .15, .64], palette.silver);
                for (const z of [30.75, 31.25]) kit.box([-1.09, -.47, z], [.07, .06, .06], palette.silver, [0, 0, 0], false);
                for (let fin = 0; fin < 14; fin++) kit.cylinder([-1.152, -.47, 30.74 + fin * .04], .011, .1, palette.dark, [0, 0, 0]);
                kit.box([-1.16, -.2, 30.72], [.02, .17, .17], palette.hull);
                kit.rod([-1.19, -.14, 30.65], [-1.19, -.26, 30.8], .022, copper);
                const railPoint = y => [-(Math.sqrt(nodeRadius ** 2 - y * y - .12 ** 2) + .09), y, 31.12];
                const railHeights = [-.95, -.78, -.6, -.42, -.24, -.06, .12, .28];
                for (let i = 1; i < railHeights.length; i++) kit.rod(railPoint(railHeights[i - 1]), railPoint(railHeights[i]), .016, copper);
                for (const y of [-.95, .28]) kit.rod(railPoint(y), [-(Math.sqrt(nodeRadius ** 2 - y * y - .12 ** 2) - .02), y, 31.12], .014, copper);
                for (const [y, radius, standoff] of [[-.72, 1.06, Math.sqrt(nodeRadius ** 2 - .72 ** 2)], [-.98, 1.0, .8]]) {
                    const arc = 2.6;
                    kit.add(new THREE.TorusGeometry(radius, .018, 4, 40, arc).rotateX(Math.PI / 2).rotateY(arc / 2 - Math.PI), material(copper), [0, y, 31], [1, 1, 1], [0, 0, 0], false);
                    for (const t of [-1.1, -.4, .4, 1.1]) kit.rod([-Math.cos(t) * standoff, y, 31 + Math.sin(t) * standoff], [-Math.cos(t) * radius, y, 31 + Math.sin(t) * radius], .014, copper);
                }
                // A small round window above the panel, clear of the zenith neck.
                const onNode = (normal, lift) => new THREE.Vector3(...node).addScaledVector(normal, nodeRadius + lift).toArray();
                const facing = (geometry, normal) => geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal));
                const windowNormal = new THREE.Vector3(-.6, .55, -.58).normalize();
                kit.add(facing(new THREE.CircleGeometry(.16, 32), windowNormal), material(palette.white), onNode(windowNormal, .01), [1, 1, 1], [0, 0, 0], false);
                kit.add(facing(new THREE.CircleGeometry(.1, 32), windowNormal), material(palette.glass, .2, .5), onNode(windowNormal, .018), [1, 1, 1], [0, 0, 0], false);
                kit.add(facing(new THREE.TorusGeometry(.12, .018, 6, 32), windowNormal), material(palette.silver), onNode(windowNormal, .02), [1, 1, 1], [0, 0, 0], false);
                // Short insulated neck between the spherical node and the flared working-compartment shoulder.
                // Its straight section runs from z 31.94 to 32.34; the existing station/module axes remain fixed.
                ring(kit, [0, 0, 31.955], .837, 'z', white, .022);
                ring(kit, [0, 0, 32.315], .837, 'z', silver, .022);
                ring(kit, [0, 0, 32.355], .861, 'z', white, .015);
                const neckPoint = (angle, z, lift = 0) => [Math.cos(angle) * (.82 + lift), Math.sin(angle) * (.82 + lift), z];
                // Small raised plates and a U-shaped grip follow the exposed side in the supplied close-up.
                const neckGripAngle = .45;
                for (const z of [32.055, 32.245]) kit.rod(neckPoint(neckGripAngle, z), neckPoint(neckGripAngle, z, .09), .014, silver);
                kit.rod(neckPoint(neckGripAngle, 32.055, .09), neckPoint(neckGripAngle, 32.245, .09), .018, 0x7f8984);
                for (const [angle, z] of [[.98, 32.02], [1.34, 32.21]]) {
                    kit.box(neckPoint(angle, z, .05), [.16, .075, .12], silver, [0, 0, angle - Math.PI / 2], false);
                    kit.box(neckPoint(angle, z, .093), [.14, .024, .10], 0x56605e, [0, 0, angle - Math.PI / 2], false);
                }
                group.userData.shortForwardNeck = { start: 31.94, end: 32.34, radius: .82, shoulderEnd: 32.72, construction: 'procedural' };
                // The neck and shoulder carry two copper rails, a row of connectors, a disc antenna and boxes,
                // ending at a copper ring handrail with rungs around the compartment's front edge.
                const onCone = (angle, z, lift) => [Math.cos(angle) * (hullRadius(z) + lift), Math.sin(angle) * (hullRadius(z) + lift), z];
                for (const angle of [3.49, 3.72]) for (let i = 1; i <= 3; i++) kit.rod(onCone(angle, 31.98 + (i - 1) * .075, .07), onCone(angle, 31.98 + i * .075, .07), .016, copper);
                for (let n = 0; n < 7; n++) {
                    const z = 32.00 + n * .028, angle = 3.93;
                    kit.add(new THREE.CylinderGeometry(.024, .024, .07, 8).rotateZ(angle - Math.PI / 2), material(palette.dark), onCone(angle, z, .03), [1, 1, 1], [0, 0, 0], false);
                }
                kit.rod(onCone(2.62, 32.10, 0), onCone(2.62, 32.10, .17), .016, palette.silver);
                kit.add(new THREE.CylinderGeometry(.1, .1, .018, 20).rotateZ(2.62 - Math.PI / 2), material(palette.white), onCone(2.62, 32.10, .18), [1, 1, 1], [0, 0, 0]);
                kit.box(onCone(2.95, 32.0, .08), [.18, .16, .2], palette.white, [0, 0, 2.95 - Math.PI / 2]);
                kit.box(onCone(2.3, 32.05, .07), [.2, .14, .16], palette.white, [0, 0, 2.3 - Math.PI / 2]);
                kit.add(new THREE.TorusGeometry(1.72, .022, 5, 72), material(copper), [0, 0, 32.8], [1, 1, 1], [0, 0, 0], false);
                for (let rung = 0; rung < 16; rung++) {
                    const a = rung * Math.PI / 8 + Math.PI / 16;
                    kit.rod([Math.cos(a) * hullRadius(32.8), Math.sin(a) * hullRadius(32.8), 32.8], [Math.cos(a) * 1.72, Math.sin(a) * 1.72, 32.8], .014, copper);
                }
                // Rolled white seams separate the narrow cylinder, flared shoulder and two broad silver barrel bands.
                for (const z of [32.74, 33.48, 35.16, 35.94, 37.43, 38.88]) {
                    shell(z - .031, z + .031, material(white, .77, .12), .025);
                    ring(kit, [0, 0, z - .045], hullRadius(z) + .029, 'z', silver, .012);
                    ring(kit, [0, 0, z + .045], hullRadius(z) + .029, 'z', white, .016);
                }
                // Narrow meridian seams follow every change of diameter.
                for (let seam = 0; seam < 12; seam++) {
                    const a = seam * Math.PI / 6;
                    const route = [32.72, 33.48, 35.16, 35.20, 35.94].map(z => onHull(a, z, .012));
                    for (let i = 1; i < route.length; i++)kit.rod(route[i - 1], route[i], .009, 0xb7beb7);
                }
                function patch(a, z, width, length, color, lift = .018) {
                    const radius = hullRadius(z), span = width / radius;
                    kit.add(new THREE.CylinderGeometry(radius + lift, radius + lift, length, 16, 1, true, a - span / 2 + Math.PI / 2, span), material(color, .79, .20), [0, 0, z], [1, 1, 1], [Math.PI / 2, 0, 0], false);
                }
                function surfaceCylinder(a, z, radius, length, color, lift) {
                    const normal = radial(a), rot = new THREE.Quaternion().setFromUnitVectors(vertical, normal);
                    kit.add(new THREE.CylinderGeometry(radius, radius, length, 24).applyQuaternion(rot), material(color), onHull(a, z, lift), [1, 1, 1], [0, 0, 0], false);
                }
                function handhold(a, z0, z1, rise = .13, color = copper) {
                    kit.rod(onHull(a, z0, .015), onHull(a, z0, rise), .016, color);
                    kit.rod(onHull(a, z0, rise), onHull(a, z1, rise), .023, color);
                    kit.rod(onHull(a, z1, rise), onHull(a, z1, .015), .016, color);
                }
                // Louvres and squared copper handholds sit in two longitudinal bays on the small forward cylinder.
                for (const z of [33.12, 34.36]) {
                    const a = Math.PI / 2, bayLength = z === 33.12 ? .70 : 1.02;
                    kit.box(onHull(a, z, .029), [.35, .05, bayLength], white, [0, 0, 0], false);
                    for (let slat = 0; slat < 11; slat++) {
                        const depth = z - (bayLength - .16) / 2 + slat * (bayLength - .16) / 10;
                        kit.box(onHull(a, depth, .065), [.28, .045, .024], silver, [-.38, 0, 0], false);
                        kit.box(onHull(a, depth + .022, .049), [.27, .012, .018], dark, [0, 0, 0], false);
                    }
                    for (const railAngle of [a - .33, a + .33]) handhold(railAngle, z - bayLength / 2 - .04, z + bayLength / 2 + .04, .14);
                }
                kit.box([0, 1.58, 33.61], [.28, .045, .25], silver, [0, 0, 0], false);
                for (const x of [-.085, 0, .085]) for (const z of [33.535, 33.61, 33.685]) kit.cylinder([x, 1.625, z], .022, .063, dark, [0, 0, 0]);
                // Subtle rounded service-panel seams are fitted to the blanket, avoiding the old oversized tile boxes.
                function blanketLoop(a, z, w, l) {
                    const path = new THREE.Shape(), r = .12;
                    path.moveTo(-w / 2 + r, -l / 2); path.lineTo(w / 2 - r, -l / 2); path.quadraticCurveTo(w / 2, -l / 2, w / 2, -l / 2 + r); path.lineTo(w / 2, l / 2 - r); path.quadraticCurveTo(w / 2, l / 2, w / 2 - r, l / 2); path.lineTo(-w / 2 + r, l / 2); path.quadraticCurveTo(-w / 2, l / 2, -w / 2, l / 2 - r); path.lineTo(-w / 2, -l / 2 + r); path.quadraticCurveTo(-w / 2, -l / 2, -w / 2 + r, -l / 2);
                    const points = path.getPoints(9).map(p => new THREE.Vector3(...onHull(a + p.x / hullRadius(z + p.y), z + p.y, .026)));
                    kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 72, .011, 5, true), material(0xb4bcb5), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                for (const a of [.48, 2.67, 4.32, 5.35]) for (const z of [33.10, 34.4]) blanketLoop(a, z, .72, z === 33.10 ? .70 : 1.08);
                // Two copper conduit runs continue across the widening shoulder.
                for (const a of [.69, 2.45]) {
                    const route = [32.85, 33.1, 34.3, 35.05, 35.2, 35.94, 36.2].map(z => onHull(a, z, .054));
                    for (let i = 1; i < route.length; i++)kit.rod(route[i - 1], route[i], .017, copper);
                    for (const z of [32.95, 34.6, 35.8]) kit.rod(onHull(a, z, .01), onHull(a, z, .078), .026, silver);
                }
                for (const z of [35.24, 35.56]) {
                    const radius = hullRadius(z) + .10;
                    ring(kit, [0, 0, z], radius, 'z', copper, .017);
                    for (let n = 0; n < 8; n++) { const a = n * Math.PI / 4; kit.rod(onHull(a, z), onHull(a, z, .1), .013, copper); }
                }
                // Short black rounded covers repeat along the two large barrel bands, as visible in the plan view.
                for (const z of [37.18, 38.64]) for (let n = 0; n < 6; n++) {
                    const a = Math.PI / 6 + n * Math.PI / 3, seat = onHull(a, z, .073);
                    kit.box(onHull(a, z - .08, .026), [.19, .045, .36], white, [0, 0, a - Math.PI / 2], false);
                    kit.add(new THREE.SphereGeometry(1, 20, 16), material(0x202a30, .36, .51), seat, [.10, .14, .25], [0, 0, a - Math.PI / 2], false);
                }
                patch(Math.PI / 2, 36.20, .72, .59, 0x707879);
                for (const a of [0, Math.PI]) patch(a, 36.25, .23, .67, silver);
                patch(Math.PI / 2 + .97, 37.68, .64, .24, 0x505b5e);
                // A visible porthole on each flank of the broad band; fine rim layers stay close to the hull.
                for (const a of [.15, Math.PI - .15]) {
                    const z = 38.02, normal = radial(a), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
                    const face = (g, col, lift) => kit.add(g.applyQuaternion(q), material(col, .36, .35), onHull(a, z, lift), [1, 1, 1], [0, 0, 0], false);
                    face(new THREE.CircleGeometry(.24, 40), dark, .021);
                    face(new THREE.RingGeometry(.177, .219, 40), silver, .030);
                    face(new THREE.CircleGeometry(.172, 40), 0x52636b, .029);
                    face(new THREE.TorusGeometry(.203, .014, 6, 40), white, .037);
                }
                // The aft shroud is long and full diameter, with two rows of bolted curved rectangular panels.
                for (let sector = 0; sector < 12; sector++) {
                    const a = sector * Math.PI / 6, half = Math.PI / 12 - .025;
                    for (const [z0, z1] of [[38.95, 40.12], [40.17, 41.56]]) {
                        patch(a, (z0 + z1) / 2, (half * 2) * 2.11, z1 - z0, (sector % 4 === 1) ? 0x747c80 : 0x626c73, .013);
                        for (const edge of [-half, half]) kit.rod(onHull(a + edge, z0, .028), onHull(a + edge, z1, .028), .012, silver);
                        for (const z of [z0, z1]) {
                            const route = []; for (let i = 0; i <= 10; i++)route.push(onHull(a - half + i * 2 * half / 10, z, .027));
                            for (let i = 1; i < route.length; i++)kit.rod(route[i - 1], route[i], .011, silver);
                        }
                        for (const edge of [-half + .057, half - .057]) for (const z of [z0 + .085, z1 - .085]) {
                            surfaceCylinder(a + edge, z, .030, .012, 0xcbd0cb, .037);
                            surfaceCylinder(a + edge, z, .013, .014, dark, .046);
                        }
                        surfaceCylinder(a, (z0 + z1) / 2, .013, .012, dark, .031);
                    }
                }
                for (const z of [38.91, 40.145, 41.60]) ring(kit, [0, 0, z], 2.129, 'z', silver, .021);
                for (const a of [.50, 2.59, 4.05, 5.62]) {
                    kit.rod(onHull(a, 39.13, .024), onHull(a, 39.50, .15), .014, silver);
                    surfaceCylinder(a, 39.50, .025, .055, dark, .14);
                }
                // Two mirrored wings: five bays, a narrow cell-covered central spine, and deeper outer two bays.
                // Their hubs are on the small cylinder, well forward of the shoulder and aft shroud.
                const solarCanvas = document.createElement('canvas'); solarCanvas.width = 300; solarCanvas.height = 180;
                const sc = solarCanvas.getContext('2d'); sc.fillStyle = '#050b10'; sc.fillRect(0, 0, 300, 180);
                for (let x = 0; x < 10; x++)for (let y = 0; y < 6; y++) {
                    sc.fillStyle = (x + y) % 4 === 0 ? '#0a171e' : '#071219'; sc.fillRect(x * 30 + 1, y * 30 + 1, 28, 28);
                }
                sc.strokeStyle = '#728c94'; sc.lineWidth = .7; sc.beginPath();
                for (let i = 0; i <= 10; i++) { sc.moveTo(i * 30, 0); sc.lineTo(i * 30, 180); }
                for (let i = 0; i <= 6; i++) { sc.moveTo(0, i * 30); sc.lineTo(300, i * 30); } sc.stroke();
                sc.fillStyle = '#aec5c8'; for (let x = 0; x <= 10; x++)for (let y = 0; y <= 6; y++)sc.fillRect(x * 30 - 1, y * 30 - 1, 2, 2);
                const solarTexture = new THREE.CanvasTexture(solarCanvas); solarTexture.colorSpace = THREE.SRGBColorSpace; solarTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                const solarSkin = material(0xffffff, .73, .18, solarTexture).clone(); solarSkin.side = THREE.DoubleSide;
                const bayWidth = 2.58, rootX = 2.17;
                for (const side of [-1, 1]) {
                    kit.cylinder([side * 1.54, 0, wingZ], .33, .22, dark, [0, 0, Math.PI / 2]);
                    ring(kit, [side * 1.668, 0, wingZ], .29, 'x', silver, .032);
                    kit.cylinder([side * 1.79, 0, wingZ], .14, .25, silver, [0, 0, Math.PI / 2]);
                    kit.rod([side * 1.8, 0, wingZ], [side * (rootX + 5 * bayWidth), 0, wingZ], .052, dark);
                    for (let bay = 0; bay < 5; bay++) {
                        const x = side * (rootX + (bay + .5) * bayWidth), w = bayWidth - .07, depth = bay < 3 ? 1.47 : 1.64;
                        for (const row of [-1, 1]) {
                            const z = wingZ + row * (.20 + depth / 2);
                            kit.box([x, 0, z], [w, .032, depth], dark, [0, 0, 0], false);
                            for (const face of [-1, 1]) kit.add(new THREE.PlaneGeometry(w - .022, depth - .025), solarSkin, [x, face * .02, z], [1, 1, 1], [face > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0], false);
                            for (const edge of [-1, 1]) {
                                kit.rod([x - w / 2, .012, z + edge * depth / 2], [x + w / 2, .012, z + edge * depth / 2], .014, silver);
                                kit.rod([x + edge * w / 2, .012, z - depth / 2], [x + edge * w / 2, .012, z + depth / 2], .014, silver);
                            }
                        }
                        const ends = [x - w / 2, x + w / 2], spine = [];
                        for (const [dx, dz] of [[-.5, -.12], [.5, -.12], [.53, -.065], [.53, .065], [.5, .12], [-.5, .12], [-.53, .065], [-.53, -.065], [-.5, -.12]]) spine.push([x + dx * (w - .06) / 1.06, .025, wingZ + dz]);
                        for (let i = 1; i < spine.length; i++)kit.rod(spine[i - 1], spine[i], .024, silver);
                        const texture = solarTexture.clone(); texture.repeat.set(1, 1 / 6); texture.needsUpdate = true;
                        const spineSkin = material(0xffffff, .73, .18, texture); spineSkin.side = THREE.DoubleSide;
                        kit.add(new THREE.PlaneGeometry(w - .17, .19), spineSkin, [x, .027, wingZ], [1, 1, 1], [-Math.PI / 2, 0, 0], false);
                        for (const edge of [-1, 1]) kit.rod([side * (rootX + bay * bayWidth), -.036, wingZ + edge * .13], [side * (rootX + bay * bayWidth), -.036, wingZ + edge * (.20 + depth)], .023, silver);
                    }
                    for (const edge of [-1, 1]) kit.rod([side * 1.72, 0, wingZ], [side * rootX, 0, wingZ + edge * .13], .032, silver);
                }
                // Full-diameter blue-grey aft bulkhead with a deep dark docking recess and bright annular lip.
                const aftBlue = material(0x465369, .72, .29), recess = material(0x151c26, .43, .38).clone(); recess.side = THREE.DoubleSide;
                kit.add(new THREE.RingGeometry(1.16, 2.11, 96), aftBlue, [0, 0, aftFace], [1, 1, 1], [0, 0, 0], false);
                ring(kit, [0, 0, aftFace - .013], 2.092, 'z', 0x667381, .043);
                kit.add(new THREE.LatheGeometry([[.84, 40.95], [.86, 41.28], [1.18, 41.65]].map(([r, z]) => new THREE.Vector2(r, z)), 64).rotateX(Math.PI / 2), recess, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                kit.add(new THREE.LatheGeometry([[1.17, 41.60], [1.12, 41.72], [.98, 41.86], [.98, 41.88]].map(([r, z]) => new THREE.Vector2(r, z)), 64).rotateX(Math.PI / 2), recess, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                kit.add(new THREE.RingGeometry(.845, .98, 64), material(0xb6c0c5, .43, .51), [0, 0, 41.887], [1, 1, 1], [0, 0, 0], false);
                kit.add(new THREE.LatheGeometry([[.84, 40.96], [.845, 41.88]].map(([r, z]) => new THREE.Vector2(r, z)), 64).rotateX(Math.PI / 2), recess, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                ring(kit, [0, 0, 41.875], .986, 'z', dark, .022);
                kit.cylinder([0, 0, 40.94], .84, .016, 0x080e16);
                // Recessed radial fittings remain behind the existing Soyuz collar when it is visible.
                for (let rib = 0; rib < 12; rib++) {
                    const a = rib * Math.PI / 6;
                    kit.rod([Math.cos(a) * .24, Math.sin(a) * .24, 40.957], [Math.cos(a) * .80, Math.sin(a) * .80, 41.008], .013, 0x56616b);
                }
                // Two hollow, flared side outlets. Their dark throats are inset, not painted flush on the face.
                for (const side of [-1, 1]) {
                    const x = side * 1.62, y = -.02, z = aftFace + .15;
                    kit.add(new THREE.CylinderGeometry(.305, .235, .29, 40, 1, true).rotateX(Math.PI / 2), material(silver, .4, .62), [x, y, z], [1, 1, 1], [0, 0, 0], false);
                    kit.add(new THREE.CylinderGeometry(.28, .214, .275, 40, 1, true).rotateX(Math.PI / 2), recess, [x, y, z + .007], [1, 1, 1], [0, 0, 0], false);
                    kit.cylinder([x, y, aftFace + .024], .217, .013, 0x080e16);
                    ring(kit, [x, y, aftFace + .295], .294, 'z', silver, .016);
                }
                // Triangular pads, small sensor housings and the bottom T-shaped target match the aft reference.
                for (const [a, r] of [[.55, 1.72], [2.25, 1.57], [3.96, 1.83], [5.16, 1.78]]) {
                    const center = [Math.cos(a) * r, Math.sin(a) * r, aftFace + .052];
                    kit.add(new THREE.CylinderGeometry(.175, .175, .075, 3).rotateX(Math.PI / 2).rotateZ(a), material(white), center);
                    kit.cylinder([center[0], center[1], aftFace + .102], .032, .024, dark);
                }
                kit.box([-.33, .92, aftFace + .087], [.25, .22, .14], silver);
                kit.box([-.33, .92, aftFace + .163], [.15, .14, .025], 0x4f606f, [0, 0, 0], false);
                kit.box([0, -1.62, aftFace + .075], [1.15, .11, .075], white, [0, 0, 0], false);
                kit.box([0, -1.81, aftFace + .075], [.075, .34, .075], white, [0, 0, 0], false);
                ring(kit, [0, -1.982, aftFace + .10], .09, 'z', silver, .020);
                for (const side of [-1, 1]) kit.box([side * .60, -1.62, aftFace + .07], [.18, .16, .065], white, [0, 0, side * .34], false);
                // Copper runs around the docking cowl and across the face terminate on small standoff brackets.
                function faceRail(points) {
                    const p = points.map(([x, y]) => [x, y, aftFace + .10]);
                    for (let i = 1; i < p.length; i++)kit.rod(p[i - 1], p[i], .018, copper);
                    for (const i of [0, p.length - 1]) kit.rod([p[i][0], p[i][1], aftFace], p[i], .017, copper);
                }
                faceRail([[-1.65, .78], [-1.27, .78], [-1.27, 1.43], [-.76, 1.43]]);
                faceRail([[-1.75, -.63], [-1.26, -.63], [-1.26, -1.36], [-.42, -1.36]]);
                faceRail([[-1.74, -.78], [-1.42, -.78], [-1.42, -1.51], [-.52, -1.51]]);
                faceRail([[1.87, .53], [1.43, .53], [1.29, .36]]);
                for (const [a, span, r] of [[.57, .37, 1.18], [2.5, .25, 1.25], [4.65, .39, 1.18]]) {
                    const path = []; for (let i = 0; i <= 18; i++) { const b = a + i * span / 18; path.push([Math.cos(b) * r, Math.sin(b) * r]); } faceRail(path);
                }
                for (let bracket = 0; bracket < 12; bracket++) {
                    const a = bracket * Math.PI / 6 + .055;
                    kit.box(onHull(a, 41.47, .046), [.18, .07, .30], silver, [0, 0, a - Math.PI / 2], false);
                    const rim = (angle, lift) => [Math.cos(angle) * (2.11 + lift), Math.sin(angle) * (2.11 + lift), 41.47];
                    kit.rod(rim(a - .10, .02), rim(a - .10, .15), .014, copper);
                    kit.rod(rim(a - .10, .15), rim(a + .10, .15), .021, copper);
                    kit.rod(rim(a + .10, .15), rim(a + .10, .02), .014, copper);
                }
                // Clustered end-mounted fittings in the shroud's rim pockets.
                for (const a of [Math.PI / 2, Math.PI * 1.5]) {
                    patch(a, 41.36, .51, .36, 0x242d34, .035);
                    for (const da of [-.065, 0, .065]) for (const z of [41.28, 41.40]) surfaceCylinder(a + da, z, .040, .10, silver, .085);
                }
                // A small aft-pointing cross-tip antenna and a flat white target sit to the lower right of the port.
                const probe = [1.16, -.94, aftFace + .065];
                kit.cylinder(probe, .19, .040, silver);
                kit.rod([probe[0], probe[1], aftFace + .08], [probe[0], probe[1], aftFace + 1.13], .015, copper);
                for (const [dx, dy] of [[.115, 0], [0, .115]]) kit.rod([probe[0] - dx, probe[1] - dy, aftFace + 1.075], [probe[0] + dx, probe[1] + dy, aftFace + 1.075], .012, silver);
                // The large white antenna projects aft from a hinge on the end face, rather than lying along the hull.
                kit.cylinder([0, 1.64, 41.88], .31, .46, white);
                ring(kit, [0, 1.64, 41.76], .315, 'z', silver, .02);
                kit.cylinder([0, 1.64, 42.16], .115, .52, silver, [0, 0, Math.PI / 2]);
                const mastBase = new THREE.Vector3(0, 1.64, 42.18), mastEnd = new THREE.Vector3(0, 1.99, 43.99), mastAxis = mastEnd.clone().sub(mastBase).normalize();
                kit.rod(mastBase.toArray(), mastEnd.toArray(), .085, silver);
                const sleeveStart = mastBase.clone().addScaledVector(mastAxis, .22), sleeveEnd = mastEnd.clone().addScaledVector(mastAxis, -.13);
                kit.add(new THREE.CylinderGeometry(.16, .16, sleeveStart.distanceTo(sleeveEnd), 6).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vertical, mastAxis)), material(white, .83, .11), sleeveStart.clone().lerp(sleeveEnd, .5).toArray(), [1, 1, 1], [0, 0, 0], false);
                kit.add(new THREE.CylinderGeometry(.34, .34, .30, 6, 1, true).rotateX(Math.PI / 2), material(white), [0, 1.99, 44.12], [1, 1, 1], [0, 0, 0], false);
                kit.cylinder([0, 1.99, 43.969], .294, .018, white);
                const dishPoints = [[0, 44.20], [.09, 44.207], [.18, 44.232], [.28, 44.270], [.35, 44.315]].map(([r, z]) => new THREE.Vector2(r, z));
                kit.add(new THREE.LatheGeometry(dishPoints, 48).rotateX(Math.PI / 2), recess, [0, 1.99, 0], [1, 1, 1], [0, 0, 0], false);
                ring(kit, [0, 1.99, 44.316], .352, 'z', silver, .016);
                kit.cylinder([0, 1.99, 44.253], .026, .08, silver);
                kit.box([.35, 1.99, 44.12], [.13, .08, .17], white, [0, .35, 0], false);
            });
            part('nauka', 'Nauka multipurpose laboratory', '15 / SCIENCE & OPERATIONS', 'Nauka docked to Zvezda in July 2021. The Russian laboratory supports research and the seven-joint European Robotic Arm. Its insulated laboratory, white radiator panels, stepped service compartment and framed solar wings follow the supplied photographic and rendered references. The inherited arm pose remains illustrative.', [['Joined station', '2021'], ['ERA joints', '7']], [0, -7.5, 31], (kit, group) => {
                // Reconstructed from the supplied front photograph and oblique render.
                // Local -Y runs from Zvezda to the separately modelled lower adapter; the shared Russian offset is applied later.
                const axisZ = 31, silver = 0xbfc5bc, seam = 0x969d91, ivory = 0xd9d6bf, white = 0xe9ede7, copper = 0xa35e24;
                const foilMap = payloadBlanket.map.clone(); foilMap.wrapS = foilMap.wrapT = THREE.RepeatWrapping; foilMap.repeat.set(5, 9); foilMap.needsUpdate = true;
                const foil = material(ivory, .87, .17, foilMap).clone(), panel = material(white, .79, .10), dark = material(0x303c3c, .76, .15);
                foil.userData.poiskSkin = 'lab';
                const coverSkin = foil.clone(); coverSkin.userData.poiskSkin = 'cover';
                // Broad laboratory above a distinct shoulder and narrower service compartment.
                const profile = [[-10.20, 1.10], [-9.96, 1.43], [-9.66, 1.64], [-9.38, 1.68], [-9.15, 1.63], [-7.04, 1.63], [-6.82, 1.69], [-6.58, 1.91], [-6.29, 2.10], [-3.10, 2.10], [-2.85, 2.06], [-2.57, 1.76], [-2.32, 1.36], [-2.20, 1.05]];
                function radius(y) { let i = profile.findIndex(p => p[0] >= y); i = Math.max(1, i < 0 ? profile.length - 1 : i); const a = profile[i - 1], b = profile[i]; return THREE.MathUtils.lerp(a[1], b[1], THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1)); }
                const around = (a, r, y) => [Math.sin(a) * r, y, axisZ + Math.cos(a) * r];
                const surface = (a, y, lift = 0) => around(a, radius(y) + lift, y);
                const samples = []; for (let i = 1; i < profile.length; i++) { const a = profile[i - 1], b = profile[i], n = Math.max(2, Math.ceil((b[0] - a[0]) / .13)); for (let j = i === 1 ? 0 : 1; j <= n; j++)samples.push(new THREE.Vector2(THREE.MathUtils.lerp(a[1], b[1], j / n), THREE.MathUtils.lerp(a[0], b[0], j / n))); }
                const hull = new THREE.LatheGeometry(samples, 96), hp = hull.attributes.position;
                for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i), a = Math.atan2(x, z), r = Math.hypot(x, z), fade = Math.min(1, (-2.2 - y) * 4, (y + 10.2) * 4); const wrinkle = (Math.sin(a * 39 + y * 23) * Math.sin(a * 17 - y * 31) + .45 * Math.cos(a * 61 + y * 43)) * .004 * fade; hp.setXYZ(i, x * (1 + wrinkle / r), y, z * (1 + wrinkle / r)); }
                hull.computeVertexNormals(); kit.add(hull, foil, [0, 0, axisZ], [1, 1, 1], [0, 0, 0], false);
                function tube(points, r = .014, color = silver) { kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(20, points.length * 6), r, 6, false), material(color, .8, .18), [0, 0, 0], [1, 1, 1], [0, 0, 0], false); }
                function surfaceTube(a, ys, lift = .045, r = .012, color = seam) { tube(ys.map(y => surface(a, y, lift)), r, color); }
                function hoop(y, r = radius(y) + .025, t = .021, color = silver) { ring(kit, [0, y, axisZ], r, 'y', color, t); }
                function axial(center, normal, geometry, mat) { geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vertical, new THREE.Vector3(...normal).normalize())); kit.add(geometry, typeof mat === 'number' ? material(mat) : mat, center, [1, 1, 1], [0, 0, 0], false); }
                function cap(a, y, r = .18, lift = .09, color = copper) { const normal = [Math.sin(a), 0, Math.cos(a)], p = surface(a, y, lift); axial(p, normal, new THREE.CylinderGeometry(r * 1.17, r * 1.17, .10, 12), silver); axial(surface(a, y, lift + .07), normal, new THREE.CylinderGeometry(r, r * .95, .09, 32), color); const rim = new THREE.TorusGeometry(r * .91, .017, 6, 32).rotateX(Math.PI / 2); axial(surface(a, y, lift + .12), normal, rim, 0xd39a4f); }
                function patch(a, y, w, h, d = .055, color = ivory, lift = .04) { const p = surface(a, y, lift + d * .5); if (color === ivory || color === 0xe2dfcb) kit.add(shapes.box, coverSkin, p, [w, h, d], [0, a, 0], false); else kit.box(p, [w, h, d], color, [0, a, 0], false); }
                function handrail(a, y, h = .53) { const lo = y - h / 2, hi = y + h / 2; kit.rod(surface(a, lo, .08), surface(a, lo, .20), .019, silver); kit.rod(surface(a, hi, .08), surface(a, hi, .20), .019, silver); tube([surface(a, lo, .20), surface(a, y, .20), surface(a, hi, .20)], .026, 0xccc8a9); }
                // Original docking interfaces keep both connected modules seated on their existing axes.
                for (const [y, r] of [[-2.2, 1.05], [-10.2, 1.10]]) kit.add(shapes.sphere, foil, [0, y, axisZ], [r, r * .16, r], [0, 0, 0], false);
                // The upper adapter flares smoothly into Nauka's existing shoulder, with its 0.90 m flange
                // ending exactly at Zvezda's nadir face y = -1.50.
                const upperConnector = new THREE.LatheGeometry([[-2.20, 1.04], [-2.15, 1.01], [-2.02, .78], [-1.62, .78], [-1.58, .90], [-1.50, .90]].map(([y, r]) => new THREE.Vector2(r, y)), 96);
                kit.add(upperConnector, material(silver, .62, .38), [0, 0, axisZ], [1, 1, 1], [0, 0, 0], false);
                hoop(-1.58, .90, .015, white); hoop(-2.03, .795, .020, silver);
                group.userData.serviceModuleFace = {axis: 'y', coordinate: -1.50, radius: .90};
                for (const [y, sign, endRadius] of [[-10.2, -1, 1.47]]) {
                    kit.cylinder([0, y + sign * .30, axisZ], endRadius * .57, .65, white, [0, 0, 0]);
                    hoop(y + sign * .56, endRadius * .59, .065, silver); hoop(y + sign * .67, endRadius * .56, .08, 0x47514e);
                    kit.cylinder([0, y + sign * .68, axisZ], endRadius * .42, .045, silver, [0, 0, 0]);
                    hoop(y + sign * .712, endRadius * .40, .025, white);
                    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; axial(around(a, endRadius * .49, y + sign * .74), [0, sign, 0], new THREE.CylinderGeometry(.055, .055, .065, 8), silver); }
                }
                // Blanket seam belts, longitudinal sewn joins and short service-line clamps.
                for (const y of [-2.84, -3.10, -6.32, -6.65, -7.13, -8.48, -9.26, -9.66, -9.92]) hoop(y, radius(y) + .032, y === -6.32 ? .038 : .019);
                for (const a of [.25, 1.12, 1.96, 2.53, 3.03, 3.77, 4.56, 5.42, 5.99]) surfaceTube(a, profile.map(p => p[0]), .018, .008, 0xb9bbaa);
                // Tall white radiator panels leave a deep, exposed front service corridor.
                const radiatorSpecs = [{ a: 2.49, span: .57 }, { a: 3.88, span: .74 }, { a: .38, span: .86 }, { a: 5.54, span: .64 }];
                const panelY = -4.71, panelH = 3.64, panelR = 2.245;
                for (const spec of radiatorSpecs) {
                    const a0 = spec.a - spec.span / 2, a1 = spec.a + spec.span / 2;
                    const shell = new THREE.CylinderGeometry(panelR, panelR, panelH, 32, 1, true, a0, spec.span); const skin = panel.clone(); skin.side = THREE.DoubleSide; kit.add(shell, skin, [0, panelY, axisZ], [1, 1, 1], [0, 0, 0], false);
                    for (const a of [a0, a1]) { kit.rod(around(a, panelR + .005, panelY - panelH / 2), around(a, panelR + .005, panelY + panelH / 2), .025, 0xd8ded7); for (const y of [-3.14, -4.64, -6.25]) kit.rod(surface(a, y, .02), around(a, panelR - .012, y), .037, silver); }
                    for (const y of [panelY - panelH / 2, panelY + panelH / 2]) { const pts = []; for (let j = 0; j <= 16; j++)pts.push(around(a0 + j * spec.span / 16, panelR + .009, y)); tube(pts, .024, white); }
                    for (let j = 1; j < 33; j++) { const y = panelY - panelH / 2 + j * panelH / 33, pts = []; for (let k = 0; k <= 12; k++)pts.push(around(a0 + .024 + k * (spec.span - .048) / 12, panelR + .015, y)); tube(pts, .004, j % 6 === 0 ? 0xcbd3ce : 0xe1e6e0); }
                    for (const y of [-3.08, -6.35]) for (const a of [a0 + .045, a1 - .045]) { axial(around(a, panelR + .018, y), [Math.sin(a), 0, Math.cos(a)], new THREE.CylinderGeometry(.024, .024, .014, 8), silver); }
                }
                // The flank has a separate louvered radiator, with raised horizontal flow channels.
                const louverA = 4.77, louverSpan = .47, louverR = 2.20;
                const lv = new THREE.CylinderGeometry(louverR, louverR, 2.42, 24, 1, true, louverA - louverSpan / 2, louverSpan); const lvm = panel.clone(); lvm.side = THREE.DoubleSide; kit.add(lv, lvm, [0, -5.16, axisZ], [1, 1, 1], [0, 0, 0], false);
                for (let j = 0; j < 16; j++) { const y = -6.29 + j * .15, pts = []; for (let k = 0; k <= 12; k++)pts.push(around(louverA - louverSpan / 2 + .018 + k * (louverSpan - .036) / 12, louverR + .026, y)); tube(pts, .021, 0xe0e6de); }
                // Dark tapered recess at the top of the front corridor, with foil-clad avionics beneath it.
                const gapA = Math.PI;
                patch(gapA, -3.34, .41, .68, .085, 0x303937, .062);
                const hood = new THREE.ConeGeometry(.245, .46, 4, 1, true).rotateY(Math.PI / 4); kit.add(hood, dark, surface(gapA, -3.56, .15), [1, 1, 1], [Math.PI, 0, 0], false);
                for (const [a, y, w, h] of [[3.09, -3.98, .42, .35], [3.15, -4.48, .33, .32], [3.03, -5.07, .44, .57], [3.19, -5.69, .39, .39], [3.05, -6.15, .35, .24], [1.73, -3.71, .39, .33], [5.02, -6.70, .26, .43]]) {
                    patch(a, y, w + .075, h + .07, .06, silver, .10); kit.add(payloadPillow.clone().scale(w, h, .14), coverSkin, surface(a, y, .22), [1, 1, 1], [0, a, 0], false);
                }
                for (const a of [2.99, 3.26]) { surfaceTube(a, [-3.65, -4.0, -4.6, -5.1, -5.8, -6.45], .11, .019, silver); for (const y of [-4.1, -4.91, -5.87]) patch(a, y, .17, .08, .045, silver, .12); }
                // Sparse fittings and amber covers on the lower service barrel, staggered as in the photograph.
                for (const [a, y, r] of [[2.34, -7.29, .22], [3.98, -7.13, .25], [2.51, -8.98, .21], [3.84, -9.10, .24]]) { patch(a, y, .66, .65, .07, 0xc7c7b6, .04); cap(a, y, r, .17, copper); handrail(a + .26, y + .04, .40); }
                cap(3.22, -8.26, .155, .09, 0x293a3e);
                for (const [a, y, w, h] of [[3.00, -7.58, .43, .45], [3.52, -8.66, .38, .43], [4.59, -7.56, .39, .58], [1.68, -8.03, .31, .38], [5.39, -9.0, .33, .27], [.2, -8.15, .49, .46]]) patch(a, y, w, h, .05, 0xe2dfcb, .028);
                for (const a of [1.91, 3.58, 5.01]) { surfaceTube(a, [-6.63, -7.03, -7.64, -8.39, -9.10, -9.62], .11, .027, silver); for (const y of [-7.28, -8.52, -9.29]) patch(a, y, .19, .095, .055, silver, .10); }
                for (const [a, y] of [[2.06, -7.97], [3.48, -7.8], [4.32, -8.20], [5.82, -7.69], [2.85, -9.53], [.61, -9.34], [1.51, -4.18], [1.52, -5.44]]) handrail(a, y, .57);
                // Small dark valve clusters, silver flanges and thermal-blanket fastening tabs.
                for (const [a, y] of [[4.44, -8.7], [1.28, -7.32], [3.07, -9.64]]) {
                    patch(a, y, .24, .43, .09, 0x828a7e, .08);
                    for (const dy of [-.13, 0, .13]) for (const da of [-.043, .043]) cap(a + da, y + dy, .039, .20, 0x343c38);
                }
                for (const y of [-6.48, -9.66]) for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6 + .08; patch(a, y, .15, .16, .042, 0xc4c8ba, .056); }
                // The paired octagonal instrument targets remain above the radiator rim.
                for (const a of [2.56, 3.98]) { const p = surface(a, -2.63, .035); axial(p, [Math.sin(a) * .8, .6, Math.cos(a) * .8], new THREE.CylinderGeometry(.12, .16, .13, 8), silver); }
                // Dark, warm solar-cell blankets: six framed bays on either side of a central deployment spar.
                const cellCanvas = document.createElement('canvas'); cellCanvas.width = 768; cellCanvas.height = 768; const cg = cellCanvas.getContext('2d'); cg.fillStyle = '#252a2c'; cg.fillRect(0, 0, 768, 768);
                for (let y = 0; y < 24; y++)for (let x = 0; x < 24; x++) { cg.fillStyle = ['#303235', '#34383a', '#353430', '#2b3033'][(x * 7 + y * 3) % 4]; cg.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); cg.fillStyle = '#9d9d8960'; cg.fillRect(x * 32 + 15, y * 32 + 2, 1, 28); }
                cg.strokeStyle = '#c2b696'; cg.lineWidth = 4; for (let k = 0; k <= 4; k++) { cg.beginPath(); cg.moveTo(k * 192, 0); cg.lineTo(k * 192, 768); cg.moveTo(0, k * 192); cg.lineTo(768, k * 192); cg.stroke(); }
                const cells = new THREE.CanvasTexture(cellCanvas); cells.colorSpace = THREE.SRGBColorSpace; cells.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
                const cellMat = material(0xffffff, .78, .18, cells);
                for (const side of [-1, 1]) {
                    const y = -6.7, z = 32.2;
                    kit.rod([side * 1.24, y, z], [side * 3.04, y, z], .115, silver); kit.cylinder([side * 2.22, y, z], .31, .39, white, [0, 0, Math.PI / 2]); ring(kit, [side * 2.47, y, z], .30, 'x', silver, .032);
                    kit.box([side * 2.94, y, z], [.32, .37, .37], silver); kit.rod([side * 3.02, y, z], [side * 12.56, y, z], .073, 0x8c938b);
                    for (let bay = 0; bay < 6; bay++)for (const row of [-1, 1]) {
                        const x = side * (3.82 + bay * 1.59), cy = y + row * .90, w = 1.53, h = 1.65;
                        kit.box([x, cy, z], [w, h, .055], 0x5c625b, [0, 0, 0], false);
                        for (const face of [-1, 1]) kit.add(new THREE.PlaneGeometry(w - .06, h - .06), cellMat, [x, cy, z + face * .031], [1, 1, 1], [0, face < 0 ? Math.PI : 0, 0], false);
                        for (const dx of [-w / 2, w / 2]) kit.box([x + dx, cy, z], [.032, h + .025, .071], 0xc4c7b4, [0, 0, 0], false);
                        for (const dy of [-h / 2, h / 2]) kit.box([x, cy + dy, z], [w, .032, .071], 0xc4c7b4, [0, 0, 0], false);
                        for (const dx of [-.54, .54]) kit.box([x + dx, y + row * .065, z], [.14, .115, .10], silver, [0, 0, 0], false);
                    }
                }
                // Three-bay deployed radiator after the supplied 10:29 reference.
                // The marked root is in the exposed front service corridor; the bank opens toward -X from that carrier.
                const radiatorCenter = [-4.115, -4.4, 28.47], radiatorWidth = 7.2, radiatorHeight = 3.2;
                const radiatorGroup = new THREE.Group(); radiatorGroup.name = 'Nauka three-panel deployed radiator'; radiatorGroup.position.fromArray(radiatorCenter); radiatorGroup.rotation.y = Math.PI; group.add(radiatorGroup);
                const radiatorKit = new Kit(), bayWidth = 2.29, gap = .165;
                for (let bay = 0; bay < 3; bay++) {
                    const x = -radiatorWidth / 2 + bayWidth / 2 + bay * (bayWidth + gap);
                    radiatorKit.box([x, 0, 0], [bayWidth, radiatorHeight, .075], white, [0, 0, 0], false);
                    // Rolled perimeter edges, small corner fasteners, and restrained thermal-panel seams.
                    for (const y of [-1.6, 1.6]) radiatorKit.box([x, y, 0], [bayWidth + .025, .035, .094], 0xd5d9cf, [0, 0, 0], false);
                    for (const side of [-1, 1]) {
                        radiatorKit.box([x + side * bayWidth / 2, 0, 0], [.032, 3.22, .094], 0xc4cbc2, [0, 0, 0], false);
                        for (const y of [-1.47, 1.47]) for (const face of [-1, 1]) radiatorKit.cylinder([x + side * (bayWidth / 2 - .095), y, face * .054], .019, .013, silver);
                    }
                    for (const y of bay === 2 ? [-1.18, -.47, .30, 1.02] : [-1.25, 1.25]) for (const face of [-1, 1]) radiatorKit.box([x, y, face * .043], [bayWidth - .11, .012, .010], 0xcbd1c7, [0, 0, 0], false);
                }
                // Two dark folding spines separate the three white bays; four knuckles per spine make the joints legible.
                for (let hinge = 0; hinge < 2; hinge++) {
                    const x = -radiatorWidth / 2 + bayWidth + gap / 2 + hinge * (bayWidth + gap);
                    radiatorKit.box([x, 0, .015], [.095, 3.27, .11], 0x3c4541, [0, 0, 0], false);
                    for (const y of [-1.49, -.52, .52, 1.49]) {
                        radiatorKit.cylinder([x, y, 0], .085, .21, silver, [0, 0, 0]);
                        for (const side of [-1, 1]) radiatorKit.box([x + side * .075, y, 0], [.15, .085, .09], 0xd4d8cd, [0, 0, 0], false);
                    }
                }
                // Root shaft is parallel to the module axis. The rotated bank puts it at x=-.46, z=28.45.
                const rootX = -radiatorWidth / 2;
                radiatorKit.rod([rootX - .055, -1.57, .02], [rootX - .055, 1.57, .02], .067, 0x68746c);
                for (const y of [-1.36, 1.36]) radiatorKit.cylinder([rootX - .055, y, .02], .12, .26, silver, [0, 0, 0]);
                // Slim longitudinal carrier in the corridor, clear of the white curved radiator edges and equipment pillows.
                const carrierX = -.46, carrierZ = 28.82, hingeZ = 28.45;
                const carrierGroup = new THREE.Group(); carrierGroup.name = 'Nauka radiator corridor carrier and hinge'; group.add(carrierGroup);
                const mountKit = new Kit();
                mountKit.box([carrierX, -4.4, carrierZ], [.12, 3.50, .13], 0xc2c8b7, [0, 0, 0], false);
                for (const y of [-2.93, -3.91, -4.92, -5.89]) {
                    const angle = Math.PI + Math.asin(-carrierX / radius(y));
                    const embedded = surface(angle, y, -.025), shoe = surface(angle, y, .018);
                    mountKit.box(shoe, [.22, .22, .105], 0xb5bdad, [0, angle, 0], false);
                    mountKit.rod(embedded, [carrierX, y, carrierZ], .051, silver);
                    mountKit.cylinder([carrierX, y, carrierZ - .073], .025, .016, 0x747d70);
                }
                // Paired triangular webs project from the fixed carrier into two compact hinge bearing blocks.
                const web = new THREE.Shape(); web.moveTo(0, -.22); web.lineTo(0, .22); web.lineTo(.43, 0); web.closePath();
                const webGeometry = new THREE.ExtrudeGeometry(web, { depth: .045, bevelEnabled: false }).rotateY(Math.PI / 2);
                for (const y of [-3.04, -5.76]) {
                    mountKit.box([carrierX, y, 28.835], [.35, .40, .105], 0xbac1b1, [0, 0, 0], false);
                    for (const side of [-1, 1]) mountKit.add(webGeometry, material(0xb8c0ae, .69, .27), [carrierX + side * .125 - .0225, y, 28.88], [1, 1, 1], [0, 0, 0], false);
                    mountKit.box([carrierX, y, hingeZ], [.36, .22, .25], 0xbfc6b7, [0, 0, 0], false);
                    mountKit.cylinder([carrierX, y, hingeZ], .124, .30, silver, [0, 0, 0]);
                    for (const dy of [-.175, .175]) mountKit.cylinder([carrierX, y + dy, hingeZ], .143, .047, 0x7d8878, [0, 0, 0]);
                    for (const dx of [-.125, .125]) mountKit.cylinder([carrierX + dx, y, hingeZ - .136], .027, .02, 0x727d70);
                }
                // Two restrained flexible service loops bridge the fixed carrier and the moving first bay.
                for (const y of [-3.45, -5.30]) for (const dz of [0, .045]) {
                    const points = [[carrierX - .025, y, 28.76 + dz], [carrierX - .12, y - .06, 28.57 + dz], [carrierX - .13, y - .20, 28.30 + dz], [carrierX - .34, y - .22, 28.28 + dz], [carrierX - .42, y - .06, 28.41 + dz]];
                    mountKit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 32, .017, 7, false), material(0xbfc5b9, .79, .14), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                    mountKit.box(points[0], [.12, .10, .10], silver, [0, 0, 0], false);
                    mountKit.box(points[4], [.12, .10, .10], silver, [0, 0, 0], false);
                }
                mountKit.finish(carrierGroup);
                // Small outboard service fittings visible on the reference's final bay.
                for (const x of [2.25, 3.08]) radiatorKit.box([x, 1.70, .045], [.20, .22, .16], 0x747d70, [0, 0, 0], false);
                for (const y of [-.65, .35]) radiatorKit.box([1.58, y, -.066], [.16, .075, .075], 0xb29f78, [0, 0, 0], false);
                radiatorKit.finish(radiatorGroup);
                group.userData.relocatedRadiator = { center: radiatorCenter, size: [radiatorWidth, radiatorHeight, .075], bayCount: 3, bayWidth, gap, normal: [0, 0, 1], solarArrayNormal: [0, 0, -1], parallelToSolarArrays: true, hingeAxis: [0, 1, 0], mount: 'exposed front corridor below black hood, as marked by the user', root: [-.46, -4.4, 28.45], extensionDirection: [-1, 0, 0], carrierPosition: [-.46, -4.4, 28.82], triangularClevisCount: 2, carrierFootCount: 4, reference: '2026-09-30 22:38 marked correction and 22:29 hinge reference', dimensionsAreReferenceProportions: true, widthToHullDiameter: 7.2 / 4.2, heightToHullDiameter: 3.2 / 4.2 };
                // A short saddle carries the inherited ERA root from the narrower service barrel.
                kit.box([1.81, -7.1, 31], [.57, .65, .68], silver, [0, 0, 0], false);
                group.userData.referenceViews = 2; group.userData.hullProfile = profile; group.userData.radiatorPanels = 4; group.userData.louveredPanel = true; group.userData.solarBaysPerWing = 6; group.userData.solarWingRootY = -6.7; group.userData.lowerInterface = [0, -10.43, 31]; group.userData.eraPosePreserved = true;
                // ESA: two insulated limbs, seven joints and interchangeable end effectors.
                // Folded outboard and beneath Nauka's array plane to avoid hull intersections.
                group.userData.eraJoints = 7;
                const eraJoints = [[2.4, -7.1, 31], [2.8, -7.1, 31], [3.1, -7.55, 31], [6.2, -10.4, 31], [9.0, -7.4, 31], [9.2, -6.95, 31], [9.65, -6.95, 31]];
                kit.box([2.10, -7.1, 31], [.23, .84, .92], palette.silver);
                kit.cylinder([2.19, -7.1, 31], .33, .35, palette.white, [0, 0, Math.PI / 2]);
                ring(kit, [2.4, -7.1, 31], .28, 'x', palette.dark, .045);
                eraJoints.forEach((joint, index) => {
                    const rotation = index === 3 ? [Math.PI / 2, 0, 0] : index % 2 ? [0, 0, 0] : [0, 0, Math.PI / 2];
                    kit.cylinder(joint, .235, .36, palette.white, rotation);
                    kit.cylinder(joint, .247, .07, palette.dark, rotation);
                    if (index < eraJoints.length - 1) {
                        const next = eraJoints[index + 1];
                        kit.rod(joint, next, .135, palette.white);
                        if (index === 2 || index === 3) {
                            // Narrow wrap bands read as insulation seams without extra meshes.
                            for (const fraction of [.10, .27, .44, .61, .78, .92]) {
                                const a = joint.map((value, axis) => THREE.MathUtils.lerp(value, next[axis], fraction));
                                const b = joint.map((value, axis) => THREE.MathUtils.lerp(value, next[axis], fraction + .018));
                                kit.rod(a, b, .143, palette.silver);
                            }
                            const railA = joint.map((value, axis) => THREE.MathUtils.lerp(value, next[axis], .29));
                            const railB = joint.map((value, axis) => THREE.MathUtils.lerp(value, next[axis], .66));
                            const raisedA = [railA[0], railA[1], railA[2] + .29];
                            const raisedB = [railB[0], railB[1], railB[2] + .29];
                            kit.rod(railA, raisedA, .025, palette.gold);
                            kit.rod(railB, raisedB, .025, palette.gold);
                            kit.rod(raisedA, raisedB, .032, palette.gold);
                            kit.rod([joint[0], joint[1], joint[2] - .145], [next[0], next[1], next[2] - .145], .018, palette.dark);
                        }
                    }
                });
                // Identical barrel-shaped interfaces at the base and free wrist.
                for (const [x, y] of [[2.40, -7.1], [9.90, -6.95]]) {
                    kit.cylinder([x, y, 31], .27, .42, palette.white, [0, 0, Math.PI / 2]);
                    const faceX = x < 3 ? x - .24 : x + .24;
                    kit.cylinder([faceX, y, 31], .20, .045, palette.dark, [0, 0, Math.PI / 2]);
                    ring(kit, [faceX, y, 31], .24, 'x', palette.silver, .035);
                    for (const side of [-1, 1]) kit.box([x, y + side * .25, 31], [.19, .075, .14], palette.silver);
                }
                for (const [x, y] of [[2.88, -7.12], [6.2, -10.4], [9.25, -6.95]]) {
                    kit.box([x, y, 31.34], [.32, .25, .28], palette.white);
                    kit.cylinder([x, y, 31.51], .09, .10, palette.dark);
                    kit.cylinder([x, y, 31.57], .063, .025, palette.glass);
                    kit.box([x + .22, y, 31.38], [.13, .17, .18], palette.silver);
                }
            });
            // Retain the existing selection key for saved links; the label identifies
            // the reference hardware correctly. This is Nauka's lower adapter/airlock.
            part('prichal', 'Nauka lower adapter & airlock', '16 / EXPERIMENT AIRLOCK', 'The lower adapter carries Nauka\'s insulated experiment airlock, with a circular end hatch, layered rings, arched handrails, service fittings and a projecting equipment frame. The airlock was transferred from Rassvet in May 2023.', [['Assembly', 'Nauka lower adapter'], ['Airlock installed', 'MAY 2023']], [0, -11.8, 29.4], (kit, group) => {
                const center = new THREE.Vector3(0, -11.70, 31);
                group.userData.assembly = 'Nauka lower adapter and experiment airlock';
                group.userData.referenceViews = 4;
                group.userData.attachment = 'Nauka lower axial collar';
                group.userData.sixPortNode = false;
                group.userData.airlockAxis = [0, 0, -1];
                group.userData.airlockFace = [0, -11.70, 27.42];
                const blanket = material(0xd7d9d3, .9, .06).clone(), seamColor = 0xb5bbb5;
                blanket.userData.poiskSkin = 'adapter';
                const airlockBlanket = blanket.clone(); airlockBlanket.userData.poiskSkin = 'airlock';
                const hatchSkin = blanket.clone(); hatchSkin.userData.poiskSkin = 'cover';
                // Slightly flattened spherical insulation, with shallow wrinkles.
                const shell = new THREE.SphereGeometry(1, 64, 40);
                const positions = shell.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
                    const a = Math.atan2(z, x), b = Math.acos(THREE.MathUtils.clamp(y, -1, 1));
                    const wrinkle = .009 * Math.sin(a * 17 + b * 13) * Math.sin(b * 19) + .005 * Math.cos(a * 31 - b * 9);
                    positions.setXYZ(i, x * (1.47 + wrinkle), y * (1.39 + wrinkle), z * (1.47 + wrinkle));
                }
                shell.computeVertexNormals(); kit.add(shell, blanket, center.toArray(), [1, 1, 1], [0, 0, 0], false);
                const onShell = (a, b, lift = .014) => [Math.sin(b) * Math.cos(a) * (1.47 + lift), center.y + Math.cos(b) * (1.39 + lift), 31 + Math.sin(b) * Math.sin(a) * (1.47 + lift)];
                for (let gore = 0; gore < 12; gore++) {
                    const a = gore * Math.PI / 6, points = [];
                    for (let i = 0; i <= 28; i++)points.push(onShell(a, .26 + i * (Math.PI - .52) / 28));
                    for (let i = 1; i < points.length; i++)kit.rod(points[i - 1], points[i], .009, seamColor);
                }
                for (const b of [.72, 1.58, 2.37]) {
                    const points = []; for (let i = 0; i <= 64; i++)points.push(onShell(i * Math.PI / 32, b));
                    for (let i = 1; i < points.length; i++)kit.rod(points[i - 1], points[i], .012, seamColor);
                }
                // Short neck meets the existing lower collar of the main laboratory.
                kit.cylinder([0, -10.43, 31], .87, .42, palette.white, [0, 0, 0]);
                for (const y of [-10.28, -10.44]) ring(kit, [0, y, 31], .89, 'y', palette.silver, .035);
                // A closed lower connection ring, as visible under the reference body.
                kit.cylinder([0, -13.015, 31], .91, .17, palette.dark, [0, 0, 0]);
                kit.cylinder([0, -13.115, 31], .88, .08, palette.silver, [0, 0, 0]);
                ring(kit, [0, -13.14, 31], .87, 'y', palette.hull, .038);
                // A low opposite-side circular closure does not mimic another long airlock.
                kit.cylinder([0, -11.7, 32.37], .68, .18, palette.silver);
                kit.cylinder([0, -11.7, 32.48], .59, .055, palette.dark);
                ring(kit, [0, -11.7, 32.51], .61, 'z', palette.rail, .038);
                // Raised handholds seat on the sphere away from the airlock opening.
                for (const a of [.2, 1.0, 2.0, 2.75]) {
                    const points = [onShell(a, .72, 0), onShell(a, .77, .09), onShell(a, 1.05, .09), onShell(a, 1.10, 0)];
                    for (let i = 1; i < points.length; i++)kit.rod(points[i - 1], points[i], .026, palette.gold);
                }
                // Airlock is modelled in local +Z, then faces station-forward (-Z).
                const airlock = new THREE.Group(), lockKit = new Kit();
                airlock.name = 'Nauka experiment airlock / reference reconstruction';
                airlock.position.copy(center); airlock.rotation.y = Math.PI;
                const profile = [[1.04, .78], [1.26, .92], [1.40, 1.10], [1.60, 1.10], [1.71, .98], [2.94, .98], [3.08, 1.055], [3.32, 1.075], [3.51, 1.03]];
                const body = new THREE.LatheGeometry(profile.map(([z, r]) => new THREE.Vector2(r, z)), 64).rotateX(Math.PI / 2);
                lockKit.add(body, airlockBlanket, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                // Recessed black gasket, stacked flange bands and captive latches.
                for (const [z, r, w, color] of [[1.31, 1.00, .14, palette.dark], [1.43, 1.13, .085, palette.silver], [1.58, 1.125, .05, palette.white], [1.76, 1.00, .045, seamColor], [2.87, .999, .028, seamColor], [3.08, 1.075, .06, palette.silver], [3.27, 1.097, .055, palette.white], [3.47, 1.05, .04, palette.silver]]) {
                    lockKit.cylinder([0, 0, z], r, w, color);
                }
                for (let latch = 0; latch < 8; latch++) {
                    const a = latch * Math.PI / 4;
                    lockKit.box([Math.cos(a) * 1.135, Math.sin(a) * 1.135, 1.46], [.18, .18, .23], palette.hull, [0, 0, a], false);
                    lockKit.cylinder([Math.cos(a) * 1.155, Math.sin(a) * 1.155, 1.585], .035, .025, palette.rail);
                }
                // Shallow wrap folds follow the cylindrical barrel instead of a rigid grid.
                for (let fold = 0; fold < 24; fold++) {
                    const a = fold * Math.PI / 12, points = [];
                    for (let i = 0; i <= 14; i++) {
                        const z = 1.79 + i * .073, angle = a + .012 * Math.sin(i * .63 + fold);
                        const r = .988 + .005 * Math.sin(i * .91 + fold * 1.3);
                        points.push([Math.cos(angle) * r, Math.sin(angle) * r, z]);
                    }
                    for (let i = 1; i < points.length; i++)lockKit.rod(points[i - 1], points[i], .0055, 0xc1c6bf);
                }
                // Broad closed end hatch, with an offset dark hemispherical viewport.
                const hatch = new THREE.Shape(); hatch.absarc(0, 0, 1.025, 0, Math.PI * 2, false);
                const windowHole = new THREE.Path(); windowHole.absarc(-.32, -.39, .275, 0, Math.PI * 2, true); hatch.holes.push(windowHole);
                lockKit.add(new THREE.ExtrudeGeometry(hatch, { depth: .055, bevelEnabled: true, bevelSize: .014, bevelThickness: .012, bevelSegments: 2, steps: 1, curveSegments: 48 }), hatchSkin, [0, 0, 3.51], [1, 1, 1], [0, 0, 0], false);
                lockKit.cylinder([-.32, -.39, 3.53], .277, .065, palette.dark);
                lockKit.sphere([-.32, -.39, 3.574], [.245, .245, .055], 0x19303c);
                ring(lockKit, [-.32, -.39, 3.573], .273, 'z', palette.silver, .015);
                // Two arched longitudinal handrails; all feet touch the barrel.
                for (const angle of [Math.PI * .22, Math.PI * .78, Math.PI * 1.30]) {
                    const radial = r => [Math.cos(angle) * r, Math.sin(angle) * r];
                    const path = [[...radial(.97), 1.80], [...radial(1.17), 1.97], [...radial(1.20), 2.61], [...radial(1.04), 2.85]];
                    lockKit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(...p))), 32, .026, 8, false), material(palette.rail), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                    for (const z of [1.80, 2.85]) lockKit.box([...radial(.994), z], [.13, .13, .13], palette.silver, [0, 0, angle], false);
                }
                // Side access covers and a capped connector match the asymmetric fittings.
                for (const side of [-1, 1]) {
                    lockKit.cylinder([side * .972, .26, 2.19], .215, .13, palette.hull, [0, 0, Math.PI / 2]);
                    lockKit.cylinder([side * 1.048, .26, 2.19], .235, .035, palette.silver, [0, 0, Math.PI / 2]);
                    lockKit.cylinder([side * 1.01, -.25, 2.57], .14, .20, palette.dark, [0, 0, Math.PI / 2]);
                    lockKit.cylinder([side * 1.10, -.25, 2.57], .11, .035, palette.rail, [0, 0, Math.PI / 2]);
                }
                // Thin triangular feet support the two end bands, without blocking the hatch.
                for (const z of [1.55, 3.23]) for (const side of [-1, 1]) {
                    const shape = new THREE.Shape(); shape.moveTo(side * .44, -.87); shape.lineTo(side * .81, -.83); shape.lineTo(side * .68, -1.42); shape.lineTo(side * .50, -1.33); shape.closePath();
                    lockKit.add(new THREE.ExtrudeGeometry(shape, { depth: .085, bevelEnabled: false }), material(palette.hull), [0, 0, z - .0425], [1, 1, 1], [0, 0, 0], false);
                }
                // Copper-coloured open equipment frame, visible beside the front cover.
                const copper = 0x875333;
                for (const v of [-.45, -.25, -.05, .15]) lockKit.rod([-.89, v, 3.34], [-.89, v, 5.11], .025, copper);
                for (const z of [3.34, 3.52, 5.11]) {
                    lockKit.rod([-.89, -.48, z], [-.89, .18, z], .033, copper);
                    lockKit.box([-.89, -.15, z], [.105, .72, .06], copper, [0, 0, 0], false);
                }
                for (const v of [-.45, .15]) {
                    lockKit.rod([-1.02, v, 3.34], [-1.02, v, 5.11], .019, copper);
                    for (const z of [3.34, 5.11]) lockKit.rod([-1.02, v, z], [-.89, v, z], .022, copper);
                }
                lockKit.box([-.93, -.15, 3.25], [.20, .60, .24], palette.silver, [0, 0, 0], false);
                // Small paired antenna/target stalks connect to brackets on the adapter.
                lockKit.rod([.98, .10, 1.04], [1.16, .12, 1.18], .048, palette.silver);
                lockKit.box([1.16, .12, 1.18], [.22, .26, .25], palette.silver);
                lockKit.rod([1.16, .12, 1.18], [1.91, .30, 1.70], .034, palette.silver);
                lockKit.cylinder([1.91, .30, 1.70], .14, .05, palette.hull);
                ring(lockKit, [1.91, .30, 1.73], .145, 'z', palette.rail, .021);
                lockKit.rod([1.91, .30, 1.73], [1.91, .30, 1.95], .032, palette.silver);
                lockKit.box([-.40, .93, 1.44], [.25, .24, .29], palette.silver);
                lockKit.finish(airlock); group.add(airlock);
                // Angled bronze service cover bridges the upper shoulder visually.
                kit.box([.98, -10.35, 30.36], [.34, .82, .16], copper, [0, .3, -.28]);
                kit.rod([.89, -10.67, 30.53], [.98, -10.35, 30.39], .046, palette.silver);
            });
            // BEGIN DRAGON REFERENCE: Crew Dragon measured from the supplied GLB; the zip's scene.gltf and scene.bin hold the
            // same bytes. Each part is a GLB mesh component in the Dragon frame, in metres at the GLB's 1:10 scale, quantised to
            // 1/4096 m: x across, +y toward the nose-cone hinge, +z forward along the docking axis, origin on the face of the
            // white collar round the docking ring. Nose-cone parts are measured from the hinge. Parts keep the GLB's own vertex
            // splits, so recomputed normals reproduce its shading. ['b' body | 'n' nose cone, surface, positions, indices]
            const dragonReference = assetData.dragonReference;
            // END DRAGON REFERENCE
            // BEGIN DRAGON CREW REFERENCE: the supplied SpaceX suit model (Diuis, CC BY 4.0), seated by a simple rig that bends
            // hip, knee, shoulder and elbow about joints measured on the mesh. Metres, quantised to 1/4096 m, from the hip midpoint
            // in the suit's own frame: x across, -y forward, z up. Triangles are grouped by the base-colour texture's two tones
            // (white suit, black panels) plus the helmet visor. `rig` holds the seated right arm and hand: 22 bones as [name, parent,
            // pivot] (upper arm, forearm, three forearm segments that share its twist, the hand, three joints in each finger and the
            // thumb, placed on the glove's own finger axes), the skin as [vertex (2 bytes), bone, bone, weight of the second] for
            // every vertex not wholly on the torso, the hand's knuckle-line and palm axes, the index fingertip relaxed and pointing,
            // and the pointing hand's finger joint rotations (index out, the others curled, the thumb across them).
            const dragonCrewSuit = assetData.dragonCrewSuit;
            // Capsule radius in metres by height z on the Dragon axis: the median of the outer surface round the capsule, and the
            // heat-shield deck 0.06 m inside the dish ([r, z] pairs).
            const dragonCabinTables = {"z":[-4.22,-4.18,-4.14,-4.1,-4.06,-4.02,-3.98,-3.94,-3.9,-3.86,-3.82,-3.78,-3.74,-3.7,-3.66,-3.62,-3.58,-3.54,-3.5,-3.46,-3.42,-3.38,-3.34,-3.3,-3.26,-3.22,-3.18,-3.14,-3.1,-3.06,-3.02,-2.98,-2.94,-2.9,-2.86,-2.82,-2.78,-2.74,-2.7,-2.66,-2.62,-2.58,-2.54,-2.5,-2.46,-2.42,-2.38,-2.34,-2.3,-2.26,-2.22,-2.18,-2.14,-2.1,-2.06,-2.02,-1.98,-1.94,-1.9,-1.86,-1.82,-1.78,-1.74,-1.7,-1.66,-1.62,-1.58,-1.54,-1.5,-1.46,-1.42,-1.38,-1.34,-1.3,-1.26,-1.22,-1.18,-1.14,-1.1,-1.06,-1.02,-0.98,-0.94,-0.9,-0.86,-0.82,-0.78,-0.74,-0.7,-0.66,-0.62,-0.58,-0.54,-0.5,-0.46,-0.42,-0.38,-0.34,-0.3,-0.26,-0.22,-0.18,-0.14,-0.1,-0.06,-0.02],"median":[0.0,0.602,0.903,1.134,1.326,1.489,1.603,1.712,1.805,1.887,1.931,1.961,1.982,1.994,1.999,1.998,1.996,1.994,1.985,1.976,1.972,1.969,1.965,1.962,1.959,1.955,1.952,1.949,1.945,1.94,1.933,1.926,1.919,1.912,1.905,1.898,1.89,1.881,1.873,1.865,1.856,1.848,1.839,1.829,1.819,1.809,1.799,1.789,1.779,1.768,1.756,1.744,1.732,1.72,1.712,1.695,1.681,1.667,1.657,1.643,1.628,1.613,1.597,1.578,1.562,1.547,1.535,1.516,1.501,1.485,1.47,1.454,1.439,1.423,1.408,1.392,1.377,1.362,1.346,1.331,1.314,1.298,1.282,1.265,1.248,1.23,1.212,1.195,1.177,1.158,1.139,1.12,1.101,1.082,1.062,1.042,1.022,1.002,0.982,0.961,0.877,0.861,0.846,0.83,0.814,0.797],"bowl":[[0.0,-4.16],[0.597,-4.12],[0.894,-4.081],[1.123,-4.041],[1.313,-4.001],[1.472,-3.962],[1.583,-3.924],[1.69,-3.884],[1.78,-3.845],[1.855,-3.809],[1.887,-3.779],[1.91,-3.748],[1.927,-3.717],[1.935,-3.688],[1.939,-3.657],[1.938,-3.622],[1.936,-3.583],[1.935,-3.548],[1.926,-3.513]]};
            // END DRAGON CREW REFERENCE
            function dragonMesh(positions, indices, surface) {
                const quantised = pmaArray(positions, Int16Array), position = new Float32Array(quantised.length);
                for (let i = 0; i < quantised.length; i++) position[i] = quantised[i] * dragonReference.quantum;
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
                geometry.setIndex(new THREE.BufferAttribute(pmaArray(indices, Uint16Array), 1));
                geometry.computeVertexNormals();
                // Only the trunk cells carry a texture: it wraps the 1.86 m cylinder by arc length and runs down its height.
                const uv = new Float32Array(position.length / 3 * 2);
                if (surface === 'solar') for (let i = 0; i < uv.length / 2; i++) {
                    uv[i * 2] = Math.atan2(position[i * 3], position[i * 3 + 1]) * 1.86 / 1.6;
                    uv[i * 2 + 1] = position[i * 3 + 2] / 7.2;
                }
                geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
                return geometry;
            }
            const dragonCells = modernSolar.clone(); dragonCells.wrapS = dragonCells.wrapT = THREE.RepeatWrapping; dragonCells.needsUpdate = true;
            const dragonSkins = {
                white: material(0xf0f2ee, .5, .16), black: material(0x1c1f24, .58, .3), metal: material(0x3b4045, .42, .55),
                glass: material(0x183241, .22, .48), ring: material(0xc4c8c6, .4, .35), solar: material(0xffffff, .82, .1, dragonCells),
                solarFin: material(0x1d2232, .6, .22), stripe: material(0x511212, .62, .2)
            };
            // The collar meets the face of PMA-2's docking ring, which sits 0.19 m inboard of the tips of its three guide petals.
            // Dragon's own petals, 60 degrees round from them, pass inside the ring.
            const pma2RingFaceZ = pma2BaseZ - pmaReferenceLength + .19;
            // Hold 18 m out, swing the nose cone open, then close on the port and dock. The cone follows the GLB's own stroke:
            // -120 degrees about the hinge on a smoothstep, slowed from 1.7 s to 4 s so it reads at station scale.
            const approach = {
                port: new THREE.Vector3(0, -pmaReferenceOffset, pma2RingFaceZ), nose: new THREE.Vector3(0, 0, 0), initialRange: 18, contactRange: .003,
                openAt: 3, openDuration: 4, departAt: 9, duration: 159, time: 0, range: 18, open: 0
            };
            // Three touchscreens on one panel: dark fields with an orbit trace, status bars and a faint grid.
            const dragonScreens = payloadCanvas(768, 132, g => {
                g.fillStyle = '#1b1f24'; g.fillRect(0, 0, 768, 132);
                for (let screen = 0; screen < 3; screen++) {
                    const x0 = 10 + screen * 252;
                    g.fillStyle = '#0d2236'; g.fillRect(x0, 10, 244, 112);
                    g.strokeStyle = 'rgba(120,180,220,.18)'; g.lineWidth = 1;
                    for (let x = x0 + 20; x < x0 + 244; x += 20) { g.beginPath(); g.moveTo(x, 10); g.lineTo(x, 122); g.stroke(); }
                    for (let y = 30; y < 122; y += 20) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + 244, y); g.stroke(); }
                    g.strokeStyle = '#6fc3ea'; g.lineWidth = 2.5; g.beginPath();
                    if (screen === 1) { g.ellipse(x0 + 122, 70, 78, 34, -.2, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#e8f4fb'; g.beginPath(); g.arc(x0 + 190, 58, 4, 0, Math.PI * 2); g.fill(); }
                    else { for (let x = 0; x <= 200; x += 4) { const y = 70 + Math.sin(x / 32 + screen) * 26; x ? g.lineTo(x0 + 22 + x, y) : g.moveTo(x0 + 22, y); } g.stroke(); }
                    g.fillStyle = '#9fd8f2'; for (let row = 0; row < 4; row++) g.fillRect(x0 + 14, 18 + row * 9, 40 + ((row * 37 + screen * 23) % 50), 4);
                    g.fillStyle = '#4fb07a'; g.fillRect(x0 + 196, 100, 36, 12);
                }
            });
            // Service-bay bulkheads: tan composite panels with rows of lightening holes.
            const dragonBayPanel = payloadCanvas(192, 128, g => {
                g.fillStyle = '#a7804f'; g.fillRect(0, 0, 192, 128);
                g.fillStyle = '#6f5130'; for (let x = 0; x < 6; x++) for (let y = 0; y < 4; y++) { g.beginPath(); g.ellipse(18 + x * 31, 17 + y * 31, 10, 10, 0, 0, Math.PI * 2); g.fill(); }
                g.strokeStyle = '#c29a66'; g.lineWidth = 6; g.strokeRect(3, 3, 186, 122);
            });
            const dragon = part('dragon', 'SpaceX Crew Dragon', '17 / FINAL APPROACH', 'Crew Dragon holds 18 m out from Harmony\'s forward docking adapter, swings its hinged nose cone open, then closes in and docks. The capsule, its four SuperDraco pods, four windows, side hatch, docking ring with three guide petals and the trunk with its four fins are measured from the supplied Crew Dragon model. Selected, the hull turns 75% transparent to show the four suited crew inside. Solar cells cover one half of the trunk; the other half is radiator. Approach timing is illustrative.', [['Destination', 'Harmony forward'], ['Length / diameter', '8.1 m / 4.0 m']], [0, 1.6, -2.6], (kit, group) => {
                const noseCone = new THREE.Group(), coneKit = new Kit();
                for (const [where, surface, positions, indices] of dragonReference.parts) (where === 'n' ? coneKit : kit).add(dragonMesh(positions, indices, surface), dragonSkins[surface]);
                coneKit.finish(noseCone); noseCone.position.fromArray(dragonReference.hinge); noseCone.name = 'Docking nose cone'; group.add(noseCone);
                group.userData.reference = { source: dragonReference.source, author: dragonReference.author, license: dragonReference.license, parts: dragonReference.parts.length, scale: dragonReference.scale };
                // Crew cabin, shown while the Dragon is selected and its hull turns translucent. The lining, floor, forward bulkhead,
                // tunnel and heat-shield deck turn translucent with the hull; the seats, crew, flight display, cargo and tanks stay
                // solid. Interior layout is illustrative.
                const cabin = new THREE.Group(), structure = new THREE.Group(), fittings = new THREE.Group(), structureKit = new Kit(), fittingKit = new Kit();
                cabin.name = 'Crew cabin'; cabin.visible = false; fittings.userData.fittings = true; cabin.add(structure, fittings); group.add(cabin);
                const cut = dragonCabinTables, step = cut.z[1] - cut.z[0];
                const tableAt = (table, z) => { const i = THREE.MathUtils.clamp((z - cut.z[0]) / step, 0, table.length - 1.0001), k = Math.floor(i); return THREE.MathUtils.lerp(table[k], table[k + 1], i - k); };
                // The lining stands 0.30 m inside the outer surface, clear of the SuperDraco pod recesses and the hatch.
                const floorZ = -3.40, floorDepth = .08, bulkheadZ = -.75, tunnelTop = -.49, tunnelRadius = .45;
                const wallRadius = z => tableAt(cut.median, z) - .30;
                const inside = (color, roughness, metalness, side) => { const surface = material(color, roughness, metalness).clone(); surface.side = side; return surface; };
                const wallProfile = []; for (let z = floorZ; z < bulkheadZ + .001; z += .05) wallProfile.push(new THREE.Vector2(wallRadius(z), z));
                structureKit.add(new THREE.LatheGeometry(wallProfile, 72), inside(0xd5d9da, .82, .05, THREE.BackSide), [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0], false);
                const floorRadius = tableAt(cut.median, floorZ - floorDepth) - .06;
                structureKit.add(new THREE.CylinderGeometry(floorRadius, floorRadius, floorDepth, 72), material(0xc3c8ca, .78, .08), [0, 0, floorZ - floorDepth / 2], [1, 1, 1], [Math.PI / 2, 0, 0], false);
                structureKit.add(new THREE.RingGeometry(tunnelRadius, tableAt(cut.median, bulkheadZ) - .02, 72), inside(0xc9cdd0, .78, .08, THREE.DoubleSide), [0, 0, bulkheadZ], [1, 1, 1], [0, 0, 0], false);
                structureKit.add(new THREE.CylinderGeometry(tunnelRadius, tunnelRadius, tunnelTop - bulkheadZ, 48, 1, true), inside(0xb7bcbe, .8, .1, THREE.BackSide), [0, 0, (tunnelTop + bulkheadZ) / 2], [1, 1, 1], [Math.PI / 2, 0, 0], false);
                structureKit.add(new THREE.LatheGeometry(cut.bowl.map(([r, z]) => new THREE.Vector2(r, z)), 72), inside(0x8b8278, .86, .08, THREE.DoubleSide), [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0], false);
                structureKit.finish(structure);
                // Four suited crew on a reclined seat pallet: heads toward +y, faces toward the nose and the -y side.
                const suit = dragonCrewSuit, quantised = pmaArray(suit.positions, Int16Array), suitPoints = new Float32Array(quantised.length);
                for (let i = 0; i < quantised.length; i++) suitPoints[i] = quantised[i] * suit.quantum;
                const suitIndex = { white: pmaArray(suit.white, Uint16Array), black: pmaArray(suit.black, Uint16Array), visor: pmaArray(suit.visor, Uint16Array) };
                const suitBody = new THREE.BufferGeometry(), allIndex = new Uint16Array(suitIndex.white.length + suitIndex.black.length + suitIndex.visor.length);
                allIndex.set(suitIndex.white); allIndex.set(suitIndex.black, suitIndex.white.length); allIndex.set(suitIndex.visor, suitIndex.white.length + suitIndex.black.length);
                suitBody.setAttribute('position', new THREE.BufferAttribute(suitPoints, 3)); suitBody.setIndex(new THREE.BufferAttribute(allIndex, 1)); suitBody.computeVertexNormals();
                const suitUv = new THREE.BufferAttribute(new Float32Array(suitPoints.length / 3 * 2), 2);
                const crewSkins = { white: material(0xf1f2ef, .56, .05), black: material(0x25282c, .6, .15), visor: material(0x0d1115, .14, .7) };
                const suitParts = Object.entries(suitIndex).map(([name, index]) => {
                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', suitBody.attributes.position); geometry.setAttribute('normal', suitBody.attributes.normal); geometry.setAttribute('uv', suitUv);
                    geometry.setIndex(new THREE.BufferAttribute(index, 1)); return [geometry, crewSkins[name]];
                });
                const recline = 55 * Math.PI / 180, seatTurn = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, Math.cos(recline), -Math.sin(recline)), new THREE.Vector3(0, Math.sin(recline), Math.cos(recline))));
                const seatShell = 0x2a2e33, pallet = 0x7f95aa;
                // The crew member in seat 1 reaches for the display: that suit is skinned to the right (outboard) arm and hand of
                // the rig, so the sleeve bends as it did when the figure was seated and each finger bends at its own joints.
                const rig = suit.rig, skin = pmaArray(rig.skin, Uint8Array), skinIndex = new Uint16Array(suitPoints.length / 3 * 4), skinWeight = new Float32Array(suitPoints.length / 3 * 4);
                for (let i = 0; i < suitPoints.length / 3; i++) skinWeight[i * 4] = 1;
                for (let k = 0; k < skin.length; k += 5) {
                    const i = skin[k] | skin[k + 1] << 8, weight = skin[k + 4] / 255;
                    skinIndex[i * 4] = skin[k + 2]; skinIndex[i * 4 + 1] = skin[k + 3]; skinWeight[i * 4] = 1 - weight; skinWeight[i * 4 + 1] = weight;
                }
                const reachingBody = new THREE.BufferGeometry();
                reachingBody.setAttribute('position', suitBody.attributes.position); reachingBody.setAttribute('normal', suitBody.attributes.normal);
                reachingBody.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4)); reachingBody.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
                reachingBody.setIndex(new THREE.BufferAttribute(allIndex, 1));
                let groupStart = 0; ['white', 'black', 'visor'].forEach((name, k) => { reachingBody.addGroup(groupStart, suitIndex[name].length, k); groupStart += suitIndex[name].length; });
                const armBones = rig.bones.map(([name]) => Object.assign(new THREE.Bone(), { name }));
                rig.bones.forEach(([, parent, x, y, z], i) => {
                    armBones[i].position.set(x, y, z);
                    if (parent >= 0) { armBones[i].position.sub(new THREE.Vector3(...rig.bones[parent].slice(2))); armBones[parent].add(armBones[i]); }
                });
                const reaching = new THREE.SkinnedMesh(reachingBody, ['white', 'black', 'visor'].map(name => crewSkins[name].clone()));
                reaching.name = 'Crew member at the display'; reaching.frustumCulled = false; reaching.add(armBones[0]);
                reaching.updateMatrixWorld(true); reaching.bind(new THREE.Skeleton(armBones));
                let reachingSeat;
                [-.93, -.31, .31, .93].forEach((x, index) => {
                    const seat = new THREE.Group(), seatKit = new Kit();
                    seat.position.set(x, -.25, -2.95 + (index === 1 || index === 2 ? .08 : 0)); seat.quaternion.copy(seatTurn); seat.name = 'Crew seat ' + (index + 1);
                    // Shell fitted to the seated suit (suit frame): back, headrest, pan, leg rest, foot rest and side rails.
                    seatKit.box([0, .225, .38], [.50, .06, .76], seatShell);
                    seatKit.box([0, .245, .77], [.30, .07, .30], seatShell);
                    seatKit.box([0, -.04, -.177], [.50, .32, .05], seatShell);
                    seatKit.box([0, -.19, -.30], [.46, .05, .24], seatShell);
                    seatKit.box([0, -.405, -.535], [.50, .34, .04], seatShell);
                    for (const side of [-1, 1]) { seatKit.box([side * .265, .20, .38], [.03, .10, .78], 0x3b4148); seatKit.box([side * .265, -.04, -.15], [.03, .32, .08], 0x3b4148); }
                    if (index === 0) { seat.add(reaching); reachingSeat = seat; } else for (const [geometry, skin] of suitParts) seatKit.add(geometry, skin, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                    seatKit.finish(seat); fittings.add(seat); seat.updateMatrix();
                    for (const local of [[-.2, .25, 0], [.2, .25, 0], [-.2, -.40, -.56], [.2, -.40, -.56]]) {
                        const foot = new THREE.Vector3(...local).applyMatrix4(seat.matrix);
                        fittingKit.rod(foot.toArray(), [foot.x, foot.y, floorZ], .026, pallet);
                    }
                });
                for (const y of [-.94, -.11]) { const reach = Math.sqrt(wallRadius(floorZ + .05) ** 2 - y * y); fittingKit.rod([-reach, y, floorZ + .05], [reach, y, floorZ + .05], .035, pallet); }
                // Flight display in front of the crew, within reach of the middle seats, hung from the forward bulkhead.
                const display = new THREE.Group(), displayKit = new Kit();
                display.position.set(0, .04, -2.135); display.name = 'Flight display';
                display.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, .7317, .6816), new THREE.Vector3(0, .6816, -.7317)));
                displayKit.box([0, 0, -.03], [1.96, .40, .05], 0x30353b);
                displayKit.add(new THREE.PlaneGeometry(1.86, .32), material(0xffffff, .35, .1, dragonScreens), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                displayKit.finish(display); fittings.add(display); display.updateMatrix();
                for (const side of [-1, 1]) { const top = new THREE.Vector3(side * .7, .2, -.05).applyMatrix4(display.matrix); fittingKit.rod(top.toArray(), [Math.sign(top.x) * .55, .45, bulkheadZ], .03, pallet); }
                // Two touches on the right-hand screen, in seat 1's frame: on the trace, then on the green key below it. The arm
                // reaches in steps: raised with the hand still relaxed 12 cm off the glass; the forearm turned 80 degrees so the palm
                // faces down, the wrist flexed 20 degrees; then the index finger out with the others curled, hovering 5 cm off and
                // pressing. At that angle the finger pad meets the glass 6 mm below the tip vertex.
                const toSeat = reachingSeat.matrix.clone().invert(), onScreen = (x, y, lift) => new THREE.Vector3(x, y, lift).applyMatrix4(display.matrix).applyMatrix4(toSeat);
                const boneIndex = Object.fromEntries(rig.bones.map(([name], i) => [name, i])), pivot = name => new THREE.Vector3(...rig.bones[boneIndex[name]].slice(2));
                const shoulder = pivot('upperArm'), elbow = pivot('forearm'), wrist = pivot('hand'), foreAxis = wrist.clone().sub(elbow).normalize();
                const across = new THREE.Vector3(...rig.across), palm = new THREE.Vector3(...rig.palm), pole = shoulder.clone().add(new THREE.Vector3(-.35, .1, -.3));
                function reachFor(target, { twist = 0, extend = 0, deviate = 0, point = false } = {}) {
                    const swing = new THREE.Quaternion().setFromAxisAngle(across, -extend).multiply(new THREE.Quaternion().setFromAxisAngle(palm, deviate));
                    const turned = new THREE.Quaternion().setFromAxisAngle(foreAxis, twist).multiply(swing);
                    // The forearm and the posed hand reach as one piece, from the elbow to the index fingertip.
                    const fingertip = new THREE.Vector3(...(point ? rig.pointTip : rig.restTip)).sub(wrist).applyQuaternion(turned).add(wrist);
                    const upperLength = elbow.distanceTo(shoulder), foreLength = fingertip.distanceTo(elbow), toward = target.clone().sub(shoulder);
                    const span = THREE.MathUtils.clamp(toward.length(), Math.abs(upperLength - foreLength) + .01, upperLength + foreLength - .001); toward.normalize();
                    const along = (upperLength ** 2 - foreLength ** 2 + span ** 2) / (2 * span), out = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
                    const bend = pole.clone().sub(shoulder); bend.addScaledVector(toward, -bend.dot(toward)).normalize();
                    const elbowAt = shoulder.clone().addScaledVector(toward, along).addScaledVector(bend, out), tipAt = shoulder.clone().addScaledVector(toward, span);
                    const upperTurn = new THREE.Quaternion().setFromUnitVectors(elbow.clone().sub(shoulder).normalize(), elbowAt.clone().sub(shoulder).normalize());
                    const foreTurn = new THREE.Quaternion().setFromUnitVectors(fingertip.clone().sub(elbow).applyQuaternion(upperTurn).normalize(), tipAt.clone().sub(elbowAt).normalize());
                    // One rotation per bone. The three forearm segments share the twist, so the sleeve turns along its length.
                    const pose = rig.bones.map(() => new THREE.Quaternion()), step = new THREE.Quaternion().setFromAxisAngle(foreAxis, twist / 3);
                    pose[boneIndex.upperArm] = upperTurn; pose[boneIndex.forearm] = upperTurn.clone().invert().multiply(foreTurn).multiply(upperTurn);
                    for (const name of ['twist1', 'twist2', 'twist3']) pose[boneIndex[name]] = step.clone();
                    pose[boneIndex.hand] = swing;
                    if (point) for (const [name, x, y, z, w] of rig.point) pose[boneIndex[name]] = new THREE.Quaternion(x, y, z, w);
                    return pose;
                }
                const trace = [.77, -.055], key = [.833, -.097], rad = THREE.MathUtils.degToRad, palmDown = { twist: rad(-80), extend: rad(-20), deviate: rad(15) }, pointing = { ...palmDown, point: true };
                const touch = {
                    bones: armBones,
                    poses: {
                        rest: rig.bones.map(() => new THREE.Quaternion()), raise: reachFor(onScreen(...trace, .12)), turn: reachFor(onScreen(...trace, .07), palmDown),
                        hoverTrace: reachFor(onScreen(...trace, .05), pointing), pressTrace: reachFor(onScreen(...trace, .0064), pointing),
                        hoverKey: reachFor(onScreen(...key, .05), pointing), pressKey: reachFor(onScreen(...key, .0064), pointing)
                    }
                };
                // Cargo bags stowed on the floor, under the seats.
                const bag = material(0xeceee9, .86, .03);
                for (const [x, y, sx, sy] of [[-.95, .42, .5, .4], [-.32, .5, .5, .44], [.32, .48, .5, .42], [.95, .40, .46, .4], [-.55, -.52, .62, .3], [.4, -.55, .55, .28]]) fittingKit.add(payloadPillow, bag, [x, y, floorZ + .14], [sx, sy, .26]);
                // Service bay under the floor: four propellant tanks, radial bulkheads and a central core.
                const tank = material(0xb0b5b8, .35, .55), bay = material(0xffffff, .78, .08, dragonBayPanel);
                for (let k = 0; k < 4; k++) {
                    const a = k * Math.PI / 2, x = Math.sin(a) * 1.28, y = Math.cos(a) * 1.28;
                    fittingKit.add(shapes.sphere, tank, [x, y, -3.735], [.24, .24, .24], [0, 0, 0], false);
                    ring(fittingKit, [x, y, -3.735], .245, 'z', 0x8d9397, .014);
                }
                for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4; fittingKit.add(shapes.box, bay, [Math.sin(a) * 1.05, Math.cos(a) * 1.05, -3.70], [1.0, .03, .44], [0, 0, Math.PI / 2 - a]); }
                fittingKit.add(new THREE.CylinderGeometry(.5, .5, .64, 40), material(0x4a4f55, .7, .3), [0, 0, -3.80], [1, 1, 1], [Math.PI / 2, 0, 0], false);
                fittingKit.finish(fittings);
                cabin.traverse(object => { object.userData.interior = true; if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; } });
                group.userData.detail = { noseCone, cabin, touch, openAngle: dragonReference.openAngle, windows: 4, superDracoPods: 4, fins: 4, integratedSolarCells: true, crew: 4 };
            });
            const dragonCone = dragon.group.userData.detail.noseCone, dragonCabin = dragon.group.userData.detail.cabin;
            // Selected, the Dragon turns translucent so the crew show through: 75% transparent on the docking approach, 90% with
            // its line art in the cabin view. The cabin fittings stay solid. Translucent copies are kept per solid surface.
            const dragonShell = { opacity: 0, copies: new Map() };
            function setDragonShell(opacity) {
                if (dragonShell.opacity === opacity) return;
                dragonShell.opacity = opacity; dragonCabin.visible = opacity > 0;
                dragon.group.traverse(child => {
                    if (child.userData.lineArt) { child.visible = opacity === ghostOpacity; return; }
                    if (!child.isMesh) return;
                    for (let parent = child.parent; parent && parent !== dragon.group; parent = parent.parent) if (parent.userData.fittings) return;
                    const solid = child.userData.shellSolid || child.material;
                    if (!opacity) { if (child.userData.shellSolid) { child.material = solid; child.castShadow = child.userData.shellShadow; delete child.userData.shellSolid; delete child.userData.shellShadow; } return; }
                    if (!child.userData.shellSolid) { child.userData.shellSolid = solid; child.userData.shellShadow = child.castShadow; }
                    if (!dragonShell.copies.has(solid)) dragonShell.copies.set(solid, new Map());
                    const copies = dragonShell.copies.get(solid);
                    if (!copies.has(opacity)) copies.set(opacity, Object.assign(solid.clone(), { transparent: true, opacity, depthWrite: false, alphaTest: 0 }));
                    const copy = copies.get(opacity);
                    copy.emissive?.copy(solid.emissive); copy.emissiveIntensity = solid.emissiveIntensity;
                    child.material = copy; child.castShadow = false;
                });
            }
            // Bounds cover the whole flight with the cone open: from the hold point to the docked position.
            dragonCone.rotation.x = dragonReference.openAngle; dragon.group.updateMatrixWorld(true);
            const dragonLocalBounds = new THREE.Box3().setFromObject(dragon.group);
            const dragonFlightBounds = dragonLocalBounds.clone().translate(new THREE.Vector3(approach.port.x - approach.nose.x, approach.port.y - approach.nose.y, approach.port.z - approach.initialRange - approach.nose.z));
            dragonFlightBounds.union(dragonLocalBounds.clone().translate(new THREE.Vector3(approach.port.x - approach.nose.x, approach.port.y - approach.nose.y, approach.port.z - approach.contactRange - approach.nose.z)));
            function updateApproach(delta) {
                approach.time = Math.min(approach.duration, approach.time + Math.max(0, delta));
                const stroke = THREE.MathUtils.clamp((approach.time - approach.openAt) / approach.openDuration, 0, 1);
                approach.open = stroke * stroke * (3 - 2 * stroke);
                const remaining = 1 - THREE.MathUtils.clamp((approach.time - approach.departAt) / (approach.duration - approach.departAt), 0, 1);
                approach.range = approach.contactRange + (approach.initialRange - approach.contactRange) * remaining * remaining;
                dragonCone.rotation.x = dragonReference.openAngle * approach.open;
                dragon.group.position.set(approach.port.x - approach.nose.x, approach.port.y - approach.nose.y, approach.port.z - approach.range - approach.nose.z);
                dragon.group.updateMatrixWorld(true);
            }
            function approachPhase() {
                if (approach.time >= approach.duration) return 'DOCKED';
                if (approach.time >= approach.departAt) return 'FINAL APPROACH';
                if (approach.open >= 1) return 'NOSE CONE OPEN';
                return approach.time >= approach.openAt ? 'NOSE CONE OPENING' : 'HOLD';
            }
            // Every 12 s the crew member in seat 1 raises the right arm, turns the hand palm-down, points the index finger, touches
            // the trace on the right-hand screen and then the green key below it, and settles back. Steps are [start, end, from,
            // to] in seconds; between steps the last pose holds.
            const dragonTouchSteps = [[2, 3.6, 'rest', 'raise'], [3.6, 4.5, 'raise', 'turn'], [4.5, 5, 'turn', 'hoverTrace'], [5, 5.3, 'hoverTrace', 'pressTrace'],
                [5.55, 5.85, 'pressTrace', 'hoverTrace'], [5.85, 6.35, 'hoverTrace', 'hoverKey'], [6.35, 6.65, 'hoverKey', 'pressKey'], [6.9, 7.2, 'pressKey', 'hoverKey'],
                [7.2, 8, 'hoverKey', 'raise'], [8, 9.6, 'raise', 'rest']];
            function updateDragonCrew(time) {
                const { bones, poses } = dragon.group.userData.detail.touch, cycle = time % 12;
                let from = 'rest', to = 'rest', k = 0;
                for (const [start, end, a, b] of dragonTouchSteps) {
                    if (cycle >= end) { from = to = b; continue; }
                    if (cycle >= start) { from = a; to = b; k = THREE.MathUtils.smoothstep(cycle, start, end); }
                    break;
                }
                bones.forEach((bone, i) => bone.quaternion.slerpQuaternions(poses[from][i], poses[to][i], k));
            }
            // Without motion the hold is shown with the nose cone already open.
            const approachStartTime = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? approach.departAt : 0;
            function restartApproach() {
                if (dragonDetail === 'cabin') { dragonDetail = 'approach'; if (selected === 'dragon') { selectPart('dragon'); focusPart('dragon'); } }
                approach.time = approachStartTime();
                updateApproach(0);
                motion = !reducedMotion.matches;
                setPressed('motion-toggle', motion);
                render();
            }
            approach.time = approachStartTime();
            updateApproach(0);
            // Soyuz reconstructed only from the two supplied spacecraft images.
            // The existing Zvezda connection is retained; the probe is seated in the docked collar.
            part('soyuz', 'Soyuz spacecraft', '18 / VISITING SPACECRAFT', 'A rounded orbital compartment and bell-shaped descent capsule are wrapped in dark thermal blankets. A white aft skirt, green optical mast, external harnesses and two narrow, cross-braced solar wings follow the supplied reference images. Shown connected to Zvezda; small fittings and hidden aft details are illustrative.', [['Crew seats', '3'], ['Main sections', 'Orbital · descent · service']], [0, 1, 45.6], (kit, group) => {
                group.userData.detailPass = 'two-user-images-only';
                group.userData.referenceViews = 2;
                group.userData.blanketFinish = 'Charcoal woven insulation with gathered seams';
                group.userData.solarWings = 2; group.userData.solarBaysPerWing = 4;
                group.userData.solarWingRootZ = 46.92;
                group.userData.dockingCollarRadius = .77 + .044;
                group.userData.dockingProbePose = 'Seated inside the existing docked collar';
                group.userData.greenOpticalMast = true;
                const dark = 0x292c31, seam = 0x505359, silver = 0xc0c8c9, white = 0xe7e9e3;
                const olive = 0x696947, copper = 0x866947, green = 0x315d3a;
                const smallSphere = new THREE.SphereGeometry(1, 10, 8);
                const bead = (point, scale, color) => kit.add(smallSphere, material(color), point, scale, [0, 0, 0], false);
                const polar = (angle, radius, z) => [Math.cos(angle) * radius, Math.sin(angle) * radius, z];
                function pipe(points, radius, color) {
                    kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(12, points.length * 3), radius, 6, false), material(color, .88, .08), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                // Fine woven surface and low relief folds replace the former tan shell.
                const clothCanvas = document.createElement('canvas'); clothCanvas.width = 1024; clothCanvas.height = 512;
                const clothContext = clothCanvas.getContext('2d'); clothContext.fillStyle = '#414348'; clothContext.fillRect(0, 0, 1024, 512);
                for (let y = 0; y < 512; y += 2)for (let x = 0; x < 1024; x += 2) {
                    const n = (x * 17 + y * 31) % 19, v = 54 + n;
                    clothContext.fillStyle = `rgb(${v},${v + 2},${v + 6})`; clothContext.fillRect(x, y, 1.5, 1.5);
                }
                for (let fold = 0; fold < 28; fold++) {
                    const x = fold * 1024 / 28;
                    clothContext.strokeStyle = fold % 2 ? '#55575b88' : '#25272b88'; clothContext.lineWidth = 1.3;
                    clothContext.beginPath(); clothContext.moveTo(x, 0); clothContext.bezierCurveTo(x + 22, 150, x - 18, 320, x + 3, 512); clothContext.stroke();
                }
                const clothMap = new THREE.CanvasTexture(clothCanvas); clothMap.colorSpace = THREE.SRGBColorSpace; clothMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
                const cloth = material(0xffffff, .97, .015, clothMap);
                const bumpCanvas = document.createElement('canvas'); bumpCanvas.width = 256; bumpCanvas.height = 256;
                const bc = bumpCanvas.getContext('2d'); bc.fillStyle = '#808080'; bc.fillRect(0, 0, 256, 256);
                for (let y = 0; y < 256; y += 2)for (let x = 0; x < 256; x += 2) { const v = 90 + (x * 11 + y * 19) % 70; bc.fillStyle = `rgb(${v},${v},${v})`; bc.fillRect(x, y, 1, 1); }
                cloth.bumpMap = new THREE.CanvasTexture(bumpCanvas); cloth.bumpScale = .012;
                function insulatedHull(z0, z1, radiusAt, gather = 1) {
                    const pos = [], uv = [], indices = [], around = 160, along = 64;
                    for (let j = 0; j <= along; j++)for (let i = 0; i <= around; i++) {
                        const a = i / around * Math.PI * 2, t = j / along, z = z0 + (z1 - z0) * t;
                        const ripple = (.007 * Math.sin(a * 31 + 4.8 * t + 1.5 * Math.sin(t * 7 + a * 3)) + .003 * Math.sin(a * 47 - 3 * Math.sin(t * 5 + a * 2))) * Math.sin(Math.PI * t) * gather;
                        pos.push(...polar(a, radiusAt(z) + ripple, z)); uv.push(i / around, t);
                    }
                    for (let j = 0; j < along; j++)for (let i = 0; i < around; i++) {
                        const a = j * (around + 1) + i, b = a + around + 1; indices.push(a, a + 1, b, b, a + 1, b + 1);
                    }
                    const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geom.setIndex(indices); geom.computeVertexNormals();
                    // Join the shading normals across the cloth texture's wrap seam.
                    const normals = geom.attributes.normal;
                    for (let j = 0; j <= along; j++) {
                        const a = j * (around + 1), b = a + around, n = new THREE.Vector3().fromBufferAttribute(normals, a).add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize();
                        normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(b, n.x, n.y, n.z);
                    }
                    kit.add(geom, cloth, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                const orbitalRadius = z => 1.29 * Math.sqrt(Math.max(0, 1 - ((z - 43.05) / 1.29) ** 2));
                const descentProfile = [[44.12, .59], [44.28, .71], [44.52, .91], [44.85, 1.10], [45.20, 1.23], [45.64, 1.29], [45.99, 1.275], [46.12, 1.24]];
                function descentRadius(z) { let i = descentProfile.findIndex(p => p[0] >= z); i = Math.max(1, i < 0 ? descentProfile.length - 1 : i); const a = descentProfile[i - 1], b = descentProfile[i]; return THREE.MathUtils.lerp(a[1], b[1], THREE.MathUtils.clamp((z - a[0]) / (b[0] - a[0]), 0, 1)); }
                insulatedHull(41.99, 44.18, orbitalRadius, .65);
                insulatedHull(44.12, 46.12, descentRadius, 1.55);
                // Gathered fabric gores and overlapping stitched blanket edges.
                for (let gore = 0; gore < 12; gore++) {
                    const a = gore * Math.PI / 6, points = [];
                    for (let i = 0; i <= 24; i++) { const z = 42.08 + i * 2.01 / 24; points.push(polar(a + .022 * Math.sin(i * .27), orbitalRadius(z) + .012, z)); }
                    pipe(points, .009, 0x55575b);
                }
                for (let gore = 0; gore < 18; gore++) {
                    const a = gore * Math.PI / 9, points = [];
                    for (let i = 0; i <= 24; i++) { const z = 44.22 + i * 1.82 / 24; points.push(polar(a + .025 * Math.sin(i * .19), descentRadius(z) + .017, z)); }
                    pipe(points, .010, gore % 3 === 0 ? 0x5c5b57 : 0x33363a);
                }
                ring(kit, [0, 0, 44.18], .635, 'z', 0x504d45, .023);
                ring(kit, [0, 0, 46.105], 1.265, 'z', 0x646760, .033);
                // Hollow docking collar stays within the already fitted Zvezda bore.
                const collarMat = material(0x8f9899, .49, .56).clone(); collarMat.side = THREE.DoubleSide;
                kit.add(new THREE.CylinderGeometry(.73, .73, 1.04, 48, 1, true), collarMat, [0, 0, 41.60], [1, 1, 1], [Math.PI / 2, 0, 0], false);
                for (const z of [41.14, 41.34, 41.93]) ring(kit, [0, 0, z], .77, 'z', silver, .044);
                ring(kit, [0, 0, 41.24], .73, 'z', dark, .031);
                // Bolted annular docking face, shield brackets and the central probe assembly.
                const annulus = material(0xaeb8b6, .49, .52).clone(); annulus.side = THREE.DoubleSide;
                kit.add(new THREE.RingGeometry(.55, .91, 64), annulus, [0, 0, 42.018], [1, 1, 1], [0, Math.PI, 0], false);
                ring(kit, [0, 0, 42.03], .905, 'z', dark, .039); ring(kit, [0, 0, 42.006], .576, 'z', silver, .024);
                for (let latch = 0; latch < 8; latch++) {
                    const a = latch * Math.PI / 4;
                    kit.box(polar(a, .875, 42.09), [.17, .13, .23], dark, [0, 0, a], false);
                    kit.cylinder(polar(a, .812, 41.995), .033, .041, silver);
                    kit.box(polar(a, .615, 41.99), [.12, .12, .10], white, [0, 0, a], false);
                }
                kit.cylinder([0, 0, 41.97], .30, .23, 0xb9c2c4);
                kit.add(new THREE.CylinderGeometry(.13, .29, .27, 24), material(silver, .36, .61), [0, 0, 41.73], [1, 1, 1], [Math.PI / 2, 0, 0], false);
                kit.cylinder([0, 0, 41.435], .072, .33, silver);
                kit.cylinder([0, 0, 41.225], .09, .09, dark);
                for (const side of [-1, 1]) kit.rod([side * .10, 0, 41.20], [side * .16, 0, 41.12], .027, dark);
                // Orbital side hatch: a dark cover, pale rim and a separate small viewing window.
                kit.cylinder([0, 1.238, 43.26], .43, .075, dark, [0, 0, 0]); ring(kit, [0, 1.285, 43.26], .43, 'y', silver, .022);
                kit.cylinder([0, 1.287, 43.26], .391, .023, 0x32353a, [0, 0, 0]);
                kit.rod([-.19, 1.318, 43.18], [.19, 1.318, 43.18], .017, 0x777e7e);
                for (const side of [-1, 1]) {
                    kit.cylinder([side * 1.235, -.13, 43.03], .158, .062, 0x9caaa9, [0, 0, Math.PI / 2]);
                    kit.cylinder([side * 1.274, -.13, 43.03], .126, .026, 0x0f2532, [0, 0, Math.PI / 2]);
                    ring(kit, [side * 1.291, -.13, 43.03], .127, 'x', dark, .014);
                }
                // A second window sits in the descent capsule's cloth-covered wall.
                const wa = -.20, wz = 45.17, wr = descentRadius(wz);
                const windowGroup = new THREE.Group(), wk = new Kit();
                wk.cylinder([0, 0, 0], .164, .062, 0x8d8070); wk.cylinder([0, 0, -.041], .126, .025, 0x102332); ring(wk, [0, 0, -.058], .14, 'z', silver, .018);
                wk.finish(windowGroup); windowGroup.position.fromArray(polar(wa, wr + .025, wz)); windowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(Math.cos(wa), Math.sin(wa), 0)); group.add(windowGroup);
                // A stitched rectangular parachute cover follows the capsule side.
                const coverAngle = -1.0, cover = [];
                for (const [a, z] of [[coverAngle - .30, 44.87], [coverAngle + .30, 44.87], [coverAngle + .30, 45.63], [coverAngle - .30, 45.63], [coverAngle - .30, 44.87]]) cover.push(polar(a, descentRadius(z) + .025, z));
                pipe(cover, .014, 0x6f7066);
                // Close-fitting dark service band; no exposed long inter-module spacer.
                insulatedHull(46.12, 46.86, z => THREE.MathUtils.lerp(1.255, 1.32, (z - 46.12) / .74), .35);
                for (const z of [46.15, 46.71, 46.84]) ring(kit, [0, 0, z], z > 46.8 ? 1.33 : 1.28, 'z', z > 46.8 ? dark : 0x646c69, .024);
                // White aft shell, a broad unbroken skin with a dark end rim.
                const skirt = [[1.31, 46.84], [1.40, 46.98], [1.43, 47.15], [1.39, 47.83], [1.30, 48.23]];
                kit.add(new THREE.LatheGeometry(skirt.map(([r, z]) => new THREE.Vector2(r, z)), 64), material(0xeff0e9, .85, .07), [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0], false);
                kit.cylinder([0, 0, 48.235], 1.30, .048, white); ring(kit, [0, 0, 48.263], 1.30, 'z', dark, .057);
                for (let panel = 0; panel < 12; panel++) {
                    const a = panel * Math.PI / 6; kit.line([polar(a, 1.435, 47.15), polar(a, 1.396, 47.83), polar(a, 1.305, 48.19)]);
                    for (const z of [47.24, 47.86]) bead(polar(a, z < 47.5 ? 1.426 : 1.389, z), [.020, .020, .020], 0xb3bdb6);
                }
                // Olive exterior cable runs, retaining straps and the green optical mast.
                for (const side of [-1, 1]) {
                    const path = [[side * .19, .66, 44.23], [side * .35, 1.03, 44.62], [side * .43, 1.35, 45.12], [side * .45, 1.46, 45.80], [side * .40, 1.38, 46.26], [side * .25, 1.33, 46.62]];
                    pipe(path, .044, olive);
                    for (const i of [1, 3, 4]) kit.box(path[i], [.12, .11, .08], copper, [0, 0, 0], false);
                }
                kit.add(new THREE.CylinderGeometry(.15, .15, 1.11, 16), material(0x77724d, .97, .02), [.38, 1.37, 45.92], [1, 1, 1], [Math.PI / 2, 0, 0], false);
                for (const z of [45.46, 46.04, 46.38]) ring(kit, [.38, 1.37, z], .154, 'z', copper, .021);
                kit.box([-.28, 1.275, 45.84], [.31, .12, .47], olive, [0, 0, 0], false);
                kit.cylinder([-.28, 1.415, 45.84], .165, .17, green, [0, 0, 0]);
                kit.cylinder([-.28, 1.70, 45.84], .077, .45, green, [0, 0, 0]);
                for (const y of [1.49, 1.73, 1.91]) ring(kit, [-.28, y, 45.84], .095, 'y', 0x9baf91, .016);
                kit.box([-.28, 2.015, 45.84], [.245, .235, .25], green, [0, 0, 0], false);
                kit.cylinder([-.28, 2.015, 45.699], .066, .028, 0x12251a); ring(kit, [-.28, 2.015, 45.682], .067, 'z', silver, .011);
                kit.cylinder([-.417, 2.015, 45.84], .045, .024, dark, [0, 0, Math.PI / 2]);
                // Copper handrails and compact connector clusters around the instrument band.
                for (const angle of [.40, 2.48]) {
                    const p = []; for (const [a, z] of [[angle, 46.72], [angle, 46.20], [angle + .30, 46.20], [angle + .30, 46.63]]) p.push(polar(a, 1.35, z)); pipe(p, .019, copper);
                    for (const z of [46.32, 46.53]) for (const da of [0, .13]) {
                        const a = angle + .53 + da; bead(polar(a, 1.335, z), [.045, .045, .045], silver);
                    }
                }
                // Four square leaves per wing: pale perimeter frames and visible X braces.
                const cellCanvas = document.createElement('canvas'); cellCanvas.width = 512; cellCanvas.height = 512;
                const cc = cellCanvas.getContext('2d'); cc.fillStyle = '#c1bda6'; cc.fillRect(0, 0, 512, 512);
                for (let row = 0; row < 32; row++)for (let col = 0; col < 24; col++) {
                    cc.fillStyle = ['#57594f', '#676857', '#73715d', '#4f544e'][(row * 7 + col * 3) % 4]; cc.fillRect(col * 512 / 24 + 1.2, row * 16 + 1.2, 512 / 24 - 2.4, 13.6);
                    cc.fillStyle = '#b3aa86'; cc.fillRect(col * 512 / 24 + 10.1, row * 16 + 1.2, .7, 13.6);
                }
                const cells = new THREE.CanvasTexture(cellCanvas); cells.colorSpace = THREE.SRGBColorSpace; cells.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
                const cellMat = material(0xffffff, .72, .20, cells), frame = 0xe0e5de, wingZ = 46.92;
                for (const side of [-1, 1]) {
                    kit.cylinder([side * 1.45, 0, wingZ], .15, .29, silver, [0, 0, Math.PI / 2]);
                    for (const end of [-1, 1]) kit.rod([side * 1.48, 0, wingZ], [side * 1.70, 0, wingZ + end * .655], .037, frame);
                    for (let bay = 0; bay < 4; bay++) {
                        const x = side * (1.70 + (bay + .5) * 1.24), w = 1.17, d = 1.31;
                        kit.box([x, 0, wingZ], [w, .042, d], 0x656658, [0, 0, 0], false);
                        for (const face of [-1, 1]) {
                            kit.add(new THREE.PlaneGeometry(w - .035, d - .035), cellMat, [x, face * .023, wingZ], [1, 1, 1], [-face * Math.PI / 2, 0, 0], false);
                            for (const diagonal of [-1, 1]) kit.rod([x - w * .48, face * .052, wingZ - diagonal * d * .48], [x + w * .48, face * .052, wingZ + diagonal * d * .48], .016, frame);
                            kit.rod([x - w * .48, face * .079, wingZ], [x + w * .48, face * .079, wingZ], .022, frame);
                            kit.add(shapes.lowCylinder, material(frame), [x, face * .079, wingZ], [.045, .15, .045], [0, 0, Math.PI / 2], false);
                        }
                        for (const end of [-1, 1]) {
                            kit.box([x + end * w / 2, 0, wingZ], [.044, .12, d + .075], frame, [0, 0, 0], false);
                            kit.box([x, 0, wingZ + end * d / 2], [w, .12, .044], frame, [0, 0, 0], false);
                            kit.cylinder([side * (1.70 + bay * 1.24), 0, wingZ + end * .43], .050, .14, silver);
                        }
                    }
                }
                // Dish antennas and white sensor caps around the orbital docking end.
                function dish(center, direction, radius) {
                    const n = new THREE.Vector3(...direction).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
                    const geom = new THREE.LatheGeometry([[0, 0], [radius * .40, .018], [radius * .72, .047], [radius, .085]].map(([r, z]) => new THREE.Vector2(r, z)), 24).applyQuaternion(q);
                    const face = material(0xe0e3db, .69, .20).clone(); face.side = THREE.DoubleSide; kit.add(geom, face, center, [1, 1, 1], [0, 0, 0], false);
                    const a = new THREE.Vector3(...center), b = a.clone().addScaledVector(n, .13); kit.rod(a.toArray(), b.toArray(), .014, silver); bead(b.toArray(), [.025, .025, .025], dark);
                }
                for (const side of [-1, 1]) {
                    kit.rod([side * .89, .20, 42.31], [side * 1.44, .34, 42.38], .029, silver);
                    dish([side * 1.44, .34, 42.38], [side * .72, .10, -.7], .235);
                    kit.box([side * .89, .20, 42.34], [.18, .18, .30], dark, [0, 0, 0], false);
                }
                kit.rod([.36, 1.05, 42.54], [.64, 1.44, 42.52], .026, silver);
                kit.box([.64, 1.40, 42.52], [.28, .22, .25], white, [.3, 0, .2], false);
                dish([.64, 1.59, 42.49], [.15, .55, -.84], .19);
                kit.rod([-.45, -.97, 42.24], [-.62, -1.45, 42.12], .025, silver); dish([-.62, -1.45, 42.12], [0, -.45, -1], .18);
                for (const [a, z] of [[.66, 42.51], [2.35, 42.67], [4.05, 42.53]]) bead(polar(a, orbitalRadius(z) + .045, z), [.115, .115, .115], white);
                // Short service-skirt fittings visible in the reference; no oversized engine extension.
                for (const angle of [.58, 2.54, 3.73, 5.70]) {
                    const n = new THREE.Vector3(Math.cos(angle), Math.sin(angle), .12).normalize();
                    const nozzle = new THREE.CylinderGeometry(.085, .05, .16, 12, 1, true).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
                    kit.add(nozzle, material(silver, .52, .48), polar(angle, 1.375, 47.90), [1, 1, 1], [0, 0, 0], false);
                    bead(polar(angle, 1.34, 47.87), [.10, .10, .10], white);
                }
                kit.cylinder([0, 0, 48.286], .38, .045, dark); ring(kit, [0, 0, 48.315], .38, 'z', silver, .020);
                kit.rod([.30, -1.27, 48.07], [.32, -1.57, 48.39], .026, green);
                // Only legible markings in the reference are reproduced: Soyuz and the tricolor.
                const patchCanvas = document.createElement('canvas'); patchCanvas.width = 512; patchCanvas.height = 256;
                const pc = patchCanvas.getContext('2d'); pc.fillStyle = '#e5e6df'; pc.fillRect(0, 0, 512, 256);
                pc.fillStyle = '#b33132'; pc.font = 'bold 76px sans-serif'; pc.textAlign = 'center'; pc.fillText('СОЮЗ', 256, 86);
                for (const [i, color] of ['#ffffff', '#285895', '#b43b3c'].entries()) { pc.fillStyle = color; pc.fillRect(158, 119 + i * 31, 196, 31); }
                const label = new THREE.CanvasTexture(patchCanvas); label.colorSpace = THREE.SRGBColorSpace;
                const pp = [], pu = []; for (let j = 0; j < 8; j++)for (let i = 0; i < 12; i++)for (const [ii, jj] of [[i, j], [i + 1, j], [i, j + 1], [i, j + 1], [i + 1, j], [i + 1, j + 1]]) {
                    const a = 2.02 + ii / 12 * .51, z = 42.87 + jj / 8 * .45; pp.push(...polar(a, orbitalRadius(z) + .025, z)); pu.push(ii / 12, jj / 8);
                }
                const patchGeom = new THREE.BufferGeometry(); patchGeom.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); patchGeom.setAttribute('uv', new THREE.Float32BufferAttribute(pu, 2)); patchGeom.computeVertexNormals();
                kit.add(patchGeom, material(0xffffff, .91, .02, label), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
            });

            part('robotics', 'Canadarm2 & Mobile Base System', '19 / CANADA - CSA', 'Canadarm2 rides the Mobile Base System along the rails on the forward face of the integrated truss. Its seven joints (three shoulder, one elbow, three wrist) and two booms are wrapped in white blankets; identical latching end effectors grasp fixtures with cable snares, and cameras on both end effectors and both booms assist operators. Shown after the supplied reference renders: the base on S0\'s forward face above Destiny, one end grappled to it and the arm raised in a high arch in front of the starboard truss.', [['Deployed reach', '17.6 m'], ['Joints / cameras', '7 / 4']], [9.5, 12.2, -.9], (kit, group) => {
                // World coordinates for the arm: the truss and its rails sit trussDrop lower than they are drawn. The base is built
                // in its own frame (x along the truss, y out from the rails, z across them) and stood on the forward-face rails.
                const mbsX = 2.5, railCenterY = (6.45 + 7.25) / 2 - trussDrop, railFace = 2.3 - .32 - .075, frameY = .5, tan = 0xb8a57b, mbsGrey = 0xc9ced0, bronze = 0xa8854f;
                let into = kit;
                const crumple = (u, v) => { const t = payloadBlanket.map.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(u, v); t.needsUpdate = true; return material(0xffffff, .9, .02, t); };
                const armBlanket = crumple(2, 2), boomBlanket = crumple(2, 12);
                // Arm pose: LEE "A" grapples the base's starboard fixture; shoulder roll, yaw and pitch, a boom up to the elbow, a boom
                // down to the wrist, then wrist pitch, yaw and roll to LEE "B". Both booms lie in one tilted plane, so the arm
                // reads as an arch from the side and from above.
                const mouthA = mbsX + 2.09, armY = railCenterY, armZ = railFace - .88;
                const rise = new THREE.Vector3(0, .95, -.31).normalize(), pitchAxis = new THREE.Vector3(1, 0, 0).cross(rise).normalize().toArray();
                const shoulder = new THREE.Vector3(mouthA + 2.6, armY + .45, armZ), elbow = shoulder.clone().add(new THREE.Vector3(2.32, 0, 0)).addScaledVector(rise, 5.75), wrist = shoulder.clone().add(new THREE.Vector3(4.64, 0, 0));
                const joints = [[mouthA + 1.3, armY, armZ], [mouthA + 2.0, armY, armZ], shoulder.toArray(), elbow.toArray(), wrist.toArray(), [wrist.x + .6, armY, armZ], [wrist.x + 1.3, armY, armZ]];
                const axes = [[1, 0, 0], [0, 0, 1], pitchAxis, pitchAxis, pitchAxis, [0, 0, 1], [1, 0, 0]];
                group.userData.joints = joints;
                group.userData.cameras = 4;
                group.userData.latchingEndEffectors = 2;
                group.userData.mobileBase = { x: mbsX, face: 'S0 forward face, above Destiny\'s starboard struts', grappleFixtures: 4, mastCamera: true, payloadOruAccommodation: true };
                // All seams, collars and fittings use the hardware's local axis.
                function hardwareFrame(center, axis) {
                    const origin = new THREE.Vector3(...center);
                    const quaternion = new THREE.Quaternion().setFromUnitVectors(vertical, new THREE.Vector3(...axis).normalize());
                    return {
                        quaternion,
                        point: (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(quaternion).add(origin).toArray(),
                        add: (geometry, color) => into.add(geometry.clone().applyQuaternion(quaternion), material(color), center, [1, 1, 1], [0, 0, 0], false),
                        wrap: (geometry, surface) => into.add(geometry.clone().applyQuaternion(quaternion), surface, center, [1, 1, 1], [0, 0, 0], false)
                    };
                }
                function axialRing(frame, height, radius, tube, color) {
                    frame.add(new THREE.TorusGeometry(radius, tube, 6, 28).rotateX(Math.PI / 2).translate(0, height, 0), color);
                }
                function localBox(frame, center, size, color) {
                    frame.add(new THREE.BoxGeometry(...size).translate(...center), color);
                }
                function localCylinder(frame, height, radius, length, color) {
                    frame.add(new THREE.CylinderGeometry(radius, radius, length, 24).translate(0, height, 0), color);
                }
                const pillow = (x, y, z) => payloadPillow.clone().scale(x, y, z);
                function cameraHead(center, direction) {
                    const camera = hardwareFrame(center, direction);
                    localBox(camera, [0, 0, 0], [.20, .28, .23], palette.white);
                    localBox(camera, [0, .145, 0], [.17, .045, .19], palette.silver);
                    localCylinder(camera, .181, .071, .045, palette.dark);
                    localCylinder(camera, .207, .050, .010, palette.glass);
                    const lamp = hardwareFrame(camera.point(.122, .085, 0), direction);
                    localCylinder(lamp, .069, .038, .075, palette.silver);
                    localCylinder(lamp, .110, .031, .012, palette.white);
                }
                // Recessed bronze grapple head: backing boss, pale capture rim, dark inset and three radial guides.
                function grappleFixture(center, normal) {
                    const f = hardwareFrame(center, normal);
                    localBox(f, [0, -.022, 0], [.53, .10, .53], mbsGrey);
                    localCylinder(f, -.01, .22, .17, 0x687476);
                    localCylinder(f, .060, .292, .052, bronze);
                    localCylinder(f, .091, .257, .012, 0x6f664d);
                    axialRing(f, .10, .288, .019, 0xd4d1b6); axialRing(f, .101, .255, .012, bronze);
                    for (let i = 0; i < 3; i++) {
                        const a = i * Math.PI * 2 / 3; f.add(new THREE.BoxGeometry(.034, .025, .218).translate(0, .115, .123).rotateY(a), 0xc1b58c);
                        const q = f.point(Math.sin(a) * .245, .116, Math.cos(a) * .245); into.add(shapes.sphere, material(0xd1d2c9), q, [.023, .018, .023], [0, 0, 0], false);
                    }
                    localCylinder(f, .123, .045, .040, palette.silver); localCylinder(f, .162, .022, .047, 0xe3e5db);
                    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; f.add(new THREE.CylinderGeometry(.013, .013, .012, 10).translate(Math.sin(a) * .274, .124, Math.cos(a) * .274), 0x757d77); }
                }
                // A latching end effector: blanketed barrel with four latch lobes, bronze-rimmed snare mouth and a grey base collar.
                function endEffector(mouth, outward, withCamera, scale = 1) {
                    const dir = new THREE.Vector3(...outward).normalize(), center = new THREE.Vector3(...mouth).addScaledVector(dir, -.5 * scale);
                    const end = hardwareFrame(center.toArray(), outward);
                    end.wrap(new THREE.CylinderGeometry(.36 * scale, .36 * scale, 1.0 * scale, 32, 1), armBlanket);
                    for (let lobe = 0; lobe < 4; lobe++) {
                        const a = Math.PI / 4 + lobe * Math.PI / 2;
                        end.wrap(new THREE.CylinderGeometry(.11 * scale, .11 * scale, .8 * scale, 16).translate(Math.cos(a) * .37 * scale, -.05 * scale, Math.sin(a) * .37 * scale), armBlanket);
                    }
                    axialRing(end, .5 * scale, .3 * scale, .045 * scale, bronze);
                    localCylinder(end, .44 * scale, .29 * scale, .02, palette.dark);
                    for (let latch = 0; latch < 3; latch++) {
                        const angle = latch * Math.PI * 2 / 3, next = angle + Math.PI * 2 / 3;
                        into.rod(end.point(Math.cos(angle) * .22 * scale, .46 * scale, Math.sin(angle) * .22 * scale), end.point(Math.cos(next) * .22 * scale, .46 * scale, Math.sin(next) * .22 * scale), .009, palette.rail);
                    }
                    localCylinder(end, -.53 * scale, .38 * scale, .1 * scale, 0x9aa0a3);
                    if (withCamera) {
                        localBox(end, [.44, -.15, 0], [.16, .17, .16], palette.silver);
                        cameraHead(end.point(.54, -.05, 0), outward);
                    }
                }
                // Detailed Mobile Base System, seated on the supplied forward-face rail position.
                // The cage stays upright; its occupied fixture faces starboard to meet the unchanged reference arm.
                const mbs = new THREE.Group(); mbs.name = 'Mobile Base System';
                mbs.position.set(.7, -3.045, .375); mbs.scale.x = -1; group.add(mbs);
                const mbsKit = new Kit(); into = mbsKit;
                {
                    const mbsX = -1.8, railTop = 7.215, frameY = 7.715, baseZ = .65;
                    const fixtureX = -3.775, armY = 8.295, armZ = .65;
                    const tan = 0xa89772, mbsGrey = 0xb5bebf;
                    const toWorld = p => [.7 - p[0], p[1] - 3.045, p[2] + .375];
                    // ---- Mobile transporter and supported forward working platform ----
                    const charcoal = 0x596466, edgeGrey = 0x899697, frontZ = -.55, rearZ = 1.40;
                    function strut(a, b, width = .10, depth = .13, color = charcoal) {
                        const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), axis = bv.clone().sub(av), g = new THREE.BoxGeometry(width, depth, axis.length());
                        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.normalize()));
                        into.add(g, material(color, .64, .39), av.add(bv).multiplyScalar(.5).toArray(), [1, 1, 1], [0, 0, 0], false);
                    }
                    function cableRun(points, r = .014, color = 0xd5d8d0) { into.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(24, points.length * 8), r, 7, false), material(color, .89, .04), [0, 0, 0], [1, 1, 1], [0, 0, 0], false); }
                    function bolt(p, axis = [0, 0, -1], r = .027) { const f = hardwareFrame(p, axis); localCylinder(f, 0, r, .020, 0xbec6c1); localCylinder(f, .015, r * .40, .010, 0x4e5a58); }
                    // Four bogies contact the supplied model's two forward-face rails.
                    // In this mirrored cage frame, world Y = local Y - 3.045 and world Z = local Z + .375.
                    for (const dx of [-1.48, 1.48]) {
                        for (const y of [7.895, 8.695]) {
                            into.cylinder([mbsX + dx, y, 1.38], .15, .19, 0x50595c, [0, 0, 0]);
                            into.box([mbsX + dx, y, 1.19], [.40, .20, .18], edgeGrey, [0, 0, 0], false);
                            strut([mbsX + dx, y, 1.17], [mbsX + dx, y, 1.36], .12, .10, charcoal);
                        }
                        strut([mbsX + dx, frameY, 1.19], [mbsX + dx, 8.795, 1.19], .19, .19, edgeGrey);
                        strut([mbsX + dx, frameY, frontZ], [mbsX + dx, frameY, rearZ], .19, .21, edgeGrey);
                        strut([mbsX + dx, frameY, baseZ], [mbsX + dx, 8.60, 1.19], .08, .10, charcoal);
                    }
                    for (const z of [frontZ, baseZ, rearZ]) strut([mbsX - 1.92, frameY, z], [mbsX + 1.92, frameY, z], .17, .17, edgeGrey);
                    for (const dx of [-1.92, 1.92]) strut([mbsX + dx, frameY, frontZ], [mbsX + dx, frameY, rearZ], .15, .17, 0xc1c8c2);
                    for (const z of [frontZ, rearZ]) {
                        into.box([mbsX, frameY + .095, z], [3.86, .045, .24], 0xd3d7cf, [0, 0, 0], false);
                        for (const dx of [-1.65, -.83, 0, .83, 1.65]) bolt([mbsX + dx, frameY + .124, z], [0, 1, 0], .025);
                    }
                    strut([mbsX - 1.42, frameY - .02, frontZ], [mbsX + 1.42, frameY - .02, rearZ], .075, .085, charcoal);
                    strut([mbsX + 1.42, frameY - .02, frontZ], [mbsX - 1.42, frameY - .02, rearZ], .075, .085, charcoal);
                    // A tall, narrow-topped trapezoidal space frame, open on every side.
                    const lowY = frameY + .16, midY = frameY + 1.40, topY = frameY + 2.78;
                    const lower = (s, back) => [mbsX + s * 1.30, lowY, back ? 1.32 : -.34];
                    const middle = (s, back) => [mbsX + s * .86, midY, back ? 1.16 : -.07];
                    const upper = (s, back) => [mbsX + s * .34, topY, back ? 1.03 : .26];
                    for (const back of [false, true]) {
                        for (const s of [-1, 1]) {
                            strut(lower(s, back), upper(s, back), .14, .16, charcoal);
                            const a = lower(s, back), b = upper(s, back); strut([a[0] + s * .095, a[1], a[2] - .06], [b[0] + s * .07, b[1], b[2] - .06], .055, .10, tan);
                            into.box(lower(s, back), [.30, .13, .32], mbsGrey, [0, 0, 0], false); bolt([a[0], a[1] + .09, a[2]], [0, 1, 0]);
                        }
                        strut(lower(-1, back), lower(1, back), .14, .13, charcoal);
                        strut(middle(-1, back), middle(1, back), .10, .12, edgeGrey);
                        strut(upper(-1, back), upper(1, back), .14, .13, charcoal);
                        strut(lower(-1, back), middle(1, back), .085, .12, charcoal); strut(lower(1, back), middle(-1, back), .085, .12, charcoal);
                        strut(middle(-1, back), upper(1, back), .075, .10, tan); strut(middle(1, back), upper(-1, back), .075, .10, charcoal);
                    }
                    for (const s of [-1, 1]) {
                        strut(lower(s, false), lower(s, true), .13, .14, charcoal); strut(middle(s, false), middle(s, true), .09, .12, edgeGrey); strut(upper(s, false), upper(s, true), .12, .14, charcoal);
                        strut(lower(s, false), middle(s, true), .075, .10, tan); strut(lower(s, true), middle(s, false), .075, .10, charcoal);
                        strut(middle(s, false), upper(s, true), .075, .10, tan);
                    }
                    // Inset equipment, mounting gussets and small blanket covers leave the trusswork legible.
                    for (const [dx, y, z, w, h, d] of [[-.67, frameY + .75, .79, .34, .95, .48], [.50, frameY + .47, 1.22, .48, .43, .50], [.05, frameY + 1.64, .77, .48, .34, .45]]) {
                        into.box([mbsX + dx, y, z], [w - .05, h - .05, d - .05], 0x79878a, [0, 0, 0], false);
                        into.add(pillow(w, h, d), armBlanket, [mbsX + dx, y, z], [1, 1, 1], [0, 0, 0], false);
                        for (const yy of [y - h * .37, y + h * .37]) into.box([mbsX + dx, yy, z - d * .60], [w * .85, .035, .024], 0xbec5c0, [0, 0, 0], false);
                    }
                    for (const s of [-1, 1]) {
                        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([mbsX + s * 1.14, lowY + .02, -.36, mbsX + s * .62, lowY + .02, -.36, mbsX + s * .97, lowY + .57, -.15], 3)); g.setIndex([0, 1, 2]); g.computeVertexNormals(); const cover = armBlanket.clone(); cover.side = THREE.DoubleSide; into.add(g, cover, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                        into.box([mbsX + s * 1.54, frameY + .20, baseZ], [.56, .24, 1.18], 0xd0d5ce, [0, 0, 0], false);
                    }
                    // Occupied starboard grapple after the cage mirror: transverse cradle joins the side frame and exactly shares LEE A's axis.
                    strut([fixtureX + .08, armY, armZ], [mbsX - .86, midY, baseZ], .16, .20, edgeGrey);
                    into.box([fixtureX + .23, armY, armZ], [.44, .53, .58], mbsGrey, [0, 0, 0], false);
                    for (const z of [armZ - .25, armZ + .25]) into.box([fixtureX + .10, armY, z], [.50, .43, .06], charcoal, [0, 0, 0], false);
                    grappleFixture([fixtureX, armY, armZ], [-1, 0, 0]);
                    // Three canted, front-facing carriers match the visible circular heads in the reference.
                    const heads = [{ p: [mbsX - 1.32, frameY + .17, -.74], n: [-.12, -.10, -1], from: lower(-1, false) }, { p: [mbsX + 1.32, frameY + .17, -.74], n: [.12, -.10, -1], from: lower(1, false) }, { p: [mbsX + .94, frameY + 1.49, -.30], n: [.15, .05, -1], from: middle(1, false) }];
                    for (const h of heads) { strut(h.from, h.p, .13, .14, edgeGrey); grappleFixture(h.p, h.n); }
                    // Dark cable service loops, white harness clips and connector panels under the forward sill.
                    for (const s of [-1, 1]) {
                        cableRun([[mbsX + s * 1.12, frameY + .14, -.23], [mbsX + s * 1.64, frameY - .11, -.29], [mbsX + s * 1.44, frameY - .37, .27], [mbsX + s * .75, frameY - .29, .70], [mbsX + s * .63, frameY + .39, .91]], .025, 0x535e5e);
                        for (let k = 0; k < 3; k++)cableRun([[mbsX + s * .25 + k * .034, frameY + 1.68, .48], [mbsX + s * .40 + k * .034, frameY + 1.11, .53], [mbsX + s * .62 + k * .034, frameY + .46, .44], [mbsX + s * .88 + k * .034, frameY + .12, .26]], .011);
                    }
                    into.box([mbsX + .1, frameY + .18, -.42], [.57, .20, .12], 0xbec6c2, [0, 0, 0], false);
                    for (const dx of [-.16, 0, .16]) into.cylinder([mbsX + .1 + dx, frameY + .18, -.495], .043, .035, 0x374747);
                    // Short camera mast at the narrow top, on a bolted head plate.
                    into.box([mbsX, topY + .075, .65], [.48, .11, .83], edgeGrey, [0, 0, 0], false);
                    into.rod([mbsX, topY + .10, .65], [mbsX, topY + .43, .65], .048, palette.silver); cameraHead([mbsX, topY + .57, .65], [0, .04, -1]);
                    // Payload/ORU accommodation remains a separate right-hand cradle behind the front fixture carriers.
                    strut([mbsX + .90, frameY + .39, 1.32], [mbsX + 1.78, frameY + .39, 1.32], .18, .20, charcoal);
                    endEffector([mbsX + 2.46, frameY + .39, 1.32], [1, 0, 0], false, .72);
                    group.userData.mobileBase.frontFixtureCenters = heads.map(h => toWorld(h.p));


                }
                mbsKit.finish(mbs); into = kit;
                group.userData.grappleInterface = { fixture: [4.475, armY, armZ], fixtureNormal: [1, 0, 0], mouth: [mouthA, armY, armZ], mouthNormal: [-1, 0, 0], seatedOffset: .115 };
                group.userData.boomLengths = [shoulder.distanceTo(elbow), elbow.distanceTo(wrist)];
                group.userData.mobileBase.railCenterlinesY = [4.85, 5.65];
                group.userData.mobileBase.railContactFaceZ = railFace;
                group.userData.mobileBase.referenceOrigin = [mbsX, railCenterY, railFace];
                group.userData.armPoseSource = '02 ISS Space Station 3D.html';
                // ---- Canadarm2 ----
                // Seven joints: blanketed, box-like housings around a rotating drum with dark seams on its axis.
                for (let joint = 0; joint < joints.length; joint++) {
                    const size = joint === 3 ? .8 : .66, housing = hardwareFrame(joints[joint], axes[joint]);
                    housing.wrap(pillow(size, size * .92, size), armBlanket);
                    localCylinder(housing, 0, .3, size + .08, palette.white);
                    for (const side of [-1, 1]) {
                        axialRing(housing, side * (size / 2 + .02), .305, .02, palette.dark);
                        localCylinder(housing, side * (size / 2 + .045), .24, .02, palette.silver);
                    }
                }
                // Short blanketed links between the shoulder and wrist joints.
                for (const [from, to] of [[0, 1], [1, 2], [4, 5], [5, 6]]) {
                    const a = new THREE.Vector3(...joints[from]), b = new THREE.Vector3(...joints[to]), link = hardwareFrame(a.clone().lerp(b, .5).toArray(), b.clone().sub(a).toArray());
                    link.wrap(pillow(.46, Math.max(.2, a.distanceTo(b) - .2), .46), armBlanket);
                }
                // Lettering that runs along each boom, set on the upper side.
                const lettering = (() => {
                    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 512; const g = canvas.getContext('2d');
                    g.translate(44, 488); g.rotate(-Math.PI / 2); g.font = 'italic 48px Georgia, "Times New Roman", serif'; g.fillStyle = '#3a3f45'; g.fillText('Canadarm', 0, 0);
                    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
                    const ink = new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: .3, roughness: .8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
                    ink.userData.decal = true; return ink;
                })();
                // Two booms: blanketed tubes with end collars, electronics boxes, a camera/light each, the lettering, and a blue band near the wrist.
                for (const [from, to, cameraAt, blue] of [[shoulder, elbow, .42, false], [elbow, wrist, .58, true]]) {
                    const axis = to.clone().sub(from), length = axis.length(), dir = axis.clone().normalize(), frame = hardwareFrame(from.clone().lerp(to, .5).toArray(), dir.toArray());
                    const span = length - .6, side = new THREE.Vector3(...pitchAxis);
                    frame.wrap(new THREE.CylinderGeometry(.19, .19, span, 28, 1), boomBlanket);
                    for (const end of [-1, 1]) { localCylinder(frame, end * (span / 2 - .1), .235, .16, palette.white); axialRing(frame, end * (span / 2 - .19), .236, .018, palette.silver); }
                    const at = t => from.clone().addScaledVector(dir, length * t);
                    for (const [t, s] of [[.22, 1], [.78, -1]]) { const box = hardwareFrame(at(t).addScaledVector(side, s * .34).toArray(), dir.toArray()); box.wrap(pillow(.3, .52, .3), armBlanket); }
                    const bracket = at(cameraAt).addScaledVector(side, -.3);
                    kit.rod(at(cameraAt).addScaledVector(side, -.18).toArray(), bracket.toArray(), .04, palette.silver);
                    cameraHead(bracket.addScaledVector(side, -.12).toArray(), dir.clone().multiplyScalar(from === shoulder ? 1 : -1).toArray());
                    // The lettering faces the side of the boom nearest to straight up.
                    const up = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize().applyQuaternion(frame.quaternion.clone().invert());
                    const facing = Math.atan2(up.x, up.z);
                    frame.wrap(new THREE.CylinderGeometry(.194, .194, 1.9, 6, 1, true, facing - .45, .9).translate(0, (from === shoulder ? .12 : -.12) * span, 0), lettering);
                    if (blue) localCylinder(frame, span / 2 - .55, .197, .14, 0x2a56a8);
                }
                // LEE "A" grapples the base's starboard fixture; LEE "B" is free at the far end.
                endEffector([mouthA, armY, armZ], [-1, 0, 0], true);
                endEffector([wrist.x + 2.56, armY, armZ], [1, 0, 0], true);
                const armModel = new THREE.Group(); armModel.name = 'Canadarm2 reference pose'; kit.finish(armModel); group.add(armModel);
            });
            part('beam', 'BEAM expandable module', '20 / EXPANDABLE HABITAT', 'BEAM is attached to Tranquility\'s aft port. Expanded in May 2016, its flexible multilayer shell surrounds a cargo stowage volume monitored by sensors. The quilted fabric barrel, the large aft bulkhead with its handholds and fixtures, and the Bigelow Aerospace and flag markings follow the supplied reference render; seams and fittings are schematic.', [['Expanded size', '~4.0 x 3.2 m'], ['Attachment', 'Tranquility aft']], [-7, 1.1, 16.55], (kit, group) => {
                group.userData.moduleLength = 4.0; group.userData.moduleDiameter = 3.24;
                group.userData.attachment = 'Tranquility aft';
                group.userData.referenceViews = 1;
                group.userData.rebuild = '2026-10-01: quilted barrel, large aft bulkhead and markings after the supplied render';
                const cx = -7, baseZ = 14.34;
                // BEAM is absent from the supplied older GLB. Adapt its CBM saddle shape to
                // the existing Node 3 hull, keeping BEAM's current body and location unchanged.
                const nodeSaddle = new THREE.Group(), nodeSaddleKit = new Kit();
                nodeSaddle.name = 'BEAM / Tranquility curved CBM saddle';
                nodeSaddle.position.set(cx, 0, 12);
                curvedCbmSaddle(nodeSaddleKit, 2.15, [
                    [1.060, 'plane', 2.180], [1.115, 'plane', 2.180],
                    [1.190, 'plane', 2.168], [1.240, 'shell', .012],
                    [1.285, 'shell', .012], [1.285, 'shell', .030],
                    [1.060, 'shell', .030], [1.060, 'plane', 2.180]
                ]);
                nodeSaddle.userData.interface = { source: 'Adapted CBM shape; BEAM absent from supplied GLB',
                    hullRadius: 2.15, flatFace: 14.180, rootDepths: [.012, .030], axis: 'Z' };
                nodeSaddleKit.finish(nodeSaddle); group.add(nodeSaddle);

                // Side profile as (radius, distance aft of the berthing plane): a round shoulder off the collar, a full barrel and a long,
                // rounded roll into the rim of the large aft bulkhead.
                const control = [[1.06, .30], [1.24, .37], [1.39, .5], [1.5, .7], [1.57, .95], [1.61, 1.3], [1.625, 1.8], [1.62, 2.3], [1.6, 2.75], [1.56, 3.1], [1.49, 3.4], [1.39, 3.63], [1.28, 3.8], [1.2, 3.89], [1.17, 3.91]];
                const spline = new THREE.SplineCurve(control.map(([r, z]) => new THREE.Vector2(r, z)));
                const rows = 110, around = 192, gores = 12, bands = [.30, .92, 1.56, 2.2, 2.84, 3.46, 3.91];
                const profile = spline.getSpacedPoints(rows).map(p => [p.x, p.y]);
                // Quilted panels puff out between the sewn seams; meandering longitudinal creases ripple the fabric. Every term is periodic
                // in the angle so the shell closes cleanly.
                function radiusAt(a, r0, zl) {
                    const k = bands.findIndex((b, i) => i < bands.length - 1 && zl <= bands[i + 1]), z0 = bands[Math.max(0, k)], z1 = bands[Math.max(0, k) + 1];
                    const fz = THREE.MathUtils.clamp((zl - z0) / (z1 - z0), 0, 1), fa = ((a / (Math.PI * 2 / gores)) % 1 + 1) % 1;
                    const puff = .046 * (r0 / 1.62) ** 2 * Math.pow(Math.sin(Math.PI * fa), .75) * Math.pow(Math.sin(Math.PI * fz), .75);
                    const crease = .009 * Math.sin(37 * a + 2.2 * Math.sin(1.3 * zl + 3 * a)) + .006 * Math.sin(61 * a + 2.8 * Math.sin(2.1 * zl - 5 * a)) + .004 * Math.sin(97 * a + 1.7 * Math.sin(3.4 * zl));
                    return r0 + puff + crease * (r0 / 1.62);
                }
                const surface = (a, zl, r0, lift = 0) => { const r = radiusAt(a, r0, zl) + lift; return [cx + Math.cos(a) * r, Math.sin(a) * r, baseZ + zl]; };
                const profileAt = zl => { let j = profile.findIndex(p => p[1] >= zl); if (j <= 0) return profile[Math.max(0, j)][0]; const [ra, za] = profile[j - 1], [rb, zb] = profile[j]; return ra + (rb - ra) * (zl - za) / (zb - za); };
                // White, softly crinkled fabric: a mottled ground under short, slightly wandering creases that mostly run along the module.
                const fabricCanvas = document.createElement('canvas'); fabricCanvas.width = fabricCanvas.height = 512;
                {
                    const g = fabricCanvas.getContext('2d'); g.fillStyle = '#ebe8df'; g.fillRect(0, 0, 512, 512);
                    let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
                    for (let i = 0; i < 420; i++) { const x = rnd() * 512, y = rnd() * 512, r = 14 + rnd() * 40; g.fillStyle = rnd() > .5 ? 'rgba(255,255,252,.10)' : 'rgba(160,156,146,.07)'; g.beginPath(); g.ellipse(x, y, r * .45, r, 0, 0, Math.PI * 2); g.fill(); }
                    for (let i = 0; i < 1900; i++) {
                        const x = rnd() * 512, y = rnd() * 512, l = 8 + rnd() * 26, tilt = (rnd() - .5) * .9, bend = (rnd() - .5) * 7;
                        const ex = x + Math.sin(tilt) * l, ey = y + Math.cos(tilt) * l;
                        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + ex) / 2 + bend, (y + ey) / 2, ex, ey);
                        const dark = rnd() > .45; g.lineWidth = 1.2 + rnd() * 2.6; g.strokeStyle = dark ? 'rgba(140,138,128,.20)' : 'rgba(255,255,252,.55)'; g.stroke();
                        if (dark) { g.translate(1.4, 0); g.lineWidth *= .7; g.strokeStyle = 'rgba(255,255,252,.35)'; g.stroke(); g.translate(-1.4, 0); }
                    }
                }
                const fabricMap = new THREE.CanvasTexture(fabricCanvas); fabricMap.colorSpace = THREE.SRGBColorSpace; fabricMap.wrapS = fabricMap.wrapT = THREE.RepeatWrapping; fabricMap.repeat.set(9, 3); fabricMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
                const fabricBump = fabricMap.clone(); fabricBump.colorSpace = THREE.NoColorSpace; fabricBump.needsUpdate = true;
                const fabric = new THREE.MeshStandardMaterial({ color: 0xf1efe8, map: fabricMap, bumpMap: fabricBump, bumpScale: .018, roughness: .93, metalness: .03 });
                // The quilted shell, built directly so the puffed panels and creases follow the exact profile.
                {
                    const positions = [], uvs = [], index = [];
                    for (let j = 0; j <= rows; j++) for (let i = 0; i <= around; i++) {
                        const a = i / around * Math.PI * 2, [r0, zl] = profile[j];
                        positions.push(...surface(a, zl, r0)); uvs.push(i / around, j / rows);
                    }
                    for (let j = 0; j < rows; j++) for (let i = 0; i < around; i++) {
                        const p = j * (around + 1) + i, q = p + 1, s = p + around + 1, t = s + 1;
                        index.push(p, q, s, q, t, s);
                    }
                    const shell = new THREE.BufferGeometry(); shell.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); shell.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); shell.setIndex(index);
                    shell.computeVertexNormals();
                    const normal = shell.attributes.normal;
                    for (let j = 0; j <= rows; j++) {
                        const p = j * (around + 1), q = p + around, n = [0, 1, 2].map(k => normal.array[p * 3 + k] + normal.array[q * 3 + k]), l = Math.hypot(...n);
                        for (const v of [p, q]) normal.setXYZ(v, n[0] / l, n[1] / l, n[2] / l);
                    }
                    kit.add(shell, fabric, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                // Sewn seams: gores along the barrel and circumferential bands, raised slightly in the creases between panels.
                const seam = material(0xd5d2c6, .9, .03);
                for (let k = 0; k < gores; k++) {
                    const a = k * Math.PI * 2 / gores;
                    kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(profile.filter((_, j) => j % 2 === 0).map(([r0, zl]) => new THREE.Vector3(...surface(a, zl, r0, .006)))), 70, .011, 6, false), seam, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                for (const zl of bands.slice(1, -1)) {
                    const r0 = profileAt(zl);
                    kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 96 }, (_, i) => new THREE.Vector3(...surface(i / 96 * Math.PI * 2, zl, r0, .006))), true), 192, .011, 6, true), seam, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                // Bigelow Aerospace wordmark above a US flag on the upper port side near the collar, as a decal that follows the quilting.
                {
                    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 640;
                    const g = canvas.getContext('2d');
                    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
                    g.font = 'italic 900 158px Arial Black, Arial, sans-serif'; g.lineJoin = 'round';
                    g.lineWidth = 16; g.strokeStyle = '#24387c'; g.strokeText('BIGELOW', 512, 205);
                    g.fillStyle = '#c62a30'; g.fillText('BIGELOW', 512, 205);
                    g.font = 'italic 700 46px Arial, sans-serif'; g.fillStyle = '#24387c'; g.fillText('AEROSPACE', 640, 262);
                    const fx = 352, fy = 318, fw = 330, fh = 196;
                    for (let s = 0; s < 13; s++) { g.fillStyle = s % 2 ? '#f6f6f2' : '#c3283a'; g.fillRect(fx, fy + s * fh / 13, fw, fh / 13 + .5); }
                    g.fillStyle = '#25356f'; g.fillRect(fx, fy, fw * .4, fh * 7 / 13);
                    g.fillStyle = '#f6f6f2'; for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) { g.beginPath(); g.arc(fx + 12 + col * 21 + (row % 2) * 10, fy + 12 + row * 19, 4, 0, Math.PI * 2); g.fill(); }
                    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
                    const ink = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: .9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 }); ink.userData.decal = true;
                    const z0 = 1.0, z1 = 2.0, aTop = 2.36, aBottom = 2.36 + .62 / 1.62, nu = 24, nv = 12, positions = [], uvs = [], index = [];
                    for (let q = 0; q <= nv; q++) for (let p = 0; p <= nu; p++) {
                        const zl = z0 + (z1 - z0) * p / nu, a = aBottom - (aBottom - aTop) * q / nv;
                        positions.push(...surface(a, zl, profileAt(zl), .026)); uvs.push(p / nu, q / nv);
                    }
                    for (let q = 0; q < nv; q++) for (let p = 0; p < nu; p++) { const A = q * (nu + 1) + p, B = A + 1, C = A + nu + 1, D = C + 1; index.push(A, B, C, B, D, C); }
                    const decal = new THREE.BufferGeometry(); decal.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); decal.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); decal.setIndex(index); decal.computeVertexNormals();
                    kit.add(decal, ink, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                // Dark berthing collar on Tranquility's aft port, with lighter flange rings and bolt heads.
                kit.cylinder([cx, 0, baseZ - .03], 1.1, .62, 0x4f565a);
                ring(kit, [cx, 0, baseZ + .27], 1.12, 'z', 0x9aa1a3, .034); ring(kit, [cx, 0, baseZ - .28], 1.12, 'z', 0x7b8386, .03);
                for (let bolt = 0; bolt < 16; bolt++) { const a = bolt * Math.PI / 8; kit.box([cx + Math.cos(a) * 1.11, Math.sin(a) * 1.11, baseZ + .1], [.06, .06, .08], 0x8d9496, [0, 0, a], false); }
                // Large aft bulkhead: a rolled rim where the fabric ends, a flat white disc with an inner hatch ring, two gold handholds,
                // a small grey plate and two black grapple fixtures with gold fittings on brackets at its upper edge.
                const endZ = baseZ + 3.93, white = 0xe9e8e2, gold = 0xc9a447;
                kit.add(new THREE.TorusGeometry(1.11, .085, 16, 96), material(white, .7, .08), [cx, 0, endZ], [1, 1, 1], [0, 0, 0], false);
                kit.cylinder([cx, 0, endZ + .04], 1.1, .1, white);
                const face = endZ + .09;
                kit.add(new THREE.TorusGeometry(.86, .014, 8, 96), material(0xc9cbc8, .6, .2), [cx, 0, face + .004], [1, 1, 1], [0, 0, 0], false);
                kit.cylinder([cx, 0, face + .01], .84, .02, 0xeeeee9);
                for (const side of [-1, 1]) {
                    const x = cx + side * .32;
                    for (const y of [-.28, .32]) kit.rod([x, y, face + .02], [x, y, face + .1], .016, gold);
                    kit.rod([x, -.3, face + .1], [x, .34, face + .1], .022, gold);
                }
                kit.box([cx - .04, .78, face + .025], [.18, .09, .03], 0x6e7477, [0, 0, 0], false);
                function fixture(a, normal, r) {
                    const base = new THREE.Vector3(cx + Math.cos(a) * 1.11, Math.sin(a) * 1.11, endZ + .02), n = new THREE.Vector3(...normal).normalize();
                    const top = base.clone().addScaledVector(n, .2), q = new THREE.Quaternion().setFromUnitVectors(vertical, n);
                    kit.rod(base.toArray(), top.toArray(), .04, white);
                    kit.add(new THREE.BoxGeometry(.05, .2, .2).applyQuaternion(q), material(white, .7, .08), base.clone().addScaledVector(n, .09).toArray(), [1, 1, 1], [0, 0, 0], false);
                    const put = (geometry, color, offset) => kit.add(geometry.applyQuaternion(q), material(color, .45, .35), top.clone().addScaledVector(n, offset).toArray(), [1, 1, 1], [0, 0, 0], false);
                    put(new THREE.CylinderGeometry(r, r, .035, 40), palette.black, 0);
                    put(new THREE.CylinderGeometry(.05, .06, .12, 16), gold, .07);
                    for (let blade = 0; blade < 3; blade++) put(new THREE.BoxGeometry(.05, .03, r * .75).translate(0, 0, r * .42).rotateY(blade * Math.PI * 2 / 3), gold, .03);
                }
                fixture(1.75, [-.1, 1, .25], .24);
                fixture(.7, [.55, .45, .7], .21);
            });
            part('bishop', 'Bishop research airlock', '21 / COMMERCIAL RESEARCH', 'Bishop was installed on Tranquility\'s port end in December 2020. Canadarm2 removes the bell-shaped airlock to expose its contents to space. It has six external payload sites; surface fittings and shielding are schematic.', [['Installed', '19 DEC 2020'], ['External payload sites', '6']], [-11.32, 1.0, 12], (kit, group) => {
                group.userData.attachment = 'Tranquility port';
                group.userData.externalPayloadSites = 6; group.userData.grappleFixtures = 2;
                // The ~2.1 m wide, ~1.8 m long bell is an approximate visual envelope.
                // NASA's guide confirms the no-hatch bell-jar architecture and CBM interface.
                const rootX = -10.29;
                const profile = [[1.025, 0], [1.025, .84], [1.012, 1.11], [.95, 1.37], [.79, 1.61], [.50, 1.77], [0, 1.84]];
                // Lathe Y axis rotates toward station port (-X).
                kit.add(new THREE.LatheGeometry(profile.map(([r, d]) => new THREE.Vector2(r, d)), 40), material(palette.white, .61, .26), [rootX, 0, 12], [1, 1, 1], [0, 0, Math.PI / 2], false);
                kit.cylinder([rootX + .10, 0, 12], 1.105, .23, palette.silver, [0, 0, Math.PI / 2]);
                ring(kit, [rootX + .23, 0, 12], 1.11, 'x', palette.dark, .042);
                ring(kit, [rootX - .06, 0, 12], 1.035, 'x', palette.silver, .037);
                ring(kit, [rootX - .85, 0, 12], 1.040, 'x', palette.silver, .029);
                for (let bolt = 0; bolt < 16; bolt++) {
                    const a = bolt * Math.PI / 8;
                    kit.add(shapes.lowCylinder, material(palette.rail), [rootX + .245, Math.cos(a) * 1.02, 12 + Math.sin(a) * 1.02], [.022, .028, .022], [0, 0, Math.PI / 2], false);
                }
                // Faceted MMOD shield panels and restrained seams distinguish the rigid shell.
                for (let panelIndex = 0; panelIndex < 12; panelIndex++) {
                    const a = panelIndex * Math.PI / 6, ny = Math.cos(a), nz = Math.sin(a);
                    kit.box([rootX - .47, ny * 1.025, 12 + nz * 1.025], [.72, .034, .48], panelIndex % 3 === 0 ? palette.hull : palette.white, [a, 0, 0], false);
                    for (const along of [.19, .75]) kit.box([rootX - along, ny * 1.048, 12 + nz * 1.048], [.05, .024, .055], palette.silver, [a, 0, 0], false);
                    kit.line(profile.slice(1).map(([r, d]) => [rootX - d, ny * (r + .012), 12 + nz * (r + .012)]));
                }
                // Six unoccupied external payload attachment pads; no specific 2023 payload assumed.
                for (let site = 0; site < 6; site++) {
                    const a = site * Math.PI / 3 + Math.PI / 6, ny = Math.cos(a), nz = Math.sin(a);
                    kit.box([rootX - .50, ny * 1.08, 12 + nz * 1.08], [.38, .10, .34], palette.silver, [a, 0, 0]);
                    kit.box([rootX - .50, ny * 1.139, 12 + nz * 1.139], [.20, .025, .18], palette.dark, [a, 0, 0], false);
                }
                // Two robotic grapple fixtures on different shell faces.
                function bishopGrapple(origin, normal) {
                    const o = new THREE.Vector3(...origin), n = new THREE.Vector3(...normal);
                    const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
                    const angles = [rotation.x, rotation.y, rotation.z];
                    const at = d => o.clone().addScaledVector(n, d).toArray();
                    kit.add(shapes.cylinder, material(palette.silver), at(.02), [.23, .08, .23], angles);
                    kit.add(shapes.cylinder, material(palette.silver), at(.20), [.055, .29, .055], angles, false);
                    kit.add(shapes.cylinder, material(palette.dark), at(.36), [.11, .055, .11], angles, false);
                    for (const offset of [-1, 1]) kit.box([origin[0] + offset * .17, origin[1] + normal[1] * .07, origin[2] + normal[2] * .07], [.085, .08, .13], palette.white);
                }
                bishopGrapple([rootX - 1.12, .99, 12], [0, 1, 0]);
                bishopGrapple([rootX - 1.05, 0, 10.99], [0, 0, -1]);
                // Folded EVA handrails, Wi-Fi antenna paddles and a short protected cable run.
                for (const side of [-1, 1]) {
                    const y = side * .76, z = 12.79;
                    kit.rod([rootX - .21, y, z], [rootX - .76, y, z], .025, palette.gold);
                    for (const d of [.21, .76]) kit.rod([rootX - d, y * .90, 12 + (z - 12) * .90], [rootX - d, y, z], .025, palette.gold);
                }
                for (const side of [-1, 1]) {
                    kit.box([rootX - 1.38, side * .46, 12.82], [.24, .23, .09], palette.white, [0, .28, 0]);
                    kit.box([rootX - 1.39, side * .46, 12.875], [.17, .15, .025], palette.silver, [0, .28, 0], false);
                }
                kit.rod([rootX - .19, .91, 12.51], [rootX - .94, .91, 12.51], .019, palette.dark);
                badge(kit, 'BISHOP', [rootX - .46, 1.155, 12], [.66, .20]);
            });
            part('poisk', 'Poisk / MRM-2 airlock', '22 / RUSSIAN AIRLOCK & RESEARCH', 'Poisk is attached to the space-facing port of Zvezda. Its rounded, blanket-covered body carries two side EVA hatches, exterior handrails and dish antennas. The outward docking end includes a recessed collar, central probe and perimeter fittings. Equipment placement and dimensions are illustrative.', [['Installed', '12 NOV 2009'], ['Length / diameter', '4.9 / 2.55 m']], [0, 3.9, 31], (kit, group) => {
                group.userData.attachment = 'Zvezda zenith';
                group.userData.evaHatches = 2;
                group.userData.referenceViews = 2;
                group.userData.reconstruction = '2026-09-30 supplied Poisk front and docking-end references';
                group.userData.interfaceCenter = [0, 1.30, 31];
                // All geometry remains in the original station frame. The probe points away from Zvezda.
                const silver = 0xb5bab7, white = 0xe0e2dc, dark = 0x434746, rail = 0xaaa791, ochre = 0xa77331;
                const metal = material(silver, .51, .55), hardware = material(0x7b8381, .58, .43);
                const profile = [[.73, 1.72], [.76, 1.91], [.91, 2.10], [1.045, 2.27], [1.065, 2.48], [1.065, 3.02], [1.105, 3.24], [1.20, 3.52], [1.273, 3.86], [1.275, 4.18], [1.24, 4.63], [1.14, 5.05], [.98, 5.40], [.78, 5.70]];
                function radiusAt(y) {
                    const i = Math.max(1, profile.findIndex(p => p[1] >= Math.min(y, 5.70))), a = profile[i - 1], b = profile[i];
                    const t = THREE.MathUtils.clamp((y - a[1]) / (b[1] - a[1]), 0, 1), s = t * t * (3 - 2 * t);
                    return a[0] + (b[0] - a[0]) * s;
                }
                const point = (a, y, lift = 0) => [Math.cos(a) * (radiusAt(y) + lift), y, 31 + Math.sin(a) * (radiusAt(y) + lift)];
                function pipe(points, r = .016, color = rail) {
                    kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(20, points.length * 5), r, 6, false), material(color, .66, .3), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                function arc(y, r, a0, a1, tube = .018, color = rail) {
                    pipe(Array.from({ length: 33 }, (_, i) => { const a = a0 + (a1 - a0) * i / 32; return [r * Math.cos(a), y, 31 + r * Math.sin(a)]; }), tube, color);
                }
                // Self-contained, deterministic crinkled MLI maps, scoped to Poisk materials.
                const clothCanvas = document.createElement('canvas'); clothCanvas.width = clothCanvas.height = 512;
                const ctx = clothCanvas.getContext('2d'), pixels = ctx.createImageData(512, 512);
                const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7 + 73.9) * 43758.5453; return v - Math.floor(v); };
                function noise(x, y, s) { const xx = x / s, yy = y / s, ix = Math.floor(xx), iy = Math.floor(yy), fx = xx - ix, fy = yy - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v); }
                for (let y = 0; y < 512; y++)for (let x = 0; x < 512; x++) {
                    const warp = noise(x, y, 45) * 22, n = noise(x + warp, y - warp, 11), crease = Math.pow(1 - Math.abs(n * 2 - 1), 12);
                    const value = 220 + (noise(x, y, 60) - .5) * 12 + (noise(x, y, 4) - .5) * 8 - crease * 27 + hash(x, y) * 3, i = (y * 512 + x) * 4;
                    pixels.data[i] = value; pixels.data[i + 1] = value + 2; pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
                }
                ctx.putImageData(pixels, 0, 0);
                for (let i = 0; i < 1450; i++) {
                    const x = hash(i, 11) * 512, y = hash(i, 19) * 512, len = 4 + hash(i, 29) * 20, a = hash(i, 41) * Math.PI * 2;
                    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a + .35) * len * .45, y + Math.sin(a + .35) * len * .45); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
                    ctx.strokeStyle = 'rgba(103,111,106,.18)'; ctx.lineWidth = .65; ctx.stroke();
                    ctx.translate(.8, .8); ctx.strokeStyle = 'rgba(255,255,250,.33)'; ctx.stroke(); ctx.translate(-.8, -.8);
                }
                const clothMap = new THREE.CanvasTexture(clothCanvas); clothMap.colorSpace = THREE.SRGBColorSpace; clothMap.wrapS = clothMap.wrapT = THREE.RepeatWrapping; clothMap.repeat.set(3, 2); clothMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
                const bumpMap = clothMap.clone(); bumpMap.colorSpace = THREE.NoColorSpace; bumpMap.needsUpdate = true;
                const blanket = new THREE.MeshStandardMaterial({ color: 0xf3f4ed, map: clothMap, bumpMap, bumpScale: .030, roughness: .89, metalness: .13 });
                const panel = blanket.clone(); panel.map = clothMap.clone(); panel.map.repeat.set(.65, .65); panel.map.needsUpdate = true; panel.bumpMap = bumpMap.clone(); panel.bumpMap.repeat.set(.65, .65); panel.bumpMap.needsUpdate = true; panel.bumpScale = .014;
                const pos = [], uv = [], idx = [], around = 128, along = 104;
                for (let j = 0; j <= along; j++)for (let i = 0; i <= around; i++) {
                    const t = j / along, y = 1.72 + (5.70 - 1.72) * t, a = i / around * Math.PI * 2;
                    const wrinkle = (.006 * Math.sin(a * 37 + Math.sin(t * 22) * 2) + .003 * Math.sin(a * 61 - t * 33)) * Math.sin(Math.PI * t);
                    const r = radiusAt(y) + wrinkle; pos.push(Math.cos(a) * r, y, 31 + Math.sin(a) * r); uv.push(i / around, t);
                }
                for (let j = 0; j < along; j++)for (let i = 0; i < around; i++) { const a = j * (around + 1) + i, b = a + around + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
                const shell = new THREE.BufferGeometry(); shell.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); shell.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); shell.setIndex(idx); shell.computeVertexNormals();
                const normals = shell.attributes.normal;
                for (let j = 0; j <= along; j++) { const a = j * (around + 1), b = a + around, n = new THREE.Vector3().fromBufferAttribute(normals, a).add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize(); normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(b, n.x, n.y, n.z); }
                kit.add(shell, blanket, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                // Broad docking flange seats directly on the matching Zvezda zenith flange at y = 1.30.
                kit.cylinder([0, 1.335, 31], .90, .07, silver, [0, 0, 0]);
                kit.cylinder([0, 1.565, 31], .78, .39, silver, [0, 0, 0]);
                ring(kit, [0, 1.365, 31], .896, 'y', white, .014);
                group.userData.serviceModuleFace = {axis: 'y', coordinate: 1.30, radius: .90};
                kit.add(new THREE.CylinderGeometry(.765, .765, .26, 64), panel, [0, 1.77, 31], [1, 1, 1], [0, 0, 0], false);
                for (const y of [1.655, 1.895]) ring(kit, [0, y, 31], .775, 'y', silver, .021);
                // Sparse stitched blanket boundaries; no rigid tile grid over the pressure hull.
                for (const y of [2.17, 3.13, 4.62, 5.53]) arc(y, radiusAt(y) + .009, 0, Math.PI * 2, .008, 0xc4c8c1);
                for (const a of [.45, 1.72, 2.55, 3.96, 5.22]) pipe(profile.map(([, y]) => point(a, y, .012)), .006, 0xbcc1b9);
                // A local tangent frame: +v follows the upside-down elevation reference, +w faces outwards.
                function frame(a, y, r = radiusAt(y)) {
                    const n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), u = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), v = new THREE.Vector3(0, -1, 0);
                    const m = new THREE.Matrix4().makeBasis(u, v, n), rot = new THREE.Euler().setFromRotationMatrix(m);
                    const base = new THREE.Vector3(Math.cos(a) * r, y, 31 + Math.sin(a) * r);
                    return { p: (x, z, w = 0) => base.clone().addScaledVector(u, x).addScaledVector(v, z).addScaledVector(n, w).toArray(), rot: [rot.x, rot.y, rot.z] };
                }
                function localBox(f, p, size, surface = metal) { kit.add(shapes.box, surface, f.p(...p), size, f.rot, false); }
                function localDisc(f, p, r, depth, surface) { const g = new THREE.CylinderGeometry(r, r, depth, 64).rotateX(Math.PI / 2); kit.add(g, surface, f.p(...p), [1, 1, 1], f.rot, false); }
                function localRing(f, p, r, tube, surface = metal) { kit.add(new THREE.TorusGeometry(r, tube, 8, 72), surface, f.p(...p), [1, 1, 1], f.rot, false); }
                function label(f, text, p, w, h, color = '#bb892e', turn = 0) {
                    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128; const c = canvas.getContext('2d'); c.font = '600 100px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color; c.translate(256, 66); c.scale(472 / Math.max(1, c.measureText(text).width), 1); c.fillText(text, 0, 0);
                    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
                    const ink = new THREE.MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, roughness: .95, polygonOffset: true, polygonOffsetFactor: -2 }); ink.userData.decal = true; kit.add(new THREE.PlaneGeometry(w, h).rotateZ(turn), ink, f.p(...p), [1, 1, 1], f.rot, false);
                }
                for (const [a, name] of [[Math.PI, 'ВЛ2'], [0, 'ВЛ1']]) {
                    const f = frame(a, 3.91, 1.238);
                    localDisc(f, [0, 0, .025], .566, .10, hardware); localRing(f, [0, 0, .084], .554, .019, metal);
                    localDisc(f, [0, 0, .087], .529, .026, panel);
                    // Centered pale inspection cover as visible in the reference, with concentric inset rings.
                    localDisc(f, [0, 0, .109], .171, .018, metal); localDisc(f, [0, 0, .121], .142, .013, material(0xc4c8c4, .83, .09));
                    localRing(f, [0, 0, .127], .147, .012, material(0x909794, .8, .18));
                    for (const x of [-.59, .59]) {
                        for (const v of [-.17, .17]) localBox(f, [x, v, .075], [.08, .055, .09]);
                        kit.rod(f.p(x, -.17, .13), f.p(x, .17, .13), .018, silver);
                    }
                    for (const v of [-.31, .31]) { kit.rod(f.p(-.085, v, .14), f.p(.085, v, .14), .016, silver); for (const x of [-.085, .085]) kit.rod(f.p(x, v, .11), f.p(x, v, .14), .013, silver); }
                    for (const sign of [-1, 1]) {
                        const pts = Array.from({ length: 21 }, (_, i) => { const t = (28 + i * 6.2) * Math.PI / 180; return f.p(.64 * Math.cos(t), sign * .64 * Math.sin(t), .11); }); pipe(pts, .018, rail);
                        for (const x of [-.33, .33]) kit.rod(f.p(x, sign * .49, .03), f.p(x, sign * .555, .115), .018, silver);
                    }
                    label(f, name, [-.34, 0, .13], .37, .145, '#be8626', Math.PI / 2);
                }
                // Reference-facing rectangular patches and round equipment covers.
                const front = frame(Math.PI, 3.91, 1.238), neck = frame(Math.PI, 2.72, 1.062);
                localBox(neck, [.30, 0, .02], [.72, .84, .055], hardware); localBox(neck, [.30, 0, .056], [.686, .802, .028], panel);
                localDisc(neck, [-.44, .07, .020], .235, .050, material(0x575c59, .88, .10)); localRing(neck, [-.44, .07, .049], .228, .012, hardware);
                for (const [a, y, r] of [[Math.PI + .70, 3.70, .26], [Math.PI - .70, 3.98, .23], [.78, 4.36, .18], [4.79, 3.42, .16]]) { const f = frame(a, y, radiusAt(y) - .015); localDisc(f, [0, 0, .026], r, .07, panel); localRing(f, [0, 0, .06], r - .01, .008, material(0xc4c8c2, .8, .18)); }
                const lower = frame(Math.PI, 4.94, radiusAt(4.94)); localBox(lower, [-.35, 0, .035], [1.07, .26, .055], hardware); localBox(lower, [-.35, 0, .069], [1.04, .225, .018], panel);
                const heel = frame(Math.PI, 5.44, radiusAt(5.44)); localBox(heel, [0, 0, .02], [.48, .22, .045], panel);
                // Slim stand-off rails around three belts, supported by discrete attachment feet.
                for (const [y, r] of [[2.03, .98], [3.14, 1.27], [4.67, 1.40]]) {
                    arc(y, r, 0, Math.PI * 2, .016, rail);
                    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; kit.rod(point(a, y, .005), [Math.cos(a) * r, y, 31 + Math.sin(a) * r], .018, silver); }
                }
                // Curving perimeter cables and triangular blanket brackets, visible in both references.
                for (const a of [Math.PI / 2 - .13, Math.PI / 2 + .13, Math.PI * 1.5 - .13, Math.PI * 1.5 + .13]) {
                    const cable = [point(a, 4.66, .11), point(a, 4.95, .34), point(a, 5.35, .29), point(a, 5.65, .10)]; pipe(cable, .012, rail);
                }
                function fin(a, y, extent = .40) {
                    const f = frame(a, y, radiusAt(y) - .02), g = new THREE.BufferGeometry();
                    const vertices = [...f.p(-.13, -.22, 0), ...f.p(.13, -.22, 0), ...f.p(.13, .16, extent), ...f.p(-.13, .16, extent)];
                    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); const foil = panel.clone(); foil.side = THREE.DoubleSide; kit.add(g, foil, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                    kit.rod(f.p(-.13, .16, extent), f.p(.13, .16, extent), .018, silver); kit.rod(f.p(0, -.22, .02), f.p(0, .16, extent), .020, silver);
                }
                for (const a of [Math.PI / 2, Math.PI * 1.5]) fin(a, 4.64, .36);
                for (const a of [.55, 2.1, 3.8, 5.4]) fin(a, 5.36, .25);
                // Exposed docking ring: ochre recessed bowl, large central probe and radial spring fingers.
                const twoMetal = metal.clone(); twoMetal.side = THREE.DoubleSide;
                kit.add(new THREE.CylinderGeometry(.79, .78, .20, 72, 1, true), panel, [0, 5.72, 31], [1, 1, 1], [0, 0, 0], false);
                kit.add(new THREE.RingGeometry(.555, .80, 80).rotateX(-Math.PI / 2), twoMetal, [0, 5.83, 31], [1, 1, 1], [0, 0, 0], false);
                ring(kit, [0, 5.83, 31], .79, 'y', silver, .024);
                const bowl = new THREE.LatheGeometry([[.22, 5.49], [.32, 5.50], [.46, 5.60], [.56, 5.80], [.555, 5.835]].map(p => new THREE.Vector2(...p)), 80);
                const bowlMat = material(ochre, .71, .34).clone(); bowlMat.side = THREE.DoubleSide; kit.add(bowl, bowlMat, [0, 0, 31], [1, 1, 1], [0, 0, 0], false);
                kit.cylinder([0, 5.50, 31], .25, .035, dark, [0, 0, 0]);
                const probeProfile = [[.19, 5.49], [.29, 5.59], [.315, 5.74], [.27, 5.93], [.21, 6.04], [.18, 6.06], [.155, 6.20], [.113, 6.235], [.107, 6.29], [.077, 6.35], [.025, 6.385], [0, 6.39]];
                kit.add(new THREE.LatheGeometry(probeProfile.map(p => new THREE.Vector2(...p)), 64), material(dark, .63, .40), [0, 0, 31], [1, 1, 1], [0, 0, 0], false);
                ring(kit, [0, 6.235, 31], .11, 'y', silver, .014);
                for (let i = 0; i < 12; i++) {
                    const a = i * Math.PI / 6, n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), t = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), vertices = [];
                    for (const [r, y, w] of [[.185, 6.045, -.035], [.185, 6.045, .035], [.365, 5.81, .047], [.365, 5.81, -.047]]) vertices.push(n.x * r + t.x * w, y, 31 + n.z * r + t.z * w);
                    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); const finger = material(0x747b78, .59, .48).clone(); finger.side = THREE.DoubleSide; kit.add(g, finger, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                for (let i = 0; i < 10; i++) {
                    const a = i * Math.PI / 5, r = .682, p = [Math.cos(a) * r, 5.865, 31 + Math.sin(a) * r];
                    kit.box(p, [.095, .048, .22], silver, [0, -a, 0], false);
                    kit.box([p[0], 5.894, p[2]], [.044, .018, .168], 0x6e7673, [0, -a, 0], false);
                    const b = a + .21; kit.cylinder([Math.cos(b) * .766, 5.904, 31 + Math.sin(b) * .766], .025, .125, silver, [0, 0, 0]);
                    kit.cylinder([Math.cos(b) * .766, 5.969, 31 + Math.sin(b) * .766], .017, .011, dark, [0, 0, 0]);
                }
                // The neck-end dish, lateral dish and compact aerials reproduce the reference silhouettes.
                function dish(center, normal, radius, gold = false) {
                    const n = new THREE.Vector3(...normal).normalize(), q = new THREE.Quaternion().setFromUnitVectors(vertical, n);
                    const dishProfile = [[0, 0], [radius * .28, .004], [radius * .55, .018], [radius * .78, .050], [radius, .10 * radius / .35]];
                    const g = new THREE.LatheGeometry(dishProfile.map(p => new THREE.Vector2(...p)), 64).applyQuaternion(q);
                    const surface = material(gold ? 0xb9a16b : 0xc6cbc6, .61, gold ? .35 : .47).clone(); surface.side = THREE.DoubleSide;
                    kit.add(g, surface, center, [1, 1, 1], [0, 0, 0], false);
                    const rimDepth = .10 * radius / .35, tip = new THREE.Vector3(...center).addScaledVector(n, rimDepth + .06);
                    const ringGeom = new THREE.TorusGeometry(radius, .014, 8, 64).rotateX(Math.PI / 2).applyQuaternion(q);
                    kit.add(ringGeom, metal, new THREE.Vector3(...center).addScaledVector(n, rimDepth).toArray(), [1, 1, 1], [0, 0, 0], false);
                    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; const end = new THREE.Vector3(Math.cos(a) * radius, rimDepth, Math.sin(a) * radius).applyQuaternion(q).add(new THREE.Vector3(...center)); kit.rod(end.toArray(), tip.toArray(), .008, silver); }
                    kit.rod(center, tip.toArray(), .016, silver);
                }
                const crown = frame(Math.PI, 1.67, .81);
                for (const x of [-.14, .14]) kit.rod(crown.p(x, -.47, -.05), crown.p(x, 0, .15), .024, silver);
                dish(crown.p(0, .02, .19), [-1, 0, 0], .285, true);
                const sideDish = frame(Math.PI * 1.53, 4.88, radiusAt(4.88));
                kit.rod(sideDish.p(0, 0, 0), sideDish.p(.13, -.45, .73), .029, silver);
                dish(sideDish.p(.13, -.45, .73), [-.45, .30, -.84], .36);
                const aftDish = frame(.67, 5.18, radiusAt(5.18));
                kit.rod(aftDish.p(0, 0, 0), aftDish.p(0, .08, .40), .027, silver);
                dish(aftDish.p(0, .08, .40), [.67, .22, .71], .26);
                for (const a of [Math.PI * .52, Math.PI * 1.48]) {
                    const f = frame(a, 2.35, radiusAt(2.35));
                    localBox(f, [0, 0, .07], [.17, .15, .17]); kit.rod(f.p(0, 0, .12), f.p(0, .09, .84), .015, silver);
                    const end = f.p(0, .09, .84); kit.cylinder(end, .075, .10, white, [0, 0, 0]);
                    if (a < Math.PI) { kit.rod(f.p(0, .05, .84), f.p(0, .43, .84), .010, silver); kit.rod(f.p(-.13, .08, .84), f.p(.13, .08, .84), .010, silver); }
                    else { dish([end[0], end[1] - .055, end[2]], [0, -1, 0], .11); }
                }
                for (const a of [Math.PI * .68, Math.PI * 1.25]) {
                    const f = frame(a, 5.15, radiusAt(5.15)); localDisc(f, [0, 0, .09], .14, .025, metal); kit.rod(f.p(0, 0, .10), f.p(0, .025, .36), .040, white); localDisc(f, [0, .025, .37], .047, .04, metal);
                }
                // Narrow longitudinal strap on the lower reference face, with a metal end tab.
                const strap = []; for (let i = 0; i <= 18; i++) { const y = 4.66 + i * .061; strap.push(point(Math.PI - .31, y, .07)); } pipe(strap, .018, rail);
                for (const y of [4.66, 5.75]) { const f = frame(Math.PI - .31, y, radiusAt(Math.min(y, 5.7)) + .04); localBox(f, [0, 0, 0], [.09, .16, .033]); }
                const marks = frame(4.62, 4.25, radiusAt(4.25) + .025);
                label(marks, 'ПОИСК', [0, .05, .03], .72, .19, '#b88524');
                const flagCanvas = document.createElement('canvas'); flagCanvas.width = 384; flagCanvas.height = 128;
                const fc = flagCanvas.getContext('2d'); fc.fillStyle = '#e7e9e5'; fc.fillRect(0, 0, 384, 128);
                fc.fillStyle = '#f7f7f4'; fc.fillRect(135, 18, 115, 30); fc.fillStyle = '#2e4a9a'; fc.fillRect(135, 48, 115, 30); fc.fillStyle = '#af3938'; fc.fillRect(135, 78, 115, 30);
                fc.fillStyle = '#c43e39'; fc.beginPath(); fc.arc(323, 48, 24, 0, Math.PI * 2); fc.fill(); fc.fillStyle = '#34424b'; fc.font = 'italic 16px sans-serif'; fc.fillText('ЭНЕРГИЯ', 272, 103);
                fc.strokeStyle = '#626d77'; fc.lineWidth = 5; fc.beginPath(); fc.ellipse(58, 60, 31, 16, -.5, 0, Math.PI * 2); fc.stroke(); fc.fillStyle = '#ad3638'; fc.fillRect(48, 27, 8, 45);
                const flagMap = new THREE.CanvasTexture(flagCanvas); flagMap.colorSpace = THREE.SRGBColorSpace;
                const flagMat = new THREE.MeshStandardMaterial({ map: flagMap, roughness: .88, metalness: 0 }); flagMat.userData.decal = true;
                kit.add(new THREE.PlaneGeometry(.98, .30), flagMat, marks.p(0, -.50, .02), [1, 1, 1], marks.rot, false);
                group.userData.referenceFeatures = { roundedBlanketHull: true, centeredHatchInsets: 2, ochreDockingBowl: true, radialProbeFingers: 12, dockingLatches: 10, largeDishes: 3 };
            });

            // Apply independent copies of Poisk's MLI finish to Nauka's insulated surfaces.
            {
                let referenceSkin;
                parts.get('poisk').group.traverse(object => {
                    const m = object.material;
                    if (!referenceSkin && m?.map && m?.bumpMap && Math.abs(m.bumpScale - .030) < 1e-8 && Math.abs(m.roughness - .89) < 1e-8) referenceSkin = m;
                });
                if (!referenceSkin) throw new Error('Poisk blanket finish is unavailable');
                const scales = { lab: [5, 4], adapter: [3.5, 2], airlock: [2.4, 1.4], cover: [.65, .65] };
                for (const id of ['nauka', 'prichal']) {
                    const variants = new Map();
                    parts.get(id).group.traverse(object => {
                        const kind = object.material?.userData?.poiskSkin; if (!kind) return;
                        if (!variants.has(kind)) {
                            const skin = referenceSkin.clone(); skin.name = 'Poisk MLI / ' + id + ' / ' + kind;
                            skin.map = referenceSkin.map.clone(); skin.map.repeat.set(...scales[kind]); skin.map.needsUpdate = true;
                            skin.bumpMap = referenceSkin.bumpMap.clone(); skin.bumpMap.repeat.set(...scales[kind]); skin.bumpMap.needsUpdate = true;
                            if (kind === 'cover') skin.bumpScale = .014;
                            skin.userData = { ...skin.userData, poiskSkin: kind, skinReference: 'Poisk / MRM-2' };
                            variants.set(kind, skin);
                        }
                        object.material = variants.get(kind);
                    });
                    parts.get(id).group.userData.skinReference = 'Poisk / MRM-2';
                }
            }
            part('rassvet', 'Rassvet / MRM-1', '23 / RUSSIAN DOCKING & STORAGE', 'Rassvet extends below Zarya. This reference configuration shows the blanket-covered module carrying its transverse experiment airlock, stowed radiator and external support frame. The external payload arrangement follows the supplied reference views.', [['Installed', '18 MAY 2010'], ['Reference configuration', 'AIRLOCK & RADIATOR STOWED']], [0, -3.9, 17.8], (kit, group) => {
                group.position.y = .45;
                group.userData.attachment = 'Zarya nadir'; group.userData.dockingPorts = 2;
                group.userData.interfaceCenter = [0, -1.40, 17.8];
                group.userData.reconstruction = '2026-09-30 four supplied Rassvet reference views';
                group.userData.externalOutfitting = 'Reference configuration with transverse airlock and stowed radiator';
                group.userData.skinReference = 'Poisk / MRM-2';
                const silver = 0xb7bdb8, rail = 0x999f95, dark = 0x353c3b, white = 0xf1f2ec, red = 0xd64724;
                const metal = material(silver, .60, .40), paint = material(white, .81, .12);
                let poiskSkin;
                parts.get('poisk').group.traverse(o => { const m = o.material; if (!poiskSkin && m?.map && m?.bumpMap && Math.abs(m.bumpScale - .030) < 1e-8 && Math.abs(m.roughness - .89) < 1e-8) poiskSkin = m; });
                if (!poiskSkin) throw new Error('Poisk blanket finish is unavailable for Rassvet');
                function skin(name, repeat, bump = .03) {
                    const m = poiskSkin.clone(); m.name = 'Poisk MLI / rassvet / ' + name;
                    m.map = poiskSkin.map.clone(); m.map.repeat.set(...repeat); m.map.needsUpdate = true;
                    m.bumpMap = poiskSkin.bumpMap.clone(); m.bumpMap.repeat.set(...repeat); m.bumpMap.needsUpdate = true;
                    m.bumpScale = bump; m.userData = { skinReference: 'Poisk / MRM-2', poiskSkin: name }; return m;
                }
                const blanket = skin('hull', [3.2, 3]), patch = skin('patch', [.65, .65], .014), airlockSkin = skin('airlock', [1.5, 1.1], .014);
                const goldSkin = skin('gold-cover', [1.2, 1.2], .025); goldSkin.color.setHex(0xd99735); goldSkin.roughness = .77; goldSkin.metalness = .30;
                const profile = [[.72, -7.02], [.79, -6.84], [1.02, -6.50], [1.15, -6.20], [1.175, -5.98], [1.175, -2.75], [1.12, -2.43], [.93, -2.06], [.74, -1.80], [.70, -1.71]];
                function radiusAt(y) { let i = profile.findIndex(p => p[1] >= y); i = Math.max(1, i < 0 ? profile.length - 1 : i); const a = profile[i - 1], b = profile[i], t = THREE.MathUtils.clamp((y - a[1]) / (b[1] - a[1]), 0, 1); return a[0] + (b[0] - a[0]) * t * t * (3 - 2 * t); }
                const point = (a, y, lift = 0) => [Math.cos(a) * (radiusAt(y) + lift), y, 17.8 + Math.sin(a) * (radiusAt(y) + lift)];
                function pipe(points, r = .013, color = rail) { kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(20, points.length * 5), r, 7, false), material(color, .74, .26), [0, 0, 0], [1, 1, 1], [0, 0, 0], false); }
                function arc(y, lift = 0, r = .01, color = rail, a0 = 0, a1 = Math.PI * 2) { pipe(Array.from({ length: 65 }, (_, i) => point(a0 + (a1 - a0) * i / 64, y, lift)), r, color); }
                function frame(a, y, lift = 0) { const n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), u = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)), v = new THREE.Vector3(0, 1, 0), rot = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n)), base = new THREE.Vector3(...point(a, y, lift)); return { p: (x, dy, d = 0) => base.clone().addScaledVector(u, x).addScaledVector(v, dy).addScaledVector(n, d).toArray(), rot: [rot.x, rot.y, rot.z] }; }
                const box = (f, p, size, surface = metal) => kit.add(shapes.box, surface, f.p(...p), size, f.rot, false);
                const disc = (f, p, r, depth, surface = metal) => kit.add(new THREE.CylinderGeometry(r, r, depth, 56).rotateX(Math.PI / 2), surface, f.p(...p), [1, 1, 1], f.rot, false);
                const hoop = (f, p, r, t = .014, surface = metal) => kit.add(new THREE.TorusGeometry(r, t, 8, 64), surface, f.p(...p), [1, 1, 1], f.rot, false);
                // Continuous rounded pressure hull, with the same crinkled blanket maps as Poisk.
                const pos = [], uv = [], idx = [], around = 128, along = 112;
                for (let j = 0; j <= along; j++)for (let i = 0; i <= around; i++) {
                    const t = j / along, y = -7.02 + 5.31 * t, a = i / around * Math.PI * 2, r = radiusAt(y) + (.0045 * Math.sin(a * 39 + Math.sin(t * 28)) + .0025 * Math.sin(a * 71 - t * 31)) * Math.sin(Math.PI * t);
                    pos.push(Math.cos(a) * r, y, 17.8 + Math.sin(a) * r); uv.push(i / around, t);
                }
                for (let j = 0; j < along; j++)for (let i = 0; i < around; i++) { const a = j * (around + 1) + i, b = a + around + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
                const shell = new THREE.BufferGeometry(); shell.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); shell.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); shell.setIndex(idx); shell.computeVertexNormals();
                const normals = shell.attributes.normal; for (let j = 0; j <= along; j++) { const a = j * (around + 1), b = a + around, n = new THREE.Vector3().fromBufferAttribute(normals, a).add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize(); normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(b, n.x, n.y, n.z); }
                kit.add(shell, blanket, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                for (const [y, r] of [[-7.01, .72], [-1.72, .70]]) kit.add(new THREE.SphereGeometry(1, 48, 24), patch, [0, y, 17.8], [r, .095, r], [0, 0, 0], false);
                // Mirror the measured Rassvet ring into the fixed body datum; its face meets Zarya at y=-.93.
                const receiverScale=.76/.66023, dockingFace=-.93-group.position.y;
                const cuffProfile=[[3.131308,.66023],[3.19177,.684758],[3.24550,.684758],[3.32364,.66757],[3.392018,.62374],
                    [3.392018,.45189],[3.131308,.5200]].map(([y,r])=>[dockingFace+y-3.392018,r*receiverScale]);
                russianDockingBand(kit,cuffProfile,'y',[0,0,17.8]);
                const cuffBase=dockingFace+3.131308-3.392018;
                russianDockingBand(kit,[[-1.77,.735],[-1.68,.75],[cuffBase,.76],[cuffBase,.598],[-1.77,.598]],'y',[0,0,17.8]);
                kit.add(new THREE.CylinderGeometry(.758,.758,.25,64),patch,[0,-1.68,17.8],[1,1,1],[0,0,0],false);
                kit.cylinder([0,dockingFace-.01,17.8],.518,.014,dark,[0,0,0]);
                group.userData.interfaceCenter=[0,dockingFace,17.8];
                group.userData.referenceDockingJoints={source:'ISS_stationary.glb / node 23',localFace:dockingFace,stationFace:-.93,faceRadius:.62374*receiverScale,outerRadius:.684758*receiverScale};
                kit.add(new THREE.LatheGeometry([[.17, -1.48], [.20, -1.35], [.12, -1.23], [.07, -1.14], [0, -1.11]].map(p => new THREE.Vector2(...p)), 48), material(dark, .64, .35), [0, 0, 17.8], [1, 1, 1], [0, 0, 0], false);
                const doubleMetal = metal.clone(); doubleMetal.side = THREE.DoubleSide;
                kit.add(new THREE.CylinderGeometry(.76, .76, .32, 64, 1, true), doubleMetal, [0, -7.16, 17.8], [1, 1, 1], [0, 0, 0], false);
                kit.add(new THREE.CylinderGeometry(.769, .769, .23, 64, 1, true), patch, [0, -7.12, 17.8], [1, 1, 1], [0, 0, 0], false);
                kit.cylinder([0, -7.19, 17.8], .60, .02, dark, [0, 0, 0]); ring(kit, [0, -7.345, 17.8], .78, 'y', white, .045); ring(kit, [0, -7.39, 17.8], .64, 'y', silver, .028);
                for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; kit.box([Math.cos(a) * .75, -7.35, 17.8 + Math.sin(a) * .75], [.09, .085, .14], silver, [0, -a, 0], false); }
                // Sparse blanket joints and exterior belt handrails leave broad soft insulated surfaces.
                for (const y of [-2.08, -2.74, -5.98, -6.68]) arc(y, .008, .0065, 0xbcc2b8);
                for (const a of [.45, 1.55, 2.62, 3.65, 4.65, 5.56]) pipe(profile.map(([, y]) => point(a, y, .008)), .006, 0xbcc2b8);
                for (const y of [-2.77, -3.58, -5.40, -6.35]) {
                    arc(y, .055, .012, 0xb3a17a, -.12, Math.PI + .12);
                    for (const a of [.1, 1.12, 2.05, 3.04]) kit.rod(point(a, y, .015), point(a, y, .065), .014, silver);
                }
                for (const a of [.37, 2.77]) pipe([point(a, -1.92, .04), point(a, -2.18, .15), point(a, -2.71, .14), point(a, -3.0, .05)], .015, rail);
                // Side faces have long white equipment blankets, handrails and diagonal carriers.
                for (const side of [-1, 1]) {
                    const sideAngle = side === 1 ? 0 : Math.PI;
                    for (const u of [-.60, .49, .81]) { const f = frame(sideAngle - u / 1.175, -4.56, .015); box(f, [0, .10, .045], [.28, 1.76, .09], patch); box(f, [0, .10, .096], [.26, 1.74, .02], paint); }
                    for (const y of [-2.42, -3.3, -5.85, -6.51]) {
                        const h = frame(side === 1 ? 0 : Math.PI, y, .03); for (const u of [-.42, .42]) box(h, [u, 0, .07], [.08, .095, .13]);
                        kit.rod(h.p(-.42, 0, .14), h.p(.42, 0, .14), .018, silver);
                    }
                    kit.rod([side * 1.22, -3.48, 16.82], [side * 1.22, -5.02, 17.63], .033, silver);
                    for (const t of [.18, .55, .85]) { const y = -3.48 - 1.54 * t, z = 16.82 + .81 * t; kit.box([side * 1.22, y, z], [.14, .15, .12], silver, [.47, 0, 0], false); }
                }
                // The airlock sits crosswise on the forward face: one gold cover and one white domed end.
                const airlockCenter = [0, -2.82, 15.83], airlockLength = 2.22, airlockRadius = .64;
                const airlockGroup = new THREE.Group(); airlockGroup.name = 'Rassvet transverse stowed experiment airlock'; group.add(airlockGroup);
                const ak = new Kit();
                ak.add(new THREE.CylinderGeometry(airlockRadius, airlockRadius, airlockLength, 72), airlockSkin, airlockCenter, [1, 1, 1], [0, 0, Math.PI / 2], false);
                for (const x of [-1.075, 1.075]) {
                    ak.cylinder([x, -2.82, 15.83], .662, .058, silver, [0, 0, Math.PI / 2]); ring(ak, [x, -2.82, 15.83], .672, 'x', dark, .016);
                    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ak.box([x, -2.82 + Math.cos(a) * .70, 15.83 + Math.sin(a) * .70], [.07, .13, .075], silver, [a, 0, 0], false); }
                }
                ak.add(new THREE.SphereGeometry(1, 64, 40), goldSkin, [-1.13, -2.82, 15.83], [.20, .627, .627], [0, 0, 0], false);
                ak.add(new THREE.SphereGeometry(1, 64, 40), paint, [1.13, -2.82, 15.83], [.21, .627, .627], [0, 0, 0], false);
                ring(ak, [-1.135, -2.82, 15.83], .618, 'x', 0xb68134, .022); ring(ak, [1.135, -2.82, 15.83], .618, 'x', silver, .024);
                // Small front panel, black connector row and top fittings visible in the broad elevation.
                ak.box([.61, -2.88, 15.18], [.47, .23, .035], 0xc4d0cb, [0, 0, 0], false);
                ak.box([-.59, -2.53, 15.24], [.55, .26, .085], dark, [0, 0, 0], false);
                for (let i = 0; i < 5; i++) { ak.box([-.37 - i * .105, -2.53, 15.192], [.054, .18, .020], white, [0, 0, 0], false); for (const y of [-2.59, -2.47]) ak.cylinder([-.37 - i * .105, y, 15.173], .011, .012, dark); }
                ak.cylinder([.02, -2.11, 15.83], .14, .24, 0xb0803e, [0, 0, 0]); ak.cylinder([.02, -1.987, 15.83], .19, .04, silver, [0, 0, 0]);
                ak.cylinder([.70, -2.08, 15.83], .055, .25, silver, [0, 0, 0]);
                ak.cylinder([0, -3.00, 15.19], .14, .12, silver);
                ak.cylinder([0, -3.00, 15.14], .18, .055, 0xaa9a68); ring(ak, [0, -3.00, 15.105], .174, 'z', silver, .012);
                for (const a of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) ak.rod([0, -3, 15.08], [Math.cos(a) * .16, -3 + Math.sin(a) * .16, 15.08], .012, silver);
                ak.finish(airlockGroup);
                // Open saddle rails support the airlock from the cylindrical hull; no floating end discs.
                for (const x of [-.92, .92]) {
                    const zTop = 17.8 - Math.sqrt(radiusAt(-2.27) ** 2 - x * x), zBottom = 17.8 - Math.sqrt(radiusAt(-3.38) ** 2 - x * x);
                    for (const [y, zHull] of [[-2.27, zTop], [-3.38, zBottom]]) { kit.rod([x, y, zHull + .025], [x, y, 15.88], .030, silver); kit.box([x, y, zHull], [.16, .16, .12], silver, [0, 0, 0], false); }
                    kit.rod([x, -2.27, 15.88], [x, -3.38, 15.88], .027, silver);
                    kit.rod([x, -2.27, zTop], [x, -3.38, 15.88], .027, silver);
                    kit.rod([x, -3.38, zBottom], [x, -2.27, 15.88], .027, silver);
                }
                // Two wide transverse carrier bars end in four red circular plates, seen edge-on from the front.
                const carrierGroup = new THREE.Group(); carrierGroup.name = 'Rassvet radiator stowage frame'; group.add(carrierGroup); const rk = new Kit();
                for (const y of [-3.68, -6.46]) {
                    // Dog-leg center section clears the front skin while the red beam ends sit closer to the body.
                    rk.rod([-.66, y, 16.48], [.66, y, 16.48], .048, silver);
                    for (const side of [-1, 1]) { rk.rod([side * .66, y, 16.48], [side * .90, y, 16.84], .048, silver); rk.rod([side * .90, y, 16.84], [side * 1.94, y, 16.84], .048, silver); }
                    for (const side of [-1, 1]) {
                        rk.cylinder([side * 1.96, y, 16.84], .275, .050, red, [0, 0, Math.PI / 2]);
                        rk.cylinder([side * 2.015, y, 16.84], .057, .16, silver, [0, 0, Math.PI / 2]);
                        for (const a of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) rk.cylinder([side * 1.991, y + Math.cos(a) * .17, 16.84 + Math.sin(a) * .17], .023, .012, dark, [0, 0, Math.PI / 2]);
                        const anchor = [side * .89, y, 17.8 - Math.sqrt(radiusAt(y) ** 2 - .89 ** 2)];
                        rk.rod(anchor, [side * 1.80, y, 16.84], .040, silver); rk.box(anchor, [.20, .20, .15], silver, [0, 0, 0], false);
                    }
                }
                for (const side of [-1, 1]) {
                    rk.rod([side * 1.85, -3.68, 16.84], [side * 1.37, -4.31, 16.27], .032, silver);
                    rk.rod([side * 1.85, -6.46, 16.84], [side * 1.37, -5.70, 16.27], .032, silver);
                    rk.rod([side * .86, -6.13, 17.00], [side * 1.34, -5.79, 16.32], .034, silver);
                    for (const z of [16.19, 16.31, 16.43]) {
                        rk.rod([side * 1.39, -3.95, z], [side * 1.39, -5.86, z], .022, silver);
                        for (const y of [-3.95, -5.86]) rk.rod([side * 1.30, y, z], [side * 1.39, y, z], .022, silver);
                    }
                    for (const y of [-3.95, -5.86]) rk.rod([side * 1.39, y, 16.19], [side * 1.39, y, 16.43], .025, silver);
                }
                // A single broad white radiator in the front view; three close parallel edges appear in side views.
                const radiatorCenter = [0, -4.86, 16.25], radiatorSize = [2.72, 2.10, .075];
                rk.box(radiatorCenter, radiatorSize, white, [0, 0, 0], false);
                for (const x of [-1.367, 1.367]) rk.box([x, -4.86, 16.26], [.027, 2.14, .096], silver, [0, 0, 0], false);
                for (const y of [-3.802, -5.918]) rk.box([0, y, 16.26], [2.76, .027, .096], silver, [0, 0, 0], false);
                for (const x of [-1.30, 1.30]) for (const y of [-3.88, -4.54, -5.18, -5.84]) rk.cylinder([x, y, 16.20], .017, .012, silver);
                for (const x of [-.97, .97]) for (const y of [-3.94, -5.78]) rk.box([x, y, 16.19], [.037, .28, .045], silver, [0, 0, 0], false);
                rk.finish(carrierGroup);
                // Lower oblique equipment bracket and antenna are distinctive in the two side views.
                const a = -.47, f = frame(a, -6.28, .04), base = f.p(0, 0, .02), tip = f.p(0, -.45, .64);
                kit.rod(base, tip, .034, silver); kit.rod(f.p(.18, .03, .02), f.p(.18, -.45, .64), .023, silver);
                box(f, [.09, -.35, .52], [.28, .46, .10], material(dark)); box(f, [.09, -.62, .81], [.40, .20, .07], paint);
                for (const u of [0, .18]) kit.rod(f.p(u, -.35, .52), f.p(u, -.62, .81), .024, silver);
                const antenna = [1.05, -6.98, 16.60]; kit.rod([.55, -6.64, 16.98], antenna, .023, silver); kit.cylinder(antenna, .073, .10, silver, [0, 0, 0]);
                kit.rod([1.05, -6.98, 16.60], [1.05, -7.17, 16.60], .012, silver); kit.rod([.89, -7.08, 16.60], [1.21, -7.08, 16.60], .012, silver);
                // Circular grapple fixture on the opposite side, with three radial spokes.
                const grapple = frame(0, -5.75, .045); disc(grapple, [-.36, 0, .06], .245, .055, paint); hoop(grapple, [-.36, 0, .096], .215, .026, material(0xb9aa78, .7, .25));
                disc(grapple, [-.36, 0, -.025], .11, .25, metal);
                for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; kit.rod(grapple.p(-.36, 0, .125), grapple.p(-.36 + Math.cos(a) * .17, Math.sin(a) * .17, .125), .024, 0xb4a675); }
                // Reference-facing Cyrillic wordmark, Russian flag and compact agency marks on both sides.
                function decal(f, canvas, p, w, h) { const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); const ink = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: .95, polygonOffset: true, polygonOffsetFactor: -2 }); ink.userData.decal = true; kit.add(new THREE.PlaneGeometry(w, h), ink, f.p(...p), [1, 1, 1], f.rot, false); }
                for (const a of [0, Math.PI]) {
                    const letters = document.createElement('canvas'); letters.width = 768; letters.height = 128; const c = letters.getContext('2d'); c.fillStyle = '#c83832'; c.font = '500 105px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('РАССВЕТ', 384, 66);
                    if (a === Math.PI) decal(frame(a, -6.03, .025), letters, [0, 0, .02], 1.38, .23);
                    const marks = document.createElement('canvas'); marks.width = 512; marks.height = 192; const m = marks.getContext('2d'); m.fillStyle = '#f5f5ed'; m.fillRect(0, 0, 512, 192); m.fillStyle = '#c73129'; m.beginPath(); m.arc(128, 77, 46, 0, Math.PI * 2); m.strokeStyle = '#bfc8c1'; m.lineWidth = 7; m.stroke(); m.fillRect(119, 40, 12, 63); m.font = 'italic 32px Arial'; m.fillText('ЭНЕРГИЯ', 268, 127); m.fillStyle = '#334350'; m.font = '20px Arial'; m.fillText('РОСКОСМОС', 38, 159);
                    decal(frame(a, -5.66, .026), marks, [0, 0, .02], .92, .23);
                    const flag = document.createElement('canvas'); flag.width = 180; flag.height = 120; const fc = flag.getContext('2d'); for (const [i, col] of ['#f5f5ef', '#234692', '#c5333c'].entries()) { fc.fillStyle = col; fc.fillRect(0, i * 40, 180, 40); }
                    decal(frame(a, -3.65, .040), flag, [0, 0, .02], .43, .25);
                }
                group.userData.referenceFeatures = { roundedBlanketHull: true, transverseAirlock: true, airlockCenter, airlockAxis: [1, 0, 0], airlockEndColors: { negativeX: 'gold', positiveX: 'white' }, stowedRadiator: true, radiatorCenter, radiatorSize, redCarrierEndplates: 4, carrierCrossbars: 2, sideEquipmentPanels: 6 };
            });
            part('z1', 'Z1 truss & communications', '24 / ATTITUDE & COMMUNICATIONS', 'Z1 sits above Unity and carries four control-moment gyroscopes, power electronics and communications hardware. Its forward face carries a large ring frame and a hinged cable tray, each side is cut in by a triangular equipment recess, and two large insulated covers fill most of the aft face. The prime Ku-band dish on the upright mast slowly tracks in an illustrative motion; the spare on the angled port boom stays parked. A spacewalker climbs hand over hand up the forward face, clips a waist tether to the worksite handhold, takes a pistol grip tool from the chest mini-workstation and drives the four service-panel bolts in a cross pattern. The steel safety tether runs from a reel at the left hip, under the handholds and Unity handrails, to the ring around Quest\'s EVA hatch. Fine fittings are schematic.', [['Installed', 'OCT 2000'], ['Control-moment gyros', '4']], [0, 7.9, 12], (kit, group) => {
                group.userData.controlMomentGyroscopes = 4;
                group.userData.kuBandAntennas = 2;
                group.userData.referenceViews = 6;
                group.userData.rebuild = '2026-10-01: near-cubic blanket body after the supplied Z1 truss renders';
                // Body frame: +x starboard, -z forward, +y zenith. The body is centred over Unity's zenith port.
                const cz = 12, halfW = 2.05, halfD = 1.85, floorY = 3.85, wallTop = 7.40, bandTop = 7.58, deckTop = 7.68;
                const front = cz - halfD, aft = cz + halfD, wallBase = floorY + .12, wallMid = (wallBase + wallTop) / 2, wallHeight = wallTop - wallBase;
                group.userData.bodyEnvelope = { floorY, deckTop, width: halfW * 2, depth: halfD * 2 };
                const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7 + 45.3) * 43758.5453; return n - Math.floor(n); };
                function noise(x, y, s) { const xx = x / s, yy = y / s, ix = Math.floor(xx), iy = Math.floor(yy), fx = xx - ix, fy = yy - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v); }
                // The shared MLI blanket, repeated twice across each face.
                const z1Crumple = mliTexture.clone(); z1Crumple.repeat.set(2, 2); z1Crumple.needsUpdate = true;
                const z1Bump = mliBump.clone(); z1Bump.repeat.set(2, 2); z1Bump.needsUpdate = true;
                const z1Blanket = new THREE.MeshStandardMaterial({ color: 0xf2f3ec, map: z1Crumple, bumpMap: z1Bump, bumpScale: .037, roughness: .94, metalness: .10 });
                // The recessed bay walls take a slightly greyer copy so the cavities read against the outer panels.
                const bayBlanket = z1Blanket.clone(); bayBlanket.color.setHex(0xc3c7c4);
                // Tan deck and tray plate, grey metal, white plates, bronze handholds and a dark interior.
                const tan = material(0x8f8064, .84, .1), tanDark = material(0x6f644f, .86, .1), ringGrey = material(0xb4b9b9, .55, .35), plateGrey = material(0xa1a7a8, .62, .32);
                const whitePlate = material(0xe6e7e1, .72, .08), interior = material(0x25272b, .92, .04), holeDark = material(0x1b1d20, .9, .05), harnessWhite = material(0xf1f2eb, .85, .03), bronzeTone = 0xa57b4a;
                // Brown sealant with pale speckles lines the ring opening and the forward base strip.
                const speckleCanvas = document.createElement('canvas'); speckleCanvas.width = speckleCanvas.height = 256;
                { const g = speckleCanvas.getContext('2d'); g.fillStyle = '#7d6c56'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 2600; i++) { g.fillStyle = hash(i, 23) > .4 ? 'rgba(228,222,206,.85)' : 'rgba(48,40,32,.7)'; g.beginPath(); g.arc(hash(i, 3) * 256, hash(i, 11) * 256, .5 + hash(i, 17) * 1.3, 0, Math.PI * 2); g.fill(); } }
                const speckled = (u, v) => { const t = new THREE.CanvasTexture(speckleCanvas); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(u, v); t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return material(0xffffff, .8, .18, t); };
                // Riveted back panel seen through the ring.
                const rivetCanvas = document.createElement('canvas'); rivetCanvas.width = rivetCanvas.height = 256;
                { const g = rivetCanvas.getContext('2d'); g.fillStyle = '#857660'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(58,48,37,.55)'; g.lineWidth = 2; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(0, k * 64); g.lineTo(256, k * 64); g.stroke(); g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64, 256); g.stroke(); } g.fillStyle = 'rgba(214,206,186,.9)'; for (let row = 0; row < 4; row++) for (let col = 0; col < 32; col++) { g.beginPath(); g.arc(4 + col * 8, 10 + row * 64, 1.6, 0, Math.PI * 2); g.fill(); } }
                const rivetTexture = new THREE.CanvasTexture(rivetCanvas); rivetTexture.colorSpace = THREE.SRGBColorSpace; rivetTexture.wrapS = rivetTexture.wrapT = THREE.RepeatWrapping; rivetTexture.repeat.set(2, 2);
                const rivetPanel = material(0xffffff, .82, .15, rivetTexture);
                const slab = (surface, center, size, rotation = [0, 0, 0]) => kit.add(shapes.box, surface, center, size, rotation, false);
                const drape = (points, r = .017, surface = harnessWhite) => kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(24, points.length * 10), r, 8, false), surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                function tube(target, start, end, radius, color, outlined = false) {
                    const from = new THREE.Vector3(...start), axis = new THREE.Vector3(...end).sub(from), length = axis.length();
                    const placed = shapes.cylinder.clone().scale(radius, length, radius).translate(0, length / 2, 0);
                    placed.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vertical, axis.normalize())).translate(from.x, from.y, from.z);
                    target.add(placed, material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], outlined);
                }
                function hoop(target, center, normal, radius, thickness, color) {
                    const placed = new THREE.TorusGeometry(radius, thickness, 8, 56).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal).normalize()));
                    target.add(placed.translate(...center), material(color), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                }
                function beam(a, b, width, depth, surface = tan) {
                    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from), mid = from.clone().add(to).multiplyScalar(.5);
                    const g = new THREE.BoxGeometry(width, depth, delta.length()).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.normalize()));
                    kit.add(g, surface, mid.toArray(), [1, 1, 1], [0, 0, 0], false);
                }
                // An oriented frame: p(a, b, c) = origin + a·u + b·v + c·(u × v). Geometry built in (a, b, c) is placed by its matrix.
                function frame(origin, u, v) {
                    const U = new THREE.Vector3(...u).normalize(), V = new THREE.Vector3(...v).normalize(), W = U.clone().cross(V), O = new THREE.Vector3(...origin);
                    const matrix = new THREE.Matrix4().makeBasis(U, V, W).setPosition(O);
                    const add = (geometry, surface) => kit.add(geometry.applyMatrix4(matrix), surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                    return {
                        p: (a, b, c = 0) => O.clone().addScaledVector(U, a).addScaledVector(V, b).addScaledVector(W, c).toArray(), add,
                        box: (center, size, surface, turn = 0) => add(new THREE.BoxGeometry(...size).rotateZ(turn).translate(...center), surface)
                    };
                }
                // A round connector boss: a short drum on `normal` with a pale rim and a dark bore.
                function boss(center, normal, r, depth, color = 0xdcded9) {
                    const n = new THREE.Vector3(...normal).normalize(), q = new THREE.Quaternion().setFromUnitVectors(vertical, n), c0 = new THREE.Vector3(...center);
                    const put = (geometry, surface, offset) => kit.add(geometry.applyQuaternion(q).translate(...c0.clone().addScaledVector(n, offset).toArray()), surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                    put(new THREE.CylinderGeometry(r, r, depth, 40), material(color, .6, .18), depth / 2);
                    put(new THREE.TorusGeometry(r * .66, r * .09, 8, 36).rotateX(-Math.PI / 2), material(0xf2f2ee, .5, .1), depth);
                    put(new THREE.CircleGeometry(r * .42, 32).rotateX(-Math.PI / 2), holeDark, depth + .004);
                }
                // A bronze U-handhold standing off a face along `n`.
                function staple(A, B, n, h = .07, r = .014) {
                    const a2 = A.map((value, i) => value + n[i] * h), b2 = B.map((value, i) => value + n[i] * h);
                    kit.rod(A, a2, r, bronzeTone); kit.rod(B, b2, r, bronzeTone); kit.rod(a2, b2, r, bronzeTone);
                }
                // A soft, rolled-edge cushion: a rounded box whose outer (+z) face puffs out, with gathered creases and an optional dent along its top.
                function cushion(width, height, depth, radius, bulge, seed, dent = 0, dentAt = 0, taper = 0) {
                    const g = new THREE.BoxGeometry(width, height, depth, 30, 24, 10), p = g.attributes.position, v = new THREE.Vector3(), core = new THREE.Vector3();
                    const ix = width / 2 - radius, iy = height / 2 - radius, iz = depth / 2 - radius;
                    for (let i = 0; i < p.count; i++) {
                        v.fromBufferAttribute(p, i);
                        core.set(THREE.MathUtils.clamp(v.x, -ix, ix), THREE.MathUtils.clamp(v.y, -iy, iy), THREE.MathUtils.clamp(v.z, -iz, iz));
                        const out = v.clone().sub(core); if (out.lengthSq() > 1e-10) out.setLength(radius); v.copy(core).add(out);
                        const u = v.x / (width / 2), t = v.y / (height / 2), face = THREE.MathUtils.clamp(v.z / (depth / 2), 0, 1);
                        const swell = bulge * (1 - u ** 4) * (1 - t ** 4) * face;
                        v.x *= (1 + .05 * (1 - t * t) * (.4 + .6 * face)) * (1 - taper * Math.max(0, -t) ** 2);
                        const gather = .028 * (noise((u + 1) * 140 + seed * 9, (t + 1) * 160, 23) - .5) + .012 * (noise((u + 1) * 300, (t + 1) * 260 + seed * 7, 9) - .5);
                        v.z += swell + gather * face;
                        if (dent) v.y -= dent * Math.exp(-(((u - dentAt) / .2) ** 2)) * Math.max(0, t) ** 3 * (.35 + .65 * face);
                        v.y += .02 * (noise((u + 1) * 90 + seed, (v.z + 1) * 70, 15) - .5) * Math.max(0, Math.abs(t) - .6);
                        p.setXYZ(i, v.x, v.y, v.z);
                    }
                    // Average normals across the box's split face seams so the rolled edges shade smoothly.
                    g.computeVertexNormals();
                    const nrm = g.attributes.normal, sums = new Map(), key = i => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
                    for (let i = 0; i < p.count; i++) { const k = key(i), s = sums.get(k) || [0, 0, 0]; s[0] += nrm.getX(i); s[1] += nrm.getY(i); s[2] += nrm.getZ(i); sums.set(k, s); }
                    for (let i = 0; i < p.count; i++) { const s = sums.get(key(i)), l = Math.hypot(...s) || 1; nrm.setXYZ(i, s[0] / l, s[1] / l, s[2] / l); }
                    return g;
                }

                // Z1's smooth cylinder and shallow upper flare follow GLB node 26.
                // Adapt the measured section to the existing mounting plane and 70% body scale.
                const z1JointScale = 1.42 / 1.07548, z1JointRise = .88 / .68514;
                const z1JointRadius = 1.04638 * z1JointScale, z1JointBore = .91889 * z1JointScale;
                const z1JointProfile = [
                    [z1JointRadius, 2.95], [z1JointRadius, 2.95 + .43294 * z1JointRise], [1.42, 3.83],
                    [z1JointBore, 3.83], [z1JointBore, 3.01], [1.0, 3.01], [1.0, 2.95], [z1JointRadius, 2.95]
                ];
                // A closed annular wall leaves the central mounting bore open.
                let z1JointArea = 0;
                for (let i = 0; i < z1JointProfile.length - 1; i++) z1JointArea += z1JointProfile[i][0] * z1JointProfile[i+1][1] - z1JointProfile[i+1][0] * z1JointProfile[i][1];
                if (z1JointArea < 0) z1JointProfile.reverse();
                kit.add(new THREE.LatheGeometry(z1JointProfile.map(p => new THREE.Vector2(...p)), 64), material(0xc7cdca, .6, .3), [0, 0, cz], [1, 1, 1], [0, 0, 0], false);
                ring(kit, [0, 2.976, cz], z1JointRadius + .006, 'y', 0x727d78, .018);
                ring(kit, [0, 3.814, cz], 1.414, 'y', palette.silver, .017);
                group.userData.berthingInterface = {
                    source: 'ISS_stationary.glb / node 26 smooth drum and shallow upper flare',
                    sourceProfile: [[0, 1.04638], [.43294, 1.04638], [.68514, 1.07548]],
                    mountedBottomY: 2.95, mountedTopY: 3.566, bodyScale: .70,
                    keptUnitySeat: true, adaptedToExistingHeight: true
                };
                // ---- Body: blanket walls, corner posts, a white top band and floor, and a dark interior under the open deck. ----
                slab(z1Blanket, [0, floorY + .05, cz], [4.18, .14, 3.78]);
                const ringY = 5.76, ringOuter = 1.55, ringInner = 1.18;
                const frontShape = new THREE.Shape([[-2.0, wallBase], [2.0, wallBase], [2.0, wallTop], [-2.0, wallTop]].map(p => new THREE.Vector2(...p)));
                const opening = new THREE.Path(); opening.absarc(0, ringY, ringInner + .02, 0, Math.PI * 2, true); frontShape.holes.push(opening);
                const frontWall = new THREE.ExtrudeGeometry(frontShape, { depth: .1, bevelEnabled: false, curveSegments: 72 });
                { const uv = frontWall.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * .25, uv.getY(i) * .25); }
                kit.add(frontWall, z1Blanket, [0, 0, front], [1, 1, 1], [0, 0, 0], false);
                slab(z1Blanket, [0, wallMid, aft - .05], [4.0, wallHeight, .1]);
                // Each side is cut in by a triangular recess. Its slanted wall starts flush at the forward corner and runs back and inward to the
                // deepest line, .9 inside the outer face; a return wall then steps straight back out, and a flat aft section carries the trunnions.
                // The top band, a triangular ceiling plate and the floor close the recess. Most side equipment mounts on the slanted wall.
                const slantFront = front + .05, deepZ = 12.55, cutDepth = .9, slantLength = Math.hypot(cutDepth, deepZ - slantFront), slantU = [cutDepth / slantLength, (deepZ - slantFront) / slantLength];
                // A point on side s's slanted wall: t metres from the forward corner toward the deepest line, at height y and d out from the wall face.
                const onSlant = (s, t, y, d) => [s * (halfW - slantU[0] * t + slantU[1] * d), y, slantFront + slantU[1] * t + slantU[0] * d];
                const slantNormal = s => [s * slantU[1], 0, slantU[0]];
                const slantBox = (s, t, y, size, surface, d0 = 0) => frame(onSlant(s, t, y, d0 + size[2] / 2), [slantU[0], 0, -s * slantU[1]], [0, 1, 0]).box([0, 0, 0], size, surface);
                for (const s of [-1, 1]) {
                    slantBox(s, slantLength / 2, wallMid, [slantLength + .08, wallHeight, .1], z1Blanket, -.1);
                    slab(bayBlanket, [s * (halfW - (cutDepth + .08) / 2), wallMid, deepZ], [cutDepth + .08, wallHeight, .1]);
                    slab(z1Blanket, [s * (halfW - .05), wallMid, (deepZ + aft) / 2], [.1, wallHeight, aft - deepZ]);
                    const roof = new THREE.Shape([[s * (halfW + .02), slantFront - .03], [s * (halfW - cutDepth - .09), deepZ + .05], [s * (halfW + .02), deepZ + .05]].map(q => new THREE.Vector2(...q)));
                    kit.add(new THREE.ExtrudeGeometry(roof, { depth: .04, bevelEnabled: false }).rotateX(Math.PI / 2), bayBlanket, [0, wallTop, 0], [1, 1, 1], [0, 0, 0], false);
                    kit.add(new THREE.ExtrudeGeometry(roof, { depth: .01, bevelEnabled: false }).rotateX(Math.PI / 2), interior, [0, wallTop + .01, 0], [1, 1, 1], [0, 0, 0], false);
                }
                for (const sx of [-1, 1]) for (const z of [front + .03, aft - .03]) slab(z1Blanket, [sx * (halfW - .03), wallMid, z], [.12, wallHeight, .12]);
                // A dark interior floor and liners follow the inside of every wall, including both slanted walls and their return walls.
                const apexIn = halfW - cutDepth - .12;
                const innerOutline = [[-1.9, front + .11], [1.9, front + .11], [apexIn, deepZ - .04], [apexIn, deepZ + .07], [1.94, deepZ + .07], [1.94, aft - .11], [-1.94, aft - .11], [-1.94, deepZ + .07], [-apexIn, deepZ + .07], [-apexIn, deepZ - .04]];
                kit.add(new THREE.ExtrudeGeometry(new THREE.Shape(innerOutline.map(q => new THREE.Vector2(...q))), { depth: .04, bevelEnabled: false }).rotateX(Math.PI / 2), interior, [0, 7.02, 0], [1, 1, 1], [0, 0, 0], false);
                innerOutline.forEach(([x0, z0], i) => { const [x1, z1] = innerOutline[(i + 1) % innerOutline.length]; slab(interior, [(x0 + x1) / 2, 7.2, (z0 + z1) / 2], [Math.hypot(x1 - x0, z1 - z0), .4, .01], [0, Math.atan2(-(z1 - z0), x1 - x0), 0]); });
                // Four gyroscope housings sit low in the open bays.
                for (const [x, z, r] of [[-.95, 11.1, .55], [.95, 11.1, .55], [-.8, 13.0, .48], [.8, 13.0, .48]]) { kit.cylinder([x, 7.1, z], r, .16, 0x50565a, [0, 0, 0]); kit.cylinder([x, 7.2, z], .2, .06, 0x3b4044, [0, 0, 0]); }
                const bandY = (wallTop + bandTop) / 2, bandH = bandTop - wallTop;
                for (const z of [front + .15, aft - .15]) slab(z1Blanket, [0, bandY, z], [4.16, bandH, .36]);
                slab(z1Blanket, [1.90, bandY, cz], [.36, bandH, 3.04]); slab(z1Blanket, [-1.78, bandY, cz], [.60, bandH, 3.04]);

                // ---- Zenith deck: tan rails with small bolt plates, an X of beams around a slotted centre plate and four ringed attach pads. ----
                const railY = bandTop + .05, deckBeamY = bandTop - .02;
                for (const z of [front + .17, aft - .17]) { slab(tan, [0, railY, z], [3.66, .1, .2]); for (let x = -1.5; x <= 1.51; x += .6) slab(plateGrey, [x, deckTop + .008, z], [.14, .016, .12]); }
                slab(tan, [1.88, railY, cz], [.2, .1, 3.14]); slab(tan, [-1.40, railY, cz], [.2, .1, 3.14]);
                beam([-1.48, deckBeamY, 10.48], [1.72, deckBeamY, 13.52], .22, .14); beam([1.72, deckBeamY, 10.48], [-1.48, deckBeamY, 13.52], .22, .14);
                for (const z of [cz - .62, cz + .62]) beam([-1.48, deckBeamY, z], [1.72, deckBeamY, z], .14, .12);
                slab(tan, [.12, deckBeamY + .02, cz], [1.0, .12, .72]); slab(holeDark, [.12, deckBeamY + .085, cz], [.56, .02, .16]);
                for (const [x, z] of [[1.45, front + .55], [-1.05, front + .55], [1.45, aft - .55], [-1.05, aft - .55]]) {
                    slab(tan, [x, bandTop + .03, z], [.46, .08, .46]);
                    kit.add(new THREE.RingGeometry(.085, .2, 48).rotateX(-Math.PI / 2), whitePlate, [x, bandTop + .072, z], [1, 1, 1], [0, 0, 0], false);
                    kit.add(new THREE.CircleGeometry(.085, 32).rotateX(-Math.PI / 2), holeDark, [x, bandTop + .071, z], [1, 1, 1], [0, 0, 0], false);
                }
                // A tan support plate carries the upright mast across the starboard bay.
                slab(tan, [1.32, bandTop + .03, 11.35], [.9, .1, .76]);
                // Starboard outrigger: an open tan frame at deck level with a ringed fitting and a pin at its tip.
                const earTop = bandTop + .08;
                const earShape = new THREE.Shape([[2.0, 10.65], [2.86, 11.05], [2.86, 11.65], [2.0, 12.05]].map(p => new THREE.Vector2(...p)));
                earShape.holes.push(new THREE.Path([[2.18, 10.95], [2.46, 11.1], [2.46, 11.6], [2.18, 11.75]].map(p => new THREE.Vector2(...p))));
                kit.add(new THREE.ExtrudeGeometry(earShape, { depth: .1, bevelEnabled: false }).rotateX(Math.PI / 2), tan, [0, earTop, 0], [1, 1, 1], [0, 0, 0], false);
                kit.add(new THREE.RingGeometry(.07, .16, 40).rotateX(-Math.PI / 2), whitePlate, [2.66, earTop + .004, 11.35], [1, 1, 1], [0, 0, 0], false);
                kit.add(new THREE.CircleGeometry(.07, 24).rotateX(-Math.PI / 2), holeDark, [2.66, earTop + .003, 11.35], [1, 1, 1], [0, 0, 0], false);
                kit.cylinder([3.06, earTop - .05, 11.35], .05, .4, 0xb6bbbc, [0, 0, Math.PI / 2]); kit.cylinder([3.27, earTop - .05, 11.35], .068, .05, 0x8b9294, [0, 0, Math.PI / 2]);
                for (const [z0, z1] of [[10.92, 10.85], [11.78, 11.85]]) kit.rod([2.55, earTop - .1, z0], [2.1, 7.43, z1], .035, 0x8f8064);

                // ---- Forward face: a heavy ring frame with crossed braces, a notched white plate and a hub plate. ----
                const ringFrame = (profile, surface) => kit.add(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), 96).rotateX(-Math.PI / 2), surface, [0, ringY, front], [1, 1, 1], [0, 0, 0], false);
                ringFrame([[ringOuter, 0], [ringOuter, .16], [ringOuter, .16], [ringOuter - .08, .25], [ringOuter - .08, .25], [ringInner + .2, .25], [ringInner + .2, .25], [ringInner + .15, .235], [ringInner + .15, .235], [ringInner + .06, .235], [ringInner + .06, .235], [ringInner, .19]], ringGrey);
                ringFrame([[ringInner, .19], [ringInner, -.27]], speckled(14, 1));
                kit.add(new THREE.CircleGeometry(ringInner + .01, 72).rotateY(Math.PI), rivetPanel, [0, ringY, front + .27], [1, 1, 1], [0, 0, 0], false);
                for (const a of [Math.PI / 4, -Math.PI / 4]) slab(ringGrey, [0, ringY, front + .17], [.16, ringInner * 2, .1], [0, 0, a]);
                for (let k = 0; k < 4; k++) {
                    const a = Math.PI / 4 + k * Math.PI / 2, rIn = [-Math.cos(a), -Math.sin(a)], tangent = [-Math.sin(a), Math.cos(a)], end = [Math.cos(a) * (ringInner - .02), ringY + Math.sin(a) * (ringInner - .02)];
                    for (const s of [-1, 1]) {
                        const at = (along, inward) => new THREE.Vector2(end[0] + tangent[0] * s * along + rIn[0] * inward, end[1] + tangent[1] * s * along + rIn[1] * inward);
                        kit.add(new THREE.ExtrudeGeometry(new THREE.Shape([at(.08, 0), at(.3, 0), at(.08, .26)]), { depth: .04, bevelEnabled: false }), whitePlate, [0, 0, front + .08], [1, 1, 1], [0, 0, 0], false);
                    }
                }
                const bowTie = new THREE.Shape([[-.86, -.30], [-.30, -.30], [-.18, -.19], [.18, -.19], [.30, -.30], [.86, -.30], [.86, .30], [.40, .30], [.25, .06], [-.25, .06], [-.40, .30], [-.86, .30]].map(p => new THREE.Vector2(...p)));
                kit.add(new THREE.ExtrudeGeometry(bowTie, { depth: .06, bevelEnabled: false }), whitePlate, [0, ringY + .06, front + .03], [1, 1, 1], [0, 0, 0], false);
                slab(whitePlate, [0, ringY - .5, front + .1], [.32, .32, .05]);
                kit.add(new THREE.CircleGeometry(.075, 32).rotateY(Math.PI), holeDark, [0, ringY - .5, front + .074], [1, 1, 1], [0, 0, 0], false);
                // A white cable loop and a short peg to starboard of the ring; a speckled riveted strip along the base.
                for (const dx of [0, .055]) drape([[1.60 + dx, 6.55, front - .03], [1.60 + dx, 6.98, front - .05], [1.66 + dx, 7.16, front - .06], [1.76 + dx, 7.18, front - .06], [1.84 + dx, 7.02, front - .05], [1.86 + dx, 6.55, front - .03]], .024);
                kit.rod([1.72, 6.25, front], [1.72, 6.25, front - .3], .028, 0xb9bec0);
                slab(speckled(8, .5), [0, floorY + .21, front - .012], [4.0, .18, .03]);
                for (let x = -1.85; x <= 1.86; x += .285) kit.cylinder([x, floorY + .21, front - .03], .022, .02, 0xd6d0bd, [Math.PI / 2, 0, 0]);
                // ---- Hinged cable tray: a tan plate swung down and out below the ring, carrying white harnesses into its slots. ----
                const trayTilt = 30 * Math.PI / 180, trayLength = 1.75;
                const tray = frame([.15, floorY + .2, front - .07], [1, 0, 0], [0, -Math.cos(trayTilt), -Math.sin(trayTilt)]);
                const trayShape = new THREE.Shape([[-1.45, 0], [1.45, 0], [1.65, trayLength], [-1.65, trayLength]].map(p => new THREE.Vector2(...p)));
                for (const hole of [[[-1.44, 1.42], [-1.0, 1.42], [-1.0, 1.58], [-1.44, 1.58]], [[1.0, 1.42], [1.44, 1.42], [1.44, 1.58], [1.0, 1.58]], [[-.52, .62], [.52, .62], [.52, 1.26], [-.52, 1.26]]]) trayShape.holes.push(new THREE.Path(hole.map(p => new THREE.Vector2(...p))));
                tray.add(new THREE.ExtrudeGeometry(trayShape, { depth: .05, bevelEnabled: false }).translate(0, 0, -.025), tan);
                const railLength = Math.hypot(.2, trayLength), railTurn = Math.atan2(.2, trayLength);
                for (const s of [-1, 1]) tray.box([s * 1.55, trayLength / 2, .05], [.07, railLength, .1], tanDark, -s * railTurn);
                tray.box([0, trayLength - .03, .04], [3.2, .06, .08], tanDark);
                for (const b of [.82, 1.1]) tray.box([0, b, .075], [1.25, .05, .03], tan);
                tray.add(new THREE.CylinderGeometry(.045, .045, 2.9, 16).rotateZ(Math.PI / 2).translate(0, 0, -.02), plateGrey);
                for (const a of [-1.1, 0, 1.1]) tray.add(new THREE.CylinderGeometry(.06, .06, .22, 16).rotateZ(Math.PI / 2).translate(a, 0, -.02), plateGrey);
                for (const s of [-1, 1]) for (const b of [.5, 1.05]) tray.box([s * 1.17, b, .075], [.22, .05, .06], material(bronzeTone, .48, .5));
                // Harnesses: six run down the port side of the ring and over the tray (four through the window, two into the port slot);
                // two more leave the ring's starboard foot for the starboard slot.
                for (let k = 0; k < 6; k++) {
                    const d = k * .048, lane = k < 4 ? -.42 + k * .14 : -1.12 - (k - 4) * .12, sink = k < 4 ? [1.17, 1.29] : [1.46, 1.56];
                    drape([[-.55 - d, deckTop - .02, front + .08], [-.62 - d, bandTop, front - .07], [-.95 - d, 7.18, front - .05], [-1.6 - d * .5, 6.5, front - .045], [-1.72 - d * .5, 5.6, front - .045], [-1.5 + d * .3, 4.62, front - .045], [-.85 + d, 4.12, front - .05], tray.p(lane, .04, .06), tray.p(lane, .55, .06), tray.p(lane, sink[0], .035), tray.p(lane, sink[1], -.1)], .021);
                }
                for (let k = 0; k < 2; k++) {
                    const lane = 1.12 + k * .12;
                    drape([[1.22 + k * .06, 4.52, front - .04], [1.24 + k * .06, 4.2, front - .05], tray.p(lane, .04, .06), tray.p(lane, .7, .06), tray.p(lane, 1.46, .035), tray.p(lane, 1.56, -.1)], .021);
                }

                // ---- Port: on the slanted wall, twin connector boxes, a round umbilical boss, handholds and a stepped access panel, and near the deepest
                // line a box with a boss over a lower white box; harnesses hang in the deep corner. ----
                for (const t of [1.14, 1.78]) {
                    slantBox(-1, t, 6.535, [.58, 1.17, .28], whitePlate);
                    slantBox(-1, t, 6.535, [.52, 1.12, .012], plateGrey, .28);
                    slantBox(-1, t, 6.56, [.42, 1.0, .02], whitePlate, .292);
                    slantBox(-1, t + .08, 5.88, [.42, .14, .18], whitePlate);
                    for (const y of [6.86, 6.6, 6.34]) slantBox(-1, t + .1, y, [.12, .1, .03], plateGrey, .312);
                }
                boss(onSlant(-1, .95, 6.05, 0), slantNormal(-1), .23, .34);
                for (const y of [5.5, 5.22]) staple(onSlant(-1, 1.25, y, 0), onSlant(-1, 1.5, y, 0), slantNormal(-1));
                slantBox(-1, 1.45, 4.6, [1.1, .7, .03], plateGrey);
                slantBox(-1, 1.18, 4.78, [.56, .34, .03], z1Blanket, .02);
                slantBox(-1, 1.46, 4.78, [.016, .34, .012], holeDark, .05); slantBox(-1, 1.18, 4.61, [.56, .016, .012], holeDark, .05);
                slantBox(-1, 2.25, 5.25, [.42, .6, .38], whitePlate); boss(onSlant(-1, 2.25, 5.25, .38), slantNormal(-1), .2, .2);
                slantBox(-1, 2.25, 4.45, [.5, .6, .44], whitePlate); slantBox(-1, 2.25, 4.45, [.44, .52, .01], plateGrey, .44);
                for (const x of [-1.25, -1.31]) drape([[x, 7.34, deepZ - .1], [x - .02, 6.3, deepZ - .09], [x + .01, 5.6, deepZ - .1], [x - .02, 4.8, deepZ - .09], [x, 3.99, deepZ - .1]], .013);
                drape([[-1.42, 7.36, deepZ - .16], [-1.46, 6.6, deepZ - .15], onSlant(-1, 2.25, 5.62, .25)]);

                // ---- Starboard: handholds, a hook and a harness on the slanted wall; near the deepest line a connector-box pair on a shelf (the forward
                // box carries a round boss) and a lower box with a boss; harnesses hang in the deep corner. ----
                for (const y of [5.6, 5.3]) staple(onSlant(1, .55, y, 0), onSlant(1, .8, y, 0), slantNormal(1));
                drape([onSlant(1, .95, 5.25, .02), onSlant(1, .95, 5.3, .14), onSlant(1, 1.0, 5.2, .2), onSlant(1, 1.1, 5.05, .16), onSlant(1, 1.12, 5.0, .06)], .03, whitePlate);
                drape([onSlant(1, 1.3, 7.33, .04), onSlant(1, 1.28, 6.9, .05), onSlant(1, 1.24, 5.9, .05), onSlant(1, 1.22, 5.45, .05), onSlant(1, 1.0, 4.6, .05), onSlant(1, .62, 4.08, .05), onSlant(1, .3, 4.03, .05), onSlant(1, .08, 4.03, .04)]);
                for (const [t, d] of [[1.58, .46], [2.04, .5]]) { slantBox(1, t, 6.65, [.44, .82, d], whitePlate); slantBox(1, t, 6.65, [.38, .76, .008], plateGrey, d); }
                boss(onSlant(1, 1.58, 6.8, .46), slantNormal(1), .17, .16);
                for (const y of [6.88, 6.65, 6.42]) slantBox(1, 2.1, y, [.14, .1, .02], plateGrey, .508);
                slantBox(1, 1.81, 6.21, [.96, .06, .5], whitePlate);
                slantBox(1, 1.97, 4.68, [.54, .84, .5], whitePlate); boss(onSlant(1, 1.97, 4.68, .5), slantNormal(1), .21, .1);
                for (const x of [1.25, 1.31, 1.37]) drape([[x, 7.34, deepZ - .1], [x + .02, 6.2, deepZ - .09], [x - .01, 5.3, deepZ - .1], [x + .02, 4.2, deepZ - .09], [x, 3.99, deepZ - .1]], .013);
                // Trunnion pins on perforated grey discs on the flat aft section of each side, near the top and bottom.
                for (const side of [-1, 1]) for (const y of [wallTop - .26, floorY + .32]) {
                    const z = aft - .23, x = side * halfW, disc = new THREE.Shape(); disc.absarc(0, 0, .27, 0, Math.PI * 2, false);
                    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, rr = k % 2 ? .19 : .14, hole = new THREE.Path(); hole.absarc(Math.cos(a) * rr, Math.sin(a) * rr, .022, 0, Math.PI * 2, true); disc.holes.push(hole); }
                    kit.add(new THREE.ExtrudeGeometry(disc, { depth: .035, bevelEnabled: false, curveSegments: 24 }).rotateY(side * Math.PI / 2), plateGrey, [x + side * .005, y, z], [1, 1, 1], [0, 0, 0], false);
                    kit.cylinder([x + side * .05, y, z], .1, .1, 0x8b9294, [0, 0, Math.PI / 2]);
                    kit.cylinder([x + side * .27, y, z], .055, .5, 0xb6bbbc, [0, 0, Math.PI / 2]);
                    kit.cylinder([x + side * .5, y, z], .07, .05, 0x8b9294, [0, 0, Math.PI / 2]);
                }

                // ---- Aft face: a tan box and a framed grey door unit to port, two large stacked pillow covers and their waist strap. ----
                slab(tan, [-1.42, 6.28, aft + .2], [1.0, .82, .4]);
                slab(plateGrey, [-1.48, 4.98, aft + .06], [.82, 1.46, .12]);
                slab(material(0xbfc3c2, .58, .3), [-1.48, 4.98, aft + .125], [.64, 1.26, .02]);
                for (const y of [4.38, 5.58]) slab(plateGrey, [-1.48, y, aft + .14], [.5, .03, .02]);
                slab(plateGrey, [-.97, 5.38, aft + .1], [.2, .16, .2]); kit.rod([-.9, 5.38, aft + .2], [-.74, 5.44, aft + .34], .022, 0x9aa1a3); kit.rod([-.74, 5.44, aft + .34], [-.66, 5.5, aft + .3], .022, 0x9aa1a3);
                kit.add(cushion(2.74, 1.70, .6, .32, .22, 1, .34, .2), z1Blanket, [.6, 6.48, aft + .3], [1, 1, 1], [0, 0, 0], false);
                kit.add(cushion(2.7, 1.62, .56, .32, .18, 2, 0, 0, .1), z1Blanket, [.6, 4.80, aft + .28], [1, 1, 1], [0, 0, 0], false);
                slab(z1Blanket, [.6, 5.62, aft + .29], [2.74, .13, .58]);
                staple([-1.85, 4.05, aft], [-1.2, 4.05, aft], [0, 0, 1]);

                // ---- Two Ku-band antennas after the supplied reference renders: a dish on an upright grey mast to starboard and a dish on an
                // angled grey boom to port, each with a finned SGTRC box and white cable runs. Each head nests mount → azimuth turntable →
                // Y-yoke elevation axis → reflector, so tracking turns about real gimbal axes. The reflector has a rolled rim, a back plate with
                // four flat arms (the pair on the elevation axis reaching past the rim), a white feed cone and a four-leg support to the feed apex.
                // Sizes are representative.
                const focal = .78, aperture = .92, vertexLift = .30, bowl = r => vertexLift + r * r / (4 * focal);
                const antennaWhite = material(0xeef0ec, .5, .12), gimbalGrey = 0xb7bcbd, jointGrey = 0x8d9396, mastGrey = 0xbcc1c2, cableWhite = material(0xf2f2ee, .55, .05), sgtrcTone = 0xd9dccf;
                const cable = (target, points, radius = .012) => target.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(12, points.length * 8), radius, 6, false), cableWhite, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                function reflector(target) {
                    // Two single-sided shells (the reversed profile faces into the bowl) keep shadow bias correct on both faces.
                    const profile = [];
                    for (let n = 0; n <= 20; n++) { const r = .07 + n / 20 * (aperture - .07); profile.push(new THREE.Vector2(r, bowl(r))); }
                    target.add(new THREE.LatheGeometry(profile.slice().reverse(), 64), antennaWhite, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                    target.add(new THREE.LatheGeometry(profile.map(point => new THREE.Vector2(point.x, point.y - .03)), 64), material(0xd9dcda, .6, .1), [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
                    hoop(target, [0, bowl(aperture) - .012, 0], [0, 1, 0], aperture + .006, .03, 0xeef0ec);
                    // Back plate and four flat arms; the pair on the elevation axis reaches past the rim and ends in small tabs.
                    target.cylinder([0, vertexLift - .06, 0], .46, .035, gimbalGrey, [0, 0, 0]);
                    for (const [a, length] of [[0, 1.2], [Math.PI, 1.2], [Math.PI / 2, .8], [-Math.PI / 2, .8]]) {
                        target.box([Math.cos(a) * length / 2, vertexLift - .1, Math.sin(a) * length / 2], [length, .03, .09], gimbalGrey, [0, -a, 0]);
                        if (length > 1) target.box([Math.cos(a) * length, vertexLift - .1, Math.sin(a) * length], [.05, .035, .24], gimbalGrey, [0, -a, 0]);
                    }
                    target.cylinder([0, .17, 0], .14, .26, gimbalGrey, [0, 0, 0]);
                    target.box([0, .03, 0], [.24, .12, .22], gimbalGrey);
                    // White feed cone on the axis; four thin legs meet at the apex plate with its three studs.
                    target.add(new THREE.CylinderGeometry(.035, .095, .36, 24), antennaWhite, [0, vertexLift + .18, 0]);
                    target.cylinder([0, vertexLift + .375, 0], .045, .03, 0xdadddb, [0, 0, 0]);
                    const apexY = vertexLift + focal - .02;
                    target.box([0, apexY, 0], [.15, .03, .15], 0xdadddb, [0, Math.PI / 4, 0]);
                    for (let stud = 0; stud < 3; stud++) { const a = stud * Math.PI * 2 / 3; target.cylinder([Math.cos(a) * .045, apexY + .045, Math.sin(a) * .045], .012, .06, 0xdadddb, [0, 0, 0]); }
                    for (let leg = 0; leg < 4; leg++) {
                        const a = Math.PI / 4 + leg * Math.PI / 2;
                        tube(target, [Math.cos(a) * .86, bowl(.86), Math.sin(a) * .86], [Math.cos(a) * .05, apexY, Math.sin(a) * .05], .012, 0xeef0ec);
                    }
                }
                function antennaHead(parent, position, heading, tilt) {
                    // Azimuth turntable and drive housing with a round side cap, then a Y-yoke of splayed cheeks carrying the
                    // elevation cross-shaft, its pivot bosses and drive.
                    const azimuth = new THREE.Group(); azimuth.position.fromArray(position); azimuth.rotation.y = heading - parent.rotation.y; parent.add(azimuth);
                    const headKit = new Kit();
                    headKit.cylinder([0, .03, 0], .19, .06, jointGrey, [0, 0, 0]);
                    headKit.box([0, .13, 0], [.3, .16, .26], gimbalGrey);
                    headKit.cylinder([0, .13, .15], .08, .05, jointGrey);
                    for (const side of [-1, 1]) {
                        headKit.box([side * .16, .33, 0], [.05, .34, .2], gimbalGrey, [0, 0, -side * .22]);
                        headKit.cylinder([side * .2, .5, 0], .095, .06, jointGrey, [0, 0, Math.PI / 2]);
                    }
                    headKit.cylinder([0, .5, 0], .045, .46, gimbalGrey, [0, 0, Math.PI / 2]);
                    headKit.cylinder([.3, .5, 0], .07, .12, jointGrey, [0, 0, Math.PI / 2]);
                    // Service loops hang from the housing down past the turntable.
                    for (const dz of [-.06, .02, .1]) cable(headKit, [[-.14, .2, dz], [-.27, .06, dz + .02], [-.22, -.2, dz], [-.1, -.32, dz]]);
                    headKit.finish(azimuth);
                    const elevation = new THREE.Group(); elevation.position.set(0, .5, 0); elevation.rotation.x = tilt; azimuth.add(elevation);
                    const dishKit = new Kit(); reflector(dishKit); dishKit.finish(elevation);
                    return { azimuth, elevation };
                }
                // A finned SGTRC box: body plus nine heat-sink fins on its outer (+x local) face, placed by `at(x, y)` in a frame turned by `turn` about z.
                function sgtrc(target, at, turn, length = .52, width = .34) {
                    target.box(at(0, 0), [.2, length, width], sgtrcTone, [0, 0, turn]);
                    for (let fin = 0; fin < 9; fin++) target.box(at(.15, -length / 2 + .05 + fin * (length - .1) / 8), [.1, .016, width - .02], 0xb5baab, [0, 0, turn], false);
                }
                // Port: a grey clevis on the wide port band, a grey boom rising outboard and aft with clipped cables and an SGTRC box under
                // its upper end, an elbow and a short upright section to the head.
                const boomMount = new THREE.Group(); boomMount.name = 'Redundant Ku-band antenna';
                boomMount.position.set(-1.78, bandTop, 12.75); boomMount.rotation.y = -2.687; group.add(boomMount);
                const boomKit = new Kit(), lean = 48 * Math.PI / 180, reach = 3.0, boomAxis = [Math.cos(lean), Math.sin(lean), 0], up = [-Math.sin(lean), Math.cos(lean), 0], headY = 4.2;
                const along = s => [.02 + boomAxis[0] * s, .24 + boomAxis[1] * s, 0];
                const off = (s, u, z = 0) => { const p = along(s); return [p[0] + up[0] * u, p[1] + up[1] * u, z]; };
                boomKit.box([0, .025, 0], [.6, .05, .58], palette.silver);
                for (const x of [-.24, .24]) for (const z of [-.24, .24]) boomKit.cylinder([x, .06, z], .025, .03, palette.dark, [0, 0, 0]);
                for (const z of [-.25, .25]) boomKit.box([.02, .2, z], [.32, .3, .05], jointGrey);
                boomKit.cylinder([.02, .24, 0], .055, .6, palette.silver);
                boomKit.box([-.2, .13, 0], [.14, .16, .3], gimbalGrey);
                tube(boomKit, along(0), along(.42), .2, jointGrey, true);
                tube(boomKit, along(.1), along(reach), .16, mastGrey, true);
                for (const s of [.95, 1.9]) hoop(boomKit, along(s), boomAxis, .165, .02, jointGrey);
                const elbow = along(reach);
                boomKit.sphere(elbow, [.2, .2, .2], jointGrey);
                boomKit.box([elbow[0], elbow[1] + .08, 0], [.3, .2, .3], jointGrey);
                boomKit.cylinder([elbow[0], (elbow[1] + headY) / 2 + .05, 0], .13, headY - elbow[1] - .1, mastGrey, [0, 0, 0]);
                boomKit.box([elbow[0] + .12, elbow[1] + .55, 0], [.06, .5, .2], gimbalGrey);
                boomKit.cylinder([elbow[0], headY - .05, 0], .17, .1, jointGrey, [0, 0, 0]);
                // Three white cables run up the boom's upper side under clips, then up the upright section.
                for (const dz of [-.05, 0, .05]) cable(boomKit, [...Array.from({ length: 12 }, (_, i) => { const s = .2 + i * (reach - .3) / 11; return off(s, .18 + .012 * Math.sin(i * 1.7 + dz * 40), dz); }), [elbow[0] - .2, elbow[1] + .3, dz], [elbow[0] - .16, elbow[1] + .9, dz], [elbow[0] - .15, headY - .2, dz]]);
                for (const s of [.5, 1.25, 2.0, 2.7]) boomKit.box(off(s, .18), [.06, .05, .16], jointGrey, [0, 0, lean], false);
                // SGTRC box on a short bracket under the upper boom, its long side along the boom and fins outward.
                boomKit.box(off(2.15, -.2), [.08, .1, .2], jointGrey, [0, 0, lean]);
                sgtrc(boomKit, (x, y) => off(2.15 + y, -.38 - x), lean + Math.PI / 2, .82, .56);
                boomKit.finish(boomMount);
                antennaHead(boomMount, [elbow[0], headY, 0], -Math.PI / 4, .05);
                // Starboard: an upright round mast on a gusseted foot with a collar and a slight jog, a bronze handrail, an SGTRC box swung
                // inboard on two stays and a clipped cable run.
                const mastMount = new THREE.Group(); mastMount.name = 'Prime Ku-band antenna';
                mastMount.position.set(1.3, bandTop + .08, 11.35); group.add(mastMount);
                const mastKit = new Kit();
                mastKit.box([0, .05, 0], [.56, .1, .52], palette.silver);
                for (const z of [-.2, .2]) mastKit.box([0, .2, z], [.44, .22, .04], jointGrey);
                mastKit.cylinder([0, .16, 0], .26, .1, jointGrey, [0, 0, 0]);
                mastKit.cylinder([0, 1.2, 0], .17, 2.1, mastGrey, [0, 0, 0]);
                ring(mastKit, [0, .7, 0], .17, 'y', jointGrey, .025);
                mastKit.cylinder([0, 2.3, 0], .21, .14, jointGrey, [0, 0, 0]);
                mastKit.box([-.02, 2.42, 0], [.36, .1, .3], jointGrey);
                mastKit.cylinder([-.04, 3.31, 0], .14, 1.7, mastGrey, [0, 0, 0]);
                ring(mastKit, [-.04, 3.5, 0], .14, 'y', jointGrey, .022);
                mastKit.cylinder([-.04, 4.18, 0], .17, .08, jointGrey, [0, 0, 0]);
                for (const y of [2.75, 3.45]) mastKit.add(shapes.box, material(bronzeTone, .48, .5), [.1, y, 0], [.12, .04, .04], [0, 0, 0], false);
                mastKit.rod([.16, 2.75, 0], [.16, 3.45, 0], .02, bronzeTone);
                // The SGTRC box hangs from a hinge bracket on the mast's inboard side, swung out on two stays; its fins face up and inboard.
                const hingeY = 1.55, swing = .5, hingeX = -.2, hinged = (x, y) => [hingeX + x * Math.cos(swing) + y * Math.sin(swing), hingeY - x * Math.sin(swing) + y * Math.cos(swing), 0];
                mastKit.box([-.17, hingeY, 0], [.08, .1, .22], jointGrey);
                mastKit.cylinder([hingeX, hingeY, 0], .03, .5, palette.silver);
                sgtrc(mastKit, (x, y) => hinged(-.1 - x, -.46 + y), -swing, .9, .6);
                const stayTop = hinged(-.02, -.9);
                for (const z of [-.14, .14]) tube(mastKit, [stayTop[0], stayTop[1], z], [-.14, .6, z], .018, palette.silver);
                // White cables run up the mast's aft side under clips, with a slack loop at the collar.
                for (const dx of [-.05, 0, .05]) cable(mastKit, [...Array.from({ length: 9 }, (_, i) => { const y = .25 + i * .25; return [dx, y, .2 + .01 * Math.sin(i * 1.3 + dx * 30)]; }), [dx + .04, 2.38, .3], [dx, 2.6, .19], [dx - .04, 3.2, .17], [dx - .04, 4.1, .17]]);
                for (const y of [.5, .95, 1.4, 1.85, 2.75, 3.25, 3.75]) mastKit.box([y > 2.3 ? -.04 : 0, y, y > 2.3 ? .16 : .2], [.16, .05, .05], jointGrey, [0, 0, 0], false);
                mastKit.finish(mastMount);
                const prime = antennaHead(mastMount, [-.04, 4.22, 0], .44, .12);
                trackingDishes.push({ ...prime, baseAzimuth: prime.azimuth.rotation.y, baseElevation: prime.elevation.rotation.x });
                // Deck harnesses: from the mast foot and the boom root forward to the bundle that drops down the forward face.
                for (let k = 0; k < 3; k++) {
                    const d = k * .05;
                    drape([[1.05, bandTop + .1, 11.2 + d], [.55, deckTop + .02, 10.95 + d], [-.1, deckTop + .03, 10.62 + d * .5], [-.5 - d, deckTop, 10.36]]);
                    drape([[-1.62, bandTop + .03, 12.45 - d], [-1.3, deckTop + .02, 12.0 - d], [-.95, deckTop + .03, 11.2], [-.62 - d, deckTop, 10.38]]);
                }
            });
            part('s3payloads', 'AMS-02 & logistics carriers', '25 / EXTERNAL PAYLOADS', 'External payloads on the starboard S3 truss, measured on the supplied GLB and redrawn part by part. The Alpha Magnetic Spectrometer stands on the inboard zenith site and ExPRESS Logistics Carrier 2 outboard; ELC-4 hangs from the inboard nadir site and External Stowage Platform 3 outboard. In this model the zenith sites bridge the mobile-transporter rails.', [['AMS-02 installed', 'MAY 2011'], ['Attach sites shown', '2 zenith · 2 nadir']], [19.35, 7, 4], (kit, group) => {
                group.userData.attachSites = 4;
                for (const name of ['AMS-02', 'ELC-2', 'ELC-4', 'ESP-3']) group.add(seatedPayload(kit, name));
            });
            part('p3payloads', 'ELC-1 & ELC-3 carriers', '26 / EXTERNAL PAYLOADS', 'ExPRESS Logistics Carriers on the port P3 truss, measured on the supplied GLB and redrawn part by part. ELC-3 stands on the zenith attach site and ELC-1 hangs from the nadir site, both at the outboard station, each carrying equipment on both faces of its lattice deck.', [['ELC-1 installed', 'NOV 2009'], ['ELC-3 installed', 'MAY 2011']], [-21.49, 7, 4], (kit, group) => {
                group.userData.attachSites = 2;
                for (const name of ['ELC-3', 'ELC-1']) group.add(seatedPayload(kit, name));
            });

            // Keep the connected Russian modules in one translated frame after PMA-1 is rebuilt.
            // Add to existing placements (including Rassvet's .45 collar adjustment); local geometry and labels stay paired.
            for (const id of ['zarya', 'zvezda', 'nauka', 'prichal', 'soyuz', 'poisk', 'rassvet']) {
                parts.get(id).group.position.add(russianSegmentOffset);
            }
            // Lower the truss with everything it carries; Destiny's strut heads and Canadarm2's base were built at this height.
            for (const id of ['truss', 'power', 'irosa', 'thermal', 's3payloads', 'p3payloads']) parts.get(id).group.position.y -= trussDrop;

            // Reduce all Z1 hardware by 30%, keeping the lower berthing face fixed on Unity.
            const z1Group = parts.get('z1').group, z1Scale = .70;
            const z1Mount = new THREE.Vector3(0, 2.95, 12);
            z1Group.scale.setScalar(z1Scale);
            z1Group.position.copy(z1Mount).multiplyScalar(1 - z1Scale);

            // Animated EVA figure from the supplied USDZ. The source skeleton and loop remain editable here.
            const evaAsset = assetData.evaAsset;
            async function createZ1Maintenance() {
                const frame = new THREE.Group(); frame.name = 'Z1 / EVA maintenance';
                // Author the EVA in station metres while inheriting Z1 selection and visibility.
                frame.scale.setScalar(1 / z1Scale);
                frame.position.copy(z1Group.position).multiplyScalar(-1 / z1Scale); z1Group.add(frame);
                const textures = {};
                await Promise.all(Object.entries(evaAsset.images).map(async ([name, url]) => {
                    const map = await new THREE.TextureLoader().loadAsync(url);
                    map.colorSpace = name.includes('normal') ? THREE.NoColorSpace : THREE.SRGBColorSpace;
                    map.flipY = true; map.wrapS = map.wrapT = THREE.RepeatWrapping;
                    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); textures[name] = map;
                }));
                const surfaces = [
                    new THREE.MeshStandardMaterial({map: textures['material_0_diffuse.jpg'], roughness: .44, metalness: .18, side: THREE.DoubleSide}),
                    new THREE.MeshStandardMaterial({color: new THREE.Color(.133209, .133209, .133209), roughness: .92, side: THREE.DoubleSide}),
                    new THREE.MeshStandardMaterial({map: textures['material_2_diffuse.jpg'], normalMap: textures['material_2_normal.jpg'], roughness: .76, metalness: .08, side: THREE.DoubleSide})
                ];
                const actor = new THREE.Group(); actor.name = 'Floating astronaut'; frame.add(actor);
                const rig = new THREE.Group(); rig.name = 'USDZ skeleton and suit';
                rig.scale.setScalar(evaAsset.modelScale);
                rig.position.fromArray(evaAsset.rootPivot).multiplyScalar(-evaAsset.modelScale); actor.add(rig);
                const rest = pmaArray(evaAsset.rest, Float32Array), bind = pmaArray(evaAsset.bind, Float32Array);
                const bones = evaAsset.parents.map((parent, i) => {
                    const bone = new THREE.Bone(); bone.name = 'evaJoint' + i;
                    new THREE.Matrix4().fromArray(rest, i * 16).decompose(bone.position, bone.quaternion, bone.scale); return bone;
                });
                bones.forEach((bone, i) => (evaAsset.parents[i] < 0 ? rig : bones[evaAsset.parents[i]]).add(bone));
                const skeleton = new THREE.Skeleton(bones, bones.map((_, i) => new THREE.Matrix4().fromArray(bind, i * 16).invert()));
                const skins = evaAsset.meshes.map(definition => {
                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.BufferAttribute(pmaArray(definition.position, Float32Array), 3));
                    geometry.setAttribute('normal', new THREE.BufferAttribute(pmaArray(definition.normal, Float32Array), 3));
                    geometry.setAttribute('uv', new THREE.BufferAttribute(pmaArray(definition.uv, Float32Array), 2));
                    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(pmaArray(definition.skinIndex, Uint16Array), 4));
                    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(pmaArray(definition.skinWeight, Float32Array), 4));
                    geometry.setIndex(new THREE.BufferAttribute(pmaArray(definition.index, Uint32Array), 1));
                    const mesh = new THREE.SkinnedMesh(geometry, surfaces[definition.material]); mesh.name = 'EVA / ' + definition.name;
                    rig.add(mesh); mesh.bind(skeleton, new THREE.Matrix4()); mesh.frustumCulled = false;
                    mesh.castShadow = mesh.receiveShadow = true; return mesh;
                });
                const tracks = [];
                for (const [channel, definition] of Object.entries(evaAsset.animation)) {
                    const times = pmaArray(definition.times, Float32Array), packed = pmaArray(definition.values, Float32Array);
                    for (let joint = 0; joint < bones.length; joint++) {
                        const values = [];
                        for (let sample = 0; sample < times.length; sample++) for (let axis = 0; axis < definition.size; axis++) values.push(packed[(sample * bones.length + joint) * definition.size + axis]);
                        const name = bones[joint].name + '.' + ({rotations: 'quaternion', translations: 'position', scales: 'scale'}[channel]);
                        tracks.push(channel === 'rotations' ? new THREE.QuaternionKeyframeTrack(name, times, values) : new THREE.VectorKeyframeTrack(name, times, values));
                    }
                }
                const clip = new THREE.AnimationClip('Supplied floating loop', evaAsset.duration, tracks);
                const mixer = new THREE.AnimationMixer(rig); mixer.clipAction(clip).play(); mixer.setTime(0);
                const calmJoints = [0, 1, 2, 3, 4, 36, 38];
                const calmPose = calmJoints.map(i => bones[i].quaternion.clone());
                const restRotations = bones.map((_, i) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().fromArray(rest, i * 16)));
                const metal = new THREE.MeshStandardMaterial({color: 0xb9c1bc, roughness: .49, metalness: .46});
                const dark = new THREE.MeshStandardMaterial({color: 0x36433e, roughness: .73, metalness: .18});
                const ivory = new THREE.MeshStandardMaterial({color: 0xe2e6df, roughness: .76, metalness: .08});
                const gold = new THREE.MeshStandardMaterial({color: 0xd0b16b, roughness: .66, metalness: .22});
                // Braided steel line of the safety tether, white webbing of the waist tether.
                const steel = new THREE.MeshStandardMaterial({color: 0x8a959a, roughness: .36, metalness: .62});
                const webbing = new THREE.MeshStandardMaterial({color: 0xd6d8d0, roughness: .9, metalness: 0});
                function mesh(parent, geometry, surface, p = [0, 0, 0]) {
                    const object = new THREE.Mesh(geometry, surface); object.position.fromArray(p);
                    object.castShadow = object.receiveShadow = true; parent.add(object); return object;
                }
                const smooth = value => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
                const ramp = (t, start, end) => smooth((t - start) / (end - start));
                // Monotone cubic through keys, so no segment overshoots its neighbours.
                function monotone(times, values, t) {
                    if (t <= times[0]) return values[0];
                    const last = times.length - 1; if (t >= times[last]) return values[last];
                    let i = 0; while (t > times[i + 1]) i++;
                    const slope = k => (values[k + 1] - values[k]) / (times[k + 1] - times[k]);
                    const tangent = k => {
                        if (k === 0 || k === last) return 0;
                        const a = slope(k - 1), b = slope(k); return a * b <= 0 ? 0 : 2 * a * b / (a + b);
                    };
                    const h = times[i + 1] - times[i], s = (t - times[i]) / h, s2 = s * s, s3 = s2 * s;
                    return (2 * s3 - 3 * s2 + 1) * values[i] + (s3 - 2 * s2 + s) * h * tangent(i) + (-2 * s3 + 3 * s2) * values[i + 1] + (s3 - s2) * h * tangent(i + 1);
                }
                const workPoint = new THREE.Vector3(-1.16, 5.42, 10.631);
                const panel = new THREE.Group(); panel.name = 'Z1 EVA service panel'; panel.position.set(-1.16, 5.42, 10.682); frame.add(panel);
                mesh(panel, new THREE.BoxGeometry(.28, .34, .048), metal);
                mesh(panel, new THREE.BoxGeometry(.24, .30, .013), ivory, [0, 0, -.030]);
                for (const x of [-.095, .095]) for (const y of [-.12, .12]) mesh(panel, new THREE.CylinderGeometry(.013, .013, .016, 8).rotateX(Math.PI / 2), dark, [x, y, -.044]);
                mesh(panel, new THREE.CylinderGeometry(.025, .025, .012, 12).rotateX(Math.PI / 2), metal, [0, 0, -.045]);
                // The four corner bolts are driven in a cross pattern; each target is a bolt head face.
                const bolts = [[.095, .12], [-.095, -.12], [-.095, .12], [.095, -.12]].map(([x, y]) => new THREE.Vector3(-1.16 + x, 5.42 + y, 10.630));
                const tool = new THREE.Group(); tool.name = 'EVA pistol grip tool'; frame.add(tool);
                mesh(tool, new THREE.BoxGeometry(.09, .09, .16), ivory, [0, .028, .05]);
                mesh(tool, new THREE.BoxGeometry(.056, .14, .065), dark, [0, -.065, 0]);
                mesh(tool, new THREE.CylinderGeometry(.026, .032, .12, 20).rotateX(Math.PI / 2), metal, [0, .028, .18]);
                const bit = mesh(tool, new THREE.CylinderGeometry(.010, .010, .10, 8).rotateX(Math.PI / 2), dark, [0, .028, .27]);
                mesh(tool, new THREE.BoxGeometry(.043, .015, .08), gold, [0, .080, .025]);
                // Put the handle centre at the palm attachment, with the bit above it.
                tool.children.forEach(child => { child.position.y += .065; });
                const toolTipLocal = new THREE.Vector3(0, .093, .32);
                const drillTip = new THREE.Object3D(); drillTip.name = 'Pistol grip tool socket'; drillTip.position.copy(toolTipLocal); tool.add(drillTip);
                // A helical flute makes rotation visible without spinning the glove.
                const flutePoints = Array.from({length: 49}, (_, i) => {
                    const angle = i / 48 * Math.PI * 6;
                    return new THREE.Vector3(.011 * Math.cos(angle), .011 * Math.sin(angle), -.05 + i / 48 * .10);
                });
                mesh(bit, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(flutePoints), 48, .0025, 5, false), metal);
                // Three gold handholds in a line up the port edge of the forward face. The crew member climbs hand over
                // hand on the lower two and works from the top one, which also takes the waist tether.
                const railX = -1.43, railZ = 10.60, holds = [[3.88, 4.24], [4.42, 4.80], [5.00, 5.40]];
                const handrail = new THREE.Group(); handrail.name = 'Z1 forward-face EVA handholds'; frame.add(handrail);
                for (const [low, high] of holds) {
                    for (const y of [low, high]) {
                        mesh(handrail, new THREE.BoxGeometry(.105, .105, .035), metal, [railX, y, 10.715]);
                        mesh(handrail, new THREE.CylinderGeometry(.018, .018, .115, 12).rotateX(Math.PI / 2), gold, [railX, y, 10.66]);
                    }
                    mesh(handrail, new THREE.CylinderGeometry(.020, .020, high - low, 16), gold, [railX, (low + high) / 2, railZ]);
                }
                const railPoint = y => new THREE.Vector3(railX, y, railZ);
                // 85-ft safety tether. The reel rides on the left D-ring extender; its steel line is hooked to the handrail
                // ring around Quest's EVA hatch and fairleaded under both forward Unity handrails and under the lowest
                // handhold. Reel tension keeps every span taut, so only the span to the crew member moves.
                const tetherRoute = [[7.37, -1.265, 11.00], [7.30, -.62, 10.90], [7.05, .20, 10.86], [6.45, .95, 10.92], [6.05, 1.70, 11.00], [5.80, 2.13, 11.22], [3.55, 2.13, 11.22], [3.25, 2.02, 11.00]].map(p => new THREE.Vector3(...p));
                const onUnity = (radius, degrees, z) => { const a = THREE.MathUtils.degToRad(degrees); return new THREE.Vector3(radius * Math.cos(a), radius * Math.sin(a), z); };
                for (let degrees = 45; degrees <= 135; degrees += 10) tetherRoute.push(onUnity(2.26, degrees, 10.17));
                // Up the port edge of the face, then sideways behind the lowest handhold bar, which turns it toward the reel.
                const fairlead = new THREE.Vector3(railX, 3.97, 10.645);
                tetherRoute.push(onUnity(2.27, 139.5, 10.18), onUnity(2.43, 140, 10.24), new THREE.Vector3(-1.74, 2.30, 10.50), new THREE.Vector3(-1.54, 3.30, 10.62),
                    new THREE.Vector3(-1.505, 3.86, 10.642), new THREE.Vector3(-1.475, 3.95, 10.645), fairlead);
                const routeCurve = new THREE.CatmullRomCurve3(tetherRoute, false, 'centripetal');
                const tetherRadius = .006;
                const routedLine = mesh(frame, new THREE.TubeGeometry(routeCurve, 640, tetherRadius, 6, false), steel);
                routedLine.name = 'Safety tether / routed line'; routedLine.castShadow = false;
                const fairleadTangent = routeCurve.getTangentAt(1);
                // The hook gate closes round the hatch ring tube, which runs along x at its forward point.
                const anchor = new THREE.Group(); anchor.name = 'Safety tether hook on the Quest hatch ring'; anchor.position.set(7.37, -1.30, 11.02); frame.add(anchor);
                mesh(anchor, new THREE.TorusGeometry(.036, .0065, 8, 24).rotateY(Math.PI / 2), metal);
                mesh(anchor, new THREE.CylinderGeometry(.007, .007, .05, 8).rotateX(-.55), metal, [0, .046, -.016]);
                // Suit hardware rides on the skeleton: D-rings on the waist bones, the tool mount on the chest.
                function onBone(bone, local) {
                    const group = new THREE.Group(); group.position.fromArray(local); group.scale.setScalar(1 / evaAsset.modelScale);
                    bone.add(group); return group;
                }
                const leftRing = onBone(bones[2], [26.5, -5.4, 8.0]), rightRing = onBone(bones[2], [-26.5, -5.4, 8.0]);
                for (const ring of [leftRing, rightRing]) mesh(ring, new THREE.TorusGeometry(.019, .0045, 6, 18).rotateY(Math.PI / 2), metal);
                const reel = onBone(bones[2], [37.5, -15.3, 5.6]); reel.name = '85-ft safety tether reel';
                mesh(reel, new THREE.BoxGeometry(.066, .125, .105), new THREE.MeshStandardMaterial({color: 0xd2d6cf, roughness: .7, metalness: .1}));
                mesh(reel, new THREE.BoxGeometry(.068, .022, .107), dark, [0, -.035, 0]);
                mesh(reel, new THREE.BoxGeometry(.04, .045, .02), metal, [0, .072, .02]);
                const reelExit = new THREE.Object3D(); reelExit.position.set(.004, -.066, .028); reel.add(reelExit);
                const toolMount = onBone(bones[3], [15.0, -18.2, 29.1]); toolMount.name = 'Mini-workstation tool mount';
                mesh(toolMount, new THREE.BoxGeometry(.05, .03, .04), dark, [0, -.02, -.035]);
                // Stowed, the tool hangs bit-down on the mini-workstation, grip toward the crew member.
                const stowRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.2, .3, 0));
                // Waist tether: webbing from the right D-ring to a large hook, stowed on the ring for the climb.
                const waistHook = new THREE.Group(); waistHook.name = 'Waist tether hook'; frame.add(waistHook);
                mesh(waistHook, new THREE.TorusGeometry(.042, .0065, 8, 28, Math.PI * 1.7), metal);
                mesh(waistHook, new THREE.CylinderGeometry(.0045, .0045, .038, 6).rotateZ(-.47), metal, [.0334, -.017, 0]);
                const hookStow = new THREE.Object3D(); hookStow.position.set(0, -.075, .02); rightRing.add(hookStow);
                // Clipped, the handhold bar runs through the hook loop.
                const hookClip = new THREE.Vector3(railX, 5.06, railZ - .012), hookClipRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
                function flexibleLine(name, count, radius, surface) {
                    const points = Array.from({length: 4}, (_, i) => new THREE.Vector3(0, i * .1, 0));
                    const curve = new THREE.CubicBezierCurve3(...points);
                    const geometry = new THREE.TubeGeometry(curve, count, radius, 6, false);
                    const line = mesh(frame, geometry, surface); line.name = name; line.frustumCulled = false; line.castShadow = false;
                    return {curve, geometry, line, count, radius};
                }
                const tetherSpan = flexibleLine('Safety tether / free span', 48, tetherRadius, steel);
                const waistStrap = flexibleLine('Waist tether webbing', 32, .0075, webbing);
                const toolTether = flexibleLine('Tool tether to mini-workstation', 24, .0028, steel);
                // Rebuild a tube in place along its curve (the same parallel-transport frames TubeGeometry uses).
                function refresh(flex) {
                    const {curve, geometry, count, radius} = flex; curve.updateArcLengths();
                    const frames = curve.computeFrenetFrames(count, false), positions = geometry.attributes.position, normals = geometry.attributes.normal;
                    for (let segment = 0; segment <= count; segment++) {
                        const center = curve.getPointAt(segment / count);
                        for (let side = 0; side <= 6; side++) {
                            const a = side / 6 * Math.PI * 2, normal = frames.normals[segment].clone().multiplyScalar(-Math.cos(a)).addScaledVector(frames.binormals[segment], Math.sin(a));
                            const index = segment * 7 + side;
                            positions.setXYZ(index, center.x + normal.x * radius, center.y + normal.y * radius, center.z + normal.z * radius);
                            normals.setXYZ(index, normal.x, normal.y, normal.z);
                        }
                    }
                    positions.needsUpdate = normals.needsUpdate = true;
                }
                // Source anatomy: +X arm 5/6/7 is LEFT; -X arm 39/40/41 is RIGHT.
                // The legacy asset field rightGrip names the +X arm; keep asset bytes intact.
                const leftGripLocal = new THREE.Vector3(...evaAsset.rightGrip);
                const rightGripLocal = new THREE.Vector3(14.1289751, .3173805, -.0742860);
                const rightHand = bones[41], leftHand = bones[7];
                const axisX = new THREE.Vector3(1, 0, 0), axisY = new THREE.Vector3(0, 1, 0), axisZ = new THREE.Vector3(0, 0, 1), parentRotation = new THREE.Quaternion();
                const worldPoint = (bone, point = new THREE.Vector3()) => bone.localToWorld(point.clone());
                // Rail and pistol grips are both upright bars: the hand points at the face, thumb up.
                const rightOrientation = new THREE.Quaternion().setFromAxisAngle(axisZ, Math.PI / 2)
                    .multiply(new THREE.Quaternion().setFromUnitVectors(rightGripLocal.clone().normalize(), axisZ));
                const leftOrientation = new THREE.Quaternion().setFromAxisAngle(axisZ, -Math.PI / 2)
                    .multiply(new THREE.Quaternion().setFromUnitVectors(leftGripLocal.clone().normalize(), axisZ));
                const rightDown = new THREE.Quaternion().setFromAxisAngle(axisX, Math.PI / 2).multiply(rightOrientation);
                // In the glove the hook sits just ahead of the fist, so pushing the fist to the bar seats the hook on it.
                const clipGrip = hookClip.clone().add(new THREE.Vector3(0, 0, -.055));
                const hookInGlove = hookClip.clone().sub(clipGrip).applyQuaternion(rightOrientation.clone().invert());
                const hookInGloveRotation = rightOrientation.clone().invert().multiply(hookClipRotation);
                function turnBone(bone, from, to) {
                    const delta = new THREE.Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
                    const current = bone.getWorldQuaternion(new THREE.Quaternion());
                    bone.parent.getWorldQuaternion(parentRotation);
                    bone.quaternion.copy(parentRotation.invert().multiply(delta.multiply(current))).normalize();
                    bone.updateWorldMatrix(false, true);
                }
                const actorRotation = new THREE.Quaternion(), worldAxis = new THREE.Vector3(), turn = new THREE.Quaternion();
                // Rotate a bone about an axis given in the crew member's own frame (x left, y up, z forward).
                function bend(bone, axis, angle) {
                    if (!angle) return;
                    worldAxis.copy(axis).applyQuaternion(actorRotation);
                    const current = bone.getWorldQuaternion(new THREE.Quaternion());
                    bone.parent.getWorldQuaternion(parentRotation);
                    bone.quaternion.copy(parentRotation.invert().multiply(turn.setFromAxisAngle(worldAxis, angle).multiply(current))).normalize();
                    bone.updateWorldMatrix(false, true);
                }
                function reachHand(chain, gripLocal, target, orientation, poleLocal) {
                    const desired = frame.getWorldQuaternion(new THREE.Quaternion()).multiply(orientation);
                    const wristTarget = target.clone().sub(gripLocal.clone().multiplyScalar(evaAsset.modelScale).applyQuaternion(desired));
                    const shoulder = worldPoint(bones[chain[0]]), elbow = worldPoint(bones[chain[1]]), wrist = worldPoint(bones[chain[2]]);
                    const upper = shoulder.distanceTo(elbow), lower = elbow.distanceTo(wrist);
                    const direction = wristTarget.clone().sub(shoulder);
                    const distance = Math.min(upper + lower - .003, Math.max(Math.abs(upper - lower) + .003, direction.length()));
                    direction.normalize();
                    const pole = new THREE.Vector3(...poleLocal).transformDirection(frame.matrixWorld);
                    pole.addScaledVector(direction, -pole.dot(direction)).normalize();
                    const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
                    const height = Math.sqrt(Math.max(0, upper * upper - along * along));
                    const elbowTarget = shoulder.clone().addScaledVector(direction, along).addScaledVector(pole, height);
                    turnBone(bones[chain[0]], elbow.clone().sub(shoulder), elbowTarget.sub(shoulder));
                    const elbowNow = worldPoint(bones[chain[1]]), wristNow = worldPoint(bones[chain[2]]);
                    turnBone(bones[chain[1]], wristNow.sub(elbowNow), wristTarget.sub(elbowNow));
                    const hand = bones[chain[2]]; hand.parent.getWorldQuaternion(parentRotation);
                    hand.quaternion.copy(parentRotation.invert().multiply(desired)); hand.updateWorldMatrix(false, true);
                }
                const fingerAxis = new THREE.Vector3(0, 0, -1);
                function closeGlove(chains, thumb, amount) {
                    for (const chain of chains) chain.forEach((index, joint) => {
                        const rotation = restRotations[index].clone().multiply(new THREE.Quaternion().setFromAxisAngle(fingerAxis, [1.02, 1.14, .22][joint]));
                        bones[index].quaternion.slerp(rotation, amount);
                    });
                    // The thumb opposes the fingers without crushing the palm.
                    thumb.forEach((index, joint) => {
                        const rotation = restRotations[index].clone().multiply(new THREE.Quaternion().setFromAxisAngle(fingerAxis, [.48, .55, .18][joint]));
                        bones[index].quaternion.slerp(rotation, amount);
                    });
                }
                // Timeline after NASA EVA practice: translate hand over hand (one hand always on a rail), stop and clip the
                // waist tether to the worksite handhold, take the pistol grip tool from the mini-workstation, then drive the
                // panel bolts in a cross pattern. Motions stay slow: no quick grabs, kicks or swings against the tethers.
                const timings = {climb: 9.8, tether: 13.6, tool: 16.4, bolt: 6.5, workCycle: 28};
                // The climb keeps the handhold line near the body's midline; at the worksite the body settles left of it,
                // so the right hand holds on its own side and the left hand works the panel without crossing the chest.
                const hipKeys = {
                    t: [0, 2.3, 4.7, 7.2, 9.8, 11.4, 12.8, 14.6],
                    x: [-1.43, -1.42, -1.44, -1.41, -1.42, -1.40, -1.33, -1.31],
                    y: [3.80, 3.83, 4.15, 4.46, 4.76, 4.76, 4.76, 4.76],
                    z: [10.14, 10.15, 10.15, 10.14, 10.10, 10.08, 10.07, 10.07]
                };
                const hipsAt = (t, out) => out.set(monotone(hipKeys.t, hipKeys.x, t), monotone(hipKeys.t, hipKeys.y, t), monotone(hipKeys.t, hipKeys.z, t));
                const stowPose = (position, rotation) => {
                    position.copy(frame.worldToLocal(toolMount.getWorldPosition(new THREE.Vector3())));
                    return rotation.copy(frameRotation()).invert().multiply(actor.getWorldQuaternion(new THREE.Quaternion())).multiply(stowRotation);
                };
                const frameRotation = () => frame.getWorldQuaternion(new THREE.Quaternion());
                const standoff = bolt => bolt.clone().add(new THREE.Vector3(0, 0, -.07));
                const identity = new THREE.Quaternion();
                // Tool pose in frame space. Returns the handle centre and rotation, the bit angle and the work phase.
                function toolPose(t, position, rotation) {
                    const state = {spin: 0, running: false, reading: 0, torque: 0, phase: 'stowed', bolt: -1};
                    if (t < 14.9) { stowPose(position, rotation); return state; }
                    const tip = new THREE.Vector3();
                    if (t < timings.tool) {
                        const s = ramp(t, 14.9, timings.tool), from = new THREE.Vector3(), fromRotation = new THREE.Quaternion();
                        stowPose(from, fromRotation);
                        tip.copy(standoff(bolts[0])).sub(toolTipLocal);
                        position.lerpVectors(from, tip, s).add(new THREE.Vector3(.02, .06, -.06).multiplyScalar(Math.sin(Math.PI * s)));
                        rotation.copy(fromRotation).slerp(identity, s);
                        state.phase = 'tool'; return state;
                    }
                    const work = t - timings.tool, cycle = Math.floor(work / timings.workCycle), w = work - cycle * timings.workCycle;
                    const k = Math.min(3, Math.floor(w / timings.bolt)), u = w - k * timings.bolt;
                    const previous = cycle === 0 && k === 0 ? bolts[0] : bolts[(k + 3) % 4];
                    const target = bolts[k], seat = new THREE.Vector3();
                    let tilt = 0, roll = 0, reading = 0;
                    if (w >= 4 * timings.bolt) {
                        // Report torque and turns: the tool is tipped up toward the visor, then back.
                        reading = ramp(w, 26.0, 26.5) * (1 - ramp(w, 27.3, 27.9));
                        tip.copy(standoff(bolts[3])).add(new THREE.Vector3(0, -.03, -.05).multiplyScalar(reading)); tilt = .32 * reading;
                    } else if (u < 1.3) {
                        const s = smooth(u / 1.3);
                        tip.lerpVectors(standoff(previous), standoff(target), s).add(new THREE.Vector3(0, .015, -.035).multiplyScalar(Math.sin(Math.PI * s)));
                        tilt = .04 * Math.sin(Math.PI * s);
                    } else if (u < 2.2) {
                        tip.lerpVectors(standoff(target), target, smooth((u - 1.3) / .9));
                    } else if (u < 5.2) {
                        tip.copy(target);
                        // Seat the socket with two small turns, then hold against the drive reaction.
                        roll = u < 2.5 ? .05 * Math.sin((u - 2.2) / .3 * Math.PI * 4) * (1 - smooth((u - 2.2) / .3)) : -.025 * ramp(u, 2.5, 2.8) * (1 - ramp(u, 4.3, 4.7));
                        state.running = u >= 2.5 && u < 4.5; state.torque = ramp(u, 2.5, 2.8) * (1 - ramp(u, 4.3, 4.7));
                        if (u >= 4.5) reading = .35 * ramp(u, 4.5, 4.8) * (1 - ramp(u, 4.9, 5.2));
                    } else tip.lerpVectors(target, standoff(target), smooth((u - 5.2) / 1.3));
                    rotation.setFromEuler(new THREE.Euler(tilt, 0, roll));
                    position.copy(tip).sub(toolTipLocal.clone().applyQuaternion(rotation));
                    // Bit time: two seconds per bolt, accumulated only while the tool runs.
                    const done = cycle * 4 + (w >= 4 * timings.bolt ? 4 : k + (u >= 4.5 ? 1 : 0));
                    state.spin = done * 2 + (k < 4 && w < 4 * timings.bolt ? THREE.MathUtils.clamp(u - 2.5, 0, 2) * (u < 4.5 ? 1 : 0) : 0);
                    state.reading = reading; state.phase = 'drive'; state.bolt = k;
                    return state;
                }
                // Hand keys: [time, target, orientation, grip, swing, hold]. A target may follow the body; the swing bows
                // the path clear of the rail and the other hand; hold keeps the glove closed on what it carries.
                const leftKeys = [
                    [0, railPoint(4.02), leftOrientation, 1], [1.0, railPoint(4.02), leftOrientation, 1],
                    [2.5, railPoint(4.66), leftOrientation, 1, [.06, 0, -.09]], [6.1, railPoint(4.66), leftOrientation, 1],
                    [7.6, railPoint(5.32), leftOrientation, 1, [.06, 0, -.09]], [13.6, railPoint(5.32), leftOrientation, 1],
                    [14.6, 'tool', 'tool', .15, [.05, -.04, -.12]], [14.9, 'tool', 'tool', 1]
                ];
                const rightKeys = [
                    [0, railPoint(4.50), rightOrientation, 1], [3.6, railPoint(4.50), rightOrientation, 1],
                    [5.1, railPoint(5.08), rightOrientation, 1, [-.06, 0, -.09]], [10.0, railPoint(5.08), rightOrientation, 1],
                    [11.0, 'hook', rightDown, .2, [-.08, .02, -.14]], [11.3, 'hook', rightDown, .85],
                    [12.4, 'clip', rightOrientation, .85, [-.05, .04, -.12], true], [12.7, 'clip', rightOrientation, .85],
                    [13.6, railPoint(5.18), rightOrientation, 1, [-.04, .02, -.07]]
                ];
                const hookPoint = () => frame.worldToLocal(hookStow.getWorldPosition(new THREE.Vector3())).sub(hookInGlove.clone().applyQuaternion(rightDown));
                const resolve = (target, t, toolPosition) => target === 'tool' ? toolPosition.clone() : target === 'hook' ? hookPoint() : target === 'clip' ? clipGrip.clone() : target.clone();
                function handAt(keys, t, toolPosition, toolOrientation) {
                    let i = 0; while (i < keys.length - 1 && t >= keys[i + 1][0]) i++;
                    const key = keys[i], next = keys[Math.min(i + 1, keys.length - 1)];
                    const orient = value => value === 'tool' ? toolOrientation : value;
                    if (i === keys.length - 1 || next === key) return {point: resolve(key[1], t, toolPosition), orientation: orient(key[2]).clone(), grip: key[3]};
                    const s = (t - key[0]) / (next[0] - key[0]), e = smooth(s);
                    const point = resolve(key[1], t, toolPosition).lerp(resolve(next[1], t, toolPosition), e);
                    if (next[4]) point.add(new THREE.Vector3(...next[4]).multiplyScalar(Math.sin(Math.PI * e)));
                    const orientation = orient(key[2]).clone().slerp(orient(next[2]), e);
                    const moving = key[1] !== next[1] || next[4];
                    // Release fast, travel half open, close as the glove arrives.
                    let grip = THREE.MathUtils.lerp(key[3], next[3], smooth((s - .7) / .3));
                    if (moving && next[4] && !next[5]) grip = Math.min(grip, 1 - .78 * smooth(s / .16) * (1 - smooth((s - .74) / .26)));
                    return {point, orientation, grip};
                }
                const hips = new THREE.Vector3(), hipsBefore = new THREE.Vector3(), hipsAfter = new THREE.Vector3();
                const toolPosition = new THREE.Vector3(), toolRotation = new THREE.Quaternion();
                const acceleration = (t, out) => {
                    hipsAt(t - .12, hipsBefore); hipsAt(t + .12, hipsAfter); hipsAt(t, out);
                    return out.multiplyScalar(-2).add(hipsBefore).add(hipsAfter).divideScalar(.0144);
                };
                // Gaze leads the hands: the next handhold, the clip point, then the bolt; each change eases over 0.6 s.
                const gazeKeys = [[0, railPoint(4.66)], [2.6, railPoint(5.08)], [5.2, railPoint(5.32)], [8.6, hookClip], [13.4, bolts[0]]];
                function gazeAt(t, toolPosition) {
                    if (t >= timings.tool) return toolPosition.clone().add(toolTipLocal);
                    let i = 0; while (i < gazeKeys.length - 1 && t >= gazeKeys[i + 1][0] - .6) i++;
                    const [time, point] = gazeKeys[i];
                    const previous = gazeKeys[Math.max(0, i - 1)][1];
                    return previous.clone().lerp(point, i === 0 ? 1 : ramp(t, time - .6, time));
                }
                let time = 0, initialized = false, phase = 'climb', drilling = false;
                const update = delta => {
                    if (initialized && delta <= 0) return;
                    time += Math.max(0, delta);
                    const t = time;
                    // Base posture: the supplied loop slowed right down for the limbs, the torso held calm.
                    mixer.setTime(t * .22);
                    calmJoints.forEach((index, i) => bones[index].quaternion.copy(calmPose[i].clone().slerp(bones[index].quaternion, .24)));
                    bones[0].position.fromArray(evaAsset.rootPivot);
                    // Body: pulled up between grips, then settled at the worksite. Lean, roll and drift stay small,
                    // and the body eases toward whichever bolt the tool is on.
                    hipsAt(t, hips);
                    const climbing = 1 - ramp(t, 9.4, 11.4), working = ramp(t, 14.9, timings.tool + 1.2);
                    const toolState = toolPose(t, toolPosition, toolRotation);
                    const lagged = new THREE.Vector3(), lagRotation = new THREE.Quaternion();
                    toolPose(Math.max(0, t - .45), lagged, lagRotation);
                    const reach = lagged.sub(new THREE.Vector3(-1.16, 5.32, 10.31)).multiplyScalar(working);
                    const sway = new THREE.Vector3(Math.sin(t * .29) * .012, Math.sin(t * .41 + 1) * .010, Math.sin(t * .23 + 2) * .008);
                    actor.position.copy(hips).add(sway).add(new THREE.Vector3(reach.x * .2, reach.y * .25, 0));
                    const pull = new THREE.Vector3(); acceleration(t, pull);
                    // Roll eases toward the reaching hand; the drive reaction yaws the body slightly while the tool runs.
                    const bump = (start, end) => { const s = THREE.MathUtils.clamp((t - start) / (end - start), 0, 1); return Math.sin(Math.PI * s) ** 2; };
                    const side = bump(1.0, 2.5) - bump(3.6, 5.1) + bump(6.1, 7.6);
                    const reaction = .010 * toolState.torque;
                    actor.rotation.set(-.03 - .03 * climbing - THREE.MathUtils.clamp(pull.y * .15, -.03, .03) + Math.sin(t * .32) * .008,
                        .07 + .025 * Math.sin(t * .27) + reaction - .03 * reach.x,
                        .06 + .025 * side * climbing + Math.sin(t * .35) * .008);
                    actor.updateWorldMatrix(true, true); actor.getWorldQuaternion(actorRotation);
                    // Waist bearing: a slight bend toward the face while pulling and while reaching for the bolts.
                    bend(bones[1], axisX, .03 * climbing + .05 * working * ramp(reach.y, -.2, .2));
                    // Pressurised legs stay nearly straight; they hang soft and lag the pulls, flexing a little more as the body is drawn up.
                    const lagPull = new THREE.Vector3(); acceleration(Math.max(0, t - .35), lagPull);
                    const swing = THREE.MathUtils.clamp(lagPull.y * .35, -.08, .08);
                    for (const [thigh, shin, foot, phaseOffset, flex] of [[77, 78, 79, 0, .07], [83, 84, 85, 1.7, .12]]) {
                        bend(bones[thigh], axisX, -(flex + swing * .6 + .035 * Math.sin(t * .37 + phaseOffset)));
                        bend(bones[shin], axisX, .14 + flex * .5 + swing + .035 * Math.sin(t * .31 + phaseOffset * 1.3));
                        bend(bones[foot], axisX, .12 + .03 * Math.sin(t * .43 + phaseOffset));
                    }
                    // The helmet is fixed to the hard upper torso, so gaze shows mostly through the body; the head turns a few
                    // degrees toward the next handhold or the bolt.
                    const gaze = gazeAt(t, toolPosition);
                    const look = frame.localToWorld(gaze).sub(bones[37].getWorldPosition(new THREE.Vector3())).applyQuaternion(actorRotation.clone().invert());
                    bend(bones[37], axisY, THREE.MathUtils.clamp(Math.atan2(look.x, look.z), -.5, .5) * .18);
                    bend(bones[37], axisX, -THREE.MathUtils.clamp(Math.atan2(look.y, Math.hypot(look.x, look.z)), -.6, .6) * .16 - toolState.reading * .12);
                    frame.updateWorldMatrix(true, true);
                    if (t < timings.tool) toolPose(t, toolPosition, toolRotation);
                    const toolOrientation = toolRotation.clone().multiply(leftOrientation);
                    const right = handAt(rightKeys, t, toolPosition, toolOrientation), left = handAt(leftKeys, t, toolPosition, toolOrientation);
                    closeGlove([[45,46,47],[48,49,50],[51,52,53],[54,55,56]], [42,43,44], right.grip);
                    closeGlove([[11,12,13],[14,15,16],[17,18,19],[20,21,22]], [8,9,10], left.grip);
                    reachHand([39,40,41], rightGripLocal, frame.localToWorld(right.point), right.orientation, [-.70, -.55, -.18]);
                    reachHand([5,6,7], leftGripLocal, frame.localToWorld(left.point), left.orientation, [.70, -.55, -.18]);
                    // The tool follows the glove once taken; before that it rides on the mini-workstation.
                    if (t >= 14.9) {
                        tool.position.copy(frame.worldToLocal(worldPoint(leftHand, leftGripLocal)));
                        tool.quaternion.copy(frameRotation().invert().multiply(leftHand.getWorldQuaternion(new THREE.Quaternion()))).multiply(leftOrientation.clone().invert());
                    } else { tool.position.copy(toolPosition); tool.quaternion.copy(toolRotation); }
                    bit.rotation.z = toolState.spin * 18;
                    phase = t < timings.climb ? 'climb' : t < timings.tether ? 'tether' : t < timings.tool ? 'tool' : 'drive';
                    drilling = toolState.running;
                    // Waist tether hook: stowed on the right D-ring, carried in the right glove, then clipped to the handhold.
                    const stowed = frame.worldToLocal(hookStow.getWorldPosition(new THREE.Vector3()));
                    const stowedRotation = frameRotation().invert().multiply(hookStow.getWorldQuaternion(new THREE.Quaternion()));
                    const gloveRotation = frameRotation().invert().multiply(rightHand.getWorldQuaternion(new THREE.Quaternion()));
                    const inGlove = frame.worldToLocal(worldPoint(rightHand, rightGripLocal)).add(hookInGlove.clone().applyQuaternion(gloveRotation));
                    const taken = ramp(t, 11.0, 11.3), clipped = ramp(t, 12.4, 12.7);
                    waistHook.position.copy(stowed).lerp(inGlove, taken).lerp(hookClip, clipped);
                    waistHook.quaternion.copy(stowedRotation).slerp(gloveRotation.clone().multiply(hookInGloveRotation), taken).slerp(hookClipRotation, clipped);
                    // Webbing: slack bows out to the right side, clear of the suit; stowed, it is a short loop beside the ring.
                    const ringPoint = frame.worldToLocal(rightRing.getWorldPosition(new THREE.Vector3()));
                    const hookEnd = waistHook.position.clone().add(new THREE.Vector3(-.042, 0, 0).applyQuaternion(waistHook.quaternion));
                    const strapLength = THREE.MathUtils.lerp(.13, .75, taken), gap = ringPoint.distanceTo(hookEnd);
                    const bow = Math.sqrt(Math.max(0, strapLength * strapLength - gap * gap)) * .55;
                    const away = new THREE.Vector3(-.75, -.35, .45).applyQuaternion(actor.quaternion).normalize().multiplyScalar(bow);
                    waistStrap.curve.v0.copy(ringPoint); waistStrap.curve.v3.copy(hookEnd);
                    waistStrap.curve.v1.lerpVectors(ringPoint, hookEnd, .3).add(away); waistStrap.curve.v2.lerpVectors(ringPoint, hookEnd, .7).add(away);
                    refresh(waistStrap);
                    // Safety tether span: leaves the reel downward, enters the fairlead along the routed line, and bows a
                    // little against the motion because the reel takes up slack with a delay.
                    const exit = frame.worldToLocal(reelExit.getWorldPosition(new THREE.Vector3()));
                    const exitDirection = new THREE.Vector3(0, -1, .25).applyQuaternion(frameRotation().invert().multiply(reel.getWorldQuaternion(new THREE.Quaternion()))).normalize();
                    const span = exit.distanceTo(fairlead);
                    const velocity = new THREE.Vector3(); hipsAt(t + .2, velocity); velocity.sub(hipsAt(Math.max(0, t - .2), new THREE.Vector3())).divideScalar(.4);
                    const lag = velocity.multiplyScalar(-.22).clampLength(0, .06).add(new THREE.Vector3(.012 * Math.sin(t * .5), 0, -.015));
                    tetherSpan.curve.v0.copy(fairlead); tetherSpan.curve.v3.copy(exit);
                    tetherSpan.curve.v1.copy(fairlead).addScaledVector(fairleadTangent, Math.min(.12, span * .1)).add(lag.clone().multiplyScalar(.6));
                    tetherSpan.curve.v2.copy(exit).addScaledVector(exitDirection, Math.min(.18, span * .14)).add(lag);
                    refresh(tetherSpan);
                    // Tool tether: retracts into the mini-workstation while the tool is stowed.
                    toolTether.line.visible = t >= 14.9;
                    if (toolTether.line.visible) {
                        const mount = frame.worldToLocal(toolMount.getWorldPosition(new THREE.Vector3()));
                        const butt = frame.worldToLocal(tool.localToWorld(new THREE.Vector3(0, -.075, -.02)));
                        toolTether.curve.v0.copy(mount); toolTether.curve.v3.copy(butt);
                        toolTether.curve.v1.lerpVectors(mount, butt, .33).add(new THREE.Vector3(0, -.03, -.01));
                        toolTether.curve.v2.lerpVectors(mount, butt, .66).add(new THREE.Vector3(0, -.03, -.01));
                        refresh(toolTether);
                    }
                    frame.updateWorldMatrix(true, true); skeleton.update(); initialized = true;
                };
                update(0);
                for (const skin of skins) { skin.computeBoundingBox(); skin.boundingBox.expandByScalar(30); skin.computeBoundingSphere(); skin.boundingSphere.radius += 30; }
                frame.userData = {role: 'Z1 hand-over-hand climb, waist tether clipped at the worksite, pistol grip tool on four panel bolts', asset: evaAsset.source, author: evaAsset.author, animationDuration: evaAsset.duration, safetyTether: 'Quest EVA hatch handrail ring', timings};
                return {frame, actor, rig, skeleton, skins, mixer, tool, bit, drillTip, handrail, panel, bones, bolts, workPoint, rightHand, leftHand, timings, update,
                    routedLine, tetherSpan: tetherSpan.line, waistStrap: waistStrap.line, waistHook, toolTether: toolTether.line, reel, anchor, routeCurve, fairlead,
                    rightGripWorld: () => worldPoint(rightHand, rightGripLocal), leftGripWorld: () => worldPoint(leftHand, leftGripLocal),
                    railPointWorld: y => frame.localToWorld(railPoint(y)), drillTipWorld: () => drillTip.getWorldPosition(new THREE.Vector3()),
                    boltWorld: k => frame.localToWorld(bolts[k].clone()), reelExitWorld: () => reelExit.getWorldPosition(new THREE.Vector3()),
                    restart: () => { time = 0; initialized = false; update(0); },
                    get time() {return time;}, get phase() {return phase;}, get drilling() {return drilling;}};
            }
            const z1EVA = await createZ1Maintenance();

            const orbitalGroup = new THREE.Group(); orbitalGroup.visible = false; scene.add(orbitalGroup);
            const earthMaterial = new THREE.MeshStandardMaterial({ color: 0x92b8c3, roughness: .95, metalness: 0 });
            const earth = new THREE.Mesh(new THREE.SphereGeometry(140, 80, 48), earthMaterial); orbitalGroup.add(earth);
            const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(142, 64, 32), new THREE.ShaderMaterial({ uniforms: { glowColor: { value: new THREE.Color(0x57aac8) } }, vertexShader: 'varying vec3 surfaceNormal; varying vec3 viewDirection; void main(){ vec4 viewPosition=modelViewMatrix*vec4(position,1.0); surfaceNormal=normalize(normalMatrix*normal); viewDirection=normalize(-viewPosition.xyz); gl_Position=projectionMatrix*viewPosition; }', fragmentShader: 'uniform vec3 glowColor; varying vec3 surfaceNormal; varying vec3 viewDirection; void main(){ float intensity=pow(1.0-max(dot(normalize(surfaceNormal),normalize(viewDirection)),0.0),4.0); gl_FragColor=vec4(glowColor,intensity*0.6); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); orbitalGroup.add(atmosphere);
            const starPositions = [];
            let seed = 37;
            function random() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
            for (let star = 0; star < 850; star++) { const angle = random() * Math.PI * 2, verticalPosition = random() * 2 - 1, spread = Math.sqrt(1 - verticalPosition * verticalPosition); starPositions.push(Math.cos(angle) * spread * 750, verticalPosition * 750, Math.sin(angle) * spread * 750); }
            const starsGeometry = new THREE.BufferGeometry(); starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
            orbitalGroup.add(new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: 0xe1e8da, size: .85, sizeAttenuation: true, transparent: true, opacity: .65, depthWrite: false })));
            let earthTextureState = 'unrequested';
            function loadEarth() {
                if (earthTextureState !== 'unrequested') return;
                earthTextureState = 'loading';
                new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg', texture => { texture.colorSpace = THREE.SRGBColorSpace; earthMaterial.map = texture; earthMaterial.color.set(0xffffff); earthMaterial.needsUpdate = true; earthTextureState = 'ready'; render(); }, undefined, () => { earthTextureState = 'failed'; notify('Earth imagery is unavailable. The station remains available.'); });
            }
            const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
            let motion = !reducedMotion.matches, labelsEnabled = false, selected = null, currentView = 'reverse', configuration = 'modern', orbital = false, elapsed = 0;
            const inspector = document.getElementById('inspector');
            const componentSelect = document.getElementById('component-select');
            for (const entry of parts.values()) {
                const option = document.createElement('option'); option.value = entry.id; option.textContent = entry.name; componentSelect.appendChild(option);
            }
            componentSelect.addEventListener('change', () => {
                if (componentSelect.value) { const id = componentSelect.value; selectPart(id); focusPart(id); }
                else { selectPart(null); setView('reverse'); }
            });
            const assemblySource = ['NASA · Assembly elements', 'https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/'];
            const detailSources = {
                destiny: ['NASA · Destiny and its observation window', 'https://www.nasa.gov/international-space-station/destiny-laboratory-module/'],
                poisk: ["NASA · Poisk MRM-2", "https://www.nasa.gov/international-space-station/poisk-mini-research-module-2-yezof/"],
                rassvet: ["NASA · Rassvet MRM-1", "https://www.nasa.gov/international-space-station/rassvet-mini-research-module/"],
                prichal: ["NASA · Nauka experiment airlock", "https://www.nasa.gov/blogs/spacestation/2023/05/03/cosmonauts-move-experiment-airlock-and-complete-spacewalk/"],
                soyuz: ['ESA · Soyuz modules and hardware', 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/The_Russian_Soyuz_spacecraft'],
                beam: ["NASA · BEAM dimensions and aft attachment", "https://www.nasa.gov/international-space-station/bigelow-expandable-activity-module-beam/"],
                bishop: ["NASA · Bishop port-side installation", "https://www.nasa.gov/blogs/spacestation/2020/12/21/new-science-airlock-expands-stations-research-capacity/"],
                z1: ['JAXA · Z1 structure and systems', 'https://iss.jaxa.jp/iss/3a/mis_z1truss_e.html'],
                irosa: ['NASA · June 2023 array installation', 'https://www.nasa.gov/blogs/spacestation/2023/06/15/nasa-spacewalkers-finish-installing-roll-out-solar-array/'],
                thermal: ['NASA · Thermal systems, p. 203', 'https://www.nasa.gov/wp-content/uploads/2018/04/iss-operating_an_outpost-tagged.pdf'],
                truss: ['NASA · Station systems reference', 'https://www.nasa.gov/wp-content/uploads/2018/04/iss-operating_an_outpost-tagged.pdf'],
                tranquility: ['ESA · Cupola architecture', 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Node-3_Cupola/Cupola'],
                robotics: ['CSA · How Canadarm2 works', 'https://www.asc-csa.gc.ca/eng/iss/canadarm2/about.asp'],
                kibo: ['JAXA · Kibo components', 'https://humans-in-space.jaxa.jp/en/kibo/structure/'],
                leonardo: ['NASA · Leonardo relocation', 'https://www.nasa.gov/international-space-station/permanent-multipurpose-module/'],
                harmony: ['NASA · International docking adapter', 'https://www.nasa.gov/missions/station/meet-the-international-docking-adapter/'],
                nauka: ['ESA · European Robotic Arm', 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/International_Space_Station/European_Robotic_Arm']
            };
            const labelLayer = document.getElementById('labels'), leaders = document.getElementById('leaders');
            const approachHud = document.getElementById('approach-hud'), approachDistLine = document.getElementById('approach-dist-line'), approachPortDot = document.getElementById('approach-port-dot'), approachDragonDot = document.getElementById('approach-dragon-dot'), approachDistBadge = document.getElementById('approach-distance-badge');
            const svgNamespace = 'http://www.w3.org/2000/svg';
            const labelSpecs = [['power', '02 / POWER', 'Solar array wings', 65, -58], ['thermal', '04 / THERMAL', 'Heat-rejection radiators', 52, 45], ['kibo', '08 / RESEARCH', 'Kibo laboratory', -133, -25], ['robotics', '19 / ROBOTICS', 'Canadarm2', 58, -44], ['zvezda', '14 / RUSSIAN SEGMENT', 'Zvezda', 60, 38], ['dragon', '17 / CREW', 'Crew Dragon', -100, 40]];
            const labels = labelSpecs.map(([id, code, title, offsetX, offsetY]) => {
                const element = document.createElement('button'); element.className = 'annotation'; element.innerHTML = '<span>' + code + '</span><b>' + title + '</b>'; element.setAttribute('aria-label', parts.get(id).name + ' details'); element.addEventListener('click', () => selectPart(id)); labelLayer.appendChild(element);
                const line = document.createElementNS(svgNamespace, 'path'), dot = document.createElementNS(svgNamespace, 'circle'); dot.setAttribute('r', '2'); leaders.append(line, dot);
                return { id, element, line, dot, offsetX, offsetY };
            });
            function setPressed(id, value) { document.getElementById(id).setAttribute('aria-pressed', String(value)); }
            setPressed('motion-toggle', motion);
            let toastTimer;
            function notify(message) { const toast = document.getElementById('toast'); toast.textContent = message; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 3500); }
            // Ghost context: while a part is selected, every other visible part drops to 10% opacity and keeps only its line
            // art, the crease (> 50°) and boundary edges of its meshes. Line art is built once, in idle slices after load, one
            // parent group at a time, so moving assemblies (wings, dishes, shutters, Dragon) carry their own. It lives on
            // layer 1, which the camera renders but picking and shadows ignore.
            const ghostOpacity = .1, lineArtDegrees = 50, lineArtLayer = 1;
            const lineArtMaterial = new THREE.LineBasicMaterial({ color: 0x43544e, transparent: true, opacity: .42, depthWrite: false });
            const ghostMaterials = new Map();
            camera.layers.enable(lineArtLayer);
            function ghostMaterial(source) {
                let ghost = ghostMaterials.get(source);
                if (!ghost) {
                    ghost = source.clone();
                    Object.assign(ghost, { transparent: true, opacity: (source.transparent ? source.opacity : 1) * ghostOpacity, depthWrite: false, alphaTest: 0 });
                    ghost.emissive?.set(0x000000); ghost.needsUpdate = true;
                    ghostMaterials.set(source, ghost);
                }
                return ghost;
            }
            // Crease and boundary edges, as THREE.EdgesGeometry finds them, but on typed-array hashes rather than string
            // keys: corners weld on a 0.1 mm grid, and an edge shared by two faces is kept when their normals part by more
            // than the threshold. Returns segment end points.
            function creaseSegments(geometry, degrees) {
                const position = geometry.attributes.position, index = geometry.index, corners = index ? index.count : position.count;
                const cosLimit = Math.cos(degrees * Math.PI / 180), tableSize = count => 1 << Math.ceil(Math.log2(Math.max(16, count * 2)));
                const weldSize = tableSize(position.count), weldSlots = new Int32Array(weldSize).fill(-1), grid = new Int32Array(position.count * 3), weld = new Int32Array(position.count);
                let welded = 0;
                for (let v = 0; v < position.count; v++) {
                    const x = Math.round(position.getX(v) * 1e4), y = Math.round(position.getY(v) * 1e4), z = Math.round(position.getZ(v) * 1e4);
                    let slot = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & (weldSize - 1);
                    for (;;) {
                        const id = weldSlots[slot];
                        if (id === -1) { weldSlots[slot] = welded; grid[welded * 3] = x; grid[welded * 3 + 1] = y; grid[welded * 3 + 2] = z; weld[v] = welded++; break; }
                        if (grid[id * 3] === x && grid[id * 3 + 1] === y && grid[id * 3 + 2] === z) { weld[v] = id; break; }
                        slot = (slot + 1) & (weldSize - 1);
                    }
                }
                const edgeSize = tableSize(corners), edgeLow = new Int32Array(edgeSize).fill(-1), edgeHigh = new Int32Array(edgeSize), edgeFace = new Int32Array(edgeSize);
                const edgeFrom = new Int32Array(edgeSize), edgeTo = new Int32Array(edgeSize), edgeUses = new Uint8Array(edgeSize), normals = new Float32Array(corners), segments = [];
                const visit = (face, from, to) => {
                    const a = weld[from], b = weld[to], low = Math.min(a, b), high = Math.max(a, b);
                    let slot = (Math.imul(low, 0x9e3779b1) ^ Math.imul(high, 0x85ebca77)) & (edgeSize - 1);
                    for (;;) {
                        if (edgeLow[slot] === -1) { edgeLow[slot] = low; edgeHigh[slot] = high; edgeFace[slot] = face; edgeFrom[slot] = from; edgeTo[slot] = to; edgeUses[slot] = 1; return; }
                        if (edgeLow[slot] === low && edgeHigh[slot] === high) {
                            const other = edgeFace[slot] * 3, own = face * 3;
                            if (edgeUses[slot] === 1 && normals[other] * normals[own] + normals[other + 1] * normals[own + 1] + normals[other + 2] * normals[own + 2] <= cosLimit) segments.push(from, to);
                            edgeUses[slot] = 2; return;
                        }
                        slot = (slot + 1) & (edgeSize - 1);
                    }
                };
                for (let face = 0; face < corners / 3; face++) {
                    const i0 = index ? index.getX(face * 3) : face * 3, i1 = index ? index.getX(face * 3 + 1) : face * 3 + 1, i2 = index ? index.getX(face * 3 + 2) : face * 3 + 2;
                    if (weld[i0] === weld[i1] || weld[i1] === weld[i2] || weld[i0] === weld[i2]) continue;
                    const ux = position.getX(i1) - position.getX(i0), uy = position.getY(i1) - position.getY(i0), uz = position.getZ(i1) - position.getZ(i0);
                    const vx = position.getX(i2) - position.getX(i0), vy = position.getY(i2) - position.getY(i0), vz = position.getZ(i2) - position.getZ(i0);
                    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, length = Math.hypot(nx, ny, nz);
                    if (length < 1e-12) continue;
                    normals[face * 3] = nx / length; normals[face * 3 + 1] = ny / length; normals[face * 3 + 2] = nz / length;
                    visit(face, i0, i1); visit(face, i1, i2); visit(face, i2, i0);
                }
                for (let slot = 0; slot < edgeSize; slot++) if (edgeUses[slot] === 1) segments.push(edgeFrom[slot], edgeTo[slot]);
                const points = new Float32Array(segments.length * 3);
                for (let i = 0; i < segments.length; i++) { points[i * 3] = position.getX(segments[i]); points[i * 3 + 1] = position.getY(segments[i]); points[i * 3 + 2] = position.getZ(segments[i]); }
                return points;
            }
            function scheduleLineArt() {
                const jobs = new Map();
                for (const entry of parts.values()) entry.group.traverse(child => {
                    if (!child.isMesh || child.isSkinnedMesh || child.userData.interior) return;
                    if (!jobs.has(child.parent)) jobs.set(child.parent, { entry, parent: child.parent, meshes: [] });
                    jobs.get(child.parent).meshes.push(child);
                });
                const queue = [...jobs.values()];
                const build = job => {
                    const pieces = [];
                    for (const mesh of job.meshes) {
                        const points = creaseSegments(mesh.geometry, lineArtDegrees);
                        if (!points.length) continue;
                        mesh.updateMatrix();
                        pieces.push(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(points, 3)).applyMatrix4(mesh.matrix));
                    }
                    if (!pieces.length) return;
                    const lines = new THREE.LineSegments(pieces.length > 1 ? mergeGeometries(pieces, false) : pieces[0], lineArtMaterial);
                    lines.userData.lineArt = true; lines.layers.set(lineArtLayer); lines.visible = !!job.entry.ghost; job.parent.add(lines);
                };
                const later = step => window.requestIdleCallback ? requestIdleCallback(step, { timeout: 250 }) : setTimeout(step, 16);
                const step = () => {
                    const start = performance.now();
                    while (queue.length && performance.now() - start < 10) build(queue.shift());
                    if (queue.length) later(step);
                };
                later(step);
            }
            // Ghost every visible part except the selection (Dragon keeps Harmony solid, its docking target).
            function applyGhost() {
                const solid = selected ? new Set(selected === 'dragon' ? dragonDetail === 'cabin' ? ['dragon'] : ['dragon', 'harmony'] : [selected]) : null;
                for (const entry of parts.values()) {
                    const ghost = solid !== null && !solid.has(entry.id);
                    if (!!entry.ghost === ghost) continue;
                    entry.ghost = ghost;
                    entry.group.traverse(child => {
                        if (child.userData.lineArt) { child.visible = ghost; return; }
                        if (!child.isMesh) return;
                        if (ghost) {
                            child.userData.solidMaterial = child.material; child.userData.solidShadow = child.castShadow;
                            child.material = Array.isArray(child.material) ? child.material.map(ghostMaterial) : ghostMaterial(child.material); child.castShadow = false;
                        } else if (child.userData.solidMaterial) {
                            child.material = child.userData.solidMaterial; child.castShadow = child.userData.solidShadow;
                            delete child.userData.solidMaterial; delete child.userData.solidShadow;
                        }
                    });
                }
            }
            function selectPart(id) {
                setDragonShell(0);
                if (currentView === 'detail' && (id !== selected || !id)) setView('reverse');
                if (id && id !== 'columbus' && currentView === 'interior') setView('reverse');
                if (id && modernParts.has(id) && configuration === 'reference') setConfiguration('modern');
                if (id === 'destiny' && selected !== 'destiny') destinyDetail = 'supports';
                if (id === 'dragon' && selected !== 'dragon') dragonDetail = 'approach';
                if (id === 'z1' && selected !== 'z1') z1EVA.restart();
                selected = id; componentSelect.value = id || "";
                document.querySelectorAll('.milestone').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.part === id)));
                for (const entry of parts.values()) entry.group.traverse(child => {
                    // A ghosted mesh keeps its solid material aside; the highlight belongs on that one.
                    const surface = child.userData.solidMaterial || child.material;
                    if (child.isMesh && !child.userData.interior) { surface.emissive?.set(entry.id === id ? 0x2e7c66 : 0x000000); if (surface.emissive) surface.emissiveIntensity = entry.id === id ? .16 : 0; }
                    if (child.userData.outline && !child.userData.interior) { child.material.color.set(entry.id === id ? 0x14776d : 0x43544e); child.material.opacity = entry.id === id ? .8 : .38; }
                });
                applyGhost();
                setDragonShell(id === 'dragon' ? dragonDetail === 'cabin' ? ghostOpacity : .25 : 0);
                inspector.hidden = !id;
                document.getElementById('eva-asset-credit').hidden = id !== 'z1';
                document.getElementById('dragon-asset-credit').hidden = id !== 'dragon';
                document.getElementById('columbus-asset-credit').hidden = id !== 'columbus';
                document.getElementById('destiny-tools').hidden = id !== 'destiny';
                document.getElementById('dragon-tools').hidden = id !== 'dragon';
                setPressed('dragon-approach', dragonDetail === 'approach');
                setPressed('dragon-cabin', dragonDetail === 'cabin');
                document.getElementById('shutter-controls').hidden = destinyDetail !== 'window';
                setPressed('destiny-supports', destinyDetail === 'supports');
                setPressed('destiny-window', destinyDetail === 'window');
                if (id) {
                    const entry = parts.get(id), windowDetail = id === 'destiny' && destinyDetail === 'window', cabinDetail = id === 'dragon' && dragonDetail === 'cabin';
                    document.getElementById('detail-code').textContent = entry.category; document.getElementById('detail-title').textContent = entry.name;
                    document.getElementById('detail-description').textContent = windowDetail
                        ? 'The Earth-facing observation window has a 0.508 m clear aperture and four panes. Its external shutter protects the glass. This close-up demonstrates the hinged cover; the outline, opening angle and timing are illustrative.'
                        : cabinDetail ? 'The docked capsule with its hull 90% transparent. Four crew in SpaceX suits recline on the seat pallet under the flight display, with cargo stowed on the floor beneath them. The crew member in the outboard seat raises an arm, turns the hand palm-down and touches the display with the index finger. Below the floor, the service bay holds propellant tanks between radial bulkheads. The suit is measured from the supplied model and seated for this view; the seats, display and bay layout are illustrative.'
                        : id === 'destiny' ? 'Two forward bipods and two aft tripods connect S0 to Destiny. Ten adjustable legs converge on four mounted shoes, with captive bolts, telescoping collars and secured cable runs. Small fittings and attachment positions are schematic.' : entry.description;
                    const [sourceLabel, sourceUrl] = id === 'destiny' ? windowDetail
                        ? ['NASA · Observation window', 'https://science.nasa.gov/earth/earth-observatory/human-spaceflight-factsheet/']
                        : ['NASA · STS-110 support hardware', 'https://www.nasa.gov/wp-content/uploads/2023/05/spk-110-press-kit.pdf']
                        : detailSources[id] || assemblySource;
                    const detailFacts = windowDetail ? [['Clear aperture', '0.508 m'], ['Glass assembly', '4 panes']] : cabinDetail ? [['Crew', '4 seated'], ['Docked to', 'Harmony forward']] : entry.facts;
                    const source = document.getElementById('detail-reference'); source.href = sourceUrl; source.textContent = sourceLabel + ' ↗';
                    const facts = document.getElementById('detail-facts'); facts.replaceChildren();
                    for (const [name, value] of detailFacts) { const pair = document.createElement('div'), term = document.createElement('dt'), definition = document.createElement('dd'); term.textContent = name; definition.textContent = value; pair.append(term, definition); facts.append(pair); }
                }
                render();
            }
            function cameraDirection(name) {
                if (name === 'interior') return new THREE.Vector3(75, 115, -190);
                if (name === 'zenith') return new THREE.Vector3(0, 240, .01);
                if (name === 'forward') return new THREE.Vector3(0, 44, -240);
                if (name === 'reverse') return new THREE.Vector3(155, 185, -155);
                return new THREE.Vector3(-155, 185, -155);
            }
            const stationBounds = new THREE.Box3();
            function setConfiguration(name) {
                configuration = name;
                for (const entry of parts.values()) entry.group.visible = !modernParts.has(entry.id) || name === 'modern';
                stationBounds.makeEmpty();
                for (const entry of parts.values()) if (entry.group.visible) stationBounds.expandByObject(entry.group);
                stationBounds.union(dragonFlightBounds);
                setPressed('configuration-toggle', name === 'modern');
                document.getElementById('configuration-name').textContent = name === 'modern' ? 'JUNE 2023 / ILLUSTRATIVE CONFIGURATION' : 'CORE ELEMENTS / SIMPLIFIED COMPARISON';
                if (selected && !parts.get(selected).group.visible) selectPart(null);
                setView(currentView === 'detail' ? 'reverse' : currentView);
            }
            function fitBox(bounds, direction, margin = 1.16) {
                const damping = controls.enableDamping;
                controls.enableDamping = false; controls.update(0); controls.enableDamping = damping;
                const center = bounds.getCenter(new THREE.Vector3());
                controls.target.copy(center); camera.up.set(0, 1, 0); camera.position.copy(center).add(direction); camera.lookAt(center); camera.updateMatrixWorld(true);
                const inverse = camera.matrixWorldInverse;
                let minimumX = Infinity, maximumX = -Infinity, minimumY = Infinity, maximumY = -Infinity;
                for (const across of [bounds.min.x, bounds.max.x]) for (const height of [bounds.min.y, bounds.max.y]) for (const depth of [bounds.min.z, bounds.max.z]) {
                    const projected = new THREE.Vector3(across, height, depth).applyMatrix4(inverse); minimumX = Math.min(minimumX, projected.x); maximumX = Math.max(maximumX, projected.x); minimumY = Math.min(minimumY, projected.y); maximumY = Math.max(maximumY, projected.y);
                }
                const width = viewport.clientWidth, height = Math.max(1, viewport.clientHeight);
                const chrome = document.querySelector('.viewport-chrome');
                const safeHeight = Math.max(80, chrome.clientHeight), aspect = width / height;
                const halfHeight = Math.max((maximumY - minimumY) * margin * height / (2 * safeHeight), (maximumX - minimumX) * margin / (aspect * 2));
                const centerOffset = (chrome.offsetTop + safeHeight / 2 - height / 2) * (2 * halfHeight / height);
                camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
                camera.top = halfHeight + centerOffset; camera.bottom = -halfHeight + centerOffset;
                camera.zoom = 1; camera.updateProjectionMatrix(); controls.update();
            }
            function setView(name) {
                inspectionLight.visible = false;
                currentView = name; app.dataset.sceneView = name; controls.autoRotate = false; setPressed('rotate-toggle', false);
                for (const entry of parts.values()) entry.group.visible = name === 'interior' ? entry.id === 'columbus' : !modernParts.has(entry.id) || configuration === 'modern';
                applyGhost();
                const bounds = name === 'interior' ? new THREE.Box3().setFromObject(parts.get('columbus').group) : stationBounds;
                fitBox(bounds, cameraDirection(name), name === 'interior' ? 1.25 : 1.16);
                setPressed('interior-focus', name === 'interior');
                document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
                document.getElementById('view-name').textContent = { overview: '01 / PORT FORWARD', reverse: '02 / STARBOARD FORWARD', zenith: '03 / ZENITH PLAN', forward: '04 / FORWARD ELEVATION', interior: '05 / COLUMBUS LABORATORY' }[name]; render();
            }
            function focusPart(id) {
                if (id === 'columbus') { setView('interior'); return; }
                if (currentView === 'interior') setView('reverse');
                const windowDetail = id === 'destiny' && destinyDetail === 'window', cabinDetail = id === 'dragon' && dragonDetail === 'cabin';
                // A fixed envelope covers the whole shutter sweep so the camera never pumps.
                const bounds = windowDetail ? new THREE.Box3(new THREE.Vector3(-.68, -3.48, 4.15), new THREE.Vector3(1.56, -2.08, 5.55))
                    : cabinDetail ? new THREE.Box3(new THREE.Vector3(-2.05, -2.05, -4.3), new THREE.Vector3(2.05, 2.05, .2)).applyMatrix4(dragon.group.matrixWorld)
                    : id === 'dragon' ? dragonFlightBounds.clone() : new THREE.Box3().setFromObject(parts.get(id).group);
                if (id === 'dragon' && !cabinDetail) bounds.union(new THREE.Box3().setFromObject(parts.get('harmony').group));
                controls.autoRotate = false; setPressed('rotate-toggle', false);
                const detailDirections = { destiny: [-110, 68, -145], poisk: [-155, 85, -140], rassvet: [-145, -85, -135], prichal: [-140, 20, -180], soyuz: [-160, 120, 160], beam: [-120, 80, 150], bishop: [-155, 100, -140], z1: [-85, 58, -165], s3payloads: [125, 70, -160], p3payloads: [-125, 70, -160], tranquility: [-100, -120, -155], robotics: [-40, 120, 150], thermal: [-155, 80, -100], irosa: [-100, 160, -130] };
                const direction = windowDetail ? new THREE.Vector3(65, -180, -105) : cabinDetail ? new THREE.Vector3(-100, -20, 35) : id === 'dragon' ? new THREE.Vector3(-100, 85, 150) : detailDirections[id] ? new THREE.Vector3(...detailDirections[id]) : cameraDirection('reverse');
                // The selected assembly stays solid; the rest of the station remains as ghosted line art for context.
                for (const entry of parts.values()) entry.group.visible = !modernParts.has(entry.id) || configuration === 'modern';
                applyGhost();
                inspectionLight.visible = windowDetail || cabinDetail || id === 'tranquility';
                currentView = 'detail'; app.dataset.sceneView = 'detail';
                fitBox(bounds, direction, windowDetail ? 1.32 : cabinDetail ? 1.12 : id === 'dragon' ? 1.23 : 1.22);
                document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', 'false'));
                document.getElementById('view-name').textContent = windowDetail ? 'DETAIL / DESTINY OBSERVATION WINDOW' : cabinDetail ? 'DETAIL / CREW DRAGON CABIN' : 'DETAIL / ' + parts.get(id).name.toUpperCase(); render();
            }
            // The cabin is shown docked: the approach jumps to its end before the camera frames the capsule.
            function setDragonDetail(mode) {
                dragonDetail = mode;
                if (mode === 'cabin') { approach.time = approach.duration; updateApproach(0); }
                selectPart('dragon'); focusPart('dragon');
            }
            function setDestinyDetail(mode) {
                destinyDetail = mode; selectPart('destiny'); focusPart('destiny');
            }
            function updateShutter(delta) {
                if (destinyShutter.progress >= 1) return;
                destinyShutter.progress = Math.min(1, destinyShutter.progress + delta / destinyShutter.duration);
                const t = destinyShutter.progress, eased = t * t * (3 - 2 * t);
                destinyShutter.angle = THREE.MathUtils.lerp(destinyShutter.from, destinyShutter.target, eased);
                destinyShutter.pivot.rotation.z = destinyShutter.angle;
            }
            function toggleShutter() {
                destinyShutter.from = destinyShutter.angle;
                destinyShutter.target = destinyShutter.target > 0 ? 0 : destinyShutter.openAngle;
                destinyShutter.progress = Math.abs(destinyShutter.target - destinyShutter.angle) < .000001 ? 1 : 0;
                if (reducedMotion.matches) updateShutter(destinyShutter.duration);
                render();
            }
            function updateShutterControls() {
                const moving = destinyShutter.progress < 1;
                const state = moving ? (motion ? '' : 'Paused · ') + (destinyShutter.target > 0 ? 'Opening' : 'Closing') : destinyShutter.target > 0 ? 'Open' : 'Closed';
                const status = document.getElementById('shutter-state');
                if (status.textContent !== state) status.textContent = state;
                const button = document.getElementById('shutter-toggle'), label = destinyShutter.target > 0 ? 'Close shutter' : 'Open shutter';
                if (button.textContent !== label) button.textContent = label;
            }
            function updateApproachDistance() {
                if (!approachHud || !approachDistLine || !approachDistBadge) return;
                const dragonPart = parts.get('dragon'), harmonyPart = parts.get('harmony');
                if (!dragonPart || !harmonyPart || currentView === 'interior' || !dragonPart.group.visible) {
                    approachHud.style.display = 'none'; approachDistBadge.style.display = 'none'; return;
                }
                const width = viewport.clientWidth, height = viewport.clientHeight;
                if (!width || !height) return;
                approachHud.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
                const pPortWorld = harmonyPart.group.localToWorld(approach.port.clone());
                const pDragonWorld = dragonPart.group.localToWorld(approach.nose.clone());
                const vPort = pPortWorld.project(camera), vDragon = pDragonWorld.project(camera);
                if (vPort.z < -1.1 || vPort.z > 1.1 || vDragon.z < -1.1 || vDragon.z > 1.1) {
                    approachHud.style.display = 'none'; approachDistBadge.style.display = 'none'; return;
                }
                const x1 = (vPort.x * .5 + .5) * width, y1 = (-vPort.y * .5 + .5) * height;
                const x2 = (vDragon.x * .5 + .5) * width, y2 = (-vDragon.y * .5 + .5) * height;
                const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
                if (maxX < -60 || minX > width + 60 || maxY < -60 || minY > height + 60) {
                    approachHud.style.display = 'none'; approachDistBadge.style.display = 'none'; return;
                }
                approachHud.style.display = ''; approachDistBadge.style.display = '';
                approachDistLine.setAttribute('x1', x1.toFixed(1)); approachDistLine.setAttribute('y1', y1.toFixed(1));
                approachDistLine.setAttribute('x2', x2.toFixed(1)); approachDistLine.setAttribute('y2', y2.toFixed(1));
                approachPortDot.setAttribute('cx', x1.toFixed(1)); approachPortDot.setAttribute('cy', y1.toFixed(1));
                approachDragonDot.setAttribute('cx', x2.toFixed(1)); approachDragonDot.setAttribute('cy', y2.toFixed(1));
                const midX = (x1 + x2) * .5, midY = (y1 + y2) * .5;
                const linePixelDist = Math.hypot(x2 - x1, y2 - y1);
                let badgeX = midX, badgeY = midY;
                if (linePixelDist < 52) {
                    let nx = -(y2 - y1), ny = (x2 - x1);
                    const nLen = Math.hypot(nx, ny);
                    if (nLen > 0.001) {
                        nx /= nLen; ny /= nLen;
                        if (ny > 0 || (Math.abs(ny) < 0.001 && nx < 0)) { nx = -nx; ny = -ny; }
                        badgeX = midX + nx * 14; badgeY = midY + ny * 14;
                    } else { badgeY = midY - 14; }
                }
                approachDistBadge.style.transform = 'translate(' + badgeX.toFixed(1) + 'px,' + badgeY.toFixed(1) + 'px) translate(-50%,-50%)';
                const rangeText = approach.range.toFixed(1) + ' m';
                if (approachDistBadge.textContent !== rangeText) approachDistBadge.textContent = rangeText;
            }
            // Crew 1's thought follows his head on screen. It shows only while the camera looks into the see-through side of
            // Columbus's hull and the crew are large enough to read (about 35 px a metre or more, as in the laboratory's own view).
            function updateCrewThought() {
                const element = crewThought.element, columbus = parts.get('columbus'), lab = columbus && columbus.group.userData.lab, person = lab && lab.crew[0];
                let show = !!person && crewThought.level > .01;
                for (let node = person; show && node; node = node.parent) if (!node.visible) show = false;
                if (show) {
                    const width = viewport.clientWidth, height = viewport.clientHeight;
                    const head = new THREE.Vector3().setFromMatrixPosition(person.userData.bones.Head.matrixWorld);
                    const top = head.clone().add(new THREE.Vector3(0, .22, 0)).project(camera), base = head.clone().project(camera);
                    const pixelsPerMetre = Math.hypot((top.x - base.x) * width / 2, (top.y - base.y) * height / 2) / .22;
                    const toCamera = camera.getWorldDirection(new THREE.Vector3()).negate().applyQuaternion(lab.interior.getWorldQuaternion(new THREE.Quaternion()).invert());
                    const angle = Math.atan2(toCamera.y, toCamera.x);
                    show = pixelsPerMetre > 35 && Math.abs(top.x) < .95 && Math.abs(top.y) < .92 && top.z < 1 && angle > lab.open.a0 + .2 && angle < lab.open.a1 - .2;
                    if (show) {
                        element.style.transform = 'translate(' + ((top.x * .5 + .5) * width).toFixed(1) + 'px,' + ((-top.y * .5 + .5) * height).toFixed(1) + 'px)';
                        element.style.opacity = crewThought.level.toFixed(2);
                    }
                }
                element.hidden = !show;
            }
            function updateLabels() {
                const width = viewport.clientWidth, height = viewport.clientHeight, occupied = [];
                const chrome = document.querySelector('.viewport-chrome');
                const safeTop = chrome.offsetTop, safeBottom = safeTop + chrome.clientHeight;
                leaders.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
                labelLayer.hidden = !labelsEnabled || !!selected || currentView === 'interior'; leaders.style.display = labelLayer.hidden ? 'none' : '';
                if (labelLayer.hidden) return;
                const viewportBounds = viewport.getBoundingClientRect();
                for (const selector of ['.approach-status', '.interior-focus', '.component-picker']) {
                    const statusBounds = document.querySelector(selector).getBoundingClientRect();
                    occupied.push({ left: statusBounds.left - viewportBounds.left, top: statusBounds.top - viewportBounds.top, right: statusBounds.right - viewportBounds.left, bottom: statusBounds.bottom - viewportBounds.top });
                }
                if (approachDistBadge && approachDistBadge.style.display !== 'none') {
                    const badgeBounds = approachDistBadge.getBoundingClientRect();
                    occupied.push({ left: badgeBounds.left - viewportBounds.left, top: badgeBounds.top - viewportBounds.top, right: badgeBounds.right - viewportBounds.left, bottom: badgeBounds.bottom - viewportBounds.top });
                }
                for (const label of labels) {
                    const mobile = width < 600, eligible = !mobile || ['power', 'kibo', 'zvezda', 'dragon'].includes(label.id);
                    const entry = parts.get(label.id);
                    const anchor = entry.group.localToWorld(entry.anchor.clone()).project(camera);
                    const anchorX = (anchor.x * .5 + .5) * width, anchorY = (-anchor.y * .5 + .5) * height;
                    const visible = parts.get(label.id).group.visible && eligible && Math.abs(anchor.x) < .97 && Math.abs(anchor.y) < .95 && anchor.z > -1 && anchor.z < 1;
                    label.element.hidden = !visible; label.line.style.display = label.dot.style.display = visible ? '' : 'none';
                    if (!visible) continue;
                    const labelWidth = label.element.offsetWidth, labelHeight = label.element.offsetHeight;
                    const maximumTop = safeBottom - labelHeight - 72, minimumTop = safeTop + 44;
                    if (maximumTop < minimumTop) { label.element.hidden = true; label.line.style.display = label.dot.style.display = 'none'; continue; }
                    let left = Math.max(16, Math.min(width - labelWidth - 16, anchorX + label.offsetX * (mobile ? .55 : 1)));
                    let top = Math.max(minimumTop, Math.min(maximumTop, anchorY + label.offsetY));
                    for (let attempt = 0; attempt < 9; attempt++) {
                        const collision = occupied.some(box => left < box.right + 10 && left + labelWidth > box.left - 10 && top < box.bottom + 10 && top + labelHeight > box.top - 10);
                        if (!collision) break;
                        top += attempt % 2 === 0 ? labelHeight + 12 : -(labelHeight + 12) * 2;
                        top = Math.max(minimumTop, Math.min(maximumTop, top));
                    }
                    if (occupied.some(box => left < box.right + 6 && left + labelWidth > box.left - 6 && top < box.bottom + 6 && top + labelHeight > box.top - 6)) { label.element.hidden = true; label.line.style.display = label.dot.style.display = 'none'; continue; }
                    occupied.push({ left, top, right: left + labelWidth, bottom: top + labelHeight });
                    label.element.style.transform = 'translate(' + left.toFixed(1) + 'px,' + top.toFixed(1) + 'px)';
                    const endX = anchorX > left + labelWidth / 2 ? left + labelWidth : left, endY = top + labelHeight - 2;
                    label.line.setAttribute('d', 'M ' + anchorX.toFixed(1) + ' ' + anchorY.toFixed(1) + ' L ' + endX.toFixed(1) + ' ' + endY.toFixed(1));
                    label.dot.setAttribute('cx', anchorX.toFixed(1)); label.dot.setAttribute('cy', anchorY.toFixed(1));
                }
            }
            function placeEarth() {
                const forward = camera.getWorldDirection(new THREE.Vector3());
                const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
                earth.position.copy(controls.target).addScaledVector(forward, 380).addScaledVector(up, -164).addScaledVector(right, 26);
                atmosphere.position.copy(earth.position);
            }
            function render() {
                camera.updateMatrixWorld(true); if (inspectionLight.visible) inspectionLight.position.copy(camera.position); if (orbital) placeEarth(); updateApproachDistance(); updateLabels(); updateCrewThought(); updateShutterControls();
                const approachState = approach.time >= approach.duration ? 'DOCKED' : motion ? approachPhase() : 'PAUSED';
                const readout = approach.range.toFixed(1) + ' m / ' + approachState;
                const status = document.getElementById('approach-state');
                if (status.textContent !== readout) status.textContent = readout;
                const pixelsPerMetre = camera.zoom * viewport.clientWidth / (camera.right - camera.left);
                const scaleMetres = [.01, .02, .05, .1, .2, .5, 1, 2, 5, 10, 20, 50, 100].find(length => length * pixelsPerMetre >= 55) || 100;
                document.getElementById('scale-line').style.width = (scaleMetres * pixelsPerMetre).toFixed(1) + 'px';
                document.getElementById('scale-label').textContent = scaleMetres + ' m';
                renderer.render(scene, camera);
            }
            function resize() {
                const width = viewport.clientWidth, height = viewport.clientHeight;
                if (!width || !height) return;
                renderer.setSize(width, height);
                if (currentView === 'interior') fitBox(new THREE.Box3().setFromObject(parts.get('columbus').group), cameraDirection('interior'), 1.25);
                else if (currentView === 'detail' && selected) focusPart(selected); else if (currentView !== 'detail') fitBox(stationBounds, cameraDirection(currentView));
                render();
            }
            document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { selectPart(null); setView(button.dataset.view); }));
            document.querySelectorAll('.milestone').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.milestone').forEach(item => item.setAttribute('aria-pressed', String(item === button))); selectPart(button.dataset.part); }));
            document.getElementById('destiny-supports').addEventListener('click', () => setDestinyDetail('supports'));
            document.getElementById('destiny-window').addEventListener('click', () => setDestinyDetail('window'));
            document.getElementById('dragon-approach').addEventListener('click', () => setDragonDetail('approach'));
            document.getElementById('dragon-cabin').addEventListener('click', () => setDragonDetail('cabin'));
            document.getElementById('shutter-toggle').addEventListener('click', toggleShutter);
            document.getElementById('close-detail').addEventListener('click', () => selectPart(null));
            document.getElementById('focus-detail').addEventListener('click', () => { if (selected) focusPart(selected); });
            document.getElementById('dragon-focus').addEventListener('click', () => { selectPart('dragon'); focusPart('dragon'); });
            approachDistBadge.addEventListener('click', () => { selectPart('dragon'); focusPart('dragon'); });
            document.getElementById('interior-focus').addEventListener('click', () => { selectPart('columbus'); focusPart('columbus'); });
            document.getElementById('replay-approach').addEventListener('click', restartApproach);
            // Reset returns the scene to its opening state: configuration, camera, selection and every animation.
            document.getElementById('reset').addEventListener('click', () => {
                selectPart(null); dragonDetail = 'approach'; destinyDetail = 'supports';
                setConfiguration('modern'); setView('reverse');
                elapsed = 0; z1EVA.restart();
                Object.assign(destinyShutter, { angle: destinyShutter.openAngle, target: destinyShutter.openAngle, from: destinyShutter.openAngle, progress: 1 });
                destinyShutter.pivot.rotation.z = destinyShutter.openAngle;
                restartApproach(); advance(0);
            });
            for (const [id, multiplier] of [['zoom-in', 1.25], ['zoom-out', .8]]) document.getElementById(id).addEventListener('click', () => { camera.zoom = THREE.MathUtils.clamp(camera.zoom * multiplier, controls.minZoom, controls.maxZoom); camera.updateProjectionMatrix(); render(); });
            document.getElementById('labels-toggle').addEventListener('click', () => { labelsEnabled = !labelsEnabled; setPressed('labels-toggle', labelsEnabled); render(); });
            document.getElementById('rotate-toggle').addEventListener('click', () => { controls.autoRotate = !controls.autoRotate; setPressed('rotate-toggle', controls.autoRotate); });
            document.getElementById('motion-toggle').addEventListener('click', () => { motion = !motion; setPressed('motion-toggle', motion); render(); });
            document.getElementById('configuration-toggle').addEventListener('click', () => setConfiguration(configuration === 'reference' ? 'modern' : 'reference'));
            document.getElementById('backdrop-toggle').addEventListener('click', () => {
                orbital = !orbital; orbitalGroup.visible = orbital; app.dataset.backdrop = orbital ? 'orbit' : 'space'; setPressed('backdrop-toggle', orbital);
                if (orbital) loadEarth(); render();
            });
            document.getElementById('capture').addEventListener('click', () => {
                render(); const canvas = document.createElement('canvas'); canvas.width = renderer.domElement.width; canvas.height = renderer.domElement.height;
                const context = canvas.getContext('2d'); context.fillStyle = getComputedStyle(app).backgroundColor; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(renderer.domElement, 0, 0);
                context.fillStyle = getComputedStyle(app).color; context.font = '500 ' + Math.max(18, canvas.width * .014) + 'px sans-serif'; context.fillText('ISS / INTERNATIONAL SPACE STATION', canvas.width * .03, canvas.height * .94);
                canvas.toBlob(blob => { if (!blob) { notify('Image export is unavailable.'); return; } const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'ISS-' + configuration + '-' + (orbital ? 'orbital' : 'space') + '.png'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); notify('Station image exported.'); }, 'image/png');
            });
            const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
            let pointerStart = null;
            renderer.domElement.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; controls.autoRotate = false; setPressed('rotate-toggle', false); });
            renderer.domElement.addEventListener('pointerup', event => {
                if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
                pointerStart = null;
                const bounds = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
                // A solid part under the pointer wins over ghosted ones in front of it; a ghost alone selects its part.
                const hits = raycaster.intersectObjects(station.children.filter(group => group.visible), true).filter(intersection => intersection.object.isMesh);
                const hit = hits.find(intersection => !intersection.object.userData.solidMaterial) || hits[0];
                if (hit) { let object = hit.object; while (object && !object.userData.part) object = object.parent; if (object) selectPart(object.userData.part); } else selectPart(null);
            });
            window.addEventListener('keydown', event => { if (event.key === 'Escape') selectPart(null); });
            reducedMotion.addEventListener('change', event => { if (event.matches) { motion = false; updateShutter(destinyShutter.duration); controls.autoRotate = false; setPressed('motion-toggle', false); setPressed('rotate-toggle', false); } });
            new ResizeObserver(resize).observe(viewport);
            function advance(delta) {
                if (motion) {
                    elapsed += delta; updateApproach(delta); updateShutter(delta); z1EVA.update(delta); updateDragonCrew(elapsed); updateColumbusCrew(elapsed);
                    for (const wing of wings) { wing.group.rotation.z = wing.base + Math.sin(elapsed * .07) * .035 * wing.direction; if (wing.overlay) wing.overlay.quaternion.copy(wing.group.quaternion); }
                    // A small illustrative prime-antenna tracking arc about its azimuth and elevation axes; the spare stays parked.
                    for (const dish of trackingDishes) {
                        dish.azimuth.rotation.y = dish.baseAzimuth + Math.sin(elapsed * .11) * Math.PI / 30;
                        dish.elevation.rotation.x = dish.baseElevation + Math.sin(elapsed * .16) * Math.PI / 60;
                    }
                    earth.rotation.y = elapsed * .008;
                }
                controls.update(delta); render();
            }
            window.issAtlas = { z1EVA, scene, station, renderer, camera, controls, parts, wings, labels, stationBounds, modernParts, approach, dragonFlightBounds, updateApproach, restartApproach, setConfiguration, setView, selectPart, focusPart, render, advance, resize, get selected() { return selected; }, get motion() { return motion; }, get configuration() { return configuration; }, get earthTextureState() { return earthTextureState; }, get currentView() { return currentView; } };
            setConfiguration('modern'); resize(); setView('reverse'); advance(0); scheduleLineArt();
            window.lucide?.createIcons();
            if (!window.lucide) window.addEventListener('load', () => window.lucide?.createIcons(), { once: true });
            loading.style.opacity = '0'; loading.style.pointerEvents = 'none'; setTimeout(() => { loading.hidden = true; }, 400);
            app.dataset.ready = 'true';
            const clock = new THREE.Clock();
            renderer.setAnimationLoop(() => advance(Math.min(clock.getDelta(), .06)));
            document.fonts.ready.then(() => render());
            renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); notify('Graphics paused. Reload the page to restore the station.'); });
        } catch (error) {
            console.error(error);
            const message = document.getElementById('error'); message.hidden = false; message.textContent = 'The station could not start. An internet connection and WebGL are required. ' + error.message;
            loading.querySelector('.load-label').textContent = 'ASSEMBLY UNAVAILABLE'; loading.querySelector('.load-line').hidden = true;
        }
