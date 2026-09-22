import { BOMB_FUSE_MS } from './constants';
import type { PlayerId } from './player';

export interface Bomb {
  x: number;
  y: number;
  placedAt: number;
  range: number;
  ownerId: PlayerId;
}

export interface Explosion {
  cells: { x: number; y: number }[];
  startedAt: number;
}

export function createBomb(
  x: number,
  y: number,
  ownerId: PlayerId,
  range: number,
  now: number = performance.now(),
): Bomb {
  return { x, y, placedAt: now, range, ownerId };
}

export function isBombReadyToExplode(b: Bomb, now: number): boolean {
  return now - b.placedAt >= BOMB_FUSE_MS;
}
