// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import type { AuditAzione } from "../services/AuditService.js";

const DB_AUDIT = "ca05282ca862460b884b4c6804e67ac9";

export interface AuditRecord {
  pageId: string;
  descrizione: string;
  utente: string;
  ruolo: string;
  azione: AuditAzione;
  risorsa: string;
  dettaglio: string;
  ip: string;
  timestamp: string | null;
  hashPrecedente: string;
  hashRecord: string;
}

function getText(prop: any): string {
  return prop?.rich_text?.[0]?.text?.content || "";
}

function fromNotionPage(page: any): AuditRecord {
  const p = page.properties || {};
  return {
    pageId: page.id,
    descrizione: p["Descrizione"]?.title?.[0]?.text?.content || "",
    utente: getText(p["Utente"]),
    ruolo: getText(p["Ruolo"]),
    azione: (p["Azione"]?.select?.name || "") as AuditAzione,
    risorsa: getText(p["Risorsa"]),
    dettaglio: getText(p["Dettaglio"]),
    ip: getText(p["IP"]),
    timestamp: p["Timestamp"]?.date?.start || null,
    hashPrecedente: getText(p["Hash precedente"]),
    hashRecord: getText(p["Hash record"])
  };
}

export const AuditModel = {
  async list(notion: any, options?: { pageSize?: number; startCursor?: string; filtroUtente?: string; filtroAzione?: string }): Promise<{ records: AuditRecord[]; hasMore: boolean; nextCursor?: string }> {
    const filters: any[] = [];
    if (options?.filtroUtente) {
      filters.push({ property: "Utente", rich_text: { contains: options.filtroUtente } });
    }
    if (options?.filtroAzione) {
      filters.push({ property: "Azione", select: { equals: options.filtroAzione } });
    }

    const query: any = {
      page_size: options?.pageSize || 50,
      sorts: [{ property: "Timestamp", direction: "descending" }]
    };
    if (options?.startCursor) query.start_cursor = options.startCursor;
    if (filters.length === 1) query.filter = filters[0];
    if (filters.length > 1) query.filter = { and: filters };

    const res: any = await notion.queryDatabase(DB_AUDIT, query);
    return {
      records: (res.results || []).map(fromNotionPage),
      hasMore: !!res.has_more,
      nextCursor: res.next_cursor || undefined
    };
  }
};
