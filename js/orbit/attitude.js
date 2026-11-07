// The station's attitude: how its own frame (x starboard, y zenith, z aft) sits against the ideal +XVV frame, the local
// vertical, local horizontal frame that the Real Sun (js/orbit/sun-track.js) and the Earth backdrop (js/orbit/sky.js)
// start from: forward end along the velocity, zenith up. It is kept as a turn, the 3 x 3 matrix (row by row) that takes
// a direction's components in the +XVV frame to its components in the station's frame.
// The ISS flies close to +XVV or, turned end for end about the zenith, -XVV. Without telemetry the page shows the
// attitude flown at the configuration's date: -XVV (ISS Live, 5 to 7 November 2026, yaw 176 degrees). ISS Live
// (js/orbit/live.js) replaces it with the telemetered attitude while it has one.
export const plusXvv = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const minusXvv = [-1, 0, 0, 0, 1, 0, 0, 0, -1];
export const datedTurn = minusXvv;
export const attitude = { turn: datedTurn.slice(), name: '−XVV' };
// The turn applied to a direction given in the +XVV frame.
export const inStation = (v, turn = attitude.turn) => [
    turn[0] * v[0] + turn[1] * v[1] + turn[2] * v[2],
    turn[3] * v[0] + turn[4] * v[1] + turn[5] * v[2],
    turn[6] * v[0] + turn[7] * v[1] + turn[8] * v[2]
];
// Named by where the forward end points, seen from above: along the velocity (+XVV), against it (-XVV), or a yaw.
// The forward end is the station's -z axis; its +XVV components are minus the turn's third row.
export function attitudeName(turn) {
    const yaw = Math.round(Math.atan2(-turn[6], turn[8]) * 180 / Math.PI);
    return Math.abs(yaw) <= 15 ? '+XVV' : Math.abs(yaw) >= 165 ? '−XVV' : 'YAW ' + yaw + '°';
}
export function setAttitude(turn) {
    for (let i = 0; i < 9; i++) attitude.turn[i] = turn[i];
    attitude.name = attitudeName(turn);
}
