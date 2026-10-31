// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
//
// Header di autenticazione verso i webhook n8n. Prima il backend li chiamava con il
// solo Content-Type: chiunque conoscesse l'URL poteva chiamarli direttamente e
// saltare login, ruoli e audit. Ora ogni chiamata porta un segreto condiviso
// (N8N_WEBHOOK_SECRET) che n8n deve verificare ("Header Auth" sul nodo Webhook,
// nome header: X-MySenca-Secret). Per i workflow che vogliono ricontrollare chi
// chiama, si aggiungono anche utente e ruoli già verificati dal backend.
const SECRET = process.env.N8N_WEBHOOK_SECRET || "";
if (!SECRET) {
  console.warn("⚠️  N8N_WEBHOOK_SECRET non impostata: le chiamate ai webhook n8n partono senza segreto.");
}

export function webhookHeaders(user?: { username: string; ruoli: string[] }): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (SECRET) h["X-MySenca-Secret"] = SECRET;
  if (user) {
    h["X-MySenca-User"] = user.username;
    h["X-MySenca-Ruoli"] = (user.ruoli || []).join(",");
  }
  return h;
}
