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

const _baseDb = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = _baseDb;
}

// Models that must always carry a companyId filter in tenant-scoped queries.
const COMPANY_SCOPED_MODELS = new Set([
  "user", "site", "vendor", "wallettransaction", "purchase",
  "materialtransfer", "siteincome", "siteassignment", "attendance",
  "siteupdate", "materialconsumption", "assetcategory", "asset",
  "assetallocation",
]);

type AnyArgs = Record<string, unknown>;
type AnyQueryFn = (a: AnyArgs) => Promise<unknown>;

function guardMissingCompanyId(model: string, operation: string, args: AnyArgs) {
  if (!COMPANY_SCOPED_MODELS.has(model.toLowerCase())) return;
  const where = args.where as AnyArgs | undefined;
  if (!where || !("companyId" in where) || where.companyId === undefined || where.companyId === null) {
    throw new Error(
      `SECURITY: Query on ${model}.${operation} without companyId filter. Use getCompanyScopedDb(). For superadmin cross-tenant access use getUnscopedDb().`
    );
  }
}

/**
 * Default Prisma client with a safety extension: any findMany/findFirst/count/
 * aggregate/groupBy/updateMany/deleteMany on a company-scoped model without a
 * companyId in the where clause throws immediately. This catches regressions
 * where raw db is used without proper tenant scoping.
 *
 * update/delete by PK are NOT guarded — ownership must be verified via
 * findUnique/findFirst before calling them (pattern throughout the codebase).
 * updateMany/deleteMany ARE guarded because they can affect multiple records.
 *
 * For company-scoped queries prefer getCompanyScopedDb(companyId) which injects
 * companyId automatically. For SUPERADMIN cross-tenant ops use getUnscopedDb().
 */
export const db = _baseDb.$extends({
  query: {
    $allModels: {
      async findMany({ model, operation, args, query }: { model: string; operation: string; args: AnyArgs; query: AnyQueryFn }) {
        guardMissingCompanyId(model, operation, args);
        return query(args);
      },
      async findFirst({ model, operation, args, query }: { model: string; operation: string; args: AnyArgs; query: AnyQueryFn }) {
        guardMissingCompanyId(model, operation, args);
        return query(args);
      },
      async count({ model, operation, args, query }: { model: string; operation: string; args: AnyArgs; query: AnyQueryFn }) {
        guardMissingCompanyId(model, operation, args);
        return query(args);
      },
      async aggregate({ model, operation, args, query }: { model: string; operation: string; args: AnyArgs; query: AnyQueryFn }) {
        guardMissingCompanyId(model, operation, args);
        return query(args);
      },
      async groupBy({ model, operation, args, query }: { model: string; operation: string; args: AnyArgs; query: AnyQueryFn }) {
        guardMissingCompanyId(model, operation, args);
        return query(args);
      },
      async updateMany({ model, operation, args, query }: { model: string; operation: string; args: AnyArgs; query: AnyQueryFn }) {
        guardMissingCompanyId(model, operation, args);
        return query(args);
      },
      async deleteMany({ model, operation, args, query }: { model: string; operation: string; args: AnyArgs; query: AnyQueryFn }) {
        guardMissingCompanyId(model, operation, args);
        return query(args);
      },
    },
  },
});

/**
 * Returns the raw Prisma client with NO tenant isolation checks.
 * Use ONLY for:
 *   - Authentication: login lookup (username cross-company), lastLoginAt
 *   - SUPERADMIN routes that intentionally query across all companies
 *   - System-level bootstrap (migrations, seeding)
 * Mark every call site: // SUPERADMIN: cross-tenant query intended
 */
export function getUnscopedDb() {
  // SUPERADMIN: cross-tenant query intended
  return _baseDb;
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
  return _baseDb.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }: { args: AnyArgs; query: AnyQueryFn }) {
          args.where = { companyId, ...(args.where as AnyArgs ?? {}) };
          return query(args);
        },
        async findFirst({ args, query }: { args: AnyArgs; query: AnyQueryFn }) {
          args.where = { companyId, ...(args.where as AnyArgs ?? {}) };
          return query(args);
        },
        async count({ args, query }: { args: AnyArgs; query: AnyQueryFn }) {
          args.where = { companyId, ...(args.where as AnyArgs ?? {}) };
          return query(args);
        },
        async aggregate({ args, query }: { args: AnyArgs; query: AnyQueryFn }) {
          args.where = { companyId, ...(args.where as AnyArgs ?? {}) };
          return query(args);
        },
        async groupBy({ args, query }: { args: AnyArgs; query: AnyQueryFn }) {
          args.where = { companyId, ...(args.where as AnyArgs ?? {}) };
          return query(args);
        },
        async create({ args, query }: { args: AnyArgs; query: AnyQueryFn }) {
          (args.data as AnyArgs).companyId = companyId;
          return query(args);
        },
        async createMany({ args, query }: { args: AnyArgs; query: AnyQueryFn }) {
          const data = args.data as AnyArgs | AnyArgs[];
          if (Array.isArray(data)) {
            args.data = data.map((row) => ({ ...row, companyId }));
          } else {
            (args.data as AnyArgs).companyId = companyId;
          }
          return query(args);
        },
        async update({ args, query }: { args: AnyArgs; query: AnyQueryFn }) {
          args.where = { companyId, ...(args.where as AnyArgs ?? {}) };
          return query(args);
        },
        async updateMany({ args, query }: { args: AnyArgs; query: AnyQueryFn }) {
          args.where = { companyId, ...(args.where as AnyArgs ?? {}) };
          return query(args);
        },
        async delete({ args, query }: { args: AnyArgs; query: AnyQueryFn }) {
          args.where = { companyId, ...(args.where as AnyArgs ?? {}) };
          return query(args);
        },
        async deleteMany({ args, query }: { args: AnyArgs; query: AnyQueryFn }) {
          args.where = { companyId, ...(args.where as AnyArgs ?? {}) };
          return query(args);
        },
      },
    },
  });
}
