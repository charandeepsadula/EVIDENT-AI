import { createClient } from "@/lib/supabase/client";

export class ApiError extends Error {
  status: number;
  code?: string;
  missing?: string[];
  constructor(message: string, status: number, code?: string, missing?: string[]) {
    super(message); this.status = status; this.code = code; this.missing = missing;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new ApiError("API address is not configured.", 503);
  let token: string | undefined;
  if (process.env.NEXT_PUBLIC_LOCAL_DEV_MODE === "true") token = process.env.NEXT_PUBLIC_LOCAL_DEV_TOKEN;
  else {
    const supabase = createClient();
    if (!supabase) throw new ApiError("Supabase sign-in is not configured.", 503);
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  }
  if (!token) throw new ApiError("Your session has expired. Sign in again.", 401);
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("Authorization", `Bearer ${token}`);
    response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
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
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new ApiError("API address is not configured.", 503);
  let token: string | undefined;
  if (process.env.NEXT_PUBLIC_LOCAL_DEV_MODE === "true") token = process.env.NEXT_PUBLIC_LOCAL_DEV_TOKEN;
  else {
    const supabase = createClient();
    if (!supabase) throw new ApiError("Supabase sign-in is not configured.", 503);
    token = (await supabase.auth.getSession()).data.session?.access_token;
  }
  if (!token) throw new ApiError("Your session or local access token is missing.", 401);
  const form = new FormData(); form.append("file", file);
  let response: Response;
  try { response = await fetch(`${base.replace(/\/$/, "")}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, cache: "no-store" }); }
  catch { throw new ApiError("The EVIDENT AI API is not reachable. Start the backend and try again.", 503); }
  const body = await response.json().catch(() => null);
  if (!response.ok) { const detail = body?.detail; throw new ApiError(typeof detail === "string" ? detail : detail?.message ?? "The upload failed.", response.status, detail?.code, detail?.missing); }
  return body as T;
}
