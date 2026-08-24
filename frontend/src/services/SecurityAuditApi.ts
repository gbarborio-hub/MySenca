import { api } from "./apiClient.js";

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

export interface StoricoVoce {
  pageId: string;
  dataControllo: string | null;
  totali: number;
  alteCritiche: number;
}

export const SecurityAuditApi = {
  ultimo: () => api.get<SecurityReport | null>("/security-audit/ultimo"),
  storico: () => api.get<StoricoVoce[]>("/security-audit/storico")
};
