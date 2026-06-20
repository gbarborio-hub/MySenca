import { Router, Request, Response } from "express";

const N8N = "https://senca-hub.duckdns.org/webhook";
// Endpoint Make.com - marketing/privacy e contatti dipendente, diversi da n8n
const MAKE_DATI = "https://hook.eu1.make.com/y882re16wkatcqdk7zevhr24uknk78v4";
const MAKE_PRIVACY = "https://hook.eu1.make.com/dmdvislgavso2dhh7ccp5iy4pa69vuox";
const MAKE_AZIONE = "https://hook.eu1.make.com/6vp67eiqkpd861to9dqqolvfft62ahcq";
const MAKE_CONTATTI = "https://hook.eu1.make.com/3pkwi2nqujb04dfklwql6tpa52fxq4rj";
const MAKE_CICLO = "https://hook.eu1.make.com/amh2svifhurdxby9dc2b9fms2fnk9f6x";

async function proxy(url: string, body: unknown, res: Response) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await r.text();
    res.status(r.status).set("Content-Type", "application/json").send(data);
  } catch (e) {
    res.status(502).json({ error: "Upstream error" });
  }
}

export const dipendentiProxyRouter = Router();

// Timbratura
dipendentiProxyRouter.post("/timbra", (req: Request, res: Response) => proxy(`${N8N}/timbra`, req.body, res));
dipendentiProxyRouter.post("/timbrature-read", (req: Request, res: Response) => proxy(`${N8N}/timbrature-read`, req.body, res));
dipendentiProxyRouter.post("/timbratura-update", (req: Request, res: Response) => proxy(`${N8N}/timbratura-update`, req.body, res));

// Turni
dipendentiProxyRouter.post("/turni-read", (req: Request, res: Response) => proxy(`${N8N}/turni-read`, req.body, res));
dipendentiProxyRouter.post("/turni-griglia", (req: Request, res: Response) => proxy(`${N8N}/turni-griglia`, req.body, res));
dipendentiProxyRouter.post("/turni-scrivi", (req: Request, res: Response) => proxy(`${N8N}/turni-scrivi`, req.body, res));
dipendentiProxyRouter.post("/legenda-read", (req: Request, res: Response) => proxy(`${N8N}/legenda-read`, req.body, res));
dipendentiProxyRouter.post("/legenda-scrivi", (req: Request, res: Response) => proxy(`${N8N}/legenda-scrivi`, req.body, res));

// Strutture
dipendentiProxyRouter.post("/strutture", (req: Request, res: Response) => proxy(`${N8N}/strutture`, req.body, res));
dipendentiProxyRouter.post("/gp-strutture", (req: Request, res: Response) => proxy(`${N8N}/gp-strutture`, req.body, res));
dipendentiProxyRouter.post("/struttura-salva", (req: Request, res: Response) => proxy(`${N8N}/struttura-salva`, req.body, res));

// Profilo
dipendentiProxyRouter.post("/profilo", (req: Request, res: Response) => proxy(`${N8N}/profilo`, req.body, res));

// Ferie
dipendentiProxyRouter.post("/ferie-saldo", (req: Request, res: Response) => proxy(`${N8N}/ferie-saldo`, req.body, res));
dipendentiProxyRouter.post("/ferie-richiesta", (req: Request, res: Response) => proxy(`${N8N}/ferie-richiesta`, req.body, res));
dipendentiProxyRouter.post("/ferie-lettura", (req: Request, res: Response) => proxy(`${N8N}/ferie-lettura`, req.body, res));
dipendentiProxyRouter.post("/ferie-update", (req: Request, res: Response) => proxy(`${N8N}/ferie-update`, req.body, res));

// Comunicazioni (condivise dipendente + GP)
dipendentiProxyRouter.post("/comunicazioni-lista", (req: Request, res: Response) => proxy(`${N8N}/comunicazioni-lista`, req.body, res));
dipendentiProxyRouter.post("/comunicazione-crea", (req: Request, res: Response) => proxy(`${N8N}/comunicazione-crea`, req.body, res));
dipendentiProxyRouter.post("/comunicazione-letta", (req: Request, res: Response) => proxy(`${N8N}/comunicazione-letta`, req.body, res));
dipendentiProxyRouter.post("/comunicazione-letture", (req: Request, res: Response) => proxy(`${N8N}/comunicazione-letture`, req.body, res));

// Documenti (condivisi dipendente + GP)
dipendentiProxyRouter.post("/documenti-lista", (req: Request, res: Response) => proxy(`${N8N}/documenti-lista`, req.body, res));
dipendentiProxyRouter.post("/documento-carica", (req: Request, res: Response) => proxy(`${N8N}/documento-carica`, req.body, res));
dipendentiProxyRouter.post("/documento-elimina", (req: Request, res: Response) => proxy(`${N8N}/documento-elimina`, req.body, res));

// Segnalazione
dipendentiProxyRouter.post("/segnalazione", (req: Request, res: Response) => proxy(`${N8N}/segnalazione`, req.body, res));
dipendentiProxyRouter.post("/app-ticket", (req: Request, res: Response) => proxy(`${N8N}/app-ticket`, req.body, res));
dipendentiProxyRouter.post("/dipendente-salva", (req: Request, res: Response) => proxy(`${N8N}/dipendente-salva`, req.body, res));

// Contatti e ciclo (Make)
dipendentiProxyRouter.post("/contatti", (_req: Request, res: Response) => proxy(MAKE_CONTATTI, { action: "get_contatti" }, res));
dipendentiProxyRouter.post("/ciclo", (req: Request, res: Response) => proxy(MAKE_CICLO, req.body, res));

// GP
dipendentiProxyRouter.post("/gp-dipendenti", (req: Request, res: Response) => proxy(`${N8N}/gp-dipendenti`, req.body, res));
dipendentiProxyRouter.post("/gp-timbrature", (req: Request, res: Response) => proxy(`${N8N}/gp-timbrature`, req.body, res));
dipendentiProxyRouter.post("/gp-ferie", (req: Request, res: Response) => proxy(`${N8N}/gp-ferie`, req.body, res));

// Privacy/marketing (Make, non n8n - action-based payload)
dipendentiProxyRouter.post("/posts", (_req: Request, res: Response) => proxy(MAKE_DATI, { action: "get_posts" }, res));
dipendentiProxyRouter.post("/incaricati", (_req: Request, res: Response) => proxy(MAKE_PRIVACY, { action: "get_incaricati" }, res));
dipendentiProxyRouter.post("/azione-nomina", (req: Request, res: Response) => proxy(MAKE_AZIONE, req.body, res));
