import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 5000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  webServer: {
    command: 'npm run dev -- --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
