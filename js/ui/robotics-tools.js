// The robotics panel in the inspector (Canadarm2 or Dextre selected): what the arm is doing and its seven joint angles
// as telemetry reads them (js/robotics/). The operations themselves are picked beside the arm (robotics-menu.js);
// both say what is happening with `statusText`.
import { fixtures } from '../robotics/fixtures.js';
import { ARM_SPEEDUP } from '../robotics/motion.js';
import { roboticsStatus } from '../robotics/index.js';
import { JOINT_NAMES, toReadings } from '../robotics/telemetry.js';

const panel = document.getElementById('robotics-tools'), stateLine = document.getElementById('robotics-state');
const joints = document.getElementById('robotics-joints');
const values = JOINT_NAMES.map(name => {
    const pair = document.createElement('div'), term = document.createElement('dt'), value = document.createElement('dd');
    term.textContent = name; pair.append(term, value); joints.append(pair); return value;
});

const name = id => fixtures.get(id)?.name || id;
export const clockText = seconds => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
// One line on what the arm is doing (js/robotics/index.js roboticsStatus).
export function statusText(status) {
    const { state, phase, sequence, step, clock, duration, live, followLive, note, map, stopping } = status;
    const where = name(state.base).toUpperCase() + ' · LEE ' + state.end, speedup = 'TIME-LAPSE ×' + (step?.speedup ?? ARM_SPEEDUP);
    const label = (step?.label || '').toUpperCase(), extra = note ? ' · ' + note.toUpperCase() : '';
    if (phase === 'mapping') return 'MAPPING THE STATION’S CLEARANCES · ' + Math.round(map.progress * 100) + '%';
    if (phase === 'planning') return (sequence ? 'PLANNING ' + sequence.title.toUpperCase() + ' AROUND THE STATION' : 'PLANNING A CLEAR ROUTE') + extra;
    if (phase === 'waiting') return (note || 'A moving part is in the way: waiting').toUpperCase();
    if (phase === 'stopping') return 'EASING TO A STOP' + extra;
    if (phase === 'route') return 'ROUTE TO ' + (followLive ? 'THE ISS LIVE POSE' : 'THE PARKED POSE') + ' · ' + label + ' · ' + speedup + extra;
    if (phase === 'sequence') return (stopping ? 'FINISHING SAFELY BEFORE STOPPING · ' : '') + label + ' · ' + speedup + ' · ' + clockText(clock) + ' / ' + clockText(duration) + extra;
    if (followLive && live?.arm) return 'ISS LIVE · ' + where + ' · TIP ' + live.arm.tip.toUpperCase() + (live.mbs ? ' · MT ' + live.mbs.x.toFixed(2) + ' m' + (live.mbs.worksite ? ' (' + live.mbs.worksite + ')' : '') : '');
    if (followLive) return 'ISS LIVE · NO ROBOTICS DATA YET · PARKED POSE';
    return 'PARKED · ' + where + extra;
}
let wait = 0;
// Every frame while the panel shows; the text changes at most four times a second.
export function refresh(now = false, delta = 0) {
    if (panel.hidden || (!now && (wait -= delta) > 0)) return;
    wait = .25;
    const status = roboticsStatus(), text = statusText(status);
    if (stateLine.textContent !== text) stateLine.textContent = text;
    const readings = toReadings(status.state.theta);
    readings.forEach((reading, i) => { const shown = reading.toFixed(1) + '°'; if (values[i].textContent !== shown) values[i].textContent = shown; });
}
