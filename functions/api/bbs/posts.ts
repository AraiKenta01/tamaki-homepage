import type { D1Database, PagesFunction, RateLimit } from "@cloudflare/workers-types";

interface Env {
  DB: D1Database;
  RATE_LIMITER: RateLimit;
  TURNSTILE_SECRET_KEY: string;
}

interface BbsPostRow {
  id: number;
  name: string;
  body: string;
  created_at: string;
}

const PER_PAGE = 20;
const MAX_NAME_LENGTH = 30;
const MAX_BODY_LENGTH = 1000;
const DEFAULT_NAME = "名無しさん";

// 承認制モデレーションを前提にしないための最低限の自動防御。完璧な検知は狙わず、
// 必要になった時にこの配列へ追記してデプロイし直す運用とする（継続的な人手作業は発生しない）。
const NG_WORDS: readonly string[] = ["死ね", "殺す"];

function containsNgWord(text: string): boolean {
  const lower = text.toLowerCase();
  return NG_WORDS.some((word) => lower.includes(word.toLowerCase()));
}

async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string | null,
): Promise<boolean> {
  if (!token) return false;

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!res.ok) return false;

  const data = (await res.json()) as { success: boolean };
  return data.success === true;
}

function toPost(row: BbsPostRow) {
  return { id: row.id, name: row.name, body: row.body, createdAt: row.created_at };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * PER_PAGE;

  const [listResult, countRow] = await Promise.all([
    env.DB.prepare(
      "SELECT id, name, body, created_at FROM bbs_posts ORDER BY id DESC LIMIT ?1 OFFSET ?2",
    )
      .bind(PER_PAGE, offset)
      .all<BbsPostRow>(),
    env.DB.prepare("SELECT COUNT(*) as count FROM bbs_posts").first<{ count: number }>(),
  ]);

  const totalCount = countRow?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  return jsonResponse({
    posts: (listResult.results ?? []).map(toPost),
    page,
    perPage: PER_PAGE,
    totalCount,
    totalPages,
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let payload: { name?: string; body?: string; turnstileToken?: string };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "invalid_request" }, 400);
  }

  const ip = request.headers.get("CF-Connecting-IP");

  const { success: rateLimitOk } = await env.RATE_LIMITER.limit({ key: ip ?? "unknown" });
  if (!rateLimitOk) {
    return jsonResponse({ success: false, error: "rate_limited" }, 429);
  }

  const turnstileOk = await verifyTurnstile(
    payload.turnstileToken ?? "",
    env.TURNSTILE_SECRET_KEY,
    ip,
  );
  if (!turnstileOk) {
    return jsonResponse({ success: false, error: "turnstile_failed" }, 403);
  }

  const name = (payload.name ?? "").trim().slice(0, MAX_NAME_LENGTH) || DEFAULT_NAME;
  const body = (payload.body ?? "").trim();

  if (!body) {
    return jsonResponse({ success: false, error: "empty_body" }, 400);
  }
  if (body.length > MAX_BODY_LENGTH) {
    return jsonResponse({ success: false, error: "body_too_long" }, 400);
  }
  if (containsNgWord(name) || containsNgWord(body)) {
    return jsonResponse({ success: false, error: "ng_word" }, 400);
  }

  const row = await env.DB.prepare(
    "INSERT INTO bbs_posts (name, body) VALUES (?1, ?2) RETURNING id, name, body, created_at",
  )
    .bind(name, body)
    .first<BbsPostRow>();

  if (!row) {
    return jsonResponse({ success: false, error: "insert_failed" }, 500);
  }

  return jsonResponse({ success: true, post: toPost(row) }, 201);
};
