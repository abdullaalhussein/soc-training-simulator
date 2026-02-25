import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://client-production-4081.up.railway.app';
const isLocal = BASE_URL.includes('localhost');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    browserName: 'firefox',
    launchOptions: { timeout: 30_000 },
  },
  projects: [
    {
      name: 'auth',
      testDir: './e2e/auth',
      use: { storageState: { cookies: [], origins: [] } },
    },
    {
      name: 'admin',
      testDir: './e2e/admin',
      dependencies: ['auth'],
      use: { storageState: 'e2e/.auth/admin.json' },
    },
    {
      name: 'trainer',
      testDir: './e2e/trainer',
      dependencies: ['admin'],
      use: { storageState: 'e2e/.auth/trainer.json' },
    },
    {
      name: 'trainee',
      testDir: './e2e/trainee',
      dependencies: ['trainer'],
      use: { storageState: 'e2e/.auth/trainee.json' },
    },
    {
      name: 'shared',
      testDir: './e2e/shared',
      dependencies: ['auth'],
      use: { storageState: 'e2e/.auth/admin.json' },
    },
    {
      name: 'demo',
      testDir: './e2e/demo',
      use: {
        browserName: 'chromium',
        storageState: { cookies: [], origins: [] },
        video: { mode: 'on', size: { width: 1920, height: 1080 } },
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        launchOptions: {
          slowMo: 300,
          args: ['--force-device-scale-factor=1', '--high-dpi-support=1'],
        },
      },
    },
    {
      name: 'demo-v2',
      testDir: './e2e/demo-v2',
      use: {
        browserName: 'chromium',
        storageState: { cookies: [], origins: [] },
        video: { mode: 'on', size: { width: 1920, height: 1080 } },
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        launchOptions: {
          slowMo: 80,
          args: ['--force-device-scale-factor=1', '--high-dpi-support=1'],
        },
      },
    },
  ],
  globalSetup: './e2e/fixtures/auth.ts',
  ...(isLocal
    ? {
        webServer: [
          {
            command: 'npm run dev -w server',
            port: 3001,
            reuseExistingServer: true,
            timeout: 30_000,
          },
          {
            command: 'npm run dev -w client',
            port: 3000,
            reuseExistingServer: true,
            timeout: 30_000,
          },
        ],
      }
    : {}),
});
