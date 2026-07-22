import { api } from "./apiClient.js";

export type CategoriaModello =
  | "Dipendente"
  | "Libero professionista"
  | "Incaricato trattamento"
  | "Amministratore di sistema"
  | "";

export interface ModelloPrivacy {
  pageId: string;
  nomeModello: string;
  categoria: CategoriaModello;
  allegatoNome: string;
  allegatoUrl: string | null;
  dataUltimoAggiornamento: string | null;
  aggiornatoDa: string;
  dataUltimoInvio: string | null;
  note: string;
}

export const DocumentazionePrivacyApi = {
  list: () => api.get<ModelloPrivacy[]>("/documentazione-privacy"),
  mancanti: () => api.get<Record<string, { pageId: string; nome: string; email: string }[]>>("/documentazione-privacy/mancanti"),
  carica: (pageId: string, fileBase64: string, fileName: string, contentType: string, aggiornatoDa: string) =>
    api.post<{ ok: boolean; error?: string }>("/documentazione-privacy/carica", { pageId, fileBase64, fileName, contentType, aggiornatoDa }),
  inviaAggiornamento: (pageId: string) =>
    api.post<{ ok: boolean; inviati: number; falliti: string[]; error?: string }>("/documentazione-privacy/invia-aggiornamento", { pageId }),
  inviaMancanti: (pageId: string) =>
    api.post<{ ok: boolean; inviati: number; falliti: string[]; error?: string }>("/documentazione-privacy/invia-mancanti", { pageId })
};
