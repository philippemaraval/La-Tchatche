import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    css: true,
    setupFiles: './src/tests/setupTests.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/App.jsx', 'src/features/**/*.js', 'src/lib/**/*.js'],
      thresholds: {
        branches: 10,
        functions: 20,
        lines: 20,
        statements: 20,
      },
    },
  },
})
