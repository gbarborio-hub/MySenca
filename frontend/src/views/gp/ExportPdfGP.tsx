import { useState } from "react";
import { ProxyApi } from "../../services/ProxyApi.js";
import {
  calcMaggiorazioni, isFestivo, dowIt, minToH, fmtGenNow, fmtDateIt,
  expMonthDefault, expRange, type ExpRange
} from "./exportPdfHelpers.js";

interface Props {
  dipendente: any; // GP_DIP_DETAIL: nome, cognome, username, mansione, matricola, struttura
}

async function loadPdfLibs() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable")
  ]);
  return { jsPDF, autoTable };
}

function expHeader(doc: any, titolo: string, rg: ExpRange, dip: any): number {
  const mesi = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("Senca Senior Care", 40, 40);
  doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.text(titolo, 40, 60);
  doc.setFontSize(10);
  doc.text(`Dipendente: ${`${dip.nome || ""} ${dip.cognome || ""}`.trim() || "—"}`, 40, 78);
  doc.text(`Qualifica: ${dip.mansione || "—"}${dip.matricola ? `      Matricola: ${dip.matricola}` : ""}`, 40, 92);
  doc.text(`Periodo: ${mesi[rg.m - 1]} ${rg.y}`, 40, 106);
  return 122;
}
function expFooter(doc: any, label?: string) {
  const ph = doc.internal.pageSize.getHeight();
  doc.setFontSize(8); doc.setFont("helvetica", "italic");
  doc.text(`${label || "Documento generato il"} ${fmtGenNow()}`, 40, ph - 24);
}

async function ensureData(dip: any, rg: ExpRange) {
  const [timbRaw, ferieRaw] = await Promise.all([
    ProxyApi.gpTimbrature({ username: dip.username || "", includeDeleted: true, dateFrom: rg.from, dateTo: rg.to }).catch(() => []),
    ProxyApi.ferieLettura(dip.username || "").catch(() => [])
  ]);
  return { timb: Array.isArray(timbRaw) ? timbRaw : [], ferie: Array.isArray(ferieRaw) ? ferieRaw : [] };
}

export default function ExportPdfGP({ dipendente }: Props) {
  const [mese, setMese] = useState(expMonthDefault());
  const strutture = String(dipendente.struttura || "").split(",").map((s: string) => s.trim()).filter(Boolean);
  const [struttura, setStruttura] = useState(strutture[0] || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!dipendente.username) {
    return (
      <div>
        <div className="section-label"><div className="section-title">Esporta riepiloghi (PDF)</div></div>
        <div className="ana-card" style={{ padding: "1rem", textAlign: "center", color: "var(--text-light)", fontWeight: 700 }}>
          Questo dipendente non ha uno Username associato: impossibile generare i riepiloghi. Imposta lo Username dal pannello Admin → Da abilitare.
        </div>
      </div>
    );
  }

  async function run(fn: () => Promise<void>) {
    setErr(null); setBusy(true);
    try { await fn(); } catch (e: any) { setErr(e?.message || "Errore nella generazione del PDF."); }
    setBusy(false);
  }

  async function expPerStruttura() {
    await run(async () => {
      const rg = expRange(mese);
      const data = await ensureData(dipendente, rg);
      const pad = (n: number) => String(n).padStart(2, "0");
      const rows: string[][] = [];
      let totMin = 0;
      for (let day = 1; day <= rg.last; day++) {
        const ds = `${rg.y}-${pad(rg.m)}-${pad(day)}`;
        const dayT = data.timb.filter((t: any) =>
          String(t.data).split("T")[0] === ds && !t.eliminata &&
          (t.approvazione === "Regolare" || t.approvazione === "Approvata") &&
          (!struttura || t.struttura === struttura)
        );
        if (!dayT.length) continue;
        dayT.sort((a: any, b: any) => ((a.oraEntrata || "") < (b.oraEntrata || "") ? -1 : 1));
        const stamps: string[] = [];
        let dayMin = 0;
        for (const t of dayT) {
          if (t.oraEntrata) stamps.push(`E ${t.oraEntrata}`);
          if (t.oraUscita) stamps.push(`U ${t.oraUscita}`);
          if (t.approvazione === "Regolare" || t.approvazione === "Approvata") {
            const mg = calcMaggiorazioni({ data: ds, oraEntrata: t.oraEntrata, oraUscita: t.oraUscita }, []);
            dayMin += Math.round(mg.ore * 60);
          }
        }
        totMin += dayMin;
        const dt = new Date(`${ds}T00:00:00`);
        rows.push([`${dowIt(dt)} ${pad(day)}/${pad(rg.m)}/${rg.y}`, minToH(dayMin), stamps.join("   ")]);
      }
      const { jsPDF, autoTable } = await loadPdfLibs();
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const y = expHeader(doc, `Riepilogo timbrature - struttura: ${struttura || "tutte"}`, rg, dipendente);
      autoTable(doc, {
        head: [["Data", "Presenza", "Timbrature"]],
        body: rows.length ? rows : [["—", "—", "Nessuna timbratura nel periodo"]],
        startY: y, styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [26, 107, 90] },
        columnStyles: { 0: { cellWidth: 140 }, 1: { cellWidth: 70 } }
      });
      const fy = (doc as any).lastAutoTable.finalY + 18;
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text(`Totale ore: ${minToH(totMin)}`, 40, fy);
      expFooter(doc);
      doc.save(`Riepilogo_struttura_${(struttura || "tutte").replace(/\s+/g, "_")}_${mese}.pdf`);
    });
  }

  async function expMensile() {
    await run(async () => {
      const rg = expRange(mese);
      const data = await ensureData(dipendente, rg);
      const turni = await ProxyApi.turniRead(`${dipendente.nome} ${dipendente.cognome}`.trim()).catch(() => []);
      const turniArr = Array.isArray(turni) ? turni : [];
      const pad = (n: number) => String(n).padStart(2, "0");

      function tipoAbbr(tp: string): string {
        const t = (tp || "").toLowerCase();
        if (t.includes("feri")) return "FERIE";
        if (t.includes("malat")) return "MALATTIA";
        if (t.includes("permess")) return "PERMESSO";
        if (t.includes("rol")) return "ROL";
        return (tp || "ASSENZA").toUpperCase();
      }
      const absByDay: Record<string, string> = {};
      for (const fr of data.ferie) {
        if ((fr.stato || "") !== "Approvata") continue;
        const di = String(fr.dataInizio || "").split("T")[0];
        if (!di) continue;
        const dfn = String(fr.dataFine || di).split("T")[0];
        let cur = new Date(`${di}T00:00:00`);
        const end = new Date(`${dfn || di}T00:00:00`);
        let g = 0;
        while (cur <= end && g < 400) {
          absByDay[`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`] = tipoAbbr(fr.tipo);
          cur = new Date(cur.getTime() + 86400000);
          g++;
        }
      }

      const rows: string[][] = [];
      const tot = { ord: 0, fest: 0, nott: 0, straord: 0, riposo: 0 };
      const totAbs: Record<string, number> = {};
      const perStr: Record<string, number> = {};

      for (let day = 1; day <= rg.last; day++) {
        const ds = `${rg.y}-${pad(rg.m)}-${pad(day)}`;
        const dt = new Date(`${ds}T00:00:00`);
        const festivo = isFestivo(dt);
        const dayT = data.timb
          .filter((t: any) => String(t.data).split("T")[0] === ds && !t.eliminata && (t.approvazione === "Regolare" || t.approvazione === "Approvata"))
          .sort((a: any, b: any) => ((a.oraEntrata || "") < (b.oraEntrata || "") ? -1 : 1));

        const stamps: string[] = [];
        let wmin = 0, nmin = 0, fmin = 0, smin = 0;
        for (const t of dayT) {
          if (t.oraEntrata) stamps.push(`E${t.oraEntrata.replace(":", "")}`);
          if (t.oraUscita) stamps.push(`U${t.oraUscita.replace(":", "")}`);
          if (t.approvazione === "Regolare" || t.approvazione === "Approvata") {
            const mg = calcMaggiorazioni({ data: ds, oraEntrata: t.oraEntrata, oraUscita: t.oraUscita }, turniArr);
            const am = Math.round(mg.ore * 60);
            wmin += am; nmin += Math.round(mg.nott * 60); fmin += Math.round(mg.fest * 60); smin += Math.round(mg.straord * 60);
            if (t.struttura) perStr[t.struttura] = (perStr[t.struttura] || 0) + am;
          }
        }
        const strSet = new Set<string>();
        for (const t of dayT) if (t.struttura) strSet.add(t.struttura);
        const strGiorno = Array.from(strSet).join(", ");
        const turnoOggi = turniArr.find((t: any) => t.data === ds);
        const turno = turnoOggi ? `${turnoOggi.oraInizio || ""}-${turnoOggi.oraFine || ""}` : "";

        let causale = "", ore = "";
        if (wmin > 0) {
          ore = minToH(wmin);
          causale = festivo ? "FESTIVA" : "ORDINARIE";
          if (smin > 0) causale += " +STR";
          if (nmin > 0) causale += " +NOTT";
          if (festivo) tot.fest += wmin; else tot.ord += wmin;
          tot.nott += nmin; tot.straord += smin;
        } else if (absByDay[ds]) {
          causale = absByDay[ds];
          totAbs[causale] = (totAbs[causale] || 0) + 1;
        } else if (festivo) {
          causale = "FESTIVO";
        } else if (!turno) {
          causale = "RIPOSO"; tot.riposo++;
        } else {
          causale = "ASSENTE";
        }
        rows.push([`${pad(day)} ${dowIt(dt)}`, turno || "riposo", stamps.join(" "), strGiorno, ore, causale]);
      }

      const { jsPDF, autoTable } = await loadPdfLibs();
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      let y = expHeader(doc, "Riepilogo mensile presenze e assenze", rg, dipendente);
      autoTable(doc, {
        head: [["GG", "Turno", "Timbrature", "Struttura", "Ore", "Causale"]],
        body: rows, startY: y, styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [26, 107, 90] },
        columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 54 }, 3: { cellWidth: 92 }, 4: { cellWidth: 30 } }
      });
      let fy = (doc as any).lastAutoTable.finalY + 18;
      if (fy > 740) { doc.addPage(); fy = 50; }
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("Totali mensili", 40, fy); fy += 15;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      const lines = [
        `Ordinarie diurne: ${minToH(tot.ord)}`, `Festive: ${minToH(tot.fest)}`,
        `di cui notturne: ${minToH(tot.nott)}`, `Straordinario: ${minToH(tot.straord)}`,
        `Totale presenze: ${minToH(tot.ord + tot.fest)}`
      ];
      for (const k of Object.keys(totAbs)) lines.push(`Assenza ${k}: ${totAbs[k]} gg`);
      lines.push(`Riposi: ${tot.riposo} gg`);
      const sk = Object.keys(perStr);
      if (sk.length) {
        lines.push("Presenze per struttura:");
        for (const s of sk) lines.push(`   ${s}: ${minToH(perStr[s])}`);
      }
      for (const line of lines) { doc.text(line, 40, fy); fy += 13; }
      expFooter(doc);
      doc.save(`Riepilogo_mensile_${(dipendente.cognome || "dip").replace(/\s+/g, "_")}_${mese}.pdf`);
    });
  }

  async function expCancellate() {
    await run(async () => {
      const rg = expRange(mese);
      const data = await ensureData(dipendente, rg);
      const elim = data.timb
        .filter((t: any) => t.eliminata || t.approvazione === "Rifiutata" || t.approvazione === "Rifiutato")
        .sort((a: any, b: any) => (String(a.data) < String(b.data) ? -1 : 1));
      const pad = (n: number) => String(n).padStart(2, "0");
      const rows = elim.map((t: any) => {
        const ds = String(t.data).split("T")[0];
        const le = t.lastEdit ? new Date(t.lastEdit) : null;
        const leStr = le ? `${pad(le.getDate())}/${pad(le.getMonth() + 1)}/${le.getFullYear()} ${pad(le.getHours())}:${pad(le.getMinutes())}` : "—";
        const tipo = t.eliminata ? (t.motivoRimozione === "Modificata" ? "Modificata" : "Cancellata") : "Rifiutata";
        return [fmtDateIt(ds), tipo, `${t.oraEntrata || "—"} → ${t.oraUscita || "—"}`, t.struttura || "—", t.eliminataDa || "—", leStr];
      });
      const { jsPDF, autoTable } = await loadPdfLibs();
      const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
      const y = expHeader(doc, "Timbrature cancellate / modificate / rifiutate (archivio a norma di legge)", rg, dipendente);
      autoTable(doc, {
        head: [["Data", "Tipo", "Orario", "Struttura", "Eseguita da", "Data/ora operazione"]],
        body: rows.length ? rows : [["—", "—", "—", "—", "—", "Nessuna nel periodo"]],
        startY: y, styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [122, 26, 26] }
      });
      expFooter(doc, "Documento scaricato il");
      doc.save(`Timbrature_cancellate_modificate_${mese}.pdf`);
    });
  }

  return (
    <div>
      <div className="section-label"><div className="section-title">Esporta riepiloghi (PDF)</div></div>
      <div className="ana-card" style={{ padding: "1rem" }}>
        <label className="dim-lbl">Mese</label>
        <input type="month" className="dim-in" value={mese} onChange={e => setMese(e.target.value)} />
        {strutture.length > 0 && (
          <>
            <label className="dim-lbl">Struttura (per il foglio per struttura)</label>
            <select className="dim-in" value={struttura} onChange={e => setStruttura(e.target.value)}>
              {strutture.map((s: string) => <option key={s} value={s}>{s}</option>)}
            </select>
          </>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginTop: "0.7rem" }}>
          <button className="ts-save" disabled={busy} onClick={expPerStruttura}>{busy ? "Attendere..." : "📄 Riepilogo per struttura"}</button>
          <button className="ts-save" disabled={busy} onClick={expMensile}>{busy ? "Attendere..." : "📄 Riepilogo mensile dipendente"}</button>
          <button className="ts-save" style={{ background: "var(--coral)" }} disabled={busy} onClick={expCancellate}>{busy ? "Attendere..." : "📄 Cancellate / modificate (legale)"}</button>
        </div>
        {err && <div style={{ marginTop: "0.6rem", fontSize: 13, fontWeight: 700, color: "#7A1A1A" }}>⚠️ {err}</div>}
        <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: "0.5rem" }}>Ogni PDF riporta la data e l'ora di generazione.</div>
      </div>
    </div>
  );
}
