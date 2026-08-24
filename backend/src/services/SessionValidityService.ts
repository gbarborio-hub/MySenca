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

interface CacheEntry {
  valida: boolean;
  scadenza: number;
}

const cache = new Map<string, CacheEntry>();

export const SessionValidityService = {
  async isValida(username: string): Promise<boolean> {
    const now = Date.now();
    const cached = cache.get(username);
    if (cached && cached.scadenza > now) return cached.valida;

    try {
      const utente = await UtentiModel.findByUsername(username);
      const valida = !!utente && utente.attivo && !utente.bloccato;
      cache.set(username, { valida, scadenza: now + CACHE_TTL_MS });
      return valida;
    } catch {
      // Notion irraggiungibile: non blocchiamo l'operatività per un problema di
      // rete — se c'era un valore in cache (anche scaduto) lo riusiamo, altrimenti
      // lasciamo passare (fail-open sull'infrastruttura, non sulla sicurezza: il
      // token resta comunque firmato e verificato crittograficamente).
      return cached?.valida ?? true;
    }
  }
};
