import type { Page, TestInfo } from '@playwright/test';

/** A fixed afternoon, so the board's daily conditions are the same every run. */
export const FIXED_NOW = new Date('2026-06-15T16:00:00Z');

export const isTouch = (info: TestInfo): boolean => !!info.project.use.hasTouch;

/** Press a control the way the device would. */
export async function press(page: Page, info: TestInfo, selector: string): Promise<void> {
  if (isTouch(info)) await page.tap(selector);
  else await page.click(selector);
}

/** A fresh visitor on the title screen, with the fonts in. */
export async function openTitle(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto('./');
  await page.waitForSelector('#title-ride');
  await page.evaluate(() => document.fonts.ready);
  // The title's own entrance.
  await page.waitForTimeout(700);
}

/** Title → RIDE → the job board. */
export async function openBoard(page: Page, info: TestInfo): Promise<void> {
  await openTitle(page);
  await press(page, info, '#title-ride');
  await page.waitForSelector('#jobs-board:not(.hidden) .job-row');
  await page.waitForTimeout(500);
}

/** The board → the first job's brief. */
export async function openBrief(page: Page, info: TestInfo): Promise<void> {
  await openBoard(page, info);
  await press(page, info, '#jobs-board .job-row:not(.locked)');
  await page.waitForSelector('#jobs-board [data-act="go"]');
  await page.waitForTimeout(300);
}

/** The brief → GO: the first seconds of job 01. */
export async function startRun(page: Page, info: TestInfo): Promise<void> {
  await openBrief(page, info);
  await press(page, info, '#jobs-board [data-act="go"]');
  await page.waitForSelector('#job-hud:not(.hidden)');
}

/** Mid-run → the pause menu. */
export async function openPause(page: Page, info: TestInfo): Promise<void> {
  await startRun(page, info);
  await page.waitForTimeout(600);
  if (isTouch(info)) await page.tap('#pause-corner .hud-button');
  else await page.keyboard.press('Escape');
  await page.waitForSelector('#menu:not(.hidden) .menu-card');
  await page.waitForTimeout(400);
}
