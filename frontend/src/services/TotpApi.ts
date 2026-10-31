// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import { api } from "./apiClient.js";

export interface TotpSetupResult {
  ok: boolean;
  qrDataUrl: string;
  manualKey: string;
}

export const TotpApi = {
  status: (username: string) => api.get<{ enabled: boolean }>(`/totp/status?username=${encodeURIComponent(username)}`),
  setup: (username: string) => api.post<TotpSetupResult>("/totp/setup", { username }),
  confirm: (username: string, token: string) => api.post<{ ok: boolean; error?: string }>("/totp/confirm", { username, token }),
  // Il backend agisce sempre sull'utente del token; lo username resta solo per compatibilità.
  disable: (username: string, token: string) => api.post<{ ok: boolean; error?: string }>("/totp/disable", { username, token })
};
