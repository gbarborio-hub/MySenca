import { useState } from "react";
import { ProxyApi } from "../../services/ProxyApi.js";

interface StrForm {
  pageId: string; nome: string; citta: string; indirizzo: string;
  committente: string; referente: string; email: string; telefono: string;
  lat: string; lng: string; raggio: string; attiva: boolean;
}

function nuovaStruttura(): StrForm {
  return { pageId: "", nome: "", citta: "", indirizzo: "", committente: "", referente: "", email: "", telefono: "", lat: "", lng: "", raggio: "", attiva: true };
}
function formDaStruttura(s: any): StrForm {
  return {
    pageId: s.id || "", nome: s.nome || "", citta: s.citta || "", indirizzo: s.indirizzo || "",
    committente: s.committente || "", referente: s.referente || "", email: s.email || "", telefono: s.telefono || "",
    lat: s.lat == null ? "" : String(s.lat), lng: s.lng == null ? "" : String(s.lng), raggio: s.raggio == null ? "" : String(s.raggio),
    attiva: s.attiva !== false
  };
}

interface Props {
  strutture: any[];
  loading: boolean;
  onRefresh: () => void;
}

export default function StruttureGP({ strutture, loading, onRefresh }: Props) {
  const [form, setForm] = useState<StrForm | null>(null);
  const [busy, setBusy] = useState(false);

  function setField<K extends keyof StrForm>(k: K, v: StrForm[K]) {
    setForm(f => (f ? { ...f, [k]: v } : f));
  }

  async function save() {
    if (!form) return;
    if (!form.nome.trim()) { alert("Inserisci il nome della struttura."); return; }
    setBusy(true);
    try {
      const res = await ProxyApi.strutturaSalva(form);
      setBusy(false);
      if (res && res.ok) {
        setForm(null);
        setTimeout(onRefresh, 800);
      } else {
        alert("Salvataggio non riuscito. Riprova.");
      }
    } catch {
      setBusy(false);
      alert("Errore di connessione. Riprova.");
    }
  }

  if (form) {
    return (
      <div>
        <div className="section-label"><div className="section-title">Strutture</div></div>
        <div className="ana-card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: "0.6rem", color: "var(--coral)" }}>{form.pageId ? "✏️ Modifica struttura" : "➕ Nuova struttura"}</div>
          <label className="dim-lbl">Nome struttura</label>
          <input className="dim-in" value={form.nome} onChange={e => setField("nome", e.target.value)} />
          <label className="dim-lbl">Città</label>
          <input className="dim-in" value={form.citta} onChange={e => setField("citta", e.target.value)} />
          <label className="dim-lbl">Indirizzo</label>
          <input className="dim-in" value={form.indirizzo} onChange={e => setField("indirizzo", e.target.value)} />
          <label className="dim-lbl">Committente</label>
          <input className="dim-in" value={form.committente} onChange={e => setField("committente", e.target.value)} />
          <label className="dim-lbl">Referente</label>
          <input className="dim-in" value={form.referente} onChange={e => setField("referente", e.target.value)} />
          <label className="dim-lbl">Email</label>
          <input type="email" className="dim-in" value={form.email} onChange={e => setField("email", e.target.value)} />
          <label className="dim-lbl">Telefono</label>
          <input className="dim-in" value={form.telefono} onChange={e => setField("telefono", e.target.value)} />
          <label className="dim-lbl">Latitudine GPS</label>
          <input type="number" className="dim-in" value={form.lat} onChange={e => setField("lat", e.target.value)} />
          <label className="dim-lbl">Longitudine GPS</label>
          <input type="number" className="dim-in" value={form.lng} onChange={e => setField("lng", e.target.value)} />
          <label className="dim-lbl">Raggio timbratura (metri)</label>
          <input type="number" className="dim-in" value={form.raggio} onChange={e => setField("raggio", e.target.value)} />
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.7rem", fontSize: 12, fontWeight: 700, color: "var(--text-mid)", cursor: "pointer" }}>
            <input type="checkbox" checked={form.attiva} onChange={e => setField("attiva", e.target.checked)} /> Struttura attiva
          </label>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.9rem" }}>
            <button className="ts-save" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? "Salvataggio…" : "💾 Salva"}</button>
            <button className="ts-mini" disabled={busy} onClick={() => setForm(null)}>Annulla</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-label"><div className="section-title">Strutture</div></div>
      <button className="ts-save" style={{ marginBottom: "0.7rem" }} onClick={() => setForm(nuovaStruttura())}>➕ Nuova struttura</button>
      {loading ? (
        <div className="ana-card" style={{ padding: "1rem", textAlign: "center", color: "var(--text-light)" }}>Caricamento…</div>
      ) : strutture.length === 0 ? (
        <div className="ana-card" style={{ padding: "1rem", textAlign: "center", color: "var(--text-light)" }}>Nessuna struttura. Creane una con "Nuova struttura".</div>
      ) : (
        <div className="ana-card">
          {strutture.map((s: any) => {
            const meta = [s.citta, s.indirizzo, s.raggio != null ? `raggio ${s.raggio}m` : null].filter(Boolean);
            return (
              <div className="table-row" key={s.id}>
                <div style={{ flex: 1 }}>
                  <div className="row-title">{s.nome}{s.attiva === false && <span style={{ color: "var(--text-light)", fontWeight: 600, fontSize: 11 }}> (non attiva)</span>}</div>
                  <div style={{ fontSize: 11, color: "var(--text-light)" }}>{meta.join(" · ") || "—"}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--coral)", cursor: "pointer" }} onClick={() => setForm(formDaStruttura(s))}>Modifica</div>
              </div>
            );
          })}
        </div>
      )}
      <button className="update-btn" onClick={onRefresh}>Aggiorna</button>
    </div>
  );
}
