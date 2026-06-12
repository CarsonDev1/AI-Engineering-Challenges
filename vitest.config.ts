import { defineConfig, configDefaults } from 'vitest/config';
import path from 'node:path';

// Default suite = pure unit tests only. Integration tests (`*.integration.test.ts`,
// which hit the real Neon database) are excluded here and run via their own config
// (`vitest.integration.config.ts`, `npm run test:integration`) so `npm run test`
// stays fast, deterministic, and offline.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
