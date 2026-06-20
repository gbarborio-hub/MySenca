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
    documentoFirmato: chk(p["Documento firmato"])
  };
}

export const IncaricatiModel = {
  async list(): Promise<Incaricato[]> {
    const res: any = await notion.queryDatabase(DB_INCARICATI, { page_size: 100 });
    return (res.results || []).map(fromNotionPage);
  },

  async setDocumentoFirmato(pageId: string, firmato: boolean): Promise<void> {
    await notion.updatePage(pageId, { properties: { "Documento firmato": { checkbox: firmato } } });
  }
};
