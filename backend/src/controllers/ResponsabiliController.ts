import type { Request, Response } from "express";
import { ResponsabiliModel } from "../models/ResponsabiliModel.js";

export const ResponsabiliController = {
  async list(_req: Request, res: Response) {
    const list = await ResponsabiliModel.list();
    res.json(list);
  },

  async create(req: Request, res: Response) {
    const { nome, attivitaSvolta, email, indirizzo, note } = req.body || {};
    if (!nome) { res.status(400).json({ ok: false, error: "Nome o ragione sociale obbligatorio." }); return; }
    try {
      const pageId = await ResponsabiliModel.create({ nome, attivitaSvolta, email, indirizzo, note });
      res.json({ ok: true, pageId });
    } catch (e: any) {
      res.status(502).json({ ok: false, error: e?.message || "Errore nella creazione." });
    }
  },

  async update(req: Request, res: Response) {
    const { pageId, ...rest } = req.body || {};
    if (!pageId) { res.status(400).json({ ok: false, error: "pageId mancante." }); return; }
    await ResponsabiliModel.update(pageId, rest);
    res.json({ ok: true });
  },

  async delete(req: Request, res: Response) {
    const { pageId } = req.body || {};
    if (!pageId) { res.status(400).json({ ok: false, error: "pageId mancante." }); return; }
    await ResponsabiliModel.delete(pageId);
    res.json({ ok: true });
  },

  async caricaDocumento(req: Request, res: Response) {
    const { pageId, slot, fileBase64, fileName, contentType, richiedeFirma } = req.body || {};
    if (!pageId || (slot !== "checklist" && slot !== "contratto")) { res.status(400).json({ ok: false, error: "Parametri non validi." }); return; }
    try {
      await ResponsabiliModel.caricaDocumento(pageId, slot, { fileBase64, fileName, contentType, richiedeFirma: !!richiedeFirma });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(502).json({ ok: false, error: e?.message || "Errore nel caricamento." });
    }
  },

  async caricaFirmato(req: Request, res: Response) {
    const { pageId, slot, fileBase64, fileName, contentType } = req.body || {};
    if (!pageId || (slot !== "checklist" && slot !== "contratto") || !fileBase64 || !fileName) {
      res.status(400).json({ ok: false, error: "Dati mancanti." }); return;
    }
    try {
      await ResponsabiliModel.caricaFirmato(pageId, slot, { fileBase64, fileName, contentType });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(502).json({ ok: false, error: e?.message || "Errore nel caricamento." });
    }
  },

  async verificaFirma(req: Request, res: Response) {
    const { pageId, slot, esito } = req.body || {};
    if (!pageId || (slot !== "checklist" && slot !== "contratto") || (esito !== "approva" && esito !== "scarta")) {
      res.status(400).json({ ok: false, error: "Parametri non validi." }); return;
    }
    await ResponsabiliModel.verificaFirma(pageId, slot, esito);
    res.json({ ok: true });
  }
};
