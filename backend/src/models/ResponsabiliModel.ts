import { notion, rt, sel, title, chk, dateStart } from "./notionClient.js";

const DB_RESPONSABILI = "8ee076b51b3f4a989a754bedb416d915";

export type StatoInvio = "Non inviata" | "Inviata" | "Autonomina" | "";
export type StatoFirma = "Da firmare" | "In attesa di verifica" | "Firmato" | "Respinto" | "";

export interface Responsabile {
  pageId: string;
  nome: string;
  attivitaSvolta: string;
  email: string;
  indirizzo: string;
  statoInvio: StatoInvio;
  dataInvio: string | null;
  note: string;
  checklistFileNome: string;
  checklistFileUrl: string | null;
  checklistRichiedeFirma: boolean;
  checklistStatoFirma: StatoFirma;
  contrattoFileNome: string;
  contrattoFileUrl: string | null;
  contrattoRichiedeFirma: boolean;
  contrattoStatoFirma: StatoFirma;
}

function fileInfo(filesProp: any): { nome: string; url: string | null } {
  const files = filesProp?.files || [];
  const f = files[0];
  if (!f) return { nome: "", url: null };
  return { nome: f.name || "", url: f.file?.url || f.external?.url || null };
}

function fromNotionPage(page: any): Responsabile {
  const p = page.properties || {};
  const checklist = fileInfo(p["Checklist file"]);
  const contratto = fileInfo(p["Contratto file"]);
  return {
    pageId: page.id,
    nome: title(p["Cognome e nome o ragione sociale"]) || "",
    attivitaSvolta: rt(p["Attivita svolta"]) || "",
    email: rt(p["Email"]) || p["Email"]?.email || "",
    indirizzo: rt(p["Indirizzo"]) || "",
    statoInvio: (sel(p["Stato invio"]) as StatoInvio) || "",
    dataInvio: dateStart(p["Data invio"]),
    note: rt(p["Note"]) || "",
    checklistFileNome: checklist.nome,
    checklistFileUrl: checklist.url,
    checklistRichiedeFirma: chk(p["Checklist richiede firma"]),
    checklistStatoFirma: (sel(p["Checklist stato firma"]) as StatoFirma) || "",
    contrattoFileNome: contratto.nome,
    contrattoFileUrl: contratto.url,
    contrattoRichiedeFirma: chk(p["Contratto richiede firma"]),
    contrattoStatoFirma: (sel(p["Contratto stato firma"]) as StatoFirma) || ""
  };
}

export interface ResponsabileCreateInput {
  nome: string; attivitaSvolta?: string; email?: string; indirizzo?: string; note?: string;
}

type Slot = "checklist" | "contratto";

function slotFileProp(slot: Slot): string { return slot === "checklist" ? "Checklist file" : "Contratto file"; }
function slotRichiedeProp(slot: Slot): string { return slot === "checklist" ? "Checklist richiede firma" : "Contratto richiede firma"; }
function slotStatoProp(slot: Slot): string { return slot === "checklist" ? "Checklist stato firma" : "Contratto stato firma"; }

async function buildFileProps(slot: Slot, input: { fileBase64?: string; fileName?: string; contentType?: string }) {
  const props: Record<string, any> = {};
  if (input.fileBase64 && input.fileName) {
    const uploadId = await notion.uploadFile(input.fileName, input.contentType || "application/octet-stream", input.fileBase64);
    props[slotFileProp(slot)] = { files: [{ type: "file_upload", file_upload: { id: uploadId }, name: input.fileName }] };
  } else {
    props[slotFileProp(slot)] = { files: [] };
  }
  return props;
}

export const ResponsabiliModel = {
  async list(): Promise<Responsabile[]> {
    const res: any = await notion.queryDatabase(DB_RESPONSABILI, { page_size: 100 });
    return (res.results || []).map(fromNotionPage);
  },

  async create(input: ResponsabileCreateInput): Promise<string> {
    const props: Record<string, any> = {
      "Cognome e nome o ragione sociale": { title: [{ text: { content: input.nome } }] },
      "Attivita svolta": { rich_text: [{ text: { content: input.attivitaSvolta || "" } }] },
      "Indirizzo": { rich_text: [{ text: { content: input.indirizzo || "" } }] },
      "Note": { rich_text: [{ text: { content: input.note || "" } }] },
      "Stato invio": { select: { name: "Non inviata" } }
    };
    if (input.email) props["Email"] = { email: input.email };
    const res: any = await notion.createPage({ parent: { database_id: DB_RESPONSABILI }, properties: props });
    return res.id;
  },

  async update(pageId: string, input: Partial<ResponsabileCreateInput> & { statoInvio?: StatoInvio; dataInvio?: string }): Promise<void> {
    const props: Record<string, any> = {};
    if (input.nome !== undefined) props["Cognome e nome o ragione sociale"] = { title: [{ text: { content: input.nome } }] };
    if (input.attivitaSvolta !== undefined) props["Attivita svolta"] = { rich_text: [{ text: { content: input.attivitaSvolta } }] };
    if (input.indirizzo !== undefined) props["Indirizzo"] = { rich_text: [{ text: { content: input.indirizzo } }] };
    if (input.note !== undefined) props["Note"] = { rich_text: [{ text: { content: input.note } }] };
    if (input.email !== undefined) props["Email"] = { email: input.email };
    if (input.statoInvio) props["Stato invio"] = { select: { name: input.statoInvio } };
    if (input.dataInvio) props["Data invio"] = { date: { start: input.dataInvio } };
    await notion.updatePage(pageId, { properties: props });
  },

  async delete(pageId: string): Promise<void> {
    await notion.updatePage(pageId, { in_trash: true } as any);
  },

  // Carica uno dei due documenti (checklist o contratto), impostando se richiede firma.
  async caricaDocumento(pageId: string, slot: Slot, input: { fileBase64?: string; fileName?: string; contentType?: string; richiedeFirma: boolean }): Promise<void> {
    const fileProps = await buildFileProps(slot, input);
    const props: Record<string, any> = {
      ...fileProps,
      [slotRichiedeProp(slot)]: { checkbox: input.richiedeFirma },
      [slotStatoProp(slot)]: { select: input.richiedeFirma ? { name: "Da firmare" } : null }
    };
    await notion.updatePage(pageId, { properties: props });
  },

  // Il documento firmato viene ricaricato (offline, da Privacy/GP) sostituendo il file.
  async caricaFirmato(pageId: string, slot: Slot, input: { fileBase64: string; fileName: string; contentType?: string }): Promise<void> {
    const fileProps = await buildFileProps(slot, input);
    await notion.updatePage(pageId, {
      properties: { ...fileProps, [slotStatoProp(slot)]: { select: { name: "In attesa di verifica" } } }
    });
  },

  async verificaFirma(pageId: string, slot: Slot, esito: "approva" | "scarta"): Promise<void> {
    if (esito === "approva") {
      await notion.updatePage(pageId, { properties: { [slotStatoProp(slot)]: { select: { name: "Firmato" } } } });
    } else {
      await notion.updatePage(pageId, {
        properties: { [slotStatoProp(slot)]: { select: { name: "Respinto" } }, [slotFileProp(slot)]: { files: [] } }
      });
    }
  }
};
