// src/hooks/useCompute.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  apiUrl,
  COMPUTE_PATH,
  COMPUTE_RESULTS_PATH,
  FEEDBACK_PATH,
  ARCHIVE_JOB_PATH,
} from "../config";
import { fetchWithTimeout } from "../lib/http";
import { useWsEvent } from "../providers/WsProvider";
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
 * Subscribe to real-time compute status via WebSocket.
 *
 * Replaces the previous polling-based `useComputeStatusQuery` (5 s interval).
 * Returns `{ data: ComputeStatus }` — same shape as React Query so all
 * existing consumers (App.tsx, ComputeModal.tsx) need no structural changes.
 *
 * Events handled:
 *   snapshot          — initial state on WS connect / reconnect
 *   inference_started — sets running=true
 *   inference_done    — sets running=false, updates compute_id & version
 */
export function useWsComputeStatus(): { data: ComputeStatus } {
  const [state, setState] = useState<ComputeStatus>({
    running: false,
    compute_id: null,
    version: null,
  });

  // Snapshot gives us the current state immediately on (re)connect
  useWsEvent("snapshot", (msg: any) => {
    setState((prev) => ({
      running: msg.inference_running ?? prev.running,
      compute_id: msg.compute_id ?? prev.compute_id,
      version: msg.compute_version ?? prev.version,
    }));
  });

  useWsEvent("inference_started", () => {
    setState((prev) => ({ ...prev, running: true }));
  });

  useWsEvent("inference_done", (msg: any) => {
    setState({
      running: false,
      compute_id: msg.compute_id ?? null,
      version: msg.version ?? 1,
    });
  });

  // Clear compute state when a new job starts (session reset)
  useWsEvent("session_reset", () => {
    setState({ running: false, compute_id: null, version: null });
  });

  return { data: state };
}

/**
 * Fetch compute results on demand (not polling).
 * Called when the modal opens or after a compute completes.
 */
export function useComputeResultsQuery(
  computeId: string | null,
  enabled: boolean
) {
  return useQuery<ComputeResults, Error>({
    queryKey: ["compute-results", computeId],
    enabled: enabled && !!computeId,
    refetchInterval: false,
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
