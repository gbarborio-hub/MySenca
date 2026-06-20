import { useState, useEffect, useCallback } from "react";
import { ProxyApi } from "../../services/ProxyApi.js";
import { calcMaggiorazioni, isFestivo, fmtDateIt } from "./exportPdfHelpers.js";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekStart(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow + offset * 7);
  return d;
}
function hm(x: string | undefined): number | null {
  const p = String(x || "").split(":");
  const h = parseInt(p[0]);
  const m = parseInt(p[1]);
  if (isNaN(h)) return null;
  return h * 60 + (isNaN(m) ? 0 : m);
}
function timbInterval(t: { data: string; oraEntrata?: string; oraUscita?: string }): { start: number; end: number } | null {
  const s = hm(t.oraEntrata), e0 = hm(t.oraUscita);
  if (!t.data || s === null || e0 === null) return null;
  let e = e0;
  if (e <= s) e += 1440;
  const startTs = new Date(`${String(t.data).split("T")[0]}T00:00:00`).getTime() + s * 60000;
  return { start: startTs, end: startTs + (e - s) * 60000 };
}
function overlaps(a: { start: number; end: number } | null, b: { start: number; end: number } | null): boolean {
  return !!(a && b && a.start < b.end && b.start < a.end);
}

function parseTimbratureGP(raw: unknown): any[] {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map((it: any) => ({
    id: it.id || "", data: String(it.data || "").split("T")[0],
    oraEntrata: it.oraEntrata || "", oraUscita: it.oraUscita || "",
    approvazione: it.approvazione || "", struttura: it.struttura || "",
    eliminata: it.eliminata || false, eliminataDa: it.eliminataDa || "", motivoRimozione: it.motivoRimozione || ""
  })).filter((x: any) => x.data);
}
function parseTurniGP(raw: unknown): any[] {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map((item: any) => {
    const p = item && item.properties_value ? item.properties_value : item || {};
    const dataRaw = (p.Data && p.Data.start) ? p.Data.start : (typeof item.data === "string" ? item.data : "");
    const data = dataRaw ? String(dataRaw).split("T")[0] : "";
    const oraInizio = typeof p["Ora inizio"] === "string" ? p["Ora inizio"] : (item.oraInizio || "");
    const oraFine = typeof p["Ora fine"] === "string" ? p["Ora fine"] : (item.oraFine || "");
    return { data, oraInizio, oraFine };
  }).filter((t: any) => t.data);
}

function Chip({ txt, col }: { txt: string; col: string }) {
  return <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 10, background: `${col}22`, color: col }}>{txt}</span>;
}
function TotRow({ lbl, val }: { lbl: string; val: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
      <span style={{ color: "var(--text-mid)", fontWeight: 600 }}>{lbl}</span>
      <span style={{ fontWeight: 800, color: "var(--text-dark)" }}>{val.toFixed(2)} h</span>
    </div>
  );
}

interface TsForm { mode: "add" | "edit"; pageId: string | null; data: string; struttura: string; oraEntrata: string; oraUscita: string }

interface Props {
  dipendente: any; // GP_DIP_DETAIL
  strutture: any[];
}

export default function TimesheetGP({ dipendente, strutture }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [timb, setTimb] = useState<any[]>([]);
  const [turni, setTurni] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tsForm, setTsForm] = useState<TsForm | null>(null);
  const [tsErr, setTsErr] = useState<string | null>(null);
  const [tsSaving, setTsSaving] = useState(false);
  const [tsBusy, setTsBusy] = useState<string | null>(null);

  const loadData = useCallback(() => {
    if (!dipendente.username) { setTimb([]); setLoading(false); return; }
    setLoading(true);
    Promise.all([
      ProxyApi.gpTimbrature({ username: dipendente.username, includeDeleted: true }).catch(() => []),
      ProxyApi.turniRead(`${dipendente.nome || ""} ${dipendente.cognome || ""}`.trim()).catch(() => [])
    ]).then(([t, tu]) => {
      setTimb(parseTimbratureGP(t));
      setTurni(parseTurniGP(tu));
      setLoading(false);
    });
  }, [dipendente.username, dipendente.nome, dipendente.cognome]);

  useEffect(() => { loadData(); }, [loadData]);

  function openAdd() {
    setTsForm({ mode: "add", pageId: null, data: ymd(new Date()), struttura: (dipendente.struttura || "").split(",")[0].trim(), oraEntrata: "", oraUscita: "" });
    setTsErr(null);
  }
  function openEdit(id: string) {
    const t = timb.find((x: any) => x.id === id);
    if (!t) return;
    setTsForm({ mode: "edit", pageId: id, data: t.data, struttura: t.struttura || "", oraEntrata: t.oraEntrata || "", oraUscita: t.oraUscita || "" });
    setTsErr(null);
  }
  function cancelForm() { setTsForm(null); setTsErr(null); }

  async function deleteTimb(id: string) {
    if (!confirm("Archiviare questa timbratura? Resta conservata in archivio a norma di legge e non sarà più conteggiata. L'operazione viene registrata col tuo nome.")) return;
    setTsBusy(id);
    try {
      await ProxyApi.timbraturaUpdate({ action: "elimina", pageId: id, motivo: "Cancellata" });
      setTsBusy(null);
      setTimeout(loadData, 1000);
    } catch {
      setTsBusy(null);
      alert("Errore nell'archiviazione. Riprova.");
    }
  }

  async function saveForm() {
    if (!tsForm) return;
    const { data, struttura, oraEntrata, oraUscita } = tsForm;
    if (!data || !struttura || !oraEntrata || !oraUscita) { setTsErr("⚠️ Compila data, struttura, entrata e uscita."); return; }

    const s = hm(oraEntrata);
    let e = hm(oraUscita);
    if (s === null || e === null) { setTsErr("⚠️ Orari non validi."); return; }
    if (e <= s) e += 1440;
    const entrataDt = new Date(`${data}T${oraEntrata}:00`);
    const uscitaDt = new Date(entrataDt.getTime() + (e - s) * 60000);
    if (uscitaDt > new Date()) { setTsErr("⚠️ Non puoi inserire orari nel futuro."); return; }

    const newIv = timbInterval({ data, oraEntrata, oraUscita });
    for (const ex of timb) {
      if (tsForm.mode === "edit" && ex.id === tsForm.pageId) continue;
      if (ex.eliminata) continue;
      if (ex.approvazione === "Rifiutata" || ex.approvazione === "Rifiutato") continue;
      if (overlaps(newIv, timbInterval(ex))) {
        setTsErr(`⛔ Si sovrappone alla timbratura del ${fmtDateIt(ex.data)} (${ex.oraEntrata || "?"}–${ex.oraUscita || "?"}). Modifica gli orari.`);
        return;
      }
    }

    const nome = `${dipendente.nome || ""} ${dipendente.cognome || ""}`.trim();
    const ore = Math.round((e - s) / 60 * 100) / 100;
    const payload = {
      nome, username: dipendente.username || "", struttura, data, oraEntrata, oraUscita, oreTotali: ore,
      stato: tsForm.mode === "edit" ? "Modificata ufficio" : "Inserita ufficio", approvazione: "Approvata", turno: "",
      note: tsForm.mode === "edit" ? "Modificata da ufficio personale - originale archiviata" : "Inserita da ufficio personale",
      lat: null, lng: null
    };
    setTsSaving(true); setTsErr(null);
    try {
      if (tsForm.mode === "edit" && tsForm.pageId) {
        await ProxyApi.timbraturaUpdate({ action: "elimina", pageId: tsForm.pageId, motivo: "Modificata" });
      }
      await ProxyApi.timbra(payload);
      setTsForm(null); setTsSaving(false);
      setTimeout(loadData, 1100);
    } catch {
      setTsSaving(false);
      setTsErr("⚠️ Errore nel salvataggio. Riprova.");
    }
  }

  const ws = weekStart(weekOffset);
  const we = new Date(ws.getTime() + 6 * 86400000);
  const giorni = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
  const tot = { ore: 0, nott: 0, fest: 0, festNott: 0, straord: 0 };

  if (loading) {
    return (
      <div>
        <div className="section-label"><div className="section-title">Timbrature settimanali</div></div>
        <div className="timbra-card" style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-light)", fontWeight: 700 }}>Caricamento...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-label"><div className="section-title">Timbrature settimanali</div></div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem", gap: "0.5rem" }}>
        <button className="ts-nav" onClick={() => setWeekOffset(o => o - 1)}>←</button>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-dark)", textAlign: "center", flex: 1 }}>{fmtDateIt(ymd(ws))} – {fmtDateIt(ymd(we))}</div>
        <button className="ts-nav" disabled={weekOffset >= 0} onClick={() => setWeekOffset(o => o + 1)}>→</button>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 12, fontWeight: 700, color: "var(--text-mid)", marginBottom: "0.6rem", cursor: "pointer" }}>
        <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} style={{ width: 16, height: 16 }} /> Mostra timbrature eliminate e rifiutate
      </label>

      {tsForm ? (
        <div className="ana-card" style={{ padding: "0.85rem 1rem", marginBottom: "0.6rem", border: "1.5px solid var(--cyan)" }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "var(--teal-dark)", marginBottom: "0.4rem" }}>{tsForm.mode === "edit" ? "✏️ Modifica timbratura" : "➕ Nuova timbratura"}</div>
          {tsForm.mode === "edit" && <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600, marginBottom: "0.5rem" }}>L'originale verrà archiviata (resta nell'archivio a norma di legge) e sostituita da questa versione corretta.</div>}
          <label className="dim-lbl">Data</label>
          <input type="date" className="dim-in" max={ymd(new Date())} value={tsForm.data} onChange={e => setTsForm(f => f && { ...f, data: e.target.value })} />
          <label className="dim-lbl">Struttura</label>
          <select className="dim-in" value={tsForm.struttura} onChange={e => setTsForm(f => f && { ...f, struttura: e.target.value })}>
            <option value="">-- Seleziona --</option>
            {strutture.map((s: any) => <option key={s.id || s.nome} value={s.nome}>{s.nome}</option>)}
          </select>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <div style={{ flex: 1 }}><label className="dim-lbl">Entrata</label><input type="time" className="dim-in" value={tsForm.oraEntrata} onChange={e => setTsForm(f => f && { ...f, oraEntrata: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label className="dim-lbl">Uscita</label><input type="time" className="dim-in" value={tsForm.oraUscita} onChange={e => setTsForm(f => f && { ...f, oraUscita: e.target.value })} /></div>
          </div>
          {tsErr && <div style={{ marginTop: "0.5rem", fontSize: 12, fontWeight: 700, color: "#7A1A1A" }}>{tsErr}</div>}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem" }}>
            <button className="ts-save" disabled={tsSaving} onClick={saveForm}>{tsSaving ? "Salvataggio..." : "💾 Salva"}</button>
            <button className="ts-cancel" onClick={cancelForm}>Annulla</button>
          </div>
        </div>
      ) : (
        <button className="ts-add" onClick={openAdd}>➕ Aggiungi timbratura</button>
      )}

      <div className="ana-card">
        {giorni.map((nomeGiorno, gi) => {
          const dayDate = new Date(ws.getTime() + gi * 86400000);
          const dayStr = ymd(dayDate);
          const festDay = isFestivo(dayDate);
          const dayTimb = timb
            .filter((t: any) => {
              const hid = t.eliminata || t.approvazione === "Rifiutata" || t.approvazione === "Rifiutato";
              return t.data === dayStr && (showDeleted || !hid);
            })
            .sort((a: any, b: any) => ((a.oraEntrata || "") < (b.oraEntrata || "") ? -1 : 1));
          let dayOre = 0;

          return (
            <div key={gi} style={{ padding: "0.7rem 1rem", borderBottom: "1px solid var(--bg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: festDay ? "#C0392B" : "var(--text-dark)" }}>
                  {nomeGiorno} <span style={{ fontWeight: 600, color: "var(--text-light)", fontSize: 11 }}>{fmtDateIt(dayStr)}</span>
                </div>
              </div>
              {dayTimb.length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600, marginTop: 2 }}>Nessuna timbratura</div>
              ) : dayTimb.map((t: any, ti: number) => {
                const mg = calcMaggiorazioni({ data: dayStr, oraEntrata: t.oraEntrata, oraUscita: t.oraUscita }, turni);
                const rifiutata = t.approvazione === "Rifiutata" || t.approvazione === "Rifiutato";
                const conta = (t.approvazione === "Regolare" || t.approvazione === "Approvata") && !t.eliminata;
                const isLive = !t.eliminata && !rifiutata;
                if (conta) { tot.ore += mg.ore; tot.nott += mg.nott; tot.fest += mg.fest; tot.festNott += mg.festNott; tot.straord += mg.straord; dayOre += mg.ore; }
                return (
                  <div key={ti} style={{ marginTop: 6, opacity: conta ? 1 : ((t.eliminata || rifiutata) ? 0.5 : 0.65) }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dark)", textDecoration: (t.eliminata || rifiutata) ? "line-through" : "none" }}>{t.oraEntrata || "—"} → {t.oraUscita || "—"}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: conta ? "var(--teal)" : "var(--text-light)" }}>{mg.ore.toFixed(2)}h</div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {t.eliminata && <Chip txt={`${t.motivoRimozione === "Modificata" ? "✏️ Modificata" : "🗑 Cancellata"}${t.eliminataDa ? ` da ${t.eliminataDa}` : ""} · non conteggiata`} col={t.motivoRimozione === "Modificata" ? "#8A5A00" : "#7A1A1A"} />}
                      {!t.eliminata && rifiutata && <Chip txt="❌ Rifiutata · non conteggiata" col="#7A1A1A" />}
                      {!t.eliminata && !rifiutata && conta && mg.nott > 0 && <Chip txt={`🌙 Nott ${mg.nott.toFixed(2)}h`} col="#2E86DE" />}
                      {!t.eliminata && !rifiutata && conta && mg.fest > 0 && <Chip txt={`🎉 Fest ${mg.fest.toFixed(2)}h`} col="#E67E22" />}
                      {!t.eliminata && !rifiutata && conta && mg.festNott > 0 && <Chip txt={`Fest.Nott ${mg.festNott.toFixed(2)}h`} col="#8E44AD" />}
                      {!t.eliminata && !rifiutata && conta && mg.straord > 0 && <Chip txt={`⏱ Straord ${mg.straord.toFixed(2)}h`} col="#C0392B" />}
                      {!t.eliminata && !rifiutata && !conta && t.approvazione === "Necessaria approvazione" && <Chip txt="⏳ Da approvare · non conteggiata" col="#7A5800" />}
                    </div>
                    {isLive && (
                      <div style={{ display: "flex", gap: "0.4rem", marginTop: 6 }}>
                        <button className="ts-mini" onClick={() => openEdit(t.id)}>✏️ Modifica</button>
                        <button className="ts-mini del" disabled={tsBusy === t.id} onClick={() => deleteTimb(t.id)}>{tsBusy === t.id ? "..." : "🗑 Elimina"}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="ana-card" style={{ marginTop: "0.5rem", background: "var(--cyan-light)" }}>
        <div style={{ padding: "0.85rem 1rem" }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "var(--teal-dark)", marginBottom: 6 }}>Totali settimana</div>
          <TotRow lbl="Ore totali" val={tot.ore} />
          <TotRow lbl="di cui notturne (22–06)" val={tot.nott} />
          <TotRow lbl="di cui festive (dom./festivi)" val={tot.fest} />
          <TotRow lbl="di cui festive notturne" val={tot.festNott} />
          <TotRow lbl="di cui straordinario (fuori turno)" val={tot.straord} />
        </div>
      </div>
    </div>
  );
}
