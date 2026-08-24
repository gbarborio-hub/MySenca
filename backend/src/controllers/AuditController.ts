// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import type { Request, Response } from "express";
import { AuditModel } from "../models/AuditModel.js";
import { AuditService } from "../services/AuditService.js";

export const AuditController = {
  async list(req: Request, res: Response) {
    try {
      const { cursor, utente, azione, pageSize } = req.query as Record<string, string>;
      const result = await AuditModel.list({
        pageSize: pageSize ? Math.min(parseInt(pageSize), 100) : 50,
        startCursor: cursor,
        filtroUtente: utente,
        filtroAzione: azione
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Errore lettura audit log." });
    }
  },

  async verifica(_req: Request, res: Response) {
    try {
      const result = await AuditService.verificaIntegrita();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Errore verifica integrità." });
    }
  },

  // Eventi loggati esplicitamente dal frontend per azioni che non passano da
  // nessun'altra chiamata API: sblocco Face ID/Touch ID, logout.
  async event(req: Request, res: Response) {
    try {
      const utente = req.user?.username || "";
      const ruolo = (req.headers["x-ruolo-attivo"] as string) || req.user?.ruolo || "";
      const { azione, dettaglio } = req.body || {};
      if (!utente || !azione) {
        res.status(400).json({ ok: false, error: "Dati mancanti." });
        return;
      }
      const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()
                || req.socket?.remoteAddress || "";
      AuditService.log({ utente, ruolo, azione, risorsa: "client-event", dettaglio: dettaglio || "", ip });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Errore registrazione evento." });
    }
  }
};
