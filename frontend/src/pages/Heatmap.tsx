import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import ReactECharts from "echarts-for-react";

import { ViewLayout } from "@/components/ViewLayout";
import { api, getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { HeatmapCell } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANGE_OPTIONS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS_FULL = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0")
);

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

/** Build a dense 24×7 array from sparse cells; missing cells are 0. */
function buildChartData(
  cells: HeatmapCell[]
): Array<[number, number, number]> {
  const map = new Map<string, number>();
  for (const c of cells) map.set(`${c.hour},${c.day}`, c.count);

  const result: Array<[number, number, number]> = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      result.push([hour, day, map.get(`${hour},${day}`) ?? 0]);
    }
  }
  return result;
}

interface Stats {
  total: number;
  peakHour: { hour: number; count: number } | null;
  peakDay: { day: number; count: number } | null;
}

function computeStats(cells: HeatmapCell[]): Stats {
  if (!cells.length) return { total: 0, peakHour: null, peakDay: null };

  const total = cells.reduce((s, c) => s + c.count, 0);

  const byHour = new Array<number>(24).fill(0);
  const byDay = new Array<number>(7).fill(0);
  for (const c of cells) {
    byHour[c.hour] += c.count;
    byDay[c.day] += c.count;
  }

  const maxHourVal = Math.max(...byHour);
  const maxDayVal = Math.max(...byDay);

  return {
    total,
    peakHour: maxHourVal > 0 ? { hour: byHour.indexOf(maxHourVal), count: maxHourVal } : null,
    peakDay: maxDayVal > 0 ? { day: byDay.indexOf(maxDayVal), count: maxDayVal } : null,
  };
}

// ---------------------------------------------------------------------------
// ECharts option builder
// ---------------------------------------------------------------------------

function buildOption(
  chartData: Array<[number, number, number]>,
  maxCount: number
) {
  return {
    tooltip: {
      position: "top" as const,
      formatter: (params: { value: [number, number, number] }) => {
        const [hour, day, count] = params.value;
        const time = `${String(hour).padStart(2, "0")}:00`;
        return count > 0
          ? `<b>${DAY_LABELS_FULL[day]}</b> at ${time}<br/>${count} run${count !== 1 ? "s" : ""}`
          : `${DAY_LABELS_FULL[day]} at ${time}<br/>No runs`;
      },
    },
    grid: { top: 16, bottom: 36, left: 44, right: 16 },
    xAxis: {
      type: "category" as const,
      data: HOUR_LABELS,
      splitArea: { show: true },
      axisLabel: { fontSize: 11, color: "#94a3b8" },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    yAxis: {
      type: "category" as const,
      data: DAY_LABELS,
      inverse: true, // Monday at top
      splitArea: { show: true },
      axisLabel: { fontSize: 11, color: "#94a3b8" },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    visualMap: {
      min: 0,
      max: Math.max(maxCount, 1),
      show: false,
      inRange: {
        color: ["#eff6ff", "#1d4ed8"],
      },
    },
    series: [
      {
        type: "heatmap" as const,
        data: chartData,
        emphasis: {
          itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,.2)" },
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RangeSelectorProps {
  value: number;
  onChange: (days: number) => void;
}

function RangeSelector({ value, onChange }: RangeSelectorProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border p-0.5 bg-muted/40">
      {RANGE_OPTIONS.map(({ label, days }) => (
        <button
          key={days}
          onClick={() => onChange(days)}
          className={cn(
            "px-3 py-1 text-xs rounded-sm transition-colors",
            value === days
              ? "bg-background text-foreground shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
      {sub && (
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Heatmap() {
  const { id } = useParams<{ id: string }>();
  const [days, setDays] = useState(30);
  const [showNoisy, setShowNoisy] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["heatmap", id, days, showNoisy],
    queryFn: () => {
      const now = new Date();
      return api.occurrences.heatmap(id!, {
        from_dt: now.toISOString(),
        to_dt: new Date(now.getTime() + days * 86_400_000).toISOString(),
        hide_noisy: !showNoisy,
      });
    },
    enabled: !!id,
    staleTime: 60_000,
  });

  const noisyCount = data?.filtered_noisy_count ?? 0;

  const cells = useMemo(() => data?.data ?? [], [data?.data]);
  const maxCount = data?.max_count ?? 0;

  const chartData = useMemo(() => buildChartData(cells), [cells]);
  const chartOption = useMemo(() => buildOption(chartData, maxCount), [chartData, maxCount]);
  const stats = useMemo(() => computeStats(cells), [cells]);
  const hasData = cells.length > 0;

  return (
    <ViewLayout activeView="heatmap">
      {/* Toolbar */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-base font-semibold">Activity heatmap</h2>
          {!isLoading && !error && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {hasData
                ? `${stats.total.toLocaleString()} runs over ${days} day${days > 1 ? "s" : ""}`
                : `No runs in the next ${days} day${days > 1 ? "s" : ""}.`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Noisy toggle */}
          {!isLoading && !error && (showNoisy || noisyCount > 0) && (
            <button
              onClick={() => setShowNoisy((s) => !s)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors",
                showNoisy
                  ? "border-border text-muted-foreground hover:text-foreground"
                  : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
              )}
            >
              {showNoisy ? (
                <>
                  <EyeOff className="h-3 w-3" />
                  Hide frequent
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" />
                  {noisyCount} frequent hidden
                </>
              )}
            </button>
          )}

          <RangeSelector value={days} onChange={setDays} />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-sm text-muted-foreground py-16 text-center">
          Loading…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive py-16 text-center">
          {getErrorMessage(error)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && !hasData && (
        <div className="text-sm text-muted-foreground py-16 text-center">
          No activity to display for the selected period.
        </div>
      )}

      {/* Chart + stats */}
      {!isLoading && !error && (
        <>
          {/* Heatmap */}
          <div className="rounded-lg border p-4 bg-card">
            <ReactECharts
              option={chartOption}
              style={{ height: 280 }}
              className="w-full"
              notMerge
            />
          </div>

          {/* Legend hint */}
          <div className="flex items-center justify-end gap-2 mt-2 text-xs text-muted-foreground">
            <span>Fewer runs</span>
            <div className="flex gap-0.5">
              {["#eff6ff", "#bfdbfe", "#60a5fa", "#2563eb", "#1d4ed8"].map(
                (c) => (
                  <div
                    key={c}
                    className="h-3 w-5 rounded-sm"
                    style={{ backgroundColor: c }}
                  />
                )
              )}
            </div>
            <span>More runs</span>
          </div>

          {/* Stats */}
          {hasData && (
            <div className="grid grid-cols-3 gap-4 mt-6">
              <StatCard
                label="Total runs"
                value={stats.total.toLocaleString()}
              />
              <StatCard
                label="Peak hour"
                value={
                  stats.peakHour !== null
                    ? `${String(stats.peakHour.hour).padStart(2, "0")}:00`
                    : "—"
                }
                sub={
                  stats.peakHour !== null
                    ? `${stats.peakHour.count.toLocaleString()} runs`
                    : undefined
                }
              />
              <StatCard
                label="Busiest day"
                value={
                  stats.peakDay !== null
                    ? DAY_LABELS_FULL[stats.peakDay.day]
                    : "—"
                }
                sub={
                  stats.peakDay !== null
                    ? `${stats.peakDay.count.toLocaleString()} runs`
                    : undefined
                }
              />
            </div>
          )}
        </>
      )}
    </ViewLayout>
  );
}
