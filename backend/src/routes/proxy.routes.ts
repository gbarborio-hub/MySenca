// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
//
// Proxy verso i workflow n8n. Tre regole, tutte applicate QUI sul server:
//  1. Ogni rotta ha i suoi ruoli: le operazioni da Gestione personale (approvare
//     ferie/timbrature, liste di tutti, turni, strutture, comunicazioni, documenti)
//     non sono più raggiungibili da un Dipendente.
//  2. Per chi non è Gestione personale lo "username" inoltrato è SEMPRE quello del
//     token: un dipendente non può più leggere o agire a nome di un collega.
//  3. Ogni chiamata a n8n porta il segreto condiviso (vedi WebhookAuth).
// Rimosse le rotte che il frontend non usa più (gp-dipendenti, dipendente-salva,
// documento-elimina, turni-read) e quelle verso Make.com (contatti, ciclo, posts,
// incaricati, azione-nomina), i cui dati passano già dalle rotte native protette.
import { Router, Request, Response, NextFunction } from "express";
import { webhookHeaders } from "../services/WebhookAuth.js";

const N8N = (process.env.N8N_BASE_URL || "https://senca-hub.duckdns.org/webhook").replace(/\/+$/, "");
const GP = "Gestione personale";
const TIMEOUT_MS = 30_000;

type Ruolo = typeof GP | "Dipendente";

function isGP(req: Request): boolean {
  return (req.user?.ruoli || []).includes(GP);
}

function consenti(...ruoli: Ruolo[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const mie = req.user?.ruoli || [];
    if (!mie.some(r => (ruoli as string[]).includes(r))) {
      res.status(403).json({ ok: false, error: "Non hai i permessi per questa operazione." });
      return;
    }
    next();
  };
}

function corpo(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body) ? { ...req.body } : {};
}

// Il soggetto dell'operazione è l'utente del token. Gestione personale può indicare
// un altro dipendente (lo fa legittimamente per timbrature, ferie, comunicazioni).
function soloSeStesso(req: Request): Record<string, unknown> {
  const b = corpo(req);
  if (!isGP(req)) {
    b.username = req.user!.username;
    delete b.all; // la lista completa delle comunicazioni è solo per GP
  }
  return b;
}

// Per segnalazioni e ticket l'autore è sempre chi chiama, qualunque ruolo abbia.
function autoreDalToken(req: Request): Record<string, unknown> {
  return { ...corpo(req), username: req.user!.username };
}

async function proxy(url: string, body: unknown, req: Request, res: Response) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: webhookHeaders(req.user ? { username: req.user.username, ruoli: req.user.ruoli } : undefined),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    const data = await r.text();
    res.status(r.status).set("Content-Type", "application/json").send(data);
  } catch {
    res.status(502).json({ error: "Upstream error" });
  }
}

const tutti = consenti(GP, "Dipendente");
const soloGP = consenti(GP);

export const dipendentiProxyRouter = Router();

// --- Self-service del dipendente (e GP per conto di un dipendente) ---
for (const path of ["timbra", "timbrature-read", "profilo", "ferie-saldo", "ferie-lettura", "ferie-richiesta", "documenti-lista", "comunicazioni-lista"]) {
  dipendentiProxyRouter.post(`/${path}`, tutti, (req, res) => proxy(`${N8N}/${path}`, soloSeStesso(req), req, res));
}
for (const path of ["comunicazione-letta", "segnalazione", "app-ticket"]) {
  dipendentiProxyRouter.post(`/${path}`, tutti, (req, res) => proxy(`${N8N}/${path}`, autoreDalToken(req), req, res));
}
dipendentiProxyRouter.post("/strutture", tutti, (req, res) => proxy(`${N8N}/strutture`, corpo(req), req, res));

// --- Solo Gestione personale ---
for (const path of [
  "timbratura-update", "turni-griglia", "turni-scrivi", "legenda-read", "legenda-scrivi",
  "gp-strutture", "struttura-salva", "ferie-update", "comunicazione-crea", "comunicazione-letture",
  "documento-carica", "gp-timbrature", "gp-ferie"
]) {
  dipendentiProxyRouter.post(`/${path}`, soloGP, (req, res) => proxy(`${N8N}/${path}`, corpo(req), req, res));
}
