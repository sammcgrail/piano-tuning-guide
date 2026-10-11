/*
 * data.js - the single source of truth for the guide.
 *
 * Everything the page says about a note, an interval or a step is computed here:
 * the step-through cards, the pick-a-note panel, the beat-rate table and the audio
 * demos all read from PLAN, so they cannot disagree. No DOM, no three.js: this file
 * also runs under Node for the tests in dev/.
 *
 * Beat rates are IDEAL: 12-tone equal temperament at A4 = 440 Hz on perfectly
 * harmonic strings (partial n = n x fundamental). Real strings are stiff
 * (inharmonic), so on a real piano treat every rate as "approximately".
 */

export const A4_HZ = 440;
export const LOW = 21;   // A0, key 1
export const HIGH = 108; // C8, key 88
const PC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = { 'C#': 'D♭', 'D#': 'E♭', 'F#': 'G♭', 'G#': 'A♭', 'A#': 'B♭' };

export function nameOf(m) { return PC[m % 12] + (Math.floor(m / 12) - 1); }
export function flatName(m) { const p = PC[m % 12]; return FLATS[p] ? FLATS[p] + (Math.floor(m / 12) - 1) : null; }
export function midiOf(name) {
  const r = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!r) throw new Error('bad note name ' + name);
  return 12 * (Number(r[2]) + 1) + PC.indexOf(r[1]);
}
export function freq(m) { return A4_HZ * Math.pow(2, (m - 69) / 12); }
export function keyNo(m) { return m - 20; }
export function isBlack(m) { return [1, 3, 6, 8, 10].indexOf(m % 12) >= 0; }

/* Typical upright stringing (it varies by make; check your own piano):
   about 10 single-string notes at the bottom, the next 18 with two strings,
   and the top 60 with three. (Sources: UBC Science Creative Quarterly "Composure";
   anonymous tuning course PTUNE ch. 2; see SOURCES.) */
export function stringsOf(m) { const k = keyNo(m); return k <= 10 ? 1 : k <= 28 ? 2 : 3; }
export function isWound(m) { return keyNo(m) <= 28; }

/* Interval kinds. lo/hi = the partial numbers that (nearly) coincide:
   lo-th partial of the lower note against hi-th partial of the upper note. */
export const KINDS = {
  U:   { semis: 0,  lo: 1, hi: 1, name: 'unison',        short: 'unison', pure: '1:1', term: 'unison' },
  m3:  { semis: 3,  lo: 6, hi: 5, name: 'minor 3rd',     short: 'm3',  pure: '6:5', term: 'third' },
  M3:  { semis: 4,  lo: 5, hi: 4, name: 'major 3rd',     short: 'M3',  pure: '5:4', term: 'third' },
  P4:  { semis: 5,  lo: 4, hi: 3, name: '4th',           short: '4th', pure: '4:3', term: 'fourth' },
  P5:  { semis: 7,  lo: 3, hi: 2, name: '5th',           short: '5th', pure: '3:2', term: 'fifth' },
  M6:  { semis: 9,  lo: 5, hi: 3, name: 'major 6th',     short: 'M6',  pure: '5:3', term: 'sixth' },
  P8:  { semis: 12, lo: 2, hi: 1, name: 'octave',        short: 'octave', pure: '2:1', term: 'octave' },
  M10: { semis: 16, lo: 5, hi: 2, name: '10th',          short: '10th', pure: '5:2', term: 'tenth' },
  P12: { semis: 19, lo: 3, hi: 1, name: '12th',          short: '12th', pure: '3:1', term: 'twelfth' },
  P15: { semis: 24, lo: 4, hi: 1, name: 'double octave', short: '2 oct', pure: '4:1', term: 'octave' },
};

/* The beat between two notes = the difference between their coincident partials.
   Returns {lo, hi, kind, rate (beats per second, >= 0), sense, hz} where
   sense is 'wide' (upper partial sharp of the lower one), 'narrow' or 'pure',
   and hz is the pitch where the beat lives (the coincident partial). */
export function beat(lo, kind, hiOverride) {
  const K = KINDS[kind];
  const hi = hiOverride == null ? lo + K.semis : hiOverride;
  const a = K.lo * freq(lo), b = K.hi * freq(hi);
  const d = b - a;
  return { lo, hi, kind, rate: Math.abs(d), sense: Math.abs(d) < 1e-6 ? 'pure' : d > 0 ? 'wide' : 'narrow', hz: (a + b) / 2 };
}
/* The pure (beatless) partner of `ref` for this interval, used by the audio demos. */
export function pureFreq(ref, kind, targetIsUpper) {
  const K = KINDS[kind];
  return targetIsUpper ? freq(ref) * K.lo / K.hi : freq(ref) * K.hi / K.lo;
}

/* ---------- plain-language helpers ---------- */
export function fmtRate(r) { return r < 0.005 ? '0' : r.toFixed(2); }
export function plainRate(r) {
  if (r < 0.03) return 'no wobble at all';
  if (r < 0.3) return 'about 1 wobble every ' + Math.round(1 / r) + ' seconds';
  if (r < 2) return 'about ' + Math.round(r * 5) + ' wobbles in 5 seconds';
  if (r < 4.5) return 'about ' + Math.round(r) + ' wobbles a second';
  if (r < 17) return 'about ' + Math.round(r) + ' a second, a quick flutter';
  return 'a fast buzz, too quick to count';
}
export function nearestNoteName(hz) {
  const m = Math.round(69 + 12 * Math.log2(hz / A4_HZ));
  return m >= 0 && m < 128 ? nameOf(m) : '';
}

/* ---------- glossary (plain words first) ---------- */
export const GLOSSARY = {
  beat: ['Beat (the wobble)', 'A steady wah-wah pulsing in loudness when two pitches are close but not equal. The pulse rate in beats per second is exactly the difference between the two frequencies, so a slower wobble means closer.'],
  pure: ['Pure', 'An interval with no wobble at all: the overtones that should match, match exactly.'],
  interval: ['Interval', 'Two notes sounded together, named by their distance: octave, 5th, 4th, 3rd, 6th.'],
  octave: ['Octave', 'Same letter name, 12 keys apart, like A3 and A4. The upper note is twice the frequency.'],
  fifth: ['5th', 'Seven keys apart, like A3 up to E4. A pure 5th is the ratio 3:2. In equal temperament it is tuned a hair narrow.'],
  fourth: ['4th', 'Five keys apart, like A3 up to D4. A pure 4th is 4:3. In equal temperament it is tuned a hair wide.'],
  third: ['Major 3rd', 'Four keys apart, like F3 up to A3. A pure major 3rd is 5:4. In equal temperament it is noticeably wide, so it flutters fast (about 7 to 11 times a second in the middle octave).'],
  sixth: ['Major 6th', 'Nine keys apart, like F3 up to D4. Pure is 5:3. Tuned wide, so it flutters fast too.'],
  tenth: ['10th', 'A major 3rd plus an octave, like F3 up to A4. A handy check in the bass.'],
  twelfth: ['12th', 'A 5th plus an octave, like A3 up to E5. A check for the high treble.'],
  narrow: ['Narrow', 'The two notes sit a hair closer together than pure.'],
  wide: ['Wide', 'The two notes sit a hair further apart than pure.'],
  temperament: ['Temperament', 'The way the 12 notes of an octave are set against each other. Equal temperament makes all 12 steps the same size, so every key sounds equally good.'],
  et: ['Equal temperament', 'All 12 semitones equal (each 2 to the power 1/12). It spreads the small mismatch between pure 5ths and octaves evenly, so every 5th is a hair narrow and every 4th a hair wide.'],
  tempoct: ['Temperament octave', 'The middle octave (here F3 to F4) that you tune first, by ear, with 4ths and 5ths. The rest of the piano is copied from it by octaves.'],
  unison: ['Unison', 'The 2 or 3 strings of one note, tuned to sound as one. A good unison has no wobble at all.'],
  partial: ['Partial (overtone)', 'A string sounds its main pitch plus fainter higher pitches at 2, 3, 4 ... times the frequency. Beats come from partials of two notes that nearly line up.'],
  inharm: ['Inharmonicity', 'Piano wire is stiff, so its partials run a little sharp of exact multiples. Short strings (small uprights, the top treble) have more of it.'],
  stretch: ['Stretch', 'Because of inharmonicity, octaves that sound clean are a little wider than exactly 2:1. So a good tuning ends sharp at the top and flat at the bottom: a few cents near the middle, up to about 35 cents at the very ends. That is normal.'],
  cents: ['Cents', 'A hundredth of a semitone. 1200 cents make an octave.'],
  setpin: ['Setting the pin', 'Leaving the tuning pin firmly turned in the block, with no twist stored in it, so the note stays put. Small final moves and firm test blows do it.'],
  testblow: ['Test blow', 'A firm (not violent) key strike that settles the string over its bearing points. If the pitch moves after a few, tune it again.'],
  strip: ['Felt temperament strip', 'A long felt strip pushed between the strings so only the middle string of each note in the middle octave sounds.'],
  mute: ['Mute', 'A rubber or felt wedge pushed between two strings to silence them while you tune a neighbour.'],
  lever: ['Tuning lever (tuning hammer)', 'A handle with a star-shaped socket that fits over the square end of a tuning pin. Most pianos take a #2 tip.'],
  pin: ['Tuning pin', 'The steel pin the string is wound around, driven tightly into the wooden pin block. Turning it clockwise tightens the string and raises the pitch.'],
  pitchraise: ['Pitch raise', 'A quick rough tuning that brings a piano that is well flat up near pitch first, because a big change in tension pulls everything out again.'],
  flagpole: ['Flagpoling', 'Bending the pin sideways instead of turning it. It moves the pitch for a moment and then springs back.'],
  falsebeat: ['False beat', 'A wobble that is not the beat you are tuning. It comes from the string itself, its bridge pins or other parts of the piano. Careful unison tuning can hide some of them; otherwise tune to the main beat and ignore it.'],
};

/* ---------- sources (shown on the page; ids referenced as [src:id]) ---------- */
export const SOURCES = [
  { id: 'wiki-tuning', t: 'Piano tuning', by: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Piano_tuning', why: 'Temperament strip, checks with successive 3rds, equal-temperament beat table (C4-C5)' },
  { id: 'iu-et', t: 'Equal Temperament', by: 'Indiana University Jacobs School, Piano Technology', url: 'https://web.archive.org/web/20240301010620/https://intranet.music.indiana.edu/departments/offices/piano-technology/temperaments/equal-temperament.html', why: 'A4 from fork, A3 from A4, 4ths wide by about 1 beat per second, thirds near 7-10/s' },
  { id: 'iu-ex1', t: 'Unison Exercise', by: 'Indiana University Piano Technology', url: 'https://web.archive.org/web/2024id_/https://intranet.music.indiana.edu/departments/offices/piano-technology/temperaments/exercise-1.html', why: 'Follow the string to its pin, turn down first, play the note while you move the pin' },
  { id: 'iu-ex2', t: 'Exercise 2', by: 'Indiana University Piano Technology', url: 'https://web.archive.org/web/20250116220232/https://intranet.music.indiana.edu/departments/offices/piano-technology/temperaments/exercise-2.html', why: '3rds and 4ths tempered wide, 5ths narrow' },
  { id: 'iu-comma', t: 'Pythagorean Comma', by: 'Indiana University Piano Technology', url: 'https://web.archive.org/web/20241210210000/https://intranet.music.indiana.edu/departments/offices/piano-technology/temperaments/pythagorean-comma.html', why: 'A circle of pure 5ths does not come back to where it started' },
  { id: 'white', t: 'Modern Piano Tuning and Allied Arts (1917)', by: 'William Braid White', url: 'https://www.mmdigest.com/Smythe/Piano_Tuning_and_Allied_Arts.pdf', why: 'The classic F-to-F circle of 4ths and 5ths, strip on the outer strings, hold the lever nearly vertical on uprights' },
  { id: 'howard4', t: 'How to Tune a Piano, Part 4: Tuning Hammer Technique', by: 'Howard Piano Industries', url: 'https://www.howardpianoindustries.com/blog/how-to-tune-a-piano-part-4/', why: 'Lever between 12 and 2 o\'clock, pull a little above pitch and settle down, turn the pin rather than twist it' },
  { id: 'howard5', t: 'How to Tune a Piano, Part 5: Tuning the Midrange', by: 'Howard Piano Industries', url: 'https://www.howardpianoindustries.com/blog/how-to-tune-a-piano-part-5/', why: 'Putting the strip in, firm test blows, pitch raise if 5-10 cents off' },
  { id: 'howard6', t: 'How to Tune a Piano, Part 6: Tuning the Unisons', by: 'Howard Piano Industries', url: 'https://www.howardpianoindustries.com/blog/how-to-tune-a-piano-part-6/', why: 'Pull the strip note by note with the damper pedal down' },
  { id: 'howard-fork', t: 'Setting A440 to a Tuning Fork', by: 'Howard Piano Industries', url: 'https://www.howardpianoindustries.com/blog/setting-a440-with-a-tuning-fork/', why: 'Strike the fork on your knee, not the piano case' },
  { id: 'sturm', t: 'Tuning Hammer Technique', by: 'Fred Sturm, Piano Technicians Guild blog', url: 'https://my.ptg.org/blogs/fred-sturm/2016/10/28/tuning-hammer-technique', why: 'Lever near 12 o\'clock, approach from below, firm test blows' },
  { id: 'ptg-faq', t: 'Beginner FAQs', by: 'Piano Technicians Guild', url: 'https://my.ptg.org/ptgeducation/beginner/FAQs', why: '4 hours to 4 days for a first tuning; pros take 1-2 hours' },
  { id: 'strip-vertical', t: 'Inserting a Strip Mute in the Treble of a Vertical Piano', by: 'Piano World forum (technicians)', url: 'https://forum.pianoworld.com/ubbthreads.php/topics/1732020/1.html', why: 'Tuck the strip beneath the dampers and push it down below where the hammers strike' },
  { id: 'falsebeats', t: 'False Beats: Two Origins, Acoustic vs Mechanical', by: 'Piano Technicians Guild forum', url: 'https://my.ptg.org/discussion/false-beats-two-origins-acoustic-vs-mechanical', why: 'Technicians ignore false beats and tune the real beat; careful unisons can mask some' },
  { id: 'sjpiano', t: 'Copper-wound vs. plain wire strings', by: 'SJ Piano Service', url: 'https://sjpianoservice.com/2017/05/copper-wound-vs-plain-wire-strings/', why: 'Usually somewhere in the octave below middle C, pianos switch to plain wire' },
  { id: 'frederick', t: 'How Pianos Work', by: 'Frederick Historic Piano Collection', url: 'https://www.frederickcollection.org/works.html', why: 'Where strings per note change is not standardized between makes' },
  { id: 'chang-start', t: 'Getting Started (tuning)', by: 'Chuan C. Chang', url: 'https://mail.pianofundamentals.com/book/en/2.5', why: 'Rotate pins in slow, small increments; a wrong pin can be turned until the string breaks' },
  { id: 'chang-uni', t: 'Sympathetic Vibrations (unisons)', by: 'Chuan C. Chang', url: 'https://mail.pianofundamentals.com/book/en/2.5.4', why: 'Always tune one string to one, never one to two' },
  { id: 'p4p5', t: 'The rationale in using P4/P5 interval to test an octave', by: 'Piano World forum (RPT replies)', url: 'https://forum.pianoworld.com/ubbthreads.php/topics/3158554/the-rationale-in-using-p4-p5-interval-to-test-an-octave.html', why: 'The 4th and 5th inside an octave beat alike when the octave is right; plain wire may end around F2' },
  { id: 'yamaha-frame', t: 'The Optimal Material for Piano Frames', by: 'Yamaha', url: 'https://dk.yamaha.com/en/musical-instruments/pianos/explore/musical-instrument-guide/piano/trivia/trivia005.html', why: 'String tension from 16 to 20 tons altogether' },
  { id: 'yamaha-strings', t: 'Design of the Strings Enriches the Sound', by: 'Yamaha', url: 'https://dk.yamaha.com/da/products/contents/musical_instrument_guide/piano/mechanism/mechanism004.html', why: 'Strings per note go from three to two to one toward the bass' },
  { id: 'mingli', t: 'Piano care', by: 'Ming Li\'s Piano Service (RPT)', url: 'https://terpconnect.umd.edu/~fuali/ming2.htm', why: 'Dryness makes the pitch go flat; moisture makes it go sharp' },
  { id: 'ptg-exam', t: 'Understanding the RPT Tuning Exam', by: 'Piano Technicians Guild', url: 'https://my.ptg.org/HigherLogic/System/DownloadDocumentFile.ashx?DocumentFileKey=119bbd28-1859-d5db-d324-1e9cfd671728', why: 'Pitch source may be a fork or an electronic device; more than 1.0 cent off costs points' },
  { id: 'ptg-check', t: 'Basic Tuning Skills Checklist', by: 'Piano Technicians Guild', url: 'https://my.ptg.org/ptgeducation/beginner/checklist/basic-tuning-skills-checklist', why: 'Test notes for wide/narrow 4ths and 5ths; M3-M10, m3-M6, M10-M17 octave tests' },
  { id: 'cerisano', t: 'Aural Stretch Using Beat Speed Windows (PTJ, Nov 2017)', by: 'Mark Cerisano RPT', url: 'https://howtotunepianos.com/wp-content/uploads/2020/02/PTJ-Stretch-for-public.pdf', why: 'M3/M6 test for 4ths; M3 = M10 for a 4:2 octave; pure 12th test' },
  { id: 'bremmer', t: 'Equal Temperament by ear (contiguous 3rds)', by: 'Bill Bremmer RPT, Piano World forum', url: 'https://forum.pianoworld.com/ubbthreads.php/topics/636677.html', why: 'Each higher 3rd beats a little faster; theoretical 4th/5th rates are only a guide' },
  { id: 'brown', t: 'Aural Tuning Strategy: Sanderson/Brown', by: 'Christopher Brown', url: 'https://grandwork.tools/blogs/chris/aural-tuning-temperament-sanderson-brown', why: 'Smoothly rising chromatic 3rds, 6ths and 10ths as the test of a good tuning' },
  { id: 'chang', t: 'Fundamentals of Piano Practice, ch. 2 (Tuning)', by: 'Chuan C. Chang', url: 'https://fundamentals-of-piano-practice.readthedocs.io/chapter2/CH2.6.html', why: 'Beginner-level lever technique: tiny moves, brace your hand, final motion sets the pin' },
  { id: 'chang-lever', t: 'Engaging and Manipulating the Tuning Lever', by: 'Chuan C. Chang', url: 'https://mail.pianofundamentals.com/book/en/2.5.1', why: 'Seat the socket fully; most pianos take a #2 tip' },
  { id: 'patent', t: 'US Patent 8,569,607, Fig. 4', by: 'Google Patents', url: 'https://patents.google.com/patent/US8569607B1/en', why: 'Published table of equal-temperament beat rates for every interval in F3-F4 at A440 (cross-check)' },
  { id: 'guinn', t: 'Tuning a Piano (essay with beat tables)', by: 'Don Guinn, J Software wiki', url: 'https://code.jsoftware.com/wiki/Essays/PianoTuning', why: 'Second computed A440 beat table (cross-check)' },
  { id: 'comma', t: 'Pythagorean comma', by: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Pythagorean_comma', why: '12 pure 5ths overshoot 7 octaves by about 23.46 cents' },
  { id: 'diesis', t: 'Diesis', by: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Diesis', why: '3 pure major 3rds fall about 41 cents short of an octave' },
  { id: 'beats', t: 'Interference beats and Tartini tones', by: 'UNSW Music Acoustics', url: 'https://newt.phys.unsw.edu.au/jw/beats.html', why: 'Beats per second = difference in frequency' },
  { id: 'stretch', t: 'Stretched tuning', by: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Stretched_tuning', why: 'Octaves tuned slightly wider than 2:1' },
  { id: 'railsback', t: 'Piano acoustics (Railsback curve)', by: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Piano_acoustics', why: 'Stretch comes from inharmonicity, not imprecision' },
  { id: 'pianometer', t: 'PianoMeter support: stretch', by: 'PianoMeter', url: 'https://pianometer.com/support/', why: 'A4-A5 about 2 cents wide; small pianos often tuned to clean 6:3 octaves' },
  { id: 'yamaha', t: 'Tuning Once a Year', by: 'Yamaha', url: 'https://dk.yamaha.com/en/musical-instruments/pianos/explore/musical-instrument-guide/piano/maintenance/maintenance002.html', why: 'Strings average about 90 kg of tension each' },
  { id: 'richards', t: 'Does my Piano Need a Pitch-Raise?', by: 'Richards Piano Service', url: 'https://www.richardspianoservice.com/blog/2012/03/02/does-my-piano-need-a-pitch-raise/', why: 'More than several cents flat needs a pitch raise first' },
  { id: 'steves', t: 'Broken wire emergency', by: 'Steve\'s Piano Service', url: 'https://www.stevespianoservice.com/Free-Online-Piano-Repair-Instruction/07-repairing-broken-piano-wire.htm', why: 'Broken wire cuts; wear glasses when removing it' },
  { id: 'shepherd', t: 'Mutes', by: 'Martin Shepherd RPT', url: 'https://mshepherdpiano.com/antique-piano-tools/mutes/', why: 'Papps mutes for uprights silence two strings of a trichord' },
  { id: 'ubc', t: 'Composure', by: 'UBC Science Creative Quarterly', url: 'https://www.scq.ubc.ca/composure/', why: 'Typical stringing: 10 single, 18 double, 60 triple' },
];

/* ---------- the plan ---------- */
const N = midiOf;

/* Temperament octave F3-F4. A4 from the reference, A3 by octave, then the circle of
   4ths and 5ths (A-D-G-C-F-Bb-Eb-Ab-Db-Gb-B-E) inside F3-F4, then F4 by octave.
   It is William Braid White's F-to-F circle (1917) run the other way round and started
   from A440: every 4th goes UP and every 5th goes DOWN, so every new note is brought
   UP through the still point and stops a hair sharp of pure. */
const TEMPERAMENT = [
  ['A3', 'A4', 'P8'], ['D4', 'A3', 'P4'], ['G3', 'D4', 'P5'], ['C4', 'G3', 'P4'], ['F3', 'C4', 'P5'],
  ['A#3', 'F3', 'P4'], ['D#4', 'A#3', 'P4'], ['G#3', 'D#4', 'P5'], ['C#4', 'G#3', 'P4'], ['F#3', 'C#4', 'P5'],
  ['B3', 'F#3', 'P4'], ['E4', 'B3', 'P4'], ['F4', 'F3', 'P8'],
];
/* Checks that become possible right after each temperament note (hand-picked: the
   ones a learner can actually hear). Each entry: [lo, hi, kind, comment]. */
const T_CHECKS = {
  'D4': [['D4', 'A4', 'P5', 'Should wobble at the same speed as the 4th {A3+D4:P4} you just tuned. If the two differ, A3 is off from A4: retune the octave.']],
  'F3': [['F3', 'A3', 'M3', 'Your first major 3rd: a fast flutter. This one is the yardstick for every 3rd that follows.'],
         ['F3', 'D4', 'M6', 'A little faster than {F3+A3:M3}. If it is slower, the 4th A3+D4 came out narrow: redo D4.']],
  'A#3': [['A#3', 'D4', 'M3', 'Faster than {F3+A3:M3}.']],
  'G#3': [['G#3', 'C4', 'M3', 'Between {F3+A3:M3} and {A#3+D4:M3}.']],
  'C#4': [['A3', 'C#4', 'M3', 'Between {G#3+C4:M3} and {A#3+D4:M3}.']],
  'F#3': [['F#3', 'A#3', 'M3', 'Just faster than {F3+A3:M3}, slower than {G#3+C4:M3}.'],
          ['F#3', 'D#4', 'M6', 'A fast flutter, a little faster than {F3+D4:M6}.']],
  'B3': [['G3', 'B3', 'M3', 'Between {F#3+A#3:M3} and {G#3+C4:M3}.'],
         ['B3', 'D#4', 'M3', 'Between {A#3+D4:M3} and {C4+E4:M3}, which comes later.']],
  'E4': [['A3', 'E4', 'P5', 'The circle closes here. This 5th should wobble slowly, a hair narrow.'],
         ['E4', 'A4', 'P4', 'A hair wide, a bit faster than earlier 4ths such as {A3+D4:P4} and {B3+E4:P4}. If A3+E4 or E4+A4 sound wrong, an earlier note is off: walk back through the 3rds to find it.'],
         ['C4', 'E4', 'M3', 'Faster than {B3+D#4:M3}.']],
  'F4': [['A#3', 'F4', 'P5', 'Should match the 4th {F3+A#3:P4} (the 4th-5th test for the F3-F4 octave).'],
         ['C4', 'F4', 'P4', 'A hair wide.'],
         ['C#4', 'F4', 'M3', 'The fastest 3rd of the octave, just above {C4+E4:M3}.']],
};

function iv(lo, hi, kind) { const b = beat(N(lo), kind, N(hi)); b.loName = lo; b.hiName = hi; return b; }
function ivm(lo, hi, kind) { const b = beat(lo, kind, hi); b.loName = nameOf(lo); b.hiName = nameOf(hi); return b; }

function build() {
  const steps = [];
  const notes = {}; // midi -> {tunedBy:{step, from, interval}, checks:[], usedFor:[], unisonStep}
  for (let m = LOW; m <= HIGH; m++) notes[m] = { m, checks: [], usedFor: [], tunedBy: null, unisonStep: null };
  const add = (s) => { s.n = steps.length + 1; steps.push(s); return s; };

  /* ---- 1-6: basics and set-up ---- */
  add({ id: 'start', chapter: 'Start', title: 'Tune an upright by ear, at A = 440',
    lead: 'Five moves: set one note to 440 Hz, build the middle octave from it with slow-wobbling 4ths and 5ths, check it with the fast 3rds, make each note\'s strings agree, then copy it outward by octaves.',
    acts: ['Go through the steps in order. Each one lights up the keys to play and the pin to turn.',
           'Tap the [[beat|beats]], [[fifth|5ths]] and other underlined words for a plain explanation.',
           'Expect a first tuning to take a long afternoon or more. Professionals take 1 to 2 hours. [src:ptg-faq]'],
    tip: 'Before anything else, open the Tuner tab and play A4. If it reads more than about 5 to 10 cents off, the piano needs a [[pitchraise|pitch raise]] first, or a technician. [src:howard5] [src:richards]',
    view: 'overview', demo: null });

  add({ id: 'beats', chapter: 'Start', title: 'What you listen for: the wobble',
    lead: 'Two strings that are almost, but not quite, at the same pitch make a steady wah-wah pulse. That pulse is a [[beat]]. The further apart they are, the faster it wobbles; when they match, it stops.',
    acts: ['Tap Hear it: first two tones exactly together (still), then 2 Hz apart (2 wobbles a second).',
           'Tuning by ear is steering that wobble: stop it for octaves and unisons, set it to a slow, chosen speed for 4ths and 5ths.',
           'Count slow wobbles for 5 seconds against a clock. "About 3 in 5 seconds" is 0.6 beats per second.'],
    tip: 'The wobble is often loudest in a higher, thinner part of the sound (where the two notes\' [[partial|overtones]] meet), not at the pitch you play. Each step tells you where.',
    view: 'unison', focus: ['A4'], demo: { type: 'beats', hz: 440, off: 2 }, src: ['beats', 'wiki-tuning'] });

  add({ id: 'why', chapter: 'Start', title: 'Why the 5ths cannot all be pure',
    lead: 'Twelve pure 5ths stacked up overshoot seven octaves by about a quarter of a semitone (23.5 [[cents]]). Something has to give, so [[et|equal temperament]] shaves a tiny bit off every 5th and spreads the error evenly, and every key sounds equally good.',
    acts: ['In equal temperament each [[fifth|5th]] is a hair [[narrow]] (about 2 cents) and each [[fourth|4th]] a hair [[wide]]: both wobble slowly, roughly once a second or a bit less in the middle octave.',
           'The [[third|major 3rds]] are much further from pure (three pure 3rds fall about 41 cents short of an octave), so they wobble fast, about 7 to 11 times a second, faster as you go up.',
           'That is the whole method: tune 4ths and 5ths to a slow wobble, then use the fast 3rds to check you got them right.'],
    tip: 'Hear it plays the 5th F3+C4 pure, then as equal temperament tunes it (about 3 wobbles in 5 seconds).',
    view: 'temperament', focus: ['F3', 'C4'], demo: { type: 'interval', lo: 'F3', hi: 'C4', kind: 'P5', target: 'C4' }, src: ['comma', 'diesis', 'iu-comma'] });

  add({ id: 'tools', chapter: 'Set up', title: 'Tools and safety',
    lead: 'You need a [[lever|tuning lever]], a [[strip|felt temperament strip]], two or three rubber [[mute|mutes]] and a 440 Hz reference: a tuning fork, or this page\'s tone and tuner.',
    acts: ['Lift the lid and take off the upper front panel so you can reach the [[pin|tuning pins]] and see the strings.',
           'Each string pulls about 90 kg, some 16 to 20 tons for the whole piano. Turn pins only a little at a time and never crank one that does not seem to change the sound: you may be on the wrong pin. [src:yamaha] [src:yamaha-frame] [src:chang-start]',
           'Old, rusty strings break more easily. If one does break, wear glasses while you remove it: the ends are sharp. [src:steves]'],
    tip: 'Most pianos take a #2 star tip on the lever. [src:chang-lever]',
    view: 'pins', focus: ['A4'], lever: 'A4', demo: null });

  add({ id: 'lever', chapter: 'Set up', title: 'Find the pin and use the lever',
    lead: 'Follow the string up from the note\'s hammer to its pin. Seat the lever all the way down on the pin, with the handle roughly upright (technicians use anything from about 11 to 2 o\'clock), and brace your arm on the piano.',
    acts: ['Clockwise raises the pitch, counter-clockwise lowers it. Turn the pin a hair at a time: the end of the handle should move well under a centimetre. [src:chang]',
           'Play the note while you move the pin. Go down a little first: if nothing changes you are on the wrong pin. [src:iu-ex1]',
           'Turn the pin; do not bend it sideways ([[flagpole|flagpoling]]). [src:howard4]',
           '[[setpin|Set the pin]]: most technicians bring the note a hair above where it should be, then ease the lever back so the pin settles. Some always finish moving up from below. Either way, finish with a few firm [[testblow|test blows]] and listen again. [src:howard4] [src:sturm] [src:white]'],
    tip: 'The animation shows a small clockwise turn, then the ease back that sets the pin.',
    view: 'pins', focus: ['A4'], lever: 'A4', turn: true, demo: null });

  add({ id: 'mute', chapter: 'Set up', title: 'Mute the middle octave',
    lead: 'Push the [[strip|felt strip]] between the strings from about E3 to G4 so that each note there sounds only its middle string. You will tune those middle strings first. [src:wiki-tuning] [src:white]',
    acts: ['Hold the damper pedal down so the dampers lift off the strings, then press the felt in with a screwdriver blade, working along the notes. [src:howard5]',
           'Each 3-string note: the felt goes between its outer strings and the neighbouring notes, so only the middle string is free.',
           'Play each note in the range: you should hear one clean string. If two sound, push the felt in further.'],
    tip: 'Keep the felt out of the hammers\' way: on an upright, technicians push it down below the spot where the hammers strike. For a single note, a rubber wedge or an upright (Papps) mute does the same job. [src:strip-vertical] [src:shepherd]',
    view: 'strip', focus: ['F3', 'F4'], strip: true, demo: null });

  /* ---- 7: A4 from the reference ---- */
  const a4 = add({ id: 'A4', chapter: 'Middle octave', title: 'A4 to 440',
    lead: 'Set the middle string of A4 to exactly 440 Hz. Everything else is built on it.',
    acts: ['Fork: strike it on your knee (not on the piano), touch its stem to the wood of the piano or hold it by your ear, and play A4. Or tap Play 440 Hz below.',
           'Listen for the wobble between the reference and the string. Turn A4 a little flat first, then bring it up until the wobble slows and stops.',
           'Or use the Tuner tab: play A4 and bring it to 0 cents. Within about 1 cent is the standard technicians are tested to. [src:ptg-exam]'],
    tip: 'A fork fades fast and has no overtones, so its wobble is gentle. Strike it again as often as you need.',
    target: { note: 'A4', ref: null, kind: 'U' }, view: 'temperament', focus: ['A4'], lever: 'A4', turn: true,
    demo: { type: 'reference' }, src: ['iu-et', 'howard-fork'] });
  notes[N('A4')].tunedBy = { step: a4.n, from: null, interval: null };

  /* ---- 8-20: the temperament octave ---- */
  const tuned = [N('A4')];
  for (const [t, f, kind] of TEMPERAMENT) {
    const tm = N(t), fm = N(f);
    const upper = tm > fm;
    const lo = upper ? fm : tm, hi = upper ? tm : fm;
    const b = beat(lo, kind, hi); b.loName = nameOf(lo); b.hiName = nameOf(hi);
    const where = nearestNoteName(b.hz);
    const checks = (T_CHECKS[t] || []).map(([l, h, k, c]) => Object.assign(iv(l, h, k), { comment: withRates(c) }));
    let s;
    if (kind === 'P8') {
      s = { id: t, chapter: 'Middle octave', title: t + ' from ' + f + ', an octave ' + (upper ? 'up' : 'down'),
        lead: 'Tune ' + t + ' so the [[octave]] ' + nameOf(lo) + '+' + nameOf(hi) + ' is completely still.',
        acts: ['Put the lever on ' + t + '\'s middle string. Turn it down a little so ' + t + ' starts flat.',
               'Play ' + nameOf(lo) + ' and ' + nameOf(hi) + ' together and keep them sounding.',
               'Bring ' + t + ' up in tiny moves. The wobble slows down; stop where it disappears. If it starts again, you went past: go down and come up again.',
               '[[setpin|Set the pin]], give a few firm [[testblow|test blows]], and listen again.'],
        listen: 'Listen around ' + where + ' (' + Math.round(b.hz) + ' Hz), where the two notes overlap.',
        tip: t === 'F4' ? 'With F4 done, the [[tempoct|temperament octave]] F3 to F4 is complete.' : null };
    } else {
      const K = KINDS[kind];
      s = { id: t, chapter: 'Middle octave', title: t + ' from ' + f + ', a ' + K.name + ' ' + (upper ? 'up' : 'down'),
        lead: 'Tune ' + t + ' so that ' + nameOf(lo) + '+' + nameOf(hi) + ' wobbles slowly: ' + plainRate(b.rate) + '.',
        acts: ['Put the lever on ' + t + '\'s middle string. Turn it down a little so ' + t + ' starts flat.',
               'Play ' + nameOf(lo) + ' and ' + nameOf(hi) + ' together and keep them sounding (re-strike every second or two).',
               'Bring ' + t + ' up in tiny moves. The wobble slows, stops ([[pure]]), then starts again. Keep going until you count ' + plainRate(b.rate) + ' (about ' + fmtRate(b.rate) + ' a second).',
               '[[setpin|Set the pin]], give a few firm [[testblow|test blows]], and count again.'],
        listen: 'The wobble lives up around ' + where + ' (' + Math.round(b.hz) + ' Hz), where ' + nameOf(lo) + '\'s ' + ordinal(K.lo) + ' [[partial]] meets ' + nameOf(hi) + '\'s ' + ordinal(K.hi) + '.',
        why: 'A ' + K.name + ' in equal temperament is a hair ' + (b.sense === 'wide' ? '[[wide]]' : '[[narrow]]') + '. Moving the ' + (upper ? 'top' : 'bottom') + ' note, that means ' + t + ' ends a hair sharp of the still point, so you only ever come up to it.' };
    }
    s.target = { note: t, ref: f, kind, lo: nameOf(lo), hi: nameOf(hi), rate: b.rate, sense: b.sense, hz: b.hz, upper };
    s.checks = checks;
    s.view = 'temperament'; s.focus = [nameOf(lo), nameOf(hi)]; s.lever = t; s.turn = true;
    s.demo = { type: 'interval', lo: nameOf(lo), hi: nameOf(hi), kind, target: t };
    s.src = kind === 'P8' ? ['iu-et', 'wiki-tuning'] : ['white', 'iu-ex2', 'wiki-tuning'];
    add(s);
    notes[tm].tunedBy = { step: s.n, from: fm, interval: b };
    notes[fm].usedFor.push({ step: s.n, note: tm, interval: b });
    for (const c of checks) {
      notes[N(c.loName)].checks.push({ step: s.n, interval: c, comment: c.comment });
      notes[N(c.hiName)].checks.push({ step: s.n, interval: c, comment: c.comment });
    }
    tuned.push(tm);
  }

  /* ---- 21: check the 3rds ---- */
  const thirds = [];
  for (let m = N('F3'); m <= N('C#4'); m++) thirds.push(ivm(m, m + 4, 'M3'));
  const chk = add({ id: 'thirds', chapter: 'Check', title: 'Check: the 3rds speed up evenly',
    lead: 'Play the major 3rds F3+A3, F#3+A#3, G3+B3 ... up to C#4+F4, one after another. Each should flutter a little faster than the one before, smoothly, from about 7 to 11 a second.',
    acts: ['Tap Hear it to hear the whole run as it should sound.',
           'A 3rd that is too fast next to one that is too slow points at the note they share: that note is off. Fix it with its 4th or 5th again.',
           'Also check the 4ths and 5ths once more: all should wobble slowly, none should be still, and they should get a little faster going up. [src:iu-et]'],
    tip: 'Contiguous 3rds that share a note (F3+A3, A3+C#4, C#4+F4) step up by about 5 to 4: for every 4 wobbles of the lower one, about 5 in the upper. [src:bremmer]',
    checks: thirds, view: 'temperament', focus: ['F3', 'F4'], series: thirds.map((t) => [t.lo, t.hi]),
    demo: { type: 'series', pairs: thirds.map((t) => [t.loName, t.hiName]) }, src: ['wiki-tuning', 'bremmer', 'brown'] });
  for (const t of thirds) { notes[t.lo].checks.push({ step: chk.n, interval: t, comment: 'Part of the rising run of 3rds.' }); notes[t.hi].checks.push({ step: chk.n, interval: t, comment: 'Part of the rising run of 3rds.' }); }

  /* ---- 22: unisons in the middle ---- */
  const uni = add({ id: 'unisons', chapter: 'Unisons', title: 'Unisons: the other strings of each note',
    lead: 'Now pull the strip out one note at a time and tune each outer string to the middle string you just set, until the two sound as one, with no wobble at all.',
    acts: ['Hold the damper pedal down while you pull the felt so it does not catch the dampers. [src:howard6]',
           'Mute the third string with a rubber mute so you hear only two strings. Tune one string to one, never one to two. [src:chang-uni]',
           'Bring the outer string up from slightly flat: the wobble slows and disappears. A good [[unison]] sounds clean, with one steady tone. Then do the other side.'],
    tip: 'Some strings have a [[falsebeat|false beat]] of their own. Tune to the main beat and move on. [src:falsebeats]',
    view: 'unison', focus: ['A4'], lever: 'A4', leverString: 0, demo: { type: 'beats', hz: 440, off: 1 }, src: ['wiki-tuning', 'howard6'] });
  for (let m = N('F3'); m <= N('F4'); m++) notes[m].unisonStep = uni.n;
  notes[N('A4')].unisonStep = uni.n;

  /* ---- 23-26: fan out by octaves ---- */
  const treble = add({ id: 'treble', chapter: 'Fan out', title: 'Treble: F#4 up to C6 by octaves',
    lead: 'Work up one key at a time. Tune each new note as a still [[octave]] from the note 12 keys below, check it, then do its unisons.',
    acts: ['Mute the outer strings of the new note, tune the middle one to a still octave from below, then tune the outer strings to it.',
           'Check with the 4th-5th test: play the note a [[fourth|4th]] above the lower octave note. The 4th below it and the 5th above it should wobble at about the same speed. [src:p4p5]',
           'And the 3rds should keep getting faster as you go up (the M3 and the 10th from the same bottom note should beat alike). [src:cerisano]'],
    view: 'region', range: ['F#4', 'C6'], src: ['iu-et', 'cerisano', 'ptg-check'] });
  const top = add({ id: 'top', chapter: 'Fan out', title: 'Top treble: C#6 to C8',
    lead: 'Up here the beats get fast and the notes short. Tune clean octaves and listen to the [[twelfth|12th]] and the double octave too.',
    acts: ['Tune each note as an octave from below, then check the double octave (24 keys down): it should sound clean.',
           'Up here octaves are usually left a hair wide ([[stretch|stretched]]), and that is what sounds in tune. [src:stretch] [src:pianometer]',
           'The tuner will read these notes sharp when they sound right, by up to about 35 cents at the very top. That is the [[stretch]] and it is normal. [src:stretch]'],
    tip: 'Strike firmly: the very short top strings are stiff and need a solid [[testblow|test blow]] to settle.',
    view: 'region', range: ['C#6', 'C8'], src: ['stretch', 'railsback', 'pianometer'] });
  const bass = add({ id: 'bass', chapter: 'Fan out', title: 'Bass: E3 down to C2 by octaves',
    lead: 'Now work down from E3. Tune each note as a still octave from the note 12 keys above, then its unisons.',
    acts: ['Check with the 4th-5th test: the note a [[fourth|4th]] above the new note makes a 4th with it and a 5th with the octave above. Both should wobble at about the same slow speed. [src:p4p5]',
           'The 3rds from each new note should get a little slower going down, smoothly.',
           'Somewhere below middle C (often in the octave just below it) the strings change to thick copper-wound ones, usually two per note. Where exactly varies from piano to piano. [src:sjpiano] [src:frederick]'],
    view: 'region', range: ['C2', 'E3'], src: ['iu-et', 'ptg-check'] });
  const low = add({ id: 'lowbass', chapter: 'Fan out', title: 'Low bass: B1 down to A0',
    lead: 'The lowest notes have one or two thick strings. Their fundamental is weak, so listen to the growl higher up in the sound.',
    acts: ['Tune each as an octave from above. If the octave sounds still but the bass sounds flat or muddy, check a [[tenth|10th]] (a 3rd plus an octave): the 10ths should get slower smoothly going down.',
           'On small uprights many tuners use the minor 3rd / major 6th test for these octaves (the 6:3 octave): the minor 3rd up from the new note and the major 6th from there to the octave should wobble alike. [src:pianometer] [src:cerisano]',
           'Do not chase tiny differences down here; listen to whether the bass sounds in tune with the middle.'],
    view: 'region', range: ['A0', 'B1'], src: ['pianometer', 'cerisano'] });

  for (let m = N('F#4'); m <= HIGH; m++) {
    if (m === N('A4')) continue;
    const st = m <= N('C6') ? treble : top;
    const b = ivm(m - 12, m, 'P8');
    notes[m].tunedBy = { step: st.n, from: m - 12, interval: b };
    notes[m - 12].usedFor.push({ step: st.n, note: m, interval: b });
    notes[m].checks.push(...trebleChecks(m).map((c) => Object.assign(c, { step: st.n })));
    if (stringsOf(m) > 1) notes[m].unisonStep = st.n;
  }
  for (let m = N('E3'); m >= LOW; m--) {
    const st = m >= N('C2') ? bass : low;
    const b = ivm(m, m + 12, 'P8');
    notes[m].tunedBy = { step: st.n, from: m + 12, interval: b };
    notes[m + 12].usedFor.push({ step: st.n, note: m, interval: b });
    notes[m].checks.push(...bassChecks(m).map((c) => Object.assign(c, { step: st.n })));
    if (stringsOf(m) > 1) notes[m].unisonStep = st.n;
  }

  add({ id: 'finish', chapter: 'Finish', title: 'Play it, then touch up',
    lead: 'Play slow chords and scales all over the keyboard. Anything that sounds sour, check its unison first, then its octave.',
    acts: ['Check A4 against your reference again: the pitch of the whole piano moves a little as tension changes.',
           'Plan on tuning at least once a year; a piano that was far off may need a second pass soon after. [src:yamaha] [src:richards]',
           'Humidity moves the pitch: dry air makes it go flat, damp air sharp. [src:mingli]'],
    tip: 'Happy with it? Take the strip and mutes out, put the panels back, and play something you love.',
    view: 'overview', demo: null });

  return { steps, notes };
}

/* "{F3+A3:M3}" in a comment becomes "F3+A3 (0.69...)" with the computed rate, so a
   comparison always shows the number it compares with */
function withRates(text) {
  return text.replace(/\{([A-G]#?\d)\+([A-G]#?\d):([A-Za-z0-9]+)\}/g, (_, a, b, k) => `${a}+${b} (${fmtRate(beat(midiOf(a), k, midiOf(b)).rate)})`);
}
function ordinal(n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); }

/* Checks for a treble note m tuned as an octave from m-12 (everything below is tuned). */
function trebleChecks(m) {
  const out = [];
  if (m <= midiOf('C7')) {
    const t = m - 7;
    out.push({ test: '4th-5th test', pair: [ivm(m - 12, t, 'P4'), ivm(t, m, 'P5')], comment: 'The 4th ' + nameOf(m - 12) + '+' + nameOf(t) + ' and the 5th ' + nameOf(t) + '+' + nameOf(m) + ' should wobble at about the same speed. Equal means the octave is right.' });
  }
  if (m - 16 >= midiOf('F3') && m <= midiOf('C6')) {
    const x = m - 16;
    out.push({ test: '3rd-10th test', pair: [ivm(x, m - 12, 'M3'), ivm(x, m, 'M10')], comment: 'The 3rd ' + nameOf(x) + '+' + nameOf(m - 12) + ' and the 10th ' + nameOf(x) + '+' + nameOf(m) + ' should beat at the same speed.' });
  }
  if (m - 4 >= midiOf('F3')) {
    const a = ivm(m - 4, m, 'M3'), p = ivm(m - 5, m - 1, 'M3');
    if (a.rate <= 17) out.push({ test: 'rising 3rds', pair: [p, a], comment: nameOf(m - 4) + '+' + nameOf(m) + ' should be a little faster than ' + nameOf(m - 5) + '+' + nameOf(m - 1) + '.' });
  }
  if (m - 24 >= midiOf('F3') && m > midiOf('C6')) out.push({ test: 'double octave', pair: [ivm(m - 24, m, 'P15')], comment: nameOf(m - 24) + '+' + nameOf(m) + ' should sound clean. A hair wide is fine up here.' });
  if (m > midiOf('C6')) { const t12 = ivm(m - 19, m, 'P12'); out.push({ test: '12th', pair: [t12], comment: 'Octave plus a 5th, ' + nameOf(m - 19) + '+' + nameOf(m) + ': ' + plainRate(t12.rate) + ' in ideal equal temperament, a hair narrow; with stretch it is often tuned slower, close to still.' }); }
  return out;
}
/* Checks for a bass note m tuned as an octave from m+12 (everything above is tuned). */
function bassChecks(m) {
  const out = [];
  const t = m + 5;
  out.push({ test: '4th-5th test', pair: [ivm(m, t, 'P4'), ivm(t, m + 12, 'P5')], comment: 'The 4th ' + nameOf(m) + '+' + nameOf(t) + ' and the 5th ' + nameOf(t) + '+' + nameOf(m + 12) + ' should wobble at about the same speed.' });
  if (m >= midiOf('C2')) {
    const a = ivm(m, m + 4, 'M3'), p = ivm(m + 1, m + 5, 'M3');
    out.push({ test: 'falling 3rds', pair: [a, p], comment: nameOf(m) + '+' + nameOf(m + 4) + ' should be a little slower than ' + nameOf(m + 1) + '+' + nameOf(m + 5) + '.' });
  } else {
    const a = ivm(m, m + 16, 'M10'), p = ivm(m + 1, m + 17, 'M10');
    out.push({ test: 'falling 10ths', pair: [a, p], comment: 'The 10th ' + nameOf(m) + '+' + nameOf(m + 16) + ' should be a little slower than ' + nameOf(m + 1) + '+' + nameOf(m + 17) + '.' });
    const c = ivm(m, m + 3, 'm3'), d = ivm(m + 3, m + 12, 'M6');
    out.push({ test: 'minor 3rd / major 6th test', pair: [c, d], comment: 'The minor 3rd ' + nameOf(m) + '+' + nameOf(m + 3) + ' and the major 6th ' + nameOf(m + 3) + '+' + nameOf(m + 12) + ' should wobble alike (a clean 6:3 octave).' });
  }
  return out;
}

export const PLAN = build();

/* The beat-rate table for the temperament octave ("for the curious"):
   for each note from F3 to F4, the 4th, 5th, major 3rd and major 6th above it. */
export function temperamentTable() {
  const rows = [];
  for (let m = midiOf('F3'); m <= midiOf('F4'); m++) {
    rows.push({ m, name: nameOf(m), hz: freq(m),
      P4: beat(m, 'P4'), P5: beat(m, 'P5'), M3: beat(m, 'M3'), M6: beat(m, 'M6') });
  }
  return rows;
}

/* Values from published tables, used by the tests and shown on the page as a cross-check.
   US Patent 8,569,607 Fig. 4 (A440, F3-F4) and Wikipedia "Piano tuning" (C4-C5). */
export const PUBLISHED = [
  ['F3', 'C4', 'P5', 0.590, 'patent'], ['A3', 'E4', 'P5', 0.744, 'patent'], ['A#3', 'F4', 'P5', 0.790, 'patent'],
  ['F3', 'A#3', 'P4', 0.790, 'patent'], ['A3', 'D4', 'P4', 0.995, 'patent'], ['C4', 'F4', 'P4', 1.180, 'patent'],
  ['E4', 'A4', 'P4', 1.48977, 'wiki-tuning'], ['F3', 'A3', 'M3', 6.930, 'patent'], ['F#3', 'A#3', 'M3', 7.343, 'patent'],
  ['G3', 'B3', 'M3', 7.778, 'patent'], ['A3', 'C#4', 'M3', 8.732, 'patent'], ['C4', 'E4', 'M3', 10.382, 'patent'],
  ['C#4', 'F4', 'M3', 10.997, 'patent'], ['F3', 'D4', 'M6', 7.925, 'patent'], ['C4', 'A4', 'M6', 11.8722, 'wiki-tuning'],
];

/* For the pick-a-note panel: everything about one key, from the same plan. */
export function noteInfo(m) {
  const n = PLAN.notes[m];
  /* the same interval can be a check in two steps (e.g. F3+A3 in step 12 and in the run of 3rds):
     list it once, with every step that uses it */
  const seen = new Map(), checks = [];
  for (const c of n.checks) {
    const ivs = c.pair || [c.interval];
    const key = ivs.map((i) => i.lo + '-' + i.hi + '-' + i.kind).join('|');
    if (seen.has(key)) { const prev = seen.get(key); if (prev.steps.indexOf(c.step) < 0) prev.steps.push(c.step); continue; }
    const e = { test: c.test || null, intervals: ivs, comment: c.comment, step: c.step, steps: [c.step] };
    seen.set(key, e); checks.push(e);
  }
  return { m, name: nameOf(m), flat: flatName(m), hz: freq(m), key: keyNo(m), strings: stringsOf(m), wound: isWound(m),
    tunedBy: n.tunedBy, checks, usedFor: n.usedFor, unisonStep: n.unisonStep };
}
export function stepOf(id) { return PLAN.steps.find((s) => s.id === id); }
