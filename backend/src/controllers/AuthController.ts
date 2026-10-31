// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import type { Request, Response } from "express";
import { AuthService } from "../services/AuthService.js";

// req.ip rispetta "trust proxy" (1 hop, Render): non si può falsificare con un
// X-Forwarded-For inventato dal client, a differenza del primo valore dell'header.
function getIp(req: Request): string {
  return (req.ip || req.socket?.remoteAddress || "").slice(0, 64);
}

export const AuthController = {
  async login(req: Request, res: Response) {
    const { username, password, remember } = req.body || {};
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ ok: false, error: "Username e password obbligatori." });
      return;
    }
    try {
      const result = await AuthService.login(username, password, !!remember, getIp(req));
      if (!result.ok) {
        res.status(401).json(result);
        return;
      }
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: "Errore interno. Riprova." });
    }
  },

  async verifyTotp(req: Request, res: Response) {
    // Serve il token "MFA in attesa" ricevuto dal login con password corretta:
    // username + codice da soli non bastano più.
    const { mfaToken, token, remember } = req.body || {};
    if (!mfaToken || !token) {
      res.status(400).json({ ok: false, error: "Sessione di accesso scaduta. Inserisci di nuovo username e password." });
      return;
    }
    try {
      const result = await AuthService.verifyTotp(String(mfaToken), String(token), !!remember, getIp(req));
      if (!result.ok) {
        res.status(401).json(result);
        return;
      }
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: "Errore interno. Riprova." });
    }
  }
};
