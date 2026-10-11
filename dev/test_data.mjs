// Unit tests for the data model and the pitch detector. Run: node dev/test_data.mjs
import { PLAN, PUBLISHED, beat, midiOf, nameOf, freq, noteInfo, temperamentTable, plainRate, LOW, HIGH, stringsOf, SOURCES, GLOSSARY } from '../js/data.js';
import { yin, detect, describe } from '../js/tuner.js';

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL', msg); } }
const N = midiOf;
const r = (lo, hi, k) => beat(N(lo), k, N(hi));

// 1. frequencies
ok(Math.abs(freq(N('A4')) - 440) < 1e-9, 'A4 = 440');
ok(Math.abs(freq(N('C4')) - 261.6256) < 1e-3, 'C4 = 261.626');
ok(Math.abs(freq(N('A0')) - 27.5) < 1e-9 && Math.abs(freq(N('C8')) - 4186.009) < 1e-2, 'A0 and C8');

// 2. spot values (ideal 12-TET, A440)
const spot = [['F3', 'C4', 'P5', 0.59, 'narrow'], ['F3', 'A#3', 'P4', 0.79, 'wide'], ['F3', 'A3', 'M3', 6.93, 'wide'], ['F#3', 'A#3', 'M3', 7.34, 'wide'], ['G3', 'B3', 'M3', 7.78, 'wide']];
for (const [a, b, k, v, sense] of spot) { const x = r(a, b, k); ok(Math.abs(x.rate - v) < 0.006 && x.sense === sense, `spot ${a}-${b} ${k} = ${x.rate.toFixed(3)} ${x.sense} (want ${v} ${sense})`); }

// 3. published tables (US Patent 8,569,607 Fig. 4; Wikipedia ET table)
let maxd = 0;
for (const [a, b, k, v, src] of PUBLISHED) { const d = Math.abs(r(a, b, k).rate - v); maxd = Math.max(maxd, d); ok(d < 0.01, `published ${a}-${b} ${k}: ours ${r(a, b, k).rate.toFixed(4)} vs ${v} (${src})`); }
console.log(`published cross-check: ${PUBLISHED.length} values, max difference ${maxd.toFixed(4)} beats/s`);

// 4. tempering direction across the whole temperament table
for (const row of temperamentTable()) {
  ok(row.P5.sense === 'narrow', row.name + ' 5th narrow'); ok(row.P4.sense === 'wide', row.name + ' 4th wide');
  ok(row.M3.sense === 'wide', row.name + ' M3 wide'); ok(row.M6.sense === 'wide', row.name + ' M6 wide');
}
// contiguous chromatic 3rds rise smoothly F3..C#4
const thirds = []; for (let m = N('F3'); m <= N('C#4'); m++) thirds.push(beat(m, 'M3').rate);
ok(thirds.every((x, i) => i === 0 || x > thirds[i - 1]), 'chromatic 3rds rise');
ok(thirds[0] > 6.9 && thirds[thirds.length - 1] < 11.01, '3rds span about 7 to 11');
// 5:4 between 3rds that share a note
ok(Math.abs(r('A3', 'C#4', 'M3').rate / r('F3', 'A3', 'M3').rate - 1.26) < 0.01, 'contiguous 3rds about 5:4');

// 5. every key is tuned exactly once, from a note tuned earlier
const order = (m) => PLAN.notes[m].tunedBy.step;
for (let m = LOW; m <= HIGH; m++) {
  const tb = PLAN.notes[m].tunedBy;
  ok(!!tb && tb.step >= 1 && tb.step <= PLAN.steps.length, nameOf(m) + ' has a tuning step');
  if (tb && tb.from != null) {
    const fs = order(tb.from);
    const earlier = fs < tb.step || (fs === tb.step && ((tb.from < m && m > N('F4')) || (tb.from > m && m < N('F3'))));
    ok(earlier, `${nameOf(m)} (step ${tb.step}) is tuned from ${nameOf(tb.from)} (step ${fs}) which is already done`);
  }
}
// checks only use notes that are already tuned when the check is made
for (let m = LOW; m <= HIGH; m++) for (const c of PLAN.notes[m].checks) {
  const ivs = c.pair || [c.interval];
  for (const iv of ivs) for (const x of [iv.lo, iv.hi]) {
    const tb = PLAN.notes[x].tunedBy;
    const fine = tb.step < c.step || (tb.step === c.step && (x === m || (m > N('F4') ? x < m : m < N('F3') ? x > m : true)));
    ok(fine, `check ${nameOf(iv.lo)}-${nameOf(iv.hi)} (step ${c.step}) uses ${nameOf(x)} tuned in step ${tb.step}`);
  }
}

// 6. step-through and pick-a-note agree
for (const s of PLAN.steps) if (s.target && s.target.ref) {
  const info = noteInfo(N(s.target.note));
  ok(info.tunedBy.step === s.n, `${s.target.note}: note panel says step ${info.tunedBy.step}, steps say ${s.n}`);
  ok(Math.abs(info.tunedBy.interval.rate - s.target.rate) < 1e-12, `${s.target.note}: same rate in both views`);
  ok(s.acts.join(' ').includes(plainRate(s.target.rate)) || s.target.kind === 'P8', `${s.target.note}: step text carries the computed target`);
}

// 7. paired tests really are equal in ideal ET (4th-5th, 3rd-10th, m3-M6)
let pairs = 0;
for (let m = LOW; m <= HIGH; m++) for (const c of PLAN.notes[m].checks) if (c.pair && c.pair.length === 2 && /4th-5th|3rd-10th|minor 3rd \/ major 6th/.test(c.test)) {
  pairs++; ok(Math.abs(c.pair[0].rate - c.pair[1].rate) < 1e-6, `${c.test} for ${nameOf(m)}: ${c.pair[0].rate} vs ${c.pair[1].rate}`);
}
for (let m = LOW; m <= HIGH; m++) for (const c of PLAN.notes[m].checks) if (c.pair && /rising 3rds|falling 3rds|falling 10ths/.test(c.test)) ok(c.pair[0].rate < c.pair[1].rate, `${c.test} for ${nameOf(m)} is ordered slower-then-faster`);
console.log('paired equal-speed tests checked:', pairs);

// 8. the comparative sentences in the temperament steps are numerically true
const cmp = [
  [['F3', 'D4', 'M6'], '>', ['F3', 'A3', 'M3']], [['A#3', 'D4', 'M3'], '>', ['F3', 'A3', 'M3']],
  [['G#3', 'C4', 'M3'], 'between', ['F3', 'A3', 'M3'], ['A#3', 'D4', 'M3']], [['A3', 'C#4', 'M3'], 'between', ['G#3', 'C4', 'M3'], ['A#3', 'D4', 'M3']],
  [['F#3', 'A#3', 'M3'], 'between', ['F3', 'A3', 'M3'], ['G#3', 'C4', 'M3']], [['F#3', 'D#4', 'M6'], '>', ['F3', 'D4', 'M6']],
  [['G3', 'B3', 'M3'], 'between', ['F#3', 'A#3', 'M3'], ['G#3', 'C4', 'M3']], [['B3', 'D#4', 'M3'], 'between', ['A#3', 'D4', 'M3'], ['C4', 'E4', 'M3']],
  [['C4', 'E4', 'M3'], '>', ['B3', 'D#4', 'M3']], [['E4', 'A4', 'P4'], '>', ['D#4', 'G#4', 'P4']],
];
for (const [a, op, b, c] of cmp) {
  const x = r(...a).rate, y = r(...b).rate, z = c ? r(...c).rate : null;
  ok(op === '>' ? x > y : x > y && x < z, `${a.join('-')} ${op} ${b.join('-')}${c ? ' and ' + c.join('-') : ''}`);
}
ok(Math.abs(r('D4', 'A4', 'P5').rate - r('A3', 'D4', 'P4').rate) < 1e-9, 'D4+A4 5th equals A3+D4 4th');
ok(Math.abs(r('A#3', 'F4', 'P5').rate - r('F3', 'A#3', 'P4').rate) < 1e-9, 'A#3+F4 5th equals F3+A#3 4th');
ok(r('C#4', 'F4', 'M3').rate === Math.max(...thirds), 'C#4+F4 is the fastest 3rd of the octave');

// 9. plain-language wording
ok(plainRate(0) === 'no wobble at all', 'plain 0');
ok(plainRate(0.59) === 'about 3 wobbles in 5 seconds', 'plain 0.59');
ok(plainRate(0.994) === 'about 5 wobbles in 5 seconds', 'plain 0.99');
ok(plainRate(6.93).startsWith('about 7 a second'), 'plain 6.93');

// 10. strings, sources, glossary
ok(stringsOf(N('A0')) === 1 && stringsOf(N('G1')) === 2 && stringsOf(N('C#3')) === 3 && stringsOf(N('C8')) === 3, 'typical string counts');
const ids = new Set(SOURCES.map((s) => s.id));
const text = JSON.stringify(PLAN.steps) + JSON.stringify(Object.values(GLOSSARY));
for (const m of text.matchAll(/\[src:([a-z0-9-]+)\]/g)) ok(ids.has(m[1]), 'source id exists: ' + m[1]);
for (const m of text.matchAll(/\[\[([a-z]+)/g)) ok(!!GLOSSARY[m[1]], 'glossary term exists: ' + m[1]);
for (const s of PLAN.steps) for (const id of s.src || []) ok(ids.has(id), `step ${s.n} source ${id}`);

// 11. YIN on synthetic piano-like tones (harmonics, weak fundamental in the bass, a little noise)
function synth(f0, sr, n, { weakFund = false } = {}) {
  const b = new Float32Array(n); let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  for (let k = 1; k <= 10; k++) { if (f0 * k > sr / 2.2) break; const a = (weakFund && k === 1 ? 0.15 : 1) / k; const ph = k * 0.7; for (let i = 0; i < n; i++) b[i] += a * Math.sin(2 * Math.PI * f0 * k * i / sr + ph); }
  for (let i = 0; i < n; i++) b[i] = b[i] * 0.3 + rnd() * 0.01;
  return b;
}
let worst = 0;
for (const [name, cents] of [['A0', 0], ['A1', 0], ['E2', 5], ['A2', -12], ['C4', 3], ['A4', 0], ['A4', 20], ['A4', -30], ['E5', 7], ['C6', -4], ['A6', 0], ['C7', 2], ['C8', 0]]) {
  const f = freq(N(name)) * Math.pow(2, cents / 1200);
  const res = detect(synth(f, 48000, 16384, { weakFund: N(name) < N('A2') }), 48000);
  const d = res ? describe(res.hz) : null;
  const err = d ? d.cents - cents : NaN;
  if (d && d.name === name) worst = Math.max(worst, Math.abs(err));
  ok(d && d.name === name && Math.abs(err) < 1.5, `yin ${name} ${cents >= 0 ? '+' : ''}${cents}c -> ${d ? d.name + ' ' + d.cents.toFixed(2) + 'c' : 'null'}`);
}
console.log('detect worst error on harmonic synthetic tones:', worst.toFixed(3), 'cents');
// stiff strings: partial k at k*f0*sqrt(1+B k^2). The tuner should read partial 1 (the fundamental).
function stiff(f0, B, sr, n, weak) { const b = new Float32Array(n); for (let k = 1; k <= 12; k++) { const fk = k * f0 * Math.sqrt(1 + B * k * k); if (fk > sr / 2.2) break; const a = (weak && k === 1 ? 0.15 : 1) / k; for (let i = 0; i < n; i++) b[i] += a * Math.sin(2 * Math.PI * fk * i / sr + k); } return b; }
let worstStiff = 0;
for (const [name, B] of [['A0', 0.0002], ['A1', 0.0002], ['A2', 0.0001], ['A3', 0.0003], ['A4', 0.0004], ['A5', 0.001], ['C6', 0.002], ['C7', 0.006], ['C8', 0.02]]) {
  const f0 = freq(N(name)); const f1 = f0 * Math.sqrt(1 + B);
  const res = detect(stiff(f0, B, 48000, 16384, N(name) < N('A2')), 48000);
  const err = res ? 1200 * Math.log2(res.hz / f1) : NaN; worstStiff = Math.max(worstStiff, Math.abs(err));
  ok(res && Math.abs(err) < 1.0, `stiff ${name} B=${B}: reads fundamental within ${err.toFixed(3)} c`);
}
console.log('detect worst error on stiff-string tones (vs the fundamental):', worstStiff.toFixed(3), 'cents');
detect(new Float32Array(16384).map(() => Math.random() - 0.5), 48000); ok(true, 'noise does not crash');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
