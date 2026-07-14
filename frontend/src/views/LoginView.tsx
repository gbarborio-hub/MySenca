import { useState } from "react";
import { AuthApi } from "../services/AuthApi.js";
import Logo from "../components/Logo.js";

interface Props {
  onSuccess: (username: string, nome: string, ruoli: string[], remember: boolean, createdTime?: string | null) => void;
}

export default function LoginView({ onSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step TOTP: attivato solo se il backend segnala requiresTotp dopo password corretta
  const [awaitingTotp, setAwaitingTotp] = useState(false);
  const [totpCode, setTotpCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await AuthApi.login(username, password);
      setBusy(false);
      if (res.requiresTotp) {
        setAwaitingTotp(true);
        return;
      }
      if (res.ok && res.ruoli) {
        onSuccess(res.username || username, res.nome || username, res.ruoli, remember, res.createdTime);
      } else {
        setError(res.error || "Credenziali non valide.");
      }
    } catch (err: any) {
      setBusy(false);
      setError(err?.message || "Credenziali non valide.");
    }
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await AuthApi.verifyTotp(username, totpCode);
      setBusy(false);
      if (res.ok && res.ruoli) {
        onSuccess(res.username || username, res.nome || username, res.ruoli, remember, res.createdTime);
      } else {
        setError(res.error || "Codice non valido.");
      }
    } catch (err: any) {
      setBusy(false);
      setError(err?.message || "Codice non valido.");
    }
  }

  if (awaitingTotp) {
    return (
      <div className="login-screen">
        <div className="login-logo-area"><div className="login-logo-wrap"><Logo size={168} /></div></div>
        <form className="login-body" onSubmit={handleTotpSubmit}>
          <label className="field-label">Codice di verifica</label>
          <div style={{ fontSize: 13, color: "var(--text-mid)", fontWeight: 600, marginBottom: "0.75rem" }}>
            Inserisci il codice a 6 cifre dalla tua app di autenticazione.
          </div>
          <input
            className="field-input"
            value={totpCode}
            onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoFocus
            maxLength={6}
            placeholder="000000"
            style={{ letterSpacing: 4, fontSize: 20, textAlign: "center" }}
          />
          {error && <div style={{ color: "var(--coral)", fontWeight: 700, fontSize: 13, margin: "0.75rem 0" }}>{error}</div>}
          <button className="login-btn" type="submit" disabled={busy || totpCode.length !== 6}>{busy ? "Verifica..." : "Conferma"}</button>
          <button
            type="button"
            onClick={() => { setAwaitingTotp(false); setTotpCode(""); setError(null); }}
            style={{ background: "none", border: "none", color: "var(--teal)", fontWeight: 700, fontSize: 13, marginTop: "0.75rem", cursor: "pointer", fontFamily: "Satoshi,sans-serif" }}
          >
            ← Torna al login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-logo-area"><div className="login-logo-wrap"><Logo size={168} /></div></div>
      <form className="login-body" onSubmit={handleSubmit}>
        <label className="field-label">Username</label>
        <input className="field-input" value={username} onChange={e => setUsername(e.target.value)} autoCapitalize="none" />
        <label className="field-label">Password</label>
        <input className="field-input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 13, fontWeight: 700, color: "var(--text-mid)", margin: "0.5rem 0 0.75rem", cursor: "pointer" }}>
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: 16, height: 16 }} /> Ricordami su questo dispositivo
        </label>
        {error && <div style={{ color: "var(--coral)", fontWeight: 700, fontSize: 13, marginBottom: "0.75rem" }}>{error}</div>}
        <button className="login-btn" type="submit" disabled={busy}>{busy ? "Accesso..." : "Accedi"}</button>
      </form>
    </div>
  );
}
