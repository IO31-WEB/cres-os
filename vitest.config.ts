import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    // Concurrency/integration tests spin up real Postgres transactions —
    // run test files sequentially so they don't fight over the same
    // TEST_DATABASE_URL. Individual tests within a file may still run
    // concurrently via Promise.all where that's the point of the test.
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      // Pure-logic unit tests (e.g. resolveAssignment) import from
      // lib/visibility.ts, which transitively imports lib/db — and that
      // module throws at import time if DATABASE_URL is unset, even
      // though these particular tests never issue a query. This is a
      // harmless placeholder for that import-time guard, not a real
      // connection; integration tests that actually query Postgres use
      // TEST_DATABASE_URL instead (see tests/integration/*.test.ts).
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://placeholder:placeholder@localhost:5432/placeholder',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
})
