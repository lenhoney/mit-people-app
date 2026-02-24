"use client";

import { useState } from "react";
import { GanttChart, type GanttViewMode } from "@/components/gantt/gantt-chart";
import { Button } from "@/components/ui/button";
import { Users, FolderKanban } from "lucide-react";

export default function GanttPage() {
  const [viewMode, setViewMode] = useState<GanttViewMode>("project");

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gantt Chart</h1>
          <p className="text-muted-foreground mt-1">
            Visualize project timelines and plan future work
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
        </div>
      </div>
      <GanttChart viewMode={viewMode} />
    </div>
  );
}
