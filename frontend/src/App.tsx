import { useSession } from "./models/useSession.js";
import LoginView from "./views/LoginView.js";
import LockView from "./views/LockView.js";
import RoleChooserView from "./views/RoleChooserView.js";
import AdminView from "./views/admin/AdminView.js";
import GestionePersonaleView from "./views/GestionePersonaleView.js";
import DipendenteView from "./views/DipendenteView.js";
import PrivacyView from "./views/PrivacyView.js";

export default function App() {
  const {
    user, choosingRole, login, chooseRole, reopenChooser, logout, ruoliSelezionabili,
    locked, pendingUser, lockErr, unlock, usePasswordInstead
  } = useSession();

  if (locked && pendingUser) {
    return <LockView nome={pendingUser.nome || pendingUser.username} error={lockErr} onUnlock={unlock} onUsePassword={usePasswordInstead} />;
  }
  if (!user) {
    return <LoginView onSuccess={(username, nome, ruoli, remember, createdTime) => login(username, nome, ruoli as any, remember, createdTime)} />;
  }
  if (choosingRole) {
    return <RoleChooserView nome={user.nome} ruoli={ruoliSelezionabili} onChoose={chooseRole} onLogout={logout} />;
  }

  const showRoleSwitch = ruoliSelezionabili.length > 1;

  switch (user.activeRole) {
    case "Admin":
      return <AdminView nome={user.nome} showRoleSwitch={showRoleSwitch} onShowRoleChooser={reopenChooser} onLogout={logout} />;
    case "Gestione personale":
      return <GestionePersonaleView nome={user.nome} username={user.username} showRoleSwitch={showRoleSwitch} onShowRoleChooser={reopenChooser} onLogout={logout} />;
    case "Dipendente":
      return <DipendenteView username={user.username} nome={user.nome} ruolo={user.activeRole} createdTime={user.createdTime} showRoleSwitch={showRoleSwitch} onShowRoleChooser={reopenChooser} onLogout={logout} />;
    case "Privacy":
      return <PrivacyView nome={user.nome} username={user.username} showRoleSwitch={showRoleSwitch} onShowRoleChooser={reopenChooser} onLogout={logout} />;
    default:
      return <PrivacyView nome={user.nome} username={user.username} showRoleSwitch={showRoleSwitch} onShowRoleChooser={reopenChooser} onLogout={logout} />;
  }
}
