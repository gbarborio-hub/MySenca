// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
// Middleware Express che intercetta ogni richiesta autenticata e la logga sull'AuditLog.

import type { Request, Response, NextFunction } from "express";
import { AuditService } from "../services/AuditService.js";
import type { AuditAzione } from "../services/AuditService.js";

// Mappa method HTTP → azione audit
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

// Endpoint che override l'azione (es. /stato, /nota, /elimina non sono sempre CREATE)
function overrideAzione(path: string, method: string): AuditAzione {
  if (path.includes("/stato")) return "UPDATE";
  if (path.includes("/nota")) return "UPDATE";
  if (path.includes("/gestione")) return "UPDATE";
  if (path.includes("/elimina")) return "DELETE";
  if (path.includes("/verifica-firma")) return "UPDATE";
  if (path.includes("/carica")) return "UPDATE";
  if (path.includes("/auth/login")) return "LOGIN";
  if (path.includes("/auth/logout")) return "LOGOUT";
  return methodToAzione(method);
}

// Estrae il nome della risorsa dal path (es. /api/dipendenti/xxx → dipendenti)
function extractRisorsa(path: string): string {
  const segments = path.replace(/^\/api\//, "").split("/");
  return segments[0] || "unknown";
}

// Endpoint da NON loggare (troppo rumorosi o irrilevanti)
const SKIP_PATHS = [
  "/api/health",
  "/api/audit" // evita log ricorsivi
];

export function auditMiddleware(notion: any) {
  return function (req: Request, _res: Response, next: NextFunction) {
    // Salta gli endpoint esclusi
    if (SKIP_PATHS.some(p => req.path.startsWith(p))) {
      return next();
    }

    // Salta le richieste non autenticate — l'utente non è ancora identificabile
    // (le richieste di login vengono loggare da AuthService direttamente)
    const utente = (req as any).user?.username || "";
    const ruolo = (req as any).user?.ruolo || "";

    if (!utente && !req.path.includes("/auth/login")) {
      return next();
    }

    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()
              || req.socket?.remoteAddress
              || "";

    const azione = overrideAzione(req.path, req.method);
    const risorsa = extractRisorsa(req.path);
    const dettaglio = req.params?.id ? `id:${req.params.id}` : "";

    // Log non bloccante — il middleware non attende la scrittura su Notion
    AuditService.log(notion, { utente, ruolo, azione, risorsa, dettaglio, ip });

    next();
  };
}
