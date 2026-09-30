import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'on-first-retry' },
  webServer: [
    {
      command: '..\\.venv\\Scripts\\python ..\\backend\\manage.py runserver 127.0.0.1:8000',
      port: 8000,
      reuseExistingServer: true,
    },
    { command: 'npm run dev -- --host 127.0.0.1', port: 5173, reuseExistingServer: true },
  ],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
