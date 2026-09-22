import { COLS, ROWS, TILE, Tile } from './constants';
import type { Bomb } from './bomb';
import type { Enemy } from './enemy';
import { ITEM_META, type Item } from './item';
import type { GameMap } from './map';
import type { Player } from './player';

export function drawMap(ctx: CanvasRenderingContext2D, map: GameMap): void {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = map[y][x];
      if (t === Tile.Solid) {
        ctx.fillStyle = '#57534e';
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        ctx.fillStyle = '#78716c';
        ctx.fillRect(x * TILE + 4, y * TILE + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = '#44403c';
        ctx.fillRect(x * TILE + 8, y * TILE + 8, TILE - 16, 4);
      } else if (t === Tile.Block) {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = '#92400e';
        ctx.fillRect(x * TILE + 8, y * TILE + 12, TILE - 16, 3);
        ctx.fillRect(x * TILE + 8, y * TILE + 22, TILE - 16, 3);
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#2a9d3a' : '#279136';
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }
}

export function drawItems(ctx: CanvasRenderingContext2D, items: Item[]): void {
  for (const it of items) {
    const meta = ITEM_META[it.kind];
    const cx = it.x * TILE + TILE / 2;
    const cy = it.y * TILE + TILE / 2;
    const bob = Math.sin(performance.now() / 300 + it.x) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 12, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy + bob, TILE * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = meta.color;
    ctx.beginPath();
    ctx.arc(cx, cy + bob, TILE * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '18px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(meta.emoji, cx, cy + bob + 1);
  }
  ctx.textBaseline = 'alphabetic';
}

export function drawBombs(
  ctx: CanvasRenderingContext2D,
  bombs: Bomb[],
  colorOf: (ownerId: number) => string,
): void {
  const now = performance.now();
  for (const b of bombs) {
    const cx = b.x * TILE + TILE / 2;
    const cy = b.y * TILE + TILE / 2;
    const pulse = 1 + Math.sin(now / 150) * 0.05;
    const r = TILE * 0.32 * pulse;
    const blink = Math.floor(now / 200) % 2 === 0;

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 12, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = blink ? colorOf(b.ownerId) : '#0c4a6e';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 6, 4, 0, Math.PI * 2);
    ctx.fill();
    // 심지 불꽃
    ctx.fillStyle = '#fde047';
    ctx.fillRect(cx - 1, cy - r - 8, 3, 6);
    ctx.fillStyle = blink ? '#f97316' : '#eab308';
    ctx.beginPath();
    ctx.arc(cx, cy - r - 9, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`P${b.ownerId}`, cx, cy + 4);
  }
}

export function drawPlayers(
  ctx: CanvasRenderingContext2D,
  players: Player[],
  now: number,
): void {
  for (const p of players) {
    const cx = p.x * TILE + TILE / 2;
    const cy = p.y * TILE + TILE / 2;
    if (!p.alive) {
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
    const invincible = now < p.invincibleUntil;
    if (invincible && Math.floor(now / 120) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 13, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 몸통
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 5, 5, 0, Math.PI * 2);
    ctx.fill();

    // 방향 눈
    const look =
      p.facing === 'left'
        ? -3
        : p.facing === 'right'
          ? 3
          : 0;
    const lookY = p.facing === 'up' ? -2 : p.facing === 'down' ? 2 : -1;
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 8 + look, cy - 10 + lookY, 6, 7);
    ctx.fillRect(cx + 2 + look, cy - 10 + lookY, 6, 7);
    ctx.fillStyle = '#111';
    ctx.fillRect(cx - 6 + look * 1.5, cy - 8 + lookY, 3, 4);
    ctx.fillRect(cx + 4 + look * 1.5, cy - 8 + lookY, 3, 4);

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, cx, cy + 24);
  }
}

export function drawEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: Enemy[],
): void {
  const now = performance.now();
  for (const e of enemies) {
    if (!e.alive) continue;
    const cx = e.x * TILE + TILE / 2;
    const cy = e.y * TILE + TILE / 2 + Math.sin(now / 250 + e.id) * 2;

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 13, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 몬스터 몸통 (유령)
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * 0.32, Math.PI, 0);
    ctx.lineTo(cx + TILE * 0.32, cy + 10);
    for (let i = 0; i < 3; i++) {
      const zx = cx + TILE * 0.32 - ((i * 2 + 1) * TILE * 0.64) / 6;
      ctx.lineTo(zx, cy + 5 + (i % 2) * 4);
      ctx.lineTo(zx - TILE * 0.64 / 6, cy + 10);
    }
    ctx.closePath();
    ctx.fill();

    // 화난 눈
    const look = e.dx !== 0 ? Math.sign(e.dx) * 2 : 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 6 + look, cy - 3, 5, 0, Math.PI * 2);
    ctx.arc(cx + 6 + look, cy - 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(cx - 6 + look, cy - 2, 2.2, 0, Math.PI * 2);
    ctx.arc(cx + 6 + look, cy - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
