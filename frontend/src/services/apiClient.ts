const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error(`Risposta non JSON da ${path}:`, text.slice(0, 200));
    return null as T;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) })
};
