import { api } from "./apiClient.js";

export interface Ticket {
  pageId: string;
  titolo: string;
  categoria: string;
  stato: string;
  data: string | null;
  nome: string;
  ruolo: string;
  username: string;
  descrizione: string;
  note: string;
}

export const TicketApi = {
  list: () => api.get<Ticket[]>("/ticket"),
  create: (payload: { titolo: string; categoria: string; descrizione: string; username: string; nome: string; ruolo: string }) =>
    api.post<{ ok: boolean; pageId?: string; error?: string }>("/ticket", payload),
  updateStato: (pageId: string, stato: "Nuovo" | "In lavorazione" | "Risolto") =>
    api.post<{ ok: boolean }>("/ticket/stato", { pageId, stato }),
  setNote: (pageId: string, note: string) =>
    api.post<{ ok: boolean }>("/ticket/nota", { pageId, note })
};
