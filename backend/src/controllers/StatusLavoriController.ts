import type { Request, Response } from "express";
import { StatusLavoriModel } from "../models/StatusLavoriModel.js";

export const StatusLavoriController = {
  async list(_req: Request, res: Response) {
    const list = await StatusLavoriModel.list();
    res.json(list);
  },

  async setStato(req: Request, res: Response) {
    const { pageId, stato } = req.body || {};
    if (!pageId || !stato) { res.status(400).json({ ok: false, error: "Parametri mancanti." }); return; }
    await StatusLavoriModel.setStato(pageId, stato);
    res.json({ ok: true });
  },

  async aggiungiNota(req: Request, res: Response) {
    const { pageId, notaEsistente, nuovaNota } = req.body || {};
    if (!pageId || !nuovaNota) { res.status(400).json({ ok: false, error: "Parametri mancanti." }); return; }
    await StatusLavoriModel.aggiungiNota(pageId, notaEsistente || "", nuovaNota);
    res.json({ ok: true });
  }
};
