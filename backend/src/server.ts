import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";

import { authRouter } from "./routes/auth.routes.js";
import { dipendentiRouter } from "./routes/dipendenti.routes.js";
import { utentiRouter } from "./routes/utenti.routes.js";
import { RotationService } from "./services/RotationService.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/dipendenti", dipendentiRouter);
app.use("/api/utenti", utentiRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ENDPOINT TEMPORANEO — rimuovere dopo aver completato la migrazione delle utenze
// Uso: GET /api/gen-hash?pwd=TUAPASSWORD
// Restituisce salt e hash da incollare nei campi Notion dell'utente
app.get("/api/gen-hash", (req, res) => {
  const pwd = String(req.query.pwd || "");
  if (!pwd || pwd.length < 4) {
    res.status(400).json({ error: "Parametro pwd mancante o troppo corto (min 4 caratteri)" });
    return;
  }
  import("crypto").then(crypto => {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(pwd, salt, 100000, 64, "sha256").toString("hex");
    res.json({ salt, hash, note: "Incolla questi valori nei campi Salt e Hash password su Notion. Poi rimuovi questo endpoint." });
  });
});

// If a built frontend is present (combined Docker image), serve it.
// In the split-services setup this folder simply doesn't exist and nothing changes.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.join(__dirname, "../public");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));
}

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`Senca Hub backend on :${PORT}`));

// 90-day password rotation: check once a day (not a precise cron, good enough for this scale)
const ONE_DAY = 24 * 60 * 60 * 1000;
setInterval(async () => {
  try {
    const { rotated, emailFailed } = await RotationService.rotateExpired();
    if (rotated) console.log(`Rotation: ${rotated} password rinnovate. Email falite: ${emailFailed.join(", ") || "nessuna"}`);
  } catch (err) {
    console.error("Rotation job failed:", err);
  }
}, ONE_DAY);
