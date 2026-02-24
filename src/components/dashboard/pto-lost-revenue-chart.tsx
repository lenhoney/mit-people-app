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

interface PTOLossData {
  month: string;
  lostRevenue: number;
}

interface PTOLostRevenueChartProps {
  data: PTOLossData[];
  currentMonth?: string;
}

const BAR_WIDTH = 64;
const Y_AXIS_WIDTH = 60;
const CHART_HEIGHT = 300;
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

export function PTOLostRevenueChart({ data, currentMonth }: PTOLostRevenueChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: formatMonth(d.month),
      })),
    [data]
  );

  const chartWidth = Math.max(
    chartData.length * BAR_WIDTH + Y_AXIS_WIDTH + RIGHT_PADDING,
    600
  );

  const currentMonthIndex = useMemo(() => {
    if (currentMonth) {
      return data.findIndex((d) => d.month === currentMonth);
    }
    const now = new Date();
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return data.findIndex((d) => d.month === nowStr);
  }, [data, currentMonth]);

  useEffect(() => {
    if (scrollRef.current && currentMonthIndex >= 0) {
      const targetX = currentMonthIndex * BAR_WIDTH + Y_AXIS_WIDTH;
      const containerWidth = scrollRef.current.clientWidth;
      const scrollTo = Math.max(0, targetX - containerWidth / 2);
      scrollRef.current.scrollLeft = scrollTo;
    }
  }, [currentMonthIndex, chartData.length]);

  const maxY = useMemo(() => {
    let max = 0;
    for (const d of chartData) {
      if (d.lostRevenue > max) max = d.lostRevenue;
    }
    if (max === 0) return 100;
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / magnitude) * magnitude;
  }, [chartData]);

  const totalLost = useMemo(
    () => chartData.reduce((sum, d) => sum + d.lostRevenue, 0),
    [chartData]
  );

  const hasData = chartData.some((d) => d.lostRevenue > 0);

  if (!hasData) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Monthly PTO Lost Revenue</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue impact of personal time off per month (billable days &times; 8 hours &times; person rate)
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground">Total Lost Revenue</span>
            <p className="text-lg font-bold text-destructive">{formatCurrencyFull(totalLost)}</p>
          </div>
        </div>
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
                const lost = payload.find(
                  (p: any) => p.dataKey === "lostRevenue"
                );
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
                    <p className="font-medium mb-1.5">{String(label)}</p>
                    {lost && lost.value > 0 && (
                      <p className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm"
                          style={{ backgroundColor: "var(--chart-5)" }}
                        />
                        Lost Revenue: {formatCurrencyFull(lost.value)}
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
                  lostRevenue: "PTO Lost Revenue",
                };
                return (
                  <span className="text-xs text-muted-foreground">
                    {labels[value] || value}
                  </span>
                );
              }}
            />

            <Bar
              dataKey="lostRevenue"
              fill="var(--chart-5)"
              radius={[4, 4, 0, 0]}
              opacity={0.85}
              name="lostRevenue"
            />
            <Line
              type="monotone"
              dataKey="lostRevenue"
              stroke="var(--chart-3)"
              strokeWidth={2}
              dot={false}
              name="trend"
              legendType="none"
            />
          </ComposedChart>
        </div>
      </CardContent>
    </Card>
  );
}
