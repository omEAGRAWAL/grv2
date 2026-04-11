"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Eye, KeyRound, UserX, UserCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { DeactivateDialog } from "./deactivate-dialog";
import { TopUpDialog } from "./topup-dialog";

type Props = {
  userId: string;
  userName: string;
  isActive: boolean;
  walletBalancePaise: string;
};

type OpenDialog = "reset-password" | "deactivate" | "topup" | null;

export function EmployeeActionsMenu({
  userId,
  userName,
  isActive,
  walletBalancePaise,
}: Props) {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href={`/employees/${userId}`}>
              <Eye className="h-4 w-4" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpenDialog("topup")}>
            <Wallet className="h-4 w-4" />
            Top Up Wallet
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog("reset-password")}>
            <KeyRound className="h-4 w-4" />
            Reset Password
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setOpenDialog("deactivate")}
            className={isActive ? "text-destructive focus:text-destructive" : ""}
          >
            {isActive ? (
              <UserX className="h-4 w-4" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
            {isActive ? "Deactivate" : "Reactivate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TopUpDialog
        employeeId={userId}
        employeeName={userName}
        currentBalancePaise={walletBalancePaise}
        open={openDialog === "topup"}
        onOpenChange={(o) => setOpenDialog(o ? "topup" : null)}
      />
      <ResetPasswordDialog
        userId={userId}
        userName={userName}
        open={openDialog === "reset-password"}
        onOpenChange={(o) => setOpenDialog(o ? "reset-password" : null)}
      />
      <DeactivateDialog
        userId={userId}
        userName={userName}
        isActive={isActive}
        open={openDialog === "deactivate"}
        onOpenChange={(o) => setOpenDialog(o ? "deactivate" : null)}
      />
    </>
  );
}
