// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
//
// Gestione del PROPRIO secondo fattore. L'account su cui si agisce è SEMPRE quello
// del token verificato (req.user), mai uno username inviato dal client: prima
// qualunque utente loggato poteva attivare/sostituire/disattivare il TOTP di
// chiunque, Admin compresi, e prenderne così il controllo.
// Per azzerare il TOTP di un altro utente (es. telefono perso) un Admin può
// togliere la spunta "TOTP Attivo" sulla sua riga Utenti in Notion.
import type { Request, Response } from "express";
import { UtentiModel } from "../models/UtentiModel.js";
import { TotpService } from "../services/TotpService.js";
import { encrypt, decryptStrict } from "../services/EncryptionService.js";

function utenteCorrente(req: Request, res: Response): string | null {
  const username = (req.user?.username || "").trim().toLowerCase();
  if (!username) { res.status(401).json({ error: "Non autenticato." }); return null; }
  return username;
}

function segretoValido(utente: { totpSecret: string }): string | null {
  try { return decryptStrict(utente.totpSecret); } catch { return null; }
}

export const TotpController = {
  async setup(req: Request, res: Response) {
    try {
      const username = utenteCorrente(req, res); if (!username) return;
      const utente = await UtentiModel.findByUsername(username);
      if (!utente) { res.status(404).json({ error: "Utente non trovato." }); return; }
      // Con il TOTP già attivo non si può sostituire il segreto da qui: prima va
      // disattivato (operazione che richiede un codice valido).
      if (utente.totpAbilitato) { res.status(409).json({ error: "L'autenticazione a due fattori è già attiva. Disattivala prima di riconfigurarla." }); return; }

      const secret = TotpService.generateSecret();
      const otpAuthUrl = TotpService.buildOtpAuthUrl(secret, username);
      const qrDataUrl = await TotpService.generateQrDataUrl(otpAuthUrl);
      await UtentiModel.setTotpSecret(utente.pageId, encrypt(secret));
      res.json({ ok: true, qrDataUrl, manualKey: secret });
    } catch {
      res.status(500).json({ error: "Errore nella generazione del codice TOTP." });
    }
  },

  async confirm(req: Request, res: Response) {
    try {
      const username = utenteCorrente(req, res); if (!username) return;
      const { token } = req.body || {};
      if (!token) { res.status(400).json({ error: "Codice mancante." }); return; }
      const utente = await UtentiModel.findByUsername(username);
      if (!utente || !utente.totpSecret) { res.status(404).json({ error: "Nessuna configurazione TOTP in corso." }); return; }
      if (utente.totpAbilitato) { res.status(409).json({ error: "Già attiva." }); return; }

      const secret = segretoValido(utente);
      if (!secret || !TotpService.verifyTokenOnce(username, secret, String(token))) {
        res.status(400).json({ ok: false, error: "Codice non valido. Riprova." }); return;
      }
      await UtentiModel.setTotpAbilitato(utente.pageId, true);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Errore nella conferma." });
    }
  },

  async status(req: Request, res: Response) {
    try {
      const username = utenteCorrente(req, res); if (!username) return;
      const utente = await UtentiModel.findByUsername(username);
      if (!utente) { res.status(404).json({ error: "Utente non trovato." }); return; }
      res.json({ enabled: utente.totpAbilitato });
    } catch {
      res.status(500).json({ error: "Errore." });
    }
  },

  async disable(req: Request, res: Response) {
    try {
      const username = utenteCorrente(req, res); if (!username) return;
      const { token } = req.body || {};
      const utente = await UtentiModel.findByUsername(username);
      if (!utente) { res.status(404).json({ error: "Utente non trovato." }); return; }
      if (!utente.totpAbilitato) { res.json({ ok: true }); return; }
      // Disattivare il secondo fattore richiede di dimostrare di averlo.
      const secret = segretoValido(utente);
      if (!token || !secret || !TotpService.verifyTokenOnce(username, secret, String(token))) {
        res.status(400).json({ ok: false, error: "Inserisci un codice valido dalla tua app per disattivare." }); return;
      }
      await UtentiModel.disableTotp(utente.pageId);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Errore nella disattivazione." });
    }
  }
};
