import { COLS, EXPLOSION_MS, ROWS, TILE, Tile } from './constants';
import { createBomb, isBombReadyToExplode, type Bomb, type Explosion } from './bomb';
import { spawnEnemies, type Enemy } from './enemy';
import { applyItem, rollItem, type Item } from './item';
import { createMap, type GameMap } from './map';
import { createPlayer, type Player, type PlayerId } from './player';
import { sound } from './sound';
import {
  drawBombs,
  drawEnemies,
  drawItems,
  drawMap,
  drawPlayers,
} from './sprites';
import { stageConfig } from './stage';

export type GameMode = 'battle' | 'solo';
export type GameState = 'menu' | 'playing' | 'paused' | 'over';
export type TouchDir = 'up' | 'down' | 'left' | 'right';

const BEST_KEY = 'ca_best';

export class Engine {
  mode: GameMode = 'battle';
  state: GameState = 'menu';
  map: GameMap = createMap();
  players: Player[] = [];
  enemies: Enemy[] = [];
  bombs: Bomb[] = [];
  explosions: Explosion[] = [];
  items: Item[] = [];
  keys = new Set<string>();
  touchDirs: Record<PlayerId, Set<TouchDir>> = { 1: new Set(), 2: new Set() };
  winner: PlayerId | 0 | null = null; // 배틀용, 0 = 무승부
  stage = 1;
  score = 0;
  best = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  clearBannerUntil = 0;
  private pendingNextStageAt = 0;
  onStateChange: (() => void) | null = null;

  constructor() {
    this.toMenu(false);
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();

      if (this.state === 'menu') return; // 메뉴는 DOM 버튼/Enter 처리
      if (k === 'p' || e.key === 'Escape') {
        this.togglePause();
        return;
      }
      if (k === 'r') {
        this.restart();
        return;
      }
      if (this.state !== 'playing') return;

      // 키 반복 무시 (물풍선 연속 설치 방지)
      if (e.repeat) return;
      this.keys.add(k);

      if (e.key === ' ' || k === 'f') {
        e.preventDefault();
        const p1 = this.players[0];
        if (p1) this.placeBomb(p1);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const p2 = this.players[1];
        if (p2) this.placeBomb(p2);
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange?.();
  }

  toMenu(notify = true): void {
    this.mode = 'battle';
    this.map = createMap();
    this.players = [];
    this.enemies = [];
    this.bombs = [];
    this.explosions = [];
    this.items = [];
    this.winner = null;
    this.stage = 1;
    this.score = 0;
    this.pendingNextStageAt = 0;
    this.clearBannerUntil = 0;
    this.state = 'menu';
    if (notify) this.onStateChange?.();
  }

  startBattle(): void {
    sound.unlock();
    sound.play('click');
    this.mode = 'battle';
    this.map = createMap(0.6);
    const p1 = createPlayer(1, 1, 1, '#3b82f6', '1P');
    const p2 = createPlayer(COLS - 2, ROWS - 2, 2, '#ef4444', '2P');
    p1.invincibleUntil = performance.now() + 1000;
    p2.invincibleUntil = performance.now() + 1000;
    this.players = [p1, p2];
    this.enemies = [];
    this.bombs = [];
    this.explosions = [];
    this.items = [];
    this.touchDirs = { 1: new Set(), 2: new Set() };
    this.winner = null;
    this.stage = 1;
    this.score = 0;
    this.pendingNextStageAt = 0;
    this.clearBannerUntil = 0;
    this.setState('playing');
  }

  startSolo(): void {
    sound.unlock();
    sound.play('click');
    this.mode = 'solo';
    this.stage = 1;
    this.score = 0;
    this.winner = null;
    this.setupStage();
    this.setState('playing');
  }

  restart(): void {
    if (this.mode === 'solo') this.startSolo();
    else this.startBattle();
  }

  togglePause(): void {
    if (this.state === 'playing') {
      this.setState('paused');
      sound.play('click');
    } else if (this.state === 'paused') {
      this.setState('playing');
      sound.play('click');
    }
  }

  private setupStage(): void {
    const cfg = stageConfig(this.stage);
    this.map = createMap(cfg.density, [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ]);
    const prev = this.players[0];
    const p = createPlayer(1, 1, 1, '#3b82f6', '1P');
    if (prev) {
      // 파워업·점수는 스테이지 간 유지
      p.maxBombs = prev.maxBombs;
      p.range = prev.range;
      p.speed = prev.speed;
      p.lives = Math.max(prev.lives, 1);
    }
    p.invincibleUntil = performance.now() + 2000;
    this.players = [p];
    this.bombs = [];
    this.explosions = [];
    this.items = [];
    this.touchDirs = { 1: new Set(), 2: new Set() };
    this.enemies = spawnEnemies(this.stage, this.map, this.players);
    this.pendingNextStageAt = 0;
    this.clearBannerUntil = 0;
  }

  private nextStage(): void {
    this.stage += 1;
    this.score += 1000;
    sound.play('stage');
    this.setupStage();
  }

  // --- 모바일 터치 API ---
  touchDown(id: PlayerId, dir: TouchDir): void {
    this.touchDirs[id].add(dir);
  }

  touchUp(id: PlayerId, dir: TouchDir): void {
    this.touchDirs[id].delete(dir);
  }

  pressBomb(id: PlayerId): void {
    const p = this.players.find((pl) => pl.id === id);
    if (p) this.placeBomb(p);
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
    if (this.map[ty]?.[tx] !== Tile.Empty) return;
    if (this.items.some((it) => it.x === tx && it.y === ty)) return;
    this.bombs.push(createBomb(tx, ty, player.id, player.range, now));
    sound.play('place');
  }

  private killPlayer(p: Player, now: number): void {
    if (!p.alive || now < p.invincibleUntil) return;
    if (this.mode === 'solo' && p.lives > 1) {
      p.lives -= 1;
      p.x = p.spawnX;
      p.y = p.spawnY;
      p.invincibleUntil = now + 2000;
      sound.play('death');
      return;
    }
    p.alive = false;
    p.lives = 0;
    sound.play('death');
  }

  update(dt: number): void {
    const now = performance.now();
    this.explosions = this.explosions.filter(
      (e) => now - e.startedAt < EXPLOSION_MS,
    );
    if (this.state !== 'playing') return;

    // 솔로 스테이지 전환 예약
    if (this.pendingNextStageAt !== 0 && now >= this.pendingNextStageAt) {
      this.pendingNextStageAt = 0;
      this.nextStage();
      return;
    }

    // 플레이어 이동
    for (const p of this.players) {
      if (!p.alive) continue;
      const { dx, dy } = this.inputFor(p.id);
      if (dx === -1) p.facing = 'left';
      else if (dx === 1) p.facing = 'right';
      else if (dy === -1) p.facing = 'up';
      else if (dy === 1) p.facing = 'down';
      const nx = p.x + dx * p.speed * dt;
      const ny = p.y + dy * p.speed * dt;
      if (this.canStandEntity(nx, p.y, p.x, p.y, true)) p.x = nx;
      if (this.canStandEntity(p.x, ny, p.x, p.y, true)) p.y = ny;
      if (dx === 0 && dy === 0) {
        p.x = Math.round(p.x * 2) / 2;
        p.y = Math.round(p.y * 2) / 2;
      }
    }

    // 적 AI 이동
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (now >= e.retargetAt) {
        const dir = this.chooseEnemyDir(e);
        e.dx = dir.dx;
        e.dy = dir.dy;
        e.retargetAt = now + 600 + Math.random() * 900;
      }
      const nx = e.x + e.dx * e.speed * dt;
      const ny = e.y + e.dy * e.speed * dt;
      if (this.canStandEntity(nx, e.y, e.x, e.y, false)) {
        e.x = nx;
      } else {
        e.dx = 0;
        e.retargetAt = 0; // 다음 틱에 즉시 재탐색
      }
      if (this.canStandEntity(e.x, ny, e.x, e.y, false)) {
        e.y = ny;
      } else {
        e.dy = 0;
        e.retargetAt = 0;
      }
    }

    // 아이템 줍기
    for (const p of this.players) {
      if (!p.alive) continue;
      const ptx = Math.floor(p.x + 0.5);
      const pty = Math.floor(p.y + 0.5);
      const idx = this.items.findIndex((it) => it.x === ptx && it.y === pty);
      if (idx !== -1) {
        const [picked] = this.items.splice(idx, 1);
        applyItem(p, picked.kind);
        this.score += 50;
        sound.play('pickup');
      }
    }

    // 적과 접촉 → 사망
    for (const p of this.players) {
      if (!p.alive || now < p.invincibleUntil) continue;
      const touched = this.enemies.some(
        (e) =>
          e.alive && Math.abs(e.x - p.x) < 0.6 && Math.abs(e.y - p.y) < 0.6,
      );
      if (touched) this.killPlayer(p, now);
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

    if (this.mode === 'battle') {
      const alive = this.players.filter((p) => p.alive);
      if (alive.length <= 1 && this.players.length === 2) {
        if (alive.length === 1) {
          this.winner = alive[0].id;
        } else if (alive.length === 0) {
          this.winner = 0;
        } else {
          return;
        }
        this.gameOver();
      }
    } else {
      // 솔로: 적이 전멸하면 스테이지 클리어
      if (
        this.enemies.length > 0 &&
        this.enemies.every((e) => !e.alive) &&
        this.pendingNextStageAt === 0
      ) {
        this.score += 500;
        this.clearBannerUntil = now + 2000;
        this.pendingNextStageAt = now + 2000;
        sound.play('stage');
      }
      // 솔로: 플레이어 사망 → 게임오버
      if (this.players.every((p) => !p.alive)) {
        this.gameOver();
      }
    }
  }

  private gameOver(): void {
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
    }
    if (this.mode === 'solo') sound.play('lose');
    else sound.play(this.winner === 0 ? 'lose' : 'win');
    this.setState('over');
  }

  private chooseEnemyDir(e: Enemy): { dx: number; dy: number } {
    // 가장 가까운 생존 플레이어 추적 (근거리 60% 확률)
    let target: Player | null = null;
    let bestDist = Infinity;
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
      if (d < bestDist) {
        bestDist = d;
        target = p;
      }
    }
    const tryDirs: { dx: number; dy: number }[] = [];
    if (target && bestDist <= 6 && Math.random() < 0.65) {
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        tryDirs.push({ dx: Math.sign(dx), dy: 0 });
        if (dy !== 0) tryDirs.push({ dx: 0, dy: Math.sign(dy) });
      } else {
        tryDirs.push({ dx: 0, dy: Math.sign(dy) });
        if (dx !== 0) tryDirs.push({ dx: Math.sign(dx), dy: 0 });
      }
    }
    const all = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ].sort(() => Math.random() - 0.5);
    for (const d of all) {
      if (!tryDirs.some((t) => t.dx === d.dx && t.dy === d.dy)) tryDirs.push(d);
    }
    for (const d of tryDirs) {
      if (
        this.canStandEntity(e.x + d.dx * 0.5, e.y + d.dy * 0.5, e.x, e.y, false)
      ) {
        return d;
      }
    }
    return { dx: 0, dy: 0 };
  }

  private inputFor(id: PlayerId): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;
    if (id === 1) {
      if (this.keys.has('a')) dx -= 1;
      if (this.keys.has('d')) dx += 1;
      if (this.keys.has('w')) dy -= 1;
      if (this.keys.has('s')) dy += 1;
    } else {
      if (this.keys.has('arrowleft')) dx -= 1;
      if (this.keys.has('arrowright')) dx += 1;
      if (this.keys.has('arrowup')) dy -= 1;
      if (this.keys.has('arrowdown')) dy += 1;
    }
    const t = this.touchDirs[id];
    if (t.has('left')) dx -= 1;
    if (t.has('right')) dx += 1;
    if (t.has('up')) dy -= 1;
    if (t.has('down')) dy += 1;

    if (dx !== 0) dx = Math.sign(dx);
    if (dy !== 0) dy = Math.sign(dy);
    if (dx !== 0 && dy !== 0) dy = 0; // 대각선 방지
    return { dx, dy };
  }

  private canStandEntity(
    x: number,
    y: number,
    selfX: number,
    selfY: number,
    allowEscape: boolean,
  ): boolean {
    const r = 0.3;
    const selfTX = Math.round(selfX);
    const selfTY = Math.round(selfY);
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
        if (allowEscape && bomb.x === selfTX && bomb.y === selfTY) return true;
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
    const destroyedBlocks: { x: number; y: number }[] = [];
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
          destroyedBlocks.push({ x, y });
          break;
        }
      }
    }
    this.score += destroyedBlocks.length * 10;

    this.items = this.items.filter(
      (it) => !cells.some((c) => c.x === it.x && c.y === it.y),
    );
    for (const b of destroyedBlocks) {
      if (this.items.some((it) => it.x === b.x && it.y === b.y)) continue;
      const dropped = rollItem(b.x, b.y);
      if (dropped) this.items.push(dropped);
    }

    this.explosions.push({ cells, startedAt: now });
    sound.play('explode');

    for (const other of this.bombs) {
      if (other === bomb) continue;
      if (cells.some((c) => c.x === other.x && c.y === other.y)) {
        other.placedAt = 0;
      }
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const etx = Math.floor(e.x + 0.5);
      const ety = Math.floor(e.y + 0.5);
      if (cells.some((c) => c.x === etx && c.y === ety)) {
        e.alive = false;
        this.score += 500;
      }
    }

    for (const p of this.players) {
      if (!p.alive) continue;
      const ptx = Math.floor(p.x + 0.5);
      const pty = Math.floor(p.y + 0.5);
      if (cells.some((c) => c.x === ptx && c.y === pty)) {
        this.killPlayer(p, now);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();
    drawMap(ctx, this.map);
    drawItems(ctx, this.items);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
    for (const e of this.explosions) {
      for (const c of e.cells) {
        ctx.fillRect(c.x * TILE + 4, c.y * TILE + 4, TILE - 8, TILE - 8);
      }
    }

    drawBombs(ctx, this.bombs, (id) => {
      const o = this.players.find((p) => p.id === id);
      return o?.color ?? '#0ea5e9';
    });
    drawEnemies(ctx, this.enemies);
    drawPlayers(ctx, this.players, now);

    if (this.state === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, COLS * TILE, ROWS * TILE);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 40px system-ui';
      ctx.fillText('일시정지', (COLS * TILE) / 2, (ROWS * TILE) / 2);
      ctx.font = '17px system-ui';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('P / Esc로 계속', (COLS * TILE) / 2, (ROWS * TILE) / 2 + 30);
    }

    if (
      this.mode === 'solo' &&
      this.state === 'playing' &&
      now < this.clearBannerUntil
    ) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, COLS * TILE, ROWS * TILE);
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'center';
      ctx.font = 'bold 40px system-ui';
      ctx.fillText(
        `STAGE ${this.stage} CLEAR!`,
        (COLS * TILE) / 2,
        (ROWS * TILE) / 2,
      );
    }

    if (this.state === 'over') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, COLS * TILE, ROWS * TILE);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px system-ui';
      let msg: string;
      if (this.mode === 'battle') {
        msg =
          this.winner === 0
            ? '무승부!'
            : this.winner === 1
              ? '1P(파랑) 승리!'
              : '2P(빨강) 승리!';
      } else {
        msg = `GAME OVER · STAGE ${this.stage}`;
      }
      ctx.fillText(msg, (COLS * TILE) / 2, (ROWS * TILE) / 2 - 16);
      ctx.font = '18px system-ui';
      ctx.fillStyle = '#fde047';
      ctx.fillText(
        `SCORE ${this.score} · BEST ${this.best}`,
        (COLS * TILE) / 2,
        (ROWS * TILE) / 2 + 16,
      );
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(
        'R / 버튼으로 재시작',
        (COLS * TILE) / 2,
        (ROWS * TILE) / 2 + 44,
      );
    }
  }
}
