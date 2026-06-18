# Senca Hub — MVC TypeScript

Sostituisce n8n+vanilla-JS con backend Express/TS + frontend React/TS. Notion resta il DB, dietro il Model layer del backend (mai chiamato direttamente dal frontend).

## Struttura

```
backend/   Express + TS — routes → controllers → services → models → Notion
frontend/  React + TS (Vite) — views → components, models (types/state), services (API client)
```

Backend MVC: `routes/` = superficie REST. `controllers/` = solo request/response, zero logica. `services/` = logica di business (hash password, login, creazione utenza, rotazione 90gg). `models/` = unico punto di accesso a Notion.

Frontend: `views/` = schermate per ruolo. `components/` = pezzi UI riusabili. `models/` = tipi + stato sessione. `services/` = client verso le API del backend.

## Stato reale di questo giro

**Completo e funzionante** (typecheck + build passano):
- Auth: login con hash PBKDF2+salt, blocco a 3 tentativi falliti
- Admin: Home, Da abilitare (assegna username + invia credenziali), Utenti web app (ricerca, cambio ruolo, riattiva utenza bloccata, elimina utenza)
- Rotazione password 90 giorni (job schedulato in `server.ts`)
- Invio email via Microsoft Graph (Outlook)
- Cambio interfaccia per utenti multi-ruolo

**Solo placeholder, porting da fare nel prossimo giro**:
- `GestionePersonaleView.tsx` — dipendenti CRUD, turni, timbrature, comunicazioni, ferie, strutture, buste paga
- `DipendenteView.tsx` — timbratura, turni, ferie, comunicazioni, documenti, profilo
- `PrivacyView.tsx` — dashboard marketing, lista post, calendario editoriale, incaricati privacy

Questi tre erano le sezioni più grosse del vecchio `index.html` (oltre 2000 righe combinate): vanno spostati uno alla volta nello stesso schema MVC già impostato per l'Admin, così la prossima sessione può procedere modulo per modulo senza dover ridisegnare l'architettura.

## Avvio locale

```bash
cd backend && npm install && cp .env.example .env   # compila NOTION_TOKEN, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT_ID, OUTLOOK_REFRESH_TOKEN
npm run dev      # http://localhost:3001

cd frontend && npm install
npm run dev      # http://localhost:5173, proxy /api verso il backend
```

## Note tecniche

- Password: mai in chiaro su Notion. PBKDF2 100k iterazioni, salt casuale 16 byte, confronto a tempo costante (`timingSafeEqual`).
- `OutlookTokenService.ts` ha un TODO esplicito: il refresh token va persistito da qualche parte che sopravviva al restart del server (oggi solo env var). Da risolvere prima di andare in produzione.
- ID database Notion (Dipendenti, Utenti web app) sono hardcoded nei model file — stessi ID già in uso nei workflow n8n precedenti.
