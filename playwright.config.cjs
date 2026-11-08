const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/browser',
  testMatch: process.env.PW_OVERFLOW_PROBE ? 'overflow-probe.spec.cjs' : ['site.spec.cjs', 'running.spec.cjs'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone-chromium', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }
  ],
  webServer: {
    command: 'python tools/serve-browser-site.py',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false
  }
});
