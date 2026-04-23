"use client";

import { useState } from "react";
import { IndianRupee, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SalaryPaymentDialog } from "./salary-payment-dialog";
import { PayrollNoteDialog } from "./payroll-note-dialog";

type Props = {
  userId: string;
  employeeName: string;
  outstandingAdvancePaise: string;
};

export function PayrollActionButtonsClient({
  userId,
  employeeName,
  outstandingAdvancePaise,
}: Props) {
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setSalaryOpen(true)}>
          <IndianRupee className="h-4 w-4 mr-1.5" />
          Pay Salary
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
          <StickyNote className="h-4 w-4 mr-1.5" />
          Add Note
        </Button>
      </div>

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
