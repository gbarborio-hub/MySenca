import { useState, useCallback, useEffect } from "react";
import type { CurrentUser, Ruolo } from "../models/domain.js";
import { RUOLI_CON_INTERFACCIA } from "../models/domain.js";
import { saveSession, loadSession, clearSession, getBio, clearBio, bioSupported, enrollBio, unlockBio } from "./session.js";

function ruoliConInterfaccia(ruoli: Ruolo[]): Ruolo[] {
  return ruoli.filter(r => RUOLI_CON_INTERFACCIA.includes(r));
}

export function useSession() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [choosingRole, setChoosingRole] = useState(false);
  // All'avvio, se c'è una sessione salvata e una biometria registrata, mostriamo
  // la schermata di blocco invece del login pieno (stesso comportamento dell'originale).
  const [locked, setLocked] = useState(false);
  const [pendingUser, setPendingUser] = useState<CurrentUser | null>(null);
  const [lockErr, setLockErr] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadSession();
    if (saved && getBio() && bioSupported()) {
      setPendingUser(saved);
      setLocked(true);
    }
    // Se c'è sessione ma niente biometria, l'originale richiede comunque username+password
    // (la sessione serve solo a "ricordare" l'utente per l'enroll biometrico successivo).
  }, []);

  const login = useCallback((username: string, nome: string, ruoli: Ruolo[], remember: boolean) => {
    const valid = ruoliConInterfaccia(ruoli);
    const activeRole = valid.length > 0 ? valid[0] : ruoli[0];
    const newUser: CurrentUser = { username, nome, ruoli, activeRole };

    if (remember) saveSession(newUser);
    else { clearSession(); clearBio(); }

    // Propone l'enroll biometrico solo se l'utente ha scelto "ricordami",
    // il dispositivo supporta WebAuthn, e non c'è già una credenziale salvata.
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
    setUser(u => (u ? { ...u, activeRole: role } : u));
    setChoosingRole(false);
  }, []);

  const reopenChooser = useCallback(() => setChoosingRole(true), []);

  const logout = useCallback(() => {
    clearSession();
    clearBio();
    setUser(null);
    setChoosingRole(false);
    setLocked(false);
    setPendingUser(null);
  }, []);

  const unlock = useCallback(async () => {
    if (!pendingUser) return;
    try {
      await unlockBio();
      const ruoli = pendingUser.ruoli && pendingUser.ruoli.length ? pendingUser.ruoli : [pendingUser.activeRole];
      const valid = ruoliConInterfaccia(ruoli);
      const activeRole = valid.includes(pendingUser.activeRole) ? pendingUser.activeRole : (valid[0] || pendingUser.activeRole);
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
