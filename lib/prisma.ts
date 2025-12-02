import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

// Créer le pool de connexions PostgreSQL
const connectionString = process.env.POOLER_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("❌ POOLER_URL ou DATABASE_URL manquante dans .env");
}

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
  });

// Créer l'adapter Prisma pour PostgreSQL
const adapter = new PrismaPg(pool);

// Créer le client Prisma avec l'adapter
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}

