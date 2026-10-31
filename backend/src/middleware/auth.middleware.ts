// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
//
// Applicato a tutte le rotte /api tranne /api/auth/* (login e verifica TOTP, che
// sono il modo con cui si ottiene il token) e /api/health. Se manca un token
// valido, la richiesta viene rifiutata con 401 prima di raggiungere qualunque
// controller — sostituisce la vecchia fiducia nell'header X-Username, che non
// veniva mai verificato.
import type { Request, Response, NextFunction } from "express";
import { TokenService } from "../services/TokenService.js";
import { SessionValidityService } from "../services/SessionValidityService.js";

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
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

  // Il token è firmato correttamente e non scaduto, ma l'account potrebbe essere
  // stato disattivato o bloccato, o i suoi ruoli cambiati, DOPO che è stato emesso:
  // controllo con cache breve (30s) per non interrogare Notion a ogni richiesta.
  const stato = await SessionValidityService.stato(payload.username);
  if (stato.nonVerificabile) {
    res.status(503).json({ ok: false, error: "Servizio temporaneamente non disponibile. Riprova tra poco." });
    return;
  }
  if (!stato.valida) {
    res.status(401).json({ ok: false, error: "Utenza disattivata o bloccata. Contatta un amministratore." });
    return;
  }

  // I ruoli usati da requireRole sono quelli ATTUALI, non quelli scritti nel token.
  req.user = { ...payload, ruolo: stato.ruolo || payload.ruolo, ruoli: stato.ruoli };
  next();
}
