export type Ruolo = "Admin" | "Gestione personale" | "Dipendente" | "Privacy" | "Operatore" | "Utente";

export const RUOLI_CON_INTERFACCIA: Ruolo[] = ["Admin", "Gestione personale", "Dipendente", "Privacy"];

export interface Dipendente {
  pageId: string;
  nome: string;
  cognome: string;
  username: string | null;
  mansione: string;
  struttura: string;
  email: string | null;
  telefono: string | null;
  cf: string | null;
  matricola: string | null;
  contratto: string | null;
  nascita: string | null;
  dataAssunzione: string | null;
  note: string | null;
  attivo: boolean;
  oreSettimanali: number | null;
  monteFerie: number | null;
  monteRol: number | null;
  residuoFerieIniz: number | null;
  residuoRolIniz: number | null;
}

export interface UtenteWebApp {
  pageId: string;
  username: string;
  email: string;
  ruolo: Ruolo;
  ruoliAggiuntivi: Ruolo[];
  attivo: boolean;
  bloccato: boolean;
  tentativiFalliti: number;
  passwordAggiornataIl: string | null;
}

export interface AuthResult {
  ok: boolean;
  username?: string;
  ruolo?: Ruolo;
  ruoli?: Ruolo[];
  nome?: string;
  createdTime?: string | null;
  error?: string;
}

export interface CurrentUser {
  username: string;
  nome: string;
  ruoli: Ruolo[];
  activeRole: Ruolo;
  createdTime?: string | null;
}
