// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
//
// Autorizzazione per ruolo. Applicato DOPO auth.middleware.ts (che verifica il
// token e popola req.user): qui si controlla non più "chi sei" ma "cosa puoi fare".
// Prima di questo, un token valido di qualunque ruolo poteva chiamare qualunque
// endpoint — l'interfaccia nascondeva le sezioni non pertinenti, ma il backend non
// bloccava nulla.
//
// Il controllo usa req.user.ruoli (TUTTI i ruoli assegnati all'utente, presi dal
// token) e non un singolo "ruolo attivo": chi ha più ruoli può passare da uno
// all'altro senza un nuovo login, quindi l'autorizzazione deve valere per l'intero
// insieme, non per la scelta di interfaccia del momento.
import type { Request, Response, NextFunction } from "express";
import type { Ruolo } from "../types/domain.js";

export function requireRole(...ruoliAmmessi: Ruolo[]) {
  return function (req: Request, res: Response, next: NextFunction): void {
    const ruoliUtente = req.user?.ruoli || [];
    const autorizzato = ruoliUtente.some(r => ruoliAmmessi.includes(r as Ruolo));
    if (!autorizzato) {
      res.status(403).json({ ok: false, error: "Non hai i permessi per questa operazione." });
      return;
    }
    next();
  };
}
