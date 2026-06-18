import type { Dipendente } from "../../models/domain.js";

interface Props {
  dipendentiSenzaUsername: Dipendente[];
  onGo: (view: "abilitare" | "utenti") => void;
}

export default function AdminHome({ dipendentiSenzaUsername, onGo }: Props) {
  return (
    <div>
      <div
        className="timbra-card-big"
        style={{ background: "var(--coral)", minHeight: 120, cursor: "pointer" }}
        onClick={() => onGo("abilitare")}
      >
        <div className="timbra-card-big-orb"></div>
        <div className="timbra-card-big-title" style={{ fontSize: 26 }}>🆕 Dipendenti da abilitare</div>
        <div className="timbra-card-big-sub">{dipendentiSenzaUsername.length} senza username · assegna accesso alla web app</div>
      </div>
      <div className="dip-half-cards">
        <div
          className="dip-half-card"
          style={{ background: "var(--teal-dark)", minHeight: 110, flex: 1, cursor: "pointer" }}
          onClick={() => onGo("utenti")}
        >
          <div className="dip-half-orb"></div>
          <div className="dip-half-label">Gestisci</div>
          <div className="dip-half-value" style={{ fontSize: 20 }}>Utenti web app</div>
        </div>
      </div>
    </div>
  );
}
