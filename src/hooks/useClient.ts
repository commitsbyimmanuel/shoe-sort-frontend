// src/hooks/useClient.ts
import { useMutation } from "@tanstack/react-query";
import { CLIENT_JOIN_PATH, apiUrl } from "../config";
import { fetchWithTimeout } from "../lib/http";

type JoinClientVars = { grid: string; client_id: string };
type JoinClientResp = { ok: boolean };

export function useJoinClientMutation() {
  return useMutation<JoinClientResp, Error, JoinClientVars>({
    mutationFn: async (vars) => {
      const res = await fetchWithTimeout(apiUrl(CLIENT_JOIN_PATH), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      return (await res.json()) as JoinClientResp;
    },
    mutationKey: ["client-join"],
  });
}
