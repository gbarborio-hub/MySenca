// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
//
// Eseguito da GitHub Actions dopo `npm audit --json` su backend e frontend: legge
// i due file JSON prodotti, li riduce a un riepilogo compatto (conteggi per
// severità + elenco pacchetti/advisory) e lo invia al backend in produzione.
import { readFileSync } from "node:fs";

function parseAuditOutput(path) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { totali: 0, perSeverita: {}, dettagli: [] };
  }

  // `npm audit --json` (npm 9+) mette le vulnerabilità sotto "vulnerabilities",
  // una per pacchetto di primo livello coinvolto, con "via" che elenca gli advisory.
  const vulnerabilities = raw.vulnerabilities || {};
  const perSeverita = {};
  const dettagli = [];

  for (const [pacchetto, info] of Object.entries(vulnerabilities)) {
    const severita = info.severity || "low";
    perSeverita[severita] = (perSeverita[severita] || 0) + 1;

    const via = Array.isArray(info.via) ? info.via : [];
    for (const v of via) {
      if (typeof v === "object" && v.title) {
        dettagli.push({
          pacchetto,
          severita: v.severity || severita,
          titolo: v.title,
          url: v.url || ""
        });
      }
    }
  }

  const totali = Object.values(perSeverita).reduce((a, b) => a + b, 0);
  return { totali, perSeverita, dettagli: dettagli.slice(0, 50) };
}

const report = {
  dataControllo: new Date().toISOString(),
  backend: parseAuditOutput("audit-backend.json"),
  frontend: parseAuditOutput("audit-frontend.json")
};

const url = process.env.SECURITY_AUDIT_URL;
const secret = process.env.SECURITY_AUDIT_SECRET;

if (!url || !secret) {
  console.error("SECURITY_AUDIT_URL o SECURITY_AUDIT_SECRET non impostati — report calcolato ma non inviato.");
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Audit-Secret": secret },
  body: JSON.stringify(report)
});

if (!res.ok) {
  console.error(`Invio fallito: HTTP ${res.status} — ${await res.text()}`);
  process.exit(1);
}

console.log(`Report inviato. Totale vulnerabilità — backend: ${report.backend.totali}, frontend: ${report.frontend.totali}.`);
