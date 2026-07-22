import { useState, useEffect, useCallback } from "react";
import { DocumentazionePrivacyApi } from "../../services/DocumentazionePrivacyApi.js";
import type { ModelloPrivacy } from "../../services/DocumentazionePrivacyApi.js";

function fmtDateOraIt(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, "0");
  const min = String(dt.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} alle ${hh}:${min}`;
}

// "Pending" = il modello è stato aggiornato dopo l'ultimo invio massivo (o non è mai
// stato inviato): significa che chi ha già ricevuto la versione precedente non ha
// ancora ricevuto l'aggiornamento più recente.
function aggiornamentoPending(m: ModelloPrivacy): boolean {
  if (!m.dataUltimoAggiornamento) return false;
  if (!m.dataUltimoInvio) return true;
  return new Date(m.dataUltimoAggiornamento).getTime() > new Date(m.dataUltimoInvio).getTime();
}

function ModelloCard({ modello, mancanti, onChanged }: { modello: ModelloPrivacy; mancanti: { pageId: string; nome: string; email: string }[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [inviando, setInviando] = useState(false);
  const [inviandoMancanti, setInviandoMancanti] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 18 * 1024 * 1024) { alert("File troppo grande (max ~18MB)."); return; }
    if (modello.allegatoNome && !confirm(`Sostituire "${modello.allegatoNome}" con "${file.name}"? Diventerà il nuovo modello definitivo per i prossimi invii.`)) {
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      setEsito(null);
      try {
        const b64 = String(reader.result);
        const ct = file.type || "application/octet-stream";
        const res = await DocumentazionePrivacyApi.carica(modello.pageId, b64, file.name, ct, "");
        if (!res.ok) alert(res.error || "Errore nel caricamento.");
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

  async function inviaATutti() {
    if (!confirm(`Inviare l'aggiornamento di "${modello.nomeModello}" a tutti gli interessati della categoria "${modello.categoria}"?`)) return;
    setInviando(true);
    setEsito(null);
    try {
      const res = await DocumentazionePrivacyApi.inviaAggiornamento(modello.pageId);
      if (!res.ok) {
        setEsito(`⚠️ ${res.error || "Errore nell'invio."}`);
      } else if (res.falliti.length > 0) {
        setEsito(`✅ Inviato a ${res.inviati}. ⚠️ Non riusciti: ${res.falliti.join(", ")}.`);
      } else if (res.inviati === 0) {
        setEsito("ℹ️ Nessun destinatario trovato per questa categoria.");
      } else {
        setEsito(`✅ Aggiornamento inviato a ${res.inviati} destinatari.`);
      }
      onChanged();
    } catch (err: any) {
      setEsito(`⚠️ ${err?.message || "Errore nell'invio."}`);
    } finally {
      setInviando(false);
    }
  }

  async function inviaAiMancanti() {
    if (!confirm(`Inviare "${modello.nomeModello}" solo a chi non l'ha mai ricevuto (${mancanti.length} persone)?`)) return;
    setInviandoMancanti(true);
    setEsito(null);
    try {
      const res = await DocumentazionePrivacyApi.inviaMancanti(modello.pageId);
      if (!res.ok) {
        setEsito(`⚠️ ${res.error || "Errore nell'invio."}`);
      } else if (res.falliti.length > 0) {
        setEsito(`✅ Inviato a ${res.inviati}. ⚠️ Non riusciti: ${res.falliti.join(", ")}.`);
      } else {
        setEsito(`✅ Inviato ai ${res.inviati} che non l'avevano mai ricevuto.`);
      }
      onChanged();
    } catch (err: any) {
      setEsito(`⚠️ ${err?.message || "Errore nell'invio."}`);
    } finally {
      setInviandoMancanti(false);
    }
  }

  const pending = aggiornamentoPending(modello);

  return (
    <div className="ana-card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-dark)", marginBottom: 2 }}>{modello.nomeModello}</div>
      <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600, marginBottom: 8 }}>Destinatari: {modello.categoria || "—"}</div>

      {modello.allegatoNome ? (
        <div style={{ fontSize: 12, color: "var(--text-mid)", marginBottom: 4 }}>📎 {modello.allegatoNome}</div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--text-light)", marginBottom: 4 }}>Nessun modello caricato</div>
      )}
      {modello.allegatoUrl && <div style={{ marginBottom: 6 }}><a href={modello.allegatoUrl} target="_blank" rel="noreferrer" style={{ color: "var(--teal)", fontWeight: 700, fontSize: 13 }}>Apri / scarica</a></div>}

      <div style={{ fontSize: 11, color: "var(--text-light)", marginBottom: 2 }}>Ultimo aggiornamento: {fmtDateOraIt(modello.dataUltimoAggiornamento)}{modello.aggiornatoDa ? ` · ${modello.aggiornatoDa}` : ""}</div>
      <div style={{ fontSize: 11, color: "var(--text-light)", marginBottom: 8 }}>Ultimo invio massivo: {fmtDateOraIt(modello.dataUltimoInvio)}</div>

      {pending && (
        <div style={{ display: "inline-block", marginBottom: 8, padding: "3px 9px", borderRadius: 10, fontSize: 11, fontWeight: 800, background: "#FEF3CD", color: "#7A5800" }}>⏳ Aggiornamento non ancora inviato</div>
      )}

      {mancanti.length > 0 && (
        <div className="ana-card" style={{ padding: "0.75rem", marginBottom: 10, background: "#FCE4E4" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#7A1A1A", marginBottom: 4 }}>⚠️ {mancanti.length} interessati non hanno mai ricevuto questo documento</div>
          <div style={{ fontSize: 11, color: "#7A1A1A", marginBottom: 8 }}>{mancanti.map(m => m.nome).join(", ")}</div>
          <button
            disabled={inviandoMancanti || !modello.allegatoUrl}
            onClick={inviaAiMancanti}
            style={{ padding: "0.45rem 0.8rem", background: modello.allegatoUrl ? "#7A1A1A" : "#ccc", color: "white", border: "none", borderRadius: 14, fontSize: 12, fontWeight: 800, cursor: modello.allegatoUrl ? "pointer" : "default" }}
          >
            {inviandoMancanti ? "Invio..." : `✉️ Invia solo a chi manca (${mancanti.length})`}
          </button>
        </div>
      )}

      {esito && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-dark)", marginBottom: 8 }}>{esito}</div>}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <label style={{ display: "inline-block", padding: "0.5rem 0.9rem", background: "var(--teal)", color: "white", borderRadius: 16, fontSize: 12, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Caricamento..." : (modello.allegatoNome ? "📤 Sostituisci" : "📤 Carica modello")}
          <input type="file" disabled={busy} onChange={onUpload} style={{ display: "none" }} />
        </label>
        <button
          disabled={inviando || !modello.allegatoUrl}
          onClick={inviaATutti}
          style={{ padding: "0.5rem 0.9rem", background: modello.allegatoUrl ? "var(--coral)" : "#ccc", color: "white", border: "none", borderRadius: 16, fontSize: 12, fontWeight: 800, cursor: modello.allegatoUrl ? "pointer" : "default" }}
        >
          {inviando ? "Invio..." : "✉️ Invia aggiornamento a tutti gli interessati"}
        </button>
      </div>
    </div>
  );
}

export default function DocumentazionePrivacyGP() {
  const [items, setItems] = useState<ModelloPrivacy[]>([]);
  const [mancanti, setMancanti] = useState<Record<string, { pageId: string; nome: string; email: string }[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([DocumentazionePrivacyApi.list(), DocumentazionePrivacyApi.mancanti()])
      .then(([lista, mancantiMap]) => {
        setItems(Array.isArray(lista) ? lista : []);
        setMancanti(mancantiMap && typeof mancantiMap === "object" ? mancantiMap : {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="section-label"><div className="section-title">Documentazione privacy</div></div>
      <div className="ana-card" style={{ padding: "0.85rem 1rem", marginBottom: "0.75rem", background: "#EAF6F4" }}>
        <div style={{ fontSize: 12, color: "var(--text-mid)" }}>Qui carichi i modelli usati per gli invii automatici (nuovi dipendenti, incaricati, amministratori interni). Sostituire un modello lo rende definitivo per i prossimi invii; per aggiornare anche chi lo ha già ricevuto usa "Invia aggiornamento a tutti gli interessati".</div>
      </div>

      {loading ? (
        <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)" }}>Caricamento...</div>
      ) : items.length === 0 ? (
        <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessun modello trovato</div>
      ) : (
        items.map((m, i) => <ModelloCard key={i} modello={m} mancanti={mancanti[m.pageId] || []} onChanged={load} />)
      )}
      <button className="update-btn" onClick={load}>Aggiorna</button>
    </div>
  );
}
