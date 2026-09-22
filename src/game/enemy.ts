import { COLS, ROWS, Tile } from './constants';
import type { GameMap } from './map';
import type { Player } from './player';
import { stageConfig } from './stage';

export interface Enemy {
  id: number;
  x: number;
  y: number;
  speed: number;
  alive: boolean;
  color: string;
  dx: number;
  dy: number;
  retargetAt: number;
}

const ENEMY_COLORS = [
  '#a855f7',
  '#ec4899',
  '#f97316',
  '#84cc16',
  '#14b8a6',
  '#eab308',
  '#f43f5e',
];

function emptyTiles(map: GameMap): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (map[y][x] === Tile.Empty) out.push({ x, y });
    }
  }
  return out;
}

export function spawnEnemies(
  stage: number,
  map: GameMap,
  players: Player[],
  now: number = performance.now(),
): Enemy[] {
  const cfg = stageConfig(stage);
  const spots = emptyTiles(map).filter((t) =>
    players.every(
      (p) => Math.abs(p.x - t.x) + Math.abs(p.y - t.y) > 5,
    ),
  );
  const pool = spots.length > 0 ? spots : emptyTiles(map);
  const enemies: Enemy[] = [];
  for (let i = 0; i < cfg.enemies && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const [spot] = pool.splice(idx, 1);
    enemies.push({
      id: i,
      x: spot.x,
      y: spot.y,
      speed: cfg.enemySpeed * (0.9 + Math.random() * 0.2),
      alive: true,
      color: ENEMY_COLORS[i % ENEMY_COLORS.length],
      dx: 0,
      dy: 0,
      retargetAt: now + Math.random() * 500,
    });
  }
  return enemies;
}
