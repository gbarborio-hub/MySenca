import { api } from "./apiClient.js";
import type { UtenteWebApp, Ruolo } from "../models/domain.js";

interface CreaUtenzaPayload {
  username: string; email?: string; ruolo: Ruolo;
  ruoliAggiuntivi: Ruolo[]; dipendentePageId: string;
}
interface CreaUtenzaResult { ok: boolean; username?: string; password?: string; emailInviata?: boolean; error?: string; }

export const UtentiApi = {
  list: () => api.get<UtenteWebApp[]>("/utenti"),
  crea: (payload: CreaUtenzaPayload) => api.post<CreaUtenzaResult>("/utenti", payload),
  elimina: (pageId: string, username: string) => api.post<{ ok: boolean }>("/utenti/elimina", { pageId, username }),
  riattiva: (pageId: string) => api.post<{ ok: boolean }>("/utenti/riattiva", { pageId }),
  aggiornaRuoli: (pageId: string, ruolo?: Ruolo, ruoliAggiuntivi?: Ruolo[]) =>
    api.post<{ ok: boolean }>("/utenti/ruoli", { pageId, ruolo, ruoliAggiuntivi })
};
