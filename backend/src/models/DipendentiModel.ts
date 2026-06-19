import { notion, rt, sel, title } from "./notionClient.js";
import type { Dipendente } from "../types/domain.js";

const DB_DIPENDENTI = "28edb837413c47bf87d38a52067c3bae";

function fromNotionPage(page: any): Dipendente {
  const p = page.properties || {};
  return {
    pageId: page.id,
    nome: title(p["Nome"]) || "",
    cognome: rt(p["Cognome"]) || "",
    username: rt(p["Username"]) || null,
    mansione: rt(p["Mansione"]) || sel(p["Mansione"]) || "",
    struttura: rt(p["Struttura principale"]) || sel(p["Struttura principale"]) || "",
    email: rt(p["Email"]) || null
  };
}

export const DipendentiModel = {
  async list(): Promise<Dipendente[]> {
    const res: any = await notion.queryDatabase(DB_DIPENDENTI, { page_size: 150 });
    return (res.results || []).map(fromNotionPage);
  },

  async findByUsername(username: string): Promise<Dipendente | null> {
    const res: any = await notion.queryDatabase(DB_DIPENDENTI, {
      filter: { property: "Username", rich_text: { equals: username } },
      page_size: 1
    });
    if (!res.results?.length) return null;
    return fromNotionPage(res.results[0]);
  },

  async setUsername(pageId: string, username: string): Promise<void> {
    await notion.updatePage(pageId, {
      properties: { "Username": { rich_text: [{ text: { content: username } }] } }
    });
  },

  async clearUsername(pageId: string): Promise<void> {
    await notion.updatePage(pageId, { properties: { "Username": { rich_text: [] } } });
  }
};
