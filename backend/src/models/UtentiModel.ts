import { notion, rt, title, sel, msel, chk, num, email, dateStart } from "./notionClient.js";
import type { UtenteWebApp, Ruolo } from "../types/domain.js";

const DB_UTENTI = "b08103dc-aafa-4d2e-b711-bc08aeb304d9";

function fromNotionPage(page: any): UtenteWebApp {
  const p = page.properties || {};
  return {
    pageId: page.id,
    username: title(p["Username"]),
    email: email(p["Email"]),
    ruolo: (sel(p["Ruolo"]) || "Utente") as Ruolo,
    ruoliAggiuntivi: msel(p["Ruoli aggiuntivi"]) as Ruolo[],
    attivo: chk(p["Attivo"]),
    bloccato: chk(p["Bloccato"]),
    tentativiFalliti: num(p["Tentativi falliti"]),
    passwordAggiornataIl: dateStart(p["Password aggiornata il"]),
    hashPassword: rt(p["Hash password"]),
    salt: rt(p["Salt"])
  };
}

export const UtentiModel = {
  async findByUsername(username: string): Promise<UtenteWebApp | null> {
    const res: any = await notion.queryDatabase(DB_UTENTI, {
      filter: { property: "Username", title: { equals: username } },
      page_size: 1
    });
    if (!res.results?.length) return null;
    return fromNotionPage(res.results[0]);
  },

  async list(): Promise<UtenteWebApp[]> {
    const res: any = await notion.queryDatabase(DB_UTENTI, { page_size: 100 });
    return (res.results || []).map(fromNotionPage).filter((u: UtenteWebApp) => u.username);
  },

  async create(props: {
    username: string; hash: string; salt: string; ruolo: Ruolo;
    ruoliAggiuntivi: Ruolo[]; email?: string;
  }): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const properties: any = {
      "Username": { title: [{ text: { content: props.username } }] },
      "Hash password": { rich_text: [{ text: { content: props.hash } }] },
      "Salt": { rich_text: [{ text: { content: props.salt } }] },
      "Attivo": { checkbox: true },
      "Ruolo": { select: { name: props.ruolo } },
      "Tentativi falliti": { number: 0 },
      "Bloccato": { checkbox: false },
      "Password aggiornata il": { date: { start: today } }
    };
    if (props.email) properties["Email"] = { email: props.email };
    if (props.ruoliAggiuntivi.length) {
      properties["Ruoli aggiuntivi"] = { multi_select: props.ruoliAggiuntivi.map(n => ({ name: n })) };
    }
    const res: any = await notion.createPage({
      parent: { database_id: DB_UTENTI },
      properties
    });
    return res.id;
  },

  async setTentativiFalliti(pageId: string, tentativi: number, bloccare: boolean): Promise<void> {
    const properties: any = { "Tentativi falliti": { number: tentativi } };
    if (bloccare) properties["Bloccato"] = { checkbox: true };
    await notion.updatePage(pageId, { properties });
  },

  async resetTentativiFalliti(pageId: string): Promise<void> {
    await notion.updatePage(pageId, { properties: { "Tentativi falliti": { number: 0 } } });
  },

  async riattiva(pageId: string): Promise<void> {
    await notion.updatePage(pageId, {
      properties: { "Bloccato": { checkbox: false }, "Tentativi falliti": { number: 0 } }
    });
  },

  async archivia(pageId: string): Promise<void> {
    await notion.updatePage(pageId, { archived: true, properties: { "Attivo": { checkbox: false } } } as any);
  },

  async aggiornaRuoli(pageId: string, ruolo?: Ruolo, ruoliAggiuntivi?: Ruolo[]): Promise<void> {
    const properties: any = {};
    if (ruolo) properties["Ruolo"] = { select: { name: ruolo } };
    if (ruoliAggiuntivi) properties["Ruoli aggiuntivi"] = { multi_select: ruoliAggiuntivi.map(n => ({ name: n })) };
    if (Object.keys(properties).length) await notion.updatePage(pageId, { properties });
  },

  async aggiornaPassword(pageId: string, hash: string, salt: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    await notion.updatePage(pageId, {
      properties: {
        "Hash password": { rich_text: [{ text: { content: hash } }] },
        "Salt": { rich_text: [{ text: { content: salt } }] },
        "Password aggiornata il": { date: { start: today } }
      }
    });
  }
};
