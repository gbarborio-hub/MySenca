import { useState, useEffect } from "react";
import { ProxyApi } from "../services/ProxyApi.js";
import RoleSwitchMini from "../components/RoleSwitchMini.js";

type PrivacyTab = "dashboard" | "lista" | "privacy";

interface Props {
  nome: string;
  showRoleSwitch: boolean;
  onShowRoleChooser: () => void;
  onLogout: () => void;
}

function fmtDate(d: string) {
  if (!d) return "—";
  const months = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  const dt = new Date(d);
  return `${dt.getDate()} ${months[dt.getMonth()]}`;
}
function fmtDateIt(d: string) {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}
function chIcon(c: string) {
  if (c === "Instagram") return "🟣";
  if (c === "Facebook") return "🔵";
  if (c === "LinkedIn") return "🔷";
  return c;
}
function nominaBg(n: string) {
  if (n === "Firmata") return "#D5F0E0";
  if (n === "Inviata") return "#DDEEFF";
  if (n === "Sollecito") return "#FEF3CD";
  return "#F0F0F0";
}
function nominaColor(n: string) {
  if (n === "Firmata") return "#1A6B3A";
  if (n === "Inviata") return "#1A4A7A";
  if (n === "Sollecito") return "#7A5800";
  return "#555";
}

export default function PrivacyView({ nome, showRoleSwitch, onShowRoleChooser, onLogout }: Props) {
  const [tab, setTab] = useState<PrivacyTab>("dashboard");
  const [dashTab, setDashTab] = useState<"all" | "marketing" | "privacy">("all");
  const [posts, setPosts] = useState<any[]>([]);
  const [incaricati, setIncaricati] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPrivacy, setLoadingPrivacy] = useState(false);
  const [filterStato, setFilterStato] = useState("Tutti");
  const [filterCanale, setFilterCanale] = useState("Tutti");
  // privacySection: quale sotto-vista dentro il tab "privacy" — null = home con le card, "incaricati" = lista
  const [privacySection, setPrivacySection] = useState<"incaricati" | null>(null);
  const [privacyDetail, setPrivacyDetail] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const firstName = (nome || "").split(" ")[0] || "utente";

  function loadAll() {
    setLoading(true);
    Promise.all([ProxyApi.posts(), ProxyApi.incaricati()]).then(([p, inc]) => {
      setPosts(Array.isArray(p) ? p : []);
      setIncaricati(Array.isArray(inc) ? inc : []);
      setLoading(false);
    });
  }
  function loadIncaricati() {
    setLoadingPrivacy(true);
    ProxyApi.incaricati().then(r => {
      setIncaricati(Array.isArray(r) ? r : []);
      setLoadingPrivacy(false);
    });
  }

  useEffect(() => { loadAll(); }, []);

  const pub = posts.filter((p: any) => p.stato === "Pubblicato").length;
  const appr = posts.filter((p: any) => p.stato === "Approvato").length;
  const bozza = posts.filter((p: any) => p.stato === "Bozza").length;
  const rev = posts.filter((p: any) => !["Pubblicato","Approvato","Bozza"].includes(p.stato)).length;
  const total = posts.length;
  const perc = total > 0 ? Math.round(pub / total * 100) : 0;

  const firmati = incaricati.filter((x: any) => x.nomina === "Firmata").length;
  const inviati = incaricati.filter((x: any) => x.nomina === "Inviata").length;
  const solleciti = incaricati.filter((x: any) => x.nomina === "Sollecito").length;
  const nonInviati = incaricati.filter((x: any) => x.nomina === "Non inviata" || !x.nomina).length;

  async function azioneNomina(inc: any, stato: "Inviata" | "Sollecito") {
    setActionLoading(true);
    const oggi = new Date().toISOString().split("T")[0];
    await ProxyApi.azioneNomina({
      pageId: inc.pageId, email: inc.email, nome: inc.nome, cognome: inc.cognome,
      stato, dataInvio: oggi,
      subject: "Nomina a Incaricato del Trattamento Dati - Senca Senior Care",
      body: `Gentile ${inc.nome} ${inc.cognome},<br><br>Le inviamo la nomina a incaricato del trattamento dei dati personali.<br><br>La preghiamo di firmare e restituire il documento allegato.<br><br>Cordiali saluti,<br>Senca Senior Care`
    });
    setActionLoading(false);
    loadIncaricati();
  }

  function openPrivacyTab() {
    setTab("privacy");
    setPrivacySection(null);
    setPrivacyDetail(null);
  }
  function openIncaricatiSection() {
    setPrivacySection("incaricati");
    loadIncaricati();
  }

  const filteredPosts = posts.filter((p: any) => {
    if (filterStato !== "Tutti" && p.stato !== filterStato) return false;
    if (filterCanale !== "Tutti" && !(p.canali || []).includes(filterCanale)) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="app-screen">
        <div className="app-header"><div className="app-greeting">Buongiorno,<br />{firstName}</div></div>
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
                <div className="stat-card"><div className="stat-card-orb"></div><div className="stat-label">Post totali</div><div className="stat-number">{total}</div><div className="stat-sub">piano editoriale maggio</div></div>
                <div className="half-cards">
                  <div className="half-card cyan"><div className="half-card-orb"></div><div className="half-card-label">Pubblicati</div><div className="half-card-number">{perc}%</div><div className="half-card-unit">{pub} su {total}</div></div>
                  <div className="half-card dark"><div className="half-card-orb"></div><div className="half-card-label">In lavorazione</div><div className="half-card-number">{appr}</div><div className="half-card-unit">approvati</div></div>
                </div>
                <div className="section-label" style={{ marginTop: "1rem" }}><div className="section-title">Piano editoriale</div></div>
                <div className="piano-chips">
                  <div className="piano-chip" style={{ background: "#E8603A", color: "white" }} onClick={() => { setTab("lista"); setFilterStato("Approvato"); }}><span className="chip-count">{appr}</span>Approvati</div>
                  <div className="piano-chip" style={{ background: "#EF8060", color: "white" }} onClick={() => { setTab("lista"); setFilterStato("Revisione"); }}><span className="chip-count">{rev}</span>Revisione</div>
                  <div className="piano-chip" style={{ background: "#F4A080", color: "white" }} onClick={() => { setTab("lista"); setFilterStato("Pubblicato"); }}><span className="chip-count">{pub}</span>Pubblicati</div>
                  <div className="piano-chip" style={{ background: "#C0A060", color: "white" }} onClick={() => { setTab("lista"); setFilterStato("Bozza"); }}><span className="chip-count">{bozza}</span>Bozza</div>
                </div>
              </>
            )}

            {(dashTab === "all" || dashTab === "privacy") && (
              <>
                <div className="section-label" style={{ marginTop: "1rem" }}><div className="section-title">Status Privacy</div></div>
                <div className="stat-card" style={{ background: "#0D5955" }}><div className="stat-card-orb"></div><div className="stat-label">Incaricati totali</div><div className="stat-number">{incaricati.length}</div><div className="stat-sub">nomine al trattamento dati</div></div>
                <div className="piano-chips">
                  <div className="piano-chip" style={{ background: "#1A6B3A", color: "white" }} onClick={() => { openPrivacyTab(); openIncaricatiSection(); }}><span className="chip-count">{firmati}</span>Firmati</div>
                  <div className="piano-chip" style={{ background: "#1A4A7A", color: "white" }} onClick={() => { openPrivacyTab(); openIncaricatiSection(); }}><span className="chip-count">{inviati}</span>Inviati</div>
                  <div className="piano-chip" style={{ background: "#E8603A", color: "white" }} onClick={() => { openPrivacyTab(); openIncaricatiSection(); }}><span className="chip-count">{solleciti}</span>Solleciti</div>
                  <div className="piano-chip" style={{ background: "#888", color: "white" }} onClick={() => { openPrivacyTab(); openIncaricatiSection(); }}><span className="chip-count">{nonInviati}</span>Non inviati</div>
                </div>
              </>
            )}
            <button className="update-btn" onClick={loadAll}>Aggiorna tutto</button>
          </div>
        )}

        {tab === "lista" && (
          <div>
            <div className="filters">
              {["Tutti","Pubblicato","Approvato","Bozza","Revisione"].map(f => (
                <div key={f} className={`filt ${filterStato === f ? "active" : "inactive"}`} onClick={() => setFilterStato(f)}>{f}</div>
              ))}
            </div>
            <div className="filters">
              {["Tutti","Instagram","Facebook","LinkedIn"].map(f => (
                <div key={f} className={`filt ${filterCanale === f ? "active" : "inactive"}`} onClick={() => setFilterCanale(f)}>{f}</div>
              ))}
            </div>
            <div className="table-card">
              {filteredPosts.length === 0
                ? <div style={{ padding: "2rem", textAlign: "center", color: "#7A9999", fontWeight: 700 }}>Nessun post trovato</div>
                : filteredPosts.map((p: any, i: number) => (
                  <div className="table-row" key={i}>
                    <div className="row-title">{p.titolo}</div>
                    <div className="row-date">{fmtDate(p.data)}</div>
                    <div className="row-channels">{(p.canali || []).map((c: string) => <span key={c} style={{ marginRight: 3 }}>{chIcon(c)}</span>)}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: p.stato === "Pubblicato" ? "#E3F6E9" : p.stato === "Approvato" ? "#DDEEFF" : "#FEF3CD", color: p.stato === "Pubblicato" ? "#1A5C33" : p.stato === "Approvato" ? "#1A4A7A" : "#7A5800", whiteSpace: "nowrap" }}>{p.stato}</div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {tab === "privacy" && privacyDetail && (
          <div>
            <div style={{ background: "var(--teal-dark)", borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1rem", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.15), transparent)" }}></div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "white", marginBottom: 4 }}>{privacyDetail.nome} {privacyDetail.cognome}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{privacyDetail.mansione}</div>
            </div>
            <div style={{ background: "var(--cyan)", borderRadius: "var(--radius-sm)", padding: "0.85rem 1rem", marginBottom: "0.5rem", fontSize: 14, fontWeight: 700, color: "white" }}>{privacyDetail.contratto || "—"}</div>
            <div style={{ background: "var(--cyan)", borderRadius: "var(--radius-sm)", padding: "0.85rem 1rem", marginBottom: "1rem", fontSize: 14, fontWeight: 700, color: "white" }}>{privacyDetail.email || "—"}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-dark)", marginBottom: "0.5rem" }}>Nomina</div>
            <div style={{ background: nominaBg(privacyDetail.nomina), borderRadius: "var(--radius-sm)", padding: "0.85rem 1rem", marginBottom: "0.5rem", fontSize: 14, fontWeight: 800, color: nominaColor(privacyDetail.nomina) }}>{privacyDetail.nomina || "Non inviata"}</div>
            {privacyDetail.dataInvio && <div style={{ background: "white", borderRadius: "var(--radius-sm)", padding: "0.75rem 1rem", marginBottom: "0.5rem", fontSize: 13, fontWeight: 700, color: "var(--text-mid)" }}>📤 Inviata il: {fmtDateIt(privacyDetail.dataInvio)}</div>}
            {privacyDetail.dataFirma && <div style={{ background: "white", borderRadius: "var(--radius-sm)", padding: "0.75rem 1rem", marginBottom: "0.5rem", fontSize: 13, fontWeight: 700, color: "var(--text-mid)" }}>✍️ Firmata il: {fmtDateIt(privacyDetail.dataFirma)}</div>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexDirection: "column" }}>
              {privacyDetail.nomina !== "Firmata" && (
                privacyDetail.nomina === "Non inviata" || !privacyDetail.nomina
                  ? <button disabled={actionLoading} onClick={() => azioneNomina(privacyDetail, "Inviata")} style={{ padding: "0.9rem", background: "var(--teal)", borderRadius: 30, border: "none", fontSize: 15, fontWeight: 800, color: "white", cursor: "pointer", fontFamily: "Satoshi,sans-serif" }}>📨 Invia nomina</button>
                  : <button disabled={actionLoading} onClick={() => azioneNomina(privacyDetail, "Sollecito")} style={{ padding: "0.9rem", background: "var(--coral)", borderRadius: 30, border: "none", fontSize: 15, fontWeight: 800, color: "white", cursor: "pointer", fontFamily: "Satoshi,sans-serif" }}>🔔 Sollecita</button>
              )}
              <button onClick={() => setPrivacyDetail(null)} style={{ padding: "0.9rem", background: "var(--coral)", borderRadius: 30, border: "none", fontSize: 15, fontWeight: 800, color: "white", cursor: "pointer", fontFamily: "Satoshi,sans-serif" }}>← Indietro</button>
            </div>
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
              <div className="half-card" style={{ background: "var(--teal)", cursor: "pointer" }}>
                <div className="half-card-orb"></div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "white" }}>Responsabili</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>al trattamento</div>
              </div>
            </div>
            <div style={{ background: "var(--cyan)", borderRadius: "var(--radius)", padding: "1.25rem 1.5rem", marginBottom: "0.75rem", cursor: "pointer" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "white" }}>Status dei lavori</div>
            </div>
            <div className="half-cards">
              <div className="half-card" style={{ background: "var(--coral)", cursor: "pointer" }}>
                <div className="half-card-orb"></div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "white" }}>Amministratori</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>di sistema</div>
              </div>
              <div className="half-card dark" style={{ cursor: "pointer" }}>
                <div className="half-card-orb"></div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "white" }}>Pazienti</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>e utenti</div>
              </div>
            </div>

            {privacySection === "incaricati" && (
              <>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-dark)", margin: "1rem 0 0.75rem" }}>Incaricati al trattamento</div>
                <div className="table-card">
                  {incaricati.filter((i: any) => i.nome).length === 0
                    ? <div style={{ padding: "2rem", textAlign: "center", color: "#7A9999", fontWeight: 700 }}>Nessun incaricato trovato</div>
                    : incaricati.filter((i: any) => i.nome).map((inc: any, i: number) => (
                      <div className="table-row" key={i} style={{ cursor: "pointer" }} onClick={() => setPrivacyDetail(inc)}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="row-title">{inc.nome} {inc.cognome}</div>
                          <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>{inc.mansione || ""}</div>
                        </div>
                        <div style={{ padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 800, background: nominaBg(inc.nomina), color: nominaColor(inc.nomina), whiteSpace: "nowrap", flexShrink: 0 }}>{inc.nomina || "Non inviata"}</div>
                      </div>
                    ))
                  }
                </div>
                <button className="update-btn" onClick={loadIncaricati}>Aggiorna</button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="bottom-nav">
        {([["dashboard","Home"],["lista","Lista"],["privacy","Privacy"]] as [PrivacyTab, string][]).map(([v, l]) => (
          <div key={v} className={`bnav-item ${tab === v ? "active" : ""}`} onClick={() => v === "privacy" ? openPrivacyTab() : setTab(v)}>
            <div className="bnav-label">{l}</div>
          </div>
        ))}
        <div className="bnav-item" onClick={onLogout}><div className="bnav-label">Esci</div></div>
      </div>
    </div>
  );
}
