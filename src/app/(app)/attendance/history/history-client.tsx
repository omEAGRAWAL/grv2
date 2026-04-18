"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildCsv } from "@/lib/csv";

interface AttendanceRecord {
  date: Date;
  status: string;
  method: string;
}

interface HistoryClientProps {
  userId: string;
  userName: string;
  initialYear: number;
  initialMonth: number;
  records: AttendanceRecord[];
}

const STATUS_COLORS: Record<string, string> = {
  PRESENT: "bg-green-400 text-white",
  HALF_DAY: "bg-yellow-400 text-white",
  ABSENT: "bg-red-400 text-white",
};

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "P",
  HALF_DAY: "H",
  ABSENT: "A",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function HistoryClient({
  userName,
  initialYear,
  initialMonth,
  records,
}: HistoryClientProps) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [currentRecords, setCurrentRecords] = useState<AttendanceRecord[]>(records);
  const [loading, setLoading] = useState(false);

  const navigate = async (dy: number, dm: number) => {
    let ny = year + dy;
    let nm = month + dm;
    if (nm > 12) { ny++; nm = 1; }
    if (nm < 1) { ny--; nm = 12; }
    setYear(ny);
    setMonth(nm);
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/history?year=${ny}&month=${nm}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentRecords(data.records.map((r: { date: string; status: string; method: string }) => ({
          ...r,
          date: new Date(r.date),
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  const recordMap = new Map(
    currentRecords.map((r) => [r.date.getDate(), r])
  );

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  const present = currentRecords.filter((r) => r.status === "PRESENT").length;
  const halfDay = currentRecords.filter((r) => r.status === "HALF_DAY").length;
  const absent = currentRecords.filter((r) => r.status === "ABSENT").length;

  const exportCsv = () => {
    const csv = buildCsv(
      ["Employee", "Date", "Status", "Method"],
      currentRecords.map((r) => [
        userName,
        r.date.toISOString().slice(0, 10),
        r.status,
        r.method,
      ])
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${userName.replace(/\s/g, "_")}_${year}_${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(0, -1)} disabled={loading}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium">{MONTH_NAMES[month - 1]} {year}</span>
        <Button variant="ghost" size="sm" onClick={() => navigate(0, 1)} disabled={loading}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50 text-center text-xs font-medium py-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-border">
          {/* Empty cells before month start */}
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`empty-${i}`} className="bg-background p-2 min-h-[2.5rem]" />
          ))}
          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const rec = recordMap.get(day);
            return (
              <div
                key={day}
                className={`bg-background p-1 min-h-[2.5rem] flex flex-col items-center justify-center gap-0.5 ${loading ? "opacity-50" : ""}`}
              >
                <span className="text-xs text-muted-foreground">{day}</span>
                {rec && (
                  <span
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${STATUS_COLORS[rec.status] ?? "bg-gray-200"}`}
                  >
                    {STATUS_LABELS[rec.status]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border p-3">
          <p className="text-2xl font-bold text-green-600">{present}</p>
          <p className="text-xs text-muted-foreground">Present</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-2xl font-bold text-yellow-600">{halfDay}</p>
          <p className="text-xs text-muted-foreground">Half Day</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-2xl font-bold text-red-600">{absent}</p>
          <p className="text-xs text-muted-foreground">Absent</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-green-400 inline-block" /> Present</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-yellow-400 inline-block" /> Half Day</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-400 inline-block" /> Absent</span>
      </div>

      {/* CSV Export */}
      <Button variant="outline" size="sm" onClick={exportCsv} className="w-full">
        <Download className="mr-2 h-4 w-4" /> Export CSV
      </Button>
    </div>
  );
}
