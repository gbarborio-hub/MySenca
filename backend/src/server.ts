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
import { securityAuditIngestRouter, securityAuditReadRouter } from "./routes/securityAudit.routes.js";
import { auditMiddleware } from "./middleware/audit.middleware.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimit.middleware.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { requireRole } from "./middleware/role.middleware.js";
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

// Render (come Cloudflare davanti a lui) instrada le richieste attraverso un
// proprio livello di proxy: senza questa riga, Express non si fida dell'header
// X-Forwarded-For e usa l'IP del proxy stesso per TUTTE le richieste — il rate
// limiting per IP diventerebbe inutile (tutti finirebbero nello stesso bucket) e
// l'IP nei log di audit sarebbe sempre lo stesso, sempre sbagliato. "1" indica un
// solo hop di proxy fidato, che è la configurazione corretta per un servizio Render
// standard.
app.set("trust proxy", 1);

// CSP attivata dopo aver verificato la build di produzione del frontend: nessuno
// script/font/stylesheet esterno viene mai caricato (solo asset locali + un data:
// URI per il QR TOTP), quindi si può restringere tutto a 'self'. Eccezione:
// style-src richiede 'unsafe-inline' perché React scrive gli stili inline
// (style={{...}}) direttamente come attributo HTML style="" — senza questo,
// l'intera grafica del sito smetterebbe di funzionare. Un riferimento a
// cdnjs.cloudflare.com trovato nel bundle di jsPDF è codice morto per questa app
// (attivo solo con un metodo di export che non usiamo, qui si usa solo .save()).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"]
    }
  }
}));
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

// Pubblica come /api/health e /api/auth (non richiede un token utente): chiamata
// da GitHub Actions, non da una persona loggata nell'app. Protetta dal proprio
// segreto condiviso, verificato dentro SecurityAuditController.ingest.
app.use("/api/security-audit", securityAuditIngestRouter);

// Da qui in poi, OGNI rotta /api richiede un token di sessione valido: prima di
// questo intervento, un semplice header non verificato (X-Username) bastava per
// farsi credere chiunque dal backend. Ora un token scaduto, mancante o manomesso
// viene rifiutato con 401 prima di raggiungere qualsiasi controller.
app.use("/api", authMiddleware);

// Audit middleware — intercetta ogni richiesta autenticata in modo non bloccante.
// Gira DOPO authMiddleware apposta: da qui req.user è sempre un'identità verificata,
// non più un header di cui fidarsi sulla parola.
app.use(auditMiddleware());

// Autorizzazione per ruolo — mappata sui ruoli che, in App.tsx, danno accesso a
// ciascuna vista frontend (e quindi alle sue chiamate API). /api/turni, /api/contatti
// e /api/totp restano aperti a qualunque utente autenticato: sono lette semplici
// (turni/contatti) o gestione del proprio 2FA, senza un singolo ruolo chiamante
// individuabile con certezza nel frontend attuale — un ulteriore restringimento
// andrà fatto se in futuro emerge chi li usa davvero.
app.use("/api/dipendenti", requireRole("Admin", "Gestione personale"), dipendentiRouter);
app.use("/api/utenti", requireRole("Admin"), utentiRouter);
app.use("/api/proxy", requireRole("Gestione personale", "Dipendente"), dipendentiProxyRouter);
app.use("/api/posts", requireRole("Privacy"), postsRouter);
app.use("/api/incaricati", requireRole("Privacy"), incaricatiRouter);
app.use("/api/documenti", requireRole("Gestione personale", "Privacy"), documentiRouter);
app.use("/api/segnalazioni", requireRole("Privacy"), segnalazioniRouter);
app.use("/api/ticket", requireRole("Admin"), ticketRouter);
app.use("/api/status-lavori", requireRole("Privacy"), statusLavoriRouter);
app.use("/api/responsabili", requireRole("Privacy"), responsabiliRouter);
app.use("/api/amministratori", requireRole("Privacy"), amministratoriRouter);
app.use("/api/documentazione-privacy", requireRole("Privacy"), documentazionePrivacyRouter);
app.use("/api/audit", requireRole("Admin"), auditRouter);
app.use("/api/security-audit", requireRole("Admin"), securityAuditReadRouter);
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
