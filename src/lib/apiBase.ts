import AsyncStorage from "@react-native-async-storage/async-storage";

export const DEFAULT_HOST = "192.168.7.140";
export const DEFAULT_PORT = "8000";
export const DEFAULT_ZOOM_FACTOR = 1.4;

const KEY_HOST = "api.host";
const KEY_PORT = "api.port";
const KEY_ZOOM = "camera.zoomFactor";
const KEY_DEVICE_ID = "app.deviceId";

let host = DEFAULT_HOST;
let port = DEFAULT_PORT;
let zoomFactor = DEFAULT_ZOOM_FACTOR;
let deviceId = "";

export const getHost = () => host;
export const getPort = () => port;
export const getZoomFactor = () => zoomFactor;
export const getDeviceId = () => deviceId;

export const getBaseUrl = () => `http://${host}:${port}`;

export const apiUrl = (path: string) => {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${getBaseUrl()}${clean}`;
};

export const normalizeHost = (h: string) =>
  h
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

const clampZoom = (z: number) => Math.max(1, Math.min(z, 5)); // 1x..5x

export async function loadApiBase() {
  try {
    const [h, p, d] = await Promise.all([
      AsyncStorage.getItem(KEY_HOST),
      AsyncStorage.getItem(KEY_PORT),
      AsyncStorage.getItem(KEY_DEVICE_ID),
    ]);
    host = h ? normalizeHost(h) : DEFAULT_HOST;
    port = p ? p : DEFAULT_PORT;

    if (d) {
      deviceId = d;
    } else {
      deviceId = `dev_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
      await AsyncStorage.setItem(KEY_DEVICE_ID, deviceId);
    }
  } catch {}
}

export async function saveApiBase(
  newHost: string,
  newPort: string,
  newZoom?: number
) {
  host = normalizeHost(newHost || DEFAULT_HOST);
  port = String(newPort || DEFAULT_PORT).trim();
  if (typeof newZoom === "number" && !Number.isNaN(newZoom)) {
    zoomFactor = Math.max(1, Math.min(newZoom, 5)); // clamp 1..5
  }
  await Promise.all([
    AsyncStorage.setItem(KEY_HOST, host),
    AsyncStorage.setItem(KEY_PORT, port),
    AsyncStorage.setItem(KEY_ZOOM, String(zoomFactor)),
  ]);
}

export async function saveZoomFactor(newZoom: number) {
  zoomFactor = clampZoom(newZoom);
  await AsyncStorage.setItem(KEY_ZOOM, String(zoomFactor));
}
