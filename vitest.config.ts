import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    // Several suites hit the same embedded database. Running their files in
    // parallel makes writers collide, so keep file execution serial.
    fileParallelism: false,
    // Point persistence at a scratch directory so a test run never mutates the
    // development database.
    env: {
      PGLITE_DIR: '.pglite-test',
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
