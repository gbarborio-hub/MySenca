// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { Router } from "express";
import { makeAuditController } from "../controllers/AuditController.js";

export function makeAuditRouter(notion: any) {
  const router = Router();
  const ctrl = makeAuditController(notion);
  router.get("/", ctrl.list);
  router.get("/verifica", ctrl.verifica);
  return router;
}
