import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

const PORT = 5174
const BASE = `http://127.0.0.1:${PORT}/skittles-br/`

// Prefer a Chromium that's already in the environment; otherwise fall back to
// Playwright's managed browser (run `npx playwright install chromium` locally).
const preinstalled = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const executablePath = existsSync(preinstalled) ? preinstalled : undefined

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: BASE,
    headless: true,
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      // Required when running as root inside a container.
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --host 127.0.0.1`,
    url: BASE,
    reuseExistingServer: true,
    timeout: 60_000
  }
})
