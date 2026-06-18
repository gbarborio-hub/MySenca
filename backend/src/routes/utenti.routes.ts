import { Router } from "express";
import { UtentiController } from "../controllers/UtentiController.js";

export const utentiRouter = Router();
utentiRouter.get("/", UtentiController.list);
utentiRouter.post("/", UtentiController.crea);
utentiRouter.post("/elimina", UtentiController.elimina);
utentiRouter.post("/riattiva", UtentiController.riattiva);
utentiRouter.post("/ruoli", UtentiController.aggiornaRuoli);
