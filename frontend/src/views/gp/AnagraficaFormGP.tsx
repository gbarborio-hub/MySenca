import { useState } from "react";
import { DipendentiApi } from "../../services/DipendentiApi.js";

const GP_DIP_MANSIONI = ["OSS", "Infermiere", "Medico", "Coordinatore", "Educatrice", "Psicologa", "Amministrativo", "Altro"];
const GP_DIP_CONTRATTI = ["Dipendente", "Libero professionista", "Tirocinio", "Altro"];

export interface AnagFormData {
  pageId: string; nome: string; cognome: string; cf: string; nascita: string;
  email: string; telefono: string; username: string; matricola: string;
  mansione: string; contratto: string; struttura: string; strutture: string[];
  oreSettimanali: string | number; attivo: boolean; note: string;
  dataAssunzione: string; monteFerie: string | number; monteRol: string | number;
  residuoFerieIniz: string | number; residuoRolIniz: string | number;
}

export function nuovoForm(): AnagFormData {
  return {
    pageId: "", nome: "", cognome: "", cf: "", nascita: "", email: "", telefono: "",
    username: "", matricola: "", mansione: "", contratto: "", struttura: "", strutture: [],
    oreSettimanali: "", attivo: true, note: "", dataAssunzione: "",
    monteFerie: "", monteRol: "", residuoFerieIniz: "", residuoRolIniz: ""
  };
}
export function formDaDipendente(d: any): AnagFormData {
  return {
    pageId: d.pageId || "", nome: d.nome || "", cognome: d.cognome || "", cf: d.cf || "",
    nascita: d.nascita || "", email: d.email || "", telefono: d.telefono || "",
    username: d.username || "", matricola: d.matricola || "", mansione: d.mansione || "",
    contratto: d.contratto || "", struttura: d.struttura || "",
    strutture: d.struttura ? d.struttura.split(",").map((x: string) => x.trim()).filter(Boolean) : [],
    oreSettimanali: (d.oreSettimanali === 0 || d.oreSettimanali) ? d.oreSettimanali : "",
    attivo: d.attivo !== false, note: d.note || "", dataAssunzione: d.dataAssunzione || "",
    monteFerie: (d.monteFerie === 0 || d.monteFerie) ? d.monteFerie : "",
    monteRol: (d.monteRol === 0 || d.monteRol) ? d.monteRol : "",
    residuoFerieIniz: (d.residuoFerieIniz === 0 || d.residuoFerieIniz) ? d.residuoFerieIniz : "",
    residuoRolIniz: (d.residuoRolIniz === 0 || d.residuoRolIniz) ? d.residuoRolIniz : ""
  };
}

interface Props {
  form: AnagFormData;
  strutture: any[];
  onSaved: () => void;
  onCancel: () => void;
}

export default function AnagraficaFormGP({ form: initialForm, strutture, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<AnagFormData>(initialForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isEdit = !!form.pageId;

  function setField<K extends keyof AnagFormData>(k: K, v: AnagFormData[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }
  function toggleStruttura(nome: string) {
    setForm(f => {
      const i = f.strutture.indexOf(nome);
      const next = i >= 0 ? f.strutture.filter(x => x !== nome) : [...f.strutture, nome];
      return { ...f, strutture: next };
    });
  }

  async function save() {
    if (!form.nome.trim()) { setErr("⚠️ Il nome è obbligatorio."); return; }
    if (!form.cognome.trim()) { setErr("⚠️ Il cognome è obbligatorio."); return; }
    setErr(null); setSaving(true);

    const payload: any = { ...form, struttura: form.strutture.join(", ") };
    delete payload.strutture;
    delete payload.username; // username/credenziali gestiti solo da Notion/Admin

    try {
      const res = await DipendentiApi.salva(payload);
      setSaving(false);
      if (res.ok) {
        onSaved();
      } else {
        setErr(`⚠️ ${res.error || "Errore nel salvataggio. Riprova."}`);
      }
    } catch {
      setSaving(false);
      setErr("⚠️ Errore nel salvataggio. Riprova.");
    }
  }

  return (
    <div>
      <div className="section-label"><div className="section-title">{isEdit ? "Modifica anagrafica" : "Nuovo dipendente"}</div></div>
      <div className="ana-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <div style={{ flex: 1 }}>
            <label className="dim-lbl">Nome *</label>
            <input className="dim-in" value={form.nome} onChange={e => setField("nome", e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="dim-lbl">Cognome *</label>
            <input className="dim-in" value={form.cognome} onChange={e => setField("cognome", e.target.value)} />
          </div>
        </div>

        <label className="dim-lbl">Codice fiscale</label>
        <input className="dim-in" value={form.cf} onChange={e => setField("cf", e.target.value)} />
        <label className="dim-lbl">Matricola</label>
        <input className="dim-in" value={form.matricola} onChange={e => setField("matricola", e.target.value)} />
        <label className="dim-lbl">Data di nascita</label>
        <input type="date" className="dim-in" value={form.nascita} onChange={e => setField("nascita", e.target.value)} />
        <label className="dim-lbl">Email</label>
        <input className="dim-in" value={form.email} onChange={e => setField("email", e.target.value)} />
        <label className="dim-lbl">Telefono</label>
        <input className="dim-in" value={form.telefono} onChange={e => setField("telefono", e.target.value)} />

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <div style={{ flex: 1 }}>
            <label className="dim-lbl">Mansione</label>
            <select className="dim-in" value={form.mansione} onChange={e => setField("mansione", e.target.value)}>
              <option value="">—</option>
              {GP_DIP_MANSIONI.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="dim-lbl">Contratto</label>
            <select className="dim-in" value={form.contratto} onChange={e => setField("contratto", e.target.value)}>
              <option value="">—</option>
              {GP_DIP_CONTRATTI.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <label className="dim-lbl">Strutture (una o più)</label>
        <div style={{ border: "1px solid var(--cyan-light)", borderRadius: 10, padding: 6, marginBottom: 8 }}>
          {strutture.length === 0
            ? <div style={{ fontSize: 12, color: "var(--text-light)", padding: 4 }}>Nessuna struttura caricata</div>
            : strutture.map((s: any) => (
              <label key={s.id || s.nome} style={{ display: "flex", alignItems: "center", gap: 8, padding: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <input type="checkbox" checked={form.strutture.includes(s.nome)} onChange={() => toggleStruttura(s.nome)} /> {s.nome}
              </label>
            ))
          }
        </div>

        <label className="dim-lbl">Ore settimanali</label>
        <input type="number" className="dim-in" value={form.oreSettimanali} onChange={e => setField("oreSettimanali", e.target.value)} />

        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 13, fontWeight: 700, color: "var(--text-mid)", margin: "0.5rem 0", cursor: "pointer" }}>
          <input type="checkbox" checked={form.attivo} onChange={e => setField("attivo", e.target.checked)} style={{ width: 16, height: 16 }} /> Dipendente attivo
        </label>

        <div style={{ borderTop: "1px solid var(--bg)", margin: "0.6rem 0", paddingTop: "0.4rem" }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "var(--teal-dark)", marginBottom: "0.3rem" }}>Configurazione ferie / ROL (ore)</div>
          <label className="dim-lbl">Data assunzione</label>
          <input type="date" className="dim-in" value={form.dataAssunzione} onChange={e => setField("dataAssunzione", e.target.value)} />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <div style={{ flex: 1 }}>
              <label className="dim-lbl">Monte ferie annuo (h)</label>
              <input type="number" className="dim-in" value={form.monteFerie} onChange={e => setField("monteFerie", e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="dim-lbl">Monte ROL annuo (h)</label>
              <input type="number" className="dim-in" value={form.monteRol} onChange={e => setField("monteRol", e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <div style={{ flex: 1 }}>
              <label className="dim-lbl">Residuo ferie iniziale (h)</label>
              <input type="number" className="dim-in" value={form.residuoFerieIniz} onChange={e => setField("residuoFerieIniz", e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="dim-lbl">Residuo ROL iniziale (h)</label>
              <input type="number" className="dim-in" value={form.residuoRolIniz} onChange={e => setField("residuoRolIniz", e.target.value)} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-light)" }}>Il residuo iniziale è il pregresso al 1° gennaio (o all'avvio del sistema). Da lì il saldo matura mese per mese e scala in automatico con le richieste approvate.</div>
        </div>

        <label className="dim-lbl">Note</label>
        <textarea className="dim-in" rows={2} value={form.note} onChange={e => setField("note", e.target.value)} />

        {err && <div style={{ margin: "8px 0", fontSize: 13, fontWeight: 700, color: "#7A1A1A" }}>{err}</div>}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
          <button className="ts-save" disabled={saving} onClick={save}>{saving ? "Salvataggio..." : "💾 Salva"}</button>
          <button className="ts-cancel" onClick={onCancel}>Annulla</button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-light)", textAlign: "center", marginTop: "0.5rem", padding: "0 1rem" }}>
        L'utente web app e le credenziali di accesso (username e password) non si gestiscono da qui: vengono attivati esclusivamente su Notion dall'amministratore.
      </div>
    </div>
  );
}
