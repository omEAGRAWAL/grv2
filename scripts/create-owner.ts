/**
 * Bootstrap script: creates the first OWNER user.
 * Run with: pnpm seed:owner
 */
import * as readline from "readline";
import { createInterface } from "readline";

// Load .env before importing db/auth
import { config } from "dotenv";
config({ path: new URL("../.env", import.meta.url).pathname });

import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    process.stdout.write(question);

    // Hide input on supported terminals
    if (process.stdin.isTTY) {
      (process.stdin as NodeJS.ReadStream).setRawMode(true);
    }

    let password = "";

    process.stdin.on("data", (char: Buffer) => {
      const c = char.toString();
      if (c === "\r" || c === "\n") {
        if (process.stdin.isTTY) {
          (process.stdin as NodeJS.ReadStream).setRawMode(false);
        }
        process.stdout.write("\n");
        rl.close();
        resolve(password);
        return;
      }
      if (c === "\u0003") {
        // Ctrl+C
        process.exit(1);
      }
      if (c === "\u007f" || c === "\b") {
        // Backspace
        password = password.slice(0, -1);
      } else {
        password += c;
      }
    });
  });
}

async function main() {
  console.log("\n─── ConstructHub: Create Owner Account ───\n");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Check if owner already exists
  const existingOwner = await db.user.findFirst({ where: { role: "OWNER" } });
  if (existingOwner) {
    console.error(
      `✗ An OWNER account already exists (username: ${existingOwner.username}).`
    );
    console.error(
      "  Only one owner account is supported per database. Aborting."
    );
    rl.close();
    process.exit(1);
  }

  // Username
  let username = "";
  while (true) {
    username = await prompt(rl, "Username (3-30 chars, a-z 0-9 _): ");
    if (USERNAME_RE.test(username)) break;
    console.error("  ✗ Invalid username. Use only lowercase letters, numbers, and underscores (3–30 chars).\n");
  }

  // Name
  let name = "";
  while (true) {
    name = await prompt(rl, "Full name: ");
    if (name.length >= 1) break;
    console.error("  ✗ Name cannot be empty.\n");
  }

  // Company name
  let companyName = "";
  while (true) {
    companyName = await prompt(rl, "Company name: ");
    if (companyName.length >= 1) break;
    console.error("  ✗ Company name cannot be empty.\n");
  }

  rl.close(); // close before raw mode for password

  // Password (hidden)
  let password = "";
  let confirm = "";

  while (true) {
    password = await promptHidden("Password (min 8 chars): ");
    if (password.length < 8) {
      console.error("  ✗ Password must be at least 8 characters.\n");
      continue;
    }
    confirm = await promptHidden("Confirm password: ");
    if (password !== confirm) {
      console.error("  ✗ Passwords do not match. Try again.\n");
      continue;
    }
    break;
  }

  console.log("\nCreating company and owner account...");
  const passwordHash = await hashPassword(password);

  const company = await db.company.create({
    data: { name: companyName, status: "ACTIVE" },
  });

  const user = await db.user.create({
    data: {
      companyId: company.id,
      username,
      name,
      passwordHash,
      role: "OWNER",
      isActive: true,
    },
  });

  console.log(`\n✓ Owner created!`);
  console.log(`  Username : ${user.username}`);
  console.log(`  Name     : ${user.name}`);
  console.log(`  ID       : ${user.id}`);
  console.log(`\nRun pnpm dev and log in at /login\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("\n✗ Failed to create owner:", err.message);
  process.exit(1);
});
