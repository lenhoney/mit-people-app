"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Timesheet {
  id: number;
  week_starts_on: string;
  category: string;
  user_name: string;
  task_description: string | null;
  task_number: string | null;
  state: string | null;
  sunday: number;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  total: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface TimesheetsTableProps {
  timesheets: Timesheet[];
  pagination: Pagination;
  onPageChange: (page: number) => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TimesheetsTable({ timesheets, pagination, onPageChange }: TimesheetsTableProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Week Starts</TableHead>
              <TableHead>Person</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Task #</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Sun</TableHead>
              <TableHead className="text-right">Mon</TableHead>
              <TableHead className="text-right">Tue</TableHead>
              <TableHead className="text-right">Wed</TableHead>
              <TableHead className="text-right">Thu</TableHead>
              <TableHead className="text-right">Fri</TableHead>
              <TableHead className="text-right">Sat</TableHead>
              <TableHead className="text-right font-bold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timesheets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                  No timesheets found. Upload a Timesheets spreadsheet to get started.
                </TableCell>
              </TableRow>
            ) : (
              timesheets.map((ts) => (
                <TableRow key={ts.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(ts.week_starts_on)}</TableCell>
                  <TableCell className="font-medium">{ts.user_name}</TableCell>
                  <TableCell>
                    <Badge variant={ts.category === "Project" ? "default" : "secondary"}>
                      {ts.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={ts.task_description || ""}>
                    {ts.task_description || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{ts.task_number || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={ts.state === "Processed" ? "default" : "outline"}>
                      {ts.state || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{ts.sunday || ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{ts.monday || ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{ts.tuesday || ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{ts.wednesday || ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{ts.thursday || ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{ts.friday || ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{ts.saturday || ""}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{ts.total}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
            {pagination.total} entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
