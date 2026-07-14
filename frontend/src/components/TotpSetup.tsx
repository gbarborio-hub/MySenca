// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
// Componente riutilizzabile per attivare/disattivare l'autenticazione a due fattori
// (TOTP) dal profilo dell'utente. Facoltativo per ognuno, come da richiesta.
import { useState, useEffect } from "react";
import { TotpApi } from "../services/TotpApi.js";

interface Props {
  username: string;
}

type Fase = "loading" | "disattivo" | "attivazione" | "attivo";

export default function TotpSetup({ username }: Props) {
  const [fase, setFase] = useState<Fase>("loading");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [codice, setCodice] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  useEffect(() => {
    TotpApi.status(username).then(r => setFase(r?.enabled ? "attivo" : "disattivo")).catch(() => setFase("disattivo"));
  }, [username]);

  async function avviaAttivazione() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await TotpApi.setup(username);
      setQrDataUrl(res.qrDataUrl);
      setManualKey(res.manualKey);
      setFase("attivazione");
    } catch (e: any) {
      setMsg({ text: e?.message || "Errore nella generazione del codice.", type: "err" });
    } finally {
      setBusy(false);
    }
  }

  async function confermaAttivazione() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await TotpApi.confirm(username, codice);
      if (res.ok) {
        setFase("attivo");
        setCodice("");
        setMsg({ text: "✅ Autenticazione a due fattori attivata.", type: "ok" });
      } else {
        setMsg({ text: res.error || "Codice non valido.", type: "err" });
      }
    } catch (e: any) {
      setMsg({ text: e?.message || "Codice non valido.", type: "err" });
    } finally {
      setBusy(false);
    }
  }

  async function disattiva() {
    if (!confirm("Disattivare l'autenticazione a due fattori?")) return;
    setBusy(true);
    setMsg(null);
    try {
      await TotpApi.disable(username);
      setFase("disattivo");
      setMsg({ text: "Autenticazione a due fattori disattivata.", type: "ok" });
    } catch (e: any) {
      setMsg({ text: e?.message || "Errore nella disattivazione.", type: "err" });
    } finally {
      setBusy(false);
    }
  }

  if (fase === "loading") return null;

  return (
    <div className="ana-card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-dark)", marginBottom: 6 }}>
        🔐 Autenticazione a due fattori
      </div>

      {fase === "disattivo" && (
        <>
          <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 600, marginBottom: 10 }}>
            Aggiunge un codice di sicurezza dal telefono al login con password. Facoltativa — lo sblocco con Face ID/impronta resta invariato.
          </div>
          <button className="ts-save" disabled={busy} onClick={avviaAttivazione}>
            {busy ? "Generazione..." : "Attiva"}
          </button>
        </>
      )}

      {fase === "attivazione" && (
        <>
          <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 600, marginBottom: 10 }}>
            Scansiona questo codice con Google Authenticator, Authy o app simile, poi inserisci il codice a 6 cifre generato per confermare.
          </div>
          {qrDataUrl && (
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <img src={qrDataUrl} alt="QR code TOTP" style={{ width: 180, height: 180, borderRadius: 8 }} />
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-light)", marginBottom: 4 }}>Oppure inserisci manualmente questa chiave:</div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-mid)", wordBreak: "break-all", background: "#F5F5F5", padding: "6px 8px", borderRadius: 6, marginBottom: 12 }}>
            {manualKey}
          </div>
          <input
            className="dim-in"
            value={codice}
            onChange={e => setCodice(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            placeholder="Codice a 6 cifre"
            style={{ letterSpacing: 4, fontSize: 18, textAlign: "center", marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="ts-save" disabled={busy || codice.length !== 6} onClick={confermaAttivazione}>
              {busy ? "Verifica..." : "Conferma"}
            </button>
            <button className="ts-cancel" onClick={() => { setFase("disattivo"); setCodice(""); setMsg(null); }}>Annulla</button>
          </div>
        </>
      )}

      {fase === "attivo" && (
        <>
          <div style={{ fontSize: 12, color: "#1A6B3A", fontWeight: 700, marginBottom: 10 }}>
            ✅ Attiva su questo account
          </div>
          <button className="ts-cancel" disabled={busy} onClick={disattiva}>
            {busy ? "..." : "Disattiva"}
          </button>
        </>
      )}

      {msg && (
        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: msg.type === "ok" ? "#1A6B3A" : "var(--coral)" }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
