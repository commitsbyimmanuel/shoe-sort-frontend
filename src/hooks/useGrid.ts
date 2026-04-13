// src/hooks/useGrid.ts
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MARK_DONE_PATH, apiUrl } from "../config";
import { fetchWithTimeout } from "../lib/http";
import { wsClient } from "../lib/wsClient";
import { useWsEvent } from "../providers/WsProvider";

// ---- Types ----

type MarkDoneVars = { grid: string; client_id: string };
type MarkDoneResp = {
  ok: boolean;
  grid: string;
  done_clients: string[];
  is_last_client: boolean;
};

export type GridStatus = {
  ok: boolean;
  grid: string;
  done_clients: string[];
  total_clients: number;
  all_done: boolean;
  session_active: boolean;
};

// ---- Mutations (unchanged — still HTTP POST) ----

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

// ---- WebSocket-based grid status ----

const DEFAULT_STATUS: GridStatus = {
  ok: true,
  grid: "",
  done_clients: [],
  total_clients: 1,
  all_done: false,
  session_active: true,
};

/**
 * Subscribe to real-time grid status via WebSocket.
 *
 * Replaces the previous polling-based `useGridStatusQuery` (2 s interval).
 * Returns `{ data: GridStatus }` — same shape as React Query so App.tsx
 * needs minimal changes (access via `statusQuery.data?.field`).
 *
 * Events handled:
 *   snapshot      — initial state on WS connect / reconnect
 *   grid_update   — join / mark_done state change
 *   session_reset — new job; marks session_active=false for all grids
 */
export function useWsGridStatus(
  grid: string,
  enabled: boolean
): { data: GridStatus } {
  const [state, setState] = useState<GridStatus>({ ...DEFAULT_STATUS, grid });

  // Keep wsClient aware of current grid for periodic pings
  useEffect(() => {
    wsClient.setGrid(grid);
  }, [grid]);

  // When the user leaves LANDING (enabled: false→true), reset state so a
  // stale session_active=false from the previous session doesn't immediately
  // bounce them back to LANDING again.
  // When they return to LANDING (enabled: true→false), also reset so state
  // is clean for the next connection.
  useEffect(() => {
    setState({ ...DEFAULT_STATUS, grid });
    if (!enabled) return;
    // Fresh session — request current grid state from server
    wsClient.send({ type: "ping", grid });
  }, [enabled, grid]);

  // Initial snapshot gives inference state; grid_update will follow from the ping
  useWsEvent(
    "snapshot",
    (_msg: any) => {
      // Snapshot doesn't include per-grid detail; the ping we just sent will
      // trigger a grid_update reply. Nothing to set here, but we keep the
      // handler so a fresh ping is sent if the WS reconnects.
    },
    enabled
  );

  // grid_update carries total_clients, done_clients, all_done, session_active
  useWsEvent(
    "grid_update",
    (msg: any) => {
      if (msg.grid !== grid) return;
      setState({
        ok: true,
        grid: msg.grid,
        done_clients: msg.done_clients ?? [],
        total_clients: msg.total_clients ?? 1,
        all_done: msg.all_done ?? false,
        session_active: msg.session_active ?? true,
      });
    },
    enabled
  );

  // session_reset is sent to all clients when a new job is archived
  useWsEvent(
    "session_reset",
    () => {
      setState((prev) => ({ ...prev, session_active: false }));
    },
    enabled
  );

  return { data: state };
}
