"use client";

import { PlannedWorkTable } from "@/components/planned-work/planned-work-table";

export default function PlannedWorkPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Planned Work</h1>
        <p className="text-muted-foreground mt-1">
          Manage planned future work assignments
        </p>
      </div>
      <PlannedWorkTable />
    </div>
  );
}
