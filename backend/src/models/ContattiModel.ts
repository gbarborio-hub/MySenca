// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { notion, rt, title, email } from "./notionClient.js";

const DB_CONTATTI = "ddef9937-8d94-4945-b9d8-eaac6ae05808";

export interface Contatto {
  nome: string;
  ruolo: string;
  email: string;
  telefono: string;
  struttura: string;
}

function fromNotionPage(page: any): Contatto {
  const p = page.properties || {};
  return {
    nome: title(p["Nome"]) || "",
    ruolo: rt(p["Ruolo"]) || "",
    email: email(p["Email"]) || "",
    telefono: rt(p["Telefono"]) || "",
    struttura: rt(p["Struttura"]) || ""
  };
}

export const ContattiModel = {
  async list(): Promise<Contatto[]> {
    const res: any = await notion.queryDatabase(DB_CONTATTI, { page_size: 100 });
    return (res.results || []).map(fromNotionPage);
  }
};
