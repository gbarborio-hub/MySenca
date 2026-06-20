import { useState, useEffect, useCallback } from "react";
import { ProxyApi } from "../services/ProxyApi.js";
import { DipendentiApi } from "../services/DipendentiApi.js";
import RoleSwitchMini from "../components/RoleSwitchMini.js";
import Logo from "../components/Logo.js";
import { NavIcons } from "../components/NavIcons.js";

type GPView = "home" | "dipendenti" | "turni" | "timbrature" | "comunicazioni" | "ferie" | "strutture" | "buste";

interface Props {
  nome: string;
  username: string;
  showRoleSwitch: boolean;
  onShowRoleChooser: () => void;
  onLogout: () => void;
}

function fmtDateIt(d: string) {
  if (!d) return "—";
  const datePart = d.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length < 3) return "—";
  const [y, m, dd] = parts;
  return `${dd}/${m}/${y}`;
}

export default function GestionePersonaleView({ nome, username, showRoleSwitch, onShowRoleChooser, onLogout }: Props) {
  const [view, setView] = useState<GPView>("home");
  const [dipendenti, setDipendenti] = useState<any[]>([]);
  const [dipDetail, setDipDetail] = useState<any>(null);
  const [dipSearch, setDipSearch] = useState("");
  const [timbrature, setTimbrature] = useState<any[]>([]);
  const [timbratureFilter, setTimbratureFilter] = useState("tutti");
  const [ferie, setFerie] = useState<any[]>([]);
  const [comunicazioni, setComunicazioni] = useState<any[]>([]);
  const [strutture, setStrutture] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Comunicazioni form
  const [comTitolo, setComTitolo] = useState("");
  const [comMessaggio, setComMessaggio] = useState("");
  const [comTipo, setComTipo] = useState("Tutti");
  const [comSending, setComSending] = useState(false);
  const [comMsg, setComMsg] = useState<string | null>(null);

  const firstName = (nome || "").split(" ")[0] || "utente";

  const fetchDip = useCallback(async () => {
    setLoading(true);
    const r = await DipendentiApi.list();
    setDipendenti(Array.isArray(r) ? r : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDip(); }, [fetchDip]);

  async function goView(v: GPView) {
    setView(v);
    setDipDetail(null);
    if (v === "timbrature") {
      const r = await ProxyApi.gpTimbrature();
      setTimbrature(Array.isArray(r) ? r : []);
    } else if (v === "ferie") {
      const r = await ProxyApi.gpFerie();
      setFerie(Array.isArray(r) ? r : []);
    } else if (v === "comunicazioni") {
      const r = await ProxyApi.comunicazioniLista();
      setComunicazioni(Array.isArray(r) ? r : []);
    } else if (v === "strutture") {
      const r = await ProxyApi.gpStrutture();
      setStrutture(Array.isArray(r) ? r : []);
    }
  }

  async function approvaFeria(pageId: string, stato: "Approvata" | "Rifiutata") {
    await ProxyApi.gpFerie({ pageId, stato });
    const r = await ProxyApi.gpFerie();
    setFerie(Array.isArray(r) ? r : []);
  }

  async function inviaComunicazione() {
    if (!comTitolo.trim()) { setComMsg("⚠️ Inserisci un titolo."); return; }
    setComSending(true);
    setComMsg("⏳ Invio in corso...");
    await ProxyApi.comunicazioneCrea({ titolo: comTitolo, messaggio: comMessaggio, mittente: username, tipoDestinatari: comTipo });
    setComSending(false);
    setComMsg("✅ Comunicazione inviata.");
    setComTitolo(""); setComMessaggio("");
    const r = await ProxyApi.comunicazioniLista();
    setComunicazioni(Array.isArray(r) ? r : []);
  }

  const filteredDip = dipSearch
    ? dipendenti.filter(d => `${d.nome} ${d.cognome} ${d.username || ""} ${d.mansione || ""} ${d.struttura || ""}`.toLowerCase().includes(dipSearch.toLowerCase()))
    : dipendenti;

  const navItems: { id: GPView; label: string; icon: keyof typeof NavIcons }[] = [
    { id: "home", label: "Home", icon: "home" },
    { id: "dipendenti", label: "Dipendenti", icon: "dipendenti" },
    { id: "timbrature", label: "Timbrature", icon: "timbra" },
    { id: "ferie", label: "Ferie/ROL", icon: "ferie" },
    { id: "comunicazioni", label: "Avvisi", icon: "comunicazioni" },
  ];

  return (
    <div className="app-screen gp-screen">
      <div className="gp-main">
        <div className="app-header">
          <div className="app-greeting">Buongiorno,<br />{firstName}</div>
          <div className="app-logo"><Logo /></div>
        </div>
        <div className="app-content">
          <RoleSwitchMini visible={showRoleSwitch} onClick={onShowRoleChooser} />

          {view === "home" && (
            <div>
              <div className="timbra-card-big" style={{ background: "var(--teal-dark)", minHeight: 120, cursor: "pointer" }} onClick={() => goView("dipendenti")}>
                <div className="timbra-card-big-orb"></div>
                <div className="timbra-card-big-title" style={{ fontSize: 30 }}>👥 Dipendenti</div>
                <div className="timbra-card-big-sub">Fascicoli · Anagrafiche · Documenti</div>
              </div>
              <div className="dip-half-cards">
                {([
                  { v: "timbrature", label: "Verifica", value: "Timbrature", bg: "var(--cyan)" },
                  { v: "ferie", label: "Approva", value: "Ferie / ROL", bg: "var(--teal)" },
                  { v: "turni", label: "Pianifica", value: "Turni", bg: "var(--coral)" },
                  { v: "comunicazioni", label: "Invia", value: "Avvisi", bg: "var(--teal-dark)" },
                  { v: "buste", label: "Carica", value: "Buste paga", bg: "var(--cyan)" },
                  { v: "strutture", label: "Gestisci", value: "Strutture", bg: "var(--teal)" },
                ] as any[]).map(c => (
                  <div key={c.v} className="dip-half-card" style={{ background: c.bg, minHeight: 110, cursor: "pointer" }} onClick={() => goView(c.v as GPView)}>
                    <div className="dip-half-orb"></div>
                    <div className="dip-half-label">{c.label}</div>
                    <div className="dip-half-value" style={{ fontSize: 22 }}>{c.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === "dipendenti" && !dipDetail && (
            <div>
              <div className="section-label"><div className="section-title">Dipendenti</div></div>
              <input className="dim-in" type="search" placeholder="🔎 Cerca per nome, cognome, struttura..." value={dipSearch} onChange={e => setDipSearch(e.target.value)} style={{ marginBottom: "0.75rem" }} />
              {loading
                ? <div className="timbra-card" style={{ textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Caricamento...</div>
                : <div className="table-card">
                  {filteredDip.map((d: any) => (
                    <div className="table-row" key={d.pageId} style={{ cursor: "pointer" }} onClick={() => setDipDetail(d)}>
                      <div style={{ flex: 1 }}>
                        <div className="row-title">{d.nome} {d.cognome}</div>
                        <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>{d.mansione} · {d.struttura}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-light)" }}>›</div>
                    </div>
                  ))}
                </div>
              }
              <button className="update-btn" onClick={fetchDip}>Aggiorna</button>
            </div>
          )}

          {view === "dipendenti" && dipDetail && (
            <div>
              <button className="update-btn" style={{ marginBottom: "0.5rem" }} onClick={() => setDipDetail(null)}>← Torna alla lista</button>
              <div className="section-label"><div className="section-title">{dipDetail.nome} {dipDetail.cognome}</div></div>
              <div className="ana-card">
                {[["Mansione", dipDetail.mansione], ["Struttura", dipDetail.struttura], ["Email", dipDetail.email], ["Username", dipDetail.username || "Non assegnato"]].map(([k, v]) => (
                  <div className="ana-row" key={k as string}>
                    <div className="ana-label">{k}</div>
                    <div className="ana-value">{v || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === "timbrature" && (
            <div>
              <div className="section-label"><div className="section-title">Timbrature</div></div>
              <div className="nav-tabs" style={{ marginBottom: "0.75rem" }}>
                {["tutti", "approvazione", "fuori turno"].map(f => (
                  <div key={f} className={`nav-tab ${timbratureFilter === f ? "active" : "inactive"}`} onClick={() => setTimbratureFilter(f)}>{f === "tutti" ? "Tutte" : f === "approvazione" ? "Da approvare" : "Fuori turno"}</div>
                ))}
              </div>
              {timbrature
                .filter((t: any) => timbratureFilter === "tutti" || (timbratureFilter === "approvazione" && t.approvazione === "Necessaria approvazione") || (timbratureFilter === "fuori turno" && t.stato === "Fuori turno"))
                .map((t: any, i: number) => (
                <div className="ana-card" key={i} style={{ marginBottom: "0.5rem", padding: "0.9rem 1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-dark)" }}>{t.nome}</div>
                      <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 600 }}>{fmtDateIt(t.data)} · {t.struttura}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--teal)" }}>🕐 {t.oraEntrata || "—"} → {t.oraUscita || "—"} · {t.oreTotali ? `${Number(t.oreTotali).toFixed(2)}h` : "—"}</div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 12, background: t.approvazione === "Necessaria approvazione" ? "#FEF3CD" : "#E3F6E9", color: t.approvazione === "Necessaria approvazione" ? "#7A5800" : "#1A5C33" }}>
                      {t.approvazione === "Necessaria approvazione" ? "⏳ Da approvare" : "✅ Approvata"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === "ferie" && (
            <div>
              <div className="section-label"><div className="section-title">Richieste ferie / ROL</div></div>
              {ferie.length === 0
                ? <div className="timbra-card" style={{ textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessuna richiesta pendente</div>
                : ferie.map((r: any, i: number) => (
                  <div className="ana-card" key={i} style={{ marginBottom: "0.6rem", padding: "0.9rem 1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-dark)" }}>{r.nome}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--teal)" }}>{r.tipo} · {r.oreRichieste}h</div>
                        <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 600 }}>{fmtDateIt(r.dataInizio)}{r.dataFine && r.dataFine !== r.dataInizio ? ` → ${fmtDateIt(r.dataFine)}` : ""}</div>
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 12, background: r.stato === "Approvata" ? "#E3F6E9" : r.stato === "Rifiutata" ? "#FCE4E4" : "#FEF3CD", color: r.stato === "Approvata" ? "#1A5C33" : r.stato === "Rifiutata" ? "#7A1A1A" : "#7A5800" }}>{r.stato}</div>
                    </div>
                    {r.stato === "In attesa" && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={{ flex: 1, background: "var(--teal)", color: "white", border: "none", borderRadius: 20, padding: "0.5rem", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Satoshi,sans-serif" }} onClick={() => approvaFeria(r.pageId, "Approvata")}>✅ Approva</button>
                        <button style={{ flex: 1, background: "var(--coral)", color: "white", border: "none", borderRadius: 20, padding: "0.5rem", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Satoshi,sans-serif" }} onClick={() => approvaFeria(r.pageId, "Rifiutata")}>❌ Rifiuta</button>
                      </div>
                    )}
                  </div>
                ))
              }
              <button className="update-btn" onClick={async () => { const r = await ProxyApi.gpFerie(); setFerie(Array.isArray(r) ? r : []); }}>Aggiorna</button>
            </div>
          )}

          {view === "comunicazioni" && (
            <div>
              <div className="section-label"><div className="section-title">Nuova comunicazione</div></div>
              <div className="ana-card" style={{ padding: "1rem" }}>
                <label className="dim-lbl">Titolo</label>
                <input className="dim-in" placeholder="Oggetto" value={comTitolo} onChange={e => setComTitolo(e.target.value)} />
                <label className="dim-lbl">Messaggio</label>
                <textarea className="dim-in" rows={4} placeholder="Testo della comunicazione" value={comMessaggio} onChange={e => setComMessaggio(e.target.value)} style={{ resize: "vertical" }} />
                <label className="dim-lbl">Destinatari</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {["Tutti", "Mirata", "Singoli"].map(t => (
                    <button key={t} className={`com-pill${comTipo === t ? " on" : ""}`} onClick={() => setComTipo(t)}>{t}</button>
                  ))}
                </div>
                {comMsg && <div style={{ marginBottom: "0.5rem", padding: "0.6rem", borderRadius: 10, background: comMsg.startsWith("✅") ? "#E3F6E9" : "#FEF3CD", color: comMsg.startsWith("✅") ? "#1A5C33" : "#7A5800", fontSize: 13, fontWeight: 700 }}>{comMsg}</div>}
                <button className="update-btn" style={{ background: "var(--teal)" }} disabled={comSending} onClick={inviaComunicazione}>📢 Invia comunicazione</button>
              </div>
              <div className="section-label" style={{ marginTop: "1rem" }}><div className="section-title">Comunicazioni inviate</div></div>
              {comunicazioni.length === 0
                ? <div className="timbra-card" style={{ textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessuna comunicazione inviata</div>
                : comunicazioni.map((c: any, i: number) => (
                  <div className="ana-card" key={i} style={{ marginBottom: "0.5rem", padding: "0.9rem 1rem" }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "var(--text-dark)" }}>{c.titolo}</div>
                    <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 600 }}>{fmtDateIt(c.data)} · {c.letture || 0} letture</div>
                  </div>
                ))
              }
            </div>
          )}

          {view === "strutture" && (
            <div>
              <div className="section-label"><div className="section-title">Strutture</div></div>
              {strutture.map((s: any, i: number) => (
                <div className="ana-card" key={i} style={{ marginBottom: "0.5rem", padding: "0.9rem 1rem" }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-dark)" }}>{s.nome}</div>
                  <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 600 }}>{s.indirizzo || ""}</div>
                  <div style={{ fontSize: 12, color: "var(--teal)", fontWeight: 700 }}>Raggio: {s.raggio || "—"}m</div>
                </div>
              ))}
            </div>
          )}

          {view === "turni" && (
            <div className="timbra-card" style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-light)", fontWeight: 700 }}>
              Griglia turni — in arrivo nella prossima versione.
            </div>
          )}

          {view === "buste" && (
            <div className="timbra-card" style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-light)", fontWeight: 700 }}>
              Buste paga — in arrivo nella prossima versione.
            </div>
          )}
        </div>
      </div>

      <div className="bottom-nav">
        {navItems.map(n => (
          <div key={n.id} className={`bnav-item ${view === n.id ? "active" : ""}`} onClick={() => goView(n.id)}>
            <div className="bnav-icon">{NavIcons[n.icon]}</div>
            <div className="bnav-label">{n.label}</div>
          </div>
        ))}
        <div className="bnav-item" onClick={onLogout}><div className="bnav-icon">{NavIcons.logout}</div><div className="bnav-label">Esci</div></div>
      </div>
    </div>
  );
}
