import { api } from "./apiClient.js";

export interface Post {
  pageId: string;
  titolo: string;
  canale: string;
  stato: string;
  tipoContenuto: string;
  dataPubblicazione: string | null;
  caption: string;
  hashtag: string;
  link: string;
  note: string;
  responsabile: string;
}

export interface Incaricato {
  pageId: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  struttura: string;
  note: string;
  dataNomina: string | null;
  dataScadenza: string | null;
  documentoFirmato: boolean;
}

export interface DipendenteMancante {
  pageId: string;
  nome: string;
  cognome: string;
  mansione: string;
  struttura: string;
  email: string | null;
}

export const PostsApi = {
  list: () => api.get<Post[]>("/posts")
};

export const IncaricatiApi = {
  list: () => api.get<Incaricato[]>("/incaricati"),
  setFirmato: (pageId: string, firmato: boolean) => api.post<{ ok: boolean }>("/incaricati/firmato", { pageId, firmato }),
  mancanti: () => api.get<DipendenteMancante[]>("/incaricati/mancanti"),
  creaSelezionati: (dipendenti: DipendenteMancante[]) =>
    api.post<{ ok: boolean; creati: number; falliti: { input: any; error: string }[] }>("/incaricati/crea-selezionati", { dipendenti })
};
