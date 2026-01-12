// src/hooks/useGrid.ts
import { useMutation, useQuery } from "@tanstack/react-query";
import { API_BASE, MARK_DONE_PATH, GRID_STATUS_PATH, apiUrl } from "../config";
import { fetchWithTimeout } from "../lib/http";

type MarkDoneVars = { grid: string; client_id: string };
type MarkDoneResp = { ok: boolean; grid: string; done_clients: string[] };

type GridStatus = {
  ok: boolean;
  grid: string;
  done_clients: string[];
  total_clients: number;
  all_done: boolean;
};

export function useMarkDoneMutation() {
  return useMutation<MarkDoneResp, Error, MarkDoneVars>({
    mutationFn: async (vars) => {
      const res = await fetchWithTimeout(apiUrl(MARK_DONE_PATH), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      return (await res.json()) as MarkDoneResp;
    },
    mutationKey: ["grid-mark-done"],
  });
}

export function useGridStatusQuery(gridOrClientId: string, enabled: boolean) {
  return useQuery<GridStatus, Error>({
    queryKey: ["grid-status", gridOrClientId],
    enabled,
    refetchInterval: enabled ? 2000 : false, // poll every 2s only while waiting
    queryFn: async () => {
      const url = `${apiUrl(GRID_STATUS_PATH)}?grid=${encodeURIComponent(
        gridOrClientId
      )}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      return (await res.json()) as GridStatus;
    },
  });
}
