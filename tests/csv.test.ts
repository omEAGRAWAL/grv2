import { describe, it, expect } from "vitest";
import { csvField, csvDate, csvRow, buildCsv } from "@/lib/csv";

// ─── csvField ─────────────────────────────────────────────────────────────────

describe("csvField", () => {
  it("passes plain strings through without quoting", () => {
    expect(csvField("hello")).toBe("hello");
    expect(csvField("Site A")).toBe("Site A");
  });

  it("wraps strings containing commas in double quotes", () => {
    expect(csvField("hello, world")).toBe('"hello, world"');
  });

  it("escapes double quotes by doubling them", () => {
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps strings containing newlines in double quotes", () => {
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles CR LF", () => {
    expect(csvField("a\r\nb")).toBe('"a\r\nb"');
  });

  it("returns empty string for null", () => {
    expect(csvField(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(csvField(undefined)).toBe("");
  });

  it("converts bigint paise to rupees string", () => {
    expect(csvField(123456n)).toBe("1234.56");
    expect(csvField(0n)).toBe("0.00");
    expect(csvField(100n)).toBe("1.00");
  });

  it("handles numbers", () => {
    expect(csvField(42)).toBe("42");
    expect(csvField(3.14)).toBe("3.14");
  });
});

// ─── csvDate ──────────────────────────────────────────────────────────────────

describe("csvDate", () => {
  it("formats a date as YYYY-MM-DD HH:mm", () => {
    const d = new Date(2026, 3, 1, 14, 30, 0); // April 1 2026, 14:30
    const result = csvDate(d);
    expect(result).toBe("2026-04-01 14:30");
  });

  it("pads single-digit months and days", () => {
    const d = new Date(2026, 0, 5, 9, 5, 0); // Jan 5 2026, 09:05
    expect(csvDate(d)).toBe("2026-01-05 09:05");
  });
});

// ─── buildCsv ─────────────────────────────────────────────────────────────────

describe("buildCsv", () => {
  it("produces a well-formed CSV with headers and rows", () => {
    const headers = ["Date", "Type", "Amount (₹)"];
    const rows = [
      ["2026-04-01 10:00", "EXPENSE", "300.00"],
      ["2026-04-02 11:30", "TOPUP", "5000.00"],
    ];
    const csv = buildCsv(headers, rows);
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines[0]).toBe("Date,Type,Amount (₹)");
    expect(lines[1]).toBe("2026-04-01 10:00,EXPENSE,300.00");
    expect(lines[2]).toBe("2026-04-02 11:30,TOPUP,5000.00");
  });

  it("correctly escapes commas in a note field", () => {
    const headers = ["Note"];
    const rows = [["Cement, steel, sand"]];
    const csv = buildCsv(headers, rows);
    expect(csv).toContain('"Cement, steel, sand"');
  });

  it("correctly escapes quotes in fields", () => {
    const headers = ["Note"];
    const rows = [['Client said "approved"']];
    const csv = buildCsv(headers, rows);
    expect(csv).toContain('"Client said ""approved"""');
  });

  it("correctly escapes newlines in notes", () => {
    const headers = ["Note"];
    const rows = [["line1\nline2"]];
    const csv = buildCsv(headers, rows);
    expect(csv).toContain('"line1\nline2"');
  });

  it("includes voided column correctly for voided and non-voided rows", () => {
    const headers = ["Item", "Voided"];
    const rows = [
      ["Purchase 1", "No"],
      ["Purchase 2", "Yes"],
    ];
    const csv = buildCsv(headers, rows);
    expect(csv).toContain("Purchase 1,No");
    expect(csv).toContain("Purchase 2,Yes");
  });

  it("produces CRLF line endings", () => {
    const csv = buildCsv(["A"], [["1"], ["2"]]);
    const crlf = csv.match(/\r\n/g);
    expect(crlf).not.toBeNull();
    expect(crlf!.length).toBeGreaterThanOrEqual(3); // header + 2 rows + trailing
  });
});
