import type { Request, Response } from "express";
import { AmministratoriModel } from "../models/AmministratoriModel.js";

export const AmministratoriController = {
  async list(_req: Request, res: Response) {
    const list = await AmministratoriModel.list();
    res.json(list);
  },

  async create(req: Request, res: Response) {
    const { nome, email, mansione, tipo, societaEsterna, note } = req.body || {};
    if (!nome) { res.status(400).json({ ok: false, error: "Nome e cognome obbligatorio." }); return; }
    try {
      const pageId = await AmministratoriModel.create({ nome, email, mansione, tipo, societaEsterna, note });
      res.json({ ok: true, pageId });
    } catch (e: any) {
      res.status(502).json({ ok: false, error: e?.message || "Errore nella creazione." });
    }
  },

  async update(req: Request, res: Response) {
    const { pageId, ...rest } = req.body || {};
    if (!pageId) { res.status(400).json({ ok: false, error: "pageId mancante." }); return; }
    await AmministratoriModel.update(pageId, rest);
    res.json({ ok: true });
  },

  async delete(req: Request, res: Response) {
    const { pageId } = req.body || {};
    if (!pageId) { res.status(400).json({ ok: false, error: "pageId mancante." }); return; }
    await AmministratoriModel.delete(pageId);
    res.json({ ok: true });
  }
};
