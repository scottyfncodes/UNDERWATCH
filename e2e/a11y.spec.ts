import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openTitle, openBoard, openBrief, openPause, openPlaytest } from './flow';

/*
 * axe-core against WCAG 2.2 A and AA on every screen a player reads before
 * and between runs. Serious and critical findings fail; anything listed in
 * KNOWN_ISSUES is reported but does not fail, and should be deleted from
 * the list once it is fixed.
 */
const KNOWN_ISSUES: string[] = [];

async function scan(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    // The canvas is the game itself, not a document.
    .exclude('#game')
    .analyze();
  const blocking = result.violations.filter((v) =>
    (v.impact === 'serious' || v.impact === 'critical') && !KNOWN_ISSUES.includes(v.id));
  const known = result.violations.filter((v) => KNOWN_ISSUES.includes(v.id));
  for (const v of known) console.log(`known: ${v.id} (${v.nodes.length})`);
  expect(blocking.map((v) => `${v.id}: ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test('title', async ({ page }) => { await openTitle(page); await scan(page); });
test('job board', async ({ page }, info) => { await openBoard(page, info); await scan(page); });
test('brief', async ({ page }, info) => { await openBrief(page, info); await scan(page); });
test('pause menu', async ({ page }, info) => { await openPause(page, info); await scan(page); });
test('playtest sheet', async ({ page }, info) => { await openPlaytest(page, info); await scan(page); });
