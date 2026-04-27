"use client";

import { useRouter } from "next/navigation";
import { TransferForm } from "./transfer-form";

type Props = React.ComponentProps<typeof TransferForm>;

export function TransferFormPage(props: Props) {
  const router = useRouter();
  return (
    <TransferForm
      {...props}
      onSuccess={() => router.push("/me")}
    />
  );
}
