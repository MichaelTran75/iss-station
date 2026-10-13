// Starts the page. The model data loads first (core/data.js), then main.js and the station modules, which index.html
// has been fetching meanwhile (modulepreload). If anything fails (no network, no WebGL, a missing file), the error
// panel replaces the loading screen.
const loading = document.getElementById('loading');
try {
    await import('./core/data.js');
    await import('./main.js');
} catch (error) {
    console.error(error);
    const message = document.getElementById('error'); message.hidden = false; message.textContent = 'The station could not start. An internet connection and WebGL are required. ' + error.message;
    loading.querySelector('.load-label').textContent = 'ASSEMBLY UNAVAILABLE'; loading.querySelector('.load-line').hidden = true;
}
