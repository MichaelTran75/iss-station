// Integrated truss structure.
import * as THREE from 'three';
import { Kit, material, palette, shapes, vertical } from '../core/kit.js';
import { inSolarPocket, part, ring, solarPocketHalf, solarRootX, solarRotaryJointX, solarStations, solarWingY,
    trussSections } from '../core/station.js';
import { badge, payloadBlanket } from '../core/surfaces.js';

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
