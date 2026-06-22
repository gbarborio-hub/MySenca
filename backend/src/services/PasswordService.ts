import crypto from "crypto";

const ITERATIONS = 100_000;
const KEYLEN = 64;
const DIGEST = "sha256";
const PWD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // no ambiguous chars

function pbkdf2Async(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, ITERATIONS, KEYLEN, DIGEST, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

export const PasswordService = {
  generate(length = 12): string {
    let out = "";
    for (let i = 0; i < length; i++) {
      out += PWD_CHARS.charAt(crypto.randomInt(0, PWD_CHARS.length));
    }
    return out;
  },

  async hash(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
    const useSalt = salt ?? crypto.randomBytes(16).toString("hex");
    const derived = await pbkdf2Async(password, useSalt);
    return { hash: derived.toString("hex"), salt: useSalt };
  },

  async verify(password: string, hash: string, salt: string): Promise<boolean> {
    const computed = await pbkdf2Async(password, salt);
    const a = computed;
    const b = Buffer.from(hash, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
};
