// src/hooks/useCompute.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE, apiUrl, COMPUTE_PATH, FEEDBACK_PATH } from "../config";
import type {
  ComputeResponse,
  ComputeResult,
  FeedbackVars,
  PairItem,
} from "../types";
import { fetchWithTimeout } from "../lib/http";

export function useComputeMutation() {
  const qc = useQueryClient();
  return useMutation<ComputeResponse, Error, void>({
    mutationFn: async () => {
      const res = await fetchWithTimeout(apiUrl(COMPUTE_PATH), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return (await res.json()) as ComputeResponse;
    },
    onSuccess: (data) => {
      // cache the latest compute
      qc.setQueryData<ComputeResponse>(["compute.latest"], data);
    },
    mutationKey: ["compute.run"],
  });
}

export function useFeedbackMutation() {
  const qc = useQueryClient();

  return useMutation<{ ok: boolean }, Error, FeedbackVars>({
    mutationFn: async (vars) => {
      const res = await fetchWithTimeout(apiUrl(FEEDBACK_PATH), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return (await res.json()) as { ok: boolean };
    },

    // ✅ Type-safe cache update (no optional fields leaked)
    onSuccess: (_resp, vars) => {
      qc.setQueryData<ComputeResponse | undefined>(
        ["compute.latest"],
        (prev) => {
          if (
            !prev ||
            !Array.isArray(prev.results) ||
            prev.results.length === 0
          ) {
            return prev; // nothing cached yet
          }

          const first: ComputeResult = prev.results[0]!;
          const rest: ComputeResult[] = prev.results.slice(1);

          const currentPairs: PairItem[] = first.pairs ?? [];
          const newPairs: PairItem[] = currentPairs.filter(
            (p) => p.pair_id !== vars.pair_id
          );

          const newFirst: ComputeResult = {
            ...first, // keeps scope, compute_id, grids, counts_by_grid, singles
            pairs: newPairs, // updated pairs list
          };

          const next: ComputeResponse = {
            ok: prev.ok,
            results: [newFirst, ...rest],
          };

          return next;
        }
      );
    },

    mutationKey: ["compute.feedback"],
  });
}
