import { notion, rt, sel, title, dateStart } from "./notionClient.js";

const DB_TICKET = "1663def3e8d447f6a702d4aefbade025";

export interface Ticket {
  pageId: string;
  titolo: string;
  categoria: string;
  stato: string;
  data: string | null;
  nome: string;
  ruolo: string;
  username: string;
  descrizione: string;
  note: string;
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
    descrizione: rt(p["Descrizione"]) || "",
    note: rt(p["Note"]) || ""
  };
}

export interface TicketCreateInput {
  titolo: string; categoria: string; descrizione: string;
  username: string; nome: string; ruolo: string;
}

export const TicketModel = {
  async list(): Promise<Ticket[]> {
    const res: any = await notion.queryDatabase(DB_TICKET, {
      page_size: 150,
      sorts: [{ property: "Data", direction: "descending" }]
    });
    return (res.results || []).map(fromNotionPage);
  },

  async create(input: TicketCreateInput): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const res: any = await notion.createPage({
      parent: { database_id: DB_TICKET },
      properties: {
        "Titolo": { title: [{ text: { content: input.titolo } }] },
        "Categoria": { select: { name: input.categoria || "Problema" } },
        "Stato": { select: { name: "Nuovo" } },
        "Data": { date: { start: today } },
        "Nome": { rich_text: [{ text: { content: input.nome || "" } }] },
        "Ruolo": { rich_text: [{ text: { content: input.ruolo || "" } }] },
        "Username": { rich_text: [{ text: { content: input.username || "" } }] },
        "Descrizione": { rich_text: [{ text: { content: input.descrizione || "" } }] }
      }
    });
    return res.id;
  },

  async updateStato(pageId: string, stato: "Nuovo" | "In lavorazione" | "Risolto"): Promise<void> {
    await notion.updatePage(pageId, { properties: { "Stato": { select: { name: stato } } } });
  },

  async setNote(pageId: string, note: string): Promise<void> {
    await notion.updatePage(pageId, { properties: { "Note": { rich_text: [{ text: { content: note } }] } } });
  }
};
