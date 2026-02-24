"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, ArrowUpDown, Search } from "lucide-react";
import { ProjectData } from "./project-dialog";

interface ProjectsTableProps {
  projects: ProjectData[];
  onEdit: (project: ProjectData) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
}

type SortField = "task_number" | "task_description" | "group_label" | "budget" | "project_lead" | "status";
type SortDir = "asc" | "desc";

export function ProjectsTable({
  projects,
  onEdit,
  onDelete,
  onStatusChange,
}: ProjectsTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("task_description");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let result = projects;

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.task_number.toLowerCase().includes(lower) ||
          (p.task_description || "").toLowerCase().includes(lower) ||
          (p.group_label || "").toLowerCase().includes(lower) ||
          (p.project_lead || "").toLowerCase().includes(lower)
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "task_number":
          cmp = a.task_number.localeCompare(b.task_number);
          break;
        case "task_description":
          cmp = (a.task_description || "").localeCompare(
            b.task_description || ""
          );
          break;
        case "group_label":
          cmp = (a.group_label || "zzz").localeCompare(
            b.group_label || "zzz"
          );
          break;
        case "budget":
          cmp = (a.budget || 0) - (b.budget || 0);
          break;
        case "project_lead":
          cmp = (a.project_lead || "zzz").localeCompare(b.project_lead || "zzz");
          break;
        case "status":
          cmp = (a.status || "Started").localeCompare(b.status || "Started");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [projects, search, sortField, sortDir]);

  // Group by group_label for visual grouping
  const groups = useMemo(() => {
    const map = new Map<string, ProjectData[]>();
    const ungrouped: ProjectData[] = [];

    for (const p of filtered) {
      if (p.group_label) {
        if (!map.has(p.group_label)) map.set(p.group_label, []);
        map.get(p.group_label)!.push(p);
      } else {
        ungrouped.push(p);
      }
    }

    const sortedGroups = Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    return { sortedGroups, ungrouped };
  }, [filtered]);

  const SortHeader = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <TableHead>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => handleSort(field)}
      >
        {children}
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    </TableHead>
  );

  const formatBudget = (budget: number | null) => {
    if (budget == null) return "—";
    return `$${budget.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const renderProjectRow = (project: ProjectData) => {
    const isCompleted = (project.status || "Started") === "Completed";
    return (
      <TableRow key={project.id} className={isCompleted ? "opacity-60" : ""}>
        <TableCell className="font-mono text-xs">
          {project.task_number}
        </TableCell>
        <TableCell className="text-sm">{project.task_description || "—"}</TableCell>
        <TableCell>
          {project.group_label ? (
            <Badge variant="secondary" className="text-xs">
              {project.group_label}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-sm tabular-nums text-right">
          {formatBudget(project.budget)}
        </TableCell>
        <TableCell className="text-sm">
          {project.project_lead || <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-center">
          <button
            onClick={() => {
              if (project.id) {
                onStatusChange(project.id, isCompleted ? "Started" : "Completed");
              }
            }}
            className="inline-flex items-center"
            title={`Click to set as ${isCompleted ? "Started" : "Completed"}`}
          >
            {isCompleted ? (
              <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                Completed
              </span>
            ) : (
              <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                Started
              </span>
            )}
          </button>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(project)}
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => project.id && onDelete(project.id)}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length} of {projects.length} projects
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          {projects.length === 0
            ? "No projects yet. Click \"Add Project\" to create one."
            : "No matching projects found."}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader field="task_number">Code</SortHeader>
                <SortHeader field="task_description">Name</SortHeader>
                <SortHeader field="group_label">Group</SortHeader>
                <SortHeader field="budget">Budget</SortHeader>
                <SortHeader field="project_lead">Project Lead</SortHeader>
                <SortHeader field="status">Status</SortHeader>
                <TableHead className="text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Grouped projects */}
              {groups.sortedGroups.map(([groupLabel, groupProjects]) => (
                <>{/* Group header */}
                  <TableRow key={`gh-${groupLabel}`} className="bg-muted/30">
                    <TableCell
                      colSpan={7}
                      className="font-medium text-sm py-2"
                    >
                      {groupLabel}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({groupProjects.length} projects)
                      </span>
                    </TableCell>
                  </TableRow>
                  {groupProjects.map(renderProjectRow)}
                </>
              ))}
              {/* Ungrouped projects */}
              {groups.ungrouped.length > 0 && groups.sortedGroups.length > 0 && (
                <TableRow className="bg-muted/30">
                  <TableCell
                    colSpan={7}
                    className="font-medium text-sm py-2 text-muted-foreground"
                  >
                    Ungrouped{" "}
                    <span className="font-normal">
                      ({groups.ungrouped.length} projects)
                    </span>
                  </TableCell>
                </TableRow>
              )}
              {groups.ungrouped.map(renderProjectRow)}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
