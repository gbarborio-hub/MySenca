// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import { SecurityAuditApi } from "../../services/SecurityAuditApi.js";
import type { SecurityReport, ReportProgetto, StoricoVoce } from "../../services/SecurityAuditApi.js";

const COLORI_SEVERITA: Record<string, { bg: string; fg: string }> = {
  critical: { bg: "#FCE4E4", fg: "#7A1A1A" },
  high:     { bg: "#FDE8D8", fg: "#8A4A00" },
  moderate: { bg: "#FEF3CD", fg: "#7A5800" },
  low:      { bg: "#EAF6F4", fg: "#0F5C52" }
};

function fmtDateOraIt(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, "0");
  const min = String(dt.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} alle ${hh}:${min}`;
}

function ProgettoCard({ nome, report }: { nome: string; report: ReportProgetto }) {
  const severitaOrdine = ["critical", "high", "moderate", "low"];
  return (
    <div className="ana-card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-dark)" }}>{nome}</div>
        {report.totali === 0 ? (
          <div style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 800, background: "#D5F0E0", color: "#1A6B3A" }}>✅ 0 vulnerabilità</div>
        ) : (
          <div style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 800, background: "#FCE4E4", color: "#7A1A1A" }}>{report.totali} trovate</div>
        )}
      </div>

      {report.totali > 0 && (
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: 8 }}>
          {severitaOrdine.filter(s => report.perSeverita[s]).map(s => (
            <span key={s} style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800, background: COLORI_SEVERITA[s]?.bg, color: COLORI_SEVERITA[s]?.fg }}>
              {report.perSeverita[s]} {s}
            </span>
          ))}
        </div>
      )}

      {report.dettagli.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {report.dettagli.map((d, i) => (
            <div key={i} style={{ fontSize: 12, color: "var(--text-mid)", padding: "5px 0", borderTop: i > 0 ? "1px solid #eee" : "none" }}>
              <span style={{ fontWeight: 800 }}>{d.pacchetto}</span> — {d.titolo}
              {d.url && <> · <a href={d.url} target="_blank" rel="noreferrer" style={{ color: "var(--teal)", fontWeight: 700 }}>dettagli</a></>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminSicurezza() {
  const [report, setReport] = useState<SecurityReport | null | undefined>(undefined);
  const [storico, setStorico] = useState<StoricoVoce[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([SecurityAuditApi.ultimo(), SecurityAuditApi.storico()])
      .then(([r, s]) => { setReport(r); setStorico(Array.isArray(s) ? s : []); setLoading(false); })
      .catch(() => { setReport(null); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="section-label"><div className="section-title">Sicurezza — vulnerabilità dipendenze</div></div>
      <div className="ana-card" style={{ padding: "0.85rem 1rem", marginBottom: "0.75rem", background: "#EAF6F4" }}>
        <div style={{ fontSize: 12, color: "var(--text-mid)" }}>Un controllo automatico (GitHub Actions) analizza ogni settimana le librerie usate da backend e frontend, cercando falle di sicurezza note e pubbliche. Qui vedi l'esito dell'ultimo controllo.</div>
      </div>

      {loading ? (
        <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)" }}>Caricamento...</div>
      ) : !report ? (
        <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>
          Nessun controllo ancora registrato. Il primo arriverà al prossimo avvio automatico settimanale, oppure lancialo a mano da GitHub → Actions → "Controllo vulnerabilità dipendenze" → "Run workflow".
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "var(--text-light)", marginBottom: 10 }}>Ultimo controllo: {fmtDateOraIt(report.dataControllo)}</div>
          <ProgettoCard nome="Backend" report={report.backend} />
          <ProgettoCard nome="Frontend" report={report.frontend} />
        </>
      )}

      {storico.length > 1 && (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-dark)", marginBottom: 6 }}>Storico controlli</div>
          <div className="table-card">
            {storico.map((s, i) => (
              <div className="table-row" key={i}>
                <div style={{ flex: 1 }}>
                  <div className="row-title">{fmtDateOraIt(s.dataControllo)}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: s.totali === 0 ? "#1A6B3A" : "#7A1A1A" }}>
                  {s.totali === 0 ? "0 vulnerabilità" : `${s.totali} (${s.alteCritiche} alte/critiche)`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="update-btn" onClick={load}>Aggiorna</button>
    </div>
  );
}
