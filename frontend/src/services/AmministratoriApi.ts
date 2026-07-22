import { api } from "./apiClient.js";

export type TipoAmministratore = "Interno" | "Esterno" | "";

export interface Amministratore {
  pageId: string;
  nome: string;
  email: string;
  mansione: string;
  tipo: TipoAmministratore;
  societaEsterna: string;
  note: string;
  dataNomina: string | null;
  nominaFirmata: boolean;
}

export interface AmministratoreCreateInput {
  nome: string;
  email?: string;
  mansione?: string;
  tipo?: TipoAmministratore;
  societaEsterna?: string;
  note?: string;
}

export const AmministratoriApi = {
  list: () => api.get<Amministratore[]>("/amministratori"),
  create: (input: AmministratoreCreateInput) => api.post<{ ok: boolean; pageId?: string; error?: string }>("/amministratori", input),
  update: (pageId: string, fields: Partial<AmministratoreCreateInput> & { nominaFirmata?: boolean }) =>
    api.post<{ ok: boolean }>("/amministratori/update", { pageId, ...fields }),
  elimina: (pageId: string) => api.post<{ ok: boolean }>("/amministratori/elimina", { pageId })
};
