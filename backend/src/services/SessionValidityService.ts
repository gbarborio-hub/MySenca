// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
//
// Un JWT è per natura "senza stato": una volta firmato resta valido fino alla sua
// scadenza naturale, anche se nel frattempo l'account viene disattivato o bloccato
// (finora quei controlli avvenivano solo al momento del login). Questo servizio
// aggiunge un controllo periodico — con una piccola cache in memoria per non
// interrogare Notion a ogni singola richiesta — così un account disattivato smette
// di poter usare un token già emesso entro pochi secondi, non alla sua scadenza
// (fino a 30 giorni dopo).
//
// Non è una revoca istantanea di un singolo dispositivo (richiederebbe una lista
// nera dei singoli token, non implementata) — è una revoca a livello di ACCOUNT,
// che copre il caso più comune e più urgente: un amministratore disattiva o blocca
// un utente e quell'utente deve smettere di poter operare a breve, non tra un mese.
import { UtentiModel } from "../models/UtentiModel.js";

const CACHE_TTL_MS = 30_000; // 30 secondi: propagazione rapida senza martellare Notion

export interface StatoSessione {
  valida: boolean;
  ruoli: string[];   // ruoli ATTUALI su Notion, non quelli scritti nel token
  ruolo: string;
  // true se Notion non era raggiungibile e non c'era nulla in cache
  nonVerificabile?: boolean;
}

interface CacheEntry extends StatoSessione {
  scadenza: number;
}

const cache = new Map<string, CacheEntry>();

export const SessionValidityService = {
  // Oltre ad attivo/bloccato restituisce anche i ruoli correnti: l'autorizzazione
  // usa questi, così togliere un ruolo a qualcuno ha effetto entro 30 secondi
  // anche sui token già emessi (prima valeva fino alla scadenza, fino a 30 giorni).
  async stato(username: string): Promise<StatoSessione> {
    const now = Date.now();
    const cached = cache.get(username);
    if (cached && cached.scadenza > now) return cached;

    try {
      const utente = await UtentiModel.findByUsername(username);
      const valida = !!utente && utente.attivo && !utente.bloccato;
      const ruoli = utente ? Array.from(new Set([utente.ruolo, ...utente.ruoliAggiuntivi])) : [];
      const entry: CacheEntry = { valida, ruoli, ruolo: utente?.ruolo || "", scadenza: now + CACHE_TTL_MS };
      cache.set(username, entry);
      return entry;
    } catch {
      // Notion irraggiungibile: si riusa l'ultimo stato noto (anche scaduto); se non
      // ce n'è nessuno si NEGA l'accesso invece di lasciar passare tutti.
      if (cached) return cached;
      return { valida: false, ruoli: [], ruolo: "", nonVerificabile: true };
    }
  },

  async isValida(username: string): Promise<boolean> {
    return (await this.stato(username)).valida;
  }
};
