import { Router } from "express";
import { ResponsabiliController } from "../controllers/ResponsabiliController.js";

export const responsabiliRouter = Router();
responsabiliRouter.get("/", ResponsabiliController.list);
responsabiliRouter.post("/", ResponsabiliController.create);
responsabiliRouter.post("/update", ResponsabiliController.update);
responsabiliRouter.post("/elimina", ResponsabiliController.delete);
responsabiliRouter.post("/carica-documento", ResponsabiliController.caricaDocumento);
responsabiliRouter.post("/carica-firmato", ResponsabiliController.caricaFirmato);
responsabiliRouter.post("/verifica-firma", ResponsabiliController.verificaFirma);
