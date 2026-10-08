/* PhoneLab UI: shared state, spec editor, software lab, benchmarks, telemetry. Arena & close-up live in view.js. */
'use strict';
const S = Sim, D = Draw, $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rand = (a, b) => a + Math.random() * (b - a);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const GRAV = 9.81;

const env = { arena: 'lab', mode3d: true, surface: 'concrete', height: 10, pool: 3, ambient: 25, sun: false, unsafe: false, speed: 20, submerged: false, hmul: 1 };
let spec = structuredClone(S.PRESETS[0].spec), st = S.newState(env.ambient), apps = [];
let tele = { load: 0, fps: 1, power: 0, ram: 0, ramAvail: 1, swap: 1 }, view = 'front', time = 0, shake = 0, cshake = 0, toast = null;
let bench = null, tool = null, holding = null;
const worldFx = [], floaters = [], history = [];

/* ---------------- log ---------------- */
function log(lvl, msg) {
  const d = document.createElement('div');
  d.className = lvl; d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  $('log').prepend(d);
  while ($('log').childElementCount > 150) $('log').lastChild.remove();
}
function handle(events) { for (const e of events) { log(e.lvl, e.msg); if (e.toast) toast = { msg: e.toast, until: time + 2.5 }; } }

/* ---------------- spec editor ---------------- */
const TABLES = [['soc', 'Processor', S.SOCS], ['cooling', 'Cooling', S.COOLING], ['ip', 'IP rating', S.IP], ['glass', 'Front glass', S.GLASS],
  ['back', 'Back panel', S.GLASS], ['frame', 'Frame', S.FRAMES], ['case', 'Case', S.CASES]];
const NUMS = [['ramGB', 'RAM (GB)', 0.000001, 64, 1], ['batteryMah', 'Battery (mAh)', 100, 100000, 100], ['weight', 'Weight (g)', 20, 50000, 1]];
const F_LABEL = { cpu: 'CPU pts', gpu: 'GPU pts', tdp: 'TDP (W)', tough: 'Crack energy (J)', hard: 'Mohs hardness', dent: 'Dent energy (J)',
  absorb: 'Energy passed (0–1)', h: 'Cooling (W/K)', rjc: 'SoC→skin (K/W)', dust: 'Dust digit (0–6)', depth: 'Depth (m)', mins: 'Minutes', jets: 'Jets (0–3)' };
const DESIGN_LABEL = {
  screen: { island: 'Dynamic Island', notch: 'Notch', punch: 'Punch-hole', waterdrop: 'Waterdrop', clean: 'Clean (no cutout)', bezel: 'Bezels + home button', keypad: 'Keypad + LCD', watch: 'Smartwatch', switch: 'Handheld + joy-cons', gameboy: 'Game Boy' },
  cams: { pro3: 'Pro triple (square)', dual: 'Dual (square)', vertical: 'Vertical lenses', bar: 'Camera bar', rog: 'Gaming angular', single: 'Single centred', triple: 'Triple (stacked)', none: 'None' },
  logo: { apple: 'Apple', samsung: 'Samsung', g: 'Google G', rog: 'ROG eye (RGB)', nokia: 'Nokia', none: 'None' },
};
function optLabel(k, e) {
  const n = (v) => +(+v).toFixed(2);
  switch (k) {
    case 'soc': return `${e.name} (${n(e.cpu)} pts · ${n(e.gpu)} GPU · ${n(e.tdp)} W)`;
    case 'glass': case 'back': return e.shatter ? `${e.name} (${n(e.tough)} J · Mohs ${n(e.hard)})` : `${e.name} (won't shatter · Mohs ${n(e.hard)})`;
    case 'frame': return `${e.name} (${n(e.dent)} J)`;
    case 'case': return `${e.name} (−${Math.round((1 - e.absorb) * 100)}%)`;
    case 'cooling': return `${e.name} (${n(e.h)} W/K)`;
    case 'ip': return `${e.name} (dust ${e.dust} · jets ${e.jets})`;
  }
}
function el(tag, props = {}, ...kids) { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; }
function row(label, ...kids) { return el('label', {}, label, ...kids); }
function markCustom() { $('preset').value = ''; }

function buildForm() {
  const f = $('specForm'); f.textContent = '';
  const name = el('input', { id: 'f_name', type: 'text' });
  name.onchange = () => { spec.name = name.value.slice(0, 60) || 'Custom phone'; markCustom(); refreshSpec(); };
  f.append(row('Name', name));
  for (const [k, label, table] of TABLES) {
    const sel = el('select', { id: 'f_' + k });
    sel.onchange = () => {
      spec[k] = sel.value === '__custom' ? S.setCustom(k, { name: 'Custom' }, table[spec[k]]) : sel.value;
      markCustom(); refreshSpec();
    };
    const box = el('div', { id: 'c_' + k, className: 'custom' });
    for (const fld of Object.keys(S.CUSTOM[k].fields)) {
      const inp = el('input', { type: 'number', step: 'any', id: `c_${k}_${fld}` });
      inp.onchange = () => {
        const cur = table[spec[k]], vals = { name: cur.name };
        for (const f2 of Object.keys(S.CUSTOM[k].fields)) vals[f2] = $(`c_${k}_${f2}`).value;
        spec[k] = S.setCustom(k, vals, cur); markCustom(); refreshSpec();
      };
      box.append(el('span', {}, F_LABEL[fld], inp));
    }
    const nm = el('input', { type: 'text', id: `c_${k}_name`, placeholder: 'name' });
    nm.onchange = () => { table[spec[k]].name = nm.value.slice(0, 40) || 'Custom'; refreshSpec(); };
    box.prepend(el('span', {}, 'Name', nm));
    f.append(row(label, sel), box);
  }
  for (const [k, label, lo, hi, step] of NUMS) {
    const inp = el('input', { id: 'f_' + k, type: 'number', min: lo, max: hi, step });
    inp.onchange = () => { spec[k] = clamp(Number(inp.value) || spec[k], lo, hi); markCustom(); refreshSpec(); };
    f.append(row(label, inp));
  }
  const size = el('span', { className: 'triple' });
  for (const [k, lo, hi] of [['w', 20, 2000], ['h', 30, 3000], ['t', 3, 200]]) {
    const inp = el('input', { id: 'f_size_' + k, type: 'number', min: lo, max: hi, step: 0.1, title: { w: 'width', h: 'height', t: 'thickness' }[k] + ' (mm)' });
    inp.onchange = () => { spec.size[k] = clamp(Number(inp.value) || spec.size[k], lo, hi); markCustom(); refreshSpec(); };
    size.append(inp);
  }
  f.append(row('Size W×H×T mm', size));
  f.append(el('h2', { style: 'margin-top:12px' }, 'Design'));
  for (const [k, label] of [['color', 'Body colour'], ['accent', 'Accent colour'], ['accent2', 'Accent 2']]) {
    const inp = el('input', { id: 'd_' + k, type: 'color' });
    inp.oninput = () => { spec.design[k] = inp.value; markCustom(); };
    f.append(row(label, inp));
  }
  for (const k of ['screen', 'cams', 'logo']) {
    const sel = el('select', { id: 'd_' + k });
    for (const opt of S.DESIGN[k]) sel.add(new Option(DESIGN_LABEL[k][opt], opt));
    sel.onchange = () => { spec.design[k] = sel.value; markCustom(); refreshSpec(); };
    f.append(row({ screen: 'Front style', cams: 'Cameras', logo: 'Logo' }[k], sel));
  }
  const corner = el('input', { id: 'd_corner', type: 'range', min: 0, max: 1, step: 0.05 });
  corner.oninput = () => { spec.design.corner = +corner.value; markCustom(); refreshSpec(); };
  f.append(row('Corner radius', corner));
}

function refreshSpec() {
  $('f_name').value = spec.name;
  for (const [k, , table] of TABLES) {
    const sel = $('f_' + k); sel.textContent = '';
    for (const [key, e] of Object.entries(table)) if (!key.startsWith('custom_') || key === 'custom_' + k) sel.add(new Option((key.startsWith('custom_') ? '✎ ' : '') + optLabel(k, e), key));
    if (!table['custom_' + k]) sel.add(new Option('✎ Custom…', '__custom'));
    sel.value = spec[k];
    const isC = spec[k].startsWith('custom_');
    $('c_' + k).style.display = isC ? 'grid' : 'none';
    if (isC) { const e = table[spec[k]]; $(`c_${k}_name`).value = e.name; for (const fld of Object.keys(S.CUSTOM[k].fields)) $(`c_${k}_${fld}`).value = e[fld]; }
  }
  for (const [k] of NUMS) $('f_' + k).value = spec[k];
  for (const k of ['w', 'h', 't']) $('f_size_' + k).value = spec.size[k];
  for (const k of ['color', 'accent', 'accent2', 'screen', 'cams', 'logo', 'corner']) $('d_' + k).value = spec.design[k];

  const m = spec.weight / 1000, g = S.GLASS[spec.glass], soc = S.SOCS[spec.soc], cool = S.COOLING[spec.cooling], ip = S.IP[spec.ip];
  const crackH = g.shatter ? g.tough / (m * GRAV * S.CASES[spec.case].absorb) : Infinity;
  const area = (spec.size.w * spec.size.h) / (77 * 163);
  const sustain = Math.min(1, (cool.h * Math.pow(area, 0.8) * 18 - 0.5) / soc.tdp);
  const ramAvail = spec.ramGB * 1024 * 0.7, dRam = Math.floor(ramAvail / S.APPS.doom.ram), dCpu = Math.floor(soc.cpu * 0.99 / S.APPS.doom.cpu);
  const bend = S.bendStrength(spec), diag = Math.hypot(spec.size.w * 0.92, spec.size.h * 0.9) / 25.4;
  $('derived').innerHTML = `
    <div>Screen-down crack height (50%, concrete): <b>${isFinite(crackH) ? crackH.toFixed(2) + ' m' : "won't shatter"}</b></div>
    <div>Scratches at Mohs <b>${g.hard}</b> ${g.hard < 7 ? '<span class="warn">(sand will scratch it)</span>' : '<span class="ok">(sand-proof)</span>'}</div>
    <div>Water: <b>${ip.depth ? `${ip.depth} m for ${ip.mins} min` : ip.jets ? 'splashes only' : 'no protection'}</b> · jets <b>${['none', 'splash', 'jets', 'hot high-pressure'][Math.round(ip.jets)]}</b></div>
    <div>Dust/sand: <b>${ip.dust >= 6 ? 'dust-tight' : ip.dust >= 5 ? 'dust-protected (some gets in)' : 'no protection'}</b></div>
    <div>Bend strength: <b>${bend.toFixed(1)}</b> ${bend >= 2.2 ? '<span class="ok">(passes)</span>' : bend >= 1.2 ? '<span class="warn">(bends)</span>' : '<span class="bad">(snaps)</span>'}</div>
    <div>Sustained performance: <b>${Math.round(sustain * 100)}%</b> of peak</div>
    <div>Max DOOMs at full 35 fps: <b>${Math.max(0, Math.min(dRam, dCpu))}</b> <span class="info">(${dRam < dCpu ? 'RAM' : 'CPU'}-limited)</span></div>
    <div class="info">${esc(soc.name)} · ${spec.ramGB >= 1 ? spec.ramGB + ' GB' : spec.ramGB * 1024 >= 1 ? Math.round(spec.ramGB * 1024) + ' MB' : Math.round(spec.ramGB * 1048576) + ' KB'} RAM · ${(spec.batteryMah * 3.85 / 1000).toFixed(1)} Wh · ~${diag.toFixed(1)}″ display</div>`;
  onSpecChanged();
}
function loadSpec(s, label) {
  spec = s; st = S.newState(env.ambient); apps = []; bench = null; holding = null;
  refreshSpec(); resetBody(); renderApps();
  log('info', `${label}: ${spec.name}`);
}

/* ---------------- software lab ---------------- */
function launch(key, n = 1) {
  if (st.power === 'dead') return log('warn', "Can't launch — the phone is dead");
  if (st.power === 'off') return log('warn', `Can't launch — phone is off (${st.offReason})`);
  const last = apps[apps.length - 1];
  if (last && last.key === key) last.count += n; else apps.push({ key, count: n });
  log('info', `Launched ${n > 1 ? n.toLocaleString() + '× ' : ''}${S.APPS[key].name}`);
  renderApps();
}
function renderApps() {
  const r = $('running'); r.textContent = '';
  if (!apps.length) { r.innerHTML = '<span class="info">Nothing running — home screen.</span>'; return; }
  apps.forEach((a, i) => {
    const A = S.APPS[a.key], fg = i === apps.length - 1;
    const name = el('span', { className: 'appname', title: 'Bring to front' }, `${fg ? '▶ ' : ''}${A.name} × ${a.count.toLocaleString()} (${(A.ram * a.count / 1024).toFixed(1)} GB)`);
    name.onclick = () => { apps.push(apps.splice(i, 1)[0]); renderApps(); };
    const x = el('button', {}, '✕'); x.onclick = () => { apps.splice(i, 1); renderApps(); };
    r.append(el('div', {}, name, x));
  });
}
function buildApps() {
  for (const [key, A] of Object.entries(S.APPS)) {
    if (A.hidden) continue;
    const b = el('button', {}, '+ ' + A.name); b.onclick = () => launch(key); $('appBtns').append(b);
    $('swarmApp').add(new Option(A.name, key));
  }
  $('swarmApp').value = 'doom';
  $('swarmGo').onclick = () => launch($('swarmApp').value, clamp(Math.floor(+$('swarmN').value) || 1, 1, 1e6));
  document.querySelectorAll('[data-swarm]').forEach(b => b.onclick = () => launch($('swarmApp').value, +b.dataset.swarm));
  $('killAll').onclick = () => { apps.length = 0; renderApps(); };
}

/* ---------------- benchmarks ---------------- */
function startBench(kind) {
  if (bench) return log('warn', 'A benchmark is already running');
  if (st.power !== 'on') return log('warn', 'Turn the phone on first');
  const entry = { key: { gb6: 'bench', '3dmark': 'bench', maxdoom: 'doom', crysis: 'crysis' }[kind], count: 1 };
  apps.push(entry); renderApps();
  bench = { kind, entry, t: 0, acc: 0, loop: 0, scores: [], best: 0,
    name: { gb6: 'Geekbench 6', '3dmark': '3DMark Wild Life Extreme Stress', maxdoom: 'Max DOOM finder', crysis: 'Can it run Crysis?' }[kind] };
  log('info', `Started ${bench.name}`);
}
function finishBench(msg, lvl = 'ok') {
  const b = bench; bench = null;
  const i = apps.indexOf(b.entry); if (i >= 0) apps.splice(i, 1);
  renderApps(); log(lvl, msg);
  $('results').prepend(el('div', { className: lvl }, `${spec.name}: ${msg}`));
}
function benchTick(dtSim, dtReal) {
  const b = bench; if (!b) return;
  if (st.power === 'dead') return finishBench(`${b.name} aborted — the phone died`, 'bad');
  if (!apps.includes(b.entry)) return finishBench(`${b.name} cancelled`, 'warn');
  if (st.power !== 'on') return; // paused while off/rebooting
  const soc = S.SOCS[spec.soc];
  switch (b.kind) {
    case 'gb6':
      b.t += dtSim; b.acc += tele.fps * dtSim;
      b.screen = { name: b.name, progress: b.t / 180, label: b.t < 60 ? 'Single-core…' : 'Multi-core…' };
      if (b.t >= 180) { const avg = b.acc / b.t; finishBench(`Geekbench 6 — single-core ${Math.round(soc.cpu * 0.36 * Math.pow(avg, 0.3)).toLocaleString()}, multi-core ${Math.round(soc.cpu * avg).toLocaleString()}`); }
      break;
    case '3dmark':
      b.t += dtSim; b.acc += tele.fps * dtSim;
      if (b.t >= 60) { b.scores.push(Math.round(soc.gpu * 40 * b.acc / b.t)); b.t = b.acc = 0; b.loop++; }
      b.screen = { name: '3DMark Stress', progress: (b.loop + b.t / 60) / 20, label: `Loop ${Math.min(b.loop + 1, 20)}/20 · last ${b.scores.at(-1) ?? '—'}`, scores: b.scores };
      if (b.loop >= 20) { const best = Math.max(...b.scores), worst = Math.min(...b.scores); finishBench(`3DMark stress — best loop ${best}, lowest ${worst}, stability ${(worst / best * 100).toFixed(1)}%`); }
      break;
    case 'maxdoom':
      if ((b.t += dtReal) < 1.2) break;
      b.t = 0;
      if (35 * tele.fps >= 30 && b.entry.count < 1e6) { b.best = b.entry.count; b.entry.count = Math.ceil(b.entry.count * 1.6); }
      else finishBench(`Max DOOM — ${b.best.toLocaleString()} instances at ≥30 fps (${b.entry.count.toLocaleString()} dropped to ${(35 * tele.fps).toFixed(1)} fps)`);
      break;
    case 'crysis': {
      b.t += dtReal; b.acc += 30 * tele.fps * dtReal;
      if (b.t < 6) break;
      const fps = b.acc / b.t;
      finishBench(`Can it run Crysis? ${fps >= 30 ? 'YES' : fps >= 15 ? 'Technically…' : fps >= 3 ? 'It runs. As a slideshow.' : 'No.'} (${fps.toFixed(1)} fps avg)`, fps >= 15 ? 'ok' : 'warn');
      break;
    }
  }
}

/* ---------------- telemetry ---------------- */
const chart = $('chart'), chg = chart.getContext('2d');
function drawChart() {
  const r = chart.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  if (chart.width !== Math.round(r.width * dpr)) { chart.width = r.width * dpr; chart.height = r.height * dpr; }
  const g = chg, w = r.width, h = r.height; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const y = (v) => h - 4 - clamp(v, -20, 110) / 100 * (h - 8);
  g.font = '9px monospace'; g.fillStyle = '#7d8896'; g.strokeStyle = '#ffffff12';
  for (const v of [0, 25, 50, 75]) { g.beginPath(); g.moveTo(0, y(v)); g.lineTo(w, y(v)); g.stroke(); g.fillText(v + '°', 2, y(v) - 2); }
  const line = (k, col, f = (v) => v) => { g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); history.forEach((s, i) => { const X = w * i / 149, Y = y(f(s[k])); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke(); };
  line('f', '#68d39188', (v) => v * 100); line('Ts', '#fc5c65'); line('T', '#f6ad55');
  g.fillStyle = '#f6ad55'; g.fillText('skin', w - 70, 10); g.fillStyle = '#fc5c65'; g.fillText('SoC', w - 46, 10); g.fillStyle = '#68d391'; g.fillText('perf', w - 24, 10);
}
function updateUI() {
  const fg = apps[apps.length - 1], A = fg && S.APPS[fg.key], Wh = spec.batteryMah * 3.85 / 1000, on = st.power === 'on';
  const rows = [
    ['Load', on ? `${Math.round(tele.load * 100)}%` : '—'], ['Power', `${tele.power.toFixed(1)} W`],
    ['Skin', `${st.T.toFixed(1)} °C`], ['SoC', `${st.Tsoc.toFixed(1)} °C`],
    ['Throttle', `${Math.round(st.throttle * 100)}%`], [A ? A.unit : 'fps', on ? ((A ? A.fps : 60) * tele.fps).toFixed(1) : '—'],
    ['RAM', `${(tele.ram / 1024).toFixed(1)}/${(tele.ramAvail / 1024).toFixed(1)} GB`], ['Swap', tele.swap > 1 ? `×${tele.swap.toFixed(1)} slower` : 'none'],
    ['Battery', `${st.battery.toFixed(0)}%`], ['Runtime', on && tele.power > 0 ? fmtDur(Wh * st.battery / 100 / tele.power * 60) + ' h' : '—'],
  ];
  $('stats').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span>${v}</div>`).join('');
  const bars = [['Screen', 100 - st.screen], ['Back panel', 100 - st.back], ['Frame', 100 - st.frame], ['Logic board', 100 - st.board],
    ['Camera', 100 - st.camera], ['USB-C port', 100 - st.port], ['Speaker', 100 - st.speaker], ['Buttons', 100 - st.buttons],
    ['Water ingress', st.ingress, true], ['Sand ingress', st.sand, true], ['Battery swelling', st.swell * 100, true], ['IP seal', S.sealIntegrity(st) * 100]];
  $('health').innerHTML = bars.map(([k, v, inv]) => {
    const good = inv ? 100 - v : v, col = good > 70 ? 'var(--ok)' : good > 35 ? 'var(--warn)' : 'var(--bad)';
    return `<div class="hl"><span>${k}</span><span>${Math.round(clamp(v, 0, 100))}%</span></div><div class="bar"><i style="width:${clamp(v, 0, 100)}%;background:${col}"></i></div>`;
  }).join('');
  const [txt, bgc, col] = st.fire && st.fireT < 120 ? ['🔥 ON FIRE', '#4a1a0a', '#ff9a3c'] : st.power === 'dead' ? [`☠ DEAD — ${st.deadReason}`, '#2e1838', 'var(--dead)']
    : st.power === 'off' ? [`OFF — ${st.offReason}`, '#2a2a2a', 'var(--dim)'] : st.power === 'rebooting' ? ['REBOOTING', '#33300f', 'var(--warn)']
    : st.smoke > 0.05 ? ['💨 SMOKING', '#3a1519', 'var(--bad)'] : tele.swap > 1 ? ['SWAPPING', '#33300f', 'var(--warn)']
    : st.throttle < 0.95 ? ['THROTTLING', '#33300f', 'var(--warn)'] : ['ONLINE', '#123430', 'var(--ok)'];
  const badge = $('badge'); badge.textContent = txt; badge.style.background = bgc; badge.style.color = col;
  drawChart();
}

/* ---------------- controls ---------------- */
const ENV_PRESETS = {
  room: ['Room', 25, false, 1], pocket: ['Jeans pocket', 33, false, 0.6], pillow: ['Under a pillow', 28, false, 0.3], car: ['Car dashboard, summer', 65, true, 1],
  sahara: ['Sahara noon', 45, true, 1.2], sauna: ['Sauna', 90, false, 1], fridge: ['Fridge', 4, false, 1], freezer: ['Freezer', -18, false, 1],
  everest: ['Everest summit (wind)', -30, true, 2], antarctica: ['Antarctica winter', -60, false, 1.5],
};
for (const [k, [name, T]] of Object.entries(ENV_PRESETS)) $('envPreset').add(new Option(`${name} (${T} °C)`, k));
$('envPreset').onchange = (e) => {
  const [name, T, sun, hmul] = ENV_PRESETS[e.target.value];
  Object.assign(env, { ambient: T, sun, hmul }); $('ambient').value = T; $('ambVal').textContent = T + ' °C'; $('sun').checked = sun;
  log('info', `Environment: ${name}`);
};
$('ambient').oninput = (e) => { env.ambient = +e.target.value; $('ambVal').textContent = env.ambient + ' °C'; };
$('sun').onchange = (e) => env.sun = e.target.checked;
$('protect').onchange = (e) => { env.unsafe = !e.target.checked; log(env.unsafe ? 'bad' : 'ok', env.unsafe ? 'Thermal protection OFF — chip overvolted 3×, no throttling. Good luck.' : 'Thermal protection ON'); };
$('speed').onchange = (e) => env.speed = +e.target.value;
$('flip').onclick = () => { view = view === 'front' ? 'back' : 'front'; $('flip').textContent = view === 'front' ? '↻ Show back' : '↻ Show front'; };
$('charge').onclick = () => {
  if (st.power === 'dead') return log('warn', "It's dead, Jim. Charging won't help.");
  if (st.port >= 50) return log('warn', 'USB-C port is damaged — the charger won\'t connect');
  if (st.sand > 35) return log('warn', 'USB-C port is packed with sand — charging intermittent, gave up');
  if (st.ingress > 5) return log('warn', 'Liquid detected in the USB-C connector — charging disabled');
  st.battery = 100; if (st.power === 'off' && st.offReason === 'battery') { st.power = 'rebooting'; st.rebootT = 3; }
  log('ok', 'Charged to 100%');
};
$('newPhone').onclick = () => loadSpec(spec, 'Fresh unit');
$('preset').add(new Option('— custom —', ''));
for (const grp of [...new Set(S.PRESETS.map(p => p.group))]) {
  const og = el('optgroup', { label: grp });
  S.PRESETS.forEach((p, i) => { if (p.group === grp) og.append(new Option(p.name, i)); });
  $('preset').append(og);
}
$('preset').onchange = (e) => { if (e.target.value !== '') loadSpec(structuredClone(S.PRESETS[+e.target.value].spec), 'Loaded'); };
document.querySelectorAll('[data-bench]').forEach(b => b.onclick = () => startBench(b.dataset.bench));
$('jsonBtn').onclick = () => { $('json').value = JSON.stringify(S.exportSpec(spec), null, 2); $('dlg').showModal(); };
$('jsonClose').onclick = () => $('dlg').close();
$('jsonApply').onclick = () => {
  try {
    const { spec: s, warnings } = S.validateSpec(JSON.parse($('json').value));
    warnings.forEach(w => log('warn', 'Import: ' + w));
    markCustom(); loadSpec(s, 'Imported'); $('dlg').close();
  } catch (err) { log('bad', 'Import failed: ' + err.message); alert('Import failed: ' + err.message); }
};
$('jsonFile').onclick = () => $('file').click();
$('file').onchange = async (e) => { const f = e.target.files[0]; if (f) $('json').value = await f.text(); e.target.value = ''; };
$('jsonSave').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([$('json').value], { type: 'application/json' }));
  a.download = (spec.name || 'phone').replace(/[^\w-]+/g, '_') + '.json'; a.click(); URL.revokeObjectURL(a.href);
};
