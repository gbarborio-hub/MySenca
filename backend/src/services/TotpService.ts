// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
// Implementazione TOTP (RFC 6238) con la sola libreria crypto nativa di Node —
// nessuna dipendenza esterna per la logica di generazione/verifica dei codici,
// coerente con l'approccio già usato per EncryptionService.
import crypto from "crypto";
import QRCode from "qrcode";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buffer: Buffer): string {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder) {
    const lastChunk = bits.slice(bits.length - remainder).padEnd(5, "0");
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "");
  let bits = "";
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secretBuffer: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binCode % 10 ** DIGITS).padStart(DIGITS, "0");
}

export const TotpService = {
  // Genera un nuovo segreto casuale a 160 bit, codificato in Base32
  // (standard per la compatibilità con Google Authenticator/Authy/Microsoft Authenticator).
  generateSecret(): string {
    return base32Encode(crypto.randomBytes(20));
  },

  // URL otpauth:// da incorporare nel QR code — l'app authenticator lo interpreta
  // per configurare automaticamente nome, emittente e segreto.
  buildOtpAuthUrl(secretBase32: string, username: string): string {
    const label = encodeURIComponent(`MySenca:${username}`);
    const issuer = encodeURIComponent("MySenca");
    return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
  },

  // Verifica un codice a 6 cifre, tollerando ±1 finestra temporale (30s) per
  // compensare piccoli disallineamenti di orologio tra telefono e server.
  verifyToken(secretBase32: string, token: string): boolean {
    const clean = (token || "").trim();
    if (!/^\d{6}$/.test(clean)) return false;
    const secretBuffer = base32Decode(secretBase32);
    const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
    for (const drift of [0, -1, 1]) {
      if (hotp(secretBuffer, counter + drift) === clean) return true;
    }
    return false;
  },

  // Genera l'immagine QR (come data URL PNG) da mostrare nella schermata di attivazione.
  async generateQrDataUrl(otpAuthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpAuthUrl, { width: 240, margin: 1 });
  }
};

