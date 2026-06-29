import { notion, rt, sel, title, dateStart } from "./notionClient.js";

const DB_STATUS_LAVORI = "d3731e17e0a34b0d9084638cbaf2c4bd";

export type StatoAvanzamento = "Non iniziato" | "In lavorazione" | "Risolto";
export type Urgenza = "Urgente" | "Alta" | "Media" | "Bassa";

export interface StatusLavoro {
  pageId: string;
  puntoCheckList: string;
  categoria: string;
  intervento: string;
  noteSoluzioni: string;
  stato: StatoAvanzamento;
  urgenza: Urgenza | "";
  data: string | null;
  place: string;
}

function fromNotionPage(page: any): StatusLavoro {
  const p = page.properties || {};
  return {
    pageId: page.id,
    puntoCheckList: title(p["Punto check list"]) || "",
    categoria: rt(p["Categoria"]) || sel(p["Categoria"]) || "",
    intervento: rt(p["Intervento da effettuare"]) || "",
    noteSoluzioni: rt(p["Note e soluzioni"]) || "",
    stato: (sel(p["Stato avanzamento"]) as StatoAvanzamento) || "Non iniziato",
    urgenza: (sel(p["Urgenza"]) as Urgenza) || "",
    data: dateStart(p["Date"]),
    place: rt(p["Place"]) || ""
  };
}

export interface StatusLavoroCreateInput {
  puntoCheckList: string; categoria?: string; intervento?: string;
  noteSoluzioni?: string; stato?: StatoAvanzamento; urgenza?: Urgenza; data?: string; place?: string;
}

export const StatusLavoriModel = {
  async list(): Promise<StatusLavoro[]> {
    const res: any = await notion.queryDatabase(DB_STATUS_LAVORI, { page_size: 150 });
    return (res.results || []).map(fromNotionPage);
  },

  async create(input: StatusLavoroCreateInput): Promise<string> {
    const props: Record<string, any> = {
      "Punto check list": { title: [{ text: { content: input.puntoCheckList } }] },
      "Categoria": { rich_text: [{ text: { content: input.categoria || "" } }] },
      "Intervento da effettuare": { rich_text: [{ text: { content: input.intervento || "" } }] },
      "Note e soluzioni": { rich_text: [{ text: { content: input.noteSoluzioni || "" } }] },
      "Stato avanzamento": { select: { name: input.stato || "Non iniziato" } },
      "Place": { rich_text: [{ text: { content: input.place || "" } }] }
    };
    if (input.urgenza) props["Urgenza"] = { select: { name: input.urgenza } };
    if (input.data) props["Date"] = { date: { start: input.data } };
    const res: any = await notion.createPage({ parent: { database_id: DB_STATUS_LAVORI }, properties: props });
    return res.id;
  },

  // Aggiorna lo stato (per il drag&drop tra colonne della vista Kanban).
  async setStato(pageId: string, stato: StatoAvanzamento): Promise<void> {
    await notion.updatePage(pageId, { properties: { "Stato avanzamento": { select: { name: stato } } } });
  },

  // Le note funzionano come log: il testo nuovo viene accodato a quello esistente,
  // con data, invece di sovrascriverlo (coerente con la richiesta "tipo i progressi fatti").
  async aggiungiNota(pageId: string, notaEsistente: string, nuovaNota: string): Promise<void> {
    const oggi = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${pad(oggi.getDate())}/${pad(oggi.getMonth() + 1)}/${oggi.getFullYear()}`;
    const riga = `[${timestamp}] ${nuovaNota}`;
    const aggiornato = notaEsistente ? `${notaEsistente}\n${riga}` : riga;
    await notion.updatePage(pageId, { properties: { "Note e soluzioni": { rich_text: [{ text: { content: aggiornato } }] } } });
  }
};
