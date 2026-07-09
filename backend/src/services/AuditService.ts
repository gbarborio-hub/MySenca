// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import crypto from "crypto";

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

// Cache dell'ultimo hash in memoria — evita una lettura Notion ad ogni operazione.
// Viene popolato al primo log e aggiornato ad ogni scrittura.
let lastHashCache: string | null = null;

function computeHash(entry: AuditEntry, timestamp: string, hashPrecedente: string): string {
  const payload = [
    timestamp,
    entry.utente,
    entry.ruolo,
    entry.azione,
    entry.risorsa,
    entry.dettaglio || "",
    entry.ip || "",
    hashPrecedente
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

async function fetchLastHash(notion: any): Promise<string> {
  if (lastHashCache !== null) return lastHashCache;
  try {
    const res: any = await notion.queryDatabase(DB_AUDIT, {
      page_size: 1,
      sorts: [{ property: "Timestamp", direction: "descending" }]
    });
    if (!res.results?.length) return GENESIS_HASH;
    const p = res.results[0].properties || {};
    return p["Hash record"]?.rich_text?.[0]?.text?.content || GENESIS_HASH;
  } catch {
    return GENESIS_HASH;
  }
}

export const AuditService = {
  async log(notion: any, entry: AuditEntry): Promise<void> {
    // Esecuzione non bloccante — non rallenta la risposta HTTP
    setImmediate(async () => {
      try {
        const timestamp = new Date().toISOString();
        const hashPrecedente = await fetchLastHash(notion);
        const hashRecord = computeHash(entry, timestamp, hashPrecedente);

        const descrizione = `${entry.azione} ${entry.risorsa}${entry.utente ? ` [${entry.utente}]` : ""}`;

        await notion.createPage({
          parent: { database_id: DB_AUDIT },
          properties: {
            "Descrizione": { title: [{ text: { content: descrizione } }] },
            "Utente": { rich_text: [{ text: { content: entry.utente || "" } }] },
            "Ruolo": { rich_text: [{ text: { content: entry.ruolo || "" } }] },
            "Azione": { select: { name: entry.azione } },
            "Risorsa": { rich_text: [{ text: { content: entry.risorsa } }] },
            "Dettaglio": { rich_text: [{ text: { content: entry.dettaglio || "" } }] },
            "IP": { rich_text: [{ text: { content: entry.ip || "" } }] },
            "Timestamp": { date: { start: timestamp } },
            "Hash precedente": { rich_text: [{ text: { content: hashPrecedente } }] },
            "Hash record": { rich_text: [{ text: { content: hashRecord } }] }
          }
        });

        // Aggiorna la cache con il nuovo hash
        lastHashCache = hashRecord;
      } catch (e) {
        // Il log non deve mai far crashare l'app — errore silenzioso
        console.error("[AuditService] Errore scrittura log:", e);
      }
    });
  },

  // Verifica l'integrità della catena — da chiamare dall'endpoint admin
  async verificaIntegrita(notion: any): Promise<{
    integro: boolean;
    totaleRecord: number;
    rotturaAlRecord?: number;
    descrizioneRottura?: string;
  }> {
    const results: any[] = [];
    let cursor: string | undefined;
    do {
      const res: any = await notion.queryDatabase(DB_AUDIT, {
        page_size: 100,
        sorts: [{ property: "Timestamp", direction: "ascending" }],
        ...(cursor ? { start_cursor: cursor } : {})
      });
      results.push(...(res.results || []));
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    if (!results.length) return { integro: true, totaleRecord: 0 };

    let hashAtteso = GENESIS_HASH;
    for (let i = 0; i < results.length; i++) {
      const p = results[i].properties || {};
      const getText = (prop: any) => prop?.rich_text?.[0]?.text?.content || "";

      const hashPrecedente = getText(p["Hash precedente"]);
      const hashRecord = getText(p["Hash record"]);
      const timestamp = p["Timestamp"]?.date?.start || "";
      const entry: AuditEntry = {
        utente: getText(p["Utente"]),
        ruolo: getText(p["Ruolo"]),
        azione: (p["Azione"]?.select?.name || "") as AuditAzione,
        risorsa: getText(p["Risorsa"]),
        dettaglio: getText(p["Dettaglio"]),
        ip: getText(p["IP"])
      };

      // Verifica 1: hash precedente deve corrispondere a quello atteso
      if (hashPrecedente !== hashAtteso) {
        return {
          integro: false,
          totaleRecord: results.length,
          rotturaAlRecord: i + 1,
          descrizioneRottura: `Record #${i + 1}: hash precedente non corrisponde (atteso: ${hashAtteso.slice(0, 16)}..., trovato: ${hashPrecedente.slice(0, 16)}...)`
        };
      }

      // Verifica 2: hash del record deve corrispondere al ricalcolo
      const hashRicalcolato = computeHash(entry, timestamp, hashPrecedente);
      if (hashRicalcolato !== hashRecord) {
        return {
          integro: false,
          totaleRecord: results.length,
          rotturaAlRecord: i + 1,
          descrizioneRottura: `Record #${i + 1}: hash record alterato — possibile manomissione`
        };
      }

      hashAtteso = hashRecord;
    }

    return { integro: true, totaleRecord: results.length };
  }
};
