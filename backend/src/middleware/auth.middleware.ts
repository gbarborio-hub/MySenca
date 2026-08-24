// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
//
// Applicato a tutte le rotte /api tranne /api/auth/* (login e verifica TOTP, che
// sono il modo con cui si ottiene il token) e /api/health. Se manca un token
// valido, la richiesta viene rifiutata con 401 prima di raggiungere qualunque
// controller — sostituisce la vecchia fiducia nell'header X-Username, che non
// veniva mai verificato.
import type { Request, Response, NextFunction } from "express";
import { TokenService } from "../services/TokenService.js";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    res.status(401).json({ ok: false, error: "Accesso non autenticato. Effettua il login." });
    return;
  }

  const payload = TokenService.verify(token);
  if (!payload) {
    res.status(401).json({ ok: false, error: "Sessione scaduta o non valida. Effettua di nuovo l'accesso." });
    return;
  }

  req.user = payload;
  next();
}
