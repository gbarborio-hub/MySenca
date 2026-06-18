import type { Request, Response } from "express";
import { AuthService } from "../services/AuthService.js";

export const AuthController = {
  async login(req: Request, res: Response) {
    const { username, password } = req.body || {};
    const result = await AuthService.login(String(username || ""), String(password || ""));
    res.status(result.ok ? 200 : 401).json(result);
  }
};
