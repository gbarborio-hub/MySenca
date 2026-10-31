// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
//
// Blocco TEMPORANEO dopo tentativi falliti, al posto del vecchio blocco permanente
// (flag "Bloccato" su Notion). Prima bastavano 3 password sbagliate, inviate da
// chiunque, per bloccare per sempre un account e chiuderne le sessioni attive:
// un modo facile per mettere fuori uso qualunque collega, Admin compresi.
// Ora: dopo 3 errori l'account è sospeso per 15 minuti, poi 30, 60... (max 24h),
// si sblocca da solo, e le sessioni già aperte non vengono toccate. Il flag
// "Bloccato" resta solo come decisione amministrativa esplicita.
// Lo stato è in memoria: un riavvio lo azzera, il che è accettabile per un
// rallentamento (il limite per IP di authLimiter resta comunque attivo).

const MAX_TENTATIVI = 3;
const BASE_MS = 15 * 60 * 1000;
const MAX_MS = 24 * 60 * 60 * 1000;
const FINESTRA_MS = 60 * 60 * 1000; // gli errori più vecchi di un'ora non contano

interface Stato { errori: number; primoErrore: number; bloccoFino: number; livello: number; }
const stati = new Map<string, Stato>();

function key(username: string) { return username.trim().toLowerCase(); }

export const LoginThrottleService = {
  // Millisecondi di blocco rimanenti (0 = libero).
  bloccatoPer(username: string): number {
    const s = stati.get(key(username));
    if (!s) return 0;
    return Math.max(0, s.bloccoFino - Date.now());
  },

  // Registra un errore; ritorna true se da questo momento l'account è sospeso.
  registraErrore(username: string): boolean {
    const k = key(username);
    const now = Date.now();
    let s = stati.get(k);
    if (!s || now - s.primoErrore > FINESTRA_MS) {
      s = { errori: 0, primoErrore: now, bloccoFino: s?.bloccoFino || 0, livello: s?.livello || 0 };
    }
    s.errori += 1;
    let sospeso = false;
    if (s.errori >= MAX_TENTATIVI) {
      s.bloccoFino = now + Math.min(BASE_MS * 2 ** s.livello, MAX_MS);
      s.livello += 1;
      s.errori = 0;
      s.primoErrore = now;
      sospeso = true;
    }
    stati.set(k, s);
    return sospeso;
  },

  azzera(username: string): void {
    stati.delete(key(username));
  }
};
