// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { notion, rt, sel, title, dateStart } from "./notionClient.js";
import { encryptIfPresent, decryptIfPresent } from "../services/EncryptionService.js";

const DB_TICKET = "1663def3e8d447f6a702d4aefbade025";

export interface Ticket {
  pageId: string; titolo: string; categoria: string; stato: string;
  data: string | null; nome: string; ruolo: string; username: string;
  descrizione: string; note: string;
}

function fromNotionPage(page: any): Ticket {
  const p = page.properties || {};
  return {
    pageId: page.id,
    titolo: title(p["Titolo"]) || "",
    categoria: sel(p["Categoria"]) || "",
    stato: sel(p["Stato"]) || "Nuovo",
    data: dateStart(p["Data"]),
    nome: rt(p["Nome"]) || "",
    ruolo: rt(p["Ruolo"]) || "",
    username: rt(p["Username"]) || "",
    descrizione: decryptIfPresent(rt(p["Descrizione"])),
    note: decryptIfPresent(rt(p["Note"]))
  };
}

function rtEnc(v: string) { return { rich_text: [{ text: { content: encryptIfPresent(v) } }] }; }
function rtPlain(v: string) { return { rich_text: [{ text: { content: v || "" } }] }; }

export const TicketModel = {
  async list(): Promise<Ticket[]> {
    const res: any = await notion.queryDatabase(DB_TICKET, {
      page_size: 150,
      sorts: [{ property: "Data", direction: "descending" }]
    });
    return (res.results || []).map(fromNotionPage);
  },

  async create(input: { titolo: string; categoria: string; descrizione: string; username: string; nome: string; ruolo: string }): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const res: any = await notion.createPage({
      parent: { database_id: DB_TICKET },
      properties: {
        "Titolo": { title: [{ text: { content: input.titolo } }] },
        "Categoria": { select: { name: input.categoria || "Problema" } },
        "Stato": { select: { name: "Nuovo" } },
        "Data": { date: { start: today } },
        "Nome": rtPlain(input.nome),
        "Ruolo": rtPlain(input.ruolo),
        "Username": rtPlain(input.username),
        "Descrizione": rtEnc(input.descrizione)
      }
    });
    return res.id;
  },

  async updateStato(pageId: string, stato: "Nuovo" | "In lavorazione" | "Risolto"): Promise<void> {
    await notion.updatePage(pageId, { properties: { "Stato": { select: { name: stato } } } });
  },

  async setNote(pageId: string, note: string): Promise<void> {
    await notion.updatePage(pageId, { properties: { "Note": { rich_text: [{ text: { content: encryptIfPresent(note) } }] } } });
  }
};
