/**
 * ハイスコアの永続化・送信ロジック。
 * 現状はlocalStorageのみに保存するが、将来オンラインランキングを追加する際は
 * この ScoreStore インターフェースの実装を差し替えるだけで済むよう、
 * ゲームロジック（engine.ts）からは完全に切り離してある。
 */

export interface SubmitScoreResult {
  highScore: number;
  isNewHighScore: boolean;
}

export interface ScoreStore {
  getHighScore(): number;
  submitScore(score: number): Promise<SubmitScoreResult>;
}

const STORAGE_KEY = "breakout-high-score";

export class LocalScoreStore implements ScoreStore {
  getHighScore(): number {
    if (typeof localStorage === "undefined") {
      return 0;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async submitScore(score: number): Promise<SubmitScoreResult> {
    const current = this.getHighScore();
    const isNewHighScore = score > current;
    const highScore = isNewHighScore ? score : current;

    if (isNewHighScore && typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(highScore));
    }

    return { highScore, isNewHighScore };
  }
}

export const defaultScoreStore: ScoreStore = new LocalScoreStore();
