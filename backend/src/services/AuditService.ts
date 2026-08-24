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

function computeHash(entry: AuditEntry, timestampIso: string, hashPrecedente: string): string {
  const payload = [
    timestampIso, entry.utente, entry.ruolo, entry.azione,
    entry.risorsa, entry.dettaglio || "", entry.ip || "", hashPrecedente
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function tp(value: string) {
  return { rich_text: [{ type: "text", text: { content: value || "" } }] };
}

// Cache in memoria dell'ultimo hash della catena. Sostituisce il lock condiviso su
// PostgreSQL (rimosso: il piano gratuito del database è scaduto) con una soluzione
// puramente in-process, senza dipendenze esterne a pagamento.
//
// Perché è comunque corretta: Render (piano gratuito/hobby) esegue UNA SOLA istanza
// del backend — non c'è autoscaling orizzontale su quel piano. Node.js è
// single-threaded, quindi la coda `writeQueue` qui sotto serializza già ogni
// scrittura all'interno dell'unico processo in esecuzione: non può verificarsi una
// diramazione della catena perché non esistono due processi che scrivono in
// parallelo. L'unica finestra di rischio teorica è un redeploy in cui, per una
// frazione di secondo, la vecchia e la nuova istanza coesistono — anche in quel
// caso, verificaIntegrita() rileva e segnala qualunque diramazione, non la nasconde.
// Se in futuro si passa a un piano con più istanze concorrenti, questa cache va
// sostituita di nuovo con un lock condiviso esterno.
let lastHashCache: string | null = null;

async function getUltimoHash(): Promise<string> {
  if (lastHashCache) return lastHashCache;
  // Prima scrittura dopo un riavvio: recupera l'ultimo hash da Notion (la fonte di
  // verità persistente) e lo mette in cache per le scritture successive di questo processo.
  const res: any = await notion.queryDatabase(DB_AUDIT, {
    page_size: 1,
    sorts: [{ property: "Timestamp", direction: "descending" }]
  });
  const ultimo = res.results?.[0];
  const p = ultimo?.properties || {};
  const hash = p["Hash record"]?.rich_text?.[0]?.text?.content
            || p["Hash record"]?.rich_text?.[0]?.plain_text
            || GENESIS_HASH;
  lastHashCache = hash;
  return hash;
}

async function writeLog(entry: AuditEntry): Promise<void> {
  const hashPrecedente = await getUltimoHash();
  const timestampIso = new Date().toISOString();
  const hashRecord = computeHash(entry, timestampIso, hashPrecedente);
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
      "Timestamp":       { date: { start: timestampIso } },
      "Timestamp ISO":   tp(timestampIso),
      "Hash precedente": tp(hashPrecedente),
      "Hash record":     tp(hashRecord)
    }
  });

  // Aggiornata SOLO dopo una scrittura riuscita: se notion.createPage fallisce, la
  // cache resta al valore precedente e il prossimo tentativo riparte dallo stesso
  // hash — niente buchi nella catena per una scrittura fallita.
  lastHashCache = hashRecord;
}

// Coda in memoria: serializza le scritture di questo processo (vedi commento sopra
// sul perché è sufficiente, senza lock esterno).
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(entry: AuditEntry): Promise<void> {
  const result = writeQueue.then(() => writeLog(entry));
  writeQueue = result.catch(() => {});
  return result;
}

export const AuditService = {
  log(entry: AuditEntry): void {
    enqueueWrite(entry).catch(e => {
      console.error("[AuditService] WRITE ERROR:", e?.message || e);
    });
  },

  async logSync(entry: AuditEntry): Promise<void> {
    await enqueueWrite(entry);
  },

  async verificaIntegrita(): Promise<{
    integro: boolean; totaleRecord: number;
    rotturaAlRecord?: number; descrizioneRottura?: string;
    recordCoinvolti?: { pageId: string; url: string; descrizione: string }[];
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
          descrizioneRottura: `Diramazione rilevata dopo il record #${contatore}: ${candidati.length} record diversi puntano allo stesso predecessore`,
          recordCoinvolti: candidati.map((page: any) => ({
            pageId: page.id,
            url: page.url,
            descrizione: page.properties?.["Descrizione"]?.title?.[0]?.plain_text
                      || page.properties?.["Descrizione"]?.title?.[0]?.text?.content || ""
          }))
        };
      }

      const page = candidati[0];
      const p = page.properties || {};
      const hashRecord = getText(p["Hash record"]);
      const timestampIso = getText(p["Timestamp ISO"]);
      const entry: AuditEntry = {
        utente:    getText(p["Utente"]),
        ruolo:     getText(p["Ruolo"]),
        azione:    (p["Azione"]?.select?.name || "") as AuditAzione,
        risorsa:   getText(p["Risorsa"]),
        dettaglio: getText(p["Dettaglio"]),
        ip:        getText(p["IP"])
      };

      const hashRicalcolato = computeHash(entry, timestampIso, hashAtteso);
      contatore++;

      if (hashRicalcolato !== hashRecord) {
        return {
          integro: false,
          totaleRecord: results.length,
          rotturaAlRecord: contatore,
          descrizioneRottura: `Record #${contatore}: hash alterato — possibile manomissione`,
          recordCoinvolti: [{
            pageId: page.id,
            url: page.url,
            descrizione: getText(p["Descrizione"] as any) || p["Descrizione"]?.title?.[0]?.plain_text || p["Descrizione"]?.title?.[0]?.text?.content || ""
          }]
        };
      }

      hashAtteso = hashRecord;
    }

    if (contatore !== results.length) {
      const raggiunti = new Set<string>();
      let cursorHash = GENESIS_HASH;
      while (byHashPrecedente.has(cursorHash)) {
        const c = byHashPrecedente.get(cursorHash)!;
        if (c.length !== 1) break;
        raggiunti.add(c[0].id);
        cursorHash = getText((c[0].properties || {})["Hash record"]);
      }
      const orfani = results.filter((page: any) => !raggiunti.has(page.id));
      return {
        integro: false,
        totaleRecord: results.length,
        rotturaAlRecord: contatore + 1,
        descrizioneRottura: `Catena interrotta: ${results.length - contatore} record non raggiungibili dalla sequenza principale`,
        recordCoinvolti: orfani.map((page: any) => ({
          pageId: page.id,
          url: page.url,
          descrizione: page.properties?.["Descrizione"]?.title?.[0]?.plain_text
                    || page.properties?.["Descrizione"]?.title?.[0]?.text?.content || ""
        }))
      };
    }

    return { integro: true, totaleRecord: results.length };
  }
};
