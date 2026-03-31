// src/hooks/usePairGrading.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiUrl,
  COMPUTE_GET_PAIR_PATH,
  COMPUTE_GRADE_PAIR_PATH,
} from "../config";
import { fetchWithTimeout } from "../lib/http";
import type {
  GetPairResponse,
  GradePairResponse,
  GradeValue,
} from "../types";

/**
 * Fetch the next ungraded pair for this client.
 * Only fetches when enabled=true. Not polling — call refetch() after grading.
 */
export function useGetPairQuery(
  computeId: string | null,
  clientId: string,
  enabled: boolean
) {
  return useQuery<GetPairResponse, Error>({
    queryKey: ["get-pair", computeId, clientId],
    enabled: enabled && !!computeId,
    staleTime: Infinity, // Don't auto-refetch; we refetch manually after grading
    queryFn: async () => {
      const url = `${apiUrl(COMPUTE_GET_PAIR_PATH)}?compute_id=${computeId}&client_id=${encodeURIComponent(clientId)}`;
      const res = await fetchWithTimeout(url, {}, 15000);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return (await res.json()) as GetPairResponse;
    },
  });
}

type GradePairVars = {
  compute_id: string;
  pair_id: string;
  client_id: string;
  grade: GradeValue;
};

/**
 * Submit a grade for a locked pair, then auto-fetch the next pair.
 */
export function useGradePairMutation() {
  const qc = useQueryClient();

  return useMutation<GradePairResponse, Error, GradePairVars>({
    mutationFn: async (vars) => {
      const res = await fetchWithTimeout(
        apiUrl(COMPUTE_GRADE_PAIR_PATH),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vars),
        },
        15000
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return (await res.json()) as GradePairResponse;
    },
    onSuccess: () => {
      // Invalidate get-pair to trigger a refetch of the next pair
      qc.invalidateQueries({ queryKey: ["get-pair"] });
    },
    mutationKey: ["grade-pair"],
  });
}
