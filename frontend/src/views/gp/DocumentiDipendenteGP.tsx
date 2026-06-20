import { useState, useEffect, useCallback } from "react";
import { ProxyApi } from "../../services/ProxyApi.js";

const DOC_TIPI = ["Contratto", "Busta paga", "Certificato", "Documento identità", "Altro"];

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

interface DocForm { titolo: string; tipo: string; note: string; link: string; fileName: string; fileB64: string; fileType: string }
function nuovoDocForm(): DocForm { return { titolo: "", tipo: "Busta paga", note: "", link: "", fileName: "", fileB64: "", fileType: "" }; }

interface Props {
  dipendente: any; // GP_DIP_DETAIL
}

export default function DocumentiDipendenteGP({ dipendente }: Props) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<DocForm | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadDocs = useCallback(() => {
    if (!dipendente.username) { setDocs([]); setLoading(false); return; }
    setLoading(true);
    ProxyApi.documentiLista({ username: dipendente.username }).then(r => {
      const list = (Array.isArray(r) ? r : []).map((item: any) => ({ ...item, id: item.id || item.pageId || "" }));
      setDocs(list);
      setLoading(false);
    });
  }, [dipendente.username]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  function setField<K extends keyof DocForm>(k: K, v: string) {
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
    if (!form.fileB64 && !form.link.trim()) { setMsg("⚠️ Allega un file o un link."); return; }
    const payload = {
      username: dipendente.username || "", dipendente: `${dipendente.nome || ""} ${dipendente.cognome || ""}`.trim(),
      titolo: form.titolo.trim(), tipo: form.tipo || "Altro", note: form.note || "",
      linkAllegato: form.link.trim(), fileBase64: form.fileB64 || "", fileName: form.fileName || "", contentType: form.fileType || ""
    };
    setUploading(true); setMsg("⏳ Caricamento...");
    try {
      await ProxyApi.documentoCarica(payload);
      setUploading(false); setForm(null);
      setTimeout(loadDocs, 1300);
    } catch {
      setUploading(false); setMsg("⚠️ Errore. Riprova.");
    }
  }

  async function deleteDoc(id: string) {
    if (!id) return;
    if (!confirm("Eliminare definitivamente questo documento? Sparirà dall'app e dal database (spostato nel cestino di Notion). L'operazione non è reversibile dall'app.")) return;
    try {
      await ProxyApi.documentoElimina({ pageId: id });
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
      ) : docs.map((d: any, i: number) => {
        const titolo = d.titolo || d.tipo || "Documento";
        const link = d.allegatoUrl || d.linkAllegato;
        return (
          <div className="ana-card" key={i} style={{ padding: "0.85rem 1rem", marginBottom: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-dark)" }}>{titolo}</div>
              <div style={{ fontSize: 11, color: "var(--text-light)" }}>{fmtDateIt(d.dataCaricamento)}</div>
            </div>
            {d.tipo && d.tipo !== titolo && <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 1 }}>{d.tipo}</div>}
            {d.allegatoNome && <div style={{ fontSize: 12, color: "var(--text-mid)", marginTop: 2 }}>{d.allegatoNome}</div>}
            {d.note && <div style={{ fontSize: 12, color: "var(--text-light)", marginTop: 2 }}>{d.note}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              {link ? <a href={link} target="_blank" rel="noreferrer" style={{ color: "var(--teal)", fontWeight: 700, fontSize: 13 }}>📎 Apri / scarica</a> : <span />}
              <button className="ts-mini del" onClick={() => deleteDoc(d.id)}>🗑 Elimina</button>
            </div>
            {d.caricatoDa && <div style={{ fontSize: 10, color: "var(--text-light)", marginTop: 4 }}>Caricato da {d.caricatoDa}</div>}
          </div>
        );
      })}
    </div>
  );
}
