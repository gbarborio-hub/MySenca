// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { useState, useCallback, useEffect } from "react";
import type { CurrentUser, Ruolo } from "../models/domain.js";
import { RUOLI_CON_INTERFACCIA } from "../models/domain.js";
import { saveSession, loadSession, clearSession, getBio, clearBio, bioSupported, enrollBio, unlockBio } from "./session.js";
import { setApiUser, clearApiUser } from "../services/apiClient.js";
import { AuditEventApi } from "../services/AuditEventApi.js";

function ruoliConInterfaccia(ruoli: Ruolo[]): Ruolo[] {
  return ruoli.filter(r => RUOLI_CON_INTERFACCIA.includes(r));
}

export function useSession() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [choosingRole, setChoosingRole] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pendingUser, setPendingUser] = useState<CurrentUser | null>(null);
  const [lockErr, setLockErr] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadSession();
    if (saved && getBio() && bioSupported()) {
      setPendingUser(saved);
      setLocked(true);
    }
  }, []);

  const login = useCallback((username: string, nome: string, ruoli: Ruolo[], remember: boolean, createdTime?: string | null) => {
    const valid = ruoliConInterfaccia(ruoli);
    const activeRole = valid.length > 0 ? valid[0] : ruoli[0];
    const newUser: CurrentUser = { username, nome, ruoli, activeRole, createdTime };

    if (remember) saveSession(newUser);
    else { clearSession(); clearBio(); }

    // Imposta l'identità per l'audit log su ogni chiamata API successiva
    setApiUser(username, activeRole);

    if (remember && bioSupported() && !getBio()) {
      setTimeout(() => {
        if (confirm("Vuoi abilitare l'accesso rapido con Face ID o impronta digitale su questo dispositivo?")) {
          enrollBio(newUser).then(() => alert("✅ Accesso biometrico abilitato.")).catch(() => {});
        }
      }, 700);
    }

    setLocked(false);
    setPendingUser(null);
    setLockErr(null);
    if (valid.length > 1) {
      setUser(newUser);
      setChoosingRole(true);
    } else {
      setUser(newUser);
      setChoosingRole(false);
    }
  }, []);

  const chooseRole = useCallback((role: Ruolo) => {
    setUser(u => {
      if (!u) return u;
      // Il ruolo attivo può cambiare senza un nuovo login — aggiorna l'header di conseguenza
      setApiUser(u.username, role);
      return { ...u, activeRole: role };
    });
    setChoosingRole(false);
  }, []);

  const reopenChooser = useCallback(() => setChoosingRole(true), []);

  const logout = useCallback(() => {
    if (user) {
      AuditEventApi.logEvent("LOGOUT", `Ruolo attivo: ${user.activeRole}`);
    }
    clearSession();
    clearBio();
    clearApiUser();
    setUser(null);
    setChoosingRole(false);
    setLocked(false);
    setPendingUser(null);
  }, [user]);

  const unlock = useCallback(async () => {
    if (!pendingUser) return;
    try {
      await unlockBio();
      const ruoli = pendingUser.ruoli && pendingUser.ruoli.length ? pendingUser.ruoli : [pendingUser.activeRole];
      const valid = ruoliConInterfaccia(ruoli);
      const activeRole = valid.includes(pendingUser.activeRole) ? pendingUser.activeRole : (valid[0] || pendingUser.activeRole);

      // Imposta l'identità per l'audit log, poi registra esplicitamente l'evento di sblocco
      // biometrico — l'autenticazione stessa resta locale (Secure Enclave/TPM), ma il backend
      // deve comunque sapere che è avvenuto un accesso.
      setApiUser(pendingUser.username, activeRole);
      AuditEventApi.logEvent("LOGIN", "Sblocco Face ID / Touch ID / impronta");

      setUser({ ...pendingUser, ruoli, activeRole });
      setLocked(false);
      setPendingUser(null);
      setLockErr(null);
    } catch {
      setLockErr("Sblocco non riuscito. Riprova o usa la password.");
    }
  }, [pendingUser]);

  const usePasswordInstead = useCallback(() => {
    setLocked(false);
    setLockErr(null);
  }, []);

  return {
    user, choosingRole, login, chooseRole, reopenChooser, logout,
    ruoliSelezionabili: user ? ruoliConInterfaccia(user.ruoli) : [],
    locked, pendingUser, lockErr, unlock, usePasswordInstead
  };
}
