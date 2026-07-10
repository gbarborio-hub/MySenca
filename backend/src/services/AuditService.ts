// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import crypto from "crypto";
import { notion } from "../models/notionClient.js";

const DB_AUDIT = "ca05282ca862460b884b4c6804e67ac9";
const GENESIS_HASH = "GENESIS-MySenca-AuditLog-v1";

export type AuditAzione = "LOGIN" | "LOGOUT" | "AUTH_FAIL" | "CREATE" | "READ" | "UPDATE" | "DELETE";

export interface AuditEntry {
  utente: string;
  ruolo: string;
  azione: AuditAzione;
  risorsa: string;
  dettaglio?: string;
  ip?: string;
}

let lastHashCache: string | null = null;

function computeHash(entry: AuditEntry, timestamp: string, hashPrecedente: string): string {
  const payload = [
    timestamp, entry.utente, entry.ruolo, entry.azione,
    entry.risorsa, entry.dettaglio || "", entry.ip || "", hashPrecedente
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

async function fetchLastHash(): Promise<string> {
  if (lastHashCache !== null) return lastHashCache;
  try {
    const res: any = await notion.queryDatabase(DB_AUDIT, {
      page_size: 1,
      sorts: [{ property: "Timestamp", direction: "descending" }]
    });
    if (!res.results?.length) return GENESIS_HASH;
    const p = res.results[0].properties || {};
    const h = p["Hash record"]?.rich_text?.[0]?.plain_text
           || p["Hash record"]?.rich_text?.[0]?.text?.content || "";
    return h || GENESIS_HASH;
  } catch (e) {
    console.error("[AuditService] fetchLastHash error:", e);
    return GENESIS_HASH;
  }
}

function tp(value: string) {
  return { rich_text: [{ type: "text", text: { content: value || "" } }] };
}

async function writeLog(entry: AuditEntry): Promise<void> {
  const timestamp = new Date().toISOString();
  const hashPrecedente = await fetchLastHash();
  const hashRecord = computeHash(entry, timestamp, hashPrecedente);
  const descrizione = `${entry.azione} ${entry.risorsa}${entry.utente ? ` [${entry.utente}]` : ""}`;

  await notion.createPage({
    parent: { database_id: DB_AUDIT },
    properties: {
      "Descrizione": { title: [{ type: "text", text: { content: descrizione } }] },
      "Utente":          tp(entry.utente),
      "Ruolo":           tp(entry.ruolo),
      "Azione":          { select: { name: entry.azione } },
      "Risorsa":         tp(entry.risorsa),
      "Dettaglio":       tp(entry.dettaglio || ""),
      "IP":              tp(entry.ip || ""),
      "Timestamp":       { date: { start: timestamp } },
      "Hash precedente": tp(hashPrecedente),
      "Hash record":     tp(hashRecord)
    }
  });

  // Aggiorna la cache SOLO dopo che la scrittura è confermata su Notion —
  // e solo perché questa funzione viene sempre eseguita in coda (mai in parallelo,
  // vedi enqueueWrite più sotto), quindi non può esserci corsa tra due scritture.
  lastHashCache = hashRecord;
}

// Coda di scrittura: garantisce che le voci di audit vengano scritte STRETTAMENTE
// una alla volta, mai in parallelo. Senza questa coda, richieste API simultanee
// (normalissime quando l'utente apre una schermata che carica più dati insieme)
// potrebbero leggere lo stesso "ultimo hash" prima che una scrittura lo aggiorni,
// creando una diramazione nella catena invece di una sequenza lineare.
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(entry: AuditEntry): Promise<void> {
  const result = writeQueue.then(() => writeLog(entry));
  // Anche se questa scrittura fallisce, la coda deve proseguire per le successive
  writeQueue = result.catch(() => {});
  return result;
}

export const AuditService = {
  // Non bloccante dal punto di vista della risposta HTTP — ma le scritture
  // avvengono comunque in sequenza rigorosa una dopo l'altra internamente.
  log(entry: AuditEntry): void {
    enqueueWrite(entry).catch(e => {
      console.error("[AuditService] WRITE ERROR:", e?.message || e);
    });
  },

  // Versione che attende il completamento — usata da endpoint che vogliono
  // la conferma di scrittura avvenuta.
  async logSync(entry: AuditEntry): Promise<void> {
    await enqueueWrite(entry);
  },

  async verificaIntegrita(): Promise<{
    integro: boolean; totaleRecord: number;
    rotturaAlRecord?: number; descrizioneRottura?: string;
  }> {
    const results: any[] = [];
    let cursor: string | undefined;
    do {
      const res: any = await notion.queryDatabase(DB_AUDIT, {
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {})
      });
      results.push(...(res.results || []));
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    if (!results.length) return { integro: true, totaleRecord: 0 };

    const getText = (prop: any): string =>
      prop?.rich_text?.[0]?.plain_text || prop?.rich_text?.[0]?.text?.content || "";

    // Ricostruisce l'ordine reale della catena seguendo i puntatori hash
    // (hash precedente → hash record), invece di fidarsi dell'ordinamento per
    // Timestamp — che ha solo precisione al minuto e non distingue correttamente
    // scritture ravvicinate nello stesso minuto.
    const byHashPrecedente = new Map<string, any[]>();
    for (const page of results) {
      const p = page.properties || {};
      const hp = getText(p["Hash precedente"]);
      if (!byHashPrecedente.has(hp)) byHashPrecedente.set(hp, []);
      byHashPrecedente.get(hp)!.push(page);
    }

    let hashAtteso = GENESIS_HASH;
    let contatore = 0;

    while (true) {
      const candidati = byHashPrecedente.get(hashAtteso) || [];
      if (candidati.length === 0) break;

      if (candidati.length > 1) {
        return {
          integro: false,
          totaleRecord: results.length,
          rotturaAlRecord: contatore + 1,
          descrizioneRottura: `Diramazione rilevata dopo il record #${contatore}: ${candidati.length} record diversi puntano allo stesso predecessore — probabile scrittura concorrente non sincronizzata`
        };
      }

      const page = candidati[0];
      const p = page.properties || {};
      const hashRecord = getText(p["Hash record"]);
      const timestamp = p["Timestamp"]?.date?.start || "";
      const entry: AuditEntry = {
        utente:    getText(p["Utente"]),
        ruolo:     getText(p["Ruolo"]),
        azione:    (p["Azione"]?.select?.name || "") as AuditAzione,
        risorsa:   getText(p["Risorsa"]),
        dettaglio: getText(p["Dettaglio"]),
        ip:        getText(p["IP"])
      };

      const hashRicalcolato = computeHash(entry, timestamp, hashAtteso);
      contatore++;

      if (hashRicalcolato !== hashRecord) {
        return {
          integro: false,
          totaleRecord: results.length,
          rotturaAlRecord: contatore,
          descrizioneRottura: `Record #${contatore}: hash alterato — possibile manomissione`
        };
      }

      hashAtteso = hashRecord;
    }

    if (contatore !== results.length) {
      return {
        integro: false,
        totaleRecord: results.length,
        rotturaAlRecord: contatore + 1,
        descrizioneRottura: `Catena interrotta: ${results.length - contatore} record non raggiungibili dalla sequenza principale`
      };
    }

    return { integro: true, totaleRecord: results.length };
  }
};
