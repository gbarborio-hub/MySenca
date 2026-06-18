import crypto from "crypto";

const ITERATIONS = 100_000;
const KEYLEN = 64;
const DIGEST = "sha256";
const PWD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // no ambiguous chars

export const PasswordService = {
  generate(length = 12): string {
    let out = "";
    for (let i = 0; i < length; i++) {
      out += PWD_CHARS.charAt(crypto.randomInt(0, PWD_CHARS.length));
    }
    return out;
  },

  hash(password: string, salt?: string): { hash: string; salt: string } {
    const useSalt = salt ?? crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, useSalt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
    return { hash, salt: useSalt };
  },

  verify(password: string, hash: string, salt: string): boolean {
    const computed = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(hash, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
};
