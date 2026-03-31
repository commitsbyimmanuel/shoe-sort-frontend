import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getBaseUrl,
  getHost,
  getPort,
  getZoomFactor,
  getDeviceId,
  loadApiBase,
  saveApiBase,
  saveZoomFactor,
} from "../lib/apiBase";

type Ctx = {
  host: string;
  port: string;
  baseUrl: string;
  setConfig: (h: string, p: string, z?: number) => Promise<void>;
  zoomFactor: number;
  deviceId: string;
  setZoom: (z: number) => Promise<void>;
  reload: () => Promise<void>;
};

const ApiCtx = createContext<Ctx | null>(null);

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState(getHost());
  const [port, setPort] = useState(getPort());
  const [zoomFactor, setZoomFactorState] = useState(getZoomFactor());
  const [deviceId, setDeviceId] = useState(getDeviceId());

  const baseUrl = useMemo(() => getBaseUrl(), [host, port]);

  useEffect(() => {
    (async () => {
      await loadApiBase();
      setHost(getHost());
      setPort(getPort());
      setZoomFactorState(getZoomFactor());
      setDeviceId(getDeviceId());
    })();
  }, []);

  const setConfig = async (h: string, p: string, z?: number) => {
    await saveApiBase(h, p, z);
    setHost(getHost());
    setPort(getPort());
    setZoomFactorState(getZoomFactor());
  };

  const setZoom = async (z: number) => {
    await saveZoomFactor(z);
    setZoomFactorState(getZoomFactor());
  };

  const reload = async () => {
    await loadApiBase();
    setHost(getHost());
    setPort(getPort());
  };

  return (
    <ApiCtx.Provider
      value={{
        host,
        port,
        baseUrl,
        zoomFactor,
        deviceId,
        setConfig,
        setZoom: async (z: number) => {
          await saveZoomFactor(z);
          setZoomFactorState(getZoomFactor());
        },
        reload,
      }}
    >
      {children}
    </ApiCtx.Provider>
  );
}

export const useApi = () => {
  const ctx = useContext(ApiCtx);
  if (!ctx) throw new Error("useApi must be used within ApiProvider");
  return ctx;
};
