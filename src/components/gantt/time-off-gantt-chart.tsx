"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { format } from "date-fns";
import {
  ROW_HEIGHT,
  HEADER_HEIGHT,
  LABEL_WIDTH,
  DEFAULT_PX_PER_WEEK,
  MIN_PX_PER_WEEK,
  MAX_PX_PER_WEEK,
  ZOOM_STEP,
  dateToX,
  buildTimeline,
  TimelineHeaderContent,
  GridLines,
  type TimelineConfig,
} from "./gantt-utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface PTOEntry {
  id: number;
  start_date: string;
  end_date: string;
  country: string | null;
  message: string | null;
  business_days: number;
}

interface PTOPerson {
  person_key: string;
  person_id: number | null;
  person_name: string;
  photo: string | null;
  entries: PTOEntry[];
}

interface PTOTypeGroup {
  type: string;
  people: PTOPerson[];
}

type TimeOffViewRow =
  | { type: "type-parent"; typeGroup: PTOTypeGroup }
  | { type: "person-child"; person: PTOPerson; ptoType: string };

// ── Colors per PTO type ──────────────────────────────────────────────────────

const PTO_COLORS: Record<string, { fill: string; opacity: number }> = {
  "National Holiday": { fill: "hsl(215 70% 55%)", opacity: 0.75 },
  Personal: { fill: "hsl(35 90% 55%)", opacity: 0.75 },
  Sick: { fill: "hsl(0 70% 55%)", opacity: 0.75 },
};

function getPTOColor(ptoType: string) {
  return PTO_COLORS[ptoType] || { fill: "hsl(250 60% 55%)", opacity: 0.75 };
}

// ── Row computation ──────────────────────────────────────────────────────────

function computeTimeOffRows(
  typeGroups: PTOTypeGroup[],
  expanded: Set<string>,
  personFilter: string
): TimeOffViewRow[] {
  const rows: TimeOffViewRow[] = [];
  const nf = personFilter.toLowerCase();

  for (const typeGroup of typeGroups) {
    const filteredPeople = nf
      ? typeGroup.people.filter((p) =>
          p.person_name.toLowerCase().includes(nf)
        )
      : typeGroup.people;

    if (nf && filteredPeople.length === 0) continue;

    // Create a view of the typeGroup with filtered people for the parent row count
    const viewGroup: PTOTypeGroup = nf
      ? { ...typeGroup, people: filteredPeople }
      : typeGroup;

    rows.push({ type: "type-parent", typeGroup: viewGroup });

    if (expanded.has(typeGroup.type)) {
      for (const person of filteredPeople) {
        rows.push({ type: "person-child", person, ptoType: typeGroup.type });
      }
    }
  }
  return rows;
}

// ── Bar Components ───────────────────────────────────────────────────────────

function TypeParentBar({
  row,
  y,
  timeline,
}: {
  row: Extract<TimeOffViewRow, { type: "type-parent" }>;
  y: number;
  timeline: TimelineConfig;
}) {
  const barH = ROW_HEIGHT * 0.35;
  const barY = y + (ROW_HEIGHT - barH) / 2;
  const color = getPTOColor(row.typeGroup.type);

  // Find earliest start and latest end across all people's entries
  let earliest = "";
  let latest = "";
  for (const person of row.typeGroup.people) {
    for (const entry of person.entries) {
      if (!earliest || entry.start_date < earliest) earliest = entry.start_date;
      if (!latest || entry.end_date > latest) latest = entry.end_date;
    }
  }

  const hasRange = !!earliest && !!latest;
  const x1 = hasRange ? dateToX(earliest, timeline) : 0;
  const x2 = hasRange
    ? dateToX(latest, timeline) + timeline.pixelsPerWeek
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
            fill={color.fill}
            fillOpacity={0.15}
          />
          <rect
            x={x1}
            y={barY}
            width={w}
            height={barH}
            rx={2}
            fill="none"
            stroke={color.fill}
            strokeOpacity={0.3}
            strokeWidth={1}
          />
        </>
      )}
      <title>
        {row.typeGroup.type}: {row.typeGroup.people.length} people
        {hasRange ? ` | ${earliest} to ${latest}` : ""}
      </title>
    </g>
  );
}

function PersonPTOBars({
  row,
  y,
  timeline,
}: {
  row: Extract<TimeOffViewRow, { type: "person-child" }>;
  y: number;
  timeline: TimelineConfig;
}) {
  const barH = ROW_HEIGHT * 0.55;
  const barY = y + (ROW_HEIGHT - barH) / 2;
  const color = getPTOColor(row.ptoType);

  return (
    <g>
      {row.person.entries.map((entry) => {
        const x1 = dateToX(entry.start_date, timeline);
        const x2 = dateToX(entry.end_date, timeline) + timeline.pixelsPerWeek;
        const w = Math.max(x2 - x1, 2);

        const startFmt = format(new Date(entry.start_date + "T00:00:00"), "MMM d");
        const endFmt = format(new Date(entry.end_date + "T00:00:00"), "MMM d, yyyy");

        return (
          <g key={entry.id}>
            <rect
              x={x1}
              y={barY}
              width={w}
              height={barH}
              rx={3}
              fill={color.fill}
              fillOpacity={color.opacity}
            />
            {/* Label inside bar if wide enough */}
            {w > 40 && (
              <text
                x={x1 + w / 2}
                y={barY + barH / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
                fill="white"
                fillOpacity={0.9}
                className="select-none pointer-events-none"
                style={{ fontFamily: "inherit" }}
              >
                {entry.business_days}d
              </text>
            )}
            <title>
              {row.person.person_name}: {startFmt} - {endFmt} ({entry.business_days} business days)
              {entry.country ? ` | ${entry.country}` : ""}
              {entry.message ? ` | ${entry.message}` : ""}
            </title>
          </g>
        );
      })}
    </g>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function TimeOffGanttChart() {
  const [typeGroups, setTypeGroups] = useState<PTOTypeGroup[]>([]);
  const [dateRange, setDateRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [personFilter, setPersonFilter] = useState("");
  const [pxPerWeek, setPxPerWeek] = useState(DEFAULT_PX_PER_WEEK);

  const labelScrollRef = useRef<HTMLDivElement>(null);
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const headerCanvasRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  // ── Data fetching ────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/gantt/time-off");
      if (!res.ok) {
        setTypeGroups([]);
        setDateRange(null);
        return;
      }
      const data = await res.json();
      setTypeGroups(data.types || []);
      setDateRange(data.dateRange || null);
      // Auto-expand all type groups on first load
      if (data.types) {
        setExpandedItems(
          new Set(data.types.map((t: PTOTypeGroup) => t.type))
        );
      }
    } catch (err) {
      console.error("Failed to load time-off gantt data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Timeline config ──────────────────────────────────────────────────────

  const timeline = useMemo<TimelineConfig | null>(() => {
    if (!dateRange) return null;
    return buildTimeline(dateRange, pxPerWeek);
  }, [dateRange, pxPerWeek]);

  // ── Scroll sync ──────────────────────────────────────────────────────────

  const handleChartScroll = useCallback(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    const chart = chartScrollRef.current;
    if (chart) {
      if (labelScrollRef.current)
        labelScrollRef.current.scrollTop = chart.scrollTop;
      if (headerCanvasRef.current)
        headerCanvasRef.current.scrollLeft = chart.scrollLeft;
    }
    syncingRef.current = false;
  }, []);

  const handleLabelScroll = useCallback(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (labelScrollRef.current && chartScrollRef.current) {
      chartScrollRef.current.scrollTop = labelScrollRef.current.scrollTop;
    }
    syncingRef.current = false;
  }, []);

  const scrollToToday = useCallback(() => {
    if (!timeline || !chartScrollRef.current) return;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayX = dateToX(todayStr, timeline);
    const container = chartScrollRef.current;
    const center = todayX - container.clientWidth / 2;
    container.scrollLeft = Math.max(0, center);
  }, [timeline]);

  // Scroll to today on first render
  useEffect(() => {
    if (timeline) {
      setTimeout(scrollToToday, 100);
    }
  }, [timeline, scrollToToday]);

  // ── Expand/collapse ──────────────────────────────────────────────────────

  const toggleItem = (key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Compute rows ─────────────────────────────────────────────────────────

  const rows = useMemo(
    () => computeTimeOffRows(typeGroups, expandedItems, personFilter),
    [typeGroups, expandedItems, personFilter]
  );

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayX = timeline ? dateToX(todayStr, timeline) : 0;
  const svgHeight = rows.length * ROW_HEIGHT;
  const typeCount = rows.filter((r) => r.type === "type-parent").length;

  // ── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-20 gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            <span className="text-muted-foreground">
              Loading time off data...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!timeline || typeGroups.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-20 text-muted-foreground">
            No time off data available. Upload PTO entries to see the Time Off Gantt chart.
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-3">
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
            {typeCount} {typeCount === 1 ? "category" : "categories"}
            {personFilter && " (filtered)"}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {Object.entries(PTO_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div
                className="w-4 h-3 rounded-sm"
                style={{ backgroundColor: color.fill, opacity: color.opacity }}
              />
              {type}
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-3 bg-red-500" />
            Today
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
              Type / Person
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
                  {rows.map((row, i) => (
                    <div
                      key={i}
                      className={`flex items-center px-3 border-b border-white/5 ${
                        row.type === "type-parent"
                          ? "bg-white/8 font-semibold"
                          : ""
                      }`}
                      style={{ height: ROW_HEIGHT }}
                    >
                      {row.type === "type-parent" ? (
                        <button
                          className="flex items-center gap-1.5 text-left w-full min-w-0"
                          onClick={() => toggleItem(row.typeGroup.type)}
                        >
                          {expandedItems.has(row.typeGroup.type) ? (
                            <ChevronDown className="h-4 w-4 flex-shrink-0 text-primary" />
                          ) : (
                            <ChevronRight className="h-4 w-4 flex-shrink-0 text-primary" />
                          )}
                          <div
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{
                              backgroundColor: getPTOColor(row.typeGroup.type)
                                .fill,
                              opacity: getPTOColor(row.typeGroup.type).opacity,
                            }}
                          />
                          <span className="text-sm truncate">
                            {row.typeGroup.type}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-1 flex-shrink-0">
                            ({row.typeGroup.people.length}{" "}
                            {row.typeGroup.people.length === 1
                              ? "person"
                              : "people"}
                            )
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0 w-full pl-5">
                          {row.person.photo ? (
                            <img
                              src={`/api/photos/${row.person.photo}`}
                              alt=""
                              className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              <span className="text-[8px] font-semibold text-muted-foreground">
                                {row.person.person_name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)}
                              </span>
                            </div>
                          )}
                          <span className="text-xs truncate text-foreground/85">
                            {row.person.person_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                            {row.person.entries.length}{" "}
                            {row.person.entries.length === 1
                              ? "entry"
                              : "entries"}
                          </span>
                        </div>
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
                {/* Grid lines */}
                <GridLines timeline={timeline} totalHeight={svgHeight} />

                {/* Today marker */}
                <line
                  x1={todayX}
                  y1={0}
                  x2={todayX}
                  y2={svgHeight}
                  stroke="hsl(0 72% 51%)"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />

                {/* Bars */}
                {rows.map((row, i) => {
                  const y = i * ROW_HEIGHT;
                  if (row.type === "type-parent") {
                    return (
                      <TypeParentBar
                        key={`tp-${i}`}
                        row={row}
                        y={y}
                        timeline={timeline}
                      />
                    );
                  }
                  return (
                    <PersonPTOBars
                      key={`pb-${i}`}
                      row={row}
                      y={y}
                      timeline={timeline}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* Help text */}
        <p className="text-xs text-muted-foreground">
          Click type rows to expand/collapse. Use person filter to search. Hover
          over bars for details.
        </p>
      </CardContent>
    </Card>
  );
}
