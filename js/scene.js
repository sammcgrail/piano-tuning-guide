/*
 * scene.js - a simplified upright piano, drawn like a technical diagram:
 * white model, ink hairline edges, flat light, colour only where it means something
 * (blue = the note you tune, amber = the note you play with it).
 *
 * Units: metres. x runs along the keyboard (A0 left), y is up, z points at the player.
 * The layout is a diagram, not a scan: on a real upright the strings do not sit exactly
 * above their keys, so always follow the string up from the hammer to find its pin.
 */
import * as THREE from 'three';
import { LOW, HIGH, isBlack, stringsOf, isWound } from './data.js';

export const GEOM = { get Y_PIN() { return Y_PIN; }, get Y_STRIKE() { return Y_STRIKE; }, get Y_BAR() { return Y_BAR; }, get KEY_TOP() { return KEY_TOP; } };
export const COLORS = {
  ink: 0x141414, paper: 0xffffff, part: 0xffffff, black: 0x2e2e2e,
  tune: 0xa6c0f6, tuneInk: 0x1f4fd8, ref: 0xf6d38f, refInk: 0x9a5400,
  steel: 0xb9b9b9, copper: 0xcfae86, felt: 0xb9897a, pin: 0xdedede, wood: 0xf4f1ea,
};
const W = 0.0235;            // white key pitch
const KEY_TOP = 0.70;
const KEY_LEN = 0.15, BLACK_LEN = 0.095;
const S = 0.01375;           // string group pitch per note
const Z_STR = -0.25;         // treble/tenor string plane
const Z_BASS = -0.236;       // overstrung bass, in front
const Y_STRIKE = 0.86;
const Y_BAR = 0.915;         // pressure bar
const Y_PIN = 0.952;         // first pin row
const BASS_LEAN = 0.30;      // dx per metre of drop for the bass strings
const WHITE_COUNT = 52;

function whiteIndex(m) { let i = 0; for (let k = LOW; k < m; k++) if (!isBlack(k)) i++; return i; }
const BLACK_OFF = { 1: -0.10, 3: 0.10, 6: -0.13, 8: 0, 10: 0.13 };
export function keyX(m) {
  if (!isBlack(m)) return (whiteIndex(m) - (WHITE_COUNT - 1) / 2) * W;
  const i = whiteIndex(m) - 1; // white key just below
  return (i - (WHITE_COUNT - 1) / 2) * W + W / 2 + BLACK_OFF[m % 12] * W;
}
function groupX(m) { return (m - LOW - 43.5) * S; }
function speak(m) { // diagram speaking length
  const k = m - LOW;
  if (isWound(m)) return 0.64 + (27 - k) * 0.0055;
  return Math.min(0.70, 0.05 * Math.pow(2, ((87 - k) / 12) * 0.75));
}
/* string j of note m: top (at the pin) and bottom points */
export function stringGeom(m, j) {
  const n = stringsOf(m);
  const sp = isWound(m) ? 0.0042 : 0.0034;
  const x0 = groupX(m) + (j - (n - 1) / 2) * sp;
  const yPin = Y_PIN + ((m + j) % 2) * 0.022;
  const L = speak(m);
  if (isWound(m)) {
    const yb = Y_BAR - L;
    return { top: new THREE.Vector3(x0, yPin, Z_BASS), bot: new THREE.Vector3(x0 + (yPin - yb) * BASS_LEAN, yb, Z_BASS), z: Z_BASS };
  }
  return { top: new THREE.Vector3(x0, yPin, Z_STR), bot: new THREE.Vector3(x0, Y_BAR - L, Z_STR), z: Z_STR };
}
function xAtY(g, y) { const t = (g.top.y - y) / (g.top.y - g.bot.y); return g.top.x + (g.bot.x - g.top.x) * t; }
export function hammerX(m) { return xAtY(stringGeom(m, (stringsOf(m) - 1) / 2 | 0), Y_STRIKE) + (stringsOf(m) === 2 ? 0.0021 : 0); }
export function pinPos(m, j) { const g = stringGeom(m, j); return new THREE.Vector3(g.top.x, g.top.y, g.z + 0.016); }

export class PianoScene {
  constructor(canvas, { still = false } = {}) {
    this.canvas = canvas; this.still = still;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.setClearColor(COLORS.paper, 1);
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xf0f0f0, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(0.6, 1.4, 1.2); this.scene.add(sun);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 50);
    const gm = new THREE.DataTexture(new Uint8Array([200, 200, 200, 255, 232, 232, 232, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    gm.minFilter = gm.magFilter = THREE.NearestFilter; gm.needsUpdate = true; this.gm = gm;
    this.anims = []; this.dirty = true; this.listeners = [];
    this.view = { c: new THREE.Vector3(0, 0.95, -0.1), r: 0.6, dir: new THREE.Vector3(0.3, 0.3, 1).normalize() };
    this.user = { az: 0, el: 0, pan: 0 };
    this.build();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    const loop = (t) => { this.tick(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  mat(color, o = {}) { return new THREE.MeshToonMaterial({ color, gradientMap: this.gm, transparent: !!o.opacity && o.opacity < 1, opacity: o.opacity == null ? 1 : o.opacity }); }
  edges(geo, opacity = 0.72) { return new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: COLORS.ink, transparent: true, opacity })); }
  boxMesh(w, h, d, color, o = {}) { const g = new THREE.BoxGeometry(w, h, d); const m = new THREE.Mesh(g, this.mat(color, o)); if (o.edge !== false) m.add(this.edges(g, o.edge)); return m; }

  build() {
    const sc = this.scene;
    this.root = new THREE.Group(); sc.add(this.root);
    const R = this.root;
    /* ---- case (cut away: sides, key bed, key slip, pin block, soundboard) ---- */
    const halfW = WHITE_COUNT * W / 2;
    for (const sx of [-1, 1]) {
      const side = this.boxMesh(0.034, 1.12, 0.40, COLORS.part); side.position.set(sx * (halfW + 0.075), 0.56, -0.14); R.add(side);
      const cheek = this.boxMesh(0.06, 0.07, 0.24, COLORS.part); cheek.position.set(sx * (halfW + 0.03), KEY_TOP - 0.01, -0.06); R.add(cheek);
      const toe = this.boxMesh(0.06, 0.07, 0.26, COLORS.part); toe.position.set(sx * (halfW + 0.03), 0.035, 0.06); R.add(toe);
    }
    const keybed = this.boxMesh(halfW * 2 + 0.12, 0.05, 0.34, COLORS.part); keybed.position.set(0, KEY_TOP - 0.05, -0.13); R.add(keybed);
    const slip = this.boxMesh(halfW * 2, 0.03, 0.014, COLORS.part); slip.position.set(0, KEY_TOP - 0.02, 0.012); R.add(slip);
    const bottom = this.boxMesh(halfW * 2 + 0.12, 0.03, 0.36, COLORS.part); bottom.position.set(0, 0.06, -0.15); R.add(bottom);
    const board = this.boxMesh(halfW * 2 + 0.1, 0.86, 0.012, 0xfafafa, { edge: 0.35 }); board.position.set(0, 0.52, -0.305); R.add(board);
    const block = this.boxMesh(halfW * 2 + 0.1, 0.12, 0.05, COLORS.wood); block.position.set(0, Y_PIN + 0.034, -0.285); R.add(block);
    const bar = this.boxMesh(halfW * 2 + 0.02, 0.012, 0.012, 0xe8e8e8); bar.position.set(0, Y_BAR, Z_STR + 0.012); R.add(bar);
    const rail = this.boxMesh(halfW * 2 + 0.04, 0.016, 0.02, COLORS.part, { edge: 0.45 }); rail.position.set(0, 0.785, -0.175); R.add(rail);

    /* ---- keys (instanced, with merged edges we can rewrite per key) ---- */
    this.keyIds = { white: [], black: [] }; this.keyOf = new Map();
    const wg = new THREE.BoxGeometry(W - 0.0012, 0.022, KEY_LEN); wg.translate(0, -0.011, -KEY_LEN / 2);
    const bg = new THREE.BoxGeometry(0.0125, 0.02, BLACK_LEN); bg.translate(0, 0.002, -KEY_LEN + BLACK_LEN / 2);
    for (let m = LOW; m <= HIGH; m++) (isBlack(m) ? this.keyIds.black : this.keyIds.white).push(m);
    this.whiteKeys = new THREE.InstancedMesh(wg, this.mat(0xffffff), this.keyIds.white.length);
    this.blackKeys = new THREE.InstancedMesh(bg, this.mat(0xffffff), this.keyIds.black.length);
    this.keyEdge = {};
    for (const [kind, mesh, geo, base] of [['white', this.whiteKeys, wg, COLORS.part], ['black', this.blackKeys, bg, COLORS.black]]) {
      const ids = this.keyIds[kind];
      const eg = new THREE.EdgesGeometry(geo, 25); const ep = eg.attributes.position.array;
      const all = new Float32Array(ep.length * ids.length);
      ids.forEach((m, i) => {
        this.keyOf.set(m, { kind, i, mesh, base });
        const mx = new THREE.Matrix4().makeTranslation(keyX(m), KEY_TOP, 0);
        mesh.setMatrixAt(i, mx); mesh.setColorAt(i, new THREE.Color(base));
      });
      const line = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: kind === 'white' ? COLORS.ink : 0x000000, transparent: true, opacity: kind === 'white' ? 0.72 : 0.9 }));
      line.geometry.setAttribute('position', new THREE.BufferAttribute(all, 3));
      this.keyEdge[kind] = { line, src: ep };
      ids.forEach((m, i) => this.writeKeyEdges(m, new THREE.Matrix4().makeTranslation(keyX(m), KEY_TOP, 0)));
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      R.add(mesh); R.add(line);
    }

    /* ---- strings ---- */
    const segs = []; const cols = []; this.stringIndex = [];
    const steel = new THREE.Color(COLORS.steel), copper = new THREE.Color(COLORS.copper);
    for (let m = LOW; m <= HIGH; m++) for (let j = 0; j < stringsOf(m); j++) {
      const g = stringGeom(m, j);
      segs.push(g.top.x, g.top.y, g.z, g.bot.x, g.bot.y, g.z);
      const c = isWound(m) ? copper : steel; cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
      this.stringIndex.push({ m, j });
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.strings = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true })); R.add(this.strings);
    /* bridges: a thin rail along the bottom ends */
    const tb = [], bb = [];
    for (let m = LOW; m <= HIGH; m++) { const g = stringGeom(m, 0); (isWound(m) ? bb : tb).push(g.bot.clone().setZ(g.z - 0.008)); }
    this.bridges = [];
    for (const pts of [tb, bb]) { const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.006, 6), this.mat(COLORS.wood)); R.add(t); this.bridges.push(t); }

    /* ---- tuning pins (instanced) ---- */
    const pg = new THREE.CylinderGeometry(0.0034, 0.0034, 0.03, 10); pg.rotateX(Math.PI / 2);
    this.pins = new THREE.InstancedMesh(pg, this.mat(0xffffff), this.stringIndex.length); this.pinIndex = new Map();
    this.stringIndex.forEach(({ m, j }, i) => {
      const p = pinPos(m, j); this.pins.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z));
      this.pins.setColorAt(i, new THREE.Color(COLORS.pin)); this.pinIndex.set(m + ':' + j, i);
    });
    this.pins.instanceColor.needsUpdate = true; R.add(this.pins);

    /* ---- hammers (heads + shanks) ---- */
    const hg = new THREE.BoxGeometry(0.0105, 0.024, 0.03);
    const shg = new THREE.CylinderGeometry(0.0014, 0.0014, 0.085, 6);
    this.hammers = new THREE.InstancedMesh(hg, this.mat(0xffffff), 88);
    this.shanks = new THREE.InstancedMesh(shg, this.mat(0xcfcfcf), 88);
    const heg = new THREE.EdgesGeometry(hg); const hep = heg.attributes.position.array;
    const hall = new Float32Array(hep.length * 88);
    this.hammerEdge = { line: new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COLORS.ink, transparent: true, opacity: 0.32 })), src: hep };
    this.hammerEdge.line.geometry.setAttribute('position', new THREE.BufferAttribute(hall, 3));
    for (let m = LOW; m <= HIGH; m++) { this.setHammer(m, 0); this.hammers.setColorAt(m - LOW, new THREE.Color(0xffffff)); }
    this.hammers.instanceColor.needsUpdate = true;
    R.add(this.hammers); R.add(this.shanks); R.add(this.hammerEdge.line);

    /* ---- highlight strings (drawn on top as thin tubes) ---- */
    this.hiStrings = new THREE.Group(); R.add(this.hiStrings);

    /* ---- felt temperament strip ---- */
    this.strip = this.buildStrip(); this.strip.visible = false; R.add(this.strip);
    /* ---- rubber mute (for the unison step) ---- */
    this.muteWedge = this.boxMesh(0.004, 0.03, 0.02, 0x555555, { edge: 0.5 }); this.muteWedge.visible = false; R.add(this.muteWedge);

    /* ---- tuning lever ---- */
    this.lever = this.buildLever(); this.lever.visible = false; R.add(this.lever);
    this.actionParts = [board, block, bar, rail, this.strings, this.pins, this.hammers, this.shanks, this.hammerEdge.line, this.hiStrings, ...this.bridges];
    this.leverState = { m: null, j: 0, base: -Math.PI / 4.2, turn: 0 };
  }

  writeKeyEdges(m, mx) {
    const k = this.keyOf.get(m); const E = this.keyEdge[k.kind]; const src = E.src;
    const arr = E.line.geometry.attributes.position.array; const off = k.i * src.length; const v = new THREE.Vector3();
    for (let i = 0; i < src.length; i += 3) { v.set(src[i], src[i + 1], src[i + 2]).applyMatrix4(mx); arr[off + i] = v.x; arr[off + i + 1] = v.y; arr[off + i + 2] = v.z; }
    E.line.geometry.attributes.position.needsUpdate = true;
  }
  setKeyPress(m, a) { // a = 0..1 press depth
    const k = this.keyOf.get(m); if (!k) return;
    const pivotZ = -KEY_LEN - 0.12; const ang = a * 0.045;
    const mx = new THREE.Matrix4().makeTranslation(keyX(m), KEY_TOP, pivotZ).multiply(new THREE.Matrix4().makeRotationX(ang)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -pivotZ));
    k.mesh.setMatrixAt(k.i, mx); k.mesh.instanceMatrix.needsUpdate = true; this.writeKeyEdges(m, mx);
  }
  setHammer(m, a) { // a = 0 rest .. 1 touching the string
    const i = m - LOW; const x = hammerX(m); const z = (isWound(m) ? Z_BASS : Z_STR) + 0.036 - a * 0.02;
    const head = new THREE.Matrix4().makeTranslation(x, Y_STRIKE, z);
    this.hammers.setMatrixAt(i, head);
    const sh = new THREE.Matrix4().makeTranslation(x, Y_STRIKE - 0.05, z + 0.02 + a * 0.004).multiply(new THREE.Matrix4().makeRotationX(-0.42 + a * 0.12));
    this.shanks.setMatrixAt(i, sh);
    this.hammers.instanceMatrix.needsUpdate = true; this.shanks.instanceMatrix.needsUpdate = true;
    const src = this.hammerEdge.src; const arr = this.hammerEdge.line.geometry.attributes.position.array; const off = i * src.length; const v = new THREE.Vector3();
    for (let k = 0; k < src.length; k += 3) { v.set(src[k], src[k + 1], src[k + 2]).applyMatrix4(head); arr[off + k] = v.x; arr[off + k + 1] = v.y; arr[off + k + 2] = v.z; }
    this.hammerEdge.line.geometry.attributes.position.needsUpdate = true;
  }

  buildStrip() {
    const g = new THREE.Group(); const lo = 52, hi = 67; // E3 .. G4
    const x0 = groupX(lo) - S * 0.6, x1 = groupX(hi) + S * 0.6; const y = Y_STRIKE - 0.034; // below the strike line, clear of the hammers
    const band = this.boxMesh(x1 - x0, 0.016, 0.004, COLORS.felt, { edge: 0.5 }); band.position.set((x0 + x1) / 2, y, Z_STR + 0.009); g.add(band);
    const tab = new THREE.BoxGeometry(0.0022, 0.014, 0.012);
    const tabs = new THREE.InstancedMesh(tab, this.mat(COLORS.felt), (hi - lo + 1) * 2); let n = 0;
    for (let m = lo; m <= hi; m++) {
      const L = stringGeom(m, 0).top.x, Rr = stringGeom(m, 2).top.x; // outer strings
      for (const x of [L - 0.0022, Rr + 0.0022]) tabs.setMatrixAt(n++, new THREE.Matrix4().makeTranslation(x, y, Z_STR + 0.002));
    }
    g.add(tabs); return g;
  }
  buildLever() {
    const g = new THREE.Group();
    const ink = 0x3a3a3a;
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.05, 16).rotateX(Math.PI / 2), this.mat(0xe9e9e9)); sock.position.z = 0.02; sock.add(this.edges(sock.geometry, 0.5)); g.add(sock);
    const head = this.boxMesh(0.022, 0.022, 0.026, 0xe9e9e9); head.position.z = 0.055; g.add(head);
    this.leverArm = new THREE.Group(); this.leverArm.position.z = 0.055; g.add(this.leverArm);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.12, 10), this.mat(0xe0e0e0)); shaft.position.y = 0.07; shaft.add(this.edges(shaft.geometry, 0.35)); this.leverArm.add(shaft);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.011, 0.075, 16), this.mat(ink)); grip.position.y = 0.165; this.leverArm.add(grip);
    /* turn arrow (clockwise as the tuner sees it) */
    const arrow = new THREE.Group();
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.0016, 6, 40, Math.PI * 0.55), this.mat(COLORS.tuneInk));
    arc.rotation.z = Math.PI * 0.2; arrow.add(arc);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0045, 0.012, 10), this.mat(COLORS.tuneInk));
    const a = Math.PI * 0.2; tip.position.set(Math.cos(a) * 0.034, Math.sin(a) * 0.034, 0); tip.rotation.z = a + Math.PI; arrow.add(tip);
    arrow.position.z = 0.03; this.turnArrow = arrow; arrow.visible = false; g.add(arrow);
    return g;
  }

  /* ---------- public API ---------- */
  setHighlights({ tune = [], ref = [], done = [], soft = [] } = {}) {
    const color = (m, black) => tune.includes(m) ? COLORS.tune : ref.includes(m) ? COLORS.ref : soft.includes(m) ? (black ? 0x4a5a85 : 0xdde6fa) : done.includes(m) ? (black ? 0x555555 : 0xe9e9e9) : null;
    for (const [m, k] of this.keyOf) { const c = color(m, k.kind === 'black'); k.mesh.setColorAt(k.i, new THREE.Color(c == null ? k.base : c)); }
    this.whiteKeys.instanceColor.needsUpdate = true; this.blackKeys.instanceColor.needsUpdate = true;
    for (let m = LOW; m <= HIGH; m++) { const c = tune.includes(m) ? COLORS.tune : ref.includes(m) ? COLORS.ref : 0xffffff; this.hammers.setColorAt(m - LOW, new THREE.Color(c)); }
    this.hammers.instanceColor.needsUpdate = true;
    /* strings + pins */
    while (this.hiStrings.children.length) { const c = this.hiStrings.children.pop(); c.geometry.dispose(); }
    for (let i = 0; i < this.stringIndex.length; i++) this.pins.setColorAt(i, new THREE.Color(COLORS.pin));
    const add = (m, col, pinCol) => {
      for (let j = 0; j < stringsOf(m); j++) {
        const g = stringGeom(m, j); const len = g.top.distanceTo(g.bot);
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, len, 5), new THREE.MeshBasicMaterial({ color: col }));
        t.position.copy(g.top).add(g.bot).multiplyScalar(0.5); t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), g.top.clone().sub(g.bot).normalize());
        t.position.z += 0.0015; this.hiStrings.add(t);
        this.pins.setColorAt(this.pinIndex.get(m + ':' + j), new THREE.Color(pinCol));
      }
    };
    ref.forEach((m) => add(m, COLORS.refInk, COLORS.ref)); tune.forEach((m) => add(m, COLORS.tuneInk, COLORS.tune));
    this.pins.instanceColor.needsUpdate = true;
    this.dirty = true;
  }
  setStrip(on) { this.strip.visible = !!on; this.dirty = true; }
  setMute(m) { // rubber mute between the middle and right string of m
    if (m == null) { this.muteWedge.visible = false; this.dirty = true; return; }
    const a = stringGeom(m, 1).top.x, b = stringGeom(m, 2).top.x;
    this.muteWedge.position.set((a + b) / 2, Y_STRIKE - 0.034, Z_STR + 0.006); this.muteWedge.visible = true; this.dirty = true;
  }
  setLever(m, j = null, turn = false) {
    if (m == null) { this.lever.visible = false; this.dirty = true; return; }
    if (j == null) j = (stringsOf(m) - 1) / 2 | 0;
    const p = pinPos(m, j);
    this.lever.position.set(p.x, p.y, p.z - 0.006); this.lever.visible = true;
    this.leverState.m = m; this.leverState.j = j; this.leverState.turn = 0;
    this.applyLever();
    if (turn) this.playTurn(); else this.dirty = true;
  }
  applyLever() {
    const s = this.leverState; this.lever.rotation.z = s.base - s.turn;
    const i = this.pinIndex.get(s.m + ':' + s.j); if (i == null) return;
    const p = pinPos(s.m, s.j);
    this.pins.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeRotationZ(-s.turn * 4)));
    this.pins.instanceMatrix.needsUpdate = true; this.dirty = true;
  }
  playTurn() {
    if (this.still) { this.leverState.turn = 0.05; this.turnArrow.visible = true; this.applyLever(); return; }
    const deg = Math.PI / 180;
    this.turnArrow.visible = true;
    const from = this.leverState.turn / deg; // start from wherever the lever is, so a replay never snaps
    this.animate(2600, (t) => {
      // clockwise to 4 deg (raise), hold, ease back 1 deg (settle the pin), hold
      const e = t < 0.35 ? from + easeIO(t / 0.35) * (4 - from) : t < 0.55 ? 4 : t < 0.8 ? 4 - easeIO((t - 0.55) / 0.25) : 3;
      this.leverState.turn = e * deg; this.applyLever();
    }, null, 'lever');
  }
  pressKey(m, ms = 380) {
    if (this.still) return;
    this.animate(ms, (t) => { const a = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75; this.setKeyPress(m, a); this.setHammer(m, Math.max(0, 1 - Math.abs(t - 0.22) / 0.22)); });
  }
  holdKeys(ms, list) { if (this.still) return; this.animate(ms, (t) => { const a = t < 0.06 ? t / 0.06 : t > 0.92 ? (1 - t) / 0.08 : 1; for (const m of list) this.setKeyPress(m, a * 0.8); }); }

  /* camera: frame a world-space box from a direction, inside the free part of the canvas */
  frame(box, dir, { instant = false, pad = 1.08, inset = null, ms = 900 } = {}) {
    const d = new THREE.Vector3().fromArray(dir).normalize();
    const target = this.fitBox(box, d, pad, inset);
    if (this.instantOnce) { instant = true; this.instantOnce = false; }
    if (instant || this.still) { this.anims = this.anims.filter((a) => a.tag !== 'cam'); this.view.c.copy(target.c); this.view.r = target.r; this.view.dir.copy(d); this.dirty = true; return; }
    const c0 = this.view.c.clone(), r0 = this.view.r, d0 = this.view.dir.clone();
    const ease = ms < 500 ? (t) => 1 - Math.pow(1 - t, 3) : easeIO;
    this.animate(ms, (t) => { const e = ease(t); this.view.c.lerpVectors(c0, target.c, e); this.view.r = r0 + (target.r - r0) * e; this.view.dir.lerpVectors(d0, d, e).normalize(); }, null, 'cam');
  }
  /* show or hide everything above the keys (action, strings, pins): the Keys close-up hides it */
  setAction(on) {
    for (const o of this.actionParts) o.visible = on;
    if (!on) { this.strip.visible = false; this.lever.visible = false; this.muteWedge.visible = false; }
    this.dirty = true;
  }
  basis(dir) {
    const z = dir.clone().normalize(); const x = new THREE.Vector3(0, 1, 0).cross(z).normalize(); const y = z.clone().cross(x);
    return { x, y, z };
  }
  fitBox(box, d, pad, inset) {
    const { x, y } = this.basis(d); const pts = [];
    for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) pts.push(new THREE.Vector3(i ? box.max.x : box.min.x, j ? box.max.y : box.min.y, k ? box.max.z : box.min.z));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { const a = p.dot(x), b = p.dot(y); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }
    const aspect = this.w / this.h;
    const ins = inset || this.inset || { top: 0, bottom: 0 };
    const usable = 1 - (ins.top + ins.bottom) / this.h; // fraction of height free
    const halfH = Math.max((y1 - y0) / 2 / usable, (x1 - x0) / 2 / aspect) * pad;
    // shift the centre so the box sits in the free band
    const shift = ((ins.top - ins.bottom) / this.h) * halfH;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + shift;
    const c = box.getCenter(new THREE.Vector3());
    const cc = c.clone().add(x.clone().multiplyScalar(cx - c.dot(x))).add(y.clone().multiplyScalar(cy - c.dot(y)));
    return { c: cc, r: halfH };
  }
  setInset(inset) { this.inset = inset; }
  setUser(u) { Object.assign(this.user, u); this.dirty = true; }
  updateCamera() {
    const v = this.view; const cam = this.camera;
    let d = v.dir.clone();
    if (this.user.az || this.user.el) { const sph = new THREE.Spherical().setFromVector3(d); sph.theta += this.user.az; sph.phi = Math.min(Math.max(sph.phi - this.user.el, 0.25), 1.55); d = new THREE.Vector3().setFromSpherical(sph); }
    const { x } = this.basis(d);
    const c = v.c.clone().add(x.multiplyScalar(this.user.pan || 0));
    cam.position.copy(c).add(d.clone().multiplyScalar(6)); cam.up.set(0, 1, 0); cam.lookAt(c);
    const a = this.w / this.h; cam.left = -v.r * a; cam.right = v.r * a; cam.top = v.r; cam.bottom = -v.r; cam.near = 0.1; cam.far = 20;
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }
  pxPerMetre() { return this.h / (2 * this.view.r); }
  project(v3) { const p = v3.clone().project(this.camera); return { x: (p.x + 1) / 2 * this.w, y: (1 - p.y) / 2 * this.h, vis: p.z > -1 && p.z < 1 }; }
  keyAnchor(m) { return new THREE.Vector3(keyX(m), KEY_TOP + (isBlack(m) ? 0.014 : 0), isBlack(m) ? -0.10 : -0.03); }
  keyFront(m) { return new THREE.Vector3(keyX(m), KEY_TOP - (isBlack(m) ? -0.012 : 0.004), isBlack(m) ? -0.058 : 0.0); }
  pinAnchor(m) { return pinPos(m, (stringsOf(m) - 1) / 2 | 0); }
  pick(px, py) {
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(px / this.w * 2 - 1, -(py / this.h) * 2 + 1);
    ray.setFromCamera(ndc, this.camera);
    const hb = ray.intersectObject(this.blackKeys); if (hb.length) return this.keyIds.black[hb[0].instanceId];
    const hw = ray.intersectObject(this.whiteKeys); if (hw.length) return this.keyIds.white[hw[0].instanceId];
    return null;
  }
  keyRangeBox(lo, hi, { top = 0.74, bottom = KEY_TOP - 0.03, front = 0.02, back = -0.30 } = {}) {
    if (top === 'pins') top = Y_PIN + 0.10;
    const xs = [keyX(lo), keyX(hi), hammerX(lo), hammerX(hi), pinPos(lo, 0).x, pinPos(hi, stringsOf(hi) - 1).x];
    return new THREE.Box3(new THREE.Vector3(Math.min(...xs) - 0.016, bottom, back), new THREE.Vector3(Math.max(...xs) + 0.016, top, front));
  }
  onFrame(fn) { this.listeners.push(fn); }

  /* ---------- loop ---------- */
  animate(ms, step, done, tag) {
    if (tag) this.anims = this.anims.filter((a) => a.tag !== tag);
    this.anims.push({ ms, step, done, tag, t0: null });
  }
  tick(now) {
    if (this.anims.length) {
      const keep = [];
      for (const a of this.anims) { if (a.t0 == null) a.t0 = now; const t = Math.min(1, (now - a.t0) / a.ms); a.step(t); if (t < 1) keep.push(a); else if (a.done) a.done(); }
      this.anims = keep; this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
    for (const fn of this.listeners) fn();
  }
  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.renderer.setSize(this.w, this.h, false); this.dirty = true;
  }
}
function easeIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
