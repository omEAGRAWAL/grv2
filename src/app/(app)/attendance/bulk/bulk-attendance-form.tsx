"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createBulkAttendance } from "@/app/actions/bulk-attendance";

type Employee = {
  id: string;
  name: string;
  title: string | null;
  role: string;
};

type Site = {
  id: string;
  name: string;
};

type Status = "PRESENT" | "HALF_DAY" | "ABSENT" | "SKIP";

type Props = {
  employees: Employee[];
  sites: Site[];
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function maxDateISO(): string {
  return todayISO();
}

function minDateISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_LABELS: Record<Status, string> = {
  PRESENT: "Present",
  HALF_DAY: "Half Day",
  ABSENT: "Absent",
  SKIP: "Skip",
};

const STATUS_CLASSES: Record<Status, string> = {
  PRESENT: "bg-green-100 text-green-700 border-green-300",
  HALF_DAY: "bg-yellow-100 text-yellow-700 border-yellow-300",
  ABSENT: "bg-red-100 text-red-700 border-red-300",
  SKIP: "bg-gray-100 text-gray-400 border-gray-200",
};

export function BulkAttendanceForm({ employees, sites }: Props) {
  const [date, setDate] = useState(todayISO());
  const [statuses, setStatuses] = useState<Record<string, Status>>(
    Object.fromEntries(employees.map((e) => [e.id, "SKIP"]))
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [skippedDialog, setSkippedDialog] = useState<
    { userName: string; reason: string }[]
  >([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function setStatus(userId: string, status: Status) {
    setStatuses((prev) => ({ ...prev, [userId]: status }));
  }

  function toggleSelect(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(employees.map((e) => e.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function bulkSetStatus(status: Status) {
    if (selected.size === 0) return;
    setStatuses((prev) => {
      const next = { ...prev };
      for (const id of selected) next[id] = status;
      return next;
    });
  }

  function handleSubmit() {
    const entries = employees.map((e) => ({
      userId: e.id,
      status: statuses[e.id] ?? "SKIP",
    }));

    startTransition(async () => {
      const result = await createBulkAttendance(date, entries);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const { created, updated, skipped } = result;
      const total = created + updated;

      if (total > 0) {
        toast.success(
          `Marked ${total} employee${total !== 1 ? "s" : ""} (${created} new, ${updated} updated)`
        );
      } else {
        toast.info("No changes made");
      }

      if (skipped.length > 0) {
        setSkippedDialog(skipped);
      } else {
        router.push("/attendance");
      }
    });
  }

  const activeCount = Object.values(statuses).filter((s) => s !== "SKIP").length;

  return (
    <>
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium block">Date</label>
            <input
              type="date"
              value={date}
              min={minDateISO()}
              max={maxDateISO()}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          {sites.length > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium block">Site (optional)</label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">All employees</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Select:</span>
          <Button variant="outline" size="sm" onClick={selectAll}>
            All
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            None
          </Button>
          {selected.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground ml-2">
                Mark {selected.size} as:
              </span>
              {(["PRESENT", "HALF_DAY", "ABSENT"] as Status[]).map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  onClick={() => bulkSetStatus(s)}
                  className={STATUS_CLASSES[s]}
                >
                  {STATUS_LABELS[s]}
                </Button>
              ))}
            </>
          )}
        </div>

        {/* Employee table */}
        {employees.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">No active employees found</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="divide-y">
              {employees.map((emp) => {
                const status = statuses[emp.id] ?? "SKIP";
                const isSelected = selected.has(emp.id);

                return (
                  <div
                    key={emp.id}
                    className="px-4 py-3 flex items-center gap-3"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(emp.id)}
                      className="rounded shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emp.name}</p>
                      {emp.title && (
                        <p className="text-xs text-muted-foreground">{emp.title}</p>
                      )}
                    </div>

                    <div className="flex gap-1 shrink-0">
                      {(["PRESENT", "HALF_DAY", "ABSENT", "SKIP"] as Status[]).map(
                        (s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setStatus(emp.id, s)}
                            className={`px-2 py-0.5 rounded text-xs font-medium border transition-opacity ${
                              STATUS_CLASSES[s]
                            } ${status === s ? "opacity-100 shadow-sm" : "opacity-40 hover:opacity-70"}`}
                          >
                            {s === "SKIP" ? "Skip" : STATUS_LABELS[s]}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {activeCount} employee{activeCount !== 1 ? "s" : ""} will be marked
          </p>
          <Button
            onClick={handleSubmit}
            disabled={isPending || activeCount === 0}
            size="sm"
          >
            <UserCheck className="h-4 w-4 mr-1.5" />
            {isPending ? "Saving…" : "Submit Attendance"}
          </Button>
        </div>
      </div>

      {/* Skipped dialog */}
      <Dialog
        open={skippedDialog.length > 0}
        onOpenChange={(o) => {
          if (!o) {
            setSkippedDialog([]);
            router.push("/attendance");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Some Entries Skipped</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <p className="text-sm text-muted-foreground">
              The following employees were not updated:
            </p>
            <div className="space-y-1">
              {skippedDialog.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{s.userName}</span>
                  <Badge variant="secondary" className="text-xs">
                    {s.reason}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={() => {
                  setSkippedDialog([]);
                  router.push("/attendance");
                }}
              >
                <Check className="h-4 w-4 mr-1.5" />
                OK
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
