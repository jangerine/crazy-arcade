import './style.css';
import { COLS, ROWS, TILE } from './game/constants';
import { Engine, type TouchDir } from './game/engine';
import type { PlayerId } from './game/player';

const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.width = COLS * TILE;
canvas.height = ROWS * TILE;
const ctx = canvas.getContext('2d')!;

const engine = new Engine();
const hud = document.getElementById('hud') as HTMLDivElement;
const restartBtn = document.getElementById('restartBtn') as HTMLButtonElement;

restartBtn.addEventListener('click', () => engine.restart());

// --- 터치 디바이스 감지 ---
const isTouch =
  window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

function updateHud(): void {
  hud.innerHTML = engine.players
    .map((p) => {
      const status = p.alive ? '🟢' : '💀';
      return `<div class="card"><span style="color:${p.color}">●</span> ${p.name} ${status} · 🎈${p.maxBombs} · 💧${p.range} · ⚡${p.speed.toFixed(1)}</div>`;
    })
    .join('');
}

// --- 터치 컨트롤 배선 (멀티터치 대응: pointer 이벤트) ---
function bindTouch(): void {
  document.querySelectorAll<HTMLDivElement>('.pad').forEach((pad) => {
    const pid = Number(pad.dataset.player) as PlayerId;
    pad.querySelectorAll<HTMLButtonElement>('button[data-dir]').forEach((btn) => {
      const dir = btn.dataset.dir as TouchDir;
      const down = (e: PointerEvent): void => {
        e.preventDefault();
        btn.setPointerCapture?.(e.pointerId);
        btn.classList.add('active');
        engine.touchDown(pid, dir);
      };
      const up = (e: PointerEvent): void => {
        e.preventDefault();
        btn.classList.remove('active');
        engine.touchUp(pid, dir);
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', () => {
        btn.classList.remove('active');
        engine.touchUp(pid, dir);
      });
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    const bomb = pad.querySelector<HTMLButtonElement>('button[data-bomb]');
    bomb?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      engine.pressBomb(pid);
    });
  });

  // 캔버스 터치 스크롤 방지
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), {
    passive: false,
  });
  canvas.addEventListener('touchmove', (e) => e.preventDefault(), {
    passive: false,
  });
}

bindTouch();

let last = performance.now();

function loop(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  engine.update(dt);
  engine.render(ctx);
  updateHud();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
