"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Download, ChevronDown, ChevronRight } from "lucide-react";

interface PTOSummaryRow {
  display_name: string;
  person_id: number | null;
  total_entries: number;
  total_business_days: number;
  personal_days: number;
  sick_days: number;
  holiday_days: number;
  total_billable_days: number;
}

interface PTODetailRow {
  id: number;
  person_name: string;
  matched_person: string | null;
  kerb: string | null;
  start_date: string;
  end_date: string;
  type: string;
  leave_status: string | null;
  country: string | null;
  message: string | null;
  business_days: number;
  billable_days: number | null;
}

interface ReportTotals {
  totalDays: number;
  totalBillableDays: number;
  totalEntries: number;
  uniquePeople: number;
}

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

export function PTOReport() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [summary, setSummary] = useState<PTOSummaryRow[]>([]);
  const [details, setDetails] = useState<PTODetailRow[]>([]);
  const [totals, setTotals] = useState<ReportTotals | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(
    new Set()
  );
  const [sortField, setSortField] = useState<
    "total_business_days" | "total_billable_days" | "personal_days" | "sick_days" | "display_name"
  >("total_business_days");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSearch = async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (personFilter) params.set("person", personFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);

      const res = await fetch(`/api/reports/pto?${params}`);
      const data = await res.json();
      setSummary(data.summary);
      setDetails(data.details);
      setTotals(data.totals);
    } catch (err) {
      console.error("Failed to load PTO report:", err);
    } finally {
      setLoading(false);
    }
  };

  const togglePerson = (name: string) => {
    const next = new Set(expandedPeople);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setExpandedPeople(next);
  };

  const sortedSummary = [...summary].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const cmp =
      typeof aVal === "number"
        ? (aVal as number) - (bVal as number)
        : String(aVal).localeCompare(String(bVal));
    return sortDir === "desc" ? -cmp : cmp;
  });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const handleExportCSV = () => {
    const rows = [
      [
        "Person",
        "Start Date",
        "End Date",
        "Business Days",
        "Billable Days",
        "Type",
        "Status",
        "Country",
        "Message",
      ],
    ];
    for (const d of details) {
      rows.push([
        d.matched_person || d.person_name || "",
        d.start_date,
        d.end_date,
        String(d.business_days),
        String(d.type === "National Holiday" ? 0 : (d.billable_days ?? d.business_days)),
        d.type,
        d.leave_status || "",
        d.country || "",
        d.message || "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pto-report-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Time Off Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Start Date
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[160px] h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              End Date
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[160px] h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Filter by Person
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Person name..."
                value={personFilter}
                onChange={(e) => setPersonFilter(e.target.value)}
                className="pl-8 w-[200px] h-9"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Type
            </label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Personal">Personal</SelectItem>
                <SelectItem value="Sick">Sick</SelectItem>
                <SelectItem value="National Holiday">
                  National Holiday
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleSearch}
            disabled={!startDate || !endDate || loading}
            className="h-9"
          >
            {loading ? "Loading..." : "Generate Report"}
          </Button>
          {summary.length > 0 && (
            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="h-9"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export CSV
            </Button>
          )}
        </div>

        {hasSearched && !loading && (
          <>
            {totals && (
              <div className="flex gap-4 py-2 flex-wrap">
                <div className="text-sm">
                  <span className="text-muted-foreground">People: </span>
                  <span className="font-bold">{totals.uniquePeople}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    Total Entries:{" "}
                  </span>
                  <span className="font-bold">{totals.totalEntries}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    Total Business Days:{" "}
                  </span>
                  <span className="font-bold">{totals.totalDays}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    Total Billable Days:{" "}
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{totals.totalBillableDays}</span>
                </div>
              </div>
            )}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8"
                        onClick={() => handleSort("display_name")}
                      >
                        Person
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8"
                        onClick={() => handleSort("total_business_days")}
                      >
                        Total Days
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8"
                        onClick={() => handleSort("total_billable_days")}
                      >
                        Billable Days
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8"
                        onClick={() => handleSort("personal_days")}
                      >
                        Personal
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8"
                        onClick={() => handleSort("sick_days")}
                      >
                        Sick
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Holidays</TableHead>
                    <TableHead className="text-right">Entries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSummary.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No PTO data found for the selected date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedSummary.map((person) => {
                      const isExpanded = expandedPeople.has(
                        person.display_name
                      );
                      const personDetails = details.filter(
                        (d) =>
                          (d.matched_person || d.person_name) ===
                          person.display_name
                      );

                      return (
                        <>
                          <TableRow
                            key={person.display_name}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => togglePerson(person.display_name)}
                          >
                            <TableCell>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {person.display_name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-bold">
                              {person.total_business_days}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-bold text-blue-600 dark:text-blue-400">
                              {person.total_billable_days}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {person.personal_days > 0
                                ? person.personal_days
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {person.sick_days > 0 ? person.sick_days : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {person.holiday_days > 0
                                ? person.holiday_days
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {person.total_entries}
                            </TableCell>
                          </TableRow>
                          {isExpanded &&
                            personDetails.map((detail) => (
                              <TableRow
                                key={detail.id}
                                className="bg-muted/30"
                              >
                                <TableCell></TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {formatDate(detail.start_date)}
                                  {detail.start_date !== detail.end_date && (
                                    <> — {formatDate(detail.end_date)}</>
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-sm">
                                  {detail.business_days}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-sm text-blue-600 dark:text-blue-400">
                                  {detail.type === "National Holiday"
                                    ? "—"
                                    : (detail.billable_days ?? detail.business_days)}
                                </TableCell>
                                <TableCell colSpan={2}>
                                  <Badge
                                    variant={getTypeBadgeVariant(detail.type)}
                                    className="text-xs"
                                  >
                                    {detail.type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {detail.country || "—"}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                                  {detail.message || "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                        </>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
