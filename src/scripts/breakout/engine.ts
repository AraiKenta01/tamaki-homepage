/**
 * ブロック崩しのゲームロジック本体。
 * DOM描画（Canvas）以外の外部システムには一切依存しない。
 * スコアの永続化・送信は score-store.ts 側の責務であり、
 * ここではコールバック経由で「今のスコア」を通知するだけに留める
 * （将来ランキングAPIに差し替える際、このファイルは変更不要にするため）。
 */

export type GameState = "ready" | "playing" | "paused" | "gameover" | "cleared";

export interface BreakoutCallbacks {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onStateChange?: (state: GameState) => void;
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
  alive: boolean;
}

const ROWS = 5;
const COLS = 8;
const BRICK_GAP = 4;
const BRICK_HEIGHT = 16;
const PADDLE_HEIGHT = 10;
const BALL_RADIUS = 5;
const INITIAL_LIVES = 3;
const BASE_BALL_SPEED = 220; // px/sec
const PADDLE_SPEED = 360; // px/sec

export class BreakoutEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: BreakoutCallbacks;

  private width = 0;
  private height = 0;

  private paddle: Paddle;
  private ball: Ball;
  private bricks: Brick[] = [];

  private score = 0;
  private lives = INITIAL_LIVES;
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

  private readonly onPointerDown = () => {
    this.handlePrimaryAction();
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
    this.ball = this.createBall();
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

  /** スペース/Enter/タップに応じて「開始」または「再挑戦」を行う。 */
  handlePrimaryAction(): void {
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
    this.paddle = this.createPaddle();
    this.ball = this.createBall();
    this.bricks = this.createBricks();
    this.setScore(0);
    this.setLives(INITIAL_LIVES);
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
    const width = 80;
    return {
      x: (this.width - width) / 2,
      width,
      height: PADDLE_HEIGHT,
      speed: PADDLE_SPEED,
    };
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

  private createBricks(): Brick[] {
    const bricks: Brick[] = [];
    const brickWidth = (this.width - BRICK_GAP * (COLS + 1)) / COLS;
    const offsetTop = 30;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        bricks.push({
          x: BRICK_GAP + col * (brickWidth + BRICK_GAP),
          y: offsetTop + BRICK_GAP + row * (BRICK_HEIGHT + BRICK_GAP),
          width: brickWidth,
          height: BRICK_HEIGHT,
          alive: true,
        });
      }
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

  private update(dt: number): void {
    // パドル移動（キーボード優先、なければポインタ追従）
    if (this.movingLeft && !this.movingRight) {
      this.paddle.x -= this.paddle.speed * dt;
    } else if (this.movingRight && !this.movingLeft) {
      this.paddle.x += this.paddle.speed * dt;
    } else if (this.pointerTargetX !== null) {
      const target = this.pointerTargetX - this.paddle.width / 2;
      const diff = target - this.paddle.x;
      const maxStep = this.paddle.speed * dt;
      this.paddle.x += Math.max(-maxStep, Math.min(maxStep, diff));
    }
    this.paddle.x = Math.max(0, Math.min(this.width - this.paddle.width, this.paddle.x));

    // ボール移動
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    // 壁反射
    if (this.ball.x - this.ball.radius < 0) {
      this.ball.x = this.ball.radius;
      this.ball.vx *= -1;
    } else if (this.ball.x + this.ball.radius > this.width) {
      this.ball.x = this.width - this.ball.radius;
      this.ball.vx *= -1;
    }
    if (this.ball.y - this.ball.radius < 0) {
      this.ball.y = this.ball.radius;
      this.ball.vy *= -1;
    }

    // パドル反射
    const paddleY = this.height - 20;
    if (
      this.ball.vy > 0 &&
      this.ball.y + this.ball.radius >= paddleY &&
      this.ball.y + this.ball.radius <= paddleY + this.paddle.height &&
      this.ball.x >= this.paddle.x &&
      this.ball.x <= this.paddle.x + this.paddle.width
    ) {
      this.ball.y = paddleY - this.ball.radius;
      const hitPos = (this.ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
      const speed = Math.hypot(this.ball.vx, this.ball.vy);
      const angle = hitPos * (Math.PI / 3); // 最大60度で反射角を変える
      this.ball.vx = speed * Math.sin(angle);
      this.ball.vy = -Math.abs(speed * Math.cos(angle));
    }

    // ブロック衝突
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      if (
        this.ball.x + this.ball.radius > brick.x &&
        this.ball.x - this.ball.radius < brick.x + brick.width &&
        this.ball.y + this.ball.radius > brick.y &&
        this.ball.y - this.ball.radius < brick.y + brick.height
      ) {
        brick.alive = false;
        this.ball.vy *= -1;
        this.setScore(this.score + 10);
        break;
      }
    }

    // 落下判定
    if (this.ball.y - this.ball.radius > this.height) {
      const remaining = this.lives - 1;
      this.setLives(remaining);
      if (remaining <= 0) {
        this.setState("gameover");
      } else {
        this.ball = this.createBall();
      }
    }

    // クリア判定
    if (this.bricks.every((b) => !b.alive)) {
      this.setState("cleared");
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#0f0f23";
    ctx.fillRect(0, 0, this.width, this.height);

    // ブロック
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      ctx.fillStyle = "#8b0000";
      ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
      ctx.strokeStyle = "#f5f2e9";
      ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
    }

    // パドル
    ctx.fillStyle = "#f5f2e9";
    ctx.fillRect(this.paddle.x, this.height - 20, this.paddle.width, this.paddle.height);

    // ボール
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd700";
    ctx.fill();

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
        return "クリックまたはSpaceキーでスタート";
      case "paused":
        return "一時停止中（Spaceキーで再開）";
      case "gameover":
        return "ゲームオーバー（Spaceキーで再挑戦）";
      case "cleared":
        return "クリア！（Spaceキーでもう一度）";
      default:
        return "";
    }
  }
}
