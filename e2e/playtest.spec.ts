import { test, expect } from '@playwright/test';
import { openPause, openPlaytest, press } from './flow';

/*
 * The playtest build (docs/53). Off for everybody unless the link asks for
 * it; on, the pause menu opens a sheet whose answers are typed text and never
 * reach the game's keys, and whose report carries what was typed.
 */
test('a normal player has no playtest button', async ({ page }, info) => {
  await openPause(page, info);
  await expect(page.locator('#menu [data-act="playtest"]')).toHaveCount(0);
});

test('the sheet takes typing and writes it into the report', async ({ page, context }, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await openPlaytest(page, info);
  const box = page.locator('#playtest textarea[data-q="stuck"]');
  await box.fill('the bridge, for ages');
  // H would show every control and Escape would close: typing H must do neither.
  await box.press('h');
  await expect(page.locator('#playtest')).not.toHaveClass(/hidden/);
  await expect(box).toHaveValue('the bridge, for agesh');
  await press(page, info, '#playtest [data-act="copy"]');
  await expect(page.locator('#playtest .pt-status')).not.toBeEmpty();
  const text = await page.evaluate(async () => {
    try { return await navigator.clipboard.readText(); } catch { return document.querySelector('#playtest .pt-seen pre')?.textContent ?? ''; }
  });
  expect(text).toContain('UNDERWATCH PLAYTEST REPORT');
  expect(text).toContain('> the bridge, for agesh');
  await press(page, info, '#playtest [data-act="close"]');
  await expect(page.locator('#playtest')).toHaveClass(/hidden/);
});
