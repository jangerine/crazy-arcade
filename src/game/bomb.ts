import { BOMB_FUSE_MS, BOMB_RANGE } from './constants';
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
  now: number = performance.now(),
): Bomb {
  return { x, y, placedAt: now, range: BOMB_RANGE, ownerId };
}

export function isBombReadyToExplode(b: Bomb, now: number): boolean {
  return now - b.placedAt >= BOMB_FUSE_MS;
}
