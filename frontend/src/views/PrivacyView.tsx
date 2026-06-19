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
  const [filterStato, setFilterStato] = useState("Tutti");
  const [filterCanale, setFilterCanale] = useState("Tutti");
  const [privacyDetail, setPrivacyDetail] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const firstName = (nome || "").split(" ")[0] || "utente";

  useEffect(() => {
    Promise.all([ProxyApi.posts(), ProxyApi.incaricati()]).then(([p, inc]) => {
      setPosts(Array.isArray(p) ? p : []);
      setIncaricati(Array.isArray(inc) ? inc : []);
      setLoading(false);
    });
  }, []);

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

  async function azioneNomina(_inc: any, _stato: string) {
    setActionLoading(true);
    await ProxyApi.incaricati(); // placeholder - il webhook reale è AZIONE_URL che non abbiamo ancora
    setActionLoading(false);
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></div>
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

        {/* Sub-nav */}
        <div className="nav-tabs">
          {([["dashboard","Home"],["lista","Lista"],["privacy","Privacy"]] as [PrivacyTab, string][]).map(([v, l]) => (
            <div key={v} className={`nav-tab ${tab === v ? "active" : "inactive"}`} onClick={() => setTab(v)}>{l}</div>
          ))}
        </div>

        {tab === "dashboard" && (
          <div>
            <div className="nav-tabs">
              {(["all","marketing","privacy"] as const).map(t => (
                <div key={t} className={`nav-tab ${dashTab === t ? "active" : "inactive"}`} onClick={() => setDashTab(t)}>
                  {t === "all" ? "All" : t === "marketing" ? "Marketing" : "Privacy"}
                </div>
              ))}
            </div>

            {(dashTab === "all" || dashTab === "marketing") && (
              <>
                <div className="section-label"><div className="section-title">Status Marketing</div></div>
                <div className="stat-card"><div className="stat-card-orb"></div><div className="stat-label">Post totali</div><div className="stat-number">{total}</div></div>
                <div className="half-cards">
                  <div className="half-card cyan"><div className="half-card-orb"></div><div className="half-card-label">Pubblicati</div><div className="half-card-number">{perc}%</div><div className="half-card-unit">{pub} su {total}</div></div>
                  <div className="half-card dark"><div className="half-card-orb"></div><div className="half-card-label">In lavorazione</div><div className="half-card-number">{appr}</div><div className="half-card-unit">approvati</div></div>
                </div>
                <div className="section-label" style={{ marginTop: "1rem" }}><div className="section-title">Piano editoriale</div></div>
                <div className="piano-chips">
                  {[["#E8603A","Approvati",appr],["#EF8060","Revisione",rev],["#F4A080","Pubblicati",pub],["#C0A060","Bozza",bozza]].map(([bg, label, count]) => (
                    <div key={label as string} className="piano-chip" style={{ background: bg as string, color: "white" }} onClick={() => { setTab("lista"); setFilterStato(label as string === "Approvati" ? "Approvato" : label as string === "Pubblicati" ? "Pubblicato" : label as string); }}>
                      <span className="chip-count">{count}</span>{label}
                    </div>
                  ))}
                </div>
              </>
            )}

            {(dashTab === "all" || dashTab === "privacy") && (
              <>
                <div className="section-label" style={{ marginTop: "1rem" }}><div className="section-title">Status Privacy</div></div>
                <div className="stat-card" style={{ background: "#0D5955" }}><div className="stat-card-orb"></div><div className="stat-label">Incaricati totali</div><div className="stat-number">{incaricati.length}</div><div className="stat-sub">nomine al trattamento dati</div></div>
                <div className="piano-chips">
                  {[["#1A6B3A","Firmati",firmati],["#1A4A7A","Inviati",inviati],["#E8603A","Solleciti",solleciti],["#888","Non inviati",nonInviati]].map(([bg, label, count]) => (
                    <div key={label as string} className="piano-chip" style={{ background: bg as string, color: "white" }} onClick={() => setTab("privacy")}>
                      <span className="chip-count">{count}</span>{label}
                    </div>
                  ))}
                </div>
              </>
            )}
            <button className="update-btn" onClick={() => Promise.all([ProxyApi.posts(), ProxyApi.incaricati()]).then(([p,inc]) => { setPosts(Array.isArray(p)?p:[]); setIncaricati(Array.isArray(inc)?inc:[]); })}>Aggiorna tutto</button>
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

        {tab === "privacy" && !privacyDetail && (
          <div>
            <div className="section-label"><div className="section-title">Incaricati al trattamento</div></div>
            <div className="table-card">
              {incaricati.length === 0
                ? <div style={{ padding: "2rem", textAlign: "center", color: "#7A9999", fontWeight: 700 }}>Nessun incaricato trovato</div>
                : incaricati.map((inc: any, i: number) => (
                  <div className="table-row" key={i} style={{ cursor: "pointer" }} onClick={() => setPrivacyDetail(inc)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row-title">{inc.nome} {inc.cognome}</div>
                      <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>{inc.mansione}</div>
                    </div>
                    <div style={{ padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 800, background: nominaBg(inc.nomina), color: nominaColor(inc.nomina), whiteSpace: "nowrap" }}>{inc.nomina || "Non inviata"}</div>
                  </div>
                ))
              }
            </div>
            <button className="update-btn" onClick={() => ProxyApi.incaricati().then(r => setIncaricati(Array.isArray(r) ? r : []))}>Aggiorna</button>
          </div>
        )}

        {tab === "privacy" && privacyDetail && (
          <div>
            <div style={{ background: "var(--teal-dark)", borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1rem", position: "relative", overflow: "hidden" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "white", marginBottom: 4 }}>{privacyDetail.nome} {privacyDetail.cognome}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{privacyDetail.mansione}</div>
            </div>
            <div className="ana-card">
              {[["Contratto", privacyDetail.contratto], ["Email", privacyDetail.email], ["Nomina", privacyDetail.nomina || "Non inviata"], ["Data invio", fmtDateIt(privacyDetail.dataInvio)], ["Data firma", fmtDateIt(privacyDetail.dataFirma)]].map(([k, v]) => (
                <div className="ana-row" key={k as string}><div className="ana-label">{k}</div><div className="ana-value">{v || "—"}</div></div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "1rem" }}>
              {privacyDetail.nomina !== "Firmata" && (
                privacyDetail.nomina === "Non inviata" || !privacyDetail.nomina
                  ? <button className="update-btn" style={{ background: "var(--teal)" }} disabled={actionLoading} onClick={() => azioneNomina(privacyDetail, "Inviata")}>📨 Invia nomina</button>
                  : <button className="update-btn" style={{ background: "var(--coral)" }} disabled={actionLoading} onClick={() => azioneNomina(privacyDetail, "Sollecito")}>🔔 Sollecita</button>
              )}
              <button className="update-btn" onClick={() => setPrivacyDetail(null)}>← Indietro</button>
            </div>
          </div>
        )}
      </div>

      <div className="bottom-nav">
        {([["dashboard","Home"],["lista","Lista"],["privacy","Privacy"]] as [PrivacyTab, string][]).map(([v, l]) => (
          <div key={v} className={`bnav-item ${tab === v ? "active" : ""}`} onClick={() => setTab(v)}>
            <div className="bnav-label">{l}</div>
          </div>
        ))}
        <div className="bnav-item" onClick={onLogout}><div className="bnav-label">Esci</div></div>
      </div>
    </div>
  );
}
