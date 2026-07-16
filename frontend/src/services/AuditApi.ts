// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { api } from "./apiClient.js";

export type AuditAzione = "LOGIN" | "LOGOUT" | "AUTH_FAIL" | "CREATE" | "READ" | "UPDATE" | "DELETE";

export interface AuditRecord {
  pageId: string;
  descrizione: string;
  utente: string;
  ruolo: string;
  azione: AuditAzione;
  risorsa: string;
  dettaglio: string;
  ip: string;
  timestamp: string | null;
  hashPrecedente: string;
  hashRecord: string;
}

export interface AuditListResult {
  records: AuditRecord[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface RecordCoinvolto {
  pageId: string;
  url: string;
  descrizione: string;
}

export interface VerificaResult {
  integro: boolean;
  totaleRecord: number;
  rotturaAlRecord?: number;
  descrizioneRottura?: string;
  recordCoinvolti?: RecordCoinvolto[];
}

export const AuditApi = {
  list: (params?: { cursor?: string; utente?: string; azione?: string }) => {
    const q = new URLSearchParams();
    if (params?.cursor) q.set("cursor", params.cursor);
    if (params?.utente) q.set("utente", params.utente);
    if (params?.azione) q.set("azione", params.azione);
    const qs = q.toString();
    return api.get<AuditListResult>(`/audit${qs ? `?${qs}` : ""}`);
  },
  verifica: () => api.get<VerificaResult>("/audit/verifica")
};
