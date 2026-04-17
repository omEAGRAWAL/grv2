import bcrypt from "bcryptjs";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sessionOptions, type SessionData } from "@/lib/session-config";
import type { User } from "@prisma/client";

const BCRYPT_ROUNDS = 10;

// ─── Password helpers ─────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

// ─── Session helpers ──────────────────────────────────────────────────────────

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/**
 * Fetch the current authenticated User from the database.
 * When a SUPERADMIN is impersonating a company, returns the SUPERADMIN user
 * but sets companyId from the impersonation target.
 * Throws if no session or if the user is inactive.
 */
export async function getCurrentUser(): Promise<User & { effectiveCompanyId?: string }> {
  const session = await getSession();
  if (!session.userId) {
    throw new Error("Not authenticated");
  }
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    throw new Error("Not authenticated");
  }
  if (!user.isActive) {
    throw new Error("User inactive");
  }
  const effectiveCompanyId =
    session.impersonatingCompanyId ?? user.companyId ?? undefined;
  return Object.assign(user, { effectiveCompanyId });
}

/**
 * Throws if the current user does not have one of the allowed roles.
 */
export async function requireRole(
  roles: Array<"SUPERADMIN" | "OWNER" | "SITE_MANAGER" | "SUPERVISOR" | "WORKER" | "EMPLOYEE">
): Promise<User & { effectiveCompanyId?: string }> {
  const user = await getCurrentUser();
  if (!roles.includes(user.role as typeof roles[number])) {
    throw new Error(`Forbidden: requires one of [${roles.join(", ")}]`);
  }
  return user;
}

/**
 * Throws if the user has no effective company (i.e. is a non-impersonating SUPERADMIN).
 */
export async function requireCompany(): Promise<User & { effectiveCompanyId: string }> {
  const user = await getCurrentUser();
  if (!user.effectiveCompanyId) {
    throw new Error("Forbidden: company context required");
  }
  return user as User & { effectiveCompanyId: string };
}

/**
 * Convenience wrapper — throws if the current user is not an OWNER.
 * Preserved for backwards compatibility with v1 server actions.
 */
export async function requireOwner(): Promise<User & { effectiveCompanyId?: string }> {
  return requireRole(["OWNER"]);
}
