import Logo from "../components/Logo.js";

interface Props {
  nome: string;
  error: string | null;
  onUnlock: () => void;
  onUsePassword: () => void;
}

export default function LockView({ nome, error, onUnlock, onUsePassword }: Props) {
  return (
    <div className="login-screen">
      <div className="login-logo-area"><div className="login-logo-wrap"><Logo size={64} /></div></div>
      <div className="login-body">
        <div className="login-greeting">Bentornato</div>
        <div className="login-sub">{nome}</div>
        <button className="login-btn" onClick={onUnlock}>🔒 Sblocca con Face ID / impronta</button>
        <button className="link-btn" onClick={onUsePassword}>Usa username e password</button>
        {error && <div className="login-error" style={{ display: "block" }}>{error}</div>}
      </div>
    </div>
  );
}
