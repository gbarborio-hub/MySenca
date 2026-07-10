// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { Router } from "express";
import { AuditController } from "../controllers/AuditController.js";

export const auditRouter = Router();
auditRouter.get("/", AuditController.list);
auditRouter.get("/verifica", AuditController.verifica);
auditRouter.post("/event", AuditController.event);
