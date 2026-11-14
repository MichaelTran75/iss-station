// The crew's day by the station clock. The ISS keeps GMT: wake-up 06:00, a planning conference with the control centres
// at 07:30 and again at 19:00, work blocks either side of lunch, about 2.5 h of exercise a day for each crew member
// (shared out over the day on the resistive exerciser in Tranquility), lights out at 21:30 in the crew quarters
// (Harmony, not modelled inside). Saturday morning is weekly housekeeping and the rest of the weekend is off duty;
// exercise goes on every day. The times are the typical published day; the real plan changes from day to day.
//
// The station clock is the one the Sun runs on (now, the time set ahead in the Orbit view, or a date fixed with
// showSunAt). Each block says who is seen where: the Columbus crew (all three on their 140 s day, js/figures/lab-crew.js,
// or only the one at the laptop), the three in Tranquility (js/figures/cabin-crew.js), and three more who go where the
// block puts them (js/figures/living-crew.js): asleep in Harmony's crew quarters, at Unity's galley table for lunch and
// dinner (dinner opens the free time), or on Tranquility's treadmill. A figure not on shift is hidden and not posed.
// Nothing is loaded or built for this: the blocks only switch the existing figures on and off and move the three.
export const blocks = {
    weekday: [[0, 'sleep'], [6, 'morning'], [7.5, 'planning'], [7.75, 'science'], [13, 'lunch'], [14, 'science'], [19, 'planning'], [19.5, 'free'], [21.5, 'sleep']],
    saturday: [[0, 'sleep'], [6, 'morning'], [7.5, 'planning'], [7.75, 'housekeeping'], [13, 'lunch'], [14, 'off duty'], [19, 'planning'], [19.5, 'free'], [21.5, 'sleep']],
    sunday: [[0, 'sleep'], [6, 'morning'], [7.5, 'planning'], [7.75, 'off duty'], [13, 'lunch'], [14, 'off duty'], [19, 'planning'], [19.5, 'free'], [21.5, 'sleep']]
};
// lab: 'day' (three at work), 'laptop' (one at the laptop), or none. Tranquility holds the toilet and the exerciser,
// so someone passes through in the morning routine; meals are in Unity, though the Cupola is a favourite place to eat.
export const cast = {
    sleep: { sleepers: true },
    morning: { traveller: true },
    planning: {},
    science: { lab: 'day', lifter: true, traveller: true, runner: true },
    lunch: { watcher: true, diners: true },
    housekeeping: { lab: 'laptop', lifter: true, traveller: true },
    'off duty': { lab: 'laptop', lifter: true, watcher: true, runner: true },
    free: { lab: 'laptop', watcher: true, diners: true }
};
export const names = { sleep: 'SLEEP', morning: 'MORNING ROUTINE', planning: 'PLANNING CONFERENCE', science: 'SCIENCE', lunch: 'LUNCH',
    housekeeping: 'HOUSEKEEPING', 'off duty': 'OFF DUTY', free: 'FREE TIME' };
// For a narrow screen, where the Sun's line has room for one or two words more.
export const shortNames = { ...names, morning: 'MORNING', planning: 'PLANNING', housekeeping: 'CHORES' };

// `at` (a Date) holds the crew at that time instead of the station clock.
export const crewDay = { at: null, block: 'science', cast: cast.science, gmt: '', blocks, names };
const pad = n => String(n).padStart(2, '0');
export function crewBlock(date) {
    const day = date.getUTCDay(), list = day === 6 ? blocks.saturday : day === 0 ? blocks.sunday : blocks.weekday;
    const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    let i = list.length - 1; while (i > 0 && hour < list[i][0]) i--;
    return list[i][1];
}
export function updateCrewDay(date) {
    const when = crewDay.at || date;
    crewDay.block = crewBlock(when); crewDay.cast = cast[crewDay.block];
    crewDay.gmt = pad(when.getUTCHours()) + ':' + pad(when.getUTCMinutes()) + ' GMT';
    return crewDay;
}
export const crewLine = narrow => narrow ? 'CREW · ' + shortNames[crewDay.block] : 'CREW ' + crewDay.gmt + ' · ' + names[crewDay.block];
