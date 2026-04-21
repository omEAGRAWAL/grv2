"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type { WalletTxnType } from "@prisma/client";

export type PayrollActionResult =
  | { success: true }
  | { success: false; error: string };

// ─── Salary Payment ───────────────────────────────────────────────────────────
//
// Employee wallet balance represents "net company cash held by employee".
// TOPUP (advance) → CREDIT: employee holds more company cash.
// SALARY → CREDIT: payment to employee reduces outstanding advance.
// ADVANCE_RECOVERY → DEBIT: net advance balance explicitly recovered from salary.
//
// Outstanding advance = Σ TOPUP credits − Σ ADVANCE_RECOVERY debits.
// Employee net position = wallet balance = Σ all CREDIT − Σ all DEBIT (non-voided).

const SalaryPaymentSchema = z.object({
  employeeId: z.string().min(1),
  amountPaise: z.coerce.bigint().positive("Amount must be greater than ₹0"),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  note: z.string().max(300).optional(),
  recoverAdvancePaise: z.coerce.bigint().min(0n).optional(),
});

export async function createSalaryPayment(
  _prev: PayrollActionResult | null,
  formData: FormData
): Promise<PayrollActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  if (!companyId) return { success: false, error: "No company" };

  const raw = {
    employeeId: formData.get("employeeId"),
    amountPaise: formData.get("amountPaise"),
    paymentDate: formData.get("paymentDate"),
    note: (formData.get("note") as string) || undefined,
    recoverAdvancePaise: (formData.get("recoverAdvancePaise") as string) || undefined,
  };

  const parsed = SalaryPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { employeeId, amountPaise, paymentDate, note, recoverAdvancePaise } = parsed.data;

  // Validate payment date not in future
  const payDate = new Date(paymentDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (payDate > today) {
    return { success: false, error: "Payment date cannot be in the future" };
  }

  // Verify employee belongs to same company
  const employee = await db.user.findFirst({
    where: { id: employeeId, companyId },
  });
  if (!employee) return { success: false, error: "Employee not found" };

  try {
    await db.$transaction(async (tx) => {
      await tx.walletTransaction.create({
        data: {
          companyId,
          actorUserId: employeeId,
          loggedById: caller.id,
          type: "SALARY",
          direction: "CREDIT",
          amountPaise,
          paymentDate: payDate,
          note: note?.trim() || null,
        },
      });

      if (recoverAdvancePaise && recoverAdvancePaise > 0n) {
        await tx.walletTransaction.create({
          data: {
            companyId,
            actorUserId: employeeId,
            loggedById: caller.id,
            type: "ADVANCE_RECOVERY",
            direction: "DEBIT",
            amountPaise: recoverAdvancePaise,
            paymentDate: payDate,
            note: "Advance recovery from salary payment",
          },
        });
      }
    });
  } catch (err) {
    console.error("[createSalaryPayment] DB error:", err);
    return { success: false, error: "Failed to record salary payment" };
  }

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
  revalidatePath("/dashboard");
  return { success: true };
}

// ─── Payroll Note ─────────────────────────────────────────────────────────────

const PayrollNoteSchema = z.object({
  userId: z.string().min(1),
  note: z.string().min(1, "Note is required").max(500),
  noteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
});

export async function addPayrollNote(
  _prev: PayrollActionResult | null,
  formData: FormData
): Promise<PayrollActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  if (!companyId) return { success: false, error: "No company" };

  const raw = {
    userId: formData.get("userId"),
    note: formData.get("note"),
    noteDate: formData.get("noteDate"),
  };

  const parsed = PayrollNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const employee = await db.user.findFirst({
    where: { id: parsed.data.userId, companyId },
  });
  if (!employee) return { success: false, error: "Employee not found" };

  try {
    await db.payrollNote.create({
      data: {
        companyId,
        userId: parsed.data.userId,
        note: parsed.data.note.trim(),
        noteDate: new Date(parsed.data.noteDate),
        createdById: caller.id,
      },
    });
  } catch (err) {
    console.error("[addPayrollNote] DB error:", err);
    return { success: false, error: "Failed to save note" };
  }

  revalidatePath(`/employees/${parsed.data.userId}`);
  return { success: true };
}

// ─── Payroll CSV export data ──────────────────────────────────────────────────

export async function getPayrollLedger(
  employeeId: string,
  companyId: string,
  page = 1,
  from?: string,
  to?: string
) {
  const ITEMS_PER_PAGE = 20;

  const where = {
    actorUserId: employeeId,
    companyId,
    type: { in: ["TOPUP", "SALARY", "ADVANCE_RECOVERY"] as WalletTxnType[] },
    ...(from || to
      ? {
          OR: [
            {
              paymentDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
              },
            },
            {
              paymentDate: null,
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
              },
            },
          ],
        }
      : {}),
  };

  const [txns, total, summary, notes] = await Promise.all([
    db.walletTransaction.findMany({
      where,
      include: { loggedBy: { select: { name: true } } },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),
    db.walletTransaction.count({ where }),
    db.walletTransaction.groupBy({
      by: ["type"],
      where: {
        actorUserId: employeeId,
        companyId,
        type: { in: ["TOPUP", "SALARY", "ADVANCE_RECOVERY"] as WalletTxnType[] },
        voidedAt: null,
      },
      _sum: { amountPaise: true },
    }),
    db.payrollNote.findMany({
      where: { userId: employeeId, companyId },
      include: { createdBy: { select: { name: true } } },
      orderBy: { noteDate: "desc" },
    }),
  ]);

  const sumMap = Object.fromEntries(
    summary.map((s) => [s.type, s._sum.amountPaise ?? 0n])
  );

  const totalAdvances = (sumMap["TOPUP"] as bigint | undefined) ?? 0n;
  const totalSalary = (sumMap["SALARY"] as bigint | undefined) ?? 0n;
  const totalRecovery = (sumMap["ADVANCE_RECOVERY"] as bigint | undefined) ?? 0n;
  const outstandingAdvance = totalAdvances > totalRecovery + totalSalary
    ? totalAdvances - totalRecovery - totalSalary
    : 0n;

  return {
    txns,
    total,
    notes,
    summary: {
      totalAdvances,
      totalSalary,
      totalRecovery,
      outstandingAdvance,
    },
  };
}
