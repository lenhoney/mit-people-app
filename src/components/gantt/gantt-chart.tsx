"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import {
  startOfWeek,
  addWeeks,
  differenceInWeeks,
  format,
  parseISO,
} from "date-fns";
import { useClient } from "@/components/layout/client-provider";

// ── Types ────────────────────────────────────────────────────────────────────

interface PlannedWork {
  id: number;
  planned_start: string;
  planned_end: string;
  allocation_pct: number;
}

// Project Gantt types
interface GanttPerson {
  user_name: string;
  person_id: number;
  photo: string | null;
  actual_start: string;
  actual_end: string;
  total_hours: number;
  planned_work: PlannedWork | null;
}

interface GanttProject {
  task_number: string;
  task_description: string;
  group_label: string | null;
  budget: number | null;
  earliest_week: string;
  latest_week: string;
  people: GanttPerson[];
}

// People Gantt types
interface PeopleGanttProject {
  task_number: string;
  task_description: string;
  actual_start: string;
  actual_end: string;
  total_hours: number;
  planned_work: PlannedWork | null;
}

interface PeopleGanttPerson {
  person_id: number;
  user_name: string;
  photo: string | null;
  earliest_week: string;
  latest_week: string;
  projects: PeopleGanttProject[];
}

interface TimelineConfig {
  startDate: Date;
  endDate: Date;
  totalWeeks: number;
  pixelsPerWeek: number;
  timelineWidth: number;
}

// Unified row types for both views
type ProjectViewRow =
  | { type: "group"; groupLabel: string; projectCount: number; earliest_week: string; latest_week: string }
  | { type: "project"; project: GanttProject }
  | { type: "person"; person: GanttPerson; project: GanttProject };

type PeopleViewRow =
  | { type: "person-parent"; personData: PeopleGanttPerson }
  | {
      type: "project-child";
      projectData: PeopleGanttProject;
      personData: PeopleGanttPerson;
    };

interface DragState {
  kind: "person" | "project";
  personId: number | null;
  taskNumber: string;
  taskDescription: string;
  actualEnd: string;
  actualEndX: number;
  startMouseX: number;
  originalEndX: number;
  currentEndX: number;
  allocationPct: number;
}

// ── Colors (matching dashboard CSS vars) ─────────────────────────────────
const ACTUAL_FILL = "var(--chart-1)";
const PLANNED_FILL = "var(--chart-4)";

// ── Constants ────────────────────────────────────────────────────────────────
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 48;
const LABEL_WIDTH = 320;
const DEFAULT_PX_PER_WEEK = 40;
const MIN_PX_PER_WEEK = 16;
const MAX_PX_PER_WEEK = 120;
const ZOOM_STEP = 8;
const FUTURE_PADDING_WEEKS = 12;

// ── Helpers ──────────────────────────────────────────────────────────────────

function dateToX(dateStr: string, tl: TimelineConfig): number {
  const d = parseISO(dateStr);
  const weeks = differenceInWeeks(d, tl.startDate);
  return weeks * tl.pixelsPerWeek;
}

function xToDate(x: number, tl: TimelineConfig): string {
  const weeks = Math.round(x / tl.pixelsPerWeek);
  const d = addWeeks(tl.startDate, weeks);
  return format(d, "yyyy-MM-dd");
}

function buildTimeline(
  dateRange: { start: string; end: string },
  pixelsPerWeek: number
): TimelineConfig {
  const s = startOfWeek(parseISO(dateRange.start), { weekStartsOn: 0 });
  const e = addWeeks(
    startOfWeek(parseISO(dateRange.end), { weekStartsOn: 0 }),
    FUTURE_PADDING_WEEKS
  );
  const totalWeeks = Math.max(differenceInWeeks(e, s), 1) + 1;
  return {
    startDate: s,
    endDate: e,
    totalWeeks,
    pixelsPerWeek,
    timelineWidth: totalWeeks * pixelsPerWeek,
  };
}

function projectActualEnd(project: GanttProject): string {
  let latest = "";
  for (const p of project.people) {
    if (p.actual_end && p.actual_end > latest) latest = p.actual_end;
  }
  return latest;
}

function personActualEnd(person: PeopleGanttPerson): string {
  let latest = "";
  for (const p of person.projects) {
    if (p.actual_end && p.actual_end > latest) latest = p.actual_end;
  }
  return latest;
}

function computeProjectRows(
  projects: GanttProject[],
  expanded: Set<string>,
  projectFilter: string,
  personFilter: string
): ProjectViewRow[] {
  const rows: ProjectViewRow[] = [];
  const pf = projectFilter.toLowerCase();
  const nf = personFilter.toLowerCase();

  // Filter projects first
  const filteredProjects: GanttProject[] = [];
  for (const project of projects) {
    if (
      pf &&
      !project.task_number.toLowerCase().includes(pf) &&
      !project.task_description.toLowerCase().includes(pf) &&
      !(project.group_label || "").toLowerCase().includes(pf)
    )
      continue;

    const filteredPeople = nf
      ? project.people.filter((p) => p.user_name.toLowerCase().includes(nf))
      : project.people;

    if (nf && filteredPeople.length === 0) continue;

    filteredProjects.push(project);
  }

  // Partition into grouped and ungrouped
  const groupMap = new Map<string, GanttProject[]>();
  const ungrouped: GanttProject[] = [];

  for (const project of filteredProjects) {
    if (project.group_label) {
      if (!groupMap.has(project.group_label))
        groupMap.set(project.group_label, []);
      groupMap.get(project.group_label)!.push(project);
    } else {
      ungrouped.push(project);
    }
  }

  // Grouped projects — sorted by group label
  const sortedGroups = Array.from(groupMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [groupLabel, groupProjects] of sortedGroups) {
    // Compute group date range
    let earliest = groupProjects[0].earliest_week;
    let latest = groupProjects[0].latest_week;
    for (const p of groupProjects) {
      if (p.earliest_week && (!earliest || p.earliest_week < earliest))
        earliest = p.earliest_week;
      if (p.latest_week && (!latest || p.latest_week > latest))
        latest = p.latest_week;
    }

    rows.push({
      type: "group",
      groupLabel,
      projectCount: groupProjects.length,
      earliest_week: earliest,
      latest_week: latest,
    });

    const groupKey = `group:${groupLabel}`;
    if (expanded.has(groupKey)) {
      for (const project of groupProjects) {
        rows.push({ type: "project", project });

        if (expanded.has(project.task_number)) {
          const people = nf
            ? project.people.filter((p) =>
                p.user_name.toLowerCase().includes(nf)
              )
            : project.people;
          for (const person of people) {
            rows.push({ type: "person", person, project });
          }
        }
      }
    }
  }

  // Ungrouped projects (standalone)
  for (const project of ungrouped) {
    rows.push({ type: "project", project });

    if (expanded.has(project.task_number)) {
      const people = nf
        ? project.people.filter((p) =>
            p.user_name.toLowerCase().includes(nf)
          )
        : project.people;
      for (const person of people) {
        rows.push({ type: "person", person, project });
      }
    }
  }

  return rows;
}

function computePeopleRows(
  people: PeopleGanttPerson[],
  expanded: Set<string>,
  projectFilter: string,
  personFilter: string
): PeopleViewRow[] {
  const rows: PeopleViewRow[] = [];
  const pf = projectFilter.toLowerCase();
  const nf = personFilter.toLowerCase();

  for (const person of people) {
    if (nf && !person.user_name.toLowerCase().includes(nf)) continue;

    const filteredProjects = pf
      ? person.projects.filter(
          (p) =>
            p.task_number.toLowerCase().includes(pf) ||
            p.task_description.toLowerCase().includes(pf)
        )
      : person.projects;

    if (pf && filteredProjects.length === 0) continue;

    rows.push({ type: "person-parent", personData: person });

    const key = String(person.person_id);
    if (expanded.has(key)) {
      for (const proj of filteredProjects) {
        rows.push({ type: "project-child", projectData: proj, personData: person });
      }
    }
  }
  return rows;
}

// ── Allocation helpers ───────────────────────────────────────────────────────

/**
 * Compute total allocation_pct across all planned work entries for each person.
 * Returns a Map of personId → total allocation percentage.
 */
function computePersonAllocations(
  projects: GanttProject[]
): Map<number, number> {
  const totals = new Map<number, number>();
  for (const proj of projects) {
    for (const person of proj.people) {
      if (person.planned_work) {
        totals.set(
          person.person_id,
          (totals.get(person.person_id) || 0) + person.planned_work.allocation_pct
        );
      }
    }
  }
  return totals;
}

function computePeopleAllocations(
  people: PeopleGanttPerson[]
): Map<number, number> {
  const totals = new Map<number, number>();
  for (const person of people) {
    let total = 0;
    for (const proj of person.projects) {
      if (proj.planned_work) {
        total += proj.planned_work.allocation_pct;
      }
    }
    if (total > 0) {
      totals.set(person.person_id, total);
    }
  }
  return totals;
}

/** Allocation badge: green = 100%, amber = under, red = over */
function AllocationBadge({ total }: { total: number | undefined }) {
  if (total === undefined || total === 0) return null;

  let color: string;
  let bgColor: string;
  if (total === 100) {
    color = "text-green-700 dark:text-green-400";
    bgColor = "bg-green-100 dark:bg-green-900/40";
  } else if (total < 100) {
    color = "text-amber-700 dark:text-amber-400";
    bgColor = "bg-amber-100 dark:bg-amber-900/40";
  } else {
    color = "text-red-700 dark:text-red-400";
    bgColor = "bg-red-100 dark:bg-red-900/40";
  }

  return (
    <span
      className={`ml-auto flex-shrink-0 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded ${color} ${bgColor}`}
      title={`Total planned allocation: ${total}%${
        total === 100
          ? " (perfect)"
          : total < 100
            ? " (under-allocated)"
            : " (over-allocated)"
      }`}
    >
      {total}%
    </span>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export type GanttViewMode = "project" | "people";

export function GanttChart({ viewMode }: { viewMode: GanttViewMode }) {
  // Project view state
  const [projects, setProjects] = useState<GanttProject[]>([]);
  // People view state
  const [people, setPeople] = useState<PeopleGanttPerson[]>([]);

  const [dateRange, setDateRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const { selectedClientId } = useClient();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [projectFilter, setProjectFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [pxPerWeek, setPxPerWeek] = useState(DEFAULT_PX_PER_WEEK);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const labelScrollRef = useRef<HTMLDivElement>(null);
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const headerCanvasRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const projectsRef = useRef<GanttProject[]>([]);
  const peopleRef = useRef<PeopleGanttPerson[]>([]);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  // ── Data fetching ────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === "project") {
        const params = new URLSearchParams();
        if (selectedClientId) params.set("clientId", String(selectedClientId));
        const res = await fetch(`/api/gantt?${params}`);
        const data = await res.json();
        setProjects(data.projects || []);
        setDateRange(data.dateRange || null);
      } else {
        const params = new URLSearchParams({ view: "people" });
        if (selectedClientId) params.set("clientId", String(selectedClientId));
        const res = await fetch(`/api/gantt?${params}`);
        const data = await res.json();
        setPeople(data.people || []);
        setDateRange(data.dateRange || null);
      }
    } catch (err) {
      console.error("Failed to load gantt data:", err);
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedClientId]);

  useEffect(() => {
    setExpandedItems(new Set());
    loadData();
  }, [loadData]);

  // ── Scroll sync ──────────────────────────────────────────────────────────
  const syncingRef = useRef(false);

  const handleChartScroll = useCallback(() => {
    if (!syncingRef.current) {
      syncingRef.current = true;
      if (labelScrollRef.current && chartScrollRef.current) {
        labelScrollRef.current.scrollTop = chartScrollRef.current.scrollTop;
      }
      syncingRef.current = false;
    }
    // Sync horizontal scroll to the header overlay
    if (headerCanvasRef.current && chartScrollRef.current) {
      headerCanvasRef.current.scrollLeft = chartScrollRef.current.scrollLeft;
    }
  }, []);

  const handleLabelScroll = useCallback(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (labelScrollRef.current && chartScrollRef.current) {
      chartScrollRef.current.scrollTop = labelScrollRef.current.scrollTop;
    }
    syncingRef.current = false;
  }, []);

  // ── Expand / collapse ────────────────────────────────────────────────────

  const toggleItem = (key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Drag-to-extend / reduce ───────────────────────────────────────────────

  const handlePersonDragStart = useCallback(
    (
      e: React.MouseEvent,
      personId: number,
      taskNumber: string,
      taskDescription: string,
      actualEnd: string,
      currentEndX: number,
      personActualEndX: number,
      allocationPct: number
    ) => {
      e.preventDefault();
      e.stopPropagation();
      setDragState({
        kind: "person",
        personId,
        taskNumber,
        taskDescription,
        actualEnd,
        actualEndX: personActualEndX,
        startMouseX: e.clientX,
        originalEndX: currentEndX,
        currentEndX,
        allocationPct,
      });
    },
    []
  );

  const handleProjectDragStart = useCallback(
    (
      e: React.MouseEvent,
      taskNumber: string,
      taskDescription: string,
      actualEnd: string,
      currentEndX: number,
      projActEndX: number
    ) => {
      e.preventDefault();
      e.stopPropagation();
      setDragState({
        kind: "project",
        personId: null,
        taskNumber,
        taskDescription,
        actualEnd,
        actualEndX: projActEndX,
        startMouseX: e.clientX,
        originalEndX: currentEndX,
        currentEndX,
        allocationPct: 100, // Not used for project-level batch; each person keeps their own
      });
    },
    []
  );

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragState((prev) => {
        if (!prev) return null;
        const delta = e.clientX - prev.startMouseX;
        const snapped = Math.round(delta / pxPerWeek) * pxPerWeek;
        const newEnd = prev.originalEndX + snapped;
        return { ...prev, currentEndX: newEnd };
      });
    };

    const handleMouseUp = async () => {
      const ds = dragStateRef.current;
      if (!ds) return;

      const tl = dateRange ? buildTimeline(dateRange, pxPerWeek) : null;
      if (!tl) {
        setDragState(null);
        return;
      }

      const newEndDate = xToDate(ds.currentEndX, tl);

      if (ds.kind === "project" && viewMode === "project") {
        // Project-level drag in Project view: batch update all people
        await fetch("/api/planned-work/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_number: ds.taskNumber,
            task_description: ds.taskDescription,
            planned_end: newEndDate,
          }),
        });
      } else {
        // Person-level drag (both views) or project-child drag in People view
        const actualEnd = ds.actualEnd;
        if (newEndDate > actualEnd) {
          await fetch("/api/planned-work", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              person_id: ds.personId,
              task_number: ds.taskNumber,
              task_description: ds.taskDescription,
              planned_start: actualEnd,
              planned_end: newEndDate,
              allocation_pct: ds.allocationPct,
            }),
          });
        } else {
          // Dragged to or past actual end → remove planned work
          if (viewMode === "project") {
            const currentProjects = projectsRef.current;
            for (const proj of currentProjects) {
              if (proj.task_number !== ds.taskNumber) continue;
              for (const pe of proj.people) {
                if (pe.person_id === ds.personId && pe.planned_work) {
                  await fetch(`/api/planned-work/${pe.planned_work.id}`, {
                    method: "DELETE",
                  });
                }
              }
            }
          } else {
            const currentPeople = peopleRef.current;
            for (const person of currentPeople) {
              if (person.person_id !== ds.personId) continue;
              for (const proj of person.projects) {
                if (proj.task_number === ds.taskNumber && proj.planned_work) {
                  await fetch(`/api/planned-work/${proj.planned_work.id}`, {
                    method: "DELETE",
                  });
                }
              }
            }
          }
        }
      }

      setDragState(null);
      await loadData();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState?.personId, dragState?.taskNumber, dragState?.kind, dateRange, pxPerWeek, viewMode]);

  // ── Scroll to today ──────────────────────────────────────────────────────

  const scrollToToday = useCallback(() => {
    if (!dateRange || !chartScrollRef.current) return;
    const tl = buildTimeline(dateRange, pxPerWeek);
    const todayX = dateToX(format(new Date(), "yyyy-MM-dd"), tl);
    chartScrollRef.current.scrollLeft = Math.max(
      0,
      todayX - chartScrollRef.current.clientWidth / 2
    );
  }, [dateRange, pxPerWeek]);

  useEffect(() => {
    if (!loading && dateRange) {
      setTimeout(scrollToToday, 100);
    }
  }, [loading, dateRange, scrollToToday]);

  // ── Loading / empty ────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full mb-2" />
          <p>Loading Gantt chart...</p>
        </CardContent>
      </Card>
    );
  }

  const hasData =
    viewMode === "project" ? projects.length > 0 : people.length > 0;

  if (!dateRange || !hasData) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          No {viewMode === "project" ? "project" : "people"} timesheet data
          available. Upload timesheets to see the Gantt chart.
        </CardContent>
      </Card>
    );
  }

  const timeline = buildTimeline(dateRange, pxPerWeek);
  const todayX = dateToX(format(new Date(), "yyyy-MM-dd"), timeline);

  // Compute rows based on view mode
  let rowCount = 0;
  let projectRows: ProjectViewRow[] = [];
  let peopleRows: PeopleViewRow[] = [];

  if (viewMode === "project") {
    projectRows = computeProjectRows(
      projects,
      expandedItems,
      projectFilter,
      personFilter
    );
    rowCount = projectRows.length;
  } else {
    peopleRows = computePeopleRows(
      people,
      expandedItems,
      projectFilter,
      personFilter
    );
    rowCount = peopleRows.length;
  }

  // Compute total allocation per person (across all their planned work)
  const personAllocations =
    viewMode === "project"
      ? computePersonAllocations(projects)
      : computePeopleAllocations(people);

  const svgHeight = rowCount * ROW_HEIGHT;
  const parentCount =
    viewMode === "project"
      ? projectRows.filter(
          (r) =>
            r.type === "group" ||
            (r.type === "project" && !r.project.group_label)
        ).length
      : peopleRows.filter((r) => r.type === "person-parent").length;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Filter by Project
            </label>
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Filter by Person
            </label>
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
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() =>
                setPxPerWeek((v) => Math.max(MIN_PX_PER_WEEK, v - ZOOM_STEP))
              }
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() =>
                setPxPerWeek((v) => Math.min(MAX_PX_PER_WEEK, v + ZOOM_STEP))
              }
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-9"
              onClick={scrollToToday}
              title="Scroll to today"
            >
              <CalendarDays className="h-4 w-4 mr-1" />
              Today
            </Button>
          </div>
          <div className="text-xs text-muted-foreground ml-auto">
            {parentCount}{" "}
            {viewMode === "project" ? "projects" : "people"}
            {(projectFilter || personFilter) && ` (filtered)`}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-3 rounded-sm"
              style={{ backgroundColor: ACTUAL_FILL, opacity: 0.85 }}
            />
            Actual time
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-3 rounded-sm"
              style={{ backgroundColor: PLANNED_FILL, opacity: 0.7 }}
            />
            Planned time
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm bg-muted-foreground/20" />
            {viewMode === "project" ? "Project" : "Person"} summary
          </div>
          {viewMode === "project" && (
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-primary/15 border border-primary/30" />
              Group
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-3 bg-red-500" />
            Today
          </div>
          <span className="text-muted-foreground/50">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold px-1 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">100%</span>
            Fully allocated
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">&lt;100%</span>
            Under-allocated
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold px-1 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">&gt;100%</span>
            Over-allocated
          </div>
        </div>

        {/* ── Gantt body ── */}
        <div
          className="border rounded-md bg-background relative"
          style={{ height: Math.min(svgHeight + HEADER_HEIGHT + 2, 700) }}
        >
          {/* Fixed timeline header overlay */}
          <div
            className="absolute top-0 left-0 right-0 z-20 flex"
            style={{ height: HEADER_HEIGHT }}
          >
            {/* Header label cell */}
            <div
              className="flex-shrink-0 border-r border-b border-white/8 bg-white/8 flex items-center px-3 text-xs font-medium text-foreground/70"
              style={{ width: LABEL_WIDTH, height: HEADER_HEIGHT }}
            >
              {viewMode === "project" ? "Project / Person" : "Person / Project"}
            </div>
            {/* Header timeline — scroll synced */}
            <div
              ref={headerCanvasRef}
              className="flex-1 overflow-hidden border-b border-white/8"
              style={{ height: HEADER_HEIGHT }}
            >
              <svg
                width={timeline.timelineWidth}
                height={HEADER_HEIGHT}
                style={{ display: "block" }}
              >
                <rect
                  x={0}
                  y={0}
                  width={timeline.timelineWidth}
                  height={HEADER_HEIGHT}
                  fill="var(--background)"
                />
                <rect
                  x={0}
                  y={0}
                  width={timeline.timelineWidth}
                  height={HEADER_HEIGHT}
                  fill="currentColor"
                  fillOpacity={0.03}
                />
                <TimelineHeaderContent timeline={timeline} />
                {/* Today marker in header */}
                <line
                  x1={todayX}
                  y1={0}
                  x2={todayX}
                  y2={HEADER_HEIGHT}
                  stroke="hsl(0 72% 51%)"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />
              </svg>
            </div>
          </div>

          {/* Scrollable body area below header */}
          <div
            className="flex"
            style={{
              paddingTop: HEADER_HEIGHT,
              height: "100%",
            }}
          >
            {/* Left: Row labels */}
            <div
              className="flex-shrink-0 border-r"
              style={{ width: LABEL_WIDTH }}
            >
              <div
                ref={labelScrollRef}
                onScroll={handleLabelScroll}
                className="overflow-y-auto h-full"
                style={{ overflowX: "hidden" }}
              >
                <div style={{ height: svgHeight }}>
                  {viewMode === "project"
                    ? projectRows.map((row, i) => (
                        <div
                          key={i}
                          className={`flex items-center px-3 border-b border-white/5 ${
                            row.type === "group"
                              ? "bg-white/8 font-semibold"
                              : row.type === "project"
                                ? "bg-white/5 font-medium"
                                : ""
                          }`}
                          style={{ height: ROW_HEIGHT }}
                        >
                          {row.type === "group" ? (
                            <button
                              className="flex items-center gap-1.5 text-left w-full min-w-0"
                              onClick={() =>
                                toggleItem(`group:${row.groupLabel}`)
                              }
                            >
                              {expandedItems.has(`group:${row.groupLabel}`) ? (
                                <ChevronDown className="h-4 w-4 flex-shrink-0 text-primary" />
                              ) : (
                                <ChevronRight className="h-4 w-4 flex-shrink-0 text-primary" />
                              )}
                              <span className="text-sm truncate">
                                {row.groupLabel}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-1 flex-shrink-0">
                                ({row.projectCount} projects)
                              </span>
                            </button>
                          ) : row.type === "project" ? (
                            <button
                              className={`flex items-center gap-1.5 text-left w-full min-w-0 ${row.project.group_label ? "pl-4" : ""}`}
                              onClick={() =>
                                toggleItem(row.project.task_number)
                              }
                            >
                              {expandedItems.has(row.project.task_number) ? (
                                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                              )}
                              <span className="text-sm truncate">
                                {row.project.task_description}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-1 flex-shrink-0">
                                ({row.project.people.length})
                              </span>
                            </button>
                          ) : (
                            <div className={`flex items-center gap-1.5 min-w-0 w-full ${row.project.group_label ? "pl-9" : "pl-5"}`}>
                              {row.person.photo ? (
                                <img
                                  src={`/api/photos/${row.person.photo}`}
                                  alt=""
                                  className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                  <span className="text-[8px] font-semibold text-muted-foreground">
                                    {row.person.user_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                  </span>
                                </div>
                              )}
                              <span className="text-xs truncate text-foreground/85">
                                {row.person.user_name}
                              </span>
                              <AllocationBadge
                                total={personAllocations.get(row.person.person_id)}
                              />
                            </div>
                          )}
                        </div>
                      ))
                    : peopleRows.map((row, i) => (
                        <div
                          key={i}
                          className={`flex items-center px-3 border-b border-white/5 ${
                            row.type === "person-parent"
                              ? "bg-white/5 font-medium"
                              : ""
                          }`}
                          style={{ height: ROW_HEIGHT }}
                        >
                          {row.type === "person-parent" ? (
                            <button
                              className="flex items-center gap-1.5 text-left w-full min-w-0"
                              onClick={() =>
                                toggleItem(String(row.personData.person_id))
                              }
                            >
                              {expandedItems.has(
                                String(row.personData.person_id)
                              ) ? (
                                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                              )}
                              {row.personData.photo ? (
                                <img
                                  src={`/api/photos/${row.personData.photo}`}
                                  alt=""
                                  className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                  <span className="text-[8px] font-semibold text-muted-foreground">
                                    {row.personData.user_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                  </span>
                                </div>
                              )}
                              <span className="text-sm truncate">
                                {row.personData.user_name}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-1 flex-shrink-0">
                                ({row.personData.projects.length})
                              </span>
                              <AllocationBadge
                                total={personAllocations.get(row.personData.person_id)}
                              />
                            </button>
                          ) : (
                            <span className="text-xs truncate pl-5 text-foreground/85">
                              {row.projectData.task_description}
                            </span>
                          )}
                        </div>
                      ))}
                </div>
              </div>
            </div>

            {/* Right: Chart area */}
            <div
              ref={chartScrollRef}
              onScroll={handleChartScroll}
              className="flex-1 overflow-auto"
            >
              <svg
                width={timeline.timelineWidth}
                height={svgHeight}
                className="select-none"
                style={{ display: "block" }}
              >
                <defs>
                  <pattern
                    id="planned-hatch"
                    patternUnits="userSpaceOnUse"
                    width="8"
                    height="8"
                    patternTransform="rotate(135)"
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="8"
                      stroke={PLANNED_FILL}
                      strokeWidth="3"
                      strokeOpacity="0.6"
                    />
                  </pattern>
                </defs>

                {/* Grid lines */}
                <GridLines timeline={timeline} totalHeight={svgHeight} />

                {/* Today line */}
                <line
                  x1={todayX}
                  y1={0}
                  x2={todayX}
                  y2={svgHeight}
                  stroke="hsl(0 72% 51%)"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />

                {/* Data bars */}
                {viewMode === "project"
                  ? projectRows.map((row, i) => {
                      const y = i * ROW_HEIGHT;
                      if (row.type === "group") {
                        return (
                          <GroupParentBar
                            key={`g-${row.groupLabel}`}
                            row={row}
                            y={y}
                            timeline={timeline}
                          />
                        );
                      } else if (row.type === "project") {
                        return (
                          <ProjectParentBar
                            key={`p-${row.project.task_number}`}
                            project={row.project}
                            y={y}
                            timeline={timeline}
                            dragState={dragState}
                            onDragStart={handleProjectDragStart}
                          />
                        );
                      } else {
                        return (
                          <PersonChildBar
                            key={`pe-${row.person.person_id}-${row.project.task_number}`}
                            person={row.person}
                            project={row.project}
                            y={y}
                            timeline={timeline}
                            dragState={dragState}
                            onDragStart={handlePersonDragStart}
                          />
                        );
                      }
                    })
                  : peopleRows.map((row, i) => {
                      const y = i * ROW_HEIGHT;
                      if (row.type === "person-parent") {
                        return (
                          <PeopleParentBar
                            key={`pp-${row.personData.person_id}`}
                            personData={row.personData}
                            y={y}
                            timeline={timeline}
                          />
                        );
                      } else {
                        return (
                          <ProjectChildBar
                            key={`pc-${row.personData.person_id}-${row.projectData.task_number}`}
                            projectData={row.projectData}
                            personData={row.personData}
                            y={y}
                            timeline={timeline}
                            dragState={dragState}
                            onDragStart={handlePersonDragStart}
                          />
                        );
                      }
                    })}
              </svg>
            </div>
          </div>
        </div>

        {/* Help text */}
        <p className="text-xs text-muted-foreground">
          {viewMode === "project"
            ? "Click a project to expand and see people."
            : "Click a person to expand and see their projects."}{" "}
          Drag the right edge of a bar to extend or reduce planned work. Drag
          left to decrease, right to increase.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Timeline Header Content (month labels & dividers) ────────────────────────

function TimelineHeaderContent({ timeline }: { timeline: TimelineConfig }) {
  const { startDate, totalWeeks, pixelsPerWeek } = timeline;
  const elements: React.ReactNode[] = [];
  let currentMonth = "";

  for (let w = 0; w <= totalWeeks; w++) {
    const weekDate = addWeeks(startDate, w);
    const x = w * pixelsPerWeek;
    const monthLabel = format(weekDate, "MMM yyyy");

    if (monthLabel !== currentMonth) {
      currentMonth = monthLabel;
      elements.push(
        <line
          key={`mg-${w}`}
          x1={x}
          y1={0}
          x2={x}
          y2={HEADER_HEIGHT}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
      );
      elements.push(
        <text
          key={`ml-${w}`}
          x={x + 4}
          y={HEADER_HEIGHT - 10}
          fontSize={11}
          fill="currentColor"
          fillOpacity={0.5}
          className="select-none"
          style={{ fontFamily: "inherit" }}
        >
          {monthLabel}
        </text>
      );
    }
  }

  return <g>{elements}</g>;
}

// ── Grid Lines ──────────────────────────────────────────────────────────────

function GridLines({
  timeline,
  totalHeight,
}: {
  timeline: TimelineConfig;
  totalHeight: number;
}) {
  const { startDate, totalWeeks, pixelsPerWeek } = timeline;
  const elements: React.ReactNode[] = [];
  let currentMonth = "";

  for (let w = 0; w <= totalWeeks; w++) {
    const weekDate = addWeeks(startDate, w);
    const x = w * pixelsPerWeek;
    const monthLabel = format(weekDate, "MMM yyyy");

    elements.push(
      <line
        key={`wg-${w}`}
        x1={x}
        y1={0}
        x2={x}
        y2={totalHeight}
        stroke="currentColor"
        strokeOpacity={0.06}
        strokeWidth={1}
      />
    );

    if (monthLabel !== currentMonth) {
      currentMonth = monthLabel;
      elements.push(
        <line
          key={`mg-${w}`}
          x1={x}
          y1={0}
          x2={x}
          y2={totalHeight}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
      );
    }
  }

  return <g>{elements}</g>;
}

// ── Group Parent Bar (for Project View grouping) ──────────────────────────────

function GroupParentBar({
  row,
  y,
  timeline,
}: {
  row: Extract<ProjectViewRow, { type: "group" }>;
  y: number;
  timeline: TimelineConfig;
}) {
  const barH = ROW_HEIGHT * 0.35;
  const barY = y + (ROW_HEIGHT - barH) / 2;

  const hasRange = !!row.earliest_week && !!row.latest_week;
  const x1 = hasRange ? dateToX(row.earliest_week, timeline) : 0;
  const x2 = hasRange
    ? dateToX(row.latest_week, timeline) + timeline.pixelsPerWeek
    : 0;
  const w = hasRange ? Math.max(x2 - x1, 2) : 0;

  return (
    <g>
      <rect
        x={0}
        y={y}
        width={timeline.timelineWidth}
        height={ROW_HEIGHT}
        fill="currentColor"
        fillOpacity={0.04}
      />
      {hasRange && (
        <>
          <rect
            x={x1}
            y={barY}
            width={w}
            height={barH}
            rx={2}
            fill="var(--primary)"
            fillOpacity={0.15}
          />
          <rect
            x={x1}
            y={barY}
            width={w}
            height={barH}
            rx={2}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={1}
            strokeOpacity={0.3}
          />
        </>
      )}
      <line
        x1={0}
        y1={y + ROW_HEIGHT}
        x2={timeline.timelineWidth}
        y2={y + ROW_HEIGHT}
        stroke="currentColor"
        strokeOpacity={0.08}
        strokeWidth={1}
      />
      <title>
        {row.groupLabel} ({row.projectCount} projects)
      </title>
    </g>
  );
}

// ── Project Parent Bar (for Project View) ────────────────────────────────────

function ProjectParentBar({
  project,
  y,
  timeline,
  dragState,
  onDragStart,
}: {
  project: GanttProject;
  y: number;
  timeline: TimelineConfig;
  dragState: DragState | null;
  onDragStart: (
    e: React.MouseEvent,
    taskNumber: string,
    taskDescription: string,
    actualEnd: string,
    endX: number,
    actualEndX: number
  ) => void;
}) {
  const barH = ROW_HEIGHT * 0.4;
  const barY = y + (ROW_HEIGHT - barH) / 2;
  const handleW = 8;

  const projActEnd = projectActualEnd(project);
  const hasActual = !!projActEnd;
  const x1 = dateToX(project.earliest_week, timeline);
  const actualEndX = hasActual
    ? dateToX(projActEnd, timeline) + timeline.pixelsPerWeek
    : x1; // no actual bar if no timesheets

  let latestPlannedEndX = actualEndX;
  for (const p of project.people) {
    if (p.planned_work) {
      const pEndX =
        dateToX(p.planned_work.planned_end, timeline) + timeline.pixelsPerWeek;
      if (pEndX > latestPlannedEndX) latestPlannedEndX = pEndX;
    }
  }

  // For planned-only projects, compute the planned start
  let earliestPlannedStartX = latestPlannedEndX;
  if (!hasActual) {
    for (const p of project.people) {
      if (p.planned_work) {
        const pStartX = dateToX(p.planned_work.planned_start, timeline);
        if (pStartX < earliestPlannedStartX) earliestPlannedStartX = pStartX;
      }
    }
  }

  const isBeingDragged =
    dragState &&
    dragState.kind === "project" &&
    dragState.taskNumber === project.task_number;

  const rawEndX = isBeingDragged
    ? dragState.currentEndX
    : Math.max(actualEndX, latestPlannedEndX);

  const effectiveEndX = Math.max(actualEndX, rawEndX);
  const actualW = hasActual ? Math.max(actualEndX - x1, 2) : 0;
  const plannedBarStart = hasActual ? actualEndX : earliestPlannedStartX;
  const plannedBarWidth = Math.max(0, effectiveEndX - plannedBarStart);
  const handleX = Math.max(actualEndX, rawEndX);

  return (
    <g>
      <rect
        x={0}
        y={y}
        width={timeline.timelineWidth}
        height={ROW_HEIGHT}
        fill="currentColor"
        fillOpacity={0.02}
      />
      {hasActual && (
        <rect
          x={x1}
          y={barY}
          width={actualW}
          height={barH}
          rx={2}
          fill={ACTUAL_FILL}
          fillOpacity={0.25}
        />
      )}
      {plannedBarWidth > 0 && (
        <>
          <rect
            x={plannedBarStart}
            y={barY}
            width={plannedBarWidth}
            height={barH}
            rx={2}
            fill={PLANNED_FILL}
            fillOpacity={0.2}
          />
          <rect
            x={plannedBarStart}
            y={barY}
            width={plannedBarWidth}
            height={barH}
            rx={2}
            fill="none"
            stroke={PLANNED_FILL}
            strokeWidth={1}
            strokeOpacity={0.4}
            strokeDasharray="4 2"
          />
        </>
      )}
      <rect
        x={handleX - handleW / 2}
        y={barY - 1}
        width={handleW}
        height={barH + 2}
        rx={2}
        fill={ACTUAL_FILL}
        fillOpacity={isBeingDragged ? 1 : 0.6}
        className="cursor-ew-resize"
        onMouseDown={(e) => {
          e.stopPropagation();
          onDragStart(
            e,
            project.task_number,
            project.task_description,
            projActEnd,
            effectiveEndX,
            actualEndX
          );
        }}
      />
      <line
        x1={0}
        y1={y + ROW_HEIGHT}
        x2={timeline.timelineWidth}
        y2={y + ROW_HEIGHT}
        stroke="currentColor"
        strokeOpacity={0.06}
        strokeWidth={1}
      />
      <title>
        {project.task_description} ({project.people.length} people) — Drag
        handle to plan
      </title>
    </g>
  );
}

// ── Person Child Bar (for Project View) ──────────────────────────────────────

function PersonChildBar({
  person,
  project,
  y,
  timeline,
  dragState,
  onDragStart,
}: {
  person: GanttPerson;
  project: GanttProject;
  y: number;
  timeline: TimelineConfig;
  dragState: DragState | null;
  onDragStart: (
    e: React.MouseEvent,
    personId: number,
    taskNumber: string,
    taskDescription: string,
    actualEnd: string,
    endX: number,
    actualEndX: number,
    allocationPct: number
  ) => void;
}) {
  const maxBarH = ROW_HEIGHT * 0.55;
  const allocationPct = person.planned_work?.allocation_pct ?? 100;
  // Scale the planned bar height by allocation %, but keep actual bar full height
  const plannedBarH = maxBarH * (allocationPct / 100);
  const barH = maxBarH;
  const barY = y + (ROW_HEIGHT - barH) / 2;
  const handleW = 8;

  const hasActual = !!person.actual_start && !!person.actual_end;
  const hasPlanned = !!person.planned_work;

  // Compute actual bar positions only if there are timesheets
  const actualX = hasActual ? dateToX(person.actual_start, timeline) : 0;
  const actualEndX = hasActual
    ? dateToX(person.actual_end, timeline) + timeline.pixelsPerWeek
    : 0;
  const actualW = hasActual ? Math.max(actualEndX - actualX, 2) : 0;

  // Planned bar: anchor at actual_end if timesheets exist, otherwise at planned_start
  const plannedStartX = hasPlanned
    ? hasActual
      ? actualEndX
      : dateToX(person.planned_work!.planned_start, timeline)
    : actualEndX;
  const plannedEndX = hasPlanned
    ? dateToX(person.planned_work!.planned_end, timeline) +
      timeline.pixelsPerWeek
    : plannedStartX;

  const isBeingDraggedDirectly =
    dragState &&
    dragState.kind === "person" &&
    dragState.personId === person.person_id &&
    dragState.taskNumber === project.task_number;

  const isProjectBeingDragged =
    dragState &&
    dragState.kind === "project" &&
    dragState.taskNumber === project.task_number;

  let rawEndX: number;

  if (isBeingDraggedDirectly) {
    rawEndX = dragState.currentEndX;
  } else if (isProjectBeingDragged) {
    const projDragEndX = dragState.currentEndX;
    if (projDragEndX < plannedEndX) {
      rawEndX = projDragEndX;
    } else {
      rawEndX = Math.max(plannedEndX, projDragEndX);
    }
  } else {
    rawEndX = hasPlanned ? plannedEndX : (hasActual ? actualEndX : 0);
  }

  // For planned-work-only, minimum end is the planned start (can't shrink before it)
  const minEndX = hasActual ? actualEndX : plannedStartX;
  const effectiveEndX = Math.max(minEndX, rawEndX);
  const plannedBarWidth = Math.max(0, effectiveEndX - plannedStartX);
  const handleX = effectiveEndX;

  // The "actual end" to pass for drag — empty string for planned-only means
  // the drag handler needs to use the planned_start as anchor
  const dragAnchorEnd = hasActual ? person.actual_end : (hasPlanned ? person.planned_work!.planned_start : "");

  return (
    <g>
      <line
        x1={0}
        y1={y + ROW_HEIGHT}
        x2={timeline.timelineWidth}
        y2={y + ROW_HEIGHT}
        stroke="currentColor"
        strokeOpacity={0.06}
        strokeWidth={1}
      />
      {hasActual && (
        <rect
          x={actualX}
          y={barY}
          width={actualW}
          height={barH}
          rx={3}
          fill={ACTUAL_FILL}
          fillOpacity={0.85}
        />
      )}
      {plannedBarWidth > 0 && (
        <>
          <rect
            x={plannedStartX}
            y={barY + (maxBarH - plannedBarH) / 2}
            width={plannedBarWidth}
            height={plannedBarH}
            rx={3}
            fill={PLANNED_FILL}
            fillOpacity={0.55}
          />
          <rect
            x={plannedStartX}
            y={barY + (maxBarH - plannedBarH) / 2}
            width={plannedBarWidth}
            height={plannedBarH}
            rx={3}
            fill="url(#planned-hatch)"
          />
          <rect
            x={plannedStartX}
            y={barY + (maxBarH - plannedBarH) / 2}
            width={plannedBarWidth}
            height={plannedBarH}
            rx={3}
            fill="none"
            stroke={PLANNED_FILL}
            strokeWidth={1}
            strokeOpacity={0.5}
          />
        </>
      )}
      <rect
        x={handleX - handleW / 2}
        y={barY - 1}
        width={handleW}
        height={barH + 2}
        rx={2}
        fill={ACTUAL_FILL}
        fillOpacity={isBeingDraggedDirectly ? 1 : 0.7}
        className="cursor-ew-resize"
        onMouseDown={(e) =>
          onDragStart(
            e,
            person.person_id,
            project.task_number,
            project.task_description,
            dragAnchorEnd,
            effectiveEndX,
            hasActual ? actualEndX : plannedStartX,
            allocationPct
          )
        }
      />
      {/* Allocation % label on the planned bar */}
      {hasPlanned && plannedBarWidth > 24 && (
        <text
          x={plannedStartX + plannedBarWidth / 2}
          y={y + ROW_HEIGHT / 2 + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fontWeight={600}
          fill="currentColor"
          fillOpacity={0.7}
          className="select-none"
          style={{ fontFamily: "inherit" }}
        >
          {allocationPct}%
        </text>
      )}
      <title>
        {person.user_name}: {hasActual ? `${person.total_hours.toFixed(1)}h actual` : "No timesheets"}
        {hasPlanned
          ? ` | Planned ${person.planned_work!.planned_start} to ${person.planned_work!.planned_end} (${allocationPct}%)`
          : " | Drag to plan"}
      </title>
    </g>
  );
}

// ── People Parent Bar (for People View) ──────────────────────────────────────

function PeopleParentBar({
  personData,
  y,
  timeline,
}: {
  personData: PeopleGanttPerson;
  y: number;
  timeline: TimelineConfig;
}) {
  const barH = ROW_HEIGHT * 0.4;
  const barY = y + (ROW_HEIGHT - barH) / 2;

  const x1 = dateToX(personData.earliest_week, timeline);
  const actEnd = personActualEnd(personData);
  const hasActual = !!actEnd;
  const actualEndX = hasActual
    ? dateToX(actEnd, timeline) + timeline.pixelsPerWeek
    : x1; // no actual bar
  const actualW = hasActual ? Math.max(actualEndX - x1, 2) : 0;

  let latestPlannedEndX = actualEndX;
  let earliestPlannedStartX = latestPlannedEndX;
  for (const p of personData.projects) {
    if (p.planned_work) {
      const pEndX =
        dateToX(p.planned_work.planned_end, timeline) + timeline.pixelsPerWeek;
      if (pEndX > latestPlannedEndX) latestPlannedEndX = pEndX;
      if (!hasActual) {
        const pStartX = dateToX(p.planned_work.planned_start, timeline);
        if (pStartX < earliestPlannedStartX) earliestPlannedStartX = pStartX;
      }
    }
  }

  const plannedBarStart = hasActual ? actualEndX : earliestPlannedStartX;
  const plannedBarWidth = Math.max(0, latestPlannedEndX - plannedBarStart);

  return (
    <g>
      <rect
        x={0}
        y={y}
        width={timeline.timelineWidth}
        height={ROW_HEIGHT}
        fill="currentColor"
        fillOpacity={0.02}
      />
      {hasActual && (
        <rect
          x={x1}
          y={barY}
          width={actualW}
          height={barH}
          rx={2}
          fill={ACTUAL_FILL}
          fillOpacity={0.25}
        />
      )}
      {plannedBarWidth > 0 && (
        <>
          <rect
            x={plannedBarStart}
            y={barY}
            width={plannedBarWidth}
            height={barH}
            rx={2}
            fill={PLANNED_FILL}
            fillOpacity={0.2}
          />
          <rect
            x={plannedBarStart}
            y={barY}
            width={plannedBarWidth}
            height={barH}
            rx={2}
            fill="none"
            stroke={PLANNED_FILL}
            strokeWidth={1}
            strokeOpacity={0.4}
            strokeDasharray="4 2"
          />
        </>
      )}
      <line
        x1={0}
        y1={y + ROW_HEIGHT}
        x2={timeline.timelineWidth}
        y2={y + ROW_HEIGHT}
        stroke="currentColor"
        strokeOpacity={0.06}
        strokeWidth={1}
      />
      <title>
        {personData.user_name} ({personData.projects.length} projects)
      </title>
    </g>
  );
}

// ── Project Child Bar (for People View) ──────────────────────────────────────

function ProjectChildBar({
  projectData,
  personData,
  y,
  timeline,
  dragState,
  onDragStart,
}: {
  projectData: PeopleGanttProject;
  personData: PeopleGanttPerson;
  y: number;
  timeline: TimelineConfig;
  dragState: DragState | null;
  onDragStart: (
    e: React.MouseEvent,
    personId: number,
    taskNumber: string,
    taskDescription: string,
    actualEnd: string,
    endX: number,
    actualEndX: number,
    allocationPct: number
  ) => void;
}) {
  const barH = ROW_HEIGHT * 0.55;
  const barY = y + (ROW_HEIGHT - barH) / 2;
  const handleW = 8;

  const hasActual = !!projectData.actual_start && !!projectData.actual_end;
  const hasPlanned = !!projectData.planned_work;

  const actualX = hasActual ? dateToX(projectData.actual_start, timeline) : 0;
  const actualEndX = hasActual
    ? dateToX(projectData.actual_end, timeline) + timeline.pixelsPerWeek
    : 0;
  const actualW = hasActual ? Math.max(actualEndX - actualX, 2) : 0;

  // Planned bar anchor: use actual_end if timesheets exist, otherwise planned_start
  const plannedStartX = hasPlanned
    ? hasActual
      ? actualEndX
      : dateToX(projectData.planned_work!.planned_start, timeline)
    : actualEndX;
  const plannedEndX = hasPlanned
    ? dateToX(projectData.planned_work!.planned_end, timeline) +
      timeline.pixelsPerWeek
    : plannedStartX;

  const isBeingDragged =
    dragState &&
    dragState.kind === "person" &&
    dragState.personId === personData.person_id &&
    dragState.taskNumber === projectData.task_number;

  let rawEndX: number;
  if (isBeingDragged) {
    rawEndX = dragState.currentEndX;
  } else {
    rawEndX = hasPlanned ? plannedEndX : (hasActual ? actualEndX : 0);
  }

  const minEndX = hasActual ? actualEndX : plannedStartX;
  const effectiveEndX = Math.max(minEndX, rawEndX);
  const plannedBarWidth = Math.max(0, effectiveEndX - plannedStartX);
  const handleX = effectiveEndX;

  const dragAnchorEnd = hasActual ? projectData.actual_end : (hasPlanned ? projectData.planned_work!.planned_start : "");

  return (
    <g>
      <line
        x1={0}
        y1={y + ROW_HEIGHT}
        x2={timeline.timelineWidth}
        y2={y + ROW_HEIGHT}
        stroke="currentColor"
        strokeOpacity={0.06}
        strokeWidth={1}
      />
      {hasActual && (
        <rect
          x={actualX}
          y={barY}
          width={actualW}
          height={barH}
          rx={3}
          fill={ACTUAL_FILL}
          fillOpacity={0.85}
        />
      )}
      {plannedBarWidth > 0 && (
        <>
          <rect
            x={plannedStartX}
            y={barY}
            width={plannedBarWidth}
            height={barH}
            rx={3}
            fill={PLANNED_FILL}
            fillOpacity={0.55}
          />
          <rect
            x={plannedStartX}
            y={barY}
            width={plannedBarWidth}
            height={barH}
            rx={3}
            fill="url(#planned-hatch)"
          />
          <rect
            x={plannedStartX}
            y={barY}
            width={plannedBarWidth}
            height={barH}
            rx={3}
            fill="none"
            stroke={PLANNED_FILL}
            strokeWidth={1}
            strokeOpacity={0.5}
          />
        </>
      )}
      <rect
        x={handleX - handleW / 2}
        y={barY - 1}
        width={handleW}
        height={barH + 2}
        rx={2}
        fill={ACTUAL_FILL}
        fillOpacity={isBeingDragged ? 1 : 0.7}
        className="cursor-ew-resize"
        onMouseDown={(e) =>
          onDragStart(
            e,
            personData.person_id,
            projectData.task_number,
            projectData.task_description,
            dragAnchorEnd,
            effectiveEndX,
            hasActual ? actualEndX : plannedStartX,
            projectData.planned_work?.allocation_pct ?? 100
          )
        }
      />
      {/* Allocation % label on the planned bar */}
      {hasPlanned && plannedBarWidth > 24 && (
        <text
          x={plannedStartX + plannedBarWidth / 2}
          y={barY + barH / 2 + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fontWeight={600}
          fill="currentColor"
          fillOpacity={0.7}
          className="select-none"
          style={{ fontFamily: "inherit" }}
        >
          {projectData.planned_work!.allocation_pct}%
        </text>
      )}
      <title>
        {projectData.task_description}: {hasActual ? `${projectData.total_hours.toFixed(1)}h actual` : "No timesheets"}
        {hasPlanned
          ? ` | Planned ${projectData.planned_work!.planned_start} to ${projectData.planned_work!.planned_end} (${projectData.planned_work!.allocation_pct}%)`
          : " | Drag to plan"}
      </title>
    </g>
  );
}
