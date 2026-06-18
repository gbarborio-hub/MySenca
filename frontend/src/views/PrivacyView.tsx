interface Props {
  nome: string;
  showRoleSwitch: boolean;
  onShowRoleChooser: () => void;
  onLogout: () => void;
}

// TODO: port full Privacy/Marketing panel (dashboard, lista post, calendario, incaricati)
// from legacy renderApp_Inner().
export default function PrivacyView({ nome, showRoleSwitch, onShowRoleChooser, onLogout }: Props) {
  return (
    <div className="app-screen">
      <div className="app-header"><div className="app-greeting">Buongiorno,<br />{nome.split(" ")[0]}</div></div>
      <div className="app-content">
        {showRoleSwitch && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
            <button onClick={onShowRoleChooser}>🔄 Cambia interfaccia</button>
          </div>
        )}
        <div className="timbra-card" style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-light)", fontWeight: 700 }}>
          Pannello Privacy &amp; Marketing — porting in corso.
        </div>
      </div>
      <div className="bottom-nav">
        <div className="bnav-item active" onClick={onLogout}><div className="bnav-label">Esci</div></div>
      </div>
    </div>
  );
}
