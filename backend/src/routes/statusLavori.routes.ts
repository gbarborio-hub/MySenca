import { Router } from "express";
import { StatusLavoriController } from "../controllers/StatusLavoriController.js";

export const statusLavoriRouter = Router();
statusLavoriRouter.get("/", StatusLavoriController.list);
statusLavoriRouter.post("/stato", StatusLavoriController.setStato);
statusLavoriRouter.post("/nota", StatusLavoriController.aggiungiNota);
