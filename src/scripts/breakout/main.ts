/**
 * ページ側のDOMとゲームエンジン・スコア保存ロジックを繋ぐ起点。
 * DOM要素の取得・表示更新のみを担当し、ゲームルールやスコア永続化の詳細には立ち入らない。
 */
import { BreakoutEngine, type GameState } from "./engine";
import { defaultScoreStore } from "./score-store";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`#${id} not found`);
  }
  return el as T;
}

function stateLabel(state: GameState): string {
  switch (state) {
    case "ready":
      return "スタート待ち";
    case "playing":
      return "プレイ中";
    case "paused":
      return "一時停止";
    case "gameover":
      return "ゲームオーバー";
    case "cleared":
      return "クリア！";
  }
}

function buildTweetHref(score: number, stage: number): string {
  const shareUrl = `${location.origin}/breakout/`;
  const text = `玉置優里ホームページのブロック崩しでスコア${score}点・ステージ${stage}まで到達！`;
  const params = new URLSearchParams({ text, url: shareUrl });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

function init(): void {
  const canvas = byId<HTMLCanvasElement>("breakout-canvas");
  const scoreEl = byId<HTMLElement>("breakout-score");
  const livesEl = byId<HTMLElement>("breakout-lives");
  const highScoreEl = byId<HTMLElement>("breakout-highscore");
  const stateEl = byId<HTMLElement>("breakout-state");
  const stageEl = byId<HTMLElement>("breakout-stage");
  const pauseButton = byId<HTMLButtonElement>("breakout-pause-button");
  const tweetLink = byId<HTMLAnchorElement>("breakout-tweet-link");

  const scoreStore = defaultScoreStore;
  highScoreEl.textContent = String(scoreStore.getHighScore());

  let gameOverHandled = false;

  const engine = new BreakoutEngine(canvas, {
    onScoreChange: (score) => {
      scoreEl.textContent = String(score);
    },
    onLivesChange: (lives) => {
      livesEl.textContent = String(lives);
    },
    onStageChange: (stage) => {
      stageEl.textContent = String(stage);
    },
    onStateChange: (state) => {
      stateEl.textContent = stateLabel(state);
      pauseButton.textContent = state === "playing" ? "一時停止" : "スタート／再開";

      if (state === "playing") {
        gameOverHandled = false;
        tweetLink.hidden = true;
        return;
      }

      if (state === "gameover") {
        tweetLink.href = buildTweetHref(engine.getScore(), engine.getStage());
        tweetLink.hidden = false;
      }

      if ((state === "gameover" || state === "cleared") && !gameOverHandled) {
        gameOverHandled = true;
        scoreStore.submitScore(engine.getScore()).then((result) => {
          highScoreEl.textContent = String(result.highScore);
        });
      }
    },
  });

  // キャンバスへのタップはプレイ中はパドル移動専用（engine側で一時停止と競合しないよう分離済み）。
  // スマホでの一時停止/再開はこのボタンから行う。
  pauseButton.addEventListener("click", () => {
    engine.handlePrimaryAction();
  });

  window.addEventListener("beforeunload", () => {
    engine.destroy();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
