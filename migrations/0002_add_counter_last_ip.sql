-- Migration number: 0002 	 2026-09-22T08:33:08.453Z

-- 直前にアクセスしたIPアドレスを1件だけ記録する（履歴やログは持たない）。
-- 同一IPからの連続アクセスでは加算しないための、古典的なCGIカウンター方式。
ALTER TABLE counter ADD COLUMN last_ip TEXT;
