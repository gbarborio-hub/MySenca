// Invio email tramite il workflow n8n dedicato ("MySenca - Invio Email"),
// che usa la credenziale Microsoft Outlook già autorizzata su n8n.
// Niente OAuth2 diretto su questo backend: n8n fa da intermediario.

const N8N_EMAIL_WEBHOOK = process.env.N8N_EMAIL_WEBHOOK_URL || "https://senca-hub.duckdns.org/webhook/senca-email";

export const EmailService = {
  // Firma mantenuta com'era (accessToken non più usato, tenuto per non toccare i chiamanti)
  // così CredentialsService/RotationService restano invariati.
  async send(_accessTokenUnused: string, to: string, subject: string, htmlBody: string): Promise<boolean> {
    try {
      const res = await fetch(N8N_EMAIL_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "generico", email: to, subject, htmlBody })
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async sendCredenziali(nome: string, username: string, email: string, password: string): Promise<boolean> {
    try {
      const res = await fetch(N8N_EMAIL_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "credenziali", nome, username, email, password })
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async sendRotazione(nome: string, username: string, email: string, password: string): Promise<boolean> {
    try {
      const res = await fetch(N8N_EMAIL_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "rotazione", nome, username, email, password })
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  credenzialiTemplate(username: string, password: string): string {
    return `<p>Gentile collega,</p>
<p>è stato creato il tuo accesso alla web app aziendale <b>MySenca</b>.</p>
<p><b>Username:</b> ${username}<br><b>Password:</b> ${password}</p>
<p>Per motivi di sicurezza la password verrà rinnovata automaticamente ogni 90 giorni: riceverai una nuova email quando accadrà.</p>
<p>Ti consigliamo di non condividere queste credenziali con nessuno.</p>
<p>Cordiali saluti,<br>Senca Senior Care</p>`;
  },

  rotazioneTemplate(username: string, password: string): string {
    return `<p>Gentile collega,</p>
<p>la tua password di accesso a <b>MySenca</b> è stata rinnovata automaticamente, come previsto ogni 90 giorni.</p>
<p><b>Username:</b> ${username}<br><b>Nuova password:</b> ${password}</p>
<p>La password precedente non è più valida da questo momento.</p>
<p>Cordiali saluti,<br>Senca Senior Care</p>`;
  }
};
