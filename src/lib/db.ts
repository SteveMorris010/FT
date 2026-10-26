import { PrismaClient } from "@/generated/prisma";

// A hot-reload-safe singleton PrismaClient.
//
// In development Next.js clears the module cache on every change, which would
// otherwise create a new PrismaClient (and a new DB connection pool) on each
// reload and eventually exhaust connections. We cache the instance on the
// global object to reuse it across reloads.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
