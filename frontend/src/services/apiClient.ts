// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
const BASE = "/api";

// Token di sessione (JWT) firmato dal server, impostato da useSession.ts dopo
// login/verifica TOTP/sblocco biometrico. Sostituisce i vecchi header X-Username/
// X-Ruolo, che il backend non verificava affatto — chiunque poteva scriverci un
// nome utente a piacere. Ora ogni chiamata porta questo token nell'header
// Authorization, e il backend lo verifica crittograficamente prima di rispondere.
let currentToken = "";

// Etichetta puramente informativa per l'audit log: quale ruolo l'utente ha scelto
// come "attivo" (per chi ne ha più di uno), aggiornabile senza un nuovo login.
// NON ha alcun ruolo nell'autenticazione — quella dipende solo dal token verificato
// sopra. Il backend la usa solo per rendere leggibile il log, mai per decidere se
// concedere l'accesso.
let currentRuoloAttivo = "";

// Richiamato quando una richiesta torna 401 (token mancante/scaduto/non valido):
// permette a useSession.ts di riportare l'utente al login senza che ogni singola
// chiamata API debba gestirlo per conto proprio.
let onUnauthorized: (() => void) | null = null;

export function setApiToken(token: string): void {
  currentToken = token || "";
}
export function clearApiToken(): void {
  currentToken = "";
}
export function setApiRuoloAttivo(ruolo: string): void {
  currentRuoloAttivo = ruolo || "";
}
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

// Le rotte di login/verifica TOTP sono l'unico caso in cui un 401 è una risposta
// applicativa normale (credenziali/codice errati), non una sessione scaduta: non
// deve far scattare il logout automatico.
const ROTTE_PUBBLICHE = ["/auth/login", "/auth/totp-verify"];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> || {})
  };
  if (currentToken) headers["Authorization"] = `Bearer ${currentToken}`;
  if (currentRuoloAttivo) headers["X-Ruolo-Attivo"] = currentRuoloAttivo;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401 && !ROTTE_PUBBLICHE.includes(path)) {
    onUnauthorized?.();
  }

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
