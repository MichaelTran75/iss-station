// Quality tiers (pixel ratio and shadow-map size per device), shadow-map scheduling and the ?stats readout.
import { renderer, scene, sunlight } from './stage.js';

// Quality tiers. The first tier follows the device: small touch screens, few cores or little memory start at
// "medium". The measured frame rate then steps the tier down when frames run long, and back up (never above
// the first tier) when there is room. ?quality=high|medium|low fixes a tier; ?stats shows the live figures.
export const query = new URLSearchParams(location.search);
const qualityTiers = {
    high: { pixelRatio: 2, shadows: true, shadowSize: 2048, shadowInterval: 1 / 15 },
    medium: { pixelRatio: 1.5, shadows: true, shadowSize: 1024, shadowInterval: 1 / 8 },
    low: { pixelRatio: 1, shadows: false, shadowSize: 1024, shadowInterval: 1 / 4 }
};
const tierNames = ['low', 'medium', 'high'];
const smallTouchScreen = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
const modestDevice = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
const requestedTier = qualityTiers[query.get('quality')] ? query.get('quality') : null;
export const quality = { tier: requestedTier || (smallTouchScreen || modestDevice ? 'medium' : 'high'), fixed: !!requestedTier, frames: [], slow: 0, fast: 0, settle: 0 };
quality.ceiling = quality.tier;
// The station is static apart from slow wings, dishes, Dragon and the crew, so the sun's shadow map is redrawn a
// few times a second while things move (and at once after a selection or visibility change), not every frame.
renderer.shadowMap.autoUpdate = false;
let shadowDirty = true, shadowClock = 0;
export function markShadowsDirty() { shadowDirty = true; }
export function updateShadows(delta, moving) {
    shadowClock += delta;
    if (renderer.shadowMap.enabled && (shadowDirty || shadowClock >= (moving ? qualityTiers[quality.tier].shadowInterval : .5))) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; shadowClock = 0; }
}
export function applyQuality(name) {
    const tier = qualityTiers[name]; quality.tier = name; quality.settle = 90; quality.frames.length = 0;
    renderer.setPixelRatio(Math.min(devicePixelRatio, tier.pixelRatio));
    if (renderer.shadowMap.enabled !== tier.shadows) {
        renderer.shadowMap.enabled = tier.shadows;
        scene.traverse(object => { if (object.material) for (const surface of [].concat(object.material)) surface.needsUpdate = true; });
    }
    if (sunlight.shadow.mapSize.x !== tier.shadowSize) { sunlight.shadow.mapSize.set(tier.shadowSize, tier.shadowSize); sunlight.shadow.map?.dispose(); sunlight.shadow.map = null; }
    shadowDirty = true;
}
// Fed every frame; returns true when it changed the tier, so the caller resizes the canvas.
export function watchFrames(delta, moving) {
    if (quality.fixed || document.hidden || !moving) return false;
    if (quality.settle > 0) { quality.settle--; return false; }
    quality.frames.push(delta);
    if (quality.frames.length < 60) return false;
    const average = quality.frames.reduce((sum, value) => sum + value, 0) / quality.frames.length; quality.frames.length = 0;
    const index = tierNames.indexOf(quality.tier);
    if (average > 1 / 40) { quality.fast = 0; if (++quality.slow >= 2 && index > 0) { quality.slow = 0; applyQuality(tierNames[index - 1]); return true; } }
    else if (average < 1 / 56) { quality.slow = 0; if (++quality.fast >= 5 && index < tierNames.indexOf(quality.ceiling)) { quality.fast = 0; applyQuality(tierNames[index + 1]); return true; } }
    else { quality.slow = 0; quality.fast = 0; }
    return false;
}
const statsPanel = query.has('stats') ? document.createElement('div') : null, statsWindow = { frames: 0, time: 0, work: 0 };
if (statsPanel) {
    statsPanel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:60;padding:5px 8px;border-radius:6px;background:rgba(10,14,16,.72);color:#d8eadf;font:10px/1.45 "IBM Plex Mono",monospace;white-space:pre;pointer-events:none';
    document.body.appendChild(statsPanel);
}
export function updateStats(delta, work, animation) {
    if (!statsPanel) return;
    statsWindow.frames++; statsWindow.time += delta; statsWindow.work += work;
    if (statsWindow.time < .5) return;
    const heap = performance.memory ? ' · JS ' + Math.round(performance.memory.usedJSHeapSize / 1e6) + ' MB' : '';
    statsPanel.textContent = Math.round(statsWindow.frames / statsWindow.time) + ' fps · ' + (statsWindow.work / statsWindow.frames).toFixed(1) + ' ms CPU/frame\n'
        + renderer.info.render.calls + ' draws · ' + Math.round(renderer.info.render.triangles / 1000) + 'k triangles\n'
        + 'quality ' + quality.tier + (quality.fixed ? ' (fixed)' : '') + ' · ' + renderer.getPixelRatio() + '× px · shadows ' + (renderer.shadowMap.enabled ? 'on' : 'off') + heap
        + (animation ? '\nanimation ' + animation : '');
    statsWindow.frames = 0; statsWindow.time = 0; statsWindow.work = 0;
}
