import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const servidorVisual = new URL(baseURL);
const usaServidorLocal = ['localhost', '127.0.0.1'].includes(servidorVisual.hostname);
const portaServidor = servidorVisual.port || '3000';

export default defineConfig({
  testDir: './tests/visual',
  outputDir: './test-results/visual',
  timeout: 30_000,
  workers: 1,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  webServer: usaServidorLocal
    ? {
        command: `pnpm exec next dev --hostname ${servidorVisual.hostname} --port ${portaServidor}`,
        url: servidorVisual.origin,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI
      }
    : undefined,
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 900 }
      }
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 5']
      }
    }
  ]
});
