import { createClient } from "@/lib/supabase/client";

export class ApiError extends Error {
  status: number;
  code?: string;
  missing?: string[];
  constructor(message: string, status: number, code?: string, missing?: string[]) {
    super(message); this.status = status; this.code = code; this.missing = missing;
  }
}

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export const isLocalWorkspace =
  !isSupabaseConfigured || process.env.NEXT_PUBLIC_LOCAL_DEV_MODE === "true";

export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location.hostname.includes("onrender.com")) {
    return "https://evident-ai-backend-s616.onrender.com/api/v1";
  }
  return "http://127.0.0.1:8000/api/v1";
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBaseUrl();
  let token: string | undefined;
  if (isLocalWorkspace) {
    token = process.env.NEXT_PUBLIC_LOCAL_DEV_TOKEN || "local-workspace-token";
  } else {
    const supabase = createClient();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    }
    if (!token && !isSupabaseConfigured) {
      token = process.env.NEXT_PUBLIC_LOCAL_DEV_TOKEN || "local-workspace-token";
    }
  }
  if (!token) throw new ApiError("Your session has expired. Sign in again.", 401);
  let response: Response;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  try {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("Authorization", `Bearer ${token}`);
    response = await fetch(`${base}${normalizedPath}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("The EVIDENT AI API is not reachable. Start the backend and try again.", 503);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    throw new ApiError(typeof detail === "string" ? detail : detail?.message ?? "The request failed.", response.status, detail?.code, detail?.missing);
  }
  return body as T;
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const base = getApiBaseUrl();
  let token: string | undefined;
  if (isLocalWorkspace) {
    token = process.env.NEXT_PUBLIC_LOCAL_DEV_TOKEN || "local-workspace-token";
  } else {
    const supabase = createClient();
    if (supabase) {
      token = (await supabase.auth.getSession()).data.session?.access_token;
    }
    if (!token && !isSupabaseConfigured) {
      token = process.env.NEXT_PUBLIC_LOCAL_DEV_TOKEN || "local-workspace-token";
    }
  }
  if (!token) throw new ApiError("Your session or local access token is missing.", 401);
  const form = new FormData(); form.append("file", file);
  let response: Response;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  try { response = await fetch(`${base}${normalizedPath}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, cache: "no-store" }); }
  catch { throw new ApiError("The EVIDENT AI API is not reachable. Start the backend and try again.", 503); }
  const body = await response.json().catch(() => null);
  if (!response.ok) { const detail = body?.detail; throw new ApiError(typeof detail === "string" ? detail : detail?.message ?? "The upload failed.", response.status, detail?.code, detail?.missing); }
  return body as T;
}
