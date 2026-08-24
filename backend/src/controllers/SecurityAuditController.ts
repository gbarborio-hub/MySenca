// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import type { Request, Response } from "express";
import { SecurityAuditModel, type SecurityReport } from "../models/SecurityAuditModel.js";

export const SecurityAuditController = {
  // Chiamato da GitHub Actions, non da un utente loggato — non ha un token di
  // sessione (non è mai passato dal login). Protetto invece da un segreto
  // condiviso (SECURITY_AUDIT_SECRET), uguale su GitHub e su Render.
  async ingest(req: Request, res: Response) {
    const secret = process.env.SECURITY_AUDIT_SECRET;
    const fornito = req.headers["x-audit-secret"];
    if (!secret || fornito !== secret) {
      res.status(401).json({ ok: false, error: "Non autorizzato." });
      return;
    }
    const report = req.body as SecurityReport;
    if (!report?.dataControllo || !report.backend || !report.frontend) {
      res.status(400).json({ ok: false, error: "Report non valido." });
      return;
    }
    try {
      await SecurityAuditModel.salva(report);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(502).json({ ok: false, error: e?.message || "Errore nel salvataggio del report." });
    }
  },

  // Lettura per l'interfaccia admin — richiede ruolo Admin (vedi server.ts).
  async ultimo(_req: Request, res: Response) {
    try {
      const report = await SecurityAuditModel.ultimo();
      res.json(report);
    } catch (e: any) {
      res.status(502).json({ ok: false, error: e?.message || "Errore nel caricamento del report." });
    }
  },

  async storico(_req: Request, res: Response) {
    try {
      const lista = await SecurityAuditModel.storico(10);
      res.json(lista);
    } catch (e: any) {
      res.status(502).json({ ok: false, error: e?.message || "Errore nel caricamento dello storico." });
    }
  }
};
