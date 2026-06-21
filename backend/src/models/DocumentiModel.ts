import { notion, rt, sel, title, chk, dateStart } from "./notionClient.js";

const DB_DOCUMENTI = "74480ed918f145f2b960e7ca5177fc77";

export type StatoFirma = "Da firmare" | "In attesa di verifica" | "Firmato" | "Respinto" | "";
export type CaricatoDaRuolo = "GP" | "Privacy" | "Dipendente" | "";

export interface Documento {
  pageId: string;
  titolo: string;
  username: string;
  dipendente: string;
  tipo: string;
  note: string;
  dataCaricamento: string | null;
  allegatoNome: string;
  allegatoUrl: string | null; // URL del file Notion (scade dopo ~1h, va letto fresco)
  linkAllegato: string;
  caricatoDa: string;
  richiedeFirma: boolean;
  statoFirma: StatoFirma;
  caricatoDaRuolo: CaricatoDaRuolo;
}

function fromNotionPage(page: any): Documento {
  const p = page.properties || {};
  const files = p["Allegato"]?.files || [];
  const f = files[0];
  const allegatoUrl = f ? (f.file?.url || f.external?.url || null) : null;
  return {
    pageId: page.id,
    titolo: title(p["Titolo"]) || "",
    username: rt(p["Username"]) || "",
    dipendente: rt(p["Dipendente"]) || "",
    tipo: sel(p["Tipo"]) || "",
    note: rt(p["Note"]) || "",
    dataCaricamento: dateStart(p["Data caricamento"]),
    allegatoNome: rt(p["Allegato nome"]) || (f?.name ?? ""),
    allegatoUrl,
    linkAllegato: p["Link allegato"]?.url || "",
    caricatoDa: rt(p["Caricato da"]) || "",
    richiedeFirma: chk(p["Richiede firma"]),
    statoFirma: (sel(p["Stato firma"]) as StatoFirma) || "",
    caricatoDaRuolo: (sel(p["Caricato da ruolo"]) as CaricatoDaRuolo) || ""
  };
}

export interface DocumentoCreateInput {
  username: string; dipendente: string; titolo: string; tipo: string; note?: string;
  linkAllegato?: string; fileBase64?: string; fileName?: string; contentType?: string;
  caricatoDa: string; caricatoDaRuolo: CaricatoDaRuolo;
  richiedeFirma?: boolean;
}

async function buildAllegatoProps(input: { fileBase64?: string; fileName?: string; contentType?: string; linkAllegato?: string }) {
  const props: Record<string, any> = {};
  if (input.fileBase64 && input.fileName) {
    const uploadId = await notion.uploadFile(input.fileName, input.contentType || "application/octet-stream", input.fileBase64);
    props["Allegato"] = { files: [{ type: "file_upload", file_upload: { id: uploadId }, name: input.fileName }] };
    props["Allegato nome"] = { rich_text: [{ text: { content: input.fileName } }] };
  } else {
    props["Allegato"] = { files: [] };
    props["Allegato nome"] = { rich_text: [] };
  }
  if (input.linkAllegato !== undefined) props["Link allegato"] = { url: input.linkAllegato || null };
  return props;
}

export const DocumentiModel = {
  async listByUsername(username: string): Promise<Documento[]> {
    const res: any = await notion.queryDatabase(DB_DOCUMENTI, {
      filter: { property: "Username", rich_text: { equals: username } },
      page_size: 100,
      sorts: [{ property: "Data caricamento", direction: "descending" }]
    });
    return (res.results || []).map(fromNotionPage);
  },

  async listAll(): Promise<Documento[]> {
    const res: any = await notion.queryDatabase(DB_DOCUMENTI, {
      page_size: 150,
      sorts: [{ property: "Data caricamento", direction: "descending" }]
    });
    return (res.results || []).map(fromNotionPage);
  },

  // Documenti caricati da GP/Privacy ancora in attesa che il dipendente carichi la firma,
  // o già restituiti dal dipendente e in attesa di verifica — utile per la coda "da gestire" in GP.
  async listInLavorazione(): Promise<Documento[]> {
    const all = await this.listAll();
    return all.filter(d => d.richiedeFirma && (d.statoFirma === "Da firmare" || d.statoFirma === "In attesa di verifica"));
  },

  // Creazione da parte di GP o Privacy: carica il documento originale (es. da firmare) per un dipendente.
  async create(input: DocumentoCreateInput): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const allegatoProps = await buildAllegatoProps(input);
    const props: Record<string, any> = {
      "Titolo": { title: [{ text: { content: input.titolo } }] },
      "Username": { rich_text: [{ text: { content: input.username } }] },
      "Dipendente": { rich_text: [{ text: { content: input.dipendente } }] },
      "Tipo": { select: { name: input.tipo || "Altro" } },
      "Note": { rich_text: [{ text: { content: input.note || "" } }] },
      "Data caricamento": { date: { start: today } },
      "Caricato da": { rich_text: [{ text: { content: input.caricatoDa } }] },
      "Caricato da ruolo": { select: { name: input.caricatoDaRuolo } },
      "Richiede firma": { checkbox: !!input.richiedeFirma },
      "Stato firma": { select: input.richiedeFirma ? { name: "Da firmare" } : null },
      ...allegatoProps
    };
    const res: any = await notion.createPage({ parent: { database_id: DB_DOCUMENTI }, properties: props });
    return res.id;
  },

  // Il dipendente carica la versione firmata: sostituisce l'allegato e passa lo stato
  // in verifica. Consentito solo se il documento richiede firma ed è in stato "Da firmare"
  // o "Respinto" (per permettere nuovi tentativi dopo uno scarto).
  async caricaFirmato(pageId: string, input: { fileBase64: string; fileName: string; contentType?: string }): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const allegatoProps = await buildAllegatoProps(input);
    await notion.updatePage(pageId, {
      properties: {
        "Stato firma": { select: { name: "In attesa di verifica" } },
        "Data caricamento": { date: { start: today } },
        ...allegatoProps
      }
    });
  },

  // GP verifica la firma: "approva" archivia il documento firmato come definitivo,
  // "scarta" elimina l'allegato e segnala al dipendente di ricaricare.
  async verificaFirma(pageId: string, esito: "approva" | "scarta"): Promise<void> {
    if (esito === "approva") {
      await notion.updatePage(pageId, { properties: { "Stato firma": { select: { name: "Firmato" } } } });
    } else {
      await notion.updatePage(pageId, {
        properties: {
          "Stato firma": { select: { name: "Respinto" } },
          "Allegato": { files: [] },
          "Allegato nome": { rich_text: [] }
        }
      });
    }
  },

  async delete(pageId: string): Promise<void> {
    await notion.updatePage(pageId, { in_trash: true } as any);
  }
};
