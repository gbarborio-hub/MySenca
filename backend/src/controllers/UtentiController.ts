import type { Request, Response } from "express";
import { UtentiModel } from "../models/UtentiModel.js";
import { CredentialsService } from "../services/CredentialsService.js";
import type { Ruolo } from "../types/domain.js";

export const UtentiController = {
  async list(_req: Request, res: Response) {
    const utenti = await UtentiModel.list();
    // never leak hash/salt to frontend
    res.json(utenti.map(({ hashPassword, salt, ...safe }) => safe));
  },

  async crea(req: Request, res: Response) {
    const { username, email, ruolo, ruoliAggiuntivi, dipendentePageId } = req.body || {};
    const result = await CredentialsService.creaUtenza({
      username: String(username || ""),
      email: email ? String(email) : undefined,
      ruolo: (ruolo || "Dipendente") as Ruolo,
      ruoliAggiuntivi: Array.isArray(ruoliAggiuntivi) ? ruoliAggiuntivi : [],
      dipendentePageId: String(dipendentePageId || "")
    });
    res.status(result.ok ? 200 : 400).json(result);
  },

  async elimina(req: Request, res: Response) {
    const { pageId, username } = req.body || {};
    if (!pageId) { res.status(400).json({ ok: false, error: "pageId mancante" }); return; }
    await CredentialsService.eliminaUtenza(String(pageId), String(username || ""));
    res.json({ ok: true });
  },

  async riattiva(req: Request, res: Response) {
    const { pageId } = req.body || {};
    if (!pageId) { res.status(400).json({ ok: false, error: "pageId mancante" }); return; }
    await CredentialsService.riattivaUtenza(String(pageId));
    res.json({ ok: true });
  },

  async aggiornaRuoli(req: Request, res: Response) {
    const { pageId, ruolo, ruoliAggiuntivi } = req.body || {};
    if (!pageId) { res.status(400).json({ ok: false, error: "pageId mancante" }); return; }
    await UtentiModel.aggiornaRuoli(String(pageId), ruolo as Ruolo | undefined, ruoliAggiuntivi as Ruolo[] | undefined);
    res.json({ ok: true });
  }
};
