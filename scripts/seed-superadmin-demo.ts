/**
 * Seeds a SUPERADMIN with fixed demo credentials.
 * Run: pnpm tsx scripts/seed-superadmin-demo.ts
 *
 * Credentials: super_admin / super1234
 */
import { config } from "dotenv";
import { resolve } from "path";
import { randomBytes } from "crypto";

config({ path: resolve(process.cwd(), ".env"), override: true });

import { neon } from "@neondatabase/serverless";
import { hashPassword } from "../src/lib/auth";

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL not set");

  const sql = neon(rawUrl);

  const existing = await sql`SELECT id, username FROM "User" WHERE role = 'SUPERADMIN' LIMIT 1`;
  if (existing.length > 0) {
    console.log("SUPERADMIN already exists:", existing[0].username);
    console.log("To reset, delete the user from the DB first.");
    process.exit(0);
  }

  const id = "sa" + randomBytes(11).toString("hex");
  const now = new Date().toISOString();
  const passwordHash = await hashPassword("super1234");

  await sql`
    INSERT INTO "User" (
      id, username, "passwordHash", name, role,
      "joinedAt", "isActive", "createdAt", "updatedAt"
    )
    VALUES (
      ${id}, 'super_admin', ${passwordHash}, 'Super Admin', 'SUPERADMIN',
      ${now}::timestamptz, true, ${now}::timestamptz, ${now}::timestamptz
    )
  `;

  console.log("\n✓ SUPERADMIN seeded!");
  console.log("  Username : super_admin");
  console.log("  Password : super1234");
  console.log("  ID       :", id);
  console.log("\nSign in at /login → navigate to /super");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
