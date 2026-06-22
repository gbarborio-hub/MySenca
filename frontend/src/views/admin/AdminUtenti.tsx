import { useMemo, useState } from "react";
import type { UtenteWebApp, Ruolo } from "../../models/domain.js";
import { RUOLI_CON_INTERFACCIA } from "../../models/domain.js";
import { UtentiApi } from "../../services/UtentiApi.js";

interface Props {
  utenti: UtenteWebApp[];
  loading: boolean;
  onRefresh: () => void;
}

export default function AdminUtenti({ utenti, loading, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return utenti;
    return utenti.filter(u => `${u.username} ${u.email}`.toLowerCase().includes(q));
  }, [utenti, search]);

  async function riattiva(u: UtenteWebApp) {
    if (!confirm(`Riattivare l'accesso per "${u.username}"? Il blocco e i tentativi falliti verranno azzerati.`)) return;
    setBusyId(u.pageId);
    try {
      await UtentiApi.riattiva(u.pageId);
      onRefresh();
    } catch (err: any) {
      alert(err?.message || "Errore nell'operazione. Riprova.");
    } finally {
      setBusyId(null);
    }
  }
  async function elimina(u: UtenteWebApp) {
    if (!confirm(`Eliminare l'accesso alla web app per "${u.username}"? Il dipendente resterà nell'anagrafica, ma non potrà più accedere finché non gli crei una nuova utenza.`)) return;
    setBusyId(u.pageId);
    try {
      await UtentiApi.elimina(u.pageId, u.username);
      onRefresh();
    } catch (err: any) {
      alert(err?.message || "Errore nell'operazione. Riprova.");
    } finally {
      setBusyId(null);
    }
  }
  async function cambiaRuolo(u: UtenteWebApp, nuovoRuolo: Ruolo) {
    setBusyId(u.pageId);
    try {
      await UtentiApi.aggiornaRuoli(u.pageId, nuovoRuolo);
      onRefresh();
    } catch (err: any) {
      alert(err?.message || "Errore nell'operazione. Riprova.");
    } finally {
      setBusyId(null);
    }
  }
  async function toggleRuoloAgg(u: UtenteWebApp, r: Ruolo) {
    const lista = u.ruoliAggiuntivi.includes(r) ? u.ruoliAggiuntivi.filter(x => x !== r) : [...u.ruoliAggiuntivi, r];
    setBusyId(u.pageId);
    try {
      await UtentiApi.aggiornaRuoli(u.pageId, undefined, lista);
      onRefresh();
    } catch (err: any) {
      alert(err?.message || "Errore nell'operazione. Riprova.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "30vh" }}>
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-label"><div className="section-title">Utenti web app</div></div>
      <input
        className="dim-in" type="search" placeholder="🔎 Cerca per username o email..."
        value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: "0.75rem" }}
      />
      {search && <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 700, marginBottom: "0.5rem" }}>{filtered.length} risultat{filtered.length === 1 ? "o" : "i"}</div>}
      {filtered.length === 0 ? (
        <div className="timbra-card" style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-light)", fontWeight: 700 }}>Nessuna utenza trovata.</div>
      ) : filtered.map(u => {
        const busy = busyId === u.pageId;
        return (
          <div className="ana-card" style={{ padding: "0.9rem 1rem", marginBottom: "0.6rem" }} key={u.pageId}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-dark)" }}>{u.username}</div>
                <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>{u.email || "—"}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                <div style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 12, background: u.attivo ? "#E3F6E9" : "#FCE4E4", color: u.attivo ? "#1A5C33" : "#7A1A1A" }}>
                  {u.attivo ? "Attivo" : "Disattivo"}
                </div>
                {u.bloccato && <div style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 12, background: "#FCE4E4", color: "#7A1A1A" }}>🔒 Bloccato</div>}
              </div>
            </div>

            {u.bloccato && (
              <>
                <div style={{ fontSize: 12, color: "#7A1A1A", fontWeight: 700, margin: "6px 0", background: "#FCE4E4", borderRadius: 10, padding: "0.6rem 0.8rem" }}>
                  Bloccato per troppi tentativi di accesso falliti.
                </div>
                <button
                  style={{ width: "100%", background: "var(--teal)", color: "white", border: "none", borderRadius: 20, padding: "0.6rem", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Satoshi,sans-serif", marginBottom: 8 }}
                  disabled={busy} onClick={() => riattiva(u)}
                >
                  {busy ? "Attendere..." : "🔓 Riattiva utenza"}
                </button>
              </>
            )}

            <label className="dim-lbl">Ruolo</label>
            <select className="dim-in" disabled={busy} value={u.ruolo} onChange={e => cambiaRuolo(u, e.target.value as Ruolo)}>
              {RUOLI_CON_INTERFACCIA.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <label className="dim-lbl">Altri ruoli (interfacce aggiuntive)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 8px" }}>
              {RUOLI_CON_INTERFACCIA.filter(r => r !== u.ruolo).map(r => (
                <button key={r} className={`com-pill${u.ruoliAggiuntivi.includes(r) ? " on" : ""}`} disabled={busy} onClick={() => toggleRuoloAgg(u, r)}>{r}</button>
              ))}
            </div>
            <button
              style={{ width: "100%", background: "var(--coral)", color: "white", border: "none", borderRadius: 20, padding: "0.6rem", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Satoshi,sans-serif" }}
              disabled={busy} onClick={() => elimina(u)}
            >
              {busy ? "Attendere..." : "🗑 Elimina utenza"}
            </button>
          </div>
        );
      })}
      <button className="update-btn" onClick={onRefresh}>Aggiorna</button>
    </div>
  );
}
