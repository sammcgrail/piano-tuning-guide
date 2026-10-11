/*
 * audio.js - Web Audio demos. Nothing is created until the reader taps a button
 * (browsers only allow sound after a gesture anyway, and we never autoplay).
 *
 * Tones are additive: harmonic partials 1..10 with a gentle roll-off, so the
 * coincident partials of an interval really line up and the beats you hear are the
 * ones the page computes. "Pure" = the exact ratio (3:2, 4:3, ...), no beats.
 * "Tempered" = 12-tone equal temperament, beating at the rate shown on screen.
 */
let ctx = null, master = null, current = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -6; master.ratio.value = 3;
    master.connect(ctx.destination);
  }
  // iOS: play through the silent switch where the browser supports it
  try { if (navigator.audioSession && navigator.audioSession.type !== 'play-and-record') navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function audioContext() { return ensure(); }

const waves = new WeakMap();
function pianoWave(c, n = 10, tilt = 1.15) {
  if (!waves.has(c)) waves.set(c, new Map());
  const m = waves.get(c), key = n + ':' + tilt;
  if (!m.has(key)) {
    const real = new Float32Array(n + 1), imag = new Float32Array(n + 1);
    for (let k = 1; k <= n; k++) imag[k] = 1 / Math.pow(k, tilt);
    m.set(key, c.createPeriodicWave(real, imag, { disableNormalization: false }));
  }
  return m.get(key);
}

/* one tone into context c / node dest; returns a stop() function */
function tone(c, dest, hz, t0, dur, gain = 0.22, { sine = false } = {}) {
  const o = c.createOscillator(), g = c.createGain();
  if (sine) o.type = 'sine'; else o.setPeriodicWave(pianoWave(c, hz > 1500 ? 4 : hz > 700 ? 7 : 10));
  o.frequency.value = hz;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.setTargetAtTime(gain * 0.55, t0 + 0.02, 0.6);            // quick initial drop, like a struck string
  g.gain.setValueAtTime(gain * 0.55, t0 + Math.max(0.05, dur - 0.25));
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  o.connect(g); g.connect(dest);
  o.start(t0); o.stop(t0 + dur + 0.05);
  return () => { try { g.gain.cancelScheduledValues(c.currentTime); g.gain.setTargetAtTime(0, c.currentTime, 0.03); o.stop(c.currentTime + 0.15); } catch (e) { /* already stopped */ } };
}
/* Render phases offline with exactly the same synthesis (used by the tests to measure
   the beat rate of what the demo plays). Resolves to one Float32Array per phase. */
export async function renderOffline(phases, sr = 44100) {
  const out = [];
  for (const ph of phases) {
    const oc = new OfflineAudioContext(1, Math.ceil(sr * (ph.dur + 0.1)), sr);
    const g = ph.gain || (ph.freqs.length > 1 ? 0.16 : 0.22);
    for (const f of ph.freqs) tone(oc, oc.destination, f, 0, ph.dur, g, { sine: ph.sine });
    out.push((await oc.startRendering()).getChannelData(0));
  }
  return out;
}

export function stopAll() {
  if (current) { current.stops.forEach((s) => s()); current.timers.forEach(clearTimeout); const cb = current.onEnd; current = null; if (cb) cb(); }
}
export function isPlaying() { return !!current; }

/*
 * Play a list of phases one after another. Each phase: {freqs:[hz...], dur, beat, label, sine}.
 * onPhase(i, phase, startTimeInCtx) is called as each one starts; onEnd() at the end or on stop.
 */
export function playPhases(phases, { onPhase, onEnd, gap = 0.35 } = {}) {
  stopAll(); ensure();
  const stops = [], timers = [];
  current = { stops, timers, onEnd };
  let t = ctx.currentTime + 0.06;
  phases.forEach((ph, i) => {
    const t0 = t;
    const g = ph.gain || (ph.freqs.length > 1 ? 0.16 : 0.22);
    for (const f of ph.freqs) stops.push(tone(ctx, master, f, t0, ph.dur, g, { sine: ph.sine }));
    timers.push(setTimeout(() => { if (current && onPhase) onPhase(i, ph, t0); }, Math.max(0, (t0 - ctx.currentTime) * 1000)));
    t += ph.dur + gap;
  });
  timers.push(setTimeout(() => { if (current && current.stops === stops) { current = null; if (onEnd) onEnd(); } }, (t - ctx.currentTime) * 1000));
  return { ctx, t0: ctx.currentTime };
}
/* a long, steady reference tone (fork-like: mostly the fundamental) */
export function playReference(hz = 440, seconds = 40, { onEnd } = {}) {
  return playPhases([{ freqs: [hz], dur: seconds, beat: 0, label: hz + ' Hz', sine: true, gain: 0.28 }], { onEnd });
}
export function now() { return ctx ? ctx.currentTime : 0; }
