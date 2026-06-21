import { Router } from "express";
import { IncaricatiController } from "../controllers/IncaricatiController.js";

export const incaricatiRouter = Router();
incaricatiRouter.get("/", IncaricatiController.list);
incaricatiRouter.post("/firmato", IncaricatiController.setFirmato);
incaricatiRouter.get("/mancanti", IncaricatiController.mancanti);
incaricatiRouter.post("/crea-selezionati", IncaricatiController.creaSelezionati);
