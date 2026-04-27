"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MapPin,
  Camera,
  User,
  MoreHorizontal,
  Users,
  Building,
  ShoppingCart,
  Package,
  BarChart2,
  Bell,
  Wrench,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const BASE_TABS = [
  { href: "/dashboard", label: "Home", Icon: Home },
  { href: "/sites", label: "Sites", Icon: MapPin },
  { href: "/attendance", label: "Attendance", Icon: Camera },
  { href: "/me", label: "Me", Icon: User },
];

const OWNER_MORE_LINKS = [
  { href: "/employees", label: "Employees", Icon: Users },
  { href: "/assets", label: "Assets", Icon: Wrench },
  { href: "/vendors", label: "Vendors", Icon: Building },
  { href: "/purchases", label: "Purchases", Icon: ShoppingCart },
  { href: "/materials", label: "Materials", Icon: Package },
  { href: "/reports", label: "Reports", Icon: BarChart2 },
  { href: "/updates", label: "Updates", Icon: Bell },
];

export function BottomTabBar({ role }: { role: "OWNER" | "EMPLOYEE" | string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = OWNER_MORE_LINKS.some((l) => pathname.startsWith(l.href));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background md:hidden">
        <div className="flex">
          {BASE_TABS.map(({ href, label, Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-xs transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </Link>
            );
          })}

          {role === "OWNER" && (
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-xs transition-colors ${
                isMoreActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              More
            </button>
          )}
        </div>
      </nav>

      {role === "OWNER" && (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl pb-8">
            <SheetHeader className="mb-4">
              <SheetTitle>More</SheetTitle>
            </SheetHeader>

            <div className="grid grid-cols-4 gap-3">
              {OWNER_MORE_LINKS.map(({ href, label, Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 px-2 text-xs transition-colors ${
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
