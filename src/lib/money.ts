import Decimal from "decimal.js";

// Configure Decimal for financial precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Convert rupees (string or number) to paise as BigInt.
 * "1234.56" → 123456n
 * Throws if the value is not a valid finite number.
 */
export function toPaise(rupees: string | number): bigint {
  const d = new Decimal(rupees);
  if (!d.isFinite()) {
    throw new Error(`Invalid rupees value: ${rupees}`);
  }
  // Multiply by 100 and round to nearest paisa
  const paise = d.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return BigInt(paise.toFixed(0));
}

/**
 * Convert paise (BigInt) to rupees string (no symbol, no separators).
 * 123456n → "1234.56"
 */
export function toRupees(paise: bigint): string {
  const d = new Decimal(paise.toString()).div(100);
  return d.toFixed(2);
}

/**
 * Format paise as Indian currency string with ₹ symbol and Indian grouping.
 * 123456789n → "₹12,34,567.89"
 * 0n          → "₹0.00"
 */
export function formatINR(paise: bigint): string {
  const rupees = toRupees(paise);
  const [intPart, decPart] = rupees.split(".");

  // Indian number grouping: last 3 digits, then groups of 2
  const formatted = formatIndianNumber(intPart);
  return `₹${formatted}.${decPart}`;
}

/**
 * Format paise as compact Indian currency (lakhs / crores).
 * 123456789n → "₹1.23Cr"
 * 1234500n   → "₹12.35L" (12.345 lakh)
 */
export function formatINRCompact(paise: bigint): string {
  const d = new Decimal(paise.toString()).div(100); // rupees
  const crore = new Decimal("10000000"); // 1 crore = 1,00,00,000
  const lakh = new Decimal("100000");    // 1 lakh  =    1,00,000

  if (d.gte(crore)) {
    const val = d.div(crore).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return `₹${val.toFixed(2)}Cr`;
  }
  if (d.gte(lakh)) {
    const val = d.div(lakh).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return `₹${val.toFixed(2)}L`;
  }
  return formatINR(paise);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function formatIndianNumber(intStr: string): string {
  // Handle negative
  const isNeg = intStr.startsWith("-");
  const digits = isNeg ? intStr.slice(1) : intStr;

  if (digits.length <= 3) {
    return isNeg ? `-${digits}` : digits;
  }

  // Last 3 digits
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);

  // Remaining digits in groups of 2 from the right
  const groups: string[] = [];
  let remaining = rest;
  while (remaining.length > 2) {
    groups.unshift(remaining.slice(-2));
    remaining = remaining.slice(0, -2);
  }
  if (remaining.length > 0) {
    groups.unshift(remaining);
  }

  const formatted = [...groups, last3].join(",");
  return isNeg ? `-${formatted}` : formatted;
}
