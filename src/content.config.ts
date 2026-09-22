import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// 自己紹介: 単一エントリ（src/content/profile/main.md）。TOPページに直接表示する
// （独立した自己紹介ページは廃止）。SNSリンク・連絡先メールもここにまとめて持つ。
// photoはCMSアップロード先（public/images/uploads）へのパス文字列であり、
// Astroのimage()最適化パイプラインには乗らない（CMSアップロード画像の一般的な制約）。
//
// URL/メール系フィールドはすべて z.string()（形式チェックなし）にしてある。
// z.string().url()/.email() で厳密にバリデーションすると、玉置がCMSでURL欄に
// 自由なコメント文などを書いてしまった場合にビルドそのものが失敗し、サイト全体が
// 更新できなくなる（実際に発生した）。非IT管理者の入力ミス1件でサイト全体が
// 壊れる設計は避け、多少URL形式が崩れていてもビルドは通す方針にする。
const profile = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/profile" }),
  schema: z.object({
    name: z.string(),
    catchphrase: z.string().optional(),
    photo: z.string().optional(),
    email: z.string().optional(),
    instagramUrl: z.string().optional(),
    xUrl: z.string().optional(),
    tiktokUrl: z.string().optional(),
    youtubeUrl: z.string().optional(),
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
    url: z.string().optional(),
    note: z.string().optional(),
  }),
});

// ディスコグラフィー: 1曲/1作品 = 1ファイル。音源は自前ホスティングせず、
// Spotify/Apple Music/YouTube等の公式埋め込みプレイヤーへのURLのみを持つ。
// coverImageはCMSアップロード先（public/images/uploads）へのパス文字列。
// ファイル名（entry.id）を詳細ページのスラッグとして使う。
const discography = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/discography" }),
  schema: z.object({
    title: z.string(),
    releaseDate: z.coerce.date(),
    type: z.enum(["single", "album", "EP"]),
    coverImage: z.string().optional(),
    composer: z.string().optional(),
    arranger: z.string().optional(),
    description: z.string().optional(),
    spotifyUrl: z.string().optional(),
    appleMusicUrl: z.string().optional(),
    youtubeUrl: z.string().optional(),
  }),
});

export const collections = { profile, schedule, discography };
