// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
import type { Request, Response } from "express";
import { ContattiModel } from "../models/ContattiModel.js";

export const ContattiController = {
  async list(_req: Request, res: Response) {
    try {
      const contatti = await ContattiModel.list();
      res.json(contatti);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Errore lettura contatti." });
    }
  }
};
