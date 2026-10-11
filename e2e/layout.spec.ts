import { test, expect, type Page } from '@playwright/test';
import { startRun, isTouch } from './flow';

/*
 * The run's geometry, measured rather than eyeballed. The canvas moves and
 * the numbers tick, so these are rules about rectangles instead of pixels:
 *
 *   - where you are going is never cut off in the job strip;
 *   - on a phone, nothing the town says lands on the strip, the corner
 *     buttons or the thumbs' controls;
 *   - on a phone, the town's cards step back while the plan is open, so its
 *     readout has the top of the glass to itself.
 */
type Box = { left: number; top: number; right: number; bottom: number };

const boxes = (page: Page, selector: string) => page.$$eval(selector, (els) => els
  .filter((e) => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && r.width > 0 && r.height > 0;
  })
  .map((e) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }));

const overlaps = (a: Box, b: Box) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;

test.beforeEach(async ({ page }, info) => {
  await startRun(page, info);
  // The town says its first two things within the first seconds of a job.
  await page.waitForSelector('.note', { timeout: 10_000 });
  await page.waitForTimeout(2500);
});

test('the objective is never cut off', async ({ page }) => {
  await expect(page.locator('#job-hud .jh-label')).toBeVisible();
  // The strip is rebuilt every frame, so find and measure it in one go: a
  // handle taken a moment earlier may already be detached and measure zero.
  const m = await page.evaluate(() => {
    const label = document.querySelector('#job-hud .jh-label') as HTMLElement;
    // On a desktop the label is plain inline text in a block that wraps; on a
    // phone it is a box of its own. Measure whichever is the box.
    const e = getComputedStyle(label).display === 'inline' ? label.parentElement as HTMLElement : label;
    return { text: label.textContent, sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight };
  });
  expect(m.cw, 'label laid out').toBeGreaterThan(0);
  expect(m.sw <= m.cw + 1 && m.sh <= m.ch + 1, `"${m.text}" is clipped: ${JSON.stringify(m)}`).toBe(true);
});

test('the town\'s cards keep off the strip, the corners and the controls', async ({ page }, info) => {
  test.skip(!isTouch(info), 'phone layout');
  const notes = await boxes(page, '.note');
  // One card at a time during a job: the strip already says how seen you are.
  expect(notes.length).toBe(1);
  const fixed = [
    ...(await boxes(page, '#job-hud')),
    ...(await boxes(page, '#pause-corner .hud-button')),
    ...(await boxes(page, '#corner .hud-button')),
  ];
  // The control cluster's top edge, as the touch layer publishes it.
  const controlTop = await page.evaluate(() =>
    window.innerHeight - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--control-top')));
  const controlLeft = await page.evaluate(() =>
    window.innerWidth - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--control-right')));
  for (const n of notes) {
    for (const f of fixed) expect(overlaps(n, f), `card ${JSON.stringify(n)} over ${JSON.stringify(f)}`).toBe(false);
    const inCluster = n.bottom > controlTop && n.right > controlLeft;
    expect(inCluster, `card ${JSON.stringify(n)} reaches the controls`).toBe(false);
  }
});

test('the plan has the top of the glass to itself', async ({ page }, info) => {
  test.skip(!isTouch(info), 'phone layout');
  await page.keyboard.press('KeyQ');
  await expect(page.locator('html')).toHaveClass(/plan-open/);
  await page.waitForTimeout(400);
  expect(await boxes(page, '.note')).toEqual([]);
});
