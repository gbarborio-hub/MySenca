const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  const text = await res.text();

  if (!res.ok) {
    let message = `Errore ${res.status}`;
    if (res.status === 413) message = "Il file allegato è troppo grande.";
    else if (text) {
      try { message = JSON.parse(text).error || message; } catch { /* corpo non JSON, manteniamo il messaggio generico */ }
    }
    throw new Error(message);
  }

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
