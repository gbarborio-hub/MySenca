// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { useState, useEffect } from "react";
import { AuditApi } from "../../services/AuditApi.js";
import type { AuditRecord, VerificaResult } from "../../services/AuditApi.js";

const AZIONE_COLORS: Record<string, { bg: string; col: string }> = {
  LOGIN:     { bg: "#D5F0E0", col: "#1A6B3A" },
  LOGOUT:    { bg: "#EEE",    col: "#555" },
  AUTH_FAIL: { bg: "#FCE4E4", col: "#7A1A1A" },
  CREATE:    { bg: "#DDEEFF", col: "#1A4A7A" },
  READ:      { bg: "#F0F0F0", col: "#444" },
  UPDATE:    { bg: "#FEF3CD", col: "#7A5800" },
  DELETE:    { bg: "#FFE3D1", col: "#8A3A1A" }
};

function fmtTs(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function exportCSV(records: AuditRecord[]) {
  const header = ["Timestamp","Utente","Ruolo","Azione","Risorsa","Dettaglio","IP","Hash record"];
  const rows = records.map(r => [
    fmtTs(r.timestamp), r.utente, r.ruolo, r.azione,
    r.risorsa, r.dettaglio, r.ip, r.hashRecord
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AuditLog_MySenca_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminAuditLog() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [filtroUtente, setFiltroUtente] = useState("");
  const [filtroAzione, setFiltroAzione] = useState("");
  const [verifica, setVerifica] = useState<VerificaResult | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [detailRec, setDetailRec] = useState<AuditRecord | null>(null);

  async function load(reset = false) {
    setLoading(true);
    try {
      const result = await AuditApi.list({
        cursor: reset ? undefined : cursor,
        utente: filtroUtente || undefined,
        azione: filtroAzione || undefined
      });
      setRecords(prev => reset ? result.records : [...prev, ...result.records]);
      setHasMore(result.hasMore);
      setCursor(result.nextCursor);
    } catch { /* handled silently */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(true); }, [filtroUtente, filtroAzione]);

  async function eseguiVerifica() {
    setVerificando(true);
    setVerifica(null);
    try {
      const result = await AuditApi.verifica();
      setVerifica(result);
    } catch { setVerifica({ integro: false, totaleRecord: 0, descrizioneRottura: "Errore durante la verifica." }); }
    finally { setVerificando(false); }
  }

  if (detailRec) {
    return (
      <div>
        <button onClick={() => setDetailRec(null)} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 800, color: "var(--teal)", cursor: "pointer", fontFamily: "Satoshi,sans-serif", marginBottom: "0.5rem" }}>← Indietro</button>
        <div style={{ background: "var(--teal-dark)", borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>{fmtTs(detailRec.timestamp)}</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: "white", marginTop: 4 }}>{detailRec.descrizione}</div>
        </div>
        <div className="ana-card" style={{ marginBottom: "0.75rem" }}>
          <div className="ana-row"><div className="ana-label">Utente</div><div className="ana-value">{detailRec.utente || "—"}</div></div>
          <div className="ana-row"><div className="ana-label">Ruolo</div><div className="ana-value">{detailRec.ruolo || "—"}</div></div>
          <div className="ana-row"><div className="ana-label">Azione</div><div className="ana-value">{detailRec.azione}</div></div>
          <div className="ana-row"><div className="ana-label">Risorsa</div><div className="ana-value">{detailRec.risorsa}</div></div>
          <div className="ana-row"><div className="ana-label">Dettaglio</div><div className="ana-value">{detailRec.dettaglio || "—"}</div></div>
          <div className="ana-row"><div className="ana-label">IP</div><div className="ana-value" style={{ fontFamily: "monospace", fontSize: 12 }}>{detailRec.ip || "—"}</div></div>
        </div>
        <div className="ana-card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-light)", textTransform: "uppercase", marginBottom: 8 }}>Catena hash</div>
          <div style={{ fontSize: 11, color: "var(--text-light)", marginBottom: 4 }}>Hash precedente</div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-mid)", wordBreak: "break-all", background: "#F5F5F5", padding: "6px 8px", borderRadius: 6, marginBottom: 8 }}>{detailRec.hashPrecedente}</div>
          <div style={{ fontSize: 11, color: "var(--text-light)", marginBottom: 4 }}>Hash questo record</div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--teal-dark)", wordBreak: "break-all", background: "#E0F7F7", padding: "6px 8px", borderRadius: 6 }}>{detailRec.hashRecord}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-label"><div className="section-title">Audit Log</div></div>

      {/* Verifica integrità */}
      <div className="ana-card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-dark)", marginBottom: 8 }}>🔐 Verifica integrità catena</div>
        <button className="ts-save" disabled={verificando} onClick={eseguiVerifica}>
          {verificando ? "Verifica in corso..." : "▶ Verifica ora"}
        </button>
        {verifica && (
          <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: verifica.integro ? "#D5F0E0" : "#FCE4E4", color: verifica.integro ? "#1A6B3A" : "#7A1A1A", fontWeight: 700, fontSize: 13 }}>
            {verifica.integro
              ? `✅ Integrità confermata — ${verifica.totaleRecord} record verificati, nessuna alterazione rilevata`
              : `❌ Anomalia rilevata al record #${verifica.rotturaAlRecord}: ${verifica.descrizioneRottura}`}
          </div>
        )}
      </div>

      {/* Filtri */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <input className="dim-in" style={{ flex: 1, minWidth: 120 }} placeholder="Filtra per utente..." value={filtroUtente} onChange={e => setFiltroUtente(e.target.value)} />
        <select className="dim-in" style={{ flex: 1, minWidth: 120 }} value={filtroAzione} onChange={e => setFiltroAzione(e.target.value)}>
          <option value="">Tutte le azioni</option>
          {["LOGIN","LOGOUT","AUTH_FAIL","CREATE","READ","UPDATE","DELETE"].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="gpt-refresh" onClick={() => exportCSV(records)} disabled={records.length === 0}>⬇ CSV</button>
      </div>

      {loading && records.length === 0 ? (
        <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)" }}>Caricamento...</div>
      ) : records.length === 0 ? (
        <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessun record trovato</div>
      ) : (
        <>
          <div className="table-card">
            {records.map((r, i) => {
              const ac = AZIONE_COLORS[r.azione] || { bg: "#EEE", col: "#555" };
              return (
                <div className="table-row" key={i} style={{ cursor: "pointer", alignItems: "flex-start" }} onClick={() => setDetailRec(r)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row-title">{r.descrizione}</div>
                    <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>
                      {fmtTs(r.timestamp)}{r.ip ? ` · ${r.ip}` : ""}
                    </div>
                  </div>
                  <div style={{ padding: "2px 9px", borderRadius: 10, fontSize: 10, fontWeight: 800, background: ac.bg, color: ac.col, whiteSpace: "nowrap", flexShrink: 0, marginLeft: 8 }}>{r.azione}</div>
                </div>
              );
            })}
          </div>
          {hasMore && (
            <button className="update-btn" onClick={() => load(false)} disabled={loading}>
              {loading ? "Caricamento..." : "Carica altri"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
