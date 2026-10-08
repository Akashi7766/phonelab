# PhoneLab — smartphone torture simulator

**▶ Play it: https://akashi7766.github.io/phonelab/**

A browser sandbox for abusing phones (and a few other gadgets) in the name of science. No build step, no dependencies: open `index.html` or serve the folder.

```bash
python -m http.server 8765
```

## What you can do

- **Spec a device**: processor, RAM, battery, cooling, IP rating, glass, frame, case, size and design, or load a preset (iPhone 16 Pro Max, Galaxy S25 Ultra, Pixel 9 Pro, ROG Phone 9, iPhone 11, Galaxy S5, Nokia 3310, iPad Pro, Apple Watch Ultra 2, Nintendo Switch OLED, Game Boy). Every material can be custom-valued; specs import/export as JSON.
- **Drop and throw it** in a 3D rigid-body arena (or a 2D side view): test lab with sand pit and pool, concrete staircase, bathroom (toilet, bathtub), playground (trampoline, ball pit), frozen lake, volcano (lava), the Moon and Mars. Which face, edge or corner lands is decided by real tumbling physics.
- **Torture it** in a rotatable close-up: hammer, Mohs scratch picks, knife, pistol, shotgun, bowling ball, taser, lighter, blowtorch, pressure washer, liquid nitrogen, microwave, bend test, car, hydraulic press, lightning, magnet, blender — on any face, edge or corner.
- **Run software**: DOOM (and swarms of it), Tetris, Snake, Minecraft, Genshin, Fortnite, LLMs, crypto miners, GTA V, Crysis, plus Geekbench / 3DMark-style benchmarks. Apps are never killed; they slow down when RAM swaps, the chip throttles or the device overheats — and with thermal protection off, batteries swell, smoke and catch fire.

Numbers are plausible approximations tuned for believability, not lab data.

## Files

| File | What it does |
| --- | --- |
| `sim.js` | Damage, water/sand ingress, thermals, performance, weapons (pure, no DOM) |
| `world.js` | Arenas and the rigid-body physics engine (pure, no DOM) |
| `draw.js` | Device designs, screen contents, damage overlays |
| `render3d.js` | Canvas-2D 3D renderer: projection, clipping, textured boxes, picking |
| `app.js` | Spec editor, software lab, benchmarks, telemetry |
| `view.js` | Arena views, input, torture close-up, main loop |
| `test.js` | `node test.js` — model and physics checks |
