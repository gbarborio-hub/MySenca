// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
//
// Rate limiting per IP. Due livelli:
//  - apiLimiter: generale, su tutte le /api, per proteggere da abusi/sovraccarico.
//  - authLimiter: più stretto, solo su login/verifica TOTP, per rallentare i
//    tentativi di forza bruta a livello di IP — indipendente e complementare al
//    blocco account dopo 3 tentativi falliti già gestito in AuthService (quello è
//    per-utente, questo è per-IP: coprono scenari diversi, es. un IP che prova
//    tante username diverse non farebbe scattare il blocco per singolo account).
import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Troppe richieste. Riprova tra qualche minuto." }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Troppi tentativi di accesso. Riprova tra qualche minuto." }
});
