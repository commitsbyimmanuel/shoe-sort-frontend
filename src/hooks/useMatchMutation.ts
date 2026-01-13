// src/hooks/useMatchMutation.ts
import { useMutation } from "@tanstack/react-query";
import { apiUrl, MATCH_PATH } from "../config";
import { fetchWithTimeout } from "../lib/http";
import type { ApiResponse } from "../types";

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
        name: `${clientId}-${Date.now()}.jpg`,
        type: "image/jpeg",
      } as any);

      // API contract: backend expects "name" as the filename to save
      // Format: "GridA-01-01.jpg" - no timestamp so retakes overwrite
      const filename = `${locationInfo}.jpg`;
      fd.append("name", filename);

      const url = apiUrl(MATCH_PATH);
      const res = await fetchWithTimeout(url, {
        method: "POST",
        body: fd, // let RN set multipart boundary
      });

      // Don’t JSON.stringify FormData; it won’t show contents.
      // If you want visibility, log the fields separately:
      console.log("POST /scan fields:", {
        name: filename,
        file: `${clientId}-${Date.now()}.jpg`,
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
