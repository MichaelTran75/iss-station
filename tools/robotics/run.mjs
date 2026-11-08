// Robotics studies in a headless browser, against the page served locally (development tool):
//
//   python3 -m http.server 8769 --bind 127.0.0.1      (in the repository)
//   node tools/robotics/run.mjs check                  (clearance of the sequences, the parked and the live poses)
//   node tools/robotics/run.mjs search                 (search the sequences' poses again: a few minutes)
//
// A study (check.js, search.js) is a function body run in the page with: clear (clearance.js), planner (planner.js),
// and the robotics modules K (kinematics), P (pose), M (layout), F (fixtures), T (telemetry), MO (motion),
// S (sequences). Needs playwright-core: PLAYWRIGHT_CORE=<its folder>, an install next to this file, or one npx left in
// ~/.npm/_npx. Optional second argument: the port (8769).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url);
function playwright() {
    const tries = [process.env.PLAYWRIGHT_CORE, 'playwright-core'];
    const npx = path.join(os.homedir(), '.npm/_npx');
    if (fs.existsSync(npx)) for (const entry of fs.readdirSync(npx)) tries.push(path.join(npx, entry, 'node_modules/playwright-core'));
    for (const name of tries.filter(Boolean)) { try { return require(name); } catch { /* next */ } }
    throw new Error('playwright-core not found: set PLAYWRIGHT_CORE');
}
const [study = 'check', port = '8769'] = process.argv.slice(2);
const body = fs.readFileSync(path.join(here, study + '.js'), 'utf8');
const browser = await playwright().chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
// Offline: the orbital elements fall back to the copy in data/, the rest of the outside world is not needed.
await page.route(url => !/^http:\/\/127\.0\.0\.1/.test(url.href) && !/cdn\.jsdelivr\.net/.test(url.href), route => route.abort());
let ready = false;
for (let attempt = 0; attempt < 3 && !ready; attempt++) {
    if (attempt) await page.reload({ waitUntil: 'load' }); else await page.goto(`http://127.0.0.1:${port}/?worker=0`, { waitUntil: 'load' });
    ready = await page.waitForFunction(() => document.getElementById('app')?.dataset.ready === 'true', null, { timeout: 90000 }).then(() => true, () => false);
}
if (!ready) { console.error('The page did not load.', errors.join('\n')); await browser.close(); process.exit(1); }
for (const file of ['clearance.js', 'planner.js']) await page.addScriptTag({ content: fs.readFileSync(path.join(here, file), 'utf8') });
page.setDefaultTimeout(0);
const result = await page.evaluate(`(async () => {
    const [K, P, M, F, T, MO, S] = await Promise.all(['kinematics', 'pose', 'layout', 'fixtures', 'telemetry', 'motion', 'sequences'].map(name => import('./js/robotics/' + name + '.js')));
    const clear = await window.roboticsClearance(), planner = await window.roboticsPlanner(clear);
    ${body}
})()`);
console.log(JSON.stringify(result, null, 1));
if (errors.length) console.error('Page errors:\n' + errors.join('\n'));
await browser.close();
