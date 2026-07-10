// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { notion, rt, sel, dateStart } from "./notionClient.js";

const DB_TURNI = "9189ca04-bd30-400b-aa28-8056cb1cefc5";

export interface Turno {
  data: string | null;
  tipo: string;
  oraInizio: string;
  oraFine: string;
  struttura: string;
  codice: string;
  colore: string;
}

function fromNotionPage(page: any): Turno {
  const p = page.properties || {};
  return {
    data: dateStart(p["Data"]),
    tipo: sel(p["Tipo turno"]) || "",
    oraInizio: rt(p["Ora inizio"]) || "",
    oraFine: rt(p["Ora fine"]) || "",
    struttura: rt(p["Struttura"]) || "",
    codice: rt(p["Codice"]) || "",
    colore: rt(p["Colore"]) || ""
  };
}

export const TurniModel = {
  // Legge tutti i turni di un dipendente, identificato per nome completo
  // (stesso valore salvato nel campo testo "Dipendente" su Notion).
  async listByDipendente(nomeCompleto: string): Promise<Turno[]> {
    const res: any = await notion.queryDatabase(DB_TURNI, {
      page_size: 100,
      filter: { property: "Dipendente", rich_text: { equals: nomeCompleto } },
      sorts: [{ property: "Data", direction: "ascending" }]
    });
    return (res.results || []).map(fromNotionPage);
  }
};
