"use client";

import { useActionState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { markManualAttendance } from "@/app/actions/attendance";
import type { AttendanceActionResult } from "@/app/actions/attendance";

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

function MarkButtons({ userId }: { userId: string }) {
  const [state, action] = useActionState<AttendanceActionResult | null, FormData>(
    markManualAttendance,
    null
  );
  const [isPending, startTransition] = useTransition();

  const mark = (status: string) => {
    const fd = new FormData();
    fd.append("userId", userId);
    fd.append("status", status);
    startTransition(() => {
      action(fd);
    });
  };

  if (state?.success) {
    toast.success("Attendance marked");
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {(["PRESENT", "HALF_DAY", "ABSENT"] as const).map((s) => (
        <button
          key={s}
          disabled={isPending}
          onClick={() => mark(s)}
          className={`text-xs px-2 py-1 rounded border font-medium transition-colors hover:opacity-80 ${STATUS_COLORS[s] ?? ""}`}
        >
          {STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

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
            {canMark && <th className="text-left px-4 py-2 font-medium">Mark</th>}
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
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[row.attendance.status] ?? ""}`}
                    >
                      {STATUS_LABELS[row.attendance.status] ?? row.attendance.status}
                    </span>
                    {row.attendance.method === "MANUAL" && (
                      <Badge variant="outline" className="text-xs">Manual</Badge>
                    )}
                    {row.attendance.photoUrl && (
                      <a
                        href={row.attendance.photoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline"
                      >
                        Selfie
                      </a>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Not marked</span>
                )}
              </td>
              {canMark && (
                <td className="px-4 py-3">
                  <MarkButtons userId={row.id} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
