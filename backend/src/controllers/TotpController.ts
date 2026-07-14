// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import type { Request, Response } from "express";
import { UtentiModel } from "../models/UtentiModel.js";
import { TotpService } from "../services/TotpService.js";
import { encrypt, decrypt } from "../services/EncryptionService.js";

export const TotpController = {
  async setup(req: Request, res: Response) {
    try {
      const { username } = req.body || {};
      if (!username) { res.status(400).json({ error: "Username mancante." }); return; }
      const utente = await UtentiModel.findByUsername(username);
      if (!utente) { res.status(404).json({ error: "Utente non trovato." }); return; }

      const secret = TotpService.generateSecret();
      const otpAuthUrl = TotpService.buildOtpAuthUrl(secret, username);
      const qrDataUrl = await TotpService.generateQrDataUrl(otpAuthUrl);

      await UtentiModel.setTotpSecret(utente.pageId, encrypt(secret));

      res.json({ ok: true, qrDataUrl, manualKey: secret });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Errore nella generazione del codice TOTP." });
    }
  },

  async confirm(req: Request, res: Response) {
    try {
      const { username, token } = req.body || {};
      if (!username || !token) { res.status(400).json({ error: "Dati mancanti." }); return; }
      const utente = await UtentiModel.findByUsername(username);
      if (!utente || !utente.totpSecret) { res.status(404).json({ error: "Nessuna configurazione TOTP in corso." }); return; }

      const secret = decrypt(utente.totpSecret);
      const valido = TotpService.verifyToken(secret, token);
      if (!valido) { res.status(400).json({ ok: false, error: "Codice non valido. Riprova." }); return; }

      await UtentiModel.setTotpAbilitato(utente.pageId, true);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Errore nella conferma." });
    }
  },

  async status(req: Request, res: Response) {
    try {
      const username = String(req.query.username || "");
      if (!username) { res.status(400).json({ error: "Username mancante." }); return; }
      const utente = await UtentiModel.findByUsername(username);
      if (!utente) { res.status(404).json({ error: "Utente non trovato." }); return; }
      res.json({ enabled: utente.totpAbilitato });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Errore." });
    }
  },

  async disable(req: Request, res: Response) {
    try {
      const { username } = req.body || {};
      if (!username) { res.status(400).json({ error: "Username mancante." }); return; }
      const utente = await UtentiModel.findByUsername(username);
      if (!utente) { res.status(404).json({ error: "Utente non trovato." }); return; }

      await UtentiModel.disableTotp(utente.pageId);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Errore nella disattivazione." });
    }
  }
};
