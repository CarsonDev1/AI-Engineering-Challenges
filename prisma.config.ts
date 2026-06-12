import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 moves CLI/migration configuration here. `dotenv/config` loads .env so
// the CLI sees DATABASE_URL (the dev .env is gitignored; Vercel provides the env var).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
