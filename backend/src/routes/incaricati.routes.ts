import { Router } from "express";
import { IncaricatiController } from "../controllers/IncaricatiController.js";

export const incaricatiRouter = Router();
incaricatiRouter.get("/", IncaricatiController.list);
incaricatiRouter.post("/firmato", IncaricatiController.setFirmato);
