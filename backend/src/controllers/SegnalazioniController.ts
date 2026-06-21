import type { Request, Response } from "express";
import { SegnalazioniModel } from "../models/SegnalazioniModel.js";

export const SegnalazioniController = {
  async list(_req: Request, res: Response) {
    const list = await SegnalazioniModel.list();
    res.json(list);
  },

  async create(req: Request, res: Response) {
    const body = req.body || {};
    if (!body.descrizione || !body.tipoViolazione) {
      res.status(400).json({ ok: false, error: "Descrizione e tipo di violazione sono obbligatori." });
      return;
    }
    try {
      const pageId = await SegnalazioniModel.create(body);
      res.json({ ok: true, pageId });
    } catch (e: any) {
      res.status(502).json({ ok: false, error: e?.message || "Errore nell'invio della segnalazione." });
    }
  },

  async updateStato(req: Request, res: Response) {
    const { pageId, stato } = req.body || {};
    if (!pageId || !stato) { res.status(400).json({ ok: false, error: "Parametri mancanti." }); return; }
    await SegnalazioniModel.updateStato(pageId, stato);
    res.json({ ok: true });
  },

  async aggiornaGestione(req: Request, res: Response) {
    const { pageId, ...rest } = req.body || {};
    if (!pageId) { res.status(400).json({ ok: false, error: "pageId mancante." }); return; }
    await SegnalazioniModel.aggiornaGestione(pageId, rest);
    res.json({ ok: true });
  }
};
