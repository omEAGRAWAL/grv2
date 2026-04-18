import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWalletBalance } from "@/lib/wallet";
import { formatINR } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddEmployeeDialog } from "@/components/employees/add-employee-dialog";
import { EmployeeActionsMenu } from "@/components/employees/employee-actions-menu";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Employees — ConstructHub" };

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "Employee",
  WORKER: "Worker",
  SUPERVISOR: "Supervisor",
  SITE_MANAGER: "Site Manager",
  OWNER: "Owner",
};

export default async function EmployeesPage() {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");

  const canManage = currentUser.role === "OWNER" || currentUser.role === "SITE_MANAGER";
  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2 p-6">
        <p className="font-semibold">Access Denied</p>
        <p className="text-sm text-muted-foreground">
          Only owners and site managers can view the employee list.
        </p>
      </div>
    );
  }

  const companyId = currentUser.effectiveCompanyId ?? currentUser.companyId;

  const employees = await db.user.findMany({
    where: {
      companyId,
      role: { notIn: ["OWNER", "SUPERADMIN"] },
    },
    orderBy: { createdAt: "desc" },
  });

  const balances = await Promise.all(employees.map((e) => getWalletBalance(e.id)));

  const rows = employees.map((e, i) => ({
    id: e.id,
    name: e.name,
    username: e.username,
    role: e.role,
    title: e.title,
    isActive: e.isActive,
    joinedAt: e.joinedAt.toLocaleDateString("en-IN"),
    walletBalance: balances[i],
    walletBalancePaise: balances[i].toString(),
  }));

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Employees</h1>
        <AddEmployeeDialog callerRole={currentUser.role} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium">No employees yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add your first employee using the button above.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Username</TableHead>
                <TableHead className="text-right">Wallet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.name}
                    {row.title && (
                      <span className="block text-xs text-muted-foreground">{row.title}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {ROLE_LABELS[row.role] ?? row.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {row.username}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(row.walletBalance)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.isActive ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {row.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.joinedAt}
                  </TableCell>
                  <TableCell>
                    <EmployeeActionsMenu
                      userId={row.id}
                      userName={row.name}
                      isActive={row.isActive}
                      walletBalancePaise={row.walletBalancePaise}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
