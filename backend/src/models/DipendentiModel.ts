import { notion, rt, sel, title, chk, dateStart } from "./notionClient.js";
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
    email: rt(p["Email"]) || null,
    telefono: rt(p["Telefono"]) || null,
    cf: rt(p["Codice fiscale"]) || null,
    matricola: rt(p["Matricola"]) || null,
    contratto: sel(p["Tipo contratto"]) || null,
    nascita: dateStart(p["Data nascita"]),
    dataAssunzione: dateStart(p["Data assunzione"]),
    note: rt(p["Note"]) || null,
    attivo: chk(p["Attivo"]),
    oreSettimanali: p["Ore settimanali"]?.number ?? null,
    monteFerie: p["Monte ferie annuo"]?.number ?? null,
    monteRol: p["Monte ROL annuo"]?.number ?? null,
    residuoFerieIniz: p["Residuo ferie iniziale"]?.number ?? null,
    residuoRolIniz: p["Residuo ROL iniziale"]?.number ?? null
  };
}

export interface DipendenteUpdateInput {
  pageId?: string;
  nome: string; cognome: string; cf?: string; matricola?: string;
  nascita?: string; email?: string; telefono?: string;
  mansione?: string; contratto?: string; struttura?: string;
  oreSettimanali?: number | string; attivo?: boolean; note?: string;
  dataAssunzione?: string; monteFerie?: number | string; monteRol?: number | string;
  residuoFerieIniz?: number | string; residuoRolIniz?: number | string;
}

function numOrUndefined(v: number | string | undefined): number | undefined {
  if (v === undefined || v === "" || v === null) return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
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
  },

  async create(input: DipendenteUpdateInput): Promise<string> {
    const res: any = await notion.createPage({
      parent: { database_id: DB_DIPENDENTI },
      properties: buildProperties(input)
    });
    return res.id;
  },

  async update(pageId: string, input: DipendenteUpdateInput): Promise<void> {
    await notion.updatePage(pageId, { properties: buildProperties(input) });
  }
};

function buildProperties(input: DipendenteUpdateInput): Record<string, any> {
  const props: Record<string, any> = {
    "Nome": { title: [{ text: { content: input.nome } }] },
    "Cognome": { rich_text: [{ text: { content: input.cognome } }] }
  };
  if (input.cf !== undefined) props["Codice fiscale"] = { rich_text: [{ text: { content: input.cf } }] };
  if (input.matricola !== undefined) props["Matricola"] = { rich_text: [{ text: { content: input.matricola } }] };
  if (input.nascita) props["Data nascita"] = { date: { start: input.nascita } };
  if (input.email !== undefined) props["Email"] = { rich_text: [{ text: { content: input.email } }] };
  if (input.telefono !== undefined) props["Telefono"] = { rich_text: [{ text: { content: input.telefono } }] };
  if (input.mansione) props["Mansione"] = { select: { name: input.mansione } };
  if (input.contratto) props["Tipo contratto"] = { select: { name: input.contratto } };
  if (input.struttura !== undefined) props["Struttura principale"] = { rich_text: [{ text: { content: input.struttura } }] };
  if (input.note !== undefined) props["Note"] = { rich_text: [{ text: { content: input.note } }] };
  if (input.dataAssunzione) props["Data assunzione"] = { date: { start: input.dataAssunzione } };
  if (typeof input.attivo === "boolean") props["Attivo"] = { checkbox: input.attivo };

  const ore = numOrUndefined(input.oreSettimanali);
  if (ore !== undefined) props["Ore settimanali"] = { number: ore };
  const mFerie = numOrUndefined(input.monteFerie);
  if (mFerie !== undefined) props["Monte ferie annuo"] = { number: mFerie };
  const mRol = numOrUndefined(input.monteRol);
  if (mRol !== undefined) props["Monte ROL annuo"] = { number: mRol };
  const rFerie = numOrUndefined(input.residuoFerieIniz);
  if (rFerie !== undefined) props["Residuo ferie iniziale"] = { number: rFerie };
  const rRol = numOrUndefined(input.residuoRolIniz);
  if (rRol !== undefined) props["Residuo ROL iniziale"] = { number: rRol };

  return props;
}
