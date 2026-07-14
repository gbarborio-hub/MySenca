// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { Router } from "express";
import { TotpController } from "../controllers/TotpController.js";

export const totpRouter = Router();
totpRouter.get("/status", TotpController.status);
totpRouter.post("/setup", TotpController.setup);
totpRouter.post("/confirm", TotpController.confirm);
totpRouter.post("/disable", TotpController.disable);
