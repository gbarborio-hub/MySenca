// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.

import express from "express";
import cors from "cors";
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
import { auditRouter } from "./routes/audit.routes.js";
import { turniRouter } from "./routes/turni.routes.js";
import { auditMiddleware } from "./middleware/audit.middleware.js";
import { RotationService } from "./services/RotationService.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// Audit middleware — intercetta ogni richiesta autenticata in modo non bloccante
app.use(auditMiddleware());

app.use("/api/auth", authRouter);
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
app.use("/api/audit", auditRouter);
app.use("/api/turni", turniRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

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
