import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

export * from './generated/client';

// Un seul client par processus, y compris sous le rechargement à chaud de Next.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL manquant : voir .env.example');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? create();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
