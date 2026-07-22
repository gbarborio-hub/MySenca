import type { Request, Response } from "express";
import { DocumentazionePrivacyModel, type DestinatarioModello } from "../models/DocumentazionePrivacyModel.js";
import { DipendentiModel } from "../models/DipendentiModel.js";
import { IncaricatiModel } from "../models/IncaricatiModel.js";
import { AmministratoriModel } from "../models/AmministratoriModel.js";

// Risolve, al momento dell'invio massivo, chi sono "tutti gli interessati" per la
// categoria del modello — gli amministratori esterni sono esclusi perché la nomina
// è già implicita nel loro contratto.
async function destinatariPerCategoria(categoria: string): Promise<DestinatarioModello[]> {
  if (categoria === "Dipendente" || categoria === "Libero professionista") {
    const dipendenti = await DipendentiModel.list();
    return dipendenti
      .filter(d => d.attivo !== false && d.contratto === categoria && d.email)
      .map(d => ({ nome: `${d.nome} ${d.cognome}`.trim(), email: d.email as string }));
  }
  if (categoria === "Incaricato trattamento") {
    const incaricati = await IncaricatiModel.list();
    return incaricati.filter(i => i.email).map(i => ({ nome: `${i.nome} ${i.cognome}`.trim(), email: i.email }));
  }
  if (categoria === "Amministratore di sistema") {
    const amministratori = await AmministratoriModel.list();
    return amministratori.filter(a => a.tipo === "Interno" && a.email).map(a => ({ nome: a.nome, email: a.email }));
  }
  return [];
}

export const DocumentazionePrivacyController = {
  async list(_req: Request, res: Response) {
    const list = await DocumentazionePrivacyModel.list();
    res.json(list);
  },

  async carica(req: Request, res: Response) {
    const { pageId, fileBase64, fileName, contentType, aggiornatoDa } = req.body || {};
    if (!pageId || !fileBase64 || !fileName) { res.status(400).json({ ok: false, error: "Dati mancanti." }); return; }
    try {
      await DocumentazionePrivacyModel.carica(pageId, { fileBase64, fileName, contentType, aggiornatoDa: aggiornatoDa || "" });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(502).json({ ok: false, error: e?.message || "Errore nel caricamento." });
    }
  },

  async inviaAggiornamento(req: Request, res: Response) {
    const { pageId } = req.body || {};
    if (!pageId) { res.status(400).json({ ok: false, error: "pageId mancante." }); return; }

    const lista = await DocumentazionePrivacyModel.list();
    const modello = lista.find(m => m.pageId === pageId);
    if (!modello) { res.status(404).json({ ok: false, error: "Modello non trovato." }); return; }
    if (!modello.categoria) { res.status(400).json({ ok: false, error: "Modello senza categoria destinatari." }); return; }

    const destinatari = await destinatariPerCategoria(modello.categoria);
    const result = await DocumentazionePrivacyModel.inviaAggiornamentoATutti(modello, destinatari);
    if (!result.ok) { res.status(400).json(result); return; }
    res.json(result);
  }
};
