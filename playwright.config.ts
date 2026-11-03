import { defineConfig, devices } from '@playwright/test';

const PORT = 3300;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Pixel 7'],
  },
  projects: [{ name: 'chromium-mobile', use: { browserName: 'chromium' } }],
  // Tests run against the production build served by the real server.
  webServer: {
    command: 'node e2e/serve.mjs',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    env: { PORT: String(PORT) },
  },
});
