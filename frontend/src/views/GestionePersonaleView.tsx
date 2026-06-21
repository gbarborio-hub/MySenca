import { useState, useEffect, useCallback } from "react";
import { ProxyApi } from "../services/ProxyApi.js";
import { DipendentiApi } from "../services/DipendentiApi.js";
import RoleSwitchMini from "../components/RoleSwitchMini.js";
import Logo from "../components/Logo.js";
import { NavIcons } from "../components/NavIcons.js";
import GriglieTurniGP from "./gp/GriglieTurniGP.js";
import ComunicazioniGP from "./gp/ComunicazioniGP.js";
import AnagraficaFormGP, { nuovoForm, formDaDipendente, type AnagFormData } from "./gp/AnagraficaFormGP.js";
import BustePagaGP from "./gp/BustePagaGP.js";
import ExportPdfGP from "./gp/ExportPdfGP.js";
import StruttureGP from "./gp/StruttureGP.js";
import TimesheetGP from "./gp/TimesheetGP.js";
import DocumentiDipendenteGP from "./gp/DocumentiDipendenteGP.js";

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

// n8n restituisce "id" come campo grezzo per le richieste ferie, non "pageId":
// normalizziamo qui per evitare di mandare pageId=undefined nelle azioni approva/rifiuta.
function parseFerie(raw: unknown): any[] {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map((item: any) => ({ ...item, pageId: item.pageId || item.id || "" }));
}
// Stesso problema per la lista timbrature GP: normalizziamo id->pageId.
function parseTimbratureList(raw: unknown): any[] {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map((item: any) => ({ ...item, pageId: item.pageId || item.id || "", nome: item.nome || item.dipendente || "" }));
}

export default function GestionePersonaleView({ nome, username, showRoleSwitch, onShowRoleChooser, onLogout }: Props) {
  const [view, setView] = useState<GPView>("home");
  const [dipendenti, setDipendenti] = useState<any[]>([]);
  const [dipDetail, setDipDetail] = useState<any>(null);
  const [dipForm, setDipForm] = useState<AnagFormData | null>(null);
  const [dipSearch, setDipSearch] = useState("");
  const [timbrature, setTimbrature] = useState<any[]>([]);
  const [gpTimbBusy, setGpTimbBusy] = useState<string | null>(null);
  const [gpFerieBusy, setGpFerieBusy] = useState<string | null>(null);
  const [ferie, setFerie] = useState<any[]>([]);
  const [strutture, setStrutture] = useState<any[]>([]);
  const [strutLoading, setStrutLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const firstName = (nome || "").split(" ")[0] || "utente";

  const fetchDip = useCallback(async () => {
    setLoading(true);
    const r = await DipendentiApi.list();
    setDipendenti(Array.isArray(r) ? r : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDip(); }, [fetchDip]);

  async function refreshStrutture() {
    setStrutLoading(true);
    const r = await ProxyApi.gpStrutture();
    setStrutture(Array.isArray(r) ? r : []);
    setStrutLoading(false);
  }

  async function goView(v: GPView) {
    setView(v);
    setDipDetail(null);
    setDipForm(null);
    if (v === "timbrature") {
      const r = await ProxyApi.gpTimbrature({ struttura: "" });
      setTimbrature(parseTimbratureList(r));
    } else if (v === "ferie") {
      const r = await ProxyApi.gpFerie({ struttura: "" });
      setFerie(parseFerie(r));
    } else if (v === "strutture") {
      refreshStrutture();
    } else if ((v === "turni" || v === "comunicazioni" || v === "dipendenti") && strutture.length === 0) {
      const r = await ProxyApi.strutture();
      setStrutture(Array.isArray(r) ? r : []);
    }
  }

  async function approvaFeria(pageId: string, stato: "Approvata" | "Rifiutata") {
    if (gpFerieBusy) return;
    setGpFerieBusy(pageId);
    try {
      await ProxyApi.ferieUpdate({ action: stato === "Approvata" ? "approva" : "rifiuta", pageId });
      setGpFerieBusy(null);
      setTimeout(async () => { const r = await ProxyApi.gpFerie({ struttura: "" }); setFerie(parseFerie(r)); }, 900);
    } catch {
      setGpFerieBusy(null);
      alert("Errore nell'operazione. Riprova.");
    }
  }

  async function gpTimbraturaAction(action: "approva" | "rifiuta" | "elimina", pageId: string) {
    if (!pageId) { alert("ID timbratura mancante. Premi Aggiorna e riprova."); return; }
    if (gpTimbBusy) return;
    if (action === "rifiuta" && !confirm("Rifiutare questa timbratura?")) return;
    if (action === "elimina" && !confirm("Archiviare questa timbratura? Resterà conservata nello storico (a norma di legge non viene mai cancellata), ma non sarà più conteggiata. L'operazione verrà registrata col tuo nome.")) return;
    setGpTimbBusy(`${pageId}|${action}`);
    try {
      await ProxyApi.timbraturaUpdate({ action, pageId, motivo: "Cancellata" });
      setGpTimbBusy(null);
      setTimeout(async () => { const r = await ProxyApi.gpTimbrature({ struttura: "" }); setTimbrature(parseTimbratureList(r)); }, 1200);
    } catch {
      setGpTimbBusy(null);
      alert("Errore nell'operazione. Riprova.");
    }
  }


  const filteredDip = dipSearch
    ? dipendenti.filter(d => `${d.nome} ${d.cognome} ${d.username || ""} ${d.mansione || ""} ${d.struttura || ""}`.toLowerCase().includes(dipSearch.toLowerCase()))
    : dipendenti;

  const navItems: { id: GPView; label: string; icon: keyof typeof NavIcons }[] = [
    { id: "home", label: "Home", icon: "home" },
    { id: "dipendenti", label: "Dipendenti", icon: "dipendenti" },
    { id: "timbrature", label: "Timbrature", icon: "timbra" },
    { id: "ferie", label: "Ferie/ROL", icon: "ferie" },
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

          {view === "dipendenti" && !dipDetail && !dipForm && (
            <div>
              <div className="section-label">
                <div className="section-title">Dipendenti</div>
                <div style={{ background: "var(--teal)", color: "white", borderRadius: 20, padding: "0.4rem 1rem", fontSize: 12, fontWeight: 800, cursor: "pointer" }} onClick={() => setDipForm(nuovoForm())}>+ Nuovo</div>
              </div>
              <input className="dim-in" type="search" placeholder="🔎 Cerca per nome, cognome, username, mansione o struttura..." value={dipSearch} onChange={e => setDipSearch(e.target.value)} style={{ marginBottom: "0.75rem" }} />
              {loading
                ? <div className="timbra-card" style={{ textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Caricamento dipendenti...</div>
                : filteredDip.length === 0
                  ? <div className="timbra-card" style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-light)", fontWeight: 700 }}>Nessun dipendente trovato.</div>
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

          {view === "dipendenti" && dipDetail && !dipForm && (
            <div>
              <div className="stat-card">
                <div className="stat-card-orb"></div>
                <div className="stat-label">Dipendente</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "white" }}>{dipDetail.nome} {dipDetail.cognome}</div>
                <div className="stat-sub">{dipDetail.mansione || ""} · {dipDetail.struttura || ""}</div>
              </div>
              <div className="ana-card">
                <div className="ana-row"><div className="ana-label">Email</div><div className="ana-value" style={{ fontSize: 12 }}>{dipDetail.email || "—"}</div></div>
                <div className="ana-row"><div className="ana-label">Telefono</div><div className="ana-value">{dipDetail.telefono || "—"}</div></div>
                <div className="ana-row"><div className="ana-label">Contratto</div><div className="ana-value">{dipDetail.contratto || "—"}</div></div>
                <div className="ana-row"><div className="ana-label">Username</div><div className="ana-value">{dipDetail.username || "—"}</div></div>
              </div>
              <div className="ana-card">
                <div className="ana-row"><div className="ana-label">Codice fiscale</div><div className="ana-value" style={{ fontSize: 12 }}>{dipDetail.cf || "—"}</div></div>
                <div className="ana-row"><div className="ana-label">Matricola</div><div className="ana-value">{dipDetail.matricola || "—"}</div></div>
                <div className="ana-row"><div className="ana-label">Data nascita</div><div className="ana-value">{dipDetail.nascita ? fmtDateIt(dipDetail.nascita) : "—"}</div></div>
                <div className="ana-row"><div className="ana-label">Data assunzione</div><div className="ana-value">{dipDetail.dataAssunzione ? fmtDateIt(dipDetail.dataAssunzione) : "—"}</div></div>
                <div className="ana-row"><div className="ana-label">Ore settimanali</div><div className="ana-value">{dipDetail.oreSettimanali ?? "—"}</div></div>
                <div className="ana-row"><div className="ana-label">Attivo</div><div className="ana-value">{dipDetail.attivo ? "Sì" : "No"}</div></div>
              </div>
              <div className="ana-card">
                <div className="ana-row"><div className="ana-label">Monte ferie annuo</div><div className="ana-value">{dipDetail.monteFerie ?? "—"} h</div></div>
                <div className="ana-row"><div className="ana-label">Monte ROL annuo</div><div className="ana-value">{dipDetail.monteRol ?? "—"} h</div></div>
                <div className="ana-row"><div className="ana-label">Residuo ferie iniziale</div><div className="ana-value">{dipDetail.residuoFerieIniz ?? "—"} h</div></div>
                <div className="ana-row"><div className="ana-label">Residuo ROL iniziale</div><div className="ana-value">{dipDetail.residuoRolIniz ?? "—"} h</div></div>
              </div>
              {dipDetail.note && (
                <div className="ana-card" style={{ padding: "0.85rem 1rem" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-light)", textTransform: "uppercase", marginBottom: 4 }}>Note</div>
                  <div style={{ fontSize: 13, color: "var(--text-mid)" }}>{dipDetail.note}</div>
                </div>
              )}
              <TimesheetGP dipendente={dipDetail} strutture={strutture} />
              <ExportPdfGP dipendente={dipDetail} />
              <DocumentiDipendenteGP dipendente={dipDetail} />
              <button className="update-btn" style={{ background: "var(--teal)" }} onClick={() => setDipForm(formDaDipendente(dipDetail))}>✏️ Modifica anagrafica</button>
              {!dipDetail.username && (
                <div className="ana-card" style={{ padding: "0.85rem 1rem", marginBottom: "0.6rem", background: "#FCE4E4", border: "1px solid #E0A0A0" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#7A1A1A" }}>⚠️ Username non impostato</div>
                  <div style={{ fontSize: 12, color: "#7A1A1A", marginTop: 2 }}>Questo dipendente non ha uno Username associato su Notion: timbrature e documenti non vengono mostrati (per evitare di mescolare i dati di altri). Imposta lo Username dal pannello Admin → Da abilitare.</div>
                </div>
              )}
              <button className="update-btn" style={{ background: "var(--coral)" }} onClick={() => setDipDetail(null)}>← Indietro</button>
            </div>
          )}

          {view === "dipendenti" && dipForm && (
            <AnagraficaFormGP
              form={dipForm}
              strutture={strutture.length ? strutture : []}
              onCancel={() => setDipForm(null)}
              onSaved={() => { setDipForm(null); setDipDetail(null); fetchDip(); }}
            />
          )}

          {view === "timbrature" && (() => {
            const daApprovare = timbrature.filter((t: any) => t.approvazione === "Necessaria approvazione");
            const altre = timbrature.filter((t: any) => t.approvazione !== "Necessaria approvazione").slice(0, 10);
            return (
              <div>
                <div className="section-label"><div className="section-title">Timbrature</div></div>

                {daApprovare.length > 0 ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--coral)", marginBottom: "0.5rem" }}>⚠️ Da approvare ({daApprovare.length})</div>
                    <div className="ana-card" style={{ marginBottom: "0.75rem" }}>
                      {daApprovare.map((t: any, i: number) => {
                        const busyA = gpTimbBusy === `${t.pageId}|approva`;
                        const busyR = gpTimbBusy === `${t.pageId}|rifiuta`;
                        return (
                          <div key={i} style={{ padding: "1rem", borderBottom: "1px solid var(--bg)" }}>
                            <div style={{ marginBottom: 6 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-dark)" }}>{t.nome}</div>
                              <div style={{ fontSize: 12, color: "var(--text-light)" }}>{fmtDateIt(t.data)} · {t.struttura} · {t.oraEntrata || "—"}→{t.oraUscita || "—"}</div>
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button disabled={!!gpTimbBusy} onClick={() => gpTimbraturaAction("approva", t.pageId)} style={{ padding: "0.4rem 0.8rem", background: "#D5F0E0", color: "#1A6B3A", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", opacity: gpTimbBusy && !busyA ? 0.5 : 1 }}>{busyA ? "..." : "✅ Approva"}</button>
                              <button disabled={!!gpTimbBusy} onClick={() => gpTimbraturaAction("rifiuta", t.pageId)} style={{ padding: "0.4rem 0.8rem", background: "#FCE4E4", color: "#7A1A1A", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", opacity: gpTimbBusy && !busyR ? 0.5 : 1 }}>{busyR ? "..." : "❌ Rifiuta"}</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="timbra-card"><div style={{ textAlign: "center", padding: "1rem", color: "#1A6B3A", fontWeight: 700 }}>✅ Nessuna timbratura in attesa di approvazione</div></div>
                )}

                {altre.length > 0 && (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-dark)", margin: "0.75rem 0 0.5rem" }}>Storico timbrature</div>
                    <div className="ana-card">
                      {altre.map((tb: any, j: number) => {
                        const appBg = tb.approvazione === "Necessaria approvazione" ? "#FEF3CD" : (tb.approvazione === "Rifiutata" || tb.approvazione === "Rifiutato") ? "#FCE4E4" : "#D5F0E0";
                        const appCol = tb.approvazione === "Necessaria approvazione" ? "#7A5800" : (tb.approvazione === "Rifiutata" || tb.approvazione === "Rifiutato") ? "#7A1A1A" : "#1A6B3A";
                        const busyE = gpTimbBusy === `${tb.pageId}|elimina`;
                        return (
                          <div key={j} style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--bg)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dark)" }}>{tb.nome}</div>
                                <div style={{ fontSize: 11, color: "var(--text-light)" }}>{fmtDateIt(tb.data)} · {tb.struttura || "—"} · {tb.oraEntrata || "—"}→{tb.oraUscita || "—"}</div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                {tb.eliminata ? (
                                  <div style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800, background: "#E5E5E5", color: "#777" }}>🗑 Archiviata</div>
                                ) : (
                                  <>
                                    <div style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800, background: appBg, color: appCol }}>{tb.approvazione}</div>
                                    <button disabled={!!gpTimbBusy} onClick={() => gpTimbraturaAction("elimina", tb.pageId)} title="Archivia" style={{ padding: "3px 7px", background: "transparent", border: "1px solid #E0C0C0", color: "#A04040", borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{busyE ? "..." : "🗑"}</button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                <button className="update-btn" onClick={async () => { const r = await ProxyApi.gpTimbrature({ struttura: "" }); setTimbrature(parseTimbratureList(r)); }}>Aggiorna</button>
              </div>
            );
          })()}

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
                        <button disabled={!!gpFerieBusy} style={{ flex: 1, background: "var(--teal)", color: "white", border: "none", borderRadius: 20, padding: "0.5rem", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Satoshi,sans-serif", opacity: gpFerieBusy && gpFerieBusy !== r.pageId ? 0.5 : 1 }} onClick={() => approvaFeria(r.pageId, "Approvata")}>{gpFerieBusy === r.pageId ? "..." : "✅ Approva"}</button>
                        <button disabled={!!gpFerieBusy} style={{ flex: 1, background: "var(--coral)", color: "white", border: "none", borderRadius: 20, padding: "0.5rem", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Satoshi,sans-serif", opacity: gpFerieBusy && gpFerieBusy !== r.pageId ? 0.5 : 1 }} onClick={() => approvaFeria(r.pageId, "Rifiutata")}>{gpFerieBusy === r.pageId ? "..." : "❌ Rifiuta"}</button>
                      </div>
                    )}
                  </div>
                ))
              }
              <button className="update-btn" onClick={async () => { const r = await ProxyApi.gpFerie({ struttura: "" }); setFerie(parseFerie(r)); }}>Aggiorna</button>
            </div>
          )}

          {view === "comunicazioni" && (
            <ComunicazioniGP strutture={strutture} dipendenti={dipendenti} username={username} />
          )}

          {view === "strutture" && (
            <StruttureGP strutture={strutture} loading={strutLoading} onRefresh={refreshStrutture} />
          )}

          {view === "turni" && (
            <GriglieTurniGP strutture={strutture} dipendenti={dipendenti} />
          )}

          {view === "buste" && (
            <BustePagaGP dipendenti={dipendenti} />
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
