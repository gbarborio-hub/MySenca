import { UtentiModel } from "../models/UtentiModel.js";
import { DipendentiModel } from "../models/DipendentiModel.js";
import { PasswordService } from "./PasswordService.js";
import { EmailService } from "./EmailService.js";
import type { CreaUtenzaInput, CreaUtenzaResult } from "../types/domain.js";

export const CredentialsService = {
  async creaUtenza(input: CreaUtenzaInput): Promise<CreaUtenzaResult> {
    const username = input.username.trim().toLowerCase();
    if (!username || !input.dipendentePageId) {
      return { ok: false, error: "Dati mancanti (username o dipendente)." };
    }

    const password = PasswordService.generate(12);
    const { hash, salt } = await PasswordService.hash(password);

    await DipendentiModel.setUsername(input.dipendentePageId, username);
    await UtentiModel.create({
      username, hash, salt,
      ruolo: input.ruolo,
      ruoliAggiuntivi: input.ruoliAggiuntivi || [],
      email: input.email
    });

    let emailInviata = false;
    if (input.email) {
      const dip = await DipendentiModel.findByUsername(username);
      const nome = dip ? `${dip.nome} ${dip.cognome}`.trim() : username;
      emailInviata = await EmailService.sendCredenziali(nome, username, input.email, password);
    }

    return { ok: true, username, password, emailInviata };
  },

  async eliminaUtenza(pageId: string, username: string): Promise<void> {
    await UtentiModel.archivia(pageId);
    const dip = await DipendentiModel.findByUsername(username);
    if (dip) await DipendentiModel.clearUsername(dip.pageId);
  },

  async riattivaUtenza(pageId: string): Promise<void> {
    await UtentiModel.riattiva(pageId);
  }
};
