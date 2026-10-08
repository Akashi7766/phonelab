/* PhoneLab rendering: phone designs, screen contents, damage overlays, close-up effects. Depends on Sim. */
(function (root) {
'use strict';
const S = root.Sim;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rand = (a, b) => a + Math.random() * (b - a);
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
function shade(hex, k) { // k < 0 darker, k > 0 lighter
  const n = parseInt(hex.slice(1), 16), f = (c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function poly(g, color, pts) { g.fillStyle = color; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); }
const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ---------- geometry ---------- */
function geometry(spec, box) {
  const d = spec.design, { w: mw, h: mh } = spec.size;
  const s = Math.min(box.w / mw, box.h / mh), w = mw * s, h = mh * s;
  const x = box.x + (box.w - w) / 2, y = box.y + (box.h - h) / 2, r = d.corner * Math.min(w, h) * 0.22;
  const fw = spec.frame === 'rugged' ? w * 0.07 : Math.max(2, w * 0.012);
  const face = { x: x + fw, y: y + fw, w: w - 2 * fw, h: h - 2 * fw, r: Math.max(2, r - fw) };
  const bez = face.w * 0.03;
  let scr;
  if (d.screen === 'bezel') scr = { x: face.x + face.w * 0.04, y: y + h * 0.12, w: face.w * 0.92, h: h * 0.76, r: 3 };
  else if (d.screen === 'keypad') scr = { x: x + w * 0.17, y: y + h * 0.15, w: w * 0.66, h: h * 0.25, r: 6 };
  else if (d.screen === 'gameboy') scr = { x: x + w * 0.24, y: y + h * 0.11, w: w * 0.52, h: h * 0.3, r: 2 };
  else if (d.screen === 'switch') scr = { x: x + w * 0.19, y: y + h * 0.1, w: w * 0.62, h: h * 0.8, r: 4 };
  else if (d.screen === 'watch') scr = { x: face.x + face.w * 0.08, y: face.y + face.h * 0.08, w: face.w * 0.84, h: face.h * 0.84, r: face.r * 0.8 };
  else scr = { x: face.x + bez, y: face.y + bez, w: face.w - 2 * bez, h: face.h - 2 * bez, r: Math.max(2, face.r - bez) };
  return { x, y, w, h, r, s, fw, face, scr };
}
const mapF = (F, u, v) => [F.x + u * F.w, F.y + v * F.h];

/* ---------- screen contents ---------- */
let llmText = '';
const LLM = 'Your phone is getting hot because a language model is doing billions of multiply-accumulates per token on a passively cooled slab of glass. The governor will throttle soon. Maybe not in direct sunlight. '.split(' ');
const TILES = {
  home(g, w, h) {
    const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#5b3cc4'); bg.addColorStop(1, '#1fa2a6'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = `200 ${w * 0.2}px system-ui`; g.textAlign = 'center'; g.fillText(new Date().toTimeString().slice(0, 5), w / 2, h * 0.2);
    const cols = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f1c', '#2ec4b6', '#e71d36'], c = w / 4.6;
    for (let i = 0; i < 16; i++) { g.fillStyle = cols[i % 8]; rr(g, c * 0.4 + (i % 4) * c * 1.05, h * 0.28 + Math.floor(i / 4) * c * 1.3, c * 0.75, c * 0.75, c * 0.2); g.fill(); }
    g.fillStyle = '#ffffff30'; rr(g, w * 0.04, h * 0.86, w * 0.92, h * 0.11, w * 0.08); g.fill();
  },
  lcdhome(g, w, h) {
    g.fillStyle = '#9ab86a'; g.fillRect(0, 0, w, h); g.fillStyle = '#26331a'; g.textAlign = 'center';
    g.font = `bold ${h * 0.2}px monospace`; g.fillText('NOKIA', w / 2, h * 0.5);
    g.font = `${h * 0.13}px monospace`; g.fillText(new Date().toTimeString().slice(0, 5), w / 2, h * 0.75);
    for (let k = 0; k < 4; k++) g.fillRect(w * 0.05, h * (0.75 - k * 0.12), w * 0.04, h * 0.08);
    g.fillText('Menu', w / 2, h * 0.95);
  },
  gbhome(g, w, h, t) {
    g.fillStyle = '#9bbc0f'; g.fillRect(0, 0, w, h); g.fillStyle = '#0f380f'; g.textAlign = 'center';
    const y = Math.min(h * 0.5, (t % 4) / 2 * h * 0.5);
    g.font = `bold ${h * 0.16}px system-ui`; g.fillText('Nintendo®', w / 2, y);
  },
  tetris(g, w, h, t, i) {
    g.fillStyle = '#9bbc0f'; g.fillRect(0, 0, w, h);
    const c = Math.max(2, Math.floor(Math.min(w / 10, h / 18))), ox = (w - c * 10) / 2;
    g.fillStyle = '#306230'; g.fillRect(ox - 2, 0, 2, h); g.fillRect(ox + c * 10, 0, 2, h);
    g.fillStyle = '#0f380f';
    for (let r = 0; r < 18; r++) for (let k = 0; k < 10; k++) if (r > 12 && hash(r * 10 + k + i) > 0.35 && !(r === 17 && k === 4)) g.fillRect(ox + k * c, r * c, c - 1, c - 1);
    const drop = Math.floor(t * 3 + i) % 12, px = ox + ((i * 3) % 7) * c;
    for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [1, 1]]) g.fillRect(px + dx * c, (drop + dy) * c, c - 1, c - 1);
  },
  snake(g, w, h, t, i) {
    g.fillStyle = '#9ab86a'; g.fillRect(0, 0, w, h);
    const c = Math.max(2, Math.floor(Math.min(w, h) / 12)), cols = Math.max(2, Math.floor(w / c) - 1), rows = Math.max(2, Math.floor(h / c) - 1);
    g.fillStyle = '#26331a'; g.strokeStyle = '#26331a'; g.strokeRect(1, 1, w - 2, h - 2);
    const head = Math.floor(t * 8) + i * 13;
    for (let k = 0; k < 9; k++) {
      const p = head - k, row = Math.floor(p / cols) % rows, col = row % 2 ? cols - 1 - (p % cols) : p % cols;
      g.fillRect(c * 0.5 + col * c, c * 0.5 + row * c, c - 1, c - 1);
    }
    g.fillRect(c * 0.5 + Math.floor(hash(i) * cols) * c, c * 0.5 + Math.floor(hash(i + 9) * rows) * c, c * 0.6, c * 0.6);
  },
  doom(g, w, h, t, i) {
    g.fillStyle = '#2f2f2f'; g.fillRect(0, 0, w, h * 0.45);
    g.fillStyle = '#4a3b2a'; g.fillRect(0, h * 0.45, w, h * 0.4);
    g.fillStyle = '#555'; g.fillRect(0, h * 0.85, w, h * 0.15);
    const cx = w / 2 + Math.sin(t * 1.7 + i * 1.3) * w * 0.15, fx0 = cx - w * 0.16, fx1 = cx + w * 0.16, fy0 = h * 0.3, fy1 = h * 0.62;
    poly(g, '#6d5a43', [[0, 0], [fx0, fy0], [fx0, fy1], [0, h * 0.85]]);
    poly(g, '#57462f', [[w, 0], [fx1, fy0], [fx1, fy1], [w, h * 0.85]]);
    g.fillStyle = '#7b2a1d'; g.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    g.fillStyle = '#b5652d'; g.beginPath(); g.arc(cx + Math.sin(t * 2.3 + i) * w * 0.1, h * 0.5, w * 0.05, 0, 7); g.fill();
    if ((t * 3 + i * 0.37) % 1 < 0.15) { g.fillStyle = '#ffd34d'; g.fillRect(w * 0.46, h * 0.62, w * 0.08, h * 0.08); }
    g.fillStyle = '#8c8c8c'; g.fillRect(w * 0.45, h * 0.68, w * 0.1, h * 0.17);
    g.fillStyle = '#c22'; g.fillRect(w * 0.05, h * 0.88, w * 0.15, h * 0.08);
    g.fillStyle = '#d9b38c'; g.fillRect(w * 0.45, h * 0.87, w * 0.1, h * 0.12);
  },
  flappy(g, w, h, t, i) {
    g.fillStyle = '#4ec0ca'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ded895'; g.fillRect(0, h * 0.88, w, h * 0.12);
    for (let k = 0; k < 3; k++) {
      const px = w - ((t * w * 0.45 + k * w * 0.6 + i * 37) % (w * 1.8)), gy = h * (0.25 + 0.4 * hash(k + i * 3 + Math.floor((t * w * 0.45 + k * w * 0.6 + i * 37) / (w * 1.8))));
      g.fillStyle = '#5ec639'; g.fillRect(px, 0, w * 0.16, gy); g.fillRect(px, gy + h * 0.3, w * 0.16, h * 0.88 - gy - h * 0.3);
    }
    g.fillStyle = '#f8d33a'; g.beginPath(); g.arc(w * 0.3, h * 0.45 + Math.sin(t * 5 + i) * h * 0.1, Math.max(1, w * 0.05), 0, 7); g.fill();
  },
  chrome(g, w, h, t, i, info) {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#eee'; g.fillRect(0, 0, w, h * 0.08);
    g.fillStyle = '#ddd'; rr(g, w * 0.04, h * 0.015, w * 0.75, h * 0.05, h * 0.025); g.fill();
    g.strokeStyle = '#555'; g.strokeRect(w * 0.84, h * 0.017, w * 0.11, h * 0.045);
    g.fillStyle = '#333'; g.font = `bold ${h * 0.03}px system-ui`; g.textAlign = 'center'; g.fillText(info.count > 99 ? ':D' : info.count, w * 0.895, h * 0.052);
    const sc = (t * h * 0.08 + i * 50) % (h * 0.4);
    for (let k = 0; k < 18; k++) { g.fillStyle = k % 6 === 0 ? '#c9d6ea' : '#d5d5d5'; g.fillRect(w * 0.06, h * 0.12 + k * h * 0.05 - sc, k % 6 === 0 ? w * 0.88 : w * 0.88 * (0.5 + (k * 37 % 50) / 100), k % 6 === 0 ? h * 0.12 : h * 0.018); }
  },
  call(g, w, h, t, i, info) {
    g.fillStyle = '#1c2533'; g.fillRect(0, 0, w, h);
    const bob = Math.sin(t * 2 + i) * h * 0.01;
    g.fillStyle = '#3a4a63'; g.beginPath(); g.ellipse(w / 2, h * 0.95, w * 0.45, h * 0.28, 0, 0, 7); g.fill();
    g.fillStyle = '#d9a37a'; g.beginPath(); g.arc(w / 2, h * 0.45 + bob, w * 0.2, 0, 7); g.fill();
    g.fillStyle = '#3b2a1e'; g.beginPath(); g.arc(w / 2, h * 0.4 + bob, w * 0.21, Math.PI, 0); g.fill();
    g.fillStyle = (t + i) % 3 < 0.15 ? '#d9a37a' : '#222'; g.fillRect(w * 0.42, h * 0.44 + bob, w * 0.04, h * 0.015); g.fillRect(w * 0.54, h * 0.44 + bob, w * 0.04, h * 0.015);
    g.fillStyle = info.camOK ? '#5d6b52' : '#000'; rr(g, w * 0.66, h * 0.06, w * 0.28, h * 0.2, w * 0.03); g.fill();
    if (!info.camOK) { g.fillStyle = '#fc5c65'; g.font = `${w * 0.05}px system-ui`; g.textAlign = 'center'; g.fillText('⚠ no camera', w * 0.8, h * 0.17); }
    g.fillStyle = '#e53935'; g.beginPath(); g.arc(w / 2, h * 0.9, w * 0.07, 0, 7); g.fill();
  },
  video(g, w, h, t, i, info) {
    if (!info.camOK) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fc5c65'; g.font = `${w * 0.07}px system-ui`; g.textAlign = 'center'; g.fillText('Camera failed', w / 2, h / 2); return; }
    const bg = g.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, h); bg.addColorStop(0, '#5f6b55'); bg.addColorStop(1, '#151810'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 200; k++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#2c3427'; g.beginPath(); g.arc(w / 2 + Math.sin(t + i) * w * 0.1, h * 0.55, w * 0.22, 0, 7); g.fill();
    g.strokeStyle = '#ffd400'; g.strokeRect(w * 0.35, h * 0.42, w * 0.3, w * 0.3);
    g.fillStyle = (t % 1) < 0.5 ? '#f33' : '#600'; g.beginPath(); g.arc(w * 0.09, h * 0.09, w * 0.025, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = `${w * 0.055}px monospace`; g.textAlign = 'left'; g.fillText(`REC ${fmtDur(t)} 4K60`, w * 0.14, h * 0.1);
  },
  minecraft(g, w, h, t, i) {
    g.fillStyle = '#8ec5ff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff6a0'; g.fillRect(w * 0.72, h * 0.08, w * 0.12, w * 0.12);
    const c = w / 10, off = (t * 1.5 + i * 3);
    for (let col = -1; col < 11; col++) {
      const wx = Math.floor(off) + col, top = h * 0.55 + Math.round(hash(wx) * 3) * c;
      const x = (col - (off % 1)) * c;
      g.fillStyle = '#6aa84f'; g.fillRect(x, top, c + 0.5, c * 0.35);
      g.fillStyle = '#8b5a2b'; g.fillRect(x, top + c * 0.35, c + 0.5, h - top);
      if (hash(wx + 50) > 0.8) { g.fillStyle = '#6b4423'; g.fillRect(x + c * 0.35, top - c * 2, c * 0.3, c * 2); g.fillStyle = '#2f7d32'; g.fillRect(x - c * 0.5, top - c * 3, c * 2, c * 1.2); }
    }
    g.fillStyle = '#0006'; g.fillRect(w * 0.15, h * 0.92, w * 0.7, h * 0.06);
  },
  genshin(g, w, h, t) {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#5aa9e6'); sky.addColorStop(0.6, '#f7c6a3'); sky.addColorStop(1, '#7fb069'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const layer = (base, amp, col, sp) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += Math.max(2, w / 40)) g.lineTo(x, base + Math.sin((x + t * sp) * 4 / w) * amp + Math.sin((x + t * sp) * 11 / w) * amp * 0.5); g.lineTo(w, h); g.fill(); };
    layer(h * 0.45, h * 0.06, '#8a9fc4', w * 0.1); layer(h * 0.58, h * 0.045, '#5d8a5b', w * 0.25); layer(h * 0.72, h * 0.03, '#3f6e3c', w * 0.5);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, h * 0.7 - Math.abs(Math.sin(t * 6)) * h * 0.02, w * 0.03, 0, 7); g.fill();
    g.fillStyle = '#ffffff55'; g.beginPath(); g.arc(w * 0.13, h * 0.1, w * 0.1, 0, 7); g.fill();
  },
  fortnite(g, w, h, t, i) {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#6a3fb5'); sky.addColorStop(1, '#3fa7d6'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3c8d2f'; g.fillRect(0, h * 0.7, w, h * 0.3);
    for (let k = 0; k < 4; k++) { const x = ((k * w * 0.3 - t * w * 0.05 + i * 20) % (w * 1.2) + w * 1.2) % (w * 1.2) - w * 0.1; poly(g, '#c49a6c', [[x, h * 0.7], [x + w * 0.2, h * (0.4 + 0.1 * k % 0.3)], [x + w * 0.24, h * (0.4 + 0.1 * k % 0.3)], [x + w * 0.04, h * 0.7]]); }
    g.strokeStyle = '#d65cff'; g.lineWidth = Math.max(1, w * 0.02); g.beginPath(); g.arc(w / 2, h * 0.7, w * (0.9 - (t * 0.02 % 0.4)), Math.PI, 0); g.stroke();
    g.fillStyle = '#222'; g.fillRect(w * 0.48, h * 0.6 + Math.sin(t * 8 + i) * 2, w * 0.05, h * 0.1);
  },
  llm(g, w, h) {
    g.fillStyle = '#111418'; g.fillRect(0, 0, w, h);
    const f = Math.max(5, w * 0.05);
    g.fillStyle = '#4fd1c5'; g.font = `${f}px monospace`; g.textAlign = 'left'; g.fillText('> why is my phone hot?', w * 0.04, f * 1.5);
    g.fillStyle = '#d9dfe7'; let line = '', y = f * 3;
    for (const word of llmText.split(' ')) { if (g.measureText(line + word).width > w * 0.92) { g.fillText(line, w * 0.04, y); y += f * 1.3; line = ''; } line += word + ' '; }
    g.fillText(line + '█', w * 0.04, y);
  },
  miner(g, w, h, t, i) {
    g.fillStyle = '#050805'; g.fillRect(0, 0, w, h);
    const f = Math.max(5, w * 0.045); g.font = `${f}px monospace`; g.textAlign = 'left';
    for (let k = 0; k < h / (f * 1.2); k++) {
      const n = Math.floor(t * 6) + k + i * 7;
      g.fillStyle = hash(n) > 0.97 ? '#f2a900' : '#2f9e44';
      g.fillText(hash(n) > 0.97 ? 'BLOCK FOUND! +0.00000001' : Math.floor(hash(n) * 1e15).toString(16).padStart(12, '0') + '…', w * 0.03, (k + 1) * f * 1.2);
    }
  },
  stress(g, w, h, t) {
    g.fillStyle = '#0d0d12'; g.fillRect(0, 0, w, h); g.fillStyle = '#fc5c65'; g.font = `bold ${w * 0.07}px system-ui`; g.textAlign = 'center'; g.fillText('STRESS TEST', w / 2, h * 0.1);
    for (let k = 0; k < 8; k++) { const v = 0.85 + Math.random() * 0.15, bw = w * 0.08; g.fillStyle = '#222'; g.fillRect(w * 0.08 + k * w * 0.105, h * 0.15, bw, h * 0.3); g.fillStyle = `hsl(${10 + k * 4},90%,55%)`; g.fillRect(w * 0.08 + k * w * 0.105, h * 0.15 + h * 0.3 * (1 - v), bw, h * 0.3 * v); }
    g.save(); g.translate(w / 2, h * 0.7); g.rotate(t * 2); g.strokeStyle = '#4fd1c5'; g.lineWidth = 2;
    for (let k = 0; k < 6; k++) { g.rotate(Math.PI / 3); g.strokeRect(-w * 0.18, -w * 0.18, w * 0.36, w * 0.36); } g.restore();
  },
  gta(g, w, h, t, i) {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.6); sky.addColorStop(0, '#ff8a5b'); sky.addColorStop(1, '#ffd29d'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 12; k++) { const x = ((k * w * 0.12 - t * w * 0.1 + i * 9) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2; g.fillStyle = '#3d3355'; g.fillRect(x, h * (0.25 + hash(k) * 0.2), w * 0.1, h * 0.4); }
    g.fillStyle = '#333'; g.fillRect(0, h * 0.65, w, h * 0.35); g.fillStyle = '#ddd';
    for (let k = 0; k < 6; k++) g.fillRect(((k * w * 0.25 - t * w * 0.6) % w + w) % w, h * 0.8, w * 0.1, h * 0.01);
    g.fillStyle = '#c0392b'; rr(g, w * 0.4, h * 0.72, w * 0.2, h * 0.06, 3); g.fill();
    g.fillStyle = '#0008'; g.beginPath(); g.arc(w * 0.14, h * 0.88, w * 0.1, 0, 7); g.fill();
  },
  crysis(g, w, h, t) {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#86c5da'); sky.addColorStop(1, '#173d1b'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 9; k++) { const x = (k * w * 0.24 + t * w * 0.1) % (w * 1.3) - w * 0.15; g.strokeStyle = '#4a3220'; g.lineWidth = Math.max(1, w * 0.02); g.beginPath(); g.moveTo(x, h); g.lineTo(x + w * 0.05, h * 0.45); g.stroke(); g.fillStyle = '#2f6b2a'; g.beginPath(); g.ellipse(x + w * 0.05, h * 0.45, w * 0.14, h * 0.02, 0.3, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.font = `bold ${w * 0.08}px system-ui`; g.textAlign = 'center'; g.fillText('CRYSIS', w / 2, h * 0.12);
  },
  bench(g, w, h, t, i, info) {
    const b = info.bench || { name: 'Benchmark', progress: 0, label: '' };
    g.fillStyle = '#0b1220'; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h * 0.4); g.rotate(t); g.strokeStyle = '#4fd1c5'; g.lineWidth = 2;
    for (let k = 0; k < 5; k++) { g.rotate(0.6); g.strokeRect(-w * 0.2, -w * 0.2, w * 0.4, w * 0.4); } g.restore();
    g.fillStyle = '#fff'; g.font = `bold ${w * 0.06}px system-ui`; g.textAlign = 'center'; g.fillText(b.name, w / 2, h * 0.12);
    g.fillStyle = '#9fb3c8'; g.font = `${w * 0.05}px system-ui`; g.fillText(b.label, w / 2, h * 0.7);
    g.fillStyle = '#223'; g.fillRect(w * 0.1, h * 0.75, w * 0.8, h * 0.015); g.fillStyle = '#4fd1c5'; g.fillRect(w * 0.1, h * 0.75, w * 0.8 * b.progress, h * 0.015);
    if (b.scores?.length) { const mx = Math.max(...b.scores); b.scores.forEach((s, k) => { g.fillStyle = '#4fd1c5'; const bh = h * 0.12 * s / mx; g.fillRect(w * 0.1 + k * w * 0.04, h * 0.95 - bh, w * 0.03, bh); }); }
  },
};

function renderApp(g, w, h, t, app, info) {
  if (!app) return TILES[info.gb ? 'gbhome' : info.lcd ? 'lcdhome' : 'home'](g, w, h, t, 0, info);
  const A = S.APPS[app.key], n = app.count, top = h * 0.045, area = h - top, shown = Math.min(n, 900);
  if (app.key === 'llm') { llmText += LLM[llmText.split(' ').length % LLM.length] + ' '; if (llmText.length > 700) llmText = ''; }
  info.count = n;
  if (n === 1) { TILES[app.key](g, w, h, t, 0, info); return; }
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const cols = Math.max(1, Math.ceil(Math.sqrt(shown * w / (area * 1.4)))), rows = Math.ceil(shown / cols);
  const tw = w / cols, th = Math.min(tw * 1.4, area / rows), gap = tw > 8 ? 1 : 0;
  for (let i = 0; i < shown; i++) {
    const x = (i % cols) * tw, y = top + Math.floor(i / cols) * th;
    if (tw < 5) { g.fillStyle = A.color; g.fillRect(x, y, tw - gap, th - gap); if (hash(i + Math.floor(t * 6)) > 0.8) { g.fillStyle = '#0004'; g.fillRect(x, y, tw - gap, th - gap); } continue; }
    g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, tw - gap, th - gap); g.clip();
    TILES[app.key](g, tw - gap, th - gap, t, i, info); g.restore();
  }
  g.fillStyle = '#000c'; g.fillRect(0, h - h * 0.045, w, h * 0.045);
  g.fillStyle = '#f6ad55'; g.font = `${h * 0.025}px monospace`; g.textAlign = 'center';
  g.fillText(`${A.name} ×${n}${n > shown ? ` (${n - shown} off-screen)` : ''}`, w / 2, h - h * 0.012);
}

const bufs = new Map(); // one cached screen image per render size (close-up, 3D textures…)
function getBuf(w, h) {
  const k = w + 'x' + h;
  let b = bufs.get(k);
  if (!b) { if (bufs.size > 8) bufs.clear(); const c = document.createElement('canvas'); c.width = w; c.height = h; b = { c, g: c.getContext('2d'), last: -1, key: '' }; bufs.set(k, b); }
  return b;
}
let glitch = [];

/* Draw the display into rect R. info = { apps, tele, time, toast, bench } */
function screen(g, R, spec, st, info) {
  const lcd = spec.design.screen === 'keypad' || spec.design.screen === 'gameboy', f = R.w / 222, t = info.time;
  g.fillStyle = lcd ? '#5d6e3f' : '#000'; g.fillRect(R.x, R.y, R.w, R.h);
  const txt = (s, y, color = '#d9dfe7', size = 14, weight = '') => { g.fillStyle = color; g.font = `${weight} ${size * f}px system-ui`; g.textAlign = 'center'; g.fillText(s, R.x + R.w / 2, R.y + y * R.h); };
  if (st.power === 'dead') { if (st.sparks && Math.random() < 0.05) { g.fillStyle = '#fff2'; g.fillRect(R.x, R.y, R.w, R.h); } return; }
  if (st.power === 'rebooting') {
    txt('⏻', 0.45, '#fff', 44);
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(R.x + R.w / 2, R.y + R.h * 0.62, 12 * f, t * 6, t * 6 + 4.5); g.stroke();
    txt('rebooting…', 0.72, '#888', 12); return;
  }
  if (st.power === 'off') {
    if (st.offReason === 'thermal') { txt('🌡️', 0.36, '#f6ad55', 50); txt('Temperature', 0.47, '#fff', 18, 'bold'); txt('Phone needs to cool down', 0.53); txt(`${st.T.toFixed(0)} °C`, 0.61, '#f6ad55'); }
    else if (st.offReason === 'cold') { txt('❄️', 0.4, '#9fd3ff', 44); txt(`Too cold: ${st.T.toFixed(0)} °C`, 0.52, '#9fd3ff', 14); }
    else if (st.offReason === 'battery' && t % 1.4 < 0.7) { g.strokeStyle = '#fc5c65'; g.lineWidth = 3; g.strokeRect(R.x + R.w / 2 - 30 * f, R.y + R.h / 2 - 14 * f, 60 * f, 28 * f); }
    return;
  }
  if (st.screen >= 100) return;
  if (st.sparks && Math.random() < 0.25) return;

  const apps = info.apps, fg = apps[apps.length - 1], A = fg && S.APPS[fg.key];
  const w = Math.max(1, Math.round(R.w)), h = Math.max(1, Math.round(R.h)), key = fg ? fg.key + fg.count : '', B = getBuf(w, h);
  const rate = (A ? A.fps : 60) * info.tele.fps;
  if (key !== B.key || B.last < 0 || t - B.last >= 1 / Math.max(0.2, rate)) {
    B.key = key; B.last = t;
    renderApp(B.g, w, h, t, fg, { ...info, camOK: st.camera < 60, lcd, gb: spec.design.screen === 'gameboy' });
  }
  g.drawImage(B.c, R.x, R.y, R.w, R.h);
  if (lcd) { g.globalCompositeOperation = 'multiply'; g.fillStyle = '#9ab86a'; g.fillRect(R.x, R.y, R.w, R.h); g.globalCompositeOperation = 'source-over'; }
  if (st.T > 42) { g.fillStyle = `rgba(0,0,0,${clamp((st.T - 42) / 16, 0, 0.55)})`; g.fillRect(R.x, R.y, R.w, R.h); } // hot phones dim the display

  const sb = Math.max(12, 22 * f);
  g.fillStyle = '#000a'; g.fillRect(R.x, R.y, R.w, sb);
  g.font = `${Math.max(8, 11 * f)}px system-ui`; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(new Date().toTimeString().slice(0, 5), R.x + 20 * f, R.y + sb * 0.7);
  g.textAlign = 'right'; g.fillStyle = st.T > 43 ? '#f6ad55' : st.T < 0 ? '#9fd3ff' : '#fff';
  g.fillText(`${st.T.toFixed(0)}°C ${Math.round(st.battery)}%`, R.x + R.w - 16 * f, R.y + sb * 0.7);
  if (A) {
    const fr = A.fps * info.tele.fps;
    g.fillStyle = '#000b'; g.fillRect(R.x + R.w - 78 * f, R.y + sb + 4, 72 * f, 16 * f);
    g.fillStyle = fr > A.fps * 0.8 ? '#68d391' : fr > A.fps * 0.4 ? '#f6ad55' : '#fc5c65'; g.font = `bold ${Math.max(7, 11 * f)}px monospace`;
    g.fillText(`${fr < 10 ? fr.toFixed(1) : Math.round(fr)} ${A.unit}`, R.x + R.w - 10 * f, R.y + sb + 16 * f);
  }
  g.font = `${Math.max(7, 10 * f)}px monospace`; g.textAlign = 'left';
  if (st.throttle < 0.95) { g.fillStyle = '#f6ad55'; g.fillText(`THROTTLED ${Math.round(st.throttle * 100)}%`, R.x + 8 * f, R.y + sb + 14 * f); }
  if (info.tele.swap > 1) { g.fillStyle = '#fc5c65'; g.fillText(`SWAPPING ×${info.tele.swap.toFixed(1)}`, R.x + 8 * f, R.y + sb + 28 * f); }

  if (st.screen > 35) {
    const n = Math.floor((st.screen - 35) / 7);
    while (glitch.length < n) glitch.push({ x: Math.random(), c: ['#0f0', '#f0f', '#0ff', '#fff'][glitch.length % 4] });
    for (const l of glitch.slice(0, n)) { g.fillStyle = l.c; g.fillRect(R.x + l.x * R.w, R.y, 1.5, R.h); }
  } else glitch.length = 0;
  if (st.screen > 65 && st.cracks.front.length) {
    const [u, v] = st.cracks.front[0][0], rad = (st.screen - 65) / 35 * R.h * 0.7, F = info.face;
    const [cx, cy] = mapF(F, u, v), rg = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    rg.addColorStop(0, '#000'); rg.addColorStop(0.7, '#000d'); rg.addColorStop(1, '#0000'); g.fillStyle = rg; g.fillRect(R.x, R.y, R.w, R.h);
  }
  if (st.ingress > 25) {
    const rg = g.createRadialGradient(R.x + R.w * 0.4, R.y + R.h, 10, R.x + R.w * 0.4, R.y + R.h, R.h * st.ingress / 120);
    rg.addColorStop(0, 'rgba(120,140,160,.55)'); rg.addColorStop(1, 'rgba(120,140,160,0)'); g.fillStyle = rg; g.fillRect(R.x, R.y, R.w, R.h);
    if (st.ingress > 40 && Math.random() < 0.15) { g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(R.x, R.y + Math.random() * R.h, R.w, 8 + Math.random() * 30); }
  }
  if (st.board > 40 && Math.random() < 0.03) { g.fillStyle = '#0f0a'; g.fillRect(R.x, R.y + Math.random() * R.h, R.w, 3); }
  if (A && info.tele.load > 1.5) { // non-blocking overload badge (the app keeps running underneath)
    const msg = `⚠ OVERLOADED ${info.tele.load.toFixed(1)}×`;
    g.font = `bold ${Math.max(7, 10 * f)}px monospace`; const tw = g.measureText(msg).width + 10;
    g.fillStyle = '#7a1d24d0'; rr(g, R.x + R.w / 2 - tw / 2, R.y + R.h - 26 * f, tw, 16 * f, 8 * f); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(msg, R.x + R.w / 2, R.y + R.h - 14.5 * f);
  }
  if (info.toast && t < info.toast.until) {
    g.fillStyle = '#333c'; rr(g, R.x + R.w * 0.08, R.y + R.h * 0.84, R.w * 0.84, 28 * f, 14 * f); g.fill();
    txt(info.toast.msg, 0.84 + 18 * f / R.h, '#fff', 11);
  }
}

/* ---------- phone body ---------- */
function crackPath(g, lines, F) { g.beginPath(); for (const ln of lines) ln.forEach(([u, v], i) => { const [x, y] = mapF(F, u, v); i ? g.lineTo(x, y) : g.moveTo(x, y); }); }
function glassOverlays(g, st, side, F, lit) {
  g.save(); rr(g, F.x, F.y, F.w, F.h, F.r); g.clip();
  for (const b of st.burns) if (b.side === side) {
    const [x, y] = mapF(F, b.u, b.v), r = F.w * 0.035 * Math.sqrt(Math.max(0.3, b.s));
    const rg = g.createRadialGradient(x, y, 0, x, y, r * 1.6);
    if (side === 'front' && b.s < 1) { rg.addColorStop(0, `rgba(255,255,255,${b.s})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); }
    else { rg.addColorStop(0, '#000'); rg.addColorStop(0.55, side === 'front' ? '#2a0a3a' : '#3a2410'); rg.addColorStop(1, 'rgba(0,0,0,0)'); }
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r * 1.6, 0, 7); g.fill();
  }
  for (const s of st.scratches) if (s.side === side) {
    const [a, b] = s.pts, [x1, y1] = mapF(F, ...a), [x2, y2] = mapF(F, ...b);
    g.strokeStyle = s.deep ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.28)'; g.lineWidth = s.deep ? 1.3 : 0.7;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  const lines = st.cracks[side];
  if (lines.length) {
    crackPath(g, lines, F); g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2.2; g.stroke();
    crackPath(g, lines, F); g.strokeStyle = lit ? 'rgba(255,255,255,.85)' : 'rgba(190,205,220,.55)'; g.lineWidth = 0.9; g.stroke();
  }
  g.restore();
}
function lens(g, x, y, r, st) {
  g.fillStyle = '#05060a'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.strokeStyle = '#3a4150'; g.lineWidth = Math.max(1, r * 0.18); g.stroke();
  g.fillStyle = '#1b2440'; g.beginPath(); g.arc(x, y, r * 0.55, 0, 7); g.fill();
  g.fillStyle = '#ffffff40'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.18, 0, 7); g.fill();
  if (st.camera > 50) { g.strokeStyle = '#ffffffa0'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - r, y - r * 0.3); g.lineTo(x + r * 0.2, y + r * 0.1); g.lineTo(x + r * 0.7, y - r * 0.8); g.moveTo(x + r * 0.2, y + r * 0.1); g.lineTo(x, y + r); g.stroke(); }
}
function cameras(g, d, F, st) {
  const u = F.w, X = F.x, Y = F.y, mod = (x, y, w, h, r) => { g.fillStyle = shade(d.color, -0.25); rr(g, X + x, Y + y, w, h, r); g.fill(); g.strokeStyle = '#ffffff22'; g.lineWidth = 1; g.stroke(); };
  const flash = (x, y, r) => { g.fillStyle = '#fff4c8'; g.beginPath(); g.arc(X + x, Y + y, r, 0, 7); g.fill(); };
  switch (d.cams) {
    case 'pro3': mod(u * 0.05, u * 0.05, u * 0.46, u * 0.46, u * 0.12);
      lens(g, X + u * 0.16, Y + u * 0.16, u * 0.085, st); lens(g, X + u * 0.36, Y + u * 0.27, u * 0.085, st); lens(g, X + u * 0.16, Y + u * 0.38, u * 0.085, st); flash(u * 0.38, u * 0.12, u * 0.03); break;
    case 'dual': mod(u * 0.05, u * 0.05, u * 0.36, u * 0.36, u * 0.1);
      lens(g, X + u * 0.15, Y + u * 0.15, u * 0.075, st); lens(g, X + u * 0.15, Y + u * 0.31, u * 0.075, st); flash(u * 0.31, u * 0.15, u * 0.03); break;
    case 'vertical': for (let k = 0; k < 3; k++) lens(g, X + u * 0.14, Y + u * (0.12 + k * 0.17), u * 0.07, st); lens(g, X + u * 0.3, Y + u * 0.12, u * 0.05, st); flash(u * 0.3, u * 0.25, u * 0.025); break;
    case 'bar': g.fillStyle = shade(d.color, -0.6); rr(g, X - 2, Y + u * 0.14, u + 4, u * 0.2, u * 0.1); g.fill();
      g.fillStyle = '#111'; rr(g, X + u * 0.08, Y + u * 0.165, u * 0.5, u * 0.15, u * 0.075); g.fill();
      for (let k = 0; k < 3; k++) lens(g, X + u * (0.16 + k * 0.17), Y + u * 0.24, u * 0.055, st); flash(u * 0.7, u * 0.24, u * 0.025); break;
    case 'rog': poly(g, shade(d.color, 0.15), [[X + u * 0.05, Y + u * 0.08], [X + u * 0.5, Y + u * 0.08], [X + u * 0.38, Y + u * 0.36], [X + u * 0.05, Y + u * 0.36]]);
      lens(g, X + u * 0.16, Y + u * 0.18, u * 0.075, st); lens(g, X + u * 0.32, Y + u * 0.18, u * 0.06, st); flash(u * 0.16, u * 0.3, u * 0.025); break;
    case 'single': lens(g, X + u * 0.5, Y + u * 0.18, u * 0.08, st); flash(u * 0.5, u * 0.32, u * 0.03); break;
    case 'triple': mod(u * 0.06, u * 0.06, u * 0.22, u * 0.52, u * 0.1);
      for (let k = 0; k < 3; k++) lens(g, X + u * 0.17, Y + u * (0.17 + k * 0.15), u * 0.065, st); flash(u * 0.36, u * 0.15, u * 0.03); break;
  }
}
function logo(g, d, F, view) {
  const cx = F.x + F.w / 2, u = F.w;
  if (view === 'front') {
    if (d.logo === 'nokia' || d.screen === 'bezel') { g.fillStyle = d.logo === 'nokia' ? '#e8e8e8' : '#c9ced8'; g.font = `bold ${u * 0.09}px system-ui`; g.textAlign = 'center'; g.fillText(d.logo === 'nokia' ? 'NOKIA' : d.logo === 'samsung' ? 'SAMSUNG' : '', cx, F.y + F.h * (d.screen === 'keypad' ? 0.1 : 0.09)); }
    return;
  }
  g.fillStyle = shade(d.color, d.color > '#888888' ? -0.15 : 0.2);
  switch (d.logo) {
    case 'apple': {
      const y = F.y + F.h * 0.5, r = u * 0.09;
      g.beginPath(); g.arc(cx - r * 0.35, y, r * 0.75, 0, 7); g.arc(cx + r * 0.35, y, r * 0.75, 0, 7); g.fill();
      g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(cx + r * 1.15, y - r * 0.1, r * 0.45, 0, 7); g.fill(); g.restore();
      g.beginPath(); g.ellipse(cx + r * 0.1, y - r * 1.05, r * 0.18, r * 0.38, 0.6, 0, 7); g.fill(); break;
    }
    case 'samsung': g.font = `bold ${u * 0.08}px system-ui`; g.textAlign = 'center'; g.fillText('SAMSUNG', cx, F.y + F.h * 0.88); break;
    case 'g': g.font = `bold ${u * 0.14}px system-ui`; g.textAlign = 'center'; g.fillText('G', cx, F.y + F.h * 0.82); break;
    case 'rog': g.save(); g.shadowColor = d.accent; g.shadowBlur = 18; poly(g, d.accent, [[cx - u * 0.16, F.y + F.h * 0.55], [cx + u * 0.16, F.y + F.h * 0.5], [cx + u * 0.05, F.y + F.h * 0.58], [cx - u * 0.12, F.y + F.h * 0.6]]); g.restore(); break;
    case 'nokia': g.font = `bold ${u * 0.1}px system-ui`; g.textAlign = 'center'; g.fillText('NOKIA', cx, F.y + F.h * 0.45); break;
  }
}
function keypad(g, F, d) {
  const u = F.w, top = F.y + F.h * 0.47, key = shade(d.color, 0.55);
  g.fillStyle = shade(d.color, -0.35); rr(g, F.x + u * 0.25, top, u * 0.5, F.h * 0.07, F.h * 0.035); g.fill(); // navi key
  g.fillStyle = key; g.font = `bold ${u * 0.06}px system-ui`; g.textAlign = 'center'; g.fillText('Menu', F.x + u / 2, top + F.h * 0.045);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    const x = F.x + u * (0.14 + c * 0.25), y = top + F.h * (0.11 + r * 0.095);
    g.fillStyle = key; rr(g, x, y, u * 0.22, F.h * 0.075, F.h * 0.035); g.fill();
    g.fillStyle = '#223'; g.fillText('123456789*0#'[r * 3 + c], x + u * 0.11, y + F.h * 0.05);
  }
}

function drawPhone(g, spec, st, G, view, info) {
  const d = spec.design, fr = S.FRAMES[spec.frame] || S.FRAMES.aluminum, F = G.face, cx = G.x + G.w / 2, cy = G.y + G.h / 2;
  g.save();
  if (st.crushed) { g.translate(cx, cy); g.scale(1.1, 0.93); g.translate(-cx, -cy); }
  else if (st.bend > 0 && st.bend < 1) { g.translate(cx, cy); g.rotate(st.bend * 0.07); g.translate(-cx, -cy); }
  if (st.T > 42 && !st.fire) { g.save(); g.shadowColor = `rgba(255,80,20,${clamp((st.T - 42) / 25, 0, 0.9)})`; g.shadowBlur = 40; g.fillStyle = '#000'; rr(g, G.x, G.y, G.w, G.h, G.r); g.fill(); g.restore(); }
  if (st.T < -20) { g.save(); g.shadowColor = 'rgba(160,220,255,.8)'; g.shadowBlur = 30; g.fillStyle = '#000'; rr(g, G.x, G.y, G.w, G.h, G.r); g.fill(); g.restore(); }
  g.fillStyle = fr.color; rr(g, G.x, G.y, G.w, G.h, G.r); g.fill();
  const sheen = g.createLinearGradient(G.x, 0, G.x + G.w, 0); sheen.addColorStop(0, '#ffffff30'); sheen.addColorStop(0.1, '#ffffff00'); sheen.addColorStop(0.9, '#00000000'); sheen.addColorStop(1, '#00000040');
  g.fillStyle = sheen; g.fill();

  if (view === 'front') {
    const plastic = ['bezel', 'keypad', 'gameboy', 'switch'].includes(d.screen);
    g.fillStyle = plastic ? d.color : '#060708'; rr(g, F.x, F.y, F.w, F.h, F.r); g.fill();
    if (d.screen === 'switch') { // joy-cons
      const jw = G.w * 0.16;
      for (const [x0, col, left] of [[G.x, d.accent, true], [G.x + G.w - jw, d.accent2, false]]) {
        g.fillStyle = col; g.beginPath(); g.roundRect(x0, G.y, jw, G.h, left ? [G.r, 4, 4, G.r] : [4, G.r, G.r, 4]); g.fill();
        g.fillStyle = '#222'; g.beginPath(); g.arc(x0 + jw / 2, G.y + G.h * (left ? 0.3 : 0.62), jw * 0.22, 0, 7); g.fill();
        for (const [bx, by] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { g.beginPath(); g.arc(x0 + jw / 2 + bx * jw * 0.18, G.y + G.h * (left ? 0.62 : 0.3) + by * jw * 0.18, jw * 0.07, 0, 7); g.fill(); }
      }
    }
    if (d.screen === 'gameboy') {
      g.fillStyle = '#5b5e6a'; rr(g, G.x + G.w * 0.1, G.y + G.h * 0.06, G.w * 0.8, G.h * 0.4, [6, 6, G.w * 0.15, 6]); g.fill();
      g.fillStyle = '#c9c8d6'; g.font = `${G.w * 0.035}px system-ui`; g.textAlign = 'left'; g.fillText('DOT MATRIX WITH STEREO SOUND', G.x + G.w * 0.16, G.y + G.h * 0.09);
      g.fillStyle = st.power === 'on' ? '#e33' : '#511'; g.beginPath(); g.arc(G.x + G.w * 0.17, G.y + G.h * 0.22, G.w * 0.018, 0, 7); g.fill();
      g.fillStyle = '#2e3a8c'; g.font = `italic bold ${G.w * 0.07}px system-ui`; g.fillText('Nintendo GAME BOY', G.x + G.w * 0.1, G.y + G.h * 0.51);
      const dx = G.x + G.w * 0.25, dy = G.y + G.h * 0.66, k = G.w * 0.065;
      g.fillStyle = '#222'; g.fillRect(dx - k * 1.5, dy - k / 2, k * 3, k); g.fillRect(dx - k / 2, dy - k * 1.5, k, k * 3);
      g.fillStyle = d.accent; for (const [bx, by] of [[0.72, 0.68], [0.86, 0.63]]) { g.beginPath(); g.arc(G.x + G.w * bx, G.y + G.h * by, G.w * 0.065, 0, 7); g.fill(); }
      g.fillStyle = '#8f8d95'; for (const bx of [0.4, 0.55]) { rr(g, G.x + G.w * bx, G.y + G.h * 0.8, G.w * 0.1, G.h * 0.018, 4); g.fill(); }
      g.strokeStyle = '#8f8d95'; g.lineWidth = 2; for (let k2 = 0; k2 < 6; k2++) { g.beginPath(); g.moveTo(G.x + G.w * (0.72 + k2 * 0.03), G.y + G.h * 0.95); g.lineTo(G.x + G.w * (0.8 + k2 * 0.03), G.y + G.h * 0.84); g.stroke(); }
    }
    if (plastic) { const gl = g.createLinearGradient(F.x, F.y, F.x + F.w, F.y + F.h); gl.addColorStop(0, '#ffffff22'); gl.addColorStop(1, '#00000033'); g.fillStyle = gl; g.fill(); }
    if (d.screen === 'bezel') {
      g.fillStyle = '#111'; rr(g, cx - F.w * 0.12, G.y + G.h * 0.055, F.w * 0.24, G.h * 0.01, 3); g.fill();
      g.fillStyle = shade(d.color, -0.35); rr(g, cx - F.w * 0.14, G.y + G.h * 0.9, F.w * 0.28, G.h * 0.055, G.h * 0.027); g.fill();
    }
    if (d.screen === 'keypad') keypad(g, F, d);
    logo(g, d, F, 'front');
    const R = G.scr;
    if (st.swell > 0.05) { g.fillStyle = '#c9b46a'; rr(g, R.x - 3, R.y - 3, R.w + 6, R.h + 6, R.r); g.fill(); }
    g.save();
    if (st.swell > 0.05) { g.translate(R.x, R.y + R.h); g.rotate(-st.swell * 0.05); g.translate(st.swell * 8, -st.swell * 6); g.translate(-R.x, -R.y - R.h); }
    g.fillStyle = d.screen === 'keypad' ? '#3a4a2a' : '#000'; rr(g, R.x - 3, R.y - 3, R.w + 6, R.h + 6, R.r + 2); g.fill();
    g.save(); rr(g, R.x, R.y, R.w, R.h, R.r); g.clip(); screen(g, R, spec, st, { ...info, face: F }); g.restore();
    g.fillStyle = '#000';
    const cw = R.w;
    if (d.screen === 'island') { rr(g, cx - cw * 0.17, R.y + cw * 0.035, cw * 0.34, cw * 0.1, cw * 0.05); g.fill(); }
    else if (d.screen === 'notch') { rr(g, cx - cw * 0.26, R.y - 4, cw * 0.52, cw * 0.11, cw * 0.05); g.fill(); }
    else if (d.screen === 'punch') { g.beginPath(); g.arc(cx, R.y + cw * 0.06, cw * 0.032, 0, 7); g.fill(); }
    else if (d.screen === 'waterdrop') { g.beginPath(); g.arc(cx, R.y + cw * 0.01, cw * 0.05, 0, Math.PI); g.fill(); }
    g.restore();
    if (d.screen === 'watch') { // digital crown + action button
      g.fillStyle = shade(fr.color, -0.2); rr(g, G.x + G.w - 2, G.y + G.h * 0.28, G.w * 0.07, G.h * 0.18, 4); g.fill();
      g.fillStyle = d.accent; rr(g, G.x - G.w * 0.05, G.y + G.h * 0.35, G.w * 0.06, G.h * 0.22, 3); g.fill();
    }
    glassOverlays(g, st, 'front', F, st.power === 'on' && st.screen < 100);
  } else {
    const mat = spec.back, glassy = S.GLASS[mat]?.shatter;
    g.fillStyle = d.color; rr(g, F.x, F.y, F.w, F.h, F.r); g.fill();
    if (glassy) { const gl = g.createLinearGradient(F.x, F.y, F.x + F.w, F.y + F.h); gl.addColorStop(0, '#ffffff38'); gl.addColorStop(0.45, '#ffffff05'); gl.addColorStop(1, '#00000040'); g.fillStyle = gl; g.fill(); }
    else if (mat === 'aluminum') { g.save(); g.clip(); g.strokeStyle = '#ffffff10'; for (let y = F.y; y < F.y + F.h; y += 2) { g.beginPath(); g.moveTo(F.x, y); g.lineTo(F.x + F.w, y); g.stroke(); } g.restore(); }
    else { g.save(); g.clip(); g.fillStyle = '#ffffff0c'; for (let k = 0; k < 220; k++) g.fillRect(F.x + hash(k) * F.w, F.y + hash(k + 500) * F.h, 1.5, 1.5); g.restore(); }
    if (st.swell > 0.05) { g.fillStyle = `rgba(255,255,255,${st.swell * 0.15})`; g.beginPath(); g.ellipse(cx, F.y + F.h * 0.55, F.w * 0.35, F.h * 0.3, 0, 0, 7); g.fill(); }
    if (spec.cooling === 'fan') {
      g.fillStyle = '#0008'; for (let k = 0; k < 6; k++) { rr(g, cx - F.w * 0.18, F.y + F.h * (0.38 + k * 0.025), F.w * 0.36, F.h * 0.01, 2); g.fill(); }
      g.save(); g.shadowColor = d.accent; g.shadowBlur = 12; g.fillStyle = d.accent; g.fillRect(F.x + F.w * 0.9, F.y + F.h * 0.3, 2, F.h * 0.25); g.restore();
    }
    cameras(g, d, F, st);
    logo(g, d, F, 'back');
    glassOverlays(g, st, 'back', F, true);
  }

  const mirror = (u) => view === 'front' ? u : 1 - u;
  for (const dn of st.dents) {
    const px = G.x + mirror(dn.u) * G.w, py = G.y + dn.v * G.h, ex = mirror(dn.u) < 0.5 ? G.x : G.x + G.w, ey = dn.v < 0.5 ? G.y : G.y + G.h;
    const [x, y] = Math.abs(px - ex) / G.w < Math.abs(py - ey) / G.h ? [ex, clamp(py, G.y + 15, G.y + G.h - 15)] : [clamp(px, G.x + 15, G.x + G.w - 15), ey];
    g.fillStyle = '#00000099'; g.beginPath(); g.arc(x, y, 3 + dn.d * 3, 0, 7); g.fill();
    g.strokeStyle = '#ffffff55'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, 3 + dn.d * 3, 0.5, 2.5); g.stroke();
  }
  for (const h of st.holes) {
    if (h.side && h.side !== view) continue;
    const [x, y] = mapF(F, mirror(h.u), h.v), r = h.r * F.w;
    g.fillStyle = '#0b0b0b'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.strokeStyle = '#8a8a8a'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#ff9a3c55'; g.beginPath(); g.arc(x, y, r * 0.5, 0, 7); g.fill();
  }
  if (st.sand > 8) {
    g.fillStyle = '#d8b878';
    for (let k = 0; k < st.sand * 1.5; k++) { const e = hash(k * 3), along = hash(k * 7); const onBottom = e < 0.6;
      g.fillRect(onBottom ? G.x + along * G.w : (e < 0.8 ? G.x : G.x + G.w - 2) + rand(0, 1), onBottom ? G.y + G.h - 3 - hash(k) * 5 : G.y + along * G.h, 1.6, 1.6); }
  }
  if (spec.frame === 'rugged') {
    for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const x = G.x + sx * G.w, y = G.y + sy * G.h, k = G.w * 0.2;
      g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (sx ? -k : k), y); g.lineTo(x, y + (sy ? -k : k)); g.closePath(); g.fill();
      g.fillStyle = d.accent; g.beginPath(); g.arc(x + (sx ? -k * 0.3 : k * 0.3), y + (sy ? -k * 0.3 : k * 0.3), 3, 0, 7); g.fill();
    }
  }
  if (st.bend >= 1 && !st.crushed) {
    g.strokeStyle = '#000'; g.lineWidth = 5; g.beginPath();
    for (let k = 0; k <= 10; k++) g.lineTo(G.x + G.w * k / 10, cy + (k % 2 ? 6 : -6));
    g.stroke();
  } else if (st.bend > 0) {
    const cr = g.createLinearGradient(0, cy - 20, 0, cy + 20); cr.addColorStop(0, '#0000'); cr.addColorStop(0.5, '#0008'); cr.addColorStop(1, '#0000');
    g.fillStyle = cr; g.fillRect(G.x, cy - 20, G.w, 40);
  }
  const char = Math.max(st.scorch, st.fire ? clamp(st.fireT / 60, 0, 0.85) : 0);
  if (char > 0) {
    g.save(); rr(g, G.x, G.y, G.w, G.h, G.r); g.clip();
    for (const [x, y, r] of [[0.3, 0.6, 0.6], [0.7, 0.75, 0.5], [0.5, 0.35, 0.45]]) {
      const rg = g.createRadialGradient(G.x + x * G.w, G.y + y * G.h, 5, G.x + x * G.w, G.y + y * G.h, r * G.w);
      rg.addColorStop(0, `rgba(10,6,4,${char})`); rg.addColorStop(1, 'rgba(40,20,10,0)'); g.fillStyle = rg; g.fillRect(G.x, G.y, G.w, G.h);
    }
    g.restore();
  }
  g.restore();
}

/* ---------- small phone for the arena (centered at 0,0, w×h px, face-on) ---------- */
function worldPhone(g, spec, st, w, h, lit) {
  const d = spec.design, r = d.corner * Math.min(w, h) * 0.22, plastic = ['bezel', 'keypad', 'gameboy', 'switch'].includes(d.screen);
  g.fillStyle = (S.FRAMES[spec.frame] || S.FRAMES.aluminum).color; rr(g, -w / 2, -h / 2, w, h, r); g.fill();
  const b = Math.max(1, w * 0.06);
  g.fillStyle = plastic ? d.color : '#060708'; rr(g, -w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b, r - b); g.fill();
  g.fillStyle = lit ? '#4a7fc8' : '#0a0c10';
  if (d.screen === 'keypad' || d.screen === 'gameboy') { g.fillStyle = lit ? '#9ab86a' : '#4d5a35'; g.fillRect(-w * 0.28, -h * 0.38, w * 0.56, h * 0.3); }
  else if (d.screen === 'switch') { g.fillStyle = d.accent; g.fillRect(-w / 2, -h / 2, w * 0.16, h); g.fillStyle = d.accent2; g.fillRect(w * 0.34, -h / 2, w * 0.16, h); g.fillStyle = lit ? '#4a7fc8' : '#0a0c10'; g.fillRect(-w * 0.31, -h * 0.4, w * 0.62, h * 0.8); }
  else if (d.screen === 'bezel') g.fillRect(-w / 2 + b * 1.5, -h * 0.38, w - 3 * b, h * 0.76);
  else { rr(g, -w / 2 + b * 1.6, -h / 2 + b * 1.6, w - 3.2 * b, h - 3.2 * b, r - b); g.fill(); }
  if (st.cracks.front.length) { g.strokeStyle = '#ffffffb0'; g.lineWidth = 1; g.beginPath(); g.moveTo(-w * .3, -h * .2); g.lineTo(w * .1, 0); g.lineTo(-w * .1, h * .3); g.moveTo(w * .1, 0); g.lineTo(w * .35, -h * .1); g.stroke(); }
  if (st.fire && st.fireT > 60 || st.scorch > 0.5) { g.fillStyle = '#000000a0'; rr(g, -w / 2, -h / 2, w, h, r); g.fill(); }
}

/* ---------- close-up particles ---------- */
const fx = [];
function emit(p) { fx.push({ max: p.life, ...p }); }
function effects(g, st, G, dt) {
  const k = dt * 60, B = G;
  if (st.smoke > 0 && Math.random() < st.smoke * k) emit({ t: 'smoke', x: B.x + rand(0, B.w), y: B.y + rand(B.h * 0.3, B.h), vx: rand(-8, 8), vy: rand(-40, -20), life: rand(2, 3.5) });
  if (st.fire && st.fireT < 120) for (let i = 0; i < Math.round(3 * k); i++) emit({ t: 'fire', x: B.x + rand(10, B.w - 10), y: B.y + rand(B.h * 0.4, B.h), vx: rand(-10, 10), vy: rand(-90, -40), life: rand(0.4, 0.9) });
  if (st.sparks && Math.random() < 0.3 * k) for (let i = 0; i < 6; i++) emit({ t: 'spark', x: B.x + B.w / 2 + rand(-15, 15), y: B.y + B.h - 4, vx: rand(-120, 120), vy: rand(-160, -30), life: rand(0.2, 0.5) });
  if (st.arcing && Math.random() < 0.5 * k) emit({ t: 'arc', x: B.x + (Math.random() < 0.5 ? 0 : B.w), y: B.y + rand(0, B.h), life: 0.12 });
  if (st.zapT > 0 && Math.random() < 0.8 * k) emit({ t: 'arc', x: B.x + rand(0, B.w), y: B.y + rand(0, B.h), life: 0.1 });
  if (st.T > 50 && !st.fire && Math.random() < 0.2 * k) emit({ t: 'haze', x: B.x + rand(0, B.w), y: B.y + rand(0, 30), vx: 0, vy: -25, life: 1.2 });
  if (st.T < -40 && Math.random() < 0.4 * k) emit({ t: 'fog', x: B.x + rand(0, B.w), y: B.y + rand(0, B.h), vx: rand(-10, 10), vy: rand(5, 20), life: rand(1, 2) });
  for (const p of fx) {
    p.life -= dt; p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; const a = clamp(p.life / p.max, 0, 1);
    switch (p.t) {
      case 'smoke': p.vx += rand(-20, 20) * dt; g.fillStyle = `rgba(120,120,125,${a * 0.45})`; g.beginPath(); g.arc(p.x, p.y, 10 + (1 - a) * 40, 0, 7); g.fill(); break;
      case 'fog': g.fillStyle = `rgba(220,240,255,${a * 0.3})`; g.beginPath(); g.arc(p.x, p.y, 8 + (1 - a) * 25, 0, 7); g.fill(); break;
      case 'fire': case 'flame': g.globalCompositeOperation = 'lighter'; g.fillStyle = p.t === 'flame' && p.blue ? `rgba(90,140,255,${a})` : `rgba(255,${80 + a * 150 | 0},20,${a})`; g.beginPath(); g.arc(p.x, p.y, (p.size || 4) + a * 12, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; break;
      case 'spark': case 'debris': p.vy += 400 * dt; g.strokeStyle = p.t === 'spark' ? `rgba(255,240,150,${a})` : `rgba(220,230,240,${a})`; g.lineWidth = 2; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); g.stroke(); break;
      case 'water': p.vy += 300 * dt; g.fillStyle = `rgba(150,200,255,${a})`; g.fillRect(p.x, p.y, 3, 3); break;
      case 'arc': g.strokeStyle = `rgba(190,170,255,${a})`; g.lineWidth = 2; g.beginPath(); g.moveTo(p.x, p.y); for (let i = 0; i < 4; i++) g.lineTo(p.x + rand(-25, 25), p.y + rand(-25, 25)); g.stroke(); break;
      case 'flash': g.fillStyle = `rgba(255,${p.color || '240,200'},${a})`; g.beginPath(); g.arc(p.x, p.y, (p.size || 20) * (1.5 - a), 0, 7); g.fill(); break;
      case 'screen': g.fillStyle = `rgba(${p.color},${a * 0.8})`; g.fillRect(0, 0, 9999, 9999); break;
      case 'emoji': g.globalAlpha = a; g.font = `${p.size}px system-ui`; g.textAlign = 'center'; g.fillText(p.text, p.x, p.y); g.globalAlpha = 1; break;
      default: g.strokeStyle = `rgba(255,150,80,${a * 0.25})`; g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(p.x + 6, p.y - 8, p.x, p.y - 16); g.stroke();
    }
  }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].life <= 0) fx.splice(i, 1);
}

root.Draw = { geometry, drawPhone, worldPhone, effects, emit, shade, rr, TILES };
})(typeof globalThis !== 'undefined' ? globalThis : this);
