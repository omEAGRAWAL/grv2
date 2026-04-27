"use client";

import { useRouter } from "next/navigation";
import { ExpenseForm } from "./expense-form";

type Props = React.ComponentProps<typeof ExpenseForm>;

export function ExpenseFormPage(props: Props) {
  const router = useRouter();
  return (
    <ExpenseForm
      {...props}
      onSuccess={(redirectTo) => router.push(redirectTo)}
    />
  );
}
