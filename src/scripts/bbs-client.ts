export interface BbsPost {
  id: number;
  name: string;
  body: string;
  createdAt: string;
}

export interface BbsPostsResponse {
  posts: BbsPost[];
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
}

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export async function fetchPosts(page: number): Promise<BbsPostsResponse> {
  const res = await fetch(`/api/bbs/posts?page=${page}`);
  if (!res.ok) {
    throw new Error(`投稿の取得に失敗しました (status: ${res.status})`);
  }
  return res.json();
}

export function renderPosts(container: HTMLElement, posts: BbsPost[]): void {
  container.textContent = "";

  if (posts.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "まだ投稿がありません。";
    container.append(empty);
    return;
  }

  for (const post of posts) {
    // innerHTMLは使わず要素・textContentのみで組み立てる（投稿本文はユーザー入力のため）。
    const article = document.createElement("article");
    article.className = "box bbs-post";

    const meta = document.createElement("p");
    meta.className = "bbs-post-meta";
    const number = document.createElement("strong");
    number.textContent = `${post.id}`;
    const time = document.createElement("time");
    time.dateTime = post.createdAt;
    time.textContent = formatDate(post.createdAt);
    meta.append(number, ` ${post.name}　`, time);

    const body = document.createElement("p");
    body.className = "bbs-post-body";
    body.textContent = post.body;

    article.append(meta, body);
    container.append(article);
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return iso;
  return dateFormatter.format(date);
}
