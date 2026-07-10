// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import type { Request, Response, NextFunction } from "express";
import { AuditService } from "../services/AuditService.js";
import type { AuditAzione } from "../services/AuditService.js";

function methodToAzione(method: string): AuditAzione {
  switch (method.toUpperCase()) {
    case "GET": return "READ";
    case "POST": return "CREATE";
    case "PUT":
    case "PATCH": return "UPDATE";
    case "DELETE": return "DELETE";
    default: return "READ";
  }
}

function overrideAzione(path: string, method: string): AuditAzione {
  if (path.includes("/stato")) return "UPDATE";
  if (path.includes("/nota")) return "UPDATE";
  if (path.includes("/gestione")) return "UPDATE";
  if (path.includes("/elimina")) return "DELETE";
  if (path.includes("/verifica-firma")) return "UPDATE";
  if (path.includes("/carica")) return "UPDATE";
  if (path.includes("/auth/login")) return "LOGIN";
  return methodToAzione(method);
}

function extractRisorsa(path: string): string {
  const segments = path.replace(/^\/api\//, "").split("/");
  return segments[0] || "unknown";
}

const SKIP_PATHS = ["/api/health", "/api/audit"];

export function auditMiddleware() {
  return function (req: Request, _res: Response, next: NextFunction) {
    if (SKIP_PATHS.some(p => req.path.startsWith(p))) return next();

    // L'identità arriva via header, impostato dal frontend (apiClient.ts) dopo
    // login/sblocco Face ID/cambio ruolo. Non esiste sessione server-side (JWT/cookie),
    // quindi questo è l'unico modo per il middleware di sapere chi sta chiamando.
    const utente = (req.headers["x-username"] as string) || "";
    const ruolo = (req.headers["x-ruolo"] as string) || "";

    // La chiamata di login stessa non ha ancora l'header (l'utente non è ancora
    // autenticato) — quell'evento specifico è già loggato direttamente da AuthController.
    if (!utente) return next();

    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()
              || req.socket?.remoteAddress || "";

    AuditService.log({
      utente, ruolo,
      azione: overrideAzione(req.path, req.method),
      risorsa: extractRisorsa(req.path),
      dettaglio: req.params?.id ? `id:${req.params.id}` : "",
      ip
    });

    next();
  };
}
