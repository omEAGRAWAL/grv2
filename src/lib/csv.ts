import Decimal from "decimal.js";

/** Escape a value for CSV: wrap in quotes if it contains comma, quote, or newline. */
export function csvField(value: string | number | bigint | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str =
    typeof value === "bigint"
      ? new Decimal(value.toString()).div(100).toFixed(2) // paise → rupees
      : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Format a Date as YYYY-MM-DD HH:mm (ISO 8601, no seconds). */
export function csvDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Build a CSV row from an array of values. */
export function csvRow(values: (string | number | bigint | null | undefined)[]): string {
  return values.map(csvField).join(",");
}

/** Build a complete CSV string from headers and rows. */
export function buildCsv(
  headers: string[],
  rows: (string | number | bigint | null | undefined)[][]
): string {
  const lines = [headers.join(","), ...rows.map(csvRow)];
  return lines.join("\r\n") + "\r\n";
}

/** Format today as YYYYMMDD for filenames. */
export function csvDateStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}
