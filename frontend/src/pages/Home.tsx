import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { CalendarDays, Clock, Grid3X3, ScrollText, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, getErrorMessage } from "@/lib/api";
import type { CrontabSummary } from "@/types";

// ---------------------------------------------------------------------------
// Import form
// ---------------------------------------------------------------------------

function ImportForm() {
  const [name, setName] = useState("");
  const [rawText, setRawText] = useState("");
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: api.crontabs.create,
    onSuccess: () => {
      setName("");
      setRawText("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      queryClient.invalidateQueries({ queryKey: ["crontabs"] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !rawText.trim()) return;
    mutation.mutate({ name: name.trim(), raw_text: rawText.trim() });
  }

  return (
    <Card className="md:sticky md:top-6">
      <CardHeader>
        <CardTitle>Import crontab</CardTitle>
        <CardDescription>
          Paste your crontab content to save and visualize it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="crontab-name"
              className="text-sm font-medium leading-none"
            >
              Name
            </label>
            <Input
              id="crontab-name"
              placeholder="Production server"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="crontab-content"
              className="text-sm font-medium leading-none"
            >
              Content
            </label>
            <textarea
              id="crontab-content"
              className="w-full min-h-[220px] p-3 border rounded-md bg-background text-xs font-mono
                         resize-y focus:outline-none focus:ring-2 focus:ring-ring
                         placeholder:text-muted-foreground"
              placeholder={"# Paste your crontab here\n@daily /usr/bin/backup\n*/5 * * * * /usr/bin/check"}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              required
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-destructive">
              {getErrorMessage(mutation.error)}
            </p>
          )}

          {success && (
            <p className="text-sm text-green-600 dark:text-green-400">
              Crontab imported successfully.
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending || !name.trim() || !rawText.trim()}
          >
            {mutation.isPending ? "Importing…" : "Import"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Single crontab card
// ---------------------------------------------------------------------------

interface CrontabCardProps {
  crontab: CrontabSummary;
  confirmDelete: string | null;
  isDeleting: boolean;
  onDeleteRequest: (id: string) => void;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
}

function CrontabCard({
  crontab,
  confirmDelete,
  isDeleting,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: CrontabCardProps) {
  const isPendingDelete = confirmDelete === crontab.id;

  return (
    <Card>
      <CardContent className="p-5">
        {/* Top row: name + delete action */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold truncate">{crontab.name}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {crontab.job_count} job{crontab.job_count !== 1 ? "s" : ""}
            </p>
            {crontab.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {crontab.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-1.5 py-0.5 bg-muted rounded-sm text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Delete control */}
          {isPendingDelete ? (
            <div className="flex gap-1.5 shrink-0 pt-0.5">
              <Button
                size="sm"
                variant="destructive"
                disabled={isDeleting}
                onClick={() => onDeleteConfirm(crontab.id)}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onDeleteCancel}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDeleteRequest(crontab.id)}
              aria-label="Delete crontab"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* View buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button size="sm" variant="outline" asChild>
            <Link to={`/crontabs/${crontab.id}/timeline`}>
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              Timeline
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/crontabs/${crontab.id}/heatmap`}>
              <Grid3X3 className="h-3.5 w-3.5 mr-1.5" />
              Heatmap
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/crontabs/${crontab.id}/calendar`}>
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
              Calendar
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/crontabs/${crontab.id}/raw`}>
              <ScrollText className="h-3.5 w-3.5 mr-1.5" />
              Raw
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Crontab list
// ---------------------------------------------------------------------------

function CrontabList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["crontabs"],
    queryFn: api.crontabs.list,
  });

  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: api.crontabs.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crontabs"] });
      setConfirmDelete(null);
    },
  });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive py-8 text-center">
        Failed to load crontabs — {getErrorMessage(error)}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Clock className="h-10 w-10 mb-3 opacity-25" />
        <p className="font-medium">No crontabs yet</p>
        <p className="text-sm mt-1">
          Import your first crontab to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {data.length} crontab{data.length !== 1 ? "s" : ""}
      </p>
      {data.map((crontab) => (
        <CrontabCard
          key={crontab.id}
          crontab={crontab}
          confirmDelete={confirmDelete}
          isDeleting={
            deleteMutation.isPending && confirmDelete === crontab.id
          }
          onDeleteRequest={(id) => setConfirmDelete(id)}
          onDeleteConfirm={(id) => deleteMutation.mutate(id)}
          onDeleteCancel={() => setConfirmDelete(null)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-lg font-bold tracking-tight">CronCeption</h1>
          <p className="text-sm text-muted-foreground">
            Visualize your crontab in seconds.
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-[380px_1fr] gap-8 items-start">
          <ImportForm />
          <CrontabList />
        </div>
      </main>
    </div>
  );
}
