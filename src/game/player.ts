export type PlayerId = 1 | 2;
export type Facing = 'up' | 'down' | 'left' | 'right';

export interface Player {
  id: PlayerId;
  name: string;
  // 타일 좌표 (실수: 부드러운 이동용)
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  speed: number; // tiles/sec
  maxBombs: number;
  range: number; // 물줄기 길이
  color: string;
  alive: boolean;
  lives: number; // 솔로 모드용
  facing: Facing;
  invincibleUntil: number;
}

export function createPlayer(
  x: number,
  y: number,
  id: PlayerId,
  color: string,
  name: string,
): Player {
  return {
    id,
    name,
    x,
    y,
    spawnX: x,
    spawnY: y,
    speed: 5,
    maxBombs: 1,
    range: 2,
    color,
    alive: true,
    lives: 3,
    facing: 'down',
    invincibleUntil: 0,
  };
}
