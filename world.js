/* PhoneLab physics: a rigid box tumbling through an arena of zones (pits/pools) and blocks.
   One engine for both views — the 2D view locks the body to a vertical plane. Pure, no DOM. */
(function (root) {
'use strict';
const S = root.Sim || (typeof require !== 'undefined' ? require('./sim.js') : null);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- vectors & quaternions ---------- */
const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z), sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a, s) => v3(a.x * s, a.y * s, a.z * s), dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x), len = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const Q = {
  id: () => ({ w: 1, x: 0, y: 0, z: 0 }),
  mul: (a, b) => ({ w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z, x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w }),
  rot(q, v) { const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
    return v3(v.x + q.w * tx + (q.y * tz - q.z * ty), v.y + q.w * ty + (q.z * tx - q.x * tz), v.z + q.w * tz + (q.x * ty - q.y * tx)); },
  conj: (q) => ({ w: q.w, x: -q.x, y: -q.y, z: -q.z }),
  norm(q) { const l = Math.hypot(q.w, q.x, q.y, q.z) || 1; return { w: q.w / l, x: q.x / l, y: q.y / l, z: q.z / l }; },
  axis(ax, ang) { const a = norm(ax), s = Math.sin(ang / 2); return { w: Math.cos(ang / 2), x: a.x * s, y: a.y * s, z: a.z * s }; },
  integrate(q, w, dt) { const d = Q.mul({ w: 0, x: w.x, y: w.y, z: w.z }, q); return Q.norm({ w: q.w + 0.5 * dt * d.w, x: q.x + 0.5 * dt * d.x, y: q.y + 0.5 * dt * d.y, z: q.z + 0.5 * dt * d.z }); },
};
const UP = v3(0, 1, 0);

/* ---------- arenas (x across, y up, z depth; metres) ---------- */
const pit = (kind, x0, z0, x1, z1, depth, floor, label, extra = {}) => ({ kind, x0, z0, x1, z1, bottom: -depth, top: 0, floor, label, ...extra });
const blk = (x0, y0, z0, x1, y1, z1, surf, color, label) => ({ x0, y0, z0, x1, y1, z1, surf, color, label });
const ARENAS = {
  lab: { name: 'Test lab', desc: 'Sand pit and a swimming pool.', build: (o) => ({
    W: 16, D: 10, slice: 5, start: v3(2, 0, 5), surface: 'concrete',
    zones: [pit('sand', 4.5, 2, 7, 8, 0.7, 'concrete', 'SAND PIT'), pit('water', 9.5, 1, 13.5, 9, o.pool, 'tile', 'POOL')], blocks: [] }) },
  stairs: { name: 'Concrete staircase', desc: 'Fourteen steps for a proper tumble.', build: () => {
    const blocks = [blk(0, 0, 2, 3, 3, 8, 'concrete', '#6b6e75', 'LANDING')];
    for (let i = 0; i < 14; i++) blocks.push(blk(3 + 0.4 * i, 0, 2, 3.4 + 0.4 * i, 2.8 - 0.2 * i, 8, 'concrete', i % 2 ? '#74777e' : '#686b72'));
    return { W: 14, D: 10, slice: 5, start: v3(1.5, 3, 5), surface: 'concrete', zones: [], blocks };
  } },
  bathroom: { name: 'Bathroom', desc: 'Toilet, bathtub and a vanity counter. Classic.', build: () => ({
    W: 12, D: 8, slice: 4.35, start: v3(10.8, 0.9, 4.35), surface: 'tile', ambient: 26,
    zones: [
      { kind: 'water', x0: 3.05, z0: 4.1, x1: 3.55, z1: 4.6, bottom: 0.12, top: 0.32, floor: 'porcelain', label: 'TOILET' },
      { kind: 'water', x0: 6.1, z0: 3.7, x1: 8.1, z1: 5.0, bottom: 0.06, top: 0.45, floor: 'porcelain', label: 'BATHTUB' }],
    blocks: [
      blk(2.9, 0, 4.0, 3.05, 0.42, 4.7, 'porcelain', '#eef0f2'), blk(3.55, 0, 4.0, 3.7, 0.42, 4.7, 'porcelain', '#eef0f2'),
      blk(3.05, 0, 4.0, 3.55, 0.42, 4.1, 'porcelain', '#eef0f2'), blk(3.05, 0, 4.6, 3.55, 0.42, 4.7, 'porcelain', '#eef0f2'),
      blk(2.9, 0, 4.7, 3.7, 0.8, 4.92, 'porcelain', '#e4e7ea'),
      blk(6.0, 0, 3.6, 6.1, 0.55, 5.1, 'porcelain', '#f4f5f6'), blk(8.1, 0, 3.6, 8.2, 0.55, 5.1, 'porcelain', '#f4f5f6'),
      blk(6.1, 0, 3.6, 8.1, 0.55, 3.7, 'porcelain', '#f4f5f6'), blk(6.1, 0, 5.0, 8.1, 0.55, 5.1, 'porcelain', '#f4f5f6'),
      blk(9.8, 0, 3.9, 11.8, 0.9, 4.8, 'stone', '#d9d4cc', 'COUNTER')] }) },
  playground: { name: 'Playground', desc: 'Trampoline and a ball pit.', build: () => ({
    W: 16, D: 10, slice: 5, start: v3(1.5, 0, 5), surface: 'grass',
    zones: [pit('balls', 9, 2, 13, 8, 0.9, 'rubber', 'BALL PIT')],
    blocks: [blk(3, 0, 2.5, 6.5, 0.8, 7.5, 'trampoline', '#1d1d22', 'TRAMPOLINE')] }) },
  ice: { name: 'Frozen lake', desc: 'Near-frictionless ice with an ice-fishing hole.', build: () => ({
    W: 20, D: 10, slice: 5, start: v3(2, 0, 5), surface: 'ice', ambient: -8,
    zones: [{ kind: 'water', x0: 12, z0: 4.2, x1: 13.2, z1: 5.8, bottom: -4, top: -0.08, floor: 'stone', label: 'FISHING HOLE' }], blocks: [] }) },
  volcano: { name: 'Volcano rim', desc: 'Basalt and a lava lake. Phones float on lava (briefly).', build: () => ({
    W: 16, D: 10, slice: 5, start: v3(2, 0, 5), surface: 'basalt', ambient: 45, sun: true,
    zones: [{ kind: 'lava', x0: 8, z0: 2, x1: 14, z1: 8, bottom: -2, top: -0.35, floor: 'basalt', label: 'LAVA LAKE' }], blocks: [] }) },
  moon: { name: 'The Moon', desc: '1/6 gravity, no air, no convection cooling.', build: () => ({
    W: 16, D: 10, slice: 5, start: v3(2, 0, 5), surface: 'regolith', g: 1.62, air: 0, ambient: -40, hmul: 0.03, space: true,
    zones: [pit('sand', 7, 2, 11, 8, 1.2, 'basalt', 'CRATER')], blocks: [] }) },
  mars: { name: 'Mars', desc: '38% gravity, thin cold air, dust dunes.', build: () => ({
    W: 16, D: 10, slice: 5, start: v3(2, 0, 5), surface: 'marsdust', g: 3.71, air: 0.0003, ambient: -60, hmul: 0.25, mars: true,
    zones: [pit('sand', 6, 2, 10, 8, 0.8, 'basalt', 'DUST DUNE')], blocks: [] }) },
};
const MEDIUM = { // buoyancy (×g), linear & quadratic drag (per kg), heat (W)
  water: { buoy: 0.5, drag: [2, 3] }, lava: { buoy: 1.35, drag: [6, 8], heat: 1500 }, balls: { buoy: 0.12, drag: [5, 6] },
};

/* ---------- body ---------- */
function samplePoints(hw, hh, ht) {
  const pts = [], add1 = (x, y, z, type) => pts.push({ b: v3(x, y, z), type, u: (x / hw + 1) / 2, v: (1 - y / hh) / 2, front: z > 0 });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) add1(sx * hw, sy * hh, sz * ht, 'corner');
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) for (const f of [-0.6, -0.2, 0.2, 0.6]) add1(f * hw, sy * hh, sz * ht, 'edge');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const f of [-0.8, -0.5, -0.2, 0.2, 0.5, 0.8]) add1(sx * hw, f * hh, sz * ht, 'edge');
  for (const sz of [-1, 1]) for (const fx of [-0.5, 0, 0.5]) for (const fy of [-0.66, -0.33, 0, 0.33, 0.66]) add1(fx * hw, fy * hh, sz * ht, 'face');
  return pts;
}
function makeBody(spec) { const b = { p: v3(), v: v3(), q: Q.id(), L: v3(), t: 0, asleep: false, still: 0, drag: false, lastHit: -9, peak: null, buried: 0, inSand: false }; setDims(b, spec); return b; }
function setDims(b, spec) {
  b.hw = spec.size.w / 2000; b.hh = spec.size.h / 2000; b.ht = Math.max(0.002, spec.size.t / 2000); b.m = spec.weight / 1000;
  const a = 2 * b.hw, c = 2 * b.hh, d = 2 * b.ht, m = b.m;
  b.invI = v3(12 / (m * (c * c + d * d)), 12 / (m * (a * a + d * d)), 12 / (m * (a * a + c * c)));
  b.pts = samplePoints(b.hw, b.hh, b.ht);
  b.asleep = false;
}
const applyBody = (b, vec, k) => { const l = Q.rot(Q.conj(b.q), vec); return Q.rot(b.q, v3(l.x * k.x, l.y * k.y, l.z * k.z)); };
const invIw = (b, vec) => applyBody(b, vec, b.invI);
const omega = (b) => invIw(b, b.L);
function setSpin(b, w) { b.L = applyBody(b, w, v3(1 / b.invI.x, 1 / b.invI.y, 1 / b.invI.z)); }
function applyImpulse(b, J, r) { b.v = add(b.v, mul(J, 1 / b.m)); b.L = add(b.L, cross(r, J)); }
/* lowest point of the body's 8 corners (world y) */
function lowest(b) { let m = Infinity; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) m = Math.min(m, b.p.y + Q.rot(b.q, v3(sx * b.hw, sy * b.hh, sz * b.ht)).y); return m; }
/* place so the body rests at (x, z) on whatever is beneath, or at height y above the floor */
function place(W, b, x, z, y = null, q = null) {
  if (q) b.q = q;
  b.p = v3(x, 0, W.planar ? W.a.slice : z);
  const floor = floorAt(W, x, b.p.z);
  b.p.y = 0; b.p.y = (y ?? floor) - lowest(b) + 0.002;
  Object.assign(b, { v: v3(), L: v3(), asleep: false, still: 0, peak: null, inSand: false, lastHit: -9 });
}

/* ---------- world ---------- */
function makeWorld(key, opts) {
  const def = ARENAS[key], a = def.build(opts);
  return { key, def, a, surface: opts.surface ?? a.surface, height: opts.height ?? 10, g: a.g ?? 9.81, air: a.air ?? 0.0125, planar: !!opts.planar };
}
const zoneAt = (W, x, z) => W.a.zones.find(zn => x > zn.x0 && x < zn.x1 && (W.planar || (z > zn.z0 && z < zn.z1)));
function floorAt(W, x, z) {
  const zn = zoneAt(W, x, z);
  let y = zn ? zn.bottom : 0;
  for (const bk of W.a.blocks) if (x > bk.x0 && x < bk.x1 && (W.planar ? W.a.slice > bk.z0 && W.a.slice < bk.z1 : z > bk.z0 && z < bk.z1)) y = Math.max(y, bk.y1);
  return zn && zn.kind !== 'sand' ? y : Math.max(y, zn ? zn.top : y);
}
function mediumAt(W, P) { const zn = zoneAt(W, P.x, P.z); return zn && P.y < zn.top && P.y > zn.bottom - 0.05 ? zn : null; }
const surf = (key) => S.SURFACES[key] || { factor: 0.8, name: 'wall' };

function contactsAt(W, P, C) {
  const out = [], a = W.a, zp = zoneAt(W, P.x, P.z), zc = zoneAt(W, C.x, C.z);
  if (zp) { if (P.y < zp.bottom) out.push({ n: UP, pen: zp.bottom - P.y, surf: zp.floor }); }
  else if (P.y < 0) {
    if (zc && zc.bottom < 0 && C.y < 0) { // poking into a pit wall from inside the pit
      if (P.x <= zc.x0) out.push({ n: v3(1, 0, 0), pen: zc.x0 - P.x, surf: zc.floor });
      if (P.x >= zc.x1) out.push({ n: v3(-1, 0, 0), pen: P.x - zc.x1, surf: zc.floor });
      if (!W.planar && P.z <= zc.z0) out.push({ n: v3(0, 0, 1), pen: zc.z0 - P.z, surf: zc.floor });
      if (!W.planar && P.z >= zc.z1) out.push({ n: v3(0, 0, -1), pen: P.z - zc.z1, surf: zc.floor });
    } else out.push({ n: UP, pen: -P.y, surf: W.surface });
  }
  for (const bk of a.blocks) {
    if (!(P.x > bk.x0 && P.x < bk.x1 && P.y > bk.y0 && P.y < bk.y1)) continue;
    if (W.planar ? !(a.slice > bk.z0 && a.slice < bk.z1) : !(P.z > bk.z0 && P.z < bk.z1)) continue;
    const c = [[P.x - bk.x0, v3(-1, 0, 0)], [bk.x1 - P.x, v3(1, 0, 0)], [P.y - bk.y0, v3(0, -1, 0)], [bk.y1 - P.y, UP]];
    if (!W.planar) c.push([P.z - bk.z0, v3(0, 0, -1)], [bk.z1 - P.z, v3(0, 0, 1)]);
    const [pen, n] = c.reduce((m, e) => e[0] < m[0] ? e : m);
    out.push({ n, pen, surf: bk.surf });
  }
  if (P.x < 0) out.push({ n: v3(1, 0, 0), pen: -P.x, surf: 'wall' });
  if (P.x > a.W) out.push({ n: v3(-1, 0, 0), pen: P.x - a.W, surf: 'wall' });
  if (!W.planar && P.z < 0) out.push({ n: v3(0, 0, 1), pen: -P.z, surf: 'wall' });
  if (!W.planar && P.z > a.D) out.push({ n: v3(0, 0, -1), pen: P.z - a.D, surf: 'wall' });
  if (P.y > W.height) out.push({ n: v3(0, -1, 0), pen: P.y - W.height, surf: 'wall' });
  return out;
}

function lockPlane(W, b) {
  b.p.z = W.a.slice; b.v.z = 0; b.L.x = b.L.y = 0;
  b.q = Q.norm({ w: b.q.w, x: 0, y: 0, z: b.q.z });
}

/* Which part of the body took the hit — from the real orientation in 3D, a coin toss for flat 2D landings. */
const FACES = [['screen', v3(0, 0, 1)], ['back', v3(0, 0, -1)], ['edge', v3(1, 0, 0)], ['edge', v3(-1, 0, 0)], ['edge', v3(0, 1, 0)], ['edge', v3(0, -1, 0)]];
function classify(W, b, cts, best, rng) {
  const s = best.s;
  if (W.planar) {
    const ang = 2 * Math.atan2(b.q.z, b.q.w), rel = ((ang % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
    const flat = Math.min(rel, Math.PI / 2 - rel) < 0.18, r = rng();
    const hit = flat ? (r < 0.4 ? 'screen' : r < 0.8 ? 'back' : 'edge') : 'corner', face = hit === 'screen' || hit === 'back';
    return { hit, side: rng() < 0.5 ? 'front' : 'back', u: face ? 0.15 + rng() * 0.7 : s.u, v: face ? 0.15 + rng() * 0.7 : s.v };
  }
  let top = null, dmax = -2;
  for (const [hit, fn] of FACES) { const d = -dot(Q.rot(b.q, fn), best.n); if (d > dmax) { dmax = d; top = hit; } }
  if (dmax > 0.94) {
    const same = cts.filter(c => dot(c.n, best.n) > 0.9 && c.vn > 0);
    const u = same.reduce((a, c) => a + c.s.u, 0) / same.length, v = same.reduce((a, c) => a + c.s.v, 0) / same.length;
    return { hit: top, side: top === 'back' ? 'back' : 'front', u, v };
  }
  const side = s.front ? 'front' : 'back';
  if (s.type === 'corner') return { hit: 'corner', side, u: s.u, v: s.v };
  if (s.type === 'edge') return { hit: 'edge', side, u: s.u, v: s.v };
  return { hit: s.front ? 'screen' : 'back', side, u: s.u, v: s.v };
}

function collide(W, b, h, ev, rng) {
  const cts = [];
  for (const s of b.pts) { const r = Q.rot(b.q, s.b), P = add(b.p, r); for (const c of contactsAt(W, P, b.p)) cts.push({ ...c, r, P, s, vn: 0 }); }
  if (!cts.length) { // resting on sand is held by penalty forces, not contacts
    b.still = b.buried > 0 && len(b.v) < 0.06 && len(mul(b.L, 1 / b.m)) < 0.01 ? b.still + h : 0; // packed sand: judge by motion, not micro-chatter
    if (b.still > 0.4) { b.v = v3(); b.L = v3(); b.asleep = true; }
    return;
  }
  const deepest = new Map(); // positional correction: deepest contact per normal
  for (const c of cts) { const k = `${Math.round(c.n.x * 4)},${Math.round(c.n.y * 4)},${Math.round(c.n.z * 4)}`; if (!deepest.has(k) || deepest.get(k).pen < c.pen) deepest.set(k, c); }
  for (const c of deepest.values()) b.p = add(b.p, mul(c.n, c.pen * 0.9));
  // impact speed is measured before any impulse; then one impulse per contact plane at the centroid
  // of its approaching points (sequential per-point impulses inject fake spin on flat landings)
  let best = null;
  const w0 = omega(b), groups = new Map();
  for (const c of cts) {
    c.vn = -dot(add(b.v, cross(w0, c.r)), c.n);
    if (c.vn <= 0) continue;
    if (!best || c.vn > best.vn) best = c;
    const k = `${Math.round(c.n.x * 4)},${Math.round(c.n.y * 4)},${Math.round(c.n.z * 4)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const pointPass = () => { // inelastic per-point impulses: kill rocking & sinking without adding spin
    for (const c of cts) {
      const vn = dot(add(b.v, cross(omega(b), c.r)), c.n);
      if (vn >= 0) continue;
      applyImpulse(b, mul(c.n, -vn / (1 / b.m + dot(c.n, cross(invIw(b, cross(c.r, c.n)), c.r)))), c.r);
    }
  };
  for (const g of groups.values()) {
    const n = g[0].n, r = mul(g.reduce((a, c) => add(a, c.r), v3()), 1 / g.length);
    const vp = add(b.v, cross(omega(b), r)), vn = dot(vp, n);
    if (vn >= 0) continue;
    const sf = surf(g[0].surf), e = -vn < 0.8 ? 0 : (sf.bounce ?? 0.12 + 0.3 * Math.min(1, sf.factor)), mu = sf.mu ?? 0.5;
    const k = 1 / b.m + dot(n, cross(invIw(b, cross(r, n)), r)), j = -(1 + e) * vn / k;
    applyImpulse(b, mul(n, j), r);
    if (e === 0) { pointPass(); pointPass(); }
    for (const c of g) { // friction spread over the contact patch, so it also resists spinning in place
      const vp2 = add(b.v, cross(omega(b), c.r)), vt = sub(vp2, mul(n, dot(vp2, n))), vtl = len(vt);
      if (vtl < 1e-6) continue;
      const t = mul(vt, -1 / vtl), kt = 1 / b.m + dot(t, cross(invIw(b, cross(c.r, t)), c.r));
      applyImpulse(b, mul(t, Math.min(vtl / kt, mu * j / g.length)), c.r);
    }
  }
  if (best && best.vn > 1.3 && b.t - b.lastHit > 0.12) {
    b.lastHit = b.t;
    const fell = Math.max(0, (b.peak ?? b.p.y) - b.p.y); b.peak = b.p.y;
    ev.push({ type: 'impact', speed: best.vn, surf: best.surf, at: best.P, fell, ...classify(W, b, cts, best, rng) });
  }
  // sleep only when resting on something below with a real footprint — never against a wall in mid-air
  const floor = cts.filter(c => c.n.y > 0.7);
  const spread = (k) => { let lo = Infinity, hi = -Infinity; for (const c of floor) { lo = Math.min(lo, c.s.b[k]); hi = Math.max(hi, c.s.b[k]); } return hi - lo; };
  const footprint = floor.length >= 3 && [spread('x') > b.hw * 0.8, spread('y') > b.hh * 0.8, spread('z') > b.ht].filter(Boolean).length >= (W.planar ? 1 : 2);
  const slow = len(b.v) < 0.06 && len(omega(b)) < 0.3;
  b.still = slow && (footprint || b.buried > 0) ? b.still + h : 0;
  if (b.still > 0.4) { b.v = v3(); b.L = v3(); b.asleep = true; }
}

/* Advance the body by dt seconds. Returns events: impact | enter (water/lava/balls/sand). */
function step(W, b, dt, rng = Math.random) {
  const ev = [];
  if (b.drag || b.asleep) return ev;
  const n = Math.max(10, Math.ceil(dt / 0.0017)), h = dt / n; // ≤ ~1/600 s keeps the stiff contacts stable on slow frames
  for (let i = 0; i < n; i++) {
    b.t += h;
    const med = mediumAt(W, b.p), sp = len(b.v);
    let F = v3(0, -W.g * b.m, 0), T = v3();
    const M = med && MEDIUM[med.kind];
    if (M) {
      F.y += W.g * b.m * M.buoy;
      F = sub(F, mul(b.v, (M.drag[0] + M.drag[1] * sp) * b.m));
      b.L = mul(b.L, Math.exp(-5 * h));
    } else F = sub(F, mul(b.v, W.air * sp * b.m)); // terminal ≈ 28 m/s on Earth
    // sand behaves like soil: it only pushes back while the body is pressing into it (no spring-back),
    // and its bearing strength grows with depth — so impacts leave the body embedded where it stopped
    const w = omega(b); let below = 0, sandY = 0;
    for (const s of b.pts) {
      const r = Q.rot(b.q, s.b), P = add(b.p, r), zn = zoneAt(W, P.x, P.z);
      if (!zn || zn.kind !== 'sand' || P.y >= zn.top) continue;
      below++;
      const pen = zn.top - P.y, vp = add(b.v, cross(w, r));
      const Fp = v3(-6 * b.m * vp.x, vp.y < 0 ? 200 * b.m * pen - 13 * b.m * vp.y : 0, -6 * b.m * vp.z);
      F = add(F, Fp); T = add(T, cross(r, Fp)); sandY += Fp.y;
    }
    b.buried = below / b.pts.length;
    if (below && !b.inSand) ev.push({ type: 'enter', medium: 'sand', speed: sp, at: { ...b.p } });
    b.inSand = below > 0;
    const vy0 = b.v.y;
    b.v = add(b.v, mul(F, h / b.m)); b.L = add(b.L, mul(T, h));
    if (sandY > 0 && vy0 <= 0 && b.v.y > 0) b.v.y = 0; // sand can stop a body, never fling it back up
    if (below) b.L = mul(b.L, Math.exp(-150 * b.buried * h)); // packed sand grips: embedded bodies stay at their angle
    b.p = add(b.p, mul(b.v, h)); b.q = Q.integrate(b.q, omega(b), h);
    if (W.planar) lockPlane(W, b);
    const now = mediumAt(W, b.p);
    if (now && now !== med && MEDIUM[now.kind]) {
      if (now !== b.lastZone || b.t - b.leftAt > 0.6) ev.push({ type: 'enter', medium: now.kind, speed: len(b.v), at: { ...b.p } }); // bobbing at the surface isn't a new entry
      b.v = mul(b.v, 0.35); b.L = mul(b.L, 0.4);
    }
    if (med && !now) { b.lastZone = med; b.leftAt = b.t; }
    b.peak = Math.max(b.peak ?? b.p.y, b.p.y);
    collide(W, b, h, ev, rng);
  }
  return ev;
}

/* Throw with a realistic tumble: spin grows with throw speed. */
function launch(W, b, v, rng = Math.random) {
  b.v = { ...v }; b.asleep = false; b.drag = false; b.lastHit = -9; b.peak = b.p.y;
  const s = len(v) * 1.5 + 1;
  setSpin(b, W.planar ? v3(0, 0, -v.x * 1.5 + (rng() - 0.5) * 4) : v3((rng() - 0.5) * s, (rng() - 0.5) * s, (rng() - 0.5) * s));
}

const World = { ARENAS, MEDIUM, v3, add, sub, mul, dot, cross, len, norm, Q, makeWorld, makeBody, setDims, place, step, launch, setSpin, omega,
  zoneAt, floorAt, mediumAt, lowest, contactsAt };
if (typeof module !== 'undefined' && module.exports) module.exports = World; else root.World = World;
})(typeof globalThis !== 'undefined' ? globalThis : this);
