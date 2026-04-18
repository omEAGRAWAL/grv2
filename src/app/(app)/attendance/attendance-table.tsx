"use client";

import { useActionState, useTransition, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { markManualAttendance } from "@/app/actions/attendance";
import type { AttendanceActionResult } from "@/app/actions/attendance";
import { useState } from "react";

interface AttendanceRow {
  id: string;
  name: string;
  role: string;
  title: string | null;
  attendance: {
    status: string;
    method: string;
    photoUrl: string | null;
  } | null;
}

interface AttendanceTableProps {
  rows: AttendanceRow[];
  canMark: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-800",
  HALF_DAY: "bg-yellow-100 text-yellow-800",
  ABSENT: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present",
  HALF_DAY: "Half Day",
  ABSENT: "Absent",
};

// ─── Selfie lightbox dialog ───────────────────────────────────────────────────

function SelfieDialog({ photoUrl, name }: { photoUrl: string; name: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="text-xs text-blue-600 underline">Selfie</button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{name}&apos;s selfie</DialogTitle>
        </DialogHeader>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt={`${name}'s attendance selfie`}
          className="w-full rounded-lg object-cover"
        />
      </DialogContent>
    </Dialog>
  );
}

// ─── Mark attendance dialog ───────────────────────────────────────────────────

function MarkForm({ userId, close }: { userId: string; close: () => void }) {
  const [state, action] = useActionState<AttendanceActionResult | null, FormData>(
    markManualAttendance,
    null
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (state?.success) {
      toast.success("Attendance marked");
      close();
    }
  }, [state, close]);

  const mark = (status: string) => {
    const fd = new FormData();
    fd.append("userId", userId);
    fd.append("status", status);
    startTransition(() => action(fd));
  };

  return (
    <div className="space-y-3 pt-1">
      {state && !state.success && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <div className="flex flex-col gap-2">
        {(["PRESENT", "HALF_DAY", "ABSENT"] as const).map((s) => (
          <button
            key={s}
            disabled={isPending}
            onClick={() => mark(s)}
            className={`w-full py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 ${STATUS_COLORS[s]}`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      <Button variant="outline" className="w-full" onClick={close} disabled={isPending}>
        Cancel
      </Button>
    </div>
  );
}

function MarkDialog({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          Mark
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-xs"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Mark attendance — {name}</DialogTitle>
        </DialogHeader>
        <MarkForm userId={userId} close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

export function AttendanceTable({ rows, canMark }: AttendanceTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No employees found.</p>;
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Employee</th>
            <th className="text-left px-4 py-2 font-medium">Status</th>
            {canMark && <th className="text-left px-4 py-2 font-medium">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-accent/30">
              <td className="px-4 py-3">
                <p className="font-medium">{row.name}</p>
                {row.title && (
                  <p className="text-xs text-muted-foreground">{row.title}</p>
                )}
              </td>
              <td className="px-4 py-3">
                {row.attendance ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[row.attendance.status] ?? ""}`}
                    >
                      {STATUS_LABELS[row.attendance.status] ?? row.attendance.status}
                    </span>
                    {row.attendance.method === "MANUAL" && (
                      <Badge variant="outline" className="text-xs">Manual</Badge>
                    )}
                    {row.attendance.photoUrl && (
                      <SelfieDialog
                        photoUrl={row.attendance.photoUrl}
                        name={row.name}
                      />
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Not marked</span>
                )}
              </td>
              {canMark && (
                <td className="px-4 py-3">
                  <MarkDialog userId={row.id} name={row.name} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
