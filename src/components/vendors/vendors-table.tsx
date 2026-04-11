"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type VendorRow = {
  id: string;
  name: string;
  contactPhone: string | null;
  gstin: string | null;
  totalPurchasedFormatted: string;
};

export function VendorsTable({ rows }: { rows: VendorRow[] }) {
  const router = useRouter();

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>GSTIN</TableHead>
            <TableHead className="text-right">Total Purchased</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer"
              onClick={() => router.push(`/vendors/${row.id}`)}
            >
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {row.contactPhone ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm font-mono">
                {row.gstin ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {row.totalPurchasedFormatted}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
