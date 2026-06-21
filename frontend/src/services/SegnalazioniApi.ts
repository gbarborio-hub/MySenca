import { api } from "./apiClient.js";

export interface Segnalazione {
  pageId: string;
  numeroEvento: string;
  tipo: string;
  stato: string;
  dataEvento: string | null;
  dataSegnalazione: string | null;
  segnalatoDa: string;
  usernameSegnalante: string;
  areaSede: string;
  struttura: string;
  descrizione: string;
  tipoViolazione: string;
  origine: string;
  causa: string;
  testimoni: string;
  infoAziendaliCoinvolte: boolean;
  dettaglioInfoAziendali: string;
  datiPersonaliCoinvolti: boolean;
  assetCoinvolti: string;
  responsabileAsset: string;
  misureAdottate: string;
  categoriaDataBreach: string;
  categorieDatiCoinvolti: string;
  quantitaDati: string;
  categorieInteressati: string;
  danniInteressati: string;
  notificaGarante: boolean;
  dataNotificaGarante: string | null;
  responsabileGestione: string;
  note: string;
}

export const SegnalazioniApi = {
  list: () => api.get<Segnalazione[]>("/segnalazioni"),
  create: (payload: any) => api.post<{ ok: boolean; pageId?: string; error?: string }>("/segnalazioni", payload),
  updateStato: (pageId: string, stato: "Aperto" | "In gestione" | "Chiuso") =>
    api.post<{ ok: boolean }>("/segnalazioni/stato", { pageId, stato }),
  aggiornaGestione: (pageId: string, fields: { responsabileGestione?: string; misureAdottate?: string; note?: string; notificaGarante?: boolean; dataNotificaGarante?: string }) =>
    api.post<{ ok: boolean }>("/segnalazioni/gestione", { pageId, ...fields })
};
