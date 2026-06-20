import { UtentiModel } from "../models/UtentiModel.js";
import { DipendentiModel } from "../models/DipendentiModel.js";
import { PasswordService } from "./PasswordService.js";
import type { AuthResult } from "../types/domain.js";

const MAX_TENTATIVI = 3;

export const AuthService = {
  async login(usernameRaw: string, password: string): Promise<AuthResult> {
    const username = usernameRaw.trim().toLowerCase();
    if (!username || !password) return { ok: false, error: "Credenziali mancanti." };

    const utente = await UtentiModel.findByUsername(username);
    if (!utente) return { ok: false, error: "Credenziali non valide." };

    if (utente.bloccato) return { ok: false, error: "Utenza bloccata. Contatta un amministratore." };
    if (!utente.attivo) return { ok: false, error: "Utenza disattivata." };
    if (!utente.hashPassword || !utente.salt) {
      return { ok: false, error: "Errore di configurazione utenza. Contatta un amministratore." };
    }

    const match = PasswordService.verify(password, utente.hashPassword, utente.salt);
    if (!match) {
      const nuovi = utente.tentativiFalliti + 1;
      const daBloccare = nuovi >= MAX_TENTATIVI;
      await UtentiModel.setTentativiFalliti(utente.pageId, nuovi, daBloccare);
      return { ok: false, error: "Credenziali non valide." };
    }

    await UtentiModel.resetTentativiFalliti(utente.pageId);
    const ruoli = Array.from(new Set([utente.ruolo, ...utente.ruoliAggiuntivi]));

    // Il nome vero (richiesto da n8n per cercare turni/timbrature/profilo) vive
    // nell'anagrafica Dipendenti, non in Utenti web app: lo recuperiamo qui.
    const dipendente = await DipendentiModel.findByUsername(username);
    const nomeCompleto = dipendente ? `${dipendente.nome} ${dipendente.cognome}`.trim() : username;

    return { ok: true, username: utente.username, ruolo: utente.ruolo, ruoli, nome: nomeCompleto };
  }
};
