import { defineConfig } from '@playwright/test';

/**
 * Browser checks against a production build served by `vite preview`:
 *
 *   e2e/visual.spec.ts   the interface screens, compared with committed baselines
 *   e2e/a11y.spec.ts     axe-core, WCAG 2.2 A/AA, fails on serious or critical
 *   e2e/layout.spec.ts   the run's geometry: nothing the player reads collides
 *
 * The town is drawn on a canvas that never stops moving, so the visual spec
 * masks it and judges the interface over it. Three devices: an iPhone held
 * upright, the same iPhone on its side, and a desktop. There is no WebKit in
 * the cloud image, so "iPhone" is Chromium with an iPhone's viewport, density,
 * touch and user agent — close for layout, not a substitute for a real phone.
 *
 * Baselines are rendered on the CI runner (.github/workflows/visual-baselines.yml)
 * because different machines anti-alias text differently. @playwright/test is
 * pinned to the release whose Chromium build is preinstalled in Claude Code
 * cloud sessions (CHROMIUM_PATH / /opt/pw-browsers).
 */
const PORT = 4173;
const baseURL = process.env.BASE_URL ?? `http://localhost:${PORT}/`;
const executablePath = process.env.CHROMIUM_PATH || undefined;
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const iphone = { userAgent: IPHONE_UA, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results/e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}-{projectName}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'test-results/report' }]] : 'list',
  expect: {
    toHaveScreenshot: {
      // Per-pixel colour tolerance only: a recoloured label fails, sub-pixel
      // anti-aliasing noise does not.
      threshold: 0.1,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  use: {
    baseURL,
    serviceWorkers: 'block',
    contextOptions: { reducedMotion: 'reduce' },
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'iphone', use: { ...iphone, viewport: { width: 393, height: 852 } } },
    { name: 'iphone-landscape', use: { ...iphone, viewport: { width: 852, height: 393 } } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    // The smallest iPhone still sold, for the geometry rules only.
    { name: 'iphone-se', testMatch: /layout\.spec/, use: { ...iphone, viewport: { width: 375, height: 667 } } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
