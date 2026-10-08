/* PhoneLab views: the arena (2D side view or 3D tumble), the torture close-up (flat or rotatable 3D),
   weapons and the main loop. Depends on Sim, World, Draw, R3 and app.js. */
'use strict';
const Wd = World, { v3, Q } = Wd;
let W = null;
const body = Wd.makeBody(spec);
const cam = { x: 3, y: 1, s: 100, zoom: null, init: false };                              // 2D side view
const cam3 = { yaw: -0.7, pitch: 0.32, dist: 3.2, target: v3(2, 0.3, 5), follow: true, init: false }; // 3D orbit
let closeQ = Q.id();
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const SKY = { lab: ['#0d1a2b', '#2c4a68'], stairs: ['#0d1a2b', '#2c4a68'], playground: ['#3b7bd1', '#a8d4ff'], bathroom: ['#cfc6b4', '#e9e3d6'],
  ice: ['#8fb8d8', '#e3f1fb'], volcano: ['#1a0604', '#7a2408'], moon: ['#000000', '#05060a'], mars: ['#8a5a3a', '#d9a066'] };

/* ---------------- world glue ---------------- */
function buildWorld(resetPos = true) {
  W = Wd.makeWorld(env.arena, { pool: env.pool, height: env.height, surface: env.surface, planar: !env.mode3d });
  Wd.setDims(body, spec);
  if (resetPos) resetBody();
  else { body.asleep = false; if (W.planar) { body.p.z = W.a.slice; body.q = Q.norm({ w: body.q.w, x: 0, y: 0, z: body.q.z }); body.L = v3(); } }
  zoneButtons();
}
function resetBody() { Wd.setDims(body, spec); Wd.place(W, body, W.a.start.x, W.a.start.z, null, W.planar ? Q.id() : Q.axis(v3(1, 0, 0), -Math.PI / 2)); cam.init = cam3.init = false; }
function onSpecChanged() { Wd.setDims(body, spec); GEO = D.geometry(spec, BOX); }
function setArena(key) {
  env.arena = key;
  const a = Wd.ARENAS[key].build({ pool: env.pool });
  Object.assign(env, { surface: a.surface, ambient: a.ambient ?? 25, hmul: a.hmul ?? 1, sun: !!a.sun });
  $('surface').value = a.surface; $('ambient').value = env.ambient; $('ambVal').textContent = env.ambient + ' °C'; $('sun').checked = env.sun;
  $('pool').disabled = key !== 'lab';
  buildWorld();
  log('info', `Arena: ${Wd.ARENAS[key].name} — ${Wd.ARENAS[key].desc}${a.g ? ` Gravity ${a.g} m/s².` : ''}`);
}
const floorUnder = () => Wd.floorAt(W, body.p.x, body.p.z);
function orientQ(kind) {
  if (W.planar) return Q.axis(v3(0, 0, 1), { corner: 0.6, edge: Math.PI / 2, bottom: 0 }[kind] ?? rand(-0.5, 0.5));
  switch (kind) {
    case 'screen': return Q.axis(v3(1, 0, 0), Math.PI / 2);
    case 'back': return Q.axis(v3(1, 0, 0), -Math.PI / 2);
    case 'edge': return Q.axis(v3(0, 0, 1), Math.PI / 2);
    case 'bottom': return Q.id();
    case 'corner': { const a = Wd.norm(v3(-body.hw, -body.hh, body.ht)), b = v3(0, -1, 0); return Q.axis(Wd.cross(a, b), Math.acos(Wd.dot(a, b))); }
    default: return Q.norm({ w: rand(-1, 1), x: rand(-1, 1), y: rand(-1, 1), z: rand(-1, 1) });
  }
}
/* drop targets: the start spot plus every zone (pool, lava, toilet…) and labelled platform of the arena;
   the height is measured from that target's surface */
const ZONE_ICON = { water: '💧', sand: '🏖', lava: '🌋', balls: '🎈' };
function dropTargets() {
  const a = W.a, t = [{ label: '📍 Start spot', x: a.start.x, z: a.start.z, base: Wd.floorAt(W, a.start.x, a.start.z) }];
  for (const zn of a.zones) t.push({ label: `${ZONE_ICON[zn.kind]} ${zn.label.toLowerCase()}`, x: (zn.x0 + zn.x1) / 2, z: (zn.z0 + zn.z1) / 2, base: zn.top });
  for (const bk of a.blocks) if (bk.label) t.push({ label: `📦 ${bk.label.toLowerCase()}`, x: (bk.x0 + bk.x1) / 2, z: (bk.z0 + bk.z1) / 2, base: bk.y1 });
  return t;
}
function dropAt(t, height) {
  const y = Math.min(t.base + height, env.height - Math.max(body.hw, body.hh) * 2.2);
  Wd.place(W, body, t.x, t.z, y, orientQ($('orient').value));
}
function zoneButtons() {
  const sel = $('dropTarget'), prev = sel.selectedIndex;
  sel.textContent = '';
  dropTargets().forEach((t, i) => sel.add(new Option(t.label, i)));
  sel.selectedIndex = prev > 0 && prev < sel.options.length ? prev : 0;
}

/* ---------------- physics events ---------------- */
const surfName = (k) => S.SURFACES[k]?.name ?? 'wall';
function applyImpact(e) {
  const r = S.impact(spec, st, { speed: e.speed, hit: e.hit, side: e.side, surfaceFactor: e.factor ?? S.SURFACES[e.surf]?.factor ?? 0.8, u: e.u, v: e.v });
  const where = e.v < 0.25 ? 'top' : e.v > 0.75 ? 'bottom' : 'middle', lr = e.u < 0.5 ? 'left' : 'right';
  const label = { screen: 'screen-down', back: 'back-down', edge: `${where === 'middle' ? lr + ' side' : where} edge`, corner: `${where}-${lr} ${e.side} corner` }[e.hit];
  log('info', `Impact ${e.speed.toFixed(1)} m/s${e.fell > 0.05 ? ` after a ${e.fell.toFixed(1)} m fall` : ''} · ${label} · ${e.surfLabel ?? surfName(e.surf)} · ${r.energy.toFixed(1)} J reached the device`);
  handle(r.events);
  const p = e.at || body.p, broke = r.events.some(x => x.lvl === 'bad' || x.lvl === 'dead');
  floaters.push({ x: p.x, y: p.y + 0.12, z: p.z, text: `${e.speed.toFixed(1)} m/s${broke ? ' 💥' : ''}`, color: broke ? '#fc5c65' : '#d9dfe7', life: 1.6 });
  if (!e.factor) for (let i = 0; i < Math.min(30, e.speed * 2); i++) worldFx.push({ t: 'dust', x: p.x, y: p.y, z: p.z, vx: rand(-1, 1), vy: rand(0, 1.2), vz: rand(-1, 1), life: rand(.4, .9) });
  if (broke) for (let i = 0; i < 14; i++) worldFx.push({ t: 'shard', x: p.x, y: p.y, z: p.z, vx: rand(-2, 2), vy: rand(1, 3), vz: rand(-2, 2), life: 1 });
  shake = Math.min(14, e.speed * 0.8);
}
function faceDownHit() {
  if (W.planar) return Math.random() < 0.5 ? 'screen' : 'back';
  const fy = Q.rot(body.q, v3(0, 0, 1)).y;
  return fy < -0.8 ? 'screen' : fy > 0.8 ? 'back' : 'edge';
}
const splash = (t, n, sp, at) => { for (let i = 0; i < n; i++) worldFx.push({ t, x: at.x + rand(-.2, .2), y: at.y, z: at.z + rand(-.2, .2), vx: rand(-1.5, 1.5), vy: rand(0.5, 1 + sp * 0.3), vz: rand(-1.5, 1.5), life: 1.1 }); };
function onEnter(e) {
  const at = { ...e.at }, n = Math.min(60, e.speed * 5);
  if (e.medium === 'water') {
    splash('splash', n, e.speed, at);
    if (e.speed > 8) {
      const sf = Math.min(1, (e.speed / 35) ** 2);
      log('info', `Hit the water at ${e.speed.toFixed(1)} m/s — at this speed water acts like ${sf > 0.5 ? 'concrete' : 'a cushion'}`);
      applyImpact({ speed: e.speed, hit: faceDownHit(), side: 'front', factor: sf, u: rand(.2, .8), v: rand(.2, .8), surfLabel: 'water', at });
    }
  } else if (e.medium === 'sand') {
    splash('sand', n, e.speed, at);
    if (e.speed > 1.5) {
      applyImpact({ speed: e.speed, hit: faceDownHit(), side: 'front', factor: S.SAND_FACTOR, u: rand(.2, .8), v: rand(.2, .8), surfLabel: 'sand', at });
      handle(S.sandImpact(spec, st, e.speed));
    }
  } else if (e.medium === 'lava') { splash('fire', n, e.speed, at); log('bad', 'Plopped into ~1,100 °C lava. It floats — lava is denser than a phone.'); }
  else if (e.medium === 'balls') { splash('ball', n, e.speed, at); log('info', 'Vanished into the ball pit.'); }
}
function mediaTick(dt, simDt) {
  const zn = Wd.zoneAt(W, body.p.x, body.p.z), low = Wd.lowest(body);
  const depth = zn && zn.kind === 'water' ? zn.top - body.p.y : 0;
  env.submerged = depth > 0.03;
  if (env.submerged) {
    handle(S.waterStep(spec, st, depth, simDt));
    if (Math.random() < dt * (3 + st.ingress / 10)) worldFx.push({ t: 'bubble', x: body.p.x, y: body.p.y + body.ht, z: body.p.z, vx: rand(-.05, .05), vy: rand(.4, .8), vz: rand(-.05, .05), life: 4, top: zn.top });
  } else st.submergedSec = 0;
  if (zn && zn.kind === 'lava' && low < zn.top + 0.01) {
    st.extHeat += 2500; st.scorch = Math.min(1, st.scorch + dt * 0.15);
    if (Math.random() < dt * 20) worldFx.push({ t: 'fire', x: body.p.x + rand(-.1, .1), y: zn.top, z: body.p.z + rand(-.1, .1), vx: 0, vy: rand(.3, .8), vz: 0, life: .7 });
  }
  st.buried = body.buried;
  if (body.buried > 0) handle(S.sandStep(spec, st, body.buried, Wd.len(body.v), simDt));
}

/* ---------------- arena canvas & input ---------------- */
const wc = $('world'), wx = wc.getContext('2d');
let cssW = 800, cssH = 500;
function resizeWorld() { const r = wc.getBoundingClientRect(), dpr = devicePixelRatio || 1; cssW = r.width; cssH = r.height; wc.width = cssW * dpr; wc.height = cssH * dpr; wx.setTransform(dpr, 0, 0, dpr, 0, 0); }
const localPt = (e, c) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
let trail = [], grab = null, orbit = null, lastPointer = [0, 0];
const pitDepth = () => Math.max(0, ...W.a.zones.map(z => -z.bottom));
// 2D
const fitScale = () => Math.min(cssH / (env.height + pitDepth() + 0.8), cssW / (W.a.W + 0.8));
const maxScale = () => cssH / 0.4;
const toS = (x, y) => [cssW / 2 + (x - cam.x) * cam.s, cssH / 2 - (y - cam.y) * cam.s];
const toW = (px, py) => ({ x: cam.x + (px - cssW / 2) / cam.s, y: cam.y - (py - cssH / 2) / cam.s });
// 3D
const eye3 = () => Wd.add(cam3.target, v3(Math.cos(cam3.pitch) * Math.sin(cam3.yaw) * cam3.dist, Math.sin(cam3.pitch) * cam3.dist, Math.cos(cam3.pitch) * Math.cos(cam3.yaw) * cam3.dist));
const camera3 = () => R3.camera(eye3(), cam3.target, 0.9, cssW, cssH);
function clampBodyPos(p) {
  const a = W.a, r = Math.max(body.hw, body.hh);
  p.x = clamp(p.x, r, a.W - r); p.z = W.planar ? a.slice : clamp(p.z, r, a.D - r);
  p.y = Math.min(p.y, env.height - r);
  const lowOff = body.p.y - Wd.lowest(body), fl = Wd.floorAt(W, p.x, p.z);
  p.y = Math.max(p.y, fl + lowOff);
  return p;
}
function pickWorld(px, py) {
  if (!env.mode3d) {
    const dp = drawnPhone(), [sx, sy] = toS(dp.x, dp.y);
    return Math.hypot(px - sx, py - sy) < Math.max(body.hh * cam.s * dp.k * 1.3, 24);
  }
  const c = camera3(), s = R3.project(c, body.p);
  if (!s) return false;
  const rad = Math.max(26, Math.max(body.hw, body.hh) * c.F / Wd.len(Wd.sub(body.p, c.eye)) * 1.2);
  return Math.hypot(px - s[0], py - s[1]) < rad;
}
let shiftHeld = false;
function grabPlane(px, py) { // vertical plane facing the camera, or (Shift) the horizontal plane at the device's height
  const c = camera3(), d = R3.ray(c, px, py), n = shiftHeld ? v3(0, 1, 0) : Wd.norm(v3(c.f.x, 0, c.f.z));
  const t = Wd.dot(Wd.sub(body.p, c.eye), n) / Wd.dot(d, n);
  grab = { n, p0: { ...body.p }, off: t > 0 ? Wd.sub(body.p, Wd.add(c.eye, Wd.mul(d, t))) : v3(), shift: shiftHeld };
}
function dragTo(px, py) {
  let p;
  if (!env.mode3d) { const w = toW(px, py); p = v3(w.x + grab.dx, w.y + grab.dy, W.a.slice); }
  else {
    if (grab.shift !== shiftHeld) grabPlane(px, py);
    const c = camera3(), d = R3.ray(c, px, py), n = grab.n, den = Wd.dot(d, n), t = Wd.dot(Wd.sub(grab.p0, c.eye), n) / den;
    if (!(t > 0) || Math.abs(den) < 1e-4) return;
    p = Wd.add(Wd.add(c.eye, Wd.mul(d, Math.min(t, 300))), grab.off);
  }
  body.p = clampBodyPos(p);
  trail.push({ ...body.p, t: performance.now() }); while (trail.length > 2 && performance.now() - trail[0].t > 150) trail.shift();
}
/* release velocity: least-squares slope over the last 100 ms of the drag (endpoints alone are jittery) */
function trailVelocity() {
  const now = performance.now(), pts = trail.filter(p => now - p.t < 100);
  if (pts.length < 2 || now - pts[pts.length - 1].t > 120) return v3(); // held still before letting go = a plain drop
  const tm = pts.reduce((a, p) => a + p.t, 0) / pts.length;
  let den = 0, num = v3();
  for (const p of pts) { const dt = (p.t - tm) / 1000; den += dt * dt; num = Wd.add(num, Wd.mul(v3(p.x, p.y, p.z), dt)); }
  return den > 0 ? Wd.mul(num, 1 / den) : v3();
}
const armVelocity = (v) => { let vel = Wd.mul(v, +$('arm').value); const sp = Wd.len(vel); return sp > 60 ? Wd.mul(vel, 60 / sp) : vel; };
function applySpinStyle(vel) {
  const style = $('spin').value, sp = Wd.len(vel);
  if (style === 'tumble') return; // launch() already gave a random tumble that grows with speed
  if (W.planar) { Wd.setSpin(body, v3(0, 0, style === 'none' ? 0 : -Math.sign(vel.x || 1) * (sp * 2.5 + 3))); return; }
  const flat = Wd.len(v3(vel.x, 0, vel.z)) > 1e-3 ? Wd.norm(v3(vel.x, 0, vel.z)) : v3(1, 0, 0);
  if (style === 'none') Wd.setSpin(body, v3());
  else if (style === 'flip') Wd.setSpin(body, Wd.mul(Wd.norm(Wd.cross(v3(0, 1, 0), flat)), -(sp * 2.5 + 4))); // end over end
  else { body.q = Q.mul(Q.axis(v3(0, 1, 0), rand(0, 6.28)), Q.axis(v3(1, 0, 0), -Math.PI / 2 + rand(-0.15, 0.15))); Wd.setSpin(body, v3(0, sp * 3 + 8, 0)); } // frisbee
}
function throwBody(vel) { Wd.launch(W, body, vel); if (Wd.len(vel) < 0.3) Wd.setSpin(body, v3()); else applySpinStyle(vel); }
/* predicted flight while dragging: gravity + air drag until it meets a surface */
function predictPath() {
  const out = [], h = 0.02; let p = { ...body.p }, v = armVelocity(trailVelocity());
  if (Wd.len(v) < 0.5) return out;
  for (let i = 0; i < 250; i++) {
    const sp = Wd.len(v);
    v = v3(v.x - W.air * v.x * sp * h, v.y - (W.g + W.air * v.y * sp) * h, v.z - W.air * v.z * sp * h);
    p = Wd.add(p, Wd.mul(v, h)); out.push(p);
    const zn = Wd.zoneAt(W, p.x, p.z);
    if (p.y < (zn ? zn.top : Wd.floorAt(W, p.x, p.z)) || p.x < 0 || p.x > W.a.W || p.z < 0 || p.z > W.a.D || p.y > env.height) break;
  }
  return out;
}
function drawPrediction(g, proj) {
  if (!body.drag) return;
  const pts = predictPath().filter((_, i) => i % 3 === 0).map(proj).filter(Boolean);
  g.fillStyle = 'rgba(79,209,197,.85)';
  pts.forEach(([x, y], i) => { g.beginPath(); g.arc(x, y, i === pts.length - 1 ? 5 : 2, 0, 7); g.fill(); });
  const v = Wd.len(armVelocity(trailVelocity()));
  if (v > 0.5 && pts.length) { g.font = 'bold 12px system-ui'; g.textAlign = 'center'; g.fillText(`${v.toFixed(1)} m/s`, pts[pts.length - 1][0], pts[pts.length - 1][1] - 10); }
}
wc.addEventListener('pointerdown', (e) => {
  const [px, py] = localPt(e, wc);
  wc.setPointerCapture(e.pointerId); lastPointer = [px, py];
  if (e.button === 0 && pickWorld(px, py)) {
    body.drag = true; body.asleep = false; wc.classList.add('grabbing');
    shiftHeld = e.shiftKey;
    if (!env.mode3d) { const w = toW(px, py); grab = { dx: body.p.x - w.x, dy: body.p.y - w.y }; }
    else grabPlane(px, py);
    trail = [{ ...body.p, t: performance.now() }];
  } else if (env.mode3d) orbit = { x: px, y: py, yaw: cam3.yaw, pitch: cam3.pitch };
});
wc.addEventListener('pointermove', (e) => {
  const [px, py] = localPt(e, wc); lastPointer = [px, py]; shiftHeld = e.shiftKey;
  if (body.drag) dragTo(px, py);
  else if (orbit) { cam3.yaw = orbit.yaw - (px - orbit.x) * 0.008; cam3.pitch = clamp(orbit.pitch + (py - orbit.y) * 0.008, 0.04, 1.5); }
});
const release = () => {
  orbit = null;
  if (!body.drag) return;
  body.drag = false; wc.classList.remove('grabbing');
  throwBody(armVelocity(trailVelocity()));
};
wc.addEventListener('pointerup', release); wc.addEventListener('pointercancel', release);
wc.addEventListener('contextmenu', (e) => e.preventDefault());
wc.addEventListener('wheel', (e) => {
  e.preventDefault();
  const step = Math.sign(e.deltaY) * Math.PI / 12;
  if (body.drag) { // rotate what you're holding
    const ax = !env.mode3d ? v3(0, 0, 1) : e.shiftKey ? v3(0, 1, 0) : camera3().r;
    body.q = Q.norm(Q.mul(Q.axis(ax, step), body.q));
    return;
  }
  if (env.mode3d) cam3.dist = clamp(cam3.dist * (e.deltaY < 0 ? 1 / 1.15 : 1.15), 0.3, 600);
  else cam.zoom = clamp(cam.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), fitScale(), maxScale());
}, { passive: false });

/* ---------------- 2D side view ---------------- */
const angle2D = () => 2 * Math.atan2(body.q.z, body.q.w);
function drawnPhone() {
  const ph = body.hh * 2 * cam.s, k = Math.max(1, 26 / ph), a = angle2D();
  const ext = Math.abs(body.hw * Math.sin(a)) + Math.abs(body.hh * Math.cos(a));
  return { k, x: body.p.x, y: body.p.y + (k - 1) * ext };
}
function updateCamera(dt) {
  cam.s = clamp(cam.zoom ?? Math.max(fitScale(), cssH / 3.5), fitScale(), maxScale());
  const vw = cssW / cam.s, vh = cssH / cam.s, a = W.a;
  if (body.drag) {
    const [px, py] = lastPointer, edge = 50, sp = 1.2 * vh * dt;
    if (py < edge) cam.y += sp; if (py > cssH - edge) cam.y -= sp; if (px < edge) cam.x -= sp; if (px > cssW - edge) cam.x += sp;
    cam.y = clamp(cam.y, -pitDepth(), env.height); cam.x = clamp(cam.x, 0, a.W); dragTo(px, py); return;
  }
  const minX = -0.4, maxX = a.W + 0.4, minY = -pitDepth() - 0.4, maxY = env.height + 0.4;
  let tx = body.p.x + body.v.x * 0.12, ty = body.p.y + body.v.y * 0.1 + vh * 0.22;
  tx = vw >= maxX - minX ? (minX + maxX) / 2 : clamp(tx, minX + vw / 2, maxX - vw / 2);
  ty = vh >= maxY - minY ? (minY + maxY) / 2 : clamp(ty, minY + vh / 2, maxY - vh / 2);
  const k = cam.init ? 1 - Math.exp(-dt * 8) : 1; cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.init = true;
}
const MEDIUM_FILL = { sand: '#d8b878', lava: '#ff5a00', balls: '#2b2b40', water: 'rgba(43,143,214,.55)' };
function drawWorld2D(dt) {
  const g = wx, Wc = cssW, H = cssH, s = cam.s, a = W.a, sl = a.slice, sky = SKY[env.arena] || SKY.lab;
  g.save();
  if (shake > 0.2) { g.translate(rand(-shake, shake), rand(-shake, shake)); shake *= Math.exp(-10 * dt); }
  const sg = g.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, sky[0]); sg.addColorStop(1, sky[1]); g.fillStyle = sg; g.fillRect(-20, -20, Wc + 40, H + 40);
  const top = cam.y + H / 2 / s, bot = cam.y - H / 2 / s, step = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100].find(v => v * s >= 32) || 100;
  for (let y = Math.ceil(Math.max(0, bot) / step) * step; y <= Math.min(top, env.height) + 1e-6; y += step) { const [, sy] = toS(0, y); g.strokeStyle = '#ffffff12'; g.beginPath(); g.moveTo(0, sy); g.lineTo(Wc, sy); g.stroke(); }
  const [, ceilY] = toS(0, env.height);
  if (ceilY > -5) { g.setLineDash([6, 6]); g.strokeStyle = '#ffffff40'; g.beginPath(); g.moveTo(0, ceilY); g.lineTo(Wc, ceilY); g.stroke(); g.setLineDash([]); }
  const [gx0, gy] = toS(0, 0), [gx1] = toS(a.W, 0), surf = S.SURFACES[env.surface] || S.SURFACES.concrete;
  g.fillStyle = '#0a0d11'; g.fillRect(-20, -20, gx0 + 20, H + 40); g.fillRect(gx1, -20, Wc, H + 40);
  g.fillStyle = surf.color; g.fillRect(gx0, gy, gx1 - gx0, H - gy + 20);
  g.fillStyle = '#00000040'; g.fillRect(gx0, gy + 4, gx1 - gx0, H);
  const zones = a.zones.filter(z => sl > z.z0 && sl < z.z1), late = [];
  for (const zn of zones) {
    const [x0, yb] = toS(zn.x0, zn.bottom), [x1, yt] = toS(zn.x1, zn.top), [, y0] = toS(0, 0);
    if (zn.bottom < 0) { g.fillStyle = '#7a7466'; g.fillRect(x0 - 4, y0, x1 - x0 + 8, yb - y0 + 4); g.fillStyle = '#0d1218'; g.fillRect(x0, y0, x1 - x0, yb - y0); }
    if (zn.kind === 'water') { late.push(zn); continue; }
    if (zn.kind === 'lava') { const lg = g.createLinearGradient(0, yt, 0, yb); lg.addColorStop(0, '#ffb300'); lg.addColorStop(0.3, '#ff4500'); lg.addColorStop(1, '#5a0d00'); g.fillStyle = lg; }
    else g.fillStyle = MEDIUM_FILL[zn.kind];
    g.fillRect(x0, yt, x1 - x0, yb - yt);
    if (zn.kind === 'sand') { g.fillStyle = '#b8955a'; for (let k = 0; k < 160; k++) g.fillRect(x0 + hash(k) * (x1 - x0), yt + hash(k + 99) * (yb - yt), 2, 2); }
    if (zn.kind === 'balls') for (let k = 0; k < 220; k++) { g.fillStyle = ['#ff4d4d', '#ffd93d', '#4d96ff', '#6bcb77', '#c77dff'][k % 5]; g.beginPath(); g.arc(x0 + hash(k) * (x1 - x0), yt + hash(k + 7) * (yb - yt), Math.max(2, 0.04 * s), 0, 7); g.fill(); }
    label2D(zn.label, (x0 + x1) / 2, Math.min(yt, y0) - 6);
  }
  for (const bk of a.blocks) {
    if (!(sl > bk.z0 && sl < bk.z1)) continue;
    const [x0, y1] = toS(bk.x0, bk.y1), [x1, y0] = toS(bk.x1, bk.y0);
    g.fillStyle = bk.color; g.fillRect(x0, y1, x1 - x0, y0 - y1);
    g.fillStyle = '#ffffff22'; g.fillRect(x0, y1, x1 - x0, 2);
    if (bk.surf === 'trampoline') { g.fillStyle = '#2e6bff'; g.fillRect(x0, y1, x1 - x0, 4); }
    if (bk.label) label2D(bk.label, (x0 + x1) / 2, y1 - 6);
  }
  const ipd = S.IP[spec.ip].depth, pool = zones.find(z => z.kind === 'water' && z.bottom < -0.5);
  if (ipd && pool && ipd <= -pool.bottom) {
    const [px0, y] = toS(pool.x0, -ipd), [px1] = toS(pool.x1, 0); g.setLineDash([5, 4]); g.strokeStyle = '#68d391'; g.beginPath(); g.moveTo(px0, y); g.lineTo(px1, y); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#68d391'; g.font = '10px ui-monospace,Consolas,monospace'; g.textAlign = 'left'; g.fillText(`IP limit ${ipd} m`, px0 + 4, y - 3);
  }
  const dp = drawnPhone(), [qx, qy] = toS(dp.x, dp.y), pw = body.hw * 2 * s * dp.k, ph = body.hh * 2 * s * dp.k;
  g.save(); g.translate(qx, qy); g.rotate(-angle2D());
  if (st.T > 45) { g.shadowColor = `rgba(255,90,30,${clamp((st.T - 45) / 25, 0, 1)})`; g.shadowBlur = 16; }
  D.worldPhone(g, spec, st, pw, ph, st.power === 'on' && st.screen < 100);
  g.restore();
  for (const zn of zones) if (zn.kind !== 'water' && Wd.lowest(body) < zn.top && body.p.x > zn.x0 - 0.3 && body.p.x < zn.x1 + 0.3) {
    const [x0, yb] = toS(zn.x0, zn.bottom), [x1, yt] = toS(zn.x1, zn.top); // the part below the surface is hidden in the medium
    g.save(); g.globalAlpha = zn.kind === 'balls' ? 0.9 : 0.96; g.fillStyle = zn.kind === 'lava' ? '#ff4500' : MEDIUM_FILL[zn.kind]; g.fillRect(x0, yt, x1 - x0, yb - yt); g.restore();
  }
  for (const zn of late) {
    const [x0, yb] = toS(zn.x0, zn.bottom), [x1, yt] = toS(zn.x1, zn.top);
    const wg = g.createLinearGradient(0, yt, 0, yb); wg.addColorStop(0, 'rgba(43,143,214,.55)'); wg.addColorStop(1, 'rgba(10,42,92,.8)');
    g.fillStyle = wg; g.fillRect(x0, yt, x1 - x0, yb - yt);
    g.strokeStyle = '#bfe3ff'; g.beginPath(); for (let x = x0; x <= x1; x += 4) g.lineTo(x, yt + Math.sin(x * 0.15 + time * 3) * 1.5); g.stroke();
    label2D(zn.label, (x0 + x1) / 2, Math.min(yt, toS(0, 0)[1]) - 6);
  }
  particles2D(g, dt);
  drawPrediction(g, (p) => toS(p.x, p.y));
  g.font = '10px ui-monospace,Consolas,monospace'; g.textAlign = 'left'; g.fillStyle = '#9aa6b4';
  for (let y = Math.ceil(Math.max(0, bot) / step) * step; y <= Math.min(top, env.height) + 1e-6; y += step) g.fillText(`${+y.toFixed(2)} m`, 4, toS(0, y)[1] - 2);
  g.restore();
  const bx = Wc - 16, by0 = 24, by1 = H - 24, total = env.height + pitDepth(), yAt = (y) => by0 + (env.height - y) / total * (by1 - by0);
  g.fillStyle = '#ffffff15'; g.fillRect(bx, by0, 6, by1 - by0); g.fillStyle = '#ffffff40'; g.fillRect(bx - 2, yAt(top), 10, Math.max(2, yAt(bot) - yAt(top)));
  g.fillStyle = '#4fd1c5'; g.beginPath(); g.arc(bx + 3, yAt(body.p.y), 4, 0, 7); g.fill();
  hud(dp.k > 1.05 ? `device drawn ×${dp.k.toFixed(1)}` : null, Wc - 28);
}
function label2D(text, x, y) { if (!text) return; wx.fillStyle = '#ffffffb0'; wx.font = '11px system-ui'; wx.textAlign = 'center'; wx.fillText(text, x, y); }
function particles2D(g, dt) {
  stepParticles(dt);
  for (const p of worldFx) {
    const [x, y] = toS(p.x, p.y), a = clamp(p.life, 0, 1);
    drawParticle(g, p, x, y, a, 1);
  }
  for (const f of floaters) { const [x, y] = toS(f.x, f.y); g.globalAlpha = clamp(f.life, 0, 1); g.fillStyle = f.color; g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.fillText(f.text, x, y); g.globalAlpha = 1; }
}
function stepParticles(dt) {
  const grav = W.g;
  for (const p of worldFx) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += (p.vz || 0) * dt;
    if (p.t !== 'bubble' && p.t !== 'smoke' && p.t !== 'fire') p.vy -= grav * dt;
    if (p.t === 'bubble' && p.y > p.top) p.life = 0;
  }
  for (let i = worldFx.length - 1; i >= 0; i--) if (worldFx[i].life <= 0) worldFx.splice(i, 1);
  for (const f of floaters) { f.life -= dt; f.y += 0.25 * dt; }
  for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].life <= 0) floaters.splice(i, 1);
}
function drawParticle(g, p, x, y, a, k) {
  switch (p.t) {
    case 'splash': g.fillStyle = `rgba(170,215,255,${a})`; g.fillRect(x, y, 3, 3); break;
    case 'sand': g.fillStyle = `rgba(216,184,120,${a})`; g.fillRect(x, y, 3, 3); break;
    case 'ball': g.fillStyle = ['#ff4d4d', '#ffd93d', '#4d96ff', '#6bcb77'][Math.floor(hash(p.vx) * 4)]; g.beginPath(); g.arc(x, y, Math.max(2, 4 * k), 0, 7); g.fill(); break;
    case 'dust': g.fillStyle = `rgba(190,180,160,${a * 0.6})`; g.beginPath(); g.arc(x, y, (3 + (1 - a) * 6) * k, 0, 7); g.fill(); break;
    case 'shard': g.fillStyle = `rgba(220,240,255,${a})`; g.fillRect(x, y, 2, 2); break;
    case 'bubble': g.strokeStyle = `rgba(200,235,255,${a})`; g.beginPath(); g.arc(x, y, 2, 0, 7); g.stroke(); break;
    case 'smoke': g.fillStyle = `rgba(110,110,115,${a * 0.5})`; g.beginPath(); g.arc(x, y, (4 + (1 - a) * 14) * k, 0, 7); g.fill(); break;
    case 'fire': g.fillStyle = `rgba(255,${120 + a * 120 | 0},40,${a})`; g.beginPath(); g.arc(x, y, (2 + a * 4) * k, 0, 7); g.fill(); break;
  }
}
function hud(extra, right) {
  const zn = Wd.zoneAt(W, body.p.x, body.p.z), depth = zn && zn.kind === 'water' ? zn.top - body.p.y : 0;
  const lines = [`height ${Math.max(0, Wd.lowest(body) - floorUnder()).toFixed(2)} m`, `speed ${Wd.len(body.v).toFixed(1)} m/s`];
  if (depth > 0) lines.push(`depth ${depth.toFixed(2)} m`, `submerged ${fmtDur(st.submergedSec)} (sim)`);
  if (body.buried > 0) lines.push(`buried ${Math.round(body.buried * 100)}%`);
  if (W.g !== 9.81) lines.push(`gravity ${W.g} m/s²`);
  if (extra) lines.push(extra);
  wx.font = '12px ui-monospace,Consolas,monospace'; wx.textAlign = 'right'; wx.fillStyle = '#e6ebf1';
  lines.forEach((t, i) => { wx.fillStyle = '#0008'; wx.fillText(t, right + 1, 19 + i * 15); wx.fillStyle = '#e6ebf1'; wx.fillText(t, right, 18 + i * 15); });
}

/* ---------------- 3D view ---------------- */
const texWorld = { front: document.createElement('canvas'), back: document.createElement('canvas') };
let texTick = 0;
function renderTex(canvas, view, w, h, scale = 1) {
  const cw = Math.max(2, Math.round(w * scale)), ch = Math.max(2, Math.round(h * scale));
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  const g = canvas.getContext('2d'); g.setTransform(scale, 0, 0, scale, 0, 0); g.clearRect(0, 0, w, h);
  D.drawPhone(g, spec, st, D.geometry(spec, { x: 0, y: 0, w, h }), view, { apps, tele, time, toast, bench: bench?.screen });
}
function update3DCam(dt) {
  if (!cam3.follow || body.drag) return;
  const k = cam3.init ? 1 - Math.exp(-dt * 6) : 1;
  cam3.target = Wd.add(cam3.target, Wd.mul(Wd.sub(body.p, cam3.target), k)); cam3.init = true;
}
function quad(c, x0, z0, x1, z1, y) { return [v3(x0, y, z0), v3(x1, y, z0), v3(x1, y, z1), v3(x0, y, z1)]; }
function drawWorld3D(dt) {
  const g = wx, c = camera3(), a = W.a, sky = SKY[env.arena] || SKY.lab, surf = S.SURFACES[env.surface] || S.SURFACES.concrete;
  g.save();
  if (shake > 0.2) { g.translate(rand(-shake, shake), rand(-shake, shake)); shake *= Math.exp(-10 * dt); }
  const sg = g.createLinearGradient(0, 0, 0, cssH); sg.addColorStop(0, sky[0]); sg.addColorStop(1, sky[1]); g.fillStyle = sg; g.fillRect(-20, -20, cssW + 40, cssH + 40);
  if (a.space || env.arena === 'moon') { g.fillStyle = '#fff'; for (let k = 0; k < 120; k++) g.fillRect(hash(k) * cssW, hash(k + 3) * cssH * 0.6, 1.2, 1.2); }
  R3.poly(g, c, quad(c, -80, -80, a.W + 80, a.D + 80, -0.001), R3.shadeHex(surf.color, 0.55));
  R3.poly(g, c, quad(c, 0, 0, a.W, a.D, 0), surf.color);
  const near = Wd.len(Wd.sub(c.eye, cam3.target)) < 60;
  if (near) for (let x = 1; x < a.W; x++) R3.line(g, c, v3(x, 0.001, 0), v3(x, 0.001, a.D), 'rgba(255,255,255,.07)');
  if (near) for (let z = 1; z < a.D; z++) R3.line(g, c, v3(0, 0.001, z), v3(a.W, 0.001, z), 'rgba(255,255,255,.07)');
  for (const [p0, p1] of [[v3(0, 0, 0), v3(a.W, 0, 0)], [v3(a.W, 0, 0), v3(a.W, 0, a.D)], [v3(a.W, 0, a.D), v3(0, 0, a.D)], [v3(0, 0, a.D), v3(0, 0, 0)]]) R3.line(g, c, p0, p1, 'rgba(255,255,255,.35)', 2);
  const inZone = Wd.zoneAt(W, body.p.x, body.p.z), submergedIn = inZone && body.p.y < inZone.top ? inZone : null;
  const objs = [];
  for (const zn of a.zones) {
    if (zn.bottom < 0) drawPit(g, c, zn);
    if (zn.kind === 'water' && zn !== submergedIn) { if (zn.bottom < 0) waterTop(g, c, zn); else objs.push({ d: dist3(c, zoneCenter(zn)), draw: () => { raisedFloor(g, c, zn); waterTop(g, c, zn); } }); }
    if (zn.kind === 'water' && zn === submergedIn && zn.bottom >= 0) objs.push({ d: dist3(c, body.p) + 1e3, draw: () => raisedFloor(g, c, zn) });
  }
  shadow3D(g, c);
  for (const bk of a.blocks) { const ctr = v3((bk.x0 + bk.x1) / 2, (bk.y0 + bk.y1) / 2, (bk.z0 + bk.z1) / 2); objs.push({ d: dist3(c, ctr), draw: () => R3.drawBox(g, c, ctr, Q.id(), v3((bk.x1 - bk.x0) / 2, (bk.y1 - bk.y0) / 2, (bk.z1 - bk.z0) / 2), { color: bk.color, edges: true }) }); }
  objs.push({ d: dist3(c, body.p), draw: () => phone3D(g, c) });
  if (submergedIn) objs.push({ d: dist3(c, body.p) - 1e-3, draw: () => waterTop(g, c, submergedIn) });
  objs.sort((p, q) => q.d - p.d).forEach(o => o.draw());
  // labels, height pole
  for (const l of [...a.zones.map(z => [z.label, zoneCenter(z), Math.max(z.top, 0) + 0.15]), ...a.blocks.filter(b => b.label).map(b => [b.label, v3((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2), b.y1 + 0.15])]) {
    const s = R3.project(c, v3(l[1].x, l[2], l[1].z)); if (s) { g.fillStyle = '#ffffffc0'; g.font = '11px system-ui'; g.textAlign = 'center'; g.fillText(l[0], s[0], s[1]); }
  }
  const pole = v3(0.15, 0, 0.15), stepH = env.height > 60 ? 10 : env.height > 15 ? 5 : 1;
  R3.line(g, c, pole, v3(pole.x, env.height, pole.z), 'rgba(255,255,255,.5)', 2);
  for (let y = stepH; y <= env.height; y += stepH) { const s = R3.project(c, v3(pole.x, y, pole.z)); if (s) { g.fillStyle = '#9aa6b4'; g.font = '10px monospace'; g.textAlign = 'left'; g.fillText(`${y} m`, s[0] + 4, s[1] + 3); } }
  stepParticles(dt);
  for (const p of worldFx) { const q = R3.project(c, p); if (q) drawParticle(g, p, q[0], q[1], clamp(p.life, 0, 1), clamp(3 / dist3(c, p), 0.3, 3)); }
  for (const f of floaters) { const q = R3.project(c, f); if (q) { g.globalAlpha = clamp(f.life, 0, 1); g.fillStyle = f.color; g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.fillText(f.text, q[0], q[1]); g.globalAlpha = 1; } }
  drawPrediction(g, (p) => R3.project(c, p));
  g.restore();
  hud(body.drag ? (shiftHeld ? 'Shift: moving along the ground' : 'hold Shift to move along the ground · scroll to rotate') : 'drag the device to throw · drag empty space to orbit · scroll to zoom', cssW - 12);
}
const dist3 = (c, p) => Wd.len(Wd.sub(p, c.eye));
const zoneCenter = (zn) => v3((zn.x0 + zn.x1) / 2, (zn.bottom + zn.top) / 2, (zn.z0 + zn.z1) / 2);
function drawPit(g, c, zn) {
  const floorCol = (S.SURFACES[zn.floor] || S.SURFACES.concrete).color;
  const hole = R3.clipPoly(c, quad(c, zn.x0, zn.z0, zn.x1, zn.z1, 0));
  if (!hole) return;
  g.save(); R3.path(g, hole); g.clip(); // the inside of a pit is only visible through its opening
  R3.poly(g, c, quad(c, zn.x0, zn.z0, zn.x1, zn.z1, zn.bottom), R3.shadeHex(floorCol, 0.6));
  const walls = [[v3(zn.x0, 0, zn.z0), v3(zn.x1, 0, zn.z0), v3(0, 0, 1)], [v3(zn.x1, 0, zn.z1), v3(zn.x0, 0, zn.z1), v3(0, 0, -1)],
    [v3(zn.x0, 0, zn.z1), v3(zn.x0, 0, zn.z0), v3(1, 0, 0)], [v3(zn.x1, 0, zn.z0), v3(zn.x1, 0, zn.z1), v3(-1, 0, 0)]];
  for (const [p0, p1, n] of walls) {
    const mid = v3((p0.x + p1.x) / 2, zn.bottom / 2, (p0.z + p1.z) / 2);
    if (Wd.dot(n, Wd.sub(c.eye, mid)) <= 0) continue;
    R3.poly(g, c, [p0, p1, v3(p1.x, zn.bottom, p1.z), v3(p0.x, zn.bottom, p0.z)], R3.shadeHex(floorCol, 0.75 + 0.15 * n.x), 'rgba(0,0,0,.25)');
  }
  if (zn.kind === 'sand' || zn.kind === 'lava' || zn.kind === 'balls') {
    const col = zn.kind === 'sand' ? (env.arena === 'mars' ? '#c0623a' : env.arena === 'moon' ? '#9a968e' : '#d8b878') : zn.kind === 'lava' ? '#ff5a00' : '#3a3a55';
    R3.poly(g, c, quad(c, zn.x0, zn.z0, zn.x1, zn.z1, zn.top), col);
    const n = zn.kind === 'balls' ? 300 : zn.kind === 'lava' ? 60 : 160;
    for (let k = 0; k < n; k++) {
      const s = R3.project(c, v3(zn.x0 + hash(k) * (zn.x1 - zn.x0), zn.top + 0.002, zn.z0 + hash(k + 50) * (zn.z1 - zn.z0))); if (!s) continue;
      if (zn.kind === 'balls') { g.fillStyle = ['#ff4d4d', '#ffd93d', '#4d96ff', '#6bcb77', '#c77dff'][k % 5]; g.beginPath(); g.arc(s[0], s[1], 3, 0, 7); g.fill(); }
      else if (zn.kind === 'lava') { g.fillStyle = `rgba(255,${200 + 55 * Math.sin(time * 2 + k) | 0},0,${0.5 + 0.5 * Math.sin(time * 3 + k)})`; g.beginPath(); g.arc(s[0], s[1], 4, 0, 7); g.fill(); }
      else { g.fillStyle = '#00000022'; g.fillRect(s[0], s[1], 2, 2); }
    }
  }
  g.restore();
}
function raisedFloor(g, c, zn) { R3.poly(g, c, quad(c, zn.x0, zn.z0, zn.x1, zn.z1, zn.bottom), '#dfe4ea'); }
function waterTop(g, c, zn) { R3.poly(g, c, quad(c, zn.x0, zn.z0, zn.x1, zn.z1, zn.top), 'rgba(43,143,214,.5)', 'rgba(191,227,255,.6)'); }
function shadow3D(g, c) {
  const fl = floorUnder(), hgt = Wd.lowest(body) - fl, pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const p = Wd.add(body.p, Q.rot(body.q, v3(sx * body.hw, sy * body.hh, sz * body.ht))); pts.push([p.x, p.z]); }
  const hl = R3.hull(pts).map(([x, z]) => v3(x, fl + 0.003, z));
  R3.poly(g, c, hl, `rgba(0,0,0,${clamp(0.45 - hgt * 0.08, 0.08, 0.45)})`);
}
function phone3D(g, c) {
  const fr = (S.FRAMES[spec.frame] || S.FRAMES.aluminum).color;
  if (texTick++ % 2 === 0) { const tw = 90, th = tw * spec.size.h / spec.size.w; renderTex(texWorld.front, 'front', tw, Math.min(th, 260), 1.5); renderTex(texWorld.back, 'back', tw, Math.min(th, 260), 1.5); }
  const zn = Wd.zoneAt(W, body.p.x, body.p.z), sunk = zn && zn.kind !== 'water' && Wd.lowest(body) < zn.top;
  if (sunk) { // churned-up crater around the part that went in
    const pts = []; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const p = Wd.add(body.p, Q.rot(body.q, v3(sx * body.hw * 1.3, sy * body.hh * 1.3, sz * body.ht * 1.3))); pts.push([p.x, p.z]); }
    R3.poly(g, c, R3.hull(pts).map(([x, z]) => v3(x, zn.top + 0.001, z)), zn.kind === 'lava' ? 'rgba(255,220,80,.55)' : zn.kind === 'balls' ? 'rgba(0,0,0,.25)' : 'rgba(120,90,40,.45)');
  }
  R3.drawBox(g, c, body.p, body.q, v3(body.hw, body.hh, body.ht), { tex: texWorld, color: fr, texBg: fr, details: true, clipY: sunk ? zn.top : undefined });
  const s = R3.project(c, body.p), r = s && Math.max(body.hw, body.hh) * c.F / dist3(c, body.p);
  if (s && r < 6) { g.strokeStyle = '#4fd1c5'; g.lineWidth = 2; g.beginPath(); g.arc(s[0], s[1], 10, 0, 7); g.stroke(); }
}

/* ---------------- close-up (torture view) ---------------- */
const cc = $('closeup'), cg = cc.getContext('2d'), CW = 300, CH = 600, BOX = { x: 25, y: 45, w: 250, h: 520 };
let GEO = D.geometry(spec, BOX);
const texClose = { front: document.createElement('canvas'), back: document.createElement('canvas') };
(() => { const dpr = devicePixelRatio || 1; cc.width = CW * dpr; cc.height = CH * dpr; })();
function closeHalf() { const { w, h, t } = spec.size, s = Math.min(115 / (w / 2), 235 / (h / 2), 60 / (t / 2)); return v3(w / 2 * s, h / 2 * s, Math.max(2.5, t / 2 * s)); }
const closeCam = () => R3.camera(v3(0, 0, 1400), v3(0, 0, 0), 2 * Math.atan(CH / 2 / 1300), CW, CH);
function drawCloseup(dt) {
  const dpr = devicePixelRatio || 1;
  cg.setTransform(dpr, 0, 0, dpr, 0, 0); cg.clearRect(0, 0, CW, CH);
  if (cshake > 0.3) { cg.translate(rand(-cshake, cshake), rand(-cshake, cshake)); cshake *= Math.exp(-12 * dt); }
  if (!env.mode3d) {
    D.drawPhone(cg, spec, st, GEO, view, { apps, tele, time, toast, bench: bench?.screen });
    D.effects(cg, st, GEO, dt);
    return;
  }
  const half = closeHalf(), c = closeCam();
  renderTex(texClose.front, 'front', half.x * 2, half.y * 2, dpr); renderTex(texClose.back, 'back', half.x * 2, half.y * 2, dpr);
  const fr = (S.FRAMES[spec.frame] || S.FRAMES.aluminum).color;
  R3.drawBox(cg, c, v3(), closeQ, half, { tex: texClose, color: fr, texBg: fr, details: true, edges: true });
  D.effects(cg, st, { x: CW / 2 - half.x, y: CH / 2 - half.y, w: half.x * 2, h: half.y * 2 }, dt);
}
const uvAt = (x, y) => { const F = GEO.face; return { u: (x - F.x) / F.w, v: (y - F.y) / F.h, side: view }; };
const onPhone = ({ u, v }) => u >= 0 && u <= 1 && v >= 0 && v <= 1;
function pickClose(x, y) { // → weapon params { side, u, v, edge } or null
  if (!env.mode3d) { const uv = uvAt(x, y); return onPhone(uv) ? uv : null; }
  const half = closeHalf(), h = R3.pickBox(closeCam(), v3(), closeQ, half, x, y);
  if (!h) return null;
  const uf = clamp((h.local.x / half.x + 1) / 2, 0, 1), v = clamp((1 - h.local.y / half.y) / 2, 0, 1);
  if (h.face === 'front') return { side: 'front', u: uf, v };
  if (h.face === 'back') return { side: 'back', u: 1 - uf, v };
  return { side: 'front', u: uf, v, edge: true, face: h.face };
}
let rot = null;
cc.addEventListener('contextmenu', (e) => e.preventDefault());
cc.addEventListener('pointerdown', (e) => {
  const [x, y] = localPt(e, cc), hit = e.button === 0 ? pickClose(x, y) : null;
  cc.setPointerCapture(e.pointerId);
  if (tool && hit) {
    if (S.WEAPONS[tool].mode === 'hold') holding = { ...hit, x, y };
    else firePoint(tool, hit, x, y);
  } else if (env.mode3d) rot = { x, y };
});
cc.addEventListener('pointermove', (e) => {
  const [x, y] = localPt(e, cc);
  if (rot) { closeQ = Q.norm(Q.mul(Q.mul(Q.axis(v3(0, 1, 0), (x - rot.x) * 0.012), Q.axis(v3(1, 0, 0), (y - rot.y) * 0.012)), closeQ)); rot = { x, y }; }
  else if (holding) { const h = pickClose(x, y); if (h) Object.assign(holding, h, { x, y }); }
});
const stopClose = () => { holding = null; rot = null; };
cc.addEventListener('pointerup', stopClose); cc.addEventListener('pointercancel', stopClose);
const CLOSE_VIEWS = { front: Q.id(), back: Q.axis(v3(0, 1, 0), Math.PI), side: Q.axis(v3(0, 1, 0), -Math.PI / 2), top: Q.axis(v3(1, 0, 0), Math.PI / 2),
  bottom: Q.axis(v3(1, 0, 0), -Math.PI / 2), corner: Q.mul(Q.axis(v3(1, 0, 0), 0.45), Q.axis(v3(0, 1, 0), -0.7)) };
document.querySelectorAll('[data-cv]').forEach(b => b.onclick = () => { closeQ = CLOSE_VIEWS[b.dataset.cv]; });

/* ---------------- weapons ---------------- */
function burst(t, x, y, n, opts = {}) { for (let i = 0; i < n; i++) D.emit({ t, x, y, vx: rand(-150, 150), vy: rand(-200, 50), life: rand(0.3, 0.7), ...opts }); }
function firePoint(key, hit, x, y) {
  if (hit.edge) log('info', `${S.WEAPONS[key].name} → ${hit.face} edge`);
  handle(S.weapon(spec, st, key, { ...hit, level: +$('mohs').value }));
  const icon = S.WEAPONS[key].icon;
  if (key === 'pistol') { D.emit({ t: 'flash', x, y, size: 25, life: 0.15 }); burst('debris', x, y, 20); cshake = 10; }
  else if (key === 'shotgun') { for (let i = 0; i < 9; i++) D.emit({ t: 'flash', x: x + rand(-35, 35), y: y + rand(-35, 35), size: 8, life: 0.15 }); burst('debris', x, y, 30); cshake = 12; }
  else if (key === 'hammer' || key === 'bowling') { D.emit({ t: 'emoji', text: icon, x, y: y - 10, size: key === 'bowling' ? 80 : 44, life: 0.6 }); burst('debris', x, y, 14); cshake = key === 'bowling' ? 14 : 7; }
  else if (key === 'taser') { D.emit({ t: 'emoji', text: icon, x, y, size: 36, life: 0.4 }); for (let i = 0; i < 8; i++) D.emit({ t: 'arc', x: x + rand(-20, 20), y: y + rand(-20, 20), life: 0.15 }); }
  else D.emit({ t: 'emoji', text: icon, x, y, size: 28, life: 0.5 });
}
function fireInstant(key) {
  handle(S.weapon(spec, st, key, { side: view }));
  const cx = CW / 2, cy = CH / 2, icon = S.WEAPONS[key].icon;
  D.emit({ t: 'emoji', text: icon, x: cx, y: cy, size: 110, life: 1.2, vx: 0, vy: key === 'press' ? 60 : 0 });
  if (key === 'car') { D.emit({ t: 'emoji', text: icon, x: -60, y: cy, size: 130, vx: 420, life: 1.4 }); cshake = 16; }
  if (key === 'press' || key === 'blender') cshake = 18;
  if (key === 'blender') for (let i = 0; i < 60; i++) D.emit({ t: 'smoke', x: cx + rand(-60, 60), y: cy + rand(-120, 120), vx: rand(-30, 30), vy: rand(-60, -10), life: rand(1, 2.5) });
  if (key === 'lightning') { D.emit({ t: 'screen', color: '255,255,255', life: 0.4 }); cshake = 20; }
  if (key === 'ln2') for (let i = 0; i < 40; i++) D.emit({ t: 'fog', x: rand(20, CW - 20), y: rand(40, CH - 40), vx: rand(-20, 20), vy: rand(-10, 30), life: rand(1, 2.5) });
  if (key === 'bend') cshake = 6;
}
function applyHold(simDt) {
  const key = tool, { x, y } = holding;
  handle(S.weapon(spec, st, key, { ...holding, dt: simDt }));
  if (key === 'lighter') D.emit({ t: 'flame', x: x + rand(-3, 3), y: y + rand(-3, 3), vx: rand(-5, 5), vy: rand(-60, -30), life: 0.35, size: 3 });
  if (key === 'torch') for (let i = 0; i < 3; i++) D.emit({ t: 'flame', blue: Math.random() < 0.6, x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-30, 30), vy: rand(-90, -40), life: 0.35, size: 6 });
  if (key === 'washer') for (let i = 0; i < 4; i++) D.emit({ t: 'water', x, y, vx: rand(-160, 160), vy: rand(-160, 40), life: 0.5 });
}
function toolHint() {
  const Wp = tool && S.WEAPONS[tool];
  $('toolHint').textContent = Wp ? `${Wp.icon} ${Wp.name}: ${Wp.mode === 'hold' ? 'press and hold' : 'click'} on the close-up${env.mode3d ? ' (any face, edge or corner — drag off the device to rotate)' : ` (${view} side)`}`
    : env.mode3d ? 'Drag the close-up to rotate the device, then pick a tool and hit any face, edge or corner.' : 'Pick a tool, then click the close-up device. Instant ones fire immediately.';
}
function buildWeapons() {
  const box = $('weapons');
  for (const [key, Wp] of Object.entries(S.WEAPONS)) {
    const b = el('button', { title: Wp.name }, `${Wp.icon} ${Wp.name}`);
    b.onclick = () => {
      if (Wp.mode === 'instant') return fireInstant(key);
      tool = tool === key ? null : key;
      document.querySelectorAll('#weapons button').forEach(x => x.classList.toggle('sel', x === b && !!tool));
      cc.style.cursor = tool ? 'crosshair' : env.mode3d ? 'grab' : 'pointer';
      toolHint();
    };
    box.append(b);
  }
}

/* ---------------- arena controls ---------------- */
for (const [k, s] of Object.entries(S.SURFACES)) $('surface').add(new Option(`${s.name} (${Math.round(s.factor * 100)}% hit)`, k));
for (const [k, a] of Object.entries(Wd.ARENAS)) $('arena').add(new Option(a.name, k));
$('arena').onchange = (e) => setArena(e.target.value);
$('mode3d').onchange = (e) => {
  env.mode3d = e.target.checked; buildWorld(false);
  $('closeViews').style.display = env.mode3d ? 'flex' : 'none';
  cc.style.cursor = tool ? 'crosshair' : env.mode3d ? 'grab' : 'pointer'; toolHint();
  log('info', env.mode3d ? '3D mode: real tumbling — the face, edge or corner that lands is decided by physics' : '2D mode: side view (flat landings pick screen/back at random)');
};
$('surface').onchange = (e) => { env.surface = e.target.value; W.surface = env.surface; body.asleep = false; };
$('height').onchange = (e) => { env.height = +e.target.value; W.height = env.height; $('dropH').max = env.height; body.asleep = false; };
$('pool').oninput = (e) => { env.pool = +e.target.value; $('poolVal').textContent = env.pool + ' m'; buildWorld(false); };
$('dropGo').onclick = () => dropAt(dropTargets()[+$('dropTarget').value || 0], clamp(+$('dropH').value || 1, 0.05, env.height));
$('arm').oninput = (e) => { $('armVal').textContent = (+e.target.value).toFixed(1) + '×'; };
function liftForThrow() { body.asleep = false; const lift = floorUnder() + Math.max(body.hw, body.hh) * 1.5 - Wd.lowest(body); if (lift > 0) body.p.y += lift; }
$('throwGo').onclick = () => { // throw away from the camera (3D) or across the arena (2D), 30° up
  liftForThrow();
  const P = clamp(+$('throwV').value || 8, 0.5, 60), c = env.mode3d ? camera3() : null;
  const dir = c ? Wd.norm(v3(c.f.x, 0, c.f.z)) : v3(body.p.x < W.a.W / 2 ? 1 : -1, 0, 0);
  throwBody(Wd.add(Wd.mul(dir, P * Math.cos(0.52)), v3(0, P * Math.sin(0.52), 0)));
};
$('yeet').onclick = () => { liftForThrow(); throwBody(v3((body.p.x < W.a.W / 2 ? 1 : -1) * rand(10, 25), rand(8, 20), W.planar ? 0 : rand(-6, 6))); };
$('fit').onclick = () => { if (env.mode3d) { cam3.follow = false; cam3.target = v3(W.a.W / 2, Math.min(env.height, 20) / 4, W.a.D / 2); cam3.dist = Math.max(W.a.W, Math.min(env.height, 60)) * 1.15; cam3.pitch = 0.55; } else cam.zoom = fitScale(); };
$('follow').onclick = () => { if (env.mode3d) { cam3.dist = 3.2; cam3.follow = true; cam3.init = false; } else cam.zoom = null; };
$('flip').onclick = () => {
  if (env.mode3d) { closeQ = Q.mul(Q.axis(v3(0, 1, 0), Math.PI), closeQ); return; }
  view = view === 'front' ? 'back' : 'front'; $('flip').textContent = view === 'front' ? '↻ Show back' : '↻ Show front';
};

/* ---------------- main loop ---------------- */
let last = performance.now(), lastUi = 0, lastHist = 0, appsSig = '';
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  const simDt = dt * env.speed;
  for (const e of Wd.step(W, body, dt)) e.type === 'impact' ? applyImpact(e) : onEnter(e);
  mediaTick(dt, simDt);
  if (holding && tool) applyHold(simDt);
  handle(S.weaponTick(spec, st, dt));
  tele = S.perfStep(spec, st, apps, env, simDt, dt);
  handle(tele.events);
  benchTick(simDt, dt);
  if (st.smoke > 0 && Math.random() < st.smoke * dt * 20) worldFx.push({ t: 'smoke', x: body.p.x, y: body.p.y + body.ht, z: body.p.z, vx: rand(-.1, .1), vy: rand(.3, .7), vz: rand(-.1, .1), life: 2.5 });
  if (st.fire && st.fireT < 120 && Math.random() < dt * 40) worldFx.push({ t: 'fire', x: body.p.x + rand(-1, 1) * body.hw, y: body.p.y, z: body.p.z + rand(-1, 1) * body.hw, vx: 0, vy: rand(.2, .6), vz: 0, life: .6 });
  if (env.mode3d) { update3DCam(dt); drawWorld3D(dt); } else { updateCamera(dt); drawWorld2D(dt); }
  drawCloseup(dt);
  const sig = apps.map(a => a.key + a.count).join();
  if (sig !== appsSig) { appsSig = sig; renderApps(); }
  if (now - lastHist > 250) { lastHist = now; history.push({ T: st.T, Ts: st.Tsoc, f: st.power === 'on' ? tele.fps : 0 }); if (history.length > 150) history.shift(); }
  if (now - lastUi > 150) { lastUi = now; updateUI(); }
  requestAnimationFrame(frame);
}

buildForm(); buildApps(); buildWeapons(); $('preset').value = 0;
W = Wd.makeWorld(env.arena, { pool: env.pool, height: env.height, surface: env.surface, planar: !env.mode3d });
new ResizeObserver(resizeWorld).observe(wc);
resizeWorld(); refreshSpec(); buildWorld(); renderApps(); toolHint();
$('mode3d').checked = env.mode3d; $('closeViews').style.display = env.mode3d ? 'flex' : 'none'; cc.style.cursor = env.mode3d ? 'grab' : 'pointer';
log('ok', `Welcome to PhoneLab. Loaded ${spec.name}. Drag it, throw it, flush it, shoot it, or launch 100 DOOMs.`);
requestAnimationFrame(frame);
