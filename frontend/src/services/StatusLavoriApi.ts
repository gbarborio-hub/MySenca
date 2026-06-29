import { api } from "./apiClient.js";

export type StatoAvanzamento = "Non iniziato" | "In lavorazione" | "Risolto";
export type Urgenza = "Urgente" | "Alta" | "Media" | "Bassa" | "";

export interface StatusLavoro {
  pageId: string;
  puntoCheckList: string;
  categoria: string;
  intervento: string;
  noteSoluzioni: string;
  stato: StatoAvanzamento;
  urgenza: Urgenza;
  data: string | null;
  place: string;
}

export const StatusLavoriApi = {
  list: () => api.get<StatusLavoro[]>("/status-lavori"),
  setStato: (pageId: string, stato: StatoAvanzamento) =>
    api.post<{ ok: boolean }>("/status-lavori/stato", { pageId, stato }),
  aggiungiNota: (pageId: string, notaEsistente: string, nuovaNota: string) =>
    api.post<{ ok: boolean }>("/status-lavori/nota", { pageId, notaEsistente, nuovaNota })
};
