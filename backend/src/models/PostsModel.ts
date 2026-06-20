import { notion, rt, sel, title, dateStart } from "./notionClient.js";

const DB_PIANO_EDITORIALE = "4cd8c9d8f648443595ce2ebad2bf854d";

export interface Post {
  pageId: string;
  titolo: string;
  canale: string;
  stato: string;
  tipoContenuto: string;
  dataPubblicazione: string | null;
  caption: string;
  hashtag: string;
  link: string;
  note: string;
  responsabile: string;
}

function fromNotionPage(page: any): Post {
  const p = page.properties || {};
  return {
    pageId: page.id,
    titolo: title(p["Titolo contenuto"]),
    canale: sel(p["Canale"]),
    stato: sel(p["Stato"]),
    tipoContenuto: sel(p["Tipo contenuto"]),
    dataPubblicazione: dateStart(p["Data pubblicazione"]),
    caption: rt(p["Caption"]),
    hashtag: rt(p["Hashtag"]),
    link: rt(p["Link"]),
    note: rt(p["Note"]),
    responsabile: rt(p["Responsabile"])
  };
}

export const PostsModel = {
  async list(): Promise<Post[]> {
    const res: any = await notion.queryDatabase(DB_PIANO_EDITORIALE, { page_size: 100 });
    return (res.results || []).map(fromNotionPage);
  }
};
