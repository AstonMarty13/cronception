import axios, { AxiosError } from "axios";
import type {
  CrontabSummary,
  CrontabResponse,
  OccurrencesResponse,
  HeatmapResponse,
} from "@/types";

const http = axios.create({ baseURL: "/api" });

/** Extract a human-readable error message from an Axios error. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    return (
      (err.response?.data as { detail?: string })?.detail ??
      err.message ??
      "Unknown error"
    );
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

export const api = {
  crontabs: {
    list: (): Promise<CrontabSummary[]> =>
      http.get("/crontabs").then((r) => r.data),

    create: (data: {
      name: string;
      raw_text: string;
      tags?: string[];
    }): Promise<CrontabResponse> =>
      http.post("/crontabs", data).then((r) => r.data),

    get: (id: string): Promise<CrontabResponse> =>
      http.get(`/crontabs/${id}`).then((r) => r.data),

    update: (
      id: string,
      data: { name?: string; raw_text?: string; tags?: string[] }
    ): Promise<CrontabResponse> =>
      http.put(`/crontabs/${id}`, data).then((r) => r.data),

    remove: (id: string): Promise<void> =>
      http.delete(`/crontabs/${id}`).then(() => undefined),
  },

  occurrences: {
    list: (
      id: string,
      params: { from_dt?: string; to_dt?: string; limit?: number }
    ): Promise<OccurrencesResponse> =>
      http.post(`/crontabs/${id}/occurrences`, params).then((r) => r.data),

    timeline: (
      id: string,
      params: { from_dt?: string; to_dt?: string; limit?: number }
    ): Promise<OccurrencesResponse> =>
      http
        .post(`/crontabs/${id}/aggregate/timeline`, params)
        .then((r) => r.data),

    heatmap: (
      id: string,
      params: { from_dt?: string; to_dt?: string }
    ): Promise<HeatmapResponse> =>
      http
        .post(`/crontabs/${id}/aggregate/heatmap`, params)
        .then((r) => r.data),
  },
};
