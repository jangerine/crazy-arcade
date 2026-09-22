import type { Player } from './player';

export type ItemKind = 'bomb' | 'range' | 'speed';

export interface Item {
  x: number;
  y: number;
  kind: ItemKind;
}

// 밸런스
export const ITEM_DROP_RATE = 0.35;
export const MAX_BOMBS = 6;
export const MAX_RANGE = 8;
export const BASE_SPEED = 5;
export const SPEED_STEP = 0.8;
export const MAX_SPEED = 8.5;

export const ITEM_META: Record<
  ItemKind,
  { emoji: string; label: string; color: string }
> = {
  bomb: { emoji: '🎈', label: '물풍선+1', color: '#0ea5e9' },
  range: { emoji: '💧', label: '물줄기+1', color: '#fb923c' },
  speed: { emoji: '⚡', label: '스피드업', color: '#facc15' },
};

const KINDS: ItemKind[] = ['bomb', 'range', 'speed'];

export function rollItem(x: number, y: number): Item | null {
  if (Math.random() >= ITEM_DROP_RATE) return null;
  const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
  return { x, y, kind };
}

export function applyItem(player: Player, kind: ItemKind): void {
  if (kind === 'bomb') {
    player.maxBombs = Math.min(player.maxBombs + 1, MAX_BOMBS);
  } else if (kind === 'range') {
    player.range = Math.min(player.range + 1, MAX_RANGE);
  } else {
    player.speed = Math.min(
      Math.round((player.speed + SPEED_STEP) * 10) / 10,
      MAX_SPEED,
    );
  }
}
