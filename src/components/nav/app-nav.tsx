"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown, LogOut, User, Receipt, ArrowRightLeft, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/app/actions/auth";

type NavUser = {
  name: string;
  role: "OWNER" | "EMPLOYEE";
};

const OWNER_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sites", label: "Sites" },
  { href: "/attendance", label: "Attendance" },
  { href: "/employees", label: "Employees" },
  { href: "/vendors", label: "Vendors" },
  { href: "/reports", label: "Reports" },
];

const EMPLOYEE_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sites", label: "Sites" },
  { href: "/attendance", label: "Attendance" },
];

export function AppNav({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const links = user.role === "OWNER" ? OWNER_LINKS : EMPLOYEE_LINKS;

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      router.push("/login");
    });
  }

  return (
    <header className="hidden md:flex h-14 items-center gap-6 border-b bg-background px-4">
      <Link
        href="/dashboard"
        className="font-bold text-base tracking-tight shrink-0"
      >
        ConstructHub
      </Link>

      <nav className="flex items-center gap-0.5 flex-1">
        {links.map((link) => {
          const active =
            link.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {link.label}
            </Link>
          );
        })}

        {/* Quick action links in nav for desktop */}
        <div className="ml-3 flex items-center gap-0.5">
          <Link
            href="/expense/new"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              pathname === "/expense/new"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            Expense
          </Link>
          <Link
            href="/transfer/new"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              pathname === "/transfer/new"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Transfer
          </Link>
          {user.role === "OWNER" && (
            <Link
              href="/purchases/new"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                pathname === "/purchases/new"
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Purchase
            </Link>
          )}
        </div>
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 shrink-0">
            <User className="h-4 w-4" />
            <span className="max-w-[120px] truncate">{user.name}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
            {user.role}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/me">Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            disabled={isPending}
            className="text-destructive focus:text-destructive cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            {isPending ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
