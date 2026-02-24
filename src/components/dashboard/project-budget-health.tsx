"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet } from "lucide-react";

interface ProjectBudget {
  id: number;
  taskNumber: string;
  projectName: string;
  budget: number;
  billed: number;
  remaining: number;
  usedPct: number;
  status: "healthy" | "warning" | "critical" | "over";
}

interface ProjectBudgetHealthProps {
  data: ProjectBudget[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function StatusBadge({ status, usedPct }: { status: string; usedPct: number }) {
  const config: Record<string, { label: string; className: string }> = {
    over: {
      label: `Over (${usedPct.toFixed(1)}%)`,
      className:
        "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    },
    critical: {
      label: `Critical (${usedPct.toFixed(1)}%)`,
      className:
        "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    },
    warning: {
      label: `Warning (${usedPct.toFixed(1)}%)`,
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    },
    healthy: {
      label: `Healthy (${usedPct.toFixed(1)}%)`,
      className:
        "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    },
  };
  const c = config[status] || config.healthy;
  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded ${c.className}`}
    >
      {c.label}
    </span>
  );
}

function BudgetBar({ usedPct }: { usedPct: number }) {
  const clamped = Math.min(usedPct, 100);
  const overPct = usedPct > 100 ? Math.min(usedPct - 100, 100) : 0;
  let barColor: string;
  if (usedPct > 100) barColor = "bg-red-500";
  else if (usedPct >= 90) barColor = "bg-orange-500";
  else if (usedPct >= 75) barColor = "bg-amber-500";
  else barColor = "bg-green-500";

  return (
    <div className="w-full">
      <div className="h-2 bg-muted rounded-full overflow-hidden relative">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${clamped}%` }}
        />
        {overPct > 0 && (
          <div
            className="absolute top-0 h-full bg-red-500 rounded-full opacity-50 animate-pulse"
            style={{ width: `${Math.min(overPct, 100)}%`, left: "0%" }}
          />
        )}
      </div>
    </div>
  );
}

type SortField = "projectName" | "budget" | "billed" | "remaining" | "usedPct";
type SortDir = "asc" | "desc";

export function ProjectBudgetHealth({ data }: ProjectBudgetHealthProps) {
  const [sortField, setSortField] = useState<SortField>("usedPct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "projectName" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortField === "projectName") {
        cmp = a.projectName.localeCompare(b.projectName);
      } else {
        cmp = a[sortField] - b[sortField];
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, sortField, sortDir]);

  const overCount = data.filter((p) => p.status === "over").length;
  const criticalCount = data.filter((p) => p.status === "critical").length;
  const warningCount = data.filter((p) => p.status === "warning").length;
  const healthyCount = data.filter((p) => p.status === "healthy").length;

  const totalBudget = data.reduce((sum, p) => sum + p.budget, 0);
  const totalBilled = data.reduce((sum, p) => sum + p.billed, 0);
  const totalRemaining = data.reduce((sum, p) => sum + p.remaining, 0);

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  };

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-blue-500" />
          Project Budget Health
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Budget utilization for {data.length} projects with defined budgets.
          Total budget: {formatCurrency(totalBudget)} | Billed:{" "}
          {formatCurrency(totalBilled)} | Remaining:{" "}
          {formatCurrency(totalRemaining)}
        </p>
        <div className="flex items-center gap-3 pt-1 flex-wrap">
          {overCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              <span className="text-muted-foreground">
                {overCount} over budget
              </span>
            </div>
          )}
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">
                {criticalCount} critical (&ge;90%)
              </span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">
                {warningCount} warning (&ge;75%)
              </span>
            </div>
          )}
          {healthyCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">
                {healthyCount} healthy
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:text-foreground select-none"
                  onClick={() => toggleSort("projectName")}
                >
                  Project{sortIndicator("projectName")}
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:text-foreground select-none"
                  onClick={() => toggleSort("budget")}
                >
                  Budget{sortIndicator("budget")}
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:text-foreground select-none"
                  onClick={() => toggleSort("billed")}
                >
                  Billed{sortIndicator("billed")}
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:text-foreground select-none"
                  onClick={() => toggleSort("remaining")}
                >
                  Remaining{sortIndicator("remaining")}
                </TableHead>
                <TableHead className="w-[120px]">Usage</TableHead>
                <TableHead
                  className="text-center cursor-pointer hover:text-foreground select-none"
                  onClick={() => toggleSort("usedPct")}
                >
                  Status{sortIndicator("usedPct")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium text-sm max-w-[250px] truncate" title={project.projectName}>
                    {project.projectName}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-right">
                    {formatCurrency(project.budget)}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-right">
                    {formatCurrency(project.billed)}
                  </TableCell>
                  <TableCell
                    className={`text-sm tabular-nums text-right ${
                      project.remaining < 0
                        ? "text-red-600 dark:text-red-400 font-semibold"
                        : ""
                    }`}
                  >
                    {formatCurrency(project.remaining)}
                  </TableCell>
                  <TableCell className="w-[120px]">
                    <BudgetBar usedPct={project.usedPct} />
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge
                      status={project.status}
                      usedPct={project.usedPct}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
