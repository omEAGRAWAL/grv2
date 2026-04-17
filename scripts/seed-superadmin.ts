import { config } from "dotenv";
import { resolve } from "path";
import { randomBytes } from "crypto";
import * as readline from "readline";

config({ path: resolve(process.cwd(), ".env"), override: true });

import { neon } from "@neondatabase/serverless";
import { hashPassword } from "../src/lib/auth";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL not set");

  const sql = neon(rawUrl);

  // Check if a SUPERADMIN already exists
  const existing = await sql`SELECT id, username FROM "User" WHERE role = 'SUPERADMIN' LIMIT 1`;
  if (existing.length > 0) {
    console.log("SUPERADMIN already exists:", existing[0].username);
    process.exit(0);
  }

  console.log("\n=== Create SUPERADMIN ===\n");
  const username = await prompt("Username: ");
  const name = await prompt("Display name: ");
  const password = await prompt("Password (min 8 chars): ");

  if (!username || username.length < 3) {
    console.error("Username must be at least 3 characters");
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  const id = "sa" + randomBytes(11).toString("hex");
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  // SUPERADMIN has companyId = NULL
  await sql`
    INSERT INTO "User" (
      id, username, "passwordHash", name, role,
      "joinedAt", "isActive", "createdAt", "updatedAt"
    )
    VALUES (
      ${id}, ${username.toLowerCase()}, ${passwordHash}, ${name}, 'SUPERADMIN',
      ${now}::timestamptz, true, ${now}::timestamptz, ${now}::timestamptz
    )
  `;

  console.log("\n✓ SUPERADMIN created!");
  console.log("  Username:", username.toLowerCase());
  console.log("  Name    :", name);
  console.log("  ID      :", id);
  console.log("\nSign in at /login, then navigate to /super");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
