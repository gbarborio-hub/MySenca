import { Router, Request, Response } from "express";

const N8N = "https://senca-hub.duckdns.org/webhook";
const MAKE_CONTATTI = "https://hook.eu1.make.com/3pkwi2nqujb04dfklwql6tpa52fxq4rj";

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
dipendentiProxyRouter.post("/ferie-approvazione", (req: Request, res: Response) => proxy(`${N8N}/ferie-approvazione`, req.body, res));

// Comunicazioni dipendente
dipendentiProxyRouter.post("/dip-comunicazioni", (req: Request, res: Response) => proxy(`${N8N}/dip-comunicazioni`, req.body, res));
dipendentiProxyRouter.post("/dip-comunicazione-letta", (req: Request, res: Response) => proxy(`${N8N}/dip-comunicazione-letta`, req.body, res));

// Documenti dipendente
dipendentiProxyRouter.post("/dip-docs", (req: Request, res: Response) => proxy(`${N8N}/dip-docs`, req.body, res));

// Segnalazione
dipendentiProxyRouter.post("/segnalazione", (req: Request, res: Response) => proxy(`${N8N}/segnalazione`, req.body, res));

// Contatti (da Make, non n8n)
dipendentiProxyRouter.post("/contatti", (_req: Request, res: Response) => proxy(MAKE_CONTATTI, {}, res));

// GP endpoints
dipendentiProxyRouter.post("/gp-dipendenti", (req: Request, res: Response) => proxy(`${N8N}/gp-dipendenti`, req.body, res));
dipendentiProxyRouter.post("/gp-timbrature", (req: Request, res: Response) => proxy(`${N8N}/gp-timbrature`, req.body, res));
dipendentiProxyRouter.post("/gp-ferie", (req: Request, res: Response) => proxy(`${N8N}/gp-ferie`, req.body, res));
dipendentiProxyRouter.post("/gp-comunicazioni", (req: Request, res: Response) => proxy(`${N8N}/gp-comunicazioni`, req.body, res));
dipendentiProxyRouter.post("/gp-com-invia", (req: Request, res: Response) => proxy(`${N8N}/gp-com-invia`, req.body, res));
dipendentiProxyRouter.post("/gp-com-letta", (req: Request, res: Response) => proxy(`${N8N}/gp-com-letta`, req.body, res));
dipendentiProxyRouter.post("/gp-buste", (req: Request, res: Response) => proxy(`${N8N}/gp-buste`, req.body, res));
dipendentiProxyRouter.post("/gp-busta-upload", (req: Request, res: Response) => proxy(`${N8N}/gp-busta-upload`, req.body, res));
dipendentiProxyRouter.post("/gp-docs", (req: Request, res: Response) => proxy(`${N8N}/gp-docs`, req.body, res));
dipendentiProxyRouter.post("/gp-doc-upload", (req: Request, res: Response) => proxy(`${N8N}/gp-doc-upload`, req.body, res));

// Privacy/marketing
dipendentiProxyRouter.post("/posts", (req: Request, res: Response) => proxy(`${N8N}/posts`, req.body, res));
dipendentiProxyRouter.post("/incaricati", (req: Request, res: Response) => proxy(`${N8N}/incaricati`, req.body, res));
