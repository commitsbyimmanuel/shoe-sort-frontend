/**
 * WsProvider — React context that manages the WebSocket connection lifecycle.
 *
 * - Connects once ApiProvider has loaded settings (host, port, deviceId).
 * - Reconnects automatically when host / port / deviceId changes.
 * - Exposes `useWsEvent(type, handler, enabled?)` for subscribing to WS messages.
 * - Exposes `useWsContext()` for reading connection status.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { wsClient, WsStatus } from "../lib/wsClient";
import { useApi } from "./ApiProvider";

// ---- Context ----

type WsCtx = { status: WsStatus };
const WsContext = createContext<WsCtx>({ status: "closed" });

// ---- Provider ----

export function WsProvider({
  children,
  enabled = false,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const { host, port, deviceId } = useApi();
  const [status, setStatus] = useState<WsStatus>("closed");

  useEffect(() => {
    // Wait for deviceId to load from AsyncStorage AND for the user to connect
    if (!deviceId || !enabled) {
      wsClient.disconnect();
      return;
    }

    wsClient.onStatusChange(setStatus);
    wsClient.connect(host, port, deviceId);

    return () => {
      wsClient.offStatusChange(setStatus);
    };
  }, [host, port, deviceId, enabled]);

  return (
    <WsContext.Provider value={{ status }}>
      {children}
    </WsContext.Provider>
  );
}

// ---- Hooks ----

export function useWsContext(): WsCtx {
  return useContext(WsContext);
}

/**
 * Subscribe to a specific WS message type for the lifetime of the component.
 *
 * The `handler` is stored in a ref so it always refers to the latest closure
 * without needing to be listed as a dependency — safe to pass inline functions.
 *
 * @param type     Message type to subscribe to (e.g. "grid_update")
 * @param handler  Callback receiving the full message object
 * @param enabled  Set to false to temporarily pause the subscription (default: true)
 */
export function useWsEvent(
  type: string,
  handler: (msg: any) => void,
  enabled: boolean = true
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    const stable = (msg: any) => handlerRef.current(msg);
    wsClient.on(type, stable);
    return () => wsClient.off(type, stable);
  }, [type, enabled]);
}
