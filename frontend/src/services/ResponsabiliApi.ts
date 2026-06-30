import { api } from "./apiClient.js";

export type StatoInvio = "Non inviata" | "Inviata" | "Autonomina" | "";
export type StatoFirma = "Da firmare" | "In attesa di verifica" | "Firmato" | "Respinto" | "";
export type DocSlot = "checklist" | "contratto";

export interface Responsabile {
  pageId: string;
  nome: string;
  attivitaSvolta: string;
  email: string;
  indirizzo: string;
  statoInvio: StatoInvio;
  dataInvio: string | null;
  note: string;
  checklistFileNome: string;
  checklistFileUrl: string | null;
  checklistRichiedeFirma: boolean;
  checklistStatoFirma: StatoFirma;
  contrattoFileNome: string;
  contrattoFileUrl: string | null;
  contrattoRichiedeFirma: boolean;
  contrattoStatoFirma: StatoFirma;
}

export interface ResponsabileCreateInput {
  nome: string; attivitaSvolta?: string; email?: string; indirizzo?: string; note?: string;
}

export const ResponsabiliApi = {
  list: () => api.get<Responsabile[]>("/responsabili"),
  create: (input: ResponsabileCreateInput) => api.post<{ ok: boolean; pageId?: string; error?: string }>("/responsabili", input),
  update: (pageId: string, fields: Partial<ResponsabileCreateInput> & { statoInvio?: StatoInvio; dataInvio?: string }) =>
    api.post<{ ok: boolean }>("/responsabili/update", { pageId, ...fields }),
  elimina: (pageId: string) => api.post<{ ok: boolean }>("/responsabili/elimina", { pageId }),
  caricaDocumento: (pageId: string, slot: DocSlot, fileBase64: string, fileName: string, contentType: string, richiedeFirma: boolean) =>
    api.post<{ ok: boolean; error?: string }>("/responsabili/carica-documento", { pageId, slot, fileBase64, fileName, contentType, richiedeFirma }),
  caricaFirmato: (pageId: string, slot: DocSlot, fileBase64: string, fileName: string, contentType: string) =>
    api.post<{ ok: boolean; error?: string }>("/responsabili/carica-firmato", { pageId, slot, fileBase64, fileName, contentType }),
  verificaFirma: (pageId: string, slot: DocSlot, esito: "approva" | "scarta") =>
    api.post<{ ok: boolean }>("/responsabili/verifica-firma", { pageId, slot, esito })
};
