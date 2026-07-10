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
  if (path.includes("/auth/logout")) return "LOGOUT";
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

    const utente = (req as any).user?.username || "";
    const ruolo = (req as any).user?.ruolo || "";

    if (!utente && !req.path.includes("/auth/login")) return next();

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
