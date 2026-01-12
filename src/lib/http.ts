// lib/http.ts
import { API_TIMEOUT_MS } from "../config";
import { apiUrl } from "../config";

export async function fetchWithTimeout(
  pathOrUrl: string,
  init: RequestInit = {},
  timeoutMs: number = API_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const isAbsolute = /^https?:\/\//i.test(pathOrUrl);
    const url = isAbsolute ? pathOrUrl : apiUrl(pathOrUrl);
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}
