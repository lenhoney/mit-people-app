"use client";

import { useState, useMemo } from "react";
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
import { Search, Download, ChevronDown, ChevronRight } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";

interface ProjectSummary {
  task_number: string;
  task_description: string;
  people_count: number;
  total_hours: number;
  revenue: number;
}

interface ProjectDetail {
  task_number: string;
  task_description: string;
  user_name: string;
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

function formatCurrencyCompact(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

const CHART_COLORS = [
  "#2563eb", // blue-600
  "#dc2626", // red-600
  "#16a34a", // green-600
  "#ca8a04", // yellow-600
  "#9333ea", // purple-600
  "#ea580c", // orange-600
  "#0891b2", // cyan-600
  "#db2777", // pink-600
  "#4f46e5", // indigo-600
  "#059669", // emerald-600
  "#6b7280", // gray-500 (for "Other")
];

interface PieSlice {
  name: string;
  fullName: string;
  value: number;
}

export function ProjectReport() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [summary, setSummary] = useState<ProjectSummary[]>([]);
  const [details, setDetails] = useState<ProjectDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<"revenue" | "total_hours" | "task_description">("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSearch = async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (projectFilter) params.set("project", projectFilter);

      const res = await fetch(`/api/reports/projects?${params}`);
      const data = await res.json();
      setSummary(data.summary);
      setDetails(data.details);
    } catch (err) {
      console.error("Failed to load report:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleProject = (taskNumber: string) => {
    const next = new Set(expandedProjects);
    if (next.has(taskNumber)) {
      next.delete(taskNumber);
    } else {
      next.add(taskNumber);
    }
    setExpandedProjects(next);
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

  const totalRevenue = summary.reduce((sum, p) => sum + p.revenue, 0);
  const totalHours = summary.reduce((sum, p) => sum + p.total_hours, 0);

  // Compute pie chart data: top 10 + Other
  const pieData = useMemo<PieSlice[]>(() => {
    if (summary.length === 0) return [];
    // summary is already sorted by revenue DESC from the API
    const top10 = summary.slice(0, 10).map((p) => ({
      name: p.task_description.length > 25 ? p.task_description.substring(0, 22) + "..." : p.task_description,
      fullName: p.task_description,
      value: p.revenue,
    }));
    if (summary.length > 10) {
      const otherRevenue = summary.slice(10).reduce((sum, p) => sum + p.revenue, 0);
      if (otherRevenue > 0) {
        top10.push({
          name: "Other",
          fullName: `Other (${summary.length - 10} projects)`,
          value: otherRevenue,
        });
      }
    }
    return top10;
  }, [summary]);

  const handleExportCSV = () => {
    const rows = [["Project Code", "Project Name", "Person", "Hours", "Revenue"]];
    for (const d of details) {
      rows.push([d.task_number, d.task_description, d.user_name, String(d.total_hours), String(d.revenue.toFixed(2))]);
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-report-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Revenue Report</CardTitle>
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
            <label className="text-xs font-medium text-muted-foreground">Filter by Project</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Project name or code..."
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
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
                  <span className="text-muted-foreground">Total Revenue: </span>
                  <span className="font-bold">{formatCurrency(totalRevenue)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Total Hours: </span>
                  <span className="font-bold">{totalHours.toFixed(1)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Projects: </span>
                  <span className="font-bold">{summary.length}</span>
                </div>
              </div>
            )}

            {/* 3D Pie Chart - Revenue by Project */}
            {pieData.length > 0 && (
              <Card className="border">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Revenue by Project</CardTitle>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">Total Revenue</span>
                      <p className="text-lg font-bold text-primary">{formatCurrency(totalRevenue)}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
                    {/* Pie chart - left side */}
                    <div className="flex-shrink-0" style={{ perspective: "800px" }}>
                      <div
                        style={{
                          transform: "rotateX(30deg)",
                          transformOrigin: "center center",
                          position: "relative",
                        }}
                      >
                        {/* 3D depth shadow */}
                        <div
                          style={{
                            position: "absolute",
                            bottom: -8,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: "70%",
                            height: 20,
                            background: "radial-gradient(ellipse at center, rgba(0,0,0,0.18) 0%, transparent 70%)",
                            borderRadius: "50%",
                            zIndex: 0,
                          }}
                        />
                        <PieChart width={360} height={360}>
                          <Pie
                            data={pieData}
                            cx={180}
                            cy={180}
                            outerRadius={150}
                            innerRadius={0}
                            dataKey="value"
                            strokeWidth={2}
                            stroke="#fff"
                          >
                            {pieData.map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                                style={{
                                  filter: "drop-shadow(0px 4px 4px rgba(0,0,0,0.25))",
                                }}
                              />
                            ))}
                          </Pie>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          <RechartsTooltip
                            content={({ active, payload }: any) => {
                              if (!active || !payload || payload.length === 0) return null;
                              const data = payload[0].payload as PieSlice;
                              const pct = totalRevenue > 0 ? ((data.value / totalRevenue) * 100).toFixed(1) : "0";
                              return (
                                <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
                                  <p className="font-medium mb-1">{data.fullName}</p>
                                  <p className="text-muted-foreground">
                                    Revenue: <span className="font-semibold text-foreground">{formatCurrency(data.value)}</span>
                                  </p>
                                  <p className="text-muted-foreground">
                                    Share: <span className="font-semibold text-foreground">{pct}%</span>
                                  </p>
                                </div>
                              );
                            }}
                          />
                        </PieChart>
                      </div>
                    </div>

                    {/* Legend table - right side */}
                    <div className="flex-1 min-w-0">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground text-xs">Project</th>
                            <th className="text-right py-1.5 px-3 font-medium text-muted-foreground text-xs">Revenue</th>
                            <th className="text-right py-1.5 pl-3 font-medium text-muted-foreground text-xs">Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pieData.map((slice, index) => {
                            const pct = totalRevenue > 0 ? ((slice.value / totalRevenue) * 100).toFixed(1) : "0";
                            return (
                              <tr key={index} className="border-b border-muted/50 hover:bg-muted/30">
                                <td className="py-1.5 pr-3">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-sm flex-shrink-0"
                                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                    />
                                    <span className="truncate" title={slice.fullName}>
                                      {slice.fullName}
                                    </span>
                                  </div>
                                </td>
                                <td className="text-right py-1.5 px-3 tabular-nums font-medium whitespace-nowrap">
                                  {formatCurrency(slice.value)}
                                </td>
                                <td className="text-right py-1.5 pl-3 tabular-nums text-muted-foreground whitespace-nowrap">
                                  {pct}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2">
                            <td className="py-2 pr-3 font-bold">Total</td>
                            <td className="text-right py-2 px-3 tabular-nums font-bold whitespace-nowrap">
                              {formatCurrency(totalRevenue)}
                            </td>
                            <td className="text-right py-2 pl-3 tabular-nums font-bold">100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Project Code</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort("task_description")}>
                        Project Name
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">People</TableHead>
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
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No project data found for the selected date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedSummary.map((project) => {
                      const isExpanded = expandedProjects.has(project.task_number);
                      const projectDetails = details.filter(
                        (d) => d.task_number === project.task_number
                      );

                      return (
                        <>
                          <TableRow
                            key={project.task_number}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleProject(project.task_number)}
                          >
                            <TableCell>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{project.task_number}</TableCell>
                            <TableCell className="font-medium">{project.task_description}</TableCell>
                            <TableCell className="text-right">{project.people_count}</TableCell>
                            <TableCell className="text-right tabular-nums">{project.total_hours.toFixed(1)}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">{formatCurrency(project.revenue)}</TableCell>
                          </TableRow>
                          {isExpanded &&
                            projectDetails.map((detail, idx) => (
                              <TableRow key={`${project.task_number}-${idx}`} className="bg-muted/30">
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell className="pl-8 text-sm">{detail.user_name}</TableCell>
                                <TableCell></TableCell>
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
