// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.

import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";

import { authRouter } from "./routes/auth.routes.js";
import { dipendentiRouter } from "./routes/dipendenti.routes.js";
import { utentiRouter } from "./routes/utenti.routes.js";
import { dipendentiProxyRouter } from "./routes/proxy.routes.js";
import { postsRouter } from "./routes/posts.routes.js";
import { incaricatiRouter } from "./routes/incaricati.routes.js";
import { documentiRouter } from "./routes/documenti.routes.js";
import { segnalazioniRouter } from "./routes/segnalazioni.routes.js";
import { ticketRouter } from "./routes/ticket.routes.js";
import { statusLavoriRouter } from "./routes/statusLavori.routes.js";
import { responsabiliRouter } from "./routes/responsabili.routes.js";
import { amministratoriRouter } from "./routes/amministratori.routes.js";
import { documentazionePrivacyRouter } from "./routes/documentazionePrivacy.routes.js";
import { auditRouter } from "./routes/audit.routes.js";
import { turniRouter } from "./routes/turni.routes.js";
import { contattiRouter } from "./routes/contatti.routes.js";
import { totpRouter } from "./routes/totp.routes.js";
import { auditMiddleware } from "./middleware/audit.middleware.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimit.middleware.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { RotationService } from "./services/RotationService.js";

// Rete di sicurezza a livello di processo — trovata necessaria testando oggi
// l'autenticazione: alcuni controller (preesistenti, non introdotti da questo
// intervento) non hanno un try/catch attorno alle chiamate a Notion. Senza questo,
// un singolo errore imprevisto (timeout, rate limit, Notion giù) fa crashare
// l'INTERO processo Node, interrompendo il servizio per tutti gli utenti, non solo
// per la richiesta che ha fallito. Questo non sostituisce il sistemare i try/catch
// mancanti nel tempo — la singola richiesta colpita resterà comunque senza risposta
// pulita — ma impedisce che un problema isolato diventi un'interruzione totale.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

// Origini ammesse per le chiamate cross-origin. Il frontend viene servito dallo
// stesso backend (vedi più sotto, express.static), quindi le chiamate dell'app in
// produzione sono same-origin e non passano nemmeno dal controllo CORS: questa
// lista serve a bloccare chiamate dirette all'API da altri siti/domini.
// In locale (nessuna CORS_ORIGIN impostata) resta permissivo per non intralciare lo
// sviluppo; in produzione va impostata la variabile d'ambiente CORS_ORIGIN su
// Render con l'URL esatto del servizio (es. "https://mysenca.onrender.com"), anche
// più di uno separati da virgola se serve.
const corsOrigins = (process.env.CORS_ORIGIN || "").split(",").map(o => o.trim()).filter(Boolean);
const corsOptions: cors.CorsOptions = corsOrigins.length > 0
  ? { origin: corsOrigins }
  : {}; // nessuna CORS_ORIGIN impostata: permissivo (comportamento precedente), pensato per lo sviluppo locale

const app = express();
// contentSecurityPolicy disattivata di proposito: la CSP di default di helmet è
// rigida (blocca per dominio script/immagini/stili non esplicitamente elencati) e
// non ho modo di verificare da qui tutte le risorse effettivamente caricate in
// produzione — abilitarla alla cieca rischia di rompere il sito. Le altre
// protezioni di helmet (X-Frame-Options, X-Content-Type-Options, HSTS, ecc.)
// restano attive. La CSP si può aggiungere in un secondo momento con un test
// mirato in produzione.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use(express.json({ limit: "20mb" }));

// Rate limiting per IP su tutte le API, con un limite più stretto sul login/TOTP.
app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

// Disabilita la cache condizionale (ETag/304) per tutte le API — sono risposte
// dinamiche, non risorse statiche. Senza questo, il browser può ricevere un 304
// con corpo vuoto su richieste GET ripetute, interpretato dal frontend come
// "nessun dato" anche quando i dati esistono e sono corretti.
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Rotte pubbliche: l'health check (per i probe di Render) e login/verifica TOTP,
// che sono esattamente il modo con cui si ottiene il token — non possono
// richiedere un token che ancora non esiste.
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);

// Da qui in poi, OGNI rotta /api richiede un token di sessione valido: prima di
// questo intervento, un semplice header non verificato (X-Username) bastava per
// farsi credere chiunque dal backend. Ora un token scaduto, mancante o manomesso
// viene rifiutato con 401 prima di raggiungere qualsiasi controller.
app.use("/api", authMiddleware);

// Audit middleware — intercetta ogni richiesta autenticata in modo non bloccante.
// Gira DOPO authMiddleware apposta: da qui req.user è sempre un'identità verificata,
// non più un header di cui fidarsi sulla parola.
app.use(auditMiddleware());

app.use("/api/dipendenti", dipendentiRouter);
app.use("/api/utenti", utentiRouter);
app.use("/api/proxy", dipendentiProxyRouter);
app.use("/api/posts", postsRouter);
app.use("/api/incaricati", incaricatiRouter);
app.use("/api/documenti", documentiRouter);
app.use("/api/segnalazioni", segnalazioniRouter);
app.use("/api/ticket", ticketRouter);
app.use("/api/status-lavori", statusLavoriRouter);
app.use("/api/responsabili", responsabiliRouter);
app.use("/api/amministratori", amministratoriRouter);
app.use("/api/documentazione-privacy", documentazionePrivacyRouter);
app.use("/api/audit", auditRouter);
app.use("/api/turni", turniRouter);
app.use("/api/contatti", contattiRouter);
app.use("/api/totp", totpRouter);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.join(__dirname, "../public");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));
}

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`MySenca backend on :${PORT}`));

const ONE_DAY = 24 * 60 * 60 * 1000;
setInterval(async () => {
  try {
    const { rotated, emailFailed } = await RotationService.rotateExpired();
    if (rotated) console.log(`Rotation: ${rotated} password rinnovate. Email fallite: ${emailFailed.join(", ") || "nessuna"}`);
  } catch (err) {
    console.error("Rotation job failed:", err);
  }
}, ONE_DAY);
