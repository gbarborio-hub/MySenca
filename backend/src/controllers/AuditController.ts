// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import type { Request, Response } from "express";
import { AuditModel } from "../models/AuditModel.js";
import { AuditService } from "../services/AuditService.js";

export function makeAuditController(notion: any) {
  return {
    async list(req: Request, res: Response) {
      try {
        const { cursor, utente, azione, pageSize } = req.query as Record<string, string>;
        const result = await AuditModel.list(notion, {
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

    async verifica(req: Request, res: Response) {
      try {
        const result = await AuditService.verificaIntegrita(notion);
        res.json(result);
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "Errore verifica integrità." });
      }
    }
  };
}
