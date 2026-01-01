import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './',
  timeout: 120000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['dot'], ['github']] : [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    actionTimeout: 15000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
