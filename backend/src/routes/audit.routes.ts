// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { Router } from "express";
import { AuditController } from "../controllers/AuditController.js";
import { AuditService } from "../services/AuditService.js";

export const auditRouter = Router();
auditRouter.get("/", AuditController.list);
auditRouter.get("/verifica", AuditController.verifica);

// Endpoint di test — chiama logSync in modo bloccante e restituisce l'esito direttamente.
// Rimuovere dopo aver confermato che la scrittura funziona.
auditRouter.get("/test", async (_req, res) => {
  try {
    await AuditService.logSync({
      utente: "test", ruolo: "Admin",
      azione: "LOGIN", risorsa: "test",
      dettaglio: "Test scrittura audit log", ip: "127.0.0.1"
    });
    res.json({ ok: true, message: "Record scritto con successo su Notion" });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message, stack: e?.stack });
  }
});
