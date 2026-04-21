"use client";

import { useState } from "react";
import { IndianRupee, Wallet, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopUpDialog } from "@/components/employees/topup-dialog";
import { SalaryPaymentDialog } from "./salary-payment-dialog";
import { PayrollNoteDialog } from "./payroll-note-dialog";

type Props = {
  userId: string;
  employeeName: string;
  walletBalancePaise: string;
  outstandingAdvancePaise: string;
};

export function PayrollActionButtonsClient({
  userId,
  employeeName,
  walletBalancePaise,
  outstandingAdvancePaise,
}: Props) {
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setAdvanceOpen(true)}>
          <Wallet className="h-4 w-4 mr-1.5" />
          Give Advance
        </Button>
        <Button size="sm" onClick={() => setSalaryOpen(true)}>
          <IndianRupee className="h-4 w-4 mr-1.5" />
          Pay Salary
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
          <StickyNote className="h-4 w-4 mr-1.5" />
          Add Note
        </Button>
      </div>

      <TopUpDialog
        employeeId={userId}
        employeeName={employeeName}
        currentBalancePaise={walletBalancePaise}
        open={advanceOpen}
        onOpenChange={setAdvanceOpen}
      />
      <SalaryPaymentDialog
        employeeId={userId}
        employeeName={employeeName}
        outstandingAdvancePaise={outstandingAdvancePaise}
        open={salaryOpen}
        onOpenChange={setSalaryOpen}
      />
      <PayrollNoteDialog
        userId={userId}
        open={noteOpen}
        onOpenChange={setNoteOpen}
      />
    </>
  );
}
