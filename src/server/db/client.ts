import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient() {
  // Limit pool size for Vercel serverless — each function instance should hold
  // at most 2 connections. Without this the default (10) exhausts Supabase's
  // free-tier connection limit when multiple instances run concurrently.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Reuse the client across hot-reloads in dev; in production the module cache
// keeps the singleton alive for the lifetime of the container.
export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
