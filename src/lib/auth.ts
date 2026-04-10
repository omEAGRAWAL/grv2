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
 * Throws if no session or if the user is inactive.
 */
export async function getCurrentUser(): Promise<User> {
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
  return user;
}

/**
 * Convenience wrapper — throws if the current user is not an OWNER.
 */
export async function requireOwner(): Promise<User> {
  const user = await getCurrentUser();
  if (user.role !== "OWNER") {
    throw new Error("Forbidden: OWNER role required");
  }
  return user;
}
