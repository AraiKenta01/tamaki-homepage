/**
 * 効果音。外部音声ファイルは使わず、Web Audio APIでその場で波形を合成する
 * （レトロなチップチューン風の質感になり、アセット追加ゼロで済む）。
 * AudioContextはブラウザの自動再生制限があるため、ユーザー操作（スタート等）の
 * タイミングで初回生成・resumeする。
 */

type ToneShape = "square" | "triangle" | "sine" | "sawtooth";

export class BreakoutSound {
  private ctx: AudioContext | null = null;

  /** ユーザー操作のハンドラ内で呼ぶこと（自動再生制限の回避）。 */
  ensureReady(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  private tone(freq: number, durationSec: number, shape: ToneShape, volume = 0.2): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = shape;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationSec);
  }

  /** ブロック破壊。段数が浅い（残りHPが多い）ほど低め、壊れるほど高くなる。 */
  brickHit(pitchLevel: number): void {
    const freq = 440 + pitchLevel * 90;
    this.tone(freq, 0.09, "square", 0.15);
  }

  paddleHit(): void {
    this.tone(180, 0.07, "triangle", 0.2);
  }

  wallBounce(): void {
    this.tone(300, 0.04, "sine", 0.08);
  }

  lifeLost(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    [420, 320, 220].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      const start = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  powerUp(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    [520, 660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      const start = ctx.currentTime + i * 0.06;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.1);
    });
  }

  gameOver(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    [330, 294, 262, 220].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      const start = ctx.currentTime + i * 0.16;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  }

  cleared(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      const start = ctx.currentTime + i * 0.1;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  }
}

export const breakoutSound = new BreakoutSound();
