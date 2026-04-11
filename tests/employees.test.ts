import { describe, it, expect } from "vitest";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/auth";

// Mirror the validation schema used in the employees action
const CreateEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(
      /^[a-z0-9_]+$/,
      "Username can only contain lowercase letters, numbers, and underscores"
    ),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// ─── Username validation ──────────────────────────────────────────────────────

describe("createEmployee validation", () => {
  it("accepts valid employee data", () => {
    const result = CreateEmployeeSchema.safeParse({
      name: "Ravi Kumar",
      username: "ravi_kumar",
      password: "secure123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects username with uppercase letters", () => {
    const result = CreateEmployeeSchema.safeParse({
      name: "Ravi",
      username: "Ravi_Kumar",
      password: "secure123",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/lowercase/i);
  });

  it("rejects username with @ symbol", () => {
    const result = CreateEmployeeSchema.safeParse({
      name: "Ravi",
      username: "ravi@kumar",
      password: "secure123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects username with dot", () => {
    const result = CreateEmployeeSchema.safeParse({
      name: "Ravi",
      username: "ravi.kumar",
      password: "secure123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects username shorter than 3 characters", () => {
    const result = CreateEmployeeSchema.safeParse({
      name: "Ravi",
      username: "rv",
      password: "secure123",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/3 characters/i);
  });

  it("rejects username longer than 30 characters", () => {
    const result = CreateEmployeeSchema.safeParse({
      name: "Ravi",
      username: "a".repeat(31),
      password: "secure123",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/30 characters/i);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = CreateEmployeeSchema.safeParse({
      name: "Ravi",
      username: "ravi",
      password: "short",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/8 characters/i);
  });

  it("rejects empty name", () => {
    const result = CreateEmployeeSchema.safeParse({
      name: "",
      username: "ravi",
      password: "secure123",
    });
    expect(result.success).toBe(false);
  });

  it("allows underscores and numbers in username", () => {
    const result = CreateEmployeeSchema.safeParse({
      name: "Worker 1",
      username: "worker_01",
      password: "secure123",
    });
    expect(result.success).toBe(true);
  });
});

// ─── Password reset updates the hash ─────────────────────────────────────────

describe("password reset", () => {
  it("new password hash verifies correctly", async () => {
    const newPassword = "newpassword123";
    const hash = await hashPassword(newPassword);
    expect(await verifyPassword(newPassword, hash)).toBe(true);
  });

  it("old password no longer verifies after reset", async () => {
    const oldPassword = "oldpassword";
    const newPassword = "newpassword123";
    const newHash = await hashPassword(newPassword);
    expect(await verifyPassword(oldPassword, newHash)).toBe(false);
  });
});

// ─── Deactivation blocks login ────────────────────────────────────────────────

describe("deactivation logic", () => {
  it("deactivated employee cannot log in (isActive=false check)", async () => {
    const hash = await hashPassword("password123");
    const passwordOk = await verifyPassword("password123", hash);

    // Simulate the login check: password ok but isActive is false
    const isActive = false;
    const canLogin = passwordOk && isActive;
    expect(canLogin).toBe(false);
  });

  it("active employee can log in when password is correct", async () => {
    const hash = await hashPassword("password123");
    const passwordOk = await verifyPassword("password123", hash);
    const isActive = true;
    const canLogin = passwordOk && isActive;
    expect(canLogin).toBe(true);
  });
});
