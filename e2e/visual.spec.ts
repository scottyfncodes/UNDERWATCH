import { test, expect, type Page } from '@playwright/test';
import { openTitle, openBoard, openBrief, openPause } from './flow';

/*
 * The interface, screen by screen, over a blank town. The canvas is never
 * still (the camera breathes, people walk), so it is hidden and only what
 * the DOM draws is compared, over a flat mid-tone that shows every scrim.
 * Run HUD geometry is checked in layout.spec.ts instead: its numbers tick
 * every frame.
 */
const BLANK_TOWN = '#game { visibility: hidden !important; } html, body { background: #3A4650 !important; }';
const shoot = async (page: Page) => {
  await page.addStyleTag({ content: BLANK_TOWN });
  // Park the pointer in a corner, so no screen is compared with whatever
  // the last press left hovered.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(100);
  return {};
};

test('title', async ({ page }) => {
  await openTitle(page);
  await expect(page).toHaveScreenshot('title.png', await shoot(page));
});

test('accessibility sheet', async ({ page }) => {
  await openTitle(page);
  // The sheet opens over the button that opens it, so a real tap or click
  // leaves the pointer resting on its DONE — hovered on a desktop, and on
  // an emulated phone by a tap's hover that a later mouse move does not
  // reliably clear. Opened without a pointer, nothing on it is hovered.
  await page.locator('#title-access').dispatchEvent('click');
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot('access.png', await shoot(page));
});

test('job board', async ({ page }, info) => {
  await openBoard(page, info);
  await expect(page).toHaveScreenshot('board.png', await shoot(page));
});

test('brief', async ({ page }, info) => {
  await openBrief(page, info);
  await expect(page).toHaveScreenshot('brief.png', await shoot(page));
});

test('pause menu', async ({ page }, info) => {
  await openPause(page, info);
  await expect(page).toHaveScreenshot('pause.png', await shoot(page));
});
