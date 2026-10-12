// Animation worker: runs motion models off the main thread. The page sends {type: 'init', id, kind, payload} once per
// animated figure, then {type: 'step', id, time, buffer} each frame; the worker fills the pose into the buffer and hands
// it back (transferred, never copied). To add a figure, write a module like eva.js and register its factory here.
import { createEvaSimulation } from './eva.js?v=2f04194c17';

const factories = { eva: payload => createEvaSimulation(payload.asset, payload.fairleadTangent) };
const simulations = new Map();

self.onmessage = ({ data }) => {
    try {
        if (data.type === 'init') {
            const simulation = factories[data.kind](data.payload);
            simulations.set(data.id, simulation);
            self.postMessage({ type: 'ready', id: data.id, size: simulation.layout.size });
        } else if (data.type === 'step') {
            const simulation = simulations.get(data.id);
            simulation.step(data.time, new Float32Array(data.buffer));
            self.postMessage({ type: 'pose', id: data.id, time: data.time, buffer: data.buffer }, [data.buffer]);
        } else if (data.type === 'dispose') simulations.delete(data.id);
    } catch (error) {
        // Hand any pose buffer back so the page keeps it.
        const message = { type: 'error', id: data.id, message: String(error && error.stack || error), buffer: data.buffer };
        self.postMessage(message, data.buffer ? [data.buffer] : []);
    }
};
