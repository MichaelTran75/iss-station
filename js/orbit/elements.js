// Orbital elements (two-line sets) for the sky and for the station's real Sun: a fresh cached copy, else CelesTrak,
// else the copy that ships with the page.
const celestrak = norad => 'https://celestrak.org/NORAD/elements/gp.php?CATNR=' + norad + '&FORMAT=TLE';
const cacheHours = 2;   // CelesTrak asks clients not to fetch the same elements more often than every two hours

// One request per object for the page's life: the sky and the station's Sun share it.
const pending = new Map();
export const loadElements = norad => pending.get(norad) || pending.set(norad, fetchElements(norad)).get(norad);
async function fetchElements(norad) {
    const key = 'iss-atlas-tle-' + norad;
    try {
        const cached = JSON.parse(localStorage.getItem(key));
        if (cached && Date.now() - cached.fetched < cacheHours * 3600000) return { tle: cached.tle, source: 'CelesTrak', fetched: cached.fetched };
    } catch (error) { /* storage blocked: fetch instead */ }
    try {
        const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 5000);
        const response = await fetch(celestrak(norad), { signal: abort.signal }); clearTimeout(timer);
        const tle = (await response.text()).split('\n').map(line => line.trim()).filter(line => /^[12] /.test(line));
        if (!response.ok || tle.length !== 2) throw new Error('no elements');
        try { localStorage.setItem(key, JSON.stringify({ tle, fetched: Date.now() })); } catch (error) { /* not cached */ }
        return { tle, source: 'CelesTrak', fetched: Date.now() };
    } catch (error) {
        const response = await fetch('data/orbits.json?v=e820d6c158');
        const data = await response.json(), entry = data.objects.find(object => object.norad === norad);
        return { tle: entry.tle, source: 'CelesTrak (copy of ' + data.fetched.slice(0, 10) + ')', fetched: Date.parse(data.fetched) };
    }
}
