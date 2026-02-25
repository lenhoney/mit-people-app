"use client";

import { useEffect, useState } from "react";
import { RevenueCards } from "@/components/dashboard/revenue-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { MissingTimesheets } from "@/components/dashboard/missing-timesheets";
import { BenchRisk } from "@/components/dashboard/bench-risk";
import { UpcomingPTO } from "@/components/dashboard/upcoming-pto";
import { ProjectBudgetHealth } from "@/components/dashboard/project-budget-health";
import { BirthdayReminder } from "@/components/dashboard/birthday-reminder";
import { WorkAnniversary } from "@/components/dashboard/work-anniversary";

interface DashboardData {
  currentMonthRevenue: number;
  currentPlannedRevenue: number;
  currentMonth: string;
  revenueFYTD: number;
  fyLabel: string;
  monthlyRevenue: { month: string; revenue: number; plannedRevenue: number }[];
  monthlyPTORevenueLoss: { month: string; lostRevenue: number }[];
  missingTimesheets: {
    person: string;
    role: string | null;
    sow: string | null;
    photo: string | null;
  }[];
  benchRisk: {
    person: string;
    person_id: number;
    photo: string | null;
    role: string | null;
    sow: string | null;
    total_allocation: number;
    latest_planned_end: string | null;
    planned_to: string | null;
  }[];
  benchRiskHorizon: string;
  totalPeople: number;
  timesheetHealthPct: number;
  upcomingPTO: {
    id: number;
    person_name: string;
    kerb: string | null;
    start_date: string;
    end_date: string;
    type: string;
    business_days: number;
    billable_days: number | null;
    matched_person: string | null;
    photo: string | null;
  }[];
  projectBudgetHealth: {
    id: number;
    taskNumber: string;
    projectName: string;
    budget: number;
    billed: number;
    remaining: number;
    usedPct: number;
    status: "healthy" | "warning" | "critical" | "over";
  }[];
  birthdays: {
    id: number;
    person: string;
    photo: string | null;
    birthday: string;
    when: "today" | "tomorrow" | "this_month";
  }[];
  workAnniversaries: {
    id: number;
    person: string;
    photo: string | null;
    years: number;
  }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load dashboard:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          No data available. Upload People Rates and Timesheets to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of consultant activity
        </p>
      </div>

      <RevenueCards
        revenueFYTD={data.revenueFYTD}
        fyLabel={data.fyLabel}
        healthyProjects={data.projectBudgetHealth.filter((p) => p.billed <= p.budget).length}
        unhealthyProjects={data.projectBudgetHealth.filter((p) => p.billed > p.budget).length}
        timesheetHealthPct={data.timesheetHealthPct ?? 0}
        benchRiskCount={data.benchRisk.length}
      />

      {((data.birthdays && data.birthdays.length > 0) || (data.workAnniversaries && data.workAnniversaries.length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.birthdays && data.birthdays.length > 0 && (
            <BirthdayReminder data={data.birthdays} />
          )}
          {data.workAnniversaries && data.workAnniversaries.length > 0 && (
            <WorkAnniversary data={data.workAnniversaries} />
          )}
        </div>
      )}

      <RevenueChart
        data={data.monthlyRevenue}
        currentMonth={data.currentMonth}
        ptoLossData={data.monthlyPTORevenueLoss}
      />

      <ProjectBudgetHealth data={data.projectBudgetHealth} />

      <BenchRisk
        data={data.benchRisk}
        horizon={data.benchRiskHorizon}
        totalPeople={data.totalPeople}
      />

      <UpcomingPTO data={data.upcomingPTO} />

      <MissingTimesheets
        data={data.missingTimesheets}
        currentMonth={data.currentMonth}
      />
    </div>
  );
}
