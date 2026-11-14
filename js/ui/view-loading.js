// Loading card over the viewport while a sky view (Orbit, Launch, Cupola) gets ready, with the time it is taking:
// the step it is at (code, building the scene, files still in flight through the three.js loaders, first frame), a bar
// and a clock in tenths of a second; at the end, the total for a moment. The card shows at once and the load starts
// after it is painted (`afterPaint`): building a view holds the main thread for up to a few seconds, and a card asked
// for after that would never be seen. A view already in memory shows no card. Only one load is followed at a time:
// a new one, or leaving the view, drops the last.
import * as THREE from 'three';

const card = document.getElementById('view-loading'), title = card.querySelector('.vl-title'), stepText = card.querySelector('.vl-step');
const bar = card.querySelector('.vl-bar i'), clock = card.querySelector('.vl-time');
export const viewLoading = { hold: 1400, last: null };

// Files through THREE.DefaultLoadingManager (textures, models, data): counted from the moment the manager was idle.
const files = { loaded: 0, total: 0, busy: false };
const manager = THREE.DefaultLoadingManager;
manager.onStart = (url, loaded, total) => { files.busy = true; files.loaded = loaded; files.total = total; };
manager.onProgress = (url, loaded, total) => { files.loaded = loaded; files.total = total; };
manager.onLoad = () => { files.busy = false; files.loaded = files.total; };
manager.onError = () => {};

const steps = { code: 'LOADING CODE', build: 'BUILDING THE SCENE', files: 'LOADING FILES', frame: 'FIRST FRAME' };
const share = { code: 0, build: .25, files: .55, frame: .93 };
let job = null;
const seconds = ms => (ms / 1000).toFixed(1) + ' S';
function paint(j) {
    if (j !== job) return;
    const now = performance.now();
    if (j.shown) {
        let k = share[j.step];
        if (j.step === 'files') { k += (share.frame - share.files) * (files.total ? files.loaded / files.total : 0); stepText.textContent = steps.files + ' ' + files.loaded + ' / ' + files.total; }
        else stepText.textContent = steps[j.step];
        if (j.finished) { k = 1; stepText.textContent = 'READY'; }
        // Before a step is done the bar creeps on, so a long step does not look stalled.
        else k += .06 * (1 - Math.exp(-(now - j.stepAt) / 4000));
        j.k = Math.max(j.k, Math.min(1, k)); bar.style.transform = 'scaleX(' + j.k.toFixed(3) + ')';
        clock.textContent = seconds((j.finished || now) - j.start);
    }
    if (!j.finished) j.raf = setTimeout(() => paint(j), 100);
}
function hide() { card.classList.remove('on'); setTimeout(() => { if (!card.classList.contains('on')) card.hidden = true; }, 300); }

export function startViewLoading(name) {
    cancelViewLoading();
    const j = job = { name, start: performance.now(), step: 'code', stepAt: performance.now(), shown: true, finished: 0, raf: 0, k: 0 };
    title.textContent = name.toUpperCase(); bar.style.transform = 'scaleX(0)'; clock.textContent = '0.0 S';
    card.hidden = false; void card.offsetWidth; card.classList.add('on');
    paint(j);
    return {
        step: name => { if (job === j && !j.finished) { j.step = name; j.stepAt = performance.now(); } },
        // The view has entered: wait for files in flight, then two frames, then show the total.
        entered() {
            if (job !== j) return;
            const settle = () => {
                if (job !== j) return;
                if (files.busy && performance.now() - j.start < 30000) { if (j.step !== 'files') { j.step = 'files'; j.stepAt = performance.now(); } setTimeout(settle, 100); return; }
                j.step = 'frame'; j.stepAt = performance.now();
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (job !== j) return;
                    j.finished = performance.now(); viewLoading.last = { name, ms: Math.round(j.finished - j.start), shown: j.shown };
                    clearTimeout(j.raf); paint(j);
                    if (j.shown) setTimeout(() => { if (job === j) { job = null; hide(); } }, viewLoading.hold);
                    else job = null;
                }));
            };
            settle();
        },
        cancel: () => { if (job === j) cancelViewLoading(); }
    };
}
export function cancelViewLoading() {
    if (!job) return;
    clearTimeout(job.raf); job = null; hide();
}
// Resolves once the frame now being built has been painted; a hidden page, which paints nothing, waits 50 ms instead.
export const afterPaint = () => new Promise(resolve => {
    let done = false; const go = () => { if (!done) { done = true; resolve(); } };
    requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 50);
});
// For a view already in memory: nothing to show.
export const noViewLoading = { step() {}, entered() {}, cancel() {} };
