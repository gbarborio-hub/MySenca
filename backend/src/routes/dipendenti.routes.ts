import { Router } from "express";
import { DipendentiController } from "../controllers/DipendentiController.js";

export const dipendentiRouter = Router();
dipendentiRouter.get("/", DipendentiController.list);
dipendentiRouter.get("/senza-username", DipendentiController.senzaUsername);
dipendentiRouter.post("/salva", DipendentiController.save);
