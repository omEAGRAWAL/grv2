import { db } from "@/lib/db";

export type ReconcileBreakdown = {
  // Credits
  topupTotal: bigint;
  topupCount: number;
  transferInTotal: bigint;
  transferInCount: number;
  reversalCreditTotal: bigint;
  reversalCreditCount: number;
  totalCredits: bigint;

  // Debits
  expenseTotal: bigint;
  expenseCount: number;
  transferOutTotal: bigint;
  transferOutCount: number;
  vendorPaymentTotal: bigint;
  vendorPaymentCount: number;
  reversalDebitTotal: bigint;
  reversalDebitCount: number;
  totalDebits: bigint;

  // Balance
  balance: bigint;
};

export async function getWalletReconcile(
  userId: string
): Promise<ReconcileBreakdown> {
  const rows = await db.walletTransaction.groupBy({
    by: ["type", "direction"],
    _sum: { amountPaise: true },
    _count: { _all: true },
    where: { actorUserId: userId, voidedAt: null },
  });

  const get = (
    type: string,
    direction: string
  ): { total: bigint; count: number } => {
    const r = rows.find((x) => x.type === type && x.direction === direction);
    return {
      total: r?._sum.amountPaise ?? 0n,
      count: r?._count._all ?? 0,
    };
  };

  const topup = get("TOPUP", "CREDIT");
  const transferIn = get("TRANSFER_IN", "CREDIT");
  const reversalCredit = get("REVERSAL", "CREDIT");
  const expense = get("EXPENSE", "DEBIT");
  const transferOut = get("TRANSFER_OUT", "DEBIT");
  const vendorPayment = get("VENDOR_PAYMENT", "DEBIT");
  const reversalDebit = get("REVERSAL", "DEBIT");

  const totalCredits =
    topup.total + transferIn.total + reversalCredit.total;
  const totalDebits =
    expense.total + transferOut.total + vendorPayment.total + reversalDebit.total;

  return {
    topupTotal: topup.total,
    topupCount: topup.count,
    transferInTotal: transferIn.total,
    transferInCount: transferIn.count,
    reversalCreditTotal: reversalCredit.total,
    reversalCreditCount: reversalCredit.count,
    totalCredits,

    expenseTotal: expense.total,
    expenseCount: expense.count,
    transferOutTotal: transferOut.total,
    transferOutCount: transferOut.count,
    vendorPaymentTotal: vendorPayment.total,
    vendorPaymentCount: vendorPayment.count,
    reversalDebitTotal: reversalDebit.total,
    reversalDebitCount: reversalDebit.count,
    totalDebits,

    balance: totalCredits - totalDebits,
  };
}
