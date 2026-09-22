import { COLS, ROWS, Tile } from './constants';

export type GameMap = Tile[][];

// 크아 클래식 느낌: 가장자리 + 격자형 Solid, 나머지는 랜덤 Block
export function createMap(): GameMap {
  const map: GameMap = [];
  for (let y = 0; y < ROWS; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < COLS; x++) {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
        row.push(Tile.Solid);
      } else if (x % 2 === 0 && y % 2 === 0) {
        row.push(Tile.Solid);
      } else {
        // 스폰 구역(좌상/우하 3칸)은 비워두기
        const isSpawn =
          (x <= 2 && y <= 2) || (x >= COLS - 3 && y >= ROWS - 3);
        row.push(
          !isSpawn && Math.random() < 0.6 ? Tile.Block : Tile.Empty,
        );
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
