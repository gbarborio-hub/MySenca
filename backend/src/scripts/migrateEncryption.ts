// Script da eseguire UNA SOLA VOLTA dopo il deploy per cifrare i dati esistenti.
// Uso: ENCRYPTION_KEY=... NOTION_TOKEN=... npx ts-node src/scripts/migrateEncryption.ts
// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.

import { encrypt } from "../services/EncryptionService.js";

const NOTION_TOKEN = process.env.NOTION_TOKEN || "";
const BASE = "https://api.notion.com/v1";
const headers = {
  "Authorization": `Bearer ${NOTION_TOKEN}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json"
};

async function queryAll(dbId: string): Promise<any[]> {
  const results: any[] = [];
  let cursor: string | undefined;
  do {
    const body: any = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res: any = await fetch(`${BASE}/databases/${dbId}/query`, {
      method: "POST", headers, body: JSON.stringify(body)
    }).then(r => r.json());
    results.push(...(res.results || []));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return results;
}

function rt(prop: any): string {
  return prop?.rich_text?.[0]?.text?.content || "";
}
function rtProp(value: string) {
  return { rich_text: [{ text: { content: value } }] };
}
async function patchPage(pageId: string, props: Record<string, any>) {
  await fetch(`${BASE}/pages/${pageId}`, {
    method: "PATCH", headers, body: JSON.stringify({ properties: props })
  });
}

const DATABASES: { id: string; name: string; fields: string[] }[] = [
  {
    id: "33adc6a37b8a809785e5c6bf9408693d",
    name: "Status lavori",
    fields: ["Intervento da effettuare", "Note e soluzioni", "Place"]
  },
  {
    id: "0397ae7f488544df92370da4ba04f5f2",
    name: "Segnalazioni e Data Breach",
    fields: ["Descrizione", "Tipo violazione", "Testimoni", "Dettaglio info aziendali",
             "Asset coinvolti", "Responsabile asset", "Misure adottate",
             "Categorie dati coinvolti", "Quantita dati", "Categorie interessati",
             "Danni agli interessati", "Responsabile gestione", "Note"]
  },
  {
    id: "1663def3e8d447f6a702d4aefbade025",
    name: "Ticket",
    fields: ["Descrizione", "Note"]
  },
  {
    id: "8ee076b51b3f4a989a754bedb416d915",
    name: "Responsabili al trattamento",
    fields: ["Attivita svolta", "Indirizzo", "Note"]
  }
];

async function migrateDatabase(db: { id: string; name: string; fields: string[] }) {
  console.log(`\n▶ ${db.name}`);
  const pages = await queryAll(db.id);
  console.log(`  ${pages.length} record`);
  let migrated = 0;
  for (const page of pages) {
    const props: Record<string, any> = {};
    let needsUpdate = false;
    for (const field of db.fields) {
      const raw = rt(page.properties[field]);
      if (!raw || raw.startsWith("ENC:v1:")) continue;
      props[field] = rtProp(encrypt(raw));
      needsUpdate = true;
    }
    if (needsUpdate) {
      await patchPage(page.id, props);
      migrated++;
      process.stdout.write(".");
    }
  }
  console.log(`\n  ✅ ${migrated} record cifrati`);
}

async function main() {
  if (!NOTION_TOKEN) { console.error("❌ NOTION_TOKEN mancante"); process.exit(1); }
  if (!process.env.ENCRYPTION_KEY) { console.error("❌ ENCRYPTION_KEY mancante"); process.exit(1); }
  console.log("🔐 Migrazione cifratura — eseguire UNA SOLA VOLTA");
  for (const db of DATABASES) await migrateDatabase(db);
  console.log("\n✅ Completato.");
}
main().catch(e => { console.error(e); process.exit(1); });
