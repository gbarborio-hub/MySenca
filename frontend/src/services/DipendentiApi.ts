import { api } from "./apiClient.js";
import type { Dipendente } from "../models/domain.js";

export const DipendentiApi = {
  list: () => api.get<Dipendente[]>("/dipendenti"),
  senzaUsername: () => api.get<Dipendente[]>("/dipendenti/senza-username"),
  salva: (payload: unknown) => api.post<{ ok: boolean; pageId?: string; error?: string }>("/dipendenti/salva", payload)
};
