import { api } from "./apiClient.js";
import type { AuthResult } from "../models/domain.js";

export const AuthApi = {
  login: (username: string, password: string, remember: boolean) =>
    api.post<AuthResult>("/auth/login", { username, password, remember }),
  verifyTotp: (username: string, token: string, remember: boolean) =>
    api.post<AuthResult>("/auth/totp-verify", { username, token, remember })
};
