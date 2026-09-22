import { COLS, ROWS, TILE, Tile } from './constants';
import type { Bomb } from './bomb';
import type { Enemy } from './enemy';
import { ITEM_META, type Item } from './item';
import type { GameMap } from './map';
import type { MapTheme } from './maps';
import type { Player } from './player';

/** 좌표 해시 (장식 배치용, 고정 난수) */
function hash01(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function drawMap(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  theme: MapTheme,
): void {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = map[y][x];
      const px = x * TILE;
      const py = y * TILE;
      if (t === Tile.Solid) {
        // 파괴불가: 석재/금속 기둥
        ctx.fillStyle = theme.solid;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = theme.solidHi;
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = theme.solidLine;
        ctx.fillRect(px + 8, py + 8, TILE - 16, 4);
        ctx.fillRect(px + 8, py + TILE - 12, TILE - 16, 4);
      } else if (t === Tile.Block) {
        // 파괴가능: 나무 상자
        ctx.fillStyle = theme.blockLine;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = theme.block;
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = theme.blockHi;
        ctx.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
        // 나무결 + 못
        ctx.fillStyle = theme.blockLine;
        ctx.fillRect(px + 8, py + 14, TILE - 16, 2);
        ctx.fillRect(px + 8, py + 24, TILE - 16, 2);
        ctx.beginPath();
        ctx.arc(px + 8, py + 8, 2, 0, Math.PI * 2);
        ctx.arc(px + TILE - 8, py + 8, 2, 0, Math.PI * 2);
        ctx.arc(px + 8, py + TILE - 8, 2, 0, Math.PI * 2);
        ctx.arc(px + TILE - 8, py + TILE - 8, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 바닥 체커 + 테마 장식
        ctx.fillStyle = (x + y) % 2 === 0 ? theme.grassA : theme.grassB;
        ctx.fillRect(px, py, TILE, TILE);
        const h = hash01(x, y);
        if (theme.decor === 'flower' && h < 0.22) {
          ctx.fillStyle = '#2f7a3a';
          ctx.fillRect(px + 8, py + 22, 2, 8);
          ctx.fillStyle = h < 0.11 ? '#fff' : '#fde047';
          ctx.beginPath();
          ctx.arc(px + 9, py + 20, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (theme.decor === 'shell' && h < 0.2) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath();
          ctx.arc(px + 28, py + 28, 3, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = 'rgba(180,140,90,0.6)';
          ctx.fillRect(px + 10, py + 10, 3, 3);
        } else if (theme.decor === 'snow' && h < 0.25) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillRect(px + 19, py + 8, 2, 10);
          ctx.fillRect(px + 15, py + 12, 10, 2);
        } else if (theme.decor === 'star' && h < 0.15) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath();
          ctx.arc(px + 30, py + 10, 2, 0, Math.PI * 2);
          ctx.arc(px + 10, py + 30, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
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
    const cy = b.y * TILE + TILE / 2 + 1;
    const pulse = 1 + Math.sin(now / 150) * 0.06;
    const r = TILE * 0.3 * pulse;
    const blink = Math.floor(now / 200) % 2 === 0;
    const body = blink ? colorOf(b.ownerId) : '#0c4a6e';

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 12, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 매듭
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - r + 2);
    ctx.lineTo(cx + 4, cy - r + 2);
    ctx.lineTo(cx, cy - r - 5);
    ctx.closePath();
    ctx.fill();

    // 풍선 몸통 (원작 물풍선 느낌)
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // 광택
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.28, r * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fill();
    // 물방울 무늬
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(cx + r * 0.35, cy + r * 0.3, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
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

    const r = TILE * 0.32;
    // 외곽선
    ctx.fillStyle = 'rgba(15,23,42,0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.fill();
    // 몸통
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // 배 (밝게)
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.45, r * 0.55, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // 방향 눈 (흰자+동공+광택)
    const look = p.facing === 'left' ? -3 : p.facing === 'right' ? 3 : 0;
    const lookY = p.facing === 'up' ? -2 : p.facing === 'down' ? 2 : 0;
    for (const ex of [-6.5, 3.5]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(cx + ex + look, cy - 3 + lookY, 4.6, 5.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(cx + ex + look * 1.4, cy - 2 + lookY, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx + ex + look * 1.4 - 0.8, cy - 2.8 + lookY, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    // 볼터치 + 입
    ctx.fillStyle = 'rgba(255,120,120,0.55)';
    ctx.beginPath();
    ctx.arc(cx - 9 + look, cy + 4, 2.2, 0, Math.PI * 2);
    ctx.arc(cx + 9 + look, cy + 4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx + look, cy + 4, 3.2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, cx, cy + 25);
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

    // 몬스터 몸통 (유령) + 외곽선
    const r = TILE * 0.32;
    ctx.fillStyle = 'rgba(15,23,42,0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, Math.PI, 0);
    ctx.lineTo(cx + r + 2, cy + 11);
    ctx.lineTo(cx - r - 2, cy + 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.lineTo(cx + r, cy + 10);
    for (let i = 0; i < 3; i++) {
      const zx = cx + r - ((i * 2 + 1) * r * 2) / 6;
      ctx.lineTo(zx, cy + 5 + (i % 2) * 4);
      ctx.lineTo(zx - (r * 2) / 6, cy + 10);
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
    // 눈썹
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 10 + look, cy - 9);
    ctx.lineTo(cx - 2 + look, cy - 6);
    ctx.moveTo(cx + 10 + look, cy - 9);
    ctx.lineTo(cx + 2 + look, cy - 6);
    ctx.stroke();
  }
}
