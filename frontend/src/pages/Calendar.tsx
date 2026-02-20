import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { EventContentArg, EventInput, EventSourceFuncArg } from "@fullcalendar/core";
import { Eye, EyeOff } from "lucide-react";

import { ViewLayout } from "@/components/ViewLayout";
import { api, getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Color palette — assigned per unique schedule string via hash
// ---------------------------------------------------------------------------

const PALETTE = [
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#06b6d4", // cyan-500
  "#ec4899", // pink-500
  "#84cc16", // lime-500
];

function hashColor(schedule: string): string {
  let h = 0;
  for (let i = 0; i < schedule.length; i++) {
    h = (h * 31 + schedule.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

// ---------------------------------------------------------------------------
// Stable event content renderer — defined outside the component so its
// reference never changes between renders, preventing FullCalendar from
// re-rendering all event DOM nodes on unrelated state updates.
//
// Layout note: eventContent JSX is placed inside FullCalendar's
// `.fc-event-main` wrapper. We deliberately avoid FullCalendar's internal
// `.fc-event-main-frame` class as the outer wrapper, because it omits the
// `.fc-event-title-container` intermediary that carries `flex-shrink:1;
// min-width:0` in FullCalendar's stylesheet. Without that wrapper the title
// span cannot shrink below its content width, causing text to overflow into
// adjacent cells in dayGridMonth. Plain flex + overflow:hidden + min-w-0 on
// the title span is the minimal correct fix.
// ---------------------------------------------------------------------------

function renderEventContent(arg: EventContentArg) {
  const enabled = arg.event.extendedProps.enabled as boolean;
  return (
    <div
      className="flex items-center overflow-hidden w-full"
      style={{ opacity: enabled ? 1 : 0.45 }}
      title={[
        arg.event.extendedProps.schedule as string,
        (arg.event.extendedProps.command as string) || null,
        (arg.event.extendedProps.description as string) || null,
      ]
        .filter(Boolean)
        .join("\n")}
    >
      {arg.timeText && (
        <span className="fc-event-time shrink-0">{arg.timeText}</span>
      )}
      <span className="flex-1 min-w-0 truncate px-1">{arg.event.title}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event fetcher factory
// Accepts refs so the closure always reads the latest values without
// needing to be recreated (which would cause FullCalendar to refetch on
// every render). Noisy filtering is delegated to the backend via hide_noisy.
// ---------------------------------------------------------------------------

function makeEventsFetcher(
  id: string,
  showNoisy: boolean,
  setNoisyCount: (n: number) => void
) {
  return async (
    info: EventSourceFuncArg,
    successCallback: (events: EventInput[]) => void,
    failureCallback: (error: Error) => void
  ) => {
    try {
      const res = await api.occurrences.list(id, {
        from_dt: info.startStr,
        to_dt: info.endStr,
        limit: 5000,
        hide_noisy: !showNoisy,
      });

      setNoisyCount(res.filtered_noisy_count);

      const events: EventInput[] = res.occurrences.map((occ) => ({
        title: occ.description || occ.command || occ.schedule,
        start: occ.at,
        backgroundColor: hashColor(occ.schedule),
        borderColor: hashColor(occ.schedule),
        textColor: "#ffffff",
        extendedProps: {
          schedule: occ.schedule,
          command: occ.command,
          enabled: occ.enabled,
          description: occ.description,
        },
      }));

      successCallback(events);
    } catch (err) {
      failureCallback(
        err instanceof Error ? err : new Error(getErrorMessage(err))
      );
    }
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Calendar() {
  const { id } = useParams<{ id: string }>();
  const calendarRef = useRef<FullCalendar>(null);

  const [showNoisy, setShowNoisy] = useState(false);
  const [noisyCount, setNoisyCount] = useState(0);

  // Stable fetcher — only recreated if `id` changes.
  // Pass a wrapper for setNoisyCount that only updates when > 0, so the
  // toggle button stays visible after switching to showNoisy=true (which
  // causes the backend to return filtered_noisy_count=0).
  const eventsFetcher = useMemo(
    () => makeEventsFetcher(id!, showNoisy, (n) => { if (n > 0) setNoisyCount(n); }),
    [id, showNoisy]
  );

  // Trigger the refetch AFTER React has committed the state update for
  // showNoisy. Calling refetchEvents() synchronously inside toggleNoisy would
  // race with React's reconciliation pass (especially in month view where
  // FullCalendar's DOM update is heavier), causing visual corruption.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    calendarRef.current?.getApi().refetchEvents();
  }, [showNoisy]);

  const toggleNoisy = () => {
    setShowNoisy((s) => !s); // refetch is triggered by the useEffect above
  };

  if (!id) return null;

  return (
    <ViewLayout activeView="calendar">
      {/* FullCalendar global style overrides */}
      <style>{`
        .fc .fc-button-primary {
          background-color: var(--primary);
          border-color: var(--primary);
          color: var(--primary-foreground);
        }
        .fc .fc-button-primary:hover {
          background-color: color-mix(in oklab, var(--primary) 90%, black);
          border-color: color-mix(in oklab, var(--primary) 90%, black);
          color: var(--primary-foreground);
        }
        .fc .fc-button-primary:not(:disabled):active,
        .fc .fc-button-primary.fc-button-active {
          background-color: color-mix(in oklab, var(--primary) 80%, black);
          border-color: color-mix(in oklab, var(--primary) 80%, black);
          color: var(--primary-foreground);
        }
        .fc .fc-button-primary:disabled {
          background-color: var(--muted);
          border-color: var(--muted);
          color: var(--muted-foreground);
        }
        .fc-theme-standard td, .fc-theme-standard th {
          border-color: var(--border);
        }
        .fc-theme-standard .fc-scrollgrid {
          border-color: var(--border);
        }
        .fc .fc-col-header-cell-cushion,
        .fc .fc-daygrid-day-number {
          color: var(--foreground);
        }
        .fc .fc-day-today {
          background-color: color-mix(in oklab, var(--accent) 30%, transparent) !important;
        }
        .fc .fc-event {
          cursor: default;
        }
        .fc .fc-toolbar-title {
          font-size: 1rem;
          font-weight: 600;
        }
        .fc .fc-more-link {
          color: var(--muted-foreground);
          font-size: 0.7rem;
        }
        /* Prevent the global a{color:#646cff; font-weight:500} rule in
           index.css from overriding event link colours and widening text. */
        .fc a, .fc a:hover {
          color: inherit;
          font-weight: inherit;
        }
      `}</style>

      {/* Noisy toggle — shown once we know there are noisy schedules */}
      {noisyCount > 0 && (
        <div className="flex justify-end mb-3">
          <button
            onClick={toggleNoisy}
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
        </div>
      )}

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek",
        }}
        buttonText={{
          today: "Today",
          month: "Month",
          week: "Week",
        }}
        height="auto"
        dayMaxEvents={4}
        events={eventsFetcher}
        eventTimeFormat={{
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }}
        eventContent={renderEventContent}
        lazyFetching
      />
    </ViewLayout>
  );
}
