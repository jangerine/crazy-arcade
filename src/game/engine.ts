import { BOMB_FUSE_MS, COLS, EXPLOSION_MS, ROWS, TILE, Tile } from './constants';
import { createBomb, isBombReadyToExplode, type Bomb, type Explosion } from './bomb';
import { spawnEnemies, type Enemy } from './enemy';
import { applyItem, rollItem, type Item } from './item';
import { type GameMap } from './map';
import {
  buildSelectedMap,
  getMapDef,
  loadMapId,
  themeFor,
} from './maps';
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
import type { Snapshot } from './net';

export type GameMode = 'battle' | 'solo' | 'online';
export type OnlineRole = 'host' | 'guest' | null;
export type GameState = 'menu' | 'playing' | 'paused' | 'over';
export type TouchDir = 'up' | 'down' | 'left' | 'right';

const BEST_KEY = 'ca_best';
const SNAP_SEND_MS = 66;

export class Engine {
  mode: GameMode = 'battle';
  onlineRole: OnlineRole = null;
  state: GameState = 'menu';
  mapId: string = loadMapId();
  map: GameMap = buildSelectedMap(this.mapId).map;
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
  /** 폭탄별 통과 허용 엔티티 (설치 순간 밟고 있던 주체. 갇힘 방지용) */
  private bombPass = new Map<Bomb, Set<string>>();
  /** 온라인 host가 guest에게 받은 최신 입력 (P2 조종용) */
  guestInput = { dx: 0, dy: 0 };
  /** 스냅샷 방송 훅 (main에서 net.sendSnap 연결) */
  onSnapshot: ((snap: Snapshot) => void) | null = null;
  /** 온라인 guest 로컬 폭탄키 → net 전송 훅 */
  onGuestBombLocal: (() => void) | null = null;
  /** 온라인 guest R키 → 재시작 요청 훅 */
  onRestartReqLocal: (() => void) | null = null;
  private pendingNextStageAt = 0;
  private nextFxId = 1;
  private lastSnapSent = 0;
  onStateChange: (() => void) | null = null;

  constructor() {
    this.toMenu(false);
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();

      if (this.state === 'menu') return; // 메뉴는 DOM 버튼/Enter 처리
      const online = this.mode === 'online';
      const guest = online && this.onlineRole === 'guest';
      if ((k === 'p' || e.key === 'Escape') && !online) {
        this.togglePause();
        return;
      }
      if (k === 'r') {
        if (guest) this.onRestartReqLocal?.();
        else this.restart();
        return;
      }
      if (this.state !== 'playing') return;

      // 키 반복 무시 (물풍선 연속 설치 방지)
      if (e.repeat) return;
      this.keys.add(k);

      if (e.key === ' ' || k === 'f') {
        e.preventDefault();
        if (guest) {
          this.onGuestBombLocal?.();
          return;
        }
        const p1 = this.players[0];
        if (p1) this.placeBomb(p1);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (guest) {
          this.onGuestBombLocal?.();
          return;
        }
        if (online) return; // host의 P2는 guest 입력으로만 조종
        const p2 = this.players[1];
        if (p2) this.placeBomb(p2);
        else if (this.mode === 'solo') {
          // 솔로에선 Enter도 1P 물풍선 (방향키+Enter 원작 조합)
          const p1 = this.players[0];
          if (p1) this.placeBomb(p1);
        }
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
    this.onlineRole = null;
    this.guestInput = { dx: 0, dy: 0 };
    this.map = buildSelectedMap(this.mapId).map;
    this.players = [];
    this.enemies = [];
    this.bombs = [];
    this.bombPass.clear();
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
    this.onlineRole = null;
    this.guestInput = { dx: 0, dy: 0 };
    const built = buildSelectedMap(this.mapId);
    this.map = built.map;
    const p1 = createPlayer(built.spawns[0].x, built.spawns[0].y, 1, '#3b82f6', '1P');
    const p2 = createPlayer(built.spawns[1].x, built.spawns[1].y, 2, '#ef4444', '2P');
    p1.invincibleUntil = performance.now() + 1000;
    p2.invincibleUntil = performance.now() + 1000;
    this.players = [p1, p2];
    this.enemies = [];
    this.bombs = [];
    this.bombPass.clear();
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
    this.onlineRole = null;
    this.stage = 1;
    this.score = 0;
    this.winner = null;
    this.setupStage();
    this.setState('playing');
  }

  /** 온라인 host: 배틀 필드 생성 + P2는 guest 입력으로 조종 */
  startOnlineHost(): void {
    sound.unlock();
    this.mode = 'online';
    this.onlineRole = 'host';
    const built = buildSelectedMap(this.mapId);
    this.map = built.map;
    const p1 = createPlayer(built.spawns[0].x, built.spawns[0].y, 1, '#3b82f6', '1P(HOST)');
    const p2 = createPlayer(built.spawns[1].x, built.spawns[1].y, 2, '#ef4444', '2P(GUEST)');
    const now = performance.now();
    p1.invincibleUntil = now + 1000;
    p2.invincibleUntil = now + 1000;
    this.players = [p1, p2];
    this.enemies = [];
    this.bombs = [];
    this.bombPass.clear();
    this.explosions = [];
    this.items = [];
    this.touchDirs = { 1: new Set(), 2: new Set() };
    this.guestInput = { dx: 0, dy: 0 };
    this.winner = null;
    this.stage = 1;
    this.score = 0;
    this.pendingNextStageAt = 0;
    this.clearBannerUntil = 0;
    this.lastSnapSent = 0;
    this.setState('playing');
    this.emitSnapshot(true);
  }

  /** 온라인 guest: 첫 스냅샷이 오기 전까지 빈 필드로 대기 */
  prepareOnlineGuest(): void {
    this.mode = 'online';
    this.onlineRole = 'guest';
    this.map = buildSelectedMap(this.mapId).map;
    this.players = [];
    this.enemies = [];
    this.bombs = [];
    this.bombPass.clear();
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

  /** guest가 보낼 로컬 P2 입력 (키보드 방향키 + 터치 패드 2) */
  localP2Input(): { dx: number; dy: number } {
    return this.inputFor(2);
  }

  toSnapshot(): Snapshot {
    const now = performance.now();
    return {
      v: 1,
      state: this.state === 'over' ? 'over' : 'playing',
      winner: this.winner,
      score: this.score,
      stage: this.stage,
      mapId: this.mapId,
      map: this.map.map((row) => [...row]),
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        speed: p.speed,
        maxBombs: p.maxBombs,
        range: p.range,
        color: p.color,
        alive: p.alive,
        lives: p.lives,
        facing: p.facing,
        invincibleIn: Math.max(0, p.invincibleUntil - now),
      })),
      bombs: this.bombs.map((b) => ({
        x: b.x,
        y: b.y,
        range: b.range,
        ownerId: b.ownerId,
        fuseIn: Math.max(0, BOMB_FUSE_MS - (now - b.placedAt)),
      })),
      items: this.items.map((it) => ({ ...it })),
      explosions: this.explosions.map((e) => ({
        id: e.id,
        cells: e.cells.map((c) => ({ ...c })),
        age: now - e.startedAt,
      })),
    };
  }

  applySnapshot(snap: Snapshot): void {
    const now = performance.now();
    this.mapId = getMapDef(snap.mapId).id;
    this.map = snap.map.map((row) => [...row]) as GameMap;
    this.players = snap.players.map((s) => ({
      id: s.id,
      name: s.name,
      x: s.x,
      y: s.y,
      spawnX: s.x,
      spawnY: s.y,
      speed: s.speed,
      maxBombs: s.maxBombs,
      range: s.range,
      color: s.color,
      alive: s.alive,
      lives: s.lives,
      facing: s.facing,
      invincibleUntil: now + s.invincibleIn,
    }));
    this.bombPass.clear();
    this.bombs = snap.bombs.map((s) => ({
      x: s.x,
      y: s.y,
      placedAt: now - (BOMB_FUSE_MS - s.fuseIn),
      range: s.range,
      ownerId: s.ownerId,
    }));
    this.items = snap.items.map((it) => ({ ...it }));
    this.explosions = snap.explosions.map((e) => ({
      id: e.id,
      cells: e.cells.map((c) => ({ ...c })),
      startedAt: now - e.age,
    }));
    this.winner = snap.winner;
    this.score = snap.score;
    this.stage = snap.stage;
    if (this.state !== snap.state) this.setState(snap.state);
  }

  /** host 루프에서 호출: 스로틀된 스냅샷 방송 */
  emitSnapshot(force = false): void {
    if (this.mode !== 'online' || this.onlineRole !== 'host') return;
    if (!this.onSnapshot) return;
    const now = performance.now();
    if (!force && now - this.lastSnapSent < SNAP_SEND_MS) return;
    this.lastSnapSent = now;
    this.onSnapshot(this.toSnapshot());
  }

  restart(): void {
    if (this.mode === 'solo') this.startSolo();
    else if (this.mode === 'online') {
      if (this.onlineRole === 'host') this.startOnlineHost();
    } else this.startBattle();
  }

  togglePause(): void {
    if (this.mode === 'online') return; // 온라인은 일시정지 미지원
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
    const built = buildSelectedMap(this.mapId, cfg.density);
    this.map = built.map;
    const prev = this.players[0];
    const p = createPlayer(built.spawns[0].x, built.spawns[0].y, 1, '#3b82f6', '1P');
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
    this.bombPass.clear();
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
    const bomb = createBomb(tx, ty, player.id, player.range, now);
    this.bombs.push(bomb);
    // 설치 순간 밟고 있던 엔티티는 폭발 전까지 통과 허용 (갇힘 방지).
    // 반올림 위치 기준이 아니라 설치 시점에 기록해야, 빠져나가는 도중
    // 반올림 칸이 바뀌어도 통과가 유지됨.
    const pass = new Set<string>();
    for (const pl of this.players) {
      if (pl.alive && Math.round(pl.x) === tx && Math.round(pl.y) === ty) {
        pass.add(`p${pl.id}`);
      }
    }
    for (const en of this.enemies) {
      if (en.alive && Math.round(en.x) === tx && Math.round(en.y) === ty) {
        pass.add(`e${en.id}`);
      }
    }
    this.bombPass.set(bomb, pass);
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
    // 온라인 guest는 시뮬레이션 없이 host 스냅샷만 렌더
    if (this.mode === 'online' && this.onlineRole === 'guest') return;
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
      const key = `p${p.id}`;
      if (this.canStandEntity(nx, p.y, key)) p.x = nx;
      if (this.canStandEntity(p.x, ny, key)) p.y = ny;
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
      const key = `e${e.id}`;
      if (this.canStandEntity(nx, e.y, key)) {
        e.x = nx;
      } else {
        e.dx = 0;
        e.retargetAt = 0; // 다음 틱에 즉시 재탐색
      }
      if (this.canStandEntity(e.x, ny, key)) {
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
      if (this.canStandEntity(e.x + d.dx * 0.5, e.y + d.dy * 0.5, `e${e.id}`)) {
        return d;
      }
    }
    return { dx: 0, dy: 0 };
  }

  private inputFor(id: PlayerId): { dx: number; dy: number } {
    // 온라인 host의 P2는 guest가 보낸 입력으로만 조종
    if (this.mode === 'online' && this.onlineRole === 'host' && id === 2) {
      const g = this.guestInput;
      const dx = g.dx !== 0 ? Math.sign(g.dx) : 0;
      let dy = g.dy !== 0 ? Math.sign(g.dy) : 0;
      if (dx !== 0) dy = 0;
      return { dx, dy };
    }
    let dx = 0;
    let dy = 0;
    // 1P: WASD 항상 + 솔로/온라인에선 방향키도 (원작 조작감)
    // (로컬 대전에서 방향키는 2P 차지)
    const p1Arrows = id === 1 && this.mode !== 'battle';
    if (id === 1) {
      if (this.keys.has('a')) dx -= 1;
      if (this.keys.has('d')) dx += 1;
      if (this.keys.has('w')) dy -= 1;
      if (this.keys.has('s')) dy += 1;
      if (p1Arrows) {
        if (this.keys.has('arrowleft')) dx -= 1;
        if (this.keys.has('arrowright')) dx += 1;
        if (this.keys.has('arrowup')) dy -= 1;
        if (this.keys.has('arrowdown')) dy += 1;
      }
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

  private canStandEntity(x: number, y: number, key: string): boolean {
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
      const bomb = this.bombs.find((b) => b.x === tx && b.y === ty);
      if (bomb) {
        // 설치 순간 밟고 있던 엔티티만 통과. 나머지는 진입 불가.
        if (this.bombPass.get(bomb)?.has(key)) return true;
        return false;
      }
      return true;
    });
  }

  private explode(bomb: Bomb, now: number): void {
    this.bombPass.delete(bomb);
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

    this.explosions.push({ id: this.nextFxId++, cells, startedAt: now });
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
    drawMap(ctx, this.map, themeFor(this.mapId));
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
      if (this.mode === 'battle' || this.mode === 'online') {
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
