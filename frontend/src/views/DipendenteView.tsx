import { useState, useEffect } from "react";
import { ProxyApi } from "../services/ProxyApi.js";
import RoleSwitchMini from "../components/RoleSwitchMini.js";
import Logo from "../components/Logo.js";
import { NavIcons } from "../components/NavIcons.js";
import { useRequestNotificationPermission, useShiftAndCommsNotifications } from "../hooks/useShiftNotifications.js";

// Tab raggiungibili: 3 nella nav orizzontale (Home/Ferie-ROL/Informazioni) + Contatti (dal logo)
// + 5 raggiungibili solo da card/bottoni interni (Avvisi, Documenti, segnalazione, timbra, turni, profilo)
type DipTab = "Home" | "Ferie/ROL" | "Informazioni" | "Contatti" | "Avvisi" | "Documenti" | "segnalazione" | "timbra" | "turni" | "profilo";

interface Props {
  username: string;
  nome: string;
  mansione?: string;
  ruolo?: string;
  showRoleSwitch: boolean;
  onShowRoleChooser: () => void;
  onLogout: () => void;
}

function fmtDateIt(d: unknown) {
  let value: unknown = d;
  if (d && typeof d === "object" && "start" in (d as any)) value = (d as any).start;
  if (!value || typeof value !== "string") return "—";
  const datePart = value.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length < 3) return "—";
  const [y, m, dd] = parts;
  return `${dd}/${m}/${y}`;
}
function parseTurni(raw: unknown): any[] {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map((item: any) => {
    const p = item && item.properties_value ? item.properties_value : item || {};
    let titolo = "";
    if (p.Titolo && Array.isArray(p.Titolo) && p.Titolo[0]) titolo = p.Titolo[0].plain_text || "";
    const dipendente = typeof p.Dipendente === "string" ? p.Dipendente : (p.Dipendente && p.Dipendente[0] ? p.Dipendente[0].plain_text || "" : "");
    const struttura = (p.Struttura && p.Struttura.name) ? p.Struttura.name : (typeof p.Struttura === "string" ? p.Struttura : "");
    const tipo = (p["Tipo turno"] && p["Tipo turno"].name) ? p["Tipo turno"].name : (typeof p["Tipo turno"] === "string" ? p["Tipo turno"] : (typeof p.tipo === "string" ? p.tipo : ""));
    const dataRaw = (p.Data && p.Data.start) ? p.Data.start : (typeof p.Data === "string" ? p.Data : (typeof p.data === "string" ? p.data : ""));
    const data = dataRaw ? dataRaw.split("T")[0] : "";
    const oraInizio = typeof p["Ora inizio"] === "string" ? p["Ora inizio"] : (p["Ora inizio"] && p["Ora inizio"][0] ? p["Ora inizio"][0].plain_text || "" : (typeof p.oraInizio === "string" ? p.oraInizio : ""));
    const oraFine = typeof p["Ora fine"] === "string" ? p["Ora fine"] : (p["Ora fine"] && p["Ora fine"][0] ? p["Ora fine"][0].plain_text || "" : (typeof p.oraFine === "string" ? p.oraFine : ""));
    return { titolo, dipendente, struttura, tipo, data, oraInizio, oraFine };
  }).filter((t: any) => t.data).sort((a: any, b: any) => (a.data > b.data ? 1 : -1));
}

function parseContatti(raw: unknown): any[] {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map((item: any) => {
    const p = item && item.properties_value ? item.properties_value : item || {};
    let nome = "";
    if (p.Nome && Array.isArray(p.Nome) && p.Nome[0]) nome = p.Nome[0].plain_text || (p.Nome[0].text && p.Nome[0].text.content) || "";
    else if (typeof p.Nome === "string") nome = p.Nome;
    const ruolo = typeof p.Ruolo === "string" ? p.Ruolo : (p.Ruolo && p.Ruolo[0] ? p.Ruolo[0].plain_text || "" : "");
    const email = p.Email || "";
    const telefono = p.Telefono || "";
    const struttura = (p.Struttura && p.Struttura.name) ? p.Struttura.name : (typeof p.Struttura === "string" ? p.Struttura : "");
    const ordine = p.Ordine || 999;
    return { nome, ruolo, email, telefono, struttura, ordine };
  }).filter((c: any) => c.nome).sort((a: any, b: any) => a.ordine - b.ordine);
}

function distanzaMetri(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function timbraKey(username: string) { return `senca_timbra_${username}`; }
function salvaTimbraturaLocale(username: string, state: any) {
  try { localStorage.setItem(timbraKey(username), JSON.stringify(state)); } catch {}
}
function pulisciTimbraturaLocale(username: string) {
  try { localStorage.removeItem(timbraKey(username)); } catch {}
}
function caricaTimbraturaLocale(username: string): any {
  try { const raw = localStorage.getItem(timbraKey(username)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function oggiISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function calcOreSettimana(timbrature: any[]) {
  const oggi = new Date();
  const lunedi = new Date(oggi);
  lunedi.setDate(oggi.getDate() - (oggi.getDay() === 0 ? 6 : oggi.getDay() - 1));
  const lunediStr = lunedi.toISOString().split("T")[0];
  const oggiStr = oggi.toISOString().split("T")[0];
  return timbrature.filter((t: any) => t.data >= lunediStr && t.data <= oggiStr).reduce((acc: number, t: any) => acc + (Number(t.oreTotali) || 0), 0);
}
function calcOreMese(timbrature: any[]) {
  const oggi = new Date();
  const meseStr = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}`;
  return timbrature.filter((t: any) => t.data && String(t.data).startsWith(meseStr)).reduce((acc: number, t: any) => acc + (Number(t.oreTotali) || 0), 0);
}
function calcOrePrevisteMese(turni: any[]) {
  const oggi = new Date();
  const meseStr = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}`;
  return turni.filter((t: any) => t.data && String(t.data).startsWith(meseStr)).reduce((acc: number, t: any) => {
    if (!t.oraInizio || !t.oraFine) return acc;
    const [hi, mi] = t.oraInizio.split(":").map(Number);
    const [hf, mf] = t.oraFine.split(":").map(Number);
    const ore = (hf * 60 + mf - hi * 60 - mi) / 60;
    return acc + (ore > 0 ? ore : 0);
  }, 0);
}

const SEG_DEFAULTS = {
  dataEvento: "", areaSede: "", descrizione: "", tipoViolazione: "", origine: "", causa: "",
  testimoni: "", infoAziendali: "No", infoDettaglio: "", datiPersonali: "No", asset: "",
  responsabileAsset: "", misure: "", dataBreach: "No", categoriaDb: "", categorieDati: "",
  quantita: "", interessati: "", danni: ""
};

export default function DipendenteView({ username, nome, mansione, ruolo, showRoleSwitch, onShowRoleChooser, onLogout }: Props) {
  const [tab, setTab] = useState<DipTab>("Home");
  const [strutture, setStrutture] = useState<any[]>([]);
  const [turni, setTurni] = useState<any[]>([]);
  const [turniLoading, setTurniLoading] = useState(false);
  const [showPastTurni, setShowPastTurni] = useState(false);
  const [timbrature, setTimbrature] = useState<any[]>([]);
  const [ferieSaldo, setFerieSaldo] = useState<any>(null);
  const [ferieRichieste, setFerieRichieste] = useState<any[]>([]);
  const [comunicazioni, setComunicazioni] = useState<any[]>([]);
  const [comSel, setComSel] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [profilo, setProfilo] = useState<any>(null);
  const [contatti, setContatti] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Timbratura state
  const [timbraStruttura, setTimbraStruttura] = useState("");
  const [timbratoEntrata, setTimbratoEntrata] = useState<string | null>(null);
  const [timbraEntrataFull, setTimbraEntrataFull] = useState<string | null>(null);
  const [timbraMsg, setTimbraMsg] = useState<{ text: string; type: string } | null>(null);
  const [timbraStrutturaNome, setTimbraStrutturaNome] = useState<string | null>(null);
  const [timbraTurno, setTimbraTurno] = useState<any>(null);
  const [timbraFuoriTurno, setTimbraFuoriTurno] = useState(false);

  // Timbratura dimenticata
  const [dimOpen, setDimOpen] = useState(false);
  const [dimMsg, setDimMsg] = useState<{ text: string; type: string } | null>(null);
  const [dim, setDim] = useState({ data: "", struttura: "", entrata: "", uscita: "", motivo: "" });

  // Ferie form
  const [ferieForm, setFerieForm] = useState<"Ferie" | "ROL" | null>(null);
  const [ferieInput, setFerieInput] = useState({ inizio: "", fine: "", ore: "", note: "" });

  // Segnalazione
  const [segInviata, setSegInviata] = useState(false);
  const [seg, setSeg] = useState({ ...SEG_DEFAULTS });
  const [segBusy, setSegBusy] = useState(false);

  // Ticket modale
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticket, setTicket] = useState({ titolo: "", categoria: "Problema", descrizione: "" });
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketMsg, setTicketMsg] = useState<string | null>(null);

  const firstName = (nome || "").split(" ")[0] || "utente";
  const nUnread = comunicazioni.filter((c: any) => !c.letto).length;

  function loadComunicazioni(prof: any) {
    ProxyApi.comunicazioniLista({ username, struttura: prof?.struttura || "", ruolo: prof?.mansione || ruolo || "" }).then(r => {
      const list = (Array.isArray(r) ? r : []).map((item: any) => ({ ...item, id: item.id || item.pageId || "" }));
      setComunicazioni(list);
    });
  }
  function loadAll() {
    ProxyApi.strutture().then(r => setStrutture(Array.isArray(r) ? r : []));
    ProxyApi.timbratureRead(username).then(r => setTimbrature(Array.isArray(r) ? r : []));
    ProxyApi.ferieSaldo(username).then(r => setFerieSaldo(r));
    ProxyApi.ferieLettura(username).then(r => setFerieRichieste(Array.isArray(r) ? r : []));
    ProxyApi.profilo(username).then(r => { setProfilo(r); loadComunicazioni(r); });
    ProxyApi.contatti().then(r => setContatti(parseContatti(r)));
    loadTurni();
    loadDocs();
  }
  function loadTurni() {
    setTurniLoading(true);
    ProxyApi.turniRead(nome).then(r => { setTurni(parseTurni(r)); setTurniLoading(false); });
  }
  function loadDocs() {
    setDocsLoading(true);
    ProxyApi.documentiLista({ username }).then(r => { setDocs(Array.isArray(r) ? r : []); setDocsLoading(false); });
  }

  useRequestNotificationPermission(true);
  useShiftAndCommsNotifications({
    isDipendente: true,
    turni, comunicazioni, ferieRichieste, docs,
    refreshComunicazioni: () => loadComunicazioni(profilo),
    refreshFerie: () => ProxyApi.ferieLettura(username).then(r => setFerieRichieste(Array.isArray(r) ? r : [])),
    refreshDocs: loadDocs
  });

  useEffect(() => {
    loadAll();
    const saved = caricaTimbraturaLocale(username);
    if (saved && saved.timbratoEntrata) {
      setTimbratoEntrata(saved.timbratoEntrata);
      setTimbraEntrataFull(saved.timbraEntrataFull);
      setTimbraStruttura(saved.timbraStruttura || "");
      setTimbraStrutturaNome(saved.timbraStrutturaNome || null);
      setTimbraTurno(saved.timbraTurno || null);
      setTimbraFuoriTurno(!!saved.timbraFuoriTurno);
      setTimbraMsg({ text: `🔵 Hai un'entrata in corso dalle ${saved.timbratoEntrata}. Ricordati di timbrare l'uscita.`, type: "warn" });
    }
  }, [username, nome]);

  function doRefresh() {
    setRefreshing(true);
    if (tab === "Ferie/ROL") { ProxyApi.ferieSaldo(username).then(setFerieSaldo); ProxyApi.ferieLettura(username).then(r => setFerieRichieste(Array.isArray(r) ? r : [])); }
    else if (tab === "Documenti") loadDocs();
    else if (tab === "Avvisi") loadComunicazioni(profilo);
    else if (tab === "turni") loadTurni();
    else if (tab === "timbra") ProxyApi.timbratureRead(username).then(r => setTimbrature(Array.isArray(r) ? r : []));
    else if (tab === "Home" || tab === "Informazioni") { loadTurni(); ProxyApi.timbratureRead(username).then(r => setTimbrature(Array.isArray(r) ? r : [])); }
    else if (tab === "profilo" || tab === "Contatti") { ProxyApi.profilo(username).then(setProfilo); ProxyApi.contatti().then(r => setContatti(parseContatti(r))); }
    else ProxyApi.profilo(username).then(setProfilo);
    setTimeout(() => setRefreshing(false), 1000);
  }

  async function doTimbraEntrata() {
    if (!timbraStruttura) { setTimbraMsg({ text: "⚠️ Seleziona una struttura prima di timbrare.", type: "warn" }); return; }
    const strut = strutture.find((s: any) => s.id === timbraStruttura);
    if (!strut) return;

    const now = new Date();
    const oggi = now.toISOString().split("T")[0];
    const turniOggi = turni.filter((t: any) => t.data === oggi);
    const minutiAttuali = now.getHours() * 60 + now.getMinutes();
    let turnoValido: any = null;
    let fuoriTurno = false;

    if (turniOggi.length > 0) {
      for (const t of turniOggi) {
        if (!t.oraInizio) continue;
        const [hi, mi] = t.oraInizio.split(":");
        const minutiInizio = parseInt(hi) * 60 + (parseInt(mi) || 0);
        let minutiFine = minutiInizio + 480;
        if (t.oraFine) {
          const [hf, mf] = t.oraFine.split(":");
          minutiFine = parseInt(hf) * 60 + (parseInt(mf) || 0);
        }
        if (minutiFine <= minutiInizio) minutiFine += 1440;
        const lo = minutiInizio - 29, hiLim = minutiFine + 29;
        if ((minutiAttuali >= lo && minutiAttuali <= hiLim) || (minutiAttuali + 1440 >= lo && minutiAttuali + 1440 <= hiLim)) { turnoValido = t; break; }
      }
      if (!turnoValido) fuoriTurno = true;
    } else {
      fuoriTurno = true;
    }

    if (fuoriTurno) {
      setTimbraFuoriTurno(true);
      setTimbraMsg({ text: "⚠️ Attenzione: stai timbrando fuori dal tuo turno previsto. Il turno dovrà essere approvato dall'ufficio del personale.", type: "warn" });
    } else {
      setTimbraFuoriTurno(false);
      setTimbraTurno(turnoValido);
    }

    if (!navigator.geolocation) { setTimbraMsg({ text: "❌ Il GPS non è disponibile su questo dispositivo.", type: "err" }); return; }
    setTimbraMsg({ text: "📡 Rilevamento posizione GPS...", type: "warn" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = distanzaMetri(pos.coords.latitude, pos.coords.longitude, strut.lat, strut.lng);
        if (dist > strut.raggio) { setTimbraMsg({ text: `❌ GPS non autorizzato. Sei a ${Math.round(dist)}m dalla struttura (max ${strut.raggio}m).`, type: "err" }); return; }
        const n2 = new Date();
        const ora = `${String(n2.getHours()).padStart(2, "0")}:${String(n2.getMinutes()).padStart(2, "0")}`;
        setTimbratoEntrata(ora);
        setTimbraEntrataFull(n2.toISOString());
        setTimbraStrutturaNome(strut.nome);
        setTimbraMsg({ text: `✅ Entrata registrata alle ${ora} — sei a ${Math.round(dist)}m dalla struttura.`, type: "ok" });
        salvaTimbraturaLocale(username, {
          timbratoEntrata: ora, timbraEntrataFull: n2.toISOString(),
          timbraStruttura, timbraStrutturaNome: strut.nome,
          timbraTurno: turnoValido, timbraFuoriTurno: fuoriTurno
        });
      },
      () => setTimbraMsg({ text: "❌ Impossibile rilevare la posizione GPS. Controlla i permessi.", type: "err" }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function doTimbraUscita() {
    if (!timbratoEntrata || !timbraEntrataFull) return;
    const strut = strutture.find((s: any) => s.id === timbraStruttura);
    if (!strut) return;
    setTimbraMsg({ text: "📡 Rilevamento posizione GPS...", type: "warn" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const dist = distanzaMetri(pos.coords.latitude, pos.coords.longitude, strut.lat, strut.lng);
        if (dist > strut.raggio) { setTimbraMsg({ text: `❌ GPS non autorizzato per l'uscita. Sei a ${Math.round(dist)}m.`, type: "err" }); return; }
        const now = new Date();
        const ora = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const oggi = now.toISOString().split("T")[0];
        const oreTotali = Math.round((now.getTime() - new Date(timbraEntrataFull).getTime()) / 36000) / 100;
        setTimbraMsg({ text: "⏳ Salvataggio in corso...", type: "warn" });
        try {
          await ProxyApi.timbra({
            nome, username, struttura: timbraStrutturaNome || strut.nome, data: oggi,
            oraEntrata: timbratoEntrata, oraUscita: ora, oreTotali,
            stato: timbraFuoriTurno ? "Fuori turno" : "Regolare",
            approvazione: timbraFuoriTurno ? "Necessaria approvazione" : "Regolare",
            turno: timbraTurno ? timbraTurno.tipo : "",
            lat: pos.coords.latitude, lng: pos.coords.longitude
          });
          setTimbraMsg({ text: `✅ Uscita registrata alle ${ora}. Ore lavorate: ${oreTotali.toFixed(2)}h`, type: "ok" });
          setTimbratoEntrata(null); setTimbraEntrataFull(null);
          pulisciTimbraturaLocale(username);
          ProxyApi.timbratureRead(username).then(r => setTimbrature(Array.isArray(r) ? r : []));
        } catch {
          setTimbraMsg({ text: "⚠️ Errore nel salvataggio dell'uscita. L'entrata resta attiva: riprova a timbrare l'uscita.", type: "warn" });
        }
      },
      () => setTimbraMsg({ text: "❌ Impossibile rilevare la posizione GPS.", type: "err" }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function setDimField<K extends keyof typeof dim>(k: K, v: string) { setDim(d => ({ ...d, [k]: v })); }
  async function inviaTimbraturaDimenticata() {
    if (!dim.data || !dim.struttura || !dim.entrata || !dim.uscita) {
      setDimMsg({ text: "⚠️ Compila data, struttura, ora entrata e ora uscita.", type: "err" });
      return;
    }
    const [he, me] = dim.entrata.split(":").map(Number);
    const [hu, mu0] = dim.uscita.split(":").map(Number);
    const minEntrata = he * 60 + me;
    let minUscita = hu * 60 + mu0;
    if (minUscita <= minEntrata) minUscita += 1440;
    const oreTotali = Math.round((minUscita - minEntrata) / 60 * 100) / 100;

    const ora = new Date();
    const entrataDt = new Date(`${dim.data}T${dim.entrata}:00`);
    const uscitaDt = new Date(entrataDt.getTime() + (minUscita - minEntrata) * 60000);
    if (entrataDt > ora) { setDimMsg({ text: "⚠️ L'orario di entrata non può essere nel futuro.", type: "err" }); return; }
    if (uscitaDt > ora) { setDimMsg({ text: "⚠️ Non puoi registrare un'uscita nel futuro: il turno non è ancora terminato.", type: "err" }); return; }

    setDimMsg({ text: "⏳ Invio in corso...", type: "warn" });
    try {
      await ProxyApi.timbra({
        nome, username, struttura: dim.struttura, data: dim.data,
        oraEntrata: dim.entrata, oraUscita: dim.uscita, oreTotali,
        stato: "Dimenticata", approvazione: "Necessaria approvazione", turno: "",
        note: dim.motivo ? `Timbratura dimenticata - ${dim.motivo}` : "Timbratura dimenticata",
        lat: null, lng: null
      });
      setDimOpen(false); setDimMsg(null);
      setDim({ data: "", struttura: "", entrata: "", uscita: "", motivo: "" });
      setTimbraMsg({ text: "✅ Timbratura inviata. In attesa di approvazione dell'ufficio del personale.", type: "ok" });
      ProxyApi.timbratureRead(username).then(r => setTimbrature(Array.isArray(r) ? r : []));
    } catch {
      setDimMsg({ text: "⚠️ Errore nell'invio. Riprova.", type: "err" });
    }
  }

  function setSegField<K extends keyof typeof SEG_DEFAULTS>(k: K, v: string) { setSeg(s => ({ ...s, [k]: v })); }
  async function inviaSegnalazione() {
    if (!seg.dataEvento || !seg.descrizione.trim() || !seg.tipoViolazione.trim()) {
      alert("Compila i campi obbligatori: data evento, descrizione, tipo di violazione.");
      return;
    }
    setSegBusy(true);
    await ProxyApi.segnalazione({
      numeroEvento: `AUTO-${Date.now()}`, ...seg, username, nome,
      areaSede: seg.areaSede || profilo?.struttura || ""
    });
    setSegBusy(false);
    setSegInviata(true);
    setSeg({ ...SEG_DEFAULTS });
  }

  async function submitTicket() {
    if (!ticket.titolo.trim() || !ticket.descrizione.trim()) { setTicketMsg("⚠️ Compila titolo e descrizione."); return; }
    setTicketBusy(true);
    setTicketMsg("⏳ Invio...");
    await ProxyApi.appTicket({ ...ticket, username, nome, ruolo: ruolo || "" });
    setTicketBusy(false);
    setTicketOpen(false);
    setTicket({ titolo: "", categoria: "Problema", descrizione: "" });
    alert("Segnalazione inviata. Grazie!");
  }

  const oggi = new Date().toISOString().split("T")[0];
  const turniFuturi = turni.filter((t: any) => t.data >= oggi).sort((a: any, b: any) => (a.data < b.data ? -1 : 1));
  const turniPassati = turni.filter((t: any) => t.data < oggi).sort((a: any, b: any) => (a.data > b.data ? -1 : 1));
  const prossimoTurno = turniFuturi[0];

  const oreSettimana = calcOreSettimana(timbrature);
  const oreMese = calcOreMese(timbrature);
  const orePreviste = calcOrePrevisteMese(turni);
  const oreResidue = Math.max(0, orePreviste - oreMese);

  const contattiPerStruttura: Record<string, any[]> = {};
  contatti.forEach((c: any) => {
    const s = c.struttura || "Tutte le strutture";
    if (!contattiPerStruttura[s]) contattiPerStruttura[s] = [];
    contattiPerStruttura[s].push(c);
  });

  function RefreshWheel() {
    return (
      <button onClick={doRefresh} aria-label="Aggiorna" style={{ background: "var(--white)", border: "1.5px solid var(--cyan-light)", borderRadius: "50%", width: 34, height: 34, minWidth: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="var(--teal)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={refreshing ? { animation: "spin 0.9s linear infinite", transformOrigin: "50% 50%" } : undefined}>
          <path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
        </svg>
      </button>
    );
  }

  const navTabItems: { id: DipTab; label: string }[] = [
    { id: "Home", label: "Home" },
    { id: "Ferie/ROL", label: "Ferie/ROL" },
    { id: "Informazioni", label: "Informazioni" },
  ];
  const bottomNavItems: { tab: DipTab; label: string; icon: keyof typeof NavIcons }[] = [
    { tab: "Home", label: "Home", icon: "home" },
    { tab: "timbra", label: "Timbra", icon: "timbra" },
    { tab: "turni", label: "Turni", icon: "turni" },
    { tab: "profilo", label: "Profilo", icon: "profilo" },
  ];

  return (
    <div className="app-screen">
      <div className="app-header">
        <div className="app-greeting">Buongiorno,<br />{firstName}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div onClick={() => { setTab("Avvisi"); setComSel(null); }} title="Comunicazioni" style={{ position: "relative", cursor: "pointer", color: "var(--teal)", display: "flex", alignItems: "center" }}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            {nUnread > 0 && <span className="nav-badge" style={{ position: "absolute", top: -5, right: -7 }}>{nUnread}</span>}
          </div>
          {(mansione || profilo?.mansione) && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)" }}>{mansione || profilo?.mansione}</div>}
          <div className="app-logo" style={{ cursor: "pointer" }} onClick={() => setTab("Contatti")} title="Contatti utili"><Logo /></div>
        </div>
      </div>

      {tab !== "Contatti" ? (
        <div style={{ padding: "0 1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div className="nav-tabs" style={{ flex: 1 }}>
              {navTabItems.map(n => (
                <div key={n.id} className={`nav-tab ${tab === n.id ? "active" : "inactive"}`} onClick={() => setTab(n.id)}>{n.label}</div>
              ))}
            </div>
            <RefreshWheel />
          </div>
        </div>
      ) : (
        <div style={{ padding: "0.5rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => setTab("Home")} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 800, color: "var(--teal)", cursor: "pointer", fontFamily: "Satoshi,sans-serif" }}>← Torna alla home</button>
          <RefreshWheel />
        </div>
      )}

      <div className="app-content">
        <RoleSwitchMini visible={showRoleSwitch} onClick={onShowRoleChooser} />

        {tab === "Home" && (
          <div>
            <div className="timbra-card-big" style={{ cursor: "pointer" }} onClick={() => setTab("timbra")}>
              <div className="timbra-card-big-orb"></div>
              <div className="timbra-card-big-title">Timbra</div>
              <div className="timbra-card-big-sub">Entrata - uscita</div>
            </div>
            <div className="dip-half-cards">
              <div className="dip-half-card" style={{ background: "var(--cyan)", cursor: "pointer" }} onClick={() => setTab("turni")}>
                <div className="dip-half-orb"></div>
                <div className="dip-half-label">I miei</div>
                <div className="dip-half-value">Turni</div>
              </div>
              <div className="dip-half-card" style={{ background: "var(--teal)", cursor: "pointer" }} onClick={() => setTab("profilo")}>
                <div className="dip-half-orb"></div>
                <div className="dip-half-label">Il mio</div>
                <div className="dip-half-value">Profilo</div>
              </div>
            </div>
            <div className="timbra-card-big" style={{ background: "var(--teal-dark)", minHeight: 90, cursor: "pointer" }} onClick={() => setTab("Documenti")}>
              <div className="timbra-card-big-orb"></div>
              <div className="timbra-card-big-title" style={{ fontSize: 22 }}>📄 Documenti</div>
              <div className="timbra-card-big-sub">Contratti · Buste paga · Certificati</div>
            </div>
          </div>
        )}

        {tab === "Informazioni" && (
          <div>
            <div className="stat-card">
              <div className="stat-card-orb"></div>
              <div className="stat-label">Ore lavorate questa settimana</div>
              <div className="stat-number">{oreSettimana.toFixed(1)}</div>
              <div className="stat-sub">{oreMese.toFixed(1)} ore questo mese</div>
            </div>
            <div className="stat-card" style={{ background: "var(--cyan)" }}>
              <div className="stat-card-orb"></div>
              <div className="stat-label">Ore residue questo mese</div>
              <div className="stat-number">{oreResidue.toFixed(1)}</div>
              <div className="stat-sub">{orePreviste.toFixed(1)} ore previste totali</div>
            </div>
            <div className="stat-card" style={{ background: "var(--coral)" }}>
              <div className="stat-card-orb"></div>
              <div className="stat-label">Prossimo turno</div>
              {prossimoTurno ? (
                <>
                  <div className="stat-number" style={{ fontSize: 28 }}>{fmtDateIt(prossimoTurno.data)}</div>
                  <div className="stat-sub">{prossimoTurno.tipo} · {prossimoTurno.oraInizio} — {prossimoTurno.oraFine} · {prossimoTurno.struttura}</div>
                </>
              ) : (
                <>
                  <div className="stat-number" style={{ fontSize: 28 }}>—</div>
                  <div className="stat-sub">Nessun turno programmato</div>
                </>
              )}
            </div>
          </div>
        )}

        {tab === "Contatti" && (
          <div>
            {contatti.length === 0 ? (
              <div className="timbra-card"><div style={{ textAlign: "center", padding: "1rem", color: "var(--text-light)", fontWeight: 700 }}>Caricamento contatti...</div></div>
            ) : (
              <>
                <div className="section-label"><div className="section-title">Contatti utili</div></div>
                {Object.entries(contattiPerStruttura).map(([struttura, lista]) => (
                  <div key={struttura}>
                    {struttura !== "Tutte le strutture" && (
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: 0.5, margin: "1rem 0 0.5rem" }}>{struttura}</div>
                    )}
                    <div className="ana-card" style={{ marginBottom: "0.75rem" }}>
                      {lista.map((c: any, i: number) => (
                        <div key={i} style={{ padding: "1rem", borderBottom: "1px solid var(--bg)" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-dark)" }}>{c.nome}</div>
                              <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 600 }}>{c.ruolo || ""}</div>
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              {c.email && <a href={`mailto:${c.email}`} style={{ width: 36, height: 36, background: "var(--teal)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 16 }}>✉️</a>}
                              {c.telefono && <a href={`tel:${c.telefono}`} style={{ width: 36, height: 36, background: "var(--cyan)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 16 }}>📞</a>}
                            </div>
                          </div>
                          {c.email && <div style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600 }}>{c.email}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === "timbra" && (
          <div>
            <div className="timbra-card">
              <div className="timbra-title">Seleziona struttura</div>
              <select className="struttura-select" value={timbraStruttura} onChange={e => setTimbraStruttura(e.target.value)}>
                {strutture.length === 0
                  ? <option value="">⏳ Caricamento strutture...</option>
                  : <>
                    <option value="">-- Seleziona struttura --</option>
                    {strutture.map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </>
                }
              </select>
              {!timbratoEntrata
                ? <button className="timbra-btn entrata" onClick={doTimbraEntrata}>⏱ Timbra Entrata</button>
                : <>
                  <div style={{ background: "var(--cyan-light)", borderRadius: "var(--radius-sm)", padding: "1rem", marginBottom: "1rem" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--teal)", textTransform: "uppercase" }}>Entrata registrata</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "var(--teal-dark)" }}>{timbratoEntrata}</div>
                    <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 600 }}>{timbraStrutturaNome || ""}</div>
                  </div>
                  <button className="timbra-btn uscita" onClick={doTimbraUscita}>🔴 Timbra Uscita</button>
                </>
              }
              {timbraMsg && <div className={`timbra-status ${timbraMsg.type}`}>{timbraMsg.text}</div>}
            </div>

            <div className="timbra-card">
              {!dimOpen ? (
                <button className="dim-toggle" onClick={() => { setDimOpen(true); setDimMsg(null); setDim({ data: oggiISO(), struttura: "", entrata: "", uscita: "", motivo: "" }); }}>🕓 Ho dimenticato di timbrare</button>
              ) : (
                <>
                  <div className="timbra-title">Timbratura dimenticata</div>
                  <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 700, marginBottom: "0.75rem" }}>Inserisci gli orari reali. La timbratura verrà inviata all'ufficio del personale per l'approvazione.</div>
                  <label className="dim-lbl">Data</label>
                  <input type="date" className="dim-in" max={oggiISO()} value={dim.data} onChange={e => setDimField("data", e.target.value)} />
                  <label className="dim-lbl">Struttura</label>
                  <select className="dim-in" value={dim.struttura} onChange={e => setDimField("struttura", e.target.value)}>
                    <option value="">-- Seleziona struttura --</option>
                    {strutture.map((s: any) => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                  </select>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <div style={{ flex: 1 }}><label className="dim-lbl">Ora entrata</label><input type="time" className="dim-in" value={dim.entrata} onChange={e => setDimField("entrata", e.target.value)} /></div>
                    <div style={{ flex: 1 }}><label className="dim-lbl">Ora uscita</label><input type="time" className="dim-in" value={dim.uscita} onChange={e => setDimField("uscita", e.target.value)} /></div>
                  </div>
                  <label className="dim-lbl">Motivo (facoltativo)</label>
                  <input type="text" className="dim-in" placeholder="Es. dimenticanza, problema GPS..." value={dim.motivo} onChange={e => setDimField("motivo", e.target.value)} />
                  {dimMsg && <div className={`timbra-status ${dimMsg.type}`}>{dimMsg.text}</div>}
                  <button className="timbra-btn entrata" style={{ marginTop: "0.5rem" }} onClick={inviaTimbraturaDimenticata}>📤 Invia per approvazione</button>
                  <button className="dim-cancel" onClick={() => { setDimOpen(false); setDimMsg(null); }}>Annulla</button>
                </>
              )}
            </div>

            <div className="timbra-card">
              <div className="timbra-title">Ultime timbrature</div>
              {(() => {
                const ultime = timbrature.slice().sort((a: any, b: any) => (a.data > b.data ? -1 : 1)).slice(0, 5);
                if (ultime.length === 0) return <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-light)", fontSize: 13, fontWeight: 700 }}>Nessuna timbratura recente</div>;
                return ultime.map((tb: any, i: number) => {
                  const isRifiutata = tb.approvazione === "Rifiutata" || tb.approvazione === "Rifiutato";
                  const appBg = tb.approvazione === "Necessaria approvazione" ? "#FEF3CD" : isRifiutata ? "#FCE4E4" : "#D5F0E0";
                  const appCol = tb.approvazione === "Necessaria approvazione" ? "#7A5800" : isRifiutata ? "#7A1A1A" : "#1A6B3A";
                  const appLabel = tb.approvazione === "Necessaria approvazione" ? "⏳ In attesa di approvazione" : tb.approvazione === "Approvata" ? "✅ Approvata" : isRifiutata ? "❌ Rifiutato" : "✅ Regolare";
                  return (
                    <div className="ana-row" key={i}>
                      <div style={{ flex: 1 }}>
                        <div className="ana-label">{fmtDateIt(tb.data)} · {tb.struttura || "—"}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--teal)" }}>🕐 {tb.oraEntrata || "—"} → {tb.oraUscita || "—"}</div>
                        <div style={{ marginTop: 4, display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800, background: appBg, color: appCol }}>{appLabel}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "var(--teal-dark)", marginLeft: 8 }}>{tb.oreTotali > 0 ? `${Number(tb.oreTotali).toFixed(2)}h` : "—"}</div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {tab === "turni" && (
          turniLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "40vh", flexDirection: "column", gap: "1rem" }}>
              <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></div>
              <div style={{ color: "#7A9999", fontWeight: 700, fontSize: 14 }}>Caricamento turni...</div>
            </div>
          ) : (
          <div>
            {turni.length === 0 ? (
              <div className="timbra-card"><div style={{ textAlign: "center", padding: "1rem", color: "var(--text-light)", fontWeight: 700 }}>Nessun turno trovato</div></div>
            ) : (
              <>
                {prossimoTurno && (
                  <div className="stat-card" style={{ background: "var(--coral)" }}>
                    <div className="stat-card-orb"></div>
                    <div className="stat-label">Prossimo turno</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "white" }}>{fmtDateIt(prossimoTurno.data)} — {prossimoTurno.tipo}</div>
                    <div className="stat-sub">🕐 {prossimoTurno.oraInizio} — {prossimoTurno.oraFine} · {prossimoTurno.struttura}</div>
                  </div>
                )}
                <div className="section-label"><div className="section-title">Turni in programma</div></div>
                {turniFuturi.length === 0
                  ? <div className="timbra-card"><div style={{ textAlign: "center", padding: "1rem", color: "var(--text-light)", fontWeight: 700 }}>Nessun turno in programma</div></div>
                  : turniFuturi.map((t: any, i: number) => (
                    <div className="turno-card" key={i}>
                      <div className="turno-data">{fmtDateIt(t.data)}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div className="turno-tipo">{t.tipo}</div>
                        <span className={`turno-badge turno-${String(t.tipo).toLowerCase()}`}>{t.tipo}</span>
                      </div>
                      <div className="turno-orari">🕐 {t.oraInizio} — {t.oraFine}</div>
                      <div className="turno-struttura">📍 {t.struttura}</div>
                    </div>
                  ))
                }
                {turniPassati.length > 0 && (
                  <>
                    <button className="turni-past-btn" onClick={() => setShowPastTurni(s => !s)}>
                      {showPastTurni ? "▲ Nascondi turni passati" : `▼ Mostra turni passati (${turniPassati.length})`}
                    </button>
                    {showPastTurni && turniPassati.map((t: any, i: number) => (
                      <div className="turno-card" style={{ opacity: 0.6 }} key={i}>
                        <div className="turno-data">{fmtDateIt(t.data)}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div className="turno-tipo">{t.tipo}</div>
                          <span className={`turno-badge turno-${String(t.tipo).toLowerCase()}`}>{t.tipo}</span>
                        </div>
                        <div className="turno-orari">🕐 {t.oraInizio} — {t.oraFine}</div>
                        <div className="turno-struttura">📍 {t.struttura}</div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
          )
        )}

        {tab === "Ferie/ROL" && (
          <div>
            <div className="dip-half-cards">
              <div className="dip-half-card" style={{ background: "var(--teal-dark)", minHeight: 130 }}>
                <div className="dip-half-orb"></div>
                <div className="dip-half-value" style={{ fontSize: 38 }}>{ferieSaldo?.ferieResidue ?? "—"}</div>
                <div className="dip-half-label">Ferie residue (ore)</div>
              </div>
              <div className="dip-half-card" style={{ background: "var(--teal)", minHeight: 130 }}>
                <div className="dip-half-orb"></div>
                <div className="dip-half-value" style={{ fontSize: 38 }}>{ferieSaldo?.rolResidue ?? "—"}</div>
                <div className="dip-half-label">ROL residue (ore)</div>
              </div>
            </div>

            {ferieSaldo && (
              <div className="ana-card" style={{ marginBottom: "0.75rem" }}>
                <div className="ana-row"><div className="ana-label">Ferie maturate</div><div className="ana-value">{ferieSaldo.ferieMaturate}h</div></div>
                <div className="ana-row"><div className="ana-label">Ferie godute</div><div className="ana-value">{ferieSaldo.ferieGodute}h</div></div>
                <div className="ana-row"><div className="ana-label">ROL maturate</div><div className="ana-value">{ferieSaldo.rolMaturate}h</div></div>
                <div className="ana-row"><div className="ana-label">ROL godute</div><div className="ana-value">{ferieSaldo.rolGodute}h</div></div>
                {(ferieSaldo.ferieMensile != null || ferieSaldo.rolMensile != null) && (
                  <div className="ana-row">
                    <div className="ana-label">Maturazione mensile</div>
                    <div className="ana-value" style={{ fontSize: 12 }}>
                      {ferieSaldo.ferieMensile != null ? `${ferieSaldo.ferieMensile}h ferie` : ""}
                      {ferieSaldo.rolMensile != null ? ` · ${ferieSaldo.rolMensile}h ROL` : ""}
                    </div>
                  </div>
                )}
                {ferieSaldo.percentuale != null && ferieSaldo.percentuale < 100 && (
                  <div className="ana-row">
                    <div className="ana-label">Contratto</div>
                    <div className="ana-value" style={{ fontSize: 12 }}>{ferieSaldo.oreSettimanali != null ? `${ferieSaldo.oreSettimanali}h/sett · ` : ""}{ferieSaldo.percentuale}% del full-time</div>
                  </div>
                )}
              </div>
            )}

            {!ferieForm
              ? <div className="dip-half-cards">
                <div className="dip-half-card" style={{ background: "var(--cyan)", cursor: "pointer" }} onClick={() => setFerieForm("Ferie")}>
                  <div className="dip-half-orb"></div><div className="dip-half-label">Nuova richiesta</div><div className="dip-half-value" style={{ fontSize: 22 }}>Ferie</div>
                </div>
                <div className="dip-half-card" style={{ background: "var(--coral)", cursor: "pointer" }} onClick={() => setFerieForm("ROL")}>
                  <div className="dip-half-orb"></div><div className="dip-half-label">Nuova richiesta</div><div className="dip-half-value" style={{ fontSize: 22 }}>ROL</div>
                </div>
              </div>
              : <div className="timbra-card">
                <div className="timbra-title">Nuova richiesta {ferieForm}</div>
                <label className="field-label">Data inizio</label>
                <input type="date" className="struttura-select" style={{ marginBottom: "0.75rem" }} value={ferieInput.inizio} onChange={e => setFerieInput(f => ({ ...f, inizio: e.target.value }))} />
                <label className="field-label">Data fine</label>
                <input type="date" className="struttura-select" style={{ marginBottom: "0.75rem" }} value={ferieInput.fine} onChange={e => setFerieInput(f => ({ ...f, fine: e.target.value }))} />
                <label className="field-label">Ore richieste</label>
                <input type="number" className="struttura-select" placeholder="Es: 8" style={{ marginBottom: "0.75rem" }} value={ferieInput.ore} onChange={e => setFerieInput(f => ({ ...f, ore: e.target.value }))} />
                <label className="field-label">Note (opzionale)</label>
                <input type="text" className="struttura-select" placeholder="Motivazione..." style={{ marginBottom: "1rem" }} value={ferieInput.note} onChange={e => setFerieInput(f => ({ ...f, note: e.target.value }))} />
                <button className="timbra-btn entrata" onClick={async () => {
                  try {
                    await ProxyApi.ferieRichiesta({ username, nome, tipo: ferieForm, dataInizio: ferieInput.inizio, dataFine: ferieInput.fine || ferieInput.inizio, oreRichieste: ferieInput.ore, note: ferieInput.note });
                    setFerieForm(null); setFerieInput({ inizio: "", fine: "", ore: "", note: "" });
                    ProxyApi.ferieLettura(username).then(r => setFerieRichieste(Array.isArray(r) ? r : []));
                  } catch (e: any) {
                    alert(e?.message || "Errore nell'invio della richiesta. Riprova.");
                  }
                }}>📤 Invia richiesta</button>
                <button className="timbra-btn uscita" style={{ marginTop: "0.5rem" }} onClick={() => setFerieForm(null)}>Annulla</button>
              </div>
            }

            <div className="section-label"><div className="section-title">Le mie richieste</div></div>
            {ferieRichieste.length === 0 ? (
              <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessuna richiesta inviata</div>
            ) : (
              <div className="ana-card">
                {ferieRichieste.map((r: any, i: number) => (
                  <div key={i} style={{ padding: "1rem", borderBottom: "1px solid var(--bg)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-dark)" }}>{r.tipo} · {r.oreRichieste}h</div>
                      <div style={{ padding: "2px 10px", borderRadius: 10, fontSize: 10, fontWeight: 800, background: r.stato === "Approvata" ? "#D5F0E0" : r.stato === "Rifiutata" ? "#FCE4E4" : "#FEF3CD", color: r.stato === "Approvata" ? "#1A6B3A" : r.stato === "Rifiutata" ? "#7A1A1A" : "#7A5800" }}>{r.stato}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 600 }}>{fmtDateIt(r.dataInizio)}{r.dataFine && r.dataFine !== r.dataInizio ? ` → ${fmtDateIt(r.dataFine)}` : ""}</div>
                    {r.noteAdmin && <div style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600, marginTop: 4 }}>📝 {r.noteAdmin}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "Avvisi" && !comSel && (
          <div>
            <div className="section-label"><div className="section-title">Comunicazioni</div></div>
            {comunicazioni.length === 0
              ? <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessuna comunicazione</div>
              : comunicazioni.map((c: any, i: number) => (
                <div className="ana-card" key={i} style={{ padding: "0.85rem 1rem", marginBottom: "0.5rem", cursor: "pointer", borderLeft: !c.letto ? "4px solid var(--teal)" : "none" }}
                  onClick={() => {
                    setComSel(c);
                    if (!c.letto) ProxyApi.comunicazioneLetta(c.id, username, nome).then(() => loadComunicazioni(profilo));
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontSize: 14, fontWeight: c.letto ? 700 : 900, color: "var(--text-dark)" }}>{!c.letto ? "🔵 " : ""}{c.titolo || "(senza titolo)"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-light)" }}>{fmtDateIt(c.dataInvio)}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-mid)", marginTop: 3 }}>{(c.messaggio || "").slice(0, 80)}{(c.messaggio || "").length > 80 ? "…" : ""}</div>
                  {(c.allegatoNome || c.linkAllegato) && <div style={{ fontSize: 11, color: "var(--teal)", fontWeight: 700, marginTop: 3 }}>📎 Allegato</div>}
                </div>
              ))
            }
          </div>
        )}

        {tab === "Avvisi" && comSel && (
          <div>
            <button onClick={() => setComSel(null)} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 800, color: "var(--teal)", cursor: "pointer", fontFamily: "Satoshi,sans-serif", marginBottom: "0.5rem" }}>← Indietro</button>
            <div className="ana-card" style={{ padding: "1rem" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text-dark)" }}>{comSel.titolo || ""}</div>
              <div style={{ fontSize: 11, color: "var(--text-light)", margin: "4px 0 10px" }}>{fmtDateIt(comSel.dataInvio)} · da {comSel.mittente || "ufficio personale"}</div>
              <div style={{ fontSize: 14, color: "var(--text-mid)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{comSel.messaggio || ""}</div>
              {comSel.allegatoUrl
                ? <div style={{ marginTop: 12 }}><a href={comSel.allegatoUrl} target="_blank" rel="noreferrer" className="ts-save" style={{ display: "inline-block", textDecoration: "none", padding: "0.6rem 1rem" }}>📎 Scarica {comSel.allegatoNome || "allegato"}</a></div>
                : comSel.allegatoNome && <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-light)" }}>📎 {comSel.allegatoNome}</div>
              }
              {comSel.linkAllegato && <div style={{ marginTop: 10 }}><a href={comSel.linkAllegato} target="_blank" rel="noreferrer" style={{ color: "var(--teal)", fontWeight: 700 }}>🔗 Apri link allegato</a></div>}
            </div>
          </div>
        )}

        {tab === "Documenti" && (
          <div>
            <div className="section-label"><div className="section-title">I miei documenti</div></div>
            {docsLoading ? (
              <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)" }}>Caricamento...</div>
            ) : docs.length === 0 ? (
              <div className="ana-card" style={{ padding: "1.2rem", textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>Nessun documento disponibile</div>
            ) : docs.map((d: any, i: number) => {
              const titolo = d.titolo || d.tipo || "Documento";
              const link = d.allegatoUrl || d.linkAllegato;
              return (
                <div className="ana-card" key={i} style={{ padding: "0.85rem 1rem", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-dark)" }}>{titolo}</div>
                    <div style={{ fontSize: 11, color: "var(--text-light)" }}>{fmtDateIt(d.dataCaricamento)}</div>
                  </div>
                  {d.tipo && d.tipo !== titolo && <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 1 }}>{d.tipo}</div>}
                  {d.allegatoNome && <div style={{ fontSize: 12, color: "var(--text-mid)", marginTop: 2 }}>{d.allegatoNome}</div>}
                  {d.note && <div style={{ fontSize: 12, color: "var(--text-light)", marginTop: 2 }}>{d.note}</div>}
                  {link && <div style={{ marginTop: 6 }}><a href={link} target="_blank" rel="noreferrer" style={{ color: "var(--teal)", fontWeight: 700, fontSize: 13 }}>📎 Apri / scarica</a></div>}
                  {d.caricatoDa && <div style={{ fontSize: 10, color: "var(--text-light)", marginTop: 4 }}>Caricato da {d.caricatoDa}</div>}
                </div>
              );
            })}
          </div>
        )}

        {tab === "profilo" && (
          <div>
            <div className="stat-card">
              <div className="stat-card-orb"></div>
              <div className="stat-label">Nome completo</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "white" }}>{profilo ? `${profilo.nome} ${profilo.cognome}` : nome}</div>
              <div className="stat-sub">{profilo?.mansione || ruolo || "Dipendente"}</div>
            </div>
            {!profilo ? (
              <div className="timbra-card"><div style={{ textAlign: "center", padding: "1rem", color: "var(--text-light)", fontWeight: 700 }}>Caricamento profilo...</div></div>
            ) : (
              <>
                <div className="ana-card">
                  <div className="ana-row"><div className="ana-label">Mansione</div><div className="ana-value">{profilo.mansione || "—"}</div></div>
                  <div className="ana-row"><div className="ana-label">Tipo contratto</div><div className="ana-value">{profilo.contratto || "—"}</div></div>
                  <div className="ana-row"><div className="ana-label">Struttura</div><div className="ana-value">{profilo.struttura || "—"}</div></div>
                </div>
                <div className="ana-card">
                  <div className="ana-row"><div className="ana-label">Email</div><div className="ana-value" style={{ fontSize: 12 }}>{profilo.email || "—"}</div></div>
                  <div className="ana-row"><div className="ana-label">Telefono</div><div className="ana-value">{profilo.telefono || "—"}</div></div>
                </div>
                <div className="ana-card">
                  <div className="ana-row"><div className="ana-label">Codice fiscale</div><div className="ana-value" style={{ fontSize: 12 }}>{profilo.cf || "—"}</div></div>
                  <div className="ana-row"><div className="ana-label">Data di nascita</div><div className="ana-value">{profilo.nascita ? fmtDateIt(profilo.nascita) : "—"}</div></div>
                </div>
              </>
            )}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button onClick={() => setTicketOpen(true)} style={{ flex: 1, background: "white", border: "1.5px solid var(--cyan-light)", borderRadius: 12, padding: "0.6rem 0.4rem", fontSize: 12, fontWeight: 800, color: "var(--teal-dark)", cursor: "pointer", fontFamily: "Satoshi,sans-serif" }}>🛠️ Segnala un problema</button>
              <button onClick={() => setTab("segnalazione")} style={{ flex: 1, background: "white", border: "1.5px solid var(--coral)", borderRadius: 12, padding: "0.6rem 0.4rem", fontSize: 12, fontWeight: 800, color: "var(--coral)", cursor: "pointer", fontFamily: "Satoshi,sans-serif" }}>⚠️ Segnala evento</button>
            </div>
          </div>
        )}

        {tab === "segnalazione" && segInviata && (
          <div>
            <div className="stat-card" style={{ background: "var(--teal)" }}>
              <div className="stat-card-orb"></div>
              <div className="stat-label">Segnalazione inviata</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "white" }}>✅ Ricevuta</div>
              <div className="stat-sub">Il responsabile privacy è stato notificato. Conserva copia della segnalazione.</div>
            </div>
            <button className="update-btn" onClick={() => setSegInviata(false)}>Nuova segnalazione</button>
          </div>
        )}

        {tab === "segnalazione" && !segInviata && (
          <div className="timbra-card">
            <div style={{ background: "#FCE4E4", borderRadius: "var(--radius-sm)", padding: "0.75rem", marginBottom: "1rem", fontSize: 13, fontWeight: 700, color: "#7A1A1A" }}>
              ⚠️ Usa questo modulo per segnalare eventi, incidenti o data breach. La segnalazione sarà registrata nel sistema privacy aziendale.
            </div>

            <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-dark)", marginBottom: "0.75rem" }}>Sezione 1 — Segnalazione evento</div>
            <label className="field-label">Data in cui si è verificato l'evento *</label>
            <input type="date" className="struttura-select" style={{ marginBottom: "0.75rem" }} value={seg.dataEvento} onChange={e => setSegField("dataEvento", e.target.value)} />
            <label className="field-label">Area e sede</label>
            <input type="text" className="struttura-select" style={{ marginBottom: "0.75rem" }} placeholder={profilo?.struttura || "Es: Struttura 1"} value={seg.areaSede} onChange={e => setSegField("areaSede", e.target.value)} />
            <label className="field-label">Descrizione dell'evento *</label>
            <textarea className="struttura-select" rows={4} style={{ marginBottom: "0.75rem", resize: "none", height: 100 }} placeholder="Descrivi dettagliatamente l'evento, includendo documenti/dati coinvolti..." value={seg.descrizione} onChange={e => setSegField("descrizione", e.target.value)} />
            <label className="field-label">Tipo di violazione *</label>
            <input type="text" className="struttura-select" style={{ marginBottom: "0.75rem" }} placeholder="Es: accesso non autorizzato, perdita dati..." value={seg.tipoViolazione} onChange={e => setSegField("tipoViolazione", e.target.value)} />
            <label className="field-label">Origine dell'evento</label>
            <select className="struttura-select" style={{ marginBottom: "0.75rem" }} value={seg.origine} onChange={e => setSegField("origine", e.target.value)}>
              <option value="">-- Seleziona --</option><option>Interna</option><option>Esterna</option>
            </select>
            <label className="field-label">Causa della violazione</label>
            <select className="struttura-select" style={{ marginBottom: "0.75rem" }} value={seg.causa} onChange={e => setSegField("causa", e.target.value)}>
              <option value="">-- Seleziona --</option><option>Azione intenzionale</option><option>Azione accidentale</option><option>Sconosciuta</option><option>Altro</option>
            </select>
            <label className="field-label">Soggetti testimoni</label>
            <input type="text" className="struttura-select" style={{ marginBottom: "0.75rem" }} placeholder="Nessuno / Segnalante / Altri..." value={seg.testimoni} onChange={e => setSegField("testimoni", e.target.value)} />
            <label className="field-label">Informazioni aziendali coinvolte</label>
            <select className="struttura-select" style={{ marginBottom: "0.5rem" }} value={seg.infoAziendali} onChange={e => setSegField("infoAziendali", e.target.value)}>
              <option value="No">No</option><option value="Sì">Sì</option>
            </select>
            <input type="text" className="struttura-select" style={{ marginBottom: "0.75rem" }} placeholder="Se sì, specificare quali..." value={seg.infoDettaglio} onChange={e => setSegField("infoDettaglio", e.target.value)} />
            <label className="field-label">Dati personali coinvolti</label>
            <select className="struttura-select" style={{ marginBottom: "0.75rem" }} value={seg.datiPersonali} onChange={e => setSegField("datiPersonali", e.target.value)}>
              <option value="No">No</option><option value="Sì">Sì</option>
            </select>
            <label className="field-label">Soggetti, risorse e asset coinvolti</label>
            <input type="text" className="struttura-select" style={{ marginBottom: "0.75rem" }} placeholder="Es: PC, cartelle, sistemi IT..." value={seg.asset} onChange={e => setSegField("asset", e.target.value)} />
            <label className="field-label">Responsabile degli asset coinvolti</label>
            <input type="text" className="struttura-select" style={{ marginBottom: "0.75rem" }} placeholder="Nome responsabile..." value={seg.responsabileAsset} onChange={e => setSegField("responsabileAsset", e.target.value)} />
            <label className="field-label">Misure di sicurezza esistenti</label>
            <input type="text" className="struttura-select" style={{ marginBottom: "1rem" }} placeholder="Se note..." value={seg.misure} onChange={e => setSegField("misure", e.target.value)} />

            <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-dark)", marginBottom: "0.5rem" }}>Sezione Data Breach</div>
            <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 600, marginBottom: "0.75rem" }}>Compila solo se l'evento ha coinvolto dati personali</div>
            <label className="field-label">È un data breach?</label>
            <select className="struttura-select" style={{ marginBottom: "0.75rem" }} value={seg.dataBreach} onChange={e => setSegField("dataBreach", e.target.value)}>
              <option value="No">No</option><option value="Sì">Sì</option>
            </select>
            <label className="field-label">Categoria data breach</label>
            <select className="struttura-select" style={{ marginBottom: "0.75rem" }} value={seg.categoriaDb} onChange={e => setSegField("categoriaDb", e.target.value)}>
              <option value="">-- Seleziona --</option><option>Confidentiality breach</option><option>Availability breach</option><option>Integrity breach</option>
            </select>
            <label className="field-label">Categorie di dati personali coinvolti</label>
            <input type="text" className="struttura-select" style={{ marginBottom: "0.75rem" }} placeholder="Es: anagrafici, sanitari, contatti..." value={seg.categorieDati} onChange={e => setSegField("categorieDati", e.target.value)} />
            <label className="field-label">Quantità di dati coinvolti</label>
            <input type="text" className="struttura-select" style={{ marginBottom: "0.75rem" }} placeholder="Se nota..." value={seg.quantita} onChange={e => setSegField("quantita", e.target.value)} />
            <label className="field-label">Categorie di interessati coinvolti</label>
            <input type="text" className="struttura-select" style={{ marginBottom: "0.75rem" }} placeholder="Es: pazienti, dipendenti..." value={seg.interessati} onChange={e => setSegField("interessati", e.target.value)} />
            <label className="field-label">Danni causati agli interessati</label>
            <input type="text" className="struttura-select" style={{ marginBottom: "1rem" }} placeholder="Se noti..." value={seg.danni} onChange={e => setSegField("danni", e.target.value)} />

            <button className="timbra-btn entrata" disabled={segBusy} onClick={inviaSegnalazione}>{segBusy ? "Invio..." : "📤 Invia segnalazione"}</button>
            <button className="timbra-btn uscita" style={{ marginTop: "0.5rem" }} onClick={() => setTab("Home")}>Annulla</button>
          </div>
        )}
      </div>

      {ticketOpen && (
        <div className="gpt-modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setTicketOpen(false); }}>
          <div className="gpt-modal">
            <div className="gpt-modal-title">Segnala un problema dell'app</div>
            <div style={{ fontSize: 12, color: "var(--text-light)", marginBottom: "0.6rem" }}>Descrivi il bug o il problema: la segnalazione arriverà a chi gestisce l'applicazione.</div>
            <label className="dim-lbl">Titolo</label>
            <input className="gpt-mini-input" placeholder="es. Non riesco a timbrare" value={ticket.titolo} onChange={e => setTicket(t => ({ ...t, titolo: e.target.value }))} />
            <label className="dim-lbl">Categoria</label>
            <select className="gpt-mini-input" value={ticket.categoria} onChange={e => setTicket(t => ({ ...t, categoria: e.target.value }))}>
              <option>Bug</option><option>Problema</option><option>Suggerimento</option>
            </select>
            <label className="dim-lbl">Descrizione</label>
            <textarea className="gpt-mini-input" rows={4} placeholder="Cosa è successo, in quale schermata, cosa ti aspettavi..." value={ticket.descrizione} onChange={e => setTicket(t => ({ ...t, descrizione: e.target.value }))} />
            {ticketMsg && <div style={{ fontSize: 13, fontWeight: 700, color: "var(--coral)", margin: "4px 0" }}>{ticketMsg}</div>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
              <button className="ts-save" disabled={ticketBusy} onClick={submitTicket}>{ticketBusy ? "Invio..." : "Invia segnalazione"}</button>
              <button className="ts-cancel" onClick={() => setTicketOpen(false)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      <div className="bottom-nav">
        {bottomNavItems.map(n => (
          <div key={n.tab} className={`bnav-item ${tab === n.tab ? "active" : ""}`} onClick={() => { setTab(n.tab); setComSel(null); }}>
            <div className="bnav-icon">{NavIcons[n.icon]}</div>
            <div className="bnav-label">{n.label}</div>
          </div>
        ))}
        <div className="bnav-item" onClick={onLogout}><div className="bnav-icon">{NavIcons.logout}</div><div className="bnav-label">Esci</div></div>
      </div>
    </div>
  );
}
