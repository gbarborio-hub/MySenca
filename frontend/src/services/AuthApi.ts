import { api } from "./apiClient.js";
import type { AuthResult } from "../models/domain.js";

export const AuthApi = {
  login: (username: string, password: string) =>
    api.post<AuthResult>("/auth/login", { username, password }),
  verifyTotp: (username: string, token: string) =>
    api.post<AuthResult>("/auth/totp-verify", { username, token })
};
