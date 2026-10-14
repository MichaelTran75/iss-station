// The wind over the Cape at Demo-2's liftoff (19:22 UTC, 30 May 2020), for the exhaust's drift. Pure data.
// - Aloft: the Cape Canaveral radiosonde (KXMR) launched at 12 and 00 UTC, its winds blended in time (0.615 of the way
//   to the evening ascent): the afternoon sea breeze from the south-south-east in the lowest kilometre, light and
//   turning through the west above it, westerlies from 4 km strengthening to 20-27 m/s between 10 and 15 km (the
//   subtropical jet's edge), light easterlies in the stratosphere from 19 km.
// - At the ground: the Shuttle Landing Facility's and the Skid Strip's reports from 19:00 and 20:00 UTC, 170-180° at
//   8-11 kt, 31 °C.
// - Above the balloon's last level (26.5 km), late May's stratospheric easterlies, about 10 m/s, to 60 km.
// Data: Iowa Environmental Mesonet (RAOB and ASOS archives).
// [height m, toward east m/s, toward north m/s]
const profile = [[0, -.4, 4.6], [150, -2, 5.7], [300, -3, 7.4], [600, -2.2, 4.6], [900, -2.4, 2.6], [1200, -1.1, .4], [1550, 1.1, -1.1], [2100, 3, -1.8],
    [2700, 2.5, -3.1], [3200, 2.6, -4.7], [4200, 6.1, -1.3], [5000, 6.3, .8], [5900, 7.2, -.7], [6600, 7.1, -2.2], [7600, 8.7, -1.2], [8700, 11.2, .8],
    [9700, 12.7, -1], [10500, 17, -4.1], [11000, 18.5, -1.1], [12000, 20.7, -6.1], [12400, 19.7, -5.8], [13500, 20.4, -8.8], [14200, 19.3, -7.4],
    [15100, 27.1, -4.1], [15600, 15.3, -12], [16200, 7.9, -2.7], [16600, 10.3, .1], [17700, 4.7, .3], [18700, .6, -1.3], [19500, -2.5, 5.4],
    [20750, -3.9, -2.6], [22500, -7.1, -.7], [24000, -4.8, -1.4], [26500, -4.2, -2.3], [35000, -9, 0], [60000, -10, 0], [90000, 0, 0]];
// Wind at a height (metres), in the pad's frame: [x (east), z (south)] in m/s. Near the ground it falls off as the
// logarithm of height over grass and concrete (roughness 3 cm), from the 10 m reading.
export function windAt(height, target = [0, 0]) {
    let east, north;
    if (height < 10) {
        const f = Math.max(0, Math.log(Math.max(.03, height) / .03) / Math.log(10 / .03));
        east = profile[0][1] * f; north = profile[0][2] * f;
    } else if (height >= profile[profile.length - 1][0]) east = north = 0;
    else {
        let k = 0; while (profile[k + 1][0] < height) k++;
        const [h0, e0, n0] = profile[k], [h1, e1, n1] = profile[k + 1], f = (height - Math.max(h0, 10)) / (h1 - Math.max(h0, 10));
        east = e0 + (e1 - e0) * f; north = n0 + (n1 - n0) * f;
    }
    target[0] = east; target[1] = -north;
    return target;
}
