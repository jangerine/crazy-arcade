import { COLS, ROWS, Tile } from './constants';

export type GameMap = Tile[][];

// 크아 클래식 느낌: 가장자리 + 격자형 Solid, 나머지는 랜덤 Block
export function createMap(
  density = 0.6,
  clearZones: { x: number; y: number }[] = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 2 },
    { x: COLS - 2, y: ROWS - 2 },
    { x: COLS - 3, y: ROWS - 2 },
    { x: COLS - 2, y: ROWS - 3 },
  ],
): GameMap {
  const map: GameMap = [];
  const clear = new Set(clearZones.map((z) => `${z.x},${z.y}`));
  for (let y = 0; y < ROWS; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < COLS; x++) {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
        row.push(Tile.Solid);
      } else if (x % 2 === 0 && y % 2 === 0) {
        row.push(Tile.Solid);
      } else if (clear.has(`${x},${y}`)) {
        row.push(Tile.Empty);
      } else {
        row.push(Math.random() < density ? Tile.Block : Tile.Empty);
      }
    }
    map.push(row);
  }
  return map;
}

export function isWalkable(map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
  return map[y][x] === Tile.Empty;
}
