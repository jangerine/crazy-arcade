// 외부 에셋 없는 WebAudio 합성 효과음
export type SfxName =
  | 'place'
  | 'explode'
  | 'pickup'
  | 'death'
  | 'win'
  | 'lose'
  | 'click'
  | 'stage';

export class SoundManager {
  private ctx: AudioContext | null = null;
  muted = localStorage.getItem('ca_muted') === '1';

  unlock(): void {
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      // 오디오 미지원 환경 무시
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem('ca_muted', this.muted ? '1' : '0');
    return this.muted;
  }

  play(name: SfxName): void {
    if (this.muted) return;
    try {
      this.unlock();
      const ctx = this.ctx;
      if (!ctx) return;
      const t = ctx.currentTime;
      if (name === 'explode') {
        this.noise(t, 0.35, 800);
        this.tone(t, 'sine', 160, 40, 0.35, 0.5);
      } else if (name === 'place') {
        this.tone(t, 'square', 220, 330, 0.12, 0.15);
      } else if (name === 'pickup') {
        this.tone(t, 'sine', 660, 660, 0.08, 0.2);
        this.tone(t + 0.08, 'sine', 880, 880, 0.1, 0.2);
      } else if (name === 'death') {
        this.tone(t, 'sawtooth', 400, 80, 0.4, 0.3);
      } else if (name === 'win') {
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone(t + i * 0.12, 'triangle', f, f, 0.15, 0.25),
        );
      } else if (name === 'lose') {
        [400, 300, 200, 120].forEach((f, i) =>
          this.tone(t + i * 0.15, 'sawtooth', f, f * 0.9, 0.18, 0.2),
        );
      } else if (name === 'stage') {
        [392, 523, 659, 784].forEach((f, i) =>
          this.tone(t + i * 0.1, 'square', f, f, 0.12, 0.15),
        );
      } else {
        this.tone(t, 'sine', 500, 500, 0.06, 0.15);
      }
    } catch {
      // 무시
    }
  }

  private tone(
    at: number,
    type: OscillatorType,
    from: number,
    to: number,
    dur: number,
    vol: number,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), at + dur);
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g).connect(ctx.destination);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  private noise(at: number, dur: number, cutoff: number): void {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(at);
  }
}

export const sound = new SoundManager();
