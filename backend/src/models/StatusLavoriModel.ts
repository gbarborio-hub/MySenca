// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { notion, rt, sel, title, dateStart } from "./notionClient.js";
import { encryptIfPresent, decryptIfPresent } from "../services/EncryptionService.js";

const DB_STATUS_LAVORI = "d3731e17e0a34b0d9084638cbaf2c4bd";
export type StatoAvanzamento = "Non iniziato" | "In lavorazione" | "Risolto";
export type Urgenza = "Urgente" | "Alta" | "Media" | "Bassa";

export interface StatusLavoro {
  pageId: string; puntoCheckList: string; categoria: string;
  intervento: string; noteSoluzioni: string; stato: StatoAvanzamento;
  urgenza: Urgenza | ""; data: string | null; place: string;
}

function fromNotionPage(page: any): StatusLavoro {
  const p = page.properties || {};
  return {
    pageId: page.id,
    puntoCheckList: title(p["Punto check list"]) || "",
    categoria: rt(p["Categoria"]) || sel(p["Categoria"]) || "",
    intervento:    decryptIfPresent(rt(p["Intervento da effettuare"])),
    noteSoluzioni: decryptIfPresent(rt(p["Note e soluzioni"])),
    stato: (sel(p["Stato avanzamento"]) as StatoAvanzamento) || "Non iniziato",
    urgenza: (sel(p["Urgenza"]) as Urgenza) || "",
    data: dateStart(p["Date"]),
    place: decryptIfPresent(rt(p["Place"]))
  };
}

function rtEnc(v: string | undefined) { return { rich_text: [{ text: { content: encryptIfPresent(v) } }] }; }

export const StatusLavoriModel = {
  async list(): Promise<StatusLavoro[]> {
    const res: any = await notion.queryDatabase(DB_STATUS_LAVORI, { page_size: 150 });
    return (res.results || []).map(fromNotionPage);
  },
  async setStato(pageId: string, stato: StatoAvanzamento): Promise<void> {
    await notion.updatePage(pageId, { properties: { "Stato avanzamento": { select: { name: stato } } } });
  },
  async aggiungiNota(pageId: string, notaEsistente: string, nuovaNota: string): Promise<void> {
    const oggi = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const ts = `${pad(oggi.getDate())}/${pad(oggi.getMonth() + 1)}/${oggi.getFullYear()}`;
    const aggiornato = notaEsistente ? `${notaEsistente}\n[${ts}] ${nuovaNota}` : `[${ts}] ${nuovaNota}`;
    await notion.updatePage(pageId, { properties: { "Note e soluzioni": { rich_text: [{ text: { content: encryptIfPresent(aggiornato) } }] } } });
  }
};
