// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
//
// Storico dei controlli di sicurezza delle dipendenze (npm audit su backend e
// frontend), eseguiti da GitHub Actions — non dal backend in produzione, che
// nell'immagine Docker finale non ha nemmeno il codice sorgente del frontend (solo
// i file già compilati). GitHub Actions invia qui il risultato ad ogni controllo.
import { notion, rt, dateStart } from "./notionClient.js";

const DB_SICUREZZA = "5ae8e760baa44f5e885148c1301fa2fa";

export interface VulnerabilitaDettaglio {
  pacchetto: string;
  severita: "low" | "moderate" | "high" | "critical";
  titolo: string;
  url: string;
}

export interface ReportProgetto {
  totali: number;
  perSeverita: Record<string, number>;
  dettagli: VulnerabilitaDettaglio[];
}

export interface SecurityReport {
  dataControllo: string;
  backend: ReportProgetto;
  frontend: ReportProgetto;
}

export interface SecurityReportStorico extends SecurityReport {
  pageId: string;
}

function contaAlteCritiche(report: SecurityReport): number {
  const alte = (r: ReportProgetto) => (r.perSeverita["high"] || 0) + (r.perSeverita["critical"] || 0);
  return alte(report.backend) + alte(report.frontend);
}

function contaTotali(report: SecurityReport): number {
  return report.backend.totali + report.frontend.totali;
}

export const SecurityAuditModel = {
  async salva(report: SecurityReport): Promise<void> {
    const totali = contaTotali(report);
    const alteCritiche = contaAlteCritiche(report);
    const dataIt = new Date(report.dataControllo).toLocaleDateString("it-IT");

    await notion.createPage({
      parent: { database_id: DB_SICUREZZA },
      properties: {
        "Riepilogo": { title: [{ text: { content: `Controllo del ${dataIt} — ${totali} vulnerabilità (${alteCritiche} alte/critiche)` } }] },
        "Data controllo": { date: { start: report.dataControllo } },
        "Vulnerabilita totali": { number: totali },
        "Vulnerabilita alte critiche": { number: alteCritiche },
        "Report JSON": { rich_text: [{ text: { content: JSON.stringify(report).slice(0, 2000) } }] }
      }
    });
  },

  async ultimo(): Promise<SecurityReportStorico | null> {
    const res: any = await notion.queryDatabase(DB_SICUREZZA, {
      page_size: 1,
      sorts: [{ property: "Data controllo", direction: "descending" }]
    });
    const page = res.results?.[0];
    if (!page) return null;
    const p = page.properties || {};
    const json = rt(p["Report JSON"]);
    try {
      const parsed = JSON.parse(json) as SecurityReport;
      return { ...parsed, pageId: page.id };
    } catch {
      return null;
    }
  },

  async storico(limit = 10): Promise<{ pageId: string; dataControllo: string | null; totali: number; alteCritiche: number }[]> {
    const res: any = await notion.queryDatabase(DB_SICUREZZA, {
      page_size: limit,
      sorts: [{ property: "Data controllo", direction: "descending" }]
    });
    return (res.results || []).map((page: any) => {
      const p = page.properties || {};
      return {
        pageId: page.id,
        dataControllo: dateStart(p["Data controllo"]),
        totali: p["Vulnerabilita totali"]?.number ?? 0,
        alteCritiche: p["Vulnerabilita alte critiche"]?.number ?? 0
      };
    });
  }
};
