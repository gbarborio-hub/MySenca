import { useState } from "react";
import { TicketApi } from "../../services/TicketApi.js";
import type { Ticket } from "../../services/TicketApi.js";

function fmtDateIt(d: string | null) {
  if (!d) return "—";
  const datePart = d.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length < 3) return "—";
  const [y, m, dd] = parts;
  return `${dd}/${m}/${y}`;
}

const CAT_ICON: Record<string, string> = { Bug: "🐛", Problema: "⚠️", Suggerimento: "💡" };

interface Props {
  ticket: Ticket[];
  loading: boolean;
  onRefresh: () => void;
}

export default function AdminTicket({ ticket, loading, onRefresh }: Props) {
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);
  const [filtro, setFiltro] = useState<"tutti" | "Nuovo" | "In lavorazione" | "Risolto">("tutti");

  async function setStato(t: Ticket, stato: "Nuovo" | "In lavorazione" | "Risolto") {
    setBusy(true);
    await TicketApi.updateStato(t.pageId, stato);
    setBusy(false);
    setDetail({ ...t, stato });
    onRefresh();
  }

  const filtrati = filtro === "tutti" ? ticket : ticket.filter(t => t.stato === filtro);
  const nNuovi = ticket.filter(t => t.stato === "Nuovo").length;

  if (detail) {
    const statoBg = detail.stato === "Nuovo" ? "#FCE4E4" : detail.stato === "In lavorazione" ? "#FEF3CD" : "#D5F0E0";
    const statoCol = detail.stato === "Nuovo" ? "#7A1A1A" : detail.stato === "In lavorazione" ? "#7A5800" : "#1A6B3A";
    return (
      <div>
        <button onClick={() => setDetail(null)} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 800, color: "var(--teal)", cursor: "pointer", fontFamily: "Satoshi,sans-serif", marginBottom: "0.5rem" }}>← Indietro</button>
        <div style={{ background: "var(--teal-dark)", borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>{CAT_ICON[detail.categoria] || "📋"} {detail.categoria}</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: "white", marginTop: 4 }}>{detail.titolo}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>{detail.nome || detail.username} {detail.ruolo ? `· ${detail.ruolo}` : ""} · {fmtDateIt(detail.data)}</div>
        </div>
        <div className="ana-card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-light)", textTransform: "uppercase", marginBottom: 4 }}>Descrizione</div>
          <div style={{ fontSize: 14, color: "var(--text-mid)", whiteSpace: "pre-wrap" }}>{detail.descrizione || "—"}</div>
        </div>
        <div className="ana-card" style={{ padding: "1rem" }}>
          <div style={{ display: "inline-block", marginBottom: "0.7rem", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 800, background: statoBg, color: statoCol }}>{detail.stato}</div>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            {(["Nuovo", "In lavorazione", "Risolto"] as const).map(st => (
              <button key={st} disabled={busy} onClick={() => setStato(detail, st)} className={`com-pill${detail.stato === st ? " on" : ""}`}>{st}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-label"><div className="section-title">Ticket app{nNuovi > 0 ? ` (${nNuovi} nuovi)` : ""}</div></div>
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        {(["tutti", "Nuovo", "In lavorazione", "Risolto"] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} className={`com-pill${filtro === f ? " on" : ""}`}>{f === "tutti" ? "Tutti" : f}</button>
        ))}
      </div>
      {loading ? (
        <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)" }}>Caricamento...</div>
      ) : filtrati.length === 0 ? (
        <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessun ticket</div>
      ) : (
        <div className="table-card">
          {filtrati.map((t, i) => {
            const statoBg = t.stato === "Nuovo" ? "#FCE4E4" : t.stato === "In lavorazione" ? "#FEF3CD" : "#D5F0E0";
            const statoCol = t.stato === "Nuovo" ? "#7A1A1A" : t.stato === "In lavorazione" ? "#7A5800" : "#1A6B3A";
            return (
              <div className="table-row" key={i} style={{ cursor: "pointer" }} onClick={() => setDetail(t)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-title">{CAT_ICON[t.categoria] || "📋"} {t.titolo}</div>
                  <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>{t.nome || t.username} · {fmtDateIt(t.data)}</div>
                </div>
                <div style={{ padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 800, background: statoBg, color: statoCol, whiteSpace: "nowrap", flexShrink: 0 }}>{t.stato}</div>
              </div>
            );
          })}
        </div>
      )}
      <button className="update-btn" onClick={onRefresh}>Aggiorna</button>
    </div>
  );
}
