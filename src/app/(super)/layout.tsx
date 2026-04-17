import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function SuperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const user = await getCurrentUser();
    if (user.role !== "SUPERADMIN") {
      redirect("/dashboard");
    }
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold tracking-widest uppercase text-slate-500">
            ConstructHub
          </span>
          <h1 className="text-lg font-bold text-slate-100">Superadmin Panel</h1>
        </div>
        <a
          href="/login"
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          Sign out →
        </a>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
