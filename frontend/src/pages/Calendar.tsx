import { useRef } from "react";
import { useParams } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { EventInput, EventSourceFuncArg } from "@fullcalendar/core";

import { ViewLayout } from "@/components/ViewLayout";
import { api, getErrorMessage } from "@/lib/api";

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
// Event fetcher
// ---------------------------------------------------------------------------

function makeEventsFetcher(id: string) {
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
      });

      const events: EventInput[] = res.occurrences.map((occ) => ({
        title: occ.command || occ.schedule,
        start: occ.at,
        backgroundColor: hashColor(occ.schedule),
        borderColor: hashColor(occ.schedule),
        textColor: "#ffffff",
        extendedProps: { schedule: occ.schedule, command: occ.command, enabled: occ.enabled },
      }));

      successCallback(events);
    } catch (err) {
      failureCallback(err instanceof Error ? err : new Error(getErrorMessage(err)));
    }
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Calendar() {
  const { id } = useParams<{ id: string }>();
  const calendarRef = useRef<FullCalendar>(null);

  if (!id) return null;

  return (
    <ViewLayout activeView="calendar">
      {/* FullCalendar global style overrides */}
      <style>{`
        .fc .fc-button-primary {
          background-color: hsl(var(--primary));
          border-color: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
        }
        .fc .fc-button-primary:hover {
          background-color: hsl(var(--primary) / 0.9);
          border-color: hsl(var(--primary) / 0.9);
        }
        .fc .fc-button-primary:not(:disabled):active,
        .fc .fc-button-primary.fc-button-active {
          background-color: hsl(var(--primary) / 0.8);
          border-color: hsl(var(--primary) / 0.8);
        }
        .fc .fc-button-primary:disabled {
          background-color: hsl(var(--muted));
          border-color: hsl(var(--muted));
          color: hsl(var(--muted-foreground));
        }
        .fc-theme-standard td, .fc-theme-standard th {
          border-color: hsl(var(--border));
        }
        .fc-theme-standard .fc-scrollgrid {
          border-color: hsl(var(--border));
        }
        .fc .fc-col-header-cell-cushion,
        .fc .fc-daygrid-day-number {
          color: hsl(var(--foreground));
        }
        .fc .fc-day-today {
          background-color: hsl(var(--accent) / 0.3) !important;
        }
        .fc .fc-event {
          cursor: default;
        }
        .fc .fc-toolbar-title {
          font-size: 1rem;
          font-weight: 600;
        }
        .fc .fc-more-link {
          color: hsl(var(--muted-foreground));
          font-size: 0.7rem;
        }
      `}</style>

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
        events={makeEventsFetcher(id)}
        eventTimeFormat={{
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }}
        eventContent={(arg) => {
          const enabled = arg.event.extendedProps.enabled as boolean;
          return (
            <div
              className="fc-event-main-frame"
              style={{ opacity: enabled ? 1 : 0.45 }}
              title={`${arg.event.extendedProps.schedule as string}${arg.event.extendedProps.command ? `  ${arg.event.extendedProps.command as string}` : ""}`}
            >
              <span className="fc-event-time">{arg.timeText}</span>
              <span className="fc-event-title px-1 truncate">{arg.event.title}</span>
            </div>
          );
        }}
        noEventsContent="No runs scheduled for this period."
        lazyFetching
      />
    </ViewLayout>
  );
}
