import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Integration tests that exercise the repository against the real Neon database.
// `dotenv/config` loads DATABASE_URL (Vitest does not auto-load .env); tests run
// serially since they share one database. Invoke with `npm run test:integration`.
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    setupFiles: ['dotenv/config'],
    fileParallelism: false,
    // These tests make many sequential round-trips to a remote Neon database over the
    // serverless WebSocket driver (incl. interactive transactions), so the strict 5s
    // unit default is too tight. The unit suite keeps the default.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
