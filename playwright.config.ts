import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // `github` annotates failures inline on the PR diff; the HTML report is kept as an artifact.
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  // Turbopack compiles a route on its first hit, so first navigations can be slow.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // CI tests the artefact that ships: the standalone server the Docker image runs,
    // built by the `build` job. Locally `next dev` keeps the edit-and-rerun loop fast.
    command: process.env.CI ? 'npm run start:standalone' : 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
