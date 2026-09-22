# 玉置優里ホームページ — プロジェクト設計方針

このファイルはCLAUDE.mdからシンボリックリンクされている。git worktreeで機能ごとに並行実装するため、
各セッションが最初にこれを読むことで、既に決まっている設計判断を再確認・再議論せずに実装へ進めること。

## 何を作っているか

ミュージシャン玉置優里のオフィシャルサイト。阿部寛のホームページ・2chまとめサイト的な「古の質感」を狙いつつ、
来客カウンター・掲示板・簡易ブロック崩しなどの遊び要素を持たせる。最低限載せる情報は自己紹介・スケジュール・
ディスコグラフィー。

## 絶対に外してはいけない制約

- **管理者（玉置）はIT知識が皆無。** コンテンツ更新はGit/Markdown/管理画面の複雑さを一切意識させない設計にすること。
- **脆弱性対策のための継続メンテナンスは原則行わない。** 重大な脆弱性が出たときだけ対応する運用前提。実装は
  「攻撃対象領域を増やさない」「自動防御で完結させる」方向を常に優先する。承認制モデレーションのような
  「誰かが継続的に手を動かす」運用は原則導入しない。
- **非常に軽量であること。** 不要なJS・重い依存関係・自前ホスティングの大容量アセットは避ける。
- **コストはドメイン代以外無料。** Cloudflare無料枠に収まる設計を維持する。

## 技術スタックと理由

- **静的サイト生成: Astro**（Zero JS by default、Sveltia CMSとの連携実績重視）
- **ホスティング: Cloudflare Pages + Workers + D1** — サイト・関数・DBが1アカウントで完結し、非IT管理者向け
  運用がシンプルになるため。GitHub連携でpush=自動デプロイ。
- **コンテンツ管理: Sveltia CMS**（Git連携ヘッドレスCMS）。玉置はフォームに入力して保存ボタンを押すだけ。
  Git/Markdownは一切見せない。
- **CMSログイン: Cloudflare Access（メールワンタイムコード）。** 玉置にGitHubアカウントは持たせない。
  実際のGitHubへの書き込みはCloudflare Workerが専用トークンで代行する。

## 機能ごとの設計方針

- **掲示板**: 誰でも投稿可、承認制にはしない（モデレーション運用を前提にできないため）。
  Cloudflare Turnstile + レート制限 + NGワードフィルタで自動防御。投稿は削除せず全件保持し、
  過去ログ保管庫（ページネーション）として蓄積する。
- **来客カウンター**: 単純な総アクセス数カウンターのみ。ユニーク判定・日別集計はしない
  （個人情報保護の考慮を増やさないため）。
- **ブロック崩し**: クライアント完結、ハイスコアはlocalStorage保存のみ。ただし将来ランキング機能を
  追加したい意向があるため、ゲームロジックとスコア送信ロジックは分離しておくこと。
- **ディスコグラフィー**: 音源は自前ホスティングせず、Spotify/YouTube等の公式埋め込みプレイヤーを使う
  （著作権リスクと軽量性のため）。
- **スケジュール**: CMS上では全件（過去分含む）を1コレクションとして管理し、表示側で開催日により
  自動フィルタして未来分のみ出す。過去分のデータは削除しない。

## ディレクトリ構成

- `/src` — Astroソース（コンポーネント、ページ、Content Collections）
- `/public` — 静的アセット
- `/functions` — Cloudflare Pages Functions（Worker API: カウンター、掲示板投稿、CMS用OAuthプロキシ等）
- `/migrations` — Cloudflare D1のSQLマイグレーション

## 開発フロー

- 機能単位でgit worktree + `feature/<name>` ブランチを作成 → 実装 → PRで`main`にマージ → worktree削除。
- `main`は常にデプロイ可能な状態を維持する。
- CIはGitHub Actionsで最小限（Astroビルド確認 + 軽量Lintのみ）。E2Eテストなど厚いCIは導入しない
  （CI自体がメンテナンス対象になるのを避けるため）。
- GitHub Dependabotのセキュリティアラートを有効化し、Critical/Highのみ自動Issue化。通知は開発者のみに届き、
  玉置には届かない。

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
