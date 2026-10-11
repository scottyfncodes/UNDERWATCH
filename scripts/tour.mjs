/*
 * The whole game, screen by screen, with the interface on — for visual
 * passes. Walks the path a player takes and, where a state takes minutes of
 * play to reach (a finished job, being caught, an ending), puts the game
 * into it through the dev-only `window.__underwatch` handle. Never ships.
 *
 *   npm run dev            # in another shell
 *   node scripts/tour.mjs <outdir> [label]      SHOT_VP=iphone,desk
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const out = process.argv[2] ?? 'tour';
const label = process.argv[3] ?? 'tour';
const url = process.env.SHOT_URL ?? 'http://localhost:5173/';
mkdirSync(out, { recursive: true });
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const VPS = {
  iphone: { width: 393, height: 852, scale: 2, touch: true },
  land: { width: 852, height: 393, scale: 2, touch: true },
  desk: { width: 1440, height: 900, scale: 1, touch: false },
};
const only = process.env.SHOT_ONLY ? new RegExp(process.env.SHOT_ONLY) : null;

const browser = await chromium.launch();
for (const name of (process.env.SHOT_VP ?? 'iphone,desk').split(',')) {
  const vp = VPS[name];
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale,
    hasTouch: vp.touch, isMobile: vp.touch, userAgent: vp.touch ? IPHONE_UA : undefined,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(name, 'pageerror', e.message));
  const shot = async (n) => { if (!only || only.test(n)) await page.screenshot({ path: `${out}/${label}-${name}-${n}.png` }); };
  const tap = (sel) => (vp.touch ? page.tap(sel) : page.click(sel));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms) => page.waitForTimeout(ms);

  // ---- jobs
  await page.goto(url);
  await page.waitForSelector('#title-ride');
  await wait(2600);
  await shot('01-title');
  await tap('#title-ride');
  await page.waitForSelector('#jobs-board:not(.hidden) .job-row');
  await wait(700);
  await shot('02-board');
  await tap('#jobs-board .job-row:not(.locked)');
  await wait(400);
  await shot('03-brief');
  await tap('#jobs-board [data-act="go"]');
  await wait(2600);
  await shot('04-run-start');
  // Push for a while, down the east path.
  await page.keyboard.down('KeyW'); await wait(1800);
  await shot('05-skating');
  await page.keyboard.up('KeyW');
  // The Lot's handrail.
  await g(() => {
    const s = window.__underwatch.sim; const p = s.player;
    const at = { x: 327, y: 232 };
    const line = [...s.grinds].sort((a, b) => Math.hypot((a.a.x + a.b.x) / 2 - at.x, (a.a.y + a.b.y) / 2 - at.y) - Math.hypot((b.a.x + b.b.x) / 2 - at.x, (b.a.y + b.b.y) / 2 - at.y))[0];
    const h = Math.atan2(line.b.y - line.a.y, line.b.x - line.a.x);
    p.pos = { x: line.a.x + Math.cos(h) * 0.6, y: line.a.y + Math.sin(h) * 0.6 }; p.heading = h; p.speed = 7; p.vel = { x: Math.cos(h) * 7, y: Math.sin(h) * 7 };
    window.__underwatch.renderer.chase.reset(s);
  });
  await page.keyboard.press('KeyC'); await wait(500);
  await shot('06-grind');
  await wait(1500);
  // The sling: drawn back from the rider.
  if (vp.touch) {
    const b = await g(() => window.__underwatch.touch.buttonLayout().find((x) => x.id === 'sling'));
    await page.touchscreen.tap(b.pos.x, b.pos.y);
    await wait(500);
    await shot('07-sling-out');
  } else {
    const cx = vp.width / 2, cy = vp.height * 0.55;
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 60, cy + 120, { steps: 8 }); await wait(500);
    await shot('07-sling-draw');
    await page.mouse.up(); await wait(400);
    await shot('08-stone-flight');
  }
  if (vp.touch) { const b = await g(() => window.__underwatch.touch.buttonLayout().find((x) => x.id === 'sling')); await page.touchscreen.tap(b.pos.x, b.pos.y); await wait(300); }
  // Recon.
  await page.keyboard.press('KeyQ'); await wait(1400);
  await shot('09-plan');
  await page.keyboard.press('Escape'); await wait(500);
  // Being seen: put the rider in front of a lens for a moment.
  await g(() => { const r = window.__underwatch.run; r.exposure.value = 62; r.exposure.level = 'TRACKED'; r.exposure.worst = 'TRACKED'; });
  await wait(900);
  await shot('10-tracked');
  await g(() => { const r = window.__underwatch.run; r.exposure.value = 0; r.exposure.level = 'UNSEEN'; });
  // Up the east kicker and into the air, with a trick.
  await g(() => { const s = window.__underwatch.sim; const p = s.player; p.pos = { x: 401, y: 215 }; p.heading = Math.PI; p.speed = 9; p.vel = { x: -9, y: 0 }; });
  await wait(450); await page.keyboard.press('KeyR'); await wait(250);
  await shot('11-air-trick');
    await wait(1500);
  await shot('12-landed-score');
  // Air off the kicker finishes job 01 for real.
  await wait(2600);
  await shot('13-results');
  // Caught.
  await g(() => { const gm = window.__underwatch; gm.results.hide(); gm.busted.show(40, 1, () => {}); });
  await wait(900);
  await shot('14-busted');
  await g(() => window.__underwatch.busted.hide?.());
  // ---- the afternoon
  await page.goto(url);
  await page.waitForSelector('#title-story');
  await wait(800);
  await tap('#title-story');
  await wait(3500);
  await shot('15-ad');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__underwatch?.phase === 'play', null, { timeout: 60000 }).catch(async () => {
    await page.mouse.click(vp.width / 2, vp.height / 2);
    await page.waitForFunction(() => window.__underwatch?.phase === 'play', null, { timeout: 60000 });
  });
  await wait(3500);
  await shot('16-story-street');
  await page.keyboard.press('KeyN'); await wait(700);
  await shot('17-notes');
  await page.keyboard.press('Escape'); await wait(400);
  await g(() => window.__underwatch.ending.show('review', ['review']));
  await wait(1200);
  await shot('18-ending');
  await ctx.close();
}
await browser.close();
