interface Props {
  nome: string;
  onLogout: () => void;
}

// TODO: port full Gestione Personale panel (dipendenti CRUD, turni, timbrature,
// comunicazioni, ferie, strutture, buste paga) from legacy renderGestionePersonale().
export default function GestionePersonaleView({ nome, onLogout }: Props) {
  return (
    <div className="app-screen">
      <div className="app-header"><div className="app-greeting">Buongiorno,<br />{nome.split(" ")[0]}</div></div>
      <div className="app-content">
        <div className="timbra-card" style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-light)", fontWeight: 700 }}>
          Pannello Gestione Personale — porting in corso.
        </div>
      </div>
      <div className="bottom-nav">
        <div className="bnav-item active" onClick={onLogout}><div className="bnav-label">Esci</div></div>
      </div>
    </div>
  );
}
