import type { Env } from "../index";

// 来客カウンター: 直前にアクセスしたIPアドレスと同じ場合は加算しない、
// 古典的なCGIカウンター方式。IPは1件だけ上書き保存し、履歴は持たない。
export async function handleCounterHit(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";

  const current = await env.DB.prepare("SELECT count, last_ip FROM counter WHERE id = 1").first<{
    count: number;
    last_ip: string | null;
  }>();

  if (current && current.last_ip === ip) {
    return new Response(JSON.stringify({ count: current.count }), {
      headers: { "content-type": "application/json" },
    });
  }

  const updated = await env.DB.prepare(
    "UPDATE counter SET count = count + 1, last_ip = ?1 WHERE id = 1 RETURNING count",
  )
    .bind(ip)
    .first<{ count: number }>();

  return new Response(JSON.stringify({ count: updated?.count ?? 0 }), {
    headers: { "content-type": "application/json" },
  });
}
