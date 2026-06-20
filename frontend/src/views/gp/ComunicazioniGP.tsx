import { useState } from "react";
import { ProxyApi } from "../../services/ProxyApi.js";

const COM_RUOLI = ["OSS", "Infermiere", "Medico", "Coordinatore", "Educatrice", "Psicologa", "Amministrativo", "Altro"];

function fmtDateIt(d: unknown) {
  let value: unknown = d;
  if (d && typeof d === "object" && "start" in (d as any)) value = (d as any).start;
  if (!value || typeof value !== "string") return "—";
  const datePart = value.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length < 3) return "—";
  const [y, m, dd] = parts;
  return `${dd}/${m}/${y}`;
}
function fmtDateTimeIt(d: unknown) {
  let value: unknown = d;
  if (d && typeof d === "object" && "start" in (d as any)) value = (d as any).start;
  if (!value || typeof value !== "string") return "—";
  if (value.indexOf("T") < 0) return fmtDateIt(value);
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return fmtDateIt(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} alle ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
function comTarget(c: any) {
  if (c.destSingoli > 0) return `👤 ${c.destSingoli} destinatari`;
  const parts: string[] = [];
  if (c.destStruttura) parts.push(`🏠 ${c.destStruttura}`);
  if (c.destRuolo) parts.push(`🏷 ${c.destRuolo}`);
  if (parts.length === 0) return "👥 Tutti";
  return parts.join(" · ");
}

const FORM_DEFAULTS = {
  tipo: "Tutti" as "Tutti" | "Mirata" | "Singoli",
  struttura: "", ruolo: "", singoli: [] as string[],
  conferma: true, titolo: "", messaggio: "", link: "",
  fileName: "", fileB64: "", fileType: ""
};

interface Props {
  strutture: any[];
  dipendenti: any[]; // GP_DIPENDENTI: nome, cognome, username
  username: string;
}

export default function ComunicazioniGP({ strutture, dipendenti, username }: Props) {
  const [form, setForm] = useState({ ...FORM_DEFAULTS });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sent, setSent] = useState<any[]>([]);
  const [sentLoading, setSentLoading] = useState(false);
  const [readers, setReaders] = useState<Record<string, { loading: boolean; list: any[] }>>({});
  const [expandedReaders, setExpandedReaders] = useState<Record<string, boolean>>({});

  function setField<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }
  function toggleSingolo(u: string) {
    setForm(f => {
      const i = f.singoli.indexOf(u);
      const next = i >= 0 ? f.singoli.filter(x => x !== u) : [...f.singoli, u];
      return { ...f, singoli: next };
    });
  }
  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 18 * 1024 * 1024) { setMsg("⚠️ File troppo grande (max ~18MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setForm(f => ({ ...f, fileB64: String(reader.result), fileName: file.name, fileType: file.type || "application/octet-stream" }));
    };
    reader.readAsDataURL(file);
  }
  function clearFile() {
    setForm(f => ({ ...f, fileName: "", fileB64: "", fileType: "" }));
  }

  function loadSent() {
    setSentLoading(true);
    ProxyApi.comunicazioniLista({ all: true }).then((d: any) => {
      setSent(Array.isArray(d) ? d : []);
      setSentLoading(false);
    }).catch(() => setSentLoading(false));
  }

  async function send() {
    const titolo = form.titolo.trim();
    const messaggio = form.messaggio.trim();
    if (!titolo) { setMsg("⚠️ Inserisci un titolo."); return; }

    let struttura = "", ruolo = "", singoli: string[] = [];
    if (form.tipo === "Mirata") {
      struttura = form.struttura || "";
      ruolo = form.ruolo || "";
      if (!struttura && !ruolo) { setMsg("⚠️ Scegli una struttura e/o un ruolo (oppure usa Tutti)."); return; }
    } else if (form.tipo === "Singoli") {
      if (form.singoli.length === 0) { setMsg("⚠️ Seleziona almeno un dipendente."); return; }
      singoli = form.singoli.slice();
    }
    const tipoSel = singoli.length ? "Singoli" : (struttura ? "Struttura" : (ruolo ? "Ruolo" : "Tutti"));

    const payload = {
      titolo, messaggio, mittente: username, tipoDestinatari: tipoSel,
      destinatari: JSON.stringify({ struttura, ruolo, singoli }),
      confermaLettura: !!form.conferma,
      linkAllegato: form.link.trim(),
      fileBase64: form.fileB64, fileName: form.fileName, contentType: form.fileType
    };
    setSending(true); setMsg("⏳ Invio in corso...");
    try {
      await ProxyApi.comunicazioneCrea(payload);
      setSending(false); setMsg("✅ Comunicazione inviata.");
      setForm({ ...FORM_DEFAULTS });
      setTimeout(loadSent, 1300);
    } catch (e: any) {
      setSending(false); setMsg(`⚠️ ${e?.message || "Errore nell'invio. Riprova."}`);
    }
  }

  function viewReaders(commId: string) {
    setReaders(r => ({ ...r, [commId]: { loading: true, list: [] } }));
    setExpandedReaders(e => ({ ...e, [commId]: true }));
    ProxyApi.comunicazioneLetture(commId).then((d: any) => {
      setReaders(r => ({ ...r, [commId]: { loading: false, list: Array.isArray(d) ? d : [] } }));
    }).catch(() => setReaders(r => ({ ...r, [commId]: { loading: false, list: [] } })));
  }

  return (
    <div>
      <div className="section-label"><div className="section-title">Nuova comunicazione</div></div>
      <div className="ana-card" style={{ padding: "1rem" }}>
        <label className="dim-lbl">Titolo</label>
        <input className="dim-in" placeholder="Oggetto" value={form.titolo} onChange={e => setField("titolo", e.target.value)} />
        <label className="dim-lbl">Messaggio</label>
        <textarea className="dim-in" rows={4} placeholder="Testo della comunicazione" value={form.messaggio} onChange={e => setField("messaggio", e.target.value)} />

        <label className="dim-lbl">Destinatari</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {([["Tutti", "Tutti"], ["Mirata", "Struttura / Ruolo"], ["Singoli", "Singoli"]] as const).map(([v, l]) => (
            <button key={v} className={`com-pill${form.tipo === v ? " on" : ""}`} onClick={() => setField("tipo", v)}>{l}</button>
          ))}
        </div>

        {form.tipo === "Mirata" && (
          <>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <div style={{ flex: 1 }}>
                <label className="dim-lbl">Struttura</label>
                <select className="dim-in" value={form.struttura} onChange={e => setField("struttura", e.target.value)}>
                  <option value="">— Tutte —</option>
                  {strutture.map((s: any) => <option key={s.id || s.nome} value={s.nome}>{s.nome}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="dim-lbl">Ruolo</label>
                <select className="dim-in" value={form.ruolo} onChange={e => setField("ruolo", e.target.value)}>
                  <option value="">— Tutti —</option>
                  {COM_RUOLI.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-light)", marginBottom: 8 }}>Se scegli sia struttura che ruolo, arriva solo a chi ha entrambi (es. infermieri della struttura X).</div>
          </>
        )}

        {form.tipo === "Singoli" && (
          <div style={{ maxHeight: 180, overflow: "auto", border: "1px solid var(--cyan-light)", borderRadius: 10, padding: 6, marginBottom: 8 }}>
            {dipendenti.length === 0
              ? <div style={{ fontSize: 12, color: "var(--text-light)", padding: 6 }}>Nessun dipendente caricato (apri prima Dipendenti)</div>
              : dipendenti.filter((d: any) => d.username).map((d: any) => (
                <label key={d.username} style={{ display: "flex", alignItems: "center", gap: 8, padding: 5, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.singoli.includes(d.username)} onChange={() => toggleSingolo(d.username)} />
                  {`${d.nome || ""} ${d.cognome || ""}`.trim()} <span style={{ color: "var(--text-light)", fontWeight: 500 }}>({d.username})</span>
                </label>
              ))
            }
          </div>
        )}

        <label className="dim-lbl">Allegato (file su Notion)</label>
        {form.fileName
          ? <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--teal)", marginBottom: 8 }}>📎 {form.fileName} <button className="ts-mini del" onClick={clearFile}>rimuovi</button></div>
          : <input type="file" onChange={onFilePick} style={{ marginBottom: 8, fontSize: 13, width: "100%" }} />
        }
        <label className="dim-lbl">oppure Link allegato (Drive/Nextcloud)</label>
        <input className="dim-in" placeholder="https://..." value={form.link} onChange={e => setField("link", e.target.value)} />

        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 13, fontWeight: 700, color: "var(--text-mid)", margin: "0.4rem 0 0.2rem", cursor: "pointer" }}>
          <input type="checkbox" checked={form.conferma} onChange={e => setField("conferma", e.target.checked)} style={{ width: 16, height: 16 }} /> Richiedi conferma di lettura
        </label>

        {msg && <div style={{ margin: "8px 0", fontSize: 13, fontWeight: 700, color: "var(--teal-dark)" }}>{msg}</div>}
        <button className="ts-save" style={{ width: "100%", marginTop: 6 }} disabled={sending} onClick={send}>{sending ? "Invio..." : "📤 Invia comunicazione"}</button>
      </div>

      <div className="section-label"><div className="section-title">Inviate</div></div>
      <button className="update-btn" onClick={loadSent}>Aggiorna</button>
      {sentLoading ? (
        <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)" }}>Caricamento...</div>
      ) : sent.length === 0 ? (
        <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessuna comunicazione inviata</div>
      ) : sent.map((c: any, i: number) => (
        <div className="ana-card" key={i} style={{ padding: "0.85rem 1rem", marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-dark)" }}>{c.titolo || "(senza titolo)"}</div>
            <div style={{ fontSize: 11, color: "var(--text-light)" }}>{fmtDateIt(c.dataInvio)}</div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-mid)", margin: "4px 0", textTransform: "capitalize" }}>{comTarget(c)}</div>
          {c.allegatoNome && <div style={{ fontSize: 12, color: "var(--teal)", fontWeight: 700 }}>📎 {c.allegatoNome}</div>}
          {c.linkAllegato && <div style={{ fontSize: 12 }}><a href={c.linkAllegato} target="_blank" rel="noreferrer" style={{ color: "var(--teal)", fontWeight: 700 }}>🔗 Link allegato</a></div>}
          {c.confermaLettura ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--teal-dark)" }}>✓ Letture: {c.lettiCount || 0}</span>
                <button className="ts-mini" onClick={() => viewReaders(c.id)}>Chi ha letto</button>
              </div>
              {expandedReaders[c.id] && (
                <div style={{ marginTop: 6, borderTop: "1px solid var(--bg)", paddingTop: 6 }}>
                  {readers[c.id]?.loading
                    ? <div style={{ fontSize: 12, color: "var(--text-light)" }}>Caricamento...</div>
                    : (readers[c.id]?.list.length === 0
                      ? <div style={{ fontSize: 12, color: "var(--text-light)" }}>Ancora nessuna lettura</div>
                      : readers[c.id].list.map((r: any, k: number) => (
                        <div key={k} style={{ fontSize: 12, color: "var(--text-mid)" }}>✓ {r.nome || r.username} · {fmtDateTimeIt(r.lettoIl)}</div>
                      ))
                    )
                  }
                </div>
              )}
            </>
          ) : (
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-light)", fontWeight: 600 }}>Senza conferma di lettura</div>
          )}
        </div>
      ))}
    </div>
  );
}
