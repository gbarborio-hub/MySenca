import { useState, useEffect, useCallback } from "react";
import { AmministratoriApi } from "../../services/AmministratoriApi.js";
import type { Amministratore, TipoAmministratore } from "../../services/AmministratoriApi.js";

function fmtDateIt(d: string | null) {
  if (!d) return "—";
  const parts = d.split("T")[0].split("-");
  if (parts.length < 3) return "—";
  const [y, m, dd] = parts;
  return `${dd}/${m}/${y}`;
}

interface NewForm { nome: string; email: string; mansione: string; tipo: TipoAmministratore; societaEsterna: string; note: string }
function nuovoForm(): NewForm { return { nome: "", email: "", mansione: "", tipo: "Interno", societaEsterna: "", note: "" }; }

export default function AmministratoriGP() {
  const [items, setItems] = useState<Amministratore[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Amministratore | null>(null);
  const [noteEdit, setNoteEdit] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [form, setForm] = useState<NewForm | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    AmministratoriApi.list().then(r => { setItems(Array.isArray(r) ? r : []); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function creaAmministratore() {
    if (!form || !form.nome.trim()) { alert("Inserisci nome e cognome."); return; }
    if (form.tipo === "Interno" && !form.email.trim()) {
      if (!confirm("Senza email non sarà possibile inviare automaticamente la nomina. Continuare comunque?")) return;
    }
    setCreating(true);
    try {
      const res = await AmministratoriApi.create(form);
      if (res.ok) { setForm(null); load(); }
      else alert(res.error || "Errore nella creazione.");
    } catch (err: any) {
      alert(err?.message || "Errore nella creazione.");
    } finally {
      setCreating(false);
    }
  }

  async function salvaNota() {
    if (!detail) return;
    setNoteSaving(true);
    setNoteSaved(false);
    try {
      await AmministratoriApi.update(detail.pageId, { note: noteEdit });
      setDetail({ ...detail, note: noteEdit });
      setItems(prev => prev.map(x => x.pageId === detail.pageId ? { ...x, note: noteEdit } : x));
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch (err: any) {
      alert(err?.message || "Errore nel salvataggio. Riprova.");
    } finally {
      setNoteSaving(false);
    }
  }

  async function toggleNominaFirmata(a: Amministratore) {
    try {
      await AmministratoriApi.update(a.pageId, { nominaFirmata: !a.nominaFirmata });
      setDetail(prev => prev ? { ...prev, nominaFirmata: !prev.nominaFirmata } : prev);
      load();
    } catch (err: any) {
      alert(err?.message || "Errore nell'operazione. Riprova.");
    }
  }

  async function eliminaAmministratore(a: Amministratore) {
    if (!confirm(`Eliminare "${a.nome}" dal registro amministratori di sistema?`)) return;
    try {
      await AmministratoriApi.elimina(a.pageId);
      setDetail(null);
      load();
    } catch (err: any) {
      alert(err?.message || "Errore nell'eliminazione.");
    }
  }

  if (detail) {
    return (
      <div>
        <button onClick={() => setDetail(null)} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 800, color: "var(--teal)", cursor: "pointer", fontFamily: "Satoshi,sans-serif", marginBottom: "0.5rem" }}>← Indietro</button>

        <div style={{ background: "var(--teal-dark)", borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: "white" }}>{detail.nome}</div>
          {detail.mansione && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>{detail.mansione}</div>}
          <div style={{ display: "inline-block", marginTop: 8, padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 800, background: detail.tipo === "Interno" ? "#DDEEFF" : "#FEF3CD", color: detail.tipo === "Interno" ? "#1A4A7A" : "#7A5800" }}>
            {detail.tipo || "—"}
          </div>
        </div>

        <div className="ana-card" style={{ marginBottom: "0.75rem" }}>
          {detail.email && <div className="ana-row"><div className="ana-label">Email</div><div className="ana-value">{detail.email}</div></div>}
          {detail.tipo === "Esterno" && detail.societaEsterna && <div className="ana-row"><div className="ana-label">Società</div><div className="ana-value">{detail.societaEsterna}</div></div>}
          <div className="ana-row"><div className="ana-label">Data nomina</div><div className="ana-value">{fmtDateIt(detail.dataNomina)}</div></div>
        </div>

        {detail.tipo === "Interno" ? (
          <div className="ana-card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
            <div style={{ fontSize: 12, color: "var(--text-light)", marginBottom: 8 }}>La nomina viene inviata automaticamente via email alla creazione dell'anagrafica, usando l'ultimo modello caricato in "Documentazione privacy".</div>
            <button onClick={() => toggleNominaFirmata(detail)} style={{ padding: "0.6rem 1rem", background: detail.nominaFirmata ? "#D5F0E0" : "#FEF3CD", color: detail.nominaFirmata ? "#1A6B3A" : "#7A5800", border: "none", borderRadius: 16, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
              {detail.nominaFirmata ? "✅ Nomina firmata" : "⏳ Segna come firmata"}
            </button>
          </div>
        ) : (
          <div className="ana-card" style={{ padding: "1rem", marginBottom: "0.75rem", background: "#FEF3CD" }}>
            <div style={{ fontSize: 12, color: "#7A5800", fontWeight: 700 }}>ℹ️ Amministratore esterno: la nomina è implicita nel contratto sottoscritto, nessun invio automatico previsto.</div>
          </div>
        )}

        <div className="ana-card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-dark)", marginBottom: 6 }}>📝 Note</div>
          <textarea className="dim-in" rows={4} placeholder="Annotazioni interne..." value={noteEdit} onChange={e => setNoteEdit(e.target.value)} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.5rem" }}>
            <button className="ts-save" disabled={noteSaving || noteEdit === detail.note} onClick={salvaNota}>{noteSaving ? "Salvataggio..." : "💾 Salva nota"}</button>
            {noteSaved && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-dark)" }}>✅ Salvata</span>}
          </div>
        </div>

        <button onClick={() => eliminaAmministratore(detail)} style={{ marginTop: "0.5rem", padding: "0.7rem", width: "100%", background: "none", border: "1.5px solid #E8603A", borderRadius: 20, color: "#E8603A", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Satoshi,sans-serif" }}>🗑 Elimina amministratore</button>
      </div>
    );
  }

  return (
    <div>
      <div className="section-label"><div className="section-title">Amministratori di sistema</div></div>

      {form ? (
        <div className="ana-card" style={{ padding: "1rem", border: "1.5px solid var(--cyan)", marginBottom: "0.75rem" }}>
          <label className="dim-lbl">Nome e cognome *</label>
          <input className="dim-in" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          <label className="dim-lbl">Email</label>
          <input className="dim-in" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <label className="dim-lbl">Mansione</label>
          <input className="dim-in" value={form.mansione} onChange={e => setForm({ ...form, mansione: e.target.value })} />
          <label className="dim-lbl">Tipo</label>
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.6rem" }}>
            {(["Interno", "Esterno"] as const).map(t => (
              <button key={t} type="button" onClick={() => setForm({ ...form, tipo: t })} className={`com-pill${form.tipo === t ? " on" : ""}`}>{t}</button>
            ))}
          </div>
          {form.tipo === "Esterno" && (
            <>
              <label className="dim-lbl">Società di appartenenza</label>
              <input className="dim-in" value={form.societaEsterna} onChange={e => setForm({ ...form, societaEsterna: e.target.value })} />
            </>
          )}
          <label className="dim-lbl">Note</label>
          <textarea className="dim-in" rows={3} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          {form.tipo === "Interno" && (
            <div style={{ fontSize: 11, color: "var(--text-light)", margin: "0.4rem 0 0.2rem" }}>Alla creazione verrà inviata automaticamente via email la nomina ad amministratore di sistema.</div>
          )}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
            <button className="ts-save" disabled={creating} onClick={creaAmministratore}>{creating ? "Creazione..." : "➕ Crea"}</button>
            <button className="ts-cancel" onClick={() => setForm(null)}>Annulla</button>
          </div>
        </div>
      ) : (
        <button className="ts-add" onClick={() => setForm(nuovoForm())}>➕ Aggiungi amministratore</button>
      )}

      {loading ? (
        <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)" }}>Caricamento...</div>
      ) : items.length === 0 ? (
        <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessun amministratore registrato</div>
      ) : (
        <div className="table-card">
          {items.map((a, i) => (
            <div className="table-row" key={i} style={{ cursor: "pointer" }} onClick={() => { setDetail(a); setNoteEdit(a.note); setNoteSaved(false); }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row-title">{a.nome}</div>
                <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>{a.mansione || ""}{a.tipo === "Esterno" && a.societaEsterna ? ` · ${a.societaEsterna}` : ""}</div>
              </div>
              <div style={{ padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 800, background: a.tipo === "Interno" ? "#DDEEFF" : "#FEF3CD", color: a.tipo === "Interno" ? "#1A4A7A" : "#7A5800", whiteSpace: "nowrap", flexShrink: 0 }}>
                {a.tipo || "—"}
              </div>
            </div>
          ))}
        </div>
      )}
      <button className="update-btn" onClick={load}>Aggiorna</button>
    </div>
  );
}
