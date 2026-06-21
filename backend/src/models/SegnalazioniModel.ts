import { notion, rt, sel, title, chk, dateStart } from "./notionClient.js";

const DB_SEGNALAZIONI = "0397ae7f488544df92370da4ba04f5f2";

export interface Segnalazione {
  pageId: string;
  numeroEvento: string;
  tipo: string;
  stato: string;
  dataEvento: string | null;
  dataSegnalazione: string | null;
  segnalatoDa: string;
  usernameSegnalante: string;
  areaSede: string;
  struttura: string;
  descrizione: string;
  tipoViolazione: string;
  origine: string;
  causa: string;
  testimoni: string;
  infoAziendaliCoinvolte: boolean;
  dettaglioInfoAziendali: string;
  datiPersonaliCoinvolti: boolean;
  assetCoinvolti: string;
  responsabileAsset: string;
  misureAdottate: string;
  categoriaDataBreach: string;
  categorieDatiCoinvolti: string;
  quantitaDati: string;
  categorieInteressati: string;
  danniInteressati: string;
  notificaGarante: boolean;
  dataNotificaGarante: string | null;
  responsabileGestione: string;
  note: string;
}

function fromNotionPage(page: any): Segnalazione {
  const p = page.properties || {};
  return {
    pageId: page.id,
    numeroEvento: title(p["Numero evento"]) || "",
    tipo: sel(p["Tipo"]) || "",
    stato: sel(p["Stato"]) || "Aperto",
    dataEvento: dateStart(p["Data evento"]),
    dataSegnalazione: dateStart(p["Data segnalazione"]),
    segnalatoDa: rt(p["Segnalato da"]) || "",
    usernameSegnalante: rt(p["Username segnalante"]) || "",
    areaSede: rt(p["Area/Sede"]) || "",
    struttura: rt(p["Struttura"]) || "",
    descrizione: rt(p["Descrizione"]) || "",
    tipoViolazione: rt(p["Tipo violazione"]) || "",
    origine: sel(p["Origine"]) || "",
    causa: sel(p["Causa"]) || "",
    testimoni: rt(p["Testimoni"]) || "",
    infoAziendaliCoinvolte: chk(p["Info aziendali coinvolte"]),
    dettaglioInfoAziendali: rt(p["Dettaglio info aziendali"]) || "",
    datiPersonaliCoinvolti: chk(p["Dati personali coinvolti"]),
    assetCoinvolti: rt(p["Asset coinvolti"]) || "",
    responsabileAsset: rt(p["Responsabile asset"]) || "",
    misureAdottate: rt(p["Misure adottate"]) || "",
    categoriaDataBreach: sel(p["Categoria data breach"]) || "",
    categorieDatiCoinvolti: rt(p["Categorie dati coinvolti"]) || "",
    quantitaDati: rt(p["Quantita dati"]) || "",
    categorieInteressati: rt(p["Categorie interessati"]) || "",
    danniInteressati: rt(p["Danni agli interessati"]) || "",
    notificaGarante: chk(p["Notifica Garante"]),
    dataNotificaGarante: dateStart(p["Data notifica Garante"]),
    responsabileGestione: rt(p["Responsabile gestione"]) || "",
    note: rt(p["Note"]) || ""
  };
}

export interface SegnalazioneCreateInput {
  numeroEvento: string; username: string; nome: string;
  dataEvento?: string; areaSede?: string; descrizione: string; tipoViolazione: string;
  origine?: string; causa?: string; testimoni?: string;
  infoAziendali?: string; infoDettaglio?: string; datiPersonali?: string;
  asset?: string; responsabileAsset?: string; misure?: string;
  dataBreach?: string; categoriaDb?: string; categorieDati?: string;
  quantita?: string; interessati?: string; danni?: string;
}

function rtProp(value: string | undefined) {
  return { rich_text: [{ text: { content: value || "" } }] };
}

export const SegnalazioniModel = {
  async list(): Promise<Segnalazione[]> {
    const res: any = await notion.queryDatabase(DB_SEGNALAZIONI, {
      page_size: 150,
      sorts: [{ property: "Data segnalazione", direction: "descending" }]
    });
    return (res.results || []).map(fromNotionPage);
  },

  async create(input: SegnalazioneCreateInput): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const props: Record<string, any> = {
      "Numero evento": { title: [{ text: { content: input.numeroEvento } }] },
      "Tipo": { select: { name: input.dataBreach === "Sì" ? "Data Breach" : "Incidente" } },
      "Stato": { select: { name: "Aperto" } },
      "Data segnalazione": { date: { start: today } },
      "Segnalato da": rtProp(input.nome),
      "Username segnalante": rtProp(input.username),
      "Area/Sede": rtProp(input.areaSede),
      "Descrizione": rtProp(input.descrizione),
      "Tipo violazione": rtProp(input.tipoViolazione),
      "Testimoni": rtProp(input.testimoni),
      "Dettaglio info aziendali": rtProp(input.infoDettaglio),
      "Asset coinvolti": rtProp(input.asset),
      "Responsabile asset": rtProp(input.responsabileAsset),
      "Misure adottate": rtProp(input.misure),
      "Categorie dati coinvolti": rtProp(input.categorieDati),
      "Quantita dati": rtProp(input.quantita),
      "Categorie interessati": rtProp(input.interessati),
      "Danni agli interessati": rtProp(input.danni),
      "Info aziendali coinvolte": { checkbox: input.infoAziendali === "Sì" },
      "Dati personali coinvolti": { checkbox: input.datiPersonali === "Sì" }
    };
    if (input.dataEvento) props["Data evento"] = { date: { start: input.dataEvento } };
    if (input.origine) props["Origine"] = { select: { name: input.origine } };
    if (input.causa) props["Causa"] = { select: { name: input.causa } };
    if (input.categoriaDb) props["Categoria data breach"] = { select: { name: input.categoriaDb } };

    const res: any = await notion.createPage({ parent: { database_id: DB_SEGNALAZIONI }, properties: props });
    return res.id;
  },

  async updateStato(pageId: string, stato: "Aperto" | "In gestione" | "Chiuso"): Promise<void> {
    await notion.updatePage(pageId, { properties: { "Stato": { select: { name: stato } } } });
  },

  async aggiornaGestione(pageId: string, input: { responsabileGestione?: string; misureAdottate?: string; note?: string; notificaGarante?: boolean; dataNotificaGarante?: string }): Promise<void> {
    const props: Record<string, any> = {};
    if (input.responsabileGestione !== undefined) props["Responsabile gestione"] = rtProp(input.responsabileGestione);
    if (input.misureAdottate !== undefined) props["Misure adottate"] = rtProp(input.misureAdottate);
    if (input.note !== undefined) props["Note"] = rtProp(input.note);
    if (typeof input.notificaGarante === "boolean") props["Notifica Garante"] = { checkbox: input.notificaGarante };
    if (input.dataNotificaGarante) props["Data notifica Garante"] = { date: { start: input.dataNotificaGarante } };
    await notion.updatePage(pageId, { properties: props });
  }
};
