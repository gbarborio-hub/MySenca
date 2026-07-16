// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
// Coordina l'ordine delle scritture dell'audit log tra TUTTI i processi/istanze
// del backend, usando PostgreSQL come punto di sincronizzazione condiviso.
//
// Il problema che risolve: la coda in memoria di AuditService serializza le
// scritture solo all'interno di un singolo processo Node.js. Se Render esegue
// più istanze del backend (o durante un deploy, la vecchia e la nuova istanza
// coesistono per un istante), ogni istanza ha la propria coda separata — due
// istanze diverse possono leggere lo stesso "ultimo hash" da Notion nello stesso
// momento e scrivere entrambe un record che lo referenzia, creando una diramazione.
//
// PostgreSQL risolve questo perché TUTTE le istanze si connettono allo stesso
// database: usando `SELECT ... FOR UPDATE` per bloccare la riga durante la
// transazione, un secondo processo che tenta di leggere la stessa riga resta
// bloccato finché il primo non completa (COMMIT o ROLLBACK) — una vera coda
// globale, indipendente da quante istanze del backend sono in esecuzione.
import pg from "pg";

const { Pool } = pg;

const GENESIS_HASH = "GENESIS-MySenca-AuditLog-v1";

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL non impostata — necessaria per il lock dell'audit log.");
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

let initialized = false;

async function ensureTable(): Promise<void> {
  if (initialized) return;
  const p = getPool();
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS audit_chain_lock (
        id INTEGER PRIMARY KEY,
        last_hash TEXT NOT NULL
      );
    `);
  } catch (e: any) {
    const giaEsiste = e?.code === "42P07" || e?.code === "23505";
    if (!giaEsiste) throw e;
  }
  await p.query(
    `INSERT INTO audit_chain_lock (id, last_hash) VALUES (1, $1) ON CONFLICT (id) DO NOTHING;`,
    [GENESIS_HASH]
  );
  initialized = true;
}

export const ChainLockService = {
  async withLock<T>(fn: (hashPrecedente: string) => Promise<{ result: T; nuovoHash: string }>): Promise<T> {
    await ensureTable();
    const p = getPool();
    const client = await p.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query("SELECT last_hash FROM audit_chain_lock WHERE id = 1 FOR UPDATE");
      const hashPrecedente: string = res.rows[0]?.last_hash || GENESIS_HASH;

      const { result, nuovoHash } = await fn(hashPrecedente);

      await client.query("UPDATE audit_chain_lock SET last_hash = $1 WHERE id = 1", [nuovoHash]);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },

  async resetLock(hash: string = GENESIS_HASH): Promise<void> {
    await ensureTable();
    const p = getPool();
    await p.query("UPDATE audit_chain_lock SET last_hash = $1 WHERE id = 1", [hash]);
  }
};
