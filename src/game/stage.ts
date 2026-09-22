export interface StageConfig {
  stage: number;
  enemies: number;
  enemySpeed: number;
  density: number;
}

export function stageConfig(stage: number): StageConfig {
  return {
    stage,
    enemies: Math.min(2 + stage, 7),
    enemySpeed: Math.min(2.2 + stage * 0.35, 4.6),
    density: Math.min(0.55 + stage * 0.02, 0.7),
  };
}
