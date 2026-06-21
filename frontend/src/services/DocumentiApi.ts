import { api } from "./apiClient.js";

export type StatoFirma = "Da firmare" | "In attesa di verifica" | "Firmato" | "Respinto" | "";
export type CaricatoDaRuolo = "GP" | "Privacy" | "Dipendente" | "";

export interface Documento {
  pageId: string;
  titolo: string;
  username: string;
  dipendente: string;
  tipo: string;
  note: string;
  dataCaricamento: string | null;
  allegatoNome: string;
  allegatoUrl: string | null;
  linkAllegato: string;
  caricatoDa: string;
  richiedeFirma: boolean;
  statoFirma: StatoFirma;
  caricatoDaRuolo: CaricatoDaRuolo;
}

export interface DocumentoCreateInput {
  username: string; dipendente: string; titolo: string; tipo: string; note?: string;
  linkAllegato?: string; fileBase64?: string; fileName?: string; contentType?: string;
  caricatoDa: string; caricatoDaRuolo: CaricatoDaRuolo; richiedeFirma?: boolean;
}

export const DocumentiApi = {
  listByUsername: (username: string) => api.get<Documento[]>(`/documenti?username=${encodeURIComponent(username)}`),
  listInLavorazione: () => api.get<Documento[]>("/documenti/in-lavorazione"),
  create: (input: DocumentoCreateInput) => api.post<{ ok: boolean; pageId?: string; error?: string }>("/documenti", input),
  caricaFirmato: (pageId: string, fileBase64: string, fileName: string, contentType?: string) =>
    api.post<{ ok: boolean; error?: string }>("/documenti/carica-firmato", { pageId, fileBase64, fileName, contentType }),
  verificaFirma: (pageId: string, esito: "approva" | "scarta") =>
    api.post<{ ok: boolean }>("/documenti/verifica-firma", { pageId, esito }),
  elimina: (pageId: string) => api.post<{ ok: boolean }>("/documenti/elimina", { pageId })
};
