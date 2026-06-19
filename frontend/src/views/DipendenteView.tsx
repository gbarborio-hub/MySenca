import { useState, useEffect } from "react";
import { ProxyApi } from "../services/ProxyApi.js";
import RoleSwitchMini from "../components/RoleSwitchMini.js";

type DipTab = "Home" | "timbra" | "turni" | "Ferie/ROL" | "Documenti" | "Avvisi" | "profilo";

interface Props {
  username: string;
  nome: string;
  showRoleSwitch: boolean;
  onShowRoleChooser: () => void;
  onLogout: () => void;
}

function fmtDateIt(d: string) {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}
function distanzaMetri(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DipendenteView({ username, nome, showRoleSwitch, onShowRoleChooser, onLogout }: Props) {
  const [tab, setTab] = useState<DipTab>("Home");
  const [strutture, setStrutture] = useState<any[]>([]);
  const [turni, setTurni] = useState<any[]>([]);
  const [timbrature, setTimbrature] = useState<any[]>([]);
  const [ferieSaldo, setFerieSaldo] = useState<any>(null);
  const [ferieRichieste, setFerieRichieste] = useState<any[]>([]);
  const [comunicazioni, setComunicazioni] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [profilo, setProfilo] = useState<any>(null);
  const [timbraStruttura, setTimbraStruttura] = useState("");
  const [timbratoEntrata, setTimbratoEntrata] = useState<string | null>(null);
  const [timbraEntrataFull, setTimbraEntrataFull] = useState<string | null>(null);
  const [timbraMsg, setTimbraMsg] = useState<{ text: string; type: string } | null>(null);
  const [ferieForm, setFerieForm] = useState<"Ferie" | "ROL" | null>(null);
  const [ferieInput, setFerieInput] = useState({ inizio: "", fine: "", ore: "" });

  const firstName = (nome || "").split(" ")[0] || "utente";
  const nUnread = comunicazioni.filter((c: any) => !c.letta).length;

  useEffect(() => {
    ProxyApi.strutture().then(r => setStrutture(Array.isArray(r) ? r : []));
    ProxyApi.turniRead(nome).then(r => setTurni(Array.isArray(r) ? r : []));
    ProxyApi.timbratureRead(username).then(r => setTimbrature(Array.isArray(r) ? r : []));
    ProxyApi.dipComunicazioni(username).then(r => setComunicazioni(Array.isArray(r) ? r : []));
    ProxyApi.ferieSaldo(username).then(r => setFerieSaldo(r));
    ProxyApi.ferieLettura(username).then(r => setFerieRichieste(Array.isArray(r) ? r : []));
    ProxyApi.profilo(username).then(r => setProfilo(r));
    ProxyApi.dipDocs(username).then(r => setDocs(Array.isArray(r) ? r : []));
  }, [username, nome]);

  async function doTimbraEntrata() {
    if (!timbraStruttura) { setTimbraMsg({ text: "⚠️ Seleziona una struttura prima di timbrare.", type: "warn" }); return; }
    const strut = strutture.find((s: any) => s.id === timbraStruttura);
    if (!strut) return;
    setTimbraMsg({ text: "📡 Rilevamento posizione GPS...", type: "warn" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = distanzaMetri(pos.coords.latitude, pos.coords.longitude, strut.lat, strut.lng);
        if (dist > strut.raggio) { setTimbraMsg({ text: `❌ GPS non autorizzato. Sei a ${Math.round(dist)}m dalla struttura (max ${strut.raggio}m).`, type: "err" }); return; }
        const now = new Date();
        const ora = now.toTimeString().slice(0, 5);
        setTimbratoEntrata(ora);
        setTimbraEntrataFull(now.toISOString());
        setTimbraMsg({ text: `✅ Entrata registrata alle ${ora} — sei a ${Math.round(dist)}m.`, type: "ok" });
      },
      () => setTimbraMsg({ text: "❌ Impossibile rilevare la posizione GPS.", type: "err" }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function doTimbraUscita() {
    if (!timbratoEntrata || !timbraEntrataFull) return;
    const strut = strutture.find((s: any) => s.id === timbraStruttura);
    if (!strut) return;
    setTimbraMsg({ text: "📡 Rilevamento posizione GPS...", type: "warn" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const dist = distanzaMetri(pos.coords.latitude, pos.coords.longitude, strut.lat, strut.lng);
        if (dist > strut.raggio) { setTimbraMsg({ text: `❌ GPS non autorizzato per l'uscita. Sei a ${Math.round(dist)}m.`, type: "err" }); return; }
        const now = new Date();
        const ora = now.toTimeString().slice(0, 5);
        const oggi = now.toISOString().split("T")[0];
        const oreTotali = Math.round((now.getTime() - new Date(timbraEntrataFull).getTime()) / 36000) / 100;
        await ProxyApi.timbra({ nome, username, struttura: strut.nome, data: oggi, oraEntrata: timbratoEntrata, oraUscita: ora, oreTotali, stato: "Regolare", approvazione: "Regolare", turno: "", lat: pos.coords.latitude, lng: pos.coords.longitude });
        setTimbratoEntrata(null); setTimbraEntrataFull(null);
        setTimbraMsg({ text: `✅ Uscita registrata alle ${ora}. Ore lavorate: ${oreTotali.toFixed(2)}h`, type: "ok" });
        ProxyApi.timbratureRead(username).then(r => setTimbrature(Array.isArray(r) ? r : []));
      },
      () => setTimbraMsg({ text: "❌ Impossibile rilevare la posizione GPS.", type: "err" }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const navItems: { tab: DipTab; label: string }[] = [
    { tab: "Home", label: "Home" },
    { tab: "timbra", label: "Timbra" },
    { tab: "turni", label: "Turni" },
    { tab: "Ferie/ROL", label: "Ferie" },
    { tab: "profilo", label: "Profilo" },
  ];

  return (
    <div className="app-screen">
      <div className="app-header">
        <div className="app-greeting">Buongiorno,<br />{firstName}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div onClick={() => setTab("Avvisi")} style={{ position: "relative", cursor: "pointer", color: "var(--teal)" }}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            {nUnread > 0 && <span className="nav-badge" style={{ position: "absolute", top: -5, right: -7 }}>{nUnread}</span>}
          </div>
        </div>
      </div>

      <div className="app-content">
        <RoleSwitchMini visible={showRoleSwitch} onClick={onShowRoleChooser} />

        {tab === "Home" && (
          <div>
            <div className="timbra-card-big" style={{ cursor: "pointer" }} onClick={() => setTab("timbra")}>
              <div className="timbra-card-big-orb"></div>
              <div className="timbra-card-big-title">Timbra</div>
              <div className="timbra-card-big-sub">Entrata - uscita</div>
            </div>
            <div className="dip-half-cards">
              <div className="dip-half-card" style={{ background: "var(--cyan)", cursor: "pointer" }} onClick={() => setTab("turni")}>
                <div className="dip-half-orb"></div>
                <div className="dip-half-label">I miei</div>
                <div className="dip-half-value">Turni</div>
              </div>
              <div className="dip-half-card" style={{ background: "var(--teal)", cursor: "pointer" }} onClick={() => setTab("profilo")}>
                <div className="dip-half-orb"></div>
                <div className="dip-half-label">Il mio</div>
                <div className="dip-half-value">Profilo</div>
              </div>
            </div>
            <div className="timbra-card-big" style={{ background: "var(--teal-dark)", minHeight: 90, cursor: "pointer" }} onClick={() => setTab("Documenti")}>
              <div className="timbra-card-big-orb"></div>
              <div className="timbra-card-big-title" style={{ fontSize: 22 }}>📄 Documenti</div>
              <div className="timbra-card-big-sub">Contratti · Buste paga · Certificati</div>
            </div>
          </div>
        )}

        {tab === "timbra" && (
          <div>
            <div className="timbra-card">
              <div className="timbra-title">Seleziona struttura</div>
              <select className="struttura-select" value={timbraStruttura} onChange={e => setTimbraStruttura(e.target.value)}>
                <option value="">-- Seleziona struttura --</option>
                {strutture.map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
              {!timbratoEntrata
                ? <button className="timbra-btn entrata" onClick={doTimbraEntrata}>⏱ Timbra Entrata</button>
                : <>
                  <div style={{ background: "var(--cyan-light)", borderRadius: "var(--radius-sm)", padding: "1rem", marginBottom: "1rem" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--teal)", textTransform: "uppercase" }}>Entrata registrata</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "var(--teal-dark)" }}>{timbratoEntrata}</div>
                  </div>
                  <button className="timbra-btn uscita" onClick={doTimbraUscita}>🔴 Timbra Uscita</button>
                </>
              }
              {timbraMsg && <div className={`timbra-status ${timbraMsg.type}`}>{timbraMsg.text}</div>}
            </div>
            <div className="timbra-card">
              <div className="timbra-title">Ultime timbrature</div>
              {timbrature.slice(0, 5).map((tb: any, i: number) => (
                <div className="ana-row" key={i}>
                  <div style={{ flex: 1 }}>
                    <div className="ana-label">{fmtDateIt(tb.data)} · {tb.struttura || "—"}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--teal)" }}>🕐 {tb.oraEntrata || "—"} → {tb.oraUscita || "—"}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "var(--teal-dark)", marginLeft: 8 }}>{tb.oreTotali > 0 ? `${Number(tb.oreTotali).toFixed(2)}h` : "—"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "turni" && (
          <div>
            <div className="section-label"><div className="section-title">I miei turni</div></div>
            {turni.length === 0
              ? <div className="timbra-card" style={{ textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessun turno disponibile</div>
              : turni.map((t: any, i: number) => (
                <div className="ana-card" style={{ marginBottom: "0.5rem", padding: "0.9rem 1rem" }} key={i}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-dark)" }}>{fmtDateIt(t.data)}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--teal)" }}>{t.tipo} · {t.oraInizio} — {t.oraFine}</div>
                  <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 600 }}>{t.struttura}</div>
                </div>
              ))
            }
          </div>
        )}

        {tab === "Ferie/ROL" && (
          <div>
            <div className="dip-half-cards">
              <div className="dip-half-card" style={{ background: "var(--teal-dark)", minHeight: 130 }}>
                <div className="dip-half-orb"></div>
                <div className="dip-half-value" style={{ fontSize: 38 }}>{ferieSaldo?.ferieResidue ?? "—"}</div>
                <div className="dip-half-label">Ferie residue (ore)</div>
              </div>
              <div className="dip-half-card" style={{ background: "var(--teal)", minHeight: 130 }}>
                <div className="dip-half-orb"></div>
                <div className="dip-half-value" style={{ fontSize: 38 }}>{ferieSaldo?.rolResidue ?? "—"}</div>
                <div className="dip-half-label">ROL residue (ore)</div>
              </div>
            </div>
            {!ferieForm
              ? <div className="dip-half-cards">
                <div className="dip-half-card" style={{ background: "var(--cyan)", cursor: "pointer" }} onClick={() => setFerieForm("Ferie")}>
                  <div className="dip-half-orb"></div><div className="dip-half-label">Nuova richiesta</div><div className="dip-half-value" style={{ fontSize: 22 }}>Ferie</div>
                </div>
                <div className="dip-half-card" style={{ background: "var(--coral)", cursor: "pointer" }} onClick={() => setFerieForm("ROL")}>
                  <div className="dip-half-orb"></div><div className="dip-half-label">Nuova richiesta</div><div className="dip-half-value" style={{ fontSize: 22 }}>ROL</div>
                </div>
              </div>
              : <div className="timbra-card">
                <div className="timbra-title">Nuova richiesta {ferieForm}</div>
                <label className="dim-lbl">Data inizio</label>
                <input type="date" className="dim-in" value={ferieInput.inizio} onChange={e => setFerieInput(f => ({ ...f, inizio: e.target.value }))} />
                <label className="dim-lbl">Data fine</label>
                <input type="date" className="dim-in" value={ferieInput.fine} onChange={e => setFerieInput(f => ({ ...f, fine: e.target.value }))} />
                <label className="dim-lbl">Ore richieste</label>
                <input type="number" className="dim-in" value={ferieInput.ore} onChange={e => setFerieInput(f => ({ ...f, ore: e.target.value }))} />
                <button className="timbra-btn entrata" onClick={async () => { await ProxyApi.ferieRichiesta({ username, nome, tipo: ferieForm, dataInizio: ferieInput.inizio, dataFine: ferieInput.fine || ferieInput.inizio, oreRichieste: ferieInput.ore }); setFerieForm(null); ProxyApi.ferieLettura(username).then(r => setFerieRichieste(Array.isArray(r) ? r : [])); }}>📤 Invia richiesta</button>
                <button className="timbra-btn uscita" style={{ marginTop: "0.5rem" }} onClick={() => setFerieForm(null)}>Annulla</button>
              </div>
            }
            <div className="section-label"><div className="section-title">Le mie richieste</div></div>
            {ferieRichieste.map((r: any, i: number) => (
              <div key={i} style={{ padding: "1rem", borderBottom: "1px solid var(--bg)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-dark)" }}>{r.tipo} · {r.oreRichieste}h</div>
                  <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 600 }}>{fmtDateIt(r.dataInizio)}{r.dataFine && r.dataFine !== r.dataInizio ? ` → ${fmtDateIt(r.dataFine)}` : ""}</div>
                </div>
                <div style={{ padding: "2px 10px", borderRadius: 10, fontSize: 10, fontWeight: 800, background: r.stato === "Approvata" ? "#D5F0E0" : r.stato === "Rifiutata" ? "#FCE4E4" : "#FEF3CD", color: r.stato === "Approvata" ? "#1A6B3A" : r.stato === "Rifiutata" ? "#7A1A1A" : "#7A5800" }}>{r.stato}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "Avvisi" && (
          <div>
            <div className="section-label"><div className="section-title">Comunicazioni</div></div>
            {comunicazioni.length === 0
              ? <div className="timbra-card" style={{ textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessuna comunicazione</div>
              : comunicazioni.map((c: any, i: number) => (
                <div className="ana-card" key={i} style={{ marginBottom: "0.5rem", padding: "0.9rem 1rem", opacity: c.letta ? 0.7 : 1, cursor: "pointer" }} onClick={() => !c.letta && ProxyApi.dipComunicazioneLetta(c.id).then(() => ProxyApi.dipComunicazioni(username).then(r => setComunicazioni(Array.isArray(r) ? r : [])))}>
                  <div style={{ fontSize: 14, fontWeight: c.letta ? 600 : 900, color: "var(--text-dark)" }}>{c.titolo || c.testo}</div>
                  <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 600 }}>{fmtDateIt(c.data)}</div>
                </div>
              ))
            }
          </div>
        )}

        {tab === "Documenti" && (
          <div>
            <div className="section-label"><div className="section-title">I miei documenti</div></div>
            {docs.length === 0
              ? <div className="timbra-card" style={{ textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessun documento disponibile</div>
              : docs.map((d: any, i: number) => (
                <div className="ana-card" key={i} style={{ marginBottom: "0.5rem", padding: "0.9rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-dark)" }}>{d.nome}</div>
                    <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 600 }}>{d.tipo} · {fmtDateIt(d.data)}</div>
                  </div>
                  {d.url && <a href={d.url} target="_blank" rel="noreferrer" style={{ color: "var(--teal)", fontWeight: 800, fontSize: 13 }}>↓ Scarica</a>}
                </div>
              ))
            }
          </div>
        )}

        {tab === "profilo" && (
          <div>
            <div className="section-label"><div className="section-title">Il mio profilo</div></div>
            <div className="ana-card">
              {profilo
                ? Object.entries(profilo).filter(([k]) => !["pageId", "id"].includes(k)).map(([k, v]) => (
                  <div className="ana-row" key={k}><div className="ana-label">{k}</div><div className="ana-value">{String(v || "—")}</div></div>
                ))
                : <div style={{ textAlign: "center", color: "var(--text-light)", fontWeight: 700, padding: "1rem" }}>Caricamento profilo...</div>
              }
            </div>
          </div>
        )}
      </div>

      <div className="bottom-nav">
        {navItems.map(n => (
          <div key={n.tab} className={`bnav-item ${tab === n.tab ? "active" : ""}`} onClick={() => setTab(n.tab)}>
            <div className="bnav-label">{n.label}</div>
          </div>
        ))}
        <div className="bnav-item" onClick={onLogout}><div className="bnav-label">Esci</div></div>
      </div>
    </div>
  );
}
