import { PrismaClient } from '@/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Prisma 7 drops the bundled query engine, so the client connects through a driver
// adapter. Neon's serverless driver needs a WebSocket implementation in Node (no
// global WebSocket before Node 22); the WS-based PrismaNeon adapter is required
// because Prisma runs transactions, which the HTTP-only adapter cannot.
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

// Reuse one client across dev hot-reloads and warm serverless invocations.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
