"use client";

import { useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  ComposedChart,
  Legend,
} from "recharts";

interface MonthlyData {
  month: string;
  revenue: number;
  plannedRevenue: number;
}

interface PTOLossData {
  month: string;
  lostRevenue: number;
}

interface RevenueChartProps {
  data: MonthlyData[];
  currentMonth?: string;
  ptoLossData?: PTOLossData[];
}

const BAR_WIDTH = 64; // pixels per month bar
const Y_AXIS_WIDTH = 60;
const CHART_HEIGHT = 350;
const RIGHT_PADDING = 20;

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
}

export function RevenueChart({ data, currentMonth, ptoLossData }: RevenueChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build a lookup map for PTO loss by month
  const ptoLossMap = useMemo(() => {
    const map = new Map<string, number>();
    if (ptoLossData) {
      for (const d of ptoLossData) {
        map.set(d.month, d.lostRevenue);
      }
    }
    return map;
  }, [ptoLossData]);

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: formatMonth(d.month),
        total: d.revenue + d.plannedRevenue,
        ptoInfluence: ptoLossMap.get(d.month) || 0,
      })),
    [data, ptoLossMap]
  );

  const hasPTOInfluence = chartData.some((d) => d.ptoInfluence > 0);

  const hasPlanned = chartData.some((d) => d.plannedRevenue > 0);

  // Calculate the chart width based on number of months
  const chartWidth = Math.max(
    chartData.length * BAR_WIDTH + Y_AXIS_WIDTH + RIGHT_PADDING,
    600
  );

  // Determine the current month index to scroll to
  const currentMonthIndex = useMemo(() => {
    if (currentMonth) {
      return data.findIndex((d) => d.month === currentMonth);
    }
    // Default: find current month from Date
    const now = new Date();
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return data.findIndex((d) => d.month === nowStr);
  }, [data, currentMonth]);

  // Scroll so the current month is visible (roughly centered)
  useEffect(() => {
    if (scrollRef.current && currentMonthIndex >= 0) {
      const targetX = currentMonthIndex * BAR_WIDTH + Y_AXIS_WIDTH;
      const containerWidth = scrollRef.current.clientWidth;
      // Position current month roughly in the center-right area
      const scrollTo = Math.max(0, targetX - containerWidth / 2);
      scrollRef.current.scrollLeft = scrollTo;
    }
  }, [currentMonthIndex, chartData.length]);

  // Compute the max Y value across all data for a consistent Y-axis
  const maxY = useMemo(() => {
    let max = 0;
    for (const d of chartData) {
      const total = d.revenue + d.plannedRevenue;
      if (total > max) max = total;
    }
    // Round up to a nice number for the axis
    if (max === 0) return 100;
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / magnitude) * magnitude;
  }, [chartData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Revenue Trend</CardTitle>
        <p className="text-xs text-muted-foreground">
          {hasPlanned && (
            <>Planned revenue is calculated as 8 hours/day &times; business days &times; person rate. </>
          )}
          {hasPTOInfluence && (
            <>PTO influence shows revenue impact of personal time off. </>
          )}
          {hasPlanned && <>Scroll right to see future months.</>}
        </p>
      </CardHeader>
      <CardContent>
        <div
          ref={scrollRef}
          className="overflow-x-auto"
          style={{ height: CHART_HEIGHT + 20 }}
        >
          <ComposedChart
            width={chartWidth}
            height={CHART_HEIGHT}
            data={chartData}
            margin={{ top: 5, right: RIGHT_PADDING, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={Y_AXIS_WIDTH}
              domain={[0, maxY]}
            />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Tooltip
              content={({ active, payload, label }: any) => {
                if (!active || !payload || payload.length === 0) return null;
                const actual = payload.find(
                  (p: any) => p.dataKey === "revenue"
                );
                const planned = payload.find(
                  (p: any) => p.dataKey === "plannedRevenue"
                );
                const total = payload.find(
                  (p: any) => p.dataKey === "total"
                );
                const pto = payload.find(
                  (p: any) => p.dataKey === "ptoInfluence"
                );
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
                    <p className="font-medium mb-1.5">{String(label)}</p>
                    {actual && actual.value > 0 && (
                      <p className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm"
                          style={{ backgroundColor: "var(--chart-1)" }}
                        />
                        Actual: {formatCurrencyFull(actual.value)}
                      </p>
                    )}
                    {planned && planned.value > 0 && (
                      <p className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm"
                          style={{ backgroundColor: "var(--chart-4)" }}
                        />
                        Planned: {formatCurrencyFull(planned.value)}
                      </p>
                    )}
                    {total && (actual?.value > 0 || planned?.value > 0) && (
                      <p className="flex items-center gap-2 mt-1 pt-1 border-t font-medium">
                        <span
                          className="w-2.5 h-2.5 rounded-sm"
                          style={{ backgroundColor: "var(--chart-2)" }}
                        />
                        Total: {formatCurrencyFull(total.value)}
                      </p>
                    )}
                    {pto && pto.value > 0 && (
                      <p className="flex items-center gap-2 mt-1 pt-1 border-t text-destructive">
                        <span
                          className="w-2.5 h-2.5 rounded-sm"
                          style={{ backgroundColor: "var(--chart-5)", opacity: 0.35 }}
                        />
                        PTO Influence: {formatCurrencyFull(pto.value)}
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  revenue: "Actual Revenue",
                  plannedRevenue: "Planned Revenue",
                  total: "Total Revenue",
                  ptoInfluence: "PTO Influence",
                };
                return (
                  <span className="text-xs text-muted-foreground">
                    {labels[value] || value}
                  </span>
                );
              }}
            />

            {/* Stacked bars: Actual on bottom, Planned on top */}
            <Bar
              dataKey="revenue"
              stackId="revenue"
              fill="var(--chart-1)"
              radius={hasPlanned ? [0, 0, 0, 0] : [4, 4, 0, 0]}
              opacity={0.85}
              name="revenue"
            />
            {hasPlanned && (
              <Bar
                dataKey="plannedRevenue"
                stackId="revenue"
                fill="var(--chart-4)"
                radius={[4, 4, 0, 0]}
                opacity={0.7}
                name="plannedRevenue"
              />
            )}
            {/* PTO Influence: superimposed light bar showing revenue lost to PTO */}
            {hasPTOInfluence && (
              <Bar
                dataKey="ptoInfluence"
                fill="var(--chart-5)"
                radius={[4, 4, 0, 0]}
                opacity={0.25}
                name="ptoInfluence"
              />
            )}
            {/* Trend line showing total (actual + planned) */}
            <Line
              type="monotone"
              dataKey="total"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
              name="total"
            />
          </ComposedChart>
        </div>
      </CardContent>
    </Card>
  );
}
