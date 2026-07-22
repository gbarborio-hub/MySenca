import { Router } from "express";
import { AmministratoriController } from "../controllers/AmministratoriController.js";

export const amministratoriRouter = Router();
amministratoriRouter.get("/", AmministratoriController.list);
amministratoriRouter.post("/", AmministratoriController.create);
amministratoriRouter.post("/update", AmministratoriController.update);
amministratoriRouter.post("/elimina", AmministratoriController.delete);
