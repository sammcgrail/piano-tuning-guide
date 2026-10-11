/*
 * tuner.js - microphone tuner. NOTHING here touches navigator.mediaDevices until
 * start() is called from a tap on "Start tuner". stop() ends every track, so the
 * browser's recording indicator goes away.
 *
 * Pitch detection, about 20 times a second: YIN (de Cheveigne & Kawahara 2002) finds
 * the note, then the peak of the windowed spectrum gives the exact frequency of the
 * fundamental (YIN alone reads stiff piano strings sharp). A short median filter keeps
 * the needle from jittering.
 */
import { A4_HZ, nameOf } from './data.js';

export function yin(buf, sr, { fmin = 25, fmax = 4400, threshold = 0.12 } = {}) {
  const tauMin = Math.max(2, Math.floor(sr / fmax));
  const tauMax = Math.min(Math.floor(sr / fmin), Math.floor(buf.length / 2));
  const W = buf.length - tauMax;
  const d = new Float32Array(tauMax + 2), raw = new Float32Array(tauMax + 2);
  let running = 0, best = -1;
  const diff = (tau) => { let s = 0; for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + tau]; s += x * x; } return s; };
  for (let tau = 1; tau <= tauMax; tau++) {
    const s = diff(tau); raw[tau] = s;
    running += s;
    d[tau] = running > 0 ? s * tau / running : 1;
    // absolute threshold: first dip below threshold, then walk to its local minimum
    if (tau > tauMin + 1 && best < 0 && d[tau - 1] < threshold && d[tau] >= d[tau - 1]) { best = tau - 1; break; }
  }
  if (best < 0) { // no dip under the threshold: take the global minimum if it is reasonably low
    let mi = tauMin, mv = Infinity;
    for (let tau = tauMin; tau <= tauMax; tau++) if (d[tau] > 0 && d[tau] < mv) { mv = d[tau]; mi = tau; }
    if (mv > 0.35) return null;
    best = mi;
  }
  // parabolic interpolation on the RAW difference function (less biased than on the
  // normalised one, which matters for short periods in the top octaves)
  let t = best;
  if (best > 1 && best < tauMax) {
    if (!raw[best + 1]) raw[best + 1] = diff(best + 1);
    const a = raw[best - 1], b = raw[best], c = raw[best + 1];
    const den = a + c - 2 * b; if (Math.abs(den) > 1e-12) t = best + (a - c) / (2 * den);
  }
  return { hz: sr / t, clarity: 1 - d[best] };
}

/* Precise frequency of the partial near `hz`: the peak of the Hann-windowed spectrum
   (a direct DTFT, searched within +-spanCents and then by golden section). YIN gives the
   period of the whole waveform, which stiff (inharmonic) piano strings pull sharp; this
   measures the fundamental itself, which is what "A4 = 440" refers to. */
export function refinePeak(buf, sr, hz, spanCents = 100) {
  const n = buf.length, w = refinePeak.win && refinePeak.win.length === n ? refinePeak.win : (refinePeak.win = hann(n));
  const mag = (f) => {
    const dw = 2 * Math.PI * f / sr; let re = 0, im = 0;
    // recurrence for cos/sin to keep it cheap
    const c1 = Math.cos(dw), s1 = Math.sin(dw); let c = 1, sn = 0;
    for (let i = 0; i < n; i++) { const v = buf[i] * w[i]; re += v * c; im -= v * sn; const nc = c * c1 - sn * s1; sn = sn * c1 + c * s1; c = nc; }
    return re * re + im * im;
  };
  const cents = (c) => hz * Math.pow(2, c / 1200);
  let bc = 0, bv = -1;
  for (let c = -spanCents; c <= spanCents; c += 4) { const v = mag(cents(c)); if (v > bv) { bv = v; bc = c; } }
  let a = bc - 4, b = bc + 4; const g = 0.618034;
  let x1 = b - g * (b - a), x2 = a + g * (b - a), f1 = mag(cents(x1)), f2 = mag(cents(x2));
  for (let k = 0; k < 18; k++) {
    if (f1 > f2) { b = x2; x2 = x1; f2 = f1; x1 = b - g * (b - a); f1 = mag(cents(x1)); }
    else { a = x1; x1 = x2; f1 = f2; x2 = a + g * (b - a); f2 = mag(cents(x2)); }
  }
  return cents((a + b) / 2);
}
function hann(n) { const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)); return w; }
/* coarse YIN on the newest 4096 samples, then the spectral peak on the whole buffer */
export function detect(buf, sr) {
  const tail = buf.length > 4096 ? buf.subarray(buf.length - 4096) : buf;
  const r = yin(tail, sr);
  if (!r) return null;
  return { hz: refinePeak(buf, sr, r.hz), coarse: r.hz, clarity: r.clarity };
}

export function describe(hz) {
  const m = Math.round(69 + 12 * Math.log2(hz / A4_HZ));
  const target = A4_HZ * Math.pow(2, (m - 69) / 12);
  return { midi: m, name: nameOf(m), cents: 1200 * Math.log2(hz / target), target };
}

export class Tuner {
  constructor(onReading) { this.onReading = onReading; this.running = false; this.history = []; }
  static supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  async start() {
    if (this.running) return;
    if (!Tuner.supported()) throw new Error('This browser has no microphone access (it needs https and a modern browser).');
    try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch (e) { /* not supported */ }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 16384;
    this.src.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.running = true; this.history = [];
    this.timer = setInterval(() => this.sample(), 50);
  }
  sample() {
    if (!this.running) return;
    this.analyser.getFloatTimeDomainData(this.buf);
    let rms = 0; for (let i = 0; i < this.buf.length; i++) rms += this.buf[i] * this.buf[i];
    rms = Math.sqrt(rms / this.buf.length);
    const level = 20 * Math.log10(rms + 1e-9);
    if (level < -58) { this.history = []; this.onReading({ level, hz: null }); return; }
    const r = detect(this.buf, this.ctx.sampleRate);
    if (!r || r.clarity < 0.6) { this.onReading({ level, hz: null }); return; }
    this.history.push(r.hz); if (this.history.length > 5) this.history.shift();
    const sorted = this.history.slice().sort((a, b) => a - b);
    const hz = sorted[sorted.length >> 1];
    this.onReading(Object.assign({ level, hz, clarity: r.clarity }, describe(hz)));
  }
  stop() {
    this.running = false;
    clearInterval(this.timer);
    if (this.src) try { this.src.disconnect(); } catch (e) { /* ignore */ }
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx) this.ctx.close();
    try { if (navigator.audioSession) navigator.audioSession.type = 'auto'; } catch (e) { /* not supported */ }
    this.lastStream = this.stream; this.stream = null; this.ctx = null; this.src = null;
  }
}
