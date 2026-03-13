"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, Search, Trash2 } from "lucide-react";

export interface PTOEntry {
  id: number;
  person_id: number | null;
  person_name: string;
  kerb: string | null;
  start_date: string;
  end_date: string;
  type: string;
  leave_status: string | null;
  country: string | null;
  message: string | null;
  business_days: number;
  billable_days: number | null;
  matched_person: string | null;
}

interface PTOTableProps {
  entries: PTOEntry[];
  onDelete: (id: number) => void;
  canDelete?: boolean;
}

type SortField = "person_name" | "start_date" | "end_date" | "type" | "business_days" | "billable_days";
type SortDir = "asc" | "desc";

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getTypeBadgeVariant(type: string): "default" | "secondary" | "destructive" | "outline" {
  switch (type) {
    case "Sick":
      return "destructive";
    case "National Holiday":
      return "secondary";
    default:
      return "default";
  }
}

function getStatusColor(status: string | null): string {
  switch (status) {
    case "Past":
      return "text-muted-foreground";
    case "Active":
      return "text-green-600 dark:text-green-400";
    case "Planned":
      return "text-blue-600 dark:text-blue-400";
    default:
      return "text-muted-foreground";
  }
}

export function PTOTable({ entries, onDelete, canDelete = true }: PTOTableProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("start_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "start_date" ? "desc" : "asc");
    }
  };

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      if (e.type) set.add(e.type);
    }
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    let result = entries;

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (e) =>
          (e.person_name || "").toLowerCase().includes(lower) ||
          (e.matched_person || "").toLowerCase().includes(lower) ||
          (e.kerb || "").toLowerCase().includes(lower) ||
          (e.country || "").toLowerCase().includes(lower) ||
          (e.message || "").toLowerCase().includes(lower)
      );
    }

    if (typeFilter !== "all") {
      result = result.filter((e) => e.type === typeFilter);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "person_name":
          cmp = (a.matched_person || a.person_name || "").localeCompare(
            b.matched_person || b.person_name || ""
          );
          break;
        case "start_date":
          cmp = (a.start_date || "").localeCompare(b.start_date || "");
          break;
        case "end_date":
          cmp = (a.end_date || "").localeCompare(b.end_date || "");
          break;
        case "type":
          cmp = (a.type || "").localeCompare(b.type || "");
          break;
        case "business_days":
          cmp = a.business_days - b.business_days;
          break;
        case "billable_days":
          cmp = (a.billable_days ?? a.business_days) - (b.billable_days ?? b.business_days);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [entries, search, typeFilter, sortField, sortDir]);

  const totalBizDays = filtered.reduce((sum, e) => sum + e.business_days, 0);
  const totalBillableDays = filtered
    .filter((e) => e.type !== "National Holiday")
    .reduce((sum, e) => sum + (e.billable_days ?? e.business_days), 0);

  const SortHeader = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <TableHead>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => handleSort(field)}
      >
        {children}
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, kerb, country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground ml-auto">
          {filtered.length} entries | {totalBizDays} business days | {totalBillableDays} billable days
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          {entries.length === 0
            ? 'No PTO data yet. Click "Upload PTO" to import a CSV file.'
            : "No matching entries found."}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader field="person_name">Person</SortHeader>
                <SortHeader field="start_date">Start Date</SortHeader>
                <SortHeader field="end_date">End Date</SortHeader>
                <SortHeader field="business_days">Days</SortHeader>
                <SortHeader field="billable_days">Billable</SortHeader>
                <SortHeader field="type">Type</SortHeader>
                <TableHead>Status</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Message</TableHead>
                {canDelete && <TableHead className="text-right w-[60px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium text-sm">
                    {entry.matched_person || entry.person_name || (
                      <span className="text-muted-foreground italic">
                        {entry.kerb || "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {formatDate(entry.start_date)}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {formatDate(entry.end_date)}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-center">
                    {entry.business_days}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-center">
                    {entry.type === "National Holiday"
                      ? "—"
                      : (entry.billable_days ?? entry.business_days)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getTypeBadgeVariant(entry.type)} className="text-xs">
                      {entry.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${getStatusColor(entry.leave_status)}`}>
                      {entry.leave_status || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.country || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {entry.message || "—"}
                  </TableCell>
                  {canDelete && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onDelete(entry.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
