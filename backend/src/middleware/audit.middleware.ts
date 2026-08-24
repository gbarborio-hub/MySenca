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

// Per le chiamate proxy (verso n8n), il primo segmento è sempre "proxy" e non dice
// nulla di utile — includiamo anche il secondo segmento per identificare l'azione reale
// (es. "proxy/turni-read" invece di solo "proxy").
function extractRisorsa(path: string): string {
  const segments = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  if (segments[0] === "proxy" && segments[1]) return `proxy/${segments[1]}`;
  return segments[0] || "unknown";
}

// Campi mai da loggare, anche se presenti nel corpo della richiesta.
const CAMPI_ESCLUSI = new Set(["password", "hashpassword", "hash", "salt", "token", "encryptionkey"]);

// Costruisce un dettaglio leggibile dell'operazione: ID nell'URL, query string,
// e alcuni campi identificativi comuni nel corpo — mai dati sensibili.
function buildDettaglio(req: Request): string {
  const parti: string[] = [];

  if (req.params?.id) parti.push(`id:${req.params.id}`);

  const query = req.query as Record<string, string>;
  const queryKeys = Object.keys(query || {});
  if (queryKeys.length) {
    parti.push(queryKeys.map(k => `${k}=${query[k]}`).join("&"));
  }

  if (req.body && typeof req.body === "object") {
    const b = req.body as Record<string, any>;
    for (const campo of ["username", "pageId", "stato", "azione", "titolo", "categoria"]) {
      if (CAMPI_ESCLUSI.has(campo.toLowerCase())) continue;
      if (b[campo] !== undefined && b[campo] !== null && typeof b[campo] !== "object") {
        parti.push(`${campo}:${b[campo]}`);
      }
    }
  }

  return parti.join(" | ").slice(0, 500); // limite di sicurezza sulla lunghezza
}

const SKIP_PATHS = ["/api/health", "/api/audit"];

export function auditMiddleware() {
  return function (req: Request, _res: Response, next: NextFunction) {
    if (SKIP_PATHS.some(p => req.path.startsWith(p))) return next();

    // Lo username viene SEMPRE dal token verificato: è l'unica fonte affidabile.
    // Il ruolo invece preferisce l'etichetta "ruolo attivo" (per chi ha più ruoli e
    // può cambiarli senza un nuovo login) quando presente, altrimenti quello del
    // token — in ogni caso è solo per rendere leggibile il log, mai per decidere
    // l'accesso.
    const utente = req.user?.username || "";
    const ruolo = (req.headers["x-ruolo-attivo"] as string) || req.user?.ruolo || "";

    if (!utente) return next();

    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()
              || req.socket?.remoteAddress || "";

    AuditService.log({
      utente, ruolo,
      azione: overrideAzione(req.path, req.method),
      risorsa: extractRisorsa(req.path),
      dettaglio: buildDettaglio(req),
      ip
    });

    next();
  };
}
