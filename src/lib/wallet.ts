import { getUnscopedDb } from "@/lib/db";

// Scoped by actorUserId (globally-unique UUID). Callers verify the userId
// belongs to the request's company before passing it here.
const db = getUnscopedDb();

/**
 * Compute the current wallet balance for a user.
 * Balance = sum of non-voided CREDIT transactions
 *         − sum of non-voided DEBIT transactions
 * Returns BigInt in paise. Returns 0n if the user has no transactions.
 */
export async function getWalletBalance(userId: string): Promise<bigint> {
  const result = await db.walletTransaction.findMany({
    where: {
      actorUserId: userId,
      voidedAt: null,
    },
    select: {
      direction: true,
      amountPaise: true,
    },
  });

  let balance = 0n;
  for (const txn of result) {
    if (txn.direction === "CREDIT") {
      balance += txn.amountPaise;
    } else {
      balance -= txn.amountPaise;
    }
  }
  return balance;
}

/**
 * Total cash currently held by all active employees across their wallets.
 */
export async function getCashWithTeam(companyId?: string): Promise<bigint> {
  const employees = await db.user.findMany({
    where: { role: "EMPLOYEE", isActive: true, ...(companyId ? { companyId } : {}) },
    select: { id: true },
  });

  let total = 0n;
  for (const emp of employees) {
    total += await getWalletBalance(emp.id);
  }
  return total;
}
