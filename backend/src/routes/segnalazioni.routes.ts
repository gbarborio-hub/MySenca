import { Router } from "express";
import { SegnalazioniController } from "../controllers/SegnalazioniController.js";

export const segnalazioniRouter = Router();
segnalazioniRouter.get("/", SegnalazioniController.list);
segnalazioniRouter.post("/", SegnalazioniController.create);
segnalazioniRouter.post("/stato", SegnalazioniController.updateStato);
segnalazioniRouter.post("/gestione", SegnalazioniController.aggiornaGestione);
