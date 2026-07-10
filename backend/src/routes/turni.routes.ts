// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { Router } from "express";
import { TurniController } from "../controllers/TurniController.js";

export const turniRouter = Router();
turniRouter.get("/", TurniController.list);
