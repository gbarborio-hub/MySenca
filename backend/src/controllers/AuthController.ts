// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import type { Request, Response } from "express";
import { AuthService } from "../services/AuthService.js";

export const AuthController = {
  async login(req: Request, res: Response) {
    const { username, password } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ ok: false, error: "Username e password obbligatori." });
      return;
    }
    try {
      // Passa l'IP reale al service per il log di audit
      const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()
                || req.socket?.remoteAddress
                || "";
      const result = await AuthService.login(username, password, ip);
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
