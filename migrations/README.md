# migrations/

Cloudflare D1のSQLマイグレーションファイルを置く場所。

`wrangler d1 migrations create <DB名> <migration名>` で生成し、
`wrangler d1 migrations apply <DB名>` で適用する。

想定テーブル:
- 来客カウンター（`counter`、Phase 5で実装済み。`0001_create_counter.sql`, `0002_add_counter_last_ip.sql`）
- 掲示板の投稿・過去ログ（`bbs_posts`、Phase 6で実装済み。`0003_create_bbs_posts.sql`）

参考: https://developers.cloudflare.com/d1/reference/migrations/
