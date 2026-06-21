import type { Request, Response } from "express";
import { TicketModel } from "../models/TicketModel.js";

export const TicketController = {
  async list(_req: Request, res: Response) {
    const list = await TicketModel.list();
    res.json(list);
  },

  async create(req: Request, res: Response) {
    const { titolo, categoria, descrizione, username, nome, ruolo } = req.body || {};
    if (!titolo || !descrizione) {
      res.status(400).json({ ok: false, error: "Titolo e descrizione sono obbligatori." });
      return;
    }
    try {
      const pageId = await TicketModel.create({ titolo, categoria, descrizione, username, nome, ruolo });
      res.json({ ok: true, pageId });
    } catch (e: any) {
      res.status(502).json({ ok: false, error: e?.message || "Errore nell'invio del ticket." });
    }
  },

  async updateStato(req: Request, res: Response) {
    const { pageId, stato } = req.body || {};
    if (!pageId || !stato) { res.status(400).json({ ok: false, error: "Parametri mancanti." }); return; }
    await TicketModel.updateStato(pageId, stato);
    res.json({ ok: true });
  }
};
