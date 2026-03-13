"use client";

import { useState } from "react";
import { GanttChart, type GanttViewMode } from "@/components/gantt/gantt-chart";
import { TimeOffGanttChart } from "@/components/gantt/time-off-gantt-chart";
import { Button } from "@/components/ui/button";
import { Users, FolderKanban, Palmtree } from "lucide-react";
import { usePermissions } from "@/components/layout/permissions-provider";

type PageViewMode = GanttViewMode | "time-off";

export default function GanttPage() {
  const [viewMode, setViewMode] = useState<PageViewMode>("project");
  const { canCreate, canUpdate } = usePermissions();

  // User needs create or update permission on planned-work to drag/resize bars
  const readOnly = !canCreate("planned-work") && !canUpdate("planned-work");

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gantt Chart</h1>
          <p className="text-muted-foreground mt-1">
            Visualize project timelines{!readOnly && " and plan future work"}
          </p>
        </div>
        <div className="flex rounded-lg border bg-muted p-1 gap-1">
          <Button
            variant={viewMode === "project" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("project")}
            className="gap-1.5"
          >
            <FolderKanban className="h-4 w-4" />
            Project Gantt
          </Button>
          <Button
            variant={viewMode === "people" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("people")}
            className="gap-1.5"
          >
            <Users className="h-4 w-4" />
            People Gantt
          </Button>
          <Button
            variant={viewMode === "time-off" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("time-off")}
            className="gap-1.5"
          >
            <Palmtree className="h-4 w-4" />
            Time Off
          </Button>
        </div>
      </div>
      {viewMode === "time-off" ? (
        <TimeOffGanttChart />
      ) : (
        <GanttChart viewMode={viewMode as GanttViewMode} readOnly={readOnly} />
      )}
    </div>
  );
}
