import { UtentiModel } from "../models/UtentiModel.js";
import { DipendentiModel } from "../models/DipendentiModel.js";
import { PasswordService } from "./PasswordService.js";
import { EmailService } from "./EmailService.js";

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
      const { hash, salt } = await PasswordService.hash(password);
      await UtentiModel.aggiornaPassword(u.pageId, hash, salt);

      if (u.email) {
        const dip = await DipendentiModel.findByUsername(u.username);
        const nome = dip ? `${dip.nome} ${dip.cognome}`.trim() : u.username;
        const sent = await EmailService.sendRotazione(nome, u.username, u.email, password);
        if (!sent) emailFailed.push(u.username);
      } else {
        emailFailed.push(u.username);
      }
    }
    return { rotated: due.length, emailFailed };
  }
};
