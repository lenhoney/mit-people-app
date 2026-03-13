"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useClient } from "@/components/layout/client-provider";
import { Search, Download, ChevronDown, ChevronRight } from "lucide-react";

interface PeopleSummary {
  user_name: string;
  role: string | null;
  sow: string | null;
  project_count: number;
  total_hours: number;
  revenue: number;
}

interface PeopleDetail {
  user_name: string;
  task_number: string;
  task_description: string;
  total_hours: number;
  revenue: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function PeopleReport() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [summary, setSummary] = useState<PeopleSummary[]>([]);
  const [details, setDetails] = useState<PeopleDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<"total_hours" | "revenue" | "user_name">("total_hours");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const { selectedClientId } = useClient();

  const handleSearch = async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (personFilter) params.set("person", personFilter);
      if (selectedClientId) params.set("clientId", String(selectedClientId));

      const res = await fetch(`/api/reports/people?${params}`);
      if (!res.ok) { setSummary([]); setDetails([]); return; }
      const data = await res.json();
      setSummary(data.summary || []);
      setDetails(data.details || []);
    } catch (err) {
      console.error("Failed to load report:", err);
    } finally {
      setLoading(false);
    }
  };

  const togglePerson = (userName: string) => {
    const next = new Set(expandedPeople);
    if (next.has(userName)) {
      next.delete(userName);
    } else {
      next.add(userName);
    }
    setExpandedPeople(next);
  };

  const sortedSummary = [...summary].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const cmp = typeof aVal === "number" ? (aVal as number) - (bVal as number) : String(aVal).localeCompare(String(bVal));
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

  const totalHours = summary.reduce((sum, p) => sum + p.total_hours, 0);
  const totalRevenue = summary.reduce((sum, p) => sum + p.revenue, 0);

  const handleExportCSV = () => {
    const rows = [["Person", "Role", "SOW", "Project Code", "Project Name", "Hours", "Revenue"]];
    for (const d of details) {
      const personSummary = summary.find(s => s.user_name === d.user_name);
      rows.push([
        d.user_name,
        personSummary?.role || "",
        personSummary?.sow || "",
        d.task_number,
        d.task_description,
        String(d.total_hours),
        String(d.revenue.toFixed(2)),
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `people-report-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>People Hours Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[160px] h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[160px] h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Filter by Person</label>
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
          <Button onClick={handleSearch} disabled={!startDate || !endDate || loading} className="h-9">
            {loading ? "Loading..." : "Generate Report"}
          </Button>
          {summary.length > 0 && (
            <Button variant="outline" onClick={handleExportCSV} className="h-9">
              <Download className="h-3.5 w-3.5 mr-1" />
              Export CSV
            </Button>
          )}
        </div>

        {hasSearched && !loading && (
          <>
            {summary.length > 0 && (
              <div className="flex gap-4 py-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Total Hours: </span>
                  <span className="font-bold">{totalHours.toFixed(1)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Total Revenue: </span>
                  <span className="font-bold">{formatCurrency(totalRevenue)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">People: </span>
                  <span className="font-bold">{summary.length}</span>
                </div>
              </div>
            )}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort("user_name")}>
                        Person
                      </Button>
                    </TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>SOW</TableHead>
                    <TableHead className="text-right">Projects</TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort("total_hours")}>
                        Hours
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort("revenue")}>
                        Revenue
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No data found for the selected date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedSummary.map((person) => {
                      const isExpanded = expandedPeople.has(person.user_name);
                      const personDetails = details.filter(
                        (d) => d.user_name === person.user_name
                      );

                      return (
                        <>
                          <TableRow
                            key={person.user_name}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => togglePerson(person.user_name)}
                          >
                            <TableCell>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{person.user_name}</TableCell>
                            <TableCell>{person.role || "—"}</TableCell>
                            <TableCell>
                              {person.sow ? <Badge variant="outline">{person.sow}</Badge> : "—"}
                            </TableCell>
                            <TableCell className="text-right">{person.project_count}</TableCell>
                            <TableCell className="text-right tabular-nums">{person.total_hours.toFixed(1)}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">{formatCurrency(person.revenue)}</TableCell>
                          </TableRow>
                          {isExpanded &&
                            personDetails.map((detail, idx) => (
                              <TableRow key={`${person.user_name}-${idx}`} className="bg-muted/30">
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell className="font-mono text-xs">{detail.task_number}</TableCell>
                                <TableCell className="text-sm" colSpan={2}>{detail.task_description}</TableCell>
                                <TableCell className="text-right tabular-nums text-sm">{detail.total_hours.toFixed(1)}</TableCell>
                                <TableCell className="text-right tabular-nums text-sm">{formatCurrency(detail.revenue)}</TableCell>
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
