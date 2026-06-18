import { api } from "./apiClient.js";
import type { Dipendente } from "../models/domain.js";

export const DipendentiApi = {
  list: () => api.get<Dipendente[]>("/dipendenti"),
  senzaUsername: () => api.get<Dipendente[]>("/dipendenti/senza-username")
};
