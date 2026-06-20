import { api } from "./apiClient.js";

// Calls the backend /api/proxy/* which proxies to n8n/Make
const p = <T>(path: string, body: unknown = {}) => api.post<T>(`/proxy/${path}`, body);

export const ProxyApi = {
  // Strutture
  strutture: () => p<any[]>("/strutture", {}),
  gpStrutture: () => p<any[]>("/gp-strutture", {}),
  strutturaSalva: (payload: unknown) => p<any>("/struttura-salva", payload),
  // Profilo
  profilo: (username: string) => p<any>("/profilo", { username }),
  // Turni
  turniRead: (nome: string) => p<any[]>("/turni-read", { nome }),
  turniGriglia: (payload?: unknown) => p<any[]>("/turni-griglia", payload || {}),
  turniScrivi: (payload: unknown) => p<any>("/turni-scrivi", payload),
  legendaRead: () => p<any[]>("/legenda-read", {}),
  legendaScrivi: (payload: unknown) => p<any>("/legenda-scrivi", payload),
  // Timbrature
  timbratureRead: (username: string) => p<any[]>("/timbrature-read", { username }),
  timbra: (payload: unknown) => p<any>("/timbra", payload),
  timbraturaUpdate: (payload: unknown) => p<any>("/timbratura-update", payload),
  // Ferie
  ferieSaldo: (username: string) => p<any>("/ferie-saldo", { username }),
  ferieLettura: (username: string) => p<any[]>("/ferie-lettura", { username }),
  ferieRichiesta: (payload: unknown) => p<any>("/ferie-richiesta", payload),
  ferieUpdate: (payload: unknown) => p<any>("/ferie-update", payload),
  // Comunicazioni (condivise dipendente + GP)
  comunicazioniLista: (payload?: unknown) => p<any[]>("/comunicazioni-lista", payload || {}),
  comunicazioneCrea: (payload: unknown) => p<any>("/comunicazione-crea", payload),
  comunicazioneLetta: (id: string) => p<any>("/comunicazione-letta", { id }),
  comunicazioneLetture: (comunicazioneId: string) => p<any[]>("/comunicazione-letture", { comunicazioneId }),
  // Documenti (condivisi dipendente + GP)
  documentiLista: (payload?: unknown) => p<any[]>("/documenti-lista", payload || {}),
  documentoCarica: (payload: unknown) => p<any>("/documento-carica", payload),
  documentoElimina: (payload: unknown) => p<any>("/documento-elimina", payload),
  // Contatti
  contatti: () => p<any[]>("/contatti", {}),
  // Segnalazione
  segnalazione: (payload: unknown) => p<any>("/segnalazione", payload),
  appTicket: (payload: unknown) => p<any>("/app-ticket", payload),
  dipendenteSalva: (payload: unknown) => p<any>("/dipendente-salva", payload),
  // GP
  gpDipendenti: () => p<any[]>("/gp-dipendenti", {}),
  gpTimbrature: (payload?: unknown) => p<any[]>("/gp-timbrature", payload || {}),
  gpFerie: (payload?: unknown) => p<any[]>("/gp-ferie", payload || {}),
  // Privacy (Make)
  posts: () => p<any[]>("/posts", {}),
  incaricati: () => p<any[]>("/incaricati", {}),
  azioneNomina: (payload: unknown) => p<any>("/azione-nomina", payload),
};
