// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { UtentiModel } from "../models/UtentiModel.js";
import { DipendentiModel } from "../models/DipendentiModel.js";
import { PasswordService } from "./PasswordService.js";
import { AuditService } from "./AuditService.js";
import { TotpService } from "./TotpService.js";
import { TokenService } from "./TokenService.js";
import { decryptStrict } from "./EncryptionService.js";
import { LoginThrottleService } from "./LoginThrottleService.js";
import type { AuthResult } from "../types/domain.js";

async function buildSuccessResult(utente: any, username: string, remember: boolean): Promise<AuthResult> {
  const ruoli = Array.from(new Set([utente.ruolo, ...utente.ruoliAggiuntivi]));
  const dipendente = await DipendentiModel.findByUsername(username);
  const nomeCompleto = dipendente ? `${dipendente.nome} ${dipendente.cognome}`.trim() : username;
  const token = TokenService.sign({ username: utente.username, ruolo: utente.ruolo, ruoli }, remember);
  return { ok: true, username: utente.username, ruolo: utente.ruolo, ruoli, nome: nomeCompleto, createdTime: utente.createdTime, token };
}

// Messaggio unico per tutti i casi di accesso negato: non rivela se l'utente
// esiste, se è bloccato o disattivato, né se ha il TOTP attivo.
const ERRORE_GENERICO = "Credenziali non valide.";
const ERRORE_SOSPESO = "Troppi tentativi falliti. Riprova tra qualche minuto.";

export const AuthService = {
  async login(usernameRaw: string, password: string, remember: boolean, ip?: string): Promise<AuthResult> {
    const username = String(usernameRaw || "").trim().toLowerCase();
    if (!username || !password) return { ok: false, error: "Credenziali mancanti." };

    if (LoginThrottleService.bloccatoPer(username) > 0) {
      AuditService.log({ utente: username, ruolo: "", azione: "AUTH_FAIL", risorsa: "auth", dettaglio: "Tentativo durante sospensione temporanea", ip: ip || "" });
      return { ok: false, error: ERRORE_SOSPESO };
    }

    const utente = await UtentiModel.findByUsername(username);
    if (!utente || !utente.hashPassword || !utente.salt) {
      // Calcolo fittizio: stessi tempi di risposta di un utente esistente.
      await PasswordService.verify(password, "0".repeat(64), "0".repeat(32)).catch(() => false);
      LoginThrottleService.registraErrore(username);
      AuditService.log({ utente: username, ruolo: "", azione: "AUTH_FAIL", risorsa: "auth", dettaglio: utente ? "Utenza senza credenziali configurate" : "Username non trovato", ip: ip || "" });
      return { ok: false, error: ERRORE_GENERICO };
    }

    const match = await PasswordService.verify(password, utente.hashPassword, utente.salt);
    if (!match) {
      const sospeso = LoginThrottleService.registraErrore(username);
      UtentiModel.setTentativiFalliti(utente.pageId, utente.tentativiFalliti + 1, false).catch(() => {});
      AuditService.log({ utente: username, ruolo: utente.ruolo, azione: "AUTH_FAIL", risorsa: "auth", dettaglio: `Password errata${sospeso ? " — sospensione temporanea" : ""}`, ip: ip || "" });
      return { ok: false, error: sospeso ? ERRORE_SOSPESO : ERRORE_GENERICO };
    }

    // Password corretta: solo ora si può dire se l'utenza è bloccata/disattivata
    // (chi conosce la password è il titolare, non serve nasconderglielo).
    if (utente.bloccato) {
      AuditService.log({ utente: username, ruolo: utente.ruolo, azione: "AUTH_FAIL", risorsa: "auth", dettaglio: "Utenza bloccata", ip: ip || "" });
      return { ok: false, error: "Utenza bloccata. Contatta un amministratore." };
    }
    if (!utente.attivo) {
      AuditService.log({ utente: username, ruolo: utente.ruolo, azione: "AUTH_FAIL", risorsa: "auth", dettaglio: "Utenza disattivata", ip: ip || "" });
      return { ok: false, error: "Utenza disattivata." };
    }

    LoginThrottleService.azzera(username);
    if (utente.tentativiFalliti) UtentiModel.resetTentativiFalliti(utente.pageId).catch(() => {});

    // TOTP attivo: niente sessione. Si emette un token "MFA in attesa" (5 minuti,
    // uso singolo) che /auth/totp-verify esigerà: così il secondo fattore si
    // aggiunge alla password invece di sostituirla.
    if (utente.totpAbilitato) {
      return { ok: true, requiresTotp: true, username: utente.username, mfaToken: TokenService.signPending(utente.username) };
    }

    AuditService.log({ utente: username, ruolo: utente.ruolo, azione: "LOGIN", risorsa: "auth", dettaglio: "Login diretto (TOTP non attivo)", ip: ip || "" });
    return buildSuccessResult(utente, username, remember);
  },

  async verifyTotp(mfaToken: string, token: string, remember: boolean, ip?: string): Promise<AuthResult> {
    const username = TokenService.consumePending(String(mfaToken || ""));
    if (!username) {
      return { ok: false, error: "Sessione di accesso scaduta. Inserisci di nuovo username e password." };
    }

    if (LoginThrottleService.bloccatoPer(username) > 0) {
      return { ok: false, error: ERRORE_SOSPESO };
    }

    const utente = await UtentiModel.findByUsername(username);
    if (!utente || utente.bloccato || !utente.attivo || !utente.totpAbilitato || !utente.totpSecret) {
      return { ok: false, error: "Accesso non consentito. Contatta un amministratore." };
    }

    let secret: string;
    try {
      secret = decryptStrict(utente.totpSecret);
    } catch {
      // Chiave di cifratura errata o dato corrotto: MAI usare un valore sostitutivo.
      console.error(`[AuthService] Impossibile decifrare il segreto TOTP di ${username}`);
      AuditService.log({ utente: username, ruolo: utente.ruolo, azione: "AUTH_FAIL", risorsa: "auth", dettaglio: "Segreto TOTP non decifrabile", ip: ip || "" });
      return { ok: false, error: "Errore di configurazione del secondo fattore. Contatta un amministratore." };
    }

    if (!TotpService.verifyTokenOnce(username, secret, token)) {
      const sospeso = LoginThrottleService.registraErrore(username);
      AuditService.log({ utente: username, ruolo: utente.ruolo, azione: "AUTH_FAIL", risorsa: "auth", dettaglio: `Codice TOTP errato o già usato${sospeso ? " — sospensione temporanea" : ""}`, ip: ip || "" });
      // Il token MFA è già stato consumato: dopo un errore si riparte dalla password.
      return { ok: false, error: sospeso ? ERRORE_SOSPESO : "Codice non valido. Inserisci di nuovo username e password." };
    }

    LoginThrottleService.azzera(username);
    const ruoli = Array.from(new Set([utente.ruolo, ...utente.ruoliAggiuntivi]));
    AuditService.log({ utente: username, ruolo: utente.ruolo, azione: "LOGIN", risorsa: "auth", dettaglio: `Login con TOTP. Ruoli: ${ruoli.join(", ")}`, ip: ip || "" });
    return buildSuccessResult(utente, username, remember);
  }
};
