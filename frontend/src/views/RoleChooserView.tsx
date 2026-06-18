import type { Ruolo } from "../models/domain.js";

const COLORS: Record<string, string> = {
  "Gestione personale": "var(--teal-dark)",
  "Dipendente": "var(--teal)",
  "Admin": "var(--coral)",
  "Privacy": "var(--cyan)"
};
const LABELS: Record<string, string> = {
  "Gestione personale": "Ufficio personale",
  "Dipendente": "Dipendente",
  "Admin": "Amministratore",
  "Privacy": "Privacy"
};

interface Props {
  nome: string;
  ruoli: Ruolo[];
  onChoose: (r: Ruolo) => void;
  onLogout: () => void;
}

export default function RoleChooserView({ nome, ruoli, onChoose, onLogout }: Props) {
  return (
    <div className="login-screen">
      <div className="login-logo-area"><div className="login-logo-wrap">Senca Hub</div></div>
      <div className="login-body">
        <div className="login-greeting">Ciao {nome}!</div>
        <div className="login-sub">Con quale interfaccia vuoi entrare?</div>
        {ruoli.map(r => (
          <button key={r} className="role-choice-btn" style={{ background: COLORS[r] || "var(--teal)" }} onClick={() => onChoose(r)}>
            {LABELS[r] || r}
          </button>
        ))}
        <button className="role-choice-logout" onClick={onLogout}>Esci</button>
      </div>
    </div>
  );
}
