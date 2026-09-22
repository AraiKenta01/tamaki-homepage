/**
 * ステージのブロック配置パターン集。
 *
 * 1マスが1文字に対応する「ドット絵」形式。各行は横14マス分の文字列
 * （足りない/多い分は自動で埋める・切り詰めるので、多少ずれても壊れない）。
 *   . = 何もない
 *   1 = 壊れるブロック（耐久低め）
 *   2 = 壊れるブロック（耐久高め）
 *   # = 壊せないブロック（障害物）
 *
 * 新しい形を追加したいときは、この配列に14文字×任意行数の文字列セットを
 * 足すだけでよい。ステージが進むと STAGE_PATTERNS を順番に繰り返し使い、
 * 一周するごとに難しく（硬いブロックが増える・障害物が増える）していく
 * （実際の難易度調整は engine.ts 側）。
 */

export const PATTERN_COLS = 14;

export type StagePattern = readonly string[];

// 定番の四角い配置（1周目・基準形）
const GRID: StagePattern = [
  "22222222222222",
  "22222222222222",
  "11111111111111",
  "11111111111111",
];

// 丸型
const CIRCLE: StagePattern = [
  ".....1111.....",
  "...11111111...",
  "..2222222222..",
  ".222222222222.",
  "22222222222222",
  ".222222222222.",
  "..2222222222..",
  "...11111111...",
  ".....1111.....",
];

// 音符（8分音符っぽいシルエット。粗いグリッドでの簡易表現）
const MUSIC_NOTE: StagePattern = [
  "........22....",
  "........22....",
  "........22....",
  "........22....",
  "........22....",
  "........22....",
  "..111111.22...",
  ".11111111.2...",
  "..111111......",
];

// トロンボーン（スライド管＋ベルの簡易シルエット）
const TROMBONE: StagePattern = [
  ".............2",
  "............22",
  "111111111.2222",
  "2.........2222",
  "2........12222",
  "2........12222",
  "2.........2222",
  "111111111.2222",
  "............22",
];

// ハート型
const HEART: StagePattern = [
  ".11...11......",
  "1111.1111.....",
  "111111111.....",
  ".1111111......",
  "..11111.......",
  "...111........",
  "....1.........",
];

export const STAGE_PATTERNS: readonly StagePattern[] = [GRID, CIRCLE, MUSIC_NOTE, TROMBONE, HEART];

/** パターンを指定の列数ぴったりに揃える（短い行は . で埋め、長い行は切り詰める）。 */
export function normalizePatternRow(row: string, cols: number = PATTERN_COLS): string {
  if (row.length === cols) return row;
  if (row.length > cols) return row.slice(0, cols);
  return row + ".".repeat(cols - row.length);
}

export function getStagePattern(stage: number): StagePattern {
  const pattern = STAGE_PATTERNS[(stage - 1) % STAGE_PATTERNS.length];
  return pattern.map((row) => normalizePatternRow(row));
}

/** そのステージがパターン一巡の何周目か（0始まり）。周回のたびに障害物などを増やす用。 */
export function getStageLap(stage: number): number {
  return Math.floor((stage - 1) / STAGE_PATTERNS.length);
}
