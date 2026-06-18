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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.join(__dirname, "../public");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));
}

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`Senca Hub backend on :${PORT}`));

const ONE_DAY = 24 * 60 * 60 * 1000;
setInterval(async () => {
  try {
    const { rotated, emailFailed } = await RotationService.rotateExpired();
    if (rotated) console.log(`Rotation: ${rotated} password rinnovate. Email falite: ${emailFailed.join(", ") || "nessuna"}`);
  } catch (err) {
    console.error("Rotation job failed:", err);
  }
}, ONE_DAY);
