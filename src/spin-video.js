// Spin video: a short clip of the body turning once with the tattoos on it, to send
// to an artist. Frames are drawn one at a time and encoded on the device with WebCodecs
// into an MP4 (H.264 where the device has it, which every iPad does), so the clip is
// smooth however long each frame takes to draw. Where WebCodecs is missing it records
// the frames in real time with MediaRecorder instead.
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const CODECS = [
  { codec: 'avc1.4d0028', mux: 'avc' },   // H.264 Main, plays everywhere
  { codec: 'avc1.42001f', mux: 'avc' },   // H.264 Baseline
  { codec: 'vp09.00.31.08', mux: 'vp9' }, // where H.264 encoding is missing (some desktop builds)
];

async function pickCodec(width, height, fps) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
  for (const c of CODECS) {
    const config = { codec: c.codec, width, height, bitrate: 6_000_000, framerate: fps };
    try { const r = await VideoEncoder.isConfigSupported(config); if (r && r.supported) return { ...c, config: r.config || config }; } catch (_) { /* try the next one */ }
  }
  return null;
}

// draw(i, ctx) paints frame i of `frames` into a width x height 2D context.
// onProgress(0..1) is called as frames are done. Returns { blob, name, codec }.
export async function makeSpinVideo({ width = 720, height = 960, fps = 30, frames = 180, draw, onProgress }) {
  if (width % 2 || height % 2) throw new Error('Video size must be even');
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  const pick = await pickCodec(width, height, fps);
  if (pick) {
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({ target, video: { codec: pick.mux, width, height, frameRate: fps }, fastStart: 'in-memory' });
    let failure = null;
    const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failure = e; } });
    encoder.configure(pick.config);
    for (let i = 0; i < frames; i++) {
      if (failure) throw failure;
      await draw(i, ctx);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: i % fps === 0 }); frame.close();
      while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 4));
      if (onProgress && i % 10 === 0) onProgress(i / frames);
    }
    await encoder.flush(); encoder.close();
    if (failure) throw failure;
    muxer.finalize();
    return { blob: new Blob([target.buffer], { type: 'video/mp4' }), name: 'ink-atlas-spin.mp4', codec: pick.codec };
  }
  // Fallback: record in real time.
  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) throw new Error('This browser cannot make videos.');
  const type = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) throw new Error('This browser cannot make videos.');
  const stream = canvas.captureStream(fps), rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6_000_000 }), parts = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
  const done = new Promise((r) => { rec.onstop = r; });
  await draw(0, ctx); rec.start();
  const start = performance.now();
  for (let i = 1; i < frames; i++) {
    const due = start + i * 1000 / fps, wait = due - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    await draw(i, ctx);
    if (onProgress && i % 10 === 0) onProgress(i / frames);
  }
  await new Promise((r) => setTimeout(r, 1000 / fps));
  rec.stop(); await done; stream.getTracks().forEach((t) => t.stop());
  const mp4 = type.startsWith('video/mp4');
  return { blob: new Blob(parts, { type: mp4 ? 'video/mp4' : 'video/webm' }), name: mp4 ? 'ink-atlas-spin.mp4' : 'ink-atlas-spin.webm', codec: type };
}
