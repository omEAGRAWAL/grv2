import { config } from "dotenv";
import { resolve } from "path";
import { randomBytes } from "crypto";

config({ path: resolve(process.cwd(), ".env"), override: true });

import { neon } from "@neondatabase/serverless";
import { hashPassword } from "../src/lib/auth";

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL not set");

  // neon() uses HTTP fetch — no WebSocket, no pg-connection-string issues
  const sql = neon(rawUrl);

  // Check existing owner
  const rows = await sql`SELECT id, username FROM "User" WHERE role = 'OWNER' LIMIT 1`;
  if (rows.length > 0) {
    console.log("Owner already exists:", rows[0].username);
    process.exit(0);
  }

  const id = "c" + randomBytes(12).toString("hex"); // cuid-style id
  const now = new Date().toISOString();
  const passwordHash = await hashPassword("123");

  await sql`
    INSERT INTO "User" (id, username, "passwordHash", name, role, "joinedAt", "isActive", "createdAt", "updatedAt")
    VALUES (${id}, ${"agrawalom711@gmail.com"}, ${passwordHash}, ${"Om Agrawal"}, 'OWNER', ${now}::timestamptz, true, ${now}::timestamptz, ${now}::timestamptz)
  `;

  console.log("✓ Owner created!");
  console.log("  Username: agrawalom711@gmail.com");
  console.log("  Name    : Om Agrawal");
  console.log("  ID      :", id);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Failed:", err.message);
  process.exit(1);
});
