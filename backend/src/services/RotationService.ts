import { UtentiModel } from "../models/UtentiModel.js";
import { PasswordService } from "./PasswordService.js";
import { EmailService } from "./EmailService.js";
import { OutlookTokenService } from "./OutlookTokenService.js";

const ROTATION_DAYS = 90;

function daysSince(dateStr: string | null): number {
  if (!dateStr) return Infinity; // never set → rotate immediately
  const then = new Date(dateStr).getTime();
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

export const RotationService = {
  async rotateExpired(): Promise<{ rotated: number; emailFailed: string[] }> {
    const utenti = await UtentiModel.list();
    const due = utenti.filter(u => u.attivo && !u.bloccato && daysSince(u.passwordAggiornataIl) >= ROTATION_DAYS);

    const emailFailed: string[] = [];
    for (const u of due) {
      const password = PasswordService.generate(12);
      const { hash, salt } = PasswordService.hash(password);
      await UtentiModel.aggiornaPassword(u.pageId, hash, salt);

      if (u.email) {
        const token = await OutlookTokenService.getAccessToken();
        const sent = token
          ? await EmailService.send(token, u.email, "La tua password Senca Hub è stata rinnovata",
              EmailService.rotazioneTemplate(u.username, password))
          : false;
        if (!sent) emailFailed.push(u.username);
      } else {
        emailFailed.push(u.username);
      }
    }
    return { rotated: due.length, emailFailed };
  }
};
