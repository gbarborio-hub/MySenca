import { notion, rt, title, chk, dateStart } from "./notionClient.js";

const DB_INCARICATI = "fe132a32729b4c7da387603e29ef1a0d";

export interface Incaricato {
  pageId: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  struttura: string;
  note: string;
  dataNomina: string | null;
  dataScadenza: string | null;
  documentoFirmato: boolean;
  username: string;
}

function fromNotionPage(page: any): Incaricato {
  const p = page.properties || {};
  return {
    pageId: page.id,
    nome: title(p["Nome"]),
    cognome: rt(p["Cognome"]),
    email: rt(p["Email"]),
    ruolo: rt(p["Ruolo"]),
    struttura: rt(p["Struttura"]),
    note: rt(p["Note"]),
    dataNomina: dateStart(p["Data nomina"]),
    dataScadenza: dateStart(p["Data scadenza"]),
    documentoFirmato: chk(p["Documento firmato"]),
    username: rt(p["Username"])
  };
}

export interface IncaricatoCreateInput {
  nome: string; cognome: string; email?: string; ruolo?: string; struttura?: string; note?: string; username?: string;
}

export const IncaricatiModel = {
  async list(): Promise<Incaricato[]> {
    const res: any = await notion.queryDatabase(DB_INCARICATI, { page_size: 100 });
    return (res.results || []).map(fromNotionPage);
  },

  async setDocumentoFirmato(pageId: string, firmato: boolean): Promise<void> {
    await notion.updatePage(pageId, { properties: { "Documento firmato": { checkbox: firmato } } });
  },

  async create(input: IncaricatoCreateInput): Promise<string> {
    const props: Record<string, any> = {
      "Nome": { title: [{ text: { content: input.nome } }] },
      "Cognome": { rich_text: [{ text: { content: input.cognome || "" } }] }
    };
    if (input.email) props["Email"] = { rich_text: [{ text: { content: input.email } }] };
    if (input.ruolo) props["Ruolo"] = { rich_text: [{ text: { content: input.ruolo } }] };
    if (input.struttura) props["Struttura"] = { rich_text: [{ text: { content: input.struttura } }] };
    if (input.note) props["Note"] = { rich_text: [{ text: { content: input.note } }] };
    if (input.username) props["Username"] = { rich_text: [{ text: { content: input.username } }] };
    const res: any = await notion.createPage({ parent: { database_id: DB_INCARICATI }, properties: props });
    return res.id;
  },

  async createMany(inputs: IncaricatoCreateInput[]): Promise<{ ok: number; failed: { input: IncaricatoCreateInput; error: string }[] }> {
    let ok = 0;
    const failed: { input: IncaricatoCreateInput; error: string }[] = [];
    for (const input of inputs) {
      try {
        await this.create(input);
        ok++;
      } catch (e: any) {
        failed.push({ input, error: e?.message || "Errore sconosciuto" });
      }
    }
    return { ok, failed };
  }
};
