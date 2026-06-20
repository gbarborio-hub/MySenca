import type { Request, Response } from "express";
import { DipendentiModel } from "../models/DipendentiModel.js";

export const DipendentiController = {
  async list(_req: Request, res: Response) {
    const dipendenti = await DipendentiModel.list();
    res.json(dipendenti);
  },

  async senzaUsername(_req: Request, res: Response) {
    const dipendenti = await DipendentiModel.list();
    res.json(dipendenti.filter(d => !d.username));
  },

  async save(req: Request, res: Response) {
    const { pageId, ...input } = req.body || {};
    if (!input.nome || !input.cognome) {
      res.status(400).json({ ok: false, error: "Nome e cognome sono obbligatori." });
      return;
    }
    try {
      if (pageId) {
        await DipendentiModel.update(pageId, input);
        res.json({ ok: true, pageId });
      } else {
        const newId = await DipendentiModel.create(input);
        res.json({ ok: true, pageId: newId });
      }
    } catch (e: any) {
      res.status(502).json({ ok: false, error: e?.message || "Errore nel salvataggio." });
    }
  }
};
