"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileDown, ClipboardList } from "lucide-react";

interface TimesheetRow {
  id: number;
  person: string;
  photo: string | null;
  total_hours: number;
}

function PersonAvatar({ name, photo }: { name: string; photo: string | null }) {
  if (photo) {
    return (
      <img
        src={`/api/photos/${photo}`}
        alt=""
        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
      <span className="text-[9px] font-semibold text-muted-foreground">
        {name.split(" ").map(n => n[0]).join("").slice(0, 2)}
      </span>
    </div>
  );
}

function getStatusInfo(totalHours: number, expectedHours: number) {
  if (expectedHours === 0) return { label: "N/A", color: "bg-gray-100 text-gray-600", barColor: "bg-gray-400" };
  const pct = (totalHours / expectedHours) * 100;
  if (pct >= 100) return { label: "Complete", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", barColor: "bg-green-500" };
  if (pct >= 75) return { label: "Partial", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300", barColor: "bg-amber-500" };
  if (totalHours === 0) return { label: "Missing", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", barColor: "bg-red-500" };
  return { label: "Low", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", barColor: "bg-orange-500" };
}

export function MissingTimesheetsReport() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [expectedHours, setExpectedHours] = useState(0);
  const [expectedBusinessDays, setExpectedBusinessDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortField, setSortField] = useState<"total_hours" | "person">("total_hours");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSearch = async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (personFilter) params.set("person", personFilter);

      const res = await fetch(`/api/reports/missing-timesheets?${params}`);
      const data = await res.json();
      setRows(data.rows);
      setExpectedHours(data.expectedHours);
      setExpectedBusinessDays(data.expectedBusinessDays);
    } catch (err) {
      console.error("Failed to load report:", err);
    } finally {
      setLoading(false);
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    if (sortField === "total_hours") {
      const cmp = a.total_hours - b.total_hours;
      return sortDir === "desc" ? -cmp : cmp;
    }
    const cmp = a.person.localeCompare(b.person);
    return sortDir === "desc" ? -cmp : cmp;
  });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "total_hours" ? "asc" : "asc");
    }
  };

  const missingCount = rows.filter(r => r.total_hours === 0).length;
  const partialCount = rows.filter(r => r.total_hours > 0 && r.total_hours < expectedHours).length;
  const completeCount = rows.filter(r => r.total_hours >= expectedHours).length;
  const totalHoursLogged = rows.reduce((sum, r) => sum + r.total_hours, 0);

  // Filter out complete people from display (they don't need attention)
  const displayRows = sortedRows.filter(r => expectedHours === 0 || r.total_hours < expectedHours);

  const handleExportPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const formatDate = (d: string) => {
      const date = new Date(d + "T00:00:00");
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    // Build compact grid items (exclude complete people)
    const pdfRows = sortedRows.filter(r => expectedHours === 0 || r.total_hours < expectedHours);
    const gridItems = pdfRows.map((row) => {
      const status = getStatusInfo(row.total_hours, expectedHours);
      const pct = expectedHours > 0 ? Math.round((row.total_hours / expectedHours) * 100) : 0;
      const initials = row.person.split(" ").map(n => n[0]).join("").slice(0, 2);
      const barColor = status.label === "Complete" ? "#22c55e" :
                       status.label === "Partial" ? "#f59e0b" :
                       status.label === "Low" ? "#f97316" : "#ef4444";
      const statusBg = status.label === "Complete" ? "#dcfce7" :
                       status.label === "Partial" ? "#fef3c7" :
                       status.label === "Low" ? "#ffedd5" :
                       status.label === "Missing" ? "#fee2e2" : "#f3f4f6";
      const statusText = status.label === "Complete" ? "#166534" :
                         status.label === "Partial" ? "#92400e" :
                         status.label === "Low" ? "#9a3412" :
                         status.label === "Missing" ? "#b91c1c" : "#4b5563";
      const photoHtml = row.photo
        ? `<img src="/api/photos/${row.photo}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;" />`
        : `<div style="width:24px;height:24px;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:600;color:#6b7280;">${initials}</div>`;

      return `
        <div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-bottom:1px solid #f3f4f6;">
          ${photoHtml}
          <span style="font-weight:500;font-size:11px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${row.person}</span>
          <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
            <div style="background:#e5e7eb;border-radius:3px;height:4px;width:50px;">
              <div style="background:${barColor};height:4px;border-radius:3px;width:${Math.min(pct, 100) * 0.5}px;"></div>
            </div>
            <span style="font-size:10px;font-variant-numeric:tabular-nums;color:#374151;min-width:32px;text-align:right;">${row.total_hours.toFixed(0)}h</span>
            <span style="background:${statusBg};color:${statusText};padding:1px 5px;border-radius:8px;font-size:9px;font-weight:500;min-width:46px;text-align:center;">${status.label}</span>
          </div>
        </div>
      `;
    }).join("");

    // Split into columns for PDF
    const perCol = Math.ceil(pdfRows.length / 2);
    const col1Items = pdfRows.slice(0, perCol);
    const col2Items = pdfRows.slice(perCol);

    const buildColHtml = (items: TimesheetRow[]) => items.map((row) => {
      const status = getStatusInfo(row.total_hours, expectedHours);
      const pct = expectedHours > 0 ? Math.round((row.total_hours / expectedHours) * 100) : 0;
      const initials = row.person.split(" ").map(n => n[0]).join("").slice(0, 2);
      const barColor = status.label === "Complete" ? "#22c55e" : status.label === "Partial" ? "#f59e0b" : status.label === "Low" ? "#f97316" : "#ef4444";
      const statusBg = status.label === "Complete" ? "#dcfce7" : status.label === "Partial" ? "#fef3c7" : status.label === "Low" ? "#ffedd5" : status.label === "Missing" ? "#fee2e2" : "#f3f4f6";
      const statusText = status.label === "Complete" ? "#166534" : status.label === "Partial" ? "#92400e" : status.label === "Low" ? "#9a3412" : status.label === "Missing" ? "#b91c1c" : "#4b5563";
      const photoHtml = row.photo
        ? `<img src="/api/photos/${row.photo}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;" />`
        : `<div style="width:22px;height:22px;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:600;color:#6b7280;">${initials}</div>`;
      return `
        <div style="display:flex;align-items:center;gap:5px;padding:3px 4px;border-bottom:1px solid #f3f4f6;">
          ${photoHtml}
          <span style="font-weight:500;font-size:10px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${row.person}</span>
          <span style="font-size:9px;font-variant-numeric:tabular-nums;color:#374151;min-width:28px;text-align:right;">${row.total_hours.toFixed(0)}h</span>
          <span style="background:${statusBg};color:${statusText};padding:1px 4px;border-radius:6px;font-size:8px;font-weight:500;min-width:40px;text-align:center;">${status.label}</span>
        </div>`;
    }).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Missing Timesheets Report</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 30px; color: #1f2937; }
          h1 { font-size: 18px; margin-bottom: 3px; }
          .subtitle { color: #6b7280; font-size: 11px; margin-bottom: 12px; }
          .stats { display: flex; gap: 16px; margin-bottom: 14px; padding: 8px 0; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
          .stat-item { font-size: 11px; }
          .stat-label { color: #6b7280; }
          .stat-value { font-weight: 700; }
          .columns { display: flex; gap: 16px; }
          .column { flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
          .col-header { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; padding: 4px 6px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
          .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
          @media print {
            body { padding: 15px; }
            @page { margin: 10mm; size: landscape; }
          }
        </style>
      </head>
      <body>
        <h1>Missing Timesheets Report</h1>
        <div class="subtitle">${formatDate(startDate)} &mdash; ${formatDate(endDate)} &bull; ${expectedBusinessDays} business days &bull; ${expectedHours} expected hours</div>
        <div class="stats">
          <div class="stat-item"><span class="stat-label">People: </span><span class="stat-value">${rows.length}</span></div>
          <div class="stat-item"><span class="stat-label">Missing: </span><span class="stat-value" style="color:#b91c1c;">${missingCount}</span></div>
          <div class="stat-item"><span class="stat-label">Partial: </span><span class="stat-value" style="color:#92400e;">${partialCount}</span></div>
          <div class="stat-item"><span class="stat-label">Complete: </span><span class="stat-value" style="color:#166534;">${completeCount}</span></div>
          <div class="stat-item"><span class="stat-label">Total Logged: </span><span class="stat-value">${totalHoursLogged.toFixed(1)} hrs</span></div>
        </div>
        <div class="columns">
          <div class="column">
            <div class="col-header">Person / Hours / Status</div>
            ${buildColHtml(col1Items)}
          </div>
          <div class="column">
            <div class="col-header">Person / Hours / Status</div>
            ${buildColHtml(col2Items)}
          </div>
        </div>
        <div class="footer">Generated on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} &bull; Populus</div>
      </body>
      </html>
    `);

    printWindow.document.close();

    const images = printWindow.document.querySelectorAll("img");
    let loaded = 0;
    const totalImages = images.length;

    const triggerPrint = () => {
      setTimeout(() => { printWindow.print(); }, 300);
    };

    if (totalImages === 0) {
      triggerPrint();
    } else {
      images.forEach((img) => {
        img.onload = img.onerror = () => {
          loaded++;
          if (loaded >= totalImages) triggerPrint();
        };
      });
      setTimeout(triggerPrint, 2000);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Missing Timesheets Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
          {rows.length > 0 && (
            <Button variant="outline" onClick={handleExportPDF} className="h-9">
              <FileDown className="h-3.5 w-3.5 mr-1" />
              Export PDF
            </Button>
          )}
        </div>

        {hasSearched && !loading && (
          <>
            {rows.length > 0 && (
              <div className="flex flex-wrap gap-4 py-2 text-sm border-b">
                <div>
                  <span className="text-muted-foreground">People: </span>
                  <span className="font-bold">{rows.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Expected: </span>
                  <span className="font-bold">{expectedHours}h</span>
                  <span className="text-muted-foreground text-xs ml-1">({expectedBusinessDays}d)</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Missing: </span>
                  <span className="font-bold text-red-600">{missingCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Partial: </span>
                  <span className="font-bold text-amber-600">{partialCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Complete: </span>
                  <span className="font-bold text-green-600">{completeCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Logged: </span>
                  <span className="font-bold">{totalHoursLogged.toFixed(1)}h</span>
                </div>
              </div>
            )}

            {/* Sort controls */}
            {rows.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Sort by:</span>
                <Button
                  variant={sortField === "person" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => handleSort("person")}
                >
                  Name {sortField === "person" && (sortDir === "asc" ? "↑" : "↓")}
                </Button>
                <Button
                  variant={sortField === "total_hours" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => handleSort("total_hours")}
                >
                  Hours {sortField === "total_hours" && (sortDir === "asc" ? "↑" : "↓")}
                </Button>
              </div>
            )}

            {/* Compact multi-column grid — excludes complete people */}
            {displayRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {rows.length > 0 ? "All people have complete timesheets!" : "No active people found."}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-0 border rounded-md">
                {displayRows.map((row) => {
                  const status = getStatusInfo(row.total_hours, expectedHours);
                  const pct = expectedHours > 0 ? Math.min(Math.round((row.total_hours / expectedHours) * 100), 100) : 0;
                  return (
                    <div
                      key={row.id}
                      className="flex items-center gap-2 py-1.5 px-2.5 border-b last:border-b-0"
                    >
                      <PersonAvatar name={row.person} photo={row.photo} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{row.person}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-[60px] h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${status.barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] tabular-nums font-medium w-[36px] text-right">
                          {row.total_hours.toFixed(0)}h
                        </span>
                        <Badge className={`${status.color} hover:${status.color} text-[10px] px-1.5 py-0 h-4 leading-4`}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
