import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    // Several suites hit the same SQLite file. Running their files in parallel
    // makes writers collide with SQLITE_BUSY, so keep file execution serial.
    fileParallelism: false,
    // Point persistence at a scratch database so a test run never mutates the
    // local.db a developer is working against.
    env: {
      TURSO_DATABASE_URL: 'file:test.db',
    },
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: {
      '@': '.',
    },
  },
})
