import type { Request, Response } from "express";
import { DipendentiModel } from "../models/DipendentiModel.js";

export const DipendentiController = {
  async list(_req: Request, res: Response) {
    const dipendenti = await DipendentiModel.list();
    res.json(dipendenti);
  },

  async senzaUsername(_req: Request, res: Response) {
    const dipendenti = await DipendentiModel.list();
    res.json(dipendenti.filter(d => !d.username));
  }
};
