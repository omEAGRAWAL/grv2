"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopUpDialog } from "./topup-dialog";

type Props = {
  employeeId: string;
  employeeName: string;
  walletBalancePaise: string;
};

export function TopUpButton({ employeeId, employeeName, walletBalancePaise }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Wallet className="h-4 w-4 mr-1.5" />
        Top Up
      </Button>
      <TopUpDialog
        employeeId={employeeId}
        employeeName={employeeName}
        currentBalancePaise={walletBalancePaise}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
