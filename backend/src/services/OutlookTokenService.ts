// Delegated OAuth2 token refresh for Microsoft Graph (mailbox: no-reply@senca.it).
// Initial authorization code exchange happens once via a setup script/route;
// from then on this module refreshes the access token using the stored refresh token.
//
// TODO: replace the in-memory token store with a persisted one (env var / small file /
// Notion config row) so refresh token survives server restarts.

interface TokenState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number; // epoch ms
}

const state: TokenState = {
  accessToken: null,
  refreshToken: process.env.OUTLOOK_REFRESH_TOKEN || null,
  expiresAt: 0
};

const TENANT_ID = process.env.MS_TENANT_ID || "";
const CLIENT_ID = process.env.MS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET || "";
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

async function refresh(): Promise<string | null> {
  if (!state.refreshToken) return null;
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: state.refreshToken,
    scope: "https://graph.microsoft.com/Mail.Send offline_access"
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!res.ok) return null;
  const json: any = await res.json();
  state.accessToken = json.access_token;
  state.refreshToken = json.refresh_token || state.refreshToken;
  state.expiresAt = Date.now() + (json.expires_in - 60) * 1000;
  return state.accessToken;
}

export const OutlookTokenService = {
  async getAccessToken(): Promise<string | null> {
    if (state.accessToken && Date.now() < state.expiresAt) return state.accessToken;
    return refresh();
  }
};
