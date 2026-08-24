// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
//
// Token di sessione firmato dal server (JWT). Sostituisce la fiducia cieca nel
// vecchio header "X-Username": ora ogni chiamata deve portare un token che solo
// questo backend può aver emesso e che scade da solo. Il token viene emesso una
// volta sola, al login riuscito (o dopo la verifica TOTP se attiva), e verificato
// ad ogni richiesta successiva dal middleware auth.middleware.ts.
import jwt from "jsonwebtoken";
import crypto from "crypto";

// Se JWT_SECRET non è impostata (ambiente locale, o dimenticata su Render), ne
// generiamo una casuale all'avvio: l'app resta funzionante, ma tutte le sessioni
// vengono invalidate ad ogni riavvio/deploy del server — nessun rischio di
// sicurezza, solo un re-login in più richiesto agli utenti. In produzione va
// impostata la variabile d'ambiente JWT_SECRET per sessioni stabili tra un deploy
// e l'altro (Render → Environment → JWT_SECRET, una stringa lunga e casuale).
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");
if (!process.env.JWT_SECRET) {
  console.warn(
    "\u26a0\ufe0f  JWT_SECRET non impostata: generata una chiave temporanea per questo avvio. " +
    "Le sessioni non sopravvivranno a un riavvio/deploy del server. " +
    "Imposta JWT_SECRET nelle variabili d'ambiente per sessioni stabili."
  );
}

// Sessione "non ricordata": dura una giornata lavorativa tipica.
// Sessione "ricordami" (checkbox al login): stessa durata che aveva la sessione
// salvata in localStorage prima di questo intervento (30 giorni), così l'esperienza
// per chi usa lo sblocco Face ID/impronta non cambia.
const DURATA_BREVE = "12h";
const DURATA_LUNGA = "30d";

export interface TokenPayload {
  username: string;
  ruolo: string;
  ruoli: string[];
}

export const TokenService = {
  sign(payload: TokenPayload, remember: boolean): string {
    return jwt.sign(payload, SECRET, { expiresIn: remember ? DURATA_LUNGA : DURATA_BREVE });
  },

  // Verifica firma + scadenza. Ritorna null per qualunque motivo di invalidità
  // (scaduto, manomesso, malformato) — il chiamante tratta tutti i casi allo stesso
  // modo: nessun accesso.
  verify(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, SECRET);
      if (typeof decoded === "string") return null;
      const { username, ruolo, ruoli } = decoded as Record<string, unknown>;
      if (!username || typeof username !== "string" || !ruolo || typeof ruolo !== "string") return null;
      return { username, ruolo, ruoli: Array.isArray(ruoli) ? (ruoli as string[]) : [] };
    } catch {
      return null;
    }
  }
};
