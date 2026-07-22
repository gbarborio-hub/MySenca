import type { Request, Response } from "express";
import { DocumentazionePrivacyModel, type DestinatarioModello, type CategoriaModello } from "../models/DocumentazionePrivacyModel.js";
import { DipendentiModel } from "../models/DipendentiModel.js";
import { IncaricatiModel } from "../models/IncaricatiModel.js";
import { AmministratoriModel } from "../models/AmministratoriModel.js";

interface CategoriaInfo {
  tutti: DestinatarioModello[];
  mancanti: DestinatarioModello[];
  onInviato: (pageId: string) => Promise<void>;
}

// Risolve, per ciascuna categoria, sia "tutti gli interessati" sia chi non ha ancora
// ricevuto il documento (mai inviato con successo) — e la funzione da chiamare per
// segnare l'anagrafica giusta come "ricevuto" dopo un invio riuscito. Gli
// amministratori esterni sono esclusi ovunque: la nomina è implicita nel contratto.
async function risolviCategorie(): Promise<Record<CategoriaModello, CategoriaInfo>> {
  const [dipendenti, incaricati, amministratori] = await Promise.all([
    DipendentiModel.list(), IncaricatiModel.list(), AmministratoriModel.list()
  ]);

  function daDipendenti(contratto: "Dipendente" | "Libero professionista"): CategoriaInfo {
    const filtrati = dipendenti.filter(d => d.attivo !== false && d.contratto === contratto && d.email);
    return {
      tutti: filtrati.map(d => ({ pageId: d.pageId, nome: `${d.nome} ${d.cognome}`.trim(), email: d.email as string })),
      mancanti: filtrati.filter(d => !d.informativaPrivacyInviata).map(d => ({ pageId: d.pageId, nome: `${d.nome} ${d.cognome}`.trim(), email: d.email as string })),
      onInviato: (pageId: string) => DipendentiModel.marcaInformativaInviata(pageId)
    };
  }

  const incaricatiFiltrati = incaricati.filter(i => i.email);
  const amministratoriFiltrati = amministratori.filter(a => a.tipo === "Interno" && a.email);

  return {
    "Dipendente": daDipendenti("Dipendente"),
    "Libero professionista": daDipendenti("Libero professionista"),
    "Incaricato trattamento": {
      tutti: incaricatiFiltrati.map(i => ({ pageId: i.pageId, nome: `${i.nome} ${i.cognome}`.trim(), email: i.email })),
      mancanti: incaricatiFiltrati.filter(i => !i.moduloInviato).map(i => ({ pageId: i.pageId, nome: `${i.nome} ${i.cognome}`.trim(), email: i.email })),
      onInviato: (pageId: string) => IncaricatiModel.marcaModuloInviato(pageId)
    },
    "Amministratore di sistema": {
      tutti: amministratoriFiltrati.map(a => ({ pageId: a.pageId, nome: a.nome, email: a.email })),
      mancanti: amministratoriFiltrati.filter(a => !a.dataNomina).map(a => ({ pageId: a.pageId, nome: a.nome, email: a.email })),
      onInviato: (pageId: string) => AmministratoriModel.marcaNominaInviata(pageId)
    }
  };
}

export const DocumentazionePrivacyController = {
  async list(_req: Request, res: Response) {
    const list = await DocumentazionePrivacyModel.list();
    res.json(list);
  },

  // Per ogni modello, quanti interessati della sua categoria non hanno ancora
  // ricevuto nulla — usato per lo scomparto "chi manca" in Privacy.
  async mancanti(_req: Request, res: Response) {
    const [lista, categorie] = await Promise.all([DocumentazionePrivacyModel.list(), risolviCategorie()]);
    const risultato: Record<string, DestinatarioModello[]> = {};
    for (const m of lista) {
      risultato[m.pageId] = m.categoria ? categorie[m.categoria].mancanti : [];
    }
    res.json(risultato);
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

  // Invio massivo a TUTTI gli interessati della categoria (chi lo aveva già ricevuto
  // riceve la nuova versione; chi non l'aveva mai ricevuto viene marcato ora).
  async inviaAggiornamento(req: Request, res: Response) {
    const { pageId } = req.body || {};
    if (!pageId) { res.status(400).json({ ok: false, error: "pageId mancante." }); return; }

    const lista = await DocumentazionePrivacyModel.list();
    const modello = lista.find(m => m.pageId === pageId);
    if (!modello) { res.status(404).json({ ok: false, error: "Modello non trovato." }); return; }
    if (!modello.categoria) { res.status(400).json({ ok: false, error: "Modello senza categoria destinatari." }); return; }

    const categorie = await risolviCategorie();
    const info = categorie[modello.categoria];
    const result = await DocumentazionePrivacyModel.inviaAggiornamentoATutti(modello, info.tutti, info.onInviato);
    if (!result.ok) { res.status(400).json(result); return; }
    res.json(result);
  },

  // Invio solo a chi non ha MAI ricevuto il documento per questa categoria.
  async inviaAiMancanti(req: Request, res: Response) {
    const { pageId } = req.body || {};
    if (!pageId) { res.status(400).json({ ok: false, error: "pageId mancante." }); return; }

    const lista = await DocumentazionePrivacyModel.list();
    const modello = lista.find(m => m.pageId === pageId);
    if (!modello) { res.status(404).json({ ok: false, error: "Modello non trovato." }); return; }
    if (!modello.categoria) { res.status(400).json({ ok: false, error: "Modello senza categoria destinatari." }); return; }

    const categorie = await risolviCategorie();
    const info = categorie[modello.categoria];
    if (info.mancanti.length === 0) { res.json({ ok: true, inviati: 0, falliti: [] }); return; }
    const result = await DocumentazionePrivacyModel.inviaAggiornamentoATutti(modello, info.mancanti, info.onInviato);
    if (!result.ok) { res.status(400).json(result); return; }
    res.json(result);
  }
};
