// src/hooks/useCompute.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiUrl,
  COMPUTE_PATH,
  COMPUTE_RESULTS_PATH,
  COMPUTE_STATUS_PATH,
  FEEDBACK_PATH,
  ARCHIVE_JOB_PATH,
} from "../config";
import { fetchWithTimeout } from "../lib/http";
import type { FeedbackVars, PairItem } from "../types";

// ============== Types ==============

export type ComputeStatus = {
  running: boolean;
  compute_id: string | null;
  version: number | null;
};

export type ComputeResults = {
  ok: boolean;
  compute_id: string;
  version: number;
  grid: string;
  pairs: PairItem[];
  reviewed_pairs: PairItem[];
  singles: { grid: string; location: string; filename: string }[];
  count: number;
  min_sim: number;
};

export type FeedbackResponse = {
  ok: boolean;
  version: number;
  previous_feedback: string | null;
};

// ============== Hooks ==============

/**
 * Poll compute status while inference is running.
 * Use enabled=true when modal opens, false after results are ready.
 */
export function useComputeStatusQuery(enabled: boolean) {
  return useQuery<ComputeStatus, Error>({
    queryKey: ["compute-status"],
    enabled,
    refetchInterval: enabled ? 5000 : false, // Poll every 5s
    queryFn: async () => {
      const res = await fetchWithTimeout(apiUrl(COMPUTE_STATUS_PATH));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ComputeStatus;
    },
  });
}

/**
 * Fetch and poll compute results for real-time sync across clients.
 * Polls every 3s while enabled.
 */
export function useComputeResultsQuery(
  computeId: string | null,
  enabled: boolean
) {
  return useQuery<ComputeResults, Error>({
    queryKey: ["compute-results", computeId],
    enabled: enabled && !!computeId,
    refetchInterval: enabled ? 3000 : false, // Poll every 3s for sync
    queryFn: async () => {
      const url = computeId
        ? `${apiUrl(COMPUTE_RESULTS_PATH)}?compute_id=${computeId}`
        : apiUrl(COMPUTE_RESULTS_PATH);
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ComputeResults;
    },
  });
}

/**
 * Trigger compute (starts background inference).
 */
export function useComputeMutation() {
  const qc = useQueryClient();
  return useMutation<{ status: string; message?: string }, Error, void>({
    mutationFn: async () => {
      const res = await fetchWithTimeout(apiUrl(COMPUTE_PATH), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate status so it starts polling
      qc.invalidateQueries({ queryKey: ["compute-status"] });
    },
    mutationKey: ["compute.run"],
  });
}

/**
 * Submit feedback on a pair (correct, false_positive, or undo).
 */
export function useFeedbackMutation() {
  const qc = useQueryClient();

  return useMutation<FeedbackResponse, Error, FeedbackVars>({
    mutationFn: async (vars) => {
      const res = await fetchWithTimeout(apiUrl(FEEDBACK_PATH), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return (await res.json()) as FeedbackResponse;
    },
    onSuccess: () => {
      // Invalidate results to trigger refetch (sync with other clients)
      qc.invalidateQueries({ queryKey: ["compute-results"] });
    },
    mutationKey: ["compute.feedback"],
  });
}

/**
 * Archive the current compute job's images.
 */
export function useArchiveJobMutation() {
  return useMutation<{ ok: boolean }, Error, { compute_id: string; discard: boolean }>({
    mutationFn: async (vars) => {
      const res = await fetchWithTimeout(apiUrl(ARCHIVE_JOB_PATH), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return await res.json();
    },
  });
}

