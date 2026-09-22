import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// 自己紹介: 単一エントリ（src/content/profile/main.md）。
// Sveltia CMSからは「ファイルコレクション」として、フォーム入力だけで編集できるようにする。
const profile = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/profile" }),
  schema: z.object({
    name: z.string(),
    catchphrase: z.string().optional(),
  }),
});

// スケジュール: 1公演 = 1ファイル。過去分も削除せずここに残し続け、
// 表示側（src/pages/schedule/index.astro）で開催日により未来分のみに絞り込む。
const schedule = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/schedule" }),
  schema: z.object({
    date: z.coerce.date(),
    venue: z.string(),
    title: z.string(),
    url: z.string().url().optional(),
    note: z.string().optional(),
  }),
});

// ディスコグラフィー: 1曲/1作品 = 1ファイル。音源は自前ホスティングせず、
// Spotify/YouTube等の公式埋め込みプレイヤーへのURLのみを持つ。
const discography = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/discography" }),
  schema: z.object({
    title: z.string(),
    releaseDate: z.coerce.date(),
    type: z.enum(["single", "album", "EP"]),
    spotifyUrl: z.string().url().optional(),
    youtubeUrl: z.string().url().optional(),
  }),
});

export const collections = { profile, schedule, discography };
