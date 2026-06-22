import { useState, useEffect, useCallback } from "react";
import { ProxyApi } from "../../services/ProxyApi.js";

const GPT_FIGURE = ["OSS", "Infermiere", "Medico", "Coordinatore", "Educatrice", "Psicologa", "Amministrativo", "Altro"];
const GPT_COLORI: Record<string, string> = { Giallo: "#F4C430", Verde: "#27AE60", Blu: "#2E86DE", Arancio: "#E67E22", Viola: "#8E44AD", Rosa: "#E84393", Grigio: "#95A5A6", Rosso: "#C0392B", Marrone: "#8D6E63" };
const GPT_TIPI = ["Mattina", "Pomeriggio", "Notte", "Mattina+Notte", "Pomeriggio+Notte", "Riposo", "Ferie", "Affiancamento", "Coordinamento", "Altro"];
const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

function colorHex(nome: string) { return GPT_COLORI[nome] || "#1B7F7A"; }

interface LegendaItem {
  id: string; codice: string; descrizione: string; oraInizio: string; oraFine: string;
  colore: string; tipo: string; struttura?: string; figura?: string;
}
interface Props {
  strutture: any[];
  dipendenti: any[];
}

export default function GriglieTurniGP({ strutture, dipendenti }: Props) {
  const oggi = new Date();
  const [struttura, setStruttura] = useState("");
  const [figura, setFigura] = useState("");
  const [mese, setMese] = useState(oggi.getMonth() + 1);
  const [anno, setAnno] = useState(oggi.getFullYear());
  const [legenda, setLegenda] = useState<LegendaItem[]>([]);
  const [griglia, setGriglia] = useState<Record<string, Record<number, string>>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [modalCell, setModalCell] = useState<{ dip: string; day: number } | null>(null);
  const [modalSel, setModalSel] = useState("");
  const [legendOpen, setLegendOpen] = useState(false);
  const [legendEdit, setLegendEdit] = useState<LegendaItem | null>(null);

  const annoNow = new Date().getFullYear();

  const dipFiltrati = dipendenti.filter((d: any) => {
    const strutture2 = (d.struttura || "").toLowerCase().split(",").map((x: string) => x.trim()).filter(Boolean);
    const sOk = !struttura || strutture2.includes(struttura.toLowerCase());
    const fOk = !figura || (d.mansione || "").toLowerCase() === figura.toLowerCase();
    return sOk && fOk;
  });
  function dipKey(d: any) { return `${d.nome} ${d.cognome || ""}`.trim(); }

  const fetchLegenda = useCallback(() => {
    ProxyApi.legendaRead().then((data: any) => setLegenda(Array.isArray(data) ? data : []));
  }, []);

  const fetchGriglia = useCallback(() => {
    setLoading(true); setLoaded(false); setGriglia({}); setDirty({});
    ProxyApi.turniGriglia({ struttura, figura, mese, anno }).then((data: any) => {
      const raw = Array.isArray(data) ? data : (data && Array.isArray(data.turni) ? data.turni : []);
      const g: Record<string, Record<number, string>> = {};
      for (const t of raw) {
        const dip = t.Dipendente || "";
        const dt = (t.Data && t.Data.start) ? t.Data.start : "";
        const code = t.Codice || "";
        if (!dip || !dt) continue;
        const day = parseInt(dt.split("-")[2]);
        if (!g[dip]) g[dip] = {};
        g[dip][day] = code;
      }
      setGriglia(g); setLoaded(true); setLoading(false);
    }).catch(() => { setLoaded(false); setLoading(false); });
  }, [struttura, figura, mese, anno]);

  useEffect(() => { fetchLegenda(); }, [fetchLegenda]);
  useEffect(() => {
    if (struttura && figura) fetchGriglia();
    else { setLoaded(false); setGriglia({}); setDirty({}); }
  }, [struttura, figura, mese, anno, fetchGriglia]);

  function gptLeg(code: string) { return legenda.find(l => l.codice === code) || null; }

  function openCell(dip: string, day: number) {
    setModalCell({ dip, day });
    setModalSel((griglia[dip] && griglia[dip][day]) || "");
  }
  function confirmCell() {
    if (!modalCell) return;
    setGriglia(prev => {
      const next = { ...prev };
      next[modalCell.dip] = { ...(next[modalCell.dip] || {}), [modalCell.day]: modalSel || "" };
      return next;
    });
    setDirty(prev => ({ ...prev, [modalCell.dip]: true }));
    setModalCell(null);
  }

  async function saveGriglia() {
    if (!loaded) { setSaveMsg("⚠️ Griglia non ancora caricata. Premi 🔄 Aggiorna prima di salvare."); return; }
    const giorniMese = new Date(anno, mese, 0).getDate();
    const righe: any[] = [];
    for (const dip of Object.keys(dirty)) {
      const g: Record<string, string> = {};
      const row = griglia[dip] || {};
      for (let d = 1; d <= giorniMese; d++) g[String(d)] = row[d] || "";
      righe.push({ dipendente: dip, giorni: g });
    }
    if (righe.length === 0) return;
    setSaveMsg(null); setSaving(true);
    try {
      await ProxyApi.turniScrivi({ struttura, figura, mese, anno, legenda, righe });
      setSaving(false); setDirty({});
      setTimeout(fetchGriglia, 2500);
    } catch {
      setSaving(false);
    }
  }

  function openLegendEdit(item: LegendaItem | null) {
    setLegendEdit(item ? { ...item } : { id: "", codice: "", descrizione: "", oraInizio: "", oraFine: "", colore: "Giallo", tipo: "Mattina", struttura, figura });
  }
  async function saveLeg() {
    if (!legendEdit || !legendEdit.codice) { alert("Inserisci almeno il codice"); return; }
    const payload = {
      action: legendEdit.id ? "update" : "create", pageId: legendEdit.id,
      codice: legendEdit.codice, descrizione: legendEdit.descrizione,
      oraInizio: legendEdit.oraInizio, oraFine: legendEdit.oraFine,
      colore: legendEdit.colore, tipo: legendEdit.tipo,
      struttura: legendEdit.struttura || "", figura: legendEdit.figura || ""
    };
    try {
      await ProxyApi.legendaScrivi(payload);
      setLegendEdit(null);
      setTimeout(fetchLegenda, 1500);
    } catch (err: any) {
      alert(err?.message || "Errore nel salvataggio. Riprova.");
    }
  }
  async function delLeg(id: string) {
    if (!confirm("Eliminare questo tipo di turno?")) return;
    try {
      await ProxyApi.legendaScrivi({ action: "delete", pageId: id });
      setTimeout(fetchLegenda, 1500);
    } catch (err: any) {
      alert(err?.message || "Errore nell'eliminazione. Riprova.");
    }
  }

  const giorniMese = new Date(anno, mese, 0).getDate();
  const nDirty = Object.keys(dirty).length;

  return (
    <div>
      <div className="section-label"><div className="section-title">Quadro turni</div></div>

      <div className="gpt-toolbar">
        <select className="gpt-sel" value={struttura} onChange={e => setStruttura(e.target.value)}>
          <option value="">— Seleziona struttura —</option>
          {strutture.map((s: any) => <option key={s.id || s.nome} value={s.nome}>{s.nome}</option>)}
        </select>
        <select className="gpt-sel" value={figura} onChange={e => setFigura(e.target.value)}>
          <option value="">— Seleziona ruolo —</option>
          {GPT_FIGURE.map(f => <option key={f}>{f}</option>)}
        </select>
        <select className="gpt-sel" value={mese} onChange={e => setMese(parseInt(e.target.value))}>
          {MESI.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select className="gpt-sel" style={{ maxWidth: 90 }} value={anno} onChange={e => setAnno(parseInt(e.target.value))}>
          {[annoNow - 1, annoNow, annoNow + 1].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="gpt-refresh" disabled={loading} onClick={() => { fetchLegenda(); if (struttura && figura) fetchGriglia(); }}>
          {loading ? "⏳" : "🔄"} Aggiorna
        </button>
      </div>

      <div className="gpt-legend">
        {legenda.map(l => (
          <div key={l.id} className="gpt-chip" style={{ background: colorHex(l.colore) }}>{l.codice}{l.oraInizio ? ` ${l.oraInizio}-${l.oraFine}` : ""}</div>
        ))}
        <div className="gpt-legend-btn" onClick={() => setLegendOpen(true)}>⚙ Gestisci legenda</div>
      </div>

      {!struttura || !figura ? (
        <div className="timbra-card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-light)", fontWeight: 700 }}>
          👆 Seleziona <b>struttura</b> e <b>ruolo</b> per visualizzare e modificare i turni.
        </div>
      ) : loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "30vh" }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></div>
        </div>
      ) : dipFiltrati.length === 0 ? (
        <div className="timbra-card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-light)", fontWeight: 700 }}>
          Nessun dipendente per i filtri selezionati.<br /><span style={{ fontSize: 12 }}>Verifica struttura e figura professionale.</span>
        </div>
      ) : (
        <>
          <div className="gpt-grid-wrap">
            <table className="gpt-table">
              <thead>
                <tr>
                  <th className="gpt-name-col">Dipendente</th>
                  {Array.from({ length: giorniMese }, (_, i) => i + 1).map(d => {
                    const dow = new Date(anno, mese - 1, d).getDay();
                    return <th key={d} className={dow === 0 || dow === 6 ? "gpt-we" : ""}>{d}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {dipFiltrati.map((dipObj: any) => {
                  const key = dipKey(dipObj);
                  const isDirty = dirty[key];
                  const row = griglia[key] || {};
                  return (
                    <tr key={key}>
                      <td className={`gpt-name${isDirty ? " gpt-dirty" : ""}`}>{key}</td>
                      {Array.from({ length: giorniMese }, (_, i) => i + 1).map(d => {
                        const dow = new Date(anno, mese - 1, d).getDay();
                        const we = dow === 0 || dow === 6;
                        const code = row[d] || "";
                        const l = code ? gptLeg(code) : null;
                        const style = l ? { background: colorHex(l.colore) } : (code ? { background: "#7A9999" } : {});
                        return (
                          <td key={d}>
                            <div className={`gpt-cell${code ? "" : " empty"}${we ? " we" : ""}`} style={style} onClick={() => openCell(key, d)}>
                              {code || "·"}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button className="gpt-save" disabled={nDirty === 0 || saving || !loaded} onClick={saveGriglia}>
            {saving ? "Salvataggio in corso..." : !loaded ? "Caricamento griglia..." : nDirty > 0 ? `Salva su Notion (${nDirty} ${nDirty === 1 ? "riga modificata" : "righe modificate"})` : "Nessuna modifica"}
          </button>
          {saveMsg && <div style={{ marginTop: "0.5rem", padding: "0.6rem", borderRadius: 10, background: "#FEF3CD", color: "#7A5800", fontSize: 12, fontWeight: 700, textAlign: "center" }}>{saveMsg}</div>}
        </>
      )}

      {modalCell && (
        <div className="gpt-modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setModalCell(null); }}>
          <div className="gpt-modal">
            <div className="gpt-modal-title">{modalCell.dip} — {modalCell.day} {MESI[mese - 1]}</div>
            <div className="gpt-shift-grid">
              {legenda.map(l => (
                <div key={l.id} className={`gpt-shift-opt${modalSel === l.codice ? " selected" : ""}`} style={{ background: colorHex(l.colore) }} onClick={() => setModalSel(l.codice)}>
                  {l.codice}
                  <span className="gpt-shift-sub">{l.descrizione || ""}{l.oraInizio ? <><br />{l.oraInizio}-{l.oraFine}</> : null}</span>
                </div>
              ))}
              <div className={`gpt-shift-opt${modalSel === "" ? " selected" : ""}`} style={{ background: "#C4DADA", color: "var(--text-mid)" }} onClick={() => setModalSel("")}>
                ✕<span className="gpt-shift-sub">Vuoto</span>
              </div>
            </div>
            <button className="gpt-save" onClick={confirmCell}>Conferma</button>
          </div>
        </div>
      )}

      {legendOpen && (
        <div className="gpt-modal-bg" onClick={(e) => { if (e.target === e.currentTarget) { setLegendOpen(false); setLegendEdit(null); } }}>
          <div className="gpt-modal">
            <div className="gpt-modal-title">Legenda turni</div>
            <div style={{ fontSize: 11.5, color: "var(--text-light)", fontWeight: 600, marginBottom: "0.6rem" }}>
              I tipi senza struttura/figura valgono per tutti. Quelli creati qui valgono per <b>{struttura || "tutte le strutture"} · {figura}</b>.
            </div>
            {legendEdit ? (
              <>
                <input className="gpt-mini-input" placeholder="Codice (es. M)" maxLength={5} value={legendEdit.codice} onChange={e => setLegendEdit(le => le && { ...le, codice: e.target.value })} />
                <input className="gpt-mini-input" placeholder="Descrizione (es. Mattina)" value={legendEdit.descrizione} onChange={e => setLegendEdit(le => le && { ...le, descrizione: e.target.value })} />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input className="gpt-mini-input" placeholder="Inizio (07:00)" value={legendEdit.oraInizio} onChange={e => setLegendEdit(le => le && { ...le, oraInizio: e.target.value })} />
                  <input className="gpt-mini-input" placeholder="Fine (14:00)" value={legendEdit.oraFine} onChange={e => setLegendEdit(le => le && { ...le, oraFine: e.target.value })} />
                </div>
                <div className="gpt-color-row">
                  {Object.keys(GPT_COLORI).map(cn => (
                    <div key={cn} className={`gpt-color-dot${legendEdit.colore === cn ? " selected" : ""}`} style={{ background: GPT_COLORI[cn] }} title={cn} onClick={() => setLegendEdit(le => le && { ...le, colore: cn })} />
                  ))}
                </div>
                <select className="gpt-mini-input" value={legendEdit.tipo} onChange={e => setLegendEdit(le => le && { ...le, tipo: e.target.value })}>
                  {GPT_TIPI.map(t => <option key={t}>{t}</option>)}
                </select>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="gpt-save" style={{ background: "var(--white)", color: "var(--text-mid)", border: "1.5px solid var(--cyan-light)" }} onClick={() => setLegendEdit(null)}>Annulla</button>
                  <button className="gpt-save" onClick={saveLeg}>{legendEdit.id ? "Salva modifiche" : "Crea tipo turno"}</button>
                </div>
              </>
            ) : (
              <>
                {legenda.map(l => (
                  <div key={l.id} className="gpt-leg-row">
                    <div className="gpt-chip" style={{ background: colorHex(l.colore) }}>{l.codice}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                      {l.descrizione || ""}
                      <div style={{ fontSize: 10.5, color: "var(--text-light)" }}>{l.oraInizio ? `${l.oraInizio}-${l.oraFine}` : "—"} · {l.struttura || "tutte"} · {l.figura || "tutte"}</div>
                    </div>
                    <div className="gpt-leg-actions">
                      <button className="gpt-leg-btn" onClick={() => openLegendEdit(l)}>Modifica</button>
                      <button className="gpt-leg-btn del" onClick={() => delLeg(l.id)}>Elimina</button>
                    </div>
                  </div>
                ))}
                <button className="gpt-save" style={{ marginTop: "0.75rem" }} onClick={() => openLegendEdit(null)}>+ Nuovo tipo turno</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
