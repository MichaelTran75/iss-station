// The booster's touchdown on the droneship, after the flight simulation (js/sim/ascent.js) has brought it to the deck:
// the legs take up its last speed, the body rocks onto the rolling deck and settles, and the barge heaves in the swell
// with the booster standing on it. All of it is a function of the time since the feet met the deck, so the view can
// seek. The flight itself is untouched: at that moment the deck's centre is at its mean height and at rest (it is
// tilted, and turning, as the swell has it).
const g0 = 9.80665, rad = Math.PI / 180;
// The legs together as one spring and damper under the booster (they can only push): their own frequency with the
// nearly empty stage on them, and the share of critical damping. The stage rocking on them: the same four springs
// 9.1 m out from the axis turn a body whose mass sits about 9 m up with a 10 m radius of gyration, which comes to
// 0.47 of the legs' frequency.
export const legs = { frequency: 1.2, damping: .4 };
export const rock = { frequency: .56, damping: .25 };
// The swell under the barge: roll about its long axis (x), pitch about z, heave (two swells whose rise and speed
// cancel at touchdown).
export const swell = { roll: [1.1 * rad, 7.4, .95], pitch: [.5 * rad, 9.6, -.6], heave: [.22, 8.3, 5.9] };

export function deckMotion(since) {
    const wave = ([size, period, phase]) => size * Math.sin(2 * Math.PI * since / period + phase);
    const [size, first, second] = swell.heave, a = 2 * Math.PI / first, b = 2 * Math.PI / second;
    return { roll: wave(swell.roll), pitch: wave(swell.pitch), heave: size * (Math.sin(a * since) - a / b * Math.sin(b * since)) };
}

// How the tilt between the booster and the deck's normal dies away: tilt(since) = hold · tilt(0) + kick · rate(0).
export function rockAt(since) {
    const w = 2 * Math.PI * rock.frequency, decay = rock.damping * w, wd = w * Math.sqrt(1 - rock.damping ** 2), fall = Math.exp(-decay * since);
    return { hold: fall * (Math.cos(wd * since) + decay / wd * Math.sin(wd * since)), kick: fall * Math.sin(wd * since) / wd };
}

// The legs' stroke (m, how far the body has come down on them) and the load felt (g), integrated once from the speed
// at touchdown; `thrust(since)` is the engine's push per unit mass as it runs down.
export function createSettle(speed, thrust, length = 10) {
    const w = 2 * Math.PI * legs.frequency, step = 1 / 480, keep = 4, count = Math.round(length / step / keep) + 1;
    const stroke = new Float32Array(count), load = new Float32Array(count);
    const push = (z, rate) => z > 0 ? Math.max(0, w * w * z + 2 * legs.damping * w * rate) : 0;
    let z = 0, rate = speed;
    for (let k = 0; k < (count - 1) * keep + 1; k++) {
        const time = k * step, force = push(z, rate);
        if (k % keep === 0) { stroke[k / keep] = z; load[k / keep] = (force + thrust(time)) / g0; }
        // Midpoint step.
        const half = rate + (g0 - thrust(time) - force) * step / 2, zHalf = z + rate * step / 2;
        rate += (g0 - thrust(time + step / 2) - push(zHalf, half)) * step; z += half * step;
    }
    const rest = g0 / (w * w);   // where it stands in the end
    return {
        rest, deepest: Math.max(...stroke),
        at(since) {
            const u = since * 480 / keep;
            if (u <= 0) return { stroke: 0, load: load[0] };
            if (u >= count - 1) return { stroke: rest, load: 1 };
            const k = Math.floor(u), f = u - k;
            return { stroke: stroke[k] + (stroke[k + 1] - stroke[k]) * f, load: load[k] + (load[k + 1] - load[k]) * f };
        }
    };
}
