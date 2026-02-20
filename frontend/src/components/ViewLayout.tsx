import { type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, Clock, Grid3X3, ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export type ViewKey = "timeline" | "heatmap" | "calendar" | "raw";

const VIEWS: { key: ViewKey; label: string; Icon: typeof Clock }[] = [
  { key: "timeline", label: "Timeline", Icon: Clock },
  { key: "heatmap", label: "Heatmap", Icon: Grid3X3 },
  { key: "calendar", label: "Calendar", Icon: CalendarDays },
  { key: "raw", label: "Raw", Icon: ScrollText },
];

interface ViewLayoutProps {
  children: ReactNode;
  activeView: ViewKey;
}

export function ViewLayout({ children, activeView }: ViewLayoutProps) {
  const { id } = useParams<{ id: string }>();

  const { data: crontab } = useQuery({
    queryKey: ["crontab", id],
    queryFn: () => api.crontabs.get(id!),
    enabled: !!id,
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3 min-w-0">
          {/* Back */}
          <Link
            to="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>

          <span className="text-muted-foreground/50 shrink-0">/</span>

          {/* Crontab name */}
          <span className="text-sm font-semibold truncate min-w-0 flex-1">
            {crontab?.name ?? "…"}
          </span>

          {/* View tabs */}
          <nav className="flex items-center gap-0.5 shrink-0">
            {VIEWS.map(({ key, label, Icon }) => (
              <Button
                key={key}
                size="sm"
                variant="ghost"
                className={cn(
                  "gap-1.5",
                  activeView === key &&
                    "bg-accent text-accent-foreground font-medium"
                )}
                asChild
              >
                <Link to={`/crontabs/${id}/${key}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              </Button>
            ))}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-6xl mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
