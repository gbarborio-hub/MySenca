// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
//
// Modelli (template) dei documenti privacy che vanno inviati alle varie categorie
// di destinatari (dipendenti, liberi professionisti, incaricati al trattamento,
// amministratori di sistema). Ogni riga è il modello CORRENTE per una categoria:
// caricarne uno nuovo sovrascrive l'allegato e segna data/ora e autore
// dell'aggiornamento. Da qui in poi:
//   - l'invio automatico a un nuovo destinatario (onboarding) usa sempre l'ultimo
//     modello caricato per la sua categoria;
//   - l'invio massivo manuale ("Invia aggiornamento a tutti gli interessati")
//     manda lo stesso file a tutti i destinatari già esistenti di quella categoria
//     e segna la data dell'ultimo invio.
import { notion, rt, sel, title, dateStart } from "./notionClient.js";
import { EmailService } from "../services/EmailService.js";

const DB_DOCUMENTAZIONE_PRIVACY = "abba4217c2604c09ac9e5b2f60da5c1e";

export type CategoriaModello =
  | "Dipendente"
  | "Libero professionista"
  | "Incaricato trattamento"
  | "Amministratore di sistema";

export interface ModelloPrivacy {
  pageId: string;
  nomeModello: string;
  categoria: CategoriaModello | "";
  allegatoNome: string;
  allegatoUrl: string | null; // URL firmato Notion, scade dopo ~1h: va letto fresco al momento dell'invio
  dataUltimoAggiornamento: string | null;
  aggiornatoDa: string;
  dataUltimoInvio: string | null;
  note: string;
}

function fromNotionPage(page: any): ModelloPrivacy {
  const p = page.properties || {};
  const files = p["Allegato"]?.files || [];
  const f = files[0];
  return {
    pageId: page.id,
    nomeModello: title(p["Nome modello"]) || "",
    categoria: (sel(p["Categoria destinatari"]) as CategoriaModello) || "",
    allegatoNome: f?.name ?? "",
    allegatoUrl: f ? (f.file?.url || f.external?.url || null) : null,
    dataUltimoAggiornamento: dateStart(p["Data ultimo aggiornamento"]),
    aggiornatoDa: rt(p["Aggiornato da"]) || "",
    dataUltimoInvio: dateStart(p["Data ultimo invio aggiornamento"]),
    note: rt(p["Note"]) || ""
  };
}

async function fetchFileAsBase64(url: string): Promise<{ base64: string; contentType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await res.arrayBuffer());
    return { base64: buf.toString("base64"), contentType };
  } catch {
    return null;
  }
}

export interface DestinatarioModello {
  pageId: string;
  nome: string;
  email: string;
}

export const DocumentazionePrivacyModel = {
  async list(): Promise<ModelloPrivacy[]> {
    const res: any = await notion.queryDatabase(DB_DOCUMENTAZIONE_PRIVACY, { page_size: 50 });
    return (res.results || []).map(fromNotionPage);
  },

  async getByCategoria(categoria: CategoriaModello): Promise<ModelloPrivacy | null> {
    const res: any = await notion.queryDatabase(DB_DOCUMENTAZIONE_PRIVACY, {
      filter: { property: "Categoria destinatari", select: { equals: categoria } },
      page_size: 1
    });
    if (!res.results?.length) return null;
    return fromNotionPage(res.results[0]);
  },

  // Carica/sostituisce il modello corrente: sovrascrive l'allegato e segna data/ora
  // e autore dell'aggiornamento. Da questo momento è il nuovo modello definitivo.
  async carica(pageId: string, input: { fileBase64: string; fileName: string; contentType?: string; aggiornatoDa: string }): Promise<void> {
    const uploadId = await notion.uploadFile(input.fileName, input.contentType || "application/octet-stream", input.fileBase64);
    const now = new Date().toISOString();
    await notion.updatePage(pageId, {
      properties: {
        "Allegato": { files: [{ type: "file_upload", file_upload: { id: uploadId }, name: input.fileName }] },
        "Data ultimo aggiornamento": { date: { start: now } },
        "Aggiornato da": { rich_text: [{ text: { content: input.aggiornatoDa || "" } }] }
      }
    });
  },

  // Invio massivo manuale (o mirato a un sottoinsieme, es. "solo i mancanti"): prende
  // il modello (già letto fresco dal chiamante) e lo manda ai destinatari passati.
  // onInviato, se fornito, viene chiamato per ogni invio riuscito con il pageId del
  // destinatario, così il chiamante può segnare "ricevuto" sull'anagrafica giusta
  // (Dipendente/Incaricato/Amministratore — il model qui non conosce quelle entità).
  async inviaAggiornamentoATutti(
    modello: ModelloPrivacy,
    destinatari: DestinatarioModello[],
    onInviato?: (pageId: string) => Promise<void>
  ): Promise<{ ok: boolean; inviati: number; falliti: string[]; error?: string }> {
    if (!modello.allegatoUrl) return { ok: false, inviati: 0, falliti: [], error: "Nessun documento caricato per questo modello." };
    const file = await fetchFileAsBase64(modello.allegatoUrl);
    if (!file) return { ok: false, inviati: 0, falliti: [], error: "Impossibile leggere il file del modello da Notion." };

    const falliti: string[] = [];
    let inviati = 0;
    for (const d of destinatari) {
      if (!d.email) { falliti.push(`${d.nome} (email mancante)`); continue; }
      const ok = await EmailService.sendDocumentoPrivacy(
        d.email,
        modello.nomeModello,
        EmailService.documentoPrivacyTemplate(d.nome, modello.nomeModello),
        { fileName: modello.allegatoNome || `${modello.nomeModello}.pdf`, contentType: file.contentType, fileBase64: file.base64 }
      );
      if (ok) {
        inviati++;
        if (onInviato) await onInviato(d.pageId).catch(() => {});
      } else {
        falliti.push(d.nome);
      }
    }

    await notion.updatePage(modello.pageId, {
      properties: { "Data ultimo invio aggiornamento": { date: { start: new Date().toISOString() } } }
    });

    return { ok: true, inviati, falliti };
  },

  // Invio automatico a UN singolo nuovo destinatario (onboarding di un dipendente,
  // incaricato o amministratore interno appena creato). Usa sempre l'ultimo modello
  // caricato per la categoria. Non tocca "Data ultimo invio aggiornamento": quel
  // campo riguarda solo gli invii massivi manuali, non l'invio standard all'ingresso
  // di una nuova persona. Non lancia mai eccezioni: un errore qui non deve mai far
  // fallire la creazione dell'anagrafica.
  async inviaANuovoDestinatario(categoria: CategoriaModello, destinatario: { nome: string; email: string }): Promise<boolean> {
    try {
      if (!destinatario.email) return false;
      const modello = await this.getByCategoria(categoria);
      if (!modello?.allegatoUrl) return false;
      const file = await fetchFileAsBase64(modello.allegatoUrl);
      if (!file) return false;
      return await EmailService.sendDocumentoPrivacy(
        destinatario.email,
        modello.nomeModello,
        EmailService.documentoPrivacyTemplate(destinatario.nome, modello.nomeModello),
        { fileName: modello.allegatoNome || `${modello.nomeModello}.pdf`, contentType: file.contentType, fileBase64: file.base64 }
      );
    } catch {
      return false;
    }
  }
};
