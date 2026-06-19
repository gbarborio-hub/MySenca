import { api } from "./apiClient.js";

// Calls the backend /api/proxy/* which proxies to n8n/Make
const p = <T>(path: string, body: unknown = {}) => api.post<T>(`/proxy/${path}`, body);

export const ProxyApi = {
  // Strutture
  strutture: () => p<any[]>("/strutture", {}),
  // Profilo dipendente
  profilo: (username: string) => p<any>("/profilo", { username }),
  // Turni
  turniRead: (nome: string) => p<any[]>("/turni-read", { nome }),
  // Timbrature dipendente
  timbratureRead: (username: string) => p<any[]>("/timbrature-read", { username }),
  timbra: (payload: unknown) => p<any>("/timbra", payload),
  // Ferie
  ferieSaldo: (username: string) => p<any>("/ferie-saldo", { username }),
  ferieLettura: (username: string) => p<any[]>("/ferie-lettura", { username }),
  ferieRichiesta: (payload: unknown) => p<any>("/ferie-richiesta", payload),
  // Comunicazioni
  dipComunicazioni: (username: string) => p<any[]>("/dip-comunicazioni", { username }),
  dipComunicazioneLetta: (id: string) => p<any>("/dip-comunicazione-letta", { id }),
  // Documenti
  dipDocs: (username: string) => p<any[]>("/dip-docs", { username }),
  // Contatti
  contatti: () => p<any[]>("/contatti", {}),
  // Segnalazione
  segnalazione: (payload: unknown) => p<any>("/segnalazione", payload),
  // GP
  gpDipendenti: () => p<any[]>("/gp-dipendenti", {}),
  gpTimbrature: (payload?: unknown) => p<any[]>("/gp-timbrature", payload || {}),
  gpFerie: (payload?: unknown) => p<any[]>("/gp-ferie", payload || {}),
  gpComunicazioni: () => p<any[]>("/gp-comunicazioni", {}),
  gpComInvia: (payload: unknown) => p<any>("/gp-com-invia", payload),
  gpComLetta: (id: string) => p<any>("/gp-com-letta", { id }),
  gpBuste: (dipId: string) => p<any[]>("/gp-buste", { dipId }),
  gpDocs: (dipId: string) => p<any[]>("/gp-docs", { dipId }),
  gpDocUpload: (payload: unknown) => p<any>("/gp-doc-upload", payload),
  strutturaSalva: (payload: unknown) => p<any>("/struttura-salva", payload),
  gpStrutture: () => p<any[]>("/gp-strutture", {}),
  // Privacy
  posts: () => p<any[]>("/posts", {}),
  incaricati: () => p<any[]>("/incaricati", {}),
};
