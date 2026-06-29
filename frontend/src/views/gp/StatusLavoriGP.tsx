import { useState, useEffect, useCallback } from "react";
import { StatusLavoriApi } from "../../services/StatusLavoriApi.js";
import type { StatusLavoro, StatoAvanzamento } from "../../services/StatusLavoriApi.js";

const COLONNE: { stato: StatoAvanzamento; label: string; bg: string }[] = [
  { stato: "Non iniziato", label: "Non iniziato", bg: "#FCE4E4" },
  { stato: "In lavorazione", label: "In lavorazione", bg: "#FEF3CD" },
  { stato: "Risolto", label: "Risolto", bg: "#D5F0E0" }
];

function urgenzaColor(u: string): { bg: string; col: string } {
  if (u === "Urgente") return { bg: "#FCE4E4", col: "#7A1A1A" };
  if (u === "Alta") return { bg: "#FFE3D1", col: "#8A4B1F" };
  if (u === "Media") return { bg: "#FEF3CD", col: "#7A5800" };
  if (u === "Bassa") return { bg: "#E0F7F7", col: "#1A6B6B" };
  return { bg: "#EEE", col: "#777" };
}
function fmtDateIt(d: string | null) {
  if (!d) return null;
  const parts = d.split("T")[0].split("-");
  if (parts.length < 3) return null;
  const [y, m, dd] = parts;
  return `${dd}/${m}/${y}`;
}

export default function StatusLavoriGP() {
  const [items, setItems] = useState<StatusLavoro[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroUrgenza, setFiltroUrgenza] = useState<string>("tutte");
  const [detail, setDetail] = useState<StatusLavoro | null>(null);
  const [busy, setBusy] = useState(false);
  const [nuovaNota, setNuovaNota] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    StatusLavoriApi.list().then(r => { setItems(Array.isArray(r) ? r : []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function spostaStato(item: StatusLavoro, nuovoStato: StatoAvanzamento) {
    if (item.stato === nuovoStato) return;
    setBusy(true);
    try {
      await StatusLavoriApi.setStato(item.pageId, nuovoStato);
      setItems(prev => prev.map(x => x.pageId === item.pageId ? { ...x, stato: nuovoStato } : x));
      if (detail?.pageId === item.pageId) setDetail({ ...detail, stato: nuovoStato });
    } catch (err: any) {
      alert(err?.message || "Errore nell'aggiornamento. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  async function salvaNota() {
    if (!detail || !nuovaNota.trim()) return;
    setBusy(true);
    try {
      await StatusLavoriApi.aggiungiNota(detail.pageId, detail.noteSoluzioni, nuovaNota.trim());
      const aggiornato = detail.noteSoluzioni ? `${detail.noteSoluzioni}\n[oggi] ${nuovaNota.trim()}` : `[oggi] ${nuovaNota.trim()}`;
      setDetail({ ...detail, noteSoluzioni: aggiornato });
      setItems(prev => prev.map(x => x.pageId === detail.pageId ? { ...x, noteSoluzioni: aggiornato } : x));
      setNuovaNota("");
      setTimeout(load, 800); // risincronizza con il timestamp vero scritto dal backend
    } catch (err: any) {
      alert(err?.message || "Errore nel salvataggio. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  const filtrati = filtroUrgenza === "tutte" ? items : items.filter(i => i.urgenza === filtroUrgenza);

  if (detail) {
    const uc = urgenzaColor(detail.urgenza);
    return (
      <div>
        <button onClick={() => { setDetail(null); setNuovaNota(""); }} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 800, color: "var(--teal)", cursor: "pointer", fontFamily: "Satoshi,sans-serif", marginBottom: "0.5rem" }}>← Indietro</button>

        <div style={{ background: "var(--teal-dark)", borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>{detail.categoria || "—"}</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: "white", marginTop: 4 }}>Punto {detail.puntoCheckList}</div>
          {detail.urgenza && <div style={{ display: "inline-block", marginTop: 8, padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 800, background: uc.bg, color: uc.col }}>{detail.urgenza}</div>}
        </div>

        <div className="ana-card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-light)", textTransform: "uppercase", marginBottom: 4 }}>Intervento da effettuare</div>
          <div style={{ fontSize: 14, color: "var(--text-mid)", whiteSpace: "pre-wrap" }}>{detail.intervento || "—"}</div>
        </div>

        {detail.place && (
          <div className="ana-card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-light)", textTransform: "uppercase", marginBottom: 4 }}>Luogo / riferimento</div>
            <div style={{ fontSize: 13, color: "var(--text-mid)" }}>{detail.place}</div>
          </div>
        )}

        <div className="ana-card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-light)", textTransform: "uppercase", marginBottom: 6 }}>Stato</div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {COLONNE.map(c => (
              <button key={c.stato} disabled={busy} onClick={() => spostaStato(detail, c.stato)} className={`com-pill${detail.stato === c.stato ? " on" : ""}`}>{c.label}</button>
            ))}
          </div>
        </div>

        <div className="ana-card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-light)", textTransform: "uppercase", marginBottom: 6 }}>Note e soluzioni — log avanzamento</div>
          {detail.noteSoluzioni ? (
            <div style={{ fontSize: 13, color: "var(--text-mid)", whiteSpace: "pre-wrap", marginBottom: "0.75rem", lineHeight: 1.5 }}>{detail.noteSoluzioni}</div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-light)", marginBottom: "0.75rem" }}>Nessuna nota ancora.</div>
          )}
          <label className="dim-lbl">Aggiungi un aggiornamento</label>
          <textarea className="dim-in" rows={3} placeholder="Descrivi il progresso fatto..." value={nuovaNota} onChange={e => setNuovaNota(e.target.value)} />
          <button className="ts-save" style={{ marginTop: "0.5rem" }} disabled={busy || !nuovaNota.trim()} onClick={salvaNota}>{busy ? "Salvataggio..." : "💾 Aggiungi nota"}</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-label"><div className="section-title">Status lavori privacy</div></div>
      <div className="gpt-toolbar">
        {(["tutte", "Urgente", "Alta", "Media", "Bassa"] as const).map(u => (
          <button key={u} onClick={() => setFiltroUrgenza(u)} className={`com-pill${filtroUrgenza === u ? " on" : ""}`}>{u === "tutte" ? "Tutte" : u}</button>
        ))}
        <button className="gpt-refresh" onClick={load} disabled={loading}>{loading ? "⏳" : "🔄"} Aggiorna</button>
      </div>

      {loading ? (
        <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)" }}>Caricamento...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {COLONNE.map(col => {
            const lista = filtrati.filter(i => i.stato === col.stato);
            return (
              <div key={col.stato}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.5rem" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.bg, border: "1.5px solid rgba(0,0,0,0.1)" }}></div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-dark)" }}>{col.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 700 }}>({lista.length})</div>
                </div>
                {lista.length === 0 ? (
                  <div className="ana-card" style={{ padding: "0.85rem 1rem", textAlign: "center", color: "var(--text-light)", fontSize: 12 }}>Nessun elemento</div>
                ) : (
                  <div className="ana-card">
                    {lista.map((item, i) => {
                      const uc = urgenzaColor(item.urgenza);
                      const data = fmtDateIt(item.data);
                      return (
                        <div key={i} className="table-row" style={{ cursor: "pointer", alignItems: "flex-start" }} onClick={() => setDetail(item)}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="row-title">Punto {item.puntoCheckList}{item.categoria ? ` · ${item.categoria}` : ""}</div>
                            <div style={{ fontSize: 12, color: "var(--text-mid)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.intervento}</div>
                            {data && <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 2 }}>{data}</div>}
                          </div>
                          {item.urgenza && <div style={{ padding: "2px 9px", borderRadius: 10, fontSize: 10, fontWeight: 800, background: uc.bg, color: uc.col, whiteSpace: "nowrap", flexShrink: 0, marginLeft: 8 }}>{item.urgenza}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
