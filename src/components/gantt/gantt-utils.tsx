"use client";

import React from "react";
import {
  startOfWeek,
  addWeeks,
  differenceInWeeks,
  format,
  parseISO,
} from "date-fns";

// ── Constants ────────────────────────────────────────────────────────────────

export const ROW_HEIGHT = 36;
export const HEADER_HEIGHT = 48;
export const LABEL_WIDTH = 320;
export const DEFAULT_PX_PER_WEEK = 40;
export const MIN_PX_PER_WEEK = 16;
export const MAX_PX_PER_WEEK = 120;
export const ZOOM_STEP = 8;
export const FUTURE_PADDING_WEEKS = 12;

// ── Types ────────────────────────────────────────────────────────────────────

export interface TimelineConfig {
  startDate: Date;
  endDate: Date;
  totalWeeks: number;
  pixelsPerWeek: number;
  timelineWidth: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function dateToX(dateStr: string, tl: TimelineConfig): number {
  const d = parseISO(dateStr);
  const weeks = differenceInWeeks(d, tl.startDate);
  return weeks * tl.pixelsPerWeek;
}

export function xToDate(x: number, tl: TimelineConfig): string {
  const weeks = Math.round(x / tl.pixelsPerWeek);
  const d = addWeeks(tl.startDate, weeks);
  return format(d, "yyyy-MM-dd");
}

export function buildTimeline(
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

// ── Timeline Header Content (month labels & dividers) ────────────────────────

export function TimelineHeaderContent({
  timeline,
}: {
  timeline: TimelineConfig;
}) {
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

export function GridLines({
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
