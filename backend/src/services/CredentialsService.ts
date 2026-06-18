import { UtentiModel } from "../models/UtentiModel.js";
import { DipendentiModel } from "../models/DipendentiModel.js";
import { PasswordService } from "./PasswordService.js";
import { EmailService } from "./EmailService.js";
import { OutlookTokenService } from "./OutlookTokenService.js";
import type { CreaUtenzaInput, CreaUtenzaResult } from "../types/domain.js";

export const CredentialsService = {
  async creaUtenza(input: CreaUtenzaInput): Promise<CreaUtenzaResult> {
    const username = input.username.trim().toLowerCase();
    if (!username || !input.dipendentePageId) {
      return { ok: false, error: "Dati mancanti (username o dipendente)." };
    }

    const password = PasswordService.generate(12);
    const { hash, salt } = PasswordService.hash(password);

    await DipendentiModel.setUsername(input.dipendentePageId, username);
    await UtentiModel.create({
      username, hash, salt,
      ruolo: input.ruolo,
      ruoliAggiuntivi: input.ruoliAggiuntivi || [],
      email: input.email
    });

    let emailInviata = false;
    if (input.email) {
      const token = await OutlookTokenService.getAccessToken();
      if (token) {
        emailInviata = await EmailService.send(
          token, input.email, "Le tue credenziali di accesso a Senca Hub",
          EmailService.credenzialiTemplate(username, password)
        );
      }
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
