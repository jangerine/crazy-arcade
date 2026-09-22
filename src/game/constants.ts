export const TILE = 40;
export const COLS = 15;
export const ROWS = 13;

export const enum Tile {
  Empty = 0,
  Solid = 1, // 파괴 불가
  Block = 2, // 파괴 가능
}

export const BOMB_FUSE_MS = 2500;
export const BOMB_RANGE = 2;
export const EXPLOSION_MS = 500;
