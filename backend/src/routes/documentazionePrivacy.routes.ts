import { Router } from "express";
import { DocumentazionePrivacyController } from "../controllers/DocumentazionePrivacyController.js";

export const documentazionePrivacyRouter = Router();
documentazionePrivacyRouter.get("/", DocumentazionePrivacyController.list);
documentazionePrivacyRouter.post("/carica", DocumentazionePrivacyController.carica);
documentazionePrivacyRouter.post("/invia-aggiornamento", DocumentazionePrivacyController.inviaAggiornamento);
