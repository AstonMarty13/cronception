import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ViewLayout } from "@/components/ViewLayout";
import { api, getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { OccurrenceItem } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANGE_OPTIONS = [
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

const LIMIT = 5000;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function toHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Key used for day-grouping — local date string, stable within a day. */
function toDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Group occurrences by local calendar day
// ---------------------------------------------------------------------------

function groupByDay(
  occurrences: OccurrenceItem[]
): Array<{ label: string; items: OccurrenceItem[] }> {
  const map = new Map<string, OccurrenceItem[]>();
  for (const occ of occurrences) {
    const key = toDayKey(occ.at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(occ);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

// ---------------------------------------------------------------------------
// Range selector
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

// ---------------------------------------------------------------------------
// Day group table
// ---------------------------------------------------------------------------

interface DayGroupProps {
  label: string;
  items: OccurrenceItem[];
}

function DayGroup({ label, items }: DayGroupProps) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
        {label}
      </h3>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <tbody>
            {items.map((occ, i) => (
              <tr
                key={i}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                {/* Time */}
                <td className="px-4 py-2.5 w-14 tabular-nums font-mono text-xs text-muted-foreground whitespace-nowrap">
                  {toHHMM(occ.at)}
                </td>

                {/* Schedule badge */}
                <td className="px-4 py-2.5 w-44 whitespace-nowrap">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
                    {occ.schedule}
                  </span>
                </td>

                {/* Command — truncates on overflow */}
                <td
                  className="px-4 py-2.5 font-mono text-xs text-muted-foreground max-w-0 w-full truncate"
                  title={occ.command || undefined}
                >
                  {occ.command || (
                    <span className="italic opacity-40">no command</span>
                  )}
                </td>

                {/* Enabled indicator */}
                <td className="px-4 py-2.5 w-6 text-right">
                  <span
                    title={occ.enabled ? "Enabled" : "Disabled"}
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      occ.enabled ? "bg-green-500" : "bg-muted-foreground/30"
                    )}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Timeline() {
  const { id } = useParams<{ id: string }>();
  const [days, setDays] = useState(30);

  const { data, isLoading, error } = useQuery({
    queryKey: ["timeline", id, days],
    queryFn: () => {
      const now = new Date();
      return api.occurrences.timeline(id!, {
        from_dt: now.toISOString(),
        to_dt: new Date(now.getTime() + days * 86_400_000).toISOString(),
        limit: LIMIT,
      });
    },
    enabled: !!id,
    staleTime: 60_000,
  });

  const groups = useMemo(
    () => groupByDay(data?.occurrences ?? []),
    [data]
  );

  const count = data?.occurrences.length ?? 0;
  const truncated = count >= LIMIT;

  return (
    <ViewLayout activeView="timeline">
      {/* Toolbar */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-base font-semibold">Upcoming runs</h2>
          {!isLoading && !error && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {count === 0
                ? `No runs scheduled in the next ${days} day${days > 1 ? "s" : ""}.`
                : `${count.toLocaleString()}${truncated ? "+" : ""} run${count !== 1 ? "s" : ""} over ${days} day${days > 1 ? "s" : ""}`}
            </p>
          )}
        </div>
        <RangeSelector value={days} onChange={setDays} />
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

      {/* Truncation notice */}
      {truncated && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
          Showing the first {LIMIT.toLocaleString()} runs. Narrow the date range to see all results.
        </div>
      )}

      {/* Day groups */}
      {!isLoading && !error && groups.length > 0 && (
        <div className="space-y-6">
          {groups.map(({ label, items }) => (
            <DayGroup key={label} label={label} items={items} />
          ))}
        </div>
      )}
    </ViewLayout>
  );
}
