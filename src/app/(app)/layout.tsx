import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppNav } from "@/components/nav/app-nav";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { QuickActionFab } from "@/components/nav/quick-action-fab";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: { name: string; role: "OWNER" | "EMPLOYEE" };
  try {
    const u = await getCurrentUser();
    user = { name: u.name, role: u.role as "OWNER" | "EMPLOYEE" };
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav user={user} />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <BottomTabBar />
      <QuickActionFab />
    </div>
  );
}
