import { BOMB_RANGE, COLS, EXPLOSION_MS, ROWS, TILE, Tile } from './constants';
import { createBomb, isBombReadyToExplode, type Bomb, type Explosion } from './bomb';
import { createMap, type GameMap } from './map';
import { createPlayer, type Player } from './player';

export class Engine {
  map: GameMap = createMap();
  player: Player = createPlayer(1, 1);
  bombs: Bomb[] = [];
  explosions: Explosion[] = [];
  keys = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      if (e.key === ' ') {
        e.preventDefault();
        this.placeBomb();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  placeBomb(): void {
    const tx = Math.round(this.player.x);
    const ty = Math.round(this.player.y);
    const active = this.bombs.filter((b) => !isBombReadyToExplode(b, performance.now()));
    if (active.length >= this.player.maxBombs) return;
    if (this.bombs.some((b) => b.x === tx && b.y === ty)) return;
    this.bombs.push(createBomb(tx, ty));
  }

  update(dt: number): void {
    const now = performance.now();
    const p = this.player;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) dx -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) dx += 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) dy -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) dy += 1;

    if (dx !== 0 && dy !== 0) dy = 0; // 대각선 방지 (크아 스타일)

    const nx = p.x + dx * p.speed * dt;
    const ny = p.y + dy * p.speed * dt;

    // 축별 충돌 처리
    if (this.canStand(nx, p.y)) p.x = nx;
    if (this.canStand(p.x, ny)) p.y = ny;

    // 그리드에 스냅 (정지 시)
    if (dx === 0 && dy === 0) {
      p.x = Math.round(p.x * 2) / 2;
      p.y = Math.round(p.y * 2) / 2;
    }

    // 폭탄 폭발
    const remaining: Bomb[] = [];
    for (const b of this.bombs) {
      if (isBombReadyToExplode(b, now)) {
        this.explode(b);
      } else {
        remaining.push(b);
      }
    }
    this.bombs = remaining;

    // 폭발 잔상 제거
    this.explosions = this.explosions.filter(
      (e) => now - e.startedAt < EXPLOSION_MS,
    );
  }

  private canStand(x: number, y: number): boolean {
    // 플레이어 반경 고려한 간단 충돌
    const r = 0.3;
    const corners = [
      [x - r, y - r],
      [x + r, y - r],
      [x - r, y + r],
      [x + r, y + r],
    ];
    return corners.every(([cx, cy]) => {
      const tx = Math.floor(cx + 0.5);
      const ty = Math.floor(cy + 0.5);
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
      if (this.map[ty][tx] !== Tile.Empty) return false;
      // 폭탄 위는 통과 불가 (놓은 직후 1칸은 예외로 두려면 고도화 필요)
      if (this.bombs.some((b) => b.x === tx && b.y === ty)) return false;
      return true;
    });
  }

  private explode(bomb: Bomb): void {
    const cells = [{ x: bomb.x, y: bomb.y }];
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of dirs) {
      for (let i = 1; i <= bomb.range; i++) {
        const x = bomb.x + dx * i;
        const y = bomb.y + dy * i;
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) break;
        const t = this.map[y][x];
        if (t === Tile.Solid) break;
        cells.push({ x, y });
        if (t === Tile.Block) {
          this.map[y][x] = Tile.Empty; // 블록 파괴
          break;
        }
      }
    }
    this.explosions.push({ cells, startedAt: performance.now() });

    // 물줄기에 닿으면 사망 → 리스폰 (프로토타입 규칙)
    const hit = cells.some(
      (c) =>
        Math.floor(this.player.x + 0.5) === c.x &&
        Math.floor(this.player.y + 0.5) === c.y,
    );
    if (hit) {
      this.player.x = 1;
      this.player.y = 1;
    }
    void BOMB_RANGE;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, COLS * TILE, ROWS * TILE);

    // 타일
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = this.map[y][x];
        if (t === Tile.Solid) ctx.fillStyle = '#57534e';
        else if (t === Tile.Block) ctx.fillStyle = '#f59e0b';
        else ctx.fillStyle = (x + y) % 2 === 0 ? '#2a9d3a' : '#279136';
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    // 폭발
    for (const e of this.explosions) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
      for (const c of e.cells) {
        ctx.fillRect(c.x * TILE + 4, c.y * TILE + 4, TILE - 8, TILE - 8);
      }
    }

    // 폭탄
    const now = performance.now();
    for (const b of this.bombs) {
      const blink = Math.floor(now / 200) % 2 === 0;
      ctx.fillStyle = blink ? '#0ea5e9' : '#0369a1';
      ctx.beginPath();
      ctx.arc(
        b.x * TILE + TILE / 2,
        b.y * TILE + TILE / 2,
        TILE * 0.32,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // 플레이어
    ctx.fillStyle = this.player.color;
    ctx.beginPath();
    ctx.arc(
      this.player.x * TILE + TILE / 2,
      this.player.y * TILE + TILE / 2,
      TILE * 0.32,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(
      this.player.x * TILE + TILE / 2 - 8,
      this.player.y * TILE + TILE / 2 - 10,
      6,
      6,
    );
    ctx.fillRect(
      this.player.x * TILE + TILE / 2 + 2,
      this.player.y * TILE + TILE / 2 - 10,
      6,
      6,
    );
  }
}
