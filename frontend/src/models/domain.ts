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
  error?: string;
}

export interface CurrentUser {
  username: string;
  nome: string;
  ruoli: Ruolo[];
  activeRole: Ruolo;
}
