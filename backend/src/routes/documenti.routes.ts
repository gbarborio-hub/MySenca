import { Router } from "express";
import { DocumentiController } from "../controllers/DocumentiController.js";

export const documentiRouter = Router();
documentiRouter.get("/", DocumentiController.listByUsername);
documentiRouter.get("/in-lavorazione", DocumentiController.listInLavorazione);
documentiRouter.post("/", DocumentiController.create);
documentiRouter.post("/carica-firmato", DocumentiController.caricaFirmato);
documentiRouter.post("/verifica-firma", DocumentiController.verificaFirma);
documentiRouter.post("/elimina", DocumentiController.delete);
