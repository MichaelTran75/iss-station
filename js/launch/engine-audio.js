// Falcon 9's engines heard from the camera: synthesised with Web Audio (no recordings), on the same plan as the jet
// engines of the airport page (its js/engine-audio.js): noise sources shaped by what makes the sound, mixed through
// distance, air and the ground's echo.
// - The roar: turbulent mixing of the jets with the air. A rocket's is far lower than a jet engine's: its spectrum
//   peaks at a Strouhal number f·D/V of about 0.03 (NASA SP-8072) for a jet some 3 m across at 3 km/s, about 40-60 Hz,
//   and falls away above the peak by about 3 dB for each octave band (the noise here: flat below 50 Hz, as 1/f²
//   above). Large eddies make it swell and fall slowly. Its acoustic power goes with the jet's mechanical power, so
//   with thrust: the amplitude with its square root, steeper while the engines spool up (the jet is not yet at speed).
//   The lowest of it also drives a bent copy an octave or two up, which small speakers that cannot play 50 Hz carry.
// - The crackle: at full thrust the roar is strong enough for its waves to steepen as they travel (the higher the
//   pressure, the faster that part of the wave goes), each strong compression turning into a shock: a sudden rise and
//   a slow fall, so the pressure's rate of change is lopsided (its skewness well above zero, the measure of crackle in
//   the literature). Made once: a stretch of the roar's noise with each part moved ahead by its own height. Sparse
//   single shocks ride on it, in bursts, strongest while the plume still strikes the trench and the deck at liftoff.
// - Width: two takes of each loop, a little apart in speed so that together they do not repeat, one to each ear;
//   close by the jets fill the view and the ears hear them apart, far off they are one point.
// - Before the engines: the wind at the camera in gusts, the oxygen venting from the rocket (a faint hiss in puffs),
//   and from T−7 s the deluge water rushing over the mount.
// - Ignition: each engine's light-off (TEA-TEB) a low thump with a few pops, the nine within 80 ms.
// - Spreading and air: the level falls as 1/r from the engines; the air takes the highs away with distance; the
//   sound arrives r/343 s late (so the flame is seen before it is heard, and the pitch drops as the rocket draws
//   away); none in airless space (the level goes with the air's density at the source and at the camera).
// - The ground: a reflection and the long rolling echo of open country; louder downstream of the jet (Mach waves,
//   about 45° off its axis) than beside or ahead of it; panned by where the engines are on screen.
// - Stage separation, as the structure carries it (at 75 km there is no air to carry sound to the camera; this is
//   what a microphone on the vehicle picks up): the pneumatic pushers' thud, the release's metallic clank ringing in
//   the tanks' walls, the nitrogen hissing out; eight seconds later the vacuum Merlin's light-off, a deep thump.
// - A burning stage through its structure, the camera riding close in thin air: a muffled rumble (the only sound of
//   the second stage's burn and of the booster's entry burn up there), and the nitrogen thrusters' hiss as the
//   booster turns.
// - Touchdown on the droneship, in the air like the engines (late by the distance, its highs taken by the air): the
//   four feet striking the steel deck, the legs' crushable honeycomb giving, the deck and legs ringing, and the
//   booster venting its gas for some seconds after.
// - Dragon's Dracos and its docking, as heard inside the capsule (no air outside; the crew hears them through the
//   structure): each thruster's valve opening a sharp knock, so the approach's trim pulses come as a train of knocks;
//   a long burn a muffled roar while it lasts. At contact the soft-capture ring's thud and its three latches, the
//   ring's motor drawing it in, the twelve hooks driving shut in two gangs for hard capture, and the last clunk as
//   the preload is reached.
// - The returning booster's sonic boom: the triple boom Falcon 9 boosters are known for, three N-waves (the shocks of
//   the engine end with its legs, of the grid fins and interstage, and of the top) 0.38 and 0.32 s apart, each a
//   sudden rise, a fall through zero over 0.16 s and a sudden return, their edges softened a little by kilometres of
//   air, with the rolling echo after (see the view for when it arrives).
const speedOfSound = 343;

export function createEngineAudio(ctx) {
    const rate = ctx.sampleRate;
    let seed = 0x9e3779b9;
    const random = () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    // A loop of noise. `fill` writes a little more than the loop; the extra is faded in over the start, so the end
    // runs into the start without a step. The loops differ in length. `level`: the loop's RMS (0 leaves it as made).
    const loop = (seconds, level, fill, at = rate) => {
        const n = Math.floor(at * seconds), fold = Math.floor(at * .06), all = new Float32Array(n + fold), b = ctx.createBuffer(1, n, at), d = b.getChannelData(0);
        fill(all, n + fold, at);
        let power = 0; for (let i = 0; i < n; i++) power += all[i] * all[i];
        const scale = level ? level / Math.sqrt(power / n) : 1;
        for (let i = 0; i < n; i++) d[i] = all[i] * scale;
        for (let i = 0; i < fold; i++) { const u = i / fold; d[i] = (all[i] * Math.sqrt(u) + all[n + i] * Math.sqrt(1 - u)) * scale; }
        return b;
    };
    const pole = hertz => 1 - Math.exp(-2 * Math.PI * hertz / rate);
    const pink = loop(4.1, .25, (d, n) => {   // Paul Kellet's filter
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < n; i++) {
            const w = random() * 2 - 1;
            b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856;
            b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362; b6 = w * .115926;
        }
    });
    const brown = loop(5.3, .2, (d, n) => { let y = 0; for (let i = 0; i < n; i++) { y = (y + .02 * (random() * 2 - 1)) / 1.02; d[i] = y; } });
    const white = loop(2.3, 0, (d, n) => { for (let i = 0; i < n; i++) d[i] = random() * 2 - 1; });
    // The jet's mixing noise: flat up to `peak`, as 1/f² above it, nothing below 12 Hz.
    const mixing = (d, n, peak) => { const a = pole(peak), s = pole(12); let y = 0, slow = 0; for (let i = 0; i < n; i++) { y += (random() * 2 - 1 - y) * a; slow += (y - slow) * s; d[i] = y - slow; } };
    const jet = loop(4.7, .25, (d, n) => mixing(d, n, 50));
    // The same after its waves have steepened. Each part of the wave arrives ahead of its time by `lead` for its own
    // height; where a later part would overtake an earlier one, it joins it: a shock, the pressure stepping up at once.
    const lead = .0026 * rate;
    const steep = loop(6.1, .25, (d, n) => {
        const x = new Float32Array(n); mixing(x, n, 90);
        let power = 0; for (let i = 0; i < n; i++) power += x[i] * x[i];
        const scale = .25 / Math.sqrt(power / n);
        let at = 0, t0 = -lead * x[0] * scale, v0 = x[0] * scale;
        for (let i = 1; i < n && at < n; i++) {
            const v1 = x[i] * scale, t1 = Math.max(t0, i - lead * v1);
            while (at < t1 && at < n) { d[at] = at <= t0 ? v0 : v0 + (v1 - v0) * (at - t0) / (t1 - t0); at++; }
            t0 = t1; v0 = v1;
        }
        while (at < n) d[at++] = v0;
    });
    // Single shocks, sparse: a sudden rise, a fall through zero, a slower return.
    const crackle = loop(3.7, 0, (d, n) => {
        for (let i = 0; i < n; i++) if (random() < .0011 * 48000 / rate) {
            const peak = .3 + .7 * Math.sqrt(random()), span = Math.floor((18 + random() * 50) * rate / 48000);
            for (let k = 0; k < span && i + k < n; k++) d[i + k] += peak * (1 - 1.5 * k / span);
            for (let k = 0; k < 2 * span && i + span + k < n; k++) d[i + span + k] -= peak * .5 * (1 - k / (2 * span)) ** 2;
        }
    });
    // Slow swells (below about 1.5 Hz), within ±2 of an RMS of 1: what the levels below rise and fall by.
    const slow = loop(16, 0, (d, n, at) => {
        const a = 1 - Math.exp(-2 * Math.PI * 1.5 / at); let y = 0, z = 0, power = 0;
        for (let i = 0; i < n; i++) { y += (random() * 2 - 1 - y) * a; z += (y - z) * a; d[i] = z; power += z * z; }
        const scale = 1 / Math.sqrt(power / n);
        for (let i = 0; i < n; i++) d[i] = Math.max(-2, Math.min(2, d[i] * scale));
    }, 8000);
    const source = (b, speed = 1) => { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = speed; s.start(0, random() * (b.duration - .1)); return s; };
    const gain = (value = 0) => { const g = ctx.createGain(); g.gain.value = value; return g; };
    const filter = (type, frequency, Q = .7, dB = 0) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = frequency; f.Q.value = Q; f.gain.value = dB; return f; };
    const chain = (...nodes) => { for (let k = 0; k < nodes.length - 1; k++) nodes[k].connect(nodes[k + 1]); return nodes[nodes.length - 1]; };
    // Two takes of a loop, a little apart in speed (together they do not repeat), one to each ear, and some of each to
    // the other ear: `across` fixed, or left to the distance (see update).
    const blends = [];
    const wide = (b, speed = 1, across = null) => {
        const out = ctx.createChannelMerger(2);
        [source(b, speed), source(b, speed * .871)].forEach((take, ear) => {
            const other = gain(across ?? .3);
            take.connect(out, 0, ear); chain(take, other).connect(out, 0, 1 - ear);
            if (across === null) blends.push(other.gain);
        });
        return out;
    };
    // A level that swells and falls about what it is set to: by `depth` of it for each unit of the slow noise.
    const voice = (node, depth = 0, speed = 1) => {
        const swell = depth ? gain(0) : null;
        if (swell) chain(source(slow, speed), swell).connect(node.gain);
        return (value, settle) => { toward(node.gain, value, settle); if (swell) toward(swell.gain, value * depth, settle); };
    };

    // Out: the sources → the air (highs lost with distance) → the delay of the sound's travel → pan → dry and the
    // ground's echo → a compressor → a ceiling → the master gain.
    const sum = gain(1), air = filter('lowpass', 12000, .5), travel = ctx.createDelay(30), pan = ctx.createStereoPanner();
    const dry = gain(1), wet = gain(.28), echo = ctx.createConvolver();
    echo.buffer = (() => {   // the ground's reflection at 25 ms, then open country's rolling echo, darkening over 3 s
        const span = Math.floor(rate * 3), b = ctx.createBuffer(2, span, rate);
        for (let c = 0; c < 2; c++) {
            const d = b.getChannelData(c); let low = 0;
            for (let i = 0; i < span; i++) {
                const t = i / rate; low += (random() * 2 - 1 - low) * Math.max(.02, .35 * Math.exp(-t / .6));
                d[i] = low * Math.exp(-t / .9) * (t < .05 ? t / .05 : 1);
            }
            d[Math.floor(rate * (.025 + c * .003))] += .5;
        }
        return b;
    })();
    const squeeze = ctx.createDynamicsCompressor();
    squeeze.threshold.value = -12; squeeze.knee.value = 14; squeeze.ratio.value = 5; squeeze.attack.value = .006; squeeze.release.value = .4;
    // A ceiling after the compressor: as it is up to 0.6 of full scale, bent over above, never past full scale (the
    // shocks' peaks stand well above the roar's level).
    const ceiling = ctx.createWaveShaper(), master = gain(0);
    ceiling.curve = Float32Array.from({ length: 2049 }, (_, i) => { const u = (i / 1024 - 1) * 2, over = Math.abs(u) - .6; return over <= 0 ? u : Math.sign(u) * (.6 + .38 * Math.tanh(over / .38)); });
    chain(sum, air, travel, pan, dry, squeeze); pan.connect(echo); chain(echo, wet, squeeze); chain(squeeze, gain(.5), ceiling, master, ctx.destination);

    // The roar: the mixing noise, smooth, and its steepened copy, which takes over toward full thrust; the deep rumble
    // below; the rumble bent, for its harmonics an octave or two up; all swelling slowly with the large eddies.
    const roarTop = filter('lowpass', 2600, .6), roar = gain(0), shocks = gain(0), rumble = gain(0), growl = gain(0);
    chain(wide(jet), roar, roarTop, sum); chain(wide(steep), filter('highpass', 30, .7), shocks, roarTop);
    const deep = chain(source(brown), filter('lowpass', 85, .7)); chain(deep, rumble, sum);
    const bend = ctx.createWaveShaper(); bend.curve = Float32Array.from({ length: 1025 }, (_, i) => { const x = i / 512 - 1; return Math.tanh(4 * x) + .4 * x * x; });
    chain(deep, bend, filter('bandpass', 150, .6), growl, sum);
    const setRoar = voice(roar, .28), setShocks = voice(shocks, .28), setRumble = voice(rumble, .3, .7), setGrowl = voice(growl, .3, .7);
    // Single shocks in bursts, and the broadband hiss close to the jets.
    const crack = gain(0); chain(wide(crackle), filter('highpass', 300, .7), crack, sum);
    const setCrack = voice(crack, .45, 1.7);
    const hiss = gain(0); chain(source(white), filter('bandpass', 3200, .6), hiss, sum);
    // Light-off: a low thump and a few pops.
    const thump = gain(0); chain(source(brown, .8), filter('lowpass', 150, .8), thump, sum);
    const pops = gain(0); chain(source(crackle, 1.6), filter('highpass', 900, .7), pops, sum);
    // Before the engines, from the pad like them: oxygen venting in puffs, the deluge water's rush.
    const vent = gain(0); chain(source(white, .9), filter('bandpass', 2600, .5), vent, sum);
    const setVent = voice(vent, .45, 1.3);
    const water = gain(0); chain(wide(white, .8), filter('bandpass', 1100, .3), water, sum); chain(source(jet, 1.9), filter('lowpass', 400, .6), gain(1.6), water);
    const setWater = voice(water, .15, 2.3);
    // At the camera, not from the engines: the wind, in gusts, straight to the mix.
    const wind = gain(0); chain(wide(pink, .7, .2), filter('bandpass', 340, .3), filter('lowpass', 1500, .5), wind, squeeze);
    const setWind = voice(wind, .45, .45);

    // The triple boom, made once: three N-waves.
    const boomBuffer = (() => {
        const span = Math.floor(rate * 1.3), b = ctx.createBuffer(1, span, rate), d = b.getChannelData(0);
        const wave = (at, peak, lasting) => {
            const from = Math.floor(at * rate), n = Math.floor(lasting * rate);
            for (let k = 0; k < n && from + k < span; k++) d[from + k] += peak * (1 - 2 * k / n);
        };
        wave(.02, 1, .16); wave(.40, .7, .14); wave(.72, .9, .15);
        // Kilometres of air round off the shocks' fronts (a few milliseconds).
        let low = 0; const keep = Math.exp(-1 / (.0018 * rate));
        for (let i = 0; i < span; i++) { low = low * keep + d[i] * (1 - keep); d[i] = low; }
        return b;
    })();
    const boomLevel = gain(0); boomLevel.connect(squeeze); boomLevel.connect(echo);
    // Sounds carried by the structure go straight to the mix (no air, no travel, no echo).
    const onboard = gain(1); onboard.connect(squeeze);
    // A burning stage through its structure (a muffled rumble), and its nitrogen thrusters.
    const hull = gain(0); chain(source(jet, .8), filter('lowpass', 480, .6), hull, onboard); chain(source(brown, .9), filter('lowpass', 70, .7), gain(1.2), hull);
    const setHull = voice(hull, .2, .9);
    const jets = gain(0); chain(source(white, 1.1), filter('bandpass', 1900, .7), filter('lowpass', 3200, .7), jets, onboard);
    // Short sounds: a burst of noise through a filter, and struck metal ringing in a few modes.
    function burst(noise, type, frequency, Q, peak, rise, decay, into, at = ctx.currentTime) {
        const s = ctx.createBufferSource(), shape = filter(type, frequency, Q), level = gain(0);
        s.buffer = noise; chain(s, shape, level, into);
        level.gain.setValueAtTime(0, at); level.gain.linearRampToValueAtTime(peak, at + rise); level.gain.setTargetAtTime(0, at + rise, decay);
        s.loop = true; s.start(at, random() * (noise.duration - .1)); s.stop(at + rise + decay * 7);
    }
    function ring(modes, peak, into, at = ctx.currentTime) {
        for (const [frequency, decay, share] of modes) {
            const o = ctx.createOscillator(), level = gain(0);
            o.frequency.value = frequency * (.985 + .03 * random()); chain(o, level, into);
            level.gain.setValueAtTime(peak * share, at); level.gain.setTargetAtTime(0, at, decay);
            o.start(at); o.stop(at + decay * 7);
        }
    }
    // Stage separation, through the structure; `strength` 0-1 by the camera's nearness.
    function staging(strength = 1) {
        const at = ctx.currentTime;
        burst(brown, 'lowpass', 140, .8, .75 * strength, .004, .18, onboard, at);   // the pushers
        ring([[180, .5, 1], [267, .42, .8], [411, .35, .6], [655, .25, .45], [930, .18, .35], [1460, .1, .25]], .3 * strength, onboard, at + .01);   // the release
        burst(white, 'bandpass', 4500, .8, .12 * strength, .05, .45, onboard, at + .03);   // the nitrogen
    }
    // The vacuum Merlin lighting, through the structure.
    function vacuumStart(strength = 1) {
        const at = ctx.currentTime;
        burst(brown, 'lowpass', 120, .8, .75 * strength, .01, .45, onboard, at);
        burst(pink, 'lowpass', 220, .7, .22 * strength, .25, .9, onboard, at + .05);
    }
    // Dracos through the capsule: `onsets` valves opened this frame, `level` 0-1 of thrust (the forward four at full),
    // `near` 0-1 (the camera's nearness to Dragon; nothing from afar).
    const dracoRoar = gain(0); chain(source(pink, .9), filter('lowpass', 520, .7), dracoRoar, onboard);
    const dracoHiss = gain(0); chain(source(white, 1.05), filter('bandpass', 2400, .9), dracoHiss, onboard);
    function dracos(onsets, level, near) {
        toward(dracoRoar.gain, .32 * Math.min(1, level) * near, .03); toward(dracoHiss.gain, .045 * Math.min(1, level) * near, .03);
        if (onsets > 0 && near > 0) {
            const at = ctx.currentTime, s = Math.min(1, .5 + .25 * onsets) * near;
            burst(brown, 'lowpass', 180, .9, .7 * s, .002, .05, onboard, at);
            burst(white, 'bandpass', 1600, 1.2, .3 * s, .001, .02, onboard, at);
            ring([[340, .08, 1], [610, .06, .6], [1120, .04, .4]], .1 * s, onboard, at);
        }
    }
    // Docking through the capsule: 'soft' contact and capture, 'retract' the ring drawn in, 'hard' the hooks, 'docked'.
    function docking(stage, near = 1) {
        const at = ctx.currentTime;
        if (stage === 'soft') {
            burst(brown, 'lowpass', 120, .8, .8 * near, .006, .4, onboard, at);
            ring([[143, .9, 1], [231, .7, .7], [377, .5, .5], [598, .35, .35]], .22 * near, onboard, at + .01);
            for (const delay of [.12, .19, .27]) burst(white, 'bandpass', 2600, 1.5, .28 * near, .001, .015, onboard, at + delay);
        } else if (stage === 'retract') {
            const motor = ctx.createOscillator(), shape = filter('lowpass', 420, .8), level = gain(0);
            motor.type = 'sawtooth'; motor.frequency.setValueAtTime(92, at); motor.frequency.linearRampToValueAtTime(110, at + 2.8);
            chain(motor, shape, level, onboard);
            level.gain.setValueAtTime(0, at); level.gain.linearRampToValueAtTime(.07 * near, at + .3); level.gain.setValueAtTime(.07 * near, at + 2.5); level.gain.linearRampToValueAtTime(0, at + 2.9);
            motor.start(at); motor.stop(at + 3);
        } else if (stage === 'hard') {
            for (let k = 0; k < 12; k++) {
                const when = at + (k < 6 ? k * .07 : .55 + (k - 6) * .07);
                burst(white, 'bandpass', 1800, 1.1, .22 * near, .001, .025, onboard, when);
                burst(brown, 'lowpass', 160, .8, .25 * near, .002, .06, onboard, when);
            }
        } else if (stage === 'docked') {
            burst(brown, 'lowpass', 100, .8, .7 * near, .005, .5, onboard, at);
            ring([[118, 1.2, 1], [203, .9, .7], [331, .6, .45]], .18 * near, onboard, at + .01);
        }
    }
    // Touchdown, in the air from the booster's place; `distance` from the camera (m).
    function touchdown(distance) {
        const at = ctx.currentTime, level = Math.min(1.6, 250 / Math.max(15, distance));
        burst(brown, 'lowpass', 110, .8, .85 * level, .004, .35, sum, at);    // the feet striking the deck
        burst(white, 'bandpass', 1200, .7, .45 * level, .003, .12, sum, at);  // the honeycomb crushing
        ring([[92, 1.4, 1], [157, 1.1, .8], [238, .9, .7], [410, .7, .5], [690, .5, .35], [1130, .3, .2]], .22 * level, sum, at + .005);   // deck and legs
        burst(white, 'bandpass', 3800, .6, .1 * level, .5, 1.6, sum, at + .8);   // venting
    }
    function boom(strength = 1) {
        const s = ctx.createBufferSource(); s.buffer = boomBuffer;
        boomLevel.gain.setValueAtTime(1.25 * Math.min(1.2, strength), ctx.currentTime);
        s.connect(boomLevel); s.start();
    }
    const toward = (param, value, settle = .06) => param.setTargetAtTime(value, ctx.currentTime, settle);
    const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    let muted = false, lights = 0, lastDelay = 0;

    // Each frame: `thrust` 0-1 of full (the nine at full thrust; the spool as they start and stop), `distance` from
    // the camera to the engines (m), `air` 0-1 (how much air carries the sound: density at the source and the
    // camera), `angle` between the jet's direction and the way to the camera (radians), `pan` -1-1, `impinge` 0-1
    // (the plume striking the ground), `lights` a count of light-offs (each new one thumps), `warp` the playback's
    // time warp, `quiet` when paused or out of the view. Besides the engines in the air (each 0-1, none if left out):
    // `wind` at the camera, `vent` the oxygen venting on the pad, `water` the deluge, `structure` a stage's burn
    // carried by its structure to a camera riding close in thin air, `gas` its nitrogen thrusters the same way.
    function update(state) {
        const thrust = Math.max(0, Math.min(1, state.thrust)), r = Math.max(15, state.distance);
        // Level: 1/r from 250 m (the lookout), the air between, the jet's directivity.
        const spread = Math.min(2.2, 250 / r), aim = .45 + .55 * Math.exp(-(((state.angle - .8) / .7) ** 2));
        const level = spread * state.air * aim;
        const body = Math.pow(thrust, .75), full = smooth(thrust, .6, .95);
        setRoar(.35 * body * (1 - .55 * full) * level); setShocks(.4 * full * level);
        setRumble(.22 * body * level); setGrowl(.14 * body * level);
        setCrack(.12 * full * level * (.6 + .9 * state.impinge) * Math.min(1, 600 / r));
        toward(hiss.gain, .04 * body * level * Math.min(1, 120 / r));
        // The air's absorption: highs fade with distance (about 10 kHz kept at 250 m, 2.7 kHz at 2 km).
        toward(air.frequency, 16000 / (1 + r / 400), .15);
        toward(roarTop.frequency, 2600 + 3400 * (1 - state.impinge * .3), .2);
        toward(wet.gain, .18 + .22 * smooth(r, 150, 3000), .3);
        toward(pan.pan, Math.max(-.7, Math.min(.7, state.pan || 0)), .1);
        // The two ears' takes: apart close by, one far off.
        const across = .3 + .7 * smooth(r, 300, 4000);
        for (const blend of blends) toward(blend, across, .3);
        // The sound's travel time in real seconds (shorter when the clock runs fast); jumps are taken at once.
        const delay = Math.min(29, r / speedOfSound / Math.max(1, state.warp || 1));
        if (Math.abs(delay - lastDelay) > .25) travel.delayTime.setValueAtTime(delay, ctx.currentTime); else toward(travel.delayTime, delay, .08);
        lastDelay = delay;
        // A new light-off: thump and pops (through the travel delay, like the rest). After a jump in time the count
        // is only caught up.
        if (state.lights > lights && !state.jumped) {
            const t = ctx.currentTime, strength = Math.min(1.4, .7 + .1 * (state.lights - lights)) * level;
            thump.gain.cancelScheduledValues(t); thump.gain.setValueAtTime(.9 * strength, t); thump.gain.setTargetAtTime(0, t + .05, .35);
            pops.gain.cancelScheduledValues(t); pops.gain.setValueAtTime(.5 * strength, t); pops.gain.setTargetAtTime(0, t + .02, .25);
        }
        lights = state.lights;
        // The pad before the engines (spreading and air as for them, no directivity), the wind, the structure.
        const pad = Math.min(2.2, 250 / r) * state.air;
        setVent(.035 * (state.vent || 0) * pad, .3); setWater(.055 * (state.water || 0) * pad, .2);
        setWind(.1 * (state.wind || 0), .6);
        setHull(.16 * Math.pow(Math.max(0, Math.min(1, state.structure || 0)), .6), .12);
        toward(jets.gain, .1 * Math.min(1, state.gas || 0), .04);
        toward(master.gain, muted || state.quiet ? 0 : 1, .25);
    }
    return {
        context: ctx, update, boom, staging, vacuumStart, touchdown, dracos, docking,
        setMuted(value) { muted = !!value; toward(master.gain, muted ? 0 : master.gain.value, .05); },
        get muted() { return muted; }
    };
}
