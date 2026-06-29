import { useState, useEffect } from "react";
import { PostsApi, IncaricatiApi } from "../services/PrivacyApi.js";
import type { Post, Incaricato, DipendenteMancante } from "../services/PrivacyApi.js";
import RoleSwitchMini from "../components/RoleSwitchMini.js";
import Logo from "../components/Logo.js";
import { NavIcons } from "../components/NavIcons.js";
import DocumentiDipendenteGP from "./gp/DocumentiDipendenteGP.js";
import StatusLavoriGP from "./gp/StatusLavoriGP.js";
import { SegnalazioniApi } from "../services/SegnalazioniApi.js";
import type { Segnalazione } from "../services/SegnalazioniApi.js";

type PrivacyTab = "dashboard" | "lista" | "calendario" | "privacy";
type PrivacySection = "incaricati" | "segnalazioni" | "statusLavori" | null;

interface Props {
  nome: string;
  username: string;
  showRoleSwitch: boolean;
  onShowRoleChooser: () => void;
  onLogout: () => void;
}

const STATI = ["Idea", "In lavorazione", "Pronto", "Pubblicato", "Archiviato"];
const CANALI = ["Instagram", "LinkedIn", "Facebook", "Sito web", "Newsletter", "TikTok", "Altro"];

function statoColor(s: string) {
  if (s === "Pubblicato") return { bg: "#E3F6E9", color: "#1A5C33" };
  if (s === "Pronto") return { bg: "#DDEEFF", color: "#1A4A7A" };
  if (s === "In lavorazione") return { bg: "#FEF3CD", color: "#7A5800" };
  if (s === "Archiviato") return { bg: "#EAE3DC", color: "#6B5640" };
  return { bg: "#F0F0F0", color: "#555" }; // Idea
}
function chIcon(c: string) {
  if (c === "Instagram") return "🟣";
  if (c === "Facebook") return "🔵";
  if (c === "LinkedIn") return "🔷";
  if (c === "TikTok") return "⚫";
  if (c === "Sito web") return "🌐";
  if (c === "Newsletter") return "✉️";
  return "•";
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  const months = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  const dt = new Date(d);
  return `${dt.getDate()} ${months[dt.getMonth()]}`;
}
function fmtDateIt(d: string | null) {
  if (!d) return "—";
  const datePart = d.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length < 3) return "—";
  const [y, m, dd] = parts;
  return `${dd}/${m}/${y}`;
}
function scadenzaVicina(d: string | null) {
  if (!d) return false;
  const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 30;
}
function scadenzaPassata(d: string | null) {
  if (!d) return false;
  return new Date(d).getTime() < Date.now();
}

export default function PrivacyView({ nome, username, showRoleSwitch, onShowRoleChooser, onLogout }: Props) {
  const [tab, setTab] = useState<PrivacyTab>("dashboard");
  const [dashTab, setDashTab] = useState<"all" | "marketing" | "privacy">("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [incaricati, setIncaricati] = useState<Incaricato[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPrivacy, setLoadingPrivacy] = useState(false);
  const [filterStato, setFilterStato] = useState("Tutti");
  const [filterCanale, setFilterCanale] = useState("Tutti");
  const [privacySection, setPrivacySection] = useState<PrivacySection>(null);
  const [mancanti, setMancanti] = useState<DipendenteMancante[]>([]);
  const [mancantiSel, setMancantiSel] = useState<string[]>([]);
  const [mancantiBusy, setMancantiBusy] = useState(false);
  const [mancantiMsg, setMancantiMsg] = useState<string | null>(null);
  const [segnalazioni, setSegnalazioni] = useState<Segnalazione[]>([]);
  const [segnalazioniLoading, setSegnalazioniLoading] = useState(false);
  const [segnalazioneDetail, setSegnalazioneDetail] = useState<Segnalazione | null>(null);
  const [segGestioneBusy, setSegGestioneBusy] = useState(false);
  const [segNoteEdit, setSegNoteEdit] = useState("");
  const [segMisureEdit, setSegMisureEdit] = useState("");
  const [segResponsabileEdit, setSegResponsabileEdit] = useState("");
  const [privacyDetail, setPrivacyDetail] = useState<Incaricato | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const firstName = (nome || "").split(" ")[0] || "utente";

  function loadAll() {
    setLoading(true);
    Promise.all([PostsApi.list(), IncaricatiApi.list()]).then(([p, inc]) => {
      setPosts(Array.isArray(p) ? p : []);
      setIncaricati(Array.isArray(inc) ? inc : []);
      setLoading(false);
    });
  }
  function loadIncaricati() {
    setLoadingPrivacy(true);
    IncaricatiApi.list().then(r => {
      setIncaricati(Array.isArray(r) ? r : []);
      setLoadingPrivacy(false);
    });
  }

  useEffect(() => { loadAll(); }, []);

  const pub = posts.filter(p => p.stato === "Pubblicato").length;
  const pronto = posts.filter(p => p.stato === "Pronto").length;
  const lavorazione = posts.filter(p => p.stato === "In lavorazione").length;
  const idea = posts.filter(p => p.stato === "Idea").length;
  const total = posts.length;
  const perc = total > 0 ? Math.round(pub / total * 100) : 0;

  const firmati = incaricati.filter(x => x.documentoFirmato).length;
  const nonFirmati = incaricati.filter(x => !x.documentoFirmato).length;
  const inScadenza = incaricati.filter(x => scadenzaVicina(x.dataScadenza) || scadenzaPassata(x.dataScadenza)).length;

  async function toggleFirmato(inc: Incaricato) {
    setActionLoading(true);
    try {
      await IncaricatiApi.setFirmato(inc.pageId, !inc.documentoFirmato);
      loadIncaricati();
      setPrivacyDetail(null);
    } catch (err: any) {
      alert(err?.message || "Errore nell'operazione. Riprova.");
    } finally {
      setActionLoading(false);
    }
  }

  function openPrivacyTab() {
    setTab("privacy");
    setPrivacySection(null);
    setPrivacyDetail(null);
  }
  function openIncaricatiSection() {
    setPrivacySection("incaricati");
    loadIncaricati();
    loadMancanti();
  }
  function openSegnalazioniSection() {
    setPrivacySection("segnalazioni");
    loadSegnalazioni();
  }
  function loadSegnalazioni() {
    setSegnalazioniLoading(true);
    SegnalazioniApi.list().then(r => { setSegnalazioni(Array.isArray(r) ? r : []); setSegnalazioniLoading(false); }).catch(() => setSegnalazioniLoading(false));
  }
  function loadMancanti() {
    IncaricatiApi.mancanti().then(r => setMancanti(Array.isArray(r) ? r : [])).catch(() => setMancanti([]));
  }
  function toggleMancante(pageId: string) {
    setMancantiSel(sel => sel.includes(pageId) ? sel.filter(id => id !== pageId) : [...sel, pageId]);
  }
  async function aggiungiMancanti(lista: DipendenteMancante[]) {
    if (lista.length === 0) return;
    setMancantiBusy(true); setMancantiMsg(null);
    try {
      const res = await IncaricatiApi.creaSelezionati(lista);
      setMancantiBusy(false);
      setMancantiMsg(res.falliti.length > 0
        ? `✅ Aggiunti ${res.creati}. ⚠️ ${res.falliti.length} non riusciti.`
        : `✅ Aggiunti ${res.creati} incaricati.`);
      setMancantiSel([]);
      loadMancanti();
      loadIncaricati();
    } catch {
      setMancantiBusy(false);
      setMancantiMsg("⚠️ Errore nell'operazione. Riprova.");
    }
  }

  const filteredPosts = posts.filter(p => {
    if (filterStato !== "Tutti" && p.stato !== filterStato) return false;
    if (filterCanale !== "Tutti" && p.canale !== filterCanale) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="app-screen">
        <div className="app-header"><div className="app-greeting">Buongiorno,<br />{firstName}</div><div className="app-logo"><Logo /></div></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: "1rem" }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></div>
          <div style={{ color: "#7A9999", fontWeight: 700, fontSize: 14 }}>Caricamento dati da Notion...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-screen">
      <div className="app-header">
        <div className="app-greeting">Buongiorno,<br />{firstName}</div>
        <div className="app-logo"><Logo /></div>
      </div>
      <div className="app-content">
        <RoleSwitchMini visible={showRoleSwitch} onClick={onShowRoleChooser} />

        {tab === "dashboard" && (
          <div>
            <div className="nav-tabs">
              {(["all","marketing","privacy"] as const).map(t => (
                <div key={t} className={`nav-tab ${dashTab === t ? "active" : "inactive"}`} onClick={() => { setDashTab(t); if (t === "privacy") loadIncaricati(); }}>
                  {t === "all" ? "All" : t === "marketing" ? "Marketing" : "Privacy"}
                </div>
              ))}
            </div>

            {(dashTab === "all" || dashTab === "marketing") && (
              <>
                <div className="section-label"><div className="section-title">Status Marketing</div></div>
                <div className="stat-card"><div className="stat-card-orb"></div><div className="stat-label">Contenuti totali</div><div className="stat-number">{total}</div><div className="stat-sub">piano editoriale</div></div>
                <div className="half-cards">
                  <div className="half-card cyan"><div className="half-card-orb"></div><div className="half-card-label">Pubblicati</div><div className="half-card-number">{perc}%</div><div className="half-card-unit">{pub} su {total}</div></div>
                  <div className="half-card dark"><div className="half-card-orb"></div><div className="half-card-label">In lavorazione</div><div className="half-card-number">{lavorazione}</div><div className="half-card-unit">contenuti</div></div>
                </div>
                <div className="section-label" style={{ marginTop: "1rem" }}><div className="section-title">Piano editoriale</div></div>
                <div className="piano-chips">
                  <div className="piano-chip" style={{ background: "#888", color: "white" }} onClick={() => { setTab("lista"); setFilterStato("Idea"); }}><span className="chip-count">{idea}</span>Idee</div>
                  <div className="piano-chip" style={{ background: "#E8603A", color: "white" }} onClick={() => { setTab("lista"); setFilterStato("In lavorazione"); }}><span className="chip-count">{lavorazione}</span>In lavorazione</div>
                  <div className="piano-chip" style={{ background: "#1A4A7A", color: "white" }} onClick={() => { setTab("lista"); setFilterStato("Pronto"); }}><span className="chip-count">{pronto}</span>Pronti</div>
                  <div className="piano-chip" style={{ background: "#1A6B3A", color: "white" }} onClick={() => { setTab("lista"); setFilterStato("Pubblicato"); }}><span className="chip-count">{pub}</span>Pubblicati</div>
                </div>
              </>
            )}

            {(dashTab === "all" || dashTab === "privacy") && (
              <>
                <div className="section-label" style={{ marginTop: "1rem" }}><div className="section-title">Status Privacy</div></div>
                <div className="stat-card" style={{ background: "#0D5955" }}><div className="stat-card-orb"></div><div className="stat-label">Incaricati totali</div><div className="stat-number">{incaricati.length}</div><div className="stat-sub">nomine al trattamento dati</div></div>
                <div className="piano-chips">
                  <div className="piano-chip" style={{ background: "#1A6B3A", color: "white" }} onClick={() => { openPrivacyTab(); openIncaricatiSection(); }}><span className="chip-count">{firmati}</span>Firmati</div>
                  <div className="piano-chip" style={{ background: "#888", color: "white" }} onClick={() => { openPrivacyTab(); openIncaricatiSection(); }}><span className="chip-count">{nonFirmati}</span>Non firmati</div>
                  <div className="piano-chip" style={{ background: "#E8603A", color: "white" }} onClick={() => { openPrivacyTab(); openIncaricatiSection(); }}><span className="chip-count">{inScadenza}</span>In scadenza/scaduti</div>
                </div>
              </>
            )}
            <button className="update-btn" onClick={loadAll}>Aggiorna tutto</button>
          </div>
        )}

        {tab === "lista" && (
          <div>
            <div className="filters">
              {["Tutti", ...STATI].map(f => (
                <div key={f} className={`filt ${filterStato === f ? "active" : "inactive"}`} onClick={() => setFilterStato(f)}>{f}</div>
              ))}
            </div>
            <div className="filters">
              {["Tutti", ...CANALI].map(f => (
                <div key={f} className={`filt ${filterCanale === f ? "active" : "inactive"}`} onClick={() => setFilterCanale(f)}>{f}</div>
              ))}
            </div>
            <div className="table-card">
              {filteredPosts.length === 0
                ? <div style={{ padding: "2rem", textAlign: "center", color: "#7A9999", fontWeight: 700 }}>Nessun contenuto trovato</div>
                : filteredPosts.map((p, i) => {
                  const sc = statoColor(p.stato);
                  return (
                    <div className="table-row" key={i}>
                      <div className="row-title">{p.titolo || "(senza titolo)"}</div>
                      <div className="row-date">{fmtDate(p.dataPubblicazione)}</div>
                      <div className="row-channels">{p.canale && <span>{chIcon(p.canale)} {p.canale}</span>}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: sc.bg, color: sc.color, whiteSpace: "nowrap" }}>{p.stato || "—"}</div>
                    </div>
                  );
                })
              }
            </div>
          </div>
        )}

        {tab === "calendario" && (() => {
          const oggi = new Date();
          const mesi = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
          const anno = oggi.getFullYear(), mese = oggi.getMonth();
          const oggiNum = oggi.getDate();
          const byDate: Record<string, Post[]> = {};
          posts.forEach(p => {
            const parts = (p.dataPubblicazione || "").split("-");
            if (parts.length < 3) return;
            if (+parts[0] !== anno || +parts[1] !== mese + 1) return;
            const dd = parts[2];
            if (!byDate[dd]) byDate[dd] = [];
            byDate[dd].push(p);
          });
          const firstDay = new Date(anno, mese, 1).getDay();
          const daysInMonth = new Date(anno, mese + 1, 0).getDate();
          const start = firstDay === 0 ? 6 : firstDay - 1;
          const cells: JSX.Element[] = [];
          for (let si = 0; si < start; si++) cells.push(<div key={`o${si}`} className="cal-day other"></div>);
          for (let di = 1; di <= daysInMonth; di++) {
            const ds = String(di).padStart(2, "0");
            const dp = byDate[ds] || [];
            cells.push(
              <div key={di} className={`cal-day${di === oggiNum ? " today" : ""}`}>
                <div className="cal-num">{di}</div>
                {dp.slice(0, 2).map((post, ei) => {
                  const ch = post.canale === "Instagram" ? "IG" : post.canale === "Facebook" ? "FB" : post.canale === "LinkedIn" ? "LI" : (post.canale || "").slice(0, 2).toUpperCase();
                  return <div key={ei} className={`cal-ev${post.stato === "Pubblicato" ? " pub" : ""}`}>{ch}</div>;
                })}
                {dp.length > 2 && <div style={{ fontSize: 8, color: "#7A9999", padding: "1px 3px" }}>+{dp.length - 2}</div>}
              </div>
            );
          }
          const dn = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
          return (
            <div className="cal-wrap">
              <div className="cal-month">{mesi[mese]} {anno}</div>
              <div className="cal-grid">
                {dn.map(d => <div key={d} className="cal-dn">{d}</div>)}
                {cells}
              </div>
            </div>
          );
        })()}

        {tab === "privacy" && privacyDetail && (
          <div>
            <div style={{ background: "var(--teal-dark)", borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1rem", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.15), transparent)" }}></div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "white", marginBottom: 4 }}>{privacyDetail.nome} {privacyDetail.cognome}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{privacyDetail.ruolo}{privacyDetail.struttura ? ` · ${privacyDetail.struttura}` : ""}</div>
            </div>
            {privacyDetail.email && <div style={{ background: "var(--cyan)", borderRadius: "var(--radius-sm)", padding: "0.85rem 1rem", marginBottom: "1rem", fontSize: 14, fontWeight: 700, color: "white" }}>{privacyDetail.email}</div>}
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-dark)", marginBottom: "0.5rem" }}>Documento</div>
            <div style={{ background: privacyDetail.documentoFirmato ? "#D5F0E0" : "#FEF3CD", borderRadius: "var(--radius-sm)", padding: "0.85rem 1rem", marginBottom: "0.5rem", fontSize: 14, fontWeight: 800, color: privacyDetail.documentoFirmato ? "#1A6B3A" : "#7A5800" }}>
              {privacyDetail.documentoFirmato ? "✅ Firmato" : "⏳ Non firmato"}
            </div>
            {privacyDetail.dataNomina && <div style={{ background: "white", borderRadius: "var(--radius-sm)", padding: "0.75rem 1rem", marginBottom: "0.5rem", fontSize: 13, fontWeight: 700, color: "var(--text-mid)" }}>📅 Data nomina: {fmtDateIt(privacyDetail.dataNomina)}</div>}
            {privacyDetail.dataScadenza && (
              <div style={{ background: scadenzaPassata(privacyDetail.dataScadenza) ? "#FCE4E4" : scadenzaVicina(privacyDetail.dataScadenza) ? "#FEF3CD" : "white", borderRadius: "var(--radius-sm)", padding: "0.75rem 1rem", marginBottom: "0.5rem", fontSize: 13, fontWeight: 700, color: scadenzaPassata(privacyDetail.dataScadenza) ? "#7A1A1A" : "var(--text-mid)" }}>
                ⏰ Scadenza: {fmtDateIt(privacyDetail.dataScadenza)}{scadenzaPassata(privacyDetail.dataScadenza) ? " (scaduta)" : scadenzaVicina(privacyDetail.dataScadenza) ? " (entro 30gg)" : ""}
              </div>
            )}
            {privacyDetail.note && <div style={{ background: "white", borderRadius: "var(--radius-sm)", padding: "0.75rem 1rem", marginBottom: "0.5rem", fontSize: 13, color: "var(--text-mid)" }}>📝 {privacyDetail.note}</div>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexDirection: "column" }}>
              <button disabled={actionLoading} onClick={() => toggleFirmato(privacyDetail)} style={{ padding: "0.9rem", background: privacyDetail.documentoFirmato ? "var(--coral)" : "var(--teal)", borderRadius: 30, border: "none", fontSize: 15, fontWeight: 800, color: "white", cursor: "pointer", fontFamily: "Satoshi,sans-serif" }}>
                {privacyDetail.documentoFirmato ? "↩️ Segna come non firmato" : "✅ Segna come firmato"}
              </button>
              <button onClick={() => setPrivacyDetail(null)} style={{ padding: "0.9rem", background: "var(--text-light)", borderRadius: 30, border: "none", fontSize: 15, fontWeight: 800, color: "white", cursor: "pointer", fontFamily: "Satoshi,sans-serif" }}>← Indietro</button>
            </div>

            {privacyDetail.username ? (
              <div style={{ marginTop: "1.25rem" }}>
                <DocumentiDipendenteGP dipendente={privacyDetail} caricatoDa={username} ruolo="Privacy" />
              </div>
            ) : (
              <div className="ana-card" style={{ marginTop: "1rem", padding: "0.85rem 1rem", background: "#FEF3CD" }}>
                <div style={{ fontSize: 12, color: "#7A5800", fontWeight: 700 }}>⚠️ Questo incaricato non è collegato a uno username (creato prima di questa funzione, o manualmente su Notion): non è possibile caricargli documenti da qui.</div>
              </div>
            )}
          </div>
        )}

        {tab === "privacy" && !privacyDetail && loadingPrivacy && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", flexDirection: "column", gap: "1rem" }}>
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></div>
            <div style={{ color: "#7A9999", fontWeight: 700, fontSize: 14 }}>Caricamento incaricati...</div>
          </div>
        )}

        {tab === "privacy" && !privacyDetail && !loadingPrivacy && (
          <div>
            <div style={{ background: "var(--coral)", borderRadius: 30, padding: "0.75rem", textAlign: "center", fontSize: 16, fontWeight: 800, color: "white", marginBottom: "1.25rem" }}>Privacy</div>
            <div className="half-cards">
              <div className="half-card dark" style={{ cursor: "pointer" }} onClick={openIncaricatiSection}>
                <div className="half-card-orb"></div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "white" }}>Incaricati</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>al trattamento</div>
              </div>
              <div className="half-card" style={{ background: "var(--teal)" }}>
                <div className="half-card-orb"></div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "white" }}>{incaricati.length}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>totali registrati</div>
              </div>
            </div>
            <div className="half-cards">
              <div className="half-card" style={{ background: "var(--coral)", cursor: "pointer" }} onClick={openSegnalazioniSection}>
                <div className="half-card-orb"></div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "white" }}>Segnalazioni</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>eventi e data breach</div>
              </div>
              <div className="half-card" style={{ background: "var(--text-mid)" }}>
                <div className="half-card-orb"></div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "white" }}>{segnalazioni.filter(s => s.stato === "Aperto").length}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>aperte</div>
              </div>
            </div>
            <div className="half-cards">
              <div className="half-card dark" style={{ cursor: "pointer" }} onClick={() => setPrivacySection("statusLavori")}>
                <div className="half-card-orb"></div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "white" }}>Status lavori</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>conformità privacy</div>
              </div>
              <div className="half-card" style={{ background: "var(--cyan)" }}>
                <div className="half-card-orb"></div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "white" }}>Kanban</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>avanzamento check list</div>
              </div>
            </div>

            {privacySection === "statusLavori" && <StatusLavoriGP />}

            {privacySection === "incaricati" && (
              <>
                {mancanti.length > 0 && (
                  <div className="ana-card" style={{ padding: "1rem", marginBottom: "1rem", border: "1.5px solid #E8603A" }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#7A1A1A", marginBottom: 4 }}>⚠️ {mancanti.length} dipendenti non sono incaricati al trattamento</div>
                    <div style={{ fontSize: 12, color: "var(--text-mid)", marginBottom: "0.6rem" }}>Verifica se vanno aggiunti: non tutti i dipendenti devono necessariamente esserlo.</div>
                    {mancanti.map(d => (
                      <label key={d.pageId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13, fontWeight: 700, color: "var(--text-dark)", cursor: "pointer" }}>
                        <input type="checkbox" checked={mancantiSel.includes(d.pageId)} onChange={() => toggleMancante(d.pageId)} style={{ width: 16, height: 16 }} />
                        {d.nome} {d.cognome} <span style={{ color: "var(--text-light)", fontWeight: 600, fontSize: 11 }}>{d.mansione ? `· ${d.mansione}` : ""}{d.struttura ? ` · ${d.struttura}` : ""}</span>
                      </label>
                    ))}
                    {mancantiMsg && <div style={{ margin: "8px 0", fontSize: 13, fontWeight: 700, color: "var(--teal-dark)" }}>{mancantiMsg}</div>}
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem", flexWrap: "wrap" }}>
                      <button className="ts-save" disabled={mancantiBusy} onClick={() => aggiungiMancanti(mancanti)}>{mancantiBusy ? "Aggiunta…" : `➕ Aggiungi tutti (${mancanti.length})`}</button>
                      <button className="ts-mini" disabled={mancantiBusy || mancantiSel.length === 0} onClick={() => aggiungiMancanti(mancanti.filter(d => mancantiSel.includes(d.pageId)))}>{mancantiBusy ? "…" : `Aggiungi selezionati (${mancantiSel.length})`}</button>
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-dark)", margin: "1rem 0 0.75rem" }}>Incaricati al trattamento</div>
                <div className="table-card">
                  {incaricati.filter(i => i.nome).length === 0
                    ? <div style={{ padding: "2rem", textAlign: "center", color: "#7A9999", fontWeight: 700 }}>Nessun incaricato trovato</div>
                    : incaricati.filter(i => i.nome).map((inc, i) => (
                      <div className="table-row" key={i} style={{ cursor: "pointer" }} onClick={() => setPrivacyDetail(inc)}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="row-title">{inc.nome} {inc.cognome}</div>
                          <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>{inc.ruolo || ""}{inc.struttura ? ` · ${inc.struttura}` : ""}</div>
                        </div>
                        <div style={{ padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 800, background: inc.documentoFirmato ? "#D5F0E0" : "#FEF3CD", color: inc.documentoFirmato ? "#1A6B3A" : "#7A5800", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {inc.documentoFirmato ? "Firmato" : "Non firmato"}
                        </div>
                      </div>
                    ))
                  }
                </div>
                <button className="update-btn" onClick={loadIncaricati}>Aggiorna</button>
              </>
            )}

            {privacySection === "segnalazioni" && !segnalazioneDetail && (
              <>
                <div className="section-label"><div className="section-title">Segnalazioni e Data Breach</div></div>
                {segnalazioniLoading ? (
                  <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)" }}>Caricamento...</div>
                ) : segnalazioni.length === 0 ? (
                  <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessuna segnalazione</div>
                ) : (
                  <div className="table-card">
                    {segnalazioni.map((s, i) => {
                      const statoBg = s.stato === "Aperto" ? "#FCE4E4" : s.stato === "In gestione" ? "#FEF3CD" : "#D5F0E0";
                      const statoCol = s.stato === "Aperto" ? "#7A1A1A" : s.stato === "In gestione" ? "#7A5800" : "#1A6B3A";
                      return (
                        <div className="table-row" key={i} style={{ cursor: "pointer" }} onClick={() => { setSegnalazioneDetail(s); setSegNoteEdit(s.note); setSegMisureEdit(s.misureAdottate); setSegResponsabileEdit(s.responsabileGestione); }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="row-title">{s.numeroEvento} {s.tipo === "Data Breach" && <span style={{ color: "#C0392B" }}>⚠️</span>}</div>
                            <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>{s.tipo} · {s.segnalatoDa || "anonimo"}{s.struttura ? ` · ${s.struttura}` : ""}</div>
                          </div>
                          <div style={{ padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 800, background: statoBg, color: statoCol, whiteSpace: "nowrap", flexShrink: 0 }}>{s.stato}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <button className="update-btn" onClick={loadSegnalazioni}>Aggiorna</button>
              </>
            )}

            {privacySection === "segnalazioni" && segnalazioneDetail && (() => {
              const s = segnalazioneDetail;
              async function setStato(stato: "Aperto" | "In gestione" | "Chiuso") {
                try {
                  await SegnalazioniApi.updateStato(s.pageId, stato);
                  setSegnalazioneDetail({ ...s, stato });
                  loadSegnalazioni();
                } catch (err: any) {
                  alert(err?.message || "Errore nell'operazione. Riprova.");
                }
              }
              async function salvaGestione() {
                setSegGestioneBusy(true);
                try {
                  await SegnalazioniApi.aggiornaGestione(s.pageId, { responsabileGestione: segResponsabileEdit, misureAdottate: segMisureEdit, note: segNoteEdit });
                  setSegnalazioneDetail({ ...s, responsabileGestione: segResponsabileEdit, misureAdottate: segMisureEdit, note: segNoteEdit });
                  loadSegnalazioni();
                } catch (err: any) {
                  alert(err?.message || "Errore nel salvataggio. Riprova.");
                } finally {
                  setSegGestioneBusy(false);
                }
              }
              return (
                <div>
                  <button onClick={() => setSegnalazioneDetail(null)} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 800, color: "var(--teal)", cursor: "pointer", fontFamily: "Satoshi,sans-serif", marginBottom: "0.5rem" }}>← Indietro</button>
                  <div style={{ background: "var(--teal-dark)", borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1rem" }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "white" }}>{s.numeroEvento}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{s.tipo}{s.tipoViolazione ? ` · ${s.tipoViolazione}` : ""}</div>
                  </div>

                  <div className="ana-card" style={{ marginBottom: "0.75rem" }}>
                    <div className="ana-row"><div className="ana-label">Segnalato da</div><div className="ana-value">{s.segnalatoDa || "—"}</div></div>
                    <div className="ana-row"><div className="ana-label">Data evento</div><div className="ana-value">{fmtDateIt(s.dataEvento)}</div></div>
                    <div className="ana-row"><div className="ana-label">Data segnalazione</div><div className="ana-value">{fmtDateIt(s.dataSegnalazione)}</div></div>
                    <div className="ana-row"><div className="ana-label">Area/Sede</div><div className="ana-value">{s.areaSede || "—"}</div></div>
                  </div>

                  <div className="ana-card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-light)", textTransform: "uppercase", marginBottom: 4 }}>Descrizione</div>
                    <div style={{ fontSize: 13, color: "var(--text-mid)", whiteSpace: "pre-wrap" }}>{s.descrizione || "—"}</div>
                  </div>

                  <div className="ana-card" style={{ marginBottom: "0.75rem" }}>
                    <div className="ana-row"><div className="ana-label">Origine</div><div className="ana-value">{s.origine || "—"}</div></div>
                    <div className="ana-row"><div className="ana-label">Causa</div><div className="ana-value">{s.causa || "—"}</div></div>
                    <div className="ana-row"><div className="ana-label">Testimoni</div><div className="ana-value" style={{ fontSize: 12 }}>{s.testimoni || "—"}</div></div>
                    <div className="ana-row"><div className="ana-label">Info aziendali coinvolte</div><div className="ana-value">{s.infoAziendaliCoinvolte ? "Sì" : "No"}</div></div>
                    {s.infoAziendaliCoinvolte && <div className="ana-row"><div className="ana-label">Dettaglio</div><div className="ana-value" style={{ fontSize: 12 }}>{s.dettaglioInfoAziendali || "—"}</div></div>}
                    <div className="ana-row"><div className="ana-label">Dati personali coinvolti</div><div className="ana-value">{s.datiPersonaliCoinvolti ? "Sì" : "No"}</div></div>
                    <div className="ana-row"><div className="ana-label">Asset coinvolti</div><div className="ana-value" style={{ fontSize: 12 }}>{s.assetCoinvolti || "—"}</div></div>
                    <div className="ana-row"><div className="ana-label">Responsabile asset</div><div className="ana-value">{s.responsabileAsset || "—"}</div></div>
                  </div>

                  {s.tipo === "Data Breach" && (
                    <div className="ana-card" style={{ marginBottom: "0.75rem", border: "1.5px solid #C0392B" }}>
                      <div style={{ padding: "0.6rem 1rem 0", fontSize: 12, fontWeight: 800, color: "#7A1A1A" }}>Dettaglio Data Breach</div>
                      <div className="ana-row"><div className="ana-label">Categoria</div><div className="ana-value">{s.categoriaDataBreach || "—"}</div></div>
                      <div className="ana-row"><div className="ana-label">Categorie dati coinvolti</div><div className="ana-value" style={{ fontSize: 12 }}>{s.categorieDatiCoinvolti || "—"}</div></div>
                      <div className="ana-row"><div className="ana-label">Quantità dati</div><div className="ana-value" style={{ fontSize: 12 }}>{s.quantitaDati || "—"}</div></div>
                      <div className="ana-row"><div className="ana-label">Categorie interessati</div><div className="ana-value" style={{ fontSize: 12 }}>{s.categorieInteressati || "—"}</div></div>
                      <div className="ana-row"><div className="ana-label">Danni agli interessati</div><div className="ana-value" style={{ fontSize: 12 }}>{s.danniInteressati || "—"}</div></div>
                    </div>
                  )}

                  <div className="section-label"><div className="section-title">Gestione</div></div>
                  <div className="ana-card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
                    <label className="dim-lbl">Stato</label>
                    <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.7rem" }}>
                      {(["Aperto", "In gestione", "Chiuso"] as const).map(st => (
                        <button key={st} onClick={() => setStato(st)} className={`com-pill${s.stato === st ? " on" : ""}`}>{st}</button>
                      ))}
                    </div>
                    <label className="dim-lbl">Responsabile gestione</label>
                    <input className="dim-in" value={segResponsabileEdit} onChange={e => setSegResponsabileEdit(e.target.value)} />
                    <label className="dim-lbl">Misure adottate</label>
                    <textarea className="dim-in" rows={3} value={segMisureEdit} onChange={e => setSegMisureEdit(e.target.value)} />
                    <label className="dim-lbl">Note interne</label>
                    <textarea className="dim-in" rows={3} value={segNoteEdit} onChange={e => setSegNoteEdit(e.target.value)} />
                    <button className="ts-save" style={{ marginTop: "0.5rem" }} disabled={segGestioneBusy} onClick={salvaGestione}>{segGestioneBusy ? "Salvataggio..." : "💾 Salva"}</button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="bottom-nav">
        {([["dashboard","Home","dashboard"],["lista","Lista","lista"],["calendario","Calendario","calendario"],["privacy","Privacy","privacy"]] as [PrivacyTab, string, keyof typeof NavIcons][]).map(([v, l, icon]) => (
          <div key={v} className={`bnav-item ${tab === v ? "active" : ""}`} onClick={() => v === "privacy" ? openPrivacyTab() : setTab(v)}>
            <div className="bnav-icon">{NavIcons[icon]}</div>
            <div className="bnav-label">{l}</div>
          </div>
        ))}
        <div className="bnav-item" onClick={onLogout}><div className="bnav-icon">{NavIcons.logout}</div><div className="bnav-label">Esci</div></div>
      </div>
    </div>
  );
}
