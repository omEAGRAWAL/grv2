

     import { describe, it, expect } from "vitest";
import { toPaise, toRupees, formatINR, formatINRCompact } from "@/lib/money";

describe("toPaise", () => {
  it("converts zero", () => {
    expect(toPaise("0")).toBe(0n);
  });

  it("converts 1 rupee to 100 paise", () => {
    expect(toPaise("1")).toBe(100n);
  });

  it("converts 1234.56 rupees to 123456 paise", () => {
    expect(toPaise("1234.56")).toBe(123456n);
  });

  it("converts the smallest unit (1 paisa)", () => {
    expect(toPaise("0.01")).toBe(1n);
  });

  it("accepts a number argument", () => {
    expect(toPaise(5)).toBe(500n);
  });

  it("rounds half-up at sub-paisa values", () => {
    // 0.005 rupees = 0.5 paise → rounds up to 1n
    expect(toPaise("0.005")).toBe(1n);
  });

  it("throws on non-numeric input", () => {
    expect(() => toPaise("abc")).toThrow();
  });

  it("handles large rupee amounts", () => {
    expect(toPaise("9999999.99")).toBe(999999999n);
  });
});

describe("toRupees", () => {
  it("converts 0 paise to '0.00'", () => {
    expect(toRupees(0n)).toBe("0.00");
  });

  it("converts 100 paise to '1.00'", () => {
    expect(toRupees(100n)).toBe("1.00");
  });

  it("converts 123456 paise to '1234.56'", () => {
    expect(toRupees(123456n)).toBe("1234.56");
  });

  it("round-trips: toRupees(toPaise(x)) === x", () => {
    expect(toRupees(toPaise("9999999.99"))).toBe("9999999.99");
  });
});

describe("formatINR", () => {
  it("formats 0n as ₹0.00", () => {
    expect(formatINR(0n)).toBe("₹0.00");
  });

  it("formats 100n paise as ₹1.00", () => {
    expect(formatINR(100n)).toBe("₹1.00");
  });

  it("formats 123456789n paise with Indian grouping (₹12,34,567.89)", () => {
    // 123456789 paise = 12,34,567.89 rupees
    expect(formatINR(123456789n)).toBe("₹12,34,567.89");
  });

  it("formats amounts under 1000 rupees without commas", () => {
    // 50000 paise = 500.00 rupees
    expect(formatINR(50000n)).toBe("₹500.00");
  });

  it("formats exactly 1 lakh (₹1,00,000.00)", () => {
    // 10000000 paise = 1,00,000.00 rupees
    expect(formatINR(10000000n)).toBe("₹1,00,000.00");
  });
});

describe("formatINRCompact", () => {
  it("formats amounts below 1 lakh with full format", () => {
    // 50000 paise = 500 rupees
    expect(formatINRCompact(50000n)).toBe("₹500.00");
  });

  it("formats 1.23 lakh correctly", () => {
    // 12300000 paise = 1,23,000 rupees = 1.23 lakh
    expect(formatINRCompact(12300000n)).toBe("₹1.23L");
  });

  it("formats amounts >= 1 crore with Cr suffix", () => {
    // 100000000n paise = 10,00,000 rupees = 10 lakh (not crore)
    // For crore: 1Cr = 1,00,00,000 rupees = 1000000000 paise
    // 1000000000 paise = 1,00,00,000 rupees = 1 crore
    expect(formatINRCompact(1000000000n)).toBe("₹1.00Cr");
  });

  it("formats 100 crore correctly", () => {
    // 100 Cr = 100 × 1,00,00,000 rupees = 1,00,00,00,000 rupees
    //        = 1,000,000,000 rupees = 100,000,000,000 paise
    expect(formatINRCompact(100000000000n)).toBe("₹100.00Cr");
  });
});
