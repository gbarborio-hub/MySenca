import { useState } from "react";
import { ProxyApi } from "../../services/ProxyApi.js";

type FileStatus = "pending" | "ok" | "nouser" | "skip" | "err";
interface BpFile {
  name: string; b64: string; type: string;
  match: any | null; status: FileStatus; msg?: string;
}

function bpMatch(filename: string, dipendenti: any[]): any | null {
  const n = String(filename || "").toLowerCase();
  const base = n.replace(/\.[a-z0-9]+$/, "");
  for (const d of dipendenti) {
    const u = (d.username || "").toLowerCase();
    if (u && n.indexOf(u) >= 0) return d;
  }
  const tokens = base.split(/[^a-z0-9]+/);
  for (const d of dipendenti) {
    const m = String(d.matricola || "").toLowerCase().trim();
    if (!m) continue;
    const mz = m.replace(/^0+/, "");
    for (const tk of tokens) {
      if (!tk) continue;
      if (tk === m || (mz !== "" && (tk === mz || tk.replace(/^0+/, "") === mz))) return d;
    }
  }
  return null;
}

function statusLabel(x: BpFile): { color: string; label: string } {
  const nomeCompleto = x.match ? `${x.match.nome || ""} ${x.match.cognome || ""}`.trim() : "";
  if (x.status === "pending") return { color: "#1A6B5A", label: `→ ${nomeCompleto} (${x.match.username})` };
  if (x.status === "ok") return { color: "#1A6B5A", label: `✓ caricata · ${nomeCompleto}` };
  if (x.status === "nouser") return { color: "#8A5A00", label: `⚠️ ${nomeCompleto} senza username` };
  if (x.status === "skip") return { color: "#7A1A1A", label: "⚠️ dipendente non riconosciuto" };
  return { color: "#7A1A1A", label: `✗ ${x.msg || "errore"}` };
}

interface Props {
  dipendenti: any[];
}

export default function BustePagaGP({ dipendenti }: Props) {
  const [files, setFiles] = useState<BpFile[]>([]);
  const [mese, setMese] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ok: number; err: number } | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files;
    if (!picked || !picked.length) return;
    setDone(null);
    const newFiles: BpFile[] = [];
    let pending = picked.length;

    function finish() {
      pending--;
      if (pending <= 0) setFiles(f => [...f, ...newFiles]);
    }
    Array.from(picked).forEach(f => {
      if (f.size > 18 * 1024 * 1024) {
        newFiles.push({ name: f.name, b64: "", type: "", match: null, status: "err", msg: "troppo grande" });
        finish();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const m = bpMatch(f.name, dipendenti);
        const st: FileStatus = !m ? "skip" : (m.username ? "pending" : "nouser");
        newFiles.push({ name: f.name, b64: String(reader.result), type: f.type || "application/octet-stream", match: m, status: st });
        finish();
      };
      reader.onerror = () => {
        newFiles.push({ name: f.name, b64: "", type: "", match: null, status: "err", msg: "lettura fallita" });
        finish();
      };
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  }

  function removeFile(idx: number) {
    setFiles(f => f.filter((_, i) => i !== idx));
  }
  function clearAll() {
    setFiles([]);
    setDone(null);
  }

  async function upload() {
    if (busy) return;
    const queue = files.filter(x => x.status === "pending" && x.match && x.match.username);
    if (!queue.length) { alert("Nessun file abbinato e pronto da caricare."); return; }
    setBusy(true); setDone(null);
    let okC = 0, errC = 0;

    for (const item of queue) {
      const payload = {
        username: item.match.username || "",
        dipendente: `${item.match.nome || ""} ${item.match.cognome || ""}`.trim(),
        titolo: `Busta paga${mese ? ` ${mese}` : ""}`,
        tipo: "Busta paga", note: "", linkAllegato: "",
        fileBase64: item.b64 || "", fileName: item.name || "", contentType: item.type || ""
      };
      try {
        await ProxyApi.documentoCarica(payload);
        setFiles(f => f.map(x => x === item ? { ...x, status: "ok" as FileStatus } : x));
        okC++;
      } catch {
        setFiles(f => f.map(x => x === item ? { ...x, status: "err" as FileStatus, msg: "upload fallito" } : x));
        errC++;
      }
      await new Promise(r => setTimeout(r, 400));
    }
    setBusy(false);
    setDone({ ok: okC, err: errC });
  }

  const pend = files.filter(x => x.status === "pending").length;
  const skipNouser = files.filter(x => x.status === "skip" || x.status === "nouser").length;
  const ok = files.filter(x => x.status === "ok").length;
  const err = files.filter(x => x.status === "err").length;

  return (
    <div>
      <div className="section-label"><div className="section-title">Buste paga — caricamento massivo</div></div>
      {dipendenti.length === 0 ? (
        <div className="ana-card" style={{ padding: "1rem", textAlign: "center", color: "var(--text-light)" }}>Carico l'elenco dipendenti…</div>
      ) : (
        <div className="ana-card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: 12, color: "var(--text-mid)", marginBottom: "0.6rem", lineHeight: 1.4 }}>
            Carica più buste paga in una volta. Il nome di ogni file deve contenere lo <b>username</b> della web app oppure la <b>matricola</b> del dipendente: l'app le smista da sola. Es. <code>m.rossi_maggio.pdf</code> oppure <code>0000000118.pdf</code>.
          </div>
          <label className="dim-lbl">Mese di riferimento (facoltativo)</label>
          <input className="dim-in" placeholder="es. Maggio 2026" value={mese} onChange={e => setMese(e.target.value)} />
          <label className="dim-lbl" style={{ marginTop: "0.5rem" }}>Seleziona i file</label>
          <input type="file" multiple accept="application/pdf,image/*" onChange={onPick} disabled={busy} style={{ fontSize: 13 }} />

          {files.length > 0 && (
            <>
              <div style={{ marginTop: "0.8rem", borderTop: "1px solid var(--bg)", paddingTop: "0.6rem" }}>
                {files.map((x, i) => {
                  const { color, label } = statusLabel(x);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "5px 0", fontSize: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "var(--text-dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</div>
                        <div style={{ color, fontWeight: 700 }}>{label}</div>
                      </div>
                      {!busy && x.status !== "ok" && (
                        <div onClick={() => removeFile(i)} style={{ color: "var(--text-light)", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-mid)", marginTop: "0.4rem" }}>
                {pend} pronte · {skipNouser} da sistemare{ok ? ` · ${ok} caricate` : ""}{err ? ` · ${err} errori` : ""}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem" }}>
                <button className="ts-save" style={{ flex: 1 }} disabled={busy || pend === 0} onClick={upload}>
                  {busy ? "Caricamento…" : `📤 Carica e smista (${pend})`}
                </button>
                <button className="ts-mini" disabled={busy} onClick={clearAll}>Svuota</button>
              </div>
            </>
          )}

          {done && (
            <div style={{ marginTop: "0.7rem", padding: "0.7rem", borderRadius: 10, background: "#EAF5F1", fontSize: 13, fontWeight: 700, color: "#1A6B5A" }}>
              ✓ Caricate {done.ok} buste paga{done.err ? ` · ${done.err} errori` : ""}. I dipendenti riceveranno la notifica all'apertura dell'app.
            </div>
          )}
        </div>
      )}
      <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: "0.5rem" }}>I file vengono salvati nel fascicolo di ciascun dipendente come documenti di tipo "Busta paga".</div>
    </div>
  );
}
