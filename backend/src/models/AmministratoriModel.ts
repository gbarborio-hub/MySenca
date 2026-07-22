// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { notion, rt, sel, title, chk, dateStart } from "./notionClient.js";
import { DocumentazionePrivacyModel } from "./DocumentazionePrivacyModel.js";

const DB_AMMINISTRATORI = "87a576360f914c25ba9a29f43c50a4ee";

export type TipoAmministratore = "Interno" | "Esterno" | "";

export interface Amministratore {
  pageId: string;
  nome: string;
  email: string;
  mansione: string;
  tipo: TipoAmministratore;
  societaEsterna: string;
  note: string;
  dataNomina: string | null;
  nominaFirmata: boolean;
}

function fromNotionPage(page: any): Amministratore {
  const p = page.properties || {};
  return {
    pageId: page.id,
    nome: title(p["Nome e cognome"]) || "",
    email: p["Email"]?.email || "",
    mansione: rt(p["Mansione"]) || "",
    tipo: (sel(p["Tipo"]) as TipoAmministratore) || "",
    societaEsterna: rt(p["Societa esterna"]) || "",
    note: rt(p["Note"]) || "",
    dataNomina: dateStart(p["Data nomina"]),
    nominaFirmata: chk(p["Nomina firmata"])
  };
}

export interface AmministratoreCreateInput {
  nome: string;
  email?: string;
  mansione?: string;
  tipo?: TipoAmministratore;
  societaEsterna?: string;
  note?: string;
}

export const AmministratoriModel = {
  async list(): Promise<Amministratore[]> {
    const res: any = await notion.queryDatabase(DB_AMMINISTRATORI, { page_size: 100 });
    return (res.results || []).map(fromNotionPage);
  },

  async create(input: AmministratoreCreateInput): Promise<string> {
    const props: Record<string, any> = {
      "Nome e cognome": { title: [{ text: { content: input.nome } }] },
      "Mansione": { rich_text: [{ text: { content: input.mansione || "" } }] },
      "Note": { rich_text: [{ text: { content: input.note || "" } }] }
    };
    if (input.email) props["Email"] = { email: input.email };
    if (input.tipo) props["Tipo"] = { select: { name: input.tipo } };
    if (input.societaEsterna !== undefined) props["Societa esterna"] = { rich_text: [{ text: { content: input.societaEsterna || "" } }] };

    const res: any = await notion.createPage({ parent: { database_id: DB_AMMINISTRATORI }, properties: props });

    // Invio automatico della nomina SOLO per gli amministratori interni: per gli
    // esterni la nomina è già implicita nel contratto sottoscritto, non va inviata.
    if (input.tipo === "Interno" && input.email) {
      DocumentazionePrivacyModel.inviaANuovoDestinatario("Amministratore di sistema", { nome: input.nome, email: input.email })
        .then(inviato => { if (inviato) this.marcaNominaInviata(res.id).catch(() => {}); })
        .catch(() => {});
    }

    return res.id;
  },

  // Segna la data di invio della nomina. Usato sia dall'invio automatico alla
  // creazione sia dagli invii massivi/mirati manuali.
  async marcaNominaInviata(pageId: string): Promise<void> {
    await notion.updatePage(pageId, { properties: { "Data nomina": { date: { start: new Date().toISOString() } } } });
  },

  async update(pageId: string, input: Partial<AmministratoreCreateInput> & { nominaFirmata?: boolean }): Promise<void> {
    const props: Record<string, any> = {};
    if (input.nome !== undefined) props["Nome e cognome"] = { title: [{ text: { content: input.nome } }] };
    if (input.email !== undefined) props["Email"] = { email: input.email };
    if (input.mansione !== undefined) props["Mansione"] = { rich_text: [{ text: { content: input.mansione } }] };
    if (input.tipo !== undefined) props["Tipo"] = input.tipo ? { select: { name: input.tipo } } : { select: null };
    if (input.societaEsterna !== undefined) props["Societa esterna"] = { rich_text: [{ text: { content: input.societaEsterna } }] };
    if (input.note !== undefined) props["Note"] = { rich_text: [{ text: { content: input.note } }] };
    if (typeof input.nominaFirmata === "boolean") props["Nomina firmata"] = { checkbox: input.nominaFirmata };
    await notion.updatePage(pageId, { properties: props });
  },

  async delete(pageId: string): Promise<void> {
    await notion.updatePage(pageId, { in_trash: true } as any);
  }
};
