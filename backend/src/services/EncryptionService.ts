// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const PREFIX = "ENC:v1:";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || "";
  if (!raw || raw.length < 32) {
    throw new Error("ENCRYPTION_KEY non impostata o troppo corta (minimo 32 caratteri).");
  }
  // Usa SHA-256 per garantire sempre esattamente 32 byte indipendentemente dalla lunghezza della chiave fornita
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Cifra un valore testuale con AES-256-GCM.
 * Restituisce una stringa con prefisso ENC:v1: riconoscibile in lettura.
 * Se il valore è già cifrato o vuoto, lo restituisce invariato.
 */
export function encrypt(value: string): string {
  if (!value || value.startsWith(PREFIX)) return value;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decifra un valore cifrato con AES-256-GCM.
 * Se il valore non è cifrato (manca il prefisso), lo restituisce invariato
 * per compatibilità con i record esistenti non ancora migrati.
 */
export function decrypt(value: string): string {
  if (!value || !value.startsWith(PREFIX)) return value;
  try {
    const key = getKey();
    const rest = value.slice(PREFIX.length);
    const parts = rest.split(":");
    if (parts.length !== 3) return value;
    const [ivHex, tagHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const ciphertext = Buffer.from(cipherHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
  } catch {
    // Se la decifratura fallisce (chiave sbagliata, dati corrotti), restituisce
    // il valore cifrato originale invece di crashare — il backend resta in piedi
    // e l'errore è visibile nel campo anziché abbattere l'intera richiesta.
    return "[ERRORE DECIFRATURA]";
  }
}

/**
 * Versione convenienza: cifra solo se il valore è non vuoto.
 */
export function encryptIfPresent(value: string | undefined | null): string {
  if (!value) return "";
  return encrypt(value);
}

/**
 * Versione convenienza: decifra solo se il valore è non vuoto.
 */
export function decryptIfPresent(value: string | undefined | null): string {
  if (!value) return "";
  return decrypt(value);
}
