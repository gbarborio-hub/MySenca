// Funzioni di calcolo per i riepiloghi PDF — porting fedele dall'originale.

function easter(Y: number): Date {
  const a = Y % 19, b = Math.floor(Y / 100), c = Y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31);
  const da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Y, mo - 1, da);
}

export function isFestivo(dt: Date): boolean {
  if (dt.getDay() === 0) return true;
  const key = `${dt.getMonth() + 1}-${dt.getDate()}`;
  const fissi: Record<string, 1> = { "1-1": 1, "1-6": 1, "4-25": 1, "5-1": 1, "6-2": 1, "8-15": 1, "11-1": 1, "12-8": 1, "12-25": 1, "12-26": 1 };
  if (fissi[key]) return true;
  const pq = new Date(easter(dt.getFullYear()).getTime() + 86400000);
  return dt.getMonth() === pq.getMonth() && dt.getDate() === pq.getDate();
}

function hm(x: string | undefined): number | null {
  const p = String(x || "").split(":");
  const h = parseInt(p[0]);
  const m = parseInt(p[1]);
  if (isNaN(h)) return null;
  return h * 60 + (isNaN(m) ? 0 : m);
}

export interface Maggiorazioni { ore: number; nott: number; fest: number; festNott: number; straord: number }

export function calcMaggiorazioni(timb: { data: string; oraEntrata?: string; oraUscita?: string }, turniDip: any[]): Maggiorazioni {
  const dstr = String(timb.data).split("T")[0];
  const s = hm(timb.oraEntrata);
  let e = hm(timb.oraUscita);
  if (!dstr || s === null || e === null) return { ore: 0, nott: 0, fest: 0, festNott: 0, straord: 0 };
  if (e <= s) e += 1440;
  const base = new Date(`${dstr}T00:00:00`);
  const win: [number, number][] = [];
  for (const t of turniDip) {
    if (t.data === dstr) {
      const a = hm(t.oraInizio);
      let b = hm(t.oraFine);
      if (a !== null && b !== null) {
        if (b <= a) b += 1440;
        win.push([a, b]);
      }
    }
  }
  let ore = 0, nott = 0, fest = 0, festNott = 0, straord = 0;
  for (let m = s; m < e; m++) {
    ore++;
    const mod = ((m % 1440) + 1440) % 1440;
    const isNight = mod >= 1320 || mod < 360;
    const dt = new Date(base.getTime() + m * 60000);
    const isFest = isFestivo(dt);
    let inShift = false;
    for (const w of win) { if (m >= w[0] && m < w[1]) { inShift = true; break; } }
    if (isNight) nott++;
    if (isFest) fest++;
    if (isNight && isFest) festNott++;
    if (!inShift) straord++;
  }
  const hh = (x: number) => Math.round((x / 60) * 100) / 100;
  return { ore: hh(ore), nott: hh(nott), fest: hh(fest), festNott: hh(festNott), straord: hh(straord) };
}

export function dowIt(dt: Date): string {
  return ["Do", "Lu", "Ma", "Me", "Gi", "Ve", "Sa"][dt.getDay()];
}
export function minToH(min: number): string {
  min = Math.max(0, Math.round(min));
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}
export function fmtGenNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fmtDateIt(ds: string): string {
  if (!ds) return "—";
  const [y, m, dd] = ds.split("-");
  return `${dd}/${m}/${y}`;
}
export function expMonthDefault(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export interface ExpRange { y: number; m: number; last: number; from: string; to: string }
export function expRange(ym: string): ExpRange {
  const p = String(ym).split("-");
  const y = +p[0], m = +p[1];
  const last = new Date(y, m, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { y, m, last, from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
}
