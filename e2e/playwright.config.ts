import { defineConfig, devices } from '@playwright/test';

// Assumes the full local stack is already running per the root README's
// "Local development" section: docker-compose (Postgres), Spring Boot on
// :8080, and `ng serve` on :4200. This config deliberately does NOT try to
// orchestrate those three heterogeneous processes itself.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env['BASE_URL'] ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
