// Fits the body to a scan away from the screen, so the iPad stays smooth for the half minute it
// takes. In: { pts, nrm, state, turn }. Out: progress messages, then the answer or an error.
import { scanToBody } from './scan-body.js';

self.onmessage = (e) => {
  const { pts, nrm, state, turn } = e.data;
  try {
    let last = 0;
    const res = scanToBody({ pts, nrm }, state, { turn, progress: (f) => { if (f - last > 0.02) { last = f; self.postMessage({ progress: f }); } } });
    self.postMessage({ done: res }, [res.off.buffer]);
  } catch (err) { self.postMessage({ error: String((err && err.message) || err) }); }
};
