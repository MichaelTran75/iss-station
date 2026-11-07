// ACES, ESA's Atomic Clock Ensemble in Space, on the Earth-facing site of Columbus's External Payload Facility since
// 25 April 2025 (5 November 2026 configuration).
import { material, palette, shapes } from '../core/kit.js';
import { part, parts, ring } from '../core/station.js';

// Built in the Columbus module's own frame (js/parts/columbus.js: x forward, y zenith, z along the module axis,
// outboard), under the floor of the lower payload frame on the outboard cone, the facility's nadir site (FRAM 4); ASIM
// stands on the forward-facing wall of the same frame. The box is the site's payload envelope (0.864 x 1.168 x
// 1.245 m) under its adapter plate; the parts on its Earth-facing underside follow ESA's labelled rendering ("The
// parts of ACES", 2024); sizes and places of those parts are illustrative.
const columbus = parts.get('columbus').group, module = columbus.getObjectByName('Columbus module');
const floorBottom = -2.55, centerX = -.09, centerZ = 3.62;
const size = [.864, 1.245, 1.168], top = floorBottom - .05, bottom = top - size[1];
part('aces', 'ACES atomic clocks', '09 / EUROPE - ESA', 'ESA\'s Atomic Clock Ensemble in Space: a laser-cooled caesium clock (PHARAO, from CNES) and a space hydrogen maser in one box, compared with the best clocks on Earth over a microwave link and a laser link to measure how gravity changes the flow of time and to compare clocks across continents. It flew on SpaceX CRS-32 on 21 April 2025, and Canadarm2 set it on the Earth-facing site of Columbus\'s external payload facility four days later, beside the ASIM storm monitor, for a 30-month mission. Its Earth-facing underside carries the S-band and Ku-band microwave antennas, a GNSS antenna and the laser timing detector and reflector. The box is the site\'s payload envelope; details are illustrative.', [['Installed', '25 APR 2025'], ['Site', 'Columbus, Earth-facing'], ['Clocks', 'PHARAO + H-maser']], [centerX, bottom + .4, centerZ], (kit, group) => {
    group.position.copy(module.position).add(columbus.position); group.quaternion.copy(module.quaternion);
    const blanket = material(0xf1f2ee, .86, .04), seam = 0xd9dcd6, gold = 0xc8a24a, rail = 0xe2b81f, grey = 0xb7bcb9;
    const middle = (top + bottom) / 2, [width, height, length] = size;
    const x0 = centerX - width / 2, x1 = centerX + width / 2, z0 = centerZ - length / 2, z1 = centerZ + length / 2;
    // Adapter plate on the floor's underside, with its four latch fittings, and the white blanketed box below it.
    kit.box([centerX, floorBottom - .025, centerZ], [width + .08, .05, length + .08], 0xc9ced0);
    for (const x of [x0, x1]) for (const z of [z0, z1]) kit.box([x, floorBottom - .06, z], [.1, .05, .1], palette.silver, [0, 0, 0], false);
    kit.add(shapes.box, blanket, [centerX, middle, centerZ], size);
    // Blanket seams round the sides.
    for (const y of [top - .32, top - .74]) {
        kit.box([centerX, y, z0 - .003], [width - .02, .012, .006], seam, [0, 0, 0], false);
        kit.box([centerX, y, z1 + .003], [width - .02, .012, .006], seam, [0, 0, 0], false);
        kit.box([x0 - .003, y, centerZ], [.006, .012, length - .02], seam, [0, 0, 0], false);
        kit.box([x1 + .003, y, centerZ], [.006, .012, length - .02], seam, [0, 0, 0], false);
    }
    // Radiator on the outboard face, which looks out to space: a pale panel with a grid of channels.
    const panel = [.7, .95], panelY = middle + .05;
    kit.box([centerX, panelY, z1 + .006], [panel[0], panel[1], .012], 0xe4edf2, [0, 0, 0], false);
    for (let i = 1; i < 7; i++) kit.box([centerX - panel[0] / 2 + i * panel[0] / 7, panelY, z1 + .014], [.008, panel[1] - .02, .006], 0xbfd2dc, [0, 0, 0], false);
    for (let i = 1; i < 9; i++) kit.box([centerX, panelY - panel[1] / 2 + i * panel[1] / 9, z1 + .014], [panel[0] - .02, .008, .006], 0xbfd2dc, [0, 0, 0], false);
    // Forward face: two handrails and the grapple fixture Canadarm2 held it by.
    for (const z of [centerZ - .3, centerZ + .3]) {
        kit.rod([x1 + .02, top - .25, z], [x1 + .09, top - .28, z], .013, rail); kit.rod([x1 + .02, bottom + .25, z], [x1 + .09, bottom + .28, z], .013, rail);
        kit.rod([x1 + .09, top - .28, z], [x1 + .09, bottom + .28, z], .014, rail);
    }
    kit.cylinder([x1 + .07, top - .2, centerZ], .1, .14, grey, [0, 0, Math.PI / 2]); kit.cylinder([x1 + .16, top - .2, centerZ], .03, .1, palette.silver, [0, 0, Math.PI / 2]);
    // Earth-facing underside: the S-band antenna (a gold disc) in the middle, the Ku-band horn in one corner, the GNSS
    // antenna on a short post, the laser timing reflector in the opposite corner and the photon detector beside the disc.
    kit.cylinder([centerX - .05, bottom - .015, centerZ], .17, .03, gold, [0, 0, 0]); kit.cylinder([centerX - .05, bottom - .035, centerZ], .05, .012, 0xf4f1e6, [0, 0, 0]);
    kit.box([x1 - .14, bottom - .055, z1 - .16], [.13, .11, .13], grey); kit.box([x1 - .14, bottom - .112, z1 - .16], [.09, .006, .09], palette.dark, [0, 0, 0], false);
    kit.cylinder([x1 - .16, bottom - .03, z0 + .2], .02, .06, palette.silver, [0, 0, 0]); kit.sphere([x1 - .16, bottom - .07, z0 + .2], [.065, .04, .065], 0xf4f4ef);
    kit.cylinder([x0 + .1, bottom - .02, z0 + .12], .045, .04, palette.dark, [0, 0, 0]); ring(kit, [x0 + .1, bottom - .04, z0 + .12], .045, 'y', palette.silver, .008);
    kit.cylinder([centerX + .2, bottom - .03, centerZ + .25], .04, .06, palette.black, [0, 0, 0]);
});
