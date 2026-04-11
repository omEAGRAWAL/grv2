import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Compute purchase total in paise using Decimal.js for exact math.
 *
 * Formula: round((qty × ratePaise) × (1 - discount/100) × (1 + gst/100))
 *
 * @param qty             - quantity as decimal string (e.g. "2.5")
 * @param ratePaise       - rate per unit in paise as BigInt
 * @param discountPercent - discount % as string (0–100)
 * @param gstPercent      - GST % as string (0–100)
 */
export function calcPurchaseTotalPaise(
  qty: string,
  ratePaise: bigint,
  discountPercent: string,
  gstPercent: string
): bigint {
  const total = new Decimal(qty)
    .times(ratePaise.toString())
    .times(new Decimal(1).minus(new Decimal(discountPercent).div(100)))
    .times(new Decimal(1).plus(new Decimal(gstPercent).div(100)))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return BigInt(total.toString());
}
