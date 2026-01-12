import { useQuery } from "@tanstack/react-query";
import { API_BASE, apiUrl, STATS_PATH } from "../config";
import { fetchWithTimeout } from "../lib/http";

export function useGetStats() {
  const {
    isLoading,
    data: stats,
    error,
  } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetchWithTimeout(apiUrl(STATS_PATH));
      if (!res.ok) {
        throw new Error("Failed to fetch stats");
      }
      console.log(res.json());
      return res.json();
    },
  });

  return { isLoading, stats, error };
}
