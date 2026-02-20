import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";

import { ViewLayout } from "@/components/ViewLayout";
import { api, getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lineCount(text: string): number {
  return text ? text.split("\n").length : 0;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Raw() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: crontab, isLoading } = useQuery({
    queryKey: ["crontab", id],
    queryFn: () => api.crontabs.get(id!),
    enabled: !!id,
    staleTime: 60_000,
  });

  // Drafts per crontab id to avoid state syncing in effects.
  const [draftById, setDraftById] = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const savedText = crontab?.raw_text ?? "";
  const draftText = id ? draftById[id] : undefined;
  const currentText = draftText ?? savedText;
  const isDirty = draftText !== undefined && currentText !== savedText;

  // Save mutation
  const { mutate: save, isPending: isSaving, error: saveError, reset: resetError } = useMutation({
    mutationFn: () => api.crontabs.update(id!, { raw_text: currentText }),
    onSuccess: (updated) => {
      // Update the cache directly so ViewLayout and other views reflect the change
      queryClient.setQueryData(["crontab", id], updated);
      // Clear draft for this crontab (marks clean)
      if (id) {
        setDraftById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
      // Invalidate the crontabs list so job_count is fresh on home
      void queryClient.invalidateQueries({ queryKey: ["crontabs"] });
    },
  });

  const handleSave = useCallback(() => {
    if (!isDirty || isSaving) return;
    resetError();
    save();
  }, [isDirty, isSaving, save, resetError]);

  // Ctrl/Cmd + S shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [currentText]);

  // Parsed warnings/errors from the cached crontab (re-parsed on each save)
  const warnings = crontab?.warnings ?? [];
  const jobs = crontab?.jobs ?? [];
  const errorJobs = jobs.filter((j) => j.error !== null);
  const disabledJobs = jobs.filter((j) => !j.enabled && j.error === null);

  return (
    <ViewLayout activeView="raw">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-semibold">Raw editor</h2>
          {!isLoading && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {jobs.length} job{jobs.length !== 1 ? "s" : ""}
              {" · "}
              {lineCount(savedText)} line{lineCount(savedText) !== 1 ? "s" : ""}
              {isDirty && (
                <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                  Unsaved changes
                </span>
              )}
            </p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className={cn(
            "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border font-medium transition-colors",
            isDirty && !isSaving
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              : "bg-muted text-muted-foreground border-border cursor-not-allowed"
          )}
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Textarea */}
      <div
        className={cn(
          "rounded-lg border overflow-hidden",
          isDirty && "border-amber-300 dark:border-amber-700"
        )}
      >
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <textarea
            ref={textareaRef}
            value={currentText}
            onChange={(e) => {
              if (!id) return;
              const value = e.target.value;
              setDraftById((prev) => ({ ...prev, [id]: value }));
              resetError();
            }}
            spellCheck={false}
            className="w-full min-h-[320px] resize-none bg-muted/20 p-4 font-mono text-xs leading-relaxed text-foreground focus:outline-none"
            placeholder="# Paste your crontab here…"
          />
        )}
      </div>

      {/* Save error */}
      {saveError && (
        <div className="mt-3 text-sm text-destructive">
          {getErrorMessage(saveError)}
        </div>
      )}

      {/* Parse info — shown after data is loaded */}
      {!isLoading && (warnings.length > 0 || errorJobs.length > 0 || disabledJobs.length > 0) && (
        <div className="mt-4 space-y-2">
          {/* Warnings */}
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
            >
              <span className="shrink-0 font-semibold">⚠</span>
              <span>{w}</span>
            </div>
          ))}

          {/* Disabled jobs summary */}
          {disabledJobs.length > 0 && (
            <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
              {disabledJobs.length} commented-out job{disabledJobs.length !== 1 ? "s" : ""} (disabled)
            </div>
          )}
        </div>
      )}
    </ViewLayout>
  );
}
