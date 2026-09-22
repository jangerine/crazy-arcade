import { COLS, EXPLOSION_MS, ROWS, TILE, Tile } from './constants';
import { createBomb, isBombReadyToExplode, type Bomb, type Explosion } from './bomb';
import { createMap, type GameMap } from './map';
import { createPlayer, type Player, type PlayerId } from './player';

export type GameState = 'playing' | 'over';

export class Engine {
  map: GameMap = createMap();
  players: Player[] = [
    createPlayer(1, 1, 1, '#3b82f6', '1P'),
    createPlayer(COLS - 2, ROWS - 2, 2, '#ef4444', '2P'),
  ];
  bombs: Bomb[] = [];
  explosions: Explosion[] = [];
  keys = new Set<string>();
  state: GameState = 'playing';
  winner: PlayerId | 0 | null = null; // 0 = 무승부

  constructor() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();

      // 게임오버 → R로 재시작
      if (this.state === 'over' && k === 'r') {
        this.restart();
        return;
      }

      // 키 반복 무시 (물풍선 연속 설치 방지)
      if (e.repeat) return;
      this.keys.add(k);

      if (e.key === ' ' || k === 'f') {
        e.preventDefault();
        this.placeBomb(this.players[0]);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        this.placeBomb(this.players[1]);
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  restart(): void {
    this.map = createMap();
    this.players = [
      createPlayer(1, 1, 1, '#3b82f6', '1P'),
      createPlayer(COLS - 2, ROWS - 2, 2, '#ef4444', '2P'),
    ];
    this.bombs = [];
    this.explosions = [];
    this.state = 'playing';
    this.winner = null;
  }

  placeBomb(player: Player): void {
    if (this.state !== 'playing' || !player.alive) return;
    const now = performance.now();
    const tx = Math.round(player.x);
    const ty = Math.round(player.y);
    const active = this.bombs.filter(
      (b) => b.ownerId === player.id && !isBombReadyToExplode(b, now),
    );
    if (active.length >= player.maxBombs) return;
    if (this.bombs.some((b) => b.x === tx && b.y === ty)) return;
    // 폭탄은 빈 타일에만 (플레이어 발밑이 빈칸이므로 사실상 항상 가능)
    if (this.map[ty]?.[tx] !== Tile.Empty) return;
    this.bombs.push(createBomb(tx, ty, player.id, now));
  }

  update(dt: number): void {
    const now = performance.now();

    // 폭발 잔상 제거는 항상
    this.explosions = this.explosions.filter(
      (e) => now - e.startedAt < EXPLOSION_MS,
    );
    if (this.state !== 'playing') return;

    for (const p of this.players) {
      if (!p.alive) continue;
      const { dx, dy } = this.inputFor(p.id);
      const nx = p.x + dx * p.speed * dt;
      const ny = p.y + dy * p.speed * dt;

      if (this.canStand(nx, p.y, p)) p.x = nx;
      if (this.canStand(p.x, ny, p)) p.y = ny;

      if (dx === 0 && dy === 0) {
        p.x = Math.round(p.x * 2) / 2;
        p.y = Math.round(p.y * 2) / 2;
      }
    }

    // 폭탄 폭발 (+ 연쇄 폭발)
    let guard = 0;
    let exploded = true;
    while (exploded && guard++ < 10) {
      exploded = false;
      const remaining: Bomb[] = [];
      for (const b of this.bombs) {
        if (isBombReadyToExplode(b, now)) {
          this.explode(b, now);
          exploded = true;
        } else {
          remaining.push(b);
        }
      }
      this.bombs = remaining;
    }

    // 승패 판정
    const alive = this.players.filter((p) => p.alive);
    if (alive.length <= 1 && this.players.length === 2) {
      // 최소 1틱은 진행된 후 판정 (스폰킬 방지용 가드 아님, 즉시 판정)
      if (alive.length === 1) {
        this.state = 'over';
        this.winner = alive[0].id;
      } else if (alive.length === 0) {
        this.state = 'over';
        this.winner = 0;
      }
    }
  }

  private inputFor(id: PlayerId): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;
    if (id === 1) {
      // 1P: WASD
      if (this.keys.has('a')) dx -= 1;
      if (this.keys.has('d')) dx += 1;
      if (this.keys.has('w')) dy -= 1;
      if (this.keys.has('s')) dy += 1;
    } else {
      // 2P: 방향키
      if (this.keys.has('arrowleft')) dx -= 1;
      if (this.keys.has('arrowright')) dx += 1;
      if (this.keys.has('arrowup')) dy -= 1;
      if (this.keys.has('arrowdown')) dy += 1;
    }
    if (dx !== 0 && dy !== 0) dy = 0; // 대각선 방지
    return { dx, dy };
  }

  private canStand(x: number, y: number, self: Player): boolean {
    const r = 0.3;
    const selfTX = Math.round(self.x);
    const selfTY = Math.round(self.y);
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
      const bomb = this.bombs.find((b) => b.x === tx && b.y === ty);
      if (bomb) {
        // 방금 놓은 폭탄 위에서는 빠져나올 수 있게 허용
        if (bomb.x === selfTX && bomb.y === selfTY) return true;
        return false;
      }
      return true;
    });
  }

  private explode(bomb: Bomb, now: number): void {
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
          this.map[y][x] = Tile.Empty;
          break;
        }
      }
    }
    this.explosions.push({ cells, startedAt: now });

    // 연쇄 폭발: 물줄기에 닿은 다른 폭탄은 즉시 터지게
    for (const other of this.bombs) {
      if (other === bomb) continue;
      if (cells.some((c) => c.x === other.x && c.y === other.y)) {
        other.placedAt = 0;
      }
    }

    // 물줄기에 닿은 플레이어 사망
    for (const p of this.players) {
      if (!p.alive) continue;
      const ptx = Math.floor(p.x + 0.5);
      const pty = Math.floor(p.y + 0.5);
      if (cells.some((c) => c.x === ptx && c.y === pty)) {
        p.alive = false;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, COLS * TILE, ROWS * TILE);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = this.map[y][x];
        if (t === Tile.Solid) ctx.fillStyle = '#57534e';
        else if (t === Tile.Block) ctx.fillStyle = '#f59e0b';
        else ctx.fillStyle = (x + y) % 2 === 0 ? '#2a9d3a' : '#279136';
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    for (const e of this.explosions) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
      for (const c of e.cells) {
        ctx.fillRect(c.x * TILE + 4, c.y * TILE + 4, TILE - 8, TILE - 8);
      }
    }

    const now = performance.now();
    for (const b of this.bombs) {
      const blink = Math.floor(now / 200) % 2 === 0;
      const owner = this.players.find((p) => p.id === b.ownerId);
      ctx.fillStyle = blink
        ? (owner?.color ?? '#0ea5e9')
        : '#0c4a6e';
      ctx.beginPath();
      ctx.arc(
        b.x * TILE + TILE / 2,
        b.y * TILE + TILE / 2,
        TILE * 0.32,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(
        `P${b.ownerId}`,
        b.x * TILE + TILE / 2,
        b.y * TILE + TILE / 2 + 4,
      );
    }

    for (const p of this.players) {
      const cx = p.x * TILE + TILE / 2;
      const cy = p.y * TILE + TILE / 2;
      if (!p.alive) {
        // 사망 표시: X
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy - 10);
        ctx.lineTo(cx + 10, cy + 10);
        ctx.moveTo(cx + 10, cy - 10);
        ctx.lineTo(cx - 10, cy + 10);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cx, cy, TILE * 0.32, 0, Math.PI * 2);
      ctx.fill();
      // 눈
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - 8, cy - 10, 6, 6);
      ctx.fillRect(cx + 2, cy - 10, 6, 6);
      // 이름표
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, cx, cy + 22);
    }

    if (this.state === 'over') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, COLS * TILE, ROWS * TILE);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 42px system-ui';
      const msg =
        this.winner === 0
          ? '무승부!'
          : this.winner === 1
            ? '1P(파랑) 승리!'
            : '2P(빨강) 승리!';
      ctx.fillText(msg, (COLS * TILE) / 2, (ROWS * TILE) / 2 - 10);
      ctx.font = '18px system-ui';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(
        'R 키로 재시작',
        (COLS * TILE) / 2,
        (ROWS * TILE) / 2 + 28,
      );
    }
  }
}
