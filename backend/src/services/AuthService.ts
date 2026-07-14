// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { UtentiModel } from "../models/UtentiModel.js";
import { DipendentiModel } from "../models/DipendentiModel.js";
import { PasswordService } from "./PasswordService.js";
import { AuditService } from "./AuditService.js";
import { TotpService } from "./TotpService.js";
import { decrypt } from "./EncryptionService.js";
import type { AuthResult } from "../types/domain.js";

const MAX_TENTATIVI = 3;

async function buildSuccessResult(utente: any, username: string): Promise<AuthResult> {
  const ruoli = Array.from(new Set([utente.ruolo, ...utente.ruoliAggiuntivi]));
  const dipendente = await DipendentiModel.findByUsername(username);
  const nomeCompleto = dipendente ? `${dipendente.nome} ${dipendente.cognome}`.trim() : username;
  return { ok: true, username: utente.username, ruolo: utente.ruolo, ruoli, nome: nomeCompleto, createdTime: utente.createdTime };
}

export const AuthService = {
  async login(usernameRaw: string, password: string, ip?: string): Promise<AuthResult> {
    const username = usernameRaw.trim().toLowerCase();
    if (!username || !password) return { ok: false, error: "Credenziali mancanti." };

    const utente = await UtentiModel.findByUsername(username);
    if (!utente) {
      AuditService.log({ utente: username, ruolo: "", azione: "AUTH_FAIL", risorsa: "auth", dettaglio: "Username non trovato", ip: ip || "" });
      return { ok: false, error: "Credenziali non valide." };
    }

    if (utente.bloccato) {
      AuditService.log({ utente: username, ruolo: utente.ruolo, azione: "AUTH_FAIL", risorsa: "auth", dettaglio: "Utenza bloccata", ip: ip || "" });
      return { ok: false, error: "Utenza bloccata. Contatta un amministratore." };
    }
    if (!utente.attivo) {
      AuditService.log({ utente: username, ruolo: utente.ruolo, azione: "AUTH_FAIL", risorsa: "auth", dettaglio: "Utenza disattivata", ip: ip || "" });
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
      AuditService.log({ utente: username, ruolo: utente.ruolo, azione: "AUTH_FAIL", risorsa: "auth", dettaglio: `Tentativo ${nuovi}/${MAX_TENTATIVI}${daBloccare ? " — account bloccato" : ""}`, ip: ip || "" });
      return { ok: false, error: "Credenziali non valide." };
    }

    UtentiModel.resetTentativiFalliti(utente.pageId).catch(() => {});

    // Password corretta ma TOTP attivo: non completare il login, il frontend
    // dovrà chiamare /auth/totp-verify con il codice a 6 cifre per proseguire.
    // Nessun log LOGIN qui — l'accesso non è ancora concluso.
    if (utente.totpAbilitato) {
      return { ok: true, requiresTotp: true, username: utente.username };
    }

    AuditService.log({ utente: username, ruolo: utente.ruolo, azione: "LOGIN", risorsa: "auth", dettaglio: "Login diretto (TOTP non attivo)", ip: ip || "" });
    return buildSuccessResult(utente, username);
  },

  async verifyTotp(usernameRaw: string, token: string, ip?: string): Promise<AuthResult> {
    const username = usernameRaw.trim().toLowerCase();
    const utente = await UtentiModel.findByUsername(username);
    if (!utente || !utente.totpAbilitato || !utente.totpSecret) {
      return { ok: false, error: "Autenticazione a due fattori non configurata per questo utente." };
    }

    const secret = decrypt(utente.totpSecret);
    const valido = TotpService.verifyToken(secret, token);
    if (!valido) {
      AuditService.log({ utente: username, ruolo: utente.ruolo, azione: "AUTH_FAIL", risorsa: "auth", dettaglio: "Codice TOTP errato", ip: ip || "" });
      return { ok: false, error: "Codice non valido. Riprova." };
    }

    const ruoli = Array.from(new Set([utente.ruolo, ...utente.ruoliAggiuntivi]));
    AuditService.log({ utente: username, ruolo: utente.ruolo, azione: "LOGIN", risorsa: "auth", dettaglio: `Login con TOTP. Ruoli: ${ruoli.join(", ")}`, ip: ip || "" });
    return buildSuccessResult(utente, username);
  }
};
