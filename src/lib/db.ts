import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

// The WebSocket constructor is required for PrismaNeon (WebSocket mode) so that
// interactive transactions (db.$transaction with a callback) work.
// PrismaNeonHTTP (HTTP mode) does not support interactive transactions.
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

/**
 * Returns a Prisma client extended with company-scoped query middleware.
 * All read operations (findMany, findFirst, count, aggregate, groupBy) and
 * write operations (create, update, updateMany, delete, deleteMany) will
 * automatically inject the given companyId into the where/data clause.
 *
 * Note: findUnique is excluded — it uses PK lookup and callers must verify
 * ownership separately when needed.
 */
export function getCompanyScopedDb(companyId: string) {
  return db.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }: { args: Record<string, unknown>; query: (a: Record<string, unknown>) => Promise<unknown> }) {
          args.where = { companyId, ...(args.where as Record<string, unknown> ?? {}) };
          return query(args);
        },
        async findFirst({ args, query }: { args: Record<string, unknown>; query: (a: Record<string, unknown>) => Promise<unknown> }) {
          args.where = { companyId, ...(args.where as Record<string, unknown> ?? {}) };
          return query(args);
        },
        async count({ args, query }: { args: Record<string, unknown>; query: (a: Record<string, unknown>) => Promise<unknown> }) {
          args.where = { companyId, ...(args.where as Record<string, unknown> ?? {}) };
          return query(args);
        },
        async aggregate({ args, query }: { args: Record<string, unknown>; query: (a: Record<string, unknown>) => Promise<unknown> }) {
          args.where = { companyId, ...(args.where as Record<string, unknown> ?? {}) };
          return query(args);
        },
        async groupBy({ args, query }: { args: Record<string, unknown>; query: (a: Record<string, unknown>) => Promise<unknown> }) {
          args.where = { companyId, ...(args.where as Record<string, unknown> ?? {}) };
          return query(args);
        },
        async create({ args, query }: { args: Record<string, unknown>; query: (a: Record<string, unknown>) => Promise<unknown> }) {
          (args.data as Record<string, unknown>).companyId = companyId;
          return query(args);
        },
        async createMany({ args, query }: { args: Record<string, unknown>; query: (a: Record<string, unknown>) => Promise<unknown> }) {
          const data = args.data as Record<string, unknown> | Record<string, unknown>[];
          if (Array.isArray(data)) {
            args.data = data.map((row) => ({ ...row, companyId }));
          } else {
            (args.data as Record<string, unknown>).companyId = companyId;
          }
          return query(args);
        },
        async update({ args, query }: { args: Record<string, unknown>; query: (a: Record<string, unknown>) => Promise<unknown> }) {
          args.where = { companyId, ...(args.where as Record<string, unknown> ?? {}) };
          return query(args);
        },
        async updateMany({ args, query }: { args: Record<string, unknown>; query: (a: Record<string, unknown>) => Promise<unknown> }) {
          args.where = { companyId, ...(args.where as Record<string, unknown> ?? {}) };
          return query(args);
        },
        async delete({ args, query }: { args: Record<string, unknown>; query: (a: Record<string, unknown>) => Promise<unknown> }) {
          args.where = { companyId, ...(args.where as Record<string, unknown> ?? {}) };
          return query(args);
        },
        async deleteMany({ args, query }: { args: Record<string, unknown>; query: (a: Record<string, unknown>) => Promise<unknown> }) {
          args.where = { companyId, ...(args.where as Record<string, unknown> ?? {}) };
          return query(args);
        },
      },
    },
  });
}
