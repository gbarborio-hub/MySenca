import type { Request, Response } from "express";
import { IncaricatiModel } from "../models/IncaricatiModel.js";
import { DipendentiModel } from "../models/DipendentiModel.js";

function norm(s: string): string {
  return String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

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
  },

  // Confronta Dipendenti attivi con Incaricati esistenti (match su nome+cognome,
  // dato che i due database non sono collegati da un riferimento diretto) e
  // restituisce chi non è ancora presente come incaricato al trattamento.
  async mancanti(_req: Request, res: Response) {
    const [dipendenti, incaricati] = await Promise.all([DipendentiModel.list(), IncaricatiModel.list()]);
    const presenti = new Set(incaricati.map(i => `${norm(i.nome)}|${norm(i.cognome)}`));
    const mancanti = dipendenti
      .filter(d => d.attivo !== false)
      .filter(d => !presenti.has(`${norm(d.nome)}|${norm(d.cognome)}`))
      .map(d => ({ pageId: d.pageId, nome: d.nome, cognome: d.cognome, mansione: d.mansione, struttura: d.struttura, email: d.email, username: d.username }));
    res.json(mancanti);
  },

  // Crea uno o più incaricati a partire da una lista di dipendenti scelti
  // (tutti, alcuni selezionati, o uno solo — la scelta avviene lato frontend).
  async creaSelezionati(req: Request, res: Response) {
    const { dipendenti } = req.body || {};
    if (!Array.isArray(dipendenti) || dipendenti.length === 0) {
      res.status(400).json({ ok: false, error: "Nessun dipendente selezionato." });
      return;
    }
    const inputs = dipendenti.map((d: any) => ({
      nome: String(d.nome || ""), cognome: String(d.cognome || ""),
      email: d.email || "", ruolo: d.mansione || "", struttura: d.struttura || "", username: d.username || ""
    })).filter((i: any) => i.nome);
    const result = await IncaricatiModel.createMany(inputs);
    res.json({ ok: true, creati: result.ok, falliti: result.failed });
  }
};
