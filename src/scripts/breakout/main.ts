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

function init(): void {
  const canvas = byId<HTMLCanvasElement>("breakout-canvas");
  const scoreEl = byId<HTMLElement>("breakout-score");
  const livesEl = byId<HTMLElement>("breakout-lives");
  const highScoreEl = byId<HTMLElement>("breakout-highscore");
  const stateEl = byId<HTMLElement>("breakout-state");
  const pauseButton = byId<HTMLButtonElement>("breakout-pause-button");

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
    onStateChange: (state) => {
      stateEl.textContent = stateLabel(state);
      pauseButton.textContent = state === "playing" ? "一時停止" : "スタート／再開";

      if (state === "playing") {
        gameOverHandled = false;
        return;
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
