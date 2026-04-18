import { redirect } from "next/navigation";
import { getCurrentUser, getSession } from "@/lib/auth";
import { AppNav } from "@/components/nav/app-nav";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { QuickActionFab } from "@/components/nav/quick-action-fab";
import { StopImpersonatingButton } from "@/components/super/stop-impersonating-button";

// All routes in this group require an active session + live DB queries.
// Force dynamic rendering so Next.js never attempts static prerendering here.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: { name: string; role: string };
  let isImpersonating = false;
  try {
    const u = await getCurrentUser();
    user = { name: u.name, role: u.role };
    const session = await getSession();
    isImpersonating = !!session.impersonatingCompanyId;
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      {isImpersonating && (
        <div className="bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-amber-950 flex items-center justify-center gap-3">
          <span>Superadmin impersonation active</span>
          <StopImpersonatingButton />
        </div>
      )}
      <AppNav user={user as { name: string; role: "OWNER" | "EMPLOYEE" }} />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <BottomTabBar />
      <QuickActionFab />
    </div>
  );
}
