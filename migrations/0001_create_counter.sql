-- Migration number: 0001 	 2026-09-22T08:15:19.471Z

-- 来客カウンター: 単純な総アクセス数のみ保持する1行だけのテーブル。
-- ユニーク判定・日別集計はしない設計方針（AGENTS.md参照）。
CREATE TABLE counter (
  id INTEGER PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

INSERT INTO counter (id, count) VALUES (1, 0);
