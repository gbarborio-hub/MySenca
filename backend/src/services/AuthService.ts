// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { UtentiModel } from "../models/UtentiModel.js";
import { DipendentiModel } from "../models/DipendentiModel.js";
import { PasswordService } from "./PasswordService.js";
import { AuditService } from "./AuditService.js";
import { notion } from "../models/notionClient.js";
import type { AuthResult } from "../types/domain.js";

const MAX_TENTATIVI = 3;

export const AuthService = {
  async login(usernameRaw: string, password: string, ip?: string): Promise<AuthResult> {
    const username = usernameRaw.trim().toLowerCase();
    if (!username || !password) return { ok: false, error: "Credenziali mancanti." };

    const utente = await UtentiModel.findByUsername(username);
    if (!utente) {
      // Tentativo su username inesistente — loggato come AUTH_FAIL senza dettagli sensibili
      AuditService.log(notion, { utente: username, ruolo: "", azione: "AUTH_FAIL", risorsa: "auth", dettaglio: "Username non trovato", ip: ip || "" });
      return { ok: false, error: "Credenziali non valide." };
    }

    if (utente.bloccato) {
      AuditService.log(notion, { utente: username, ruolo: utente.ruolo, azione: "AUTH_FAIL", risorsa: "auth", dettaglio: "Utenza bloccata", ip: ip || "" });
      return { ok: false, error: "Utenza bloccata. Contatta un amministratore." };
    }
    if (!utente.attivo) {
      AuditService.log(notion, { utente: username, ruolo: utente.ruolo, azione: "AUTH_FAIL", risorsa: "auth", dettaglio: "Utenza disattivata", ip: ip || "" });
      return { ok: false, error: "Utenza disattivata." };
    }
    if (!utente.hashPassword || !utente.salt) {
      return { ok: false, error: "Errore di configurazione utenza. Contatta un amministratore." };
    }

    const match = await PasswordService.verify(password, utente.hashPassword, utente.salt);
    if (!match) {
      const nuovi = utente.tentativiFalliti + 1;
      const daBloccare = nuovi >= MAX_TENTATIVI;
      UtentiModel.setTentativiFalliti(utente.pageId, nuovi, daBloccare).catch(() => {});
      AuditService.log(notion, { utente: username, ruolo: utente.ruolo, azione: "AUTH_FAIL", risorsa: "auth", dettaglio: `Tentativo ${nuovi}/${MAX_TENTATIVI}${daBloccare ? " — account bloccato" : ""}`, ip: ip || "" });
      return { ok: false, error: "Credenziali non valide." };
    }

    // Login riuscito
    UtentiModel.resetTentativiFalliti(utente.pageId).catch(() => {});
    const ruoli = Array.from(new Set([utente.ruolo, ...utente.ruoliAggiuntivi]));

    const dipendente = await DipendentiModel.findByUsername(username);
    const nomeCompleto = dipendente ? `${dipendente.nome} ${dipendente.cognome}`.trim() : username;

    AuditService.log(notion, { utente: username, ruolo: utente.ruolo, azione: "LOGIN", risorsa: "auth", dettaglio: `Ruoli: ${ruoli.join(", ")}`, ip: ip || "" });

    return { ok: true, username: utente.username, ruolo: utente.ruolo, ruoli, nome: nomeCompleto, createdTime: utente.createdTime };
  }
};
