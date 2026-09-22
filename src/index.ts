export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
}

// API機能が増えるたびに、ここにインポートとルート分岐を追加していく。
// 例: /api/counter (来客カウンター), /api/bbs/... (掲示板)

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
