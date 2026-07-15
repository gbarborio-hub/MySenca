// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { Router } from "express";
import { ContattiController } from "../controllers/ContattiController.js";

export const contattiRouter = Router();
contattiRouter.get("/", ContattiController.list);
