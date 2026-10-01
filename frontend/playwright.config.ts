import { defineConfig, devices } from '@playwright/test'

const python = process.env.PLAYWRIGHT_PYTHON || '..\\.venv\\Scripts\\python'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'on-first-retry' },
  webServer: [
    {
      command: `${python} ../backend/manage.py runserver 127.0.0.1:8000 --noreload`,
      url: 'http://127.0.0.1:8000/api/health/',
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --strictPort',
      url: 'http://127.0.0.1:5173/',
      reuseExistingServer: true,
    },
  ],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
