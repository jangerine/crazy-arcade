import './style.css';
import { COLS, ROWS, TILE } from './game/constants';
import { Engine } from './game/engine';

const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.width = COLS * TILE;
canvas.height = ROWS * TILE;
const ctx = canvas.getContext('2d')!;

const engine = new Engine();
let last = performance.now();

function loop(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  engine.update(dt);
  engine.render(ctx);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
