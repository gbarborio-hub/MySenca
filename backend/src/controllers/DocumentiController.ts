import type { Request, Response } from "express";
import { DocumentiModel } from "../models/DocumentiModel.js";

export const DocumentiController = {
  async listByUsername(req: Request, res: Response) {
    const username = String(req.query.username || req.body?.username || "");
    if (!username) { res.json([]); return; }
    const docs = await DocumentiModel.listByUsername(username);
    res.json(docs);
  },

  async listInLavorazione(_req: Request, res: Response) {
    const docs = await DocumentiModel.listInLavorazione();
    res.json(docs);
  },

  async create(req: Request, res: Response) {
    const { username, dipendente, titolo, tipo, note, linkAllegato, fileBase64, fileName, contentType, caricatoDa, caricatoDaRuolo, richiedeFirma } = req.body || {};
    if (!username || !titolo) { res.status(400).json({ ok: false, error: "username e titolo sono obbligatori." }); return; }
    try {
      const pageId = await DocumentiModel.create({
        username, dipendente, titolo, tipo, note, linkAllegato, fileBase64, fileName, contentType,
        caricatoDa: caricatoDa || "", caricatoDaRuolo: caricatoDaRuolo || "GP", richiedeFirma: !!richiedeFirma
      });
      res.json({ ok: true, pageId });
    } catch (e: any) {
      res.status(502).json({ ok: false, error: e?.message || "Errore nel caricamento." });
    }
  },

  async caricaFirmato(req: Request, res: Response) {
    const { pageId, fileBase64, fileName, contentType } = req.body || {};
    if (!pageId || !fileBase64 || !fileName) { res.status(400).json({ ok: false, error: "Dati mancanti." }); return; }
    try {
      await DocumentiModel.caricaFirmato(pageId, { fileBase64, fileName, contentType });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(502).json({ ok: false, error: e?.message || "Errore nel caricamento." });
    }
  },

  async verificaFirma(req: Request, res: Response) {
    const { pageId, esito } = req.body || {};
    if (!pageId || (esito !== "approva" && esito !== "scarta")) { res.status(400).json({ ok: false, error: "Parametri non validi." }); return; }
    await DocumentiModel.verificaFirma(pageId, esito);
    res.json({ ok: true });
  },

  async delete(req: Request, res: Response) {
    const { pageId } = req.body || {};
    if (!pageId) { res.status(400).json({ ok: false, error: "pageId mancante." }); return; }
    await DocumentiModel.delete(pageId);
    res.json({ ok: true });
  }
};
