// The Orbit view's background, from the switch under the Orbit button: the page's own paper (light, the default) or
// black (dark). `?theme=dark` (or light) picks it; otherwise the one last picked in this browser. It sets
// `data-orbit-background` on the page (css/app.css turns the page dark from it while the Orbit view shows) and js/orbit/sky.js
// reads `orbitTheme.name` each frame. The station's Earth backdrop and the Launch view stay dark.
const app = document.getElementById('app'), key = 'iss.orbit.theme';
const buttons = [...document.querySelectorAll('[data-orbit-theme]')];
let name = 'light';
try { name = localStorage.getItem(key) === 'dark' ? 'dark' : 'light'; } catch (error) { /* no storage: light */ }
const asked = new URLSearchParams(location.search).get('theme');
if (asked) name = asked === 'dark' ? 'dark' : 'light';

function show() {
    app.dataset.orbitBackground = name;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.orbitTheme === name));
}
export const orbitTheme = {
    get name() { return name; },
    set(next) {
        name = next === 'dark' ? 'dark' : 'light'; show();
        try { localStorage.setItem(key, name); } catch (error) { /* not kept */ }
    }
};
buttons.forEach(button => button.addEventListener('click', () => orbitTheme.set(button.dataset.orbitTheme)));
show();
