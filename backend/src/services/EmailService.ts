// Sends mail via Microsoft Graph API using a pre-acquired OAuth2 access token.
// Token acquisition (client credentials or delegated refresh) lives in its own
// module so this service only knows "send this html to this address".

const GRAPH_SEND_URL = "https://graph.microsoft.com/v1.0/me/sendMail";

export const EmailService = {
  async send(accessToken: string, to: string, subject: string, htmlBody: string): Promise<boolean> {
    const res = await fetch(GRAPH_SEND_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: htmlBody },
          toRecipients: [{ emailAddress: { address: to } }]
        }
      })
    });
    return res.ok;
  },

  credenzialiTemplate(username: string, password: string): string {
    return `<p>Gentile collega,</p>
<p>è stato creato il tuo accesso alla web app aziendale <b>Senca Hub</b>.</p>
<p><b>Username:</b> ${username}<br><b>Password:</b> ${password}</p>
<p>Per motivi di sicurezza la password verrà rinnovata automaticamente ogni 90 giorni: riceverai una nuova email quando accadrà.</p>
<p>Ti consigliamo di non condividere queste credenziali con nessuno.</p>
<p>Cordiali saluti,<br>Senca Senior Care</p>`;
  },

  rotazioneTemplate(username: string, password: string): string {
    return `<p>Gentile collega,</p>
<p>la tua password di accesso a <b>Senca Hub</b> è stata rinnovata automaticamente, come previsto ogni 90 giorni.</p>
<p><b>Username:</b> ${username}<br><b>Nuova password:</b> ${password}</p>
<p>La password precedente non è più valida da questo momento.</p>
<p>Cordiali saluti,<br>Senca Senior Care</p>`;
  }
};
