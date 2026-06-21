import { useState, useEffect, useCallback } from "react";
import { DocumentiApi } from "../../services/DocumentiApi.js";
import type { Documento, CaricatoDaRuolo } from "../../services/DocumentiApi.js";

const DOC_TIPI = ["Contratto", "Busta paga", "Certificato medico", "Documento identità", "Altro"];

function fmtDateIt(d: unknown): string {
  let value: unknown = d;
  if (d && typeof d === "object" && "start" in (d as any)) value = (d as any).start;
  if (!value || typeof value !== "string") return "—";
  const datePart = value.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length < 3) return "—";
  const [y, m, dd] = parts;
  return `${dd}/${m}/${y}`;
}
function statoBadge(d: Documento): { label: string; bg: string; col: string } | null {
  if (!d.richiedeFirma) return null;
  if (d.statoFirma === "Da firmare") return { label: "⏳ In attesa che il dipendente firmi", bg: "#FEF3CD", col: "#7A5800" };
  if (d.statoFirma === "In attesa di verifica") return { label: "🔍 Da verificare", bg: "#DDEEFF", col: "#1A4A7A" };
  if (d.statoFirma === "Firmato") return { label: "✅ Firmato e archiviato", bg: "#D5F0E0", col: "#1A6B3A" };
  if (d.statoFirma === "Respinto") return { label: "❌ Respinto: in attesa che il dipendente ricarichi", bg: "#FCE4E4", col: "#7A1A1A" };
  return null;
}

interface DocForm { titolo: string; tipo: string; note: string; link: string; fileName: string; fileB64: string; fileType: string; richiedeFirma: boolean }
function nuovoDocForm(): DocForm { return { titolo: "", tipo: "Busta paga", note: "", link: "", fileName: "", fileB64: "", fileType: "", richiedeFirma: false }; }

interface Props {
  dipendente: any; // GP_DIP_DETAIL
  caricatoDa: string; // username di chi sta caricando (GP o Privacy)
  ruolo: CaricatoDaRuolo;
}

export default function DocumentiDipendenteGP({ dipendente, caricatoDa, ruolo }: Props) {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<DocForm | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [verificaBusy, setVerificaBusy] = useState<string | null>(null);

  const loadDocs = useCallback(() => {
    if (!dipendente.username) { setDocs([]); setLoading(false); return; }
    setLoading(true);
    DocumentiApi.listByUsername(dipendente.username).then(r => {
      setDocs(Array.isArray(r) ? r : []);
      setLoading(false);
    });
  }, [dipendente.username]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  function setField<K extends keyof DocForm>(k: K, v: DocForm[K]) {
    setForm(f => (f ? { ...f, [k]: v } : f));
  }
  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 18 * 1024 * 1024) { setMsg("⚠️ File troppo grande (max ~18MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setForm(f => (f ? { ...f, fileB64: String(reader.result), fileName: file.name, fileType: file.type || "application/octet-stream" } : f));
    };
    reader.readAsDataURL(file);
  }
  function clearFile() {
    setForm(f => (f ? { ...f, fileName: "", fileB64: "", fileType: "" } : f));
  }

  async function upload() {
    if (!form) return;
    if (!form.titolo.trim()) { setMsg("⚠️ Inserisci un titolo per il documento."); return; }
    if (form.richiedeFirma && !form.fileB64) { setMsg("⚠️ Per un documento da firmare serve allegare un file (non solo un link)."); return; }
    if (!form.fileB64 && !form.link.trim()) { setMsg("⚠️ Allega un file o un link."); return; }
    setUploading(true); setMsg("⏳ Caricamento...");
    try {
      const res = await DocumentiApi.create({
        username: dipendente.username || "", dipendente: `${dipendente.nome || ""} ${dipendente.cognome || ""}`.trim(),
        titolo: form.titolo.trim(), tipo: form.tipo || "Altro", note: form.note || "",
        linkAllegato: form.link.trim(), fileBase64: form.fileB64 || "", fileName: form.fileName || "", contentType: form.fileType || "",
        caricatoDa, caricatoDaRuolo: ruolo, richiedeFirma: form.richiedeFirma
      });
      setUploading(false);
      if (res.ok) { setForm(null); setTimeout(loadDocs, 1300); }
      else setMsg(`⚠️ ${res.error || "Errore nel caricamento."}`);
    } catch {
      setUploading(false); setMsg("⚠️ Errore. Riprova.");
    }
  }

  async function verifica(pageId: string, esito: "approva" | "scarta") {
    if (esito === "scarta" && !confirm("Scartare questo documento? Il file caricato verrà eliminato e il dipendente dovrà ricaricarlo.")) return;
    setVerificaBusy(pageId);
    try {
      await DocumentiApi.verificaFirma(pageId, esito);
      setVerificaBusy(null);
      setTimeout(loadDocs, 800);
    } catch {
      setVerificaBusy(null);
      alert("Errore nell'operazione. Riprova.");
    }
  }

  async function deleteDoc(pageId: string) {
    if (!pageId) return;
    if (!confirm("Eliminare definitivamente questo documento? L'operazione non è reversibile dall'app.")) return;
    try {
      await DocumentiApi.elimina(pageId);
      setTimeout(loadDocs, 800);
    } catch {
      alert("Errore nell'eliminazione. Riprova.");
    }
  }

  return (
    <div>
      <div className="section-label"><div className="section-title">Documenti</div></div>
      {form ? (
        <div className="ana-card" style={{ padding: "1rem", border: "1.5px solid var(--cyan)" }}>
          <label className="dim-lbl">Titolo documento *</label>
          <input className="dim-in" placeholder="es. Contratto 2024, Busta paga maggio..." value={form.titolo} onChange={e => setField("titolo", e.target.value)} />
          <label className="dim-lbl">Categoria</label>
          <select className="dim-in" value={form.tipo} onChange={e => setField("tipo", e.target.value)}>
            {DOC_TIPI.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="dim-lbl">File</label>
          {form.fileName
            ? <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--teal)", marginBottom: 8 }}>📎 {form.fileName} <button className="ts-mini del" onClick={clearFile}>rimuovi</button></div>
            : <input type="file" onChange={onFilePick} style={{ marginBottom: 8, fontSize: 13, width: "100%" }} />
          }
          <label className="dim-lbl">oppure Link</label>
          <input className="dim-in" placeholder="https://..." value={form.link} onChange={e => setField("link", e.target.value)} />
          <label className="dim-lbl">Note</label>
          <input className="dim-in" value={form.note} onChange={e => setField("note", e.target.value)} />
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 13, fontWeight: 700, color: "var(--text-mid)", margin: "0.6rem 0 0.2rem", cursor: "pointer" }}>
            <input type="checkbox" checked={form.richiedeFirma} onChange={e => setField("richiedeFirma", e.target.checked)} style={{ width: 16, height: 16 }} />
            Richiede la firma del dipendente
          </label>
          {form.richiedeFirma && <div style={{ fontSize: 11, color: "var(--text-light)", marginBottom: 6 }}>Il dipendente potrà scaricarlo, firmarlo fuori dall'app e ricaricarlo qui per la tua verifica.</div>}
          {msg && <div style={{ margin: "8px 0", fontSize: 13, fontWeight: 700, color: "var(--teal-dark)" }}>{msg}</div>}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
            <button className="ts-save" disabled={uploading} onClick={upload}>{uploading ? "Caricamento..." : "📤 Carica"}</button>
            <button className="ts-cancel" onClick={() => { setForm(null); setMsg(null); }}>Annulla</button>
          </div>
        </div>
      ) : (
        <button className="ts-add" onClick={() => { setForm(nuovoDocForm()); setMsg(null); }}>➕ Carica documento</button>
      )}

      {loading ? (
        <div className="ana-card" style={{ padding: "1rem", textAlign: "center", color: "var(--text-light)" }}>Caricamento...</div>
      ) : docs.length === 0 ? (
        <div className="ana-card" style={{ padding: "1rem", textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessun documento</div>
      ) : docs.map((d, i) => {
        const titolo = d.titolo || d.tipo || "Documento";
        const link = d.allegatoUrl || d.linkAllegato;
        const badge = statoBadge(d);
        const daVerificare = d.richiedeFirma && d.statoFirma === "In attesa di verifica";
        return (
          <div className="ana-card" key={i} style={{ padding: "0.85rem 1rem", marginBottom: "0.5rem", border: daVerificare ? "1.5px solid #1A4A7A" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-dark)" }}>{titolo}</div>
              <div style={{ fontSize: 11, color: "var(--text-light)" }}>{fmtDateIt(d.dataCaricamento)}</div>
            </div>
            {d.tipo && d.tipo !== titolo && <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 1 }}>{d.tipo}</div>}
            {d.allegatoNome && <div style={{ fontSize: 12, color: "var(--text-mid)", marginTop: 2 }}>{d.allegatoNome}</div>}
            {d.note && <div style={{ fontSize: 12, color: "var(--text-light)", marginTop: 2 }}>{d.note}</div>}
            {badge && <div style={{ display: "inline-block", marginTop: 6, padding: "3px 9px", borderRadius: 10, fontSize: 11, fontWeight: 800, background: badge.bg, color: badge.col }}>{badge.label}</div>}

            {daVerificare && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: 8 }}>
                <button disabled={!!verificaBusy} onClick={() => verifica(d.pageId, "approva")} style={{ flex: 1, padding: "0.4rem", background: "#D5F0E0", color: "#1A6B3A", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{verificaBusy === d.pageId ? "..." : "✅ Salva (firma valida)"}</button>
                <button disabled={!!verificaBusy} onClick={() => verifica(d.pageId, "scarta")} style={{ flex: 1, padding: "0.4rem", background: "#FCE4E4", color: "#7A1A1A", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{verificaBusy === d.pageId ? "..." : "❌ Scarta"}</button>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              {link ? <a href={link} target="_blank" rel="noreferrer" style={{ color: "var(--teal)", fontWeight: 700, fontSize: 13 }}>📎 Apri / scarica</a> : <span />}
              <button className="ts-mini del" onClick={() => deleteDoc(d.pageId)}>🗑 Elimina</button>
            </div>
            {d.caricatoDa && <div style={{ fontSize: 10, color: "var(--text-light)", marginTop: 4 }}>Caricato da {d.caricatoDa}{d.caricatoDaRuolo ? ` (${d.caricatoDaRuolo})` : ""}</div>}
          </div>
        );
      })}
    </div>
  );
}
