import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth";

describe("hashPassword / verifyPassword", () => {
  it("produces a bcrypt hash (starts with $2b$)", async () => {
    const hash = await hashPassword("secretpass1");
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it("round-trip: correct password verifies successfully", async () => {
    const plain = "MyStr0ngP@ssword";
    const hash = await hashPassword(plain);
    expect(await verifyPassword(plain, hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("rejects an empty password string", async () => {
    const hash = await hashPassword("somepassword");
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("hashes are not equal to the plain text", async () => {
    const plain = "plaintext";
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
  });

  it("two hashes of the same password are different (salted)", async () => {
    const plain = "samepassword";
    const hash1 = await hashPassword(plain);
    const hash2 = await hashPassword(plain);
    expect(hash1).not.toBe(hash2);
    // But both should verify correctly
    expect(await verifyPassword(plain, hash1)).toBe(true);
    expect(await verifyPassword(plain, hash2)).toBe(true);
  });
});
