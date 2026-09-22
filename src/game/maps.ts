import { COLS, ROWS, Tile } from './constants';
import { createMap, type GameMap } from './map';

// 원작 오마주 맵팩. 캠프08(중앙 세로 철조망·좌우 대칭 진영) 포함.
// 표기: '#' 파괴불가, 'X' 파괴가능 블록, '.' 빈칸, '1'/'2' 스폰.
// 스폰 주변 +자 4칸은 파서가 자동 정리해서 갇히지 않음.

export type MapDecor = 'flower' | 'shell' | 'snow' | 'star' | 'none';

export interface MapTheme {
  grassA: string;
  grassB: string;
  solid: string;
  solidHi: string;
  solidLine: string;
  block: string;
  blockHi: string;
  blockLine: string;
  decor: MapDecor;
}

export interface MapDef {
  id: string;
  name: string;
  desc: string;
  theme: MapTheme;
  rows?: string[];
  random?: boolean;
}

const CAMP_THEME: MapTheme = {
  grassA: '#4a9e4f',
  grassB: '#418a45',
  solid: '#5a6b35',
  solidHi: '#7d8f4c',
  solidLine: '#3c4823',
  block: '#c98f4e',
  blockHi: '#e8b06e',
  blockLine: '#8a5a28',
  decor: 'flower',
};

const PIRATE_THEME: MapTheme = {
  grassA: '#dfc084',
  grassB: '#d2af6e',
  solid: '#6b4a2f',
  solidHi: '#8f6642',
  solidLine: '#4a3120',
  block: '#b9884f',
  blockHi: '#d9a866',
  blockLine: '#7d5a2e',
  decor: 'shell',
};

const SNOW_THEME: MapTheme = {
  grassA: '#e9f1f9',
  grassB: '#d8e6f4',
  solid: '#7d9bb5',
  solidHi: '#a5c2d8',
  solidLine: '#57748c',
  block: '#a9cbe8',
  blockHi: '#cfe4f7',
  blockLine: '#6f97b8',
  decor: 'snow',
};

const ARENA_THEME: MapTheme = {
  grassA: '#3d9e57',
  grassB: '#358a4c',
  solid: '#4a4a52',
  solidHi: '#6e6e78',
  solidLine: '#2e2e34',
  block: '#d8a24a',
  blockHi: '#f2c063',
  blockLine: '#96691f',
  decor: 'star',
};

const MAZE_THEME: MapTheme = {
  grassA: '#2f7a44',
  grassB: '#286539',
  solid: '#3f3f4d',
  solidHi: '#5e5e70',
  solidLine: '#26262e',
  block: '#8f6b3d',
  blockHi: '#b08a52',
  blockLine: '#5f4726',
  decor: 'none',
};

const RANDOM_THEME: MapTheme = {
  grassA: '#2a9d3a',
  grassB: '#279136',
  solid: '#57534e',
  solidHi: '#78716c',
  solidLine: '#44403c',
  block: '#b45309',
  blockHi: '#f59e0b',
  blockLine: '#92400e',
  decor: 'flower',
};

export const MAPS: MapDef[] = [
  {
    id: 'camp08',
    name: '캠프 08',
    desc: '중앙 철조망·좌우 대칭 진영 (오마주)',
    theme: CAMP_THEME,
    rows: [
      '###############',
      '#..X...#...X..#',
      '#.X.X.X#X.X.X.#',
      '#..X.......X..#',
      '#XX.##.#.##.XX#',
      '#X...#.#.#...X#',
      '#1...X###X...2#',
      '#X...#.#.#...X#',
      '#XX.##.#.##.XX#',
      '#..X.......X..#',
      '#.X.X.X#X.X.X.#',
      '#..X...#...X..#',
      '###############',
    ],
  },
  {
    id: 'pirate',
    name: '해적선',
    desc: '갑판 중앙 돛대·선실',
    theme: PIRATE_THEME,
    rows: [
      '###############',
      '#1.X.....X...X#',
      '#..X..X.X..X..#',
      '#X.###...###.X#',
      '#X.X.....X.X..#',
      '#..X.#####.X..#',
      '#..X.#...#.X..#',
      '#..X.#####.X..#',
      '#..X.X.....X.X#',
      '#X.###...###.X#',
      '#..X..X.X..X..#',
      '#X...X.....X.2#',
      '###############',
    ],
  },
  {
    id: 'snow',
    name: '설원',
    desc: '얼음 기둥·눈밭',
    theme: SNOW_THEME,
    rows: [
      '###############',
      '#1...X...X....#',
      '#.X.X.X.X.X.X.#',
      '#X..X.....X..X#',
      '#.X..#####..X.#',
      '#X.X.......X.X#',
      '#..X.X.#.X.X..#',
      '#X.X.......X.X#',
      '#.X..#####..X.#',
      '#X..X.....X..X#',
      '#.X.X.X.X.X.X.#',
      '#....X...X...2#',
      '###############',
    ],
  },
  {
    id: 'arena',
    name: '경기장',
    desc: '탁 트인 결전장',
    theme: ARENA_THEME,
    rows: [
      '###############',
      '#1....X...X...#',
      '#.X.......X...#',
      '#XX.##...##.XX#',
      '#X....X.X....X#',
      '#..X..X.X..X..#',
      '#...X.....X...#',
      '#..X..X.X..X..#',
      '#X....X.X....X#',
      '#XX.##...##.XX#',
      '#...X.......X.#',
      '#...X...X....2#',
      '###############',
    ],
  },
  {
    id: 'maze',
    name: '미로',
    desc: '빽빽한 석벽 미로',
    theme: MAZE_THEME,
    rows: [
      '###############',
      '#1#.X...X..#..#',
      '#.#.#.#.#.#.#.#',
      '#X...#...#...X#',
      '##.##.###.##.##',
      '#X..X.....X..X#',
      '#.###..#..###.#',
      '#X..X.....X..X#',
      '##.##.###.##.##',
      '#X...#...#...X#',
      '#.#.#.#.#.#.#.#',
      '#..#..X...X.#2#',
      '###############',
    ],
  },
  {
    id: 'random',
    name: '랜덤',
    desc: '매번 바뀌는 블록',
    theme: RANDOM_THEME,
    random: true,
  },
];

export const DEFAULT_MAP_ID = 'camp08';

export function getMapDef(id: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}

export interface BuiltMap {
  map: GameMap;
  spawns: [{ x: number; y: number }, { x: number; y: number }];
}

const FALLBACK_SPAWNS = [
  { x: 1, y: 1 },
  { x: COLS - 2, y: ROWS - 2 },
] as [{ x: number; y: number }, { x: number; y: number }];

/** ASCII 맵 파싱 + 스폰 주변 +자 정리 */
export function parseMapDef(def: MapDef): BuiltMap {
  if (def.random || !def.rows) {
    return { map: createMap(0.6), spawns: FALLBACK_SPAWNS };
  }
  const map: GameMap = [];
  let s1 = { x: 1, y: 1 };
  let s2 = { x: COLS - 2, y: ROWS - 2 };
  for (let y = 0; y < ROWS; y++) {
    const row: Tile[] = [];
    const line = def.rows[y] ?? '';
    for (let x = 0; x < COLS; x++) {
      const c = line[x] ?? '#';
      if (c === '#') row.push(Tile.Solid);
      else if (c === 'X') row.push(Tile.Block);
      else {
        row.push(Tile.Empty);
        if (c === '1') s1 = { x, y };
        if (c === '2') s2 = { x, y };
      }
    }
    map.push(row);
  }
  // 스폰 + 상하좌우 정리 (갇힘 방지)
  for (const s of [s1, s2]) {
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = s.x + dx;
      const y = s.y + dy;
      if (x <= 0 || y <= 0 || x >= COLS - 1 || y >= ROWS - 1) continue;
      if (map[y][x] !== Tile.Solid) map[y][x] = Tile.Empty;
    }
  }
  return { map, spawns: [s1, s2] };
}

export const MAP_STORAGE_KEY = 'ca_map';

export function loadMapId(): string {
  try {
    const id = localStorage.getItem(MAP_STORAGE_KEY);
    if (id && MAPS.some((m) => m.id === id)) return id;
  } catch {
    // 무시
  }
  return DEFAULT_MAP_ID;
}

export function saveMapId(id: string): void {
  try {
    localStorage.setItem(MAP_STORAGE_KEY, id);
  } catch {
    // 무시
  }
}

/** 선택된 맵 빌드 (random은 매번 새로 생성, density 지정 가능) */
export function buildSelectedMap(mapId: string, density = 0.6): BuiltMap {
  const def = getMapDef(mapId);
  if (def.random || !def.rows) {
    return { map: createMap(density), spawns: FALLBACK_SPAWNS };
  }
  return parseMapDef(def);
}

export function themeFor(mapId: string): MapTheme {
  return getMapDef(mapId).theme;
}
