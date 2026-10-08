/* PhoneLab simulation model — pure functions, no DOM. Used by the UI, checked by test.js.
   Numbers are plausible approximations tuned for believability, not lab data. */
(function (root) {
'use strict';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// cpu/gpu = relative work units per second; tdp = sustained package power (W)
const SOCS = {
  a18pro:   { name: 'Apple A18 Pro (2024)',       cpu: 8500, gpu: 100,  tdp: 8.5 },
  sd8elite: { name: 'Snapdragon 8 Elite (2024)',  cpu: 9500, gpu: 110,  tdp: 9.5 },
  d9400:    { name: 'Dimensity 9400 (2024)',      cpu: 8700, gpu: 105,  tdp: 9 },
  sd8g3:    { name: 'Snapdragon 8 Gen 3 (2023)',  cpu: 7000, gpu: 90,   tdp: 9 },
  exy2400:  { name: 'Exynos 2400 (2024)',         cpu: 6800, gpu: 80,   tdp: 9 },
  tensorg4: { name: 'Google Tensor G4 (2024)',    cpu: 4300, gpu: 55,   tdp: 7 },
  sd7sg2:   { name: 'Snapdragon 7s Gen 2 (2023)', cpu: 2900, gpu: 22,   tdp: 5.5 },
  a13:      { name: 'Apple A13 Bionic (2019)',    cpu: 3400, gpu: 40,   tdp: 6 },
  heliog85: { name: 'MediaTek Helio G85 (2020)',  cpu: 1350, gpu: 8,    tdp: 4.5 },
  sd801:    { name: 'Snapdragon 801 (2014)',      cpu: 900,  gpu: 5,    tdp: 4 },
  mcu:      { name: 'Feature-phone MCU (2000)',   cpu: 15,   gpu: 0.05, tdp: 0.3 },
  m4:       { name: 'Apple M4 (2024, tablet)',    cpu: 14000, gpu: 140, tdp: 15 },
  tegrax1:  { name: 'Nvidia Tegra X1 (Switch)',   cpu: 1600, gpu: 25,   tdp: 7 },
  s9:       { name: 'Apple S9 SiP (watch)',       cpu: 900,  gpu: 5,    tdp: 1.2 },
  lr35902:  { name: 'Sharp LR35902 (Game Boy)',   cpu: 1,    gpu: 0.01, tdp: 0.7 },
};

// tough = impact energy (J) with ~50% crack odds on a flat hit; hard = Mohs scratch level
const GLASS = {
  ceramic:  { name: 'Ceramic Shield (2nd gen)', tough: 2.7, hard: 6,   shatter: true },
  armor:    { name: 'Gorilla Armor 2',          tough: 2.6, hard: 6.5, shatter: true },
  victus2:  { name: 'Gorilla Glass Victus 2',   tough: 2.2, hard: 6,   shatter: true },
  victus:   { name: 'Gorilla Glass Victus',     tough: 1.9, hard: 6,   shatter: true },
  gg5:      { name: 'Gorilla Glass 5',          tough: 1.5, hard: 6,   shatter: true },
  gg3:      { name: 'Gorilla Glass 3',          tough: 1.1, hard: 6,   shatter: true },
  sapphire: { name: 'Sapphire crystal',         tough: 1.3, hard: 8.5, shatter: true },
  plastic:  { name: 'Plastic / polycarbonate',  tough: 99,  hard: 3,   shatter: false },
  aluminum: { name: 'Aluminium unibody',        tough: 99,  hard: 3,   shatter: false },
};

const FRAMES = { // hard = Mohs scratch hardness of the frame
  titanium: { name: 'Grade 5 titanium',        dent: 4.0, hard: 6,   color: '#8d8983' },
  steel:    { name: 'Stainless steel',         dent: 4.5, hard: 5.5, color: '#d0d3d8' },
  aluminum: { name: 'Aluminium 7000',          dent: 2.2, hard: 3,   color: '#a3abb5' },
  plastic:  { name: 'Plastic',                 dent: 3.0, hard: 2.5, color: '#2b2e33' },
  rugged:   { name: 'Rubberised rugged shell', dent: 14,  hard: 2,   color: '#2f2f2f' },
  nokia:    { name: 'Nokia polycarbonate',     dent: 60,  hard: 3,   color: '#1f4078' },
  gameboy:  { name: 'Game Boy ABS (Gulf War survivor)', dent: 50, hard: 2.5, color: '#bdbab3' },
};

const CASES = { // absorb = fraction of impact energy that reaches the phone
  none:     { name: 'No case',                 absorb: 1 },
  slim:     { name: 'Slim case',               absorb: 0.8 },
  silicone: { name: 'Silicone case',           absorb: 0.6 },
  rugged:   { name: 'Rugged (OtterBox-style)', absorb: 0.3 },
};

// factor = share of impact energy the surface passes on; bounce = restitution; mu = friction
const SURFACES = {
  concrete:   { name: 'Concrete',       factor: 1,    color: '#5a5d63' },
  tile:       { name: 'Ceramic tile',   factor: 0.95, color: '#b9b3a6' },
  porcelain:  { name: 'Porcelain',      factor: 1.05, color: '#eef0f2' },
  stone:      { name: 'Granite',        factor: 1.1,  color: '#8f8a82' },
  basalt:     { name: 'Basalt rock',    factor: 1.05, color: '#2e2826' },
  wood:       { name: 'Hardwood',       factor: 0.7,  color: '#7a5233' },
  ice:        { name: 'Ice',            factor: 0.9,  color: '#cfe8f5', mu: 0.03 },
  grass:      { name: 'Grass',          factor: 0.35, color: '#3f7a35' },
  regolith:   { name: 'Lunar regolith', factor: 0.45, color: '#8d8a83' },
  marsdust:   { name: 'Martian dust',   factor: 0.5,  color: '#b5562f' },
  carpet:     { name: 'Carpet',         factor: 0.3,  color: '#6b2f3a' },
  rubber:     { name: 'Rubber mat',     factor: 0.25, color: '#3a3a40', bounce: 0.45 },
  mattress:   { name: 'Mattress',       factor: 0.08, color: '#d7dbe8' },
  trampoline: { name: 'Trampoline',     factor: 0.05, color: '#1d1d22', bounce: 0.85 },
};
const SAND_FACTOR = 0.2;

// h = heat shed to air (W/K) for a 77×163 mm phone, rjc = SoC-to-skin resistance (K/W)
const COOLING = {
  none:     { name: 'None',                h: 0.32, rjc: 5 },
  graphite: { name: 'Graphite sheets',     h: 0.40, rjc: 4 },
  vapor:    { name: 'Vapor chamber',       h: 0.50, rjc: 3 },
  fan:      { name: 'Active fan (gaming)', h: 0.95, rjc: 2 },
};

// dust = first IP digit (6 = dust-tight); jets: 0 none, 1 splashes, 2 water jets, 3 hot high-pressure (IPx9K)
const IP = {
  'IP68-6m': { name: 'IP68 — 6 m / 30 min',      dust: 6, depth: 6,   mins: 30, jets: 1 },
  'IP68-2m': { name: 'IP68 — 2 m / 30 min',      dust: 6, depth: 2,   mins: 30, jets: 1 },
  IP68:      { name: 'IP68 — 1.5 m / 30 min',    dust: 6, depth: 1.5, mins: 30, jets: 1 },
  IP69:      { name: 'IP68 + IP69K — hot jets',  dust: 6, depth: 1.5, mins: 30, jets: 3 },
  IP67:      { name: 'IP67 — 1 m / 30 min',      dust: 6, depth: 1,   mins: 30, jets: 1 },
  IP65:      { name: 'IP65 — dust-tight, jets',  dust: 6, depth: 0,   mins: 0,  jets: 2 },
  IP54:      { name: 'IP54 — dust & splashes',   dust: 5, depth: 0,   mins: 0,  jets: 1 },
  WR100:     { name: 'IP6X + WR100 dive (40 m)', dust: 6, depth: 40,  mins: 120, jets: 2 },
  IP00:      { name: 'None (IP00)',              dust: 0, depth: 0,   mins: 0,  jets: 0 },
};

// Per instance. ram MB; fps = target rate at full speed; saturate = always 100% of the chip
const APPS = {
  tetris:    { name: 'Tetris (1989)',         cpu: 0.8,   gpu: 0,    ram: 0.008, fps: 60, unit: 'fps', color: '#9bbc0f' },
  snake:     { name: 'Snake II',              cpu: 2,     gpu: 0,    ram: 0.5,  fps: 10, unit: 'fps',  color: '#9ab86a' },
  doom:      { name: 'DOOM (1993)',           cpu: 25,    gpu: 0,    ram: 4,    fps: 35, unit: 'fps',  color: '#7b2a1d' }, // the real thing: a 386 and 4 MB
  flappy:    { name: 'Flappy Bird',           cpu: 25,    gpu: 0.5,  ram: 70,   fps: 60, unit: 'fps',  color: '#4ec0ca' },
  chrome:    { name: 'Chrome tab',            cpu: 35,    gpu: 0.4,  ram: 160,  fps: 60, unit: 'fps',  color: '#e8e8e8' },
  call:      { name: 'Video call',            cpu: 900,   gpu: 6,    ram: 450,  fps: 30, unit: 'fps',  color: '#2d8cff', camera: true },
  video:     { name: '4K60 video recording',  cpu: 1800,  gpu: 15,   ram: 900,  fps: 60, unit: 'fps',  color: '#5f6b55', camera: true },
  minecraft: { name: 'Minecraft',             cpu: 1400,  gpu: 30,   ram: 1400, fps: 60, unit: 'fps',  color: '#6aa84f' },
  genshin:   { name: 'Genshin Impact (max)',  cpu: 3200,  gpu: 85,   ram: 3800, fps: 60, unit: 'fps',  color: '#f7c6a3' },
  fortnite:  { name: 'Fortnite (epic)',       cpu: 2800,  gpu: 95,   ram: 4200, fps: 60, unit: 'fps',  color: '#8e44ad' },
  llm:       { name: 'On-device LLM (8B Q4)', cpu: 5500,  gpu: 60,   ram: 5200, fps: 18, unit: 'tok/s', color: '#111418' },
  miner:     { name: 'Crypto miner',          cpu: 0,     gpu: 0,    ram: 300,  fps: 30, unit: 'MH/s', color: '#f2a900', saturate: true },
  stress:    { name: 'CPU+GPU stress test',   cpu: 0,     gpu: 0,    ram: 600,  fps: 60, unit: 'fps',  color: '#fc5c65', saturate: true },
  gta:       { name: 'GTA V (x86 emulated)',  cpu: 15000, gpu: 170,  ram: 7000, fps: 30, unit: 'fps',  color: '#3b7d3b' },
  crysis:    { name: 'Crysis (x86 emulated)', cpu: 16000, gpu: 180,  ram: 4800, fps: 30, unit: 'fps',  color: '#2f6b2a' },
  bench:     { name: 'Benchmark',             cpu: 0,     gpu: 0,    ram: 800,  fps: 60, unit: 'fps',  color: '#4fd1c5', saturate: true, hidden: true },
};

const DESIGN = {
  screen: ['island', 'notch', 'punch', 'waterdrop', 'clean', 'bezel', 'keypad', 'watch', 'switch', 'gameboy'],
  cams: ['pro3', 'dual', 'vertical', 'bar', 'rog', 'single', 'triple', 'none'],
  logo: ['apple', 'samsung', 'g', 'rog', 'nokia', 'none'],
};
const DEFAULT_DESIGN = { color: '#3a3f4a', accent: '#4fd1c5', accent2: '#ff4554', screen: 'punch', cams: 'triple', logo: 'none', corner: 0.5 };

const P = (name, ip, glass, back, frame, weight, soc, ramGB, batteryMah, cooling, size, design, group = 'Phones') =>
  ({ name, group, spec: { name, ip, glass, back, frame, case: 'none', weight, soc, ramGB, batteryMah, cooling, size, design: { ...DEFAULT_DESIGN, ...design } } });
const sz = (w, h, t) => ({ w, h, t });
const PRESETS = [
  P('iPhone 16 Pro Max', 'IP68-6m', 'ceramic', 'victus', 'titanium', 227, 'a18pro', 8, 4685, 'graphite', sz(77.6, 163, 8.25),
    { color: '#c4b59d', screen: 'island', cams: 'pro3', logo: 'apple', corner: 0.55 }),
  P('Galaxy S25 Ultra', 'IP68', 'armor', 'victus2', 'titanium', 218, 'sd8elite', 12, 5000, 'vapor', sz(77.6, 162.8, 8.2),
    { color: '#4a5468', screen: 'punch', cams: 'vertical', logo: 'samsung', corner: 0.18 }),
  P('Pixel 9 Pro', 'IP68', 'victus2', 'victus2', 'aluminum', 199, 'tensorg4', 16, 4700, 'vapor', sz(72, 152.8, 8.5),
    { color: '#e9e3d6', screen: 'punch', cams: 'bar', logo: 'g', corner: 0.6 }),
  P('ROG Phone 9 + fan', 'IP68', 'victus2', 'victus2', 'aluminum', 227, 'sd8elite', 24, 5800, 'fan', sz(76.8, 163.8, 8.9),
    { color: '#16171a', accent: '#ff1f4b', screen: 'punch', cams: 'rog', logo: 'rog', corner: 0.35 }),
  P('iPhone 11 (2019)', 'IP68-2m', 'gg5', 'gg5', 'aluminum', 194, 'a13', 4, 3110, 'graphite', sz(75.7, 150.9, 8.3),
    { color: '#b9a9da', screen: 'notch', cams: 'dual', logo: 'apple', corner: 0.6 }),
  P('Galaxy S5 (2014)', 'IP67', 'gg3', 'plastic', 'plastic', 145, 'sd801', 2, 2800, 'none', sz(72.5, 142, 8.1),
    { color: '#2a3a5c', screen: 'bezel', cams: 'single', logo: 'samsung', corner: 0.45 }),
  P('Budget Android', 'IP54', 'gg3', 'plastic', 'plastic', 192, 'heliog85', 4, 5000, 'none', sz(76, 168, 8.9),
    { color: '#2e7d6b', screen: 'waterdrop', cams: 'dual', logo: 'none', corner: 0.5 }),
  P('Rugged phone', 'IP69', 'gg5', 'plastic', 'rugged', 360, 'sd7sg2', 8, 10000, 'graphite', sz(82, 175, 18),
    { color: '#2a2a2a', accent: '#ff7a00', screen: 'waterdrop', cams: 'triple', logo: 'none', corner: 0.3 }),
  P('Nokia 3310 (2000)', 'IP00', 'plastic', 'plastic', 'nokia', 133, 'mcu', 0.004, 900, 'none', sz(48, 113, 22),
    { color: '#1f4078', screen: 'keypad', cams: 'none', logo: 'nokia', corner: 0.95 }),
  P('iPad Pro 13" (M4)', 'IP00', 'gg5', 'aluminum', 'aluminum', 579, 'm4', 8, 10130, 'graphite', sz(215.5, 281.6, 5.1),
    { color: '#3b3d42', screen: 'clean', cams: 'single', logo: 'apple', corner: 0.22 }, 'Other gadgets'),
  P('Apple Watch Ultra 2', 'WR100', 'sapphire', 'sapphire', 'titanium', 61, 's9', 1, 564, 'none', sz(44, 49, 14.4),
    { color: '#c9c3b8', accent: '#ff6a00', screen: 'watch', cams: 'none', logo: 'none', corner: 0.9 }, 'Other gadgets'),
  P('Nintendo Switch OLED', 'IP00', 'plastic', 'plastic', 'plastic', 420, 'tegrax1', 4, 4310, 'fan', sz(242, 102, 13.9),
    { color: '#2b2b2b', accent: '#00c3e3', accent2: '#ff4554', screen: 'switch', cams: 'none', logo: 'none', corner: 0.6 }, 'Other gadgets'),
  P('Game Boy (1989)', 'IP00', 'plastic', 'plastic', 'gameboy', 300, 'lr35902', 0.000008, 2500, 'none', sz(90, 148, 32),
    { color: '#c6c3bd', accent: '#8b1d4f', screen: 'gameboy', cams: 'none', logo: 'none', corner: 0.15 }, 'Other gadgets'),
];

// Editable numbers per table; "custom_<field>" entries are created on demand.
const CUSTOM = {
  soc:     { table: SOCS,    fields: { cpu: [1, 50000], gpu: [0.01, 500], tdp: [0.1, 30] } },
  glass:   { table: GLASS,   fields: { tough: [0.1, 99], hard: [1, 10] } },
  back:    { table: GLASS,   fields: { tough: [0.1, 99], hard: [1, 10] } },
  frame:   { table: FRAMES,  fields: { dent: [0.5, 100], hard: [1, 10] } },
  case:    { table: CASES,   fields: { absorb: [0.01, 1] } },
  cooling: { table: COOLING, fields: { h: [0.05, 5], rjc: [0.5, 10] } },
  ip:      { table: IP,      fields: { dust: [0, 6], depth: [0, 100], mins: [0, 10000], jets: [0, 3] } },
};
function setCustom(k, values = {}, base = {}) {
  const c = CUSTOM[k], e = { name: (typeof values.name === 'string' && values.name.trim() ? values.name.trim() : 'Custom').slice(0, 40) };
  for (const [f, [lo, hi]] of Object.entries(c.fields)) {
    const v = Number(values[f]);
    e[f] = Number.isFinite(v) ? clamp(v, lo, hi) : clamp(base[f] ?? lo, lo, hi);
  }
  if (c.table === GLASS) e.shatter = e.tough < 50;
  if (c.table === FRAMES) e.color = base.color || '#7d8590';
  c.table['custom_' + k] = e;
  return 'custom_' + k;
}
function exportSpec(spec) {
  const out = structuredClone(spec);
  for (const k of Object.keys(CUSTOM)) if (String(spec[k]).startsWith('custom_')) {
    const e = CUSTOM[k].table[spec[k]], o = { name: e.name };
    for (const f of Object.keys(CUSTOM[k].fields)) o[f] = e[f];
    out[k] = o;
  }
  return out;
}

/* Imported JSON is untrusted: whitelist enum keys, clamp numbers, cap strings. */
function validateSpec(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Spec must be a JSON object');
  const base = PRESETS[0].spec, out = {}, warnings = [];
  out.name = typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 60) : 'Custom phone';
  const tables = { soc: SOCS, ip: IP, glass: GLASS, back: GLASS, frame: FRAMES, case: CASES, cooling: COOLING };
  for (const [k, table] of Object.entries(tables)) {
    const v = input[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = setCustom(k, v, table[base[k]]);
    else if (Object.hasOwn(table, String(v)) && !String(v).startsWith('custom_')) out[k] = String(v);
    else { out[k] = base[k]; if (v !== undefined) warnings.push(`Unknown ${k} "${String(v).slice(0, 30)}" — using ${base[k]}`); }
  }
  const num = (obj, k, lo, hi, dflt, label = k) => {
    const v = Number(obj?.[k]);
    if (obj?.[k] === undefined || !Number.isFinite(v)) { if (obj?.[k] !== undefined) warnings.push(`Bad ${label} — using ${dflt}`); return dflt; }
    if (v < lo || v > hi) warnings.push(`${label} clamped to ${clamp(v, lo, hi)}`);
    return clamp(v, lo, hi);
  };
  out.weight = num(input, 'weight', 20, 50000, base.weight);
  out.ramGB = num(input, 'ramGB', 0.000001, 64, base.ramGB);
  out.batteryMah = num(input, 'batteryMah', 100, 100000, base.batteryMah);
  const s = input.size && typeof input.size === 'object' ? input.size : {};
  out.size = { w: num(s, 'w', 20, 2000, base.size.w, 'size.w'), h: num(s, 'h', 30, 3000, base.size.h, 'size.h'), t: num(s, 't', 3, 200, base.size.t, 'size.t') };
  const d = input.design && typeof input.design === 'object' ? input.design : {};
  const hex = (v, dflt) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : dflt;
  const pickD = (k) => DESIGN[k].includes(d[k]) ? d[k] : DEFAULT_DESIGN[k];
  out.design = { color: hex(d.color, DEFAULT_DESIGN.color), accent: hex(d.accent, DEFAULT_DESIGN.accent), accent2: hex(d.accent2, DEFAULT_DESIGN.accent2),
    screen: pickD('screen'), cams: pickD('cams'), logo: pickD('logo'), corner: num(d, 'corner', 0, 1, DEFAULT_DESIGN.corner, 'design.corner') };
  return { spec: out, warnings };
}

function newState(ambient = 25) {
  return {
    screen: 0, back: 0, frame: 0, board: 0, ingress: 0, swell: 0, sand: 0,      // damage %, swell 0..1
    camera: 0, port: 0, speaker: 0, buttons: 0,                                // components %
    punctured: false, fire: false, fireT: 0, smoke: 0, sparks: false,
    cracks: { front: [], back: [] }, crackHits: { front: 0, back: 0 },
    dents: [], scratches: [], holes: [], burns: [], scuffs: 0, bend: 0, crushed: false, scorch: 0,
    T: ambient, Tsoc: ambient, throttle: 1, battery: 100, extHeat: 0, buried: 0,
    power: 'on', offReason: '', deadReason: '', rebootT: 0,
    submergedSec: 0, waterStage: 0, sandStage: 0, overloadT: 0, microwaveT: 0, arcing: false, zapT: 0,
    swapping: false, anrWarned: false, swellWarned: false, smokeWarned: false, cooking: false, flags: {},
  };
}

function sealIntegrity(st) {
  if (st.holes.length || st.crushed) return 0;
  let s = 1 - st.frame * 0.004 - st.swell * 0.6 - st.bend * 0.5 - st.port * 0.002;
  if (st.cracks.front.length) s *= 0.45;
  if (st.cracks.back.length) s *= 0.6;
  return clamp(s, 0, 1);
}

function kill(st, reason, ev, lvl = 'dead') {
  if (st.power === 'dead') return;
  st.power = 'dead'; st.deadReason = reason;
  ev.push({ lvl, msg: `DEVICE DEAD — ${reason}` });
}
const once = (st, key, ev, lvl, msg) => { if (!st.flags[key]) { st.flags[key] = true; ev.push({ lvl, msg }); } };

/* Crack polylines in normalised phone coords (u across, v down, as seen from that side). */
function genCracks(u, v, sev, rng, A = 2.1) {
  const lines = [], n = clamp(Math.round(2 + sev * 3), 2, 16);
  for (let i = 0; i < n; i++) {
    let x = u, y = v * A, ang = (i / n) * Math.PI * 2 + rng() * 0.8;
    const pts = [[u, v]], steps = 4 + Math.floor(rng() * 6 * Math.min(sev, 2.5));
    for (let s = 0; s < steps; s++) {
      ang += (rng() - 0.5) * 0.9;
      const len = 0.03 + rng() * 0.06 * Math.min(sev, 3);
      x += Math.cos(ang) * len; y += Math.sin(ang) * len;
      pts.push([x, y / A]);
      if (x < 0 || x > 1 || y < 0 || y > A) break;
    }
    lines.push(pts);
  }
  if (sev > 1.6) {
    const r = 0.05 + rng() * 0.05, ring = [];
    for (let a = 0; a <= 12; a++) {
      const t = a / 12 * Math.PI * 2, k = 0.8 + rng() * 0.4;
      ring.push([u + Math.cos(t) * r * k, v + Math.sin(t) * r * k / A]);
    }
    lines.push(ring);
  }
  return lines;
}

const glassOf = (spec, side) => GLASS[side === 'front' ? spec.glass : spec.back];
const sideKey = (side) => side === 'front' ? 'screen' : 'back';
const sideLabel = (side) => side === 'front' ? 'Screen' : 'Back panel';

/* e = energy reaching this glass (J). Already-cracked glass gets weaker with each hit. */
function crackGlass(spec, st, side, e, u, v, rng, ev, point = false) {
  const g = glassOf(spec, side), key = sideKey(side), label = sideLabel(side);
  if (!g.shatter) {
    if (e > 0.6) st.scuffs++;
    if (e > 5) {
      st[key] = Math.min(100, st[key] + (e - 5) * 4);
      ev.push({ lvl: 'warn', msg: `${label} (${g.name}) bent instead of shattering — took ${e.toFixed(1)} J` });
    }
    return false;
  }
  const tough = g.tough / Math.min(3, 1 + 0.4 * st.crackHits[side]) / (point ? 1.6 : 1);
  const p = 1 / (1 + Math.exp(-(e - tough) / (0.22 * tough)));
  if (rng() < p) {
    const sev = e / tough;
    st[key] = Math.min(100, st[key] + 10 + 14 * Math.min(sev, 6));
    st.crackHits[side]++;
    st.cracks[side].push(...genCracks(u, v, sev, rng));
    ev.push({ lvl: 'bad', msg: `${label} cracked — ${g.name} took ${e.toFixed(1)} J (${st.crackHits[side] > 1 ? 'already weakened, ' : ''}${Math.round(p * 100)}% odds)` });
    return true;
  }
  if (p > 0.15) ev.push({ lvl: 'ok', msg: `${label} survived a ${Math.round(p * 100)}% crack chance` });
  return false;
}

function dentFrame(spec, st, e, u, v, ev) {
  const frame = FRAMES[spec.frame];
  if (e <= frame.dent * 0.5) return;
  const d = e / frame.dent;
  st.frame = Math.min(100, st.frame + 8 * d);
  st.dents.push({ u, v, d: Math.min(3, d) });
  ev.push({ lvl: 'warn', msg: `${frame.name} frame ${spec.frame === 'plastic' ? 'cracked' : 'dented'} (${e.toFixed(1)} J)` });
}

function shockInternals(spec, st, E, ev, rng) {
  const shock = E / Math.sqrt(FRAMES[spec.frame].dent / 2.2); // tougher shells protect the internals
  if (shock <= 7) return;
  st.board = Math.min(100, st.board + (shock - 7) * 4);
  ev.push({ lvl: 'bad', msg: `Internal shock ${shock.toFixed(1)} J — logic board ${Math.round(st.board)}% damaged` });
  if (!st.punctured && shock > 12 && rng() < (shock - 12) / 25) puncture(st, ev);
  if (st.board >= 100) kill(st, 'logic board shattered', ev);
}
function puncture(st, ev) {
  if (st.punctured) return;
  st.punctured = true;
  ev.push({ lvl: 'dead', msg: 'Battery pouch punctured! Lithium is reacting with air…' });
}

// Component zones in front-view coords (u across, v down). Rear camera sits top-right seen from the front.
const AREAS = {
  camera:  { r: [0.55, 0.02, 0.95, 0.24], name: 'Rear camera',   k: 5 },
  port:    { r: [0.30, 0.92, 0.70, 1.00], name: 'USB-C port',    k: 7 },
  speaker: { r: [0.05, 0.92, 0.95, 1.00], name: 'Speaker',       k: 5 },
  buttons: { r: [0.93, 0.15, 1.00, 0.40], name: 'Side buttons',  k: 5 },
  battery: { r: [0.12, 0.30, 0.88, 0.86], name: 'Battery',       k: 0 },
  board:   { r: [0.08, 0.02, 0.92, 0.30], name: 'Logic board',   k: 0 },
};
const distRect = (u, v, [x0, y0, x1, y1]) => Math.hypot(Math.max(x0 - u, 0, u - x1), Math.max(y0 - v, 0, v - y1));
function hitArea(st, u, v, E, radius, ev, rng) {
  const hits = [];
  for (const [k, a] of Object.entries(AREAS)) {
    const w = clamp(1 - distRect(u, v, a.r) / radius, 0, 1);
    if (!w) continue;
    hits.push(k);
    if (k === 'battery') { if (E * w > 25 && rng() < (E * w - 25) / 60) puncture(st, ev); continue; }
    if (k === 'board') { if (E * w > 20) { st.board = Math.min(100, st.board + (E * w - 20) * 0.5); if (st.board >= 100) kill(st, 'logic board destroyed', ev); } continue; }
    const before = st[k];
    st[k] = Math.min(100, st[k] + E * w * a.k);
    if (before < 50 && st[k] >= 50) ev.push({ lvl: 'bad', msg: `${a.name} damaged` });
    if (before < 100 && st[k] >= 100) ev.push({ lvl: 'bad', msg: `${a.name} destroyed` });
  }
  return hits;
}

/* o = { speed m/s | energy J, hit: screen|back|edge|corner, side: front|back (corners), surfaceFactor, u, v } */
function impact(spec, st, o, rng = Math.random) {
  const ev = [];
  const E = (o.energy ?? 0.5 * (spec.weight / 1000) * o.speed * o.speed * (o.surfaceFactor ?? 1)) * CASES[spec.case].absorb;
  const [kFront, kBack, kFrame] = {
    screen: [1, 0, 0.2], back: [0, 1, 0.2], edge: [0.3, 0.3, 1],
    corner: [o.side === 'front' ? 1.5 : 0.4, o.side === 'back' ? 1.5 : 0.4, 1.3],
  }[o.hit];
  const u = o.u ?? 0.5, v = o.v ?? 0.5;
  if (kFront) crackGlass(spec, st, 'front', E * kFront, u, v, rng, ev);
  if (kBack) crackGlass(spec, st, 'back', E * kBack, 1 - u, v, rng, ev); // back view is mirrored
  dentFrame(spec, st, E * kFrame, u, v, ev);
  hitArea(st, u, v, E * 0.6, 0.3, ev, rng);
  shockInternals(spec, st, E, ev, rng);
  return { energy: E, events: ev };
}

/* depth in m, dt in simulated seconds */
function waterStages(st, ev) {
  const stages = [[5, 'warn', 'Moisture detected in the USB-C port'], [30, 'warn', 'Water behind the display — stains & ghost touches'],
    [70, 'bad', 'Water reached the logic board — short circuit!'], [100, 'bad', 'Device completely flooded']];
  while (st.waterStage < stages.length && st.ingress >= stages[st.waterStage][0]) {
    const [, lvl, msg] = stages[st.waterStage++];
    ev.push({ lvl, msg });
  }
  if (st.ingress >= 100) kill(st, 'drowned (water damage)', ev);
}
function waterStep(spec, st, depth, dt) {
  const ev = [], ip = IP[spec.ip], seal = sealIntegrity(st);
  st.submergedSec += dt;
  let rate; // % per simulated minute
  if (!ip.depth) rate = ip.jets ? 8 : 14;
  else rate = Math.max(0, depth - ip.depth * seal) * 8 + Math.max(0, st.submergedSec / 60 - ip.mins * seal) * 0.6;
  rate = (rate + (1 - seal) * 15) * (1 + depth * 0.15);
  st.ingress = Math.min(100, st.ingress + rate * dt / 60);
  waterStages(st, ev);
  return ev;
}

/* Sand: buried 0..1, rub = sliding speed through sand (m/s), dt simulated seconds */
function addScratches(spec, st, side, n, deep, rng, at) {
  for (let i = 0; i < n; i++) {
    const u = at ? at[0] + (rng() - 0.5) * 0.1 : rng(), v = at ? at[1] + (rng() - 0.5) * 0.1 : rng();
    const a = rng() * Math.PI, len = 0.04 + rng() * 0.12;
    st.scratches.push({ side, deep, pts: [[u, v], [u + Math.cos(a) * len, v + Math.sin(a) * len / 2.1]] });
  }
  if (st.scratches.length > 400) st.scratches.splice(0, st.scratches.length - 400);
}
function sandStages(st, ev) {
  const stages = [[10, 'warn', 'Grit in the speaker grille — audio sounds crunchy'], [35, 'warn', 'Sand packed into the USB-C port — charging unreliable'],
    [60, 'bad', 'Sand in the buttons — they crunch and stick'], [85, 'bad', 'Sand reached the camera module and internals']];
  while (st.sandStage < stages.length && st.sand >= stages[st.sandStage][0]) {
    const [, lvl, msg] = stages[st.sandStage++];
    ev.push({ lvl, msg });
  }
  st.port = Math.max(st.port, st.sand * 0.9); st.speaker = Math.max(st.speaker, st.sand * 0.8);
  st.buttons = Math.max(st.buttons, (st.sand - 40) * 1.2); if (st.sand > 85) st.camera = Math.max(st.camera, (st.sand - 85) * 4);
}
function sandStep(spec, st, buried, rub, dt, rng = Math.random) {
  const ev = [], ip = IP[spec.ip], seal = sealIntegrity(st);
  st.sand = Math.min(100, st.sand + ((6 - ip.dust) * 4 + (1 - seal) * 10) * buried * dt / 60);
  for (const side of ['front', 'back']) // sand is quartz, Mohs 7: anything softer gets scratched while it grinds
    if (glassOf(spec, side).hard < 7 && rng() < rub * buried * dt * 0.05) addScratches(spec, st, side, 1, false, rng);
  sandStages(st, ev);
  return ev;
}
function sandImpact(spec, st, speed, rng = Math.random) {
  const ev = [], ip = IP[spec.ip];
  st.sand = Math.min(100, st.sand + (6 - ip.dust) * speed * 0.6 + (1 - sealIntegrity(st)) * speed);
  const n = Math.round(speed / 2);
  for (const side of ['front', 'back']) if (glassOf(spec, side).hard < 7 && n) addScratches(spec, st, side, n, speed > 10, rng);
  if (n && (glassOf(spec, 'front').hard < 7 || glassOf(spec, 'back').hard < 7)) ev.push({ lvl: 'warn', msg: `Sand (Mohs 7) scratched the ${glassOf(spec, 'front').hard < 7 ? 'screen' : 'back'}` });
  sandStages(st, ev);
  return ev;
}

/* Bend strength ~ frame strength × thickness² / length */
function bendStrength(spec) {
  const caseK = spec.case === 'rugged' ? 2 : spec.case === 'none' ? 1 : 1.2;
  return FRAMES[spec.frame].dent * (spec.size.t / 8) ** 2 * (163 / spec.size.h) * caseK;
}

const WEAPONS = {
  hammer:    { name: 'Hammer',                   icon: '🔨', mode: 'point' },
  mohs:      { name: 'Mohs scratch pick',        icon: '⛏️', mode: 'point' },
  knife:     { name: 'Steel knife (Mohs 5.5)',   icon: '🔪', mode: 'point' },
  pistol:    { name: '9 mm pistol',              icon: '🔫', mode: 'point' },
  shotgun:   { name: 'Shotgun (birdshot)',       icon: '💥', mode: 'point' },
  bowling:   { name: 'Bowling ball from 2 m',    icon: '🎳', mode: 'point' },
  taser:     { name: 'Taser (50 kV)',            icon: '⚡', mode: 'point' },
  lighter:   { name: 'Lighter (hold)',           icon: '🔥', mode: 'hold' },
  torch:     { name: 'Blowtorch (hold)',         icon: '☄️', mode: 'hold' },
  washer:    { name: 'Pressure washer (hold)',   icon: '🚿', mode: 'hold' },
  ln2:       { name: 'Liquid nitrogen dunk',     icon: '🧊', mode: 'instant' },
  microwave: { name: 'Microwave (10 s)',         icon: '♨️', mode: 'instant' },
  bend:      { name: 'Bend test (hands)',        icon: '🤲', mode: 'instant' },
  car:       { name: 'Run over by a car',        icon: '🚗', mode: 'instant' },
  press:     { name: 'Hydraulic press',          icon: '🗜️', mode: 'instant' },
  lightning: { name: 'Lightning strike',         icon: '🌩️', mode: 'instant' },
  magnet:    { name: 'Neodymium magnet',         icon: '🧲', mode: 'instant' },
  blender:   { name: 'Industrial blender',       icon: '🌀', mode: 'instant' },
};

/* o = { u, v (as seen from `side`), side: front|back, level (Mohs), dt (sim s, hold weapons) } */
function weapon(spec, st, key, o = {}, rng = Math.random) {
  const ev = [], side = o.side || 'front', u = o.u ?? 0.5, v = o.v ?? 0.5;
  const fu = side === 'front' ? u : 1 - u; // front-view coords for component zones
  const other = side === 'front' ? 'back' : 'front';
  const absorb = CASES[spec.case].absorb;
  const scratchTest = (level) => {
    const g = glassOf(spec, side);
    if (level < g.hard) ev.push({ lvl: 'ok', msg: `Mohs ${level}: no marks — ${g.name} is harder (≈${g.hard})` });
    else {
      const deep = level >= g.hard + 1;
      addScratches(spec, st, side, 1, deep, rng, [u, v]);
      st[sideKey(side)] = Math.min(100, st[sideKey(side)] + (deep ? 1.5 : 0.3));
      ev.push({ lvl: 'warn', msg: `Mohs ${level}: ${deep ? 'deep groove' : 'light scratch'} in the ${g.name}` });
    }
  };
  if (o.edge) { // hit on the frame edge (3D torture view)
    const frame = FRAMES[spec.frame];
    if (key === 'hammer' || key === 'bowling') {
      const E = (key === 'hammer' ? 30 : 142) * absorb;
      dentFrame(spec, st, E * 0.6, fu, v, ev);
      for (const s of ['front', 'back']) crackGlass(spec, st, s, E * 0.12, s === 'front' ? fu : 1 - fu, v, rng, ev, true); // edge chips spread into the glass
      hitArea(st, fu, v, E * 0.5, 0.12, ev, rng);
      shockInternals(spec, st, E * 0.25, ev, rng);
      return ev;
    }
    if (key === 'mohs' || key === 'knife') {
      const level = key === 'knife' ? 5.5 : clamp(Math.round(o.level ?? 6), 1, 10);
      ev.push(level >= frame.hard ? { lvl: 'warn', msg: `Mohs ${level}: scratched the ${frame.name} frame (hardness ≈${frame.hard})` }
        : { lvl: 'ok', msg: `Mohs ${level}: no marks on the ${frame.name} frame (≈${frame.hard})` });
      if (level >= frame.hard) st.scuffs++;
      return ev;
    }
  }
  switch (key) {
    case 'blender':
      for (const s of ['front', 'back']) { if (glassOf(spec, s).shatter) for (let i = 0; i < 6; i++) st.cracks[s].push(...genCracks(rng(), rng(), 4, rng)); st[sideKey(s)] = 100; }
      st.crushed = true; st.frame = 100; st.bend = 1; st.board = 100; st.camera = st.port = st.speaker = st.buttons = 100;
      puncture(st, ev);
      ev.push({ lvl: 'bad', msg: "Will it blend? Yes. Yes it will. (Don't breathe this.)" });
      kill(st, 'blended into powder', ev);
      break;
    case 'hammer':
      crackGlass(spec, st, side, 30 * absorb, u, v, rng, ev, true);
      hitArea(st, fu, v, 30 * absorb, 0.12, ev, rng);
      shockInternals(spec, st, 9 * absorb, ev, rng);
      break;
    case 'mohs': scratchTest(clamp(Math.round(o.level ?? 6), 1, 10)); break;
    case 'knife': scratchTest(5.5); break;
    case 'pistol': {
      st.holes.push({ u: fu, v, r: 0.035 });
      for (const s of ['front', 'back']) {
        const su = s === 'front' ? fu : 1 - fu;
        if (glassOf(spec, s).shatter) { st.cracks[s].push(...genCracks(su, v, 4, rng)); st.crackHits[s]++; }
        st[sideKey(s)] = Math.min(100, st[sideKey(s)] + 45);
      }
      const hit = hitArea(st, fu, v, 500, 0.06, ev, rng);
      if (hit.includes('battery')) puncture(st, ev);
      if (hit.includes('board') || rng() < 0.4) { st.board = 100; kill(st, hit.includes('board') ? 'bullet through the logic board' : 'shockwave severed the flex cables', ev); }
      else st.board = Math.min(100, st.board + 35);
      ev.push({ lvl: 'bad', msg: `Bullet passed straight through${hit.length ? ' the ' + hit.map(k => AREAS[k].name.toLowerCase()).join(' and ') : ''}` });
      break;
    }
    case 'shotgun':
      for (let i = 0; i < 9; i++) {
        const pu = clamp(u + (rng() - 0.5) * 0.3, 0.02, 0.98), pv = clamp(v + (rng() - 0.5) * 0.15, 0.02, 0.98);
        const pfu = side === 'front' ? pu : 1 - pu;
        st.holes.push({ u: pfu, v: pv, r: 0.012, side });
        if (glassOf(spec, side).shatter) { st.cracks[side].push(...genCracks(pu, pv, 1.2, rng)); }
        st[sideKey(side)] = Math.min(100, st[sideKey(side)] + 6);
        hitArea(st, pfu, pv, 25, 0.05, ev, rng);
      }
      st.crackHits[side] += 2;
      st.board = Math.min(100, st.board + 20);
      ev.push({ lvl: 'bad', msg: '9 pellets embedded in the phone' });
      break;
    case 'bowling': {
      const E = 7.26 * 9.81 * 2 * absorb;
      crackGlass(spec, st, side, E, u, v, rng, ev);
      dentFrame(spec, st, E * 0.15, fu, v, ev);
      hitArea(st, fu, v, E * 0.5, 0.25, ev, rng);
      shockInternals(spec, st, E * 0.4, ev, rng);
      if (bendStrength(spec) < 6) { st.bend = Math.min(1, st.bend + 0.3); ev.push({ lvl: 'bad', msg: 'Chassis bent under the ball' }); }
      break;
    }
    case 'taser': {
      st.zapT = 0.6;
      const dmg = rng() * 30;
      st.board = Math.min(100, st.board + dmg);
      ev.push(dmg < 15 ? { lvl: 'ok', msg: 'Zapped — ESD protection diodes absorbed it' } : { lvl: 'bad', msg: `Taser fried part of the logic board (${Math.round(st.board)}%)` });
      if (st.board >= 100) kill(st, 'electrocuted', ev);
      break;
    }
    case 'lighter': case 'torch': {
      const torch = key === 'torch', dt = o.dt ?? 0.1;
      st.extHeat += torch ? 80 : 4;
      const near = st.burns.find(b => b.side === side && Math.hypot(b.u - u, b.v - v) < 0.06);
      const b = near || (st.burns.push({ u, v, s: 0, side }), st.burns[st.burns.length - 1]);
      b.s = Math.min(torch ? 4 : 1.5, b.s + dt / (torch ? 3 : 20));
      if (side === 'front' && b.s > 1) once(st, 'oledburn', ev, 'bad', 'OLED pixels permanently burned — that spot stays black');
      if (torch) { st.scorch = Math.min(1, st.scorch + dt / 60); once(st, 'torch', ev, 'bad', 'Blowtorch: the frame is discolouring and the glue is melting'); }
      else once(st, 'lighter', ev, 'warn', 'Flame on the display — pixels turning white…');
      break;
    }
    case 'washer': {
      const ip = IP[spec.ip], dt = o.dt ?? 0.1, port = v > 0.85 ? 2 : 1;
      st.ingress = Math.min(100, st.ingress + (Math.max(0, 3 - ip.jets) * 25 + (1 - sealIntegrity(st)) * 30) * port * dt / 60);
      st.sand = Math.max(0, st.sand - dt * 2);
      if (ip.jets >= 3) once(st, 'washer', ev, 'ok', 'IP69K: hot high-pressure jets bounce off the seals');
      else once(st, 'washer', ev, 'warn', `${ip.name} isn't rated for high-pressure jets — water is being forced in`);
      waterStages(st, ev);
      break;
    }
    case 'ln2': {
      const dT = st.T + 196;
      st.T = -196;
      for (const s of ['front', 'back']) {
        const g = glassOf(spec, s);
        if (g.shatter && rng() < Math.min(0.9, dT / 900 + (g.tough < 1.6 ? 0.15 : 0))) {
          st.cracks[s].push(...genCracks(rng(), rng(), 2.5, rng)); st.crackHits[s]++;
          st[sideKey(s)] = Math.min(100, st[sideKey(s)] + 30);
          ev.push({ lvl: 'bad', msg: `Thermal shock (Δ${Math.round(dT)} °C) cracked the ${sideLabel(s).toLowerCase()}` });
        }
      }
      ev.push({ lvl: 'warn', msg: 'Dunked in liquid nitrogen at −196 °C — battery chemistry has stopped' });
      break;
    }
    case 'microwave':
      st.microwaveT = 10;
      ev.push({ lvl: 'warn', msg: 'Microwave on. The metal frame is about to arc…' });
      break;
    case 'bend': {
      const S = bendStrength(spec);
      if (S >= 2.2) ev.push({ lvl: 'ok', msg: `Bend test passed — no flex (strength ${S.toFixed(1)})` });
      else if (S >= 1.2) {
        st.bend = Math.max(st.bend, 0.35); st.screen = Math.min(100, st.screen + 15); st.frame = Math.min(100, st.frame + 25);
        if (glassOf(spec, 'back').shatter) { st.cracks.back.push([[0, 0.5], [0.3, 0.52], [0.6, 0.49], [1, 0.51]]); st.crackHits.back++; }
        ev.push({ lvl: 'bad', msg: `It flexes and stays bent — bendgate! (strength ${S.toFixed(1)})` });
      } else {
        st.bend = 1; st.screen = 100; st.board = 100;
        kill(st, `snapped in half (strength ${S.toFixed(1)})`, ev);
      }
      break;
    }
    case 'car': {
      const E = 400 * absorb;
      for (const s of ['front', 'back']) crackGlass(spec, st, s, E * 0.05, rng(), rng(), rng, ev);
      st.frame = Math.min(100, st.frame + 40 * absorb);
      if (bendStrength(spec) < 3) st.bend = Math.min(1, st.bend + 0.4);
      shockInternals(spec, st, E * 0.05, ev, rng);
      if (rng() < 0.4 * absorb) puncture(st, ev);
      ev.push({ lvl: 'bad', msg: 'A 1.5-tonne car rolled over it' });
      break;
    }
    case 'press':
      for (const s of ['front', 'back']) {
        if (glassOf(spec, s).shatter) for (let i = 0; i < 4; i++) st.cracks[s].push(...genCracks(rng(), rng(), 5, rng));
        st[sideKey(s)] = 100;
      }
      st.crushed = true; st.frame = 100; st.bend = 1; st.board = 100;
      puncture(st, ev);
      kill(st, 'flattened by a 20-tonne hydraulic press', ev);
      break;
    case 'lightning':
      st.scorch = 1; st.board = 100; st.T += 250;
      if (rng() < 0.6) puncture(st, ev);
      kill(st, 'struck by lightning (~1 GJ in 30 µs)', ev);
      break;
    case 'magnet':
      ev.push({ lvl: 'ok', msg: 'The compass spins wildly. Nothing else happens — phones use flash storage, not magnetic disks.' });
      break;
  }
  return ev;
}

/* Real-time effects of weapons with duration (microwave). */
function weaponTick(spec, st, dtReal, rng = Math.random) {
  const ev = [];
  st.zapT = Math.max(0, st.zapT - dtReal);
  st.arcing = st.microwaveT > 0;
  if (!st.arcing) return ev;
  st.microwaveT -= dtReal;
  st.T += 6 * dtReal;
  st.board = Math.min(100, st.board + 8 * dtReal);
  st.scorch = Math.min(1, st.scorch + dtReal / 12);
  st.screen = Math.min(100, st.screen + 5 * dtReal);
  if (rng() < 0.06 * dtReal) puncture(st, ev);
  if (st.board >= 100) kill(st, 'cooked in a microwave', ev);
  if (st.microwaveT <= 0) ev.push({ lvl: 'info', msg: 'Ding! Microwave finished.' });
  return ev;
}

/* apps = [{ key, count }] — never killed by the sim; they just suffer.
   env = { ambient, sun, unsafe, submerged, hmul }. dt = simulated s, dtReal = wall-clock s. */
function perfStep(spec, st, apps, env, dt, dtReal, rng = Math.random) {
  const ev = [], soc = SOCS[spec.soc] || SOCS.a18pro, cool = COOLING[spec.cooling] || COOLING.none;
  const ramAvail = spec.ramGB * 1024 * 0.7; // ~30% held by the OS
  let load = 0, socP = 0, extraP = 0, ram = 0, fps = 0, swap = 1;
  const powerOff = (why, msg, lvl = 'bad') => { st.power = 'off'; st.offReason = why; ev.push({ lvl, msg }); };
  const boot = (msg) => { st.power = 'rebooting'; st.rebootT = 3; ev.push({ lvl: 'info', msg }); };

  if (st.power === 'rebooting' && (st.rebootT -= dtReal) <= 0) {
    st.power = 'on'; ev.push({ lvl: 'info', msg: apps.length ? `Booted — resumed ${apps.length} running app${apps.length > 1 ? 's' : ''}` : 'Booted up' });
  }
  if (st.power === 'off' && st.offReason === 'thermal' && st.T < 38) boot('Cooled down — restarting');
  if (st.power === 'off' && st.offReason === 'cold' && st.T > 0) boot('Warmed up — restarting');

  if (st.power === 'on') {
    for (const a of apps) ram += APPS[a.key].ram * a.count;
    if (ram > ramAvail) { // swapping to storage: everything crawls, but nothing gets killed
      swap = 1 + (ram / ramAvail - 1) * 3;
      if (!st.swapping) { st.swapping = true; ev.push({ lvl: 'warn', msg: `RAM full (${(ram / 1024).toFixed(1)} of ${(ramAvail / 1024).toFixed(1)} GB) — swapping to storage, everything slows down` }); }
    } else st.swapping = false;
    let cpu = soc.cpu * 0.01, gpu = soc.gpu * 0.01; // OS background work
    for (const a of apps) { const A = APPS[a.key]; cpu += (A.saturate ? soc.cpu : A.cpu) * a.count; gpu += (A.saturate ? soc.gpu : A.gpu) * a.count; }
    const health = 1 - Math.min(st.board, 99) / 100 * 0.7;
    load = Math.max(cpu / (soc.cpu * st.throttle * health), gpu / (soc.gpu * st.throttle * health)) * swap;
    fps = Math.min(1, 1 / load);
    socP = soc.tdp * Math.min(1, load) * (env.unsafe ? 3 : 1) * Math.pow(st.throttle, 1.6);
    extraP = st.screen < 100 ? 0.5 : 0.2;

    if (load > 12) { if ((st.overloadT += dtReal) > 3 && !st.anrWarned) { st.anrWarned = true; ev.push({ lvl: 'warn', msg: "System heavily overloaded — everything is crawling, but nothing gets killed" }); } }
    else { st.overloadT = 0; st.anrWarned = false; }
    if (st.board > 60 && rng() < 0.04 * dtReal) { st.power = 'rebooting'; st.rebootT = 4; ev.push({ lvl: 'bad', msg: 'Random reboot — damaged logic board (apps will resume)' }); }

    if (st.power === 'on') {
      const coldDrain = st.T < 10 ? 1 + (10 - st.T) * 0.03 : 1; // cold batteries lose usable capacity
      st.battery -= (socP + extraP) * coldDrain * dt / 36 / (spec.batteryMah * 3.85 / 1000);
      if (st.battery <= 0) { st.battery = 0; powerOff('battery', 'Battery depleted — shutting down'); }
      else if (st.T < -20) powerOff('cold', `Battery too cold (${st.T.toFixed(0)} °C) — shutting down`, 'warn');
    }
  }

  st.sparks = (st.ingress >= 70 || st.arcing) && st.power !== 'dead';
  if (st.ingress >= 70 && st.power !== 'dead') { extraP += 3; st.board = Math.min(100, st.board + 6 * dt / 60); if (st.board >= 100) kill(st, 'short-circuited logic board', ev); }
  if (st.punctured) extraP += 12;
  if (st.fire) { st.fireT += dt; if (st.fireT < 120) extraP += 25; }

  const area = (spec.size.w * spec.size.h) / (77 * 163);
  const fanClog = spec.cooling === 'fan' ? 1 - st.sand / 150 : 1;
  const h = cool.h * Math.pow(area, 0.8) * fanClog * (env.hmul ?? 1) * (env.submerged ? 20 : 1) * (1 - 0.5 * st.buried);
  const C = spec.weight * 0.9;
  st.T += (socP + extraP + st.extHeat + (env.sun ? 2.5 : 0) - h * (st.T - env.ambient)) / C * dt;
  st.extHeat = 0;
  st.Tsoc = st.T + socP * cool.rjc;

  if (env.unsafe) st.throttle = 1;
  else {
    if (st.Tsoc > 88 || st.T > 43) st.throttle = Math.max(0.3, st.throttle - 0.08 * dt);
    else if (st.Tsoc < 78 && st.T < 41) st.throttle = Math.min(1, st.throttle + 0.05 * dt);
    if (st.power === 'on' && st.T > 49) powerOff('thermal', `Thermal shutdown at ${st.T.toFixed(0)} °C — phone needs to cool down (apps will resume)`, 'warn');
  }
  if (st.Tsoc > 120 && st.power === 'on') { // only reachable with protection off
    if (!st.cooking) { st.cooking = true; ev.push({ lvl: 'bad', msg: `SoC at ${st.Tsoc.toFixed(0)} °C — past Tjmax, the silicon is cooking` }); }
    st.board = Math.max(st.board, Math.min(90, st.board + (st.Tsoc - 120) * 0.01 * dt)); // glitches & reboots; the battery gets the finale
  }

  if (st.T > 60) st.swell = Math.min(1, st.swell + (st.T - 60) * 0.0006 * dt);
  if (st.swell > 0.2 && !st.swellWarned) { st.swellWarned = true; ev.push({ lvl: 'bad', msg: 'Battery swelling — the display is lifting off the frame' }); }
  if (!st.fire && (st.T > 85 || (st.punctured && st.T > 55) || st.swell >= 1)) {
    st.fire = true; st.fireT = 0;
    ev.push({ lvl: 'dead', msg: `THERMAL RUNAWAY at ${st.T.toFixed(0)} °C — the battery is on fire` });
    kill(st, 'battery fire', ev);
  }
  st.smoke = st.fire ? (st.fireT < 120 ? 1 : Math.max(0, 1 - (st.fireT - 120) / 240))
    : clamp((st.T - 62) / 20, 0, 0.8) + (st.punctured ? 0.4 : 0) + (st.arcing ? 0.3 : 0);
  if (st.smoke > 0.05 && !st.smokeWarned) { st.smokeWarned = true; ev.push({ lvl: 'bad', msg: 'Smoke venting from the battery!' }); }

  return { load, fps, power: socP + extraP, ram, ramAvail, swap, events: ev };
}

const Sim = { SOCS, GLASS, FRAMES, CASES, SURFACES, SAND_FACTOR, COOLING, IP, APPS, PRESETS, DESIGN, DEFAULT_DESIGN, CUSTOM, AREAS, WEAPONS,
  setCustom, exportSpec, validateSpec, newState, sealIntegrity, bendStrength,
  impact, waterStep, sandStep, sandImpact, weapon, weaponTick, perfStep };
if (typeof module !== 'undefined' && module.exports) module.exports = Sim; else root.Sim = Sim;
})(typeof globalThis !== 'undefined' ? globalThis : this);
