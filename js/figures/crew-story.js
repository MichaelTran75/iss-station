// The crew's story from the moment the page opens, and then their day. Seven people: the three of Columbus (Crew 1-3,
// js/parts/columbus.js) and the four Crew Dragon brings (js/figures/dragon-transfer.js).
// - Before docking ('pre'): only the three are aboard, at work in Columbus, whatever the station clock says.
// - After contact ('arrival'): they leave the lab to open Harmony's hatch and greet the arrivals, and go back to work
//   once the ceremony is over; the arrivals change in the crew quarters and float off to where the day has them. Each
//   figure there stays hidden until its person reaches it (posed meanwhile, so the arrival finishes in its pose).
// - Once everyone is in place ('day'), or with no Crew Dragon in the configuration: the crew's day by the station
//   clock (js/figures/crew-day.js).
// Who does what in the day (the roster): Crew 1-3 work the Columbus loop when the block has the lab at work; the
// laptop on a free block goes to each of the seven in turn, hour by hour; the other places (the exerciser, the
// errand through Tranquility, the Cupola, the treadmill, the two crew quarters in view, the galley table) go round
// the seven from one block and one day to the next. Each figure is dressed as the person it is (lab.dress): their own
// clothes and socks, trainers on the treadmill and the exerciser.
import { parts } from '../core/station.js';
import { approach, dragon } from '../parts/dragon.js';
import { crewDay, names, updateCrewDay } from './crew-day.js';
import { labCrew, updateLabCrew } from './lab-crew.js';
import { cabinCrew, updateCabinCrew } from './cabin-crew.js';
import { livingCrew, updateLivingCrew } from './living-crew.js';
import { dragonTransfer } from './dragon-transfer.js';
import { wrap } from './pose-kit.js';

const lab = parts.get('columbus').group.userData.lab;
export const people = [...lab.looks, ...dragonTransfer.stationLooks];
const trainersOf = look => ({ ...look, shoes: 0xe8e8e2 });
const labFigures = lab.crew.map(person => wrap(person, person.parent));
// Places other than the lab, in the order they are handed out; each with its figure.
const places = ['lifter', 'traveller', 'watcher', 'run', 'sleep0', 'sleep1', 'dine0', 'dine1', 'dine2'];
const living = livingCrew.crew, figureOf = {
    lab0: labFigures[0], lab1: labFigures[1], lab2: labFigures[2], laptop: labFigures[0],
    lifter: cabinCrew.lifter, traveller: cabinCrew.traveller, watcher: cabinCrew.watcher,
    run: living[0], sleep0: living[0], sleep1: living[1], dine0: living[0], dine1: living[1], dine2: living[2]
};
const open = (place, cast) => place === 'run' ? !!cast.runner : place.startsWith('sleep') ? !!cast.sleepers : place.startsWith('dine') ? !!cast.diners : !!cast[place];
const blockOrder = Object.keys(names);
export function rosterFor(cast, block, date) {
    const roster = {}, used = new Set(), hours = Math.floor(date.getTime() / 3.6e6), days = Math.floor(hours / 24);
    if (cast.lab === 'day') for (let k = 0; k < 3; k++) { roster['lab' + k] = k; used.add(k); }
    if (cast.lab === 'laptop') { roster.laptop = hours % 7; used.add(hours % 7); }
    const start = (days * 5 + blockOrder.indexOf(block) * 3) % 7;
    const queue = Array.from({ length: 7 }, (_, k) => (start + k) % 7).filter(p => !used.has(p));
    for (const place of places) if (open(place, cast)) roster[place] = queue.shift();
    return roster;
}

export const story = { phase: 'pre', roster: {}, cast: {} };
const dressed = new Map();
function dress(figure, look) { if (dressed.get(figure) === look) return; dressed.set(figure, look); lab.dress(figure.person, look); }
const trainers = people.map(trainersOf);
// The arrivals (by seat) are persons 3-6: where each goes once changed.
dragonTransfer.setDestinations(seat => {
    const place = places.find(key => story.roster[key] === 3 + seat);
    return place ? figureOf[place] : null;
});

export function updateCrew(elapsed, date, motion) {
    const day = updateCrewDay(date), cast = day.cast, progress = dragonTransfer.progress;
    const phase = !dragon.group.visible ? 'day' : approach.time < approach.duration ? (motion ? 'pre' : 'day') : progress.done ? 'day' : 'arrival';
    const roster = rosterFor(cast, day.block, crewDay.at || date);
    story.phase = phase; story.roster = roster;
    // Who is in place: everyone in the day; before docking only the lab three; then each as the transfer says.
    const here = p => phase === 'day' ? true : phase === 'pre' ? p < 3 : p < 3 ? !progress.hostsAway[p] : progress.home[p - 3];
    // Off the schedule until the day: the lab three at work in the lab, whatever their place in the roster.
    const placed = place => roster[place] !== undefined && (phase === 'day' || roster[place] >= 3);
    const state = place => !placed(place) ? false : here(roster[place]) ? true : 'hidden';
    const labMode = phase === 'day' ? cast.lab || 'none' : 'day';
    const away = phase === 'day' ? [false, false, false] : [0, 1, 2].map(k => !here(k));
    // Dress every figure on shift as its person.
    if (labMode === 'day') for (let k = 0; k < 3; k++) dress(labFigures[k], people[k]);
    if (labMode === 'laptop') dress(labFigures[0], people[roster.laptop]);
    for (const place of places) if (placed(place)) dress(figureOf[place], place === 'run' || place === 'lifter' ? trainers[roster[place]] : people[roster[place]]);
    const cabinOn = { lifter: state('lifter'), traveller: state('traveller'), watcher: state('watcher') };
    // The living three: the roles of the block, each hidden while its person is on the way, none if not theirs yet.
    const livingOn = phase === 'day' ? cast : { sleepers: placed('sleep0') || placed('sleep1'), diners: placed('dine0') || placed('dine1') || placed('dine2'), runner: placed('run') };
    const livingAway = livingCrew.roleList(livingOn).map(role => !role ? false : state(role === 'run' ? 'run' : role) !== true);
    story.cast = { lab: labMode, ...cabinOn, living: livingCrew.roleList(livingOn) };
    updateLabCrew(elapsed, labMode, motion, away);
    updateCabinCrew(elapsed, cabinOn, motion);
    updateLivingCrew(elapsed, livingOn, motion, livingAway);
    return story;
}
export const crewStory = { story, people, rosterFor, update: updateCrew, labCrew };
