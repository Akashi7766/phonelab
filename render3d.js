/* PhoneLab 3D rendering on a plain 2D canvas: perspective camera, near-plane clipping,
   back-face culled boxes with texture-mapped faces, and ray picking. Depends on World. */
(function (root) {
'use strict';
const { v3, add, sub, mul, dot, cross, len, norm, Q } = root.World;

/* ---------- camera ---------- */
function camera(eye, target, fov, W, H) {
  const f = norm(sub(target, eye));
  let r = cross(f, v3(0, 1, 0)); r = len(r) < 1e-6 ? v3(1, 0, 0) : norm(r);
  return { eye, f, r, u: cross(r, f), F: H / 2 / Math.tan(fov / 2), cx: W / 2, cy: H / 2, near: 0.02 };
}
const toCam = (c, P) => { const d = sub(P, c.eye); return v3(dot(d, c.r), dot(d, c.u), dot(d, c.f)); };
const projCam = (c, q) => [c.cx + q.x / q.z * c.F, c.cy - q.y / q.z * c.F];
function project(c, P) { const q = toCam(c, P); return q.z > c.near ? projCam(c, q) : null; }
function ray(c, px, py) { return norm(add(add(mul(c.r, (px - c.cx) / c.F), mul(c.u, -(py - c.cy) / c.F)), c.f)); }
function clipPoly(c, pts) {
  const cam = pts.map(p => toCam(c, p)), out = [];
  for (let i = 0; i < cam.length; i++) {
    const a = cam[i], b = cam[(i + 1) % cam.length], ain = a.z > c.near, bin = b.z > c.near;
    if (ain) out.push(a);
    if (ain !== bin) { const t = (c.near - a.z) / (b.z - a.z); out.push(v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, c.near)); }
  }
  return out.length >= 3 ? out.map(q => projCam(c, q)) : null;
}
function path(g, s) { g.beginPath(); s.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }
function poly(g, c, pts, fill, stroke) {
  const s = clipPoly(c, pts); if (!s) return null;
  path(g, s); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
  return s;
}
function line(g, c, a, b, color, w = 1) {
  const s = clipPoly(c, [a, b, b]); if (!s) return;
  g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.moveTo(...s[0]); g.lineTo(...s[1]); g.stroke();
}
function shadeHex(hex, k) { const n = parseInt(hex.slice(1), 16), f = (x) => Math.round(clampN(x * k, 0, 255)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- textured quad: two affine triangles ---------- */
function tri(g, img, p0, p1, p2, t0, t1, t2) {
  const [x0, y0] = p0, [x1, y1] = p1, [x2, y2] = p2, [u0, v0] = t0, [u1, v1] = t1, [u2, v2] = t2;
  const d = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
  if (Math.abs(d) < 1e-9) return;
  const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / d, b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / d;
  const cc = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / d, e = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / d;
  const mx = (x0 + x1 + x2) / 3, my = (y0 + y1 + y2) / 3, grow = (x, y) => [x + Math.sign(x - mx) * 0.6, y + Math.sign(y - my) * 0.6]; // hide seams
  g.save(); g.beginPath(); g.moveTo(...grow(x0, y0)); g.lineTo(...grow(x1, y1)); g.lineTo(...grow(x2, y2)); g.closePath(); g.clip();
  g.transform(a, b, cc, e, x0 - a * u0 - cc * v0, y0 - b * u0 - e * v0); g.drawImage(img, 0, 0); g.restore();
}
function texQuad(g, img, s) { // s = screen corners tl,tr,br,bl
  const w = img.width, h = img.height;
  tri(g, img, s[0], s[1], s[2], [0, 0], [w, 0], [w, h]);
  tri(g, img, s[0], s[2], s[3], [0, 0], [w, h], [0, h]);
}

/* ---------- boxes ---------- */
// corners listed tl,tr,br,bl as seen from outside each face
const FACES = [
  ['front', v3(0, 0, 1), [[-1, 1, 1], [1, 1, 1], [1, -1, 1], [-1, -1, 1]]],
  ['back', v3(0, 0, -1), [[1, 1, -1], [-1, 1, -1], [-1, -1, -1], [1, -1, -1]]],
  ['right', v3(1, 0, 0), [[1, 1, 1], [1, 1, -1], [1, -1, -1], [1, -1, 1]]],
  ['left', v3(-1, 0, 0), [[-1, 1, -1], [-1, 1, 1], [-1, -1, 1], [-1, -1, -1]]],
  ['top', v3(0, 1, 0), [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]]],
  ['bottom', v3(0, -1, 0), [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]]],
];
const LIGHT = norm(v3(0.35, 0.85, 0.45));
// side-face details as [s0, t0, s1, t1, colour] in face-local 0..1 coords
const DETAILS = { bottom: [[0.42, 0.25, 0.58, 0.75, '#111'], [0.15, 0.35, 0.3, 0.65, '#222'], [0.7, 0.35, 0.85, 0.65, '#222']],
  right: [[0.25, 0.2, 0.42, 0.8, null]], left: [[0.2, 0.2, 0.3, 0.8, null], [0.34, 0.2, 0.44, 0.8, null]] };
function clipAboveY(pts, y) { // keep the part of a 3D polygon above the plane at height y
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ain = a.y >= y, bin = b.y >= y;
    if (ain) out.push(a);
    if (ain !== bin) { const t = (y - a.y) / (b.y - a.y); out.push(v3(a.x + (b.x - a.x) * t, y, a.z + (b.z - a.z) * t)); }
  }
  return out;
}
/* o.clipY: hide everything below that height (a body sunk in sand, balls or lava) */
function drawBox(g, c, pos, q, half, o = {}) {
  const color = o.color || '#888888';
  for (const [key, nb, corners] of FACES) {
    const n = Q.rot(q, nb), fc = add(pos, Q.rot(q, v3(nb.x * half.x, nb.y * half.y, nb.z * half.z)));
    if (dot(n, sub(c.eye, fc)) <= 0) continue;
    const W3 = corners.map(([sx, sy, sz]) => add(pos, Q.rot(q, v3(sx * half.x, sy * half.y, sz * half.z))));
    let clipped = false;
    if (o.clipY !== undefined && W3.some(P => P.y < o.clipY)) {
      const vis = clipAboveY(W3, o.clipY), sc = vis.length >= 3 && clipPoly(c, vis);
      if (!sc) continue;
      g.save(); path(g, sc); g.clip(); clipped = true;
    }
    const lit = 0.5 + 0.5 * Math.max(0, dot(n, LIGHT)), tex = o.tex?.[key];
    const s = W3.map(P => project(c, P));
    if (s.some(p => !p)) { poly(g, c, W3, shadeHex(color, lit)); if (clipped) g.restore(); continue; }
    path(g, s); g.fillStyle = shadeHex(tex ? o.texBg || color : (o.faceColor?.[key] || color), lit); g.fill();
    if (tex) { texQuad(g, tex, s); path(g, s); g.fillStyle = `rgba(0,0,0,${(1 - lit) * 0.75})`; g.fill(); }
    if (o.details && DETAILS[key]) for (const [s0, t0, s1, t1, col] of DETAILS[key]) {
      const at = (sx, ty) => { const top = add(mul(W3[0], 1 - sx), mul(W3[1], sx)), bot = add(mul(W3[3], 1 - sx), mul(W3[2], sx)); return add(mul(top, 1 - ty), mul(bot, ty)); };
      poly(g, c, [at(s0, t0), at(s1, t0), at(s1, t1), at(s0, t1)], col || shadeHex(color, lit * 0.75));
    }
    if (o.edges) { path(g, s); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.stroke(); }
    if (clipped) g.restore();
  }
}
/* Ray-pick a box: returns { face, local } (local = body-frame hit point) or null */
function pickBox(c, pos, q, half, px, py) {
  const d = ray(c, px, py);
  let best = null;
  for (const [key, nb] of FACES) {
    const n = Q.rot(q, nb), fc = add(pos, Q.rot(q, v3(nb.x * half.x, nb.y * half.y, nb.z * half.z)));
    const den = dot(d, n); if (den >= 0) continue;
    const t = dot(sub(fc, c.eye), n) / den; if (t <= 0 || (best && t >= best.t)) continue;
    const local = Q.rot(Q.conj(q), sub(add(c.eye, mul(d, t)), pos)), e = 1.0001;
    if (Math.abs(local.x) <= half.x * e && Math.abs(local.y) <= half.y * e && Math.abs(local.z) <= half.z * e) best = { t, face: key, local };
  }
  return best;
}
function hull(pts) { // 2D convex hull, monotone chain
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), crossZ = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && crossZ(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length >= 2 && crossZ(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

root.R3 = { camera, project, ray, clipPoly, poly, line, path, drawBox, pickBox, texQuad, shadeHex, hull, FACES };
})(typeof globalThis !== 'undefined' ? globalThis : this);
