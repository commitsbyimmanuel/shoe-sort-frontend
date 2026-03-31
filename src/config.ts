import Constants from "expo-constants";

// If you want to override at build time (EAS) use extra.env
export const API_BASE: string =
  (Constants?.expoConfig?.extra as any)?.API_BASE ||
  "http://192.168.7.140:8000";

export const MATCH_PATH = "/scan";

export const CLIENT_JOIN_PATH = "/client/join";
export const MARK_DONE_PATH = "/grid/mark_done";
export const GRID_STATUS_PATH = "/grid/status";

export const ARCHIVE_JOB_PATH = "/jobs/archive";

export const DEFAULT_CLIENT_ID = "GridA";

export const COMPUTE_PATH = "/compute";
export const COMPUTE_STATUS_PATH = "/compute/status";
export const COMPUTE_RESULTS_PATH = "/compute/results";
export const COMPUTE_GET_PAIR_PATH = "/compute/get_pair";
export const COMPUTE_GRADE_PAIR_PATH = "/compute/grade_pair";
export const FEEDBACK_PATH = "/feedback";
export const IMAGES_PATH = "/images";

export const HEALTHZ_PATH = "/healthz";
export const STATS_PATH = "/stats";

export { apiUrl, getBaseUrl } from "./lib/apiBase";

export const API_TIMEOUT_MS = 5000;
