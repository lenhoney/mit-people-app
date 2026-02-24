"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ClipboardCheck, AlertTriangle, Wallet } from "lucide-react";

interface RevenueCardProps {
  revenueFYTD: number;
  fyLabel: string;
  healthyProjects: number;
  unhealthyProjects: number;
  timesheetHealthPct: number;
  benchRiskCount: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function RevenueCards({
  revenueFYTD,
  fyLabel,
  healthyProjects,
  unhealthyProjects,
  timesheetHealthPct,
  benchRiskCount,
}: RevenueCardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Revenue FYTD
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(revenueFYTD)}
          </div>
          <p className="text-xs text-muted-foreground">
            {fyLabel} (1 Mar &ndash; today)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Project Health
          </CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-green-500">{healthyProjects}</span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className={`text-2xl font-bold ${unhealthyProjects > 0 ? "text-red-500" : "text-muted-foreground"}`}>{unhealthyProjects}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="text-green-500">healthy</span> / <span className={unhealthyProjects > 0 ? "text-red-500" : ""}>over budget</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Timesheet Health
          </CardTitle>
          <ClipboardCheck className={`h-4 w-4 ${
            timesheetHealthPct >= 80 ? "text-green-500" :
            timesheetHealthPct >= 50 ? "text-amber-500" : "text-red-500"
          }`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            timesheetHealthPct >= 80 ? "text-green-500" :
            timesheetHealthPct >= 50 ? "text-amber-500" : "text-red-500"
          }`}>
            {timesheetHealthPct}%
          </div>
          <p className="text-xs text-muted-foreground">
            Avg. completion this month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Bench Risk Summary
          </CardTitle>
          <AlertTriangle className={`h-4 w-4 ${benchRiskCount > 0 ? "text-red-500" : "text-green-500"}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${benchRiskCount > 0 ? "text-red-500" : "text-green-500"}`}>
            {benchRiskCount}
          </div>
          <p className="text-xs text-muted-foreground">
            {benchRiskCount === 0
              ? "No people at risk of being on the bench"
              : `${benchRiskCount === 1 ? "person" : "people"} at risk of being on the bench`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
