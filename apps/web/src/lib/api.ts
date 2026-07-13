const API_BASE = import.meta.env.VITE_API_URL || "/api";

type ApiInit = RequestInit & { token?: string | null };

export async function apiFetch<T>(path: string, init?: ApiInit): Promise<T> {
  const { token, ...rest } = (init ?? {}) as ApiInit;
  const headers = new Headers(rest.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }

  // 204 (or any other empty body) has nothing to parse — res.json() throws
  // "Unexpected end of JSON input" on an empty string.
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
