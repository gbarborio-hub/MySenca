// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import type { Request, Response } from "express";
import { TurniModel } from "../models/TurniModel.js";

export const TurniController = {
  async list(req: Request, res: Response) {
    try {
      const nome = String(req.query.nome || "").trim();
      if (!nome) {
        res.status(400).json({ error: "Parametro 'nome' mancante." });
        return;
      }
      const turni = await TurniModel.listByDipendente(nome);
      res.json(turni);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Errore lettura turni." });
    }
  }
};
