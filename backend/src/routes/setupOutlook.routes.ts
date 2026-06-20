// Route temporanea per generare il refresh token OAuth2 di Outlook UNA VOLTA.
// Dopo aver salvato OUTLOOK_REFRESH_TOKEN su Render, questo file può essere rimosso
// (o lasciato: senza visitarlo non fa nulla, ma è comunque pulito togliere endpoint
// che esporrebbero client secret in caso di errore).
import { Router, Request, Response } from "express";

const TENANT_ID = process.env.MS_TENANT_ID || "";
const CLIENT_ID = process.env.MS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET || "";
const SCOPES = "https://graph.microsoft.com/Mail.Send offline_access";

export const setupOutlookRouter = Router();

function redirectUri(req: Request): string {
  // Costruita dinamicamente dall'host della richiesta, così funziona sia in
  // locale (se mai serve) sia su Render senza dover hardcodare il dominio.
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${req.get("host")}/api/setup-outlook/callback`;
}

setupOutlookRouter.get("/", (req: Request, res: Response) => {
  if (!CLIENT_ID || !TENANT_ID) {
    res.status(500).send("MS_CLIENT_ID o MS_TENANT_ID non configurati su Render.");
    return;
  }
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(req),
    response_mode: "query",
    scope: SCOPES,
    prompt: "consent"
  });
  res.redirect(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`);
});

setupOutlookRouter.get("/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;
  if (error) {
    res.status(400).send(`<pre>Errore da Microsoft: ${error} — ${req.query.error_description || ""}</pre>`);
    return;
  }
  if (!code) {
    res.status(400).send("Nessun codice di autorizzazione ricevuto.");
    return;
  }
  try {
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(req),
      scope: SCOPES
    });
    const tokenRes = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const json: any = await tokenRes.json();
    if (!tokenRes.ok || !json.refresh_token) {
      res.status(500).send(`<pre>Scambio del codice non riuscito:\n${JSON.stringify(json, null, 2)}</pre>`);
      return;
    }
    res.send(`
      <html><body style="font-family: sans-serif; max-width: 700px; margin: 40px auto;">
        <h2>✅ Refresh token generato</h2>
        <p>Copia il valore qui sotto e salvalo su Render → Environment → <code>OUTLOOK_REFRESH_TOKEN</code>, poi fai un manual deploy.</p>
        <textarea style="width:100%; height:120px; font-family: monospace; padding: 8px;" readonly onclick="this.select()">${json.refresh_token}</textarea>
        <p style="color:#888; font-size: 13px;">Dopo averlo salvato, questa pagina e l'intero file setupOutlook.routes.ts possono essere rimossi dal codice per sicurezza.</p>
      </body></html>
    `);
  } catch (e: any) {
    res.status(500).send(`<pre>Errore: ${e?.message || e}</pre>`);
  }
});
