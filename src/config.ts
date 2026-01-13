import Constants from "expo-constants";

// If you want to override at build time (EAS) use extra.env
export const API_BASE: string =
  (Constants?.expoConfig?.extra as any)?.API_BASE ||
  "http://192.168.7.141:8000";

export const MATCH_PATH = "/scan";

export const MARK_DONE_PATH = "/grid/mark_done";
export const GRID_STATUS_PATH = "/grid/status";

export const DEFAULT_CLIENT_ID = "GridA";

export const COMPUTE_PATH = "/compute";
export const COMPUTE_STATUS_PATH = "/compute/status";
export const COMPUTE_RESULTS_PATH = "/compute/results";
export const FEEDBACK_PATH = "/feedback";
export const IMAGES_PATH = "/images";

export const HEALTHZ_PATH = "/healthz";
export const STATS_PATH = "/stats";

export { apiUrl, getBaseUrl } from "./lib/apiBase";

export const API_TIMEOUT_MS = 5000;
