import type { CurrentUser } from "./domain.js";

const SESSION_KEY = "senca_session_v1";
const BIO_KEY = "senca_bio_v1";
const SESSION_MAX_AGE_MS = 30 * 24 * 3600 * 1000; // 30 giorni

export function saveSession(user: CurrentUser): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ user, ts: Date.now() })); } catch {}
}
export function loadSession(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !d.user) return null;
    if (Date.now() - d.ts > SESSION_MAX_AGE_MS) return null;
    return d.user as CurrentUser;
  } catch { return null; }
}
export function clearSession(): void {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

interface BioRecord { credId: string; username: string }

export function getBio(): BioRecord | null {
  try {
    const raw = localStorage.getItem(BIO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function clearBio(): void {
  try { localStorage.removeItem(BIO_KEY); } catch {}
}
export function bioSupported(): boolean {
  return !!(
    typeof window !== "undefined" &&
    (window as any).PublicKeyCredential &&
    navigator.credentials &&
    (navigator.credentials as any).create &&
    window.isSecureContext
  );
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBuf(b64: string): ArrayBuffer {
  const s = atob(b64);
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr.buffer;
}

/** Registra una credenziale WebAuthn (Face ID / Touch ID / impronta) per l'utente. */
export async function enrollBio(user: CurrentUser): Promise<boolean> {
  if (!bioSupported()) throw new Error("unsupported");
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  const uid = new Uint8Array(16);
  crypto.getRandomValues(uid);

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Senca Hub" },
      user: { id: uid, name: user.username || "utente", displayName: user.nome || user.username || "utente" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
      attestation: "none"
    }
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("no-credential");
  localStorage.setItem(BIO_KEY, JSON.stringify({ credId: bufToB64(cred.rawId), username: user.username }));
  return true;
}

/** Richiede Face ID / Touch ID / impronta per sbloccare la sessione già salvata. */
export async function unlockBio(): Promise<boolean> {
  const bio = getBio();
  if (!bio || !bioSupported()) throw new Error("nobio");
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: "public-key", id: b64ToBuf(bio.credId) }],
      userVerification: "required",
      timeout: 60000
    }
  });
  return true;
}
