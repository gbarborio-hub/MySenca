import { useState, useCallback } from "react";
import type { CurrentUser, Ruolo } from "../models/domain.js";
import { RUOLI_CON_INTERFACCIA } from "../models/domain.js";

function ruoliConInterfaccia(ruoli: Ruolo[]): Ruolo[] {
  return ruoli.filter(r => RUOLI_CON_INTERFACCIA.includes(r));
}

export function useSession() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [choosingRole, setChoosingRole] = useState(false);

  const login = useCallback((username: string, nome: string, ruoli: Ruolo[]) => {
    const valid = ruoliConInterfaccia(ruoli);
    if (valid.length > 1) {
      setUser({ username, nome, ruoli, activeRole: valid[0] });
      setChoosingRole(true);
    } else {
      setUser({ username, nome, ruoli, activeRole: valid[0] || ruoli[0] });
      setChoosingRole(false);
    }
  }, []);

  const chooseRole = useCallback((role: Ruolo) => {
    setUser(u => (u ? { ...u, activeRole: role } : u));
    setChoosingRole(false);
  }, []);

  const reopenChooser = useCallback(() => setChoosingRole(true), []);

  const logout = useCallback(() => {
    setUser(null);
    setChoosingRole(false);
  }, []);

  return {
    user, choosingRole, login, chooseRole, reopenChooser, logout,
    ruoliSelezionabili: user ? ruoliConInterfaccia(user.ruoli) : []
  };
}
