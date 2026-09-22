import { BOMB_FUSE_MS, BOMB_RANGE } from './constants';

export interface Bomb {
  x: number;
  y: number;
  placedAt: number;
  range: number;
}

export interface Explosion {
  cells: { x: number; y: number }[];
  startedAt: number;
}

export function createBomb(x: number, y: number): Bomb {
  return { x, y, placedAt: performance.now(), range: BOMB_RANGE };
}

export function isBombReadyToExplode(b: Bomb, now: number): boolean {
  return now - b.placedAt >= BOMB_FUSE_MS;
}
