import { Router } from "express";
import { TicketController } from "../controllers/TicketController.js";

export const ticketRouter = Router();
ticketRouter.get("/", TicketController.list);
ticketRouter.post("/", TicketController.create);
ticketRouter.post("/stato", TicketController.updateStato);
