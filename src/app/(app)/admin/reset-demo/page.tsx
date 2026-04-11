import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ResetDemoButton } from "./reset-demo-button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reset Demo — ConstructHub" };

export default async function ResetDemoPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  if (user.role !== "OWNER") redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-destructive">Reset Demo Data</h1>
          <p className="text-sm text-muted-foreground">
            This will <strong>permanently delete</strong> all current data (sites, employees,
            transactions, purchases, incomes) and replace it with fresh demo data.
            Your owner account credentials are preserved.
          </p>
        </div>
        <ResetDemoButton />
      </div>
    </div>
  );
}
