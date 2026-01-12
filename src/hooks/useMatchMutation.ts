// src/hooks/useMatchMutation.ts
import { useMutation } from "@tanstack/react-query";
import type { ApiResponse } from "../types";
import { API_BASE, apiUrl, MATCH_PATH } from "../config";
import { fetchWithTimeout } from "../lib/http";

// Pass location_info from the caller (parent) so it controls sequencing like "GridA-01-01"
type MatchVars = { uri: string; locationInfo: string };

export function useMatchMutation(clientId: string) {
  return useMutation<ApiResponse, Error, MatchVars>({
    mutationFn: async ({ uri, locationInfo }) => {
      if (!locationInfo) throw new Error("location_info is required");

      const fd = new FormData();
      // IMPORTANT: React Native expects `name`, not `filename`
      fd.append("file", {
        uri,
        name: `capture-${clientId}-${Date.now()}.jpg`,
        type: "image/jpeg",
      } as any);

      // API contract (Grid == Client -> same value everywhere)
      fd.append("location_info", locationInfo); // required
      fd.append("grid", clientId); // optional, but we send it
      fd.append("client_id", clientId); // optional, but we send it

      const url = apiUrl(MATCH_PATH);
      const res = await fetchWithTimeout(url, {
        method: "POST",
        body: fd, // let RN set multipart boundary
      });

      // Don’t JSON.stringify FormData; it won’t show contents.
      // If you want visibility, log the fields separately:
      console.log("POST /scan fields:", {
        location_info: locationInfo,
        grid: clientId,
        client_id: clientId,
        file: `capture-${clientId}.jpg`,
      });

      if (!res.ok) {
        const text = await res.text();
        return {
          status: "error",
          message: `HTTP ${res.status}: ${text}`,
        } as any;
      }
      return (await res.json()) as ApiResponse;
    },
    mutationKey: ["match", clientId],
  });
}
