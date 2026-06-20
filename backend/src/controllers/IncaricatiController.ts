import type { Request, Response } from "express";
import { IncaricatiModel } from "../models/IncaricatiModel.js";

export const IncaricatiController = {
  async list(_req: Request, res: Response) {
    const incaricati = await IncaricatiModel.list();
    res.json(incaricati);
  },

  async setFirmato(req: Request, res: Response) {
    const { pageId, firmato } = req.body || {};
    if (!pageId) { res.status(400).json({ ok: false, error: "pageId mancante" }); return; }
    await IncaricatiModel.setDocumentoFirmato(String(pageId), !!firmato);
    res.json({ ok: true });
  }
};
