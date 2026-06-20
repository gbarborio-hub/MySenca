import { useEffect, useState, useCallback } from "react";
import type { Dipendente, UtenteWebApp } from "../../models/domain.js";
import { DipendentiApi } from "../../services/DipendentiApi.js";
import { UtentiApi } from "../../services/UtentiApi.js";
import RoleSwitchMini from "../../components/RoleSwitchMini.js";
import Logo from "../../components/Logo.js";
import { NavIcons } from "../../components/NavIcons.js";
import AdminHome from "./AdminHome.js";
import AdminAbilitare from "./AdminAbilitare.js";
import AdminUtenti from "./AdminUtenti.js";

type AdminScreen = "home" | "abilitare" | "utenti";

interface Props {
  nome: string;
  showRoleSwitch: boolean;
  onShowRoleChooser: () => void;
  onLogout: () => void;
}

export default function AdminView({ nome, showRoleSwitch, onShowRoleChooser, onLogout }: Props) {
  const [screen, setScreen] = useState<AdminScreen>("home");
  const [dipendenti, setDipendenti] = useState<Dipendente[]>([]);
  const [dipLoading, setDipLoading] = useState(true);
  const [utenti, setUtenti] = useState<UtenteWebApp[]>([]);
  const [utentiLoading, setUtentiLoading] = useState(false);

  const fetchDipendenti = useCallback(async () => {
    setDipLoading(true);
    setDipendenti(await DipendentiApi.list());
    setDipLoading(false);
  }, []);
  const fetchUtenti = useCallback(async () => {
    setUtentiLoading(true);
    setUtenti(await UtentiApi.list());
    setUtentiLoading(false);
  }, []);

  useEffect(() => { fetchDipendenti(); }, [fetchDipendenti]);
  useEffect(() => { if (screen === "utenti") fetchUtenti(); }, [screen, fetchUtenti]);

  const senzaUsername = dipendenti.filter(d => !d.username);
  const firstName = nome.split(" ")[0] || "utente";

  const navs: { id: AdminScreen | "logout"; label: string; icon: keyof typeof NavIcons }[] = [
    { id: "home", label: "Home", icon: "home" },
    { id: "abilitare", label: "Da abilitare", icon: "daAbilitare" },
    { id: "utenti", label: "Utenti", icon: "utenti" },
    { id: "logout", label: "Esci", icon: "logout" }
  ];

  return (
    <div className="app-screen gp-screen">
      <div className="gp-main">
        <div className="app-header">
          <div className="app-greeting">Buongiorno,<br />{firstName}</div>
          <div className="app-logo"><Logo /></div>
        </div>
        <div className="app-content">
          <RoleSwitchMini visible={showRoleSwitch} onClick={onShowRoleChooser} />
          {screen === "home" && <AdminHome dipendentiSenzaUsername={senzaUsername} onGo={setScreen} />}
          {screen === "abilitare" && (
            <AdminAbilitare dipendenti={senzaUsername} loading={dipLoading} onRefresh={fetchDipendenti} onCreated={() => { fetchDipendenti(); fetchUtenti(); }} />
          )}
          {screen === "utenti" && <AdminUtenti utenti={utenti} loading={utentiLoading} onRefresh={fetchUtenti} />}
        </div>
      </div>
      <div className="bottom-nav">
        {navs.map(nav => (
          <div
            key={nav.id}
            className={`bnav-item ${screen === nav.id ? "active" : ""}`}
            onClick={() => (nav.id === "logout" ? onLogout() : setScreen(nav.id as AdminScreen))}
          >
            <div className="bnav-icon">{NavIcons[nav.icon]}</div>
            <div className="bnav-label">{nav.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
