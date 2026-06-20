import { useState } from "react";
import { AuthApi } from "../services/AuthApi.js";
import Logo from "../components/Logo.js";

interface Props {
  onSuccess: (username: string, nome: string, ruoli: string[]) => void;
}

export default function LoginView({ onSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await AuthApi.login(username, password);
    setBusy(false);
    if (res.ok && res.ruoli) {
      onSuccess(res.username || username, res.nome || username, res.ruoli);
    } else {
      setError(res.error || "Credenziali non valide.");
    }
  }

  return (
    <div className="login-screen">
      <div className="login-logo-area"><div className="login-logo-wrap"><Logo size={64} /></div></div>
      <form className="login-body" onSubmit={handleSubmit}>
        <label className="field-label">Username</label>
        <input className="field-input" value={username} onChange={e => setUsername(e.target.value)} autoCapitalize="none" />
        <label className="field-label">Password</label>
        <input className="field-input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <div style={{ color: "var(--coral)", fontWeight: 700, fontSize: 13, marginBottom: "0.75rem" }}>{error}</div>}
        <button className="login-btn" type="submit" disabled={busy}>{busy ? "Accesso..." : "Accedi"}</button>
      </form>
    </div>
  );
}
