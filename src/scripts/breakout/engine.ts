/**
 * ブロック崩しのゲームロジック本体。
 * DOM描画（Canvas）・効果音（sound.ts）・ステージ配置（stages.ts）以外の
 * 外部システムには一切依存しない。
 * スコアの永続化・送信は score-store.ts 側の責務であり、
 * ここではコールバック経由で「今のスコア」を通知するだけに留める
 * （将来ランキングAPIに差し替える際、このファイルは変更不要にするため）。
 */

import { breakoutSound } from "./sound";
import { getStagePattern, getStageLap, PATTERN_COLS } from "./stages";

export type GameState = "ready" | "playing" | "paused" | "gameover" | "cleared";
export type CapsuleType = "multi" | "wide" | "pierce";

export interface BreakoutCallbacks {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onStateChange?: (state: GameState) => void;
  onStageChange?: (stage: number) => void;
}

interface Paddle {
  x: number;
  width: number;
  height: number;
  speed: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  unbreakable: boolean;
}

/** ブロック破壊時に飛び散る破片（演出のみ、当たり判定は持たない）。 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

/** 落ちてくるパワーアップカプセル。パドルで受けると種類に応じた効果が発動する。 */
interface Capsule {
  x: number;
  y: number;
  vy: number;
  radius: number;
  type: CapsuleType;
}

const PATTERN_ROWS_AREA_TOP = 26;
const BRICK_GAP = 3;
const BRICK_HEIGHT = 14;
const PADDLE_HEIGHT = 10;
const PADDLE_WIDTH = 70;
const PADDLE_WIDE_SCALE = 1.45;
const PADDLE_WIDE_DURATION = 8; // 秒
const PIERCE_DURATION = 6; // 秒
const BALL_RADIUS = 5;
const INITIAL_LIVES = 3;
const BASE_BALL_SPEED = 260; // px/sec。難易度を上げるため元の220から引き上げ
const PADDLE_SPEED = 380; // px/sec（キーボード操作時のみ使用）
const MAX_SPEED_MULTIPLIER = 2.3;
const SPEED_RAMP_PER_BRICK = 0.035;
const MAX_BALLS = 5;
const CAPSULE_DROP_CHANCE = 0.16;
const CAPSULE_FALL_SPEED = 120;
const STAGE_SPEED_BASELINE_STEP = 0.12; // ステージが進むごとの開始速度の底上げ
const MAX_BRICK_HP = 4;
const CAPSULE_WEIGHTS: readonly [CapsuleType, number][] = [
  ["multi", 0.5],
  ["wide", 0.25],
  ["pierce", 0.25],
];

function pickCapsuleType(): CapsuleType {
  const roll = Math.random();
  let acc = 0;
  for (const [type, weight] of CAPSULE_WEIGHTS) {
    acc += weight;
    if (roll < acc) return type;
  }
  return "multi";
}

export class BreakoutEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: BreakoutCallbacks;

  private width = 0;
  private height = 0;

  private paddle: Paddle;
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private particles: Particle[] = [];
  private capsules: Capsule[] = [];
  private speedMultiplier = 1;
  private paddleWideTimer = 0;
  private pierceTimer = 0;

  private score = 0;
  private lives = INITIAL_LIVES;
  private stage = 1;
  private state: GameState = "ready";

  private movingLeft = false;
  private movingRight = false;
  private pointerTargetX: number | null = null;

  private rafId: number | null = null;
  private lastTimestamp = 0;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      this.movingLeft = true;
    } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      this.movingRight = true;
    } else if (event.key === " " || event.key === "Enter") {
      this.handlePrimaryAction();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      this.movingLeft = false;
    } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      this.movingRight = false;
    }
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    this.pointerTargetX = (event.clientX - rect.left) * scaleX;
  };

  // プレイ中はタップ＝パドル移動の開始点でしかなく、開始/一時停止をここで
  // 兼ねるとスマホでパドルを掴むたびに一時停止してしまう。プレイ中以外の
  // 状態（スタート待ち・一時停止・ゲームオーバー・クリア）でのタップだけ
  // 「開始/再開」として扱う。プレイ中の一時停止はHUDの専用ボタンで行う。
  private readonly onPointerDown = () => {
    if (this.state !== "playing") {
      this.handlePrimaryAction();
    }
  };

  private readonly loop = (timestamp: number) => {
    const deltaSeconds = this.lastTimestamp === 0 ? 0 : (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    if (this.state === "playing") {
      this.update(Math.min(deltaSeconds, 0.05));
    }
    this.draw();

    this.rafId = requestAnimationFrame(this.loop);
  };

  constructor(canvas: HTMLCanvasElement, callbacks: BreakoutCallbacks = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D canvas context is not available");
    }
    this.ctx = ctx;
    this.callbacks = callbacks;

    this.width = canvas.width;
    this.height = canvas.height;

    this.paddle = this.createPaddle();
    this.balls = [this.createBall()];
    this.bricks = this.createBricks();

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);

    this.rafId = requestAnimationFrame(this.loop);
    this.draw();
  }

  getScore(): number {
    return this.score;
  }

  getState(): GameState {
    return this.state;
  }

  getStage(): number {
    return this.stage;
  }

  /** スペース/Enter/タップ/HUDボタンに応じて「開始」「一時停止」「再開」「再挑戦」を行う。 */
  handlePrimaryAction(): void {
    breakoutSound.ensureReady();
    if (this.state === "ready" || this.state === "gameover" || this.state === "cleared") {
      this.reset();
      this.setState("playing");
    } else if (this.state === "paused") {
      this.setState("playing");
    } else if (this.state === "playing") {
      this.setState("paused");
    }
  }

  reset(): void {
    this.stage = 1;
    this.callbacks.onStageChange?.(this.stage);
    this.paddle = this.createPaddle();
    this.balls = [this.createBall()];
    this.bricks = this.createBricks();
    this.particles = [];
    this.capsules = [];
    this.speedMultiplier = 1;
    this.paddleWideTimer = 0;
    this.pierceTimer = 0;
    this.setScore(0);
    this.setLives(INITIAL_LIVES);
  }

  /** ブロックを全部壊すとゲームを終わらせず、より厳しい次ステージへ進む（無限に難易度が上がる）。 */
  private advanceStage(): void {
    this.stage += 1;
    this.callbacks.onStageChange?.(this.stage);
    this.setScore(this.score + 100); // ステージクリアボーナス
    this.bricks = this.createBricks();
    this.capsules = [];
    this.speedMultiplier = Math.min(MAX_SPEED_MULTIPLIER, 1 + (this.stage - 1) * STAGE_SPEED_BASELINE_STEP);
    this.balls = [this.createBall()];
    for (const ball of this.balls) {
      this.applySpeedMultiplier(ball, this.speedMultiplier);
    }
    breakoutSound.cleared();
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
  }

  private createPaddle(): Paddle {
    return {
      x: (this.width - PADDLE_WIDTH) / 2,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
      speed: PADDLE_SPEED,
    };
  }

  /** 幅を変えつつ中心位置は保つ（パドル拡大パワーアップ用）。 */
  private setPaddleWidth(newWidth: number): void {
    const center = this.paddle.x + this.paddle.width / 2;
    this.paddle.width = newWidth;
    this.paddle.x = Math.max(0, Math.min(this.width - newWidth, center - newWidth / 2));
  }

  private createBall(): Ball {
    const angle = (Math.PI / 4) * (Math.random() < 0.5 ? -1 : 1) - Math.PI / 2;
    return {
      x: this.width / 2,
      y: this.height - 40,
      vx: BASE_BALL_SPEED * Math.cos(angle),
      vy: BASE_BALL_SPEED * Math.sin(angle),
      radius: BALL_RADIUS,
    };
  }

  /**
   * ステージごとにドット絵パターン（stages.ts）から配置を読み込む。
   * パターンは STAGE_PATTERNS を順番に繰り返し使い、一周するたびに
   * ・硬いブロックのHPが底上げされ
   * ・空きマスの一部が壊せない障害物ブロックに変わる
   * ことで際限なく難しくなっていく。
   */
  private createBricks(): Brick[] {
    const bricks: Brick[] = [];
    const pattern = getStagePattern(this.stage);
    const lap = getStageLap(this.stage);
    const extraHp = lap; // 一周するごとにHP+1
    const obstacleCount = Math.min(10, lap * 2);

    const brickWidth = (this.width - BRICK_GAP * (PATTERN_COLS + 1)) / PATTERN_COLS;

    const emptyCells: { row: number; col: number }[] = [];

    pattern.forEach((rowStr, row) => {
      for (let col = 0; col < PATTERN_COLS; col++) {
        const ch = rowStr[col] ?? ".";
        const x = BRICK_GAP + col * (brickWidth + BRICK_GAP);
        const y = PATTERN_ROWS_AREA_TOP + BRICK_GAP + row * (BRICK_HEIGHT + BRICK_GAP);

        if (ch === ".") {
          emptyCells.push({ row, col });
          continue;
        }
        if (ch === "#") {
          bricks.push({ x, y, width: brickWidth, height: BRICK_HEIGHT, hp: 1, maxHp: 1, unbreakable: true });
          continue;
        }
        const baseHp = ch === "2" ? 2 : 1;
        const hp = Math.min(MAX_BRICK_HP, baseHp + extraHp);
        bricks.push({ x, y, width: brickWidth, height: BRICK_HEIGHT, hp, maxHp: hp, unbreakable: false });
      }
    });

    // 周回ボーナス障害物: 空いているマスの一部を壊せないブロックにして密度を上げる
    for (let i = 0; i < obstacleCount && emptyCells.length > 0; i++) {
      const idx = Math.floor(Math.random() * emptyCells.length);
      const { row, col } = emptyCells.splice(idx, 1)[0];
      const x = BRICK_GAP + col * (brickWidth + BRICK_GAP);
      const y = PATTERN_ROWS_AREA_TOP + BRICK_GAP + row * (BRICK_HEIGHT + BRICK_GAP);
      bricks.push({ x, y, width: brickWidth, height: BRICK_HEIGHT, hp: 1, maxHp: 1, unbreakable: true });
    }

    return bricks;
  }

  private setScore(value: number): void {
    this.score = value;
    this.callbacks.onScoreChange?.(this.score);
  }

  private setLives(value: number): void {
    this.lives = value;
    this.callbacks.onLivesChange?.(this.lives);
  }

  private setState(value: GameState): void {
    this.state = value;
    this.callbacks.onStateChange?.(this.state);
  }

  private spawnParticles(x: number, y: number, color: string): void {
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35,
        color,
      });
    }
  }

  private applySpeedMultiplier(ball: Ball, newMultiplier: number): void {
    const currentSpeed = Math.hypot(ball.vx, ball.vy);
    if (currentSpeed === 0) return;
    const targetSpeed = BASE_BALL_SPEED * newMultiplier;
    const scale = targetSpeed / currentSpeed;
    ball.vx *= scale;
    ball.vy *= scale;
  }

  private splitBalls(): void {
    const room = MAX_BALLS - this.balls.length;
    if (room <= 0) return;
    const source = this.balls.slice(0, room);
    for (const original of source) {
      const speed = Math.hypot(original.vx, original.vy);
      const currentAngle = Math.atan2(original.vy, original.vx);
      const spread = (Math.PI / 6) * (Math.random() < 0.5 ? -1 : 1);
      const angle = currentAngle + spread;
      this.balls.push({
        x: original.x,
        y: original.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: BALL_RADIUS,
      });
    }
  }

  private activateCapsule(type: CapsuleType): void {
    switch (type) {
      case "multi":
        this.splitBalls();
        break;
      case "wide":
        this.paddleWideTimer = PADDLE_WIDE_DURATION;
        this.setPaddleWidth(PADDLE_WIDTH * PADDLE_WIDE_SCALE);
        break;
      case "pierce":
        this.pierceTimer = PIERCE_DURATION;
        break;
    }
    breakoutSound.powerUp();
  }

  private update(dt: number): void {
    // パドル移動（キーボード優先、なければポインタ追従）
    if (this.movingLeft && !this.movingRight) {
      this.paddle.x -= this.paddle.speed * dt;
    } else if (this.movingRight && !this.movingLeft) {
      this.paddle.x += this.paddle.speed * dt;
    } else if (this.pointerTargetX !== null) {
      // マウス/タッチの位置に完全に追随させる（速度上限を設けない）。
      this.paddle.x = this.pointerTargetX - this.paddle.width / 2;
    }
    this.paddle.x = Math.max(0, Math.min(this.width - this.paddle.width, this.paddle.x));

    // パドル拡大タイマー
    if (this.paddleWideTimer > 0) {
      this.paddleWideTimer = Math.max(0, this.paddleWideTimer - dt);
      if (this.paddleWideTimer === 0) {
        this.setPaddleWidth(PADDLE_WIDTH);
      }
    }
    // 貫通弾タイマー
    if (this.pierceTimer > 0) {
      this.pierceTimer = Math.max(0, this.pierceTimer - dt);
    }

    const paddleY = this.height - 20;
    const piercing = this.pierceTimer > 0;

    for (const ball of this.balls) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // 壁反射
      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.vx *= -1;
        breakoutSound.wallBounce();
      } else if (ball.x + ball.radius > this.width) {
        ball.x = this.width - ball.radius;
        ball.vx *= -1;
        breakoutSound.wallBounce();
      }
      if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.vy *= -1;
        breakoutSound.wallBounce();
      }

      // パドル反射
      if (
        ball.vy > 0 &&
        ball.y + ball.radius >= paddleY &&
        ball.y + ball.radius <= paddleY + this.paddle.height &&
        ball.x >= this.paddle.x &&
        ball.x <= this.paddle.x + this.paddle.width
      ) {
        ball.y = paddleY - ball.radius;
        const hitPos = (ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
        const speed = Math.hypot(ball.vx, ball.vy);
        const angle = hitPos * (Math.PI / 3); // 最大60度で反射角を変える
        ball.vx = speed * Math.sin(angle);
        ball.vy = -Math.abs(speed * Math.cos(angle));
        breakoutSound.paddleHit();
      }

      // ブロック衝突（1フレームにつき1ボール1ブロックまで。貫通弾は反射せず通過する）
      for (const brick of this.bricks) {
        if (brick.hp <= 0) continue;
        if (
          ball.x + ball.radius > brick.x &&
          ball.x - ball.radius < brick.x + brick.width &&
          ball.y + ball.radius > brick.y &&
          ball.y - ball.radius < brick.y + brick.height
        ) {
          if (brick.unbreakable) {
            ball.vy *= -1; // 壊せないブロックは貫通弾でも跳ね返す
            breakoutSound.wallBounce();
            break;
          }

          brick.hp -= 1;
          if (!piercing) {
            ball.vy *= -1;
          }
          this.setScore(this.score + 10 * brick.maxHp);

          const brickColor = brick.hp > 0 ? "#c76b1a" : "#8b0000";
          this.spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, brickColor);
          breakoutSound.brickHit(brick.maxHp - brick.hp + 1);

          if (brick.hp <= 0 && Math.random() < CAPSULE_DROP_CHANCE) {
            this.capsules.push({
              x: brick.x + brick.width / 2,
              y: brick.y + brick.height / 2,
              vy: CAPSULE_FALL_SPEED,
              radius: 7,
              type: pickCapsuleType(),
            });
          }

          if (brick.hp <= 0) {
            this.speedMultiplier = Math.min(
              MAX_SPEED_MULTIPLIER,
              this.speedMultiplier + SPEED_RAMP_PER_BRICK,
            );
            for (const b of this.balls) {
              this.applySpeedMultiplier(b, this.speedMultiplier);
            }
          }
          break;
        }
      }
    }

    // 落下したボールを除去
    this.balls = this.balls.filter((ball) => ball.y - ball.radius <= this.height);

    if (this.balls.length === 0) {
      const remaining = this.lives - 1;
      this.setLives(remaining);
      breakoutSound.lifeLost();
      if (remaining <= 0) {
        this.setState("gameover");
        breakoutSound.gameOver();
      } else {
        this.balls = [this.createBall()];
        this.capsules = [];
      }
    }

    // カプセル（パワーアップ）落下・パドルキャッチ判定
    for (const capsule of this.capsules) {
      capsule.y += capsule.vy * dt;
    }
    this.capsules = this.capsules.filter((capsule) => {
      const caught =
        capsule.y + capsule.radius >= paddleY &&
        capsule.y - capsule.radius <= paddleY + this.paddle.height &&
        capsule.x >= this.paddle.x - capsule.radius &&
        capsule.x <= this.paddle.x + this.paddle.width + capsule.radius;
      if (caught) {
        this.activateCapsule(capsule.type);
        return false;
      }
      return capsule.y - capsule.radius <= this.height;
    });

    // 演出パーティクルの寿命処理
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    // 全ブロック破壊で終了にはせず、次ステージへ進む（無限に難しくなっていく）
    if (this.bricks.every((b) => b.hp <= 0)) {
      this.advanceStage();
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#0f0f23";
    ctx.fillRect(0, 0, this.width, this.height);

    // ブロック（耐久が残っているほど明るい色、壊せないブロックはグレー）
    for (const brick of this.bricks) {
      if (brick.hp <= 0) continue;
      ctx.fillStyle = brick.unbreakable ? "#555" : brick.hp >= 2 ? "#c76b1a" : "#8b0000";
      ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
      ctx.strokeStyle = brick.unbreakable ? "#999" : "#f5f2e9";
      ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
    }

    // カプセル（種類ごとに色分け）
    const capsuleColor: Record<CapsuleType, string> = {
      multi: "#4ade80",
      wide: "#38bdf8",
      pierce: "#f97316",
    };
    for (const capsule of this.capsules) {
      ctx.beginPath();
      ctx.arc(capsule.x, capsule.y, capsule.radius, 0, Math.PI * 2);
      ctx.fillStyle = capsuleColor[capsule.type];
      ctx.fill();
      ctx.strokeStyle = "#f5f2e9";
      ctx.stroke();
    }

    // 破片演出
    for (const particle of this.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / 0.35);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // パドル（貫通弾中はオレンジ枠で分かるようにする）
    ctx.fillStyle = this.pierceTimer > 0 ? "#f97316" : "#f5f2e9";
    ctx.fillRect(this.paddle.x, this.height - 20, this.paddle.width, this.paddle.height);

    // ボール
    for (const ball of this.balls) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd700";
      ctx.fill();
    }

    if (this.state !== "playing") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = "#f5f2e9";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      const message = this.getOverlayMessage();
      ctx.fillText(message, this.width / 2, this.height / 2);
    }
  }

  private getOverlayMessage(): string {
    switch (this.state) {
      case "ready":
        return "タップ／クリックまたはSpaceキーでスタート";
      case "paused":
        return "一時停止中（タップ/Spaceキーで再開）";
      case "gameover":
        return "ゲームオーバー（タップ/Spaceキーで再挑戦）";
      case "cleared":
        return "クリア！（タップ/Spaceキーでもう一度）";
      default:
        return "";
    }
  }
}
