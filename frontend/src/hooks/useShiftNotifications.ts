import { useEffect, useRef } from "react";

const SHIFTNOTIF_KEY = "senca_shiftnotif_v1";

function shiftStore(): Record<string, Record<string, number>> {
  try { return JSON.parse(localStorage.getItem(SHIFTNOTIF_KEY) || "{}"); } catch { return {}; }
}
function shiftFired(date: string, key: string): boolean {
  const s = shiftStore();
  return !!(s[date] && s[date][key]);
}
function shiftMark(date: string, key: string): void {
  const s = shiftStore();
  const fresh: Record<string, Record<string, number>> = { [date]: { ...(s[date] || {}), [key]: 1 } };
  try { localStorage.setItem(SHIFTNOTIF_KEY, JSON.stringify(fresh)); } catch {}
}
function hmDate(date: string, hm: string): Date | null {
  const p = String(hm || "").split(":");
  if (p.length < 2) return null;
  const d = new Date(`${date}T00:00:00`);
  d.setHours(parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0, 0, 0);
  return d;
}
function notify(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try { new Notification(title, { body }); } catch {}
}

interface Params {
  isDipendente: boolean;
  turni: any[];
  comunicazioni: any[];
  ferieRichieste: any[];
  docs: any[];
  refreshComunicazioni: () => void;
  refreshFerie: () => void;
  refreshDocs: () => void;
}

/** Richiede il permesso notifiche al primo mount, se non ancora deciso. */
export function useRequestNotificationPermission(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if ("Notification" in window && Notification.permission === "default") {
      try { Notification.requestPermission(); } catch {}
    }
  }, [enabled]);
}

/**
 * Polling ogni 45s per nuove comunicazioni, esito ferie, nuovi documenti,
 * e controllo promemoria turno (10 min prima dell'inizio, 10-50 min dopo la fine).
 */
export function useShiftAndCommsNotifications(p: Params) {
  const prevCommIds = useRef<Set<string> | null>(null);
  const prevFerieStati = useRef<Map<string, string> | null>(null);
  const prevDocCount = useRef<number | null>(null);

  useEffect(() => {
    if (!p.isDipendente) return;

    function checkShiftReminders() {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      for (const t of p.turni) {
        if (t.data !== today || !t.oraInizio || !t.oraFine) continue;
        const start = hmDate(t.data, t.oraInizio);
        let end = hmDate(t.data, t.oraFine);
        if (!start || !end) continue;
        if (end <= start) end = new Date(end.getTime() + 86400000);
        const id = `${t.titolo || t.tipo || "turno"}_${t.oraInizio}_${t.oraFine}`;

        const preStart = new Date(start.getTime() - 10 * 60000);
        if (now >= preStart && now < start && !shiftFired(today, `${id}_start`)) {
          notify("Tra 10 minuti inizia il turno", `Ricordati di timbrare l'entrata (${t.oraInizio}${t.struttura ? ` · ${t.struttura}` : ""})`);
          shiftMark(today, `${id}_start`);
        }
        const postEnd = new Date(end.getTime() + 10 * 60000);
        if (now >= postEnd && now < new Date(postEnd.getTime() + 40 * 60000) && !shiftFired(today, `${id}_end`)) {
          notify("Turno terminato", `Il turno è finito alle ${t.oraFine}: ricordati di timbrare l'uscita.`);
          shiftMark(today, `${id}_end`);
        }
      }
    }

    function poll() {
      p.refreshComunicazioni();
      p.refreshFerie();
      p.refreshDocs();
      checkShiftReminders();
    }

    const interval = setInterval(poll, 45000);
    return () => clearInterval(interval);
  }, [p.isDipendente, p.turni]);

  // Nuove comunicazioni → notifica
  useEffect(() => {
    if (!p.isDipendente) return;
    const ids = new Set(p.comunicazioni.map((c: any) => c.id));
    if (prevCommIds.current) {
      const nuove = p.comunicazioni.filter((c: any) => !prevCommIds.current!.has(c.id));
      if (nuove.length === 1) notify("Nuova comunicazione", nuove[0].titolo || "Hai una nuova comunicazione");
      else if (nuove.length > 1) notify("Nuove comunicazioni", `Hai ${nuove.length} nuove comunicazioni`);
    }
    prevCommIds.current = ids;
  }, [p.comunicazioni, p.isDipendente]);

  // Cambio stato ferie (approvata/rifiutata) → notifica
  useEffect(() => {
    if (!p.isDipendente) return;
    const stati = new Map(p.ferieRichieste.map((r: any) => [r.pageId, r.stato]));
    if (prevFerieStati.current) {
      const cambiate = p.ferieRichieste.filter((r: any) => {
        const prev = prevFerieStati.current!.get(r.pageId);
        return prev && prev !== r.stato && (r.stato === "Approvata" || r.stato === "Rifiutata");
      });
      for (const c of cambiate) {
        notify(c.stato === "Approvata" ? "Richiesta approvata ✅" : "Richiesta rifiutata ❌", `${c.tipo || "Richiesta"}`);
      }
    }
    prevFerieStati.current = stati;
  }, [p.ferieRichieste, p.isDipendente]);

  // Nuovi documenti (es. busta paga) → notifica
  useEffect(() => {
    if (!p.isDipendente) return;
    if (prevDocCount.current !== null && p.docs.length > prevDocCount.current) {
      const nuovi = p.docs.length - prevDocCount.current;
      const nb = p.docs.slice(0, nuovi).filter((d: any) => d.tipo === "Busta paga").length;
      const na = nuovi - nb;
      if (nb > 0) notify(nb === 1 ? "Nuova busta paga disponibile" : "Nuove buste paga disponibili", "La trovi nella sezione Documenti.");
      if (na > 0) notify(na === 1 ? "Nuovo documento disponibile" : "Nuovi documenti disponibili", "Lo trovi nella sezione Documenti.");
    }
    prevDocCount.current = p.docs.length;
  }, [p.docs, p.isDipendente]);
}
