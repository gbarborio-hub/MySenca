// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
const BASE = "/api";

// Identità dell'utente corrente, impostata da useSession.ts dopo login/sblocco/cambio ruolo.
// Viene inviata come header su ogni richiesta successiva, così il backend può attribuire
// correttamente ogni azione all'utente giusto nell'audit log — senza questo, il backend
// non ha alcun modo di sapere chi sta chiamando l'API dopo il login iniziale.
let currentUsername = "";
let currentRuolo = "";

export function setApiUser(username: string, ruolo: string): void {
  currentUsername = username || "";
  currentRuolo = ruolo || "";
}

export function clearApiUser(): void {
  currentUsername = "";
  currentRuolo = "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> || {})
  };
  if (currentUsername) headers["X-Username"] = currentUsername;
  if (currentRuolo) headers["X-Ruolo"] = currentRuolo;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
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
