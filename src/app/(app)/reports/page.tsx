import { redirect } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reports — ConstructHub" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const owner = await requireOwner().catch(() => null);
  if (!owner) redirect("/login");

  const companyId = owner.effectiveCompanyId ?? owner.companyId;
  if (!companyId) redirect("/dashboard");

  const { site: defaultSiteId } = await searchParams;

  const [sites, employees] = await Promise.all([
    db.site.findMany({
      where: { companyId },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { role: "EMPLOYEE", companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Reports &amp; Exports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Download transaction data as CSV for offline analysis.
        </p>
      </div>

      {/* Per-site export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Per-Site Export
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            All transactions for a single site: wallet expenses, purchases,
            material transfers, and income — unified in one CSV.
          </p>
          <div className="divide-y rounded-lg border">
            {sites.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No sites found.</p>
            ) : (
              sites.map((site) => (
                <div
                  key={site.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{site.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {site.status.toLowerCase().replace("_", " ")}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={`/api/reports/site?siteId=${site.id}`}
                      download
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Download CSV
                    </a>
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Per-employee export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Per-Employee Wallet History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Complete wallet transaction history for a single employee.
          </p>
          <div className="divide-y rounded-lg border">
            {employees.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No employees found.</p>
            ) : (
              employees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <p className="text-sm font-medium">{emp.name}</p>
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={`/api/reports/employee?employeeId=${emp.id}`}
                      download
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Download CSV
                    </a>
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Company-wide export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Company-Wide Export
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            All transactions across every site and employee in a single CSV.
            Use this for full financial audits.
          </p>
          <Button asChild variant="default">
            <a href="/api/reports/company" download>
              <Download className="h-4 w-4 mr-2" />
              Download Full Company CSV
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
