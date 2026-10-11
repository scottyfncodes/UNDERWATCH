/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist', sourcemap: true },
  server: { port: 5173, host: true },
  // Browser specs under e2e/ belong to Playwright, not Vitest.
  test: { include: ['tests/**/*.test.ts'] },
});
