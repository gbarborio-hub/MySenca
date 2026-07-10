// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
// Endpoint leggero per eventi che non passano da nessuna vera chiamata API
// (sblocco Face ID/Touch ID, logout) ma che vanno comunque tracciati nell'audit log.
import { api } from "./apiClient.js";

export const AuditEventApi = {
  // Fire-and-forget: non deve mai bloccare o rompere il flusso utente se fallisce
  logEvent(azione: "LOGIN" | "LOGOUT", dettaglio: string): void {
    api.post("/audit/event", { azione, dettaglio }).catch(() => { /* silenzioso */ });
  }
};
