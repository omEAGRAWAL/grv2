export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { SuspendButton } from "./suspend-button";
import { ImpersonateButton } from "./impersonate-button";

async function getCompanyStats() {
  const companies = await db.company.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: { users: true, sites: true },
      },
    },
  });

  const companyIds = companies.map((c) => c.id);

  const [walletAggs, topUpAggs] = await Promise.all([
    db.walletTransaction.groupBy({
      by: ["companyId"],
      _sum: { amountPaise: true },
      where: {
        companyId: { in: companyIds },
        direction: "DEBIT",
        type: { in: ["EXPENSE", "VENDOR_PAYMENT"] },
        voidedAt: null,
      },
    }),
    db.walletTransaction.groupBy({
      by: ["companyId"],
      _sum: { amountPaise: true },
      where: {
        companyId: { in: companyIds },
        type: "TOPUP",
        voidedAt: null,
      },
    }),
  ]);

  const spendMap = new Map(
    walletAggs.map((r) => [r.companyId, r._sum.amountPaise ?? 0n])
  );
  const topUpMap = new Map(
    topUpAggs.map((r) => [r.companyId, r._sum.amountPaise ?? 0n])
  );

  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    createdAt: c.createdAt,
    userCount: c._count.users,
    siteCount: c._count.sites,
    totalSpend: spendMap.get(c.id) ?? 0n,
    totalTopUp: topUpMap.get(c.id) ?? 0n,
  }));
}

export default async function SuperPage() {
  const companies = await getCompanyStats();

  const totalCompanies = companies.length;
  const activeCompanies = companies.filter((c) => c.status === "ACTIVE").length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold">Companies</h2>
        <p className="text-slate-400 text-sm mt-1">
          {totalCompanies} total · {activeCompanies} active
        </p>
      </div>

      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900">
              <th className="text-left px-4 py-3 font-medium text-slate-400">Company</th>
              <th className="text-right px-4 py-3 font-medium text-slate-400">Users</th>
              <th className="text-right px-4 py-3 font-medium text-slate-400">Sites</th>
              <th className="text-right px-4 py-3 font-medium text-slate-400">Top-ups</th>
              <th className="text-right px-4 py-3 font-medium text-slate-400">Spend</th>
              <th className="text-right px-4 py-3 font-medium text-slate-400">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {companies.map((company) => (
              <tr key={company.id} className="hover:bg-slate-900/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium">{company.name}</div>
                  <div className="text-xs text-slate-500">
                    {company.id} · {new Date(company.createdAt).toLocaleDateString("en-IN")}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{company.userCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{company.siteCount}</td>
                <td className="px-4 py-3 text-right tabular-nums text-green-400">
                  {formatINR(company.totalTopUp)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-red-400">
                  {formatINR(company.totalSpend)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      company.status === "ACTIVE"
                        ? "bg-green-900/50 text-green-400"
                        : "bg-red-900/50 text-red-400"
                    }`}
                  >
                    {company.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <ImpersonateButton companyId={company.id} companyName={company.name} />
                    <SuspendButton
                      companyId={company.id}
                      currentStatus={company.status}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No companies yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
