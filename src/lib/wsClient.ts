/**
 * Singleton WebSocket client for real-time server event delivery.
 *
 * Replaces three polling loops:
 *   - GET /grid/status     (every 2 s)
 *   - GET /compute/status  (every 5 s)
 *   - GET /compute/get_pair refetch interval (every 3 s)
 *
 * Usage:
 *   wsClient.connect(host, port, clientId)
 *   wsClient.setGrid("GridA")                    // kept in sync for heartbeat pings
 *   wsClient.on("grid_update", handler)
 *   wsClient.off("grid_update", handler)
 *   wsClient.send({ type: "ping", grid: "GridA" })
 */

export type WsStatus = "connecting" | "open" | "closed";

type WsMessage = { type: string; [key: string]: any };
type Handler = (msg: WsMessage) => void;
type StatusHandler = (status: WsStatus) => void;

const PING_INTERVAL_MS = 15_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

class WsClient {
  private ws: WebSocket | null = null;
  private url = "";
  private currentGrid = "";

  // Event handlers keyed by message type (and "*" for wildcard)
  private handlers = new Map<string, Set<Handler>>();
  // Status change subscribers
  private statusHandlers = new Set<StatusHandler>();

  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = RECONNECT_BASE_MS;
  private intentionalClose = false;

  public status: WsStatus = "closed";

  // ---- Public API ----

  connect(host: string, port: string, clientId: string): void {
    this.intentionalClose = false;
    const newUrl = `ws://${host}:${port}/ws/${encodeURIComponent(clientId)}`;

    if (
      this.ws &&
      this.ws.readyState === WebSocket.OPEN &&
      this.url === newUrl
    ) {
      return; // already connected to same URL
    }

    this.url = newUrl;
    this._clearTimers();
    this._closeExisting();
    this._doConnect();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this._clearTimers();
    this._closeExisting();
    this._setStatus("closed");
  }

  send(msg: WsMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** Keep track of the current grid so the periodic ping carries it. */
  setGrid(grid: string): void {
    this.currentGrid = grid;
  }

  on(type: string, handler: Handler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  off(type: string, handler: Handler): void {
    this.handlers.get(type)?.delete(handler);
  }

  onStatusChange(handler: StatusHandler): void {
    this.statusHandlers.add(handler);
  }

  offStatusChange(handler: StatusHandler): void {
    this.statusHandlers.delete(handler);
  }

  // ---- Private helpers ----

  private _doConnect(): void {
    this._setStatus("connecting");
    console.log(`[WS] Connecting to ${this.url}`);

    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      console.warn("[WS] Failed to create WebSocket:", e);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log("[WS] Connected");
      this._setStatus("open");
      this.reconnectDelay = RECONNECT_BASE_MS; // reset back-off
      this._startPing();
      // Request current grid state immediately on connect / reconnect
      if (this.currentGrid) {
        this.send({ type: "ping", grid: this.currentGrid });
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: WsMessage = JSON.parse(event.data as string);
        // Dispatch to type-specific handlers
        this.handlers.get(msg.type)?.forEach((h) => h(msg));
        // Dispatch to wildcard handlers
        this.handlers.get("*")?.forEach((h) => h(msg));
      } catch (e) {
        console.warn("[WS] Failed to parse message:", e);
      }
    };

    this.ws.onerror = () => {
      console.warn("[WS] Connection error");
    };

    this.ws.onclose = () => {
      console.log("[WS] Closed");
      this._clearTimers();
      this.ws = null;
      if (!this.intentionalClose) {
        this._setStatus("closed");
        this._scheduleReconnect();
      }
    };
  }

  private _startPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.currentGrid) {
        this.send({ type: "ping", grid: this.currentGrid });
      }
    }, PING_INTERVAL_MS);
  }

  private _scheduleReconnect(): void {
    if (this.intentionalClose) return;
    console.log(`[WS] Reconnecting in ${this.reconnectDelay}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        RECONNECT_MAX_MS
      );
      this._doConnect();
    }, this.reconnectDelay);
  }

  private _clearTimers(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _closeExisting(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  private _setStatus(s: WsStatus): void {
    this.status = s;
    this.statusHandlers.forEach((h) => h(s));
  }
}

/** Module-level singleton — shared by all hooks and components. */
export const wsClient = new WsClient();
