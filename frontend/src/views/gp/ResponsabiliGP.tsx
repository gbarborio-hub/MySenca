import { useState, useEffect, useCallback } from "react";
import { ResponsabiliApi } from "../../services/ResponsabiliApi.js";
import type { Responsabile, DocSlot, StatoFirma } from "../../services/ResponsabiliApi.js";

function fmtDateIt(d: string | null) {
  if (!d) return "—";
  const parts = d.split("T")[0].split("-");
  if (parts.length < 3) return "—";
  const [y, m, dd] = parts;
  return `${dd}/${m}/${y}`;
}
function statoInvioBadge(s: string): { bg: string; col: string } {
  if (s === "Inviata") return { bg: "#FEF3CD", col: "#7A5800" };
  if (s === "Autonomina") return { bg: "#DDEEFF", col: "#1A4A7A" };
  return { bg: "#FCE4E4", col: "#7A1A1A" };
}
function statoFirmaBadge(s: StatoFirma): { label: string; bg: string; col: string } | null {
  if (s === "Da firmare") return { label: "⏳ Da firmare", bg: "#FEF3CD", col: "#7A5800" };
  if (s === "In attesa di verifica") return { label: "🔍 Da verificare", bg: "#DDEEFF", col: "#1A4A7A" };
  if (s === "Firmato") return { label: "✅ Firmato", bg: "#D5F0E0", col: "#1A6B3A" };
  if (s === "Respinto") return { label: "❌ Respinto", bg: "#FCE4E4", col: "#7A1A1A" };
  return null;
}

interface NewForm { nome: string; attivitaSvolta: string; email: string; indirizzo: string }
function nuovoForm(): NewForm { return { nome: "", attivitaSvolta: "", email: "", indirizzo: "" }; }

function DocSlotCard({ resp, slot, label, fileNome, fileUrl, richiedeFirma, statoFirma, onChanged }: {
  resp: Responsabile; slot: DocSlot; label: string;
  fileNome: string; fileUrl: string | null; richiedeFirma: boolean; statoFirma: StatoFirma;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [richiedi, setRichiedi] = useState(richiedeFirma);

  function onUpload(e: React.ChangeEvent<HTMLInputElement>, modalita: "originale" | "firmato") {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 18 * 1024 * 1024) { alert("File troppo grande (max ~18MB)."); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      try {
        const b64 = String(reader.result);
        const ct = file.type || "application/octet-stream";
        if (modalita === "originale") {
          await ResponsabiliApi.caricaDocumento(resp.pageId, slot, b64, file.name, ct, richiedi);
        } else {
          await ResponsabiliApi.caricaFirmato(resp.pageId, slot, b64, file.name, ct);
        }
        onChanged();
      } catch (err: any) {
        alert(err?.message || "Errore nel caricamento. Riprova.");
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function verifica(esito: "approva" | "scarta") {
    if (esito === "scarta" && !confirm("Scartare questo documento? Il file verrà eliminato e andrà ricaricato.")) return;
    setBusy(true);
    try {
      await ResponsabiliApi.verificaFirma(resp.pageId, slot, esito);
      onChanged();
    } catch (err: any) {
      alert(err?.message || "Errore nell'operazione. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  const badge = statoFirmaBadge(statoFirma);
  const daVerificare = richiedeFirma && statoFirma === "In attesa di verifica";

  return (
    <div className="ana-card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-dark)", marginBottom: 6 }}>{label}</div>

      {fileNome ? (
        <div style={{ fontSize: 12, color: "var(--text-mid)", marginBottom: 6 }}>📎 {fileNome}</div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--text-light)", marginBottom: 6 }}>Nessun file caricato</div>
      )}
      {badge && <div style={{ display: "inline-block", marginBottom: 8, padding: "3px 9px", borderRadius: 10, fontSize: 11, fontWeight: 800, background: badge.bg, color: badge.col }}>{badge.label}</div>}

      {fileUrl && <div style={{ marginBottom: 8 }}><a href={fileUrl} target="_blank" rel="noreferrer" style={{ color: "var(--teal)", fontWeight: 700, fontSize: 13 }}>Apri / scarica</a></div>}

      {daVerificare ? (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: 8 }}>
          <button disabled={busy} onClick={() => verifica("approva")} style={{ flex: 1, padding: "0.4rem", background: "#D5F0E0", color: "#1A6B3A", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>✅ Salva (firma valida)</button>
          <button disabled={busy} onClick={() => verifica("scarta")} style={{ flex: 1, padding: "0.4rem", background: "#FCE4E4", color: "#7A1A1A", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>❌ Scarta</button>
        </div>
      ) : (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-mid)", marginBottom: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={richiedi} onChange={e => setRichiedi(e.target.checked)} style={{ width: 14, height: 14 }} />
            Richiede la firma del responsabile
          </label>
          <label style={{ display: "inline-block", padding: "0.45rem 0.8rem", background: "var(--teal)", color: "white", borderRadius: 16, fontSize: 12, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, marginRight: 6 }}>
            {busy ? "..." : (fileNome ? "📤 Sostituisci" : "📤 Carica")}
            <input type="file" disabled={busy} onChange={e => onUpload(e, "originale")} style={{ display: "none" }} />
          </label>
          {richiedeFirma && statoFirma === "Respinto" && (
            <label style={{ display: "inline-block", padding: "0.45rem 0.8rem", background: "var(--cyan)", color: "white", borderRadius: 16, fontSize: 12, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
              {busy ? "..." : "📤 Ricarica firmato"}
              <input type="file" disabled={busy} onChange={e => onUpload(e, "firmato")} style={{ display: "none" }} />
            </label>
          )}
        </>
      )}
    </div>
  );
}

export default function ResponsabiliGP() {
  const [items, setItems] = useState<Responsabile[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Responsabile | null>(null);
  const [form, setForm] = useState<NewForm | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    ResponsabiliApi.list().then(r => { setItems(Array.isArray(r) ? r : []); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function refreshDetail(pageId: string) {
    ResponsabiliApi.list().then(r => {
      const list = Array.isArray(r) ? r : [];
      setItems(list);
      const found = list.find(x => x.pageId === pageId);
      if (found) setDetail(found);
    });
  }

  async function creaResponsabile() {
    if (!form || !form.nome.trim()) { alert("Inserisci il nome o ragione sociale."); return; }
    setCreating(true);
    try {
      const res = await ResponsabiliApi.create(form);
      if (res.ok) { setForm(null); load(); }
      else alert(res.error || "Errore nella creazione.");
    } catch (err: any) {
      alert(err?.message || "Errore nella creazione.");
    } finally {
      setCreating(false);
    }
  }

  async function eliminaResponsabile(r: Responsabile) {
    if (!confirm(`Eliminare "${r.nome}" dal registro responsabili?`)) return;
    try {
      await ResponsabiliApi.elimina(r.pageId);
      setDetail(null);
      load();
    } catch (err: any) {
      alert(err?.message || "Errore nell'eliminazione.");
    }
  }

  if (detail) {
    const badge = statoInvioBadge(detail.statoInvio);
    return (
      <div>
        <button onClick={() => setDetail(null)} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 800, color: "var(--teal)", cursor: "pointer", fontFamily: "Satoshi,sans-serif", marginBottom: "0.5rem" }}>← Indietro</button>

        <div style={{ background: "var(--teal-dark)", borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: "white" }}>{detail.nome}</div>
          {detail.attivitaSvolta && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>{detail.attivitaSvolta}</div>}
          <div style={{ display: "inline-block", marginTop: 8, padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 800, background: badge.bg, color: badge.col }}>{detail.statoInvio || "—"}</div>
        </div>

        <div className="ana-card" style={{ marginBottom: "0.75rem" }}>
          {detail.email && <div className="ana-row"><div className="ana-label">Email</div><div className="ana-value">{detail.email}</div></div>}
          {detail.indirizzo && <div className="ana-row"><div className="ana-label">Indirizzo</div><div className="ana-value" style={{ fontSize: 12 }}>{detail.indirizzo}</div></div>}
          {detail.dataInvio && <div className="ana-row"><div className="ana-label">Data invio</div><div className="ana-value">{fmtDateIt(detail.dataInvio)}</div></div>}
        </div>

        <DocSlotCard resp={detail} slot="checklist" label="📋 Checklist conformità" fileNome={detail.checklistFileNome} fileUrl={detail.checklistFileUrl} richiedeFirma={detail.checklistRichiedeFirma} statoFirma={detail.checklistStatoFirma} onChanged={() => refreshDetail(detail.pageId)} />
        <DocSlotCard resp={detail} slot="contratto" label="📄 Contratto / nomina" fileNome={detail.contrattoFileNome} fileUrl={detail.contrattoFileUrl} richiedeFirma={detail.contrattoRichiedeFirma} statoFirma={detail.contrattoStatoFirma} onChanged={() => refreshDetail(detail.pageId)} />

        <button onClick={() => eliminaResponsabile(detail)} style={{ marginTop: "0.5rem", padding: "0.7rem", width: "100%", background: "none", border: "1.5px solid #E8603A", borderRadius: 20, color: "#E8603A", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Satoshi,sans-serif" }}>🗑 Elimina responsabile</button>
      </div>
    );
  }

  return (
    <div>
      <div className="section-label"><div className="section-title">Responsabili al trattamento</div></div>

      {form ? (
        <div className="ana-card" style={{ padding: "1rem", border: "1.5px solid var(--cyan)", marginBottom: "0.75rem" }}>
          <label className="dim-lbl">Nome o ragione sociale *</label>
          <input className="dim-in" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          <label className="dim-lbl">Attività svolta</label>
          <input className="dim-in" value={form.attivitaSvolta} onChange={e => setForm({ ...form, attivitaSvolta: e.target.value })} />
          <label className="dim-lbl">Email</label>
          <input className="dim-in" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <label className="dim-lbl">Indirizzo</label>
          <input className="dim-in" value={form.indirizzo} onChange={e => setForm({ ...form, indirizzo: e.target.value })} />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
            <button className="ts-save" disabled={creating} onClick={creaResponsabile}>{creating ? "Creazione..." : "➕ Crea"}</button>
            <button className="ts-cancel" onClick={() => setForm(null)}>Annulla</button>
          </div>
        </div>
      ) : (
        <button className="ts-add" onClick={() => setForm(nuovoForm())}>➕ Aggiungi responsabile</button>
      )}

      {loading ? (
        <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)" }}>Caricamento...</div>
      ) : items.length === 0 ? (
        <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessun responsabile registrato</div>
      ) : (
        <div className="table-card">
          {items.map((r, i) => {
            const badge = statoInvioBadge(r.statoInvio);
            return (
              <div className="table-row" key={i} style={{ cursor: "pointer" }} onClick={() => setDetail(r)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-title">{r.nome}</div>
                  {r.attivitaSvolta && <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>{r.attivitaSvolta}</div>}
                </div>
                <div style={{ padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 800, background: badge.bg, color: badge.col, whiteSpace: "nowrap", flexShrink: 0 }}>{r.statoInvio || "—"}</div>
              </div>
            );
          })}
        </div>
      )}
      <button className="update-btn" onClick={load}>Aggiorna</button>
    </div>
  );
}
