import { handleCounterHit } from "./api/counter";
import { handleBbsPostsGet, handleBbsPostsPost } from "./api/bbs";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  RATE_LIMITER: RateLimit;
  TURNSTILE_SECRET_KEY: string;
}

// API機能が増えるたびに、ここにインポートとルート分岐を追加していく。
// 例: /api/counter (来客カウンター), /api/bbs/... (掲示板)

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/counter" && request.method === "POST") {
      return handleCounterHit(request, env);
    }

    if (url.pathname === "/api/bbs/posts" && request.method === "GET") {
      return handleBbsPostsGet(request, env);
    }
    if (url.pathname === "/api/bbs/posts" && request.method === "POST") {
      return handleBbsPostsPost(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
