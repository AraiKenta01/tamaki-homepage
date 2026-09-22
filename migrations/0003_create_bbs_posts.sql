-- 掲示板の投稿テーブル。
-- 設計方針: 承認制にはせず誰でも投稿可能、投稿は削除せず全件保持して過去ログとして蓄積する。
CREATE TABLE bbs_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '名無しさん',
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
