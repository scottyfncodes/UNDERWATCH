/*
 * The moments docs/52 is about, captured in the street with the interface
 * on: being watched by a camera the player knows, being tracked, a grind, a
 * slam, a trick caught, and a job point done. Puts the game into each state
 * through the dev-only `window.__underwatch` handle. Never ships.
 *
 *   npm run dev            # in another shell
 *   node scripts/impact-shots.mjs <outdir> [label]      SHOT_VP=iphone,desk
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const out = process.argv[2] ?? 'impact';
const label = process.argv[3] ?? 'impact';
const url = process.env.SHOT_URL ?? 'http://localhost:5173/';
mkdirSync(out, { recursive: true });
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const VPS = {
  iphone: { width: 393, height: 852, scale: 2, touch: true },
  land: { width: 852, height: 393, scale: 2, touch: true },
  desk: { width: 1440, height: 900, scale: 1, touch: false },
};

const browser = await chromium.launch();
for (const name of (process.env.SHOT_VP ?? 'iphone,desk').split(',')) {
  const vp = VPS[name];
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale,
    hasTouch: vp.touch, isMobile: vp.touch, userAgent: vp.touch ? IPHONE_UA : undefined,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = (n) => page.screenshot({ path: `${out}/${label}-${name}-${n}.png` });
  const tap = (sel) => (vp.touch ? page.tap(sel) : page.click(sel));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms) => page.waitForTimeout(ms);

  await page.goto(url);
  await page.waitForSelector('#title-ride');
  await wait(1200);
  await tap('#title-ride');
  await page.waitForSelector('#jobs-board:not(.hidden) .job-row');
  await tap('#jobs-board .job-row:not(.locked)');
  await wait(300);
  await tap('#jobs-board [data-act="go"]');
  await wait(2400);

  // A street with cameras in it, the cameras noticed: stood in front of the
  // nearest working one, inside its picture, facing along its look.
  await g(() => {
    const s = window.__underwatch.sim; const p = s.player;
    const cams = s.sensors.filter((c) => c.data.kind !== 'reader' && c.state === 'ONLINE');
    cams.sort((a, b) => Math.hypot(a.data.pos.x - 330, a.data.pos.y - 300) - Math.hypot(b.data.pos.x - 330, b.data.pos.y - 300));
    const c = cams[0];
    for (const o of cams.slice(0, 8)) s.knownSensors.add(o.data.id);
    s.recon.cameras.set(c.data.id, { id: c.data.id, studied: 99, spotted: true, timed: true });
    const f = c.data.facing;
    p.pos = { x: c.data.pos.x + Math.cos(f) * c.data.range * 0.45, y: c.data.pos.y + Math.sin(f) * c.data.range * 0.45 };
    p.heading = f + Math.PI * 0.85; p.speed = 0; p.vel = { x: 0, y: 0 };
    window.__underwatch.renderer.chase.reset(s);
  });
  await wait(1600);
  await shot('01-watched');
  await g(() => { const r = window.__underwatch.run; if (r) { r.exposure.value = 60; r.exposure.level = 'TRACKED'; } });
  await wait(500);
  await shot('02-tracked');

  // Out of the picture again: the cones it knows stay on the ground.
  await g(() => {
    const s = window.__underwatch.sim; const p = s.player;
    const c = s.sensors.find((x) => s.knownSensors.has(x.data.id));
    // Beside its look, out of the picture, the cone ahead and to one side.
    const f = c.data.facing, side = f + Math.PI / 2;
    const off = c.data.range * 0.55;
    p.pos = { x: c.data.pos.x + Math.cos(side) * off - Math.cos(f) * 6, y: c.data.pos.y + Math.sin(side) * off - Math.sin(f) * 6 };
    p.heading = f + 0.5; window.__underwatch.renderer.chase.reset(s);
    const r = window.__underwatch.run; if (r) { r.exposure.value = 0; r.exposure.level = 'UNSEEN'; }
  });
  await wait(1400);
  await shot('03-known-cones');

  // The Lot's handrail, at speed.
  await g(() => {
    const s = window.__underwatch.sim; const p = s.player;
    const at = { x: 327, y: 232 };
    const line = [...s.grinds].sort((a, b) => Math.hypot((a.a.x + a.b.x) / 2 - at.x, (a.a.y + a.b.y) / 2 - at.y) - Math.hypot((b.a.x + b.b.x) / 2 - at.x, (b.a.y + b.b.y) / 2 - at.y))[0];
    const h = Math.atan2(line.b.y - line.a.y, line.b.x - line.a.x);
    p.pos = { x: line.a.x + Math.cos(h) * 0.6, y: line.a.y + Math.sin(h) * 0.6 }; p.heading = h; p.speed = 8; p.vel = { x: Math.cos(h) * 8, y: Math.sin(h) * 8 };
    window.__underwatch.renderer.chase.reset(s);
  });
  await page.keyboard.press('KeyC'); await wait(700);
  await shot('04-grind');
  await wait(1600);

  // A slam: the presentation of one, at the rider.
  await g(() => { const s = window.__underwatch.sim; s.bus.emit('player:bail', { pos: { ...s.player.pos } }); });
  await wait(120);
  await shot('07-bail');
  await wait(800);

  // A job point done: the beam flares where it was.
  await g(() => { const gm = window.__underwatch; const s = gm.sim; const p = s.player.pos; gm.renderer.objective?.({ x: p.x + 6, y: p.y - 2 }); });
  await wait(200);
  await shot('08-objective');
  // Up the east kicker into a flip; the frame the feet catch it.
  await g(() => { const s = window.__underwatch.sim; const p = s.player; p.pos = { x: 401, y: 215 }; p.heading = Math.PI; p.speed = 9; p.vel = { x: -9, y: 0 }; window.__underwatch.renderer.chase.reset(s); });
  await wait(450); await page.keyboard.press('KeyR');
  await page.waitForFunction(() => window.__underwatch.sim.player.trick?.landed, null, { timeout: 4000 }).catch(() => {});
  await wait(60);
  await shot('05-trick-catch');
  await wait(900);
  await shot('06-landing');

  if (errors.length) console.error(name, 'errors:', errors.join(' | '));
  await ctx.close();
}
await browser.close();
