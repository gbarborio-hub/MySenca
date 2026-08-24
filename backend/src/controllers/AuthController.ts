// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import type { Request, Response } from "express";
import { AuthService } from "../services/AuthService.js";

function getIp(req: Request): string {
  return req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()
      || req.socket?.remoteAddress || "";
}

export const AuthController = {
  async login(req: Request, res: Response) {
    const { username, password, remember } = req.body || {};
    if (!username || !password) {
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
    const { username, token, remember } = req.body || {};
    if (!username || !token) {
      res.status(400).json({ ok: false, error: "Username e codice obbligatori." });
      return;
    }
    try {
      const result = await AuthService.verifyTotp(username, token, !!remember, getIp(req));
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
