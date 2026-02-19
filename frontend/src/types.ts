export interface CrontabSummary {
  id: string;
  name: string;
  tags: string[];
  job_count: number;
  created_at: string;
  updated_at: string;
}

export interface ParsedJob {
  line_number: number;
  raw_line: string;
  schedule: string;
  command: string;
  enabled: boolean;
  error: string | null;
}

export interface CrontabResponse {
  id: string;
  name: string;
  raw_text: string;
  tags: string[];
  jobs: ParsedJob[];
  warnings: string[];
  created_at: string;
  updated_at: string;
}

export interface OccurrenceItem {
  schedule: string;
  command: string;
  enabled: boolean;
  at: string;
}

export interface OccurrencesResponse {
  from_dt: string;
  to_dt: string;
  occurrences: OccurrenceItem[];
}

export interface HeatmapCell {
  hour: number;
  day: number;
  count: number;
}

export interface HeatmapResponse {
  from_dt: string;
  to_dt: string;
  data: HeatmapCell[];
  max_count: number;
}
