/*
 * Screen-by-screen capture of the real interface, for design passes.
 *
 *   npm run dev            # in another shell
 *   node scripts/flow-shots.mjs <outdir> [label]
 *
 * Unlike shots.mjs (which hides the UI to judge the town), this keeps every
 * piece of interface on and walks the path a player takes: title, the
 * accessibility sheet, the job board, a brief, the first seconds of a run,
 * the pause menu and the plan. Each at iPhone portrait, small iPhone,
 * iPhone landscape and desktop.
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const out = process.argv[2] ?? 'flow';
const label = process.argv[3] ?? 'flow';
const url = process.env.SHOT_URL ?? 'http://localhost:5173/';
mkdirSync(out, { recursive: true });

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const VIEWPORTS = (process.env.SHOT_VP ?? 'iphone,se,land,desk').split(',').map((n) => ({
  iphone: { name: 'iphone', width: 393, height: 852, scale: 2, touch: true },
  se: { name: 'se', width: 375, height: 667, scale: 2, touch: true },
  land: { name: 'land', width: 852, height: 393, scale: 2, touch: true },
  desk: { name: 'desk', width: 1280, height: 800, scale: 1, touch: false },
}[n]));

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale,
    hasTouch: vp.touch, isMobile: vp.touch, userAgent: vp.touch ? IPHONE_UA : undefined,
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(vp.name, 'pageerror', e.message));
  const shot = (n) => page.screenshot({ path: `${out}/${label}-${vp.name}-${n}.png` });
  const tap = (sel) => (vp.touch ? page.tap(sel) : page.click(sel));
  await page.goto(url);
  await page.waitForSelector('#title-ride');
  await page.waitForTimeout(2500);
  await shot('01-title');
  await tap('#title-access');
  await page.waitForTimeout(400);
  await shot('02-access');
  await tap('#title-access-done');
  await page.waitForTimeout(300);
  await tap('#title-ride');
  await page.waitForSelector('#jobs-board:not(.hidden)');
  await page.waitForTimeout(900);
  await shot('03-board');
  await tap('#jobs-board .job-row:not(.locked)');
  await page.waitForTimeout(400);
  await shot('04-brief');
  await tap('#jobs-board [data-act="go"]');
  await page.waitForTimeout(3000);
  await shot('05-run');
  // The plan: Q opens it on any device with a keyboard, touch included.
  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(1200);
  await shot('06-plan');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  await shot('07-pause');
  await ctx.close();
}
await browser.close();
