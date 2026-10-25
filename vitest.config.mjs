import { defineConfig } from 'vitest/config'

// API + socket tests. They run against an in-memory MongoDB that is started
// once (globalSetup) and thrown away afterwards - never a real database.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/tests/**/*.test.js', 'tests/unit/**/*.test.ts'],
    globalSetup: ['server/tests/global-setup.js'],
    setupFiles: ['server/tests/setup-env.js'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
  resolve: {
    alias: { '@': new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') },
  },
})
