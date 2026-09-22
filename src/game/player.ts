export interface Player {
  // 타일 좌표 (실수: 부드러운 이동용)
  x: number;
  y: number;
  speed: number; // tiles/sec
  maxBombs: number;
  color: string;
}

export function createPlayer(x: number, y: number): Player {
  return { x, y, speed: 5, maxBombs: 1, color: '#3b82f6' };
}
