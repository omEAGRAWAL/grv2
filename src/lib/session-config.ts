import type { SessionOptions } from "iron-session";

// Validate session secret at module load time
const secret = process.env.SESSION_SECRET ?? "";
if (secret.length < 32) {
  // Only throw at runtime, not during build-time static analysis
  if (process.env.NODE_ENV !== "test") {
    console.warn(
      "[session-config] SESSION_SECRET must be at least 32 characters. " +
        "Run: openssl rand -base64 32"
    );
  }
}

export interface SessionData {
  userId: string;
  role: "SUPERADMIN" | "OWNER" | "SITE_MANAGER" | "SUPERVISOR" | "WORKER" | "EMPLOYEE";
  companyId?: string;
  impersonatingCompanyId?: string;
}

export const sessionOptions: SessionOptions = {
  cookieName: "constructhub_session",
  password: secret || "placeholder-for-build-time-do-not-use-in-production",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};
