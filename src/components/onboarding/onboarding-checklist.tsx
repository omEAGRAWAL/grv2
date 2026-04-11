"use client";

import { useTransition } from "react";
import { CheckCircle2, Circle, X } from "lucide-react";
import Link from "next/link";
import { dismissOnboarding } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";

type Props = {
  hasSite: boolean;
  hasEmployee: boolean;
  hasTopUp: boolean;
};

export function OnboardingChecklist({ hasSite, hasEmployee, hasTopUp }: Props) {
  const [isPending, startTransition] = useTransition();

  const allDone = hasSite && hasEmployee && hasTopUp;

  function handleDismiss() {
    startTransition(async () => {
      await dismissOnboarding();
    });
  }

  const items = [
    {
      done: hasSite,
      label: "Add your first site",
      href: "/sites",
    },
    {
      done: hasEmployee,
      label: "Add your first employee",
      href: "/employees",
    },
    {
      done: hasTopUp,
      label: "Top up an employee wallet",
      href: "/employees",
    },
  ];

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 relative">
      <button
        onClick={handleDismiss}
        disabled={isPending}
        aria-label="Dismiss onboarding checklist"
        className="absolute top-3 right-3 p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <p className="font-semibold text-blue-900 text-sm mb-1">
        Welcome to ConstructHub!
      </p>
      <p className="text-xs text-blue-700 mb-3">
        {allDone
          ? "You're all set! Dismiss this card whenever you're ready."
          : "Get started with these three steps:"}
      </p>

      <ul className="space-y-2">
        {items.map(({ done, label, href }) => (
          <li key={label} className="flex items-center gap-2">
            {done ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-blue-400 shrink-0" />
            )}
            {done ? (
              <span className="text-sm text-blue-700 line-through opacity-60">
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="text-sm text-blue-900 font-medium hover:underline"
              >
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
