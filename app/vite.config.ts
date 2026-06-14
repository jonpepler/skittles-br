/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` is the repo name so built asset URLs resolve under
// https://<user>.github.io/skittles-br/. Override with BASE_PATH if the repo
// is ever renamed or served from a custom domain.
const base = process.env.BASE_PATH ?? '/skittles-br/'

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}']
  }
})
