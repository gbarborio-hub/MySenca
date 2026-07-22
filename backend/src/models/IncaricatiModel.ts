import { notion, rt, title, chk, dateStart } from "./notionClient.js";
import { DocumentazionePrivacyModel } from "./DocumentazionePrivacyModel.js";

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
  moduloInviato: string | null;
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
    username: rt(p["Username"]),
    moduloInviato: dateStart(p["Modulo inviato"])
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

    // Invio automatico del "Modulo incaricato al trattamento" usando l'ultimo
    // modello caricato in "Documentazione privacy". Non blocca la creazione.
    if (input.email) {
      DocumentazionePrivacyModel
        .inviaANuovoDestinatario("Incaricato trattamento", { nome: `${input.nome} ${input.cognome}`.trim(), email: input.email })
        .then(inviato => { if (inviato) this.marcaModuloInviato(res.id).catch(() => {}); })
        .catch(() => {});
    }

    return res.id;
  },

  // Segna la data di invio del modulo incaricato al trattamento. Usato sia
  // dall'invio automatico alla creazione sia dagli invii massivi/mirati manuali.
  async marcaModuloInviato(pageId: string): Promise<void> {
    await notion.updatePage(pageId, { properties: { "Modulo inviato": { date: { start: new Date().toISOString() } } } });
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
