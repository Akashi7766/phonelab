// node test.js — sanity checks for the simulation model
const assert = require('assert');
const S = require('./sim.js');
const spec = (name) => structuredClone(S.PRESETS.find(p => p.name.startsWith(name)).spec);
const coin = () => 0.5; // deterministic rng: crack happens iff odds > 50%
const v = (m) => Math.sqrt(2 * 9.81 * m); // drop height -> impact speed

// Drops: Ceramic Shield survives 1 m face-down, cracks at 3 m, a rugged case saves it at 3 m.
let ip = spec('iPhone 16'), st = S.newState();
S.impact(ip, st, { speed: v(1), hit: 'screen', surfaceFactor: 1 }, coin);
assert.strictEqual(st.cracks.front.length, 0, '1 m should not crack ceramic');
S.impact(ip, st, { speed: v(3), hit: 'screen', surfaceFactor: 1 }, coin);
assert.ok(st.cracks.front.length > 0, '3 m should crack ceramic');
st = S.newState(); ip.case = 'rugged';
S.impact(ip, st, { speed: v(3), hit: 'screen', surfaceFactor: 1 }, coin);
assert.strictEqual(st.cracks.front.length, 0, 'rugged case should absorb a 3 m drop');
st = S.newState(); ip.case = 'none';
S.impact(ip, st, { speed: v(3), hit: 'screen', surfaceFactor: S.SURFACES.grass.factor }, coin);
assert.strictEqual(st.cracks.front.length, 0, 'grass should absorb a 3 m drop');
// Cracked glass is weaker: a 1 m drop that was safe before now cracks further
st = S.newState(); S.impact(ip, st, { speed: v(3), hit: 'screen', surfaceFactor: 1 }, coin);
const before = st.cracks.front.length;
S.impact(ip, st, { speed: v(1.2), hit: 'screen', surfaceFactor: 1 }, coin);
assert.ok(st.cracks.front.length > before, 'weakened glass should crack at 1.2 m');
// Corner hit near the rear camera damages it
st = S.newState(); S.impact(ip, st, { speed: v(2), hit: 'corner', side: 'back', surfaceFactor: 1, u: 0.95, v: 0.03 }, coin);
assert.ok(st.camera > 0, 'top-right corner hit should damage the camera');

// Nokia shrugs off 10 m; flagship from 100 m (terminal velocity) dies.
st = S.newState();
S.impact(spec('Nokia'), st, { speed: v(10), hit: 'corner', side: 'front', surfaceFactor: 1 }, coin);
assert.strictEqual(st.dents.length, 0); assert.strictEqual(st.power, 'on');
st = S.newState();
S.impact(spec('Galaxy S25'), st, { speed: 28, hit: 'corner', side: 'front', surfaceFactor: 1 }, coin);
assert.strictEqual(st.power, 'dead');

// Water
const soak = (s, depth, mins) => { const st = S.newState(); for (let t = 0; t < mins * 60; t++) S.waterStep(s, st, depth, 1); return st; };
assert.strictEqual(soak(spec('iPhone 16'), 3, 20).ingress, 0);
assert.ok(soak(spec('Nokia'), 0.5, 5).ingress > 40);
assert.strictEqual(soak(spec('Galaxy S5'), 5, 3).power, 'dead');

// Sand: dust-tight IP6x keeps sand out, IP00 fills up; sand scratches Mohs-6 glass but not sapphire
const dig = (s, mins) => { const st = S.newState(); for (let t = 0; t < mins * 60; t++) S.sandStep(s, st, 1, 0, 1, coin); return st; };
assert.strictEqual(dig(spec('iPhone 16'), 10).sand, 0);
assert.ok(dig(spec('Nokia'), 5).sand > 50);
st = S.newState(); S.sandImpact(spec('iPhone 16'), st, 8, coin);
assert.ok(st.scratches.length > 0, 'sand should scratch Ceramic Shield');
ip = spec('iPhone 16'); ip.glass = ip.back = 'sapphire'; st = S.newState(); S.sandImpact(ip, st, 8, coin);
assert.strictEqual(st.scratches.length, 0, 'sapphire is harder than sand');

// Weapons
st = S.newState(); S.weapon(spec('iPhone 16'), st, 'mohs', { level: 5 }, coin); assert.strictEqual(st.scratches.length, 0);
S.weapon(spec('iPhone 16'), st, 'mohs', { level: 7 }, coin); assert.ok(st.scratches[0].deep);
st = S.newState(); S.weapon(spec('iPhone 16'), st, 'pistol', { u: 0.5, v: 0.6 }, coin);
assert.ok(st.punctured && st.holes.length === 1 && S.sealIntegrity(st) === 0, 'bullet through the battery');
st = S.newState(); S.weapon(spec('Nokia'), st, 'bend', {}, coin); assert.strictEqual(st.bend, 0, 'Nokia does not bend');
ip = spec('iPhone 11'); ip.size.t = 6.5; st = S.newState(); S.weapon(ip, st, 'bend', {}, coin); assert.ok(st.bend > 0, 'thin aluminium bends');
st = S.newState(); S.weapon(spec('Rugged'), st, 'washer', { dt: 60 }, coin); assert.strictEqual(st.ingress, 0, 'IP69K shrugs off jets');
st = S.newState(); S.weapon(spec('iPhone 16'), st, 'press', {}, coin); assert.strictEqual(st.power, 'dead');

// Thermals: protection throttles and survives; unprotected burns; apps are never killed
const run = (s, appsIn, envX, mins) => {
  const st = S.newState(25), apps = structuredClone(appsIn), env = { ambient: 25, sun: false, unsafe: false, ...envX };
  let r; for (let t = 0; t < mins * 60; t++) r = S.perfStep(s, st, apps, env, 1, 0.05, coin);
  return { st, apps, r };
};
let r = run(spec('iPhone 16'), [{ key: 'stress', count: 1 }], {}, 30);
assert.strictEqual(r.st.power, 'on'); assert.ok(r.st.T < 49 && r.st.throttle < 1, `T=${r.st.T}`);
r = run(spec('iPhone 16'), [{ key: 'stress', count: 1 }], { unsafe: true }, 30);
assert.ok(r.st.fire, 'unprotected stress test should end in thermal runaway');
r = run(spec('Budget'), [{ key: 'stress', count: 1 }], { unsafe: true }, 30);
assert.ok(r.st.swellWarned && r.st.smokeWarned, 'budget phone should swell and smoke');
r = run(spec('iPhone 16'), [{ key: 'genshin', count: 20 }], {}, 1);
assert.strictEqual(r.apps[0].count, 20, 'apps must not be killed'); assert.ok(r.r.swap > 10 && r.r.fps < 0.1, 'RAM overflow should crawl');
// DOOM runs on modest hardware: a 2014 Galaxy S5 at full speed, an Apple Watch too
for (const d of ['Galaxy S5', 'Apple Watch']) { r = run(spec(d), [{ key: 'doom', count: 1 }], {}, 1); assert.ok(r.r.fps === 1, `${d} should run DOOM at 35 fps`); }
r = run(spec('iPhone 16'), [{ key: 'genshin', count: 1 }], { ambient: 45, sun: true, hmul: 0.3 }, 30);
assert.ok(r.apps.length === 1, 'thermal shutdown keeps apps');

// Import validation & custom materials
const { spec: bad, warnings } = S.validateSpec({ name: '<img onerror=x>', ip: 'toString', weight: 1e9, soc: { name: 'X1', cpu: 'abc', tdp: 99 },
  glass: { name: 'Unobtanium', tough: 50, hard: 11 }, design: { color: 'red;', screen: 'hologram' }, size: { w: 5 } });
assert.strictEqual(bad.ip, 'IP68-6m'); assert.strictEqual(bad.weight, 50000); assert.strictEqual(bad.soc, 'custom_soc');
assert.strictEqual(S.SOCS.custom_soc.tdp, 30); assert.strictEqual(S.GLASS.custom_glass.hard, 10); assert.strictEqual(S.GLASS.custom_glass.shatter, false);
assert.strictEqual(bad.design.color, S.DEFAULT_DESIGN.color); assert.strictEqual(bad.design.screen, 'punch'); assert.strictEqual(bad.size.w, 20);
assert.ok(warnings.length >= 2);
assert.deepStrictEqual(S.validateSpec(S.exportSpec(bad)).spec.glass, 'custom_glass', 'export round-trips');
assert.throws(() => S.validateSpec('nope'));

console.log('all sim checks passed');

// ---- physics (world.js) ----
const Wd = require('./world.js'), { Q, v3 } = Wd;
const sim = (W, b, secs) => { const ev = []; for (let t = 0; t < secs; t += 1 / 60) ev.push(...Wd.step(W, b, 1 / 60, coin)); return ev; };
let W = Wd.makeWorld('lab', { pool: 3, height: 10 }), b = Wd.makeBody(spec('iPhone 16'));
Wd.place(W, b, 2, 5, 2, Q.axis(v3(1, 0, 0), Math.PI / 2)); // screen facing the floor, 2 m up
let ev = sim(W, b, 3);
const first = ev.find(e => e.type === 'impact');
assert.strictEqual(first.hit, 'screen', `flat screen-down drop should hit the screen, got ${first.hit}`);
assert.ok(Math.abs(first.speed - v(2)) < 0.4 && first.fell > 1.9, `speed ${first.speed} fell ${first.fell}`);
assert.ok(b.asleep && Math.abs(b.p.y - b.ht) < 0.01, `should rest flat on the floor, y=${b.p.y} asleep=${b.asleep}`);
// corner-first drop from 3 m tumbles and still comes to rest on the ground (never floats)
b = Wd.makeBody(spec('iPhone 16')); Wd.place(W, b, 2, 5, 3, Q.norm({ w: 0.8, x: 0.4, y: 0.3, z: 0.3 }));
ev = sim(W, b, 6);
assert.strictEqual(ev.find(e => e.type === 'impact').hit, 'corner');
assert.ok(b.asleep && Wd.lowest(b) > -0.01 && b.p.y < 0.05, `resting y=${b.p.y}`);
// thrown against a wall: must not freeze in mid-air
b = Wd.makeBody(spec('iPhone 16')); Wd.place(W, b, 14.5, 5, 2); Wd.launch(W, b, v3(8, 2, 0), coin);
sim(W, b, 6); assert.ok(b.p.y < 0.1 || Wd.mediumAt(W, b.p), `ended at y=${b.p.y}`);
// stairs: tumbles down several steps
W = Wd.makeWorld('stairs', { height: 10 }); b = Wd.makeBody(spec('iPhone 16')); Wd.place(W, b, 2.9, 5);
Wd.launch(W, b, v3(2, 0.5, 0), coin); ev = sim(W, b, 8);
assert.ok(ev.filter(e => e.type === 'impact').length >= 3 && b.p.x > 3.5 && b.p.y < 2.7, `stairs: x=${b.p.x} y=${b.p.y}`);
// planar (2D) mode rests on its edge in the slice
W = Wd.makeWorld('lab', { pool: 3, height: 10, planar: true }); b = Wd.makeBody(spec('iPhone 16')); Wd.place(W, b, 2, 0, 2);
sim(W, b, 4); assert.ok(b.asleep && b.p.z === 5 && b.p.y < b.hh + 0.01, `planar y=${b.p.y}`);
// lava floats a phone; moon falls slower
W = Wd.makeWorld('volcano', {}); b = Wd.makeBody(spec('iPhone 16')); Wd.place(W, b, 11, 5, 1.5); ev = sim(W, b, 6);
assert.ok(ev.some(e => e.medium === 'lava') && b.p.y > -0.7, `lava y=${b.p.y}`);
W = Wd.makeWorld('moon', {}); b = Wd.makeBody(spec('iPhone 16')); Wd.place(W, b, 2, 5, 2, Q.axis(v3(1, 0, 0), Math.PI / 2));
assert.ok(Math.abs(sim(W, b, 3).find(e => e.type === 'impact').speed - Math.sqrt(2 * 1.62 * 2)) < 0.3, 'moon impact speed');
console.log('all physics checks passed');
