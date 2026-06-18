import { useState } from "react";
import type { Dipendente, Ruolo } from "../../models/domain.js";
import { RUOLI_CON_INTERFACCIA } from "../../models/domain.js";
import { UtentiApi } from "../../services/UtentiApi.js";

interface Props {
  dipendenti: Dipendente[];
  loading: boolean;
  onRefresh: () => void;
  onCreated: () => void;
}

function proponiUsername(nome: string, cognome: string): string {
  const n = (nome || "").trim().toLowerCase().charAt(0);
  const c = (cognome || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!n || !c) return "";
  return `${n}.${c}`;
}

export default function AdminAbilitare({ dipendenti, loading, onRefresh, onCreated }: Props) {
  const [selected, setSelected] = useState<Dipendente | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [ruolo, setRuolo] = useState<Ruolo>("Dipendente");
  const [ruoliAggiuntivi, setRuoliAggiuntivi] = useState<Ruolo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ username: string; password: string; emailInviata: boolean } | null>(null);

  function open(d: Dipendente) {
    setSelected(d);
    setUsername(proponiUsername(d.nome, d.cognome));
    setEmail(d.email || "");
    setRuolo("Dipendente");
    setRuoliAggiuntivi([]);
    setResult(null);
    setError(null);
  }
  function close() {
    setSelected(null);
  }
  function toggleRuoloAgg(r: Ruolo) {
    setRuoliAggiuntivi(prev => (prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]));
  }

  async function salvaInvia() {
    if (!selected) return;
    if (!username.trim()) { setError("Inserisci uno username."); return; }
    setBusy(true);
    setError(null);
    const res = await UtentiApi.crea({
      username, email: email || undefined, ruolo, ruoliAggiuntivi,
      dipendentePageId: selected.pageId
    });
    setBusy(false);
    if (res.ok && res.username && res.password) {
      setResult({ username: res.username, password: res.password, emailInviata: !!res.emailInviata });
      onCreated();
    } else {
      setError(res.error || "Errore nella creazione dell'utenza.");
    }
  }

  if (selected) {
    return (
      <div>
        <div className="section-label"><div className="section-title">Assegna accesso</div></div>
        <div className="ana-card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text-dark)", marginBottom: 4 }}>
            {selected.nome} {selected.cognome}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 600, marginBottom: "0.75rem" }}>
            {selected.mansione} · {selected.struttura}
          </div>

          {result ? (
            <>
              <div className="ana-card" style={{ padding: "0.9rem 1rem", marginBottom: "0.75rem", background: "#E3F6E9", border: "1px solid #9ED8B0" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1A5C33" }}>✅ Utenza creata</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1A5C33", marginTop: 6 }}>Username: <b>{result.username}</b></div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1A5C33" }}>Password: <b>{result.password}</b></div>
                <div style={{ fontSize: 11, color: "#1A5C33", marginTop: 6 }}>
                  {result.emailInviata
                    ? "Le credenziali sono state inviate via email al dipendente."
                    : "Invio email non riuscito: copia queste credenziali e comunicale tu al dipendente."}
                </div>
              </div>
              <button className="update-btn" onClick={close}>← Torna alla lista</button>
            </>
          ) : (
            <>
              <label className="dim-lbl">Username</label>
              <input className="dim-in" value={username} onChange={e => setUsername(e.target.value.trim().toLowerCase())} autoCapitalize="none" />
              <label className="dim-lbl">Email (opzionale)</label>
              <input className="dim-in" value={email} onChange={e => setEmail(e.target.value.trim())} />
              <label className="dim-lbl">Ruolo</label>
              <select className="dim-in" value={ruolo} onChange={e => setRuolo(e.target.value as Ruolo)}>
                {RUOLI_CON_INTERFACCIA.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <label className="dim-lbl">Altri ruoli (interfacce aggiuntive)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {RUOLI_CON_INTERFACCIA.filter(r => r !== ruolo).map(r => (
                  <button key={r} className={`com-pill${ruoliAggiuntivi.includes(r) ? " on" : ""}`} onClick={() => toggleRuoloAgg(r)}>{r}</button>
                ))}
              </div>
              {error && (
                <div style={{ marginBottom: "0.5rem", padding: "0.6rem", borderRadius: 10, background: "#FEF3CD", color: "#7A5800", fontSize: 12, fontWeight: 700, textAlign: "center" }}>
                  {error}
                </div>
              )}
              <button className="update-btn" style={{ background: "var(--teal)" }} disabled={busy} onClick={salvaInvia}>
                {busy ? "Salvataggio..." : "💾 Salva e invia credenziali"}
              </button>
              <button className="update-btn" style={{ background: "var(--coral)" }} onClick={close}>← Annulla</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-label"><div className="section-title">Dipendenti da abilitare</div></div>
      {loading ? (
        <div className="timbra-card"><div style={{ textAlign: "center", padding: "1rem", color: "var(--text-light)", fontWeight: 700 }}>Caricamento dipendenti...</div></div>
      ) : dipendenti.length === 0 ? (
        <div className="timbra-card"><div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-light)", fontWeight: 700 }}>✅ Tutti i dipendenti hanno già un username.</div></div>
      ) : (
        <div className="table-card">
          {dipendenti.map(d => (
            <div className="table-row" key={d.pageId}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row-title">{d.nome} {d.cognome}</div>
                <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>{d.mansione} · {d.struttura}</div>
              </div>
              <button
                style={{ background: "var(--teal)", color: "white", border: "none", borderRadius: 20, padding: "0.45rem 0.9rem", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Satoshi,sans-serif" }}
                onClick={() => open(d)}
              >
                Assegna username
              </button>
            </div>
          ))}
        </div>
      )}
      <button className="update-btn" onClick={onRefresh}>Aggiorna</button>
    </div>
  );
}
