// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { Router } from "express";
import { SecurityAuditController } from "../controllers/SecurityAuditController.js";

// Router "misto": /ingest è pubblico (protetto dal proprio segreto, chiamato da
// GitHub Actions) e viene montato in server.ts PRIMA del middleware di
// autenticazione utenti. /ultimo e /storico sono montati dopo, protetti da
// requireRole("Admin") come le altre rotte riservate.
export const securityAuditIngestRouter = Router();
securityAuditIngestRouter.post("/ingest", SecurityAuditController.ingest);

export const securityAuditReadRouter = Router();
securityAuditReadRouter.get("/ultimo", SecurityAuditController.ultimo);
securityAuditReadRouter.get("/storico", SecurityAuditController.storico);
