# migrations/

Cloudflare D1のSQLマイグレーションファイルを置く場所。

`wrangler d1 migrations create <DB名> <migration名>` で生成し、
`wrangler d1 migrations apply <DB名>` で適用する。

想定テーブル:
- 来客カウンター（Phase 5）
- 掲示板の投稿・過去ログ（Phase 6）

参考: https://developers.cloudflare.com/d1/reference/migrations/
