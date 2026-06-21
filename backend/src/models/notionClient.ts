// Thin Notion REST client. Models call this; no business logic here.

const NOTION_VERSION = "2022-06-28";
const NOTION_TOKEN = process.env.NOTION_TOKEN || "";

async function notionFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const notion = {
  queryDatabase: <T>(databaseId: string, body: unknown) =>
    notionFetch<T>(`databases/${databaseId}/query`, { method: "POST", body: JSON.stringify(body) }),
  createPage: <T>(body: unknown) =>
    notionFetch<T>(`pages`, { method: "POST", body: JSON.stringify(body) }),
  updatePage: <T>(pageId: string, body: unknown) =>
    notionFetch<T>(`pages/${pageId}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Upload binario in due fasi: 1) crea uno slot di upload, 2) invia i byte.
  // Restituisce il fileUploadId da usare nella proprietà "file" della pagina
  // (vedi attachFileUpload nel model che chiama questo client).
  async uploadFile(filename: string, contentType: string, base64Data: string): Promise<string> {
    const created: any = await notionFetch(`file_uploads`, {
      method: "POST",
      body: JSON.stringify({ filename, content_type: contentType || "application/octet-stream" })
    });
    const buffer = Buffer.from(base64Data.includes(",") ? base64Data.split(",")[1] : base64Data, "base64");
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: contentType || "application/octet-stream" }), filename);
    const sendRes = await fetch(`https://api.notion.com/v1/file_uploads/${created.id}/send`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION },
      body: form
    });
    if (!sendRes.ok) {
      const body = await sendRes.text();
      throw new Error(`Notion file upload error ${sendRes.status}: ${body}`);
    }
    return created.id;
  }
};

// Property readers — Notion's raw JSON shape is verbose, these normalize it.
export function rt(prop: any): string {
  if (!prop?.rich_text || !Array.isArray(prop.rich_text)) return "";
  return prop.rich_text.map((x: any) => x.plain_text ?? x.text?.content ?? "").join("");
}
export function title(prop: any): string {
  if (!prop?.title || !Array.isArray(prop.title)) return "";
  return prop.title.map((x: any) => x.plain_text ?? x.text?.content ?? "").join("");
}
export function sel(prop: any): string {
  return prop?.select?.name ?? "";
}
export function msel(prop: any): string[] {
  return Array.isArray(prop?.multi_select) ? prop.multi_select.map((x: any) => x.name) : [];
}
export function chk(prop: any): boolean {
  return !!prop?.checkbox;
}
export function num(prop: any): number {
  return typeof prop?.number === "number" ? prop.number : 0;
}
export function email(prop: any): string {
  return prop?.email ?? "";
}
export function dateStart(prop: any): string | null {
  return prop?.date?.start ?? null;
}
