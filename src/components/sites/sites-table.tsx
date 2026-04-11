"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SiteRow = {
  id: string;
  name: string;
  clientName: string;
  contractFormatted: string;
  spentFormatted: string;
  plFormatted: string;
  status: "ACTIVE" | "COMPLETED" | "ON_HOLD";
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  COMPLETED: "secondary",
  ON_HOLD: "outline",
};

export function SitesTable({ rows }: { rows: SiteRow[] }) {
  const router = useRouter();

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Site Name</TableHead>
            <TableHead>Client</TableHead>
            <TableHead className="text-right">Spent</TableHead>
            <TableHead className="text-right">Budget</TableHead>
            <TableHead className="text-right">Received</TableHead>
            <TableHead className="text-right">P&amp;L</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer"
              onClick={() => router.push(`/sites/${row.id}`)}
            >
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {row.clientName}
              </TableCell>
              <TableCell className="text-right tabular-nums text-red-600">
                {row.spentFormatted}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.contractFormatted}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                ₹0.00
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {row.plFormatted}
              </TableCell>
              <TableCell>
                <Badge
                  variant={STATUS_VARIANT[row.status] ?? "secondary"}
                  className="text-xs"
                >
                  {STATUS_LABELS[row.status] ?? row.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
